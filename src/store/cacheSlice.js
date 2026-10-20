/**
 * src/store/cacheSlice.js
 * IndexedDB cache management for application state.
 */

const DB_NAME = 'PlatePlanDB';
const STORE_NAME = 'StateStore';
const DB_VERSION = 1;
export const CACHE_KEY = 'plateplan_store_cache_v3.35.4';

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

export async function loadStateCache() {
  try {
    const db = await openIDB();
    const idbData = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (idbData && (Array.isArray(idbData.recipes) && idbData.recipes.length > 0)) {
      return idbData;
    }
  } catch (e) {
    console.warn('[Store] IndexedDB cache read failed, attempting LocalStorage fallback:', e);
  }

  // LocalStorage Fallback
  try {
    const recipes = JSON.parse(localStorage.getItem('plateplan_recipes') || '[]');
    const ingredients = JSON.parse(localStorage.getItem('plateplan_ingredients') || '[]');
    const products = JSON.parse(localStorage.getItem('plateplan_products') || '[]');
    const shoppingList = JSON.parse(localStorage.getItem('plateplan_shopping') || '[]');
    const inventory = JSON.parse(localStorage.getItem('plateplan_inventory') || '[]');
    
    let v2Blob = null;
    if (recipes.length === 0) {
      const rawV2 = localStorage.getItem('plateplan_v2') || localStorage.getItem('plateplan_v2_recovery');
      if (rawV2) v2Blob = JSON.parse(rawV2);
    }

    const fallbackCache = {
      recipes: recipes.length > 0 ? recipes : (v2Blob?.recipes || []),
      ingredients: ingredients.length > 0 ? ingredients : (v2Blob?.ingredients || []),
      products: products.length > 0 ? products : (v2Blob?.products || []),
      categories: v2Blob?.categories || [],
      inventory: inventory.length > 0 ? inventory : (v2Blob?.inventory || []),
      shoppingList: shoppingList.length > 0 ? shoppingList : (v2Blob?.shoppingList || []),
      preferences: v2Blob?.preferences || null,
      userPrefs: v2Blob?.userPrefs || {},
      settings: v2Blob?.settings || {}
    };

    if (fallbackCache.recipes.length > 0) {
      console.info(`[Store] Successfully recovered ${fallbackCache.recipes.length} recipes from LocalStorage fallback.`);
      return fallbackCache;
    }
  } catch (err) {
    console.error('[Store] LocalStorage fallback recovery error:', err);
  }

  return null;
}

let saveTimer = null;
export function saveStateCache(state) {
  if (!state || typeof state !== 'object' || !state.recipes) {
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      if (!state || typeof state !== 'object' || !state.recipes) {
        return;
      }
      const payload = {
        recipes: state.recipes || [],
        ingredients: state.ingredients || [],
        products: state.products || [],
        categories: state.categories || [],
        inventory: state.inventory || [],
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

export async function initStoreCache(targetState) {
  try {
    const initialCache = await loadStateCache();
    if (initialCache && targetState) {
      targetState.recipes = Array.isArray(initialCache.recipes) ? initialCache.recipes : [];
      targetState.ingredients = Array.isArray(initialCache.ingredients) ? initialCache.ingredients : [];
      targetState.products = Array.isArray(initialCache.products) ? initialCache.products : [];
      targetState.categories = Array.isArray(initialCache.categories) ? initialCache.categories : [];
      targetState.inventory = Array.isArray(initialCache.inventory) ? initialCache.inventory : [];
      targetState.preferences = initialCache.preferences || null;
      targetState.userPrefs = initialCache.userPrefs || {};
      targetState.settings = initialCache.settings || {};
      targetState.currentPlan = initialCache.currentPlan || null;
      targetState.shoppingList = Array.isArray(initialCache.shoppingList) ? initialCache.shoppingList : [];
      targetState.isCachedHydrated = true;
    }
    return targetState;
  } catch (e) {
    console.warn('[CacheSlice] initStoreCache warning:', e);
    return targetState;
  }
}
