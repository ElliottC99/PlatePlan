/**
 * scripts/features/planner-modals.js
 * PlatePlan Options, Dates Workspace, Use-Up Preferences & Plan History Engine
 */
(function() {
  'use strict';
  window.PlatePlanPlanner = window.PlatePlanPlanner || {};
  window.PlatePlanPlanner.State = window.PlatePlanPlanner.State || {};
  const PlannerState = window.PlatePlanPlanner.State;
  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function openPlanOptionsWorkspace() {
    const modalEl = document.getElementById('plan-options-modal') || document.getElementById('planner-options-modal');
    if (modalEl) {
      modalEl.classList.remove('hidden');
      modalEl.style.display = 'block';
    } else {
      const state = getState();
      const currentDays = state.plan?.days || 7;
      const newDays = prompt('Enter number of days for meal plan (1 - 14):', currentDays);
      if (newDays !== null) {
        const d = parseInt(newDays, 10);
        if (d >= 1 && d <= 14) {
          if (!state.plan) state.plan = { days: 7, slots: {}, dayDates: {} };
          state.plan.days = d;
          if (typeof window.renderPlan === 'function') window.renderPlan();
          if (typeof window.saveState === 'function') window.saveState();
        } else {
          alert('Please enter a valid number of days between 1 and 14.');
        }
      }
    }
  }

  function closePlanOptionsWorkspace() {
    const modalEl = document.getElementById('plan-options-modal') || document.getElementById('planner-options-modal');
    if (modalEl) {
      modalEl.classList.add('hidden');
      modalEl.style.display = 'none';
    }
  }

  function confirmClearPlanFromOptions() {
    if (confirm('Are you sure you want to clear the entire meal plan?')) {
      const state = getState();
      if (state.plan) {
        state.plan.slots = {};
      }
      closePlanOptionsWorkspace();
      if (typeof window.renderPlan === 'function') window.renderPlan();
      if (typeof window.saveState === 'function') window.saveState();
    }
  }

  function renderPlanHistoryPanel() {
    const container = document.getElementById('plan-history-container') || document.getElementById('plan-library-container');
    if (!container) return;
    const state = getState();
    const history = state.planHistory || [];
    container.innerHTML = history.map(h => `
      <div class="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h4 class="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">${h.name || 'Saved Plan'}</h4>
          <p class="text-xs text-zinc-500">${h.days || 7} Days • ${Object.keys(h.slots || {}).length} meals</p>
        </div>
        <button onclick="window.PlatePlanPlanner?.applyPlanFromLibrary && window.PlatePlanPlanner.applyPlanFromLibrary('${h.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium">Load</button>
      </div>
    `).join('') || '<p class="text-xs text-zinc-400 italic">No saved plan history found.</p>';
  }

  function applyPlanFromLibrary(historyId) {
    const state = getState();
    const history = state.planHistory || [];
    const found = history.find(h => h.id === historyId);
    if (found) {
      state.plan = JSON.parse(JSON.stringify(found));
      if (typeof window.renderPlan === 'function') window.renderPlan();
      if (typeof window.saveState === 'function') window.saveState();
      alert(`Loaded plan: ${found.name || 'Saved Plan'}`);
    }
  }

  const moduleExports = {
    openPlanOptionsWorkspace,
    closePlanOptionsWorkspace,
    confirmClearPlanFromOptions,
    renderPlanHistoryPanel,
    applyPlanFromLibrary
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
    window.renderLibrary = renderPlanHistoryPanel;
    window.renderMealPlanLibrary = renderPlanHistoryPanel;
    window.renderPlanlib = renderPlanHistoryPanel;
  }
})();
