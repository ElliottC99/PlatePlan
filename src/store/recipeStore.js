/**
 * src/store/recipeStore.js (v3.38.4)
 * Domain state slice for Recipes, Draft Recipes, and Meal Plans.
 * Provides reactive setters and microtask-debounced event dispatching.
 */

import { saveStateCache } from './cacheSlice.js';
import { autoRecalibrateRecipeDrift } from '../services/DataQualityEngine.js';

let recipeState = {
  recipes: [],
  draftRecipes: [],
  currentPlan: null
};

function dispatchStateEvent(eventName, detail) {
  if (typeof window === 'undefined') return;
  Promise.resolve().then(() => {
    try {
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
    } catch (err) {
      console.warn(`[RecipeStore] Failed to dispatch ${eventName}:`, err);
    }
  });
}

export function getRecipeState() {
  return recipeState;
}

export function setRecipes(newRecipes, ingredients = [], products = []) {
  const processed = (Array.isArray(newRecipes) ? newRecipes : []).map(r => {
    const res = autoRecalibrateRecipeDrift(r, ingredients, products);
    return res.recipe;
  });
  recipeState.recipes = processed;
  if (typeof window !== 'undefined') {
    if (!window.state) window.state = {};
    window.state.recipes = recipeState.recipes;
  }
  saveStateCache(recipeState);
  dispatchStateEvent('plateplan:state:recipes', recipeState.recipes);
}

export function updateRecipeInStore(recipe, ingredients = [], products = []) {
  if (!recipe || !recipe.id) return;
  const res = autoRecalibrateRecipeDrift(recipe, ingredients, products);
  const processed = res.recipe;

  const index = recipeState.recipes.findIndex(r => r.id === processed.id);
  if (index !== -1) {
    recipeState.recipes[index] = { ...recipeState.recipes[index], ...processed };
  } else {
    recipeState.recipes.push(processed);
  }
  if (typeof window !== 'undefined') {
    if (!window.state) window.state = {};
    window.state.recipes = recipeState.recipes;
  }
  saveStateCache(recipeState);
  dispatchStateEvent('plateplan:state:recipes', recipeState.recipes);
}

export function removeRecipeFromStore(recipeId) {
  if (!recipeId) return;
  recipeState.recipes = recipeState.recipes.filter(r => r.id !== recipeId);
  if (typeof window !== 'undefined') {
    if (!window.state) window.state = {};
    window.state.recipes = recipeState.recipes;
  }
  saveStateCache(recipeState);
  dispatchStateEvent('plateplan:state:recipes', recipeState.recipes);
}

export function setCurrentPlan(newPlan) {
  recipeState.currentPlan = newPlan || null;
  if (typeof window !== 'undefined') {
    if (!window.state) window.state = {};
    window.state.plan = recipeState.currentPlan;
  }
  saveStateCache(recipeState);
  dispatchStateEvent('plateplan:state:plan', recipeState.currentPlan);
}

export function hydrateRecipeStore(cacheData = {}) {
  if (Array.isArray(cacheData.recipes)) recipeState.recipes = cacheData.recipes;
  if (Array.isArray(cacheData.draftRecipes)) recipeState.draftRecipes = cacheData.draftRecipes;
  if (cacheData.currentPlan) recipeState.currentPlan = cacheData.currentPlan;
}
