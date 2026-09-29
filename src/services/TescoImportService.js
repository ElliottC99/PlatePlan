/**
 * src/services/TescoImportService.js (v3.8.1)
 * Isolated pure data parsing service for Tesco bookmarklet imports.
 * Quarantined from the DOM and direct database operations.
 */

/**
 * Standard title-casing helper for product and brand names.
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Clean product name by stripping duplicated brand names and trailing pack sizes.
 * @param {string} rawName
 * @param {string} rawBrand
 * @returns {string}
 */
export function cleanProductName(rawName, rawBrand) {
  let name = String(rawName || '').trim();
  const brand = toTitleCase((rawBrand || '').trim());

  if (brand && brand !== 'Generic') {
    const re = new RegExp('\\b' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig');
    name = name.replace(re, '').trim();
  }

  // Remove trailing pack sizes (e.g., "226g", "2 x 113g", "1kg", "4 pack")
  name = name.replace(/\s+(?:\d+\s*[x×]\s*)?\d+(?:\.\d+)?\s*(g|kg|ml|l|pack)$/i, '').trim();
  name = name.replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
  return toTitleCase(name);
}

/**
 * Infer storage location ('freezer', 'fridge', 'cupboard') from breadcrumbs or text.
 * @param {string} breadcrumbs
 * @param {string} storageText
 * @returns {string}
 */
export function inferStorageLocation(breadcrumbs = '', storageText = '') {
  const bc = String(breadcrumbs || '').toLowerCase();
  const st = String(storageText || '').toLowerCase();

  if (bc.includes('frozen food') || bc.includes('frozen vegetables') || bc.includes('frozen meat') || bc.includes('frozen')) {
    return 'freezer';
  }
  if (bc.includes('fresh food') || bc.includes('chilled food') || bc.includes('fresh produce') || bc.includes('dairy') || bc.includes('fresh') || bc.includes('chilled')) {
    return 'fridge';
  }
  if (bc.includes('cupboard') || bc.includes('pasta rice') || bc.includes('tinned food') || bc.includes('baking')) {
    return 'cupboard';
  }

  if (st.includes('keep frozen') || st.includes('freeze') || st.includes('frozen')) {
    return 'freezer';
  }
  if (st.includes('keep refrigerated') || st.includes('fridge') || st.includes('chilled')) {
    return 'fridge';
  }
  if (st.includes('store in a cool') || st.includes('dry place') || st.includes('cupboard')) {
    return 'cupboard';
  }

  return '';
}

/**
 * Infer product category fallback from product name keywords.
 * @param {string} name
 * @returns {string}
 */
export function inferProductCategory(name = '') {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('pepper') || lower.includes('salad') || lower.includes('veg') || lower.includes('garlic')) {
    return 'vegetables';
  }
  if (lower.includes('quorn') || lower.includes('beyond') || lower.includes('meat free') || lower.includes('vegan chicken') || lower.includes('plant based') || lower.includes('plant-based')) {
    return 'meat-substitute';
  }
  if (lower.includes('tofu')) {
    return 'tofu-tempeh';
  }
  if (lower.includes('bean') || lower.includes('lentil') || lower.includes('chickpea')) {
    return 'legume';
  }
  return 'other';
}

/**
 * Guess individual item weight in grams.
 * @param {Object} data
 * @param {string} name
 * @returns {number|string}
 */
export function guessItemWeight(data, name = '') {
  if (!data) return '';
  const count = +data.itemCount || 0;
  const packSize = +data.drainedWeight || +data.packSize || 0;
  const explicit = +data.itemWeight || 0;
  if (explicit > 0) return explicit;
  if (count > 1 && packSize > 0) return Math.round((packSize / count) * 10) / 10;
  if (count === 1 && explicit > 0) return explicit;
  return '';
}

/**
 * Validate nutritional payload and return warning strings.
 * @param {Object} pv - Parsed nutrition values
 * @param {string} sourceName
 * @returns {string[]}
 */
export function validateNutritionValues(pv, sourceName = '') {
  const warnings = [];
  if (sourceName.includes('Not found')) {
    warnings.push("Nutrition table not found. Please expand the Nutrition section on Tesco and try again.");
  }
  if (pv.cal < 0 || pv.prot < 0 || pv.carb < 0 || pv.fat < 0 || pv.fibre < 0) {
    warnings.push("Negative nutrition values detected.");
  }
  if (pv.prot > 100 || pv.carb > 100 || pv.fat > 100) {
    warnings.push("Macronutrients exceed 100g (Check if basis is per 100g).");
  }
  if (!pv.cal && !pv.prot && !pv.fat) {
    warnings.push("Nutrition data appears to be completely empty.");
  }
  return warnings;
}

/**
 * Parse raw Tesco JSON payload string or object into a structured product extraction.
 * @param {string|Object} rawInput
 * @returns {{success: boolean, data?: Object, warnings?: string[], error?: string}}
 */
export function parseTescoProduct(rawInput) {
  if (!rawInput) {
    return { success: false, error: 'Please paste data first.' };
  }

  let raw = null;
  try {
    raw = typeof rawInput === 'string' ? JSON.parse(rawInput.trim()) : rawInput;
  } catch (e) {
    return { success: false, error: 'Invalid JSON format. Please use the bookmarklet to copy the correct data from Tesco.' };
  }

  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'Invalid payload structure.' };
  }

  const brand = toTitleCase((raw.brand || '').trim());
  const name = cleanProductName(raw.name, brand);
  const breadcrumbs = raw.diagnostics?.breadcrumbs || '';
  const storageText = raw.diagnostics?.storageText || '';
  const storage = inferStorageLocation(breadcrumbs, storageText);
  const category = raw.cat || inferProductCategory(name);

  const sv = raw.diagnostics?.sourceValues || {};
  const pvRaw = raw.diagnostics?.parsedValues || { cal: raw.cal, prot: raw.prot, carb: raw.carb, fat: raw.fat, fibre: raw.fibre };
  const nsrc = raw.diagnostics?.nutritionSource || 'Fallback / Legacy Import';
  const nbasis = raw.diagnostics?.nutritionBasis || 'unknown';

  const sourceEnergy = sv.energy ?? sv.cal ?? sv.kcal ?? sv['energy'] ?? sv['Energy'] ?? null;
  const parsedEnergy = pvRaw.energy ?? pvRaw.kcal ?? pvRaw.cal ?? raw.energy ?? raw.cal;
  const richSourceEnergy = typeof sourceEnergy === 'string' && /(kcal|kj|\/)/i.test(sourceEnergy);
  const energyValue = richSourceEnergy ? sourceEnergy : (parsedEnergy ?? sourceEnergy);

  const cal = Math.max(0, +energyValue || +pvRaw.cal || +raw.cal || 0);
  const prot = Math.max(0, Math.round((+pvRaw.prot || +raw.prot || 0) * 10) / 10);
  const carb = Math.max(0, Math.round((+pvRaw.carb || +raw.carb || 0) * 10) / 10);
  const fat = Math.max(0, Math.round((+pvRaw.fat || +raw.fat || 0) * 10) / 10);
  const fibre = Math.max(0, Math.round((+pvRaw.fibre || +raw.fibre || 0) * 10) / 10);

  const normalisedPv = { cal, prot, carb, fat, fibre };
  const warnings = validateNutritionValues(normalisedPv, nsrc);

  const itemWeightGuess = guessItemWeight(raw, name);
  const realItemCount = +raw.itemCount || 0;
  const countablePack = realItemCount > 1 && itemWeightGuess;
  const importedPackUnit = String(raw.packUnit || 'g').toLowerCase();
  const importedItemUnit = String(raw.itemWeightUnit || 'g').toLowerCase() === 'ml' ? 'ml' : 'g';
  const totalPackAmount = countablePack && importedPackUnit === 'qty' ? realItemCount * itemWeightGuess : (raw.packSize || '');

  return {
    success: true,
    data: {
      raw,
      name,
      brand,
      price: raw.price || '',
      packSize: totalPackAmount,
      packUnit: countablePack ? importedItemUnit : importedPackUnit,
      itemWeight: itemWeightGuess,
      itemWeightUnit: raw.itemWeightUnit || 'g',
      drainedWeight: raw.drainedWeight || '',
      drainedWeightUnit: raw.drainedWeightUnit || 'g',
      itemCount: realItemCount,
      storage,
      cat: category,
      cal,
      prot,
      carb,
      fat,
      fibre,
      nsrc,
      nbasis,
      breadcrumbs,
      sourceValues: sv,
      parsedValues: pvRaw,
      normalisedValues: normalisedPv
    },
    warnings
  };
}

/**
 * Pure factory creating a normalized ingredient product object.
 * @param {Object} data
 * @returns {Object}
 */
export function createTescoIngredientFromData(data) {
  return {
    id: 'ing' + Date.now(),
    name: data.name,
    brand: data.brand || '',
    cat: data.cat || 'other',
    storage: data.storage || '',
    cal: +data.cal || 0,
    fat: +data.fat || 0,
    carb: +data.carb || 0,
    fibre: +data.fibre || 0,
    prot: +data.prot || 0,
    price: +data.price || null,
    packSize: +data.packSize || null,
    packUnit: data.packUnit || 'g',
    itemWeight: +data.itemWeight || null,
    itemWeightUnit: data.itemWeightUnit || 'g',
    drainedWeight: +data.drainedWeight || null,
    drainedWeightUnit: data.drainedWeightUnit || 'g',
    notes: data.notes || '',
    sourceUrl: data.sourceUrl || null,
    itemCount: data.itemCount || null,
    meatSubstituteFor: null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Pure function to append a pack variant option to an ingredient.
 * @param {Object} match
 * @param {Object} data
 * @returns {Object}
 */
export function addTescoPackVariant(match, data) {
  if (!match) return match;
  if (!match.packOptions) match.packOptions = [];

  if (match.packSize && match.price && match.packOptions.length === 0) {
    match.packOptions.push({
      packSize: match.packSize,
      packUnit: match.packUnit || 'g',
      price: match.price,
      itemWeight: match.itemWeight || null,
      itemWeightUnit: match.itemWeightUnit || 'g',
      drainedWeight: match.drainedWeight || null,
      drainedWeightUnit: match.drainedWeightUnit || 'g'
    });
  }

  match.packOptions.push({
    packSize: data.packSize,
    packUnit: data.packUnit || 'g',
    price: data.price,
    itemWeight: data.itemWeight || null,
    itemWeightUnit: data.itemWeightUnit || 'g',
    drainedWeight: data.drainedWeight || null,
    drainedWeightUnit: data.drainedWeightUnit || 'g',
    sourceUrl: data.sourceUrl || null,
    itemCount: data.itemCount || null
  });

  if (data.drainedWeight) {
    match.drainedWeight = data.drainedWeight;
    match.drainedWeightUnit = data.drainedWeightUnit || 'g';
  }
  if (data.sourceUrl) {
    match.sourceUrl = match.sourceUrl || data.sourceUrl;
  }
  match.updatedAt = new Date().toISOString();
  return match;
}
