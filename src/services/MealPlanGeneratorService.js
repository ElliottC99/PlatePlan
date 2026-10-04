/**
 * src/services/MealPlanGeneratorService.js (v3.19.7)
 * ES6 Meal Plan Generator Engine & Slot Resolver.
 * Generates balanced multi-day meal plans matching household macro targets,
 * cadence repeats, and dietary exclusions without external legacy monolith dependencies.
 */

import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { setCurrentPlan } from '../store/store.js';
import { saveCurrentPlan } from './HouseholdRepository.js';

/**
 * Resolves planned slot data into full recipe information.
 */
export function getPlanSlotInfo(slotData) {
  if (!slotData) return null;
  const id = typeof slotData === 'string' ? slotData : slotData.id;
  const variant = (typeof slotData === 'object' && slotData.variant) ? slotData.variant : 'original';
  const instanceId = typeof slotData === 'object' ? (slotData.instanceId || `${id}_${Date.now()}`) : `${id}_${Date.now()}`;
  
  const recipes = window.state?.recipes || [];
  const recipe = recipes.find(r => r && r.id === id) || null;
  if (!recipe) {
    return { id, variant, instanceId, recipe: null, active: null };
  }

  const active = (variant === 'enhanced' && recipe.enhanced) 
    ? { ...recipe, ...recipe.enhanced, ingredients: recipe.enhanced.ingredients || recipe.ingredients }
    : recipe;

  return { id, variant, instanceId, recipe, active };
}

/**
 * Resolves nutrition for a planned slot.
 */
export function getPlannedSlotNutrition(activeRecipe, slotKey = 'dinnerE', instanceId = null, plan = null) {
  if (!activeRecipe) return { cal: 0, prot: 0 };
  const mealType = slotKey.startsWith('breakfast') ? 'breakfast' : (slotKey.startsWith('lunch') ? 'lunch' : 'dinner');
  const person = slotKey.endsWith('E') ? 'elliott' : 'chloe';

  const res = calculateMealFitScore(activeRecipe, mealType, {
    activeProfile: person,
    portionScaled: true
  });

  const detail = res?.details?.[person];
  if (detail) {
    return { cal: detail.scaledKcal || 0, prot: detail.scaledProtein || 0 };
  }
  return { cal: Number(activeRecipe.calories || activeRecipe.cal || 0), prot: Number(activeRecipe.protein || activeRecipe.prot || 0) };
}

/**
 * Generates an automated household meal plan adhering to cadence, macros, and preferences.
 */
export function generateMealPlan(options = {}) {
  const days = Number(options.days || window.state?.plannerDays || window.state?.plan?.days || 7);
  const startDateStr = options.startDate || window.state?.plannerStartDate || new Date().toISOString().split('T')[0];
  const cadence = options.cadence || window.state?.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
  const minFitScore = Number(options.minFitScore || window.state?.prefs?.minFitScore || 0);
  const allRecipes = Array.isArray(options.recipes) ? options.recipes : (window.state?.recipes || []);

  if (!allRecipes.length) {
    throw new Error('No recipes available in the Recipe Vault to generate plan.');
  }

  const startDate = new Date(startDateStr);
  const dayDates = {};
  for (let d = 1; d <= days; d++) {
    const cur = new Date(startDate);
    cur.setDate(startDate.getDate() + (d - 1));
    dayDates[d] = cur.toISOString().split('T')[0];
  }

  const getFilteredRecipes = (type) => {
    return allRecipes.filter(r => {
      const types = (r.types || [r.type || 'dinner']).map(t => String(t).toLowerCase());
      if (!types.includes(type)) return false;
      if (minFitScore > 0) {
        const score = calculateMealFitScore(r, type, { activeProfile: 'everyone' }).score;
        if (score < minFitScore) return false;
      }
      return true;
    });
  };

  const breakfasts = getFilteredRecipes('breakfast').length ? getFilteredRecipes('breakfast') : allRecipes;
  const lunches = getFilteredRecipes('lunch').length ? getFilteredRecipes('lunch') : allRecipes;
  const dinners = getFilteredRecipes('dinner').length ? getFilteredRecipes('dinner') : allRecipes;

  const slots = {};
  const mealPrepGroups = [];

  const fillMealType = (mealType, pool, repeatCount) => {
    let poolIdx = 0;
    let d = 1;
    while (d <= days) {
      const recipe = pool[poolIdx % pool.length];
      poolIdx++;
      const variant = recipe.enhanced ? 'enhanced' : 'original';
      const instanceId = `inst_${recipe.id}_d${d}_${Math.random().toString(36).substr(2, 5)}`;
      const assignedDays = [];

      const span = Math.min(repeatCount, days - d + 1);
      for (let s = 0; s < span; s++) {
        const curDay = d + s;
        if (!slots[curDay]) slots[curDay] = {};
        const slotData = { id: recipe.id, variant, instanceId, isSkipped: false, skipped: false };
        slots[curDay][`${mealType}E`] = slotData;
        slots[curDay][`${mealType}C`] = slotData;
        assignedDays.push(curDay);
      }

      if (assignedDays.length > 1) {
        mealPrepGroups.push({
          id: `prep_${instanceId}`,
          recipeId: recipe.id,
          recipeName: recipe.name || 'Recipe',
          mealType,
          days: assignedDays,
          servings: assignedDays.length * 2
        });
      }

      d += span;
    }
  };

  fillMealType('breakfast', breakfasts, cadence.breakfast || 1);
  fillMealType('lunch', lunches, cadence.lunch || 2);
  fillMealType('dinner', dinners, cadence.dinner || 2);

  return {
    days,
    startDate: startDateStr,
    dayDates,
    slots,
    mealPrepGroups,
    createdAt: new Date().toISOString()
  };
}

/**
 * Triggers interactive plan generation from the UI and updates centralized state.
 */
export async function generatePlan() {
  if (typeof window === 'undefined') return;
  try {
    const plan = generateMealPlan();
    if (window.state) {
      window.state.plan = plan;
      window.state.plannerStep = 2;
    }

    setCurrentPlan(plan);

    // Save to Firestore asynchronously
    saveCurrentPlan(plan).catch(err => {
      console.warn('[MealPlanGeneratorService] Background cloud save warning:', err);
    });

    document.dispatchEvent(new CustomEvent('plateplan:state:plan', { detail: plan }));

    if (typeof window.renderPlanner === 'function') {
      window.renderPlanner();
    }
    if (typeof window.renderShoppingListUI === 'function') {
      window.renderShoppingListUI();
    }
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('✨ Meal plan generated successfully!', 'success');
    }
  } catch (err) {
    console.error('[MealPlanGeneratorService] Error generating meal plan:', err);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Failed to generate plan: ${err.message}`, 'error');
    }
  }
}

// Global browser registration for backward compatibility
if (typeof window !== 'undefined') {
  window.generatePlan = generatePlan;
  window.generateMealPlan = generateMealPlan;
  window.getPlanSlotInfo = getPlanSlotInfo;
  window.getPlannedSlotNutrition = getPlannedSlotNutrition;
}
