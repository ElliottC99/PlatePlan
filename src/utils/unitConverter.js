/**
 * src/utils/unitConverter.js
 * Culinary measurement helpers and the ingredient text parsing regex engine.
 * Unit conversion itself lives in src/services/UnitConversionService.js.
 * Quarantined from page DOM queries and UI mutations.
 */

import { convertToStrictUnit, toGrams, isLiquidIngredient } from '../services/UnitConversionService.js';

export function isLikelyLiquidIngredientName(name) {
  return isLiquidIngredient(name);
}

export function isLikelyCountableIngredientName(name) {
  const text = String(name || '').toLowerCase();
  if (/gnocchi|rice|pasta|noodle|noodles|grain|grains|couscous|bulgur|orzo|flour|sugar|salt|seasoning|spice|spices|herb|herbs|ground|powder|flakes|paprika|cumin|coriander|nutmeg|oregano|parsley|basil|thyme|rosemary|peppercorn|black pepper|white pepper|oil|vinegar|sauce|pesto|paste|chutney|honey|syrup/.test(text)) return false;
  if (/\bchilli\b/.test(text) && !/fresh|red|green|jalapeno|jalapeño|pepper/.test(text)) return false;
  if (/\bpepper\b/.test(text) && /black|white|ground|cracked|corn/.test(text)) return false;
  if (/\b(each|per item|per serving)\b/.test(text)) return true;
  if (/\b\d+\s*[x×]\s*\d+(?:\.\d+)?\s*(g|kg|ml|l)\b/.test(text)) return true;
  if (/\b\d+\s*(pack|packs|burger|burgers|sausage|sausages|roll|rolls|bun|buns|wrap|wraps|tortilla|tortillas|egg|eggs|fillet|fillets)\b/.test(text)) return true;
  return /garlic|clove|egg|avocado|potato|sweet potato|onion|\bpepper\b|\bchilli\b|lime|lemon|mango|burger|sausage|wrap|tortilla|bun|roll|bagel|fillet|slice|piece|block|ball/.test(text);
}

export function normaliseUnicodeFractions(text) {
  const map = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  return String(text || '').replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, m => map[m] || m);
}

export function parseRecipeNumber(value) {
  const text = normaliseUnicodeFractions(value).trim();
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseFloat(mixed[1]) + (parseFloat(mixed[2]) / parseFloat(mixed[3]));
  const glued = text.match(/^(\d+)(\d)\/(\d+)$/);
  if (glued) return parseFloat(glued[1]) + (parseFloat(glued[2]) / parseFloat(glued[3]));
  const frac = text.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
  return parseFloat(text);
}

export function normaliseLeadingQuantity(raw) {
  let line = normaliseUnicodeFractions(raw)
    .replace(/^(\d+)\s+(\d+)\/(\d+)/, (m, whole, num, den) => String(parseFloat(whole) + (parseFloat(num) / parseFloat(den))))
    .replace(/^(\d+)(\d)\/(\d+)/, (m, whole, num, den) => String(parseFloat(whole) + (parseFloat(num) / parseFloat(den))))
    .replace(/^(\d+)\/(\d+)/, (m, num, den) => String(parseFloat(num) / parseFloat(den)));
  return line.replace(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)(?=\s*[a-zA-Z])/, '$2');
}

export function cleanIngredientLinePrefix(raw) {
  let line = String(raw || '').replace(/\u00a0/g, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').trim();
  let prev = '';
  while (line && line !== prev) {
    prev = line;
    line = line
      .replace(/^\s*-\s+/, '')
      .replace(/^(?:[*•‣⁃∙·▪▫◦●○■□☐☑☒✓✔]+)\s*/u, '')
      .replace(/^(?:✅|☑️|✔️|✓|🔸|🔹|👉|➡️|➜|⭐|🍽️|🥣|🥘|🧂|🧄|🧅|🥔|🥕|🌶️|🍅|🧀|🥚|🍋|🥑|🍗|🥩|🥦)\s*/u, '')
      .replace(/^(?:[0-9#*]\ufe0f?\u20e3|[①②③④⑤⑥⑦⑧⑨⑩])\s*/u, '')
      .replace(/^(?:\[[ xX✓✔]?\]|\([ xX✓✔]?\))\s*/u, '')
      .replace(/^(?:\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[\.)]\s+(?=\S)/u, '')
      .replace(/^Step\s+\d+[\.:)\-]\s*/i, '')
      .trim();
  }
  return line;
}

export function splitPastedIngredientText(text) {
  let norm = String(text || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ')
    .replace(/(?:^|\n)\s*-\s+/g, '\n- ')
    .replace(/([0-9#*]\ufe0f?\u20e3|[①②③④⑤⑥⑦⑧⑨⑩]|[*•‣⁃∙·▪▫◦●○■□☐☑☒✓✔]|✅|☑️|✔️|✓|🔸|🔹|👉|➡️|➜|⭐|🍽️|🥣|🥘|🧂|🧄|🧅|🥔|🥕|🌶️|🍅|🧀|🥚|🍋|🥑|🍗|🥩|🥦)\s*/gu, '\n$1 ')
    .replace(/;\s*/g, '\n');
  norm = norm.replace(/(?<!(?:\b\d+|\bone|\btwo|\bthree|\bfour)\s*[x×])\s+(?=(?:\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(?:g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|pack|packs|block|blocks|pot|pots|jar|jars|bottle|bottles|oz|ounces?|lbs?|pounds?|fl\.?\s*oz\.?|x\b|×\b|qty\b|each\b))/gi, '\n');
  return norm.split(/\n+/).map(cleanIngredientLinePrefix).filter(Boolean);
}

export function inferParsedUnitForIngredient(ing) {
  const unit = (ing?.unit || '').toLowerCase().replace(/s$/, '');
  const name = ing?.name || ing?.raw || '';
  if (unit === 'g' || unit === 'kg') return 'g';
  if (unit === 'ml' || unit === 'l') return 'ml';
  if (unit === 'qty') return 'qty';
  if (['clove', 'head', 'bulb', 'slice', 'piece', 'stalk', 'sprig', 'leaf'].includes(unit)) return 'qty';
  if (['tsp', 'tbsp', 'cup'].includes(unit)) return isLikelyLiquidIngredientName(name) ? 'ml' : 'g';
  if (ing?.isStock) return 'qty';
  if (isLikelyLiquidIngredientName(name)) return 'ml';
  if (isLikelyCountableIngredientName(name)) return 'qty';
  return unit || 'g';
}

export function normaliseRecipeAmountForUi(ing = {}) {
  const name = ing.name || ing.raw || '';
  let qty = parseFloat(ing.qty);
  if (!isFinite(qty)) qty = 1;
  const unit = (ing.unit || '').toLowerCase().replace(/s$/, '') || inferParsedUnitForIngredient(ing);
  // Stored amounts are already g, ml or qty; return them untouched so saving never rewrites them.
  if (unit === 'g' || unit === 'ml' || unit === 'qty') return { qty, unit };
  const strict = convertToStrictUnit(qty, unit, name);
  return { qty: strict.qty, unit: strict.unit };
}

export function parseIngredientLine(raw) {
  let line = cleanIngredientLinePrefix(raw).replace(/^\xad\s*/, '').trim();
  if (!line) return null;

  line = normaliseLeadingQuantity(line);
  let parsed = null;

  // 1. Multiplier with sub-quantity, e.g. "1 x 450g firm tofu", "2 x 400g tins chickpeas"
  const multiWithSub = line.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|pack|packs|block|blocks|pot|pots|jar|jars|bottle|bottles|oz|ounces?|lbs?|pounds?|fl\.?\s*oz\.?)?\s*(?:of\s+)?(?:tins?|cans?|packs?|blocks?|pots?|jars?|bottles?|of\s+)?(.+)$/i);
  if (multiWithSub) {
    const count = parseFloat(multiWithSub[1]);
    const subQty = parseFloat(multiWithSub[2]);
    let rawUnit = (multiWithSub[3] || 'g').toLowerCase().replace(/s$/, '');
    if (rawUnit === 'tin' || rawUnit === 'can') rawUnit = 'tin';
    if (['pack', 'block', 'pot', 'jar', 'bottle'].includes(rawUnit)) rawUnit = 'g';
    const totalQty = count * subQty;
    const name = multiWithSub[4].replace(/\s*\(.*?\)\s*/g, '').trim();
    parsed = { raw: line, qty: totalQty, unit: rawUnit, name };
  }

  // 2. Multiplier without sub-quantity, e.g. "1 x red onion", "2 x tins chickpeas"
  if (!parsed) {
    const multiSimple = line.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)\s*(?:of\s+)?(?:tins?|cans?|packs?|blocks?|pots?|jars?|bottles?|of\s+)?(.+)$/i);
    if (multiSimple) {
      const count = parseFloat(multiSimple[1]);
      const remainder = multiSimple[2].trim();
      const discreteMatch = remainder.match(/^(clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|tin|tins|can|cans)\s+(?:of\s+)?(.+)$/i);
      if (discreteMatch) {
        let dUnit = discreteMatch[1].toLowerCase().replace(/s$/, '');
        if (dUnit === 'tin' || dUnit === 'can') dUnit = 'tin';
        const dName = discreteMatch[2].replace(/\s*\(.*?\)\s*/g, '').trim();
        parsed = { raw: line, qty: count, unit: dUnit, name: dName };
      } else {
        const name = remainder.replace(/\s*\(.*?\)\s*/g, '').trim();
        parsed = { raw: line, qty: count, unit: 'qty', name };
      }
    }
  }

  // 3. Standard quantity + unit matching
  if (!parsed) {
    const m = line.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|oz|ounces?|lbs?|pounds?|fl\.?\s*oz\.?)s?\s+(?:of\s+)?(.+)$/i);
    if (m) {
      const qty = parseFloat(m[1]);
      let unit = m[2].toLowerCase().replace(/s$/, '');
      if (unit === 'tin' || unit === 'can') unit = 'tin';
      if (unit === 'bulb' || unit === 'head') unit = 'head';
      const name = m[3].replace(/\s*\(.*?\)\s*/g, '').trim();
      parsed = { raw: line, qty, unit, name };
    } else {
      const m2 = line.match(/^(handful|bunch|pinch|dash|sprig)s?\s+(?:of\s+)?(.+)$/i);
      if (m2) {
        const unit = m2[1].toLowerCase();
        const name = m2[2].replace(/\s*\(.*?\)\s*/g, '').trim();
        parsed = { raw: line, qty: 1, unit, name };
      } else {
        const m3 = line.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)\s+(.+)$/i);
        if (m3) {
          parsed = { raw: line, qty: parseFloat(m3[1]), unit: m3[2].toLowerCase(), name: m3[3].replace(/\s*\(.*?\)\s*/g, '').trim() };
        } else {
          const m4 = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
          if (m4) {
            parsed = { raw: line, qty: parseFloat(m4[1]), unit: 'qty', name: m4[2].replace(/\s*\(.*?\)\s*/g, '').trim() };
          } else {
            parsed = { raw: line, qty: 1, unit: 'qty', name: line.replace(/\s*\(.*?\)\s*/g, '').trim() || line };
          }
        }
      }
    }
  }

  const { qty, unit, name } = parsed;
  const strict = convertToStrictUnit(qty, unit, name);
  return { raw: line, qty: strict.qty, unit: strict.unit, name, grams: toGrams(qty, unit, name) };
}

export function formatGarlicQuantity(ingredient, weightG) {
  const isFreshGarlic = ingredient.id === 'garlic_fresh' || 
                        String(ingredient.name || '').trim().toLowerCase() === 'garlic';
  
  if (isFreshGarlic) {
    const cloves = Math.round(weightG / 6.0);
    const count = cloves < 1 ? 1 : cloves;
    return `${count} ${count === 1 ? 'clove' : 'cloves'} of garlic`;
  }
  return `${weightG}g ${ingredient.name}`;
}

export function checkStockCubeWaterRequirement(ingredient) {
  if (!ingredient) return { requiresWaterInput: false };
  const subType = String(ingredient.subType || ingredient.subtype || '').toLowerCase();
  const name = String(ingredient.name || ingredient.ingredientName || '').toLowerCase();
  const isStockCube = subType.includes('stock cube') || subType.includes('stock') || name.includes('stock cube') || name.includes('stock pot');
  if (isStockCube) {
    return {
      requiresWaterInput: true,
      defaultWaterMlPerCube: 400
    };
  }
  return { requiresWaterInput: false };
}



