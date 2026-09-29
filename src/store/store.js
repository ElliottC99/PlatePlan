/**
 * src/store/store.js (v3.8.1)
 * Centralized Reactive State Store module using native browser CustomEvents for unidirectional data flow.
 * Provides microtask-wrapped event dispatching, local storage caching for instant offline hydration,
 * and optimistic UI rollbacks.
 */

import { safeJsonStringify, safeClone } from '../utils/safeJson.js';

const CACHE_KEY = `plateplan_store_cache_${(typeof window !== 'undefined' && window.APP_VERSION) || 'v3.13.1'}`;

const state = {
  recipes: [],
  ingredients: [],
  preferences: null,
  userPrefs: {},
  settings: {},
  currentPlan: null,
  shoppingList: [],
  isCachedHydrated: false,
  isCloudHydrated: false
};

/**
 * Safely read cached state from localStorage.
 */
function readCache() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    console.warn('[Store] Failed to read localStorage cache:', e);
    return null;
  }
}

/**
 * Debounced persistence of state cache to localStorage using strict allowlist.
 */
let saveTimer = null;
export function saveStateCache() {
  if (typeof localStorage === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const payload = {
        userPrefs: state.userPrefs || {},
        preferences: state.preferences ? { nutritionTargets: state.preferences.nutritionTargets } : null,
        settings: state.settings || {},
        cachedAt: Date.now()
      };
      const serialized = safeJsonStringify(payload, null, '');
      if (serialized) localStorage.setItem(CACHE_KEY, serialized);
    } catch (e) {
      console.warn('[Store] Failed to save state cache (Quota exceeded or restricted):', e);
    }
  }, 100);
}

/**
 * Clear the local storage cache.
 */
export function clearStateCache() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
  }
}

// Initialize state from local cache on load for instant offline first paint
const initialCache = readCache();
if (initialCache) {
  state.recipes = Array.isArray(initialCache.recipes) ? initialCache.recipes : [];
  state.ingredients = Array.isArray(initialCache.ingredients) ? initialCache.ingredients : [];
  state.preferences = initialCache.preferences || null;
  state.userPrefs = initialCache.userPrefs || {};
  state.settings = initialCache.settings || {};
  state.currentPlan = initialCache.currentPlan || null;
  state.shoppingList = Array.isArray(initialCache.shoppingList) ? initialCache.shoppingList : [];
  state.isCachedHydrated = true;
}

/**
 * Read-only getter for current application state snapshot.
 * @returns {Object} Current state snapshot.
 */
export const getState = () => state;

/**
 * Dispatch a custom event on the document in a safe microtask.
 * @param {string} eventName 
 * @param {any} detail 
 */
function dispatchStateEvent(eventName, detail) {
  if (typeof document !== 'undefined') {
    Promise.resolve().then(() => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
  }
}

/**
 * Update recipes state domain and dispatch reactive update event.
 * @param {Array<Object>} newRecipes 
 */
export function setRecipes(newRecipes) {
  state.recipes = Array.isArray(newRecipes) ? newRecipes : [];
  saveStateCache();
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

/**
 * Upsert a single recipe in the state domain.
 * @param {Object} recipe 
 */
export function updateRecipeInStore(recipe) {
  if (!recipe || !recipe.id) return;
  const index = state.recipes.findIndex(r => r.id === recipe.id);
  if (index !== -1) {
    state.recipes[index] = { ...state.recipes[index], ...recipe };
  } else {
    state.recipes.push(recipe);
  }
  saveStateCache();
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

/**
 * Remove a recipe from the state domain by ID.
 * @param {string} recipeId 
 */
export function removeRecipeFromStore(recipeId) {
  if (!recipeId) return;
  state.recipes = state.recipes.filter(r => r.id !== recipeId);
  saveStateCache();
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

/**
 * Update ingredients state domain and dispatch reactive update event.
 * @param {Array<Object>} newIngredients 
 */
export function setIngredients(newIngredients) {
  state.ingredients = Array.isArray(newIngredients) ? newIngredients : [];
  saveStateCache();
  dispatchStateEvent('plateplan:state:ingredients', state.ingredients);
}

/**
 * Upsert an ingredient in the store.
 * @param {Object} ingredient 
 */
export function updateIngredientInStore(ingredient) {
  if (!ingredient || !ingredient.id) return;
  const index = state.ingredients.findIndex(i => i.id === ingredient.id);
  if (index !== -1) {
    state.ingredients[index] = { ...state.ingredients[index], ...ingredient };
  } else {
    state.ingredients.push(ingredient);
  }
  saveStateCache();
  dispatchStateEvent('plateplan:state:ingredients', state.ingredients);
}

/**
 * Remove an ingredient from store by ID.
 * @param {string} ingredientId 
 */
export function removeIngredientFromStore(ingredientId) {
  if (!ingredientId) return;
  state.ingredients = state.ingredients.filter(i => i.id !== ingredientId);
  saveStateCache();
  dispatchStateEvent('plateplan:state:ingredients', state.ingredients);
}

/**
 * Update preferences state domain and dispatch reactive update event.
 * @param {Object|null} newPreferences 
 */
export function setPreferences(newPreferences) {
  state.preferences = newPreferences || null;
  state.userPrefs = (newPreferences && newPreferences.userPrefs) ? newPreferences.userPrefs : (newPreferences || {});
  state.settings = (newPreferences && newPreferences.settings) ? newPreferences.settings : {};
  saveStateCache();
  dispatchStateEvent('plateplan:state:preferences', state.preferences);
}

/**
 * Update current meal plan state domain and dispatch reactive update event.
 * @param {Object|null} newPlan 
 */
export function setCurrentPlan(newPlan) {
  state.currentPlan = newPlan || null;
  saveStateCache();
  dispatchStateEvent('plateplan:state:plan', state.currentPlan);
}

/**
 * Update shopping list state domain and dispatch reactive update event.
 * @param {Array<Object>} newShoppingList 
 */
export function setShoppingList(newShoppingList) {
  state.shoppingList = Array.isArray(newShoppingList) ? newShoppingList : [];
  saveStateCache();
  dispatchStateEvent('plateplan:state:shopping', state.shoppingList);
}

/**
 * Execute an optimistic state mutation with automatic rollback on network failure.
 * @param {string} domain 'recipes' | 'ingredients' | 'preferences' | 'plan' | 'shopping'
 * @param {Function} mutateFn Function that synchronously mutates local state
 * @param {Promise} persistPromise The network persistence Promise from HouseholdRepository
 * @param {Function} [rollbackFn] Optional custom rollback function
 * @param {string} [errorMessage] Custom error notification message
 * @returns {Promise<any>}
 */
export async function runOptimisticMutation(domain, mutateFn, persistPromise, rollbackFn, errorMessage) {
  const previousStateSnapshot = safeClone(state[domain] || null);
  
  if (typeof mutateFn === 'function') {
    mutateFn(state);
    saveStateCache();
    dispatchStateEvent(`plateplan:state:${domain}`, state[domain]);
  }

  try {
    const result = await persistPromise;
    if (result && result.success === false) {
      throw new Error(result.error || 'Persistence returned false status');
    }
    return result;
  } catch (err) {
    console.error(`[Store v3.8.1] Network failure in domain '${domain}', executing rollback:`, err);
    
    if (typeof rollbackFn === 'function') {
      rollbackFn(state, previousStateSnapshot);
    } else {
      state[domain] = previousStateSnapshot;
    }
    saveStateCache();
    dispatchStateEvent(`plateplan:state:${domain}`, state[domain]);

    if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(errorMessage || 'Network sync failed. Changes rolled back.', 'error');
    }
    
    throw err;
  }
}

/**
 * Update global state with a partial patch object.
 * @param {Object} patch 
 */
export function updateState(patch) {
  if (!patch || typeof patch !== 'object') return;
  Object.assign(state, patch);
  saveStateCache();
  dispatchStateEvent('plateplan:state:patch', patch);
}

/**
 * Subscribe to state changes on a specific domain or globally.
 * @param {string|Function} domainOrCallback Domain name ('recipes', 'plan', etc.) or global listener callback
 * @param {Function} [maybeCallback] Optional callback if domain is specified
 * @returns {Function} Unsubscribe function
 */
export function subscribe(domainOrCallback, maybeCallback) {
  if (typeof document === 'undefined') return () => {};
  if (typeof domainOrCallback === 'function') {
    const listener = domainOrCallback;
    const handler = (e) => listener(state, e.detail);
    document.addEventListener('plateplan:state:patch', handler);
    return () => {
      document.removeEventListener('plateplan:state:patch', handler);
    };
  }
  const domain = domainOrCallback;
  const callback = maybeCallback;
  if (typeof callback !== 'function') return () => {};
  const eventName = `plateplan:state:${domain}`;
  const handler = (e) => callback(e.detail);
  document.addEventListener(eventName, handler);
  return () => {
    document.removeEventListener(eventName, handler);
  };
}
