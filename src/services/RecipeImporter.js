/**
 * src/services/RecipeImporter.js (v3.22.0)
 * Modern recipe scraping, JSON-LD microdata extraction,
 * natural language ingredient parsing, and taxonomy matching pipeline.
 */

import { getState } from '../store/store.js';

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

  // Replace unicode fractions
  Object.keys(UNICODE_FRACTIONS).forEach(uf => {
    if (text.includes(uf)) {
      text = text.replace(new RegExp(uf, 'g'), UNICODE_FRACTIONS[uf]);
    }
  });

  // Range e.g. "3-4" or "3 to 4" or "3 – 4"
  const rangeMatch = text.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)(.*)/i);
  if (rangeMatch) {
    const q1 = parseFloat(rangeMatch[1]);
    const q2 = parseFloat(rangeMatch[2]);
    const avg = (q1 + q2) / 2;
    return { qty: avg, remainder: rangeMatch[3].trim() };
  }

  // Mixed fraction e.g. "1 1/2" or "2 3/4"
  const mixedMatch = text.match(/^(\d+)\s+(\d+)\/(\d+)(.*)/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const den = parseFloat(mixedMatch[3]);
    const qty = whole + (den > 0 ? num / den : 0);
    return { qty, remainder: mixedMatch[4].trim() };
  }

  // Simple fraction e.g. "1/2" or "3/4"
  const fracMatch = text.match(/^(\d+)\/(\d+)(.*)/);
  if (fracMatch) {
    const num = parseFloat(fracMatch[1]);
    const den = parseFloat(fracMatch[2]);
    const qty = den > 0 ? num / den : 1;
    return { qty, remainder: fracMatch[3].trim() };
  }

  // Decimal or integer e.g. "200" or "1.5"
  const numMatch = text.match(/^(\d+(?:\.\d+)?)(.*)/);
  if (numMatch) {
    return { qty: parseFloat(numMatch[1]), remainder: numMatch[2].trim() };
  }

  // Word quantities e.g. "a", "an", "one", "two", "half"
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

/**
 * Normalizes standard metric and imperial units.
 */
export function normalizeUnit(rawUnit) {
  if (!rawUnit) return 'qty';
  const clean = String(rawUnit).toLowerCase().trim().replace(/[\.\,]/g, '');
  return UNIT_MAP[clean] || 'qty';
}

/**
 * Parses raw ingredient string into structured quantity, unit, name, and notes.
 * Example: "200g firm tofu, drained and cubed" -> { qty: 200, unit: "g", name: "firm tofu", notes: "drained and cubed" }
 */
export function parseIngredientString(rawString) {
  if (!rawString || typeof rawString !== 'string') return null;
  const original = rawString.trim();
  if (!original) return null;

  const { qty, remainder } = parseQuantity(original);

  let unit = 'qty';
  let ingredientText = remainder;

  // Check if remainder starts with a unit key
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

  // Strip leading "of " if present
  if (/^of\b/i.test(ingredientText.trim())) {
    ingredientText = ingredientText.trim().replace(/^of\b/i, '').trim();
  }

  // Separate name and notes (parentheses, commas, hyphens, prep words)
  let name = ingredientText;
  let notes = '';

  // 1. Extract parentheses notes e.g. "diced onion (optional)" or "extra firm tofu (pressed)"
  const parenMatch = name.match(/^(.*?)\((.*?)\)(.*)$/);
  if (parenMatch) {
    name = (parenMatch[1] + ' ' + parenMatch[3]).trim();
    notes = parenMatch[2].trim();
  }

  // 2. Comma separation e.g. "firm tofu, drained and cubed"
  if (name.includes(',')) {
    const parts = name.split(',');
    name = parts[0].trim();
    const commaNotes = parts.slice(1).join(', ').trim();
    notes = notes ? `${notes}, ${commaNotes}` : commaNotes;
  }

  // 3. Dash separation e.g. "garlic cloves - minced"
  if (name.includes(' - ') || name.includes(' – ')) {
    const parts = name.split(/\s+[-–]\s+/);
    name = parts[0].trim();
    const dashNotes = parts.slice(1).join(' ').trim();
    notes = notes ? `${notes}, ${dashNotes}` : dashNotes;
  }

  // 4. Clean container descriptors like "can", "tin", "block", "jar", "pack" from start of name
  const containerMatch = name.match(/^(can|tin|block|jar|pack|packet|bottle|head|stalk)\s+(.*)/i);
  if (containerMatch) {
    const descriptor = containerMatch[1].toLowerCase();
    name = containerMatch[2].trim();
    notes = notes ? `${descriptor}, ${notes}` : descriptor;
  }

  // 5. Clean leading prep descriptors like "diced", "sliced", "chopped", "minced", "grated", "crushed", "peeled", "cubed"
  const prepLeadMatch = name.match(/^(diced|sliced|chopped|minced|grated|crushed|peeled|cubed|drained|pressed|raw|fresh|organic)\s+(.*)/i);
  if (prepLeadMatch) {
    const prepWord = prepLeadMatch[1].toLowerCase();
    name = prepLeadMatch[2].trim();
    notes = notes ? `${prepWord}, ${notes}` : prepWord;
  }

  // Clean title
  name = name.replace(/^[\s,.\-–]+|[\s,.\-–]+$/g, '').trim();

  return {
    raw: original,
    qty: Number(qty.toFixed(2)),
    unit,
    name: name || original,
    notes: notes.trim()
  };
}

/**
 * Stemming helper to normalize ingredient names for cross-referencing.
 */
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
 * Cross-references parsed ingredient against existing Store taxonomy to prevent duplicates.
 */
export function matchIngredientTaxonomy(parsedItem, existingIngredients = null) {
  if (!parsedItem) return null;
  const storeState = (typeof getState === 'function') ? getState() : {};
  const ingredients = existingIngredients || storeState.ingredients || [];
  
  const rawNameLower = String(parsedItem.name || '').toLowerCase().trim();
  const stemmed = stemIngredientName(rawNameLower);

  let matchedIng = null;

  for (const ing of ingredients) {
    if (!ing || !ing.name) continue;
    const ingNameLower = String(ing.name).toLowerCase().trim();
    const ingStemmed = stemIngredientName(ingNameLower);

    if (ingNameLower === rawNameLower || (stemmed && stemmed === ingStemmed)) {
      matchedIng = ing;
      break;
    }
  }

  // Substring fallback matching
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

/**
 * Helper to parse ISO8601 duration string e.g. "PT15M", "PT1H30M" -> minutes float.
 */
export function parseIsoDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!match) {
    const simpleMin = durationStr.match(/(\d+)\s*min/i);
    return simpleMin ? parseInt(simpleMin[1], 10) : 0;
  }
  const days = parseInt(match[1] || 0, 10);
  const hours = parseInt(match[2] || 0, 10);
  const mins = parseInt(match[3] || 0, 10);
  return (days * 1440) + (hours * 60) + mins;
}

/**
 * Helper to parse nutrition string e.g. "550 kcal", "18g", "18.5 grams" -> number float.
 */
export function parseNutritionNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const match = String(val).match(/([\d\.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Flattens JSON-LD recipeInstructions steps into array of clean string steps.
 */
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
 * Extracts schema.org/Recipe JSON-LD or microdata from raw HTML string.
 */
export function extractRecipeFromHtml(html, sourceUrl = '') {
  if (!html || typeof html !== 'string') return null;

  let recipeData = null;

  // 1. Scan for <script type="application/ld+json"> blocks
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
    } catch (e) {
      // Ignore parse errors for malformed script tags
    }
    if (recipeData) break;
  }

  // If no script tag matched, attempt direct JSON parse if whole input is JSON
  if (!recipeData && (html.trim().startsWith('{') || html.trim().startsWith('['))) {
    try {
      const parsedJson = JSON.parse(html.trim());
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
  }

  if (recipeData) {
    // Process JSON-LD fields
    const title = recipeData.name || recipeData.headline || 'Imported Recipe';
    
    let imageUrl = '';
    if (typeof recipeData.image === 'string') {
      imageUrl = recipeData.image;
    } else if (Array.isArray(recipeData.image)) {
      imageUrl = typeof recipeData.image[0] === 'string' ? recipeData.image[0] : (recipeData.image[0]?.url || '');
    } else if (recipeData.image && typeof recipeData.image === 'object') {
      imageUrl = recipeData.image.url || '';
    }

    let servings = 4;
    if (recipeData.recipeYield) {
      const yieldStr = Array.isArray(recipeData.recipeYield) ? recipeData.recipeYield[0] : String(recipeData.recipeYield);
      const yieldNum = yieldStr.match(/\d+/);
      if (yieldNum) servings = parseInt(yieldNum[0], 10);
    }

    const prepTimeMinutes = parseIsoDuration(recipeData.prepTime);
    const cookTimeMinutes = parseIsoDuration(recipeData.cookTime);

    const rawIngredients = Array.isArray(recipeData.recipeIngredient) ? recipeData.recipeIngredient : [];
    const parsedIngredients = rawIngredients.map(ingStr => {
      const parsed = parseIngredientString(ingStr);
      return matchIngredientTaxonomy(parsed);
    }).filter(Boolean);

    const instructions = flattenRecipeInstructions(recipeData.recipeInstructions);

    const nut = recipeData.nutrition || {};
    const macros = {
      calories: parseNutritionNumber(nut.calories),
      protein: parseNutritionNumber(nut.proteinContent),
      carbs: parseNutritionNumber(nut.carbohydrateContent),
      fat: parseNutritionNumber(nut.fatContent),
      fiber: parseNutritionNumber(nut.fiberContent)
    };

    return {
      title,
      imageUrl,
      servings,
      prepTimeMinutes,
      cookTimeMinutes,
      ingredients: parsedIngredients,
      instructions,
      macros,
      sourceUrl
    };
  }

  // Fallback to text chunk parsing if HTML contains plain recipe text
  return null;
}

/**
 * Bulk text parser service for recipe ingestion.
 */
export function parseBulkRecipeText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  
  const text = rawText.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  let recipeBlocks = [];

  if (/Recipe\s+\d+:/i.test(text)) {
    const parts = text.split(/Recipe\s+\d+:/i).map(p => p.trim()).filter(Boolean);
    recipeBlocks = parts;
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
    let ingLines = [];
    let methodLines = [];

    let currentSection = 'header';

    lines.forEach((line, idx) => {
      if (/^(Ingredients?|Items?):/i.test(line)) {
        currentSection = 'ingredients';
        const rest = line.replace(/^(Ingredients?|Items?):/i, '').trim();
        if (rest) ingLines.push(rest);
        return;
      }

      if (/^(Method|Instructions|Steps|Preparation):/i.test(line)) {
        currentSection = 'method';
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
        title = line.replace(/^Recipe\s*\d*:?\s*/i, '').trim() || 'Imported Recipe';
        return;
      }

      if (currentSection === 'ingredients' || (currentSection === 'header' && !/^\d+\.|\b(mix|bake|heat|cook|boil|sauté|simmer)\b/i.test(line))) {
        ingLines.push(line);
      } else if (currentSection === 'method' || /^\d+\.|\b(mix|bake|heat|cook|boil|sauté|simmer)\b/i.test(line)) {
        methodLines.push(line.replace(/^\d+\.\s*/, ''));
      }
    });

    const parsedIngs = ingLines.map(line => {
      const parsed = parseIngredientString(line);
      return matchIngredientTaxonomy(parsed);
    }).filter(Boolean);

    if (parsedIngs.length > 0 || methodLines.length > 0) {
      parsedRecipes.push({
        title,
        servings,
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        imageUrl: '',
        ingredients: parsedIngs,
        instructions: methodLines,
        macros: { calories: 400, protein: 25, carbs: 45, fat: 15 }
      });
    }
  });

  return parsedRecipes;
}

/**
 * High-level import entry point: Accepts HTML, JSON-LD, or raw text and outputs clean recipe object payload.
 */
export function importRecipeFromHtml(htmlOrText, sourceUrl = '') {
  const extracted = extractRecipeFromHtml(htmlOrText, sourceUrl);
  if (extracted) {
    return {
      id: crypto.randomUUID(),
      ...extracted,
      createdAt: new Date().toISOString()
    };
  }

  const bulk = parseBulkRecipeText(htmlOrText);
  if (bulk.length > 0) {
    const first = bulk[0];
    return {
      id: crypto.randomUUID(),
      title: first.title,
      servings: first.servings || 4,
      prepTimeMinutes: first.prepTimeMinutes || 0,
      cookTimeMinutes: first.cookTimeMinutes || 0,
      imageUrl: first.imageUrl || '',
      sourceUrl,
      ingredients: first.ingredients,
      instructions: first.instructions || [],
      macros: first.macros || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      createdAt: new Date().toISOString()
    };
  }

  return null;
}

if (typeof window !== 'undefined') {
  window.parseIngredientString = parseIngredientString;
  window.extractRecipeFromHtml = extractRecipeFromHtml;
  window.importRecipeFromHtml = importRecipeFromHtml;
  window.matchIngredientTaxonomy = matchIngredientTaxonomy;
  window.RecipeImporter = {
    parseIngredientString,
    normalizeUnit,
    parseQuantity,
    matchIngredientTaxonomy,
    extractRecipeFromHtml,
    parseBulkRecipeText,
    importRecipeFromHtml
  };
}
