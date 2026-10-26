/**
 * src/views/PlannerRenderService.js (v3.38.66)
 * Pure template generation service for the Meal Planner Wizard.
 * Isolates HTML string building from the main PlannerView controller.
 */
import { getState } from '../store/coreState.js';

/**
 * Renders the Step 2 review screen for the planner wizard.
 * @param {Object} plan - The current plan state.
 * @returns {string} HTML string.
 */
export function renderWizardStep2(plan) {
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

  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Step 2: Review Generated Meal Plan</h2>
          <div style="font-size:13px;color:var(--text2);margin-top:4px">Review daily macro fits and swap any meal directly inline.</div>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn ghost sm" data-action="set-step" data-step="1">← Edit Requests</button>
          <button type="button" class="btn primary sm" style="font-weight:700" data-action="set-step" data-step="3">Proceed to Shopping List →</button>
        </div>
      </div>
      <div class="dense-plan-grid">${cardsHtml}</div>
      <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <button type="button" class="btn ghost" data-action="set-step" data-step="1">← Back to Configure</button>
        <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" data-action="set-step" data-step="3">Proceed to Shopping List &amp; Substitutions →</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Step 3 shopping list review screen.
 * @param {Object} plan - The current plan.
 * @returns {string} HTML string.
 */
export function renderWizardStep3(plan) {
  const agg = typeof window.computeWizardShoppingAgg === 'function' ? window.computeWizardShoppingAgg(plan) : { items: [], totalCost: 0 };
  const items = agg.items || [];
  const totalCost = agg.totalCost || 0;
  const topToolbarHtml = window.ShoppingBatchToolbar?.renderShoppingBatchToolbar?.({ totalCost, items }) || '';
  const listHtml = window.ShoppingCategoryGroup?.renderShoppingCategoriesList?.(items) || '';
  return `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${topToolbarHtml}
      ${listHtml}
      <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <button type="button" class="btn ghost" data-action="set-step" data-step="2">← Back to Review Plan</button>
        <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" data-action="commit-plan">✓ Save Shopping List &amp; Plan (Commit to Today) →</button>
      </div>
    </div>
  `;
}

/**
 * Calculates day nutrition summary.
 * @returns {Object} Nutrition totals and targets.
 */
export function makeRenderedDaySummary() {
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
    targets: { e: { cal: +getState()?.prefs?.ecal || 0, prot: +getState()?.prefs?.eprot || 0 }, c: { cal: +getState()?.prefs?.ccal || 0, prot: +getState()?.prefs?.cprot || 0 } },
    assumed,
    score: 0
  };
}
