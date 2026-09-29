/**
 * src/utils/fitScoreCalculator.js (v3.16.2)
 * Traffic Light Fit Score Engine with 50/50 Household Weighting & Portion-Aware Scaling.
 * Evaluates recipes against dynamically hydrated profile meal targets
 * (calorieSplits vs proteinSplits), supports portion scaling with sanity volume penalties,
 * and maps macro deltas into Green, Amber, Red tiers.
 */

import { getProfileMealTargets } from '../models/StateModel.js';
import {
  calculatePortionMultiplier,
  calculatePortionSanityPenalty,
  getRecipePerServingNutrition
} from '../services/PortionCalculationService.js';

/**
 * Evaluates portion-scaled fit for a single profile.
 * m = Kcal Target / recipe.perServing.kcal
 * Scaled Protein = recipe.perServing.protein * m
 * Portion Sanity Penalty if m > 2.5 or m < 0.3
 *
 * @param {Object} recipe
 * @param {string} profileId
 * @param {number} kcalTarget
 * @param {number} proteinTarget
 * @param {Object} options
 * @returns {{ score: number, tier: string, tierIcon: string, tierLabel: string, multiplier: number, scaledKcal: number, scaledProtein: number, sanityPenalty: number, proteinRatio: number }}
 */
function evaluatePortionScaledProfileFit(recipe, profileId, kcalTarget, proteinTarget, options = {}) {
  const variant = options.variant || (recipe?.enhanced ? 'enhanced' : 'original');
  const perServing = getRecipePerServingNutrition(recipe, variant);

  const multiplier = calculatePortionMultiplier(kcalTarget, perServing.kcal);
  const scaledKcal = Math.round(perServing.kcal * multiplier);
  const scaledProtein = Math.round((perServing.protein * multiplier) * 10) / 10;
  const sanityPenalty = calculatePortionSanityPenalty(multiplier);

  const proteinRatio = proteinTarget > 0 ? (scaledProtein / proteinTarget) : 1.0;

  // Base score from protein hit ratio
  let baseScore = 50;
  if (proteinRatio >= 1.0) {
    const surplusBonus = Math.min(1, Math.max(0, (proteinRatio - 1.0) / 0.25));
    baseScore = 80 + Math.round(20 * surplusBonus); // 80 - 100
  } else if (proteinRatio >= 0.90) {
    baseScore = 70 + Math.round(((proteinRatio - 0.90) / 0.10) * 9); // 70 - 79
  } else if (proteinRatio >= 0.50) {
    baseScore = 40 + Math.round(((proteinRatio - 0.50) / 0.40) * 29); // 40 - 69
  } else {
    baseScore = Math.max(0, Math.round((proteinRatio / 0.50) * 35)); // 0 - 35
  }

  // Combined score after sanity penalty
  const finalScore = Math.max(0, Math.min(100, baseScore - sanityPenalty));

  let tier = 'amber';
  let tierIcon = '🟡';
  let tierLabel = 'Moderate Fit';

  if (finalScore >= 80) {
    tier = 'green';
    tierIcon = '🟢';
    tierLabel = 'Ideal Fit';
  } else if (finalScore < 40) {
    tier = 'red';
    tierIcon = '🔴';
    tierLabel = 'Needs Work';
  }

  return {
    score: finalScore,
    tier,
    tierIcon,
    tierLabel,
    multiplier,
    scaledKcal,
    scaledProtein,
    sanityPenalty,
    deltaKcal: 0,
    proteinRatio: Math.round(proteinRatio * 100) / 100
  };
}

/**
 * Extracts per-serving or portion-scaled macros from a recipe.
 *
 * @param {Object} recipe
 * @param {string} profileId
 * @param {Object} options
 * @returns {{ kcal: number, protein: number }}
 */
function extractRecipeMacros(recipe, profileId, options = {}) {
  const r = recipe?.recipe || recipe || {};
  const variant = options.variant || recipe?.variant || 'original';
  const useEnhanced = variant === 'enhanced' && r.enhanced;

  const source = useEnhanced ? (r.enhanced || r) : r;
  const perServing = source.perServing || source.nutrition || source;

  let kcal = Number(perServing.calories ?? perServing.kcal ?? perServing.cal ?? source.calories ?? source.kcal ?? 0);
  let protein = Number(perServing.protein ?? perServing.prot ?? source.protein ?? source.prot ?? 0);

  if (options.portionScaled) {
    const portions = options.portions || r.portions;
    const isE = profileId === 'elliott' || profileId === 'e';
    if (portions) {
      if (isE && (portions.elliott || portions.eCal !== undefined)) {
        kcal = Number(portions.elliott?.kcal ?? portions.elliott?.calories ?? portions.eCal ?? kcal);
        protein = Number(portions.elliott?.protein ?? portions.eProt ?? protein);
      } else if (!isE && (portions.chloe || portions.cCal !== undefined)) {
        kcal = Number(portions.chloe?.kcal ?? portions.chloe?.calories ?? portions.cCal ?? kcal);
        protein = Number(portions.chloe?.protein ?? portions.cProt ?? protein);
      }
    }
  }

  return {
    kcal: Math.max(0, Math.round(kcal)),
    protein: Math.max(0, Math.round(protein * 10) / 10)
  };
}

/**
 * Evaluates a single profile's macro delta against targets and computes Traffic Light tier & continuous score.
 *
 * @param {number} recipeKcal
 * @param {number} recipeProtein
 * @param {number} kcalTarget
 * @param {number} proteinTarget
 * @returns {{ score: number, tier: string, tierIcon: string, tierLabel: string, deltaKcal: number, proteinRatio: number }}
 */
function evaluateProfileFit(recipeKcal, recipeProtein, kcalTarget, proteinTarget) {
  const deltaKcal = kcalTarget > 0 ? (recipeKcal - kcalTarget) / kcalTarget : 0;
  const proteinRatio = proteinTarget > 0 ? (recipeProtein / proteinTarget) : 1;

  // 1. RED TIER (Score 0 - 39): Over calories OR severe protein deficit
  if (deltaKcal > 0.10 || (deltaKcal > 0.00 && proteinRatio < 0.90) || proteinRatio < 0.50) {
    const calculatedRedScore = Math.max(0, Math.round(39 - (Math.max(0, deltaKcal) * 50) - (Math.max(0, 0.9 - proteinRatio) * 50)));
    return {
      tier: 'red',
      tierIcon: '🔴',
      tierLabel: 'Needs Work',
      score: Math.max(0, Math.min(39, calculatedRedScore))
    };
  }

  // 2. GREEN TIER (Score 80 - 100): Ideal range
  if (deltaKcal >= -0.10 && deltaKcal <= 0.00 && proteinRatio >= 1.0) {
    const calProximity = 1 - (Math.abs(deltaKcal) / 0.10);
    const proteinBonus = Math.min(1, Math.max(0, (proteinRatio - 1.0) / 0.25));
    const calculatedGreenScore = 80 + Math.round((10 * calProximity) + (10 * proteinBonus));
    return {
      tier: 'green',
      tierIcon: '🟢',
      tierLabel: 'Ideal Fit',
      score: Math.max(80, Math.min(100, calculatedGreenScore))
    };
  }

  // 3. AMBER TIER (Score 40 - 79): Moderate alignment
  const protPart = Math.min(1, Math.max(0, (proteinRatio - 0.50) / 0.50));
  const calPart = Math.max(0, 1 - (Math.abs(deltaKcal) / 0.40));
  const calculatedAmberScore = 40 + Math.round((20 * protPart) + (19 * calPart));
  return {
    tier: 'amber',
    tierIcon: '🟡',
    tierLabel: 'Moderate Fit',
    score: Math.max(40, Math.min(79, calculatedAmberScore))
  };
}

/**
 * Calculates meal fit score for a recipe and meal type across active profile or 50/50 household.
 *
 * @param {Object} recipe Recipe object or container
 * @param {string} mealType 'breakfast' | 'lunch' | 'dinner' | 'snack'
 * @param {Object} [options={}] Configuration options
 * @param {string} [options.activeProfile='everyone'] 'everyone' | 'elliott' | 'chloe'
 * @param {boolean} [options.portionScaled=false] Whether to scale by person portions
 * @param {string} [options.variant='original'] 'original' | 'enhanced'
 * @returns {{ score: number, tier: string, tierIcon: string, tierLabel: string, activeProfile: string, mealType: string, details: Object }}
 */
export function calculateMealFitScore(recipe, mealType = 'dinner', options = {}) {
  const normMeal = String(mealType || 'dinner').toLowerCase();
  const rawProfile = String(options.activeProfile || 'everyone').toLowerCase();
  const activeProfile = (rawProfile === 'both' || rawProfile === 'all') ? 'everyone' : rawProfile;

  // Retrieve targets for Elliott and Chloe
  const eTargets = getProfileMealTargets('elliott', normMeal);
  const cTargets = getProfileMealTargets('chloe', normMeal);

  if (!eTargets.kcal || !cTargets.kcal) {
    console.warn(`[FitScoreEngine] Missing macro targets for meal: ${normMeal}`, { eTargets, cTargets });
  }

  // If no targets, return error tier instead of falling back to 100/green
  if (eTargets.kcal === 0 && cTargets.kcal === 0) {
      return {
        score: 0,
        tier: 'red',
        tierIcon: '🔴',
        tierLabel: 'Needs Work',
        error: 'Missing Macro Targets',
        activeProfile,
        mealType: normMeal
      };
  }

  let eFit, cFit;
  let eMacros, cMacros;

  if (options.portionScaled) {
    eFit = evaluatePortionScaledProfileFit(recipe, 'elliott', eTargets.kcal, eTargets.protein, options);
    cFit = evaluatePortionScaledProfileFit(recipe, 'chloe', cTargets.kcal, cTargets.protein, options);
    eMacros = { kcal: eFit.scaledKcal, protein: eFit.scaledProtein };
    cMacros = { kcal: cFit.scaledKcal, protein: cFit.scaledProtein };
  } else {
    eMacros = extractRecipeMacros(recipe, 'elliott', options);
    cMacros = extractRecipeMacros(recipe, 'chloe', options);
    eFit = evaluateProfileFit(eMacros.kcal, eMacros.protein, eTargets.kcal, eTargets.protein);
    cFit = evaluateProfileFit(cMacros.kcal, cMacros.protein, cTargets.kcal, cTargets.protein);
  }

  const details = {
    elliott: {
      ...eFit,
      kcalTarget: eTargets.kcal,
      proteinTarget: eTargets.protein,
      recipeKcal: eMacros.kcal,
      recipeProtein: eMacros.protein
    },
    chloe: {
      ...cFit,
      kcalTarget: cTargets.kcal,
      proteinTarget: cTargets.protein,
      recipeKcal: cMacros.kcal,
      recipeProtein: cMacros.protein
    }
  };

  let finalScore = 0;
  let finalTier = 'amber';
  let finalIcon = '🟡';
  let finalLabel = 'Moderate Fit';

  if (activeProfile === 'elliott' || activeProfile === 'e') {
    finalScore = eFit.score;
    finalTier = eFit.tier;
    finalIcon = eFit.tierIcon;
    finalLabel = eFit.tierLabel;
  } else if (activeProfile === 'chloe' || activeProfile === 'c') {
    finalScore = cFit.score;
    finalTier = cFit.tier;
    finalIcon = cFit.tierIcon;
    finalLabel = cFit.tierLabel;
  } else {
    // 50/50 Household Weighting
    finalScore = Math.round((0.5 * eFit.score) + (0.5 * cFit.score));
    if (finalScore >= 80) {
      finalTier = 'green';
      finalIcon = '🟢';
      finalLabel = 'Ideal Fit';
    } else if (finalScore >= 40) {
      finalTier = 'amber';
      finalIcon = '🟡';
      finalLabel = 'Moderate Fit';
    } else {
      finalTier = 'red';
      finalIcon = '🔴';
      finalLabel = 'Needs Work';
    }
  }

  return {
    score: finalScore,
    tier: finalTier,
    tierIcon: finalIcon,
    tierLabel: finalLabel,
    activeProfile,
    mealType: normMeal,
    details
  };
}

// Global browser registration
if (typeof window !== 'undefined') {
  window.calculateMealFitScore = calculateMealFitScore;
}
