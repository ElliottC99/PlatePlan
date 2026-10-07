/**
 * src/services/NutritionService.js (v3.8.1)
 * Pure macro calculation, calorie normalization, and nutritional rollup service.
 * Quarantined from page DOM queries and direct database operations.
 */
import { UNIT_TO_GRAMS, toGrams } from '../utils/unitConverter.js';

export const NUTRITION_CANONICAL_MAP = {
  cal: "cal", kcal: "cal", calories: "cal", energy: "cal",
  fat: "fat",
  satfat: "satFat", sat_fat: "satFat", saturated_fat: "satFat", "saturated fat": "satFat",
  carb: "carb", carbs: "carb", carbohydrate: "carb", carbohydrates: "carb",
  sugar: "sugar", sugars: "sugar",
  fibre: "fibre", fiber: "fibre",
  protein: "prot", prot: "prot",
  salt: "salt", sodium: "salt"
};

export function normalizeNutrientKey(key) {
  if (!key) return key;
  const cleanKey = String(key).toLowerCase().trim();
  if (cleanKey.includes('kcal') || cleanKey.includes('calories')) return 'cal';
  return NUTRITION_CANONICAL_MAP[cleanKey] || cleanKey;
}

export function numericNutritionValues(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];
  return String(value).match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
}

export function normalizeEnergyKcal(value) {
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
}

export function normalizeNutritionPayload(raw) {
  const parsed = {};
  for (const k in (raw || {})) {
    const cleanKey = String(k || '').toLowerCase();
    const key = normalizeNutrientKey(k);
    if (key === 'cal') parsed[key] = normalizeEnergyKcal(raw[k]);
    else if (cleanKey.includes('kj') && !parsed.cal) parsed.cal = normalizeEnergyKcal(`${raw[k]} kJ`);
    else parsed[key] = +raw[k] || 0;
  }
  if (!parsed.cal) {
    parsed.cal = normalizeEnergyKcal(raw?.energy ?? raw?.calories ?? raw?.kcal ?? raw?.cal);
  }
  return parsed;
}

export function calculateItemNutrition(item, quantity, unit = 'g') {
  const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0, cal: 0, prot: 0, carb: 0 };
  if (!item || typeof item !== 'object') return zero;

  const q = parseFloat(quantity);
  if (isNaN(q) || q <= 0) return zero;

  let grams = 0;
  const u = String(unit || 'g').trim().toLowerCase().replace(/s$/, '');

  if (u === 'item' || u === 'piece' || u === 'qty' || u === 'pack' || u === 'can' || u === 'tin') {
    const itemWeight = parseFloat(item.itemWeight) || parseFloat(item.drainedWeight) || parseFloat(item.packSize) || 0;
    grams = q * itemWeight;
  } else if (u === 'g' || u === 'gram') {
    grams = q;
  } else if (u === 'kg') {
    grams = q * 1000;
  } else if (u === 'ml') {
    grams = q;
  } else if (u === 'l' || u === 'litre' || u === 'liter') {
    grams = q * 1000;
  } else if (UNIT_TO_GRAMS[u]) {
    grams = q * UNIT_TO_GRAMS[u];
  } else {
    grams = toGrams(q, u, item?.itemWeight || 100);
  }

  grams = calculateItemNutritionalWeight(item, grams);

  if (grams <= 0) return zero;

  const scale = grams / 100;
  const calVal = (parseFloat(item.cal) || parseFloat(item.calories) || parseFloat(item.kcal) || 0) * scale;
  const protVal = (parseFloat(item.prot) || parseFloat(item.protein) || 0) * scale;
  const carbVal = (parseFloat(item.carb) || parseFloat(item.carbs) || 0) * scale;
  const fatVal = (parseFloat(item.fat) || 0) * scale;
  const fibreVal = (parseFloat(item.fibre) || parseFloat(item.fiber) || 0) * scale;

  let costVal = 0;
  if (parseFloat(item.price) > 0) {
    const packGrams = parseFloat(item.usablePackAmount) || parseFloat(item.packSize) || 0;
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
}

export function rollupNutritionTotals(itemsNutritionList, serves = 1) {
  let cal = 0, prot = 0, carb = 0, fat = 0, fibre = 0, cost = 0;
  (itemsNutritionList || []).forEach(n => {
    cal += (n.kcal ?? n.cal ?? 0);
    prot += (n.protein ?? n.prot ?? 0);
    carb += (n.carbs ?? n.carb ?? 0);
    fat += (n.fat ?? 0);
    fibre += (n.fibre ?? 0);
    cost += (n.cost ?? 0);
  });

  const s = Math.max(1, +serves || 1);
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

  return { ...perServing, totalNutrition, perServing };
}

export function scaleNutrition(nutrition, targetServings, baseServings = 1) {
  if (!nutrition) return null;
  const ratio = (Math.max(1, targetServings) / Math.max(1, baseServings));
  return {
    cal: Math.round((nutrition.cal || 0) * ratio),
    prot: Math.round((nutrition.prot || 0) * ratio * 10) / 10,
    carb: Math.round((nutrition.carb || 0) * ratio * 10) / 10,
    fat: Math.round((nutrition.fat || 0) * ratio * 10) / 10,
    fibre: Math.round((nutrition.fibre || 0) * ratio * 10) / 10,
    cost: Math.round((nutrition.cost || 0) * ratio * 100) / 100
  };
}

export function calculateItemNutritionalWeight(product, requestedGramWeight) {
  if (product && product.drainedWeightG && product.netWeightG) {
    const drainedRatio = product.drainedWeightG / product.netWeightG;
    return requestedGramWeight * drainedRatio;
  }
  if (product && product.drainedWeight && product.netWeight) {
    const drainedRatio = product.drainedWeight / product.netWeight;
    return requestedGramWeight * drainedRatio;
  }
  return requestedGramWeight;
}

if (typeof window !== 'undefined') {
  window.calculateItemNutritionalWeight = calculateItemNutritionalWeight;
}
