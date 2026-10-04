/**
 * src/components/planner/PlannerSkeletonGridUI.js (v3.19.75)
 * Dual-Dot Fit Score Scope Timeline & Pre-Generation Interactive Skeleton Grid.
 * Enables user-defined anchors (Pinned Recipes & Skipped Slots) prior to meal plan generation.
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
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

      <!-- Visual Track Bar -->
      <div style="position:relative;height:8px;border-radius:4px;background:${trackGradient};margin-top:6px;width:100%"></div>
    </div>
  `;
}

export function renderSkeletonGridUI({ days = 7, startDate = '', skeletonGrid = {} } = {}) {
  const dayCount = Number(days) || 7;
  const start = startDate ? new Date(startDate) : new Date();

  let gridCardsHtml = '';
  const meals = [
    { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { key: 'lunch', label: 'Lunch', icon: '☀️' },
    { key: 'dinner', label: 'Dinner', icon: '🌙' }
  ];

  for (let d = 1; d <= dayCount; d++) {
    const curDate = new Date(start);
    curDate.setDate(start.getDate() + (d - 1));
    const dateStr = curDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

    let slotsHtml = '';
    meals.forEach(m => {
      const slotKey = `${d}_${m.key}`;
      const config = skeletonGrid[slotKey] || { status: 'unassigned' };

      if (config.status === 'skipped') {
        slotsHtml += `
          <div class="skeleton-slot skipped" onclick="window.openSlotConfigurator(${d}, '${m.key}')" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:space-between;opacity:0.85" title="Tap to modify">
            <span style="font-size:12px;font-weight:600;color:#94a3b8;text-decoration:line-through">${m.icon} ${m.label}</span>
            <span class="badge" style="font-size:10px;background:#cbd5e1;color:#334155;font-weight:700;padding:2px 6px;border-radius:4px">Skipped</span>
          </div>
        `;
      } else if (config.status === 'pinned' && config.recipeName) {
        slotsHtml += `
          <div class="skeleton-slot pinned" onclick="window.openSlotConfigurator(${d}, '${m.key}')" style="padding:8px 10px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;cursor:pointer;display:flex;align-items:center;justify-content:space-between" title="Tap to modify">
            <div style="min-width:0;flex:1;padding-right:6px">
              <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase">${m.icon} ${m.label}</div>
              <div style="font-size:12px;font-weight:700;color:#14532d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📌 ${escapeHtml(config.recipeName)}</div>
            </div>
            <span class="badge" style="font-size:10px;background:#dcfce7;color:#15803d;font-weight:700;padding:2px 6px;border-radius:4px;flex-shrink:0">Pinned</span>
          </div>
        `;
      } else {
        slotsHtml += `
          <div class="skeleton-slot unassigned" onclick="window.openSlotConfigurator(${d}, '${m.key}')" style="padding:8px 10px;border:1px dashed #cbd5e1;border-radius:8px;background:#ffffff;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:border-color 0.15s" title="Tap to configure slot">
            <span style="font-size:12px;font-weight:600;color:#64748b">${m.icon} ${m.label}</span>
            <span style="font-size:11px;color:#94a3b8;font-style:italic">+ Assign</span>
          </div>
        `;
      }
    });

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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:750;color:var(--text,#0f172a)">Pre-Generation Layout Grid</h3>
          <div style="font-size:12px;color:var(--text2,#64748b);margin-top:2px">Tap any slot to pin a recipe or mark it as skipped before generating.</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px">
        ${gridCardsHtml}
      </div>
    </div>
  `;
}

export function openSlotConfigurator(dayIndex, mealType) {
  window.__slotConfigContext = { day: dayIndex, meal: mealType };
  const existing = document.getElementById('slot-configurator-overlay');
  if (existing) existing.remove();

  const state = window.state || {};
  const skeletonGrid = state.skeletonGrid || {};
  const slotKey = `${dayIndex}_${mealType}`;
  const currentConfig = skeletonGrid[slotKey] || { status: 'unassigned' };
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];

  const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  const overlay = document.createElement('div');
  overlay.id = 'slot-configurator-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  overlay.innerHTML = `
    <div style="background:#ffffff;border-radius:16px;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;background:#f8fafc">
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:750;color:#0f172a">Configure Day ${dayIndex} - ${mealLabel}</h3>
          <div style="font-size:11.5px;color:#64748b;margin-top:2px">Set an anchor for this meal slot</div>
        </div>
        <button type="button" class="btn sm ghost" onclick="window.closeSlotConfigurator()">✕</button>
      </div>

      <div style="padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:14px">
        ${currentConfig.status !== 'unassigned' ? `
          <div style="padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:12px;font-weight:600;color:#991b1b">Current Status: ${currentConfig.status.toUpperCase()} ${currentConfig.recipeName ? `(${escapeHtml(currentConfig.recipeName)})` : ''}</span>
            <button type="button" class="btn sm" style="background:#ef4444;color:#ffffff;font-weight:700" onclick="window.setSlotConfiguredStatus(${dayIndex}, '${mealType}', 'unassigned')">Clear Slot</button>
          </div>
        ` : ''}

        <button type="button" class="btn secondary" style="width:100%;padding:10px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px" onclick="window.setSlotConfiguredStatus(${dayIndex}, '${mealType}', 'skipped')">
          🚫 Mark Slot as Skipped
        </button>

        <div style="border-top:1px solid #e2e8f0;padding-top:12px">
          <label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">📌 Pin a Recipe to Slot</label>
          <input type="search" id="slot-config-recipe-search" aria-label="Search recipe to pin" placeholder="Search recipe name..." class="input sm" style="width:100%;margin-bottom:8px" oninput="window.filterSlotConfigRecipes(this.value)">
          
          <div id="slot-config-recipe-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
            ${recipes.slice(0, 15).map(r => `
              <div onclick="window.setSlotConfiguredStatus(${dayIndex}, '${mealType}', 'pinned', '${escapeAttr(r.id)}', '${escapeAttr(r.name)}')" style="padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#ffffff;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:12.5px" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
                <span style="font-weight:600;color:#1e293b">${escapeHtml(r.name)}</span>
                <span style="font-size:11px;color:#2563eb;font-weight:700">Pin →</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

export function closeSlotConfigurator() {
  const el = document.getElementById('slot-configurator-overlay');
  if (el) el.remove();
}

export function setSlotConfiguredStatus(dayIndex, mealType, status, recipeId = null, recipeName = null) {
  if (!window.state) window.state = {};
  if (!window.state.skeletonGrid) window.state.skeletonGrid = {};

  const slotKey = `${dayIndex}_${mealType}`;
  if (status === 'unassigned') {
    delete window.state.skeletonGrid[slotKey];
  } else {
    window.state.skeletonGrid[slotKey] = {
      status,
      recipeId: recipeId || null,
      recipeName: recipeName || null
    };
  }

  if (typeof window.saveState === 'function') window.saveState();
  closeSlotConfigurator();

  if (typeof window.renderPlannerWizard === 'function') {
    window.renderPlannerWizard();
  }
}

if (typeof window !== 'undefined') {
  window.renderFitScoreScopeUI = renderFitScoreScopeUI;
  window.renderSkeletonGridUI = renderSkeletonGridUI;
  window.openSlotConfigurator = openSlotConfigurator;
  window.closeSlotConfigurator = closeSlotConfigurator;
  window.setSlotConfiguredStatus = setSlotConfiguredStatus;

  window.handleFitScoreMinChange = function(val) {
    if (!window.state) window.state = {};
    if (!window.state.prefs) window.state.prefs = {};
    window.state.prefs.minFitScore = parseInt(val, 10) || 0;
    if (typeof window.saveState === 'function') window.saveState();
    if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
  };

  window.handleFitScoreMaxChange = function(val) {
    if (!window.state) window.state = {};
    if (!window.state.prefs) window.state.prefs = {};
    window.state.prefs.maxFitScore = parseInt(val, 10) || 100;
    if (typeof window.saveState === 'function') window.saveState();
    if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
  };

  window.filterSlotConfigRecipes = function(query) {
    const listEl = document.getElementById('slot-config-recipe-list');
    if (!listEl) return;
    const q = (query || '').toLowerCase().trim();
    const recipes = Array.isArray(window.state?.recipes) ? window.state.recipes : [];
    const filtered = recipes.filter(r => (r.name || '').toLowerCase().includes(q));

    listEl.innerHTML = filtered.slice(0, 15).map(r => `
      <div onclick="window.setSlotConfiguredStatus(${window.__slotConfigContext?.day || 1}, '${window.__slotConfigContext?.meal || 'dinner'}', 'pinned', '${escapeAttr(r.id)}', '${escapeAttr(r.name)}')" style="padding:8px 10px;border-radius:6px;border:1px solid #e2e8f0;background:#ffffff;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-size:12.5px" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">
        <span style="font-weight:600;color:#1e293b">${escapeHtml(r.name)}</span>
        <span style="font-size:11px;color:#2563eb;font-weight:700">Pin →</span>
      </div>
    `).join('') || '<div style="font-size:12px;color:#94a3b8;padding:8px">No matching recipes found</div>';
  };
}
