/**
 * src/services/HydrationService.js (v3.19.50)
 * Orchestrates concurrent fetching from HouseholdRepository, invalidating/updating cache,
 * and populating the centralized Store and window.state.
 */

import { getRecipes, getIngredients, getProducts, getPreferences, getCurrentPlan, subscribeIngredients, subscribeProducts, getCategories } from './HouseholdRepository.js';
import { setRecipes, setIngredients, setProducts, setPreferences, setCurrentPlan, saveStateCache, setCategories } from '../store/store.js';
import { calculateMealSplit } from '../utils/nutritionCalculator.js';

export function normalizeProductRecord(p) {
  if (!p || typeof p !== 'object') return p;
  
  const subtypeId = p.subtypeId ?? p.subTypeId ?? p.sub_type_id ?? null;
  const ingredientId = p.ingredientId ?? p.ingredient_id ?? p.groupId ?? null;
  const category = p.category ?? p.category_id ?? p.categoryName ?? p.cat ?? 'Other';

  const rawPackSize = p.packSize ?? p.pack_size ?? p.pack_size_g ?? p.pack_weight ?? p.packageSize ?? p.size ?? p.pack ?? 0;
  let packSize = 0;
  if (typeof rawPackSize === 'string') {
    const matched = rawPackSize.match(/[\d\.]+/);
    packSize = matched ? parseFloat(matched[0]) : 0;
  } else {
    packSize = Number(rawPackSize) || 0;
  }

  const kcal = Number(p.kcal ?? p.calories ?? p.energy_kcal ?? p.cal ?? 0);
  const protein = Number(p.protein ?? p.protein_g ?? p.prot ?? 0);

  return {
    ...p,
    subtypeId,
    ingredientId,
    category,
    packSize,
    pack: packSize,
    kcal,
    cal: kcal,
    protein,
    prot: protein
  };
}

export function normalizeIngredientRecord(ing) {
  if (!ing || typeof ing !== 'object') return ing;
  
  const category = ing.category ?? ing.category_id ?? ing.categoryName ?? ing.cat ?? 'Other';
  const kcal = Number(ing.kcal ?? ing.calories ?? ing.energy_kcal ?? ing.cal ?? 0);
  const protein = Number(ing.protein ?? ing.protein_g ?? ing.prot ?? 0);

  const subtypes = (Array.isArray(ing.subtypes) ? ing.subtypes : []).map(st => {
    const stKcal = Number(st.kcal ?? st.calories ?? st.energy_kcal ?? st.cal ?? 0);
    const stProtein = Number(st.protein ?? st.protein_g ?? st.prot ?? 0);
    return {
      ...st,
      kcal: stKcal,
      cal: stKcal,
      protein: stProtein,
      prot: stProtein
    };
  });

  return {
    ...ing,
    category,
    kcal,
    cal: kcal,
    protein,
    prot: protein,
    subtypes
  };
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
    (error) => {
      console.warn('[HydrationService] Firestore stream transient disconnect (reconnecting):', error?.message || error);
    }
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
    (error) => {
      console.warn('[HydrationService] Firestore stream transient disconnect (reconnecting):', error?.message || error);
    }
  );
}

/**
 * Hydrate all household data domains concurrently into the reactive Store.
 * Singleton guarded to coalesce concurrent startup triggers.
 * @returns {Promise<{success: boolean, timestamp?: number, error?: any}>} Hydration result status.
 */
export async function hydrateHouseholdData() {
  if (inFlightHydration) {
    return inFlightHydration;
  }

  inFlightHydration = (async () => {
    try {
      const [recipes, rawIngredients, rawProducts, preferencesData, plan, categories] = await Promise.all([
        getRecipes(),
        getIngredients(),
        getProducts(),
        getPreferences(),
        getCurrentPlan(),
        getCategories()
      ]);

      const ingredients = (rawIngredients || []).map(normalizeIngredientRecord);
      const products = (rawProducts || []).map(normalizeProductRecord);

      setRecipes(recipes);
      setIngredients(ingredients);
      setProducts(products);
      setPreferences(preferencesData);
      setCurrentPlan(plan);
      setCategories(categories);

      // Populate window.state directly for legacy/ES6 bridge compatibility
      if (typeof window !== 'undefined') {
        if (!window.state) {
          try { window.state = {}; } catch (e) {}
        }
        if (window.state) {
          window.state.isCloudHydrated = true;
          window.state.ingredients = ingredients;
          window.state.products = products;
          window.state.categories = categories;
        }

        window.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: ingredients }));
        window.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: products }));

        const docData = preferencesData || {};
        const userPrefs = docData.userPrefs || docData;

        window.state.userPrefs = {
          ...window.state.userPrefs,
          ...userPrefs,
          favouriteVariantIds: Array.isArray(userPrefs.favouriteVariantIds) ? userPrefs.favouriteVariantIds : (window.state.userPrefs?.favouriteVariantIds || []),
          favourites: Array.isArray(userPrefs.favourites) ? userPrefs.favourites : (window.state.userPrefs?.favourites || [])
        };

        // Map user profile data from Firestore into state.preferences.profiles
        const rawProfiles = docData.profiles || userPrefs.profiles || {};
        const docTargets = docData.nutritionTargets || userPrefs.nutritionTargets || {};
        const docMealSplits = docData.mealSplits || userPrefs.mealSplits || {};

        const profileIds = Array.from(new Set([
          ...Object.keys(rawProfiles),
          ...Object.keys(docTargets),
          'elliott',
          'chloe'
        ]));

        const profiles = {};
        for (const profileId of profileIds) {
          const rawProf = rawProfiles[profileId] || {};
          const rawTarget = docTargets[profileId] || {};
          const legacyCal = profileId === 'elliott'
            ? (userPrefs.elliottCal ?? userPrefs.calE ?? userPrefs.eDailyKcal)
            : (userPrefs.chloeCal ?? userPrefs.calC ?? userPrefs.cDailyKcal);
          const legacyProt = profileId === 'elliott'
            ? (userPrefs.elliottProt ?? userPrefs.protE ?? userPrefs.eDailyProt)
            : (userPrefs.chloeProt ?? userPrefs.protC ?? userPrefs.cDailyProt);

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
            dailyKcal,
            dailyProtein,
            calorieSplits: {
              breakfast: calBf,
              lunch: calLu,
              snack: calSn,
              dinner: calDi
            },
            proteinSplits: {
              breakfast: protBf,
              lunch: protLu,
              snack: protSn,
              dinner: protDi
            }
          };
        }

        window.state.preferences = window.state.preferences || {};
        window.state.preferences.profiles = profiles;
        window.state.userPrefs = window.state.userPrefs || {};
        window.state.userPrefs.profiles = profiles;

        // Bridge to nutritionTargets for existing reactive components
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
            dailyKcal: pData.dailyKcal,
            dailyProtein: pData.dailyProtein,
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
        window.state.settings = docData.settings || window.state.settings || {};

        if (!hydrationLogged) {
          console.log('[HydrationService] Core user data and decoupled profiles mapped to state.');
        }
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
