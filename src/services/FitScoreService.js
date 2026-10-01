/**
 * src/services/FitScoreService.js (v3.17.0)
 * Thin proxy wrapper for fitScoreCalculator.js modern engine.
 * Deprecates legacy linear math and hardcoded fallback budgets.
 */

import { 
  calculateMealFitScore, 
  calculateRecipeFit,
  calculateCalorieScore,
  calculateProteinScore,
  getVaultTargetMacros as modernGetVaultTargetMacros
} from '../utils/fitScoreCalculator.js';
import { getProfileMealTargets, getProfilesFromState } from '../models/StateModel.js';

/**
 * Re-export modern engine features.
 */
export { calculateMealFitScore, calculateRecipeFit };

export const FIT_SCORE_TIERS = {
  IDEAL: { min: 80, tier: 'green', label: 'Ideal Fit', colors: 'background-color:#dcfce7;color:#15803d;border:1px solid #bbf7d0;' },
  ACCEPTABLE: { min: 60, tier: 'amber-green', label: 'Good Fit', colors: 'background-color:#ecfccb;color:#4d7c0f;border:1px solid #d9f99d;' },
  SUBOPTIMAL: { min: 40, tier: 'amber', label: 'Fair Fit', colors: 'background-color:#fef3c7;color:#b45309;border:1px solid #fde68a;' },
  POOR: { min: 0, tier: 'red', label: 'Needs Work', colors: 'background-color:#fee2e2;color:#b91c1c;border:1px solid #fecaca;' }
};

/**
 * Resolves dynamic meal targets for both profiles.
 * Strictly delegates to StateModel.
 */
export function getMealTypeTargets(mealType = 'dinner', userPrefs = null) {
  const mt = (mealType || 'dinner').toLowerCase();
  const profiles = userPrefs?.profiles || getProfilesFromState();
  const elliott = profiles.elliott || profiles.e || {};
  const chloe = profiles.chloe || profiles.c || {};

  // Core Data Mapping: prefer absolute meals[mt].kcal if it exists, otherwise calculate from daily * splits
  const targetCal_E = elliott.meals?.[mt]?.kcal || 
                      ((Number(elliott.dailyKcal) || 0) * ((Number(elliott.calorieSplits?.[mt]) || 0) / 100));
  const targetProt_E = elliott.meals?.[mt]?.protein || 
                       ((Number(elliott.dailyProtein) || 0) * ((Number(elliott.proteinSplits?.[mt]) || 0) / 100));

  const targetCal_C = chloe.meals?.[mt]?.kcal || 
                      ((Number(chloe.dailyKcal) || 0) * ((Number(chloe.calorieSplits?.[mt]) || 0) / 100));
  const targetProt_C = chloe.meals?.[mt]?.protein || 
                       ((Number(chloe.dailyProtein) || 0) * ((Number(chloe.proteinSplits?.[mt]) || 0) / 100));

  return {
    mealType: mt,
    targetCal_E: Math.round(targetCal_E),
    targetProt_E: Math.round(targetProt_E * 10) / 10,
    targetCal_C: Math.round(targetCal_C),
    targetProt_C: Math.round(targetProt_C * 10) / 10,
    e: { cal: Math.round(targetCal_E), prot: Math.round(targetProt_E * 10) / 10 },
    c: { cal: Math.round(targetCal_C), prot: Math.round(targetProt_C * 10) / 10 }
  };
}

export function getVaultTargetMacros(mealType = 'dinner', userPrefs = {}) {
  return modernGetVaultTargetMacros(mealType, userPrefs);
}

/**
 * DEPRECATED: Delegated to Traffic Light Engine.
 * Formerly computeProfileFitScore.
 */
export function computeProfileFitScore(actualCal, targetCal, actualProt, targetProt) {
  if (!targetCal || targetCal <= 0 || !targetProt || targetProt <= 0 || !actualCal || actualCal <= 0 || !actualProt || actualProt <= 0) return 0;
  const calScore = calculateCalorieScore(actualCal, targetCal);
  const protScore = calculateProteinScore(actualProt, targetProt);
  return Math.round((calScore * 0.5) + (protScore * 0.5));
}

/**
 * DEPRECATED: Delegated to calculateMealFitScore.
 */
export function calculateMacroFitTierAndScore(recipe, mealType = 'dinner', protAct, protTgt, context = {}) {
  const result = calculateMealFitScore(recipe, mealType, {
    activeProfile: context.activeProfile || 'everyone',
    portionScaled: true,
    variant: recipe?.variant || 'original'
  });

  return {
    tier: result.tier,
    score: result.score,
    raw: result.score,
    label: result.tierLabel,
    colors: result.tier === 'green' ? FIT_SCORE_TIERS.IDEAL.colors : (result.tier === 'amber' ? FIT_SCORE_TIERS.SUBOPTIMAL.colors : FIT_SCORE_TIERS.POOR.colors),
    error: result.error
  };
}

/**
 * Delegated to calculateMealFitScore for multiple variants.
 */
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

/**
 * Attaches computed fit scores to an array of recipes.
 * Strictly uses the modern engine.
 */
export function attachComputedFitScores(recipes = [], targetSlot = 'dinner', context = {}) {
  if (!Array.isArray(recipes)) return [];
  const activeProfile = context.activeProfile || 'everyone';

  return recipes.map(recipe => {
    if (!recipe) return recipe;
    
    const scoreOrig = calculateMealFitScore(recipe, targetSlot, { ...context, activeProfile, portionScaled: true, variant: 'original' }).score;
    const scoreEnh = calculateMealFitScore(recipe, targetSlot, { ...context, activeProfile, portionScaled: true, variant: 'enhanced' }).score;
    
    recipe._computedFitScore = Math.max(scoreOrig, scoreEnh);
    recipe._bestVariant = scoreEnh > scoreOrig ? 'enhanced' : 'original';
    recipe._computedFitResult = calculateMealFitScore(recipe, targetSlot, { ...context, activeProfile, portionScaled: true, variant: recipe._bestVariant });

    return recipe;
  });
}

/**
 * Sorts recipes by fit score or name.
 */
export function getSortedRecipes(recipes = [], sortOption = 'fit-desc', activeSlotTargets = 'dinner', context = {}) {
  const scoredRecipes = recipes.map(recipe => {
    const scoreOrig = calculateMealFitScore(recipe, activeSlotTargets, { ...context, variant: 'original', portionScaled: true }).score;
    const scoreEnh = calculateMealFitScore(recipe, activeSlotTargets, { ...context, variant: 'enhanced', portionScaled: true }).score;
    return {
      ...recipe,
      _computedFitScore: Math.max(scoreOrig, scoreEnh)
    };
  });

  return scoredRecipes.sort((a, b) => {
    if (sortOption === 'fit-desc') {
      return (b._computedFitScore || 0) - (a._computedFitScore || 0);
    }
    if (sortOption === 'fit-asc') {
      return (a._computedFitScore || 0) - (b._computedFitScore || 0);
    }
    if (sortOption === 'name-asc') {
      return (a.title || a.name || '').localeCompare(b.title || b.name || '');
    }
    if (sortOption === 'name-desc') {
      return (b.title || b.name || '').localeCompare(a.title || a.name || '');
    }
    return 0;
  });
}
