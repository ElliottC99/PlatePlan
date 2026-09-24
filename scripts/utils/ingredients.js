/**
 * scripts/utils/ingredients.js
 * PlatePlan Ingredient Parsing & Fuzzy Matching Engine
 * Classic global namespace script.
 */

(() => {
const normaliseUnicodeFractions = (text) => {
  const map = {'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
  return String(text || '').replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, m => map[m] || m);
};

const parseRecipeNumber = (value) => {
  const text = normaliseUnicodeFractions(value).trim();
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseFloat(mixed[1]) + (parseFloat(mixed[2]) / parseFloat(mixed[3]));
  const glued = text.match(/^(\d+)(\d)\/(\d+)$/);
  if (glued) return parseFloat(glued[1]) + (parseFloat(glued[2]) / parseFloat(glued[3]));
  const frac = text.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseFloat(frac[1]) / parseFloat(frac[2]);
  return parseFloat(text);
};

const normaliseLeadingQuantity = (raw) => {
  let line = normaliseUnicodeFractions(raw)
    .replace(/^(\d+)\s+(\d+)\/(\d+)/, (m, whole, num, den) => String(parseFloat(whole) + (parseFloat(num) / parseFloat(den))))
    .replace(/^(\d+)(\d)\/(\d+)/, (m, whole, num, den) => String(parseFloat(whole) + (parseFloat(num) / parseFloat(den))))
    .replace(/^(\d+)\/(\d+)/, (m, num, den) => String(parseFloat(num) / parseFloat(den)));
  line = line.replace(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)(?=\s*[a-zA-Z])/, '$2');
  return line;
};

const cleanIngredientLinePrefix = (raw) => {
  let line = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim();

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
};

const splitPastedIngredientText = (text) => {
  let normalised = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/(?:^|\n)\s*-\s+/g, '\n- ')
    .replace(/([0-9#*]\ufe0f?\u20e3|[①②③④⑤⑥⑦⑧⑨⑩]|[*•‣⁃∙·▪▫◦●○■□☐☑☒✓✔]|✅|☑️|✔️|✓|🔸|🔹|👉|➡️|➜|⭐|🍽️|🥣|🥘|🧂|🧄|🧅|🥔|🥕|🌶️|🍅|🧀|🥚|🍋|🥑|🍗|🥩|🥦)\s*/gu, '\n$1 ')
    .replace(/;\s*/g, '\n');
  
  normalised = normalised.replace(/(?<!(?:\b\d+|\bone|\btwo|\bthree|\bfour)\s*[x×])\s+(?=(?:\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(?:g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|pack|packs|block|blocks|pot|pots|jar|jars|bottle|bottles|oz|ounces?|lbs?|pounds?|fl\.?\s*oz\.?|x\b|×\b|qty\b|each\b))/gi, '\n');
  return normalised.split(/\n+/).map(cleanIngredientLinePrefix).filter(Boolean);
};

const getIngredientSectionHeading = (line) => {
  const cleaned = cleanIngredientLinePrefix(line || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const noColon = cleaned.replace(/[:：]\s*$/, '').trim();
  if (!noColon) return '';
  if (/^(?:for|to serve|for serving)\b/i.test(noColon) && noColon.length <= 60) {
    return (typeof window !== 'undefined' && typeof window.toTitleCase === 'function') ? window.toTitleCase(noColon) : noColon;
  }
  const hasQty = /^(?:\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞])\s*(?:g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|x\b|×\b|qty\b|each\b)/i.test(noColon);
  const looksLikeHeading = /[:：]\s*$/.test(cleaned) && !hasQty && noColon.split(/\s+/).length <= 7;
  return looksLikeHeading ? ((typeof window !== 'undefined' && typeof window.toTitleCase === 'function') ? window.toTitleCase(noColon) : noColon) : '';
};

const splitPastedIngredientSections = (text) => {
  const rows = splitPastedIngredientText(text);
  const out = [];
  let section = '';
  rows.forEach(row => {
    const heading = getIngredientSectionHeading(row);
    if (heading) {
      section = heading;
      return;
    }
    out.push({ line: row, section });
  });
  return out;
};

const splitPastedMethodText = (text) => {
  let normalised = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/([0-9#*]\ufe0f?\u20e3|[①②③④⑤⑥⑦⑧⑨⑩])\s*/gu, '\n$1 ')
    .replace(/\s+(?=(?:Step\s+)?\d+[\.)]\s+[A-Z])/g, '\n');
  return normalised.split(/\n+/).map(l => cleanIngredientLinePrefix(l).trim()).filter(Boolean);
};

const escapeRegex = (string) => {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
const ppEscapeRegex = (string) => escapeRegex(string);

const convertMethodQuantitiesToPercentages = (steps, parsedIngs = []) => {
  if (!Array.isArray(steps)) return [];
  try {
    const ings = (parsedIngs || []).map(ing => {
      const rawName = (ing.name || ing.raw || '').toLowerCase().trim();
      const baseName = rawName.replace(/\b(diced|chopped|sliced|grated|minced|crushed|peeled|firm|extra firm|fresh|dried|tinned|canned|organic|ground|whole|half|halved)\b/g, '').replace(/\s+/g, ' ').trim();
      const grams = +ing.grams || (['g','ml'].includes(ing.unit) ? +ing.qty : 0);
      const qty = +ing.qty || 0;
      const unit = ing.unit || 'g';
      return { raw: ing.raw, name: ing.name, rawName, baseName, grams, qty, unit };
    }).filter(i => i.name && (i.grams > 0 || i.qty > 0));

    return steps.map(step => {
      let text = String(step || '');
      ings.forEach(ing => {
        const base = ing.baseName || ing.rawName;
        const singular = base.replace(/s$/, '');
        const plural = base.endsWith('s') ? base : base + 's';
        const searchTerms = [...new Set([ing.rawName, (ing.name || '').toLowerCase(), base, singular, plural])]
          .filter(t => t && t.length >= 3);
        if (!searchTerms.length) return;

        const termPattern = searchTerms.map(escapeRegex).join('|');
        const unitOptions = 'g|kg|ml|l|tbsp|tablespoons?|tsp|teaspoons?|cups?|tins?|cans?|cloves?|slices?|pieces?|oz|ounces?|lbs?|pounds?|fl\\.?\\s*oz\\.?';
        const qtyPattern = new RegExp(`(?<!\\b(?:at|to|heat to|gas mark|for|in|about)\\s+)(?:(\\d+(?:\\.\\d+)?)\\s*(${unitOptions})?\\s+(?:of\\s+)?(?:the\\s+)?(${termPattern}))`, 'gi');

        text = text.replace(qtyPattern, (match, amountStr, unitStr, ingMention) => {
          const amount = parseFloat(amountStr);
          if (isNaN(amount) || amount <= 0) return match;

          let amountInGrams = amount;
          const u = (unitStr || '').toLowerCase().replace(/s$/, '');
          if (u === 'kg') amountInGrams = amount * 1000;
          else if (u === 'l') amountInGrams = amount * 1000;
          else if (u === 'tbsp' || u === 'tablespoon') amountInGrams = amount * 15;
          else if (u === 'tsp' || u === 'teaspoon') amountInGrams = amount * 5;
          else if (u === 'oz' || u === 'ounce') amountInGrams = amount * 28.35;
          else if (u === 'lb' || u === 'pound') amountInGrams = amount * 453.6;
          else if (u === 'cup') amountInGrams = amount * 240;
          else if (u === 'fl oz' || u === 'floz' || u === 'fl. oz') amountInGrams = amount * 30;

          const toGramsFn = window.toGrams || ((q, un) => q * 100);
          const totalGrams = ing.grams || toGramsFn(ing.qty, ing.unit);

          if (totalGrams > 0 && amountInGrams > 0 && unitStr) {
            const ratio = amountInGrams / totalGrams;
            let pct = Math.round(ratio * 100);
            if (pct > 100) pct = 100;
            if (pct < 1) pct = 1;
            return `${pct}% of the ${ingMention}`;
          } else if (ing.qty > 0) {
            const ratio = amount / ing.qty;
            let pct = Math.round(ratio * 100);
            if (pct > 100) pct = 100;
            if (pct < 1) pct = 1;
            return `${pct}% of the ${ingMention}`;
          }
          return match;
        });
      });
      return text;
    });
  } catch (e) {
    console.warn('Error converting method quantities to percentages:', e);
    return steps;
  }
};

const detectStockIngredient = (raw) => {
  const text = String(raw || '').toLowerCase();
  if (!/\bstock\b/.test(text) || !/\b(vegetable|veg|chicken|beef|stock)\b/.test(text)) return null;
  const waterMatch = text.match(/(\d+(?:\.\d+)?)\s*(ml|l)\s+(?:of\s+)?(?:vegetable\s+|veg\s+|chicken\s+|beef\s+)?stock\b/) || text.match(/\b(?:stock|water)\b.*?(\d+(?:\.\d+)?)\s*(ml|l)\b/);
  const cubeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:stock\s*)?(cube|cubes|pot|pots)\b/) || text.match(/\bwith\s+(\d+(?:\.\d+)?)\s*(?:cube|cubes|pot|pots)\b/);
  const waterMl = waterMatch ? Math.round(parseFloat(waterMatch[1]) * (waterMatch[2] === 'l' ? 1000 : 1)) : null;
  const cubeQty = cubeMatch ? parseFloat(cubeMatch[1]) : (waterMl ? Math.max(1, Math.round((waterMl / 500) * 10) / 10) : null);
  if (!waterMl && !cubeQty) return null;
  const stockType = /\bbeef\b/.test(text) ? 'Beef Stock Cubes' : /\bchicken\b/.test(text) ? 'Chicken Stock Cubes' : 'Vegetable Stock Cubes';
  const toGramsFn = window.toGrams || ((q, un) => q * 100);
  return {
    raw: cleanIngredientLinePrefix(raw),
    qty: cubeQty || 1,
    unit: 'qty',
    name: stockType,
    grams: toGramsFn(cubeQty || 1, 'qty'),
    isStock: true,
    stockWaterMl: waterMl || '',
    stockDisplayName: stockType
  };
};

const normaliseMultiplierAndUnits = (rawLine) => {
  let text = String(rawLine || '').trim();
  if (!text) return '';

  text = text.replace(/^(\d+(?:\.\d+)?\s*)?(?:a\s+)?small\s+bunch(?:es)?\b\s*(?:of\s+)?(.*)$/i, (m, countStr, remainder) => {
    const c = countStr ? parseFloat(countStr) : 1;
    return `${Math.round(c * 15 * 10) / 10}g ${remainder.trim()}`;
  });

  text = text.replace(/^(\d+(?:\.\d+)?\s*)?(?:a\s+)?large\s+bunch(?:es)?\b\s*(?:of\s+)?(.*)$/i, (m, countStr, remainder) => {
    const c = countStr ? parseFloat(countStr) : 1;
    return `${Math.round(c * 30 * 10) / 10}g ${remainder.trim()}`;
  });

  text = text.replace(/^(\d+(?:\.\d+)?\s*)?(?:a\s+)?bunch(?:es)?\b\s*(?:of\s+)?(.*)$/i, (m, countStr, remainder) => {
    const c = countStr ? parseFloat(countStr) : 1;
    return `${Math.round(c * 20 * 10) / 10}g ${remainder.trim()}`;
  });

  text = text.replace(/^(\d+(?:\.\d+)?\s*)?(?:a\s+)?handful(?:s)?\b\s*(?:of\s+)?(.*)$/i, (m, countStr, remainder) => {
    const c = countStr ? parseFloat(countStr) : 1;
    return `${Math.round(c * 30 * 10) / 10}g ${remainder.trim()}`;
  });

  const compoundMatch = text.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)(?:\s+(?:tins?|cans?|packs?|blocks?|pots?|jars?|bottles?)\b)?\s*(?:of\s+)?(.*)$/i);
  if (compoundMatch) {
    const count = parseFloat(compoundMatch[1]);
    const subQty = parseFloat(compoundMatch[2]);
    const rawUnit = compoundMatch[3].toLowerCase();
    let remainder = compoundMatch[4].trim();
    remainder = remainder.replace(/^(?:tins?|cans?|packs?|blocks?|pots?|jars?|bottles?)\s*(?:of\s+)?/i, '').trim();

    let totalWeight = count * subQty;
    let unit = 'g';

    if (rawUnit === 'kg') {
      totalWeight = count * subQty * 1000;
      unit = 'g';
    } else if (['l', 'litre', 'litres', 'liter', 'liters'].includes(rawUnit)) {
      totalWeight = count * subQty * 1000;
      unit = 'ml';
    } else if (rawUnit === 'ml') {
      totalWeight = count * subQty;
      unit = 'ml';
    } else if (['oz', 'ounce', 'ounces'].includes(rawUnit)) {
      totalWeight = Math.round(count * subQty * 28.35 * 10) / 10;
      unit = 'g';
    } else if (['lb', 'lbs', 'pound', 'pounds'].includes(rawUnit)) {
      totalWeight = Math.round(count * subQty * 453.6 * 10) / 10;
      unit = 'g';
    } else if (['floz', 'fl oz'].includes(rawUnit)) {
      totalWeight = Math.round(count * subQty * 30 * 10) / 10;
      unit = 'ml';
    } else if (['cup', 'cups'].includes(rawUnit)) {
      totalWeight = Math.round(count * subQty * 240 * 10) / 10;
      unit = 'ml';
    } else if (['tbsp', 'tablespoon', 'tablespoons'].includes(rawUnit)) {
      totalWeight = Math.round(count * subQty * 15 * 10) / 10;
      unit = 'g';
    } else if (['tsp', 'teaspoon', 'teaspoons'].includes(rawUnit)) {
      totalWeight = Math.round(count * subQty * 5 * 10) / 10;
      unit = 'g';
    } else if (['tin', 'tins', 'can', 'cans'].includes(rawUnit)) {
      totalWeight = count * subQty * 400;
      unit = 'g';
    } else {
      totalWeight = count * subQty;
      unit = 'g';
    }

    return `${totalWeight}${unit} ${remainder}`;
  }

  text = text.replace(/^(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz\.?|fluid\s*ounces?)\b\s*(?:of\s+)?(.*)$/i, (m, q, rem) => {
    const val = Math.round(parseFloat(q) * 30 * 10) / 10;
    return `${val}ml ${rem.trim()}`;
  });
  text = text.replace(/^(\d+(?:\.\d+)?)\s*(?:cups?)\b\s*(?:of\s+)?(.*)$/i, (m, q, rem) => {
    const val = Math.round(parseFloat(q) * 240 * 10) / 10;
    return `${val}ml ${rem.trim()}`;
  });
  text = text.replace(/^(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b\s*(?:of\s+)?(.*)$/i, (m, q, rem) => {
    const val = Math.round(parseFloat(q) * 28.35 * 10) / 10;
    return `${val}g ${rem.trim()}`;
  });
  text = text.replace(/^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\b\s*(?:of\s+)?(.*)$/i, (m, q, rem) => {
    const val = Math.round(parseFloat(q) * 453.6 * 10) / 10;
    return `${val}g ${rem.trim()}`;
  });
  text = text.replace(/^(\d+(?:\.\d+)?)\s*(?:tbsp|tablespoons?)\b\s*(?:of\s+)?(.*)$/i, (m, q, rem) => {
    const val = Math.round(parseFloat(q) * 15 * 10) / 10;
    return `${val}g ${rem.trim()}`;
  });
  text = text.replace(/^(\d+(?:\.\d+)?)\s*(?:tsp|teaspoons?)\b\s*(?:of\s+)?(.*)$/i, (m, q, rem) => {
    const val = Math.round(parseFloat(q) * 5 * 10) / 10;
    return `${val}g ${rem.trim()}`;
  });

  return text;
};

const parseIngredientLine = (raw) => {
  raw = cleanIngredientLinePrefix(raw).replace(/^\xad\s*/, '').trim(); 
  if (!raw) return null;
  const stock = detectStockIngredient(raw);
  if (stock) return stock;

  raw = normaliseLeadingQuantity(raw);
  raw = normaliseMultiplierAndUnits(raw);

  let parsed = null;

  const multiWithSub = raw.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|pack|packs|block|blocks|pot|pots|jar|jars|bottle|bottles|oz|ounces?|lbs?|pounds?|fl\.?\s*oz\.?)?\s*(?:of\s+)?(?:tins?|cans?|packs?|blocks?|pots?|jars?|bottles?|of\s+)?(.+)$/i);
  if (multiWithSub) {
    const count = parseFloat(multiWithSub[1]);
    const subQty = parseFloat(multiWithSub[2]);
    let rawUnit = (multiWithSub[3] || 'g').toLowerCase().replace(/s$/,'');
    if (rawUnit === 'tin' || rawUnit === 'can') rawUnit = 'tin';
    if (['pack','block','pot','jar','bottle'].includes(rawUnit)) rawUnit = 'g';
    const totalQty = count * subQty;
    const name = multiWithSub[4].replace(/\s*\(.*?\)\s*/g,'').trim();
    parsed = { raw, qty: totalQty, unit: rawUnit, name };
  }

  if (!parsed) {
    const multiSimple = raw.match(/^(\d+(?:\.\d+)?)\s*(?:x|×)\s*(?:of\s+)?(?:tins?|cans?|packs?|blocks?|pots?|jars?|bottles?|of\s+)?(.+)$/i);
    if (multiSimple) {
      const count = parseFloat(multiSimple[1]);
      const remainder = multiSimple[2].trim();
      const discreteMatch = remainder.match(/^(clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|tin|tins|can|cans)\s+(?:of\s+)?(.+)$/i);
      if (discreteMatch) {
        let dUnit = discreteMatch[1].toLowerCase().replace(/s$/,'');
        if (dUnit === 'tin' || dUnit === 'can') dUnit = 'tin';
        const dName = discreteMatch[2].replace(/\s*\(.*?\)\s*/g,'').trim();
        parsed = { raw, qty: count, unit: dUnit, name: dName };
      } else {
        const name = remainder.replace(/\s*\(.*?\)\s*/g,'').trim();
        parsed = { raw, qty: count, unit: 'qty', name };
      }
    }
  }

  if (!parsed) {
    const m = raw.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tsp|tbsp|cup|tin|tins|can|cans|clove|cloves|bulb|bulbs|head|heads|handful|handfuls|bunch|bunches|pinch|dash|slice|slices|piece|pieces|stalk|stalks|sprig|sprigs|leaf|leaves|oz|ounces?|lbs?|pounds?|fl\.?\s*oz\.?)s?\s+(?:of\s+)?(.+)$/i);
    if (m) {
      const qty = parseFloat(m[1]);
      let unit = m[2].toLowerCase().replace(/s$/,'');
      if (unit === 'tin' || unit === 'can') unit = 'tin';
      if (unit === 'bulb' || unit === 'head') unit = 'head';
      const name = m[3].replace(/\s*\(.*?\)\s*/g,'').trim();
      parsed = { raw, qty, unit, name };
    } else {
      const m2 = raw.match(/^(handful|bunch|pinch|dash|sprig)s?\s+(?:of\s+)?(.+)$/i);
      if (m2) {
        const unit = m2[1].toLowerCase();
        const name = m2[2].replace(/\s*\(.*?\)\s*/g,'').trim();
        parsed = { raw, qty: 1, unit, name };
      } else {
        const m3 = raw.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)\s+(.+)$/i);
        if (m3) {
          const qty = parseFloat(m3[1]);
          const unit = m3[2].toLowerCase();
          const name = m3[3].replace(/\s*\(.*?\)\s*/g,'').trim();
          parsed = { raw, qty, unit, name };
        } else {
          const m4 = raw.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
          if (m4) {
            const qty = parseFloat(m4[1]);
            const name = m4[2].replace(/\s*\(.*?\)\s*/g,'').trim();
            parsed = { raw, qty, unit: 'qty', name };
          } else {
            parsed = { raw, qty: 1, unit: 'qty', name: raw.replace(/\s*\(.*?\)\s*/g,'').trim() || raw };
          }
        }
      }
    }
  }

  let { qty, unit, name } = parsed;
  unit = (unit || '').toLowerCase().replace(/s$/, '');

  if (unit === 'handful') {
    qty = qty * 30;
    unit = 'g';
  } else if (unit === 'bunch') {
    qty = qty * 20;
    unit = 'g';
  } else if (unit === 'pinch' || unit === 'dash') {
    qty = qty * 1;
    unit = 'g';
  }

  const isFreshGarlicFn = window.isFreshGarlicIngredient || (() => false);
  const toGramsFn = window.toGrams || ((q, un) => q * 100);

  if (isFreshGarlicFn({ name }, null)) {
    if (['g', 'tsp', 'tbsp', 'ml'].includes(unit)) {
      let g = toGramsFn(qty, unit);
      qty = Math.max(0.5, Math.round((g / 6) * 10) / 10);
      unit = 'qty';
      name = name.toLowerCase().includes('clove') ? name : name + ' cloves';
    } else if (unit === 'head') {
      qty = Math.round(qty * 11); 
      unit = 'qty';
      name = name.toLowerCase().includes('clove') ? name : name + ' cloves';
    } else if (unit === 'clove') {
      unit = 'qty';
    }
  }

  const liquidMeasureToMl = ['tsp', 'tbsp', 'cup', 'fl oz', 'floz'];
  const volToG = ['kg', 'tin', 'can', 'oz', 'ounce', 'lb', 'lbs', 'pound', 'handful', 'bunch'];
  const discreteToQty = ['clove', 'head', 'bulb', 'slice', 'piece', 'stalk', 'sprig', 'leaf'];
  const isLikelyLiquidFn = window.isLikelyLiquidIngredientName || (() => false);

  if ((liquidMeasureToMl.includes(unit) && isLikelyLiquidFn(name)) || unit === 'fl oz' || unit === 'floz') {
    qty = toGramsFn(qty, unit);
    unit = 'ml';
  } else if (liquidMeasureToMl.includes(unit) || volToG.includes(unit)) {
    qty = toGramsFn(qty, unit);
    unit = 'g';
  } else if (unit === 'l') {
    qty = qty * 1000;
    unit = 'ml';
  } else if (discreteToQty.includes(unit)) {
    unit = 'qty';
  }

  const toTitleCaseFn = window.toTitleCase || (s => s);
  name = toTitleCaseFn(name);

  return { raw, qty, unit, name, grams: toGramsFn(qty, unit) };
};

const fuzzyMatchBank = (name) => {
  if (!name) return null;
  const getSearchVariantsFn = window.getSearchVariants || (str => [str.toLowerCase()]);
  const variants = getSearchVariantsFn(name);
  let best = null, bestScore = 0;
  
  const productBank = window.state?.ingredients || [];
  for (const ing of productBank) {
    const ingWords = ing.name.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
    if (!ingWords.length) continue;
    
    variants.forEach(variant => {
      const words = variant.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
      if (!words.length) return;
      const intersection = words.filter(w => ingWords.some(iw => iw.includes(w) || w.includes(iw)));
      const union = new Set([...words, ...ingWords]);
      const score = intersection.length / union.size;
      if (score > bestScore) { bestScore = score; best = ing; }
    });
  }
  return bestScore >= 0.4 ? best : null;
};

const fuzzyMatchIngredientGroup = (name) => {
  const groups = window.state?.ingredientGroups || [];
  if (!name || !groups.length) return null;
  const getSearchVariantsFn = window.getSearchVariants || (str => [str.toLowerCase()]);
  const variants = getSearchVariantsFn(name);
  let best = null, bestScore = 0;

  for (const group of groups) {
    const canonicalKeyFn = window.canonicalGroupKey || (s => s.toLowerCase());
    const exactFields = [group.name, group.family, ...(group.aliases || [])].map(canonicalKeyFn);
    if (variants.some(variant => exactFields.includes(canonicalKeyFn(variant)))) return group;
    
    const getSearchTextFn = window.getIngredientGroupSearchText || (() => '');
    const haystack = getSearchTextFn(group);
    const groupWords = haystack.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
    if (!groupWords.length) continue;

    variants.forEach(variant => {
      const words = variant.replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 2);
      if (!words.length) return;
      const intersection = words.filter(w => groupWords.some(gw => gw.includes(w) || w.includes(gw)));
      const union = new Set([...words, ...groupWords]);
      const score = intersection.length / union.size;
      if (score > bestScore) { bestScore = score; best = group; }
    });
  }
  return bestScore >= 0.35 ? best : null;
};

const round1 = (value) => Math.round((parseFloat(value) || 0) * 10) / 10;

const normaliseAliasText = (text) => String(text || '').replace(/\s+/g, ' ').trim();

const inferIngredientFamilyFromText = (text) => {
  if (!text) return '';
  const clean = String(text).trim();
  const s = typeof window !== 'undefined' ? window.state : null;
  const families = s?.ingredientFamilies || [];
  const found = families.find(f => f && (f.name.toLowerCase() === clean.toLowerCase() || clean.toLowerCase().includes(f.name.toLowerCase())));
  return found ? found.name : clean;
};

const getIngredientById = (id, targetState = null) => {
  if (!id) return null;
  const s = targetState || (typeof window !== 'undefined' ? window.state : null);
  const families = s?.ingredientFamilies || [];
  return families.find(f => f && (f.id === id || f.name === id)) || null;
};

const getProductById = (id, targetState = null) => {
  if (!id) return null;
  const s = targetState || (typeof window !== 'undefined' ? window.state : null);
  const prods = s?.ingredients || s?.products || [];
  return prods.find(p => p && (p.id === id || p.name === id)) || null;
};

const getEffectiveProductPrice = (product) => {
  if (!product) return 0;
  return parseFloat(product.price) || 0;
};

const getGroupProducts = (groupId, targetState = null) => {
  if (!groupId) return [];
  const s = targetState || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  const list = s?.ingredients || s?.products || [];
  return list.filter(p => p && (p.groupId === groupId || p.subTypeId === groupId || (Array.isArray(p.groupIds) && p.groupIds.includes(groupId))));
};

const getFamilyGroups = (familyId, targetState = null) => {
  if (!familyId) return [];
  const s = targetState || (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  const families = s?.ingredientFamilies || [];
  const groups = s?.ingredientGroups || [];
  const family = (typeof window !== 'undefined' && window.platePlanIndexes?.families?.get(familyId)) ||
                 families.find(f => f && (f.id === familyId || f.name === familyId)) || null;

  if (family?.typeIds && Array.isArray(family.typeIds) && family.typeIds.length > 0) {
    const mapped = family.typeIds.map(id => {
      return (typeof window !== 'undefined' && window.platePlanIndexes?.groups?.get(id)) ||
             groups.find(g => g && g.id === id) || null;
    }).filter(Boolean);
    if (mapped.length > 0) return mapped;
  }

  return groups.filter(g => g && (g.ingredientId === familyId || g.familyId === familyId || (family && g.family === family.name)));
};

const getGroupHierarchyText = (group) => {
  if (!group) return '';
  const cat = (typeof CAT !== 'undefined' && CAT[group.cat]) || group.cat || 'Other';
  const resolveFamily = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily : (window.getGroupIngredientFamily || (() => null));
  const fam = group.family || resolveFamily(group)?.name || 'Ingredient';
  const typeName = (typeof getGroupTypeName === 'function' ? getGroupTypeName(group) : (window.getGroupTypeName ? window.getGroupTypeName(group) : group.name)) || 'Sub-type';
  return `${cat} > ${fam} > ${typeName}`;
};

const needsItemWeightForQtyIngredient = (ingredient, product) => {
  if (!ingredient || !product) return false;
  const unitStr = String(ingredient.unit || '').toLowerCase().trim();
  const isCounted = ['qty', 'count', 'item', 'items', 'whole', 'piece', 'pieces', 'pack', 'unit', 'units'].includes(unitStr) || (!unitStr && +(ingredient.qty || ingredient.grams || 0) > 0);
  if (!isCounted) return false;
  const packUnit = String(product.packUnit || '').toLowerCase().trim();
  if (packUnit === 'qty' && +(product.itemWeight || 0) > 0) return false;
  if (['g', 'ml', 'kg', 'l'].includes(packUnit) && !(+product.itemWeight > 0)) return true;
  if (!(+product.itemWeight > 0) && !(+product.drainedWeight > 0) && packUnit !== 'qty') return true;
  return false;
};

const getIngredientMappingWarning = (ingredient, resolved) => {
  if (!ingredient || !resolved) return null;
  if (ingredient.groupId && resolved.group?.id && ingredient.groupId !== resolved.group.id) {
    return `Sub-type mismatch: ingredient specifies ${ingredient.groupId} but mapped to ${resolved.group.id}.`;
  }
  return null;
};

const calculateIngredientCost = (ingredient, product, serves = 1) => {
  if (!ingredient || !product || !(+product.price > 0)) return 0;
  const getGrams = typeof getEffectiveIngredientGrams === 'function' ? getEffectiveIngredientGrams : (window.getEffectiveIngredientGrams || (() => 0));
  const grams = getGrams(ingredient, product);
  const getUsable = typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount : (window.getProductUsablePackAmount || (() => +(product.packSize || 100)));
  const packGrams = getUsable(product);
  if (!(grams > 0 && packGrams > 0)) return 0;
  const activeServes = +(serves) || 1;
  return ((+product.price / packGrams) * grams) / activeServes;
};

const resolveProductForIngredient = (ingredientOrId, contextOrState = null, targetState = null) => {
  if (!ingredientOrId) {
    return { product: null, group: null, productId: null, groupId: null };
  }

  let s = targetState;
  let resolutionContext = null;

  if (contextOrState && (contextOrState.ingredients || contextOrState.ingredientGroups || contextOrState.ingredientProductMappings || contextOrState.recipes)) {
    s = contextOrState;
  } else if (contextOrState && typeof contextOrState === 'object') {
    resolutionContext = contextOrState;
  }
  if (!s) {
    s = (typeof window !== 'undefined' ? window.state : null) || (typeof state !== 'undefined' ? state : null);
  }

  const productsList = s?.ingredients || s?.products || [];
  const groupsList = s?.ingredientGroups || [];
  const mappings = s?.ingredientProductMappings || {};

  let ing = ingredientOrId;
  let directId = null;
  if (typeof ing === 'string' || typeof ing === 'number') {
    directId = String(ing);
    ing = { id: directId, productId: directId, bankId: directId };
  }

  const findProductById = (id) => {
    if (!id) return null;
    const str = String(id);
    if (typeof window !== 'undefined' && window.platePlanIndexes?.products) {
      const idxP = window.platePlanIndexes.products.get(str) || window.platePlanIndexes.products.get(id);
      if (idxP) return idxP;
    }
    if (typeof window !== 'undefined' && typeof window.getProduct === 'function') {
      const p = window.getProduct(id);
      if (p) return p;
    }
    return productsList.find(p => p && (String(p.id) === str || p.name === id)) || null;
  };

  const findGroupById = (id) => {
    if (!id) return null;
    const str = String(id);
    if (typeof window !== 'undefined' && window.platePlanIndexes?.groups) {
      const idxG = window.platePlanIndexes.groups.get(str) || window.platePlanIndexes.groups.get(id);
      if (idxG) return idxG;
    }
    if (typeof window !== 'undefined' && typeof window.getIngredientGroup === 'function') {
      const g = window.getIngredientGroup(id);
      if (g) return g;
    }
    return groupsList.find(g => g && (String(g.id) === str || g.name === id)) || null;
  };

  let product = null;
  let group = null;

  // 1. Context overrides first
  if (resolutionContext) {
    const overId = (ing.id && resolutionContext.productOverrides?.[ing.id]) ||
                   (ing.id && resolutionContext.substitutions?.[ing.id]) ||
                   (ing.groupId && resolutionContext.productSelections?.[ing.groupId]) ||
                   (ing.groupId && resolutionContext.productOverrides?.[ing.groupId]);
    if (overId) {
      product = findProductById(overId);
    }
  }

  // 2. Direct product object on ingredient
  if (!product && ing.product && typeof ing.product === 'object') {
    product = ing.product;
  }

  // 3. Mappings lookup by ingredientId or raw/name
  if (!product && mappings) {
    const mappedId = (ing.ingredientId && mappings[ing.ingredientId]) ||
                     (ing.id && mappings[ing.id]) ||
                     (ing.name && mappings[ing.name]);
    if (mappedId) {
      product = findProductById(mappedId);
    }
  }

  // 4. By bankId / productId
  if (!product) {
    const pId = ing.productId || ing.bankId;
    if (pId) {
      product = findProductById(pId);
    }
  }

  // 5. Look up group if specified
  const targetGroupId = ing.groupId || ing.subTypeId;
  if (targetGroupId) {
    group = findGroupById(targetGroupId);
  }

  // If product found but no group, resolve group from product
  if (product && !group) {
    const pGroupId = product.groupId || product.subTypeId;
    if (pGroupId) {
      group = findGroupById(pGroupId);
    }
  }

  // 6. If no product yet, but we have a group, resolve default product for group
  if (!product && group) {
    const defId = group.manualDefaultProductId || group.defaultProductId;
    if (defId) {
      product = findProductById(defId);
    }
    if (!product) {
      const groupProducts = productsList.filter(p => p && (p.groupId === group.id || p.subTypeId === group.id));
      if (groupProducts.length > 0) {
        product = groupProducts.find(p => p && (+p.cal > 0 || +p.prot > 0)) || groupProducts[0];
      }
    }
  }

  // 7. By directId if input was string and wasn't found as product
  if (!product && directId && !group) {
    group = findGroupById(directId);
    if (group) {
      const defId = group.manualDefaultProductId || group.defaultProductId;
      if (defId) product = findProductById(defId);
      if (!product) {
        const groupProducts = productsList.filter(p => p && (p.groupId === group.id || p.subTypeId === group.id));
        if (groupProducts.length > 0) product = groupProducts[0];
      }
    }
  }

  // 8. Family fallback if ingredientId or familyId is present
  if (!product && !group && (ing.ingredientId || ing.familyId)) {
    const famId = ing.ingredientId || ing.familyId;
    const fam = (s?.ingredientFamilies || []).find(f => f && (f.id === famId || f.name === famId));
    if (fam) {
      const defaultGroup = fam.defaultTypeId ? findGroupById(fam.defaultTypeId) : null;
      if (defaultGroup) {
        group = defaultGroup;
        const defId = defaultGroup.manualDefaultProductId || defaultGroup.defaultProductId;
        if (defId) product = findProductById(defId);
        if (!product) {
          const groupProducts = productsList.filter(p => p && (p.groupId === defaultGroup.id || p.subTypeId === defaultGroup.id));
          if (groupProducts.length > 0) product = groupProducts[0];
        }
      }
    }
  }

  const result = {
    ...(product || {}),
    product: product || null,
    group: group || null,
    productId: product?.id || null,
    groupId: group?.id || ing.groupId || null
  };

  return result;
};

const resolveProductForIngredientWithContext = (ingredientOrId, context, targetState = null) => {
  return resolveProductForIngredient(ingredientOrId, context, targetState);
};

if (typeof window !== 'undefined') {
  window.PlatePlanIngredients = {
    normaliseUnicodeFractions,
    parseRecipeNumber,
    normaliseLeadingQuantity,
    cleanIngredientLinePrefix,
    splitPastedIngredientText,
    getIngredientSectionHeading,
    splitPastedIngredientSections,
    splitPastedMethodText,
    escapeRegex,
    ppEscapeRegex,
    convertMethodQuantitiesToPercentages,
    detectStockIngredient,
    normaliseMultiplierAndUnits,
    parseIngredientLine,
    parseIngredient: parseIngredientLine,
    fuzzyMatchBank,
    fuzzyMatchIngredientGroup,
    resolveProductForIngredient,
    resolveProductForIngredientWithContext,
    getGroupProducts,
    getFamilyGroups,
    getGroupHierarchyText,
    needsItemWeightForQtyIngredient,
    getIngredientMappingWarning,
    round1,
    normaliseAliasText,
    inferIngredientFamilyFromText,
    getIngredientById,
    getProductById,
    getEffectiveProductPrice,
    calculateIngredientCost
  };

  window.resolveProductForIngredient = resolveProductForIngredient;
  window.resolveProductForIngredientWithContext = resolveProductForIngredientWithContext;
  window.getGroupProducts = getGroupProducts;
  window.getFamilyGroups = getFamilyGroups;
  window.getGroupHierarchyText = getGroupHierarchyText;
  window.needsItemWeightForQtyIngredient = needsItemWeightForQtyIngredient;
  window.getIngredientMappingWarning = getIngredientMappingWarning;
  window.round1 = round1;
  window.normaliseAliasText = normaliseAliasText;
  window.inferIngredientFamilyFromText = inferIngredientFamilyFromText;
  window.getIngredientById = getIngredientById;
  window.getProductById = getProductById;
  window.getEffectiveProductPrice = getEffectiveProductPrice;
  window.calculateIngredientCost = calculateIngredientCost;
}
})();
