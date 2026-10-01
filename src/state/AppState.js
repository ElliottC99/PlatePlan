/**
 * src/state/AppState.js (v3.19.23)
 * Centralized State Encapsulation Module.
 * Provides getState(), updateState(patch), subscribe(listener), and batch mutation execution.
 */
import { getState, updateState, subscribe, saveStateCache, clearStateCache, setRecipes, setIngredients, setProducts, setPreferences, setCurrentPlan, setShoppingList, runOptimisticMutation, startBatch, endBatch, batchMutate } from '../store/store.js';

if (typeof window !== 'undefined') {
  window.AppState = { getState, updateState, subscribe, startBatch, endBatch, batchMutate };
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
  startBatch,
  endBatch,
  batchMutate
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
  startBatch,
  endBatch,
  batchMutate
};

export default AppState;
