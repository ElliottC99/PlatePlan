/**
 * src/services/HydrationService.js (v3.8.1)
 * Orchestrates concurrent fetching from HouseholdRepository, invalidating/updating cache,
 * and populating the centralized Store and window.state.
 */

import { getRecipes, getIngredients, getPreferences, getCurrentPlan } from './HouseholdRepository.js';
import { setRecipes, setIngredients, setPreferences, setCurrentPlan, saveStateCache } from '../store/store.js';

/**
 * Hydrate all household data domains concurrently into the reactive Store.
 * @returns {Promise<{success: boolean, timestamp?: number, error?: any}>} Hydration result status.
 */
export async function hydrateHouseholdData() {
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

      // Map nutritionTargets with full fallback structure
      const nutritionTargets = docData.nutritionTargets || userPrefs.nutritionTargets || {
        elliott: {
          dailyKcal: userPrefs.elliottCal || 2200,
          dailyProtein: userPrefs.elliottProt || 140,
          meals: {
            breakfast: { kcal: 550, protein: 35 },
            lunch: { kcal: 650, protein: 40 },
            dinner: { kcal: 750, protein: 45 },
            snacking: { kcal: 250, protein: 20 }
          }
        },
        chloe: {
          dailyKcal: userPrefs.chloeCal || 1800,
          dailyProtein: userPrefs.chloeProt || 110,
          meals: {
            breakfast: { kcal: 450, protein: 25 },
            lunch: { kcal: 500, protein: 30 },
            dinner: { kcal: 650, protein: 40 },
            snacking: { kcal: 200, protein: 15 }
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
  }
}
