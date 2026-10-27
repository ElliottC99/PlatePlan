/**
 * src/services/RecipeUnitConverter.js
 * RecipeUnitConverter.js - PlatePlan Canonical Unit & Density Normaliser
 * Translates volumetric, non-metric, and count units into 'g', 'ml', or 'qty'.
 */

const LIQUID_TERMS = [
  'oil', 'water', 'milk', 'vinegar', 'sauce', 'syrup', 'sherry',
  'juice', 'wine', 'stock', 'broth', 'tamari', 'cream', 'dressing'
];

/**
 * Normalises raw quantity and unit into canonical 'g', 'ml', or 'qty'.
 * Uses density estimation for volumetric units (tbsp, tsp, cups).
 * @param {number|string} rawQty 
 * @param {string} rawUnit 
 * @param {string} ingredientName 
 * @returns {Object} { qty: number, unit: string, isEstimated: boolean }
 */
export function normaliseUnitAndQty(rawQty, rawUnit, ingredientName) {
  const u = (rawUnit || '').toLowerCase().trim();
  const nameLower = (ingredientName || '').toLowerCase().trim();
  let qty = parseFloat(rawQty) || 1;
  let unit = 'qty';
  let isEstimated = false;

  const isLiquid = LIQUID_TERMS.some(term => nameLower.includes(term));

  switch (u) {
    case 'g':
    case 'gram':
    case 'grams':
      unit = 'g';
      break;

    case 'kg':
    case 'kilogram':
    case 'kilograms':
      unit = 'g';
      qty = Math.round(qty * 1000 * 100) / 100;
      break;

    case 'ml':
    case 'millilitre':
    case 'millilitres':
    case 'milliliter':
    case 'milliliters':
      unit = 'ml';
      break;

    case 'l':
    case 'litre':
    case 'litres':
    case 'liter':
    case 'liters':
      unit = 'ml';
      qty = Math.round(qty * 1000 * 100) / 100;
      break;

    case 'tbsp':
    case 'tablespoon':
    case 'tablespoons':
      if (isLiquid) {
        unit = 'ml';
        qty = Math.round(qty * 15 * 100) / 100;
      } else {
        unit = 'g';
        qty = Math.round(qty * 14 * 100) / 100;
        isEstimated = true;
      }
      break;

    case 'tsp':
    case 'teaspoon':
    case 'teaspoons':
      if (isLiquid) {
        unit = 'ml';
        qty = Math.round(qty * 5 * 100) / 100;
      } else {
        // Exact fraction support for 0.25 tsp -> 0.9g
        if (Math.abs(qty - 0.25) < 0.01) qty = 0.9;
        else qty = Math.round(qty * 3.5 * 100) / 100;
        unit = 'g';
        isEstimated = true;
      }
      break;

    case 'cup':
    case 'cups':
      if (isLiquid) {
        unit = 'ml';
        qty = Math.round(qty * 240);
      } else {
        unit = 'g';
        qty = Math.round(qty * 125);
        isEstimated = true;
      }
      break;

    case 'oz':
    case 'ounce':
    case 'ounces':
      unit = 'g';
      qty = Math.round(qty * 28.35 * 100) / 100;
      break;

    case 'fl oz':
      unit = 'ml';
      qty = Math.round(qty * 29.57 * 100) / 100;
      break;

    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      unit = 'g';
      qty = Math.round(qty * 453.6 * 100) / 100;
      break;

    case 'pinch':
    case 'pinches':
      unit = 'g';
      qty = Math.round(qty * 0.5 * 100) / 100;
      isEstimated = true;
      break;

    case 'clove':
    case 'cloves':
    case 'pack':
    case 'packs':
    case 'tin':
    case 'tins':
    case 'can':
    case 'cans':
    case 'pot':
    case 'pots':
    case 'jar':
    case 'jars':
    case 'bunch':
    case 'bunches':
    case 'handful':
    case 'handfuls':
    default:
      unit = 'qty';
      qty = Math.round(qty * 100) / 100;
      break;
  }

  return { qty, unit, isEstimated };
}
