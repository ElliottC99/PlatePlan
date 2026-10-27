/**
 * src/services/RecipeAuthoringService.js (v3.8.3)
 * Pure recipe authoring schema constructors, fuzzy typeahead matchers,
 * alias synchronization, and step/ingredient normalizers.
 * Quarantined from page DOM queries and direct database operations.
 */

import { safeJsonStringify } from '../utils/safeJson.js';

export function getSearchVariants(str) {
  const q = (str || '').toLowerCase().trim();
  if (!q) return [];
  const alt1 = q.replace(/hummus/g, 'houmous').replace(/yogurt/g, 'yoghurt');
  const alt2 = q.replace(/houmous/g, 'hummus').replace(/yoghurt/g, 'yogurt');
  return [...new Set([q, alt1, alt2])];
}

export function canonicalGroupKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normaliseAliasText(alias) {
  return String(alias || '').replace(/\s+/g, ' ').trim();
}

export function addIngredientGroupAlias(group, alias) {
  const clean = normaliseAliasText(alias);
  if (!group || !clean) return false;
  if (!Array.isArray(group.aliases)) group.aliases = [];
  const key = canonicalGroupKey(clean);
  if (!key || group.aliases.some(a => canonicalGroupKey(a) === key)) return false;
  group.aliases.push(clean);
  return true;
}

export function addIngredientFamilyAlias(family, alias) {
  const clean = normaliseAliasText(alias);
  if (!family || !clean) return false;
  if (!Array.isArray(family.aliases)) family.aliases = [];
  const key = canonicalGroupKey(clean);
  if (!key || canonicalGroupKey(family.name) === key || family.aliases.some(a => canonicalGroupKey(a) === key)) return false;
  family.aliases.push(clean);
  return true;
}

export function syncIngredientGroupAliases(group, products = []) {
  if (!group) return;
  if (!Array.isArray(group.aliases)) group.aliases = [];
  group.aliases = group.aliases
    .map(normaliseAliasText)
    .filter(Boolean)
    .filter((alias, idx, arr) => arr.findIndex(a => canonicalGroupKey(a) === canonicalGroupKey(alias)) === idx);
  addIngredientGroupAlias(group, group.name);
  (products || []).forEach(product => {
    addIngredientGroupAlias(group, product?.name);
  });
}

export function fuzzyMatchBank(name, ingredients = []) {
  if (!name || !Array.isArray(ingredients)) return null;
  const variants = getSearchVariants(name);
  let best = null, bestScore = 0;

  for (const ing of ingredients) {
    if (!ing?.name) continue;
    const ingWords = ing.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    if (!ingWords.length) continue;

    variants.forEach(variant => {
      const words = variant.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      if (!words.length) return;
      const intersection = words.filter(w => ingWords.some(iw => iw.includes(w) || w.includes(iw)));
      const union = new Set([...words, ...ingWords]);
      const score = intersection.length / union.size;
      if (score > bestScore) {
        bestScore = score;
        best = ing;
      }
    });
  }
  return bestScore >= 0.4 ? best : null;
}

export function fuzzyMatchIngredientGroup(name, groups = []) {
  if (!name || !Array.isArray(groups) || !groups.length) return null;
  const variants = getSearchVariants(name);
  let best = null, bestScore = 0;

  for (const group of groups) {
    if (!group) continue;
    const exactFields = [group.name, group.family, ...(group.aliases || [])].map(canonicalGroupKey);
    if (variants.some(variant => exactFields.includes(canonicalGroupKey(variant)))) return group;

    const haystack = [group.name, group.family, group.category, ...(group.aliases || [])].filter(Boolean).join(' ');
    const groupWords = haystack.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    if (!groupWords.length) continue;

    variants.forEach(variant => {
      const words = variant.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
      if (!words.length) return;
      const intersection = words.filter(w => groupWords.some(gw => gw.includes(w) || w.includes(gw)));
      const union = new Set([...words, ...groupWords]);
      const score = intersection.length / union.size;
      if (score > bestScore) {
        bestScore = score;
        best = group;
      }
    });
  }
  return bestScore >= 0.35 ? best : null;
}

export function normaliseReviewCompareText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normaliseRecipeIngredientSection(section) {
  return normaliseAliasText(section || '');
}

export function orderRecipeIngredientsBySection(ingredients = []) {
  const rows = Array.isArray(ingredients) ? ingredients.slice() : [];
  const named = new Map();
  const blank = [];
  rows.forEach(item => {
    const section = normaliseRecipeIngredientSection(item?.section);
    if (!section) {
      blank.push(item);
      return;
    }
    if (!named.has(section)) named.set(section, []);
    named.get(section).push(item);
  });
  return [...named.values()].flat().concat(blank);
}

export function comparableReviewIngredients(ings = []) {
  return (ings || []).map(ing => ({
    qty: Math.round((+ing.qty || 0) * 1000) / 1000,
    unit: ing.unit || '',
    name: normaliseReviewCompareText(ing.name),
    section: normaliseReviewCompareText(ing.section),
    groupId: ing.groupId || '',
    bankId: ing.bankId || '',
    ingredientId: ing.ingredientId || '',
    mappedViaIngredient: !!ing.mappedViaIngredient,
    excludeNutrition: !!ing.excludeNutrition,
    stockWaterMl: +ing.stockWaterMl || 0
  }));
}

export function comparableReviewSteps(steps = []) {
  return (steps || [])
    .map(step => normaliseReviewCompareText(step))
    .filter(Boolean);
}

export function hasMeaningfulEnhancedChanges({ origName = '', enhName = '', changesText = '', origIngs = [], enhIngs = [], origSteps = [], enhSteps = [] }) {
  const defaultEnhName = origName ? `${origName} (enhanced)` : '';
  const cleanOrigName = normaliseReviewCompareText(origName);
  const cleanEnhName = normaliseReviewCompareText(enhName);
  const cleanDefaultEnhName = normaliseReviewCompareText(defaultEnhName);
  const nameChanged = !!cleanEnhName && cleanEnhName !== cleanOrigName && cleanEnhName !== cleanDefaultEnhName;
  const cleanChanges = normaliseReviewCompareText(changesText);
  const ingredientsChanged = safeJsonStringify(comparableReviewIngredients(origIngs)) !== safeJsonStringify(comparableReviewIngredients(enhIngs));
  const methodChanged = safeJsonStringify(comparableReviewSteps(origSteps)) !== safeJsonStringify(comparableReviewSteps(enhSteps));
  return nameChanged || !!cleanChanges || ingredientsChanged || methodChanged;
}

export function buildBlankRecipe(defaults = {}) {
  return {
    id: defaults.id || ('r' + Date.now()),
    name: defaults.name || 'Untitled Recipe',
    types: defaults.types || ['dinner'],
    serves: defaults.serves || 2,
    who: defaults.who || 'both',
    time: defaults.time || null,
    source: defaults.source || '',
    cal: 0,
    prot: 0,
    carb: 0,
    fat: 0,
    fibre: 0,
    nutrition: {
      total: { cal: 0, prot: 0, carb: 0, fat: 0, fibre: 0 },
      perServing: { cal: 0, prot: 0, carb: 0, fat: 0, fibre: 0 }
    },
    portions: { e: '', c: '' },
    ingredients: [],
    steps: [],
    estimated: false,
    enhanced: null,
    updatedAt: new Date().toISOString()
  };
}

export function buildRecipePayload({
  editId,
  origName = 'Untitled Recipe',
  types = ['dinner'],
  serves = 2,
  who = 'both',
  time = null,
  source = '',
  origPS = { cal: 0, prot: 0, carb: 0, fat: 0, fibre: 0 },
  origIngs = [],
  origSteps = [],
  origPortionE = '',
  origPortionC = '',
  enhName = '',
  enhPS = { cal: 0, prot: 0, carb: 0, fat: 0, fibre: 0 },
  enhIngs = [],
  enhSteps = [],
  enhPortionE = '',
  enhPortionC = '',
  enhChanges = '',
  useEnh = false
}) {
  const s = Math.max(1, serves);
  const origTotal = {
    cal: Math.round(origPS.cal * s),
    prot: Math.round(origPS.prot * s * 10) / 10,
    carb: Math.round(origPS.carb * s * 10) / 10,
    fat: Math.round(origPS.fat * s * 10) / 10,
    fibre: Math.round(origPS.fibre * s * 10) / 10
  };

  const enh = (useEnh && enhIngs.length > 0) ? {
    name: enhName || (origName ? `${origName} (enhanced)` : 'Enhanced Recipe'),
    ...enhPS,
    nutrition: {
      total: {
        cal: Math.round(enhPS.cal * s),
        prot: Math.round(enhPS.prot * s * 10) / 10,
        carb: Math.round(enhPS.carb * s * 10) / 10,
        fat: Math.round(enhPS.fat * s * 10) / 10,
        fibre: Math.round(enhPS.fibre * s * 10) / 10
      },
      perServing: enhPS
    },
    portionE: enhPortionE,
    portionC: enhPortionC,
    changes: enhChanges,
    ingredients: enhIngs,
    method: enhSteps,
    updatedAt: new Date().toISOString()
  } : null;

  return {
    id: editId || ('r' + Date.now()),
    name: origName,
    types,
    serves: s,
    who,
    time,
    source,
    ...origPS,
    nutrition: { total: origTotal, perServing: origPS },
    portions: { e: origPortionE, c: origPortionC },
    ingredients: origIngs,
    steps: origSteps,
    estimated: false,
    enhanced: enh,
    updatedAt: new Date().toISOString()
  };
}
