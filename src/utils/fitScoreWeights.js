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
    return { tier: 'green', icon: '🟢', label: 'Ideal Match', color: '#22c55e', bg: '#dcfce7', text: '#14532d', border: '#86efac' };
  }
  if (s >= 70) {
    return { tier: 'yellow', icon: '🟡', label: 'Needs Work', color: '#eab308', bg: '#fef9c3', text: '#713f12', border: '#fde047' };
  }
  if (s >= 50) {
    return { tier: 'orange', icon: '🟠', label: 'Suboptimal', color: '#f97316', bg: '#ffedd5', text: '#7c2d12', border: '#fdba74' };
  }
  return { tier: 'red', icon: '🔴', label: 'Poor Match', color: '#ef4444', bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' };
}
