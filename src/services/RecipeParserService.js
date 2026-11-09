/**
 * src/services/RecipeParserService.js (v3.32.9)
 * Multi-Recipe Batch Parsing, Token Normalisation, Block Chunking,
 * Collapsed Ingredient Unpacking & Method Step Splitting.
 */

import { toTitleCase, parseIngredientString, matchIngredientTaxonomy } from './RecipeIngredientParser.js';

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isMethodHeader = l => /^(?:#+\s*)?(?:Method\s+Instructions|Method|Instructions|Steps|Preparation):?/i.test(l.trim());
const isIngredientsHeader = l => /^(?:#+\s*)?(?:main\s+)?ingredients?:?/i.test(l.trim());

const isExplicitRecipeHeader = l => {
  const t = l.trim();
  if (/^(?:Recipe|Dish)\s*(?:#?\s*\d+[:\.\-\s]?|[:\-])|^(?:Recipe\s*)?(?:Title|Name):/i.test(t)) return true;
  if (/^#+\s+/.test(t)) {
    const withoutHash = t.replace(/^#+\s*/, '').trim();
    if (isIngredientsHeader(withoutHash) || isMethodHeader(withoutHash)) return false;
    if (/^(?:notes|equipment|yield|servings):?/i.test(withoutHash)) return false;
    return true;
  }
  return false;
};

/**
 * Splits raw multi-recipe text into distinct recipe blocks using a semantic
 * state machine that handles unnumbered recipes, dividers, markdown and glued headers.
 * @param {string} rawText
 * @returns {string[]}
 */
export function unpackAndSplitRecipeBlocks(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  let clean = rawText.replace(/\r\n/g, '\n').trim();

  // 1. Expand glued structural headers without preceding newlines
  const structural = ['Recipe Title:', 'Total Servings:', 'Prep Time:', 'Cook Time:', 'Ingredients:', 'Method Instructions:', 'Instructions:', 'Method:'];
  structural.forEach(h => { clean = clean.replace(new RegExp(`([^\\n])(${h})`, 'gi'), '$1\n$2'); });

  // 2. Normalise dividers and ensure headers have clear boundaries
  clean = clean.replace(/(?:^|\n)\s*[-=_*~]{3,}\s*(?:\n|$)/g, '\n\n__RECIPE_SPLIT__\n\n')
    .replace(/([^\n])\n*((?:Dish|Recipe)\s*(?:#?\s*\d+[:\.\-\s]?|[:\-])|(?:Recipe\s*)?(?:Title|Name):)/gi, '$1\n\n$2');

  // 3. Line-by-line semantic state machine
  const lines = clean.split('\n');
  const blocks = [];
  let currentBlockLines = [];
  let seenIngredients = false, seenMethod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim();

    if (trimmed.includes('__RECIPE_SPLIT__')) {
      if (currentBlockLines.length > 0) blocks.push(currentBlockLines.join('\n').trim());
      currentBlockLines = []; seenIngredients = false; seenMethod = false;
      continue;
    }

    let isNewBoundary = false;
    if (isExplicitRecipeHeader(trimmed) && currentBlockLines.length > 0 && (seenIngredients || seenMethod)) {
      isNewBoundary = true;
    }

    // Semantic transition: Ingredients header after method indicates next recipe
    if (seenMethod && isIngredientsHeader(trimmed) && !isNewBoundary) {
      const candidates = [];
      while (currentBlockLines.length > 0) {
        const last = currentBlockLines[currentBlockLines.length - 1].trim();
        if (!last) { currentBlockLines.pop(); break; }
        if (isMethodHeader(last) || /^\d+[\.\)]/.test(last)) break;
        candidates.unshift(currentBlockLines.pop());
      }
      if (currentBlockLines.length > 0) blocks.push(currentBlockLines.join('\n').trim());
      currentBlockLines = [...candidates];
      seenIngredients = false; seenMethod = false;
    }

    if (isNewBoundary) {
      if (currentBlockLines.length > 0) blocks.push(currentBlockLines.join('\n').trim());
      currentBlockLines = []; seenIngredients = false; seenMethod = false;
    }

    if (isIngredientsHeader(trimmed)) seenIngredients = true;
    if (isMethodHeader(trimmed)) seenMethod = true;
    currentBlockLines.push(line);
  }

  if (currentBlockLines.length > 0) blocks.push(currentBlockLines.join('\n').trim());

  const valid = blocks.filter(b => b.length > 20 && (isIngredientsHeader(b) || isMethodHeader(b) || /ingredients?:/i.test(b)));
  return valid.length > 0 ? valid : [rawText.trim()];
}

/**
 * Unpacks collapsed ingredients by separating subsections, unspaced units and quantities.
 * @param {string} rawIngText
 * @returns {string}
 */
export function unpackCollapsedIngredients(rawIngText) {
  if (!rawIngText || typeof rawIngText !== 'string') return '';
  let text = rawIngText.replace(/\r\n/g, '\n').trim();

  // 1. Mask parentheticals to protect inner weights & serving notes e.g. "(about 160g)", "(to serve, optional)"
  const parens = [];
  text = text.replace(/\([^)]*\)/g, m => { parens.push(m); return `###PAREN_${parens.length - 1}###`; });

  // 2. Separate subsections e.g. "For the chips:", "To serve:"
  text = text.replace(/([^\n,])\s*(FOR THE\s+[A-Za-z\s]+:|TO SERVE:)/gi, '$1\n\n$2\n')
    .replace(/\)\s*(?=[0-9a-zA-Z])/g, ')\n');

  // 3. Separate letters followed immediately by ANY quantity (never splits inside parens)
  text = text.replace(/([a-zA-Z])(?=(?:0\.\d+|[1-9]\d*(?:\.\d+)?)(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:x\s*\d+|g|kg|ml|l|tbsp|tsp|cm|packs?|cloves?|spring|tin|pot|large|medium|small|pieces?|blocks?|handful|bunch|drizzle|pinch|aubergine|onion|[a-zA-Z]+))/gi, '$1\n');

  // 4. Separate known descriptor phrases glued to words without numbers
  const unspacedTokens = ['bunch of', 'handful of', 'a few', 'nooch', 'flat-leaf', 'drizzle of', 'pinch of', 'vegetable oil', 'olive oil', 'sun-dried tomatoes', 'cornflour'];
  unspacedTokens.forEach(tok => { text = text.replace(new RegExp(`([a-zA-Z])(${tok})`, 'gi'), '$1\n$2'); });

  // 5. Restore parentheticals cleanly
  text = text.replace(/###PAREN_(\d+)###/g, (_, i) => parens[Number(i)]);

  // 6. Stitch standalone multiplier lines ("1 x\n280g" -> "1 x 280g")
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const stitched = [];
  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i];
    if (/^\d+(?:\.\d+)?\s*[xX]$/.test(curr) && i + 1 < lines.length) {
      stitched.push(`${curr} ${lines[i + 1]}`);
      i++;
    } else {
      stitched.push(curr);
    }
  }
  return stitched.join('\n');
}

/**
 * Pre-normalizes single-line and social-media recipe captions (such as TikTok / Instagram captions)
 * into structured lines with Ingredients: and Method: boundaries when explicit headers are absent.
 * @param {string} rawBlock
 * @returns {string}
 */
function normalizeSocialCaptionText(rawBlock) {
  if (!rawBlock || typeof rawBlock !== 'string') return '';
  let text = rawBlock.replace(/\r\n/g, '\n').trim();

  // 1. Strip trailing social sign-offs ("ENJOY!") and markdown or plain hashtag blocks at the end
  text = text.replace(/\s*(?:ENJOY!?\s*)?(?:\s*(?:\[#[^\]]+\]\([^)]*\)|#[a-zA-Z0-9_]+))+\s*$/i, '').trim();
  text = text.replace(/(?<=[.!?])\s*ENJOY!?\s*$/i, '').trim();

  // 2. Separate a leading ALL-CAPS title glued directly to a Capitalized+lowercase sentence
  text = text.replace(/^([A-Z0-9\s&'’\-]{3,}[A-Z])(?=[A-Z][a-z]{2,})/, '$1\n');

  // 3. Place "Makes X-Y servings." / "Serves: X" onto its own line when glued to preceding text
  text = text.replace(/([^\n])\s*((?:(?:Makes|Serves)\s+\d+(?:\s*[-–to]+\s*\d+)?\s+servings?\.?|(?:Serves|Yield|Servings|Total\s+Servings):\s*\d+(?:\s*[-–to]+\s*\d+)?(?:\s*(?:servings?|portions?))?\.?))/gi, '$1\n$2\n');

  // 4. Remove inline "* If you're using..." / "* Note..." footnote explanations before numbered Step 1
  text = text.replace(/\*\s+(?:If\b|Note\b|You\s+can\b|Use\b|Adjust\b)[\s\S]*?(?=(?:\n|\s)*1[\.\)]\s+[A-Z])/gi, '\n');

  // 5. Separate inline "For the <section>:" headers when glued to preceding words
  text = text.replace(/([^\n])\s*(For\s+the\s+[A-Za-z\s]+:|To\s+serve:)/gi, '$1\n$2\n');

  // 6. Expand Unicode square/round bullets onto their own lines and unpack inline "- qty" subsections
  if (/(?:▫️|▪️|[•●◦▪▫])/.test(text)) {
    text = text.replace(/\s*(?:▫️|▪️|[•●◦▪▫])\s*/g, '\n▫️ ');
    const rawLines = text.split('\n');
    const expandedLines = [];
    let insertedIngredientsHeader = /(?:^|\n)\s*(?:#+\s*)?(?:main\s+)?ingredients?:?/i.test(text);

    for (const rawLine of rawLines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('▫️')) {
        if (!insertedIngredientsHeader) {
          expandedLines.push('Ingredients:');
          insertedIngredientsHeader = true;
        }
        const content = trimmed.replace(/^▫️\s*/, '').trim();
        const subParts = content.split(/(?<!\d)-\s+(?=(?:\d|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]))/).map(p => p.trim()).filter(Boolean);
        if (
          subParts.length > 1 &&
          !/^(?:\d|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|a\b|an\b|one\b|two\b|three\b|four\b|five\b|half\b|pinch\b|handful\b|dash\b|drizzle\b)/i.test(subParts[0])
        ) {
          const secHeader = subParts[0].replace(/:$/, '').trim();
          expandedLines.push(`${secHeader}:`);
          for (let j = 1; j < subParts.length; j++) {
            expandedLines.push(subParts[j]);
          }
        } else {
          expandedLines.push(content);
        }
      } else {
        expandedLines.push(trimmed);
      }
    }
    text = expandedLines.join('\n');
  }

  // 7. Split inline numbered method steps glued to sentence punctuation (e.g. ".1. Preheat... .2. In a...")
  text = text.replace(/([.!?])\s*(?=[1-9]\d?[\.\)]\s+[A-Z])/g, '$1\n');

  // 8. If no explicit Method/Instructions header exists, insert "Method:" before "1. <Step>" when "2. <Step>" also exists
  if (!/(?:^|\n)\s*(?:#+\s*)?(?:Method\s+Instructions|Method|Instructions|Steps|Preparation):?/i.test(text)) {
    if (/(?:^|\n)\s*1[\.\)]\s+[A-Z][\s\S]*?(?:^|\n)\s*2[\.\)]\s+[A-Z]/.test(text)) {
      text = text.replace(/((?:^|\n)\s*)(1[\.\)]\s+[A-Z])/, '$1Method:\n$2');
    }
  }

  return text.trim();
}

/**
 * Unpacks collapsed method instructions into individual steps.
 * Handles numbered lines, inline numbered steps (1. ... 2. ...), step prefixes (Step 1: ...),
 * bullet points, and paragraph breaks.
 * @param {string} rawMethodText
 * @returns {string[]}
 */
export function unpackCollapsedSteps(rawMethodText) {
  if (!rawMethodText || typeof rawMethodText !== 'string') return [];
  let text = rawMethodText.replace(/\r\n/g, '\n').trim();

  // Strip trailing social sign-offs ("ENJOY!") and hashtags
  text = text.replace(/\s*(?:ENJOY!?\s*)?(?:\s*(?:\[#[^\]]+\]\([^)]*\)|#[a-zA-Z0-9_]+))+\s*$/i, '').trim();
  text = text.replace(/(?<=[.!?])\s*ENJOY!?\s*$/i, '').trim();

  // 1. Separate "Step 1:", "Step 1.", "Step 1 -" with newlines
  text = text.replace(/(\bStep\s*\d+[:\.\-]?\s*)/gi, '\n\n$1\n');

  // 2. Separate inline numbered steps (e.g. "... 2. Add onions ..." or "...fan.2. In a...")
  text = text.replace(/([\.!?])\s*(?=(?:[1-9]\d?[\.\)])\s+[A-Za-z])/g, '$1\n\n');
  text = text.replace(/(?:^|\n|\s+)(?=(?:[1-9]\d?[\.\)])\s+[A-Za-z])/g, '\n\n');

  // 3. Separate bulleted items: •, -, * followed by space and letter
  text = text.replace(/([\.!?])\s*(?=[•\*\-]\s+[A-Za-z])/g, '$1\n\n');
  text = text.replace(/(?:^|\n|\s+)(?=[•\*\-]\s+[A-Za-z])/g, '\n\n');

  // 4. Split on newlines and clean step prefixes
  const rawList = text.split(/(?:\n\s*\n|\n)/).map(s => s.trim()).filter(Boolean);

  const cleanSteps = [];
  rawList.forEach(line => {
    // Strip leading numbering, bullets, or Step prefixes: e.g. "1. ", "1) ", "Step 1: ", "• ", "- "
    const cleaned = line
      .replace(/^(?:Step\s*\d+[:\.\-]?\s*|[0-9]+[\.\)]\s*|[•\*\-]\s*)/i, '')
      .trim();
    if (cleaned.length > 0) {
      cleanSteps.push(cleaned);
    }
  });

  return cleanSteps.length > 0 ? cleanSteps : [rawMethodText.trim()];
}

/**
 * Parses a single recipe text block into a complete recipe object.
 * @param {string} block
 * @param {Array} ingredientsBank
 * @returns {Object|null}
 */
export function parseSingleRecipeText(block, ingredientsBank = []) {
  if (!block || typeof block !== 'string') return null;
  block = normalizeSocialCaptionText(block);

  const ingMatch = block.match(/(?:^|\n)\s*(?:#+\s*)?(?:main\s+)?ingredients?:?\s*/i);
  const methodMatch = block.match(/(?:^|\n)\s*(?:#+\s*)?(?:Method\s+Instructions|Method|Instructions|Steps|Preparation):?\s*/i);

  let headerText = block, rawIngText = '', rawMethodText = '';

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

  // Prevent greedy method ingestion if boundary marker or secondary ingredients header exists
  if (rawMethodText) {
    const boundary = rawMethodText.match(/(?:\n\s*\n|\n)(?=(?:(?:Recipe|Dish)\s*(?:#?\s*\d+[:\.\-\s]?|[:\-])|(?:Recipe\s*)?(?:Title|Name):|[#]+\s+|(?:main\s+)?ingredients?:))/i);
    if (boundary) rawMethodText = rawMethodText.slice(0, boundary.index);
  }

  let title = 'Imported Recipe', servings = null, prepMinutes = 15, cookMinutes = 30;
  const headerLines = headerText.split('\n').map(l => l.trim()).filter(Boolean);

  headerLines.forEach((line, idx) => {
    if (/^(?:Recipe\s*)?(?:Title|Name):/i.test(line)) {
      const ext = cleanRecipeTitle(line.replace(/^(?:Recipe\s*)?(?:Title|Name):/i, ''));
      if (ext) title = ext;
      return;
    }
    if (/^(?:Dish|Recipe)\s+#?\s*\d+[:\.\-]?\s*(.*)/i.test(line)) {
      const match = line.match(/^(?:Dish|Recipe)\s+#?\s*\d+[:\.\-]?\s*(.*)/i);
      const ext = cleanRecipeTitle(match[1]);
      if (ext) title = ext;
      return;
    }
    if (/^(?:Makes|Serves|Yield|Servings|Total\s+Servings)\b/i.test(line)) {
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

  const sectionsMap = { 'Main Ingredients': [] };
  let currentSectionTitle = 'Main Ingredients';

  if (rawIngText) {
    const unpackedIngText = unpackCollapsedIngredients(rawIngText);
    const rawIngLines = unpackedIngText.split('\n').map(l => l.trim()).filter(Boolean);
    const ingLines = [];
    for (let i = 0; i < rawIngLines.length; i++) {
      let line = rawIngLines[i];
      if (/^\d+\s*x$/i.test(line) && i + 1 < rawIngLines.length) {
        line = `${line} ${rawIngLines[i + 1]}`;
        i++;
      }
      ingLines.push(line);
    }

    ingLines.forEach(line => {
      if (/^(?:for\s+the\s+[a-zA-Z\s]+:?|to\s+serve:?|[a-zA-Z\s]+:)$/i.test(line) && !/^\d+\b|serves|yield|prep|cook/i.test(line)) {
        let cleanSec = line.replace(':', '').trim();
        cleanSec = cleanSec.replace(/^for\s+the\s+to\s+serve/i, 'To Serve').replace(/^for\s+the\s+/i, '');
        currentSectionTitle = toTitleCase(cleanSec);
        if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];
        return;
      }
      parseIngredientLine(line, currentSectionTitle, sectionsMap, ingredientsBank);
    });
  }

  const ingredientSections = Object.entries(sectionsMap)
    .filter(([_, list]) => list.length > 0)
    .map(([sec, list]) => ({ sectionTitle: toTitleCase(sec), ingredients: list }));

  if (ingredientSections.length === 0) {
    ingredientSections.push({ sectionTitle: 'Main Ingredients', ingredients: [] });
  }

  const rawSteps = unpackCollapsedSteps(rawMethodText);
  const methodSteps = rawSteps.map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);

  return {
    title: toTitleCase(title),
    servings,
    prepTime: { hours: Math.floor(prepMinutes / 60), minutes: prepMinutes % 60 },
    cookTime: { hours: Math.floor(cookMinutes / 60), minutes: cookMinutes % 60 },
    mealSuitability: ['Dinner'],
    ingredientSections,
    ingredients: ingredientSections.flatMap(s => s.ingredients),
    instructions: methodSteps,
    methodSteps,
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
  };
}

/**
 * Parses multi-recipe raw text into an array of parsed recipe objects.
 * Reallocates instructions if recipes and methods were listed in separate grouped sections.
 * @param {string} text
 * @param {Array} ingredientsBank
 * @returns {Array}
 */
export function parseBulkRecipeText(text, ingredientsBank = []) {
  if (!text || typeof text !== 'string') return [];
  const blocks = unpackAndSplitRecipeBlocks(text);
  const parsed = blocks
    .map(b => parseSingleRecipeText(b, ingredientsBank))
    .filter(r => r && (r.title || (r.ingredientSections && r.ingredientSections.some(s => s.ingredients.length))));

  reallocateGroupedInstructions(text, parsed);
  return parsed;
}

/**
 * Detects grouped layouts (all ingredients at top, methods grouped at bottom)
 * and allocates instruction blocks to their respective recipes by title matching.
 */
function reallocateGroupedInstructions(rawText, parsedRecipes) {
  if (!parsedRecipes || parsedRecipes.length <= 1) return;
  const methodMatch = rawText.match(/(?:^|\n)\s*(?:Instructions|Methods|Method Instructions|Directions):\s*\n([\s\S]+)$/i);
  if (!methodMatch) return;
  const methodsBlock = methodMatch[1];

  const matchingRecipes = parsedRecipes.filter(r => {
    const clean = r.title.trim().toLowerCase();
    return clean.length > 3 && new RegExp(`(?:^|\\n)\\s*(?:\\d+[\\.\\)]\\s*)?(?:Dish|Recipe\\s*\\d*[:\\.\\-\\s]*)?${escapeRegex(clean)}[:\\s]`, 'i').test(methodsBlock);
  });

  if (matchingRecipes.length >= 1) {
    matchingRecipes.forEach(recipe => {
      const cleanTitle = recipe.title.trim().toLowerCase();
      const lines = methodsBlock.split('\n');
      let capturing = false;
      const captured = [];

      for (const line of lines) {
        const norm = line.trim().toLowerCase().replace(/^(?:recipe|dish)?\s*\d*[:\.\-\s]*/i, '').replace(/[:#]+$/, '').trim();
        if (norm === cleanTitle || (cleanTitle.length > 4 && norm.startsWith(cleanTitle))) {
          capturing = true;
          continue;
        }
        if (capturing) {
          const isOther = parsedRecipes.some(o => o !== recipe && (norm === o.title.trim().toLowerCase() || (o.title.length > 4 && norm.startsWith(o.title.trim().toLowerCase()))));
          if (isOther) break;
          captured.push(line);
        }
      }

      if (captured.length > 0) {
        const steps = captured.join('\n').trim().split(/(?:\n\s*\n|\n(?=\d+[\.\)]\s+))/g).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
        if (steps.length > 0) {
          recipe.instructions = steps;
          recipe.methodSteps = steps;
        }
      }
    });
  }
}

function cleanRecipeTitle(raw) {
  if (!raw) return '';
  let str = String(raw)
    .replace(/^__RECIPE_SPLIT__\s*[-–—]?\s*/i, '')
    .replace(/^#+\s*/, '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/^(?:Dish|Recipe)\s*\d*:?\s*/i, '')
    .replace(/^Title:\s*/i, '')
    .trim();
  if (str.includes(' - ')) {
    const parts = str.split(' - ');
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) str = parts[0].trim();
  }
  return str.trim();
}

function parseDurationMinutes(line) {
  let mins = 0;
  const hrMatch = line.match(/(\d+)\s*(?:h|hr|hours?)\b/i), minMatch = line.match(/(\d+)\s*(?:m|min|mins|minutes?)\b/i);
  if (hrMatch) mins += parseInt(hrMatch[1], 10) * 60;
  if (minMatch) mins += parseInt(minMatch[1], 10);
  if (!hrMatch && !minMatch) { const raw = line.match(/\d+/); if (raw) mins = parseInt(raw[0], 10); }
  return mins || 15;
}

function parseIngredientLine(line, currentSectionTitle, sectionsMap, ingredientsBank) {
  if (!line || /^[:\-\*•\s]+$/.test(line.trim())) return;
  if (!sectionsMap[currentSectionTitle]) sectionsMap[currentSectionTitle] = [];

  // Protect parentheticals from quantity splits e.g. "(about 160g)", "(to serve, optional)"
  const parens = [];
  const safeLine = line.replace(/\([^)]*\)/g, m => { parens.push(m); return `###PAREN_${parens.length - 1}###`; });

  const rawSubLines = safeLine.split(/(?<=[^\n])\s+(?=\d+(?:\.\d+)?\s*(?:g|kg|ml|l|tbsp|tsp|cup|cloves?|cans?|packs?|pinches?|slices?|handfuls?|bunches?|stalks?)\b)/gi);
  rawSubLines.forEach(subLine => {
    const unmasked = subLine.replace(/###PAREN_(\d+)###/g, (_, i) => parens[Number(i)]).trim();
    if (!unmasked || /^[:\-\*•\s]+$/.test(unmasked)) return;
    const parsed = parseIngredientString(unmasked);
    if (parsed) {
      const matched = matchIngredientTaxonomy(parsed, ingredientsBank);
      if (matched) {
        const destSection = (parsed.isToServe && currentSectionTitle.toLowerCase() !== 'to serve') ? 'To Serve' : currentSectionTitle;
        if (!sectionsMap[destSection]) sectionsMap[destSection] = [];
        sectionsMap[destSection].push(matched);
      }
    }
  });
}
