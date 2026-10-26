/**
 * src/store/planSlice.js
 * Meal plan state management.
 */

import { state, dispatchStateEvent } from './state.js';
import { saveStateCache } from './cacheSlice.js';
import { savePlan } from '../repositories/PlanRepository.js';
import { setRecipes as setRecipeSliceRecipes, updateRecipeInStore as updateRecipeInRecipeStore, removeRecipeFromStore as removeRecipeFromRecipeStore, setCurrentPlan as setRecipeSliceCurrentPlan, getRecipeState } from './recipeStore.js';

export function setActivePlan(newPlan) {
  state.currentPlan = newPlan || null;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:plan', state.currentPlan);
  if (newPlan) {
    savePlan(newPlan);
  }
}

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
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:plan', state.currentPlan);
  savePlan(state.currentPlan);
}

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

export function clearPlan() {
  state.currentPlan = null;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:plan', null);
}
