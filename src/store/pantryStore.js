/**
 * src/store/pantryStore.js (v3.38.3)
 * Domain state slice for Pantry Ingredients, Products, and Categories.
 * Provides microtask-debounced dispatching and reactive state management.
 */

import { saveStateCache } from './store.js';

let pantryState = {
  ingredients: [],
  products: [],
  categories: []
};

function dispatchStateEvent(eventName, detail) {
  if (typeof window === 'undefined') return;
  Promise.resolve().then(() => {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch (err) {
      console.warn(`[PantryStore] Failed to dispatch ${eventName}:`, err);
    }
  });
}

export function getPantryState() {
  return pantryState;
}

export function setIngredients(newIngredients) {
  pantryState.ingredients = Array.isArray(newIngredients) ? newIngredients : [];
  dispatchStateEvent('plateplan:state:ingredients', pantryState.ingredients);
  saveStateCache();
}

export function setProducts(newProducts) {
  pantryState.products = Array.isArray(newProducts) ? newProducts : [];
  dispatchStateEvent('plateplan:state:products', pantryState.products);
  saveStateCache();
}

export function setCategories(newCategories) {
  pantryState.categories = Array.isArray(newCategories) ? newCategories : [];
  dispatchStateEvent('plateplan:state:categories', pantryState.categories);
  saveStateCache();
}

export function hydratePantryStore(cacheData = {}) {
  if (Array.isArray(cacheData.ingredients)) pantryState.ingredients = cacheData.ingredients;
  if (Array.isArray(cacheData.products)) pantryState.products = cacheData.products;
  if (Array.isArray(cacheData.categories)) pantryState.categories = cacheData.categories;
}
