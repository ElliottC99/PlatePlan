/**
 * scripts/features/planner-studio.js
 * PlatePlan Meal Plan Studio Drawer, Wizard & Auto-Generator Engine
 */
(function() {
  'use strict';
  window.PlatePlanPlanner = window.PlatePlanPlanner || {};
  window.PlatePlanPlanner.State = window.PlatePlanPlanner.State || {};
  const PlannerState = window.PlatePlanPlanner.State;
  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function ensurePlannerOptionsUI() {
    const el = document.getElementById('planner-options-ui');
    if (el && !el.innerHTML.trim()) {
      el.innerHTML = '<div class="text-xs text-zinc-500">Studio Options Ready</div>';
    }
  }

  function generatePlanFromQuickSetup() {
    const state = getState();
    if (!state.plan) state.plan = { days: 7, slots: {}, dayDates: {} };
    const recipes = state.recipes || [];
    if (recipes.length === 0) {
      alert('Please add some recipes to your library first!');
      return;
    }
    
    // Auto populate slots
    const days = state.plan.days || 7;
    const slots = {};
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    
    for (let i = 1; i <= days; i++) {
      mealTypes.forEach(meal => {
        const matching = recipes.filter(r => r.type === meal || !r.type || r.type === 'any');
        const chosen = matching.length > 0 ? matching[Math.floor(Math.random() * matching.length)] : recipes[0];
        if (chosen) {
          slots[`day-${i}-${meal}`] = { recipeId: chosen.id, portions: 2 };
        }
      });
    }
    
    state.plan.slots = slots;
    closeMealPlanStudio();
    if (typeof window.renderPlan === 'function') window.renderPlan();
    if (typeof window.saveState === 'function') window.saveState();
    alert('Meal plan successfully auto-generated!');
  }

  function generatePlanFromOptions(options = {}) {
    generatePlanFromQuickSetup();
  }

  function openMealPlanStudio() {
    const drawer = document.getElementById('meal-plan-studio-drawer') || document.getElementById('studio-drawer');
    if (drawer) {
      drawer.classList.remove('hidden');
      drawer.style.display = 'block';
    } else {
      if (confirm('Open Meal Plan Studio Auto-Generator?')) {
        generatePlanFromQuickSetup();
      }
    }
  }

  function closeMealPlanStudio() {
    const drawer = document.getElementById('meal-plan-studio-drawer') || document.getElementById('studio-drawer');
    if (drawer) {
      drawer.classList.add('hidden');
      drawer.style.display = 'none';
    }
  }

  function resetStudioSession() {
    PlannerState.studioSession = null;
    PlannerState.studioUndoBuffer = null;
  }

  function renderMealPlannerWizard() {
    const hostEl = document.getElementById('planner-wizard-host');
    if (!hostEl) return;

    const state = getState();
    const recipes = Array.isArray(state?.recipes) ? state.recipes : [];
    const plan = state?.plan || { days: 7, slots: {}, dayDates: {} };
    const days = Number(plan.days) || 7;
    const populatedSlotsCount = Object.keys(plan.slots || {}).filter(k => plan.slots[k] && plan.slots[k].recipeId).length;

    let html = `
      <div class="planner-compact-card bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-4 shadow-sm" id="planner-wizard-card">
        <div class="planner-compact-head flex items-center justify-between gap-3 mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 class="planner-compact-title text-base font-bold text-zinc-900 dark:text-zinc-100">Meal Planner Wizard</h3>
            <p class="planner-compact-copy text-xs text-zinc-500">Auto-generate meal plans, set plan length, and manage meal distribution.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="window.PlatePlanPlanner?.openPlanOptionsWorkspace && window.PlatePlanPlanner.openPlanOptionsWorkspace()" class="btn sm ghost text-xs">Options</button>
            <button type="button" onclick="window.PlatePlanPlanner?.generatePlanFromQuickSetup && window.PlatePlanPlanner.generatePlanFromQuickSetup()" class="btn sm primary text-xs">Auto-Generate</button>
          </div>
        </div>
        <div class="planner-quick-fields grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            <span class="block text-zinc-400 font-medium mb-1">Plan Duration</span>
            <strong class="text-zinc-800 dark:text-zinc-200 text-sm font-semibold">${days} Days</strong>
          </div>
          <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            <span class="block text-zinc-400 font-medium mb-1">Available Recipes</span>
            <strong class="text-zinc-800 dark:text-zinc-200 text-sm font-semibold">${recipes.length} Loaded</strong>
          </div>
          <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
            <span class="block text-zinc-400 font-medium mb-1">Populated Slots</span>
            <strong class="text-zinc-800 dark:text-zinc-200 text-sm font-semibold">${populatedSlotsCount} / ${days * 3}</strong>
          </div>
        </div>
        ${recipes.length === 0 ? `
          <div class="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>No recipes found in library. Add recipes to build custom meal plans.</span>
            <button type="button" onclick="window.requestPlatePlanViewRender && window.requestPlatePlanViewRender('add')" class="btn sm primary ml-2 text-xs shrink-0">Add Recipe</button>
          </div>
        ` : ''}
      </div>
    `;

    hostEl.innerHTML = html;
  }

  const moduleExports = {
    ensurePlannerOptionsUI,
    generatePlanFromQuickSetup,
    generatePlanFromOptions,
    openMealPlanStudio,
    closeMealPlanStudio,
    resetStudioSession,
    renderMealPlannerWizard
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
  }
})();
