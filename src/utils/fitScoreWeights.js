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
