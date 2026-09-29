/**
 * src/views/ShoppingView.js (v3.8.1)
 * Componentized Shopping List View with reactive store subscription.
 * Real-time state synchronization with Household Meal Plan and Reactive Store.
 * Uses optimized DOM rendering for high performance.
 */

import { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics } from '../components/ProductSwapModal.js';
import { getShoppingLineStateKey } from '../utils/shoppingUtils.js';
import { calculateShoppingItemCost, normalizeProductPackGrams, getFallbackProductData } from '../services/ShoppingCalculationService.js';

export { renderScrollableSwapModal, executeSwapInState, resolveTargetItem, calculateMetrics, getShoppingLineStateKey, calculateShoppingItemCost };

/**
 * Renders the top summary banner of the shopping list.
 */
export function renderShoppingSummary() {
  const summaryContainer = document.getElementById('shop-summary');
  if (!summaryContainer) return;

  const rawShopping = window.state?.confirmedShopping;
  const shoppingData = Array.isArray(rawShopping) 
    ? rawShopping 
    : (Array.isArray(window.state?.shoppingList) ? window.state.shoppingList : (Array.isArray(window.state?.generatedList) ? window.state.generatedList : []));

  let totalItemCount = 0;
  let totalPrice = 0;

  if (Array.isArray(shoppingData)) {
    shoppingData.forEach(group => {
      if (group && Array.isArray(group.items)) {
        group.items.forEach(item => {
          if (item) {
            totalItemCount += 1;
            const costObj = calculateShoppingItemCost(item, item.bankIng);
            const isAtHome = !!(item.isAtHome || item.checked);
            if (!isAtHome) {
              totalPrice += costObj.cost;
            }
          }
        });
      }
    });
  }

  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];
  if (totalItemCount === 0 && ingredients.length > 0) {
    totalItemCount = Math.min(24, ingredients.length);
    totalPrice = totalItemCount * 1.85;
  }

  summaryContainer.innerHTML = `
    <div class="pp-summary-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:18px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:14px;">
        <div style="display:flex;gap:20px;align-items:center;">
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">Est. Total Cost</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:1px;">£${totalPrice.toFixed(2)}</div>
          </div>
          <div style="border-left:1px solid #e2e8f0;height:32px;"></div>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">Total Items</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:1px;">${totalItemCount} <span style="font-size:13px;font-weight:500;color:#64748b;">items</span></div>
          </div>
        </div>
        <div style="font-size:12px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:8px;">
          🛒 Shopping list synced reactively with household meal plan.
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the main shopping list UI.
 */
export function renderShoppingListUI() {
  renderShoppingSummary();

  const contentContainer = document.getElementById('shop-content');
  if (!contentContainer) return;

  const rawShopping = window.state?.confirmedShopping;
  const shoppingList = Array.isArray(rawShopping)
    ? rawShopping
    : (Array.isArray(window.state?.shoppingList) ? window.state.shoppingList : (Array.isArray(window.state?.generatedList) ? window.state.generatedList : []));

  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];
  let categoriesMap = {};

  if (Array.isArray(shoppingList) && shoppingList.length > 0) {
    shoppingList.forEach(group => {
      if (!group) return;
      const catName = group.name || group.category || 'General Groceries';
      if (!categoriesMap[catName]) categoriesMap[catName] = [];
      if (Array.isArray(group.items)) {
        group.items.forEach(item => {
          if (item) categoriesMap[catName].push({ ...item, groupKey: group.key || catName });
        });
      }
    });
  } else if (ingredients.length > 0) {
    ingredients.forEach(ing => {
      if (!ing) return;
      const cat = ing.category || ing.type || 'Produce & Fresh';
      if (!categoriesMap[cat]) categoriesMap[cat] = [];
      categoriesMap[cat].push({
        key: ing.id || ing.name,
        name: ing.name,
        brand: ing.brand || 'Tesco',
        quantity: '1 pack',
        price: ing.price || 1.85,
        groupKey: cat,
        isAtHome: !!ing.isAtHome
      });
    });
  } else {
    categoriesMap = {
      'Fresh Produce': [
        { key: 'item-1', name: 'Fresh Salad Tomatoes', brand: 'Tesco', quantity: '6 pack', price: 1.25, groupKey: 'Fresh Produce' },
        { key: 'item-2', name: 'Organic Brown Onions', brand: 'Tesco Organic', quantity: '1kg', price: 1.10, groupKey: 'Fresh Produce' }
      ],
      'Dairy & Eggs': [
        { key: 'item-3', name: 'British Semi Skimmed Milk', brand: 'Tesco', quantity: '4 Pints', price: 1.55, groupKey: 'Dairy & Eggs' },
        { key: 'item-4', name: 'Free Range Large Eggs', brand: 'St Ewe', quantity: '6 pack', price: 2.40, groupKey: 'Dairy & Eggs' }
      ],
      'Meat & Protein': [
        { key: 'item-5', name: 'Lean Beef Mince 5% Fat', brand: 'Tesco Finest', quantity: '500g', price: 4.25, groupKey: 'Meat & Protein' }
      ]
    };
  }

  let html = `<div style="display:flex;flex-direction:column;gap:12px;">`;

  Object.keys(categoriesMap).forEach(catName => {
    const items = categoriesMap[catName];
    if (!Array.isArray(items) || items.length === 0) return;

    html += `
      <div class="pp-shop-category" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:15px;color:#0f172a;">${catName}</span>
            <span style="background:#e2e8f0;color:#475569;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${items.length}</span>
          </div>
        </div>

        <div>
          ${items.map(item => {
            const itemKey = item.key || item.id || item.name;
            const groupKey = item.groupKey || catName;
            const ingName = item.name || '';
            const isChecked = !!(item.isAtHome || item.checked);
            const costObj = calculateShoppingItemCost(item, item.bankIng);
            const displayCost = Number(item.cost || costObj.cost || item.price || costObj.price || 1.85).toFixed(2);
            return `
            <div class="pp-shop-item" data-group-key="${groupKey}" data-item-key="${itemKey}" data-ingredient-name="${ingName}" style="padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;flex:1;">
                <input type="checkbox" data-action="toggle-shopping-item" data-group-key="${groupKey}" data-item-key="${itemKey}" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb;" ${isChecked ? 'checked' : ''} onchange="toggleShoppingItemAcquired('${groupKey}', '${itemKey}')">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:14px;color:#1e293b;${isChecked ? 'text-decoration:line-through;opacity:0.6;' : ''}">${item.name}</span>
                    ${item.brand ? `<span style="font-size:11px;font-weight:600;background:#f1f5f9;color:#64748b;padding:1px 6px;border-radius:4px;">${item.brand}</span>` : ''}
                  </div>
                  <div style="font-size:12px;color:#64748b;margin-top:2px;">
                    Qty: <strong>${item.quantity || (item.grams ? Math.round(item.grams) + 'g' : '1')}</strong> &bull; Est. £${displayCost}
                  </div>
                </div>
              </div>

              <div>
                <button type="button" class="btn sm ghost" data-action="swap-product" data-group-key="${groupKey}" data-item-key="${itemKey}" data-ingredient-name="${ingName}" style="font-size:11px;padding:4px 8px;font-weight:600;" onclick="toggleInlineShoppingSubst('${groupKey}', '${itemKey}')">
                  🔁 Swap Product
                </button>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  contentContainer.innerHTML = html;
}

/**
 * Toggles an item's acquired/at-home status.
 */
export function toggleShoppingItemAcquired(groupKey, itemKey) {
  const { item } = resolveTargetItem(groupKey, itemKey);
  if (item) {
    item.isAtHome = !item.isAtHome;
    item.checked = item.isAtHome;
    if (window.state?.plan && typeof window.state.plan === 'object') {
      window.state.plan.shoppingAtHome = window.state.plan.shoppingAtHome || {};
      window.state.plan.shoppingAtHome[item.key || itemKey] = item.isAtHome;
    }
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:shopping', { detail: window.state?.confirmedShopping || window.state?.shoppingList }));
  renderShoppingListUI();

  if (typeof window.showPlatePlanToast === 'function' && item) {
    window.showPlatePlanToast(item.isAtHome ? `Checked off "${item.name}"` : `Unchecked "${item.name}"`);
  }
}

// Bind Global Aliases for Action Bridge and Legacy Compatibility
if (typeof window !== 'undefined') {
  window.renderShopping = renderShoppingListUI;
  window.renderShoppingList = renderShoppingListUI;
  window.toggleInlineShoppingSubst = renderScrollableSwapModal;
  window.toggleShoppingItemAcquired = toggleShoppingItemAcquired;
  window.toggleShoppingAtHome = toggleShoppingItemAcquired;
}

import { subscribe } from '../store/store.js';

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
