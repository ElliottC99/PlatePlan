/**
 * src/services/RecipeImporter.js (v3.27.3)
 * Modern recipe scraping, JSON-LD microdata extraction,
 * natural language ingredient parsing with compound stock extraction ("1 stock cube + 400ml water"),
 * multiplier extraction ("2 x 400g"), strict density-based unit conversion,
 * universal Title Case normalization, section recognition, and alias matching.
 */

import { getState } from '../store/store.js';
import { convertToStrictUnit } from './UnitConversionService.js';

/**
 * Universal Title Casing helper for titles, ingredient names, and section headers.
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

const UNICODE_FRACTIONS = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6',
  '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8'
};

const UNIT_MAP = {
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', mls: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbl: 'tbsp', tbs: 'tbsp', tb: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', t: 'tsp',
  cup: 'cup', cups: 'cup',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  pinch: 'pinch', pinches: 'pinch',
  block: 'block', blocks: 'block',
  slice: 'slice', slices: 'slice',
  handful: 'handful', handfuls: 'handful',
  bunch: 'bunch', bunches: 'bunch',
  pack: 'pack', packet: 'pack', packets: 'pack', package: 'pack', packages: 'pack', pkg: 'pack',
  head: 'head', heads: 'head',
  stalk: 'stalk', stalks: 'stalk', stick: 'stalk', sticks: 'stalk',
  sprig: 'sprig', sprigs: 'sprig',
  dash: 'dash', dashes: 'dash', drizzle: 'dash', splash: 'dash', drop: 'dash', drops: 'dash',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb'
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

  // Multiplier pattern e.g. "2 x 400g" or "2 x 150ml"
  const multMatch = text.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)(.*)/);
  if (multMatch) {
    const m1 = parseFloat(multMatch[1]);
    const m2 = parseFloat(multMatch[2]);
    const unitStr = multMatch[3];
    const totalQty = m1 * m2;
    return { qty: totalQty, remainder: `${unitStr}${multMatch[4]}`.trim() };
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

  // Check compound stock patterns (e.g., "1 stock cube + 400ml water", "0.5 stock cube in 200ml boiling water", "1 vegetable stock cube dissolved in 400ml water")
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

  const containerMatch = name.match(/^(can|tin|block|jar|pack|packet|bottle|head|stalk)\s+(.*)/i);
  if (containerMatch) {
    const descriptor = containerMatch[1].toLowerCase();
    name = containerMatch[2].trim();
    notes = notes ? `${descriptor}, ${notes}` : descriptor;
  }

  const prepLeadMatch = name.match(/^(diced|sliced|chopped|minced|grated|crushed|peeled|cubed|drained|pressed|raw|fresh|organic)\s+(.*)/i);
  if (prepLeadMatch) {
    const prepWord = prepLeadMatch[1].toLowerCase();
    name = prepLeadMatch[2].trim();
    notes = notes ? `${prepWord}, ${notes}` : prepWord;
  }

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
 * Cross-references parsed ingredient against existing Store taxonomy including aliases.
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

export function parseIsoDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return { hours: 0, minutes: 0 };
  const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) {
    const simpleMin = durationStr.match(/(\d+)\s*min/i);
    const mins = simpleMin ? parseInt(simpleMin[1], 10) : 0;
    return { hours: Math.floor(mins / 60), minutes: mins % 60 };
  }
  const hours = parseInt(match[2] || 0, 10);
  const mins = parseInt(match[3] || 0, 10);
  return { hours, minutes: mins };
}

export function parseNutritionNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const match = String(val).match(/([\d\.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

export function flattenRecipeInstructions(instructions) {
  if (!instructions) return [];
  if (typeof instructions === 'string') {
    return instructions.split(/\n+/).map(s => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(instructions)) return [];

  const steps = [];
  instructions.forEach(step => {
    if (!step) return;
    if (typeof step === 'string') {
      steps.push(step.trim());
    } else if (typeof step === 'object') {
      if (step['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
        step.itemListElement.forEach(sub => {
          if (sub && sub.text) steps.push(sub.text.trim());
          else if (typeof sub === 'string') steps.push(sub.trim());
        });
      } else if (step.text) {
        steps.push(step.text.trim());
      }
    }
  });

  return steps.filter(Boolean);
}

/**
 * Extracts schema.org/Recipe JSON-LD or microdata with sections and time objects.
 */
export function extractRecipeFromHtml(html, sourceUrl = '') {
  if (!html || typeof html !== 'string') return null;

  let recipeData = null;
  const scriptRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsedJson = JSON.parse(match[1]);
      const items = Array.isArray(parsedJson) ? parsedJson : (parsedJson['@graph'] || [parsedJson]);

      for (const item of items) {
        if (!item) continue;
        const type = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (type.some(t => String(t).toLowerCase() === 'recipe')) {
          recipeData = item;
          break;
        }
      }
    } catch (e) {}
    if (recipeData) break;
  }

  if (recipeData) {
    const rawTitle = recipeData.name || recipeData.headline || 'Imported Recipe';
    const title = toTitleCase(rawTitle);
    let imageUrl = '';
    if (typeof recipeData.image === 'string') imageUrl = recipeData.image;
    else if (Array.isArray(recipeData.image)) imageUrl = recipeData.image[0] || '';

    let servings = 4;
    if (recipeData.recipeYield) {
      const yieldStr = Array.isArray(recipeData.recipeYield) ? recipeData.recipeYield[0] : String(recipeData.recipeYield);
      const yieldNum = yieldStr.match(/\d+/);
      if (yieldNum) servings = parseInt(yieldNum[0], 10);
    }

    const prepMinsTotal = parseIsoDuration(recipeData.prepTime);
    const cookMinsTotal = parseIsoDuration(recipeData.cookTime);

    const rawIngredients = Array.isArray(recipeData.recipeIngredient) ? recipeData.recipeIngredient : [];
    const parsedIngredients = rawIngredients.map(ingStr => {
      const parsed = parseIngredientString(ingStr);
      return matchIngredientTaxonomy(parsed);
    }).filter(Boolean);

    const instructions = flattenRecipeInstructions(recipeData.recipeInstructions);

    return {
      title,
      imageUrl,
      servings,
      prepTime: prepMinsTotal,
      cookTime: cookMinsTotal,
      mealSuitability: ['Dinner'],
      ingredientSections: [{ sectionTitle: 'Main Ingredients', ingredients: parsedIngredients }],
      ingredients: parsedIngredients,
      instructions,
      sourceUrl
    };
  }

  return null;
}

/**
 * Multi-recipe text splitter supporting "Recipe X" headers, double page breaks, and section recognition.
 */
export function parseBulkRecipeText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  
  const text = rawText.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  let recipeBlocks = [];
  if (/Recipe\s+\d+:/i.test(text)) {
    recipeBlocks = text.split(/Recipe\s+\d+:/i).map(p => p.trim()).filter(Boolean);
  } else {
    recipeBlocks = text.split(/\n\s*\n\s*\n/).map(p => p.trim()).filter(Boolean);
    if (recipeBlocks.length === 1) {
      recipeBlocks = [text];
    }
  }

  const parsedRecipes = [];

  recipeBlocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    let title = 'Imported Recipe';
    let servings = 4;
    let currentSectionTitle = 'Main Ingredients';
    let sectionsMap = { 'Main Ingredients': [] };
    let methodLines = [];
    let parsingMode = 'header';

    lines.forEach((line, idx) => {
      // Check section header e.g. "For the salsa:" or "Main Ingredients:" or "Dressing:"
      if (/^(?:main\s+)?ingredients?:/i.test(line)) {
        parsingMode = 'ingredients';
        const rest = line.replace(/^(?:main\s+)?ingredients?:/i, '').trim();
        if (rest) {
          const parsed = parseIngredientString(rest);
          sectionsMap[currentSectionTitle].push(matchIngredientTaxonomy(parsed));
        }
        return;
      }

      if (/^for\s+the\s+.+:|^[a-zA-Z\s]+:$/i.test(line) && !/serves|yield|method|instructions|steps|preparation/i.test(line)) {
        currentSectionTitle = toTitleCase(line.replace(':', '').trim());
        if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];
        parsingMode = 'section';
        return;
      }

      if (/^(Method|Instructions|Steps|Preparation):/i.test(line)) {
        parsingMode = 'method';
        const rest = line.replace(/^(Method|Instructions|Steps|Preparation):/i, '').trim();
        if (rest) methodLines.push(rest);
        return;
      }

      if (/^(Serves|Yield|Servings):/i.test(line)) {
        const match = line.match(/\d+/);
        if (match) servings = parseInt(match[0], 10);
        return;
      }

      if (idx === 0) {
        const rawTitle = line.replace(/^Recipe\s*\d*:?\s*/i, '').trim() || 'Imported Recipe';
        title = toTitleCase(rawTitle);
        return;
      }

      if (parsingMode === 'ingredients' || parsingMode === 'section' || (parsingMode === 'header' && !/^\d+\.|\b(mix|bake|heat|cook|boil|sauté|simmer)\b/i.test(line))) {
        if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];
        const parsed = parseIngredientString(line);
        if (parsed) sectionsMap[currentSectionTitle].push(matchIngredientTaxonomy(parsed));
      } else if (parsingMode === 'method' || /^\d+\.|\b(mix|bake|heat|cook|boil|sauté|simmer)\b/i.test(line)) {
        methodLines.push(line.replace(/^\d+\.\s*/, ''));
      }
    });

    const ingredientSections = Object.entries(sectionsMap)
      .filter(([_, ingList]) => ingList.length > 0)
      .map(([secTitle, ingList]) => ({ sectionTitle: toTitleCase(secTitle), ingredients: ingList }));

    if (ingredientSections.length === 0) {
      ingredientSections.push({ sectionTitle: 'Main Ingredients', ingredients: [] });
    }

    const flatIngredients = ingredientSections.flatMap(s => s.ingredients);

    parsedRecipes.push({
      title: toTitleCase(title),
      servings,
      prepTime: { hours: 0, minutes: 15 },
      cookTime: { hours: 0, minutes: 30 },
      mealSuitability: ['Dinner'],
      ingredientSections,
      ingredients: flatIngredients,
      instructions: methodLines,
      macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
    });
  });

  return parsedRecipes;
}

export function importRecipeFromHtml(htmlOrText, sourceUrl = '') {
  const extracted = extractRecipeFromHtml(htmlOrText, sourceUrl);
  if (extracted) {
    return {
      id: crypto.randomUUID(),
      ...extracted,
      title: toTitleCase(extracted.title),
      createdAt: new Date().toISOString()
    };
  }

  const bulk = parseBulkRecipeText(htmlOrText);
  if (bulk.length > 0) {
    const first = bulk[0];
    return {
      id: crypto.randomUUID(),
      title: toTitleCase(first.title),
      servings: first.servings || 4,
      prepTime: first.prepTime || { hours: 0, minutes: 15 },
      cookTime: first.cookTime || { hours: 0, minutes: 30 },
      mealSuitability: first.mealSuitability || ['Dinner'],
      ingredientSections: first.ingredientSections || [{ sectionTitle: 'Main Ingredients', ingredients: first.ingredients }],
      ingredients: first.ingredients,
      instructions: first.instructions || [],
      macros: first.macros || { calories: 450, protein: 28, carbs: 40, fat: 16 },
      createdAt: new Date().toISOString()
    };
  }

  return null;
}

if (typeof window !== 'undefined') {
  window.toTitleCase = toTitleCase;
  window.parseIngredientString = parseIngredientString;
  window.extractRecipeFromHtml = extractRecipeFromHtml;
  window.importRecipeFromHtml = importRecipeFromHtml;
  window.matchIngredientTaxonomy = matchIngredientTaxonomy;
  window.RecipeImporter = {
    toTitleCase,
    parseIngredientString,
    normalizeUnit,
    parseQuantity,
    matchIngredientTaxonomy,
    extractRecipeFromHtml,
    parseBulkRecipeText,
    importRecipeFromHtml
  };
}
