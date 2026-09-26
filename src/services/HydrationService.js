/**
 * src/services/HydrationService.js (v3.3.32)
 * Orchestrates concurrent fetching from HouseholdRepository and populating the centralized Store and window.state.
 */

import { getRecipes, getIngredients, getPreferences, getCurrentPlan } from './HouseholdRepository.js';
import { setRecipes, setIngredients, setPreferences, setCurrentPlan } from '../store/store.js';

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

      console.log('[HydrationService v3.3.32] Mapped userPrefs and nutritionTargets to window.state', window.state.userPrefs);
    }

    console.log('[HydrationService v3.3.32] Household data hydrated successfully into Store.');
    return { success: true, timestamp: Date.now() };
  } catch (err) {
    console.error('[HydrationService v3.3.32] Hydration failed:', err);
    return { success: false, error: err };
  }
}
