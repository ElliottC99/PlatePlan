/**
 * src/components/FitScoreBadge.js (v3.16.1)
 * Reusable Traffic Light Fit Score Badge Component.
 * Renders Green (🟢), Amber (🟡), or Red (🔴) indicators with continuous scores.
 */

import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';

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
 * Renders an HTML string for the Traffic Light Fit Score badge.
 *
 * @param {Object|number} fitScoreOrRecipe
 * @param {string|Object} [mealTypeOrOptions='dinner']
 * @param {Object} [extraOptions={}]
 * @returns {string} HTML string
 */
export function renderFitScoreBadge(fitScoreOrRecipe, mealTypeOrOptions = 'dinner', extraOptions = {}) {
  let fitResult = null;

  if (fitScoreOrRecipe && typeof fitScoreOrRecipe === 'object' && fitScoreOrRecipe.score !== undefined && fitScoreOrRecipe.tier) {
    fitResult = fitScoreOrRecipe;
  } else if (fitScoreOrRecipe) {
    const mealType = typeof mealTypeOrOptions === 'string' ? mealTypeOrOptions : 'dinner';
    const opts = typeof mealTypeOrOptions === 'object' ? mealTypeOrOptions : extraOptions;
    fitResult = calculateMealFitScore(fitScoreOrRecipe, mealType, opts);
  }

  if (!fitResult || fitResult.score === 0 || fitResult.error) {
    return `<span class="pp-fit-badge pp-fit-neutral" title="${escapeHtml(fitResult?.error || 'Awaiting Data')}">--</span>`;
  }

  const { score, details } = fitResult;

  let title = `Fit Score: ${score}%`;
  if (details) {
    const e = details.elliott;
    const c = details.chloe;
    if (e && c) {
      title += ` | Elliott: ${e.score}% (${e.recipeKcal}kcal, ${e.recipeProtein}g prot) | Chloe: ${c.score}% (${c.recipeKcal}kcal, ${c.recipeProtein}g prot)`;
    }
  }

  const hue = Math.round(score * 1.2); 
  // 0 = Red, 60 = Yellow, 120 = Green

  return `<span class="pp-fit-badge gradient-badge" 
    style="background-color: hsl(${hue}, 85%, 92%); 
           color: hsl(${hue}, 90%, 25%); 
           border: 1px solid hsl(${hue}, 80%, 45%);" 
    title="${escapeHtml(title)}" data-fit-score="${score}">
    ${score}%
  </span>`;
}

if (typeof window !== 'undefined') {
  window.renderFitScoreBadge = renderFitScoreBadge;
}
