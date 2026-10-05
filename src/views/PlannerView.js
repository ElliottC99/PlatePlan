/**
 * src/views/PlannerView.js (v3.19.79)
 * Componentised Weekly Planner, Wizard & Schedule Controller View.
 * Strictly modular (<400 lines) with sanitised reset state persistence.
 */

import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { subscribe } from '../store/store.js';
import { createCleanEmptyPlanSchema } from '../models/MealPlannerModel.js';
import {
  renderDraftPlanBanner,
  renderPlanExpiredBanner,
  renderEarlierDaysHeading,
  renderPlannerEmptyError
} from '../components/planner/PlannerGridToolbar.js';
import { buildPlannedMealActionItems } from '../components/planner/PlannerModalsUI.js';
import {
  openSwapMealModal,
  setSwapModalFilter,
  selectSwapModalRecipe,
  confirmSwapMealModal,
  renderSwapModalOptionsList,
  executeSwapSlotAndClose,
  closeSwapMealModal,
  quickRandomizeSwap
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
  quickRandomizeSwap
};

export function renderPlanner() {
  renderPlannerWizard();
  renderPlan();
}

export function renderPlannerWizard() {
  const host = document.getElementById('planner-wizard-host');
  if (!host) return;

  const currentStep = typeof window.getPlannerWizardStep === 'function' ? window.getPlannerWizardStep() : (window.state?.plannerStep || 1);
  const hasActivePlan = !!(window.state?.plan?.slots && Object.keys(window.state.plan.slots).length > 0);
  let stepContentHtml = '';

  if (currentStep === 1) {
    const daysVal = window.state?.plannerDays || window.state?.plan?.days || 10;
    const today = new Date().toISOString().split('T')[0];
    const startVal = window.state?.plannerStartDate || window.state?.plan?.dayDates?.[1] || today;
    const cadence = window.state?.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
    const minFitScore = window.state?.prefs?.minFitScore || 0;
    const activeExclusions = typeof window.getActiveWizardExclusions === 'function' ? window.getActiveWizardExclusions() : [];
    const rawPinned = window.state?.planOptions?.pinnedMeals || window.state?.pinnedRecipes || [];
    const pinned = Array.isArray(rawPinned) ? rawPinned : [];
    const rawUseUp = window.state?.planOptions?.useUp || window.state?.useUpProducts || [];
    const useUp = Array.isArray(rawUseUp) ? rawUseUp : (rawUseUp && typeof rawUseUp === 'object' ? Object.keys(rawUseUp) : []);

    stepContentHtml = window.GeneratorConstraintsForm?.renderConstraintsForm?.({
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
      const plan = window.state.plan || {};
      const rawSlots = plan.slots;
      const safeSlots = Array.isArray(rawSlots) ? rawSlots : (rawSlots && typeof rawSlots === 'object' ? Object.values(rawSlots) : []);
      const days = plan.days || safeSlots.length || 0;
      const prepGroups = Array.isArray(plan.mealPrepGroups) ? plan.mealPrepGroups : [];

      let cardsHtml = '';
      for (let d = 1; d <= days; d++) {
        const dateLabel = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(plan, d, { short: true }) : `Day ${d}`;
        const daySlots = plan.slots?.[d] || {};
        let eCal = 0, eProt = 0, cCal = 0, cProt = 0;

        ['breakfast', 'lunch', 'dinner'].forEach(m => {
          const sE = daySlots[m + 'E'];
          const sC = daySlots[m + 'C'];
          if (sE && typeof window.getPlanSlotInfo === 'function' && typeof window.getPlannedSlotNutrition === 'function') {
            const info = window.getPlanSlotInfo(sE);
            const nut = window.getPlannedSlotNutrition(info?.active, m + 'E', info?.instanceId, plan);
            if (nut) { eCal += nut.cal || 0; eProt += nut.prot || 0; }
          }
          if (sC && typeof window.getPlanSlotInfo === 'function' && typeof window.getPlannedSlotNutrition === 'function') {
            const info = window.getPlanSlotInfo(sC);
            const nut = window.getPlannedSlotNutrition(info?.active, m + 'C', info?.instanceId, plan);
            if (nut) { cCal += nut.cal || 0; cProt += nut.prot || 0; }
          }
        });

        const dayPreps = prepGroups.filter(g => (Array.isArray(g?.days) ? g.days : []).includes(d));
        const mealsHtml = ['breakfast', 'lunch', 'dinner'].map(meal => {
          const slotKeyE = meal + 'E';
          const slotKeyC = meal + 'C';
          const sE = daySlots[slotKeyE];
          const sC = daySlots[slotKeyC];
          const infoE = sE && typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(sE) : null;
          const infoC = sC && typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(sC) : null;
          const rE = infoE?.active;
          const rC = infoC?.active;
          const isShared = rE && rC && infoE.id === infoC.id && infoE.variant === infoC.variant;
          return window.PlannerMealSlot?.renderDensePlanMealRow({ meal, isShared, rE, rC, infoE, infoC, day: d, slotKeyE, slotKeyC }) || '';
        }).join('');

        cardsHtml += window.PlannerDayCard?.renderDenseDayCard({
          day: d, dateLabel, eCal, eProt, cCal, cProt, dayPreps, mealsHtml
        }) || '';
      }

      stepContentHtml = `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:700">Step 2: Review Generated Meal Plan</h2>
              <div style="font-size:13px;color:var(--text2);margin-top:4px">Review daily macro fits and swap any meal directly inline.</div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn ghost sm" onclick="setPlannerWizardStep(1)">← Edit Requests</button>
              <button type="button" class="btn primary sm" style="font-weight:700" onclick="setPlannerWizardStep(3)">Proceed to Shopping List →</button>
            </div>
          </div>
          <div class="dense-plan-grid">${cardsHtml}</div>
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(1)">← Back to Configure</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="setPlannerWizardStep(3)">Proceed to Shopping List & Substitutions →</button>
          </div>
        </div>
      `;
    }
  } else if (currentStep === 3) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(3) || '';
    } else {
      const agg = typeof window.computeWizardShoppingAgg === 'function' ? window.computeWizardShoppingAgg(window.state.plan) : { items: [], totalCost: 0 };
      const items = agg.items || [];
      const totalCost = agg.totalCost || 0;
      const topToolbarHtml = window.ShoppingBatchToolbar?.renderShoppingBatchToolbar?.({ totalCost, items }) || '';
      const listHtml = window.ShoppingCategoryGroup?.renderShoppingCategoriesList?.(items) || '';
      stepContentHtml = `
        <div style="display:flex;flex-direction:column;gap:16px">
          ${topToolbarHtml}
          ${listHtml}
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(2)">← Back to Review Plan</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="commitPlannerWizardPlan()">✓ Save Shopping List &amp; Plan (Commit to Today) →</button>
          </div>
        </div>
      `;
    }
  } else if (currentStep === 4) {
    stepContentHtml = window.GeneratorWizardModal?.renderWizardStep4Commit?.('v3.19.78') || '';
  }

  host.innerHTML = window.GeneratorWizardModal?.renderPlannerWizardView?.({
    currentStep, hasActivePlan, stepContentHtml
  }) || `<div class="planner-wizard-container">${stepContentHtml}</div>`;
}

export function renderPlan() {
  if (typeof window.ensurePlannerShell === 'function') window.ensurePlannerShell();
  if (typeof window.installPlannerSummaryObserver === 'function') window.installPlannerSummaryObserver();
  renderPlannerWizard();
  const el = document.getElementById('plan-content');
  if (!el) return;
  try {
    if (!window.state?.plan || !window.state.plan.slots) {
      el.innerHTML = '';
      const actions = document.getElementById('plan-actions'); if (actions) actions.style.display = 'none';
      const overall = document.getElementById('plan-overall-summary'); if (overall) overall.innerHTML = '';
      const prep = document.getElementById('plan-meal-prep-panel'); if (prep) prep.innerHTML = '';
      return;
    }

    const { days, slots } = window.state.plan;
    const startInput = document.getElementById('plan-start-date');
    if (startInput) startInput.value = window.state.plan.dayDates?.[1] || '';
    let hasValidSlots = false;

    const makeRenderedDaySummary = () => {
      const totals = { e: { cal: 0, prot: 0 }, c: { cal: 0, prot: 0 } };
      const assumed = { e: { cal: 0, prot: 0, labels: ['snacks'] }, c: { cal: 0, prot: 0, labels: ['snacks'] } };
      ['e', 'c'].forEach(person => {
        const b = typeof window.getBudgets === 'function' ? window.getBudgets(person, 'snack') : { cal: 0, prot: 0 };
        totals[person].cal += +b.cal || 0;
        totals[person].prot += +b.prot || 0;
        assumed[person].cal += +b.cal || 0;
        assumed[person].prot += +b.prot || 0;
      });
      return {
        totals,
        targets: { e: { cal: +window.state.prefs?.ecal || 0, prot: +window.state.prefs?.eprot || 0 }, c: { cal: +window.state.prefs?.ccal || 0, prot: +window.state.prefs?.cprot || 0 } },
        assumed,
        score: 0
      };
    };

    let html = '';
    if (window.state.isDraftPlan || window.state.draftPlan) {
      html += renderDraftPlanBanner();
    }

    const localToday = typeof window.getPlatePlanLocalToday === 'function' ? window.getPlatePlanLocalToday() : new Date().toISOString().split('T')[0];
    const isPlanExpired = typeof window.checkIsPlanExpired === 'function' ? window.checkIsPlanExpired(window.state.plan, localToday) : false;
    if (isPlanExpired) {
      const tomorrow = typeof window.getTomorrowLocalDate === 'function' ? window.getTomorrowLocalDate() : localToday;
      const datedEntries = Object.entries(window.state.plan.dayDates || {}).filter(([, v]) => typeof window.parsePlanLocalDate === 'function' ? !!window.parsePlanLocalDate(v) : !!v);
      const dates = datedEntries.map(([, v]) => v).sort();
      const maxDate = dates[dates.length - 1] || localToday;
      const endLabel = typeof window.parsePlanLocalDate === 'function' && window.parsePlanLocalDate(maxDate) ? window.formatPlanDateShort(maxDate) : maxDate;
      const tomorrowLabel = typeof window.formatPlanDateShort === 'function' ? window.formatPlanDateShort(tomorrow) : tomorrow;
      html += renderPlanExpiredBanner(endLabel, tomorrowLabel);
    }

    const earlierDays = Array.from({ length: days }, (_, index) => index + 1).filter(day => {
      const value = window.state.plan.dayDates?.[day] || '';
      return typeof window.parsePlanLocalDate === 'function' ? !!window.parsePlanLocalDate(value) && value < localToday : false;
    });

    if (earlierDays.length) {
      const firstLabel = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(window.state.plan, earlierDays[0], { short: true }) : `Day ${earlierDays[0]}`;
      const lastLabel = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(window.state.plan, earlierDays[earlierDays.length - 1], { short: true }) : `Day ${earlierDays[earlierDays.length - 1]}`;
      const range = earlierDays.length > 1 ? `${firstLabel} – ${lastLabel}` : firstLabel;
      const isExpanded = typeof window.platePlanEarlierDaysExpanded !== 'undefined' ? window.platePlanEarlierDaysExpanded : false;
      html += renderEarlierDaysHeading(range, earlierDays.length, isExpanded);
    }

    for (let d = 1; d <= days; d++) {
      const isExpanded = typeof window.platePlanEarlierDaysExpanded !== 'undefined' ? window.platePlanEarlierDaysExpanded : false;
      if (earlierDays.includes(d) && !isExpanded) continue;
      const s = slots[d] || {};
      const allEx = typeof window.SLOTS !== 'undefined' ? window.SLOTS.every(sl => window.state.excluded?.[d]?.[sl.key]) : false;
      const dayLabelFormatted = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(window.state.plan, d, { short: true }) : `Day ${d}`;
      const dayDateVal = window.state.plan.dayDates?.[d] || '';

      if (allEx) {
        html += window.PlannerDayCard?.renderDayPlanCard?.({ day: d, dayLabel: dayLabelFormatted, dayDate: dayDateVal, isAllExcluded: true }) || '';
        continue;
      }

      const daySlotInfos = typeof window.buildPlanDaySlotInfos === 'function' ? window.buildPlanDaySlotInfos(window.state.plan, d) : [];
      const daySummary = makeRenderedDaySummary();
      let dayRowsHtml = '';

      if (typeof window.SLOTS !== 'undefined' && typeof window.SLOT_LABELS !== 'undefined' && typeof window.SLOT_COLORS !== 'undefined') {
        window.SLOTS.forEach(sl => {
          const isEx = window.state.excluded?.[d]?.[sl.key];
          const slotData = s[sl.key];
          const slotInfo = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(slotData) : { active: null, id: null, variant: 'original', instanceId: null };
          const r = slotInfo?.active;
          const rId = slotInfo?.id;
          const instanceId = slotInfo?.instanceId;
          const lblLines = window.SLOT_LABELS[sl.key].split('\n');
          const showRecipe = !!r && !isEx;
          if (showRecipe) hasValidSlots = true;

          const slotNutrition = daySlotInfos.find(info => info.slotKey === sl.key) || (typeof window.getPlannerSlotNutritionInfo === 'function' ? window.getPlannerSlotNutritionInfo(window.state.plan, d, sl.key) : { cal: 0, prot: 0 });
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
          const rowAttrs = showRecipe ? ` data-plan-person="${rowPerson}" data-plan-cal="${rowCal}" data-plan-prot="${rowProt}"` : '';
          const slotReason = typeof window.getPlanSlotReason === 'function' ? window.getPlanSlotReason(window.state.plan, d, sl.key) : '';
          const slotReasonLabel = typeof window.formatPlanSlotReason === 'function' ? window.formatPlanSlotReason(slotReason) : slotReason;
          const slotActionsHtml = showRecipe
            ? `<div class="slot-actions"><span class="slot-macro">${calStr}</span><button class="btn sm primary" onclick="viewRecipe('${rId}', '${instanceId || ''}', '${slotInfo.variant}')">View</button><button class="btn sm ghost" onclick="openSwapMealModal(${d},'${sl.key}')">Swap</button><button class="btn sm ghost" onclick="openPlannedMealActions(${d},'${sl.key}')">More</button></div>`
            : `<div class="slot-actions"><button class="btn sm ghost" onclick="openSwapMealModal(${d},'${sl.key}')">Choose Meal</button>${slotReason ? `<button class="btn sm ghost" onclick="clearPlanSlotReason(${d},'${sl.key}')">Clear reason</button>` : ''}</div>`;
          const emptyContent = slotReason ? `<span class="plan-slot-reason">${slotReasonLabel}</span>` : '<span style="color:var(--text3)">Not set</span>';
          const isPinned = !!(r && (slotData?.pinned || slotData?.isPinned || (typeof window.getPinnedRecipesList === 'function' && window.getPinnedRecipesList().some(p => p.recipeId === rId))));
          dayRowsHtml += `<div class="slot-row"${rowAttrs}><span class="slot-lbl" style="color:${window.SLOT_COLORS[sl.key]}">${lblLines[0]}<br>${lblLines[1]}</span>${isEx ? '<span class="slot-skipped">Not needed</span>' : `<span class="slot-name">${r ? r.name : emptyContent}${slotInfo?.variant === 'enhanced' ? ' <span class="tag green">Enhanced</span>' : ''}${isPinned ? ' <span class="tag pinned" title="Pre-selected recipe">Pinned</span>' : ''}</span>${slotActionsHtml}`}</div>`;
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

export function toggleSlotVariant(day, slotKey) {
  const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan?.slots?.[day]?.[slotKey]) : { recipe: null };
  if (!info?.recipe) return;
  const newVariant = (info.variant || 'original') === 'enhanced' ? 'original' : 'enhanced';
  window.state.plan.slots[day][slotKey] = typeof window.makePlanSlot === 'function' ? window.makePlanSlot(info.id, newVariant) : { id: info.id, recipeId: info.id, variant: newVariant };
  const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
  window.state.plan.productSelections = typeof window.lockProductSelectionsForSlots === 'function' ? window.lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
  window.state.plan.score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
  if (typeof window.saveState === 'function') window.saveState(window.state.plan);
  renderPlan();
  if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`Switched to ${newVariant === 'enhanced' ? '✨ Enhanced' : 'Original'} variant for ${info.recipe.name}`);
}

export function prioritiseAllPlannedEnhancedRecipes() {
  if (!window.state.plan?.slots) return typeof window.showPlatePlanToast === 'function' ? window.showPlatePlanToast('No active meal plan to prioritise.') : null;
  let upgradedCount = 0;
  Object.entries(window.state.plan.slots).forEach(([day, daySlots]) => {
    Object.entries(daySlots || {}).forEach(([slotKey, slotVal]) => {
      if (!slotVal) return;
      const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(slotVal) : { recipe: null };
      if (!info?.recipe || info.variant === 'enhanced') return;
      const r = info.recipe;
      const hasEnhanced = r.enhanced && ((r.enhanced.ingredients?.length) || (r.enhanced.method?.length) || (r.enhanced.steps?.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
      if (hasEnhanced) {
        window.state.plan.slots[day][slotKey] = typeof window.makePlanSlot === 'function' ? window.makePlanSlot(info.id, 'enhanced') : { id: info.id, recipeId: info.id, variant: 'enhanced' };
        upgradedCount++;
      }
    });
  });

  if (upgradedCount > 0) {
    const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
    window.state.plan.productSelections = typeof window.lockProductSelectionsForSlots === 'function' ? window.lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
    window.state.plan.score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
    if (typeof window.saveState === 'function') window.saveState(window.state.plan);
    renderPlan();
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`✨ Prioritised ${upgradedCount} meal(s) to Enhanced variants!`);
  } else if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast('All eligible meals in your plan are already using Enhanced variants.');
  }
}

export function openPlannedMealActions(day, slotKey) {
  const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan?.slots?.[day]?.[slotKey]) : { recipe: null };
  if (!info?.active && !info?.recipe) return typeof window.showPlatePlanToast === 'function' ? window.showPlatePlanToast('That planned meal is no longer available.') : null;
  const actions = buildPlannedMealActionItems(info, day, slotKey);
  if (typeof window.openMobileActionSheet === 'function') {
    window.openMobileActionSheet(info.active?.name || info.recipe?.name || 'Planned meal', actions);
  }
}

export function swapSlot(day, slot, id) {
  if (!window.state.plan.slots[day]) window.state.plan.slots[day] = {};
  let swappedName = '';
  const mealType = slot.includes('breakfast') ? 'breakfast' : slot.includes('lunch') ? 'lunch' : 'dinner';
  const slotMealMode = typeof window.getSlotMealMode === 'function' ? window.getSlotMealMode(day, mealType) : 'both';
  const counterpartKey = typeof window.getPlanSlotCounterpartKey === 'function' ? window.getPlanSlotCounterpartKey(slot) : null;
  const isDualView = slotMealMode === 'both' || (document.getElementById('filter-who')?.value === 'both') || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');

  if (id) {
    const parsed = typeof window.parsePlanRecipeValue === 'function' ? window.parsePlanRecipeValue(id) : { id, variant: 'original' };
    const slotObj = typeof window.makePlanSlot === 'function' ? window.makePlanSlot(parsed.id, parsed.variant) : { id: parsed.id, recipeId: parsed.id, variant: parsed.variant };
    window.state.plan.slots[day][slot] = slotObj;
    if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, slot, '');
    if (isDualView && counterpartKey) {
      window.state.plan.slots[day][counterpartKey] = { ...slotObj };
      if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, counterpartKey, '');
    }
    const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan.slots[day][slot]) : { active: null };
    swappedName = info?.active?.name || info?.recipe?.name || '';
  } else {
    window.state.plan.slots[day][slot] = null;
    if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, slot, '');
    if (isDualView && counterpartKey) {
      window.state.plan.slots[day][counterpartKey] = null;
      if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, counterpartKey, '');
    }
  }
  const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
  window.state.plan.productSelections = typeof window.lockProductSelectionsForSlots === 'function' ? window.lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
  window.state.plan.productPriority = priority;
  window.state.plan.confirmedShopping = false;
  window.state.plan.mealPrepGroups = [];
  window.state.plan.declinedMealPrepGroups = [];
  window.state.plan.score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
  if (typeof window.saveState === 'function') window.saveState(window.state.plan);
  renderPlan();
  const toastMsg = swappedName
    ? (isDualView ? `Assigned ${swappedName} for Elliott & Chloe` : `Swapped meal to ${swappedName}`)
    : (isDualView ? 'Meal slots cleared for Elliott & Chloe' : 'Meal slot cleared');
  if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(toastMsg);
}

export function clearPlan() {
  const cleanEmptySchema = createCleanEmptyPlanSchema();
  if (window.state) {
    window.state.plan = cleanEmptySchema;
    window.state.skeletonGrid = {};
    window.state.overrides = {};
    window.state.plannerStep = 1;
    window.state.isDraftPlan = false;
    window.state.draftPlan = null;
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
  if (!el || !window.state?.plan?.slots) { if (el) el.innerHTML = ''; return; }
  if (document.querySelector('#plan-content .day-plan-card:not(.skipped)')) {
    if (typeof window.reconcileVisiblePlanSummaries === 'function') window.reconcileVisiblePlanSummaries();
    return;
  }
  const score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
  window.state.plan.score = score;
  if (typeof window.renderPlanOverallSummaryHtml === 'function') window.renderPlanOverallSummaryHtml(score);
}

export function setPlannerWizardStep(step) {
  const nextStep = Math.max(1, Math.min(4, step));
  if (typeof window !== 'undefined' && window.state) {
    window.state.plannerStep = nextStep;
  }
  renderPlannerWizard();
}

export function resetPlannerStartFresh() {
  const cleanEmptySchema = createCleanEmptyPlanSchema();
  if (window.state) {
    window.state.plan = cleanEmptySchema;
    window.state.skeletonGrid = {};
  }
  clearPlan();
  setPlannerWizardStep(1);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    setPlannerWizardStep, resetPlannerStartFresh, renderPlanner, renderPlannerWizard, renderPlan,
    toggleSlotVariant, prioritiseAllPlannedEnhancedRecipes, openPlannedMealActions, swapSlot,
    openSwapMealModal, setSwapModalFilter, selectSwapModalRecipe, confirmSwapMealModal,
    renderSwapModalOptionsList, executeSwapSlotAndClose, closeSwapMealModal, quickRandomizeSwap,
    clearPlan, showPlanSetup, renderPlanOverallSummary,
    openRecipeModal(id, instanceId, variant) {
      if (typeof window.viewRecipe === 'function') return window.viewRecipe(id, instanceId, variant);
    }
  });
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}

let plannerUnsub = null;
let prefsUnsub = null;

function handlePreferencesUpdated() {
  renderPlanner();
}

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
