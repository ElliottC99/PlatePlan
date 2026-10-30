/**
 * src/services/FitScoreService.js (v3.20.14)
 * Universal Fit Score Service & Sorting Coordinator.
 * Delegates all macro extraction, asymmetric curve scoring, and 4-tier classification
 * to src/utils/fitScoreCalculator.js.
 */

import {
  calculateMealFitScore,
  calculateRecipeFit,
  calculateCalorieScore,
  calculateProteinScore,
  getActiveFitScoreParams,
  extractRecipeMacros,
  sweepRecipeMacroQuality,
  getFitScoreTierMeta,
  getVaultTargetMacros as modernGetVaultTargetMacros
} from '../utils/fitScoreCalculator.js';
import { getProfilesFromState } from '../models/StateModel.js';
import { FIT_SCORE_TIERS } from '../config/businessRules.js';

export {
  calculateMealFitScore,
  calculateRecipeFit,
  extractRecipeMacros,
  sweepRecipeMacroQuality,
  getFitScoreTierMeta
};

export function getMealTypeTargets(mealType = 'dinner', userPrefs = null) {
  return modernGetVaultTargetMacros(mealType, userPrefs || { profiles: getProfilesFromState() });
}

export function getVaultTargetMacros(mealType = 'dinner', userPrefs = null) {
  return modernGetVaultTargetMacros(mealType, userPrefs);
}

export function computeProfileFitScore(actualCal, targetCal, actualProt, targetProt, customParams = null) {
  if (!targetCal || targetCal <= 0 || !targetProt || targetProt <= 0 || !actualCal || actualCal <= 0 || !actualProt || actualProt <= 0) return 0;
  const params = getActiveFitScoreParams(customParams);
  const calScore = calculateCalorieScore(actualCal, targetCal, params);
  const protScore = calculateProteinScore(actualProt, targetProt, params);
  return Math.round((calScore * (params.calorieWeight ?? 0.5)) + (protScore * (params.proteinWeight ?? 0.5)));
}

export function calculateMacroFitTierAndScore(recipe, mealType = 'dinner', protAct, protTgt, context = {}) {
  const result = calculateMealFitScore(recipe, mealType, {
    activeProfile: context.activeProfile || 'everyone',
    portionScaled: true,
    variant: recipe?.variant || 'original'
  });
  const meta = getFitScoreTierMeta(result.score);

  return {
    tier: result.tier,
    score: result.score,
    raw: result.score,
    label: result.tierLabel,
    color: meta.color,
    colors: `background-color:${meta.bg};color:${meta.text};border:1px solid ${meta.color};`,
    error: result.error
  };
}

export function getEffectiveRecipeFitScore(recipe, targetSlot = 'dinner', context = {}) {
  if (!recipe) return { score: 0, bestVariant: 'original', scoreOriginal: 0, scoreEnhanced: 0 };

  const activeProfile = context.activeProfile || 'everyone';
  const resOriginal = calculateMealFitScore(recipe, targetSlot, { activeProfile, portionScaled: true, variant: 'original' });

  let scoreEnhanced = 0;
  const hasEnhanced = !!(recipe.enhanced || recipe.recipe?.enhanced);
  if (hasEnhanced) {
    const resEnhanced = calculateMealFitScore(recipe, targetSlot, { activeProfile, portionScaled: true, variant: 'enhanced' });
    scoreEnhanced = resEnhanced.score;
  }

  const bestVariant = scoreEnhanced > resOriginal.score ? 'enhanced' : 'original';
  return {
    score: Math.max(resOriginal.score, scoreEnhanced),
    bestVariant,
    scoreOriginal: resOriginal.score,
    scoreEnhanced
  };
}

export function attachComputedFitScores(recipes = [], targetSlot = 'dinner', context = {}) {
  if (!Array.isArray(recipes)) return [];
  const activeProfile = context.activeProfile || 'everyone';

  return recipes.map(recipe => {
    if (!recipe) return recipe;
    const baseRecipe = recipe.recipe || recipe;
    const scoreOrig = calculateMealFitScore(baseRecipe, targetSlot, { ...context, activeProfile, portionScaled: true, variant: 'original' }).score;
    const hasEnhanced = !!(baseRecipe.enhanced);
    const scoreEnh = hasEnhanced
      ? calculateMealFitScore(baseRecipe, targetSlot, { ...context, activeProfile, portionScaled: true, variant: 'enhanced' }).score
      : 0;

    recipe._computedFitScore = Math.max(scoreOrig, scoreEnh);
    recipe._bestVariant = scoreEnh > scoreOrig ? 'enhanced' : 'original';
    recipe._computedFitResult = calculateMealFitScore(baseRecipe, targetSlot, { ...context, activeProfile, portionScaled: true, variant: recipe._bestVariant });

    return recipe;
  });
}

/**
 * Universal Sorting for Recipe Vault and Swap Modals:
 * - Maps 'best-fit' and 'fit-desc' to Descending sort
 * - Maps 'needs-work' and 'fit-asc' to Ascending sort
 * - Maps 'name' and 'name-asc' to Alphabetical A-Z
 * - Maps 'name-desc' to Alphabetical Z-A
 * - Any other value falls back to Descending (fit score)
 */
export function getSortedRecipes(recipes = [], sortOption = 'fit-desc', activeSlotTargets = 'all', context = {}) {
  if (!Array.isArray(recipes)) return [];
  const slot = typeof activeSlotTargets === 'string' ? activeSlotTargets : (activeSlotTargets?.mealType || 'all');
  const activeProfile = context.activeProfile || 'everyone';

  const scoredRecipes = recipes.map(item => {
    if (!item) return item;
    if (typeof item.fitScore === 'number' && item.fitRes) {
      return {
        ...item,
        _computedFitScore: item.fitScore
      };
    }
    const baseRecipe = item.recipe || item;
    const resOrig = calculateMealFitScore(baseRecipe, slot, { ...context, activeProfile, variant: item.variant || 'original', portionScaled: true });
    const scoreOrig = resOrig.score;
    const hasEnh = !item.variant && !!(baseRecipe.enhanced);
    const resEnh = hasEnh
      ? calculateMealFitScore(baseRecipe, slot, { ...context, activeProfile, variant: 'enhanced', portionScaled: true })
      : resOrig;
    const scoreEnh = resEnh.score;

    return {
      ...item,
      _computedFitScore: Math.max(scoreOrig, scoreEnh),
      _bestMealType: scoreEnh > scoreOrig ? resEnh.mealType : resOrig.mealType
    };
  });

  const normSort = String(sortOption || 'fit-desc').toLowerCase();

  return scoredRecipes.sort((a, b) => {
    if (normSort === 'needs-work' || normSort === 'fit-asc') {
      return (a._computedFitScore ?? 0) - (b._computedFitScore ?? 0);
    }
    if (normSort === 'name' || normSort === 'name-asc') {
      return String(a.label || a.title || a.name || '').localeCompare(String(b.label || b.title || b.name || ''));
    }
    if (normSort === 'name-desc') {
      return String(b.label || b.title || b.name || '').localeCompare(String(a.label || a.title || a.name || ''));
    }
    // 'best-fit', 'fit-desc' and any unrecognised value
    return (b._computedFitScore ?? 0) - (a._computedFitScore ?? 0);
  });
}

if (typeof window !== 'undefined') {
  window.getSortedRecipes = getSortedRecipes;
  window.attachComputedFitScores = attachComputedFitScores;
  window.getEffectiveRecipeFitScore = getEffectiveRecipeFitScore;
}
