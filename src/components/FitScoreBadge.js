/**
 * src/components/FitScoreBadge.js (v3.20.10)
 * Unified 4-Tier Continuous Gradient Fit Score Badge Component.
 * Tiers:
 * - 🟢 85–100 (#22c55e - Ideal Match)
 * - 🟡 70–84  (#eab308 - Needs Work)
 * - 🟠 50–69  (#f97316 - Suboptimal)
 * - 🔴 < 50   (#ef4444 - Poor Match)
 */

import { calculateMealFitScore, getFitScoreTierMeta } from '../utils/fitScoreCalculator.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders an HTML string for the Unified 4-Tier Fit Score badge.
 *
 * @param {Object|number} fitScoreOrRecipe - Numeric score, pre-computed fitResult, or recipe object
 * @param {string|Object} [mealTypeOrOptions='dinner']
 * @param {Object} [extraOptions={}]
 * @returns {string} HTML string
 */
export function renderFitScoreBadge(fitScoreOrRecipe, mealTypeOrOptions = 'dinner', extraOptions = {}) {
  let fitResult = null;
  const mealType = typeof mealTypeOrOptions === 'string' ? mealTypeOrOptions : 'dinner';
  const opts = typeof mealTypeOrOptions === 'object' && mealTypeOrOptions !== null ? mealTypeOrOptions : (extraOptions || {});

  if (typeof fitScoreOrRecipe === 'number') {
    const numericScore = Math.round(fitScoreOrRecipe);
    const meta = getFitScoreTierMeta(numericScore);
    fitResult = {
      score: numericScore,
      tier: meta.tier,
      tierIcon: meta.icon,
      tierLabel: meta.label,
      color: meta.color
    };
  } else if (fitScoreOrRecipe && typeof fitScoreOrRecipe === 'object') {
    const isComputedResult = typeof fitScoreOrRecipe.score === 'number'
      && (fitScoreOrRecipe.tier || fitScoreOrRecipe.tierLabel || fitScoreOrRecipe.details)
      && !fitScoreOrRecipe.ingredients
      && !fitScoreOrRecipe.nutrition
      && !fitScoreOrRecipe.perServing
      && !fitScoreOrRecipe.id;

    if (isComputedResult) {
      fitResult = fitScoreOrRecipe;
    } else if (fitScoreOrRecipe.fitRes && typeof fitScoreOrRecipe.fitRes.score === 'number') {
      fitResult = fitScoreOrRecipe.fitRes;
    } else {
      fitResult = calculateMealFitScore(fitScoreOrRecipe, mealType, opts);
    }
  }

  if (!fitResult || fitResult.score <= 0 || fitResult.error || fitResult.isMissingMacros) {
    return `<span class="pp-fit-badge pp-fit-neutral" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:6px;background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1" title="${escapeHtml(fitResult?.error || 'Missing Calorie/Protein Data')}">⚪ --</span>`;
  }

  const score = Math.round(Number(fitResult.score) || 0);
  const meta = getFitScoreTierMeta(score);
  const details = fitResult.details;

  let title = `${meta.icon} Fit Score: ${score}% (${meta.label})`;
  if (details) {
    const e = details.elliott;
    const c = details.chloe;
    if (e && c) {
      title += ` | Elliott: ${e.score}% (${e.recipeKcal}kcal, ${e.recipeProtein}g prot) | Chloe: ${c.score}% (${c.recipeKcal}kcal, ${c.recipeProtein}g prot)`;
    }
  }

  const labelSuffix = opts.showLabel ? ` · ${escapeHtml(meta.label)}` : '';

  return `<span class="pp-fit-badge gradient-badge" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background-color:${meta.bg};color:${meta.text};border:1px solid ${meta.color};line-height:1.2" title="${escapeHtml(title)}" data-fit-score="${score}" data-fit-tier="${meta.tier}">${meta.icon} ${score}%${labelSuffix}</span>`;
}

if (typeof window !== 'undefined') {
  window.renderFitScoreBadge = renderFitScoreBadge;
}
