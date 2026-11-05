/**
 * src/services/NutritionService.js (v3.8.1)
 * Pure macro calculation, calorie normalization, and nutritional rollup service.
 * Quarantined from page DOM queries and direct database operations.
 */
import { toGrams } from './UnitConversionService.js';

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

export function normalizeEnergyKcal(value, prot = 0, carb = 0, fat = 0, fibre = 0) {
  if (value === null || value === undefined || value === '') return 0;
  
  let valNum = 0;
  if (typeof value === 'number') {
    valNum = value;
  } else {
    const text = String(value).toLowerCase();
    const kcalMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories|cals?\b)/i);
    if (kcalMatch) return Math.round(+kcalMatch[1]);
    const kjMatch = text.match(/(\d+(?:\.\d+)?)\s*kj/i);
    const nums = numericNutritionValues(text);
    if (nums.length >= 2) {
      const plausible = nums.filter(n => n > 0 && n < 1000);
      if (plausible.length) valNum = Math.min(...plausible);
    } else if (kjMatch) {
      return Math.round((+kjMatch[1]) / 4.184);
    } else if (nums.length === 1) {
      valNum = nums[0];
    }
  }

  if (valNum <= 0) return 0;

  // Atwater macronutrient cross-validation:
  // If macros are available, check if the calorie number is actually in kilojoules.
  // 1 kcal = 4.184 kJ. Ratio of kJ to expected Atwater kcal is typically between 3.4 and 5.2.
  const p = Number(prot) || 0, c = Number(carb) || 0, f = Number(fat) || 0, fib = Number(fibre) || 0;
  const atwater = (4 * p) + (4 * c) + (9 * f) + (2 * fib);
  if (atwater > 15) {
    const ratio = valNum / atwater;
    if (ratio >= 3.4 && ratio <= 5.2) {
      return Math.round(valNum / 4.184);
    }
  }

  if (valNum > 2500) return Math.round(valNum / 4.184);
  return Math.round(valNum);
}

export function normalizeNutritionPayload(raw) {
  const parsed = {};
  const prot = +(raw?.prot ?? raw?.protein ?? 0);
  const carb = +(raw?.carb ?? raw?.carbs ?? raw?.carbohydrate ?? 0);
  const fat = +(raw?.fat ?? 0);
  const fibre = +(raw?.fibre ?? raw?.fiber ?? 0);

  for (const k in (raw || {})) {
    const cleanKey = String(k || '').toLowerCase();
    const key = normalizeNutrientKey(k);
    if (key === 'cal') parsed[key] = normalizeEnergyKcal(raw[k], prot, carb, fat, fibre);
    else if (cleanKey.includes('kj') && !parsed.cal) parsed.cal = normalizeEnergyKcal(`${raw[k]} kJ`, prot, carb, fat, fibre);
    else parsed[key] = +raw[k] || 0;
  }
  if (!parsed.cal) {
    parsed.cal = normalizeEnergyKcal(raw?.energy ?? raw?.calories ?? raw?.kcal ?? raw?.cal, prot, carb, fat, fibre);
  }
  return parsed;
}

export function resolveProductItemWeight(product) {
  if (!product || typeof product !== 'object') return 0;
  const val = product.value && typeof product.value === 'object' ? product.value : {};

  // 1. Explicit 1 usable item size
  const explicit = parseFloat(
    product.itemWeight ?? product.item_weight ?? product.usableItemSize ?? product.singleItemWeight ??
    val.itemWeight ?? val.item_weight ?? val.usableItemSize ?? val.singleItemWeight ?? 0
  );
  if (explicit > 0) return explicit;

  // 2. Derive from pack size, drained weight, or usable pack amount divided by itemCount
  const drainedWeight = parseFloat(product.drainedWeight ?? product.drained_weight ?? val.drainedWeight ?? val.drained_weight ?? 0);
  const usablePack = parseFloat(product.usablePackAmount ?? product.usable_pack_amount ?? val.usablePackAmount ?? val.usable_pack_amount ?? 0);
  const packSize = parseFloat(product.packSize ?? product.pack_size ?? val.packSize ?? val.pack_size ?? 0);
  const itemCount = parseFloat(product.itemCount ?? product.item_count ?? val.itemCount ?? val.item_count ?? 0);

  if (itemCount > 0) {
    const baseWeight = (drainedWeight > 0 ? drainedWeight : (usablePack > 0 ? usablePack : packSize));
    if (baseWeight > 0) {
      return Math.round((baseWeight / itemCount) * 10) / 10;
    }
  }

  // 3. Single packaged unit with drained weight (e.g. fresh mozzarella ball in liquid)
  const packUnit = String(product.packUnit || product.pack_unit || product.unit || val.packUnit || '').toLowerCase();
  const name = String(product.name || product.title || val.name || '');
  const notes = String(product.notes || val.notes || '');

  if (drainedWeight > 0 && (packUnit === 'each' || packUnit === 'item' || packUnit === 'qty' || /\b(?:ball|block)\b/i.test(name))) {
    return drainedWeight;
  }

  // 4. Look for embedded count in product name or notes (e.g. "6 Vegan Sausages", "Twin Pack", "2 Burgers")
  let parsedCount = 0;
  const nameCountMatch = name.match(/^(\d+)\s+(?:pack\s+of\s+)?([a-zA-Z\s]+)/i) || 
                         name.match(/\b(\d+)\s+(?:[a-zA-Z&'-]+\s+)*(?:pack|burgers?|patties?|pieces?|items?|sausages?|fillets?|slices?|wraps?|buns?)\b/i) ||
                         name.match(/\b(?:pack of|box of)\s*(\d+)\b/i);
  if (nameCountMatch) {
    parsedCount = parseInt(nameCountMatch[1], 10);
  } else if (/\btwin\s*pack\b/i.test(name)) {
    parsedCount = 2;
  } else if (notes) {
    const notesCountMatch = notes.match(/\b(\d+)\s*(?:[a-zA-Z&'-]+\s+)*(?:pack|burgers?|patties?|pieces?|items?|sausages?|fillets?|slices?|wraps?|buns?)\b/i);
    if (notesCountMatch) {
      parsedCount = parseInt(notesCountMatch[1], 10);
    }
  }

  if (parsedCount > 1 && parsedCount <= 100) {
    const baseWeight = (drainedWeight > 0 ? drainedWeight : (usablePack > 0 ? usablePack : packSize));
    if (baseWeight > 0) {
      return Math.round((baseWeight / parsedCount) * 10) / 10;
    }
  }

  // 5. Pack unit indicates each / item and pack size is within single item range
  if ((packUnit === 'each' || packUnit === 'item' || /\beach\b/i.test(name)) && packSize > 0 && packSize <= 1000) {
    return packSize;
  }

  return 0;
}

export function calculateItemNutrition(item, quantity, unit = 'g') {
  const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0, cal: 0, prot: 0, carb: 0 };
  if (!item || typeof item !== 'object') return zero;

  const q = parseFloat(quantity);
  if (isNaN(q) || q <= 0) return zero;

  let grams = 0;
  const u = String(unit || 'g').trim().toLowerCase().replace(/s$/, '');
  const resolvedItemWeight = resolveProductItemWeight(item);

  if (u === 'g' || u === 'gram' || u === 'ml') {
    grams = q;
  } else if (u === 'pack' || u === 'can' || u === 'tin') {
    const drained = parseFloat(item.drainedWeight ?? item.value?.drainedWeight ?? 0);
    const usablePack = parseFloat(item.usablePackAmount ?? item.value?.usablePackAmount ?? 0);
    const pack = parseFloat(item.packSize ?? item.value?.packSize ?? 0);
    const packAmount = drained || usablePack || pack || 400;
    grams = q * packAmount;
  } else if (resolvedItemWeight > 0) {
    grams = q * resolvedItemWeight;
  } else {
    grams = toGrams(q, u, item.name, 0);
  }

  // Pack / Drained Weight Ceiling Guard for discrete counts:
  // Discrete piece counts against a jar or can (e.g. 20 olives) cannot exceed the container's solid weight
  if (u === 'qty' || u === 'item' || u === 'count') {
    const maxContainerWeight = parseFloat(item.drainedWeight ?? item.value?.drainedWeight ?? 0) || 
                               parseFloat(item.usablePackAmount ?? item.value?.usablePackAmount ?? 0);
    if (maxContainerWeight > 0 && grams > maxContainerWeight) {
      grams = maxContainerWeight;
    }
  }

  grams = calculateItemNutritionalWeight(item, grams);

  if (grams <= 0) return zero;

  const scale = grams / 100;
  const rawCal = parseFloat(item.cal) || parseFloat(item.calories) || parseFloat(item.kcal) || 0;
  const rawProt = parseFloat(item.prot) || parseFloat(item.protein) || 0;
  const rawCarb = parseFloat(item.carb) || parseFloat(item.carbs) || 0;
  const rawFat = parseFloat(item.fat) || 0;
  const rawFibre = parseFloat(item.fibre) || parseFloat(item.fiber) || 0;

  // Runtime safeguard against products stored in database with kJ as cal
  const cleanCal = normalizeEnergyKcal(rawCal, rawProt, rawCarb, rawFat, rawFibre);

  const calVal = cleanCal * scale;
  const protVal = rawProt * scale;
  const carbVal = rawCarb * scale;
  const fatVal = rawFat * scale;
  const fibreVal = rawFibre * scale;

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
  if (!product || typeof product !== 'object' || requestedGramWeight <= 0) return requestedGramWeight;
  const drained = parseFloat(product.drainedWeight || product.drainedWeightG || product.drained_weight || 0);
  const pack = parseFloat(product.packSize || product.netWeight || product.netWeightG || product.usablePackAmount || 0);

  if (drained > 0 && pack > 0 && drained < pack) {
    // If recipe asks for roughly the gross can size (e.g. 360g-440g for a 400g can), scale to drained weight
    if (Math.abs(requestedGramWeight - pack) / pack <= 0.15) {
      return drained * (requestedGramWeight / pack);
    }
    // Partial gram weight requested (e.g. 200g of canned beans) -> scale by drained ratio
    const drainedRatio = drained / pack;
    return requestedGramWeight * drainedRatio;
  }
  return requestedGramWeight;
}

if (typeof window !== 'undefined') {
  window.calculateItemNutritionalWeight = calculateItemNutritionalWeight;
}
