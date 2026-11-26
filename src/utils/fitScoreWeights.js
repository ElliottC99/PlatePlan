/**
 * src/utils/fitScoreWeights.js (v3.38.63)
 * Static configuration, weighting dictionaries, and tier metadata for Fit Score evaluation.
 */

export const DEFAULT_SPLITS = {
  breakfast: 25,
  lunch: 30,
  snack: 10,
  snacking: 10,
  dinner: 35
};

export const DEFAULT_FIT_SCORE_PARAMS = Object.freeze({
  calorieWeightPct: 50,
  proteinWeightPct: 50,
  calLowFloorPct: 50,
  calMinGracePct: 85,
  calMinOptPct: 95,
  calMaxOptPct: 100,
  calMaxGracePct: 105,
  calHighCeilPct: 140,
  protLowFloorPct: 70,
  protMinGracePct: 95,
  protMinOptPct: 100,
  protMaxOptPct: 120,
  protMaxGracePct: 130,
  protHighCeilPct: 200
});

function toPct(pctVal, ratioVal, fallbackPct) {
  if (pctVal !== undefined && pctVal !== null && pctVal !== '' && Number.isFinite(Number(pctVal))) {
    return Number(pctVal);
  }
  if (ratioVal !== undefined && ratioVal !== null && ratioVal !== '' && Number.isFinite(Number(ratioVal))) {
    const n = Number(ratioVal);
    return n <= 5 ? Math.round(n * 1000) / 10 : n;
  }
  return fallbackPct;
}

/**
 * Resolves and normalizes Fit Score tapering & weighting parameters from preferences or custom overrides.
 */
export function resolveFitScoreParams(rawParams = {}) {
  const p = (rawParams && typeof rawParams === 'object') ? rawParams : {};

  let calWeightPct = toPct(p.calorieWeightPct, p.calorieWeight, DEFAULT_FIT_SCORE_PARAMS.calorieWeightPct);
  calWeightPct = Math.max(0, Math.min(100, calWeightPct));
  const protWeightPct = Math.max(0, Math.min(100, 100 - calWeightPct));

  const calLowFloorPct = Math.max(0, toPct(p.calLowFloorPct, p.calLowFloor, DEFAULT_FIT_SCORE_PARAMS.calLowFloorPct));
  const calMinOptPct = Math.max(calLowFloorPct + 2, toPct(p.calMinOptPct, p.calMinOpt, DEFAULT_FIT_SCORE_PARAMS.calMinOptPct));
  const defaultCalMinGrace = Math.max(calLowFloorPct + 1, calMinOptPct - 10);
  const calMinGracePct = Math.max(calLowFloorPct + 1, Math.min(calMinOptPct, toPct(p.calMinGracePct, p.calMinGrace, defaultCalMinGrace)));
  const calMaxOptPct = Math.max(calMinOptPct, toPct(p.calMaxOptPct, p.calMaxOpt, DEFAULT_FIT_SCORE_PARAMS.calMaxOptPct));
  const defaultCalMaxGrace = calMaxOptPct + 5;
  const calMaxGracePct = Math.max(calMaxOptPct, toPct(p.calMaxGracePct, p.calMaxGrace, defaultCalMaxGrace));
  const calHighCeilPct = Math.max(calMaxGracePct + 1, toPct(p.calHighCeilPct, p.calHighCeil, DEFAULT_FIT_SCORE_PARAMS.calHighCeilPct));

  const protLowFloorPct = Math.max(0, toPct(p.protLowFloorPct, p.protLowFloor, DEFAULT_FIT_SCORE_PARAMS.protLowFloorPct));
  const protMinOptPct = Math.max(protLowFloorPct + 2, toPct(p.protMinOptPct, p.protMinOpt, DEFAULT_FIT_SCORE_PARAMS.protMinOptPct));
  const defaultProtMinGrace = Math.max(protLowFloorPct + 1, protMinOptPct - 5);
  const protMinGracePct = Math.max(protLowFloorPct + 1, Math.min(protMinOptPct, toPct(p.protMinGracePct, p.protMinGrace, defaultProtMinGrace)));
  const protMaxOptPct = Math.max(protMinOptPct, toPct(p.protMaxOptPct, p.protMaxOpt, DEFAULT_FIT_SCORE_PARAMS.protMaxOptPct));
  const defaultProtMaxGrace = protMaxOptPct + 10;
  const protMaxGracePct = Math.max(protMaxOptPct, toPct(p.protMaxGracePct, p.protMaxGrace, defaultProtMaxGrace));
  const protHighCeilPct = Math.max(protMaxGracePct + 1, toPct(p.protHighCeilPct, p.protHighCeil, DEFAULT_FIT_SCORE_PARAMS.protHighCeilPct));

  return {
    calorieWeightPct: Math.round(calWeightPct),
    proteinWeightPct: Math.round(protWeightPct),
    calorieWeight: calWeightPct / 100,
    proteinWeight: protWeightPct / 100,
    calLowFloorPct,
    calMinGracePct,
    calMinOptPct,
    calMaxOptPct,
    calMaxGracePct,
    calHighCeilPct,
    calLowFloor: calLowFloorPct / 100,
    calMinGrace: calMinGracePct / 100,
    calMinOpt: calMinOptPct / 100,
    calMaxOpt: calMaxOptPct / 100,
    calMaxGrace: calMaxGracePct / 100,
    calHighCeil: calHighCeilPct / 100,
    protLowFloorPct,
    protMinGracePct,
    protMinOptPct,
    protMaxOptPct,
    protMaxGracePct,
    protHighCeilPct,
    protLowFloor: protLowFloorPct / 100,
    protMinGrace: protMinGracePct / 100,
    protMinOpt: protMinOptPct / 100,
    protMaxOpt: protMaxOptPct / 100,
    protMaxGrace: protMaxGracePct / 100,
    protHighCeil: protHighCeilPct / 100
  };
}

/**
 * Resolves 4-tier badge metadata for a given numeric Fit Score (0–100).
 * - 🟢 85–100 (#22c55e - Ideal Match)
 * - 🟡 70–84 (#eab308 - Needs Work)
 * - 🟠 50–69 (#f97316 - Suboptimal)
 * - 🔴 < 50 (#ef4444 - Poor Match)
 */
export function getFitScoreTierMeta(score) {
  const s = Math.round(Number(score) || 0);
  if (s >= 85) {
    return { tier: 'green', icon: '🟢', label: 'Ideal Match', color: 'var(--system-green)', bg: 'var(--badge-green-bg)', text: 'var(--badge-green-text)', border: 'var(--badge-green-border)' };
  }
  if (s >= 70) {
    return { tier: 'yellow', icon: '🟡', label: 'Needs Work', color: 'var(--system-yellow)', bg: 'var(--badge-yellow-bg)', text: 'var(--badge-yellow-text)', border: 'var(--badge-yellow-border)' };
  }
  if (s >= 50) {
    return { tier: 'orange', icon: '🟠', label: 'Suboptimal', color: 'var(--system-orange)', bg: 'var(--badge-orange-bg)', text: 'var(--badge-orange-text)', border: 'var(--badge-orange-border)' };
  }
  return { tier: 'red', icon: '🔴', label: 'Poor Match', color: 'var(--system-red)', bg: 'var(--badge-red-bg)', text: 'var(--badge-red-text)', border: 'var(--badge-red-border)' };
}

/**
 * Pure piecewise asymmetric curve used by both Calorie and Protein Fit Score calculators.
 */
export function interpolateAsymmetricCurve(r, lowFloor, minGrace, minOpt, maxOpt, maxGrace, highCeil) {
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

export function calculateCalorieScoreWithParams(actual, target, params) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
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

export function calculateProteinScoreWithParams(actual, target, params) {
  if (!target || target <= 0 || actual === null || actual === undefined || actual <= 0) return 0;
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

/**
 * Pure helper returning the flattened ingredient list for a recipe and variant,
 * preferring non-empty `ingredientSections` and falling back to `ingredients`
 * without letting base `ingredientSections` shadow `enhanced.ingredients`.
 */
export function extractRecipeIngredients(recipe, variant = 'original') {
  if (!recipe || typeof recipe !== 'object') return [];
  const fromObj = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj.ingredientSections) && obj.ingredientSections.length > 0) {
      const flattened = obj.ingredientSections.flatMap(sec => Array.isArray(sec?.ingredients) ? sec.ingredients : []);
      if (flattened.length > 0) return flattened;
    }
    return Array.isArray(obj.ingredients) ? obj.ingredients : [];
  };
  if (variant === 'enhanced' && recipe.enhanced && typeof recipe.enhanced === 'object') {
    const enhList = fromObj(recipe.enhanced);
    if (enhList.length > 0) return enhList;
  }
  return fromObj(recipe);
}
