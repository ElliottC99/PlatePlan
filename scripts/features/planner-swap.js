/**
 * scripts/features/planner-swap.js
 * PlatePlan Recipe Swap, Searchable Swap, Pinned Picker & Reschedule Engine
 */
(function() {
  'use strict';
  window.PlatePlanPlanner = window.PlatePlanPlanner || {};
  window.PlatePlanPlanner.State = window.PlatePlanPlanner.State || {};
  const PlannerState = window.PlatePlanPlanner.State;
  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function openSwapModal(slotKey) {
    PlannerState.swapModalContext = { slotKey };
    const modalEl = document.getElementById('swap-recipe-modal') || document.getElementById('recipe-swap-modal');
    if (modalEl) {
      modalEl.classList.remove('hidden');
      modalEl.style.display = 'block';
    } else {
      // Fallback prompt or alert if modal element is not in DOM
      const state = getState();
      const recipes = state.recipes || [];
      const recipeNames = recipes.map(r => `${r.name} (id: ${r.id})`).join('\n');
      const chosen = prompt(`Swap slot ${slotKey}\nEnter Recipe ID from library:\n\n${recipeNames}`);
      if (chosen) {
        applyRecipeSwap(slotKey, chosen.trim());
      }
    }
  }

  function closeSwapModal() {
    PlannerState.swapModalContext = null;
    const modalEl = document.getElementById('swap-recipe-modal') || document.getElementById('recipe-swap-modal');
    if (modalEl) {
      modalEl.classList.add('hidden');
      modalEl.style.display = 'none';
    }
  }

  function applyRecipeSwap(slotKey, recipeId, variantId = null, portions = 2) {
    const state = getState();
    if (!state.plan) state.plan = { days: 7, slots: {}, dayDates: {} };
    if (!state.plan.slots) state.plan.slots = {};
    
    if (!recipeId) {
      delete state.plan.slots[slotKey];
    } else {
      state.plan.slots[slotKey] = {
        recipeId,
        variantId,
        portions: Number(portions) || 2
      };
    }
    
    closeSwapModal();
    if (typeof window.renderPlan === 'function') window.renderPlan();
    if (typeof window.saveState === 'function') window.saveState();
  }

  function getPinnedRecipesList() {
    const state = getState();
    const favs = state.userPrefs?.favouriteVariantIds || [];
    const recipes = state.recipes || [];
    return recipes.filter(r => favs.includes(r.id) || r.pinned);
  }

  function setPreferEnhancedRecipes(prefer) {
    PlannerState.preferEnhancedRecipes = !!prefer;
  }

  function renderPinnedRecipesEditor() {
    const container = document.getElementById('pinned-recipes-container');
    if (!container) return;
    const pinned = getPinnedRecipesList();
    container.innerHTML = pinned.map(r => `
      <div class="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
        <span class="text-sm font-medium text-zinc-800 dark:text-zinc-200">${r.name}</span>
        <span class="text-xs text-emerald-600 font-medium">Pinned</span>
      </div>
    `).join('') || '<p class="text-xs text-zinc-400 italic">No pinned recipes</p>';
  }

  function resetSwapContext() {
    PlannerState.swapModalContext = null;
    PlannerState.searchableSwapContext = null;
    PlannerState.swapModalFilter = 'all';
  }

  const moduleExports = {
    openSwapModal,
    closeSwapModal,
    applyRecipeSwap,
    getPinnedRecipesList,
    setPreferEnhancedRecipes,
    renderPinnedRecipesEditor,
    resetSwapContext
  };

  window.PlatePlanPlanner = Object.assign(window.PlatePlanPlanner || {}, moduleExports);
  if (typeof window !== 'undefined') {
    for (const k of Object.keys(moduleExports)) {
      try { window[k] = moduleExports[k]; } catch(e) {}
    }
  }
})();
