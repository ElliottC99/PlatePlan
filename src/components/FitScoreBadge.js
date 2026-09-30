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
  } else if (typeof fitScoreOrRecipe === 'number') {
    const score = Math.max(0, Math.min(100, Math.round(fitScoreOrRecipe)));
    
    // Safety: If targets are missing in global state, force neutral badge even if a number is passed
    const profiles = window.state?.preferences?.profiles || window.state?.prefs?.profiles;
    if (!profiles || Object.keys(profiles).length === 0) {
       return `<span class="pp-fit-badge pp-fit-neutral" title="Awaiting Data">--</span>`;
    }

    const tier = score >= 80 ? 'green' : (score >= 40 ? 'amber' : 'red');
    const tierIcon = score >= 80 ? '🟢' : (score >= 40 ? '🟡' : '🔴');
    const tierLabel = score >= 80 ? 'Ideal Fit' : (score >= 40 ? 'Moderate Fit' : 'Needs Work');
    fitResult = { score, tier, tierIcon, tierLabel };
  } else if (fitScoreOrRecipe) {
    const mealType = typeof mealTypeOrOptions === 'string' ? mealTypeOrOptions : 'dinner';
    const opts = typeof mealTypeOrOptions === 'object' ? mealTypeOrOptions : extraOptions;
    fitResult = calculateMealFitScore(fitScoreOrRecipe, mealType, opts);
  }

  if (!fitResult) {
    return '';
  }

  const { score, tier, tierIcon, tierLabel, details } = fitResult;

  if (fitResult.error === 'Missing Macro Targets' || fitResult.error === 'Zero Macro Data' || tierLabel === 'Awaiting Data' || tierLabel === 'Missing Macros' || (score === 0 && tier === 'red')) {
    const title = fitResult.error || tierLabel || 'Awaiting Data';
    return `<span class="pp-fit-badge pp-fit-neutral" title="${escapeHtml(title)}">--</span>`;
  }

  const options = (typeof mealTypeOrOptions === 'object' && !extraOptions.showLabel) ? mealTypeOrOptions : extraOptions;

  let title = `Fit Score: ${score}/100 (${tierLabel})`;
  if (details) {
    const e = details.elliott;
    const c = details.chloe;
    if (e && c) {
      title += ` | Elliott: ${e.score}/100 (${e.recipeKcal}kcal, ${e.recipeProtein}g prot) | Chloe: ${c.score}/100 (${c.recipeKcal}kcal, ${c.recipeProtein}g prot)`;
    }
  }

  const showLabel = options.showLabel ? ` <span class="pp-fit-label">${escapeHtml(tierLabel)}</span>` : '';
  const extraClass = options.className ? ` ${options.className}` : '';

  return `<span class="pp-fit-badge pp-fit-${escapeHtml(tier)}${extraClass}" title="${escapeHtml(title)}" data-fit-score="${score}" data-fit-tier="${escapeHtml(tier)}">${score} ${tierIcon}${showLabel}</span>`;
}

if (typeof window !== 'undefined') {
  window.renderFitScoreBadge = renderFitScoreBadge;
}
