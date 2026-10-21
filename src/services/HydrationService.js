import { getState } from '../store/coreState.js';
import store from "../store/store.js";
/**
 * src/services/HydrationService.js (v3.38.5)
 * Orchestrates concurrent fetching and real-time Firebase subscriptions.
 * Delegates maintenance routines to CacheMaintenanceService.js.
 */

import { getRecipes, getIngredients, getProducts, getPreferences, getCurrentPlan, subscribeRecipes, subscribeIngredients, subscribeProducts, subscribePreferences, subscribeCurrentPlan, getCategories, saveCategories, saveIngredient, cleanLegacyMacros } from './HouseholdRepository.js';
import { getInventory } from './InventoryRepository.js';
import { getCurrentActivePlan as getActivePlanFromSubcollection } from './PlanRepository.js';
import { setRecipes, setPreferences, setCurrentPlan, saveStateCache, setInventory, sanitizePreferences, updateState } from '../store/store.js';
import { setIngredients, setProducts, setCategories } from '../store/store.js';
import { compareProductsByStrategy } from '../models/PantryHierarchyModel.js';
import { waitForAuth } from './AuthService.js';
import { runDeferredMaintenance } from './CacheMaintenanceService.js';

export { waitForAuth };

export const CANONICAL_CATEGORIES = [
  'Baking, Chocolate and Sweets', 'Beverages', 'Carbs', 'Dairy', 'Fruit & Vegetables',
  'Grains, Nuts and Seeds', 'Herbs & Spices', 'Meat Substitutes', 'Other',
  'Sauces, Condiments & Pastes', 'Store Cupboard', 'Supplements', 'Tofu, Tempeh and Seitan'
];

export const DEFAULT_PREFERENCES = {
  macroTargets: { calories: 2000, protein: 125, carbs: 200, fat: 70 },
  fallbackProducts: [
    { match: 'vegetable stock', name: 'Vegetable Stock Cubes', brand: 'Knorr', price: 1.45, packSize: 80, packUnit: 'g', cat: 'Store Cupboard' },
    { match: 'chicken stock', name: 'Chicken Stock Cubes', brand: 'Knorr', price: 1.45, packSize: 80, packUnit: 'g', cat: 'Store Cupboard' },
    { match: 'beef stock', name: 'Beef Stock Cubes', brand: 'Knorr', price: 1.45, packSize: 80, packUnit: 'g', cat: 'Store Cupboard' },
    { match: 'instant noodles', name: 'Egg Noodles / Instant Noodles', brand: 'Amoy', price: 1.25, packSize: 300, packUnit: 'g', cat: 'Grains & Pasta' },
    { match: 'noodles', name: 'Medium Egg Noodles', brand: 'Amoy', price: 1.35, packSize: 300, packUnit: 'g', cat: 'Grains & Pasta' },
    { match: 'shallot', name: 'Echalion Shallots', brand: 'Tesco', price: 1.35, packSize: 300, packUnit: 'g', cat: 'Fresh Produce' },
    { match: 'celery', name: 'Celery Sticks', brand: 'Tesco', price: 0.89, packSize: 350, packUnit: 'g', cat: 'Fresh Produce' },
    { match: 'spring onion', name: 'Spring Onions', brand: 'Tesco', price: 0.65, packSize: 100, packUnit: 'g', cat: 'Fresh Produce' },
    { match: 'ginger', name: 'Fresh Root Ginger', brand: 'Tesco', price: 0.70, packSize: 100, packUnit: 'g', cat: 'Fresh Produce' },
    { match: 'garlic', name: 'Garlic Bulbs 3 Pack', brand: 'Tesco', price: 0.95, packSize: 150, packUnit: 'g', cat: 'Fresh Produce' },
    { match: 'tofu', name: 'Organic Firm Tofu', brand: 'Tofoo Co', price: 2.30, packSize: 280, packUnit: 'g', cat: 'Meat & Protein' },
    { match: 'cucumber', name: 'Whole Cucumber', brand: 'Tesco', price: 0.89, packSize: 350, packUnit: 'g', cat: 'Fresh Produce' }
  ]
};

export function getCategoryName(cat) {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.name || cat.categoryName || cat.id || '';
}

export async function sweepAndRecalibrateIngredientDefaults() {
  const state = window.Store?.getState?.() || {};
  const ingredients = state.ingredients || (getState()?.ingredients || []);
  const products = state.products || (getState()?.products || []);
  const criterion = state.settings?.autoDefaultStrategy || state.settings?.autoDefaultCriterion || state.userPrefs?.autoDefaultStrategy || state.userPrefs?.autoDefaultCriterion ?.settings?.autoDefaultStrategy ?.settings?.autoDefaultCriterion ?.userPrefs?.autoDefaultStrategy ?.userPrefs?.autoDefaultCriterion || 'lowest_absolute_price';
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
    if (getState()) getState().ingredients = updatedIngredients;
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

      const sanitizedPrefs = sanitizePreferences(preferencesData || {});
      const finalPrefs = {
        ...DEFAULT_PREFERENCES,
        ...sanitizedPrefs,
        settings: {
          ...DEFAULT_PREFERENCES.settings,
          ...(sanitizedPrefs.settings || {})
        },
        macroTargets: {
          ...DEFAULT_PREFERENCES.macroTargets,
          ...(sanitizedPrefs.macroTargets || {})
        },
        fallbackProducts: Array.isArray(sanitizedPrefs.fallbackProducts) ? sanitizedPrefs.fallbackProducts : DEFAULT_PREFERENCES.fallbackProducts
      };

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

      if (finalPrefs && Object.keys(finalPrefs).length > 0) {
        setPreferences(finalPrefs);
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
        if (!getState()) { try { getState() = {}; } catch (e) {} }
        const docData = sanitizedPrefs || {};
        const userPrefs = docData.userPrefs || docData;
        getState().settings = { ...(getState().settings || {}), ...(docData.settings || {}) };
        const strat = userPrefs.autoDefaultStrategy || userPrefs.autoDefaultCriterion || docData.settings?.autoDefaultStrategy || docData.settings?.autoDefaultCriterion;
        if (strat) {
          getState().settings.autoDefaultStrategy = strat;
          getState().settings.autoDefaultCriterion = strat;
          if (!getState().userPrefs) getState().userPrefs = {};
          getState().userPrefs.autoDefaultStrategy = strat;
          getState().userPrefs.autoDefaultCriterion = strat;
        }
        const cloudHasData = (Array.isArray(recipes) && recipes.length > 0) || (Array.isArray(ingredients) && ingredients.length > 0) || Boolean(plan);
        if (cloudHasData) {
          getState().isCloudHydrated = true;
        }
        getState().ingredients = ingredients;
        getState().products = products;
        getState().categories = mergedCategories;
        if (plan && typeof plan === 'object') {
          getState().currentPlan = plan;
          if (plan.skeletonGrid && typeof plan.skeletonGrid === 'object') {
            getState().skeletonGrid = plan.skeletonGrid;
          }
        }

        window.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: getState().ingredients }));
        window.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: products }));

        getState().userPrefs = {
          ...getState().userPrefs,
          ...userPrefs,
          favouriteVariantIds: Array.isArray(userPrefs.favouriteVariantIds) ? userPrefs.favouriteVariantIds : (getState().userPrefs?.favouriteVariantIds || []),
          favourites: Array.isArray(userPrefs.favourites) ? userPrefs.favourites : (getState().userPrefs?.favourites || [])
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
        getState().profiles = hydratedProfiles;
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
      if (getState()) getState().recipes = recipes;
    }));

    unsubs.push(subscribeIngredients((ingredients) => {
      const normIngs = (ingredients || []).map(normalizeIngredientRecord);
      setIngredients(normIngs);
      if (getState()) getState().ingredients = normIngs;
    }));

    unsubs.push(subscribeProducts((products) => {
      const normProds = (products || []).map(normalizeProductRecord);
      setProducts(normProds);
      if (getState()) getState().products = normProds;
    }));

    unsubs.push(subscribePreferences((prefs) => {
      if (prefs) {
        const sanitized = sanitizePreferences(prefs);
        setPreferences(sanitized);
        if (getState()) {
          getState().settings = { ...(getState().settings || {}), ...(sanitized.settings || {}) };
        }
      }
    }));

    unsubs.push(subscribeCurrentPlan((plan) => {
      if (plan) {
        setCurrentPlan(plan);
        if (getState()) {
          getState().currentPlan = plan;
          if (plan.skeletonGrid) getState().skeletonGrid = plan.skeletonGrid;
        }
      }
    }));
  } catch (err) {
    console.warn('[HydrationService] Realtime subscription setup warning:', err);
  }
}
