/**
 * src/utils/fitScoreCalculator.js (v3.20.14)
 * Universal Asymmetric Fit Score Engine & Bulletproof Macro Extractor.
 * Evaluates Elliott & Chloe's personal meal targets using continuous asymmetric
 * calorie and protein curves, dynamic split exclusions, and macro quality sweeps.
 */

const DEFAULT_SPLITS = {
  breakfast: 25,
  lunch: 30,
  snack: 10,
  snacking: 10,
  dinner: 35
};

function parsePositiveNumberOrNull(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const num = Number(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function pickFirstValidMacro(candidates = []) {
  for (const c of candidates) {
    const parsed = parsePositiveNumberOrNull(c);
    if (parsed !== null && parsed > 0) return parsed;
  }
  for (const c of candidates) {
    const parsed = parsePositiveNumberOrNull(c);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Exhaustively extracts per-serving calories and protein across all supported schema keys.
 * Strictly returns `null` (not 0) when a macro is missing so missing data can be explicitly flagged.
 */
export function extractRecipeMacros(recipe, variant = 'original') {
  if (!recipe || typeof recipe !== 'object') {
    return { cal: null, prot: null, calories: null, protein: null };
  }
  const r = recipe.recipe || recipe;

  const extractFromNode = (node) => {
    if (!node || typeof node !== 'object') return { cal: null, prot: null };
    const cal = pickFirstValidMacro([
      node.nutrition?.perServing?.cal,
      node.nutrition?.perServing?.calories,
      node.perServing?.cal,
      node.perServing?.calories,
      node.macros?.cal,
      node.macros?.calories,
      node.cal,
      node.calories,
      node.kcal
    ]);
    const prot = pickFirstValidMacro([
      node.nutrition?.perServing?.prot,
      node.nutrition?.perServing?.protein,
      node.perServing?.prot,
      node.perServing?.protein,
      node.macros?.prot,
      node.macros?.protein,
      node.prot,
      node.protein
    ]);
    return { cal, prot };
  };

  if (variant === 'enhanced' && r.enhanced && typeof r.enhanced === 'object') {
    const enh = extractFromNode(r.enhanced);
    const base = extractFromNode(r);
    const cal = (enh.cal !== null && enh.cal > 0) ? enh.cal : base.cal;
    const prot = (enh.prot !== null && enh.prot > 0) ? enh.prot : base.prot;
    return { cal, prot, calories: cal, protein: prot };
  }

  const base = extractFromNode(r);
  return { cal: base.cal, prot: base.prot, calories: base.cal, protein: base.prot };
}

/**
 * Sweeps the active recipe database for missing or non-positive calorie/protein macros.
 */
export function sweepRecipeMacroQuality(recipes = []) {
  const list = Array.isArray(recipes) ? recipes : Object.values(recipes || {});
  const flagged = [];

  list.forEach(r => {
    if (!r || typeof r !== 'object') return;
    const { cal, prot } = extractRecipeMacros(r, 'original');
    const missingCal = cal === null || cal <= 0;
    const missingProt = prot === null || prot <= 0;
    if (missingCal || missingProt) {
      flagged.push({
        id: r.id || '',
        name: r.name || r.title || 'Untitled Recipe',
        calories: cal,
        protein: prot,
        missingCal,
        missingProt
      });
    }
  });

  return flagged;
}

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

/**
 * Universal Asymmetric Calorie Score Curve (50% Weight):
 * - 100 if ratio between 0.95 and 1.00.
 * - Interpolate 86-99 for [0.85, 0.95) and (1.00, 1.05].
 * - Interpolate 0-85 for <0.85 (down to 0.5) and >1.05 (down to 1.4).
 */
export function calculateCalorieScore(actual, target) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const r = actual / target;

  // 100 if ratio between 0.95 and 1.00
  if (r >= 0.95 && r <= 1.00) {
    return 100;
  }
  // Interpolate 86-99 for [0.85, 0.95)
  if (r >= 0.85 && r < 0.95) {
    return 86 + ((r - 0.85) / (0.95 - 0.85)) * (99 - 86);
  }
  // Interpolate 86-99 for (1.00, 1.05]
  if (r > 1.00 && r <= 1.05) {
    return 99 - ((r - 1.00) / (1.05 - 1.00)) * (99 - 86);
  }
  // Interpolate 0-85 for <0.85 (down to 0.5)
  if (r < 0.85) {
    if (r <= 0.50) return 0;
    return ((r - 0.50) / (0.85 - 0.50)) * 85;
  }
  // Interpolate 0-85 for >1.05 (down to 1.4)
  if (r > 1.05) {
    if (r >= 1.40) return 0;
    return (1 - ((r - 1.05) / (1.40 - 1.05))) * 85;
  }
  return 0;
}

/**
 * Universal Asymmetric Protein Score Curve (50% Weight):
 * - 100 if ratio between 1.00 and 1.20.
 * - Interpolate 86-99 for [0.95, 1.00) and (1.20, 1.30].
 * - Steep penalty <0.95 (0 at 0.70); gentle penalty >1.30 (0 at 2.00).
 */
export function calculateProteinScore(actual, target) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const r = actual / target;

  // 100 if ratio between 1.00 and 1.20
  if (r >= 1.00 && r <= 1.20) {
    return 100;
  }
  // Interpolate 86-99 for [0.95, 1.00)
  if (r >= 0.95 && r < 1.00) {
    return 86 + ((r - 0.95) / (1.00 - 0.95)) * (99 - 86);
  }
  // Interpolate 86-99 for (1.20, 1.30]
  if (r > 1.20 && r <= 1.30) {
    return 99 - ((r - 1.20) / (1.30 - 1.20)) * (99 - 86);
  }
  // Steep penalty <0.95 (0 at 0.70): interpolate 0-85 for [0.70, 0.95)
  if (r < 0.95) {
    if (r <= 0.70) return 0;
    return ((r - 0.70) / (0.95 - 0.70)) * 85;
  }
  // Gentle penalty >1.30 (0 at 2.00): interpolate 0-85 for (1.30, 2.00]
  if (r > 1.30) {
    if (r >= 2.00) return 0;
    return (1 - ((r - 1.30) / (2.00 - 1.30))) * 85;
  }
  return 0;
}

/**
 * Resolves 4-tier badge metadata for a given numeric Fit Score (0–100).
 * - 🟢 85–100 (#22c55e - Ideal Match)
 * - 🟡 70–84 (#eab308 - Needs Work)
 * - 🟠 50–69 (#f97316 - Suboptimal)
 * - 🔴 < 50 (#ef4444 - Poor Match)
 */
export function getFitScoreTierMeta(score) {
  const s = Math.round(Number(score) || 0);
  if (s >= 85) {
    return { tier: 'green', icon: '🟢', label: 'Ideal Match', color: '#22c55e', bg: '#dcfce7', text: '#14532d', border: '#86efac' };
  }
  if (s >= 70) {
    return { tier: 'yellow', icon: '🟡', label: 'Needs Work', color: '#eab308', bg: '#fef9c3', text: '#713f12', border: '#fde047' };
  }
  if (s >= 50) {
    return { tier: 'orange', icon: '🟠', label: 'Suboptimal', color: '#f97316', bg: '#ffedd5', text: '#7c2d12', border: '#fdba74' };
  }
  return { tier: 'red', icon: '🔴', label: 'Poor Match', color: '#ef4444', bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' };
}

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
  window.calculateMealFitScore = calculateMealFitScore;
  window.calculateRecipeFit = calculateRecipeFit;
  window.getVaultTargetMacros = getVaultTargetMacros;
  window.extractRecipeMacros = extractRecipeMacros;
  window.sweepRecipeMacroQuality = sweepRecipeMacroQuality;
}
