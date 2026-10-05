/**
 * src/services/HydrationService.js (v3.20.02)
 * Orchestrates concurrent fetching from HouseholdRepository, invalidating/updating cache,
 * and populating the centralized Store and window.state.
 */

import { getRecipes, getIngredients, getProducts, getPreferences, getCurrentPlan, subscribeIngredients, subscribeProducts, getCategories, saveCategories, saveIngredient } from './HouseholdRepository.js';
import { setRecipes, setIngredients, setProducts, setPreferences, setCurrentPlan, saveStateCache, setCategories } from '../store/store.js';
import { compareProductsByStrategy } from '../models/PantryHierarchyModel.js';

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

    // 1. STRICTLY filter products that belong to this exact ingredient or its nested subtypes
    const strictlyMatchingProducts = products.filter(p => {
      const pIngId = String(p.ingredientId || p.ingredient || '');
      const pSubId = String(p.subtypeId || p.subTypeId || p.subtype || '');
      const matchesDirectIng = pIngId && (pIngId === String(ing.id) || pIngId === String(ing.name));
      const matchesSubtype = pSubId && subtypeIdentifiers.some(subId => subId.toLowerCase() === pSubId.toLowerCase());
      return matchesDirectIng || matchesSubtype;
    });

    let targetDefaultId = null;
    let targetDefaultName = null;

    if (strictlyMatchingProducts.length > 0) {
      // 1. Check for explicit manual user pin override
      const userPinnedProduct = strictlyMatchingProducts.find(p => p.isAutoDefault === true);
      let targetProduct = userPinnedProduct;

      if (!targetProduct && strictlyMatchingProducts.length > 0) {
        // 2. Sort candidates based on selected strategy
        const sorted = [...strictlyMatchingProducts].sort((a, b) => compareProductsByStrategy(a, b, criterion));
        targetProduct = sorted[0];
      }

      if (targetProduct) {
        targetDefaultId = targetProduct.id || targetProduct.productId;
        targetDefaultName = targetProduct.name || targetProduct.productName;
      }
    }

    if (ing.defaultProductId !== targetDefaultId || ing.autoDefault !== targetDefaultName) {
      updatedCount++;
      return {
        ...ing,
        defaultProductId: targetDefaultId,
        autoDefault: targetDefaultName,
        autoDefaultProduct: targetDefaultName,
        updatedAt: new Date().toISOString()
      };
    }
    return ing;
  });

  if (updatedCount > 0) {
    console.log(`[HydrationService] Repaired and recalibrated defaults for ${updatedCount} ingredients.`);
    setIngredients(updatedIngredients);
    if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients });
    if (typeof window !== 'undefined') {
      if (window.state) window.state.ingredients = updatedIngredients;
      if (typeof window.invalidateHierarchyCache === 'function') window.invalidateHierarchyCache();
      window.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: updatedIngredients }));
      if (typeof window.renderPantryBank === 'function') window.renderPantryBank();
    }
    try {
      const changed = updatedIngredients.filter((i, idx) => ingredients[idx] !== i);
      await Promise.all(changed.map(i => saveIngredient(i)));
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
  const slugCat = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const existingSlugs = new Set(categories.map(c => slugCat(getCategoryName(c))));
  let mutated = false;
  CANONICAL_CATEGORIES.forEach(canon => {
    if (!existingSlugs.has(slugCat(canon))) {
      categories.push(canon);
      existingSlugs.add(slugCat(canon));
      mutated = true;
    }
  });
  return { categories, mutated };
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

export function normalizeIngredientRecord(ing) {
  if (!ing || typeof ing !== 'object') return ing;
  const category = ing.category ?? ing.category_id ?? ing.categoryName ?? ing.cat ?? 'Other';
  const kcal = Number(ing.kcal ?? ing.calories ?? ing.energy_kcal ?? ing.cal ?? 0);
  const protein = Number(ing.protein ?? ing.protein_g ?? ing.prot ?? 0);
  const subtypes = (Array.isArray(ing.subtypes) ? ing.subtypes : []).map(st => {
    const stKcal = Number(st.kcal ?? st.calories ?? st.energy_kcal ?? st.cal ?? 0);
    const stProtein = Number(st.protein ?? st.protein_g ?? st.prot ?? 0);
    return { ...st, kcal: stKcal, cal: stKcal, protein: stProtein, prot: stProtein };
  });
  return { ...ing, category, kcal, cal: kcal, protein, prot: protein, subtypes };
}

let inFlightHydration = null;
let listenersActive = false;
let hydrationLogged = false;

function initRealtimeListeners() {
  if (listenersActive) return;
  listenersActive = true;
  subscribeIngredients(
    (freshIngredients) => {
      const normalized = (freshIngredients || []).map(normalizeIngredientRecord);
      setIngredients(normalized);
      if (typeof window !== 'undefined') {
        if (window.state) window.state.ingredients = normalized;
        window.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: normalized }));
      }
    },
    (error) => console.warn('[HydrationService] Firestore stream transient disconnect:', error?.message || error)
  );
  subscribeProducts(
    (freshProducts) => {
      const normalized = (freshProducts || []).map(normalizeProductRecord);
      setProducts(normalized);
      if (typeof window !== 'undefined') {
        if (window.state) window.state.products = normalized;
        window.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: normalized }));
      }
    },
    (error) => console.warn('[HydrationService] Firestore stream transient disconnect:', error?.message || error)
  );
}

export async function hydrateHouseholdData() {
  if (inFlightHydration) return inFlightHydration;

  inFlightHydration = (async () => {
    try {
      const [recipes, rawIngredients, rawProducts, preferencesData, plan, rawCategories] = await Promise.all([
        getRecipes(), getIngredients(), getProducts(), getPreferences(), getCurrentPlan(), getCategories()
      ]);

      const ingredients = (rawIngredients || []).map(normalizeIngredientRecord);
      const products = (rawProducts || []).map(normalizeProductRecord);
      const { categories: mergedCategories, mutated } = mergeCanonicalCategories(rawCategories);

      setRecipes(recipes);
      setIngredients(ingredients);
      setProducts(products);
      setPreferences(preferencesData);
      setCurrentPlan(plan);
      setCategories(mergedCategories);

      if (mutated) {
        saveCategories(mergedCategories).catch(err => console.warn('[HydrationService] Failed to persist merged canonical categories:', err));
      }

      if (typeof window !== 'undefined') {
        if (!window.state) { try { window.state = {}; } catch (e) {} }
        const docData = preferencesData || {};
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
        window.state.isCloudHydrated = true;
        window.state.ingredients = ingredients;
        window.state.products = products;
        window.state.categories = mergedCategories;
        if (plan && typeof plan === 'object') {
          window.state.plan = plan;
          if (plan.skeletonGrid && typeof plan.skeletonGrid === 'object') {
            window.state.skeletonGrid = plan.skeletonGrid;
          }
        }

        await sweepAndRecalibrateIngredientDefaults();

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

        const profiles = {};
        for (const profileId of profileIds) {
          const rawProf = rawProfiles[profileId] || {};
          const rawTarget = docTargets[profileId] || {};
          const legacyCal = profileId === 'elliott' ? (userPrefs.elliottCal ?? userPrefs.calE ?? userPrefs.eDailyKcal) : (userPrefs.chloeCal ?? userPrefs.calC ?? userPrefs.cDailyKcal);
          const legacyProt = profileId === 'elliott' ? (userPrefs.elliottProt ?? userPrefs.protE ?? userPrefs.eDailyProt) : (userPrefs.chloeProt ?? userPrefs.protC ?? userPrefs.cDailyProt);
          const dailyKcal = Number(rawProf.dailyKcal ?? rawTarget.dailyKcal ?? rawTarget.dailyCal ?? legacyCal ?? 0);
          const dailyProtein = Number(rawProf.dailyProtein ?? rawTarget.dailyProtein ?? rawTarget.dailyProt ?? legacyProt ?? 0);

          const pSplits = docMealSplits[profileId] || docMealSplits || {};
          const calSplits = rawProf.calorieSplits || pSplits.calories || pSplits || {};
          const protSplits = rawProf.proteinSplits || pSplits.protein || pSplits || {};

          const extractMealSplit = (src, meal, targetVal, mealsObj) => {
            if (src[meal] !== undefined && src[meal] !== null) return Number(src[meal]) || 0;
            if (meal === 'snack' && src.snacking !== undefined) return Number(src.snacking) || 0;
            if (meal === 'snacking' && src.snack !== undefined) return Number(src.snack) || 0;
            const m = mealsObj?.[meal] || (meal === 'snack' ? mealsObj?.snacking : null);
            const val = Number(m?.kcal ?? m?.protein ?? 0);
            return (targetVal > 0 && val > 0) ? Math.round((val / targetVal) * 100) : 0;
          };

          const calBf = extractMealSplit(calSplits, 'breakfast', dailyKcal, rawTarget.meals);
          const calLu = extractMealSplit(calSplits, 'lunch', dailyKcal, rawTarget.meals);
          const calSn = extractMealSplit(calSplits, 'snack', dailyKcal, rawTarget.meals);
          const calDi = calSplits.dinner !== undefined ? Number(calSplits.dinner) || 0 : Math.max(0, 100 - (calBf + calLu + calSn));

          const protBf = extractMealSplit(protSplits, 'breakfast', dailyProtein, rawTarget.meals);
          const protLu = extractMealSplit(protSplits, 'lunch', dailyProtein, rawTarget.meals);
          const protSn = extractMealSplit(protSplits, 'snack', dailyProtein, rawTarget.meals);
          const protDi = protSplits.dinner !== undefined ? Number(protSplits.dinner) || 0 : Math.max(0, 100 - (protBf + protLu + protSn));

          profiles[profileId] = {
            enabled: rawProf.enabled !== undefined ? Boolean(rawProf.enabled) : true,
            name: rawProf.name || (profileId.charAt(0).toUpperCase() + profileId.slice(1)),
            dailyKcal, dailyProtein,
            calorieSplits: { breakfast: calBf, lunch: calLu, snack: calSn, dinner: calDi },
            proteinSplits: { breakfast: protBf, lunch: protLu, snack: protSn, dinner: protDi }
          };
        }

        window.state.preferences = window.state.preferences || {};
        window.state.preferences.profiles = profiles;
        window.state.userPrefs.profiles = profiles;

        const nutritionTargets = {};
        for (const [pId, pData] of Object.entries(profiles)) {
          const bfKcal = Math.round((pData.calorieSplits.breakfast / 100) * pData.dailyKcal);
          const luKcal = Math.round((pData.calorieSplits.lunch / 100) * pData.dailyKcal);
          const snKcal = Math.round((pData.calorieSplits.snack / 100) * pData.dailyKcal);
          const diKcal = Math.max(0, pData.dailyKcal - (bfKcal + luKcal + snKcal));
          const bfProt = Math.round((pData.proteinSplits.breakfast / 100) * pData.dailyProtein);
          const luProt = Math.round((pData.proteinSplits.lunch / 100) * pData.dailyProtein);
          const snProt = Math.round((pData.proteinSplits.snack / 100) * pData.dailyProtein);
          const diProt = Math.max(0, pData.dailyProtein - (bfProt + luProt + snProt));

          nutritionTargets[pId] = {
            dailyKcal: pData.dailyKcal, dailyProtein: pData.dailyProtein,
            meals: {
              breakfast: { kcal: bfKcal, protein: bfProt },
              lunch: { kcal: luKcal, protein: luProt },
              dinner: { kcal: diKcal, protein: diProt },
              snacking: { kcal: snKcal, protein: snProt }
            }
          };
        }

        window.state.userPrefs.nutritionTargets = nutritionTargets;
        window.state.preferences.nutritionTargets = nutritionTargets;
      }

      initRealtimeListeners();
      saveStateCache();
      if (!hydrationLogged) {
        hydrationLogged = true;
        console.log('[HydrationService] Household data hydrated successfully into Store and persisted to local cache.');
      }
      return { success: true, timestamp: Date.now() };
    } catch (err) {
      console.error('[HydrationService] Hydration failed:', err);
      return { success: false, error: err };
    } finally {
      inFlightHydration = null;
    }
  })();

  return inFlightHydration;
}
