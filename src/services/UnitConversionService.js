/**
 * src/services/UnitConversionService.js (v3.22.1)
 * Density-Based Unit Conversion Engine for PlatePlan Recipe Ingestion.
 * Strictly converts all incoming measurements to 'g', 'ml', or 'qty'.
 */

const LIQUID_INGREDIENTS = [
  'water', 'milk', 'oil', 'olive oil', 'vegetable oil', 'broth', 'stock', 'soy sauce', 
  'tamari', 'vinegar', 'juice', 'lemon juice', 'lime juice', 'cream', 'coconut milk',
  'maple syrup', 'honey', 'syrup', 'wine', 'beer'
];

const DENSITY_TABLE = {
  // g/ml density ratios
  flour: 0.5,        // 1 cup ~ 120g
  sugar: 0.85,       // 1 cup ~ 200g
  rice: 0.8,         // 1 cup ~ 190g
  oats: 0.4,         // 1 cup ~ 90g
  nuts: 0.6,         // 1 cup ~ 140g
  seeds: 0.6,        // 1 cup ~ 140g
  lentils: 0.85,     // 1 cup ~ 200g
  beans: 0.8,        // 1 cup ~ 180g
  butter: 0.9,       // 1 tbsp ~ 14g
  powder: 0.5,       // generic powder/spice
};

export function isLiquidIngredient(name) {
  const lower = String(name || '').toLowerCase();
  return LIQUID_INGREDIENTS.some(liq => lower.includes(liq));
}

export function getIngredientDensity(name) {
  const lower = String(name || '').toLowerCase();
  for (const [key, density] of Object.entries(DENSITY_TABLE)) {
    if (lower.includes(key)) return density;
  }
  return 0.7; // default dry density
}

/**
 * Converts any raw parsed quantity and unit strictly into 'g', 'ml', or 'qty'.
 */
export function convertToStrictUnit(qty, unit, ingredientName) {
  let q = Number(qty) || 1;
  let u = String(unit || 'qty').toLowerCase().trim();
  const name = String(ingredientName || '').toLowerCase();

  // 1. Multiplier / Count units -> 'qty'
  const countUnits = ['clove', 'cloves', 'tin', 'tins', 'can', 'cans', 'block', 'blocks', 'head', 'heads', 'stalk', 'stalks', 'slice', 'slices', 'sprig', 'sprigs', 'piece', 'pieces', 'pack', 'packet', 'package'];
  if (countUnits.includes(u) || u === 'qty' || u === '') {
    return { qty: q, unit: 'qty', isFallbackWeight: false };
  }

  // 2. Weight units -> 'g' or 'kg'
  if (u === 'kg') {
    return { qty: q * 1000, unit: 'g', isFallbackWeight: false };
  }
  if (u === 'g' || u === 'gram' || u === 'grams' || u === 'oz' || u === 'lb' || u === 'lbs') {
    let grams = q;
    if (u === 'oz') grams = q * 28.3495;
    if (u === 'lb' || u === 'lbs') grams = q * 453.592;
    return { qty: Math.round(grams * 10) / 10, unit: 'g', isFallbackWeight: false };
  }

  // 3. Volume units -> 'ml' (if liquid) or 'g' (if dry density lookup)
  let mlVolume = 0;
  if (u === 'ml') mlVolume = q;
  else if (u === 'l' || u === 'liter' || u === 'liters' || u === 'litre' || u === 'litres') mlVolume = q * 1000;
  else if (u === 'cup' || u === 'cups') mlVolume = q * 240;
  else if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') mlVolume = q * 15;
  else if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') mlVolume = q * 5;
  else if (u === 'pinch' || u === 'pinches' || u === 'dash' || u === 'dashes') {
    return { qty: 1, unit: 'g', isFallbackWeight: true };
  }

  if (mlVolume > 0) {
    if (isLiquidIngredient(name)) {
      return { qty: Math.round(mlVolume), unit: 'ml', isFallbackWeight: false };
    } else {
      // Dry ingredient volume to weight via density
      const density = getIngredientDensity(name);
      const weightGrams = mlVolume * density;
      const isFallback = (density === 0.7 && !Object.keys(DENSITY_TABLE).some(k => name.includes(k)));
      return { qty: Math.round(weightGrams * 10) / 10, unit: 'g', isFallbackWeight: isFallback };
    }
  }

  return { qty: q, unit: 'qty', isFallbackWeight: false };
}

if (typeof window !== 'undefined') {
  window.UnitConversionService = {
    convertToStrictUnit,
    isLiquidIngredient,
    getIngredientDensity
  };
}
