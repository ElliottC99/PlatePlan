/**
 * src/services/HydrationService.js (v3.8.1)
 * Orchestrates concurrent fetching from HouseholdRepository, invalidating/updating cache,
 * and populating the centralized Store and window.state.
 */

import { getRecipes, getIngredients, getPreferences, getCurrentPlan } from './HouseholdRepository.js';
import { setRecipes, setIngredients, setPreferences, setCurrentPlan, saveStateCache } from '../store/store.js';

let inFlightHydration = null;

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
      const [recipes, ingredients, preferencesData, plan] = await Promise.all([
        getRecipes(),
        getIngredients(),
        getPreferences(),
        getCurrentPlan()
      ]);

      setRecipes(recipes);
      setIngredients(ingredients);
      setPreferences(preferencesData);
      setCurrentPlan(plan);

      // Populate window.state directly for legacy/ES6 bridge compatibility
      if (typeof window !== 'undefined') {
        window.state = window.state || {};
        window.state.isCloudHydrated = true;

        const docData = preferencesData || {};
        const userPrefs = docData.userPrefs || docData;

        window.state.userPrefs = {
          ...window.state.userPrefs,
          ...userPrefs,
          favouriteVariantIds: Array.isArray(userPrefs.favouriteVariantIds) ? userPrefs.favouriteVariantIds : (window.state.userPrefs?.favouriteVariantIds || []),
          favourites: Array.isArray(userPrefs.favourites) ? userPrefs.favourites : (window.state.userPrefs?.favourites || [])
        };

        // Map nutritionTargets from canonical Firestore docData and userPrefs
        const docTargets = docData.nutritionTargets || userPrefs.nutritionTargets || {};
        
        const elliottDailyKcal = Number(docTargets.elliott?.dailyKcal || docTargets.elliott?.dailyCal || userPrefs.elliottCal || userPrefs.calE || userPrefs.eDailyKcal || 2200);
        const elliottDailyProt = Number(docTargets.elliott?.dailyProtein || docTargets.elliott?.dailyProt || userPrefs.elliottProt || userPrefs.protE || userPrefs.eDailyProt || 140);
        
        const chloeDailyKcal = Number(docTargets.chloe?.dailyKcal || docTargets.chloe?.dailyCal || userPrefs.chloeCal || userPrefs.calC || userPrefs.cDailyKcal || 1800);
        const chloeDailyProt = Number(docTargets.chloe?.dailyProtein || docTargets.chloe?.dailyProt || userPrefs.chloeProt || userPrefs.protC || userPrefs.cDailyProt || 110);

        const nutritionTargets = {
          elliott: {
            dailyKcal: elliottDailyKcal,
            dailyProtein: elliottDailyProt,
            meals: docTargets.elliott?.meals || {
              breakfast: { kcal: Math.round(elliottDailyKcal * 0.25), protein: Math.round(elliottDailyProt * 0.25) },
              lunch: { kcal: Math.round(elliottDailyKcal * 0.30), protein: Math.round(elliottDailyProt * 0.30) },
              dinner: { kcal: Math.round(elliottDailyKcal * 0.35), protein: Math.round(elliottDailyProt * 0.35) },
              snacking: { kcal: Math.round(elliottDailyKcal * 0.10), protein: Math.round(elliottDailyProt * 0.10) }
            }
          },
          chloe: {
            dailyKcal: chloeDailyKcal,
            dailyProtein: chloeDailyProt,
            meals: docTargets.chloe?.meals || {
              breakfast: { kcal: Math.round(chloeDailyKcal * 0.25), protein: Math.round(chloeDailyProt * 0.25) },
              lunch: { kcal: Math.round(chloeDailyKcal * 0.30), protein: Math.round(chloeDailyProt * 0.30) },
              dinner: { kcal: Math.round(chloeDailyKcal * 0.35), protein: Math.round(chloeDailyProt * 0.35) },
              snacking: { kcal: Math.round(chloeDailyKcal * 0.10), protein: Math.round(chloeDailyProt * 0.10) }
            }
          }
        };

        window.state.userPrefs.nutritionTargets = nutritionTargets;
        window.state.settings = docData.settings || window.state.settings || {};

        console.log('[HydrationService] Core user data mapped to state.');
      }

      saveStateCache();
      console.log('[HydrationService] Household data hydrated successfully into Store and persisted to local cache.');
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
