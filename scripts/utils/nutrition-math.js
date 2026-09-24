/**
 * scripts/utils/nutrition-math.js
 * Pure Nutrition Math, Normalization, Macro Calculation & Fit Scoring Utility Module
 */

(() => {
  window.PlatePlanNutrition = window.PlatePlanNutrition || {};

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

  const normalizeEnergyKcal = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value > 2500 ? Math.round(value / 4.184) : Math.round(value);

    const text = String(value).toLowerCase();
    const kcalMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories|cals?\b)/i);
    if (kcalMatch) return Math.round(+kcalMatch[1]);

    const kjMatch = text.match(/(\d+(?:\.\d+)?)\s*kj/i);
    const nums = (window.numericNutritionValues || (() => []))(text);
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

  const getProductProteinPer100Kcal = (product) => {
    if (!product) return 0;
    const cal = parseFloat(product.cal) || 0;
    const prot = parseFloat(product.prot) || 0;
    if (cal <= 0) return 0;
    return (prot / cal) * 100;
  };

  // == Attach to Namespace ==
  Object.assign(window.PlatePlanNutrition, {
    NUTRITION_CANONICAL_MAP,
    normalizeNutrientKey,
    normalizeEnergyKcal,
    normalizeNutritionPayload,
    calculateItemNutrition,
    calculateRecipeNutrition,
    calculateFit,
    getBudgets,
    calculatePlanDayTotals,
    computeMacroProgress,
    getProductProteinPer100Kcal
  });

  // == Attach to Window ==
  if (typeof window !== 'undefined') {
    window.normalizeNutrientKey = normalizeNutrientKey;
    window.normalizeEnergyKcal = normalizeEnergyKcal;
    window.normalizeNutritionPayload = normalizeNutritionPayload;
    window.calculateItemNutrition = calculateItemNutrition;
    window.calculateRecipeNutrition = calculateRecipeNutrition;
    window.calculateFit = calculateFit;
    window.getBudgets = getBudgets;
    window.calculatePlanDayTotals = calculatePlanDayTotals;
    window.computeMacroProgress = computeMacroProgress;
    window.getProductProteinPer100Kcal = getProductProteinPer100Kcal;
  }
})();
