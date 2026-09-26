/**
 * src/services/HydrationService.js
 * Orchestrates concurrent fetching from HouseholdRepository and populating the centralized Store.
 */

import { getRecipes, getIngredients, getPreferences, getCurrentPlan } from './HouseholdRepository.js';
import { setRecipes, setIngredients, setPreferences, setCurrentPlan } from '../store/store.js';

/**
 * Hydrate all household data domains concurrently into the reactive Store.
 * @returns {Promise<{success: boolean, timestamp?: number, error?: any}>} Hydration result status.
 */
export async function hydrateHouseholdData() {
  try {
    const [recipes, ingredients, preferences, plan] = await Promise.all([
      getRecipes(),
      getIngredients(),
      getPreferences(),
      getCurrentPlan()
    ]);

    setRecipes(recipes);
    setIngredients(ingredients);
    setPreferences(preferences);
    setCurrentPlan(plan);

    console.log('[HydrationService] Household data hydrated successfully into Store.');
    return { success: true, timestamp: Date.now() };
  } catch (err) {
    console.error('[HydrationService] Hydration failed:', err);
    return { success: false, error: err };
  }
}
