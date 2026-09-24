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

  const moduleExports = {
    ensurePlannerOptionsUI,
    generatePlanFromQuickSetup,
    generatePlanFromOptions,
    openMealPlanStudio,
    closeMealPlanStudio,
    resetStudioSession
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
  }
})();
