/**
 * src/state/AppState.js (v3.19.26)
 * Centralized State Encapsulation Module.
 * Provides getState(), updateState(patch), and subscribe(listener).
 */
import { getState, updateState, subscribe, saveStateCache, clearStateCache, setRecipes, setIngredients, setProducts, setPreferences, setCurrentPlan, setShoppingList, runOptimisticMutation } from '../store/store.js';

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
  runOptimisticMutation
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
  runOptimisticMutation
};

export default AppState;
