/**
 * src/views/ShoppingView.js (v3.20.14)
 * Componentised Shopping List View with reactive store subscription.
 * Real-time state synchronisation with Household Meal Plan and Reactive Store.
 * Categorised groceries with clean 'Items I Already Have' separation.
 */

import { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics } from '../components/ProductSwapModal.js';
import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { calculateShoppingItemCost, normalizeProductPackGrams, getFallbackProductData, formatShoppingItemQuantity, aggregateShoppingListFromPlan } from '../services/ShoppingCalculationService.js';
import { renderShoppingSummary, renderShoppingListUI } from '../components/shopping/ShoppingListUI.js';
import { subscribe } from '../store/store.js';

export { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics, getShoppingLineStateKey, calculateShoppingItemCost, formatShoppingItemQuantity, aggregateShoppingListFromPlan, renderShoppingSummary, renderShoppingListUI };

/**
 * Toggles an item's acquired/at-home status.
 */
export function toggleShoppingItemAcquired(groupKey, itemKey, explicitName = '') {
  const { item } = resolveTargetItem(groupKey, itemKey);
  const targetKey = item?.key || itemKey;
  const currentAtHome = !!(item?.isAtHome || (getState()?.plan?.shoppingAtHome && getState().currentPlan.shoppingAtHome[targetKey]));
  const nextAtHome = !currentAtHome;

  if (item) {
    item.isAtHome = nextAtHome;
    item.checked = nextAtHome;
  }

  if (getState()?.plan && typeof getState().currentPlan === 'object') {
    getState().currentPlan.shoppingAtHome = getState().currentPlan.shoppingAtHome || {};
    getState().currentPlan.shoppingAtHome[targetKey] = nextAtHome;
  }

  // Determine human-readable item name for toast
  let cleanName = item?.name || explicitName;
  if (!cleanName || cleanName.startsWith('group_') || cleanName.startsWith('bank_') || cleanName.startsWith('raw_')) {
    cleanName = explicitName || item?.ingredient || item?.productName || item?.bankIng?.name || 'Item';
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: getState()?.confirmedShopping ?.shoppingList }));
  renderShoppingListUI();

  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(nextAtHome ? `Checked off "${cleanName}"` : `Moved "${cleanName}" back to shopping list`);
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
