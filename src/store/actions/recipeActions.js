/**
 * src/store/actions/recipeActions.js (v3.38.55)
 * Domain-specific store mutations and actions for Recipes, Drafts, and Plans.
 * Binds directly to the reactive central state object and cacheSlice.
 */

import { state, dispatchStateEvent } from '../state.js';
import { saveStateCache } from '../cacheSlice.js';
import { safeClone } from '../../utils/safeJson.js';
import * as RecipeSlice from '../recipeStore.js';

export function setRecipes(newRecipes) {
  const ingredients = state.ingredients || [];
  const products = state.products || [];
  RecipeSlice.setRecipes(newRecipes, ingredients, products);
  state.recipes = RecipeSlice.getRecipeState().recipes;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

export function updateRecipeInStore(recipe) {
  if (!recipe || !recipe.id) return;
  const ingredients = state.ingredients || [];
  const products = state.products || [];
  RecipeSlice.updateRecipeInStore(recipe, ingredients, products);
  state.recipes = RecipeSlice.getRecipeState().recipes;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

export function removeRecipeFromStore(recipeId) {
  if (!recipeId) return;
  RecipeSlice.removeRecipeFromStore(recipeId);
  state.recipes = RecipeSlice.getRecipeState().recipes;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:recipes', state.recipes);
}

export function setCurrentPlan(newPlan) {
  RecipeSlice.setCurrentPlan(newPlan);
  state.currentPlan = RecipeSlice.getRecipeState().currentPlan;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:plan', state.currentPlan);
}

export function reorderDraftRecipes(oldIndex, newIndex) {
  const recipes = state.draftRecipes || [];
  if (oldIndex < 0 || oldIndex >= recipes.length || newIndex < 0 || newIndex >= recipes.length) return;
  
  const [movedItem] = recipes.splice(oldIndex, 1);
  recipes.splice(newIndex, 0, movedItem);
  
  saveStateCache(state);
  dispatchStateEvent('plateplan:recipes-updated', recipes);
  dispatchStateEvent('plateplan:state:patch', { draftRecipes: recipes });
}

export async function runOptimisticMutation(domain, mutateFn, persistPromise, rollbackFn, errorMessage) {
  const previousStateSnapshot = safeClone(state[domain] || null);
  
  if (typeof mutateFn === 'function') {
    mutateFn(state);
    saveStateCache(state);
    dispatchStateEvent(`plateplan:state:${domain}`, state[domain]);
  }

  try {
    const result = await persistPromise;
    if (result && result.success === false) {
      throw new Error(result.error || 'Persistence returned false status');
    }
    return result;
  } catch (err) {
    console.error(`[Store] Network failure in domain '${domain}', executing rollback:`, err);
    
    if (typeof rollbackFn === 'function') {
      rollbackFn(state, previousStateSnapshot);
    } else {
      state[domain] = previousStateSnapshot;
    }
    saveStateCache(state);
    dispatchStateEvent(`plateplan:state:${domain}`, state[domain]);

    if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(errorMessage || 'Network sync failed. Changes rolled back.', 'error');
    }
    
    throw err;
  }
}
