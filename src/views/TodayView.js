
/**
 * src/views/TodayView.js (v3.20.14)
 * Modular ES6 View for the Today Dashboard.
 * Renders daily meal timeline, macro snapshots, and meal completion toggles.
 */

import { subscribe } from '../store/store.js';
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
    contentEl.innerHTML = `<div class="empty-state-container" style="padding: 2rem; text-align: center; color: var(--text-secondary);">No meals assigned to this day in your active plan.</div>`;
    return;
  }

  const mealSlots = [
    { type: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { type: 'lunch', label: 'Lunch', icon: '☀️' },
    { type: 'dinner', label: 'Dinner', icon: '🌙' },
    { type: 'snack', label: 'Snack', icon: '🍎' }
  ];

  const eatenMeals = plan.eatenMeals || {};

  const cardsHtml = mealSlots.flatMap(slot => getTodayMealCards(dayPlan, slot.type)
    .map(card => renderTodayMealCard(slot, card, eatenMeals))).join('');

  contentEl.innerHTML = cardsHtml || `<div class="empty-state-container" style="padding: 2rem; text-align: center; color: var(--text-secondary);">No meals assigned to this day in your active plan.</div>`;
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

function renderTodayMealCard(slot, { info: slotInfo, person }, eatenMeals) {
  const recipe = slotInfo.active;
  const isEatenE = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'e');
  const isEatenC = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'c');
  const isEaten = person === 'e' ? isEatenE
    : person === 'c' ? isEatenC
    : isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'both');
  const personLabel = person === 'e' ? ' · Elliott' : person === 'c' ? ' · Chloe' : '';
  const fitBadge = renderFitScoreBadge(recipe, slot.type, { showLabel: true });

  const eatenLabel = person === 'both' ? '✓ Both Eaten' : '✓ Eaten';
  const mainTick = `
        <button class="btn sm ${isEaten ? 'success' : 'ghost'}" type="button" data-action="toggle-meal-eaten" data-meal-type="${slot.type}" data-person="${person}" style="font-size:12px;flex:1;">
          ${isEaten ? eatenLabel : 'Mark Eaten'}
        </button>`;
  const personTicks = person !== 'both' ? '' : `
        <button class="btn sm ${isEatenE ? 'primary' : 'ghost'}" type="button" data-action="toggle-meal-eaten" data-meal-type="${slot.type}" data-person="e" style="font-size:11px;padding:4px 8px;" title="Toggle Elliott">
          ${isEatenE ? '✓ E' : 'E'}
        </button>
        <button class="btn sm ${isEatenC ? 'primary' : 'ghost'}" type="button" data-action="toggle-meal-eaten" data-meal-type="${slot.type}" data-person="c" style="font-size:11px;padding:4px 8px;" title="Toggle Chloe">
          ${isEatenC ? '✓ C' : 'C'}
        </button>`;

  return `
    <div class="today-meal-card ${isEaten ? 'meal-eaten' : ''}" style="background:var(--card,#fff);border:1px solid ${isEaten ? 'var(--green-light,#bbf7d0)' : 'var(--border,#e7e5e4)'};border-radius:14px;padding:16px;margin-bottom:12px;display:flex;flex-direction:column;gap:12px;opacity:${isEaten ? '0.75' : '1'};transition:all 0.2s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted,#78716c);">${slot.icon} ${slot.label}${personLabel}</span>
        <div>${fitBadge}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <h4 style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:var(--text,#1c1917);">${recipe.name || 'Untitled Recipe'}</h4>
          <div style="font-size:12px;color:var(--muted,#78716c);display:flex;gap:10px;">
            <span>🔥 ${Math.round(recipe.nutrition?.perServing?.cal ?? recipe.macros?.calories ?? 0)} kcal</span>
            <span>💪 ${Math.round(recipe.nutrition?.perServing?.prot ?? recipe.macros?.protein ?? 0)}g P</span>
            ${(recipe.prepTime || recipe.time) ? `<span>⏱️ ${escapeHtml(recipe.prepTime || recipe.time)}</span>` : ''}
          </div>
        </div>
        <button class="btn sm" type="button" data-action="view-recipe" data-recipe-id="${escapeAttr(recipe.id)}" data-instance-id="${escapeAttr(slotInfo.instanceId || '')}" data-variant="${escapeAttr(slotInfo.variant || 'original')}" style="white-space:nowrap;font-weight:600;">View Recipe</button>
      </div>
      <div style="display:flex;gap:8px;border-top:1px dashed var(--border,#e7e5e4);padding-top:10px;margin-top:2px;">${mainTick}${personTicks}
      </div>
    </div>
  `;
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
    mount,
    unmount
  };
  window.renderToday = renderToday;
  window.moveTodayDate = moveTodayDate;
  window.resetTodayDate = resetTodayDate;
}
