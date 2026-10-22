/**
 * src/utils/macroScoringUtils.js (v3.38.63)
 * Pure mathematical utilities for macro extraction and fit score curve interpolation.
 */

import { getState } from '../store/coreState.js';

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
      node.perServing?.prot,
      node.perServing?.protein,
      node.macros?.prot,
      node.macros?.protein,
      node.prot,
      node.protein
    ]);
    if (cal !== null && serves > 1 && !node.perServing && !node.nutrition?.perServing) {
      cal = cal / serves;
    }
    if (prot !== null && serves > 1 && !node.perServing && !node.nutrition?.perServing) {
      prot = prot / serves;
    }
    return { cal, prot };
  };

  if (variant === 'enhanced' && r.enhanced && typeof r.enhanced === 'object') {
    const enh = extractFromNode(r.enhanced);
    const base = extractFromNode(r);
    const cal = (enh.cal !== null && enh.cal > 0) ? enh.cal : base.cal;
    const prot = (enh.prot !== null && enh.prot > 0) ? enh.prot : base.prot;
    return { cal, prot, calories: cal, protein: prot };
  }

  const base = extractFromNode(r);
  return { cal: base.cal, prot: base.prot, calories: base.cal, protein: base.prot };
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

/**
 * Universal Asymmetric Calorie Score Curve (50% Weight)
 */
export function calculateCalorieScore(actual, target) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const state = typeof getState === 'function' ? getState() : {};
  const params = state?.userPrefs?.fitScoreParams || state?.prefs?.fitScoreParams || {};
  const minOpt = params.calMinOpt ?? 0.95;
  const maxOpt = params.calMaxOpt ?? 1.00;
  const lowFloor = params.calLowFloor ?? 0.50;
  const highCeil = params.calHighCeil ?? 1.40;

  const r = actual / target;

  if (r >= minOpt && r <= maxOpt) return 100;
  if (r >= (minOpt - 0.10) && r < minOpt) return 86 + ((r - (minOpt - 0.10)) / (minOpt - (minOpt - 0.10))) * (99 - 86);
  if (r > maxOpt && r <= (maxOpt + 0.05)) return 99 - ((r - maxOpt) / ((maxOpt + 0.05) - maxOpt)) * (99 - 86);
  if (r < minOpt) {
    if (r <= lowFloor) return 0;
    return ((r - lowFloor) / (minOpt - lowFloor)) * 85;
  }
  if (r > maxOpt) {
    if (r >= highCeil) return 0;
    return (1 - ((r - maxOpt) / (highCeil - maxOpt))) * 85;
  }
  return 0;
}

/**
 * Universal Asymmetric Protein Score Curve (50% Weight)
 */
export function calculateProteinScore(actual, target) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
  const state = typeof getState === 'function' ? getState() : {};
  const params = state?.userPrefs?.fitScoreParams || state?.prefs?.fitScoreParams || {};
  const protMinOpt = params.protMinOpt ?? 1.00;
  const protMaxOpt = params.protMaxOpt ?? 1.20;
  const protLowFloor = params.protLowFloor ?? 0.70;
  const protHighCeil = params.protHighCeil ?? 2.00;

  const r = actual / target;

  if (r >= protMinOpt && r <= protMaxOpt) return 100;
  if (r >= (protMinOpt - 0.05) && r < protMinOpt) return 86 + ((r - (protMinOpt - 0.05)) / (protMinOpt - (protMinOpt - 0.05))) * (99 - 86);
  if (r > protMaxOpt && r <= (protMaxOpt + 0.10)) return 99 - ((r - protMaxOpt) / ((protMaxOpt + 0.10) - protMaxOpt)) * (99 - 86);
  if (r < protMinOpt) {
    if (r <= protLowFloor) return 0;
    return ((r - protLowFloor) / (protMinOpt - protLowFloor)) * 85;
  }
  if (r > protMaxOpt) {
    if (r >= protHighCeil) return 0;
    return (1 - ((r - protMaxOpt) / (protHighCeil - protMaxOpt))) * 85;
  }
  return 0;
}
