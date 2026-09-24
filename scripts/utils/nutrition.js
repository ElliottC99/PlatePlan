/**
 * scripts/utils/nutrition.js
 * PlatePlan Nutrition & Macro Calculation Engine
 * Classic global namespace script.
 */

(() => {
// == NUTRITION NORMALISATION MAP ==
const NUTRITION_CANONICAL_MAP = Object.freeze({
  "carbohydrates": "carb",
  "carbs": "carb",
  "available carbohydrate": "carb",
  "available carbohydrates": "carb",
  "total carbohydrate": "carb",
  "sugar": "sugar",
  "sugars": "sugar",
  "of which sugars": "sugar",
  "energy": "cal",
  "calories": "cal",
  "kcal": "cal",
  "energy (kcal)": "cal",
  "protein": "prot",
  "proteins": "prot",
  "fat": "fat",
  "total fat": "fat",
  "saturates": "sat",
  "saturated fat": "sat",
  "of which saturates": "sat",
  "fibre": "fibre",
  "fiber": "fibre",
  "dietary fibre": "fibre",
  "salt": "salt",
  "sodium": "salt"
});

const normalizeNutrientKey = (key) => {
  if (!key) return key;
  const cleanKey = String(key).toLowerCase().trim();
  if (cleanKey.includes('kcal') || cleanKey.includes('calories')) return 'cal';
  return NUTRITION_CANONICAL_MAP[cleanKey] || cleanKey;
};

const numericNutritionValues = (value) => {
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];
  return String(value).match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
};

const normalizeEnergyKcal = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value > 2500 ? Math.round(value / 4.184) : Math.round(value);
  
  const text = String(value).toLowerCase();
  const kcalMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories|cals?\b)/i);
  if (kcalMatch) return Math.round(+kcalMatch[1]);
  
  const kjMatch = text.match(/(\d+(?:\.\d+)?)\s*kj/i);
  const nums = numericNutritionValues(text);
  if (nums.length >= 2) {
    const plausible = nums.filter(n => n > 0 && n < 1000);
    if (plausible.length) return Math.round(Math.min(...plausible));
  }
  if (kjMatch) return Math.round((+kjMatch[1]) / 4.184);
  if (nums.length === 1) return nums[0] > 2500 ? Math.round(nums[0] / 4.184) : Math.round(nums[0]);
  return 0;
};

const normalizeNutritionPayload = (raw) => {
  const parsed = {};
  for (const k in (raw || {})) {
    const cleanKey = String(k || '').toLowerCase();
    const key = normalizeNutrientKey(k);
    if (key === 'cal') {
      parsed[key] = normalizeEnergyKcal(raw[k]);
    } else if (cleanKey.includes('kj') && !parsed.cal) {
      parsed.cal = normalizeEnergyKcal(`${raw[k]} kJ`);
    } else {
      parsed[key] = +raw[k] || 0;
    }
  }
  if (!parsed.cal) {
    parsed.cal = normalizeEnergyKcal(raw?.energy ?? raw?.calories ?? raw?.kcal ?? raw?.cal);
  }
  return parsed;
};

const calculateItemNutrition = (item, quantity, unit = 'g', customToGrams = null) => {
  const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0, cal: 0, prot: 0, carb: 0 };
  if (!item || typeof item !== 'object') return zero;

  const q = parseFloat(quantity);
  if (isNaN(q) || q <= 0) return zero;

  let grams = 0;
  const u = String(unit || 'g').trim().toLowerCase().replace(/s$/, '');

  if (['item', 'piece', 'qty', 'pack', 'can', 'tin'].includes(u)) {
    const itemWeight = parseFloat(item.itemWeight) || parseFloat(item.drainedWeight) || parseFloat(item.packSize) || 0;
    grams = q * itemWeight;
  } else if (u === 'g' || u === 'gram' || u === 'ml') {
    grams = q;
  } else if (u === 'kg' || u === 'l' || u === 'litre' || u === 'liter') {
    grams = q * 1000;
  } else if (typeof customToGrams === 'function') {
    grams = customToGrams(q, u, item?.itemWeight || 100);
  } else {
    grams = q;
  }

  if (grams <= 0) return zero;

  const scale = grams / 100;
  const calVal = (parseFloat(item.cal) || parseFloat(item.calories) || parseFloat(item.kcal) || 0) * scale;
  const protVal = (parseFloat(item.prot) || parseFloat(item.protein) || 0) * scale;
  const carbVal = (parseFloat(item.carb) || parseFloat(item.carbs) || 0) * scale;
  const fatVal = (parseFloat(item.fat) || 0) * scale;
  const fibreVal = (parseFloat(item.fibre) || parseFloat(item.fiber) || 0) * scale;

  let costVal = 0;
  if (parseFloat(item.price) > 0) {
    const packGrams = parseFloat(item.usablePackAmount) || parseFloat(item.drainedWeight) || parseFloat(item.packSize) || 0;
    if (packGrams > 0) {
      costVal = (parseFloat(item.price) / packGrams) * grams;
    }
  }

  const roundedKcal = Math.round(calVal);
  const roundedProt = Math.round(protVal * 10) / 10;
  const roundedCarb = Math.round(carbVal * 10) / 10;
  const roundedFat = Math.round(fatVal * 10) / 10;
  const roundedFibre = Math.round(fibreVal * 10) / 10;
  const roundedCost = Math.round(costVal * 100) / 100;

  return {
    kcal: roundedKcal,
    protein: roundedProt,
    carbs: roundedCarb,
    fat: roundedFat,
    fibre: roundedFibre,
    cost: roundedCost,
    cal: roundedKcal,
    prot: roundedProt,
    carb: roundedCarb
  };
};

const calculateRecipeNutrition = (structuredIngs = [], serves = 1, context = {}, helpers = {}) => {
  let cal = 0, prot = 0, carb = 0, fat = 0, fibre = 0, cost = 0;
  let matched = 0, ingCount = (structuredIngs || []).length;
  const s = Math.max(1, +serves || 1);

  for (const ing of (structuredIngs || [])) {
    if (helpers.isIngredientRemovedInContext && helpers.isIngredientRemovedInContext(ing, context)) continue;
    if (!ing.bankId && !ing.groupId && !ing.product) continue;

    const adjustedIng = helpers.getAdjustedIngredientForContext ? helpers.getAdjustedIngredientForContext(ing, context) : ing;
    const bankIng = ing.product || (helpers.resolveProductForIngredient ? helpers.resolveProductForIngredient(adjustedIng, context)?.product : null);
    if (!bankIng) continue;
    matched++;

    const g = helpers.getEffectiveIngredientGrams ? helpers.getEffectiveIngredientGrams(adjustedIng, bankIng) : (+adjustedIng.amount || +adjustedIng.grams || 0);
    const itemNutrition = calculateItemNutrition(bankIng, g, 'g', helpers.toGrams);

    if (!adjustedIng.excludeNutrition) {
      cal += itemNutrition.kcal;
      prot += itemNutrition.protein;
      carb += itemNutrition.carbs;
      fat += itemNutrition.fat;
      fibre += itemNutrition.fibre;
    }
    cost += itemNutrition.cost;
  }

  const totalNutrition = {
    cal: Math.round(cal),
    prot: Math.round(prot * 10) / 10,
    carb: Math.round(carb * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fibre: Math.round(fibre * 10) / 10,
    cost: Math.round(cost * 100) / 100
  };

  const perServing = {
    cal: Math.round(cal / s),
    prot: Math.round(prot * 10 / s) / 10,
    carb: Math.round(carb * 10 / s) / 10,
    fat: Math.round(fat * 10 / s) / 10,
    fibre: Math.round(fibre * 10 / s) / 10,
    cost: Math.round(cost * 100 / s) / 100
  };

  return { ...perServing, totalNutrition, perServing, matched, total: ingCount };
};

const calculateFit = (actCal, actProt, tgtCal, tgtProt) => {
  if (!tgtCal || !tgtProt) {
    return { score: 0, status: 'green', label: '🟢 Great Fit', warn: [], calDiffPct: 0, protDiffPct: 0 };
  }

  const calDiffPct = ((actCal - tgtCal) / tgtCal) * 100;
  const protDiffPct = ((actProt - tgtProt) / tgtProt) * 100;

  const protDev = protDiffPct < 0 ? (Math.abs(protDiffPct) / 100) * 1.5 : 0;

  let calDev = 0;
  if (calDiffPct > 0) {
    calDev = (calDiffPct / 100) * 1.2;
  } else {
    const absCalDiff = Math.abs(calDiffPct);
    if (protDiffPct >= 0) {
      if (absCalDiff > 35) calDev = 0.10 + ((absCalDiff - 35) / 100) * 0.8;
      else if (absCalDiff > 25) calDev = ((absCalDiff - 25) / 100) * 0.4;
      else calDev = 0;
    } else {
      if (absCalDiff > 35) calDev = (absCalDiff / 100) * 1.0;
      else if (absCalDiff > 25) calDev = (absCalDiff / 100) * 0.6;
      else calDev = (absCalDiff / 100) * 0.3;
    }
  }

  const score = calDev + protDev;

  let calStatus = 'green';
  if (calDiffPct > 35 || calDiffPct < -35) calStatus = 'red';
  else if (calDiffPct > 20 || calDiffPct < -25) calStatus = 'amber';

  let protStatus = 'green';
  if (protDiffPct < -25) protStatus = 'red';
  else if (protDiffPct < -10) protStatus = 'amber';

  let status = 'green';
  if (calStatus === 'red' || protStatus === 'red') status = 'red';
  else if (calStatus === 'amber' || protStatus === 'amber') status = 'amber';

  const label = status === 'green' ? '🟢 Great Fit' : status === 'amber' ? '🟠 Acceptable Fit' : '🔴 Poor Fit';

  const warn = [];
  if (calDiffPct > 20) warn.push(`Calories ${Math.round(calDiffPct)}% above target`);
  else if (calDiffPct < -25) {
    if (protDiffPct >= 0) warn.push(`Calories ${Math.round(Math.abs(calDiffPct))}% below target (protein target met)`);
    else warn.push(`Calories ${Math.round(Math.abs(calDiffPct))}% below target`);
  }

  if (protDiffPct < -10) warn.push(`Protein ${Math.round(Math.abs(protDiffPct))}% below target`);

  return { score, status, label, warn, calDiffPct, protDiffPct };
};

const getBudgets = (person = 'e', mealType = 'dinner', prefs = {}) => {
  const p = prefs || {};
  const eAlloc = p.eAlloc || { b: 15, l: 25, d: 45, s: 15 };
  const cAlloc = p.cAlloc || { b: 25, l: 30, d: 35, s: 10 };
  const eProtAlloc = p.eProtAlloc || eAlloc;
  const cProtAlloc = p.cProtAlloc || cAlloc;

  const alloc = person === 'e' ? eAlloc : cAlloc;
  const protAlloc = person === 'e' ? eProtAlloc : cProtAlloc;

  const meal = String(mealType || '').toLowerCase();
  let mKey = 'd';
  if (meal.includes('breakfast')) mKey = 'b';
  else if (meal.includes('lunch')) mKey = 'l';
  else if (meal.includes('snack')) mKey = 's';
  else if (meal.includes('dinner')) mKey = 'd';

  const calPct = (alloc[mKey] || 0) / 100;
  const protPct = (protAlloc[mKey] || 0) / 100;
  const cal = (person === 'e' ? (Number(p.ecal) || 2400) : (Number(p.ccal) || 1700)) * calPct;
  const prot = (person === 'e' ? (Number(p.eprot) || 130) : (Number(p.cprot) || 100)) * protPct;
  return { cal, prot };
};

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

const calculatePlanDayTotals = (daySlotInfos = [], prefs = {}) => {
  const totals = { e: { cal: 0, prot: 0 }, c: { cal: 0, prot: 0 } };
  const assumed = { e: { cal: 0, prot: 0, labels: [] }, c: { cal: 0, prot: 0, labels: [] } };

  const addSnackBudget = (personPrefix) => {
    const b = getBudgets(personPrefix, 'snack', prefs);
    totals[personPrefix].cal += +b.cal || 0;
    totals[personPrefix].prot += +b.prot || 0;
    assumed[personPrefix].cal += +b.cal || 0;
    assumed[personPrefix].prot += +b.prot || 0;
    assumed[personPrefix].labels.push('snacks');
  };

  addSnackBudget('e');
  addSnackBudget('c');

  (daySlotInfos || []).forEach(info => {
    if (!info?.person || !info.visible) return;
    totals[info.person].cal += +info.cal || 0;
    totals[info.person].prot += +info.prot || 0;
  });

  const eTgt = { cal: +prefs.ecal || 0, prot: +prefs.eprot || 0 };
  const cTgt = { cal: +prefs.ccal || 0, prot: +prefs.cprot || 0 };

  const miss = (actual, target, isProt = false) => {
    if (!target) return 0;
    const pct = ((actual - target) / target) * 100;
    return isProt ? Math.max(0, -pct) : Math.abs(pct);
  };

  const score = miss(totals.e.cal, eTgt.cal) + miss(totals.c.cal, cTgt.cal) + miss(totals.e.prot, eTgt.prot, true) + miss(totals.c.prot, cTgt.prot, true);

  return { totals, targets: { e: eTgt, c: cTgt }, assumed, score: Math.round(score) };
};

const computeMacroProgress = (actual = 0, target = 0, isProtein = false) => {
  if (!target) {
    return { pct: 0, label: 'no target', color: 'var(--text2)', isMet: true };
  }

  const pct = Math.round(((actual - target) / target) * 100);
  const absPct = Math.abs(pct);

  let label = '';
  if (isProtein && pct >= 0) label = `${absPct}% above target`;
  else if (pct === 0) label = 'on target';
  else label = `${absPct}% ${pct > 0 ? 'above' : 'below'} target`;

  let color = 'var(--red)';
  if (isProtein && pct >= 0) color = 'var(--green)';
  else if (absPct <= 10) color = 'var(--green)';
  else if (absPct <= 15) color = 'var(--amber)';

  const isMet = isProtein ? pct >= -10 : absPct <= 15;

  return { pct, label, color, isMet };
};

const getEffectiveIngredientGrams = (ing, product) => {
  if (!ing) return 0;
  const qty = parseFloat(ing.qty ?? ing.amount ?? ing.grams ?? 0);
  const unit = (ing.unit || '').toLowerCase().trim();
  const itemWeight = product ? (parseFloat(product.itemWeight) || 100) : 100;
  return window.toGrams ? window.toGrams(qty, unit, itemWeight) : qty;
};

const calcPortions = (nutrition, prefs, serves, who, mealType) => {
  const s = parseFloat(serves) || 1;
  const p = prefs || window.state?.prefs || {};
  
  const eBud = (window.PlatePlanNutrition && typeof window.PlatePlanNutrition.getBudgets === 'function')
    ? window.PlatePlanNutrition.getBudgets('e', mealType, p)
    : getBudgets('e', mealType, p);
  const cBud = (window.PlatePlanNutrition && typeof window.PlatePlanNutrition.getBudgets === 'function')
    ? window.PlatePlanNutrition.getBudgets('c', mealType, p)
    : getBudgets('c', mealType, p);

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
  const carbPerServ = parseFloat(nutrition?.carb ?? nutrition?.carbs ?? 0);
  const fatPerServ = parseFloat(nutrition?.fat ?? 0);
  const fibrePerServ = parseFloat(nutrition?.fibre ?? nutrition?.fiber ?? 0);

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

const resolveProductForIngredient = (ingredientOrId, contextOrState = null, targetState = null) => {
  if (typeof window !== 'undefined' && typeof window.PlatePlanIngredients?.resolveProductForIngredient === 'function') {
    return window.PlatePlanIngredients.resolveProductForIngredient(ingredientOrId, contextOrState, targetState);
  }

  if (!ingredientOrId) {
    return { product: null, group: null, productId: null, groupId: null };
  }

  let s = targetState;
  let resolutionContext = null;

  if (contextOrState && (contextOrState.ingredients || contextOrState.ingredientGroups || contextOrState.ingredientProductMappings || contextOrState.recipes)) {
    s = contextOrState;
  } else if (contextOrState && typeof contextOrState === 'object') {
    resolutionContext = contextOrState;
  }
  if (!s) {
    s = (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  }

  const productsList = s?.ingredients || s?.products || [];
  const groupsList = s?.ingredientGroups || [];
  const mappings = s?.ingredientProductMappings || {};

  let ing = ingredientOrId;
  let directId = null;
  if (typeof ing === 'string' || typeof ing === 'number') {
    directId = String(ing);
    ing = { id: directId, productId: directId, bankId: directId };
  }

  const findProductById = (id) => {
    if (!id) return null;
    const str = String(id);
    if (typeof window !== 'undefined' && window.platePlanIndexes?.products) {
      const idxP = window.platePlanIndexes.products.get(str) || window.platePlanIndexes.products.get(id);
      if (idxP) return idxP;
    }
    if (typeof window !== 'undefined' && typeof window.getProduct === 'function') {
      const p = window.getProduct(id);
      if (p) return p;
    }
    return productsList.find(p => p && (String(p.id) === str || p.name === id)) || null;
  };

  const findGroupById = (id) => {
    if (!id) return null;
    const str = String(id);
    if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
      const idxG = window.platePlanIndexes.groups.get(str) || window.platePlanIndexes.groups.get(id);
      if (idxG) return idxG;
    }
    if (typeof window !== 'undefined' && typeof window.getIngredientGroup === 'function') {
      const g = window.getIngredientGroup(id);
      if (g) return g;
    }
    return groupsList.find(g => g && (String(g.id) === str || g.name === id)) || null;
  };

  let product = null;
  let group = null;

  if (resolutionContext) {
    const overId = (ing.id && resolutionContext.productOverrides?.[ing.id]) ||
                   (ing.id && resolutionContext.substitutions?.[ing.id]) ||
                   (ing.groupId && resolutionContext.productSelections?.[ing.groupId]) ||
                   (ing.groupId && resolutionContext.productOverrides?.[ing.groupId]);
    if (overId) {
      product = findProductById(overId);
    }
  }

  if (!product && ing.product && typeof ing.product === 'object') {
    product = ing.product;
  }

  if (!product && mappings) {
    const mappedId = (ing.ingredientId && mappings[ing.ingredientId]) ||
                     (ing.id && mappings[ing.id]) ||
                     (ing.name && mappings[ing.name]);
    if (mappedId) {
      product = findProductById(mappedId);
    }
  }

  if (!product) {
    const pId = ing.productId || ing.bankId;
    if (pId) {
      product = findProductById(pId);
    }
  }

  const targetGroupId = ing.groupId || ing.subTypeId;
  if (targetGroupId) {
    group = findGroupById(targetGroupId);
  }

  if (product && !group) {
    const pGroupId = product.groupId || product.subTypeId;
    if (pGroupId) {
      group = findGroupById(pGroupId);
    }
  }

  if (!product && group) {
    const defId = group.manualDefaultProductId || group.defaultProductId;
    if (defId) {
      product = findProductById(defId);
    }
    if (!product) {
      const groupProducts = productsList.filter(p => p && (p.groupId === group.id || p.subTypeId === group.id));
      if (groupProducts.length > 0) {
        product = groupProducts.find(p => p && (+p.cal > 0 || +p.prot > 0)) || groupProducts[0];
      }
    }
  }

  if (!product && directId && !group) {
    group = findGroupById(directId);
    if (group) {
      const defId = group.manualDefaultProductId || group.defaultProductId;
      if (defId) product = findProductById(defId);
      if (!product) {
        const groupProducts = productsList.filter(p => p && (p.groupId === group.id || p.subTypeId === group.id));
        if (groupProducts.length > 0) product = groupProducts[0];
      }
    }
  }

  if (!product && !group && (ing.ingredientId || ing.familyId)) {
    const famId = ing.ingredientId || ing.familyId;
    const fam = (s?.ingredientFamilies || []).find(f => f && (f.id === famId || f.name === famId));
    if (fam) {
      const defaultGroup = fam.defaultTypeId ? findGroupById(fam.defaultTypeId) : null;
      if (defaultGroup) {
        group = defaultGroup;
        const defId = defaultGroup.manualDefaultProductId || defaultGroup.defaultProductId;
        if (defId) product = findProductById(defId);
        if (!product) {
          const groupProducts = productsList.filter(p => p && (p.groupId === defaultGroup.id || p.subTypeId === defaultGroup.id));
          if (groupProducts.length > 0) product = groupProducts[0];
        }
      }
    }
  }

  return {
    ...(product || {}),
    product: product || null,
    group: group || null,
    productId: product?.id || null,
    groupId: group?.id || ing.groupId || null
  };
};

const getEffectiveIngredientAmount = (ing, resolutionContext) => {
  if (resolutionContext && resolutionContext.ingredientQuantityOverrides?.[ing.id] !== undefined) {
    return parseFloat(resolutionContext.ingredientQuantityOverrides[ing.id]) || 0;
  }
  return parseFloat(ing.qty ?? ing.amount ?? ing.grams ?? 1);
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

  for (const ing of activeIngredients) {
    if (resolutionContext && resolutionContext.removeIngredientKeys?.[ing.id]) continue;

    const product = resolveProductForIngredient(ing, resolutionContext);
    if (product) matchedCount++;

    const qty = getEffectiveIngredientAmount(ing, resolutionContext);
    const unit = ing.unit || 'g';
    const grams = getEffectiveIngredientGrams({ qty, unit }, product);

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

let isRefreshingDerivedState = false;
const refreshPlatePlanDerivedState = (options = {}) => {
  if (isRefreshingDerivedState) return;
  isRefreshingDerivedState = true;
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
    isRefreshingDerivedState = false;
  }
};

const ensureIngredientGroups = (target = null) => {
  const s = target || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  if (!s || typeof s !== 'object') return [];
  if (!Array.isArray(s.ingredientGroups)) {
    s.ingredientGroups = [];
  }
  if (!Array.isArray(s.ingredientFamilies)) {
    s.ingredientFamilies = [];
  }
  if (!Array.isArray(s.ingredients)) {
    s.ingredients = [];
  }
  if (Array.isArray(s.recipes)) {
    s.recipes.forEach(r => {
      if (!r || typeof r !== 'object') return;
      if (!Array.isArray(r.ingredientGroups)) {
        r.ingredientGroups = [];
      }
      if (r.enhanced && typeof r.enhanced === 'object' && !Array.isArray(r.enhanced.ingredientGroups)) {
        r.enhanced.ingredientGroups = [];
      }
    });
  }
  if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
    s.ingredientGroups.forEach(g => {
      if (g && g.id) window.platePlanIndexes.groups.set(g.id, g);
    });
  }
  return s.ingredientGroups;
};

const ensureIngredientFamilies = (target = null) => {
  const s = target || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  if (!s || typeof s !== 'object') return [];
  if (!Array.isArray(s.ingredientFamilies)) {
    s.ingredientFamilies = [];
  }
  if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
    s.ingredientFamilies.forEach(f => {
      if (f && f.id) window.platePlanIndexes.families.set(f.id, f);
    });
  }
  return s.ingredientFamilies;
};

const hasUsableIngredientNutrition = (ingredient) => {
  if (!ingredient) return false;
  let target = ingredient;
  if (typeof target === 'string' || typeof target === 'number') {
    const s = typeof window !== 'undefined' ? window.state : (typeof state !== 'undefined' ? state : null);
    if (s?.ingredients) {
      if (Array.isArray(s.ingredients)) {
        target = s.ingredients.find(i => i && (i.id === target || String(i.id) === String(target)));
      } else if (typeof s.ingredients === 'object') {
        target = s.ingredients[target] || Object.values(s.ingredients).find(i => i && (i.id === target || String(i.id) === String(target)));
      }
    }
    if (!target && typeof window !== 'undefined' && window.platePlanIndexes?.ingredients) {
      target = window.platePlanIndexes.ingredients.get(ingredient);
    }
  }
  if (!target || typeof target !== 'object') return false;

  const n = (target.nutrition && typeof target.nutrition === 'object') ? target.nutrition : {};
  const cal = target.cal ?? target.calories ?? target.kcal ?? target.kcals ?? target.energy ?? n.cal ?? n.calories ?? n.kcal ?? n.kcals;
  const prot = target.prot ?? target.protein ?? n.prot ?? n.protein;
  const carb = target.carb ?? target.carbs ?? n.carb ?? n.carbs;
  const fat = target.fat ?? n.fat;
  const fibre = target.fibre ?? target.fiber ?? n.fibre ?? n.fiber;

  const isValidNum = (v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)) && Number(v) >= 0;

  if (isValidNum(cal) && Number(cal) > 0) return true;
  if ((isValidNum(prot) && Number(prot) > 0) || (isValidNum(carb) && Number(carb) > 0) || (isValidNum(fat) && Number(fat) > 0) || (isValidNum(fibre) && Number(fibre) > 0)) return true;
  if (isValidNum(cal) && isValidNum(prot) && isValidNum(carb)) return true;

  return false;
};

const getGroupIngredientFamily = (groupOrId, targetState = null) => {
  if (!groupOrId) return null;
  const s = targetState || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  const families = s?.ingredientFamilies || [];
  const groups = s?.ingredientGroups || [];

  let group = groupOrId;
  if (typeof group === 'string' || typeof group === 'number') {
    const strId = String(group);
    if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
      group = window.platePlanIndexes.groups.get(strId) || window.platePlanIndexes.groups.get(group);
    }
    if (!group || typeof group !== 'object') {
      group = groups.find(g => g && (String(g.id) === strId || g.name === groupOrId));
    }
    if (!group) {
      if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
        const directFam = window.platePlanIndexes.families.get(strId) || window.platePlanIndexes.families.get(groupOrId);
        if (directFam) return directFam;
      }
      return families.find(f => f && (String(f.id) === strId || f.name === groupOrId)) || null;
    }
  }

  if (!group || typeof group !== 'object') return null;

  const familyId = group.ingredientId || group.familyId;
  if (familyId) {
    if (typeof window !== 'undefined' && window.platePlanIndexes?.families) {
      const found = window.platePlanIndexes.families.get(String(familyId)) || window.platePlanIndexes.families.get(familyId);
      if (found) return found;
    }
    const found = families.find(f => f && (String(f.id) === String(familyId) || f.name === familyId));
    if (found) return found;
  }

  if (group.family) {
    const famStr = String(group.family).trim().toLowerCase();
    const found = families.find(f => f && (String(f.id) === group.family || String(f.name || '').trim().toLowerCase() === famStr));
    if (found) return found;
    return { id: group.ingredientId || group.familyId || group.family, name: group.family, cat: group.cat || 'other' };
  }

  if (group.cat) {
    const found = families.find(f => f && (f.cat === group.cat || f.id === group.cat));
    if (found) return found;
  }

  return null;
};

if (typeof window !== 'undefined') {
  window.PlatePlanNutrition = {
    NUTRITION_CANONICAL_MAP,
    normalizeNutrientKey,
    numericNutritionValues,
    normalizeEnergyKcal,
    normalizeNutritionPayload,
    calculateItemNutrition,
    calculateRecipeNutrition,
    calculateFit,
    getBudgets,
    getEffectiveRecipeFitScore,
    attachComputedFitScores,
    getSortedRecipes,
    calculatePlanDayTotals,
    computeMacroProgress,
    getEffectiveIngredientGrams,
    calcPortions,
    calculateRecipeDisplayNutrition,
    calcRecipeNutrition,
    recalcRecipeNutrition,
    recalcAllRecipes,
    refreshPlatePlanDerivedState,
    ensureIngredientGroups,
    ensureIngredientFamilies,
    hasUsableIngredientNutrition,
    getGroupIngredientFamily,
    resolveProductForIngredient
  };

  window.resolveProductForIngredient = resolveProductForIngredient;
  window.getEffectiveIngredientGrams = getEffectiveIngredientGrams;
  window.calcPortions = calcPortions;
  window.calculateRecipeDisplayNutrition = calculateRecipeDisplayNutrition;
  window.calcRecipeNutrition = calcRecipeNutrition;
  window.recalcRecipeNutrition = recalcRecipeNutrition;
  window.recalcAllRecipes = recalcAllRecipes;
  window.refreshPlatePlanDerivedState = refreshPlatePlanDerivedState;
  window.ensureIngredientGroups = ensureIngredientGroups;
  window.ensureIngredientFamilies = ensureIngredientFamilies;
  window.hasUsableIngredientNutrition = hasUsableIngredientNutrition;
  window.getGroupIngredientFamily = getGroupIngredientFamily;
  window.getBudgets = getBudgets;
  window.calculatePlanDayTotals = calculatePlanDayTotals;
  window.calculateFit = calculateFit;
  window.calculateRecipeNutrition = calculateRecipeNutrition;
  window.attachComputedFitScores = attachComputedFitScores;
  window.getSortedRecipes = getSortedRecipes;
  window.getEffectiveRecipeFitScore = getEffectiveRecipeFitScore;
  window.computeMacroProgress = computeMacroProgress;
}
})();
