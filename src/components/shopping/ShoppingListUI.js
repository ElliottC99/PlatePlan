/**
 * src/components/shopping/ShoppingListUI.js (v3.20.01)
 * Modular Presentation Component for Shopping List Cards, Items & Summaries.
 * Hydrates planned slot items by fetching full recipe objects from the central Recipe Vault via recipeId.
 */

import { renderShoppingItemRow, renderSubstDrawerContent } from './ShoppingItemRow.js';
import { renderShoppingCategoriesList } from './ShoppingCategoryGroup.js';
import { renderShoppingBatchToolbar, exportShoppingListToClipboard, exportShoppingListToText, clearCheckedShoppingItems } from './ShoppingBatchToolbar.js';
import { calculateShoppingItemCost, formatShoppingItemQuantity, aggregateShoppingListFromPlan } from '../../services/ShoppingCalculationService.js';

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function resolveHydratedShoppingGroups() {
  const state = (typeof window !== 'undefined' ? (window.Store?.getState?.() || window.state || {}) : {});
  const rawShopping = typeof window !== 'undefined' ? window.state?.confirmedShopping : null;
  if (Array.isArray(rawShopping) && rawShopping.length > 0) {
    return rawShopping;
  }

  const plan = (typeof window !== 'undefined' ? window.state?.plan : null) || state.plan;
  const vaultRecipes = (typeof window !== 'undefined' && Array.isArray(window.recipes) && window.recipes.length ? window.recipes : null)
    || (typeof window !== 'undefined' && Array.isArray(window.state?.recipes) && window.state.recipes.length ? window.state.recipes : null)
    || (Array.isArray(state.recipes) ? state.recipes : []);

  if (plan && plan.slots && Object.keys(plan.slots).length > 0 && vaultRecipes.length > 0) {
    const agg = aggregateShoppingListFromPlan(plan, { ...state, recipes: vaultRecipes });
    if (Array.isArray(agg.groups) && agg.groups.length > 0) {
      return agg.groups;
    }
  }

  const fallbackList = typeof window !== 'undefined'
    ? (Array.isArray(window.state?.shoppingList) ? window.state.shoppingList : (Array.isArray(window.state?.generatedList) ? window.state.generatedList : []))
    : [];
  return fallbackList;
}

export function renderShoppingSummary() {
  const summaryContainer = document.getElementById('shop-summary');
  if (!summaryContainer) return;

  const shoppingData = resolveHydratedShoppingGroups();
  let totalItemCount = 0;
  let totalPrice = 0;

  if (Array.isArray(shoppingData)) {
    shoppingData.forEach(group => {
      if (group && Array.isArray(group.items)) {
        group.items.forEach(item => {
          if (item) {
            const isAtHome = !!(item.isAtHome || item.checked);
            if (!isAtHome) {
              totalItemCount += 1;
              const costObj = calculateShoppingItemCost(item, item.bankIng);
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
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">Est. Needed Cost</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:1px;">£${totalPrice.toFixed(2)}</div>
          </div>
          <div style="border-left:1px solid #e2e8f0;height:32px;"></div>
          <div>
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;">Items to Buy</div>
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:1px;">${totalItemCount} <span style="font-size:13px;font-weight:500;color:#64748b;">items</span></div>
          </div>
        </div>
        <div style="font-size:12px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:8px;">
          🛒 Synchronised live with household meal plan.
        </div>
      </div>
    </div>
  `;
}

export function renderShoppingListUI() {
  renderShoppingSummary();

  const contentContainer = document.getElementById('shop-content');
  if (!contentContainer) return;

  const shoppingList = resolveHydratedShoppingGroups();
  const ingredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];
  let categoriesMap = {};
  let alreadyHaveItems = [];

  const checkIsAtHome = (item, key) => {
    if (item?.isAtHome || item?.checked) return true;
    if (window.state?.plan?.shoppingAtHome && key) {
      return !!window.state.plan.shoppingAtHome[key];
    }
    return false;
  };

  if (Array.isArray(shoppingList) && shoppingList.length > 0) {
    shoppingList.forEach(group => {
      if (!group) return;
      const catName = group.name || group.category || 'General Groceries';
      if (!categoriesMap[catName]) categoriesMap[catName] = [];
      if (Array.isArray(group.items)) {
        group.items.forEach(item => {
          if (!item) return;
          const itemKey = item.key || item.id || item.name;
          const isAtHome = checkIsAtHome(item, itemKey);
          const enriched = { ...item, isAtHome, checked: isAtHome, groupKey: group.key || catName };
          if (isAtHome) {
            alreadyHaveItems.push(enriched);
          } else {
            categoriesMap[catName].push(enriched);
          }
        });
      }
    });
  } else if (ingredients.length > 0) {
    ingredients.forEach(ing => {
      if (!ing) return;
      const cat = ing.category || ing.type || 'Produce & Fresh';
      const itemKey = ing.id || ing.name;
      const isAtHome = checkIsAtHome(ing, itemKey);
      const enriched = {
        key: itemKey,
        name: ing.name,
        brand: ing.brand || 'Tesco',
        quantity: '1 pack',
        price: ing.price || 1.85,
        groupKey: cat,
        isAtHome,
        checked: isAtHome
      };
      if (isAtHome) {
        alreadyHaveItems.push(enriched);
      } else {
        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(enriched);
      }
    });
  } else {
    categoriesMap = {
      'Fresh Produce': [
        { key: 'item-1', name: 'Fresh Salad Tomatoes', brand: 'Tesco', quantity: '6 pack', price: 1.25, groupKey: 'Fresh Produce', isAtHome: false },
        { key: 'item-2', name: 'Organic Brown Onions', brand: 'Tesco Organic', quantity: '1kg', price: 1.10, groupKey: 'Fresh Produce', isAtHome: false }
      ],
      'Dairy & Eggs': [
        { key: 'item-3', name: 'British Semi Skimmed Milk', brand: 'Tesco', quantity: '4 Pints', price: 1.55, groupKey: 'Dairy & Eggs', isAtHome: false }
      ]
    };
  }

  let html = `<div style="display:flex;flex-direction:column;gap:14px;">`;

  Object.keys(categoriesMap).forEach(catName => {
    const items = categoriesMap[catName];
    if (!Array.isArray(items) || items.length === 0) return;

    html += `
      <div class="pp-shop-category" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:15px;color:#0f172a;">${escapeHtml(catName)}</span>
            <span style="background:#e2e8f0;color:#475569;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${items.length}</span>
          </div>
        </div>
        <div>
          ${items.map(item => {
            const itemKey = item.key || item.id || item.name;
            const groupKey = item.groupKey || catName;
            const ingName = item.name || '';
            const costObj = calculateShoppingItemCost(item, item.bankIng);
            const displayCost = Number(item.cost || costObj.cost || item.price || costObj.price || 1.85).toFixed(2);
            return `
            <div class="pp-shop-item" data-group-key="${escapeHtml(groupKey)}" data-item-key="${escapeHtml(itemKey)}" data-ingredient-name="${escapeHtml(ingName)}" style="padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;flex:1;">
                <input type="checkbox" id="chk-shop-view-${escapeHtml(groupKey)}-${escapeHtml(itemKey)}" name="chkShopView-${escapeHtml(groupKey)}-${escapeHtml(itemKey)}" aria-label="Acquire ${escapeHtml(item.name)}" data-action="toggle-shopping-item" data-group-key="${escapeHtml(groupKey)}" data-item-key="${escapeHtml(itemKey)}" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb;" onchange="toggleShoppingItemAcquired('${escapeHtml(groupKey)}', '${escapeHtml(itemKey)}', '${escapeHtml(ingName)}')">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:14px;color:#1e293b;">${escapeHtml(item.name)}</span>
                    ${item.brand ? `<span style="font-size:11px;font-weight:600;background:#f1f5f9;color:#64748b;padding:1px 6px;border-radius:4px;">${escapeHtml(item.brand)}</span>` : ''}
                  </div>
                  <div style="font-size:12px;color:#64748b;margin-top:2px;">
                    Qty: <strong>${escapeHtml(formatShoppingItemQuantity(item))}</strong> &bull; Est. £${displayCost}
                  </div>
                </div>
              </div>
              <div>
                <button type="button" class="btn sm btn-ghost ghost" data-action="swap-product" data-group-key="${escapeHtml(groupKey)}" data-item-key="${escapeHtml(itemKey)}" data-ingredient-name="${escapeHtml(ingName)}" style="font-size:11px;padding:4px 8px;font-weight:600;" onclick="toggleInlineShoppingSubst('${escapeHtml(groupKey)}', '${escapeHtml(itemKey)}')">
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

  if (alreadyHaveItems.length > 0) {
    html += `
      <div class="pp-shop-athome-section" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden;margin-top:8px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">
        <div style="background:#e2e8f0;padding:12px 16px;border-bottom:1px solid #cbd5e1;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:14px;color:#334155;">✓ Items I Already Have</span>
            <span style="background:#cbd5e1;color:#1e293b;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${alreadyHaveItems.length}</span>
          </div>
          <span style="font-size:11px;color:#64748b;">Tap checkbox to uncheck</span>
        </div>
        <div>
          ${alreadyHaveItems.map(item => {
            const itemKey = item.key || item.id || item.name;
            const groupKey = item.groupKey || 'General';
            const ingName = item.name || '';
            return `
            <div class="pp-shop-item at-home" data-group-key="${escapeHtml(groupKey)}" data-item-key="${escapeHtml(itemKey)}" data-ingredient-name="${escapeHtml(ingName)}" style="padding:10px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f8fafc;opacity:0.85;">
              <div style="display:flex;align-items:center;gap:12px;flex:1;">
                <input type="checkbox" id="chk-shop-athome-${escapeHtml(groupKey)}-${escapeHtml(itemKey)}" name="chkShopAthome-${escapeHtml(groupKey)}-${escapeHtml(itemKey)}" aria-label="Mark ${escapeHtml(item.name)} as needed" checked data-action="toggle-shopping-item" data-group-key="${escapeHtml(groupKey)}" data-item-key="${escapeHtml(itemKey)}" style="width:18px;height:18px;cursor:pointer;accent-color:#059669;" onchange="toggleShoppingItemAcquired('${escapeHtml(groupKey)}', '${escapeHtml(itemKey)}', '${escapeHtml(ingName)}')">
                <div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-weight:600;font-size:13px;color:#64748b;text-decoration:line-through;">${escapeHtml(item.name)}</span>
                    ${item.brand ? `<span style="font-size:10px;background:#e2e8f0;color:#64748b;padding:1px 5px;border-radius:4px;">${escapeHtml(item.brand)}</span>` : ''}
                  </div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:1px;">
                    Qty: ${escapeHtml(formatShoppingItemQuantity(item))} (Marked at home)
                  </div>
                </div>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  contentContainer.innerHTML = html;
}

export {
  renderShoppingItemRow,
  renderSubstDrawerContent,
  renderShoppingCategoriesList,
  renderShoppingBatchToolbar,
  exportShoppingListToClipboard,
  exportShoppingListToText,
  clearCheckedShoppingItems
};
