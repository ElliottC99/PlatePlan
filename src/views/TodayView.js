/**
 * src/views/TodayView.js (v3.20.03)
 * Modular ES6 View for the Today Dashboard.
 * Renders daily meal timeline, macro snapshots, and meal completion toggles.
 */

import { getState, subscribe } from '../store/store.js';
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
  const state = getState() || window.state || {};
  const plan = state.plan || {};
  const currentEaten = plan.eatenMeals || {};

  const { nextEaten, toastMessage } = calculateMealEatenUpdates(currentEaten, currentDateStr, mealType, person);
  plan.eatenMeals = nextEaten;
  
  if (typeof window !== 'undefined' && window.state?.plan) {
    window.state.plan.eatenMeals = nextEaten;
  }

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

  const state = getState() || window.state || {};
  const plan = state.plan || {};
  const recipes = state.recipes || [];
  const planContext = { dayDates: plan.dayDates || {} };
  
  const dayKey = getTodayPlanDay(currentDateStr, planContext);
  const dayPlan = dayKey && plan.slots ? plan.slots[dayKey] : null;

  if (!dayPlan || Object.keys(dayPlan).length === 0) {
    contentEl.innerHTML = `
      <div style="background:var(--card,#fff);border:1px solid var(--border,#e7e5e4);border-radius:16px;padding:32px 20px;text-align:center;margin-top:16px;">
        <div style="font-size:36px;margin-bottom:12px;">📅</div>
        <h3 style="font-size:18px;font-weight:700;margin:0 0 8px 0;color:var(--text,#1c1917);">No meals planned for this day</h3>
        <p style="font-size:14px;color:var(--muted,#78716c);margin:0 0 20px 0;max-width:320px;margin-inline:auto;">Generate a balanced multi-day meal plan or browse the recipe vault to get started.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="btn primary" type="button" data-pp-click="showView('planner')" style="padding:10px 20px;font-weight:600;">Open Meal Planner</button>
          <button class="btn ghost" type="button" data-pp-click="showView('vault')" style="padding:10px 20px;font-weight:600;">Browse Recipes</button>
        </div>
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

  const cardsHtml = mealSlots.map(slot => {
    const slotData = dayPlan[slot.type];
    if (!slotData) return '';

    const slotInfo = getPlanSlotInfo(slotData);
    if (!slotInfo || !slotInfo.active) return '';

    const recipe = slotInfo.active;
    const isEaten = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'both');
    const isEatenE = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'e');
    const isEatenC = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'c');
    const fitBadge = renderFitScoreBadge(recipe, slot.type, { showLabel: true });

    return `
      <div class="today-meal-card ${isEaten ? 'meal-eaten' : ''}" style="background:var(--card,#fff);border:1px solid ${isEaten ? 'var(--green-light,#bbf7d0)' : 'var(--border,#e7e5e4)'};border-radius:14px;padding:16px;margin-bottom:12px;display:flex;flex-direction:column;gap:12px;opacity:${isEaten ? '0.75' : '1'};transition:all 0.2s ease;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted,#78716c);">${slot.icon} ${slot.label}</span>
          <div>${fitBadge}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <h4 style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:var(--text,#1c1917);">${recipe.name || 'Untitled Recipe'}</h4>
            <div style="font-size:12px;color:var(--muted,#78716c);display:flex;gap:10px;">
              <span>🔥 ${Math.round(recipe.nutrition?.calories || 0)} kcal</span>
              <span>🥩 ${Math.round(recipe.nutrition?.protein || 0)}g P</span>
              <span>⏱️ ${recipe.prepTime || 20}m</span>
            </div>
          </div>
          <button class="btn sm" type="button" data-pp-click="viewRecipe('${recipe.id}', '${slotInfo.instanceId}', '${slotInfo.variant}')" style="white-space:nowrap;font-weight:600;">View Recipe</button>
        </div>
        <div style="display:flex;gap:8px;border-top:1px dashed var(--border,#e7e5e4);padding-top:10px;margin-top:2px;">
          <button class="btn sm ${isEaten ? 'success' : 'ghost'}" type="button" data-pp-click="TodayView.toggleMealEaten('${slot.type}', 'both')" style="font-size:12px;flex:1;">
            ${isEaten ? '✓ Both Eaten' : 'Mark Eaten'}
          </button>
          <button class="btn sm ${isEatenE ? 'primary' : 'ghost'}" type="button" data-pp-click="TodayView.toggleMealEaten('${slot.type}', 'e')" style="font-size:11px;padding:4px 8px;" title="Toggle Elliott">
            ${isEatenE ? '✓ E' : 'E'}
          </button>
          <button class="btn sm ${isEatenC ? 'primary' : 'ghost'}" type="button" data-pp-click="TodayView.toggleMealEaten('${slot.type}', 'c')" style="font-size:11px;padding:4px 8px;" title="Toggle Chloe">
            ${isEatenC ? '✓ C' : 'C'}
          </button>
        </div>
      </div>
    `;
  }).filter(Boolean).join('');

  contentEl.innerHTML = cardsHtml || `
    <div style="background:var(--card,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;padding:24px;text-align:center;margin-top:12px;">
      <p style="color:var(--muted,#78716c);margin:0;">No meals assigned to this day in your active plan.</p>
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
