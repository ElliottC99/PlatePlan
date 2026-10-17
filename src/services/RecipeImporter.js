/**
 * src/services/RecipeImporter.js (v3.32.1)
 * Modern recipe scraping, JSON-LD microdata extraction,
 * HTML microdata normalization, and facade re-exports for RecipeIngredientParser and RecipeParserService.
 */

import {
  toTitleCase,
  UNICODE_FRACTIONS,
  UNIT_MAP,
  parseQuantity,
  normalizeUnit,
  parseIngredientString,
  stemIngredientName,
  matchIngredientTaxonomy
} from './RecipeIngredientParser.js';

import {
  unpackAndSplitRecipeBlocks,
  parseSingleRecipeText,
  parseBulkRecipeText
} from './RecipeParserService.js';

export {
  toTitleCase,
  UNICODE_FRACTIONS,
  UNIT_MAP,
  parseQuantity,
  normalizeUnit,
  parseIngredientString,
  stemIngredientName,
  matchIngredientTaxonomy,
  unpackAndSplitRecipeBlocks,
  parseSingleRecipeText,
  parseBulkRecipeText
};

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
      instructions: first.instructions || first.methodSteps || [],
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
