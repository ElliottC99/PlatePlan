/**
 * scripts/features/planner-ui.js
 * PlatePlan Core Planner Grid, Day Card Views, Meal Slot Cards, Summary Bars & View Entrypoints
 */
(function() {
  'use strict';
  window.PlatePlanPlanner = window.PlatePlanPlanner || {};
  window.PlatePlanPlanner.State = window.PlatePlanPlanner.State || {
    draftDayDates: null,
    isReconcilingSummaries: false,
    summaryObserver: null,
    useUpCoverageCache: {},
    useUpSaveTimer: null,
    pinnedPickerFilter: 'all',
    pinnedPickerSearch: '',
    studioSession: null,
    studioUndoBuffer: null,
    searchableSwapContext: null,
    swapModalContext: null,
    swapModalFilter: 'all'
  };
  const PlannerState = window.PlatePlanPlanner.State;
  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function renderPlannerView() {
    const state = getState();
    const container = document.getElementById('view-planner');
    if (!container) return;
    renderPlan();
  }

  function renderPlan() {
    const state = getState();
    const gridEl = document.getElementById('planner-grid') || document.getElementById('meal-plan-grid');
    if (!gridEl) {
      // If container doesn't exist yet, schedule or return
      return;
    }
    const plan = state.plan || { days: 7, slots: {}, dayDates: {} };
    const daysCount = Number(plan.days) || 7;
    
    let html = '';
    for (let i = 1; i <= daysCount; i++) {
      const dayKey = `day-${i}`;
      const dateStr = plan.dayDates && plan.dayDates[dayKey] ? plan.dayDates[dayKey] : '';
      const dayLabel = (typeof window.formatPlanDayLabel === 'function') ? window.formatPlanDayLabel(dayKey, dateStr) : `Day ${i}`;
      
      html += `
        <div class="planner-day-card bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col gap-3" data-day="${dayKey}">
          <div class="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h3 class="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">${dayLabel}</h3>
            <button onclick="window.PlatePlanPlanner?.openPlanOptionsWorkspace && window.PlatePlanPlanner.openPlanOptionsWorkspace()" class="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Configure</button>
          </div>
          <div class="flex flex-col gap-2 meal-slots-container">
      `;

      const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      mealTypes.forEach(mealType => {
        const slotKey = `${dayKey}-${mealType}`;
        const slot = plan.slots && plan.slots[slotKey];
        const recipe = slot && state.recipes ? state.recipes.find(r => r.id === slot.recipeId) : null;
        
        html += `
          <div class="meal-slot-card p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between group" data-slot="${slotKey}">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-xs font-medium text-zinc-500 uppercase w-16 shrink-0">${mealType}</span>
              <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">${recipe ? recipe.name : '<span class="text-zinc-400 italic">Empty slot</span>'}</span>
            </div>
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button onclick="window.PlatePlanPlanner?.openSwapModal && window.PlatePlanPlanner.openSwapModal('${slotKey}')" class="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 font-medium">Swap</button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }

    gridEl.innerHTML = html;
    renderPlannerSummaryBar();
  }

  function renderPlannerSummaryBar() {
    const summaryEl = document.getElementById('planner-summary-bar');
    if (!summaryEl) return;
    const state = getState();
    const plan = state.plan || {};
    summaryEl.innerHTML = `
      <div class="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-sm">
        <span class="font-medium text-emerald-900 dark:text-emerald-200">Meal Plan Active (${plan.days || 7} Days)</span>
        <div class="flex items-center gap-3">
          <button onclick="window.PlatePlanPlanner?.openPlanOptionsWorkspace && window.PlatePlanPlanner.openPlanOptionsWorkspace()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-xs shadow-sm">Plan Options</button>
          <button onclick="window.PlatePlanPlanner?.openMealPlanStudio && window.PlatePlanPlanner.openMealPlanStudio()" class="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white font-medium rounded-xl text-xs shadow-sm">Meal Studio</button>
        </div>
      </div>
    `;
  }

  const moduleExports = {
    renderPlannerView,
    renderPlan,
    renderPlannerSummaryBar
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
    window.renderPlannerView = renderPlan;
    window.renderPlan = renderPlan;
  }
})();
