/**
 * src/store/store.js (v3.28.2-ui)
 * Centralized Reactive State Store module using native browser CustomEvents for unidirectional data flow.
 * Provides microtask-wrapped event dispatching and IndexedDB caching for instant offline hydration without localStorage quotas.
 */

import { safeJsonStringify, safeClone } from '../utils/safeJson.js';
import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { autoRecalibrateRecipeDrift } from '../services/DataQualityEngine.js';
import { savePantryItem, toggleUseUpStatusInDb } from '../repositories/InventoryRepository.js';
import { savePlan } from '../repositories/PlanRepository.js';

export { getShoppingLineStateKey };

const DB_NAME = 'PlatePlanDB';
const STORE_NAME = 'StateStore';
const DB_VERSION = 1;
const CACHE_KEY = 'plateplan_store_cache_v3.28.2-ui';

const state = {
  version: 'v3.28.2-ui',
  recipes: [],
  ingredients: [],
  products: [],
  categories: [],
  inventory: [],
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
 * Supports both raw item arrays and full shopping list objects with persistence.
 * @param {Array<Object>|Object|null} listOrArray 
 */
export async function setShoppingList(listOrArray) {
  if (Array.isArray(listOrArray)) {
    state.shoppingList = listOrArray;
  } else if (listOrArray && typeof listOrArray === 'object') {
    state.shoppingList = Array.isArray(listOrArray.items) ? listOrArray.items : [];
  } else {
    state.shoppingList = [];
  }
  
  saveStateCache();
  dispatchStateEvent('plateplan:state:shopping', state.shoppingList);
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);

  if (listOrArray && !Array.isArray(listOrArray) && listOrArray.id) {
    try {
      const { saveShoppingList } = await import('../repositories/ShoppingListRepository.js');
      await saveShoppingList(listOrArray);
    } catch (err) {
      console.warn('[Store] Failed to persist shopping list:', err);
    }
  }
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
  * Update inventory state domain and dispatch reactive update event.
  * @param {Array<Object>} newInventory 
  */
export function setInventory(newInventory) {
  state.inventory = Array.isArray(newInventory) ? newInventory : [];
  saveStateCache();
  dispatchStateEvent('plateplan:state:inventory', state.inventory);
}

/**
  * Update or add a single pantry inventory item in state and persist directly to subcollection.
  * @param {string} itemId 
  * @param {Object} patch 
  */
export function updatePantryItem(itemId, patch = {}) {
  if (!itemId && !patch.id) return;
  const targetId = itemId || patch.id;
  const list = state.inventory || [];
  const idx = list.findIndex(i => i.id === targetId);
  let updatedItem;
  if (idx !== -1) {
    updatedItem = { ...list[idx], ...patch, id: targetId, updatedAt: new Date().toISOString() };
    list[idx] = updatedItem;
  } else {
    updatedItem = { id: targetId, status: 'in_stock', isUseUp: false, quantity: null, unit: null, expiryDate: null, ...patch, updatedAt: new Date().toISOString() };
    list.push(updatedItem);
  }
  state.inventory = [...list];
  saveStateCache();
  dispatchStateEvent('plateplan:state:inventory', state.inventory);

  // Persist directly to inventory subcollection
  savePantryItem(updatedItem);
}

/**
  * Toggle isUseUp flag for a pantry inventory item.
  * @param {string} itemId 
  */
export function toggleUseUpStatus(itemId) {
  if (!itemId) return;
  const list = state.inventory || [];
  const item = list.find(i => i.id === itemId);
  if (!item) return;
  const newStatus = !item.isUseUp;
  updatePantryItem(itemId, { isUseUp: newStatus });
  toggleUseUpStatusInDb(itemId, newStatus);
}

/**
 * Sets active plan state domain and persists to subcollection.
 * @param {Object} newPlan 
 */
export function setActivePlan(newPlan) {
  state.currentPlan = newPlan || null;
  saveStateCache();
  dispatchStateEvent('plateplan:state:plan', state.currentPlan);
  if (newPlan) {
    savePlan(newPlan);
  }
}

/**
 * Updates a meal entry in active plan day.
 */
export function updatePlanMeal(dayIndex, mealIndex, patch = {}) {
  if (!state.currentPlan || !Array.isArray(state.currentPlan.days) || !state.currentPlan.days[dayIndex]) return;
  const day = state.currentPlan.days[dayIndex];
  if (!Array.isArray(day.meals) || !day.meals[mealIndex]) return;

  day.meals[mealIndex] = { ...day.meals[mealIndex], ...patch };

  // Recalculate daily totals
  let totalCal = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  day.meals.forEach(m => {
    if (m && m.macros) {
      totalCal += Number(m.macros.calories || 0);
      totalProt += Number(m.macros.protein || 0);
      totalCarbs += Number(m.macros.carbs || 0);
      totalFat += Number(m.macros.fat || 0);
    }
  });

  day.dailyTotals = {
    calories: Math.round(totalCal),
    protein: Math.round(totalProt),
    carbs: Math.round(totalCarbs),
    fat: Math.round(totalFat)
  };

  const targetProt = state.currentPlan.macroTargets?.protein || 140;
  day.proteinDeltaPct = Math.round(((totalProt - targetProt) / targetProt) * 100);

  state.currentPlan.updatedAt = new Date().toISOString();
  saveStateCache();
  dispatchStateEvent('plateplan:state:plan', state.currentPlan);
  savePlan(state.currentPlan);
}

/**
 * Swaps recipe for a specific meal in active plan.
 */
export function swapPlanRecipe(dayIndex, mealType, newRecipeId) {
  if (!state.currentPlan || !Array.isArray(state.currentPlan.days) || !state.currentPlan.days[dayIndex]) return;
  const day = state.currentPlan.days[dayIndex];
  const mealIdx = day.meals.findIndex(m => m.mealType === mealType);
  if (mealIdx === -1) return;

  const recipes = state.recipes || [];
  const recipe = recipes.find(r => r.id === newRecipeId);
  if (!recipe) return;

  const cal = Number(recipe.macros?.calories || recipe.calories || 450);
  const prot = Number(recipe.macros?.protein || recipe.protein || 25);
  const carbs = Number(recipe.macros?.carbs || recipe.carbs || 45);
  const fat = Number(recipe.macros?.fat || recipe.fat || 15);

  updatePlanMeal(dayIndex, mealIdx, {
    recipeId: recipe.id,
    recipeTitle: recipe.title || recipe.name,
    servings: recipe.servings || 1,
    macros: { calories: cal, protein: prot, carbs, fat }
  });
}

/**
 * Clears active plan state.
 */
export function clearPlan() {
  state.currentPlan = null;
  saveStateCache();
  dispatchStateEvent('plateplan:state:plan', null);
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
    console.error(`[Store v3.25.0] Network failure in domain '${domain}', executing rollback:`, err);
    
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
 * Learns an alias for an ingredient taxonomy item and persists to repository.
 * @param {string} ingredientId 
 * @param {string} rawString 
 */
export async function learnIngredientAlias(ingredientId, rawString) {
  if (!ingredientId || !rawString) return;
  const ingredientsList = state.ingredients.length > 0 ? state.ingredients : (window.state?.ingredients || []);
  const ing = ingredientsList.find(i => i.id === ingredientId);
  if (!ing) return;

  if (!Array.isArray(ing.aliases)) ing.aliases = [];
  const cleanAlias = String(rawString).trim();
  const lowerAliases = ing.aliases.map(a => a.toLowerCase());

  if (cleanAlias && !lowerAliases.includes(cleanAlias.toLowerCase())) {
    ing.aliases.push(cleanAlias);
    if (!state.ingredients.includes(ing)) state.ingredients.push(ing);
    saveStateCache();
    dispatchStateEvent('plateplan:state:ingredients', state.ingredients);

    try {
      const { saveIngredient } = await import('../repositories/HouseholdRepository.js');
      await saveIngredient(ing);
    } catch (err) {
      console.warn('[Store] Failed to persist learned ingredient alias:', err);
    }
  }
}



/**
 * Toggle checked status of a shopping item.
 * @param {string} itemId 
 */
export async function toggleShoppingItem(itemId) {
  const item = state.shoppingList.find(i => i.id === itemId);
  if (!item) return;

  item.isChecked = !item.isChecked;
  saveStateCache();
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);

  // If checked off while shopping, optionally replenish pantry stock
  if (item.isChecked && item.ingredientId) {
    try {
      const invItem = {
        id: `inv_${item.ingredientId}`,
        ingredientId: item.ingredientId,
        customName: item.name,
        status: 'in_stock',
        isUseUp: false,
        quantity: item.buyQty || item.requiredQty || 1,
        unit: item.unit || 'qty',
        updatedAt: new Date().toISOString()
      };
      const { savePantryItem } = await import('../repositories/InventoryRepository.js');
      await savePantryItem(invItem);
      
      const existingInv = state.inventory.find(i => i.id === invItem.id);
      if (existingInv) {
        existingInv.status = 'in_stock';
        existingInv.quantity = invItem.quantity;
      } else {
        state.inventory.push(invItem);
      }
      dispatchStateEvent('plateplan:state:inventory', state.inventory);
    } catch (err) {
      console.warn('[Store] Failed to replenish pantry stock on shopping checkoff:', err);
    }
  }
}

/**
 * Add a manual item to the shopping list.
 * @param {Object} newItem 
 */
export async function addManualShoppingItem(newItem) {
  const item = {
    id: `item_${Math.random().toString(36).substr(2, 9)}`,
    ingredientId: newItem.ingredientId || '',
    name: newItem.name || 'Custom Item',
    category: newItem.category || 'Uncategorized',
    requiredQty: Number(newItem.requiredQty) || 1,
    inStockQty: 0,
    buyQty: Number(newItem.requiredQty) || 1,
    unit: newItem.unit || 'qty',
    isChecked: false,
    isManualAdd: true,
    ...newItem
  };

  state.shoppingList.push(item);
  saveStateCache();
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);
}

/**
 * Update quantity for a shopping list item.
 * @param {string} itemId 
 * @param {number} newQty 
 */
export async function updateShoppingItemQty(itemId, newQty) {
  const item = state.shoppingList.find(i => i.id === itemId);
  if (!item) return;

  item.buyQty = Math.max(0, Number(newQty) || 0);
  saveStateCache();
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);
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

export const setState = updateState;

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
  window.setInventory = setInventory;
  window.updatePantryItem = updatePantryItem;
  window.toggleUseUpStatus = toggleUseUpStatus;
  window.setActivePlan = setActivePlan;
  window.updatePlanMeal = updatePlanMeal;
  window.swapPlanRecipe = swapPlanRecipe;
  window.clearPlan = clearPlan;
  window.learnIngredientAlias = learnIngredientAlias;
  window.setShoppingList = setShoppingList;
  window.toggleShoppingItem = toggleShoppingItem;
  window.addManualShoppingItem = addManualShoppingItem;
  window.updateShoppingItemQty = updateShoppingItemQty;
  window.Store = {
    getState,
    setState: (patch) => {
      updateState(patch);
    },
    setInventory,
    updatePantryItem,
    toggleUseUpStatus,
    setActivePlan,
    updatePlanMeal,
    swapPlanRecipe,
    clearPlan,
    setShoppingList,
    toggleShoppingItem,
    addManualShoppingItem,
    updateShoppingItemQty,
    subscribe,
    learnIngredientAlias
  };
  window.store = window.Store;
}
