/**
 * src/services/PlanGeneratorService.js (v3.24.0)
 * Automated Meal Plan Generator & Macro Optimization Engine for PlatePlan.
 * Multi-day / weekly generator balancing macro targets, use-up pantry priorities,
 * and high-protein vegetarian rotation.
 */

import { getState } from '../store/store.js';
import { calculateRecipePantryMatch } from './InventoryService.js';

const PROTEIN_KEYWORDS = [
  'tofu', 'tempeh', 'seitan', 'halloumi', 'lentils', 'paneer',
  'chickpeas', 'beans', 'edamame', 'egg', 'eggs', 'soya', 'falafel'
];

/**
 * Detects dominant protein source keyword in a recipe.
 */
export function detectPrimaryProteinKeyword(recipe) {
  if (!recipe) return 'other';
  const text = [
    recipe.title || recipe.name || '',
    ...(recipe.ingredients || []).map(i => i.name || i.raw || '')
  ].join(' ').toLowerCase();

  for (const kw of PROTEIN_KEYWORDS) {
    if (text.includes(kw)) {
      return kw === 'eggs' ? 'egg' : kw;
    }
  }
  return 'other';
}

/**
 * Generates an automated multi-day or weekly meal plan.
 */
export function generateWeeklyPlan(options = {}) {
  const storeState = (typeof getState === 'function') ? getState() : {};
  const recipes = options.recipes || storeState.recipes || [];
  const inventory = options.inventory || storeState.inventory || [];

  if (!recipes || recipes.length === 0) {
    throw new Error('No recipes available in state to generate meal plan.');
  }

  const numDays = typeof options.days === 'number' ? options.days : (Array.isArray(options.days) ? options.days.length : 7);
  const startDateStr = options.startDate || new Date().toISOString().split('T')[0];

  const dailyTargets = {
    calories: Number(options.dailyTargets?.calories || 2000),
    protein: Number(options.dailyTargets?.protein || 140),
    carbs: Number(options.dailyTargets?.carbs || 200),
    fat: Number(options.dailyTargets?.fat || 65)
  };

  const pantryPriorityWeight = Number(options.pantryPriorityWeight !== undefined ? options.pantryPriorityWeight : 1.5);
  const enableProteinRotation = options.proteinRotation !== false;

  // Enrich all recipes with pantry match and protein keyword metadata
  const candidateRecipes = recipes.map(r => {
    const pm = calculateRecipePantryMatch(r, inventory);
    const proteinKw = detectPrimaryProteinKeyword(r);
    const calories = Number(r.macros?.calories || r.calories || r.cal || 450);
    const protein = Number(r.macros?.protein || r.protein || r.prot || 25);
    const carbs = Number(r.macros?.carbs || r.carbohydrateContent || r.carbs || 45);
    const fat = Number(r.macros?.fat || r.fatContent || r.fat || 15);

    return {
      ...r,
      _pantryMatch: pm,
      _proteinKw: proteinKw,
      _macros: { calories, protein, carbs, fat }
    };
  });

  const planDays = [];
  let prevMainProtein = '';
  let totalUseUpItems = 0;
  let totalMatchPct = 0;

  const startDate = new Date(startDateStr);

  for (let d = 0; d < numDays; d++) {
    const curDate = new Date(startDate);
    curDate.setDate(startDate.getDate() + d);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayName = curDate.toLocaleDateString('en-US', { weekday: 'long' });

    // Allocate targets for 3 meal slots: Lunch (~40%), Dinner (~45%), Snack (~15%)
    const slotTargets = [
      { mealType: 'lunch', targetProt: dailyTargets.protein * 0.40, targetCal: dailyTargets.calories * 0.40 },
      { mealType: 'dinner', targetProt: dailyTargets.protein * 0.45, targetCal: dailyTargets.calories * 0.45 },
      { mealType: 'snack', targetProt: dailyTargets.protein * 0.15, targetCal: dailyTargets.calories * 0.15 }
    ];

    const dayMeals = [];
    let dayCalories = 0;
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFat = 0;

    slotTargets.forEach(slot => {
      // Score candidates for this slot
      const scored = candidateRecipes.map(r => {
        const baseProt = r._macros.protein;
        const baseCal = r._macros.calories;

        // Calculate optimal serving multiplier (0.5, 1, 1.5, 2)
        const rawServings = slot.targetProt / Math.max(baseProt, 10);
        const servings = Math.max(0.5, Math.round(rawServings * 2) / 2);

        const scaledProt = baseProt * servings;
        const scaledCal = baseCal * servings;

        // Base macro closeness score (higher is better)
        const protDist = Math.abs(scaledProt - slot.targetProt);
        const calDist = Math.abs(scaledCal - slot.targetCal);
        let fitScore = 100 - (protDist * 1.5 + calDist * 0.05);

        // Apply Pantry & Use-Up Priority boost
        if (pantryPriorityWeight > 0) {
          if (r._pantryMatch.useUpMatches.length > 0) {
            fitScore += (r._pantryMatch.useUpMatches.length * 20 * pantryPriorityWeight);
          }
          fitScore += (r._pantryMatch.matchPercentage * 0.3 * pantryPriorityWeight);
        }

        // Apply Protein Rotation penalty for main meals
        if (enableProteinRotation && (slot.mealType === 'lunch' || slot.mealType === 'dinner')) {
          if (prevMainProtein && r._proteinKw === prevMainProtein && r._proteinKw !== 'other') {
            fitScore -= 45; // Penalize consecutive same protein
          }
        }

        return { recipe: r, servings, scaledProt, scaledCal, score: fitScore };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0] || { recipe: candidateRecipes[0], servings: 1, scaledProt: 25, scaledCal: 450 };
      const chosen = best.recipe;
      const servings = best.servings || 1;

      const scaledMacros = {
        calories: Math.round(chosen._macros.calories * servings),
        protein: Math.round(chosen._macros.protein * servings),
        carbs: Math.round(chosen._macros.carbs * servings),
        fat: Math.round(chosen._macros.fat * servings)
      };

      if (slot.mealType === 'dinner' && chosen) {
        prevMainProtein = chosen._proteinKw;
      }

      dayCalories += scaledMacros.calories;
      dayProtein += scaledMacros.protein;
      dayCarbs += scaledMacros.carbs;
      dayFat += scaledMacros.fat;

      if (chosen._pantryMatch) {
        totalUseUpItems += chosen._pantryMatch.useUpMatches.length;
        totalMatchPct += chosen._pantryMatch.matchPercentage;
      }

      dayMeals.push({
        mealType: slot.mealType,
        recipeId: chosen.id,
        recipeTitle: chosen.title || chosen.name || 'Recipe',
        servings,
        macros: scaledMacros
      });
    });

    const proteinDeltaPct = Math.round(((dayProtein - dailyTargets.protein) / dailyTargets.protein) * 100);

    planDays.push({
      date: dateStr,
      dayName,
      meals: dayMeals,
      dailyTotals: {
        calories: Math.round(dayCalories),
        protein: Math.round(dayProtein),
        carbs: Math.round(dayCarbs),
        fat: Math.round(dayFat)
      },
      proteinDeltaPct
    });
  }

  const endDate = planDays[planDays.length - 1]?.date || startDateStr;
  const avgPantryMatchPct = Math.round(totalMatchPct / Math.max(numDays * 3, 1));

  const planId = `plan_${Date.now()}`;

  return {
    id: planId,
    startDate: startDateStr,
    endDate,
    days: planDays,
    macroTargets: dailyTargets,
    pantrySummary: {
      useUpItemsConsumed: totalUseUpItems,
      avgPantryMatchPct
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

const PlanGeneratorService = {
  detectPrimaryProteinKeyword,
  generateWeeklyPlan
};

if (typeof window !== 'undefined') {
  window.PlanGeneratorService = PlanGeneratorService;
  window.generateWeeklyPlan = generateWeeklyPlan;
}

export default PlanGeneratorService;
