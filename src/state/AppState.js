/**
 * src/state/AppState.js (v3.12.2)
 * Centralized State Encapsulation Module.
 * Provides getState(), updateState(patch), and subscribe(listener).
 */
import { getState, updateState, subscribe, saveStateCache, clearStateCache, setRecipes, setIngredients, setPreferences, setCurrentPlan, setShoppingList, runOptimisticMutation } from '../store/store.js';

if (typeof window !== 'undefined') {
  window.AppState = { getState, updateState, subscribe };
  if (!window.state) {
    Object.defineProperty(window, 'state', {
      get() { return getState(); },
      configurable: true
    });
  }
}

export {
  getState,
  updateState,
  subscribe,
  saveStateCache,
  clearStateCache,
  setRecipes,
  setIngredients,
  setPreferences,
  setCurrentPlan,
  setShoppingList,
  runOptimisticMutation
};

export default {
  getState,
  updateState,
  subscribe
};
