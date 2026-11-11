/**
 * src/services/RecipeIngredientParser.js (v3.32.9)
 * Core ingredient string parsing, units, quantities, fractions, and taxonomy matching.
 */

import { getState } from '../store/store.js';
import { convertToStrictUnit } from './UnitConversionService.js';
import { toTitleCase } from '../utils/stringUtils.js';

export { toTitleCase };

function parseFractionOrNumber(val) {
  const s = String(val || '').trim();
  const m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return parseFloat(m[1]) + (parseFloat(m[3]) > 0 ? parseFloat(m[2]) / parseFloat(m[3]) : 0);
  const f = s.match(/^(\d+)\/(\d+)$/);
  if (f) return parseFloat(f[2]) > 0 ? parseFloat(f[1]) / parseFloat(f[2]) : 0;
  return parseFloat(s) || 0;
}

function extractServingQualifier(rawName) {
  const text = String(rawName || '').trim();
  const serveMatch = text.match(/(?:,\s*|\s*\()(?:\b(?:to\s+serve|for\s+serving|to\s+garnish|for\s+garnish|to\s+finish|for\s+finishing)\b)\)?$/i);
  if (serveMatch) {
    const cleaned = text.replace(/(?:,\s*|\s*\()(?:\b(?:to\s+serve|for\s+serving|to\s+garnish|for\s+garnish|to\s+finish|for\s+finishing)\b)\)?$/i, '').trim();
    return { name: cleaned, notes: 'to serve', isToServe: true };
  }
  return { name: text, notes: '', isToServe: false };
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
  sprig: 'sprig', sprigs: 'sprig', leaf: 'leaf', leaves: 'leaf', dash: 'dash', dashes: 'dash', drizzle: 'dash', splash: 'dash',
  drop: 'dash', drops: 'dash', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb'
};

/**
 * Normalizes unicode fractions and parses numeric quantity floats.
 */
export function parseQuantity(rawText) {
  let text = String(rawText || '').trim();
  if (!text) return { qty: 1, remainder: '' };

  // Strip leading bullets, asterisks, dashes, pluses, tildes, unicode bullets, and emojis
  text = text.replace(/^[\s*\-–—~•●◦▪▫▫️▪️+\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '');
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

  // Range with fractions, mixed numbers, or decimals e.g. "1/4 - 1/2", "1/4–1/2", "3-4", "1 1/2 to 2"
  const rangeMatch = text.match(/^((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*((?:\d+\s+)?\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)/i);
  if (rangeMatch) {
    const q1 = parseFractionOrNumber(rangeMatch[1]);
    const q2 = parseFractionOrNumber(rangeMatch[2]);
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
 * Returns true if the ingredient line represents standalone unmeasured salt and/or black/white pepper
 * (including "to taste", "for seasoning", or "a pinch/dash of"), while preserving explicit numeric
 * culinary measurements (e.g., "1 tsp salt", "1/2 tsp black pepper") and culinary peppers/blends
 * (e.g., "bell pepper", "garlic salt").
 */
function isImpliedSaltOrPepperLine(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return false;
  let text = rawStr.replace(/^[\s•●◦▪▫▫️▪️\-\*]+/, '').trim();
  if (!text) return false;

  // Preserve explicit numeric culinary measurements (e.g., "1 tsp salt", "1/2 tsp black pepper", "10g sea salt")
  const explicitUnitRegex = /^(?:\d+(?:\s+\d+\/\d+|\.\d+)?|\d+\/\d+|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|a|an|one|two|three|four|five|half)\s*(?:[xX×]\s*\d+(?:\.\d+)?\s*)?(?:(?:heaped|heaping|level|generous|scant|rounded)\s+)?(?:g|grams?|kg|kilograms?|mg|oz|ounces?|lbs?|pounds?|tsp|teaspoons?|tbsp|tablespoons?|tbl|tbs|tb|cups?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?)\b/i;
  if (explicitUnitRegex.test(text)) return false;

  // Strip optional parenthetical qualifiers and loose pinch/dash prefixes
  text = text
    .replace(/\((?:optional|to\s+taste|for\s+seasoning|for\s+serving|to\s+serve)\)/gi, ' ')
    .replace(/^(?:(?:\d+|a|an|one|two|good|generous|small|big|large)\s+)?(?:(?:pinch|pinches|dash|dashes|sprinkle|sprinkles|twist|twists|grind|grinds|crack|cracks)\s+(?:of\s+)?|little\s+|some\s+)/i, '')
    .replace(/\b(?:to\s+taste|for\s+seasoning|for\s+serving|to\s+serve|optional|as\s+needed|if\s+needed)\b/gi, ' ')
    .replace(/[&+/]/g, ' and ')
    .replace(/[,.;:!?*()]/g, ' ')
    .replace(/\b(?:sea|kosher|flaky|table|maldon|rock|fine|finely|coarse|coarsely|freshly|fresh|ground|cracked|milled|black|white|cooking)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return false;
  return /^(?:salt|pepper)(?:\s+(?:and|or)\s+(?:salt|pepper))*$/i.test(text);
}

/**
 * Parses raw ingredient string into structured quantity, unit, name, and notes,
 * then converts strictly into 'g', 'ml', or 'qty' via UnitConversionService.
 */
export function parseIngredientString(rawStr) {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const s = rawStr.trim();
  const unbulleted = s.replace(/^[\s*\-–—~•●◦▪▫▫️▪️+\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '');
  if (!unbulleted || /^(?:FOR THE\b|TO SERVE\b)/i.test(unbulleted)) return null;
  if (isImpliedSaltOrPepperLine(unbulleted)) return null;

  // Standalone multiplier guard: never allow orphaned multiplier rows
  if (/^\d+(?:\.\d+)?\s*[xX]$/.test(unbulleted)) return null;

  // Insert space between integer and unicode fraction: "1½" -> "1 ½"
  let clean = unbulleted.replace(/(\d+)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2');
  Object.keys(UNICODE_FRACTIONS).forEach(uf => {
    if (clean.includes(uf)) {
      clean = clean.replace(new RegExp(uf, 'g'), UNICODE_FRACTIONS[uf]);
    }
  });

  // 0. Compound stock cube + liquid patterns (e.g., "1 stock cube + 400ml water", "0.5 stock cube in 200ml boiling water", "1 chicken stock cube dissolved in 500ml water")
  const compoundStockMatch = clean.match(
    /^(?:(\d+(?:\.\d+)?|\d+\s*\/\s*\d+|a|an|one|two|three|half)\s*)?(?:x\s*)?(?:(vegetable|chicken|beef|fish|lamb|vegan|mushroom|onion)\s+)?(?:stock\s*cubes?|cubes?\s*(?:of\s*)?stock|cubes?\s*(?:vegetable|chicken|beef|fish|lamb|vegan)?\s*stock)\s*(?:\+|\bin\b|,\s*dissolved\s+in\b|\bdissolved\s+in\b|\bmade\s+(?:up\s+)?(?:to\s+)?with\b|\bmixed\s+with\b)\s*([\s\S]*)$/i
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
      raw: s,
      qty: parsedQty || 1,
      unit: 'qty',
      isEstimated: false,
      name: toTitleCase(name),
      notes,
      waterMl,
      isToServe: false
    };
  }

  // 1. Loose measures without leading numbers e.g. "handful of parsley", "pinch of black pepper", "drizzle of olive oil"
  const looseMatch = clean.match(/^(?:a\s+)?(handful|handfuls|pinch|pinches|bunch|bunches|drizzle|drizzles|dash|dashes|splash|splashes)\s+(?:of\s+)?(.*)/i);
  if (looseMatch) {
    const u = looseMatch[1].toLowerCase();
    const rawName = looseMatch[2].trim();
    const servingInfo = extractServingQualifier(rawName);
    const normalised = convertToStrictUnit(1, u, servingInfo.name);
    return {
      raw: s,
      qty: normalised.qty,
      unit: normalised.unit,
      isEstimated: normalised.isEstimated,
      name: toTitleCase(servingInfo.name),
      notes: servingInfo.notes,
      isToServe: servingInfo.isToServe
    };
  }

  // 2. Package multiplier with parenthetical weight e.g. "1 x pack plant-based chicken pieces (about 160g)"
  const parenMult = clean.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+(?:packs?|tins?|cans?|jars?|blocks?|pots?|boxes?)\s+(?:of\s+)?(.*?)\s*\((?:about|approx\.?)?\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\)/i);
  if (parenMult) {
    const mult = parseFloat(parenMult[1]) || 1;
    const innerWeight = parseFloat(parenMult[3]) || 0;
    const nameClean = parenMult[2].trim();
    const servingInfo = extractServingQualifier(nameClean);
    const normalised = convertToStrictUnit(mult * innerWeight, parenMult[4], servingInfo.name);
    const baseNotes = `${mult} pack (${innerWeight}${parenMult[4]})`;
    return {
      raw: s,
      qty: normalised.qty,
      unit: normalised.unit,
      isEstimated: normalised.isEstimated,
      name: toTitleCase(servingInfo.name),
      notes: servingInfo.isToServe ? `${baseNotes}, to serve` : baseNotes,
      isToServe: servingInfo.isToServe
    };
  }

  // 3. Explicit unit multiplier e.g. "2 x 400g tins best-quality Italian chopped tomatoes", "1 x 280g tin jackfruit in water"
  const compMatch = clean.match(/^(\d+(?:\.\d+)?)\s*[xX]\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tablespoons?|tsp|teaspoons?|cups?|oz|fl\s*oz|lbs?|pinch|cm)\b\s*(?:(?:packs?|tins?|cans?|jars?|blocks?|pots?|boxes?)\s*(?:of\s*)?)?(.*)/i);
  if (compMatch) {
    const multComp = parseFloat(compMatch[1]) || 1;
    const baseWeight = parseFloat(compMatch[2]) || 0;
    const rawName = (compMatch[4] || '').replace(/^(?:blocks?|packs?|tins?|cans?)\s*(?:of\s*)?/i, '').trim();
    const servingInfo = extractServingQualifier(rawName);
    const normalised = convertToStrictUnit(multComp * baseWeight, compMatch[3], servingInfo.name);
    const baseNotes = `${multComp} x ${baseWeight}${compMatch[3]}`;
    return {
      raw: s,
      qty: normalised.qty,
      unit: normalised.unit,
      isEstimated: normalised.isEstimated,
      name: toTitleCase(servingInfo.name),
      notes: servingInfo.isToServe ? `${baseNotes}, to serve` : baseNotes,
      isToServe: servingInfo.isToServe
    };
  }

  // 3.5. Dimensioned root/produce items e.g. "2.5cm piece of fresh ginger", "1 inch piece of ginger", "thumb-sized piece of ginger"
  const dimMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(cm|inch(?:es)?|in\.?)\s*(?:piece(?:\s+of)?|chunk(?:\s+of)?|slice(?:\s+of)?)?\s+(?:of\s+)?(.*)/i);
  const thumbMatch = !dimMatch && clean.match(/^(?:a\s+)?(\d+(?:\.\d+)?\s*)?(?:thumb(?:-sized)?(?:\s+piece)?)\s+(?:of\s+)?(.*)/i);

  if (dimMatch || thumbMatch) {
    let dimVal = 1;
    let dimUnit = 'cm';
    let rawName = '';

    if (dimMatch) {
      dimVal = parseFloat(dimMatch[1]) || 1;
      dimUnit = dimMatch[2].toLowerCase().startsWith('in') ? 'inch' : 'cm';
      rawName = dimMatch[3].trim();
    } else {
      const count = parseFloat(thumbMatch[1]) || 1;
      dimVal = count * 2.5; // 1 thumb ≈ 2.5cm / 1 inch
      dimUnit = 'cm';
      rawName = thumbMatch[2].trim();
    }

    const cmTotal = dimUnit === 'inch' ? dimVal * 2.54 : dimVal;
    // Standard culinary conversion for ginger, turmeric, galangal: 1 cm ≈ 5g (2.5cm / 1 inch ≈ 12.5g)
    const gramsPerCm = 5;
    const calculatedGrams = Math.round(cmTotal * gramsPerCm * 10) / 10;
    const cleanItemName = rawName.replace(/^(?:piece|chunk|slice)\s+(?:of\s+)?/i, '').trim();
    const servingInfo = extractServingQualifier(cleanItemName);
    const baseNotes = `${dimVal}${dimUnit} piece`;

    return {
      raw: s,
      qty: calculatedGrams,
      unit: 'g',
      isEstimated: true,
      name: toTitleCase(servingInfo.name),
      notes: servingInfo.isToServe ? `${baseNotes}, to serve` : baseNotes,
      isToServe: servingInfo.isToServe
    };
  }

  // 4. Standard parsed quantity with unit or count
  const { qty, remainder } = parseQuantity(clean);
  const cleanedRemainder = remainder.replace(/^(?:heaped|heaping|level|generous|scant|rounded)\s+/i, '');
  const unitMatch = cleanedRemainder.match(/^([a-zA-Z]+)\b\s*(.*)/i);
  let parsedUnit = 'qty';
  let rawName = remainder;

  if (unitMatch) {
    const word = unitMatch[1].toLowerCase();
    if (UNIT_MAP[word]) {
      parsedUnit = UNIT_MAP[word];
      rawName = (unitMatch[2] || '').replace(/^(?:of\s+|tins?\s+(?:of\s+)?|cans?\s+(?:of\s+)?|packs?\s+(?:of\s+)?)/i, '').trim();
    }
  }

  // Trailing measurement unit check e.g. "4 rosemary sprigs", "3 thyme sprigs", "2 large bay leaves", "4 garlic cloves"
  if (parsedUnit === 'qty') {
    const trailingUnitMatch = remainder.match(/^(.*?)\s+(sprigs?|leaves?|leaf|cloves?|slices?|stalks?|heads?|bulbs?)\b(?:\s+(?:of\s+)?(.*))?$/i);
    if (trailingUnitMatch) {
      const uWord = trailingUnitMatch[2].toLowerCase();
      if (UNIT_MAP[uWord]) {
        parsedUnit = UNIT_MAP[uWord];
        const prefix = trailingUnitMatch[1].trim();
        const suffix = (trailingUnitMatch[3] || '').trim();
        rawName = suffix ? `${prefix} ${suffix}`.trim() : prefix;
      }
    }
  }

  const servingInfo = extractServingQualifier(rawName || remainder);
  let cleanedName = servingInfo.name;
  let extraNotes = '';

  const parenMatch = cleanedName.match(/^(.*?)\((.*?)\)(.*)$/);
  if (parenMatch) {
    cleanedName = (parenMatch[1] + ' ' + parenMatch[3]).trim();
    extraNotes = parenMatch[2].trim();
  }

  if (cleanedName.includes(',')) {
    const parts = cleanedName.split(',');
    cleanedName = parts[0].trim();
    const commaNotes = parts.slice(1).join(', ').trim();
    extraNotes = extraNotes ? `${extraNotes}, ${commaNotes}` : commaNotes;
  }

  cleanedName = cleanedName.replace(/\*+/g, '').trim();
  cleanedName = cleanedName.replace(/^(?:a|an)\s+/i, '').trim();

  if (/^(?:(vegetable|chicken|beef|fish|lamb|vegan|mushroom|onion)\s+)?stock\s*cubes?$/i.test(cleanedName)) {
    const typeMatch = cleanedName.match(/^(vegetable|chicken|beef|fish|lamb|vegan|mushroom|onion)\b/i);
    const stockType = typeMatch ? toTitleCase(typeMatch[1]) : 'Vegetable';
    cleanedName = `${stockType} Stock Cube`;
  }

  const combinedNotes = [extraNotes, servingInfo.isToServe ? 'to serve' : ''].filter(Boolean).join(', ');
  const normalised = convertToStrictUnit(qty, parsedUnit, cleanedName);
  return {
    raw: s,
    qty: normalised.qty,
    unit: normalised.unit,
    isEstimated: normalised.isEstimated,
    name: toTitleCase(cleanedName),
    notes: combinedNotes,
    isToServe: servingInfo.isToServe
  };
}

export function normalizeTaxonomyName(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,\(\)\/\"\'\:\;\-\–\—\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function stemIngredientName(rawName) {
  if (!rawName) return '';
  let str = normalizeTaxonomyName(rawName).replace(/^\d+(?:\.\d+)?\s*(?:x\s*)?/, '').trim();
  str = str.replace(/\b(cloves?|heads?|bulbs?|stalks?|sprigs?|leaves?|leaf|pieces?|pots?|tins?|cans?|jars?|packs?|packet?|boxes?|blocks?|bottles?|bags?|diced|sliced|chopped|minced|grated|crushed|ground|shredded|pitted|peeled|cracked|parboiled|toasted|roasted|pressed|mashed|fresh|dried|dry|raw|cooked|frozen|boiled|organic|unsweetened|sweetened|salted|unsalted|extra virgin|best quality|good quality|pure|natural|plant based|plant-based|vegan|vegetarian|large|small|medium|thick|thin|finely|roughly|coarsely|to serve|for frying|for dusting|optional|garnish)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (str.endsWith('potatoes') || str.endsWith('tomatoes')) str = str.slice(0, -2);
  else if (str.endsWith('chillies')) str = str.slice(0, -3) + 'i';
  else if (str.endsWith('ies')) str = str.slice(0, -3) + 'y';
  else if (str.endsWith('es') && !str.endsWith('cheese')) str = str.slice(0, -2);
  else if (str.endsWith('s') && !str.endsWith('ss') && !str.endsWith('is') && !str.endsWith('us')) str = str.slice(0, -1);
  return str.trim();
}

/**
 * Strips quantities, units, and preparation notes from a raw ingredient string or parsed item
 * to produce a clean canonical phrase suitable for alias matching and learning.
 */
export function cleanIngredientPhraseForAlias(rawOrItem) {
  if (!rawOrItem) return '';
  if (typeof rawOrItem === 'object') {
    rawOrItem = rawOrItem.raw || rawOrItem.name || '';
  }
  const str = String(rawOrItem).trim();
  if (!str) return '';
  const parsed = parseIngredientString(str);
  if (parsed && parsed.name) {
    return normalizeTaxonomyName(parsed.name);
  }
  const fallback = str
    .replace(/^[\d\s\/\.\-\u00BC-\u00BE\u2150-\u215E]+(?:x\s*)?(?:g|kg|ml|l|oz|lb|tbsp|tsp|cup|cups|scoop|scoops|pinch|can|cans|tin|tins|clove|cloves|slice|slices|pack|packs|bunch|bunches)?\s+(?:of\s+)?/i, '')
    .split(',')[0]
    .replace(/\(.*?\)/g, '')
    .trim();
  return normalizeTaxonomyName(fallback || str);
}

export const CANONICAL_COMPOUND_SYNONYMS = {
  'coconut rice': 'jasmine rice',
  'thai coconut rice': 'jasmine rice',
  'curry rice': 'jasmine rice',
  'garlic rice': 'jasmine rice'
};

/**
 * Cross-references parsed ingredient against existing Store items including aliases and subtypes.
 */
export function matchIngredientTaxonomy(parsedItem, existingIngredients = null) {
  if (!parsedItem) return null;
  const storeState = (typeof getState === 'function') ? getState() : {};
  const ingredients = (existingIngredients && existingIngredients.length) ? existingIngredients : (storeState.rootItems || storeState.ingredients || []);
  const rawClean = (parsedItem.name || '').toLowerCase().trim();
  const targetClean = CANONICAL_COMPOUND_SYNONYMS[rawClean] || rawClean;
  const normParsed = normalizeTaxonomyName(targetClean);
  const stemmedParsed = stemIngredientName(targetClean);
  const cleanedRawPhrase = parsedItem.raw ? cleanIngredientPhraseForAlias(parsedItem.raw) : '';
  const stemmedRawPhrase = cleanedRawPhrase ? stemIngredientName(cleanedRawPhrase) : '';

  let bestMatch = null, bestScore = 0;

  const matchesAliasCandidate = (aliasStr) => {
    if (!aliasStr) return 0;
    const normAl = normalizeTaxonomyName(aliasStr);
    const cleanedAl = cleanIngredientPhraseForAlias(aliasStr);
    const stemmedAl = stemIngredientName(cleanedAl || normAl);
    if (!normAl && !stemmedAl) return 0;

    if (
      (normAl && (normParsed === normAl || stemmedParsed === normAl || (cleanedRawPhrase && cleanedRawPhrase === normAl))) ||
      (cleanedAl && (normParsed === cleanedAl || stemmedParsed === cleanedAl || (cleanedRawPhrase && cleanedRawPhrase === cleanedAl))) ||
      (stemmedAl && (stemmedParsed === stemmedAl || normParsed === stemmedAl || (stemmedRawPhrase && stemmedRawPhrase === stemmedAl)))
    ) {
      return 1; // exact or stemmed match
    }

    const tokenTarget = stemmedAl || cleanedAl || normAl;
    if (tokenTarget.length >= 3 && normParsed.length >= 3) {
      const escapedAl = tokenTarget.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regexAlInParsed = new RegExp('(^|\\s)' + escapedAl + '(?:s|es)?(\\s|$)', 'i');
      if (regexAlInParsed.test(normParsed) || regexAlInParsed.test(stemmedParsed)) {
        return 2; // alias contained in parsed phrase
      }
      const escapedParsed = (stemmedParsed || normParsed).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (escapedParsed.length >= 3) {
        const regexParsedInAl = new RegExp('(^|\\s)' + escapedParsed + '(?:s|es)?(\\s|$)', 'i');
        if (regexParsedInAl.test(tokenTarget) || regexParsedInAl.test(normAl)) {
          return 3; // parsed phrase contained in multi-word alias
        }
      }
    }
    return 0;
  };

  for (const ing of ingredients) {
    if (!ing) continue;
    const ingName = (ing.name || '').trim();
    const normIng = normalizeTaxonomyName(ingName), stemmedIng = stemIngredientName(ingName);

    if (normIng && normParsed === normIng) {
      return { ...parsedItem, ingredientId: ing.id, subtypeId: null, matchedName: ing.name, matchedCategory: ing.category || 'General', isNewTaxonomyItem: false };
    }

    const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    for (const sub of subtypes) {
      const normSub = normalizeTaxonomyName(sub.name);
      if (normSub && normParsed === normSub) {
        return { ...parsedItem, ingredientId: ing.id, subtypeId: sub.id || sub.name, matchedName: `${sub.name} (${ing.name})`, matchedCategory: ing.category || 'General', isNewTaxonomyItem: false };
      }
    }

    (Array.isArray(ing.aliases) ? ing.aliases : []).forEach(al => {
      const mType = matchesAliasCandidate(al);
      if (mType === 1 && bestScore < 95) {
        bestScore = 95; bestMatch = { ing, subtype: null, name: ing.name };
      } else if (mType >= 2 && bestScore < 85) {
        bestScore = 85; bestMatch = { ing, subtype: null, name: ing.name };
      }
    });

    for (const sub of subtypes) {
      const normSub = normalizeTaxonomyName(sub.name), stemmedSub = stemIngredientName(sub.name);
      if (stemmedSub && (stemmedParsed === stemmedSub || normParsed === stemmedSub) && bestScore < 90) {
        bestScore = 90; bestMatch = { ing, subtype: sub, name: `${sub.name} (${ing.name})` };
      }
      (Array.isArray(sub.aliases) ? sub.aliases : []).forEach(sal => {
        const mType = matchesAliasCandidate(sal);
        if (mType === 1 && bestScore < 96) {
          bestScore = 96; bestMatch = { ing, subtype: sub, name: `${sub.name} (${ing.name})` };
        } else if (mType >= 2 && bestScore < 87) {
          bestScore = 87; bestMatch = { ing, subtype: sub, name: `${sub.name} (${ing.name})` };
        }
      });
    }

    if (stemmedIng && (stemmedParsed === stemmedIng || normParsed === stemmedIng) && bestScore < 88) {
      bestScore = 88; bestMatch = { ing, subtype: null, name: ing.name };
    }

    for (const sub of subtypes) {
      const normSub = normalizeTaxonomyName(sub.name);
      if (normSub.length >= 3) {
        const regex = new RegExp('(^|\\s)' + normSub.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:s|es)?(\\s|$)', 'i');
        if ((regex.test(normParsed) || regex.test(stemmedParsed)) && (75 + normSub.length > bestScore)) {
          bestScore = 75 + normSub.length; bestMatch = { ing, subtype: sub, name: `${sub.name} (${ing.name})` };
        }
      }
    }

    if (normIng.length >= 3) {
      const regex = new RegExp('(^|\\s)' + normIng.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:s|es)?(\\s|$)', 'i');
      if ((regex.test(normParsed) || regex.test(stemmedParsed)) && (70 + normIng.length > bestScore)) {
        bestScore = 70 + normIng.length; bestMatch = { ing, subtype: null, name: ing.name };
      } else if (normParsed.length >= 3) {
        const pRegex = new RegExp('(^|\\s)' + normParsed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:s|es)?(\\s|$)', 'i');
        if (pRegex.test(normIng) && (65 + normParsed.length > bestScore)) {
          bestScore = 65 + normParsed.length; bestMatch = { ing, subtype: null, name: ing.name };
        }
      }
    }
  }

  if (bestMatch && bestScore >= 65) {
    return { ...parsedItem, ingredientId: bestMatch.ing.id, subtypeId: bestMatch.subtype?.id || bestMatch.subtype?.name || null, matchedName: bestMatch.name, matchedCategory: bestMatch.ing.category || 'General', isNewTaxonomyItem: false };
  }

  return { ...parsedItem, ingredientId: null, subtypeId: null, matchedName: parsedItem.name, matchedCategory: 'Store Cupboard', isNewTaxonomyItem: true };
}
