/**
 * src/services/PortionCalculationService.js (v3.19.79)
 * Portion-Aware Scaling Engine.
 * Dynamically scales recipe servings per person based on meal calorie targets,
 * and evaluates protein adequacy and portion realism (sanity penalty).
 */

import { getProfileMealTargets } from '../models/StateModel.js';
import { extractRecipeMacros } from '../utils/fitScoreCalculator.js';

/**
 * Calculates the required serving multiplier to meet the profile's calorie target.
 * m = Kcal Target / recipe.perServing.kcal
 *
 * @param {number} kcalTarget Target calories
 * @param {number} perServingKcal Baseline recipe calories per serving
 * @returns {number} Multiplier (e.g. 1.25)
 */
export function calculatePortionMultiplier(kcalTarget, perServingKcal) {
  const target = Number(kcalTarget) || 0;
  const servingKcal = Number(perServingKcal) || 0;
  if (servingKcal <= 0 || target <= 0) return 1.0;
  return Math.round((target / servingKcal) * 100) / 100;
}

/**
 * Evaluates Portion Sanity Penalty when multiplier requires unmanageable eating volumes.
 * Unmanageable if m > 2.5 (too large) or m < 0.3 (too small).
 *
 * @param {number} multiplier Serving multiplier
 * @returns {number} Penalty deduction points (0 to 50)
 */
export function calculatePortionSanityPenalty(multiplier) {
  const m = Number(multiplier) || 1.0;
  let penalty = 0;

  if (m > 2.5) {
    // Unmanageable excessive volume
    penalty = Math.min(50, Math.round((m - 2.5) * 30));
  } else if (m < 0.3) {
    // Impractically tiny portion
    penalty = Math.min(50, Math.round((0.3 - m) * 150));
  }

  return penalty;
}

/**
 * Extracts per-serving calories and protein from recipe or variant.
 *
 * @param {Object} recipe
 * @param {string} [variant='original']
 * @returns {{ kcal: number, protein: number }}
 */
export function getRecipePerServingNutrition(recipe, variant = 'original') {
  const { cal, prot } = extractRecipeMacros(recipe, variant);
  return {
    kcal: Math.max(0, Math.round(Number(cal) || 0)),
    protein: Math.max(0, Math.round((Number(prot) || 0) * 10) / 10)
  };
}

/**
 * Scales a recipe's serving for a specific profile and returns scaled nutrition, multiplier & sanity penalty.
 *
 * @param {Object} recipe
 * @param {string} profileId 'elliott' | 'chloe'
 * @param {string} mealType 'breakfast' | 'lunch' | 'dinner' | 'snack'
 * @param {Object} [options={}]
 * @returns {{ multiplier: number, scaledKcal: number, scaledProtein: number, sanityPenalty: number, kcalTarget: number, proteinTarget: number, proteinRatio: number }}
 */
export function scaleRecipeForProfile(recipe, profileId, mealType = 'dinner', options = {}) {
  const normMeal = String(mealType || 'dinner').toLowerCase();
  const targets = getProfileMealTargets(profileId, normMeal);
  const kcalTarget = targets.kcal || 0;
  const proteinTarget = targets.protein || 0;

  const variant = options.variant || (recipe?.enhanced ? 'enhanced' : 'original');
  const perServing = getRecipePerServingNutrition(recipe, variant);

  const multiplier = calculatePortionMultiplier(kcalTarget, perServing.kcal);
  const scaledKcal = Math.round(perServing.kcal * multiplier);
  const scaledProtein = Math.round((perServing.protein * multiplier) * 10) / 10;
  const sanityPenalty = calculatePortionSanityPenalty(multiplier);

  const proteinRatio = proteinTarget > 0 ? (scaledProtein / proteinTarget) : 1.0;

  return {
    multiplier,
    scaledKcal,
    scaledProtein,
    sanityPenalty,
    kcalTarget,
    proteinTarget,
    proteinRatio: Math.round(proteinRatio * 100) / 100,
    perServing
  };
}

if (typeof window !== 'undefined') {
  window.PortionCalculationService = {
    calculatePortionMultiplier,
    calculatePortionSanityPenalty,
    getRecipePerServingNutrition,
    scaleRecipeForProfile
  };
}
