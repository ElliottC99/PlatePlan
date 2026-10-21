/**
 * src/views/PlannerView.js (v3.38.66)
 * Componentised Weekly Planner, Wizard & Schedule Controller View.
 * Strictly modular (<350 lines) with sanitised reset state persistence.
 */

import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { subscribe } from '../store/store.js';
import { getState } from '../store/coreState.js';
import { createCleanEmptyPlanSchema } from '../models/MealPlannerModel.js';
import { renderDraftPlanBanner, renderPlanExpiredBanner, renderEarlierDaysHeading, renderPlannerEmptyError, renderPlanDaySlotRow } from '../components/planner/PlannerGridToolbar.js';
import * as GeneratorConstraintsForm from '../components/generator/GeneratorConstraintsForm.js';
import { renderWizardStep2, renderWizardStep3, makeRenderedDaySummary } from './PlannerRenderService.js';
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
  createCleanEmptyPlanSchema,
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
    const daysVal = getState().currentPlannerDays .currentPlan?.days || 10;
    const today = new Date().toISOString().split('T')[0];
    const startVal = getState().currentPlannerStartDate .currentPlan?.dayDates?.[1] || today;
    const cadence = getState()?.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
    const minFitScore = getState()?.prefs?.minFitScore || 0;
    const activeExclusions = typeof window.getActiveWizardExclusions === 'function' ? window.getActiveWizardExclusions() : [];
    const rawPinned = getState().currentPlanOptions?.pinnedMeals ?.pinnedRecipes || [];
    const pinned = Array.isArray(rawPinned) ? rawPinned : [];
    const rawUseUp = getState().currentPlanOptions?.useUp ?.useUpProducts || [];
    const useUp = Array.isArray(rawUseUp) ? rawUseUp : (rawUseUp && typeof rawUseUp === 'object' ? Object.keys(rawUseUp) : []);

    stepContentHtml = GeneratorConstraintsForm.renderConstraintsForm({
      daysVal, startVal, cadence, minFitScore, activeExclusions, pinned, useUp
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

export function renderPlan() {
  if (typeof window.ensurePlannerShell === 'function') window.ensurePlannerShell();
  if (typeof window.installPlannerSummaryObserver === 'function') window.installPlannerSummaryObserver();
  renderPlannerWizard();
  const el = document.getElementById('plan-content');
  if (!el) return;
  try {
    if (!getState().currentPlan || !getState().currentPlan.slots) {
      el.innerHTML = '';
      const actions = document.getElementById('plan-actions'); if (actions) actions.style.display = 'none';
      const overall = document.getElementById('plan-overall-summary'); if (overall) overall.innerHTML = '';
      const prep = document.getElementById('plan-meal-prep-panel'); if (prep) prep.innerHTML = '';
      return;
    }

    const { days, slots } = getState().currentPlan;
    const startInput = document.getElementById('plan-start-date');
    if (startInput) startInput.value = getState().currentPlan.dayDates?.[1] || '';
    let hasValidSlots = false;

    let html = '';
    if (getState().isDraftPlan .draftPlan) {
      html += renderDraftPlanBanner();
    }

    const localToday = typeof window.getPlatePlanLocalToday === 'function' ? window.getPlatePlanLocalToday() : new Date().toISOString().split('T')[0];
    const isPlanExpired = typeof window.checkIsPlanExpired === 'function' ? window.checkIsPlanExpired(getState().currentPlan, localToday) : false;
    if (isPlanExpired) {
      const tomorrow = typeof window.getTomorrowLocalDate === 'function' ? window.getTomorrowLocalDate() : localToday;
      const datedEntries = Object.entries(getState().currentPlan.dayDates || {}).filter(([, v]) => typeof window.parsePlanLocalDate === 'function' ? !!window.parsePlanLocalDate(v) : !!v);
      const dates = datedEntries.map(([, v]) => v).sort();
      const maxDate = dates[dates.length - 1] || localToday;
      const endLabel = typeof window.parsePlanLocalDate === 'function' && window.parsePlanLocalDate(maxDate) ? window.formatPlanDateShort(maxDate) : maxDate;
      const tomorrowLabel = typeof window.formatPlanDateShort === 'function' ? window.formatPlanDateShort(tomorrow) : tomorrow;
      html += renderPlanExpiredBanner(endLabel, tomorrowLabel);
    }

    const earlierDays = Array.from({ length: days }, (_, index) => index + 1).filter(day => {
      const value = getState().currentPlan.dayDates?.[day] || '';
      return typeof window.parsePlanLocalDate === 'function' ? !!window.parsePlanLocalDate(value) && value < localToday : false;
    });

    if (earlierDays.length) {
      const firstLabel = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(getState().currentPlan, earlierDays[0], { short: true }) : `Day ${earlierDays[0]}`;
      const lastLabel = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(getState().currentPlan, earlierDays[earlierDays.length - 1], { short: true }) : `Day ${earlierDays[earlierDays.length - 1]}`;
      const range = earlierDays.length > 1 ? `${firstLabel} – ${lastLabel}` : firstLabel;
      const isExpanded = typeof window.platePlanEarlierDaysExpanded !== 'undefined' ? window.platePlanEarlierDaysExpanded : false;
      html += renderEarlierDaysHeading(range, earlierDays.length, isExpanded);
    }

    for (let d = 1; d <= days; d++) {
      const isExpanded = typeof window.platePlanEarlierDaysExpanded !== 'undefined' ? window.platePlanEarlierDaysExpanded : false;
      if (earlierDays.includes(d) && !isExpanded) continue;
      const s = slots[d] || {};
      const allEx = typeof window.SLOTS !== 'undefined' ? window.SLOTS.every(sl => getState().excluded?.[d]?.[sl.key]) : false;
      const dayLabelFormatted = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(getState().currentPlan, d, { short: true }) : `Day ${d}`;
      const dayDateVal = getState().currentPlan.dayDates?.[d] || '';

      if (allEx) {
        html += window.PlannerDayCard?.renderDayPlanCard?.({ day: d, dayLabel: dayLabelFormatted, dayDate: dayDateVal, isAllExcluded: true }) || '';
        continue;
      }

      const daySlotInfos = typeof window.buildPlanDaySlotInfos === 'function' ? window.buildPlanDaySlotInfos(getState().currentPlan, d) : [];
      const daySummary = makeRenderedDaySummary();
      let dayRowsHtml = '';

      if (typeof window.SLOTS !== 'undefined' && typeof window.SLOT_LABELS !== 'undefined' && typeof window.SLOT_COLORS !== 'undefined') {
        window.SLOTS.forEach(sl => {
          const isEx = getState().excluded?.[d]?.[sl.key];
          const slotData = s[sl.key];
          const slotInfo = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(slotData) : { active: null, id: null, variant: 'original', instanceId: null };
          const r = slotInfo?.active;
          const rId = slotInfo?.id;
          const instanceId = slotInfo?.instanceId;
          const lblLines = window.SLOT_LABELS[sl.key].split('\n');
          const showRecipe = !!r && !isEx;
          if (showRecipe) hasValidSlots = true;

          const slotNutrition = daySlotInfos.find(info => info.slotKey === sl.key) || (typeof window.getPlannerSlotNutritionInfo === 'function' ? window.getPlannerSlotNutritionInfo(getState().currentPlan, d, sl.key) : { cal: 0, prot: 0 });
          let calStr = '', rowCal = 0, rowProt = 0;
          const rowPerson = sl.key.endsWith('E') ? 'e' : sl.key.endsWith('C') ? 'c' : '';
          if (showRecipe) {
            rowCal = +slotNutrition.cal || 0;
            rowProt = +slotNutrition.prot || 0;
            calStr = `${Math.round(rowCal)}kcal / P${typeof window.round1 === 'function' ? window.round1(rowProt) : rowProt}g`;
            if (rowPerson) {
              daySummary.totals[rowPerson].cal += rowCal;
              daySummary.totals[rowPerson].prot += rowProt;
            }
          }
          const slotReason = typeof window.getPlanSlotReason === 'function' ? window.getPlanSlotReason(getState().currentPlan, d, sl.key) : '';
          const slotReasonLabel = typeof window.formatPlanSlotReason === 'function' ? window.formatPlanSlotReason(slotReason) : slotReason;
          const isPinned = !!(r && (slotData?.pinned || slotData?.isPinned || (typeof window.getPinnedRecipesList === 'function' && window.getPinnedRecipesList().some(p => p.recipeId === rId))));
          dayRowsHtml += renderPlanDaySlotRow({ d, sl, isEx, showRecipe, r, rId, instanceId, slotInfo, lblLines, calStr, rowPerson, rowCal, rowProt, slotReason, slotReasonLabel, isPinned });
        });
      }

      daySummary.score = typeof window.calculatePlanDayScoreFromTotals === 'function' ? window.calculatePlanDayScoreFromTotals(daySummary.totals) : 0;
      html += window.PlannerDayCard?.renderDayPlanCard?.({
        day: d, dayLabel: dayLabelFormatted, dayDate: dayDateVal, isAllExcluded: false, daySummary, dayRowsHtml, score: daySummary.score
      }) || '';
    }

    el.innerHTML = html;
    if (typeof window.reconcileVisiblePlanSummaries === 'function') window.reconcileVisiblePlanSummaries();
    if (typeof window.renderMealPrepSuggestions === 'function') window.renderMealPrepSuggestions();
    if (typeof window.renderPlanHistoryPanel === 'function') window.renderPlanHistoryPanel();
    const setup = document.getElementById('plan-setup-card'); if (setup) setup.style.display = '';
    const actions = document.getElementById('plan-actions'); if (actions) actions.style.display = hasValidSlots ? 'block' : 'none';
    if (typeof window.updatePlannerCompactHeader === 'function') window.updatePlannerCompactHeader();
  } catch (err) {
    console.error('Error rendering Meal Planner:', err);
    el.innerHTML = renderPlannerEmptyError();
  }
}

export function clearPlan() {
  const cleanEmptySchema = createCleanEmptyPlanSchema();
  if (getState()) {
    getState().currentPlan = cleanEmptySchema;
    getState().skeletonGrid = {};
    getState().overrides = {};
    getState().currentPlannerStep = 1;
    getState().isDraftPlan = false;
    getState().draftPlan = null;
  }
  if (typeof window.Store?.setState === 'function') {
    window.Store.setState({ plan: cleanEmptySchema, skeletonGrid: {} });
  }
  if (typeof window.platePlanEarlierDaysExpanded !== 'undefined') window.platePlanEarlierDaysExpanded = false;
  if (typeof window.saveState === 'function') window.saveState(cleanEmptySchema);

  const content = document.getElementById('plan-content'); if (content) content.innerHTML = '';
  const warnings = document.getElementById('plan-warnings'); if (warnings) warnings.innerHTML = '';
  const overall = document.getElementById('plan-overall-summary'); if (overall) overall.innerHTML = '';
  const prep = document.getElementById('plan-meal-prep-panel'); if (prep) prep.innerHTML = '';
  const setup = document.getElementById('plan-setup-card'); if (setup) setup.style.display = '';
  const actions = document.getElementById('plan-actions'); if (actions) actions.style.display = 'none';
  if (typeof window.renderPlanHistoryPanel === 'function') window.renderPlanHistoryPanel();
  if (typeof window.updatePlannerCompactHeader === 'function') window.updatePlannerCompactHeader();
  renderPlannerWizard();
}

export function showPlanSetup() {
  if (typeof window.ensurePlannerShell === 'function') window.ensurePlannerShell();
  if (typeof window.openPlanOptionsWorkspace === 'function') window.openPlanOptionsWorkspace();
}

export function renderPlanOverallSummary() {
  const el = document.getElementById('plan-overall-summary');
  if (!el || !getState().currentPlan?.slots) { if (el) el.innerHTML = ''; return; }
  if (document.querySelector('#plan-content .day-plan-card:not(.skipped)')) {
    if (typeof window.reconcileVisiblePlanSummaries === 'function') window.reconcileVisiblePlanSummaries();
    return;
  }
  const score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(getState().currentPlan) : 0;
  getState().currentPlan.score = score;
  if (typeof window.renderPlanOverallSummaryHtml === 'function') window.renderPlanOverallSummaryHtml(score);
}

export function setPlannerWizardStep(step) {
  const nextStep = Math.max(1, Math.min(4, step));
  if (typeof window !== 'undefined' && getState()) getState().currentPlannerStep = nextStep;
  renderPlannerWizard();
}

export function resetPlannerStartFresh() {
  const cleanEmptySchema = createCleanEmptyPlanSchema();
  if (getState()) { getState().currentPlan = cleanEmptySchema; getState().skeletonGrid = {}; }
  clearPlan(); setPlannerWizardStep(1);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    setPlannerWizardStep, resetPlannerStartFresh, renderPlanner, renderPlannerWizard, renderPlan,
    toggleSlotVariant, prioritiseAllPlannedEnhancedRecipes, openPlannedMealActions, swapSlot,
    openSwapMealModal, setSwapModalFilter, selectSwapModalRecipe, confirmSwapMealModal,
    renderSwapModalOptionsList, executeSwapSlotAndClose, closeSwapMealModal, quickRandomizeSwap,
    clearPlan, showPlanSetup, renderPlanOverallSummary,
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
