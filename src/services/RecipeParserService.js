/**
 * src/services/RecipeParserService.js (v3.32.0)
 * Multi-Recipe Batch Parsing, Token Normalisation & Recipe Block Chunking.
 */

import { toTitleCase, parseIngredientString, matchIngredientTaxonomy } from './RecipeIngredientParser.js';

/**
 * Unpacks glued header tokens and splits raw multi-recipe text into distinct recipe block chunks.
 * @param {string} rawText
 * @returns {string[]}
 */
export function unpackAndSplitRecipeBlocks(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // Normalise line breaks
  let clean = rawText.replace(/\r\n/g, '\n');

  // Expand structural headers glued directly to values without newlines
  const structuralHeaders = [
    'Recipe Title:',
    'Total Servings:',
    'Prep Time (Hours & Mins):',
    'Cook Time (Hours & Mins):',
    'Prep Time:',
    'Cook Time:',
    'Ingredients:',
    'Method Instructions:',
    'Instructions:',
    'Method:'
  ];
  structuralHeaders.forEach(h => {
    clean = clean.replace(new RegExp(`([^\\n])(${h})`, 'gi'), '$1\n$2');
  });

  // Expand numbered titles or Dish markers glued to previous text (e.g. "...immediately.2. CRISPY...")
  clean = clean.replace(/([^\n])(\d+\.\s+[A-Z0-9\s-]{3,})/g, '$1\n\n$2');
  clean = clean.replace(/([^\n])((?:Dish|Recipe)\s+\d+[:\.])/gi, '$1\n\n$2');

  // Split on numbered recipe headers OR standalone Recipe Title occurrences
  const blocks = clean
    .split(/(?:^|\n\n|\n(?=(?:Recipe\s+Title:|(?:Dish|Recipe)\s+\d+[:\.]|\d+[\.\)]\s+[A-Z0-9\s-]{4,})))/g)
    .map(c => c.trim())
    .filter(c => c.length > 30);

  return blocks.length > 0 ? blocks : [rawText.trim()];
}

/**
 * Parses a single recipe text block into a complete recipe object.
 * Strips leading numbering/delimiters from titles.
 * @param {string} block
 * @param {Array} ingredientsBank
 * @returns {Object|null}
 */
export function parseSingleRecipeText(block, ingredientsBank = []) {
  if (!block || typeof block !== 'string') return null;

  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  let title = 'Imported Recipe';
  let servings = 4;
  let prepMinutes = 15;
  let cookMinutes = 30;
  let currentSectionTitle = 'Main Ingredients';
  const sectionsMap = { 'Main Ingredients': [] };
  const methodLines = [];
  let parsingMode = 'header';

  lines.forEach((line, idx) => {
    // Title match
    if (/^(?:Recipe\s*)?(?:Title|Name):/i.test(line)) {
      let extracted = line.replace(/^(?:Recipe\s*)?(?:Title|Name):/i, '').trim();
      extracted = cleanRecipeTitle(extracted);
      if (extracted) title = extracted;
      return;
    }

    if (/^(?:Dish|Recipe)\s+\d+:\s*(.*)/i.test(line)) {
      const match = line.match(/^(?:Dish|Recipe)\s+\d+:\s*(.*)/i);
      const extracted = cleanRecipeTitle(match[1]);
      if (extracted) title = extracted;
      return;
    }

    // Servings match
    if (/^(?:Serves|Yield|Servings|Total\s+Servings):/i.test(line)) {
      const match = line.match(/\d+/);
      if (match) servings = parseInt(match[0], 10);
      return;
    }

    // Timings
    if (/^Prep\s+Time(?:\s*\(Hours\s*&\s*Mins\))?:/i.test(line)) {
      prepMinutes = parseDurationMinutes(line);
      return;
    }

    if (/^Cook\s+Time(?:\s*\(Hours\s*&\s*Mins\))?:/i.test(line)) {
      cookMinutes = parseDurationMinutes(line);
      return;
    }

    // Ingredients section header
    if (/^(?:main\s+)?ingredients?:/i.test(line)) {
      parsingMode = 'ingredients';
      const rest = line.replace(/^(?:main\s+)?ingredients?:/i, '').trim();
      if (rest) {
        parseIngredientLine(rest, currentSectionTitle, sectionsMap, ingredientsBank);
      }
      return;
    }

    // Sub-section header (e.g., "For the sauce:")
    if (/^for\s+the\s+.+:|^[a-zA-Z\s]+:$/i.test(line) && !/serves|yield|servings|method|instructions|steps|preparation|prep|cook/i.test(line)) {
      currentSectionTitle = toTitleCase(line.replace(':', '').trim());
      if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];
      parsingMode = 'section';
      return;
    }

    // Method header
    if (/^(?:Method\s+Instructions|Method|Instructions|Steps|Preparation):/i.test(line)) {
      parsingMode = 'method';
      const rest = line.replace(/^(?:Method\s+Instructions|Method|Instructions|Steps|Preparation):/i, '').trim();
      if (rest) {
        pushMethodSteps(rest, methodLines);
      }
      return;
    }

    // Fallback title on first non-header line
    if (idx === 0) {
      const rawTitle = cleanRecipeTitle(line);
      if (rawTitle) title = toTitleCase(rawTitle);
      return;
    }

    const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();

    if (parsingMode === 'ingredients' || parsingMode === 'section' || (parsingMode === 'header' && !/^\d+\.|\b(mix|bake|heat|cook|boil|sauté|simmer)\b/i.test(cleanLine))) {
      parseIngredientLine(cleanLine, currentSectionTitle, sectionsMap, ingredientsBank);
    } else if (parsingMode === 'method' || /^\d+\.|\b(mix|bake|heat|cook|boil|sauté|simmer)\b/i.test(cleanLine)) {
      pushMethodSteps(cleanLine, methodLines);
    }
  });

  const ingredientSections = Object.entries(sectionsMap)
    .filter(([_, ingList]) => ingList.length > 0)
    .map(([secTitle, ingList]) => ({ sectionTitle: toTitleCase(secTitle), ingredients: ingList }));

  if (ingredientSections.length === 0) {
    ingredientSections.push({ sectionTitle: 'Main Ingredients', ingredients: [] });
  }

  const flatIngredients = ingredientSections.flatMap(s => s.ingredients);

  return {
    title: toTitleCase(title),
    servings: servings || 4,
    prepTime: { hours: Math.floor(prepMinutes / 60), minutes: prepMinutes % 60 },
    cookTime: { hours: Math.floor(cookMinutes / 60), minutes: cookMinutes % 60 },
    mealSuitability: ['Dinner'],
    ingredientSections,
    ingredients: flatIngredients,
    instructions: methodLines,
    methodSteps: methodLines,
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
  };
}

/**
 * Parses multi-recipe raw text into an array of parsed recipe objects.
 * @param {string} text
 * @param {Array} ingredientsBank
 * @returns {Array}
 */
export function parseBulkRecipeText(text, ingredientsBank = []) {
  if (!text || typeof text !== 'string') return [];
  const blocks = unpackAndSplitRecipeBlocks(text);
  return blocks
    .map(b => parseSingleRecipeText(b, ingredientsBank))
    .filter(r => r && (r.title || (r.ingredientSections && r.ingredientSections.some(s => s.ingredients.length))));
}

function cleanRecipeTitle(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/^\d+[\.\)]\s*/, '') // Strip leading enumeration numbering e.g. "2. CRISPY..."
    .replace(/^(?:Dish|Recipe)\s*\d*:?\s*/i, '')
    .replace(/^Title:\s*/i, '')
    .trim();
}

function parseDurationMinutes(line) {
  let mins = 0;
  const hrMatch = line.match(/(\d+)\s*(?:h|hr|hours?)\b/i);
  if (hrMatch) mins += parseInt(hrMatch[1], 10) * 60;
  const minMatch = line.match(/(\d+)\s*(?:m|min|mins|minutes?)\b/i);
  if (minMatch) mins += parseInt(minMatch[1], 10);
  if (!hrMatch && !minMatch) {
    const rawNum = line.match(/\d+/);
    if (rawNum) mins = parseInt(rawNum[0], 10);
  }
  return mins || 15;
}

function parseIngredientLine(line, currentSectionTitle, sectionsMap, ingredientsBank) {
  if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];
  const rawSubLines = line.split(/(?<=[^\n])\s+(?=\d+(?:\.\d+)?\s*(?:g|kg|ml|l|tbsp|tsp|cup|cloves?|cans?|packs?|pinches?|slices?|handfuls?|bunches?|stalks?)\b)/gi);
  rawSubLines.forEach(subLine => {
    const parsed = parseIngredientString(subLine.trim());
    if (parsed) {
      const matched = matchIngredientTaxonomy(parsed, ingredientsBank);
      if (matched) sectionsMap[currentSectionTitle].push(matched);
    }
  });
}

function pushMethodSteps(line, methodLines) {
  const subSteps = line.split(/(?<=[^\n])\s+(?=\d+\.\s*)/gi);
  subSteps.forEach(s => {
    const stepText = s.replace(/^\d+\.\s*/, '').trim();
    if (stepText) methodLines.push(stepText);
  });
}
