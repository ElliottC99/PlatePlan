/**
 * src/views/ShoppingView.js (v3.20.14)
 * Shopping actions for the planner's Step 3 shopping list (at-home ticks and product
 * swaps). The standalone Shopping screen was removed; Step 3 is the shopping list.
 */
import { getState } from '../store/coreState.js';

import { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics } from '../components/ProductSwapModal.js';
import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { calculateShoppingItemCost, normalizeProductPackGrams, getFallbackProductData, formatShoppingItemQuantity, aggregateShoppingListFromPlan } from '../services/ShoppingCalculationService.js';
import { saveCurrentPlan } from '../services/HouseholdRepository.js';

export { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics, getShoppingLineStateKey, calculateShoppingItemCost, formatShoppingItemQuantity, aggregateShoppingListFromPlan };

/**
 * Toggles an item's at-home tick on the planner's Step 3 shopping list.
 * The ticks live in currentPlan.shoppingAtHome, keyed by each line's atHomeKey (its
 * ingredient), which is what aggregateShoppingListFromPlan reads back.
 */
export function toggleShoppingItemAcquired(atHomeKey) {
  // saveCurrentPlan replaces the whole plans/current document, so never save without a plan.
  const plan = getState().currentPlan;
  if (!plan || !plan.slots || !atHomeKey) {
    console.warn('[ShoppingView] No current plan or item key; not saving at-home tick.');
    return;
  }

  const shoppingAtHome = { ...(plan.shoppingAtHome || {}) };
  const nextAtHome = !shoppingAtHome[atHomeKey];
  if (nextAtHome) shoppingAtHome[atHomeKey] = true;
  else delete shoppingAtHome[atHomeKey];
  plan.shoppingAtHome = shoppingAtHome;

  saveCurrentPlan(plan).catch(err => {
    console.warn('[ShoppingView] Failed saving at-home ticks to cloud:', err);
  });

  const item = (aggregateShoppingListFromPlan(plan).items || []).find(i => i.atHomeKey === atHomeKey);
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
  window.toggleInlineShoppingSubst = toggleInlineShoppingSubst;
  window.toggleShoppingItemAcquired = toggleShoppingItemAcquired;
  window.toggleShoppingAtHome = toggleShoppingItemAcquired;
}
