/**
 * src/store/store.js
 * Centralized State Store module using native browser CustomEvents for unidirectional data flow.
 */

const state = {
  recipes: [],
  ingredients: [],
  preferences: null,
  currentPlan: null
};

/**
 * Read-only getter for current application state snapshot.
 * @returns {Object} Current state snapshot.
 */
export const getState = () => state;

/**
 * Update recipes state domain and dispatch reactive update event.
 * @param {Array<Object>} newRecipes 
 */
export function setRecipes(newRecipes) {
  state.recipes = Array.isArray(newRecipes) ? newRecipes : [];
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: state.recipes }));
  }
}

/**
 * Update ingredients state domain and dispatch reactive update event.
 * @param {Array<Object>} newIngredients 
 */
export function setIngredients(newIngredients) {
  state.ingredients = Array.isArray(newIngredients) ? newIngredients : [];
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: state.ingredients }));
  }
}

/**
 * Update preferences state domain and dispatch reactive update event.
 * @param {Object|null} newPreferences 
 */
export function setPreferences(newPreferences) {
  state.preferences = newPreferences || null;
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:preferences', { detail: state.preferences }));
  }
}

/**
 * Update current meal plan state domain and dispatch reactive update event.
 * @param {Object|null} newPlan 
 */
export function setCurrentPlan(newPlan) {
  state.currentPlan = newPlan || null;
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: state.currentPlan }));
  }
}
