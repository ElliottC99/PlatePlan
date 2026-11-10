/**
 * src/utils/macroScoringUtils.js (v3.38.63)
 * Pure mathematical utilities for macro extraction and fit score curve interpolation.
 */

import { getState } from '../store/coreState.js';
import { resolveFitScoreParams } from './fitScoreWeights.js';
import { calculateItemNutrition } from '../services/NutritionService.js';
import { resolveDynamicProductForIngredient } from '../services/PantryTaxonomyService.js';

export function findProductForIngredient(item, products = [], options = {}) {
  if (!item || !Array.isArray(products) || !products.length) return null;
  const state = (options.ingredients && options.preferences)
    ? null
    : (typeof window !== 'undefined' && typeof window.getState === 'function'
        ? window.getState()
        : (typeof getState === 'function' ? getState() : {}));
  const ingredients = options.ingredients || state?.rootItems || state?.ingredients || [];
  const preferences = options.preferences || state?.preferences || state?.settings || {};
  return resolveDynamicProductForIngredient(item, {
    products,
    ingredients,
    preferences
  });
}

export function computeDynamicMacrosFromIngredients(ingredients, serves = 1) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return null;
  const state = typeof window !== 'undefined' && typeof window.getState === 'function'
    ? window.getState()
    : (typeof getState === 'function' ? getState() : {});
  const products = (Array.isArray(state?.products) && state.products.length > 0)
    ? state.products
    : (Array.isArray(globalThis?.window?.Store?.getState?.()?.products)
        ? globalThis.window.Store.getState().products
        : (Array.isArray(state?.products) ? state.products : []));
  if (!products.length) return null;

  const rootItems = state?.rootItems || state?.ingredients || [];
  const preferences = state?.preferences || state?.settings || {};

  let totalCal = 0;
  let totalProt = 0;
  let matchedCount = 0;

  ingredients.forEach(item => {
    if (!item || item.excludeNutrition) return;
    const prod = findProductForIngredient(item, products, { ingredients: rootItems, preferences });
    if (prod) {
      matchedCount++;
      const qty = Number(item.qty ?? item.amount ?? 1) || 1;
      const unit = item.unit || 'g';
      const nut = calculateItemNutrition(prod, qty, unit);
      totalCal += (nut.kcal ?? nut.cal ?? 0);
      totalProt += (nut.protein ?? nut.prot ?? 0);
    }
  });

  if (matchedCount === 0 || (totalCal === 0 && totalProt === 0)) return null;
  const s = Math.max(1, Number(serves) || 1);
  return {
    cal: Math.round(totalCal / s),
    prot: Math.round((totalProt / s) * 10) / 10
  };
}

export function getActiveFitScoreParams(customParams = null) {
  const state = typeof getState === 'function' ? getState() : {};
  const raw = customParams
    || state?.preferences?.fitScoreParams
    || state?.userPrefs?.fitScoreParams
    || state?.prefs?.fitScoreParams
    || {};
  return resolveFitScoreParams(raw);
}

export function parsePositiveNumberOrNull(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const num = Number(String(val).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export function pickFirstValidMacro(candidates = []) {
  for (const c of candidates) {
    const parsed = parsePositiveNumberOrNull(c);
    if (parsed !== null && parsed > 0) return parsed;
  }
  for (const c of candidates) {
    const parsed = parsePositiveNumberOrNull(c);
    if (parsed !== null) return parsed;
  }
  return null;
}

/**
 * Exhaustively extracts per-serving calories and protein across all supported schema keys.
 * Strictly returns `null` (not 0) when a macro is missing so missing data can be explicitly flagged.
 */
export function extractRecipeMacros(recipe, variant = 'original') {
  if (!recipe || typeof recipe !== 'object') {
    return { cal: null, prot: null, calories: null, protein: null };
  }
  const r = recipe.recipe || recipe;

  const serves = Number(r.servings || r.serves || 1) || 1;

  const extractFromNode = (node) => {
    if (!node || typeof node !== 'object') return { cal: null, prot: null };
    let cal = pickFirstValidMacro([
      node.nutrition?.perServing?.cal,
      node.nutrition?.perServing?.calories,
      node.nutrition?.calories,
      node.nutrition?.cal,
      node.perServing?.cal,
      node.perServing?.calories,
      node.macros?.cal,
      node.macros?.calories,
      node.cal,
      node.calories,
      node.kcal
    ]);
    let prot = pickFirstValidMacro([
      node.nutrition?.perServing?.prot,
      node.nutrition?.perServing?.protein,
      node.nutrition?.protein,
      node.nutrition?.prot,
      node.perServing?.prot,
      node.perServing?.protein,
      node.macros?.prot,
      node.macros?.protein,
      node.prot,
      node.protein
    ]);
    const isExplicitPerServing = Boolean(
      node.nutrition?.perServing ||
      node.perServing ||
      node.macros ||
      (cal !== null && !node.nutrition?.total && !node.total)
    );
    if (!isExplicitPerServing && cal !== null && serves > 1) {
      cal = cal / serves;
    }
    if (!isExplicitPerServing && prot !== null && serves > 1) {
      prot = prot / serves;
    }
    return { cal, prot };
  };

  if (variant === 'enhanced' && r.enhanced && typeof r.enhanced === 'object') {
    const enh = extractFromNode(r.enhanced);
    const base = extractFromNode(r);
    let cal = (enh.cal !== null && enh.cal > 0) ? enh.cal : null;
    let prot = (enh.prot !== null && enh.prot > 0) ? enh.prot : null;

    // Detect if enhanced macros were cloned verbatim from base without recalculation
    const isClonedFromBase = Boolean(
      base.cal !== null && base.prot !== null &&
      cal === base.cal && prot === base.prot
    );

    const enhIngs = (Array.isArray(r.enhanced.ingredientSections) && r.enhanced.ingredientSections.length > 0)
      ? r.enhanced.ingredientSections.flatMap(s => s.ingredients || [])
      : (Array.isArray(r.enhanced.ingredients) ? r.enhanced.ingredients : []);

    if ((cal === null || prot === null || isClonedFromBase) && enhIngs.length > 0) {
      const enhServes = Number(r.enhanced.servings || r.enhanced.serves || serves) || serves;
      const dynamic = computeDynamicMacrosFromIngredients(enhIngs, enhServes);
      if (dynamic && dynamic.cal > 0 && dynamic.prot > 0) {
        cal = dynamic.cal;
        prot = dynamic.prot;
        if (r.enhanced && typeof r.enhanced === 'object') {
          if (!r.enhanced.macros) r.enhanced.macros = {};
          r.enhanced.macros.calories = dynamic.cal;
          r.enhanced.macros.protein = dynamic.prot;
        }
      }
    }

    cal = (cal !== null && cal > 0) ? cal : base.cal;
    prot = (prot !== null && prot > 0) ? prot : base.prot;
    return { cal, prot, calories: cal, protein: prot };
  }

  const base = extractFromNode(r);
  let cal = base.cal;
  let prot = base.prot;
  if ((cal === null || cal <= 0 || prot === null || prot <= 0) && Array.isArray(r.ingredients) && r.ingredients.length > 0) {
    const dynamic = computeDynamicMacrosFromIngredients(r.ingredients, serves);
    if (dynamic) {
      if (cal === null || cal <= 0) cal = dynamic.cal;
      if (prot === null || prot <= 0) prot = dynamic.prot;
    }
  }
  return { cal, prot, calories: cal, protein: prot };
}

/**
 * Sweeps the active recipe database for missing or non-positive calorie/protein macros.
 */
export function sweepRecipeMacroQuality(recipes = []) {
  const list = Array.isArray(recipes) ? recipes : Object.values(recipes || {});
  const flagged = [];

  list.forEach(r => {
    if (!r || typeof r !== 'object') return;
    const { cal, prot } = extractRecipeMacros(r, 'original');
    const missingCal = cal === null || cal <= 0;
    const missingProt = prot === null || prot <= 0;
    if (missingCal || missingProt) {
      flagged.push({
        id: r.id || '',
        name: r.name || r.title || 'Untitled Recipe',
        calories: cal,
        protein: prot,
        missingCal,
        missingProt
      });
    }
  });

  return flagged;
}

function interpolateAsymmetricCurve(r, lowFloor, minGrace, minOpt, maxOpt, maxGrace, highCeil) {
  if (r >= minOpt && r <= maxOpt) return 100;

  if (r >= minGrace && r < minOpt) {
    const span = minOpt - minGrace;
    return span > 0 ? 86 + ((r - minGrace) / span) * (99 - 86) : 99;
  }

  if (r > maxOpt && r <= maxGrace) {
    const span = maxGrace - maxOpt;
    return span > 0 ? 99 - ((r - maxOpt) / span) * (99 - 86) : 99;
  }

  if (r < minGrace) {
    if (r <= lowFloor) return 0;
    const span = minGrace - lowFloor;
    return span > 0 ? ((r - lowFloor) / span) * 85 : 0;
  }

  if (r > maxGrace) {
    if (r >= highCeil) return 0;
    const span = highCeil - maxGrace;
    return span > 0 ? (1 - ((r - maxGrace) / span)) * 85 : 0;
  }

  return 0;
}

/**
 * Universal Asymmetric Calorie Score Curve
 */
export function calculateCalorieScore(actual, target, customParams = null) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const params = getActiveFitScoreParams(customParams);
  const r = actual / target;
  return interpolateAsymmetricCurve(
    r,
    params.calLowFloor,
    params.calMinGrace,
    params.calMinOpt,
    params.calMaxOpt,
    params.calMaxGrace,
    params.calHighCeil
  );
}

/**
 * Universal Asymmetric Protein Score Curve
 */
export function calculateProteinScore(actual, target, customParams = null) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const params = getActiveFitScoreParams(customParams);
  const r = actual / target;
  return interpolateAsymmetricCurve(
    r,
    params.protLowFloor,
    params.protMinGrace,
    params.protMinOpt,
    params.protMaxOpt,
    params.protMaxGrace,
    params.protHighCeil
  );
}
