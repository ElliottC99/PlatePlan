/**
 * src/services/RecipeParserService.js (v3.32.3)
 * Multi-Recipe Batch Parsing, Token Normalisation, Block Chunking,
 * Collapsed Ingredient Unpacking & Method Step Splitting.
 */

import { toTitleCase, parseIngredientString, matchIngredientTaxonomy } from './RecipeIngredientParser.js';

/**
 * Unpacks glued header tokens, eliminates ghost duplicate headers, and splits raw multi-recipe text.
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

  // Merge "X. TITLE\nRecipe Title: TITLE" into a single header boundary before splitting to eliminate ghost duplicates
  clean = clean.replace(/((?:Dish|Recipe|\d+[\.\)])\s*[^\n]+)\s*\n+\s*Recipe Title:\s*/gi, '$1 - ');

  // Split on numbered recipe headers OR standalone Recipe Title occurrences
  const blocks = clean
    .split(/(?:^|\n\n+)(?=(?:\d+[\.\)]\s+[A-Z0-9\s-]{3,}|Recipe Title:|(?:Dish|Recipe)\s+\d+[:\.]))/i)
    .map(c => c.trim())
    .filter(c => c.length > 40 && /(?:Ingredients:|Method|Instructions)/i.test(c));

  return blocks.length > 0 ? blocks : [rawText.trim()];
}

/**
 * Unpacks collapsed ingredient text by inserting newlines before section sub-headings,
 * glued quantities, and fraction/unit descriptors.
 * @param {string} rawIngText
 * @returns {string}
 */
export function unpackCollapsedIngredients(rawIngText) {
  if (!rawIngText || typeof rawIngText !== 'string') return '';
  let text = rawIngText.replace(/\r\n/g, '\n').trim();

  // 1. Separate subsection headers (e.g. FOR THE SAUCE, FOR THE PASTA, TO SERVE)
  text = text.replace(/([^\n])\s*(FOR THE [A-Z\s]+|TO SERVE)/gi, '$1\n\n$2\n');

  // 2. Unconditionally protect composite multipliers: "2 x 280g", "1 x pack", "2x"
  text = text.replace(/(\b\d+(?:\.\d+)?)\s*[xX]\s+/g, '$1_MULTX_');

  // 3. Separate closing brackets/parentheses followed immediately by letters or digits: ")3" -> ")\n3"
  text = text.replace(/([\)\]])\s*(?=[0-9a-zA-Z])/g, '$1\n');

  // 4. Separate a letter followed immediately by ANY number (integer, decimal, or range)
  text = text.replace(/([a-zA-Z])(?=(?:0\.\d+|[1-9]\d*(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:g|kg|ml|l|tbsp|tsp|cm|packs?|cloves?|spring|tin|pot|large|medium|small|pieces?|blocks?|handful|bunch|drizzle|pinch|aubergine|onion|[a-zA-Z]+))/gi, '$1\n');

  // 5. Separate known descriptor phrases glued to words without numbers
  const unspacedTokens = [
    'bunch of',
    'handful of',
    'nooch',
    'flat-leaf',
    'drizzle of',
    'pinch of',
    'vegetable oil',
    'olive oil',
    'sun-dried tomatoes',
    'cornflour'
  ];
  unspacedTokens.forEach(token => {
    const reg = new RegExp(`([a-zA-Z])(${token})`, 'gi');
    text = text.replace(reg, '$1\n$2');
  });

  // 6. Restore multipliers cleanly
  text = text.replace(/_MULTX_/g, ' x ');

  return text;
}

/**
 * Unpacks collapsed method instructions into individual steps.
 * Inserts newlines before step headers ending in colons or numbered steps.
 * @param {string} rawMethodText
 * @returns {string[]}
 */
export function unpackCollapsedSteps(rawMethodText) {
  if (!rawMethodText) return [];
  let text = rawMethodText.replace(/\r\n/g, '\n').trim();

  // Insert newline before step headers ending in colon (e.g. "...shreds.Cook the noodles:")
  text = text.replace(/([\.!?])\s*(?=[A-Z][a-zA-Z0-9\s,'–-]{2,45}:)/g, '$1\n\n');

  // Insert newline before numbered step markers on the same line (e.g. "...40C. 2. Toss in sauce")
  text = text.replace(/([\.!?])\s*(?=\d+[\.\)]\s+)/g, '$1\n\n');

  // Split on double newlines or numbered steps (1., 2., etc.)
  const steps = text
    .split(/(?:\n\s*\n|\n(?=\d+[\.\)]\s+))/g)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  return steps.length > 0 ? steps : [text];
}

/**
 * Parses a single recipe text block into a complete recipe object.
 * Strips leading numbering/delimiters from titles and unpacks collapsed sections.
 * @param {string} block
 * @param {Array} ingredientsBank
 * @returns {Object|null}
 */
export function parseSingleRecipeText(block, ingredientsBank = []) {
  if (!block || typeof block !== 'string') return null;

  const ingRegex = /(?:^|\n)\s*(?:main\s+)?ingredients?:\s*/i;
  const methodRegex = /(?:^|\n)\s*(?:Method\s+Instructions|Method|Instructions|Steps|Preparation):\s*/i;

  const ingMatch = block.match(ingRegex);
  const methodMatch = block.match(methodRegex);

  let headerText = block;
  let rawIngText = '';
  let rawMethodText = '';

  if (ingMatch) {
    headerText = block.slice(0, ingMatch.index);
    if (methodMatch && methodMatch.index > ingMatch.index) {
      rawIngText = block.slice(ingMatch.index + ingMatch[0].length, methodMatch.index);
      rawMethodText = block.slice(methodMatch.index + methodMatch[0].length);
    } else {
      rawIngText = block.slice(ingMatch.index + ingMatch[0].length);
    }
  } else if (methodMatch) {
    headerText = block.slice(0, methodMatch.index);
    rawMethodText = block.slice(methodMatch.index + methodMatch[0].length);
  }

  // Parse Header Information
  let title = 'Imported Recipe';
  let servings = 4;
  let prepMinutes = 15;
  let cookMinutes = 30;

  const headerLines = headerText.split('\n').map(l => l.trim()).filter(Boolean);
  headerLines.forEach((line, idx) => {
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

    if (/^(?:Serves|Yield|Servings|Total\s+Servings):/i.test(line)) {
      const match = line.match(/\d+/);
      if (match) servings = parseInt(match[0], 10);
      return;
    }

    if (/^Prep\s+Time(?:\s*\(Hours\s*&\s*Mins\))?:/i.test(line)) {
      prepMinutes = parseDurationMinutes(line);
      return;
    }

    if (/^Cook\s+Time(?:\s*\(Hours\s*&\s*Mins\))?:/i.test(line)) {
      cookMinutes = parseDurationMinutes(line);
      return;
    }

    if (idx === 0) {
      const rawTitle = cleanRecipeTitle(line);
      if (rawTitle) title = toTitleCase(rawTitle);
    }
  });

  // Parse Ingredients with Collapsed Section & Quantity Unpacking
  const sectionsMap = { 'Main Ingredients': [] };
  let currentSectionTitle = 'Main Ingredients';

  if (rawIngText) {
    const unpackedIngText = unpackCollapsedIngredients(rawIngText);
    const ingLines = unpackedIngText.split('\n').map(l => l.trim()).filter(Boolean);

    ingLines.forEach(line => {
      if (/^(?:for\s+the\s+[a-zA-Z\s]+:?|to\s+serve:?|[a-zA-Z\s]+:)$/i.test(line) && !/^\d+\b|serves|yield|prep|cook/i.test(line)) {
        currentSectionTitle = toTitleCase(line.replace(':', '').trim());
        if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];
        return;
      }
      parseIngredientLine(line, currentSectionTitle, sectionsMap, ingredientsBank);
    });
  }

  const ingredientSections = Object.entries(sectionsMap)
    .filter(([_, ingList]) => ingList.length > 0)
    .map(([secTitle, ingList]) => ({ sectionTitle: toTitleCase(secTitle), ingredients: ingList }));

  if (ingredientSections.length === 0) {
    ingredientSections.push({ sectionTitle: 'Main Ingredients', ingredients: [] });
  }

  const flatIngredients = ingredientSections.flatMap(s => s.ingredients);

  // Parse Method Steps with Step Header & Inline Number Unpacking
  const rawSteps = unpackCollapsedSteps(rawMethodText);
  const methodSteps = rawSteps
    .map(s => s.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean);

  return {
    title: toTitleCase(title),
    servings: servings || 4,
    prepTime: { hours: Math.floor(prepMinutes / 60), minutes: prepMinutes % 60 },
    cookTime: { hours: Math.floor(cookMinutes / 60), minutes: cookMinutes % 60 },
    mealSuitability: ['Dinner'],
    ingredientSections,
    ingredients: flatIngredients,
    instructions: methodSteps,
    methodSteps,
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
  let str = String(raw)
    .replace(/^\d+[\.\)]\s*/, '') // Strip leading enumeration numbering e.g. "2. CRISPY..."
    .replace(/^(?:Dish|Recipe)\s*\d*:?\s*/i, '')
    .replace(/^Title:\s*/i, '')
    .trim();

  // If merged from duplicate header: "TITLE - TITLE"
  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
      str = parts[0].trim();
    }
  }

  return str.trim();
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
