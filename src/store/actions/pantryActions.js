/**
 * src/store/actions/pantryActions.js (v3.38.55)
 * Domain-specific store mutations and actions for Ingredients, Products, Categories, and Preferences.
 * Binds directly to the reactive central state object and cacheSlice.
 */

import { state, dispatchStateEvent } from '../state.js';
import { saveStateCache } from '../cacheSlice.js';
import { setIngredients as setPantryIngredients, setProducts as setPantryProducts, setCategories as setPantryCategories } from '../pantryStore.js';

export function setIngredients(newIngredients) {
  setPantryIngredients(newIngredients);
  state.ingredients = Array.isArray(newIngredients) ? newIngredients : [];
  state.rootItems = state.ingredients;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:ingredients', state.ingredients);
  dispatchStateEvent('plateplan:state:root-items', state.rootItems);
}

export function setRootItems(newRootItems) {
  setIngredients(newRootItems);
}

export function setProducts(newProducts) {
  setPantryProducts(newProducts);
  state.products = Array.isArray(newProducts) ? newProducts : [];
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:products', state.products);
}

export function setCategories(newCategories) {
  setPantryCategories(newCategories);
  state.categories = Array.isArray(newCategories) ? newCategories : [];
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:categories', state.categories);
}

export function updateIngredientInStore(ingredient) {
  if (!ingredient || !ingredient.id) return;
  const index = state.ingredients.findIndex(i => i.id === ingredient.id);
  if (index !== -1) {
    state.ingredients[index] = { ...state.ingredients[index], ...ingredient };
  } else {
    state.ingredients.push(ingredient);
  }
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:ingredients', state.ingredients);
}

export function removeIngredientFromStore(ingredientId) {
  if (!ingredientId) return;
  state.ingredients = state.ingredients.filter(i => i.id !== ingredientId);
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:ingredients', state.ingredients);
}

export function sanitizePreferences(rawPreferences) {
  if (!rawPreferences || typeof rawPreferences !== 'object') return {};
  
  const cleaned = JSON.parse(JSON.stringify(rawPreferences));
  
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

export function setPreferences(newPreferences) {
  const safe = sanitizePreferences(newPreferences);
  state.preferences = safe || null;
  state.userPrefs = (safe && safe.userPrefs) ? safe.userPrefs : (safe || {});
  state.settings = (safe && safe.settings) ? safe.settings : {};
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:preferences', state.preferences);
}

export async function learnIngredientAlias(ingredientId, rawString, subtypeId = null) {
  if (!ingredientId || !rawString) return;
  const ingredientsList = state.ingredients.length > 0 ? state.ingredients : [];
  const ing = ingredientsList.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  const cleanAlias = String(rawString).trim().toLowerCase();
  if (!cleanAlias) return;

  let targetDoc = ing;
  if (subtypeId && Array.isArray(ing.subtypes)) {
    const sub = ing.subtypes.find(s => String(s.id) === String(subtypeId));
    if (sub) targetDoc = sub;
  }

  if (!Array.isArray(targetDoc.aliases)) targetDoc.aliases = [];
  const lowerAliases = targetDoc.aliases.map(a => String(a).toLowerCase());

  if (!lowerAliases.includes(cleanAlias)) {
    targetDoc.aliases.push(cleanAlias);
    if (!state.ingredients.includes(ing)) state.ingredients.push(ing);
    saveStateCache(state);
    dispatchStateEvent('plateplan:state:ingredients', state.ingredients);

    try {
      const { saveRootItem: saveIngredient } = await import('../../services/RootItemRepository.js');
      await saveIngredient(ing);
    } catch (err) {
      console.warn('[Store] Failed to persist learned ingredient alias:', err);
    }
  }
}
