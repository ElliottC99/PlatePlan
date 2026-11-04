/**
 * src/views/PlannerView.js (v3.39.0)
 * Componentised Weekly Planner, Wizard & Meal Plan Library Controller View.
 * Strictly modular with active plan auto-archiving, interactive history management, and state persistence.
 */

import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { subscribe, store, Store, setCurrentPlan } from '../store/store.js';
import { getState } from '../store/coreState.js';
import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import * as GeneratorConstraintsForm from '../components/generator/GeneratorConstraintsForm.js';
import { renderWizardStep2, renderWizardStep3 } from './PlannerRenderService.js';
import { renderHistoryPanel, getPlanDateRangeLabel, getPlanRecipeIds } from '../components/planner/PlannerGridUI.js';
import DialogHelpers from '../components/ui/DialogHelpers.js';
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

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function renderPlanner() {
  renderPlannerWizard();
  renderPlan();
}

export function renderPlannerWizard() {
  const wizardContainer = document.getElementById('planner-wizard-flow');
  if (!wizardContainer) return;
  const state = getState() || {};
  const currentStep = state.currentPlannerStep || 2;

  if (currentStep === 1) {
    if (typeof GeneratorConstraintsForm.renderStep1 === 'function') {
      GeneratorConstraintsForm.renderStep1(wizardContainer);
    }
  } else if (currentStep === 2) {
    renderWizardStep2(wizardContainer);
  } else if (currentStep === 3) {
    renderWizardStep3(wizardContainer);
  } else {
    renderWizardStep2(wizardContainer);
  }
}

export function renderPlan() {
  renderPlannerWizard();
  if (typeof renderPlanLibrary === 'function') renderPlanLibrary();
}

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

    // Auto-archive active plan into historical plans collection for Library & 30-day rotation
    try {
      import('../repositories/PlanRepository.js').then(repo => {
        const archivePayload = repo.createPlanArchivePayload(plan);
        if (archivePayload && repo.savePlanHistory) {
          repo.savePlanHistory(archivePayload.id, archivePayload).then(() => {
            if (typeof renderPlanLibrary === 'function') renderPlanLibrary();
          }).catch(e => console.warn('[PlannerView] Background plan archive save error:', e));
        }
      });
    } catch (e) {
      console.warn('[PlannerView] Failed triggering background plan archive:', e);
    }

    toast('Meal plan committed & saved to Library! Displaying Today\'s meals. ✓', 'success');
    if (typeof window.showView === 'function') window.showView('today');
  }).catch(failed);
}

export function setPlannerWizardStep(step) {
  const nextStep = Math.max(1, Math.min(4, step));
  if (typeof window !== 'undefined' && getState()) getState().currentPlannerStep = nextStep;
  renderPlannerWizard();
}

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

/**
 * Meal Plan Library Rendering & Interactive Actions
 */
export async function renderPlanLibrary() {
  const container = document.getElementById('plan-history-panel');
  if (!container) return;

  const state = getState() || {};
  const activePlan = state.currentPlan || null;
  const recipes = state.recipes || [];

  container.innerHTML = `
    <div style="padding:24px; text-align:center; color:var(--text3,#78716c);">
      <div class="spinner" style="margin: 0 auto 12px;"></div>
      <div style="font-size:12px;">Loading saved meal plans...</div>
    </div>
  `;

  try {
    const { getPlanHistory } = await import('../repositories/PlanRepository.js');
    const historyPlans = await getPlanHistory();
    historyPlans.sort((a, b) => {
      const timeA = new Date(a.archivedAt || a.date || a.updatedAt || 0).getTime();
      const timeB = new Date(b.archivedAt || b.date || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });

    container.innerHTML = renderHistoryPanel({
      activePlan,
      historyPlans,
      recipes
    });
  } catch (err) {
    console.warn('[PlannerView] Error rendering plan library:', err);
    container.innerHTML = renderHistoryPanel({
      activePlan,
      historyPlans: [],
      recipes
    });
  }
}

export async function restoreSavedPlan(planId) {
  if (!planId) return;
  const confirmed = await DialogHelpers.showConfirm({
    title: 'Load Saved Plan as Active?',
    message: 'Loading this plan will set it as your current active meal plan in the planner and Today view.',
    confirmLabel: 'Load Plan',
    cancelLabel: 'Cancel'
  });
  if (!confirmed) return;

  const repo = await import('../repositories/PlanRepository.js');
  const history = await repo.getPlanHistory();
  const target = history.find(p => String(p.id) === String(planId));
  if (!target) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Saved plan not found.', 'error');
    }
    return;
  }

  const cleanPlan = { ...target };
  delete cleanPlan.archivedAt;
  const saveRes = await repo.savePlan(cleanPlan);
  if (saveRes.success) {
    if (typeof setCurrentPlan === 'function') {
      setCurrentPlan(cleanPlan);
    } else if (store && store.setState) {
      store.setState({ currentPlan: cleanPlan });
    }
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Loaded "${target.name || 'Saved Plan'}" as active plan! ✓`, 'success');
    }
    if (typeof window.showView === 'function') {
      window.showView('today');
    }
  } else {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed loading plan: ' + (saveRes.error || ''), 'error');
    }
  }
}

export async function deleteSavedPlan(planId) {
  if (!planId) return;
  const confirmed = await DialogHelpers.showConfirm({
    title: 'Delete Saved Plan?',
    message: 'Are you sure you want to delete this saved meal plan from your library? This cannot be undone.',
    confirmLabel: 'Delete Plan',
    cancelLabel: 'Cancel',
    isDanger: true
  });
  if (!confirmed) return;

  const repo = await import('../repositories/PlanRepository.js');
  const res = await repo.deletePlan(planId);
  if (res.success) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Plan deleted from library. ✓', 'success');
    }
    renderPlanLibrary();
  } else {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to delete plan: ' + (res.error || ''), 'error');
    }
  }
}

export function openSavedPlanRecipeCards(planId) {
  import('../repositories/PlanRepository.js').then(async repo => {
    const historyPlans = await repo.getPlanHistory();
    const target = historyPlans.find(p => String(p.id) === String(planId));
    if (!target) {
      if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Plan not found in library.', 'error');
      return;
    }
    openPlanRecipeCardsModal(target);
  });
}

export function openActivePlanRecipeCards() {
  const plan = getState()?.currentPlan;
  if (!plan) {
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('No active plan found.', 'error');
    return;
  }
  openPlanRecipeCardsModal(plan);
}

export function openPlanRecipeCardsModal(plan) {
  const recipes = getState()?.recipes || (typeof window !== 'undefined' ? window.state?.recipes : []) || [];
  const recipeIds = getPlanRecipeIds(plan);
  const matchedRecipes = recipeIds.map(id => {
    return recipes.find(r => String(r.id) === String(id)) || { id, name: id, types: ['dinner'] };
  });

  const modalHtml = `
    <div class="modal-wrap open" id="plan-recipe-cards-modal-wrap" style="z-index: 10005; display:flex; align-items:center; justify-content:center; position:fixed; inset:0; background:rgba(0,0,0,0.5);">
      <div class="modal card" style="max-width: 720px; width:90%; max-height: 85vh; display:flex; flex-direction:column; background:var(--surface,#fff); border-radius:12px; padding:20px; box-shadow:0 12px 36px rgba(0,0,0,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; border-bottom:1px solid var(--border,#eee); padding-bottom:10px;">
          <div>
            <h2 style="margin:0; font-size:17px; font-weight:700; color:var(--text,#1c1917);">${escapeHtml(plan.name || 'Meal Plan Recipes')}</h2>
            <div style="font-size:12px; color:var(--text2,#78716c); margin-top:3px;">${escapeHtml(getPlanDateRangeLabel(plan))} · ${matchedRecipes.length} distinct meals</div>
          </div>
          <button type="button" class="btn sm ghost" data-action="close-plan-recipe-cards">✕ Close</button>
        </div>
        <div style="overflow-y:auto; flex:1; display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px; padding:4px;">
          ${matchedRecipes.length === 0 ? `<div style="grid-column: 1 / -1; text-align:center; padding:20px; color:var(--text3,#78716c);">No recipes found in this plan.</div>` : ''}
          ${matchedRecipes.map(r => `
            <div class="card" style="margin:0; padding:12px; cursor:pointer; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; flex-direction:column; justify-content:space-between; background:var(--surface2,#fafaf9);" data-action="view-recipe" data-recipe-id="${escapeAttr(r.id)}">
              <div>
                <div style="font-size:10px; color:var(--primary,#059669); font-weight:700; text-transform:uppercase;">${escapeHtml((r.types || [r.type || 'Meal']).join(', '))}</div>
                <div style="font-weight:700; font-size:13px; margin:6px 0; color:var(--text,#1c1917); line-height:1.3;">${escapeHtml(r.name || r.title || r.id)}</div>
              </div>
              <div style="font-size:11px; color:var(--text3,#a8a29e); margin-top:6px; display:flex; align-items:center; justify-content:space-between;">
                <span>${r.servings || r.serves ? `${r.servings || r.serves} serves` : ''}</span>
                <span style="color:var(--primary,#059669); font-weight:600;">View Recipe →</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('plan-recipe-cards-modal-wrap');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

export async function openSaveMealPlanModal() {
  const plan = getState().currentPlan;
  if (!plan || !plan.slots || Object.keys(plan.slots).length === 0) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('No active meal plan to save.', 'info');
    }
    return;
  }

  const dateLabel = getPlanDateRangeLabel(plan);
  const defaultTitle = plan.name || `Plan: ${dateLabel || 'Current'}`;
  const customName = await DialogHelpers.showPrompt({
    title: 'Save Current Plan to Library',
    message: 'Enter a name for this meal plan archive:',
    defaultValue: defaultTitle,
    confirmLabel: 'Save Snapshot',
    cancelLabel: 'Cancel'
  });

  if (customName === null) return;

  const repo = await import('../repositories/PlanRepository.js');
  const archivePayload = repo.createPlanArchivePayload(plan, { name: customName.trim() || defaultTitle });
  const res = await repo.savePlanHistory(archivePayload.id, archivePayload);
  if (res.success) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Current plan saved to Library! ✓', 'success');
    }
    renderPlanLibrary();
  } else {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed saving plan: ' + (res.error || ''), 'error');
    }
  }
}

export function mount(container) {
  if (container?.id === 'view-planlib' || document.getElementById('view-planlib')?.classList.contains('active')) {
    renderPlanLibrary();
  } else {
    renderPlanner();
  }
  plannerUnsub = subscribe('plan', () => {
    if (document.getElementById('view-planlib')?.classList.contains('active')) {
      renderPlanLibrary();
    } else {
      renderPlanner();
    }
  });
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

let plannerUnsub = null, prefsUnsub = null;
const handlePreferencesUpdated = () => renderPlanner();

if (typeof window !== 'undefined') {
  Object.assign(window, {
    setPlannerWizardStep, resetPlannerStartFresh, commitPlannerWizardPlan, renderPlanner, renderPlannerWizard, renderPlan,
    renderPlanLibrary, renderPlanHistoryPanel: renderPlanLibrary,
    restoreSavedPlan, deleteSavedPlan, openSavedPlanRecipeCards, openActivePlanRecipeCards, openSaveMealPlanModal,
    toggleSlotVariant, prioritiseAllPlannedEnhancedRecipes, openPlannedMealActions, swapSlot,
    openSwapMealModal, setSwapModalFilter, selectSwapModalRecipe, confirmSwapMealModal,
    renderSwapModalOptionsList, executeSwapSlotAndClose, closeSwapMealModal, quickRandomizeSwap,
    openRecipeModal: (id, instanceId, variant) => typeof window.viewRecipe === 'function' ? window.viewRecipe(id, instanceId, variant) : undefined
  });
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}
