/**
 * src/services/UnitConversionService.js
 * The one unit converter. Recipe import, the shopping list, nutrition, the recipe
 * detail view and the recipe editor all turn measurements into 'g', 'ml' or 'qty' here.
 * scripts/test_unit_conversion.js pins every rule; change the fixture with the rule.
 */

// Whole words (or their plurals) that make an ingredient a liquid, kept in ml.
const LIQUID_WORDS = [
  'water', 'milk', 'coconut milk', 'buttermilk', 'oatmilk', 'soymilk', 'oil', 'broth', 'stock',
  'soy', 'tamari', 'vinegar', 'juice', 'cream', 'maple', 'syrup', 'honey', 'wine', 'beer', 'sherry',
  'sauce', 'dressing', 'yoghurt', 'yogurt', 'passata', 'mustard', 'ketchup', 'mayo', 'mayonnaise'
];
const LIQUID_PATTERN = new RegExp(`\\b(?:${LIQUID_WORDS.join('|')})(?:s|es)?\\b`);
const NOT_LIQUID_PATTERN = /\b(?:paste|pastes|puree|purees|purée|purées)\b/;

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
const DEFAULT_DENSITY = 0.7;

const GRAMS_PER_UNIT = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000, kilo: 1000, kilos: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6
};

const ML_PER_UNIT = {
  ml: 1, millilitre: 1, millilitres: 1, milliliter: 1, milliliters: 1,
  l: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  cup: 240, cups: 240,
  'fl oz': 29.57, 'fl. oz': 29.57, 'fl. oz.': 29.57, 'fluid oz': 29.57, floz: 29.57
};

const METRIC_VOLUME_UNITS = new Set([
  'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters',
  'l', 'litre', 'litres', 'liter', 'liters'
]);

// Estimated weights for loose measures, per unit.
const ESTIMATED_GRAMS_PER_UNIT = {
  pinch: 0.5, pinches: 0.5, dash: 0.5, dashes: 0.5,
  handful: 30, handfuls: 30,
  bunch: 20, bunches: 20,
  'small bunch': 15, 'small bunches': 15,
  'large bunch': 30, 'large bunches': 30
};

// Count units with a fixed weight each, used by toGrams even when the item has its own weight.
const COUNT_UNIT_GRAMS = {
  clove: 6, cloves: 6,
  head: 65, heads: 65, bulb: 65, bulbs: 65,
  tin: 400, tins: 400, can: 400, cans: 400,
  slice: 30, slices: 30,
  piece: 100, pieces: 100,
  stalk: 50, stalks: 50,
  sprig: 2, sprigs: 2,
  leaf: 1, leaves: 1,
  cube: 10, cubes: 10,
  pod: 5, pods: 5
};

const COUNT_UNITS = new Set([
  ...Object.keys(COUNT_UNIT_GRAMS),
  'block', 'blocks', 'pack', 'packs', 'packet', 'packets', 'package', 'packages',
  'pot', 'pots', 'jar', 'jars', 'bottle', 'bottles', 'item', 'items', 'count', 'qty', ''
]);

// Typical weight of one whole item, matched by name, when nothing better is known.
const COMMON_DISCRETE_WEIGHTS = {
  lime: 60, lemon: 90, cucumber: 350, onion: 150, shallot: 35,
  garlic: 6, clove: 6, bulb: 65, head: 65, carrot: 100, potato: 180,
  avocado: 170, egg: 60, tomato: 100, pepper: 160, chilli: 15,
  apple: 150, banana: 120, mushroom: 30, stock: 10, cube: 10
};
const DEFAULT_ITEM_GRAMS = 100;

const round1 = n => Math.round(n * 10) / 10;

export function isLiquidIngredient(name) {
  const lower = String(name || '').toLowerCase();
  if (NOT_LIQUID_PATTERN.test(lower)) return false;
  return LIQUID_PATTERN.test(lower);
}

function findDensity(name) {
  const lower = String(name || '').toLowerCase();
  for (const [key, density] of Object.entries(DENSITY_TABLE)) {
    if (lower.includes(key)) return density;
  }
  return null;
}

export function getIngredientDensity(name) {
  return findDensity(name) ?? DEFAULT_DENSITY;
}

function normaliseUnitName(unit) {
  return String(unit || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Converts any raw parsed quantity and unit strictly into 'g', 'ml', or 'qty'.
 * isEstimated marks weights guessed from a volume or a loose measure;
 * isFallbackWeight marks volume weights that used the default density.
 */
export function convertToStrictUnit(qty, unit, ingredientName) {
  const q = Number(qty) || 1;
  const u = normaliseUnitName(unit);
  const result = (value, outUnit, isEstimated = false, isFallbackWeight = false) =>
    ({ qty: value, unit: outUnit, isEstimated, isFallbackWeight });

  if (COUNT_UNITS.has(u)) return result(q, 'qty');
  if (GRAMS_PER_UNIT[u]) return result(round1(q * GRAMS_PER_UNIT[u]), 'g');
  if (ESTIMATED_GRAMS_PER_UNIT[u]) return result(round1(q * ESTIMATED_GRAMS_PER_UNIT[u]), 'g', true);

  if (ML_PER_UNIT[u]) {
    const ml = q * ML_PER_UNIT[u];
    if (isLiquidIngredient(ingredientName)) return result(round1(ml), 'ml');
    const density = findDensity(ingredientName);
    return result(round1(ml * (density ?? DEFAULT_DENSITY)), 'g', true, density === null);
  }

  return result(q, 'qty');
}

/**
 * Converts a quantity to grams for nutrition and display.
 * Fixed-weight count units (clove, tin, head...) use their own weight; ml and litres count 1:1
 * as grams; spoons and cups go through convertToStrictUnit; any other count uses itemWeight,
 * then a weight matched by name, then 100 g.
 */
export function toGrams(qty, unit, ingredientName = '', itemWeight = 0) {
  const u = normaliseUnitName(unit);
  if (COUNT_UNIT_GRAMS[u]) return round1((Number(qty) || 1) * COUNT_UNIT_GRAMS[u]);
  if (METRIC_VOLUME_UNITS.has(u)) return round1((Number(qty) || 1) * ML_PER_UNIT[u]);

  const strict = convertToStrictUnit(qty, unit, ingredientName);
  if (strict.unit !== 'qty') return strict.qty;

  const weight = Number(itemWeight) > 0 ? Number(itemWeight) : inferIngredientWeightByName(ingredientName);
  return round1(strict.qty * weight);
}

function inferIngredientWeightByName(name) {
  const text = String(name || '').toLowerCase();
  for (const [kw, g] of Object.entries(COMMON_DISCRETE_WEIGHTS)) {
    if (text.includes(kw)) return g;
  }
  return DEFAULT_ITEM_GRAMS;
}

if (typeof window !== 'undefined') {
  window.UnitConversionService = {
    convertToStrictUnit,
    toGrams,
    isLiquidIngredient,
    getIngredientDensity
  };
}
