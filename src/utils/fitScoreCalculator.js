/**
 * src/utils/fitScoreCalculator.js (v3.38.63)
 * Universal Asymmetric Fit Score Engine Orchestrator.
 * Decomposed: Weights and Macro utilities moved to dedicated modules.
 */

import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import { DEFAULT_SPLITS, getFitScoreTierMeta } from './fitScoreWeights.js';
import { 
  extractRecipeMacros, 
  sweepRecipeMacroQuality, 
  calculateCalorieScore, 
  calculateProteinScore 
} from './macroScoringUtils.js';

export { 
  extractRecipeMacros, 
  sweepRecipeMacroQuality, 
  getFitScoreTierMeta,
  calculateCalorieScore,
  calculateProteinScore
};

/**
 * Resolves specific meal target for a given profile, type ('kcal' | 'protein'), and meal slot.
 */
export const getTarget = (profile, type, meal) => {
  if (!profile || typeof profile !== 'object') return 0;
  const normMeal = String(meal || 'dinner').toLowerCase();
  const altMeal = normMeal === 'snack' ? 'snacking' : (normMeal === 'snacking' ? 'snack' : normMeal);

  const override = profile.meals?.[normMeal]?.[type] ?? profile.meals?.[altMeal]?.[type];
  if (override !== undefined && override !== null && Number(override) > 0) {
    return Number(override);
  }

  const daily = type === 'kcal'
    ? (Number(profile.dailyKcal ?? profile.cal) || 0)
    : (Number(profile.dailyProtein ?? profile.prot) || 0);
  if (daily <= 0) return 0;

  const splitKey = type === 'kcal' ? 'calorieSplits' : 'proteinSplits';
  const splitsObj = profile[splitKey] || {};
  const rawSplit = splitsObj[normMeal] ?? splitsObj[altMeal];
  if (rawSplit !== undefined && rawSplit !== null && !Number.isNaN(Number(rawSplit))) {
    if (Number(rawSplit) <= 0) return 0;
    return daily * (Number(rawSplit) / 100);
  }
  const splitPct = DEFAULT_SPLITS[normMeal] ?? 35;

  return daily * (splitPct / 100);
};

function resolveHouseholdProfiles(options = {}) {
  const winState = typeof window !== 'undefined' ? (window.state || {}) : {};
  const rawProfiles = options?.userPrefs?.profiles
    || winState.prefs?.profiles
    || winState.preferences?.profiles
    || winState.userPrefs?.profiles
    || {};
  const legacyPrefs = options?.userPrefs || winState.prefs || winState.preferences || winState.userPrefs || {};

  const eRaw = rawProfiles.elliott || rawProfiles.e || {};
  const cRaw = rawProfiles.chloe || rawProfiles.c || {};

  const elliott = {
    ...eRaw,
    dailyKcal: Number(eRaw.dailyKcal ?? legacyPrefs.elliottCal ?? legacyPrefs.ecal ?? 2100) || 2100,
    dailyProtein: Number(eRaw.dailyProtein ?? legacyPrefs.elliottProt ?? legacyPrefs.eprot ?? 140) || 140
  };
  const chloe = {
    ...cRaw,
    dailyKcal: Number(cRaw.dailyKcal ?? legacyPrefs.chloeCal ?? legacyPrefs.ccal ?? 1650) || 1650,
    dailyProtein: Number(cRaw.dailyProtein ?? legacyPrefs.chloeProt ?? legacyPrefs.cprot ?? 105) || 105
  };

  return { elliott, chloe };
}

/**
 * Calculates meal fit score for a recipe and meal type across active profile or shared household.
 */
export function calculateMealFitScore(recipe, mealType = 'dinner', options = {}) {
  const r = recipe?.recipe || recipe || {};
  const requestedVariant = options.variant || (r.enhanced ? 'enhanced' : 'original');
  const macros = extractRecipeMacros(r, requestedVariant);
  const totalKcal = macros.cal;
  const totalProt = macros.prot;

  if (totalKcal === null || totalKcal <= 0 || totalProt === null || totalProt <= 0) {
    return {
      score: 0,
      tier: 'red',
      tierIcon: '🔴',
      tierLabel: 'Missing Macros',
      color: '#ef4444',
      isMissingMacros: true,
      error: 'Missing Calorie/Protein Data'
    };
  }

  const normMeal = String(mealType || 'dinner').toLowerCase();
  const rawProfile = String(options.activeProfile || 'everyone').toLowerCase();
  const activeProfile = (rawProfile === 'both' || rawProfile === 'all') ? 'everyone' : rawProfile;

  const { elliott: profileE, chloe: profileC } = resolveHouseholdProfiles(options);

  const targetCal_E = getTarget(profileE, 'kcal', normMeal);
  const targetProt_E = getTarget(profileE, 'protein', normMeal);
  const targetCal_C = getTarget(profileC, 'kcal', normMeal);
  const targetProt_C = getTarget(profileC, 'protein', normMeal);

  const totalHH = (Number(profileE.dailyKcal) || 0) + (Number(profileC.dailyKcal) || 0);
  const shareE = totalHH > 0 ? (Number(profileE.dailyKcal) / totalHH) : 0.5;
  const shareC = totalHH > 0 ? (Number(profileC.dailyKcal) / totalHH) : 0.5;

  const serves = Number(r.serves || r.yield || 2);
  const isSnack = normMeal === 'snack' || normMeal === 'snacking'
    || String(r.type || '').toLowerCase() === 'snack'
    || (Array.isArray(r.types) && r.types.some(t => String(t).toLowerCase() === 'snack'));

  const batchSize = (serves === 1 || isSnack) ? 1 : 2;
  const multE = Number.isFinite(batchSize * shareE) ? (batchSize * shareE) : 1;
  const multC = Number.isFinite(batchSize * shareC) ? (batchSize * shareC) : 1;

  const actualKcalE = totalKcal * multE;
  const actualProtE = totalProt * multE;
  const actualKcalC = totalKcal * multC;
  const actualProtC = totalProt * multC;

  const calScoreE = calculateCalorieScore(actualKcalE, targetCal_E);
  const protScoreE = calculateProteinScore(actualProtE, targetProt_E);
  const calScoreC = calculateCalorieScore(actualKcalC, targetCal_C);
  const protScoreC = calculateProteinScore(actualProtC, targetProt_C);

  const fitScoreE = Math.round((calScoreE * 0.5) + (protScoreE * 0.5));
  const fitScoreC = Math.round((calScoreC * 0.5) + (protScoreC * 0.5));

  const hasTargetE = targetCal_E > 0 && targetProt_E > 0;
  const hasTargetC = targetCal_C > 0 && targetProt_C > 0;

  let finalScore = 0;
  if (activeProfile === 'elliott' || activeProfile === 'e') {
    finalScore = Math.round(fitScoreE * 1.0);
  } else if (activeProfile === 'chloe' || activeProfile === 'c') {
    finalScore = Math.round(fitScoreC * 1.0);
  } else {
    if (hasTargetE && hasTargetC) {
      finalScore = Math.round((fitScoreE * 0.5) + (fitScoreC * 0.5));
    } else if (hasTargetE) {
      finalScore = fitScoreE;
    } else if (hasTargetC) {
      finalScore = fitScoreC;
    }
  }

  const finalMeta = getFitScoreTierMeta(finalScore);
  const metaE = getFitScoreTierMeta(fitScoreE);
  const metaC = getFitScoreTierMeta(fitScoreC);

  const details = {
    elliott: {
      score: fitScoreE,
      tier: metaE.tier,
      tierIcon: metaE.icon,
      tierLabel: metaE.label,
      kcalTarget: Math.round(targetCal_E),
      proteinTarget: Math.round(targetProt_E * 10) / 10,
      recipeKcal: Math.round(actualKcalE),
      recipeProtein: Math.round(actualProtE * 10) / 10,
      multiplier: multE,
      scaledKcal: Math.round(actualKcalE),
      scaledProtein: Math.round(actualProtE * 10) / 10,
      proteinRatio: targetProt_E > 0 ? (actualProtE / targetProt_E) : 0
    },
    chloe: {
      score: fitScoreC,
      tier: metaC.tier,
      tierIcon: metaC.icon,
      tierLabel: metaC.label,
      kcalTarget: Math.round(targetCal_C),
      proteinTarget: Math.round(targetProt_C * 10) / 10,
      recipeKcal: Math.round(actualKcalC),
      recipeProtein: Math.round(actualProtC * 10) / 10,
      multiplier: multC,
      scaledKcal: Math.round(actualKcalC),
      scaledProtein: Math.round(actualProtC * 10) / 10,
      proteinRatio: targetProt_C > 0 ? (actualProtC / targetProt_C) : 0
    }
  };

  return {
    score: finalScore,
    tier: finalMeta.tier,
    tierIcon: finalMeta.icon,
    tierLabel: finalMeta.label,
    color: finalMeta.color,
    activeProfile,
    mealType: normMeal,
    details
  };
}

export function calculateRecipeFit(recipe, mealType = 'dinner', options = {}) {
  return calculateMealFitScore(recipe, mealType, options);
}

export function getVaultTargetMacros(mealType = 'dinner', userPrefs = null) {
  const mt = (mealType || 'dinner').toLowerCase();
  const { elliott, chloe } = resolveHouseholdProfiles({ userPrefs });
  const targetCal_E = getTarget(elliott, 'kcal', mt);
  const targetProt_E = getTarget(elliott, 'protein', mt);
  const targetCal_C = getTarget(chloe, 'kcal', mt);
  const targetProt_C = getTarget(chloe, 'protein', mt);

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

if (typeof window !== 'undefined') {
  Object.assign(window, {
    calculateMealFitScore,
    calculateRecipeFit,
    getVaultTargetMacros,
    extractRecipeMacros,
    sweepRecipeMacroQuality
  });
}
