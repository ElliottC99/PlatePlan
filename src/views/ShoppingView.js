/**
 * src/views/ShoppingView.js (v3.20.14)
 * Componentised Shopping List View with reactive store subscription.
 * Real-time state synchronisation with Household Meal Plan and Reactive Store.
 * Categorised groceries with clean 'Items I Already Have' separation.
 */
import { getState } from '../store/coreState.js';

import { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics } from '../components/ProductSwapModal.js';
import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { calculateShoppingItemCost, normalizeProductPackGrams, getFallbackProductData, formatShoppingItemQuantity, aggregateShoppingListFromPlan } from '../services/ShoppingCalculationService.js';
import { renderShoppingSummary, renderShoppingListUI } from '../components/shopping/ShoppingListUI.js';
import { subscribe } from '../store/store.js';
import { saveCurrentPlan } from '../services/HouseholdRepository.js';

export { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics, getShoppingLineStateKey, calculateShoppingItemCost, formatShoppingItemQuantity, aggregateShoppingListFromPlan, renderShoppingSummary, renderShoppingListUI };

/**
 * Toggles an item's at-home tick on the planner's Step 3 shopping list.
 * The ticks live in currentPlan.shoppingAtHome, keyed by the aggregated item key,
 * which is what aggregateShoppingListFromPlan reads back.
 */
export function toggleShoppingItemAcquired(itemKey) {
  // saveCurrentPlan replaces the whole plans/current document, so never save without a plan.
  const plan = getState().currentPlan;
  if (!plan || !plan.slots || !itemKey) {
    console.warn('[ShoppingView] No current plan or item key; not saving at-home tick.');
    return;
  }

  const shoppingAtHome = { ...(plan.shoppingAtHome || {}) };
  const nextAtHome = !shoppingAtHome[itemKey];
  if (nextAtHome) shoppingAtHome[itemKey] = true;
  else delete shoppingAtHome[itemKey];
  plan.shoppingAtHome = shoppingAtHome;

  saveCurrentPlan(plan).catch(err => {
    console.warn('[ShoppingView] Failed saving at-home ticks to cloud:', err);
  });

  const item = (aggregateShoppingListFromPlan(plan).items || []).find(i => i.key === itemKey);
  const name = item?.name || 'Item';

  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();

  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(nextAtHome ? `Checked off "${name}"` : `Moved "${name}" back to shopping list`);
  }
}

// Bind Global Aliases for Action Bridge and Legacy Compatibility
export function toggleInlineShoppingSubst(itemKey, groupId = '', instanceId = null) {
  renderScrollableSwapModal(itemKey, groupId, null, { instanceId });
}

if (typeof window !== 'undefined') {
  window.renderShopping = renderShoppingListUI;
  window.renderShoppingList = renderShoppingListUI;
  window.toggleInlineShoppingSubst = toggleInlineShoppingSubst;
  window.toggleShoppingItemAcquired = toggleShoppingItemAcquired;
  window.toggleShoppingAtHome = toggleShoppingItemAcquired;
}

let shoppingUnsub = null;
let shoppingTimer = null;

export function mount(container) {
  if (typeof renderShoppingListUI === 'function') {
    renderShoppingListUI();
  } else if (typeof renderShoppingSummary === 'function') {
    renderShoppingSummary();
  }
  shoppingUnsub = subscribe('shopping', (list) => {
    if (typeof renderShoppingListUI === 'function') {
      renderShoppingListUI();
    }
  });
}

export function unmount() {
  if (typeof shoppingUnsub === 'function') {
    shoppingUnsub();
    shoppingUnsub = null;
  }
  if (shoppingTimer) {
    clearTimeout(shoppingTimer);
    shoppingTimer = null;
  }
}
