/**
 * src/components/planner/PlannerGridUI.js (v3.9.5)
 * Modular Presentation Component for Weekly Meal Planner Grid & History Cards
 */

import { renderDayPlanCard, renderDenseDayCard, renderPersonSummaryBox } from './PlannerDayCard.js';
import { renderDraftPlanBanner, renderPlanExpiredBanner, renderEarlierDaysHeading, renderPlanOverallSummary, renderPlannerEmptyError } from './PlannerGridToolbar.js';

function escapeHtml(str) {
  if (typeof window !== 'undefined' && window.ppEscapeHtml) {
    return window.ppEscapeHtml(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderExpandableText(text, idKey, className) {
  if (typeof window !== 'undefined' && window.renderExpandableText) {
    return window.renderExpandableText(text, idKey, className);
  }
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function getPlanDateRangeLabel(p) {
  if (typeof window !== 'undefined' && window.getPlanDateRangeLabel) {
    return window.getPlanDateRangeLabel(p);
  }
  return p?.date ? new Date(p.date).toLocaleDateString() : '';
}

function getPlanRecipeIds(p) {
  if (typeof window !== 'undefined' && window.getPlanRecipeIds) {
    return window.getPlanRecipeIds(p);
  }
  return [];
}

function getProductIndexRecipe(id) {
  if (typeof window !== 'undefined' && window.getProductIndexRecipe) {
    return window.getProductIndexRecipe(id);
  }
  return null;
}

/**
 * Render history panel HTML string for #plan-history-panel
 */
export function renderHistoryPanel(hist = []) {
  if (!hist || !hist.length) {
    return `<div class="card" style="font-size:12px;margin:0">
      <div style="font-size:12px;color:var(--text3)">No saved meal plans yet. Generate a plan, then use Save current plan.</div>
    </div>`;
  }

  const cardsHtml = hist.map((p, i) => {
    const dt = p.date ? new Date(p.date).toLocaleString() : 'Previous plan';
    const dateRange = getPlanDateRangeLabel(p);
    const allIds = getPlanRecipeIds(p);
    const ids = allIds.slice(0, 3).map(id => getProductIndexRecipe(id)?.name || id);
    const remaining = Math.max(0, allIds.length - ids.length);
    const status = p.savedStatus || (p.confirmedShopping ? 'Shopping confirmed' : 'PlatePlan generated');
    const title = p.name || `Saved plan ${i + 1}`;
    const score = p.score?.score ?? p.score ?? '—';

    return `<article class="plan-library-card">
      <div class="plan-library-layout">
        <div class="plan-library-main">
          ${renderExpandableText(title, `plan-${p.id || i}`, 'plan-library-title')}
          <div class="plan-library-meta">
            <span class="tag">${p.days || 0} days</span>
            ${dateRange ? `<span class="tag">${escapeHtml(dateRange)}</span>` : ''}
            <span class="tag">Score ${escapeHtml(score)}</span>
            <span class="tag">${escapeHtml(status)}</span>
          </div>
          <div style="color:var(--text3);margin-top:7px">Saved ${escapeHtml(dt)} · ${escapeHtml(p.savedBy || 'PlatePlan')}</div>
          <div class="plan-library-recipe-preview"><strong>Recipes:</strong> ${renderExpandableText(ids.length ? ids.join(', ') : 'No recipes', `plan-recipes-${p.id || i}`, '')}${remaining ? ` <span class="tag">+${remaining} more</span>` : ''}</div>
        </div>
        <div class="plan-library-actions">
          <button class="btn sm primary" data-action="open-saved-plan-recipe-cards" data-index="${i}" onclick="openSavedPlanRecipeCards(${i})">Recipe cards</button>
          <button class="btn sm ghost" data-action="open-plan-history-actions" data-index="${i}" onclick="openPlanHistoryActions(${i})">More</button>
        </div>
      </div>
    </article>`;
  }).join('');

  return `<div class="card" style="font-size:12px;margin:0"><div style="display:grid;gap:10px">${cardsHtml}</div></div>`;
}

// Re-export sub-components for direct access
export {
  renderDayPlanCard,
  renderDenseDayCard,
  renderPersonSummaryBox,
  renderDraftPlanBanner,
  renderPlanExpiredBanner,
  renderEarlierDaysHeading,
  renderPlanOverallSummary,
  renderPlannerEmptyError
};
