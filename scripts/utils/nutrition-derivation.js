/**
 * scripts/utils/nutrition-derivation.js
 * PlatePlan Nutrition Derivation, Recalculation & Fit Scoring Subsystem
 * Classic global namespace script.
 */

(() => {
  window.PlatePlanNutrition = window.PlatePlanNutrition || {};
  window.PlatePlanNutrition.State = window.PlatePlanNutrition.State || {
    isRefreshingDerivedState: false
  };

  const NutritionState = window.PlatePlanNutrition.State;

  const getEffectiveRecipeFitScore = (recipe, targetSlot = 'dinner', customState = null) => {
    if (!recipe) return { score: 0, bestVariant: 'original', scoreOriginal: 0, scoreEnhanced: 0 };

    const activeState = customState || (typeof window !== 'undefined' ? window.state : null);
    const rawRecipe = recipe.recipe || (recipe.id && activeState?.recipes ? activeState.recipes.find(r => r && r.id === recipe.id) : null) || recipe;

    const fnFit = typeof window !== 'undefined' && typeof window.calculateMacroFitTierAndScore === 'function'
      ? window.calculateMacroFitTierAndScore
      : null;

    const resOriginal = fnFit ? fnFit({ recipe: rawRecipe, variant: 'original' }, targetSlot) : { score: 0 };
    const scoreOriginal = typeof resOriginal === 'number' ? resOriginal : (resOriginal?.score ?? 0);

    let scoreEnhanced = 0;
    const hasEnhanced = !!(rawRecipe.enhanced || rawRecipe.enhancedMacros || recipe.enhanced || recipe.enhancedMacros || (recipe.variant === 'enhanced'));
    if (hasEnhanced && fnFit) {
      const resEnhanced = fnFit({ recipe: rawRecipe, variant: 'enhanced' }, targetSlot);
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
  };

  const attachComputedFitScores = (recipes = [], targetSlot = 'dinner', customState = null) => {
    if (!Array.isArray(recipes)) return [];
    return recipes.map(recipe => {
      if (!recipe) return recipe;
      const effective = getEffectiveRecipeFitScore(recipe, targetSlot, customState);
      recipe._computedFitScore = effective.score;
      recipe._bestVariant = effective.bestVariant;
      recipe._scoreOriginal = effective.scoreOriginal;
      recipe._scoreEnhanced = effective.scoreEnhanced;
      return recipe;
    });
  };

  const getSortedRecipes = (recipes = [], sortOption = 'name', activeSlotTargets = 'dinner', customState = null) => {
    const scoredRecipes = attachComputedFitScores([...recipes], activeSlotTargets, customState);

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
  };

  const calcPortions = (nutrition, prefs, serves, who, mealType) => {
    const s = parseFloat(serves) || 1;
    const p = prefs || window.state?.prefs || {};

    const resolveGetBudgets = window.PlatePlanNutrition?.getBudgets || (typeof getBudgets !== 'undefined' ? getBudgets : () => ({ cal: 0, prot: 0 }));
    const eBud = resolveGetBudgets('e', mealType, p);
    const cBud = resolveGetBudgets('c', mealType, p);

    let eServ = 0;
    let cServ = 0;

    const w = String(who || 'both').toLowerCase();
    if (w === 'e') {
      eServ = s;
      cServ = 0;
    } else if (w === 'c') {
      eServ = 0;
      cServ = s;
    } else {
      const totalCalTarget = eBud.cal + cBud.cal;
      if (totalCalTarget > 0) {
        eServ = s * (eBud.cal / totalCalTarget);
        cServ = s * (cBud.cal / totalCalTarget);
      } else {
        eServ = s / 2;
        cServ = s / 2;
      }
    }

    const calPerServ = parseFloat(nutrition?.cal ?? nutrition?.kcal ?? 0);
    const protPerServ = parseFloat(nutrition?.prot ?? nutrition?.protein ?? 0);

    const eCal = eServ * calPerServ;
    const eProt = eServ * protPerServ;
    const cCal = cServ * calPerServ;
    const cProt = cServ * protPerServ;

    const totalCal = eCal + cCal;
    const ePct = totalCal > 0 ? (eCal / totalCal) * 100 : 0;
    const cPct = totalCal > 0 ? (cCal / totalCal) * 100 : 0;

    return {
      eSingleServ: Math.round(eServ * 100) / 100,
      cSingleServ: Math.round(cServ * 100) / 100,
      eCal: Math.round(eCal),
      eProt: Math.round(eProt * 10) / 10,
      cCal: Math.round(cCal),
      cProt: Math.round(cProt * 10) / 10,
      ePct: Math.round(ePct),
      cPct: Math.round(cPct),
      e: (Math.round(eServ * 100) / 100) + ' serving' + (Math.abs(eServ - 1) < 0.01 ? '' : 's'),
      c: (Math.round(cServ * 100) / 100) + ' serving' + (Math.abs(cServ - 1) < 0.01 ? '' : 's')
    };
  };

  const calculateRecipeDisplayNutrition = (options = {}) => {
    const {
      recipe = null,
      ingredients = null,
      serves = null,
      who = null,
      mealType = null,
      variant = 'original',
      instanceId = null,
      planContext = null,
      overrideStore = null
    } = options;

    let activeRecipe = recipe;
    if (typeof recipe === 'string') {
      activeRecipe = window.state?.recipes?.find(r => r.id === recipe) || null;
    }

    const v = variant || 'original';
    let activeIngredients = ingredients || activeRecipe?.ingredients || [];
    let activeServes = parseFloat(serves ?? activeRecipe?.serves ?? 1);
    let activeWho = who ?? activeRecipe?.who ?? 'both';

    if (activeRecipe && v === 'enhanced' && activeRecipe.enhanced) {
      if (activeRecipe.enhanced.ingredients) activeIngredients = activeRecipe.enhanced.ingredients;
      if (activeRecipe.enhanced.serves) activeServes = parseFloat(activeRecipe.enhanced.serves);
      if (activeRecipe.enhanced.who) activeWho = activeRecipe.enhanced.who;
    }

    const resolutionContext = window.getPlanContextForInstance ? window.getPlanContextForInstance(instanceId, planContext, overrideStore) : null;

    let totalCal = 0, totalProt = 0, totalCarb = 0, totalFat = 0, totalFibre = 0;
    let matchedCount = 0;
    const resolvedIngs = [];

    const resolveProduct = window.PlatePlanNutrition?.resolveProductForIngredient || window.resolveProductForIngredient;
    const getGrams = window.PlatePlanNutrition?.getEffectiveIngredientGrams || window.getEffectiveIngredientGrams;
    const getAmount = window.PlatePlanNutrition?.getEffectiveIngredientAmount || window.getEffectiveIngredientAmount;

    for (const ing of activeIngredients) {
      if (resolutionContext && resolutionContext.removeIngredientKeys?.[ing.id]) continue;

      const product = resolveProduct ? resolveProduct(ing, resolutionContext) : null;
      if (product) matchedCount++;

      const qty = getAmount ? getAmount(ing, resolutionContext) : parseFloat(ing.qty ?? ing.amount ?? ing.grams ?? 1);
      const unit = ing.unit || 'g';
      const grams = getGrams ? getGrams({ qty, unit }, product) : qty;

      const scale = grams / 100;
      const cal = (parseFloat(product?.cal) || parseFloat(product?.calories) || parseFloat(product?.kcal) || 0) * scale;
      const prot = (parseFloat(product?.prot) || parseFloat(product?.protein) || 0) * scale;
      const carb = (parseFloat(product?.carb) || parseFloat(product?.carbs) || 0) * scale;
      const fat = (parseFloat(product?.fat) || 0) * scale;
      const fibre = (parseFloat(product?.fibre) || parseFloat(product?.fiber) || 0) * scale;

      totalCal += cal;
      totalProt += prot;
      totalCarb += carb;
      totalFat += fat;
      totalFibre += fibre;

      resolvedIngs.push({
        ...ing,
        qty,
        unit,
        grams,
        product,
        calculated: { cal, prot, carb, fat, fibre }
      });
    }

    const s = Math.max(1, activeServes);
    const nutrition = {
      cal: Math.round(totalCal),
      prot: Math.round(totalProt * 10) / 10,
      carb: Math.round(totalCarb * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      fibre: Math.round(totalFibre * 10) / 10
    };

    const perServing = {
      cal: Math.round(totalCal / s),
      prot: Math.round((totalProt / s) * 10) / 10,
      carb: Math.round((totalCarb / s) * 10) / 10,
      fat: Math.round((totalFat / s) * 10) / 10,
      fibre: Math.round((totalFibre / s) * 10) / 10
    };

    const portions = calcPortions(perServing, window.state?.prefs || {}, s, activeWho, mealType || 'dinner');

    const eServ = portions.eSingleServ;
    const cServ = portions.cSingleServ;

    portions.eCarb = Math.round(eServ * perServing.carb * 10) / 10;
    portions.eFat = Math.round(eServ * perServing.fat * 10) / 10;
    portions.eFibre = Math.round(eServ * perServing.fibre * 10) / 10;

    portions.cCarb = Math.round(cServ * perServing.carb * 10) / 10;
    portions.cFat = Math.round(cServ * perServing.fat * 10) / 10;
    portions.cFibre = Math.round(cServ * perServing.fibre * 10) / 10;

    portions.eRecipePct = Math.round((eServ / s) * 100);
    portions.cRecipePct = Math.round((cServ / s) * 100);

    return {
      active: activeRecipe ? (v === 'enhanced' && activeRecipe.enhanced ? { ...activeRecipe, ...activeRecipe.enhanced } : activeRecipe) : { serves: s, who: activeWho },
      mealType: mealType || 'dinner',
      resolutionContext,
      nutrition: {
        ...perServing,
        perServing,
        totalNutrition: nutrition
      },
      totalNutrition: nutrition,
      perServing,
      portions,
      matched: matchedCount,
      total: activeIngredients.length
    };
  };

  const calcRecipeNutrition = (ingredients = [], serves = 1) => {
    const bundle = calculateRecipeDisplayNutrition({ ingredients, serves: parseFloat(serves) || 1 });
    return {
      ...bundle.nutrition,
      perServing: bundle.perServing,
      totalNutrition: bundle.totalNutrition
    };
  };

  const recalcRecipeNutrition = (recipeId) => {
    const recipe = window.state?.recipes?.find(r => r.id === recipeId);
    if (!recipe) return;

    const bundleOrig = calculateRecipeDisplayNutrition({ recipe, variant: 'original' });
    recipe.originalNutrition = bundleOrig.totalNutrition;
    recipe.perServing = bundleOrig.perServing;
    recipe.portions = bundleOrig.portions;

    if (recipe.enhanced) {
      const bundleEnh = calculateRecipeDisplayNutrition({ recipe, variant: 'enhanced' });
      recipe.enhancedNutrition = bundleEnh.totalNutrition;
      recipe.enhanced.perServing = bundleEnh.perServing;
      recipe.enhanced.portions = bundleEnh.portions;
    }
  };

  const recalcAllRecipes = () => {
    const recipes = window.state?.recipes || [];
    recipes.forEach(r => {
      recalcRecipeNutrition(r.id);
    });
  };

  const refreshPlatePlanDerivedState = (options = {}) => {
    if (NutritionState.isRefreshingDerivedState) return;
    NutritionState.isRefreshingDerivedState = true;
    try {
      const { persist = false, render = true, changedProductIds = [], changedGroupIds = [], changedRecipeIds = [], full = false } = options;

      if (window.PlatePlanModals && typeof window.PlatePlanModals.rebuildPlatePlanIndexes === 'function') {
        window.PlatePlanModals.rebuildPlatePlanIndexes();
      } else if (window.rebuildPlatePlanIndexes) {
        window.rebuildPlatePlanIndexes();
      }

      if (window.platePlanNutritionCache && window.platePlanNutritionCache.clear) {
        window.platePlanNutritionCache.clear();
      }

      if (changedRecipeIds && changedRecipeIds.length > 0) {
        changedRecipeIds.forEach(id => recalcRecipeNutrition(id));
      } else if (full || (changedProductIds && changedProductIds.length > 0)) {
        recalcAllRecipes();
      }

      if (persist) {
        if (window.PlatePlanModals && typeof window.PlatePlanModals.saveState === 'function') {
          window.PlatePlanModals.saveState();
        } else if (typeof window.saveState === 'function') {
          window.saveState();
        }
      }

      if (render) {
        Promise.resolve().then(() => {
          if (typeof window.renderAll === 'function') {
            window.renderAll();
          } else if (window.PlatePlanRouter && typeof window.PlatePlanRouter.renderAll === 'function') {
            window.PlatePlanRouter.renderAll();
          }
        });
      }
    } finally {
      NutritionState.isRefreshingDerivedState = false;
    }
  };

  // == Attach methods to Namespace ==
  Object.assign(window.PlatePlanNutrition, {
    getEffectiveRecipeFitScore,
    attachComputedFitScores,
    getSortedRecipes,
    calcPortions,
    calculateRecipeDisplayNutrition,
    calcRecipeNutrition,
    recalcRecipeNutrition,
    recalcAllRecipes,
    refreshPlatePlanDerivedState
  });

  // == Attach methods to Window ==
  if (typeof window !== 'undefined') {
    window.calcPortions = calcPortions;
    window.calculateRecipeDisplayNutrition = calculateRecipeDisplayNutrition;
    window.calcRecipeNutrition = calcRecipeNutrition;
    window.recalcRecipeNutrition = recalcRecipeNutrition;
    window.recalcAllRecipes = recalcAllRecipes;
    window.refreshPlatePlanDerivedState = refreshPlatePlanDerivedState;
    window.attachComputedFitScores = attachComputedFitScores;
    window.getSortedRecipes = getSortedRecipes;
    window.getEffectiveRecipeFitScore = getEffectiveRecipeFitScore;
  }
})();
