/**
 * src/components/planner/PlannerGridUI.js (v3.10.0)
 * Modular Presentation Component for Weekly Meal Planner Grid & Meal Plan Library Cards
 */

import { renderDenseDayCard, renderPersonSummaryBox } from './PlannerDayCard.js';
import { renderPlannerEmptyError } from './PlannerGridToolbar.js';
import { getState } from '../../store/coreState.js';

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

function renderExpandableText(text, idKey, className) {
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

export function getPlanDateRangeLabel(p) {
  if (!p) return '';
  const startDate = p.startDate || p.date;
  const days = Number(p.days || (p.slots ? Object.keys(p.slots).length : 0));
  if (!startDate) return '';
  let endDate = p.endDate;
  if (!endDate && days > 0) {
    try {
      const end = new Date(startDate);
      end.setDate(end.getDate() + (days - 1));
      endDate = end.toISOString().split('T')[0];
    } catch (_) {}
  }
  try {
    const startFmt = new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const endFmt = endDate ? new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    return `${startFmt}${endFmt ? ` – ${endFmt}` : ''}`;
  } catch (_) {
    return String(startDate);
  }
}

export function getPlanRecipeIds(p) {
  if (!p || !p.slots || typeof p.slots !== 'object') return [];
  const ids = new Set();
  Object.values(p.slots).forEach(daySlot => {
    if (!daySlot || typeof daySlot !== 'object') return;
    Object.values(daySlot).forEach(slot => {
      if (!slot || slot.isSkipped || slot.skipped) return;
      const rId = slot.recipeId || slot.id;
      if (rId) ids.add(rId);
    });
  });
  return Array.from(ids);
}

export function getProductIndexRecipe(id, recipes = []) {
  const allRecipes = Array.isArray(recipes) && recipes.length > 0
    ? recipes
    : (getState()?.recipes || (typeof window !== 'undefined' ? window.state?.recipes : [])) || [];
  return allRecipes.find(r => String(r.id) === String(id)) || null;
}

/**
 * Render history panel HTML string for #plan-history-panel
 * Supports both hist array argument and options object { activePlan, historyPlans, recipes }
 */
export function renderHistoryPanel(options = []) {
  let hist = [];
  let activePlan = null;
  let recipes = [];

  if (Array.isArray(options)) {
    hist = options;
    activePlan = getState()?.currentPlan || (typeof window !== 'undefined' ? window.state?.currentPlan : null);
  } else if (options && typeof options === 'object') {
    hist = Array.isArray(options.historyPlans) ? options.historyPlans : (Array.isArray(options.hist) ? options.hist : []);
    activePlan = options.activePlan || getState()?.currentPlan || (typeof window !== 'undefined' ? window.state?.currentPlan : null);
    recipes = Array.isArray(options.recipes) ? options.recipes : [];
  }

  let html = '';

  // 1. Active Plan Section (if current active plan exists)
  if (activePlan && activePlan.slots && Object.keys(activePlan.slots).length > 0) {
    const activeDateRange = getPlanDateRangeLabel(activePlan);
    const activeRecipeIds = getPlanRecipeIds(activePlan);
    const activeRecipesPreview = activeRecipeIds.slice(0, 4).map(id => getProductIndexRecipe(id, recipes)?.name || id);
    const activeRemaining = Math.max(0, activeRecipeIds.length - activeRecipesPreview.length);
    const activeDays = activePlan.days || Object.keys(activePlan.slots).length;
    const activeScore = activePlan.score?.score ?? activePlan.score ?? '—';

    html += `
      <div style="margin-bottom:24px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
          <h2 style="font-size:14px; font-weight:700; color:var(--text,#1c1917); text-transform:uppercase; letter-spacing:0.04em; margin:0;">
            Currently Active Plan
          </h2>
          <span class="badge" style="background:#ecfdf5; color:#059669; font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; border:1px solid #10b981;">
            ● Active in Planner & Today
          </span>
        </div>
        <article class="plan-library-card" style="border: 2px solid #10b981; background: var(--surface,#fff); box-shadow: 0 4px 14px rgba(16,185,129,0.08);">
          <div class="plan-library-layout">
            <div class="plan-library-main">
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 class="plan-library-title" style="margin:0; font-size:16px; font-weight:700;">${escapeHtml(activePlan.name || 'Current Meal Plan')}</h3>
              </div>
              <div class="plan-library-meta" style="margin-top:6px; display:flex; flex-wrap:wrap; gap:6px;">
                <span class="tag" style="background:#f0fdf4; color:#15803d; font-weight:600;">${activeDays} days</span>
                ${activeDateRange ? `<span class="tag">${escapeHtml(activeDateRange)}</span>` : ''}
                <span class="tag">Score ${escapeHtml(activeScore)}</span>
                <span class="tag" style="background:#e0f2fe; color:#0369a1;">Active</span>
              </div>
              <div style="color:var(--text3,#78716c); font-size:11.5px; margin-top:8px;">
                Updated ${activePlan.updatedAt ? new Date(activePlan.updatedAt).toLocaleString() : 'Recently'}
              </div>
              <div class="plan-library-recipe-preview" style="margin-top:8px; font-size:12px;">
                <strong>Recipes (${activeRecipeIds.length}):</strong> ${activeRecipesPreview.length ? escapeHtml(activeRecipesPreview.join(', ')) : 'No recipes'}
                ${activeRemaining ? `<span class="tag">+${activeRemaining} more</span>` : ''}
              </div>
            </div>
            <div class="plan-library-actions" style="display:flex; flex-direction:column; gap:8px; justify-content:center;">
              <button class="btn sm primary" data-action="open-active-plan-recipe-cards">Recipe Cards</button>
              <button class="btn sm ghost" data-action="open-planner-view">Edit in Planner →</button>
            </div>
          </div>
        </article>
      </div>
    `;
  }

  // 2. Saved Plans History Section
  html += `
    <div style="margin-top:16px;">
      <h2 style="font-size:14px; font-weight:700; color:var(--text,#1c1917); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:10px;">
        Saved Plan Archives (${hist.length})
      </h2>
  `;

  if (!hist || !hist.length) {
    html += `
      <div class="card" style="font-size:12px; margin:0; padding:20px; text-align:center; color:var(--text3,#78716c);">
        No saved meal plans in the library yet. Committing a plan in the planner automatically archives a snapshot here for your 30-day rotation.
      </div>
    </div>`;
    return html;
  }

  const cardsHtml = hist.map((p, i) => {
    const dt = p.archivedAt || p.date || p.updatedAt;
    const dtFormatted = dt ? new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Previous plan';
    const dateRange = getPlanDateRangeLabel(p);
    const allIds = getPlanRecipeIds(p);
    const ids = allIds.slice(0, 3).map(id => getProductIndexRecipe(id, recipes)?.name || id);
    const remaining = Math.max(0, allIds.length - ids.length);
    const title = p.name || `Saved Plan ${i + 1}`;
    const score = p.score?.score ?? p.score ?? '—';
    const planId = p.id || `plan_${i}`;

    return `<article class="plan-library-card" style="margin-bottom:10px; border:1px solid var(--border,#e7e5e4); border-radius:10px; padding:12px;">
      <div class="plan-library-layout">
        <div class="plan-library-main">
          ${renderExpandableText(title, `plan-${planId}`, 'plan-library-title')}
          <div class="plan-library-meta" style="margin-top:5px; display:flex; flex-wrap:wrap; gap:6px;">
            <span class="tag">${p.days || (p.slots ? Object.keys(p.slots).length : 0)} days</span>
            ${dateRange ? `<span class="tag">${escapeHtml(dateRange)}</span>` : ''}
            <span class="tag">Score ${escapeHtml(score)}</span>
            <span class="tag">Archived</span>
          </div>
          <div style="color:var(--text3,#78716c); font-size:11.5px; margin-top:6px">Archived on ${escapeHtml(dtFormatted)} · ${allIds.length} recipes</div>
          <div class="plan-library-recipe-preview" style="margin-top:6px; font-size:12px;">
            <strong>Recipes:</strong> ${ids.length ? escapeHtml(ids.join(', ')) : 'No recipes'}
            ${remaining ? `<span class="tag">+${remaining} more</span>` : ''}
          </div>
        </div>
        <div class="plan-library-actions" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <button class="btn sm primary" data-action="restore-saved-plan" data-plan-id="${escapeAttr(planId)}">Load Plan</button>
          <button class="btn sm secondary" data-action="open-saved-plan-recipe-cards" data-plan-id="${escapeAttr(planId)}">Recipe Cards</button>
          <button class="btn sm ghost" data-action="delete-saved-plan" data-plan-id="${escapeAttr(planId)}" style="color:var(--danger,#ef4444);">Delete</button>
        </div>
      </div>
    </article>`;
  }).join('');

  html += `<div style="display:grid; gap:10px;">${cardsHtml}</div></div>`;
  return html;
}

// Re-export sub-components for direct access
export {
  renderDenseDayCard,
  renderPersonSummaryBox,
  renderPlannerEmptyError
};
