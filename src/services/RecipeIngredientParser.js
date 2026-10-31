/**
 * src/services/RecipeIngredientParser.js (v3.32.9)
 * Core ingredient string parsing, units, quantities, fractions, and taxonomy matching.
 */

import { getState } from '../store/store.js';
import { convertToStrictUnit } from './UnitConversionService.js';

export function toTitleCase(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

export const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5',
  '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8',
  '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
};

export const UNIT_MAP = {
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', mls: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbl: 'tbsp', tbs: 'tbsp', tb: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', t: 'tsp',
  cup: 'cup', cups: 'cup', clove: 'clove', cloves: 'clove', can: 'can', cans: 'can', tin: 'can', tins: 'can',
  pinch: 'pinch', pinches: 'pinch', block: 'block', blocks: 'block', slice: 'slice', slices: 'slice',
  handful: 'handful', handfuls: 'handful', bunch: 'bunch', bunches: 'bunch',
  pack: 'pack', packet: 'pack', packets: 'pack', package: 'pack', packages: 'pack', pkg: 'pack',
  head: 'head', heads: 'head', stalk: 'stalk', stalks: 'stalk', stick: 'stalk', sticks: 'stalk',
  sprig: 'sprig', sprigs: 'sprig', dash: 'dash', dashes: 'dash', drizzle: 'dash', splash: 'dash',
  drop: 'dash', drops: 'dash', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb'
};

/**
 * Normalizes unicode fractions and parses numeric quantity floats.
 */
export function parseQuantity(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return { qty: 1, remainder: '' };

  text = text.replace(/(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2');
  Object.keys(UNICODE_FRACTIONS).forEach(uf => {
    if (text.includes(uf)) {
      text = text.replace(new RegExp(uf, 'g'), UNICODE_FRACTIONS[uf]);
    }
  });

  // 1. Multiplier pattern with fraction: e.g. "2 x 1/2 wraps"
  const multFracMatch = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+)\/(\d+)\s*(.*)/);
  if (multFracMatch) {
    const m1 = parseFloat(multFracMatch[1]);
    const num = parseFloat(multFracMatch[2]);
    const den = parseFloat(multFracMatch[3]);
    const totalQty = den > 0 ? m1 * (num / den) : m1;
    return { qty: totalQty, remainder: multFracMatch[4].trim() };
  }

  // 2. Multiplier pattern with range e.g. "1 x 160-200g" or "2 x 150-200ml"
  const multRangeMatch = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)(.*)/i);
  if (multRangeMatch) {
    const m1 = parseFloat(multRangeMatch[1]);
    const r1 = parseFloat(multRangeMatch[2]);
    const r2 = parseFloat(multRangeMatch[3]);
    const avg = (r1 + r2) / 2;
    const unitStr = multRangeMatch[4];
    return { qty: m1 * avg, remainder: `${unitStr}${multRangeMatch[5]}`.trim() };
  }

  // 3. Multiplier pattern with unit e.g. "2 x 400g" or "2 x 150ml"
  const multMatch = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)(.*)/);
  if (multMatch) {
    const m1 = parseFloat(multMatch[1]);
    const m2 = parseFloat(multMatch[2]);
    const unitStr = multMatch[3];
    const totalQty = m1 * m2;
    return { qty: totalQty, remainder: `${unitStr}${multMatch[4]}`.trim() };
  }

  // 4. Multiplier with number only e.g. "2 x 2 wraps"
  const multNumOnlyMatch = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s+([a-zA-Z].*)/);
  if (multNumOnlyMatch) {
    const m1 = parseFloat(multNumOnlyMatch[1]);
    const m2 = parseFloat(multNumOnlyMatch[2]);
    return { qty: m1 * m2, remainder: multNumOnlyMatch[3].trim() };
  }

  // 5. Multiplier count only e.g. "4 x chicken breasts" or "1x lime"
  const countMultMatch = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(.*)/);
  if (countMultMatch && countMultMatch[2] && !/^\d/.test(countMultMatch[2])) {
    return { qty: parseFloat(countMultMatch[1]), remainder: countMultMatch[2].trim() };
  }

  // Range e.g. "3-4" or "3 to 4"
  const rangeMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)(.*)/i);
  if (rangeMatch) {
    const q1 = parseFloat(rangeMatch[1]);
    const q2 = parseFloat(rangeMatch[2]);
    const avg = (q1 + q2) / 2;
    return { qty: avg, remainder: rangeMatch[3].trim() };
  }

  // Mixed fraction e.g. "1 1/2"
  const mixedMatch = text.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    const qty = whole + (den > 0 ? num / den : 0);
    return { qty, remainder: mixedMatch[4].trim() };
  }

  // Simple fraction e.g. "1/2"
  const fracMatch = text.match(/^(\d+)\/(\d+)(.*)/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    const qty = den > 0 ? num / den : 1;
    return { qty, remainder: fracMatch[3].trim() };
  }

  // Decimal or integer e.g. "200"
  const numMatch = text.match(/^(\d+(?:\.\d+)?)(.*)/);
  if (numMatch) {
    return { qty: parseFloat(numMatch[1]), remainder: numMatch[2].trim() };
  }

  // Word quantities e.g. "one", "half"
  const wordMatch = text.match(/^(a|an|one|two|three|four|five|half)\b(.*)/i);
  if (wordMatch) {
    const w = wordMatch[1].toLowerCase();
    let qty = 1;
    if (w === 'two') qty = 2;
    else if (w === 'three') qty = 3;
    else if (w === 'four') qty = 4;
    else if (w === 'five') qty = 5;
    else if (w === 'half') qty = 0.5;
    return { qty, remainder: wordMatch[2].trim() };
  }

  return { qty: 1, remainder: text };
}

export function normalizeUnit(rawUnit) {
  if (!rawUnit) return 'qty';
  const clean = String(rawUnit).toLowerCase().trim().replace(/[\.\,]/g, '');
  return UNIT_MAP[clean] || 'qty';
}

/**
 * Parses raw ingredient string into structured quantity, unit, name, and notes,
 * then converts strictly into 'g', 'ml', or 'qty' via UnitConversionService.
 */
export function parseIngredientString(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const s = rawStr.trim();
  if (!s || /^(?:FOR THE\b|TO SERVE\b)/i.test(s)) return null;

  // Standalone multiplier guard: never allow orphaned multiplier rows
  if (/^\d+(?:\.\d+)?\s*[xX]$/.test(s)) return null;

  // Insert space between integer and unicode fraction: "1½" -> "1 ½"
  let clean = s.replace(/(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2');
  Object.keys(UNICODE_FRACTIONS).forEach(uf => {
    if (clean.includes(uf)) {
      clean = clean.replace(new RegExp(uf, 'g'), UNICODE_FRACTIONS[uf]);
    }
  });

  // 1. Loose measures without leading numbers e.g. "handful of parsley", "pinch of black pepper", "drizzle of olive oil"
  const looseMatch = clean.match(/^(?:a\s+)?(handful|handfuls|pinch|pinches|bunch|bunches|drizzle|drizzles|dash|dashes|splash|splashes)\s+(?:of\s+)?(.*)/i);
  if (looseMatch) {
    const u = looseMatch[1].toLowerCase();
    const rawName = looseMatch[2].trim();
    const normalised = convertToStrictUnit(1, u, rawName);
    return {
      raw: s,
      qty: normalised.qty,
      unit: normalised.unit,
      isEstimated: normalised.isEstimated,
      name: toTitleCase(rawName),
      notes: normalised.isEstimated ? 'Est. Weight' : ''
    };
  }

  // 2. Package multiplier with parenthetical weight e.g. "1 x pack plant-based chicken pieces (about 160g)"
  const parenMult = clean.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+(?:packs?|tins?|cans?|jars?|blocks?|pots?|boxes?)\s+(?:of\s+)?(.*?)\s*\((?:about|approx\.?)?\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\)/i);
  if (parenMult) {
    const mult = parseFloat(parenMult[1]) || 1;
    const innerWeight = parseFloat(parenMult[3]) || 0;
    const nameClean = parenMult[2].trim();
    const normalised = convertToStrictUnit(mult * innerWeight, parenMult[4], nameClean);
    return {
      raw: s,
      qty: normalised.qty,
      unit: normalised.unit,
      isEstimated: normalised.isEstimated,
      name: toTitleCase(nameClean),
      notes: normalised.isEstimated ? 'Est. Weight' : `${mult} pack (${innerWeight}${parenMult[4]})`
    };
  }

  // 3. Explicit unit multiplier e.g. "2 x 400g tins best-quality Italian chopped tomatoes", "1 x 280g tin jackfruit in water"
  const compMatch = clean.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|fl\s*oz|lbs?|pinch|cm)\b\s*(?:(?:packs?|tins?|cans?|jars?|blocks?|pots?|boxes?)\s*(?:of\s*)?)?(.*)/i);
  if (compMatch) {
    const multComp = parseFloat(compMatch[1]) || 1;
    const baseWeight = parseFloat(compMatch[2]) || 0;
    const rawName = (compMatch[4] || '').replace(/^(?:blocks?|packs?|tins?|cans?)\s*(?:of\s*)?/i, '').trim();
    const normalised = convertToStrictUnit(multComp * baseWeight, compMatch[3], rawName);
    return {
      raw: s,
      qty: normalised.qty,
      unit: normalised.unit,
      isEstimated: normalised.isEstimated,
      name: toTitleCase(rawName),
      notes: normalised.isEstimated ? 'Est. Weight' : `${multComp} x ${baseWeight}${compMatch[3]}`
    };
  }

  // 4. Standard parsed quantity with unit or count
  const { qty, remainder } = parseQuantity(clean);
  const unitMatch = remainder.match(/^([a-zA-Z]+)\b\s*(.*)/i);
  let parsedUnit = 'qty';
  let rawName = remainder;

  if (unitMatch) {
    const word = unitMatch[1].toLowerCase();
    if (UNIT_MAP[word]) {
      parsedUnit = UNIT_MAP[word];
      rawName = (unitMatch[2] || '').replace(/^(?:of\s+|tins?\s+(?:of\s+)?|cans?\s+(?:of\s+)?|packs?\s+(?:of\s+)?)/i, '').trim();
    }
  }

  const normalised = convertToStrictUnit(qty, parsedUnit, rawName);
  return {
    raw: s,
    qty: normalised.qty,
    unit: normalised.unit,
    isEstimated: normalised.isEstimated,
    name: toTitleCase(rawName || remainder),
    notes: normalised.isEstimated ? 'Est. Weight' : ''
  };
}

export function stemIngredientName(rawName) {
  if (!rawName) return '';
  let str = String(rawName).toLowerCase().trim();
  str = str.replace(/\b(cloves?|heads?|bulbs?|block|blocks|diced|sliced|chopped|minced|fresh|raw|organic)\b/g, '').trim();
  if (str.endsWith('ies')) str = str.slice(0, -3) + 'y';
  else if (str.endsWith('es')) str = str.slice(0, -2);
  else if (str.endsWith('s') && !str.endsWith('ss')) str = str.slice(0, -1);
  return str.trim();
}

/**
 * Cross-references parsed ingredient against existing Store items including aliases.
 */
export function matchIngredientTaxonomy(parsedItem, existingIngredients = null) {
  if (!parsedItem) return null;
  const storeState = (typeof getState === 'function') ? getState() : {};
  const ingredients = existingIngredients || storeState.ingredients || [];

  const rawClean = (parsedItem.name || '').toLowerCase().trim();
  const stemmed = stemIngredientName(rawClean);

  // 1. Direct Name Match
  const direct = ingredients.find(ing => (ing.name || '').toLowerCase().trim() === rawClean);
  if (direct) {
    return {
      ...parsedItem,
      ingredientId: direct.id,
      matchedName: direct.name,
      matchedCategory: direct.category || 'General',
      isNewTaxonomyItem: false
    };
  }

  // 2. Alias Match
  const aliasMatch = ingredients.find(ing => {
    if (!ing.aliases || !Array.isArray(ing.aliases)) return false;
    return ing.aliases.some(alias => {
      const aClean = alias.toLowerCase().trim();
      return aClean === rawClean || aClean === stemmed;
    });
  });

  if (aliasMatch) {
    return {
      ...parsedItem,
      ingredientId: aliasMatch.id,
      matchedName: aliasMatch.name,
      matchedCategory: aliasMatch.category || 'General',
      isNewTaxonomyItem: false
    };
  }

  // 3. Stemmed Match
  const stemmedMatch = ingredients.find(ing => {
    const ingStem = stemIngredientName(ing.name);
    return ingStem === stemmed || ingStem === rawClean;
  });

  if (stemmedMatch) {
    return {
      ...parsedItem,
      ingredientId: stemmedMatch.id,
      matchedName: stemmedMatch.name,
      matchedCategory: stemmedMatch.category || 'General',
      isNewTaxonomyItem: false
    };
  }

  // 4. Fallback: New Taxonomy Item
  return {
    ...parsedItem,
    ingredientId: null,
    matchedName: parsedItem.name,
    matchedCategory: 'Store Cupboard',
    isNewTaxonomyItem: true
  };
}
