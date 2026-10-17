/**
 * src/services/RecipeIngredientParser.js (v3.32.4)
 * Core ingredient string parsing, units, quantities, fractions, and taxonomy matching.
 */

import { getState } from '../store/store.js';
import { convertToStrictUnit } from './UnitConversionService.js';

export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
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
export function parseIngredientString(rawString) {
  if (!rawString || typeof rawString !== 'string') return null;
  const original = rawString.trim();
  if (!original) return null;

  // Check compound stock patterns
  const compoundStockMatch = original.match(
    /^(?:(\d+(?:\.\d+)?|\d+\s*\/\s*\d+|½|¼|¾|a|an|one|two|three|half)\s*)?(?:x\s*)?(?:(vegetable|chicken|beef|fish|lamb|vegan|mushroom|onion)\s+)?(?:stock\s*cubes?|cubes?\s*(?:of\s*)?stock|cubes?\s*(?:vegetable|chicken|beef|fish|lamb|vegan)?\s*stock)\s*(?:\+|\bin\b|,\s*dissolved\s+in\b|\bdissolved\s+in\b|\bmade\s+(?:up\s+)?(?:to\s+)?with\b|\bmixed\s+with\b)\s*([\s\S]*)$/i
  );

  if (compoundStockMatch) {
    const rawQty = compoundStockMatch[1] || '1';
    const { qty: parsedQty } = parseQuantity(rawQty);
    const stockType = compoundStockMatch[2] ? toTitleCase(compoundStockMatch[2]) : 'Vegetable';
    const name = `${stockType} Stock Cube`;
    const liquidPart = (compoundStockMatch[3] || '').trim();
    let notes = liquidPart;
    if (notes && !notes.toLowerCase().startsWith('in ') && !notes.toLowerCase().startsWith('with ') && !notes.toLowerCase().startsWith('dissolved')) {
      notes = `dissolved in ${notes}`;
    }
    const mlMatch = /(\d+)\s*(?:ml|millilitres|ml\b)/i.exec(liquidPart);
    const waterMl = mlMatch ? parseInt(mlMatch[1], 10) : 400;
    return {
      raw: original,
      qty: parsedQty || 1,
      unit: 'qty',
      name: toTitleCase(name),
      notes: notes,
      waterMl: waterMl,
      isFallbackWeight: false
    };
  }

  // Check composite package multipliers e.g. "2 x 280g blocks", "1 x pack (about 160g)", "1 x 400g tin"
  const multPattern = /^(\d+(?:\.\d+)?)\s*[xX]\s*(?:(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|oz|lb)\b\s*)?(?:(packs?|tins?|cans?|jars?|blocks?|pots?|boxes?)\s*(?:of\s*)?)?/i;
  const multMatch = original.match(multPattern);
  if (multMatch && multMatch[2] && multMatch[3]) {
    const packCount = parseFloat(multMatch[1]);
    const itemWeight = parseFloat(multMatch[2]);
    const unitStr = multMatch[3].toLowerCase();
    const totalQty = packCount * itemWeight;
    const remainder = original.replace(multMatch[0], '').trim();
    
    // Check if remainder or parenthetical contains alternate weight e.g. "(about 160g)"
    let parsedNotes = '';
    let parsedName = remainder;
    const parenMatch = parsedName.match(/^(.*?)\((.*?)\)(.*)$/);
    if (parenMatch) {
      parsedName = (parenMatch[1] + ' ' + parenMatch[3]).trim();
      parsedNotes = parenMatch[2].trim();
      const altWeightMatch = parsedNotes.match(/(?:about|approx\.?|approx)?\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb)\b/i);
      if (altWeightMatch) {
        // If parenthetical specifies an item weight like (about 160g) for a pack
        // Keep packCount * itemWeight or alt weight if appropriate. Here totalQty = packCount * itemWeight or altWeight
      }
    }

    parsedName = parsedName.replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '').trim();
    if (!parsedName || parsedName.toLowerCase() === 'x') {
      parsedName = 'Ingredient';
    }

    const strictUnit = normalizeUnit(unitStr);
    const converted = convertToStrictUnit(totalQty, strictUnit, parsedName);

    return {
      raw: original,
      qty: converted.qty,
      unit: converted.unit,
      name: toTitleCase(parsedName),
      notes: parsedNotes,
      isFallbackWeight: converted.isFallbackWeight
    };
  }

  const { qty, remainder } = parseQuantity(original);
  let unit = 'qty';
  let ingredientText = remainder;

  if (remainder) {
    const words = remainder.split(/\s+/);
    const firstWordClean = words[0].toLowerCase().replace(/[\.\,]/g, '');
    
    if (UNIT_MAP[firstWordClean]) {
      unit = UNIT_MAP[firstWordClean];
      ingredientText = words.slice(1).join(' ');
    } else if (words.length > 1) {
      const twoWordsClean = (words[0] + ' ' + words[1]).toLowerCase().replace(/[\.\,]/g, '');
      if (UNIT_MAP[twoWordsClean]) {
        unit = UNIT_MAP[twoWordsClean];
        ingredientText = words.slice(2).join(' ');
      }
    }
  }

  if (/^of\b/i.test(ingredientText.trim())) {
    ingredientText = ingredientText.trim().replace(/^of\b/i, '').trim();
  }

  let name = ingredientText;
  let notes = '';

  const parenMatch = name.match(/^(.*?)\((.*?)\)(.*)$/);
  if (parenMatch) {
    name = (parenMatch[1] + ' ' + parenMatch[3]).trim();
    notes = parenMatch[2].trim();
  }

  if (name.includes(',')) {
    const parts = name.split(',');
    name = parts[0].trim();
    const commaNotes = parts.slice(1).join(', ').trim();
    notes = notes ? `${notes}, ${commaNotes}` : commaNotes;
  }

  if (name.includes(' - ') || name.includes(' – ')) {
    const parts = name.split(/\s+[-–]\s+/);
    name = parts[0].trim();
    const dashNotes = parts.slice(1).join(' ').trim();
    notes = notes ? `${notes}, ${dashNotes}` : dashNotes;
  }

  const containerMatch = name.match(/^(cans?|tins?|blocks?|jars?|packs?|packets?|bottles?|heads?|stalks?|sachets?|tubs?|pots?|bags?|box(?:es)?)\s+(?:of\s+)?(.*)/i);
  if (containerMatch) {
    const descriptor = containerMatch[1].toLowerCase();
    name = containerMatch[2].trim();
    notes = notes ? `${descriptor}, ${notes}` : descriptor;
  }
  if (/^of\b/i.test(name.trim())) name = name.trim().replace(/^of\b/i, '').trim();

  const prepLeadMatch = name.match(/^(diced|sliced|chopped|minced|grated|crushed|peeled|cubed|drained|pressed|raw|fresh|organic)\s+(.*)/i);
  if (prepLeadMatch) {
    const prepWord = prepLeadMatch[1].toLowerCase();
    name = prepLeadMatch[2].trim();
    notes = notes ? `${prepWord}, ${notes}` : prepWord;
  }
  if (/^of\b/i.test(name.trim())) name = name.trim().replace(/^of\b/i, '').trim();

  name = name.replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '').trim();
  let cleanedName = name || original;

  if (/^(?:(vegetable|chicken|beef|fish|lamb|vegan|mushroom|onion)\s+)?stock\s*cubes?$/i.test(cleanedName)) {
    const typeMatch = cleanedName.match(/^(vegetable|chicken|beef|fish|lamb|vegan|mushroom|onion)\b/i);
    const stockType = typeMatch ? toTitleCase(typeMatch[1]) : 'Vegetable';
    cleanedName = `${stockType} Stock Cube`;
  }

  cleanedName = toTitleCase(cleanedName);

  // Apply strict unit conversion (g, ml, qty)
  const strict = convertToStrictUnit(qty, unit, cleanedName);

  return {
    raw: original,
    qty: strict.qty,
    unit: strict.unit,
    name: cleanedName,
    notes: notes.trim(),
    isFallbackWeight: strict.isFallbackWeight || false
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
  
  const rawNameLower = String(parsedItem.name || '').toLowerCase().trim();
  const stemmed = stemIngredientName(rawNameLower);

  let matchedIng = null;

  for (const ing of ingredients) {
    if (!ing) continue;
    const aliases = Array.isArray(ing.aliases) ? ing.aliases.map(a => String(a).toLowerCase().trim()) : [];
    if (aliases.includes(rawNameLower) || aliases.includes(stemmed) || aliases.some(a => rawNameLower.includes(a) || a.includes(rawNameLower))) {
      matchedIng = ing;
      break;
    }

    if (ing.name) {
      const ingNameLower = String(ing.name).toLowerCase().trim();
      const ingStemmed = stemIngredientName(ingNameLower);
      if (ingNameLower === rawNameLower || (stemmed && stemmed === ingStemmed) || ingNameLower.includes(stemmed) || stemmed.includes(ingNameLower)) {
        matchedIng = ing;
        break;
      }
    }
  }

  if (!matchedIng && stemmed.length > 3) {
    for (const ing of ingredients) {
      if (!ing || !ing.name) continue;
      const ingNameLower = String(ing.name).toLowerCase().trim();
      if (ingNameLower.includes(stemmed) || stemmed.includes(ingNameLower)) {
        matchedIng = ing;
        break;
      }
    }
  }

  if (matchedIng) {
    return {
      ...parsedItem,
      ingredientId: matchedIng.id,
      isNewTaxonomyItem: false,
      matchedName: matchedIng.name
    };
  }

  return {
    ...parsedItem,
    ingredientId: null,
    isNewTaxonomyItem: true
  };
}
