/**
 * src/state/AppState.js (v3.19.27)
 * Centralized State Encapsulation Module.
 * Provides getState(), updateState(patch), and subscribe(listener).
 */
import { getState, updateState, subscribe, saveStateCache, clearStateCache, setRecipes, setIngredients, setProducts, setPreferences, setCurrentPlan, setShoppingList, runOptimisticMutation, reorderDraftRecipes } from '../store/store.js';

if (typeof window !== 'undefined') {
  window.AppState = { getState, updateState, subscribe };
  try {
    Object.defineProperty(window, 'state', {
      get() { return getState(); },
      set(val) {
        if (val && typeof val === 'object' && val !== getState()) {
          updateState(val);
        }
      },
      configurable: true
    });
  } catch (e) {
    window.state = getState();
  }
}

export const AppState = {
  getState,
  updateState,
  subscribe,
  saveStateCache,
  clearStateCache,
  setRecipes,
  setIngredients,
  setProducts,
  setPreferences,
  setCurrentPlan,
  setShoppingList,
  runOptimisticMutation,
  reorderDraftRecipes
};

export {
  getState,
  updateState,
  subscribe,
  saveStateCache,
  clearStateCache,
  setRecipes,
  setIngredients,
  setProducts,
  setPreferences,
  setCurrentPlan,
  setShoppingList,
  runOptimisticMutation,
  reorderDraftRecipes
};

export default AppState;
