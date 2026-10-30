/**
 * src/views/PlannerView.js (v3.38.66)
 * Componentised Weekly Planner, Wizard & Schedule Controller View.
 * Strictly modular (<350 lines) with sanitised reset state persistence.
 */

import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { subscribe } from '../store/store.js';
import { getState } from '../store/coreState.js';
import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import * as GeneratorConstraintsForm from '../components/generator/GeneratorConstraintsForm.js';
import { renderWizardStep2, renderWizardStep3 } from './PlannerRenderService.js';
import {
  openSwapMealModal,
  setSwapModalFilter,
  selectSwapModalRecipe,
  confirmSwapMealModal,
  renderSwapModalOptionsList,
  executeSwapSlotAndClose,
  closeSwapMealModal,
  quickRandomizeSwap,
  toggleSlotVariant,
  prioritiseAllPlannedEnhancedRecipes,
  openPlannedMealActions,
  swapSlot
} from '../components/planner/PlannerSwapModalUI.js';

export {
  getShoppingLineStateKey,
  openSwapMealModal,
  setSwapModalFilter,
  selectSwapModalRecipe,
  confirmSwapMealModal,
  renderSwapModalOptionsList,
  executeSwapSlotAndClose,
  closeSwapMealModal,
  quickRandomizeSwap,
  toggleSlotVariant,
  prioritiseAllPlannedEnhancedRecipes,
  openPlannedMealActions,
  swapSlot
};


export function renderPlanner() {
  renderPlannerWizard();
  renderPlan();
}

export function renderPlannerWizard() {
  const host = document.getElementById('planner-wizard-host');
  if (!host) return;

  const currentStep = typeof window.getPlannerWizardStep === 'function' ? window.getPlannerWizardStep() : (getState().currentPlannerStep || 1);
  const hasActivePlan = !!(getState().currentPlan?.slots && Object.keys(getState().currentPlan.slots).length > 0);
  let stepContentHtml = '';

  if (currentStep === 1) {
    // The form's own values win, as in the old runtime, so an edit or Start Fresh isn't undone
    // by the loaded plan on the next render.
    const daysVal = getState().currentPlannerDays || getState().currentPlan?.days || 10;
    const today = new Date().toISOString().split('T')[0];
    const startVal = getState().currentPlannerStartDate || getState().currentPlan?.dayDates?.[1] || today;
    const cadence = getState()?.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
    const minFitScore = getState()?.prefs?.minFitScore || 0;
    const rawPinned = getState().currentPlanOptions?.pinnedMeals ?.pinnedRecipes || [];
    const pinned = Array.isArray(rawPinned) ? rawPinned : [];

    stepContentHtml = GeneratorConstraintsForm.renderConstraintsForm({
      daysVal, startVal, cadence, minFitScore, pinned
    }) || '';
  } else if (currentStep === 2) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(2) || `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Generated Yet</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Configure your days and requests in Step 1 to generate your meal plan.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1: Configure Requests</button>
        </div>
      `;
    } else {
      stepContentHtml = renderWizardStep2(getState().currentPlan || {});
    }
  } else if (currentStep === 3) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(3) || '';
    } else {
      stepContentHtml = renderWizardStep3(getState().currentPlan || {});
    }
  } else if (currentStep === 4) {
    stepContentHtml = window.GeneratorWizardModal?.renderWizardStep4Commit?.('v3.30.0') || '';
  }

  host.innerHTML = window.GeneratorWizardModal?.renderPlannerWizardView?.({
    currentStep, hasActivePlan, stepContentHtml
  }) || `<div class="planner-wizard-container">${stepContentHtml}</div>`;
  
  if (currentStep === 1) {
    GeneratorConstraintsForm.bindConstraintEvents(host, renderPlannerWizard);
  }

  if (!host.hasAttribute('data-delegated')) {
    host.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      
      if (action === 'set-step') {
        const step = parseInt(actionBtn.dataset.step);
        if (typeof window.setPlannerWizardStep === 'function') window.setPlannerWizardStep(step);
      } else if (action === 'commit-plan') {
        if (typeof window.commitPlannerWizardPlan === 'function') window.commitPlannerWizardPlan();
      } else if (action === 'back-to-plan') {
        if (typeof window.setPlannerWizardStep === 'function') window.setPlannerWizardStep(2);
      } else if (action === 'copy-list') {
        import('../components/shopping/ShoppingBatchToolbar.js').then(m => m.exportShoppingListToClipboard());
      }
    });
    host.setAttribute('data-delegated', 'true');
  }
}

// The legacy day grid (#plan-content) sits in a hidden wrap in index.html and is no longer drawn:
// what people see is the wizard.
export function renderPlan() {
  renderPlannerWizard();
  // Deferred to the plan library piece, which defines it.
  if (typeof window.renderPlanHistoryPanel === 'function') window.renderPlanHistoryPanel();
}

// Step 3 "Save Shopping List & Plan" and Step 4 "Commit Plan Now". Saves the loaded plan as a
// whole document, leaves the wizard on Step 2 for next time and opens Today, as the old commit did.
export function commitPlannerWizardPlan() {
  const toast = (m, type) => { if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(m, type); };
  const plan = getState().currentPlan;
  if (!plan || !plan.slots) {
    toast('No active plan found to commit.');
    return;
  }
  getState().currentPlannerStep = 2;
  const failed = err => {
    if (err) console.error('[PlannerView] Failed to commit meal plan:', err);
    toast('Failed to commit meal plan. Check network connection.', 'error');
  };
  saveCurrentPlan(plan).then(saved => {
    if (!saved) { failed(); return; }
    toast('Meal plan committed! Displaying Today\'s meals. ✓', 'success');
    if (typeof window.showView === 'function') window.showView('today');
  }).catch(failed);
}

export function setPlannerWizardStep(step) {
  const nextStep = Math.max(1, Math.min(4, step));
  if (typeof window !== 'undefined' && getState()) getState().currentPlannerStep = nextStep;
  renderPlannerWizard();
}

// Start Fresh, as the old runtime had it: back to Step 1 with no pinned meals, today's date and
// 10 days. The saved plan is left alone, so Today keeps the current week until a new plan is
// committed.
export function resetPlannerStartFresh() {
  const state = getState();
  if (state) {
    if (state.currentPlanOptions?.pinnedMeals) state.currentPlanOptions.pinnedMeals.pinnedRecipes = [];
    state.currentPlannerStartDate = new Date().toISOString().split('T')[0];
    state.currentPlannerDays = 10;
  }
  setPlannerWizardStep(1);
  if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Meal planner reset to Step 1. ✓');
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    setPlannerWizardStep, resetPlannerStartFresh, commitPlannerWizardPlan, renderPlanner, renderPlannerWizard, renderPlan,
    toggleSlotVariant, prioritiseAllPlannedEnhancedRecipes, openPlannedMealActions, swapSlot,
    openSwapMealModal, setSwapModalFilter, selectSwapModalRecipe, confirmSwapMealModal,
    renderSwapModalOptionsList, executeSwapSlotAndClose, closeSwapMealModal, quickRandomizeSwap,
    openRecipeModal: (id, instanceId, variant) => typeof window.viewRecipe === 'function' ? window.viewRecipe(id, instanceId, variant) : undefined
  });
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}

let plannerUnsub = null, prefsUnsub = null;
const handlePreferencesUpdated = () => renderPlanner();

export function mount() {
  renderPlanner();
  plannerUnsub = subscribe('plan', () => renderPlanner());
  prefsUnsub = subscribe('preferences', () => renderPlanner());
  document.addEventListener('plateplan:state:preferences', handlePreferencesUpdated);
  window.addEventListener('plateplan:preferences-updated', handlePreferencesUpdated);
}

export function unmount() {
  if (typeof plannerUnsub === 'function') { plannerUnsub(); plannerUnsub = null; }
  if (typeof prefsUnsub === 'function') { prefsUnsub(); prefsUnsub = null; }
  document.removeEventListener('plateplan:state:preferences', handlePreferencesUpdated);
  window.removeEventListener('plateplan:preferences-updated', handlePreferencesUpdated);
}
