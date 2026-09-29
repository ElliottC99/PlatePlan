/**
 * src/services/FitScoreService.js (v3.8.1)
 * Pure macro target resolver, dual-profile fit score calculation,
 * and recipe ranking/sorting engine.
 * Quarantined from page DOM queries and direct database operations.
 */

export const FIT_SCORE_TIERS = {
  IDEAL: { min: 80, tier: 'green', label: 'Ideal Fit', color: '#16a34a', bg: '#dcfce7', colors: 'background-color:#dcfce7;color:#15803d;border:1px solid #bbf7d0;' },
  ACCEPTABLE: { min: 60, tier: 'amber-green', label: 'Good Fit', color: '#65a30d', bg: '#ecfccb', colors: 'background-color:#ecfccb;color:#4d7c0f;border:1px solid #d9f99d;' },
  SUBOPTIMAL: { min: 40, tier: 'amber', label: 'Fair Fit', color: '#d97706', bg: '#fef3c7', colors: 'background-color:#fef3c7;color:#b45309;border:1px solid #fde68a;' },
  POOR: { min: 0, tier: 'red', label: 'Needs Work', color: '#dc2626', bg: '#fee2e2', colors: 'background-color:#fee2e2;color:#b91c1c;border:1px solid #fecaca;' }
};

export function getMealTypeTargets(mealType = 'dinner', userPrefs = {}) {
  const mt = (mealType || 'dinner').toLowerCase();
  
  // Default fallback budgets
  let eTgt = { cal: 840, prot: 45.5 };
  let cTgt = { cal: 595, prot: 35 };

  if (typeof window !== 'undefined' && typeof window.getBudgets === 'function') {
    eTgt = window.getBudgets('e', mt) || eTgt;
    cTgt = window.getBudgets('c', mt) || cTgt;
  } else if (userPrefs && userPrefs.nutritionTargets) {
    const nt = userPrefs.nutritionTargets;
    if (nt.e && nt.e[mt]) eTgt = nt.e[mt];
    if (nt.c && nt.c[mt]) cTgt = nt.c[mt];
    if (nt.elliott?.meals && nt.elliott.meals[mt]) eTgt = { cal: nt.elliott.meals[mt].kcal, prot: nt.elliott.meals[mt].protein };
    if (nt.chloe?.meals && nt.chloe.meals[mt]) cTgt = { cal: nt.chloe.meals[mt].kcal, prot: nt.chloe.meals[mt].protein };
  }

  return {
    mealType: mt,
    targetCal_E: Number(eTgt?.cal) || 0,
    targetProt_E: Number(eTgt?.prot) || 0,
    targetCal_C: Number(cTgt?.cal) || 0,
    targetProt_C: Number(cTgt?.prot) || 0,
    e: eTgt,
    c: cTgt
  };
}

export function getVaultTargetMacros(mealType = 'dinner', userPrefs = {}) {
  return getMealTypeTargets(mealType, userPrefs);
}

export function computeProfileFitScore(actualCal, targetCal, actualProt, targetProt) {
  const aCal = Number(actualCal) || 0;
  const tCal = Number(targetCal) || 0;
  const aProt = Number(actualProt) || 0;
  const tProt = Number(targetProt) || 0;

  let calScore = 100;
  if (tCal > 0) {
    const calError = Math.abs(aCal - tCal) / tCal;
    calScore = Math.max(0, 100 - (calError * 110));
  }

  let protScore = 100;
  if (tProt > 0) {
    if (aProt >= tProt) {
      const surplus = (aProt - tProt) / tProt;
      protScore = surplus > 0.6 ? Math.max(80, 100 - ((surplus - 0.6) * 50)) : 100;
    } else {
      const deficit = (tProt - aProt) / tProt;
      protScore = Math.max(0, 100 - (deficit * 125));
    }
  }

  return (calScore * 0.45) + (protScore * 0.55);
}

export function calculateMacroFitTierAndScore(calActualOrRecipe, mealTypeOrTargets, protAct, protTgt, context = {}) {
  let mealType = 'dinner';
  let variant = 'original';
  let recipeObj = null;
  let customTargets = null;

  let actualCal_E = 0, targetCal_E = 0, actualProt_E = 0, targetProt_E = 0;
  let actualCal_C = 0, targetCal_C = 0, actualProt_C = 0, targetProt_C = 0;
  let whoKey = 'both';

  if (typeof calActualOrRecipe === 'object' && calActualOrRecipe !== null) {
    recipeObj = calActualOrRecipe.recipe || calActualOrRecipe;
    variant = calActualOrRecipe.variant || 'original';

    if (typeof mealTypeOrTargets === 'string') {
      mealType = mealTypeOrTargets;
    } else if (typeof mealTypeOrTargets === 'object' && mealTypeOrTargets !== null) {
      if (mealTypeOrTargets.mealType) mealType = mealTypeOrTargets.mealType;
      if (mealTypeOrTargets.variant) variant = mealTypeOrTargets.variant;
      customTargets = mealTypeOrTargets;
    } else if (calActualOrRecipe.mealType) {
      mealType = calActualOrRecipe.mealType;
    } else {
      const types = recipeObj.types || [recipeObj.type || 'dinner'];
      mealType = types[0] || 'dinner';
    }

    whoKey = String(recipeObj.who || 'both').trim().toLowerCase();

    // Resolve meal slot targets
    const slotTargets = customTargets || getMealTypeTargets(mealType, context?.userPrefs);
    targetCal_E = Number(slotTargets.targetCal_E ?? slotTargets.eCal ?? slotTargets.e?.cal ?? slotTargets.cal) || 0;
    targetProt_E = Number(slotTargets.targetProt_E ?? slotTargets.eProt ?? slotTargets.e?.prot ?? slotTargets.prot) || 0;
    targetCal_C = Number(slotTargets.targetCal_C ?? slotTargets.cCal ?? slotTargets.c?.cal ?? slotTargets.cal) || 0;
    targetProt_C = Number(slotTargets.targetProt_C ?? slotTargets.cProt ?? slotTargets.c?.prot ?? slotTargets.prot) || 0;

    // Resolve split portions
    let portions = calActualOrRecipe.portions;
    if (!portions && typeof window !== 'undefined' && typeof window.calculateRecipeDisplayNutrition === 'function' && (recipeObj.ingredients || recipeObj.enhanced || recipeObj.name)) {
      try {
        const bundle = window.calculateRecipeDisplayNutrition({ recipe: recipeObj, variant, mealType });
        portions = bundle?.portions;
      } catch (e) {}
    }

    if (!portions && typeof window !== 'undefined' && typeof window.calcPortions === 'function') {
      const perServing = recipeObj.perServing || recipeObj.nutrition || recipeObj;
      portions = window.calcPortions(perServing, window.state?.prefs || {}, recipeObj.serves || 2, recipeObj.who || 'both', mealType);
    }

    if (portions) {
      actualCal_E = Number(portions.eCal) || 0;
      actualProt_E = Number(portions.eProt) || 0;
      actualCal_C = Number(portions.cCal) || 0;
      actualProt_C = Number(portions.cProt) || 0;
    } else {
      const ps = recipeObj.perServing || recipeObj.nutrition || recipeObj;
      const cal = Number(ps.cal ?? ps.calories ?? ps.kcal) || 0;
      const prot = Number(ps.prot ?? ps.protein) || 0;
      actualCal_E = cal;
      actualProt_E = prot;
      actualCal_C = cal;
      actualProt_C = prot;
    }
  } else {
    // Positional arguments
    const actCal = Number(calActualOrRecipe) || 0;
    const tgtCal = Number(mealTypeOrTargets) || 0;
    const actProt = Number(protAct) || 0;
    const tgtProt = Number(protTgt) || 0;

    actualCal_E = actCal;
    targetCal_E = tgtCal;
    actualProt_E = actProt;
    targetProt_E = tgtProt;

    actualCal_C = actCal;
    targetCal_C = tgtCal;
    actualProt_C = actProt;
    targetProt_C = tgtProt;
  }

  const score_Elliott = computeProfileFitScore(actualCal_E, targetCal_E, actualProt_E, targetProt_E);
  const score_Chloe = computeProfileFitScore(actualCal_C, targetCal_C, actualProt_C, targetProt_C);

  let finalScore = 0;
  if (whoKey === 'elliott' || whoKey === 'e') {
    finalScore = Math.round(score_Elliott);
  } else if (whoKey === 'chloe' || whoKey === 'c') {
    finalScore = Math.round(score_Chloe);
  } else {
    finalScore = Math.round((score_Elliott * 0.50) + (score_Chloe * 0.50));
  }

  const clampedScore = Math.max(0, Math.min(100, finalScore));

  let tierConfig = FIT_SCORE_TIERS.POOR;
  if (clampedScore >= FIT_SCORE_TIERS.IDEAL.min) {
    tierConfig = FIT_SCORE_TIERS.IDEAL;
  } else if (clampedScore >= FIT_SCORE_TIERS.ACCEPTABLE.min) {
    tierConfig = FIT_SCORE_TIERS.ACCEPTABLE;
  } else if (clampedScore >= FIT_SCORE_TIERS.SUBOPTIMAL.min) {
    tierConfig = FIT_SCORE_TIERS.SUBOPTIMAL;
  }

  const badgeStyle = `${tierConfig.colors}border-radius:4px;padding:2px 8px;font-weight:600;font-size:11px;display:inline-block;`;

  return {
    tier: tierConfig.tier,
    score: clampedScore,
    raw: clampedScore,
    color: tierConfig.color,
    label: tierConfig.label,
    colors: tierConfig.colors,
    badgeStyle,
    score_E: score_Elliott,
    score_C: score_Chloe
  };
}

export function getEffectiveRecipeFitScore(recipe, targetSlot = 'dinner', context = {}) {
  if (!recipe) return { score: 0, bestVariant: 'original', scoreOriginal: 0, scoreEnhanced: 0 };

  const rawRecipe = recipe.recipe || (recipe.id && typeof window !== 'undefined' ? (window.state?.recipes || []).find(r => r.id === recipe.id) : null) || recipe;

  // 1. Original Variant Score
  const resOriginal = calculateMacroFitTierAndScore({ recipe: rawRecipe, variant: 'original' }, targetSlot, null, null, context);
  const scoreOriginal = typeof resOriginal === 'number' ? resOriginal : (resOriginal?.score ?? 0);

  // 2. Enhanced Variant Score
  let scoreEnhanced = 0;
  const hasEnhanced = !!(rawRecipe.enhanced || rawRecipe.enhancedMacros || recipe.enhanced || recipe.enhancedMacros || (recipe.variant === 'enhanced'));
  if (hasEnhanced) {
    const resEnhanced = calculateMacroFitTierAndScore({ recipe: rawRecipe, variant: 'enhanced' }, targetSlot, null, null, context);
    scoreEnhanced = typeof resEnhanced === 'number' ? resEnhanced : (resEnhanced?.score ?? 0);
  }

  const bestVariant = scoreEnhanced > scoreOriginal ? 'enhanced' : 'original';
  const maxScore = Math.max(scoreOriginal, scoreEnhanced);

  return {
    score: maxScore,
    bestVariant,
    scoreOriginal,
    scoreEnhanced
  };
}

export function attachComputedFitScores(recipes = [], targetSlot = 'dinner', context = {}) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(recipe => {
    if (!recipe) return recipe;
    const effective = getEffectiveRecipeFitScore(recipe, targetSlot, context);
    recipe._computedFitScore = effective.score;
    recipe._bestVariant = effective.bestVariant;
    recipe._scoreOriginal = effective.scoreOriginal;
    recipe._scoreEnhanced = effective.scoreEnhanced;
    return recipe;
  });
}

export function getSortedRecipes(recipes = [], sortOption = 'name', activeSlotTargets = 'dinner', context = {}) {
  const scoredRecipes = attachComputedFitScores([...recipes], activeSlotTargets, context);

  const isFav = (r) => {
    if (!r) return false;
    if (typeof window !== 'undefined' && typeof window.isRecipeVariantFavourite === 'function') {
      return window.isRecipeVariantFavourite(r.id, 'original') || window.isRecipeVariantFavourite(r.id, 'enhanced') || r.isFavourite || r.isFavorite;
    }
    return !!(r.isFavourite || r.isFavorite);
  };

  switch (sortOption) {
    case 'best-fit':
    case 'best_fit':
    case 'fit-desc':
      return scoredRecipes.sort((a, b) => {
        const aF = isFav(a), bF = isFav(b);
        if (!!bF !== !!aF) return bF ? 1 : -1;
        const diff = (b._computedFitScore ?? 0) - (a._computedFitScore ?? 0);
        return diff || (a.name || a.label || '').localeCompare(b.name || b.label || '', 'en', { sensitivity: 'base' });
      });

    case 'needs-work':
    case 'needs_work':
    case 'fit-asc':
      return scoredRecipes.sort((a, b) => {
        const aF = isFav(a), bF = isFav(b);
        if (!!bF !== !!aF) return bF ? 1 : -1;
        const diff = (a._computedFitScore ?? 0) - (b._computedFitScore ?? 0);
        return diff || (a.name || a.label || '').localeCompare(b.name || b.label || '', 'en', { sensitivity: 'base' });
      });

    case 'name':
    default:
      return scoredRecipes.sort((a, b) => {
        const aF = isFav(a), bF = isFav(b);
        if (!!bF !== !!aF) return bF ? 1 : -1;
        return (a.name || a.label || '').localeCompare(b.name || b.label || '', 'en', { sensitivity: 'base' });
      });
  }
}
