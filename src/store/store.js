/**
 * src/store/store.js (v3.38.55)
 * Centralized Reactive State Store module using native browser CustomEvents for unidirectional data flow.
 * Unified state facade composing domain slices and action handlers.
 */

import * as CacheSlice from './cacheSlice.js';
import * as PlanSlice from './planSlice.js';
import * as ShoppingSlice from './shoppingSlice.js';
import * as RecipeSlice from './recipeStore.js';
import { state, dispatchStateEvent, subscribe, getState, updateState } from './state.js';
import { loadStateCache, saveStateCache, clearStateCache, initStoreCache as initCacheSlice, CACHE_KEY } from './cacheSlice.js';

import { 
  setRecipes, 
  updateRecipeInStore, 
  removeRecipeFromStore, 
  setCurrentPlan, 
  reorderDraftRecipes, 
  runOptimisticMutation 
} from './actions/recipeActions.js';

import { 
  setIngredients, 
  setRootItems,
  setProducts, 
  setCategories, 
  updateIngredientInStore, 
  removeIngredientFromStore, 
  sanitizePreferences, 
  setPreferences, 
  learnIngredientAlias 
} from './actions/pantryActions.js';

import { 
  setActivePlan, 
  updatePlanMeal, 
  swapPlanRecipe, 
  clearPlan 
} from './planSlice.js';

import { 
  setShoppingList, 
  toggleShoppingItem, 
  addManualShoppingItem, 
  updateShoppingItemQty 
} from './shoppingSlice.js';

export const STORE_CACHE_KEY = CACHE_KEY;

export async function initStoreCache() {
  await initCacheSlice(state);
  return state;
}

export function updateStoreState(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(state, patch);
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:patch', patch);
}

export const setState = updateStoreState;

export const store = { 
  getState: () => state, 
  setState: (patch) => updateStoreState(patch), 
  subscribe: (domain, cb) => subscribe(domain, cb) 
};

export {
  // Slices
  CacheSlice,
  PlanSlice,
  ShoppingSlice,
  RecipeSlice,
  // Core state & reactivity
  state,
  dispatchStateEvent,
  subscribe,
  getState,
  updateState,
  // Cache methods
  loadStateCache,
  saveStateCache,
  clearStateCache,
  // Recipe actions
  setRecipes,
  updateRecipeInStore,
  removeRecipeFromStore,
  setCurrentPlan,
  reorderDraftRecipes,
  runOptimisticMutation,
  // Pantry & Preference actions
  setIngredients,
  setRootItems,
  setProducts,
  setCategories,
  updateIngredientInStore,
  removeIngredientFromStore,
  sanitizePreferences,
  setPreferences,
  learnIngredientAlias,
  // Plan actions
  setActivePlan,
  updatePlanMeal,
  swapPlanRecipe,
  clearPlan,
  // Shopping actions
  setShoppingList,
  toggleShoppingItem,
  addManualShoppingItem,
  updateShoppingItemQty
};

export default store;
