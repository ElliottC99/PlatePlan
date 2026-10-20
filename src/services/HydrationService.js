/**
 * src/services/HydrationService.js (v3.38.5)
 * Orchestrates concurrent fetching and real-time Firebase subscriptions.
 * Delegates maintenance routines to CacheMaintenanceService.js.
 */

import { getRecipes, getIngredients, getProducts, getPreferences, getCurrentPlan, subscribeRecipes, subscribeIngredients, subscribeProducts, subscribePreferences, subscribeCurrentPlan, getCategories, saveCategories, saveIngredient, cleanLegacyMacros } from './HouseholdRepository.js';
import { getInventory } from './InventoryRepository.js';
import { getCurrentActivePlan as getActivePlanFromSubcollection } from './PlanRepository.js';
import { setRecipes, setIngredients, setProducts, setPreferences, setCurrentPlan, saveStateCache, setCategories, setInventory, sanitizePreferences, updateState } from '../store/store.js';
import { compareProductsByStrategy } from '../models/PantryHierarchyModel.js';
import { waitForAuth } from './AuthService.js';
import { runDeferredMaintenance } from './CacheMaintenanceService.js';

export { waitForAuth };

export const CANONICAL_CATEGORIES = [
  'Baking, Chocolate and Sweets', 'Beverages', 'Carbs', 'Dairy', 'Fruit & Vegetables',
  'Grains, Nuts and Seeds', 'Herbs & Spices', 'Meat Substitutes', 'Other',
  'Sauces, Condiments & Pastes', 'Store Cupboard', 'Supplements', 'Tofu, Tempeh and Seitan'
];

export function getCategoryName(cat) {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.name || cat.categoryName || cat.id || '';
}

export async function sweepAndRecalibrateIngredientDefaults() {
  const state = window.Store?.getState?.() || {};
  const ingredients = state.ingredients || (window.state?.ingredients || []);
  const products = state.products || (window.state?.products || []);
  const criterion = state.settings?.autoDefaultStrategy || state.settings?.autoDefaultCriterion || state.userPrefs?.autoDefaultStrategy || state.userPrefs?.autoDefaultCriterion || window.state?.settings?.autoDefaultStrategy || window.state?.settings?.autoDefaultCriterion || window.state?.userPrefs?.autoDefaultStrategy || window.state?.userPrefs?.autoDefaultCriterion || 'lowest_absolute_price';
  let updatedCount = 0;

  const updatedIngredients = ingredients.map(ing => {
    const nestedSubtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    const subtypeIdentifiers = nestedSubtypes.flatMap(s => [
      String(s.id || ''), String(s.name || ''), String(s.subtypeId || '')
    ].filter(Boolean));

    const matchedProducts = products.filter(p => {
      const pIngId = String(p.ingredientId || p.ingredient_id || p.groupId || '');
      const pSubId = String(p.subtypeId || p.subTypeId || p.sub_type_id || '');
      return pIngId === String(ing.id) || subtypeIdentifiers.includes(pSubId);
    });

    if (matchedProducts.length > 0) {
      const bestProduct = compareProductsByStrategy(matchedProducts, criterion);
      if (bestProduct && String(ing.defaultProductId || '') !== String(bestProduct.id)) {
        updatedCount++;
        return { ...ing, defaultProductId: bestProduct.id, updatedAt: new Date().toISOString() };
      }
    }
    return ing;
  });

  if (updatedCount > 0) {
    setIngredients(updatedIngredients);
    if (window.state) window.state.ingredients = updatedIngredients;
    try {
      for (const ing of updatedIngredients) {
        if (ing.defaultProductId) {
          await saveIngredient(ing);
        }
      }
      console.log(`[HydrationService] Repaired and recalibrated defaults for ${updatedCount} ingredients.`);
    } catch (err) {
      console.warn('[HydrationService] Failed persisting repaired ingredient defaults:', err);
    }
  }
  return updatedCount;
}

if (typeof window !== 'undefined') {
  window.sweepAndRecalibrateIngredientDefaults = sweepAndRecalibrateIngredientDefaults;
}

export function mergeCanonicalCategories(rawCategories) {
  const categories = Array.isArray(rawCategories) ? [...rawCategories] : [];
  return { categories, mutated: false };
}

export function normalizeProductRecord(p) {
  if (!p || typeof p !== 'object') return p;
  const subtypeId = p.subtypeId ?? p.subTypeId ?? p.sub_type_id ?? null;
  const ingredientId = p.ingredientId ?? p.ingredient_id ?? p.groupId ?? null;
  const category = p.category ?? p.category_id ?? p.categoryName ?? p.cat ?? 'Other';
  const rawPackSize = p.packSize ?? p.pack_size ?? p.pack_size_g ?? p.pack_weight ?? p.packageSize ?? p.size ?? p.pack ?? p.itemWeight ?? 0;
  let packSize = 0;
  if (typeof rawPackSize === 'string') {
    const matched = rawPackSize.match(/[\d\.]+/);
    packSize = matched ? parseFloat(matched[0]) : 0;
  } else {
    packSize = Number(rawPackSize) || 0;
  }
  const kcal = Number(p.kcal ?? p.calories ?? p.energy_kcal ?? p.cal ?? 0);
  const protein = Number(p.protein ?? p.protein_g ?? p.prot ?? 0);
  return { ...p, subtypeId, ingredientId, category, packSize, pack: packSize, kcal, cal: kcal, protein, prot: protein };
}

export function normalizeIngredientRecord(i) {
  if (!i || typeof i !== 'object') return i;
  const category = i.category ?? i.category_id ?? i.categoryName ?? i.cat ?? 'Other';
  const subtypes = Array.isArray(i.subtypes) ? i.subtypes.map(st => ({
    ...st,
    category: st.category ?? st.categoryName ?? category,
    cat: st.cat ?? slugifyToKebab(st.category ?? category)
  })) : [];
  return { ...i, category, subtypes };
}

function slugifyToKebab(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let activeHydrationPromise = null;

export async function hydrateHouseholdData(options = {}) {
  const { force = false } = options;
  if (activeHydrationPromise && !force) return activeHydrationPromise;

  activeHydrationPromise = (async () => {
    const authed = await waitForAuth(15000);
    if (!authed) {
      console.error('[Sync] Universal sync aborted: User unauthenticated after auth barrier timeout.');
      return { success: false, unauthenticated: true };
    }
    const uid = authed.uid;

    try {
      const [recipes, rawIngredients, rawProducts, preferencesData, legacyPlan, rawCategories, inventoryItems, subcollPlan] = await Promise.all([
        getRecipes(uid).catch(e => { console.warn('[HydrationService] getRecipes fallback:', e?.message || e); return []; }),
        getIngredients(uid).catch(e => { console.warn('[HydrationService] getIngredients fallback:', e?.message || e); return []; }),
        getProducts(uid).catch(e => { console.warn('[HydrationService] getProducts fallback:', e?.message || e); return []; }),
        getPreferences(uid).catch(e => { console.warn('[HydrationService] getPreferences fallback:', e?.message || e); return null; }),
        getCurrentPlan(uid).catch(e => { console.warn('[HydrationService] getCurrentPlan fallback:', e?.message || e); return null; }),
        getCategories(uid).catch(e => { console.warn('[HydrationService] getCategories fallback:', e?.message || e); return []; }),
        getInventory(uid).catch(e => { console.warn('[HydrationService] getInventory fallback:', e?.message || e); return []; }),
        getActivePlanFromSubcollection(uid).catch(e => { console.warn('[HydrationService] getActivePlan fallback:', e?.message || e); return null; })
      ]);
      const plan = subcollPlan || legacyPlan;

      const sanitizedPrefs = sanitizePreferences(preferencesData);

      const ingredients = (rawIngredients || []).map(normalizeIngredientRecord);
      const products = (rawProducts || []).map(normalizeProductRecord);
      const { categories: mergedCategories, mutated } = mergeCanonicalCategories(rawCategories);

      const currentStoreState = (typeof window !== 'undefined' && window.Store?.getState?.()) || {};

      if (Array.isArray(recipes) && recipes.length > 0) {
        setRecipes(recipes);
      } else if (!currentStoreState.recipes || currentStoreState.recipes.length === 0) {
        setRecipes([]);
      }

      if (Array.isArray(ingredients) && ingredients.length > 0) {
        setIngredients(ingredients);
      } else if (!currentStoreState.ingredients || currentStoreState.ingredients.length === 0) {
        setIngredients([]);
      }

      if (Array.isArray(products) && products.length > 0) {
        setProducts(products);
      } else if (!currentStoreState.products || currentStoreState.products.length === 0) {
        setProducts([]);
      }

      if (sanitizedPrefs && Object.keys(sanitizedPrefs).length > 0) {
        setPreferences(sanitizedPrefs);
      }

      if (plan) {
        setCurrentPlan(plan);
      }

      if (Array.isArray(mergedCategories) && mergedCategories.length > 0) {
        setCategories(mergedCategories);
      }

      if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
        setInventory(inventoryItems);
      }

      if (typeof window !== 'undefined') {
        if (!window.state) { try { window.state = {}; } catch (e) {} }
        const docData = sanitizedPrefs || {};
        const userPrefs = docData.userPrefs || docData;
        window.state.settings = { ...(window.state.settings || {}), ...(docData.settings || {}) };
        const strat = userPrefs.autoDefaultStrategy || userPrefs.autoDefaultCriterion || docData.settings?.autoDefaultStrategy || docData.settings?.autoDefaultCriterion;
        if (strat) {
          window.state.settings.autoDefaultStrategy = strat;
          window.state.settings.autoDefaultCriterion = strat;
          if (!window.state.userPrefs) window.state.userPrefs = {};
          window.state.userPrefs.autoDefaultStrategy = strat;
          window.state.userPrefs.autoDefaultCriterion = strat;
        }
        const cloudHasData = (Array.isArray(recipes) && recipes.length > 0) || (Array.isArray(ingredients) && ingredients.length > 0) || Boolean(plan);
        if (cloudHasData) {
          window.state.isCloudHydrated = true;
        }
        window.state.ingredients = ingredients;
        window.state.products = products;
        window.state.categories = mergedCategories;
        if (plan && typeof plan === 'object') {
          window.state.plan = plan;
          if (plan.skeletonGrid && typeof plan.skeletonGrid === 'object') {
            window.state.skeletonGrid = plan.skeletonGrid;
          }
        }

        window.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: window.state.ingredients }));
        window.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: products }));

        window.state.userPrefs = {
          ...window.state.userPrefs,
          ...userPrefs,
          favouriteVariantIds: Array.isArray(userPrefs.favouriteVariantIds) ? userPrefs.favouriteVariantIds : (window.state.userPrefs?.favouriteVariantIds || []),
          favourites: Array.isArray(userPrefs.favourites) ? userPrefs.favourites : (window.state.userPrefs?.favourites || [])
        };

        const rawProfiles = docData.profiles || userPrefs.profiles || {};
        const docTargets = docData.nutritionTargets || userPrefs.nutritionTargets || {};
        const docMealSplits = docData.mealSplits || userPrefs.mealSplits || {};
        const profileIds = Array.from(new Set([...Object.keys(rawProfiles), ...Object.keys(docTargets), 'elliott', 'chloe']));
        const hydratedProfiles = {};
        profileIds.forEach(pid => {
          hydratedProfiles[pid] = {
            id: pid,
            name: pid.charAt(0).toUpperCase() + pid.slice(1),
            avatar: rawProfiles[pid]?.avatar || (pid === 'elliott' ? '🧔‍♂️' : '👩‍🦰'),
            colour: rawProfiles[pid]?.colour || (pid === 'elliott' ? '#3b82f6' : '#ec4899'),
            nutritionTargets: docTargets[pid] || rawProfiles[pid]?.nutritionTargets || { calories: 2000, protein: 125, carbs: 200, fat: 70 },
            mealSplits: docMealSplits[pid] || rawProfiles[pid]?.mealSplits || { breakfast: 0.25, lunch: 0.35, dinner: 0.40 }
          };
        });
        window.state.profiles = hydratedProfiles;
      }

      setupRealtimeSubscriptions();
      saveStateCache();

      runDeferredMaintenance(preferencesData, mergedCategories, mutated, saveCategories);

      return { success: true, recipesCount: recipes.length, ingredientsCount: ingredients.length, productsCount: products.length };
    } catch (err) {
      console.error('[HydrationService] Critical hydration failure (detailed):', err, err.stack);
      return { success: false, error: err };
    } finally {
      activeHydrationPromise = null;
    }
  })();

  return activeHydrationPromise;
}

let unsubs = [];
function setupRealtimeSubscriptions() {
  if (unsubs.length > 0) {
    unsubs.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
    unsubs = [];
  }

  try {
    unsubs.push(subscribeRecipes((recipes) => {
      setRecipes(recipes.map(cleanLegacyMacros));
      if (window.state) window.state.recipes = recipes;
    }));

    unsubs.push(subscribeIngredients((ingredients) => {
      const normIngs = (ingredients || []).map(normalizeIngredientRecord);
      setIngredients(normIngs);
      if (window.state) window.state.ingredients = normIngs;
    }));

    unsubs.push(subscribeProducts((products) => {
      const normProds = (products || []).map(normalizeProductRecord);
      setProducts(normProds);
      if (window.state) window.state.products = normProds;
    }));

    unsubs.push(subscribePreferences((prefs) => {
      if (prefs) {
        const sanitized = sanitizePreferences(prefs);
        setPreferences(sanitized);
        if (window.state) {
          window.state.settings = { ...(window.state.settings || {}), ...(sanitized.settings || {}) };
        }
      }
    }));

    unsubs.push(subscribeCurrentPlan((plan) => {
      if (plan) {
        setCurrentPlan(plan);
        if (window.state) {
          window.state.plan = plan;
          if (plan.skeletonGrid) window.state.skeletonGrid = plan.skeletonGrid;
        }
      }
    }));
  } catch (err) {
    console.warn('[HydrationService] Realtime subscription setup warning:', err);
  }
}
