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

  function updateWizardDaysCount() {
    const checkboxes = document.querySelectorAll('.wizard-day-cb:checked');
    const state = getState();
    if (!state.plan) state.plan = { days: 7, slots: {}, dayDates: {} };
    state.plan.days = Math.max(1, checkboxes.length || 7);
  }

  function renderMealPlannerWizard() {
    const hostEl = document.getElementById('planner-wizard-host');
    if (!hostEl) return;

    const state = getState();
    const recipes = Array.isArray(state?.recipes) ? state.recipes : (window.PlatePlanRecipes?.State?.recipes || []);
    const plan = state?.plan || { days: 7, slots: {}, dayDates: {} };
    const days = Number(plan.days) || 7;
    const prefs = state?.prefs || window.PlatePlanCloud?.State?.settings || {};
    const targets = prefs.targets || { cal: 2000, prot: 140, carb: 220, fat: 65 };
    const hasRecipes = recipes.length > 0;

    const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let html = `
      <div class="planner-compact-card bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 shadow-sm" id="planner-wizard-card">
        <div class="planner-compact-head flex items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 class="planner-compact-title text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Meal Planner Wizard</span>
              <span class="text-xs font-normal px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-mono">${recipes.length} Recipes Available</span>
            </h3>
            <p class="planner-compact-copy text-xs text-zinc-500 mt-0.5">Configure schedule, meal distribution, and nutritional macro targets.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="window.PlatePlanPlanner?.openPlanOptionsWorkspace && window.PlatePlanPlanner.openPlanOptionsWorkspace()" class="btn sm ghost text-xs">Options</button>
          </div>
        </div>

        <!-- Section A: Day Selector (Mon-Sun) -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Active Plan Schedule (Mon - Sun)</label>
          <div class="grid grid-cols-7 gap-1.5 sm:gap-2">
            ${weekDays.map((day, idx) => `
              <label class="flex flex-col items-center justify-center p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <input type="checkbox" class="wizard-day-cb mb-1 rounded text-emerald-600 focus:ring-emerald-500" ${idx < days ? 'checked' : ''} value="${day.toLowerCase()}" onchange="window.PlatePlanPlanner?.updateWizardDaysCount && window.PlatePlanPlanner.updateWizardDaysCount()">
                <span class="text-xs font-medium text-zinc-700 dark:text-zinc-300">${day}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Section B: Meal Distribution Controls -->
        <div class="mb-4 p-3.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
          <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Meal Slot Distribution</label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Breakfast Repeats</label>
              <select id="wizard-repeat-breakfast" class="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                <option value="1">Daily Variety (1 day)</option>
                <option value="2" selected>Repeat 2 days</option>
                <option value="3">Prep 3 days</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Lunch Distribution</label>
              <select id="wizard-repeat-lunch" class="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                <option value="1">Daily Variety (1 day)</option>
                <option value="2" selected>Batch Prep (2 days)</option>
                <option value="3">Batch Prep (3 days)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-zinc-500 mb-1">Dinner Distribution</label>
              <select id="wizard-repeat-dinner" class="w-full text-xs p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200">
                <option value="1">Daily Variety (1 day)</option>
                <option value="2" selected>Cook & Save (2 days)</option>
                <option value="3">Cook & Save (3 days)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Section C: Macro Target Inputs -->
        <div class="mb-4">
          <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Daily Macro Targets</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span class="block text-[10px] text-zinc-400 font-medium mb-1">Calories (kcal)</span>
              <input type="number" id="wizard-target-cal" value="${targets.cal || 2000}" class="w-full text-xs font-bold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none border-b border-zinc-200 dark:border-zinc-700 focus:border-emerald-500" placeholder="2000">
            </div>
            <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span class="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mb-1">Protein (g)</span>
              <input type="number" id="wizard-target-prot" value="${targets.prot || 140}" class="w-full text-xs font-bold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none border-b border-zinc-200 dark:border-zinc-700 focus:border-emerald-500" placeholder="140">
            </div>
            <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span class="block text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-1">Carbs (g)</span>
              <input type="number" id="wizard-target-carb" value="${targets.carb || 220}" class="w-full text-xs font-bold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none border-b border-zinc-200 dark:border-zinc-700 focus:border-emerald-500" placeholder="220">
            </div>
            <div class="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span class="block text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-1">Fat (g)</span>
              <input type="number" id="wizard-target-fat" value="${targets.fat || 65}" class="w-full text-xs font-bold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none border-b border-zinc-200 dark:border-zinc-700 focus:border-emerald-500" placeholder="65">
            </div>
          </div>
        </div>

        ${!hasRecipes ? `
          <div class="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>No recipes found in library. Add recipes to enable auto-generation.</span>
            <button type="button" onclick="window.requestPlatePlanViewRender && window.requestPlatePlanViewRender('add')" class="btn sm primary ml-2 text-xs shrink-0">Add Recipe</button>
          </div>
        ` : ''}

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button type="button" onclick="window.PlatePlanPlanner?.generatePlanFromQuickSetup && window.PlatePlanPlanner.generatePlanFromQuickSetup()" class="btn primary text-xs px-5 py-2 ${!hasRecipes ? 'opacity-50 cursor-not-allowed' : ''}" ${!hasRecipes ? 'disabled' : ''}>
            Auto-Generate Plan
          </button>
        </div>
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
    updateWizardDaysCount,
    renderMealPlannerWizard
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
  }
})();
