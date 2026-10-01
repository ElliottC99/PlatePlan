/**
 * src/utils/fitScoreCalculator.js (v3.19.5)
 * Deterministic 50/50 Household Fit Score Engine utilizing Piecewise Linear Interpolation (Lerp).
 * Strictly maps user profiles and scales macros dynamically using consumption shares.
 */

/**
 * Resolves specific meal target for a given profile, type, and meal.
 * Prefers absolute overrides first, then daily budget & split percentage.
 */
export const getTarget = (profile, type, meal) => {
  if (!profile) return 0;
  const override = profile.meals?.[meal]?.[type];
  if (override !== undefined && override !== null) return Number(override);
  const daily = type === 'kcal' ? (Number(profile.dailyKcal) || 0) : (Number(profile.dailyProtein) || 0);
  const splitStr = type === 'kcal' ? 'calorieSplits' : 'proteinSplits';
  const split = Number(profile[splitStr]?.[meal]) || 0;
  return daily * (split / 100);
};

/**
 * Piecewise Linear Interpolation (Lerp) for Calorie Score
 */
export function calculateCalorieScore(actual, target) {
  if (!target || target <= 0 || !actual || actual <= 0) return 0;
  const r = actual / target;

  // Evaluate lower-bound deficits sequentially upwards
  if (r < 0.75) {
    return Math.max(0, (r / 0.75) * 60); // 0 to 60
  }
  if (r < 0.90) {
    return 60 + ((r - 0.75) / 0.15) * 20; // 60 to 80
  }
  if (r <= 1.05) {
    return 100; // Ideal window: -10% to +5%
  }
  if (r <= 1.15) {
    return 100 - ((r - 1.05) / 0.10) * 30; // 100 down to 70
  }
  return Math.max(0, 70 - ((r - 1.15) / 0.15) * 70); // > 1.15
}

/**
 * Piecewise Linear Interpolation (Lerp) for Protein Score
 */
export function calculateProteinScore(actual, target) {
  if (!target || target <= 0 || !actual || actual <= 0) return 0;
  const r = actual / target;

  // Evaluate upper-tier matches down to lower deficits
  if (r >= 0.95) {
    return 100; // Meets or exceeds target (up to 5% under tolerance)
  }
  if (r >= 0.80) {
    return 80 + ((r - 0.80) / 0.15) * 20; // 80 to 100
  }
  if (r >= 0.60) {
    return 50 + ((r - 0.60) / 0.20) * 30; // 50 to 80
  }
  return Math.max(0, (r / 0.60) * 50); // 0 to 50
}

export function extractRecipeMacros(recipe, variant = 'original') {
  if (!recipe) return { cal: 0, prot: 0 };
  const r = recipe.recipe || recipe;

  if (variant === 'enhanced' && r.enhanced) {
    const e = r.enhanced;
    const cal = Number(e.nutrition?.perServing?.calories ?? e.perServing?.calories ?? e.macros?.calories ?? e.calories ?? e.cal ?? 0);
    const prot = Number(e.nutrition?.perServing?.protein ?? e.perServing?.protein ?? e.macros?.protein ?? e.protein ?? e.prot ?? 0);
    if (cal > 0) return { cal, prot };
  }

  // Fallback / Original Variant
  const cal = Number(r.nutrition?.perServing?.calories ?? r.perServing?.calories ?? r.macros?.calories ?? r.calories ?? r.cal ?? 0);
  const prot = Number(r.nutrition?.perServing?.protein ?? r.perServing?.protein ?? r.macros?.protein ?? r.protein ?? r.prot ?? 0);
  return { cal, prot };
}

/**
 * Calculates meal fit score for a recipe and meal type across active profile or 50/50 household.
 */
export function calculateMealFitScore(recipe, mealType = 'dinner', options = {}) {
  const r = recipe?.recipe || recipe || {};
  const macros = extractRecipeMacros(r, options.variant || 'original');
  const totalKcal = macros.cal;
  const totalProt = macros.prot;

  // Top-Level Calorie Circuit Breaker Guard
  if (totalKcal <= 0) {
    return {
      score: 0,
      tier: 'red',
      tierIcon: '🔴',
      tierLabel: 'Missing Macros',
      error: 'Zero Calorie Data'
    };
  }

  const normMeal = String(mealType || 'dinner').toLowerCase();
  const rawProfile = String(options.activeProfile || 'everyone').toLowerCase();
  const activeProfile = (rawProfile === 'both' || rawProfile === 'all') ? 'everyone' : rawProfile;

  // Retrieve targets for Elliott and Chloe
  const profiles = options?.userPrefs?.profiles || 
                   (typeof window !== 'undefined' ? (window.state?.preferences?.profiles || window.state?.userPrefs?.profiles) : {}) || null;
  
  if (!profiles) {
    return {
      score: 0,
      tier: 'neutral',
      tierIcon: '⚪',
      tierLabel: 'Awaiting Data',
      error: 'Missing Macro Targets',
      activeProfile,
      mealType: normMeal
    };
  }

  const profileE = profiles.elliott || profiles.e || {};
  const profileC = profiles.chloe || profiles.c || {};

  const targetCal_E = getTarget(profileE, 'kcal', normMeal);
  const targetProt_E = getTarget(profileE, 'protein', normMeal);
  const targetCal_C = getTarget(profileC, 'kcal', normMeal);
  const targetProt_C = getTarget(profileC, 'protein', normMeal);

  if (!profileE.dailyKcal || !profileC.dailyKcal) {
    return {
      score: 0,
      tier: 'neutral',
      tierIcon: '⚪',
      tierLabel: 'Awaiting Data',
      error: 'Missing Macro Targets',
      activeProfile,
      mealType: normMeal
    };
  }

  // Household Portion Scaling
  const totalHH = (Number(profileE.dailyKcal) || 0) + (Number(profileC.dailyKcal) || 0);
  if (totalHH <= 0) {
    return {
      score: 0,
      tier: 'neutral',
      tierIcon: '⚪',
      tierLabel: 'Awaiting Data',
      error: 'Missing Macro Targets',
      activeProfile,
      mealType: normMeal
    };
  }

  const shareE = (Number(profileE.dailyKcal) || 0) / totalHH;
  const shareC = (Number(profileC.dailyKcal) || 0) / totalHH;

  const serves = Number(r.serves || r.yield || 2);
  const isSnack = normMeal === 'snack' || String(r.type || '').toLowerCase() === 'snack' || (r.types || []).some(t => String(t).toLowerCase() === 'snack');
  
  // If single-serving or snack, scale from batch of 1 instead of 2
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

  const scoreE = Math.round((calScoreE * 0.5) + (protScoreE * 0.5));
  const scoreC = Math.round((calScoreC * 0.5) + (protScoreC * 0.5));

  let finalScore = 0;
  if (activeProfile === 'elliott' || activeProfile === 'e') {
    finalScore = scoreE;
  } else if (activeProfile === 'chloe' || activeProfile === 'c') {
    finalScore = scoreC;
  } else {
    finalScore = Math.round((scoreE * 0.5) + (scoreC * 0.5));
  }

  let finalTier = 'amber';
  let finalIcon = '🟡';
  let finalLabel = 'Moderate Fit';

  if (finalScore >= 80) {
    finalTier = 'green';
    finalIcon = '🟢';
    finalLabel = 'Ideal Fit';
  } else if (finalScore < 40) {
    finalTier = 'red';
    finalIcon = '🔴';
    finalLabel = 'Needs Work';
  }

  const getTierInfo = (score) => {
    if (score >= 80) return { tier: 'green', icon: '🟢', label: 'Ideal Fit' };
    if (score < 40) return { tier: 'red', icon: '🔴', label: 'Needs Work' };
    return { tier: 'amber', icon: '🟡', label: 'Moderate Fit' };
  };

  const infoE = getTierInfo(scoreE);
  const infoC = getTierInfo(scoreC);

  const details = {
    elliott: {
      score: scoreE,
      tier: infoE.tier,
      tierIcon: infoE.icon,
      tierLabel: infoE.label,
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
      score: scoreC,
      tier: infoC.tier,
      tierIcon: infoC.icon,
      tierLabel: infoC.label,
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
    tier: finalTier,
    tierIcon: finalIcon,
    tierLabel: finalLabel,
    activeProfile,
    mealType: normMeal,
    details
  };
}

/**
 * Modern alias for calculateMealFitScore.
 */
export function calculateRecipeFit(recipe, mealType = 'dinner', options = {}) {
  return calculateMealFitScore(recipe, mealType, options);
}

/**
 * Resolves dynamic meal targets for both profiles.
 */
export function getVaultTargetMacros(mealType = 'dinner', userPrefs = null) {
  const mt = (mealType || 'dinner').toLowerCase();
  const profiles = userPrefs?.profiles || (typeof window !== 'undefined' ? (window.state?.preferences?.profiles || window.state?.userPrefs?.profiles) : {}) || {};
  const elliott = profiles.elliott || profiles.e || {};
  const chloe = profiles.chloe || profiles.c || {};

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

// Global browser registration
if (typeof window !== 'undefined') {
  window.calculateMealFitScore = calculateMealFitScore;
  window.calculateRecipeFit = calculateRecipeFit;
  window.getVaultTargetMacros = getVaultTargetMacros;
  window.extractRecipeMacros = extractRecipeMacros;
}
