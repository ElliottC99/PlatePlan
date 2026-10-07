/**
 * src/store/store.js (v3.21.12)
 * Centralized Reactive State Store module using native browser CustomEvents for unidirectional data flow.
 * Provides microtask-wrapped event dispatching and IndexedDB caching for instant offline hydration without localStorage quotas.
 */

import { safeJsonStringify, safeClone } from '../utils/safeJson.js';
import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { autoRecalibrateRecipeDrift } from '../services/DataQualityEngine.js';

export { getShoppingLineStateKey };

const DB_NAME = 'PlatePlanDB';
const STORE_NAME = 'StateStore';
const DB_VERSION = 1;
const CACHE_KEY = 'plateplan_store_cache_v3.21.12';

const state = {
  recipes: [],
  ingredients: [],
  products: [],
  categories: [],
  preferences: null,
  userPrefs: {},
  settings: {},
  currentPlan: null,
  shoppingList: [],
  isCachedHydrated: false,
  isCloudHydrated: false
};

function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Asynchronously read cached state from IndexedDB.
 */
export async function loadStateCache() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('[Store] Failed to read IndexedDB cache:', e);
    return null;
  }
}

/**
 * Debounced persistence of state cache to IndexedDB using strict allowlist.
 */
let saveTimer = null;
export function saveStateCache() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const payload = {
        recipes: state.recipes || [],
        ingredients: state.ingredients || [],
        products: state.products || [],
        categories: state.categories || [],
        preferences: state.preferences ? { nutritionTargets: state.preferences.nutritionTargets } : null,
        userPrefs: state.userPrefs || {},
        settings: state.settings || {},
        currentPlan: state.currentPlan || null,
        shoppingList: state.shoppingList || [],
        cachedAt: Date.now()
      };
      const db = await openIDB();
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(payload, CACHE_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn('[Store] Failed to save state cache to IndexedDB:', e);
    }
  }, 100);
}

/**
 * Clear the IndexedDB cache.
 */
export async function clearStateCache() {
  try {
    const db = await openIDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CACHE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {}
}

/**
 * Initialize state from IndexedDB cache on load for instant offline first paint.
 */
export async function initStoreCache() {
  try {
    const initialCache = await loadStateCache();
    if (initialCache) {
      state.recipes = Array.isArray(initialCache.recipes) ? initialCache.recipes : [];
      state.ingredients = Array.isArray(initialCache.ingredients) ? initialCache.ingredients : [];
      state.products = Array.isArray(initialCache.products) ? initialCache.products : [];
      state.categories = Array.isArray(initialCache.categories) ? initialCache.categories : [];
      state.preferences = initialCache.preferences || null;
      state.userPrefs = initialCache.userPrefs || {};
      state.settings = initialCache.settings || {};
      state.currentPlan = initialCache.currentPlan || null;
      state.shoppingList = Array.isArray(initialCache.shoppingList) ? initialCache.shoppingList : [];
      state.isCachedHydrated = true;
    }
  } catch (e) {
    console.warn('[Store] initStoreCache warning:', e);
  }
  return state;
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
  const ingredients = state.ingredients || [];
  const products = state.products || [];
  const processed = (Array.isArray(newRecipes) ? newRecipes : []).map(r => {
    const res = autoRecalibrateRecipeDrift(r, ingredients, products);
    return res.recipe;
  });
  state.recipes = processed;
  saveStateCache();
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

/**
 * Upsert a single recipe in the state domain.
 * @param {Object} recipe 
 */
export function updateRecipeInStore(recipe) {
  if (!recipe || !recipe.id) return;
  const ingredients = state.ingredients || [];
  const products = state.products || [];
  const res = autoRecalibrateRecipeDrift(recipe, ingredients, products);
  const processed = res.recipe;

  const index = state.recipes.findIndex(r => r.id === processed.id);
  if (index !== -1) {
    state.recipes[index] = { ...state.recipes[index], ...processed };
  } else {
    state.recipes.push(processed);
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

export function sanitizePreferences(rawPreferences) {
  if (!rawPreferences || typeof rawPreferences !== 'object') return {};
  
  const cleaned = JSON.parse(JSON.stringify(rawPreferences));
  
  // a. Deletes top-level legacy duplicates
  delete cleaned.planHistory;
  delete cleaned.ingredientGroups;
  delete cleaned.ingredientFamilies;
  delete cleaned.userPrefs;

  const keysToPurge = ['snapshots', 'history', 'cache', 'recipeSnapshots', 'ingredientCache', 'productCache', 'advisoryLogs'];
  const deepClean = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    keysToPurge.forEach(k => delete obj[k]);
    Object.keys(obj).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (keysToPurge.includes(key) || lowerKey.includes('cache') || lowerKey.includes('snapshot') || lowerKey.includes('log')) {
        delete obj[key];
      } else if (obj[key] && typeof obj[key] === 'object') {
        deepClean(obj[key]);
      }
    });
  };
  deepClean(cleaned);

  return cleaned;
}

/**
 * Update preferences state domain and dispatch reactive update event.
 * @param {Object|null} newPreferences 
 */
export function setPreferences(newPreferences) {
  const safe = sanitizePreferences(newPreferences);
  state.preferences = safe || null;
  state.userPrefs = (safe && safe.userPrefs) ? safe.userPrefs : (safe || {});
  state.settings = (safe && safe.settings) ? safe.settings : {};
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
 * Update products state domain and dispatch reactive update event.
 * @param {Array<Object>} newProducts 
 */
export function setProducts(newProducts) {
  state.products = Array.isArray(newProducts) ? newProducts : [];
  saveStateCache();
  dispatchStateEvent('plateplan:state:products', state.products);
}

/**
 * Update categories state domain and dispatch reactive update event.
 * @param {Array<string>} newCategories
 */
export function setCategories(newCategories) {
  state.categories = Array.isArray(newCategories) ? newCategories : [];
  saveStateCache();
  dispatchStateEvent('plateplan:state:categories', state.categories);
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
    console.error(`[Store v3.21.12] Network failure in domain '${domain}', executing rollback:`, err);
    
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

if (typeof window !== 'undefined') {
  window.Store = {
    getState,
    setState: (patch) => {
      updateState(patch);
    },
    subscribe
  };
}
