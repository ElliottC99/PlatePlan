/**
 * src/utils/macroScoringUtils.js (v3.38.63)
 * Pure mathematical utilities for macro extraction and fit score curve interpolation.
 */

import { getState } from '../store/coreState.js';
import { resolveFitScoreParams } from './fitScoreWeights.js';

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
