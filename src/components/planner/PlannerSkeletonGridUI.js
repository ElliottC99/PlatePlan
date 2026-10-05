/**
 * src/components/planner/PlannerSkeletonGridUI.js (v3.19.79)
 * Dual-Dot Fit Score Scope Timeline, Pre-Generation Interactive Skeleton Grid,
 * and Split Household Slot Configurator (Elliott & Chloe) with Unified Fit & Duplication Badges.
 */

import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';

function resolveRecipeName(recipeId, fallback = '') {
  if (!recipeId) return fallback || '';
  const recipes = (typeof window !== 'undefined' && Array.isArray(window.state?.recipes)) ? window.state.recipes : [];
  const found = recipes.find(r => String(r.id) === String(recipeId));
  return found?.name || fallback || 'Pinned Recipe';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
const escapeAttr = escapeHtml;

export function getSkeletonSlotConfig(skeletonGrid, dayIndex, mealType) {
  return skeletonGrid ? (skeletonGrid[`${dayIndex}_${mealType}`] || skeletonGrid[dayIndex]?.[mealType] || null) : null;
}

export function isRecipeInSkeletonGrid(recipeId, skeletonGrid = {}) {
  if (!recipeId || !skeletonGrid) return false;
  for (const key of Object.keys(skeletonGrid)) {
    const val = skeletonGrid[key];
    if (!val || typeof val !== 'object') continue;
    if (val.recipeId === recipeId || val.elliott?.recipeId === recipeId || val.chloe?.recipeId === recipeId) return true;
    for (const m of ['breakfast', 'lunch', 'dinner']) {
      const sub = val[m];
      if (sub && (sub.recipeId === recipeId || sub.elliott?.recipeId === recipeId || sub.chloe?.recipeId === recipeId)) return true;
    }
  }
  return false;
}

function renderRecipeCandidateRows(recipes, { dayIndex, mealType, person = 'both', query = '', skeletonGrid = {} }) {
  const q = (query || '').toLowerCase().trim();
  const filtered = recipes.filter(r => !q || (r.name || '').toLowerCase().includes(q)).slice(0, 15);
  if (!filtered.length) {
    return '<div style="font-size:12px;color:#94a3b8;padding:8px;text-align:center">No matching recipes found</div>';
  }
  const activeProfile = person === 'both' ? 'everyone' : person;
  return filtered.map(r => {
    const fitObj = calculateMealFitScore(r, mealType, { activeProfile });
    const badgeHtml = renderFitScoreBadge(fitObj, mealType, { activeProfile });
    const isDup = isRecipeInSkeletonGrid(r.id, skeletonGrid);
    const clickAction = person === 'both'
      ? `window.setSlotConfiguredStatus(${dayIndex}, '${mealType}', 'pinned', '${escapeAttr(r.id)}', '${escapeAttr(r.name)}')`
      : `window.setSplitPersonSlotStatus(${dayIndex}, '${mealType}', '${person}', 'pinned', '${escapeAttr(r.id)}', '${escapeAttr(r.name)}')`;

    return `
      <div onclick="${clickAction}" style="padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#ffffff;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
        <div style="min-width:0;flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-weight:600;color:#1e293b">${escapeHtml(r.name)}</span>
          ${badgeHtml}
          ${isDup ? `<span class="badge badge-warning" style="font-size:10px;background:#fef3c7;color:#b45309;font-weight:700;padding:2px 6px;border-radius:4px">🔄 Already in Plan</span>` : ''}
        </div>
        <span style="font-size:11px;color:#2563eb;font-weight:700;flex-shrink:0">Pin →</span>
      </div>
    `;
  }).join('');
}

export function renderFitScoreScopeUI({ minVal = 0, maxVal = 100 } = {}) {
  const min = Math.max(0, Math.min(100, Number(minVal) || 0));
  const max = Math.max(min, Math.min(100, Number(maxVal) || 100));
  const trackGradient = `linear-gradient(90deg, #e2e8f0 0%, #e2e8f0 ${min}%, #2563eb ${min}%, #2563eb ${max}%, #e2e8f0 ${max}%, #e2e8f0 100%)`;

  return `
    <div class="fit-score-scope-card" style="background:var(--surface2,#f8fafc);padding:14px;border-radius:12px;border:1px solid var(--border,#e2e8f0);margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--text2,#64748b);display:block;text-transform:uppercase">Fit Score Scope (${min} – ${max})</label>
          <div style="font-size:12px;color:var(--text2,#64748b);margin-top:2px">Organise and filter recipe candidates by macro fit score range.</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:4px">
            <span style="font-size:11px;font-weight:600;color:var(--text2,#64748b)">Min:</span>
            <input type="number" id="wizard-fit-score-min" name="minFitScore" aria-label="Minimum Fit Score" min="0" max="100" value="${min}" style="width:58px;padding:4px 6px;font-size:12px;border:1px solid var(--border,#cbd5e1);border-radius:6px;background:#fff;font-weight:600" onchange="window.handleFitScoreMinChange(this.value)">
          </div>
          <span style="font-size:12px;color:var(--text2,#64748b)">–</span>
          <div style="display:flex;align-items:center;gap:4px">
            <span style="font-size:11px;font-weight:600;color:var(--text2,#64748b)">Max:</span>
            <input type="number" id="wizard-fit-score-max" name="maxFitScore" aria-label="Maximum Fit Score" min="0" max="100" value="${max}" style="width:58px;padding:4px 6px;font-size:12px;border:1px solid var(--border,#cbd5e1);border-radius:6px;background:#fff;font-weight:600" onchange="window.handleFitScoreMaxChange(this.value)">
          </div>
        </div>
      </div>
      <div style="position:relative;height:8px;border-radius:4px;background:${trackGradient};margin-top:6px;width:100%"></div>
    </div>
  `;
}

function renderSlotCardSummary(day, meal, config) {
  if (!config || config.status === 'unassigned') {
    return `
      <div class="skeleton-slot unassigned" onclick="window.openSlotConfigurator(${day}, '${meal.key}')" style="padding:8px 10px;border:1px dashed #cbd5e1;border-radius:8px;background:#ffffff;cursor:pointer;display:flex;align-items:center;justify-content:space-between" title="Tap to configure slot">
        <span style="font-size:12px;font-weight:600;color:#64748b">${meal.icon} ${meal.label}</span>
        <span style="font-size:11px;color:#94a3b8;font-style:italic">+ Assign</span>
      </div>
    `;
  }
  if (config.isSplit) {
    const eName = config.elliott?.recipeId ? resolveRecipeName(config.elliott.recipeId, config.elliott.recipeName) : '';
    const cName = config.chloe?.recipeId ? resolveRecipeName(config.chloe.recipeId, config.chloe.recipeName) : '';
    const eSummary = config.elliott?.isSkipped ? '🚫 Skipped' : (eName ? `📌 ${escapeHtml(eName)}` : '⚡ Auto');
    const cSummary = config.chloe?.isSkipped ? '🚫 Skipped' : (cName ? `📌 ${escapeHtml(cName)}` : '⚡ Auto');
    return `
      <div class="skeleton-slot split" onclick="window.openSlotConfigurator(${day}, '${meal.key}')" style="padding:8px 10px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;cursor:pointer;display:flex;flex-direction:column;gap:3px" title="Tap to modify split slot">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:10px;font-weight:700;color:#1e40af;text-transform:uppercase">${meal.icon} ${meal.label}</span>
          <span class="badge" style="font-size:9.5px;background:#dbeafe;color:#1d4ed8;font-weight:700;padding:1px 5px;border-radius:4px">Split</span>
        </div>
        <div style="font-size:11px;color:#1e3a8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><strong>E:</strong> ${eSummary}</div>
        <div style="font-size:11px;color:#1e3a8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><strong>C:</strong> ${cSummary}</div>
      </div>
    `;
  }
  if (config.isSkipped || config.status === 'skipped') {
    return `
      <div class="skeleton-slot skipped" onclick="window.openSlotConfigurator(${day}, '${meal.key}')" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;opacity:0.85" title="Tap to modify">
        <span style="font-size:12px;font-weight:600;color:#94a3b8;text-decoration:line-through">${meal.icon} ${meal.label}</span>
        <span class="badge" style="font-size:10px;background:#cbd5e1;color:#334155;font-weight:700;padding:2px 6px;border-radius:4px">Skipped</span>
      </div>
    `;
  }
  const sharedName = config.recipeId ? resolveRecipeName(config.recipeId, config.recipeName) : config.recipeName;
  if (sharedName) {
    return `
      <div class="skeleton-slot pinned" onclick="window.openSlotConfigurator(${day}, '${meal.key}')" style="padding:8px 10px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;cursor:pointer;display:flex;align-items:center;justify-content:space-between" title="Tap to modify">
        <div style="min-width:0;flex:1;padding-right:6px">
          <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase">${meal.icon} ${meal.label}</div>
          <div style="font-size:12px;font-weight:700;color:#14532d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📌 ${escapeHtml(sharedName)}</div>
        </div>
        <span class="badge" style="font-size:10px;background:#dcfce7;color:#15803d;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0">Pinned</span>
      </div>
    `;
  }
  return '';
}

export function renderSkeletonGridUI({ days = 7, startDate = '', skeletonGrid = {} } = {}) {
  const dayCount = Number(days) || 7;
  const start = startDate ? new Date(startDate) : new Date();
  const meals = [
    { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { key: 'lunch', label: 'Lunch', icon: '☀️' },
    { key: 'dinner', label: 'Dinner', icon: '🌙' }
  ];

  let gridCardsHtml = '';
  for (let d = 1; d <= dayCount; d++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + (d - 1));
    const dateStr = curDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const slotsHtml = meals.map(m => renderSlotCardSummary(d, m, getSkeletonSlotConfig(skeletonGrid, d, m.key))).join('');

    gridCardsHtml += `
      <div class="skeleton-day-card" style="background:#ffffff;border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 2px rgba(0,0,0,0.03)">
        <div style="font-size:13px;font-weight:750;color:var(--text,#1e293b);padding-bottom:4px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between">
          <span>Day ${d}</span>
          <span style="font-size:11px;font-weight:600;color:#64748b">${escapeHtml(dateStr)}</span>
        </div>
        ${slotsHtml}
      </div>
    `;
  }

  return `
    <div class="skeleton-grid-panel" style="background:var(--surface2,#f8fafc);padding:16px;border-radius:14px;border:1px solid var(--border,#e2e8f0);margin-bottom:16px">
      <div style="margin-bottom:12px">
        <h3 style="margin:0;font-size:15px;font-weight:750;color:var(--text,#0f172a)">Pre-Generation Layout Grid</h3>
        <div style="font-size:12px;color:var(--text2,#64748b);margin-top:2px">Tap any slot to pin a shared or split household recipe or mark as skipped before generating.</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px">
        ${gridCardsHtml}
      </div>
    </div>
  `;
}

function renderPersonSplitColumn(personKey, personLabel, dayIndex, mealType, personConfig = {}, recipes = [], skeletonGrid = {}) {
  const isSkipped = Boolean(personConfig.isSkipped);
  const pinnedName = personConfig.recipeId ? resolveRecipeName(personConfig.recipeId, personConfig.recipeName) : '';
  const statusText = isSkipped ? '🚫 Skipped' : (pinnedName ? `📌 ${escapeHtml(pinnedName)}` : '⚡ Auto-Generate (Unassigned)');

  return `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">
        <div>
          <div style="font-size:13px;font-weight:750;color:#0f172a">${personLabel}'s Meal</div>
          <div style="font-size:11.5px;color:#475569;margin-top:1px">${statusText}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn sm ${isSkipped ? 'primary' : 'secondary'}" style="font-size:11px;font-weight:700;padding:4px 8px" onclick="window.setSplitPersonSlotStatus(${dayIndex}, '${mealType}', '${personKey}', '${isSkipped ? 'unassigned' : 'skipped'}')">
            ${isSkipped ? '✓ Skipped' : '🚫 Skip'}
          </button>
          ${(isSkipped || pinnedName) ? `<button type="button" class="btn sm ghost" style="font-size:11px;padding:4px 6px" onclick="window.setSplitPersonSlotStatus(${dayIndex}, '${mealType}', '${personKey}', 'unassigned')">Reset</button>` : ''}
        </div>
      </div>
      <input type="search" id="slot-config-search-${personKey}" aria-label="Search recipe for ${personLabel}" placeholder="Search recipe for ${personLabel}..." class="input sm" style="width:100%;background:#fff" oninput="window.filterSlotConfigRecipes(this.value, '${personKey}')">
      <div id="slot-config-recipe-list-${personKey}" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
        ${renderRecipeCandidateRows(recipes, { dayIndex, mealType, person: personKey, query: '', skeletonGrid })}
      </div>
    </div>
  `;
}

export function openSlotConfigurator(dayIndex, mealType, forceSplitMode = null) {
  const state = window.state || {};
  const skeletonGrid = state.skeletonGrid || {};
  const currentConfig = getSkeletonSlotConfig(skeletonGrid, dayIndex, mealType) || { status: 'unassigned', isSkipped: false, isSplit: false };
  const isSplit = forceSplitMode !== null ? Boolean(forceSplitMode) : Boolean(currentConfig.isSplit);
  window.__slotConfigContext = { day: dayIndex, meal: mealType, isSplit };

  const existing = document.getElementById('slot-configurator-overlay');
  if (existing) existing.remove();

  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const hasAnyConfig = currentConfig.status && currentConfig.status !== 'unassigned';

  const overlay = document.createElement('div');
  overlay.id = 'slot-configurator-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="background:#ffffff;border-radius:16px;width:100%;max-width:${isSplit ? '680px' : '500px'};max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;background:#f8fafc">
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:750;color:#0f172a">Configure Day ${dayIndex} - ${mealLabel}</h3>
          <div style="font-size:11.5px;color:#64748b;margin-top:2px">Organise household anchors for Elliott &amp; Chloe</div>
        </div>
        <button type="button" class="btn sm ghost" onclick="window.closeSlotConfigurator()">✕</button>
      </div>

      <div style="padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn secondary" style="flex:1;padding:9px 12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px" onclick="window.setSlotConfiguredStatus(${dayIndex}, '${mealType}', 'skipped')">
            🚫 Skip Entire Slot (Both)
          </button>
          ${hasAnyConfig ? `<button type="button" class="btn" style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;font-weight:700;padding:9px 12px" onclick="window.setSlotConfiguredStatus(${dayIndex}, '${mealType}', 'unassigned')">Clear Slot</button>` : ''}
        </div>

        <!-- Dining Mode Segmented Toggle -->
        <div style="display:flex;background:#f1f5f9;padding:4px;border-radius:10px;gap:4px">
          <button type="button" onclick="window.toggleSlotConfiguratorMode(false)" style="flex:1;padding:7px 10px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:pointer;background:${!isSplit ? '#ffffff' : 'transparent'};color:${!isSplit ? '#0f172a' : '#64748b'};box-shadow:${!isSplit ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'}">
            👫 Shared Meal
          </button>
          <button type="button" onclick="window.toggleSlotConfiguratorMode(true)" style="flex:1;padding:7px 10px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:pointer;background:${isSplit ? '#ffffff' : 'transparent'};color:${isSplit ? '#0f172a' : '#64748b'};box-shadow:${isSplit ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'}">
            ↔️ Separate Meals (Elliott &amp; Chloe)
          </button>
        </div>

        ${!isSplit ? `
          <div style="border-top:1px solid #e2e8f0;padding-top:10px">
            <label for="slot-config-recipe-search" style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">📌 Pin Shared Recipe (Applies to Both)</label>
            <input type="search" id="slot-config-recipe-search" aria-label="Search recipe to pin" placeholder="Search recipe name..." class="input sm" style="width:100%;margin-bottom:8px" oninput="window.filterSlotConfigRecipes(this.value, 'both')">
            <div id="slot-config-recipe-list-both" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
              ${renderRecipeCandidateRows(recipes, { dayIndex, mealType, person: 'both', query: '', skeletonGrid })}
            </div>
          </div>
        ` : `
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:12px;border-top:1px solid #e2e8f0;padding-top:10px">
            ${renderPersonSplitColumn('elliott', 'Elliott', dayIndex, mealType, currentConfig.elliott || {}, recipes, skeletonGrid)}
            ${renderPersonSplitColumn('chloe', 'Chloe', dayIndex, mealType, currentConfig.chloe || {}, recipes, skeletonGrid)}
          </div>
          <div style="display:flex;justify-content:flex-end;padding-top:4px">
            <button type="button" class="btn primary sm" style="font-weight:700;padding:7px 18px" onclick="window.closeSlotConfigurator()">Done</button>
          </div>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

export function closeSlotConfigurator() {
  const el = document.getElementById('slot-configurator-overlay');
  if (el) el.remove();
}

export function setSlotConfiguredStatus(dayIndex, mealType, status, recipeId = null) {
  if (!window.state) window.state = {};
  if (!window.state.skeletonGrid) window.state.skeletonGrid = {};

  const slotKey = `${dayIndex}_${mealType}`;
  if (status === 'unassigned') {
    delete window.state.skeletonGrid[slotKey];
  } else if (status === 'skipped') {
    window.state.skeletonGrid[slotKey] = {
      status: 'skipped',
      isSkipped: true,
      isSplit: false,
      elliott: { isSkipped: true },
      chloe: { isSkipped: true }
    };
  } else {
    window.state.skeletonGrid[slotKey] = {
      status: 'pinned',
      isSkipped: false,
      isSplit: false,
      pinned: true,
      recipeId: recipeId || null,
      elliott: { recipeId: recipeId || null, isSkipped: false, pinned: true },
      chloe: { recipeId: recipeId || null, isSkipped: false, pinned: true }
    };
  }

  if (typeof window.saveState === 'function') window.saveState();
  closeSlotConfigurator();
  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
}

export function setSplitPersonSlotStatus(dayIndex, mealType, personKey, status, recipeId = null) {
  if (!window.state) window.state = {};
  if (!window.state.skeletonGrid) window.state.skeletonGrid = {};

  const slotKey = `${dayIndex}_${mealType}`;
  const existing = getSkeletonSlotConfig(window.state.skeletonGrid, dayIndex, mealType) || {};
  const elliott = { ...(existing.elliott || (existing.recipeId ? { recipeId: existing.recipeId, pinned: true } : (existing.isSkipped ? { isSkipped: true } : {}))) };
  const chloe = { ...(existing.chloe || (existing.recipeId ? { recipeId: existing.recipeId, pinned: true } : (existing.isSkipped ? { isSkipped: true } : {}))) };
  delete elliott.recipeName;
  delete chloe.recipeName;

  const targetObj = status === 'skipped'
    ? { isSkipped: true }
    : (status === 'pinned' && recipeId ? { recipeId, isSkipped: false, pinned: true } : {});

  const nextElliott = personKey === 'elliott' ? targetObj : elliott;
  const nextChloe = personKey === 'chloe' ? targetObj : chloe;

  window.state.skeletonGrid[slotKey] = {
    status: 'split',
    isSkipped: Boolean(nextElliott.isSkipped && nextChloe.isSkipped),
    isSplit: true,
    elliott: nextElliott,
    chloe: nextChloe
  };

  if (typeof window.saveState === 'function') window.saveState();
  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
  openSlotConfigurator(dayIndex, mealType, true);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderFitScoreScopeUI,
    renderSkeletonGridUI,
    openSlotConfigurator,
    closeSlotConfigurator,
    setSlotConfiguredStatus,
    setSplitPersonSlotStatus,
    toggleSlotConfiguratorMode(isSplit) {
      const ctx = window.__slotConfigContext || { day: 1, meal: 'dinner' };
      openSlotConfigurator(ctx.day, ctx.meal, Boolean(isSplit));
    },
    handleFitScoreMinChange(val) {
      if (!window.state) window.state = {};
      if (!window.state.prefs) window.state.prefs = {};
      window.state.prefs.minFitScore = parseInt(val, 10) || 0;
      if (typeof window.saveState === 'function') window.saveState();
      if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
    },
    handleFitScoreMaxChange(val) {
      if (!window.state) window.state = {};
      if (!window.state.prefs) window.state.prefs = {};
      window.state.prefs.maxFitScore = parseInt(val, 10) || 100;
      if (typeof window.saveState === 'function') window.saveState();
      if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
    },
    filterSlotConfigRecipes(query, person = 'both') {
      const ctx = window.__slotConfigContext || { day: 1, meal: 'dinner' };
      const listEl = document.getElementById(`slot-config-recipe-list-${person}`) || document.getElementById('slot-config-recipe-list-both');
      if (!listEl) return;
      const recipes = Array.isArray(window.state?.recipes) ? window.state.recipes : [];
      const skeletonGrid = window.state?.skeletonGrid || {};
      listEl.innerHTML = renderRecipeCandidateRows(recipes, {
        dayIndex: ctx.day,
        mealType: ctx.meal,
        person,
        query,
        skeletonGrid
      });
    }
  });
}
