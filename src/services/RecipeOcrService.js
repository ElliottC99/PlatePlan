/**
 * src/services/RecipeOcrService.js (v3.7.4)
 * Pure data parsing & image preprocessing service for Recipe OCR.
 * Quarantined from page DOM queries and direct database operations.
 */

export function cleanLine(line) {
  return String(line || '').trim().replace(/^[-*•#\s]+/, '').trim();
}

export function toAPTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  const lowerWords = new Set(['a', 'an', 'the', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'of', 'for', 'and', 'but', 'or', 'nor']);
  const words = trimmed.split(/\s+/);
  return words.map((word, index) => {
    const lower = word.toLowerCase();
    if (index > 0 && index < words.length - 1 && lowerWords.has(lower)) return lower;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export function parseTimeToCleanMinutes(str) {
  if (str === null || str === undefined) return null;
  const s = String(str).toLowerCase().trim();
  if (!s) return null;

  const rangeMatch = s.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:mins?|minutes?)/i);
  if (rangeMatch) return Math.round((parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2);

  let totalSeconds = 0;
  let matched = false;

  const hrMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i);
  if (hrMatch) { totalSeconds += parseFloat(hrMatch[1]) * 3600; matched = true; }

  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m\b)/i);
  if (minMatch) { totalSeconds += parseFloat(minMatch[1]) * 60; matched = true; }

  const secMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s\b)/i);
  if (secMatch) { totalSeconds += parseFloat(secMatch[1]); matched = true; }

  if (matched) {
    const mins = Math.round(totalSeconds / 60);
    return mins > 0 ? mins : (totalSeconds > 0 ? 1 : null);
  }
  const numMatch = s.match(/\b(\d+)\b/);
  return numMatch ? parseInt(numMatch[1], 10) : null;
}

export function isIngredientLine(line) {
  const l = String(line || '').trim();
  if (!l) return false;
  return /^(?:[-•*]\s*)?(?:\d|½|¼|¾|one |two |a |an )/i.test(l) &&
    /\b(g|kg|ml|l|tsp|tbsp|cup|tin|can|bunch|clove|slice|handful|pinch|x|pack|block|onion|garlic|oil|salt|pepper|sauce|chicken|beef|egg|rice|pasta|cheese|butter|water|sugar|flour)\b/i.test(l);
}

export function splitPastedRecipeBlocks(rawText) {
  const text = String(rawText || '').replace(/\r/g, '').trim();
  if (!text) return [];

  const lines = text.split('\n');
  const headerIndices = [];
  lines.forEach((line, idx) => {
    if (/^\s*(?:Recipe\s*Title|Title|Recipe)\s*[:\-]/i.test(line) || /^\s*Recipe\s*#?\d+\s*[:\-]/i.test(line)) {
      headerIndices.push(idx);
    }
  });

  let blocks = [];
  if (headerIndices.length > 1) {
    for (let i = 0; i < headerIndices.length; i++) {
      const start = headerIndices[i];
      const end = (i + 1 < headerIndices.length) ? headerIndices[i + 1] : lines.length;
      const chunk = lines.slice(start, end).join('\n').trim();
      if (chunk) blocks.push(chunk);
    }
  } else if (/(?:\n\s*){3,}/.test(text)) {
    blocks = text.split(/(?:\n\s*){3,}/).map(c => c.trim()).filter(c => c.length > 15);
  }
  return blocks.length ? blocks : [text];
}

export function normaliseRecognisedRecipe(value) {
  return {
    name: toAPTitleCase(String(value?.name || '')),
    servings: (value?.servings !== null && value?.servings !== undefined) ? +value.servings : null,
    timeMinutes: (value?.timeMinutes !== null && value?.timeMinutes !== undefined) ? +value.timeMinutes : null,
    mealTypes: Array.isArray(value?.mealTypes) && value.mealTypes.length ? value.mealTypes : ['dinner'],
    sourceType: String(value?.sourceType || ''),
    bookTitle: String(value?.bookTitle || ''),
    author: String(value?.author || ''),
    page: String(value?.page || ''),
    url: String(value?.url || ''),
    ingredients: (value?.ingredients || []).map(String).filter(Boolean),
    method: (value?.method || []).map(String).filter(Boolean),
    warnings: (value?.warnings || []).map(String).filter(Boolean),
    rawText: String(value?.rawText || '')
  };
}

export function parseRobustRecipeText(raw) {
  const text = String(raw || '').replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return normaliseRecognisedRecipe({ rawText: '' });

  let servings = null;
  const servesMatch = text.match(/(?:Number of Servings|Original Servings|Original Serves|Servings|Serves)\s*[:\-]?\s*(\d+)/i);
  if (servesMatch) servings = parseInt(servesMatch[1], 10);

  const isMetaLine = l => /^(?:(?:Number of Servings|Original Servings|Original Serves|Servings?|Serves|Prep(?:aration)?(?:\s*time)?|Cook(?:\s*time)?|Total(?:\s*time)?|Time|Book|Cookbook|Author|By|Page|Source|Url|Link)\s*[:\-]|^https?:\/\/|^(?:ingredients?|method|instructions?|steps?)\b)/i.test(l);
  const firstMetaIdx = lines.findIndex(isMetaLine);
  let name = firstMetaIdx > 0 ? lines.slice(0, firstMetaIdx).join(' ').trim() : (lines[0] || '');
  name = toAPTitleCase(name.replace(/^(?:recipe\s*title|recipe\s*name|recipe|title)\s*[:\-]?\s*/i, '').trim());

  let timeMinutes = null;
  const prepTimeMatch = text.match(/(?:Prep(?:aration)?\s*time|Prep)\s*[:\-]?\s*([^\n\r|]+)/i);
  if (prepTimeMatch) timeMinutes = parseTimeToCleanMinutes(prepTimeMatch[1]);
  if (timeMinutes === null) {
    const totalTimeMatch = text.match(/(?:Total\s*time|Cook\s*time|Time)\s*[:\-]?\s*([^\n\r|]+)/i);
    if (totalTimeMatch) timeMinutes = parseTimeToCleanMinutes(totalTimeMatch[1]);
  }

  const ingHeaderIdx = lines.findIndex(l => /^(?:[-*•#\s]*)ingredients?\b/i.test(l));
  const methodHeaderIdx = lines.findIndex(l => /^(?:[-*•#\s]*)(?:method|instructions?|directions?|steps?|preparation)\b/i.test(l));

  let ingredients = [];
  let method = [];

  if (ingHeaderIdx >= 0 && methodHeaderIdx > ingHeaderIdx) {
    ingredients = lines.slice(ingHeaderIdx + 1, methodHeaderIdx);
    method = lines.slice(methodHeaderIdx + 1);
  } else if (ingHeaderIdx >= 0 && methodHeaderIdx < 0) {
    ingredients = lines.slice(ingHeaderIdx + 1);
  } else if (methodHeaderIdx >= 0 && ingHeaderIdx < 0) {
    method = lines.slice(methodHeaderIdx + 1);
  } else {
    lines.forEach(l => {
      if (l === name || /^(?:serves?|number of servings|prep|cook|total|time|recipe)\b/i.test(l)) return;
      if (isIngredientLine(l)) ingredients.push(l);
      else method.push(l);
    });
  }

  ingredients = ingredients.filter(l => !/^(?:ingredients?|method|instructions?|steps?)\s*:?$/i.test(l.trim()));
  method = method.filter(l => !/^(?:ingredients?|method|instructions?|steps?)\s*:?$/i.test(l.trim()));

  const lowerText = text.toLowerCase();
  const mealTypes = [];
  if (/breakfast|brekkie|pancake|porridge|waffle|granola|smoothie/.test(lowerText)) mealTypes.push('breakfast');
  if (/lunch|sandwich|salad|wrap|soup/.test(lowerText)) mealTypes.push('lunch');
  if (/dinner|curry|casserole|roast|pasta|stew|risotto|pie|stir-fry/.test(lowerText)) mealTypes.push('dinner');
  if (/snack|dessert|biscuit|cookie|cake|muffin/.test(lowerText)) mealTypes.push('snack');
  if (!mealTypes.length) mealTypes.push('dinner');

  let sourceType = '', bookTitle = '', author = '', page = '', url = '';
  const urlMatch = text.match(/(https?:\/\/[^\s\)\>\]]+)/i);
  if (urlMatch) {
    url = urlMatch[1];
    if (url.includes('tiktok.com')) sourceType = 'tiktok';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) sourceType = 'youtube';
    else if (url.includes('instagram.com')) sourceType = 'instagram';
    else sourceType = 'website';
  }

  const bookMatch = text.match(/(?:Book|From the book|Cookbook|Source)\s*:\s*([^\n\r,]+)/i);
  if (bookMatch && !sourceType) { sourceType = 'book'; bookTitle = bookMatch[1].trim(); }
  const authorMatch = text.match(/(?:Author|By)\s*:\s*([^\n\r,]+)/i);
  if (authorMatch) author = authorMatch[1].trim();
  const pageMatch = text.match(/(?:Page|p\.?)\s*[:\-]?\s*(\d+)/i);
  if (pageMatch) page = pageMatch[1].trim();

  return normaliseRecognisedRecipe({
    name, servings, timeMinutes, ingredients, method, mealTypes,
    sourceType, bookTitle, author, page, url, warnings: [], rawText: text
  });
}

export function getRecipeRecognitionSchema() {
  return {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      servings: { type: 'NUMBER' },
      timeMinutes: { type: 'NUMBER' },
      sourceType: { type: 'STRING' },
      bookTitle: { type: 'STRING' },
      author: { type: 'STRING' },
      page: { type: 'STRING' },
      ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
      method: { type: 'ARRAY', items: { type: 'STRING' } },
      warnings: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['name', 'ingredients', 'method', 'warnings']
  };
}

export async function prepareRecipePhoto(file) {
  let source;
  if (typeof createImageBitmap === 'function') {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } else {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Photo could not be opened.')); };
      img.src = url;
    });
  }

  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const scale = Math.min(1, 2000 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(source, 0, 0, width, height);
  if (typeof source.close === 'function') source.close();

  let blob;
  if (canvas.convertToBlob) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  } else {
    blob = await new Promise((resolve, reject) =>
      canvas.toBlob(v => (v ? resolve(v) : reject(new Error('Photo could not be prepared.'))), 'image/jpeg', 0.86)
    );
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  return { blob, dataUrl, base64: String(dataUrl).split(',')[1], mimeType: 'image/jpeg' };
}
