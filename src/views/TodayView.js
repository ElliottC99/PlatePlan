
/**
 * src/views/TodayView.js (v3.20.14)
 * Modular ES6 View for the Today Dashboard.
 * Renders daily meal timeline, macro snapshots, and meal completion toggles.
 */

import { subscribe, setCurrentPlan } from '../store/store.js';
import { getState } from '../store/coreState.js';
import {
  getPlatePlanLocalToday,
  formatTodayDateLabel,
  parsePlanLocalDate,
  formatPlanLocalDateValue,
  getTodayPlanDay,
  isMealEatenOnDate,
  calculateMealEatenUpdates
} from '../services/TodayViewService.js';
import { getPlanSlotInfo } from '../services/MealPlanGeneratorService.js';
import { renderFitScoreBadge } from '../components/FitScoreBadge.js';
import { saveCurrentPlan } from '../services/HouseholdRepository.js';
import { escapeAttr, escapeHtml } from '../utils/stringUtils.js';
import { swapPlanMealSlots } from '../services/PlanSlotSwapService.js';
import { renderTodaySwapModalHtml } from '../components/today/TodaySwapMealModalUI.js';
import { renderTodayMacrosCard, renderTodayMealCard } from './TodayRenderService.js';

let currentDateStr = getPlatePlanLocalToday();
let stateUnsub = null;

export function getSelectedTodayDate() {
  return currentDateStr;
}

export function moveTodayDate(deltaDays) {
  const current = parsePlanLocalDate(currentDateStr) || new Date();
  current.setDate(current.getDate() + deltaDays);
  currentDateStr = formatPlanLocalDateValue(current);
  renderToday();
}

export function resetTodayDate() {
  currentDateStr = getPlatePlanLocalToday();
  renderToday();
}

export function toggleMealEaten(mealType, person = 'both') {
  // The loaded plan lives in state.currentPlan. Never save without one: saveCurrentPlan
  // replaces the whole plans/current document.
  const plan = getState().currentPlan;
  if (!plan || !plan.slots) {
    console.warn('[TodayView] No current plan loaded; not saving eaten meals.');
    return;
  }
  const currentEaten = plan.eatenMeals || {};

  const { nextEaten, toastMessage } = calculateMealEatenUpdates(currentEaten, currentDateStr, mealType, person);
  plan.eatenMeals = nextEaten;

  saveCurrentPlan(plan).catch(err => {
    console.warn('[TodayView] Failed saving eaten meals to cloud:', err);
  });

  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(toastMessage, 'info');
  }

  renderToday();
}

export function renderToday() {
  if (typeof document === 'undefined') return;
  const contentEl = document.getElementById('today-content');
  const labelEl = document.getElementById('today-date-label');
  if (!contentEl) return;

  if (labelEl) {
    labelEl.textContent = formatTodayDateLabel(currentDateStr) || currentDateStr;
  }

  const state = getState();
  const plan = state.currentPlan || {};
  const recipes = state.recipes || [];
  const planContext = { dayDates: plan.dayDates || {} };
  
  const dayKey = getTodayPlanDay(currentDateStr, planContext);
  const dayPlan = dayKey && plan.slots ? plan.slots[dayKey] : null;

  if (!dayPlan || Object.keys(dayPlan).length === 0) {
    contentEl.innerHTML = `
      <div class="ios-grouped-card" style="padding: 32px 16px; text-align: center; margin: 16px 0;">
        <div style="font-size: 28px; margin-bottom: 8px;">🍽️</div>
        <div class="ios-headline" style="color:var(--label); margin-bottom: 4px;">No Planned Meals</div>
        <div style="font-size: 13px; color: var(--secondary-label);">No meals assigned to this day in your active plan.</div>
      </div>
    `;
    return;
  }

  const mealSlots = [
    { type: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { type: 'lunch', label: 'Lunch', icon: '☀️' },
    { type: 'dinner', label: 'Dinner', icon: '🌙' },
    { type: 'snack', label: 'Snack', icon: '🍎' }
  ];

  const eatenMeals = plan.eatenMeals || {};

  // Calculate day macro totals across all planned meal slots
  const allMealCards = mealSlots.flatMap(slot => 
    getTodayMealCards(dayPlan, slot.type).map(card => ({ slot, ...card }))
  );

  const dayTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  allMealCards.forEach(({ info }) => {
    const r = info?.active;
    if (r) {
      dayTotals.calories += Number(r.nutrition?.perServing?.cal ?? r.macros?.calories ?? 0);
      dayTotals.protein += Number(r.nutrition?.perServing?.prot ?? r.macros?.protein ?? 0);
      dayTotals.carbs += Number(r.nutrition?.perServing?.carb ?? r.macros?.carbs ?? 0);
      dayTotals.fat += Number(r.nutrition?.perServing?.fat ?? r.macros?.fat ?? 0);
    }
  });

  const rawTargets = state.preferences?.nutritionTargets?.both || 
                     state.preferences?.nutritionTargets?.elliott || 
                     state.userPrefs?.nutritionTargets?.elliott || 
                     { calories: 2000, protein: 130, carbs: 220, fat: 65 };

  const targets = {
    calories: Number(rawTargets.calories || rawTargets.cal || 2000),
    protein: Number(rawTargets.protein || rawTargets.prot || 130),
    carbs: Number(rawTargets.carbs || rawTargets.carb || 220),
    fat: Number(rawTargets.fat || 65)
  };

  const macrosHtml = renderTodayMacrosCard(dayTotals, targets);
  const cardsHtml = allMealCards.map(({ slot, ...card }) => 
    renderTodayMealCard(slot, card, eatenMeals, dayKey, currentDateStr)
  ).join('');

  contentEl.innerHTML = macrosHtml + (cardsHtml || `
    <div class="ios-grouped-card" style="padding: 24px 16px; text-align: center;">
      <div style="font-size: 13px; color: var(--secondary-label);">No meals assigned to this day.</div>
    </div>
  `);
}

/**
 * Plans store each meal per person ("dinnerE" / "dinnerC"), as the planner writes them.
 * A meal is shared when both slots hold the same recipe and variant (the planner's rule);
 * otherwise each person gets their own card. Older plans with a plain "dinner" key are
 * shown as shared.
 */
export function getTodayMealCards(dayPlan, mealType) {
  const resolve = slotData => {
    if (!slotData || slotData.isSkipped || slotData.skipped) return null;
    const info = getPlanSlotInfo(slotData);
    return info && info.active ? info : null;
  };

  const slotE = dayPlan[`${mealType}E`];
  const slotC = dayPlan[`${mealType}C`];
  if (!slotE && !slotC) {
    const legacy = resolve(dayPlan[mealType]);
    return legacy ? [{ info: legacy, person: 'both' }] : [];
  }

  const infoE = resolve(slotE);
  const infoC = resolve(slotC);
  if (infoE && infoC && infoE.id === infoC.id && infoE.variant === infoC.variant) {
    return [{ info: infoE, person: 'both' }];
  }
  return [
    infoE ? { info: infoE, person: 'e' } : null,
    infoC ? { info: infoC, person: 'c' } : null
  ].filter(Boolean);
}

export function openTodayRearrangeModal(dayKey, mealType = 'dinner') {
  const state = getState();
  const plan = state?.currentPlan;
  if (!plan || !plan.slots) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('No active meal plan loaded to rearrange.', 'info');
    }
    return;
  }
  const recipes = state?.recipes || [];
  const modalHtml = renderTodaySwapModalHtml({
    plan,
    sourceDayKey: dayKey,
    mealType,
    recipes
  });

  const existing = document.getElementById('today-swap-modal-wrap');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const wrap = document.getElementById('today-swap-modal-wrap');
  if (wrap) {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        closeTodaySwapModal();
        document.removeEventListener('keydown', handleKey);
      }
    };
    document.addEventListener('keydown', handleKey);
  }
}

export function closeTodaySwapModal() {
  const existing = document.getElementById('today-swap-modal-wrap');
  if (existing) existing.remove();
}

export async function executeTodaySlotSwap(sourceDayKey, targetDayKey, mealType = 'dinner') {
  const plan = getState()?.currentPlan;
  if (!plan) return;

  const result = swapPlanMealSlots(plan, sourceDayKey, targetDayKey, mealType);
  if (!result.success || !result.plan) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(result.error || 'Failed swapping meals.', 'error');
    }
    return;
  }

  const updatedPlan = result.plan;
  if (typeof setCurrentPlan === 'function') {
    setCurrentPlan(updatedPlan);
  }

  saveCurrentPlan(updatedPlan).catch(err => {
    console.warn('[TodayView] Failed saving swapped plan to cloud:', err);
  });

  if (typeof window.showPlatePlanToast === 'function') {
    const dayDates = updatedPlan.dayDates || {};
    const tgtDate = dayDates[String(targetDayKey)];
    let destLabel = `Day ${targetDayKey}`;
    if (tgtDate) {
      try {
        destLabel = new Date(tgtDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      } catch (_) {}
    }
    window.showPlatePlanToast(`Swapped ${mealType} with ${destLabel}! ✓`, 'success');
  }

  // Refresh modal if still open so subsequent swaps can be done smoothly
  const modalWrap = document.getElementById('today-swap-modal-wrap');
  if (modalWrap) {
    openTodayRearrangeModal(sourceDayKey, mealType);
  }

  renderToday();
}

export function mount(container) {
  renderToday();
  if (!stateUnsub) {
    stateUnsub = subscribe('plan', () => {
      renderToday();
    });
  }
}

export function unmount() {
  if (typeof stateUnsub === 'function') {
    stateUnsub();
    stateUnsub = null;
  }
}

if (typeof window !== 'undefined') {
  window.TodayView = {
    renderToday,
    moveTodayDate,
    resetTodayDate,
    toggleMealEaten,
    openTodayRearrangeModal,
    closeTodaySwapModal,
    executeTodaySlotSwap,
    mount,
    unmount
  };
  window.renderToday = renderToday;
  window.moveTodayDate = moveTodayDate;
  window.resetTodayDate = resetTodayDate;
  window.openTodayRearrangeModal = openTodayRearrangeModal;
  window.closeTodaySwapModal = closeTodaySwapModal;
  window.executeTodaySlotSwap = executeTodaySlotSwap;
}
