/**
 * src/components/shopping/ShoppingListView.js (v3.26.0)
 * Interactive Shopping List View Component:
 * - Renders consolidated list grouped by expandable Aisle/Category headers.
 * - Displays required vs. pantry stock quantities.
 * - Interactive checkboxes for shopping check-off and automatic inventory replenishment.
 * - Quick Add manual item form.
 */

import { getState, toggleShoppingItem, addManualShoppingItem, updateShoppingItemQty, setShoppingList } from '../../store/store.js';
import { generateShoppingListFromPlan, AISLE_CATEGORIES } from '../../services/ShoppingListService.js';
import { getShoppingLists } from '../../repositories/ShoppingListRepository.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function renderShoppingListView(container) {
  if (!container) return;

  const state = getState() || {};
  const shoppingList = state.shoppingList || [];
  const activePlan = state.currentPlan || state.plan;
  const inventory = state.inventory || [];
  const recipes = state.recipes || [];
  const ingredientsBank = state.ingredients || [];

  // Group items by category / aisle
  const grouped = {};
  AISLE_CATEGORIES.forEach(cat => { grouped[cat] = []; });

  shoppingList.forEach(item => {
    const cat = AISLE_CATEGORIES.includes(item.category) ? item.category : 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  let aislesHtml = '';
  AISLE_CATEGORIES.forEach(cat => {
    const items = grouped[cat] || [];
    if (items.length === 0) return;

    let itemsHtml = '';
    items.forEach(item => {
      itemsHtml += `
        <div class="shopping-item-row" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border, #eee); background: ${item.isChecked ? 'var(--surface2, #f9f8f6)' : 'var(--surface, #fff)'}; opacity: ${item.isChecked ? '0.65' : '1'}; transition: all 0.2s;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <input type="checkbox" data-action="toggle-shop-item" data-id="${escapeAttr(item.id)}" ${item.isChecked ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
            <div>
              <div style="font-weight: 600; font-size: 14px; text-decoration: ${item.isChecked ? 'line-through' : 'none'}; color: var(--text, #111);">
                ${escapeHtml(item.buyQty)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}
              </div>
              <div style="font-size: 11px; color: var(--text2, #666);">
                Need ${escapeHtml(item.requiredQty)}${escapeHtml(item.unit)} • In stock: ${escapeHtml(item.inStockQty)}${escapeHtml(item.unit)} ${item.isManualAdd ? '• (Manual Add)' : ''}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="number" step="any" class="shop-item-qty-input" data-id="${escapeAttr(item.id)}" value="${item.buyQty}" style="width: 65px; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
            <span style="font-size: 12px; color: var(--text2);">${escapeHtml(item.unit)}</span>
          </div>
        </div>
      `;
    });

    aislesHtml += `
      <div class="shopping-aisle-card" style="background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 12px; margin-bottom: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <div style="background: var(--surface2, #f3f4f6); padding: 10px 16px; font-weight: 700; font-size: 14px; border-bottom: 1px solid var(--border, #e5e7eb); display: flex; justify-content: space-between; align-items: center;">
          <span>🛒 ${cat}</span>
          <span class="badge" style="background: var(--surface); border: 1px solid var(--border); font-size: 11px;">${items.length} item(s)</span>
        </div>
        <div>
          ${itemsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = `
    <div style="padding: 20px; max-width: 900px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: var(--text);">Smart Shopping List</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: var(--text2);">Consolidated from active meal plan with pantry stock subtraction.</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" id="btn-generate-shopping" class="btn primary">🔄 Generate from Active Plan</button>
        </div>
      </div>

      <div style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 700;">+ Quick Add Custom Item</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <input type="text" id="manual-item-name" placeholder="Item name (e.g. Oat Milk)" style="flex: 2; min-width: 200px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px;" />
          <input type="number" step="any" id="manual-item-qty" value="1" placeholder="Qty" style="width: 80px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px;" />
          <select id="manual-item-unit" style="width: 100px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px;">
            <option value="qty">qty</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
          <select id="manual-item-category" style="width: 160px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px;">
            ${AISLE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <button type="button" id="btn-add-manual-item" class="btn secondary">Add Item</button>
        </div>
      </div>

      <div id="shopping-aisles-container">
        ${aislesHtml || `
          <div class="card empty" style="padding: 40px; text-align: center; color: var(--text2); background: var(--surface); border: 1px solid var(--border); border-radius: 12px;">
            <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Your shopping list is empty</div>
            <div style="font-size: 13px; margin-bottom: 16px;">Click "Generate from Active Plan" to calculate needs based on your meals and pantry inventory.</div>
          </div>
        `}
      </div>
    </div>
  `;

  bindShoppingListEvents(container);
}

function bindShoppingListEvents(container) {
  // Generate list button
  const btnGen = container.querySelector('#btn-generate-shopping');
  if (btnGen) {
    btnGen.onclick = () => {
      const state = getState() || {};
      const activePlan = state.currentPlan || state.plan;
      if (!activePlan) {
        alert('No active meal plan found. Please create or generate a meal plan first.');
        return;
      }
      const newList = generateShoppingListFromPlan(activePlan, state.inventory || [], state.recipes || [], state.ingredients || []);
      setShoppingList(newList);
      renderShoppingListView(container);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Generated smart shopping list from active plan!');
      }
    };
  }

  // Quick add manual item
  const btnAddManual = container.querySelector('#btn-add-manual-item');
  if (btnAddManual) {
    btnAddManual.onclick = () => {
      const nameInput = container.querySelector('#manual-item-name');
      const qtyInput = container.querySelector('#manual-item-qty');
      const unitSelect = container.querySelector('#manual-item-unit');
      const catSelect = container.querySelector('#manual-item-category');

      const name = nameInput?.value?.trim();
      if (!name) {
        alert('Please enter a custom item name.');
        return;
      }

      const requiredQty = parseFloat(qtyInput?.value) || 1;
      const unit = unitSelect?.value || 'qty';
      const category = catSelect?.value || 'Uncategorized';

      addManualShoppingItem({
        name,
        requiredQty,
        buyQty: requiredQty,
        unit,
        category
      });

      if (nameInput) nameInput.value = '';
      if (qtyInput) qtyInput.value = '1';
      renderShoppingListView(container);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Added "${name}" to shopping list!`);
      }
    };
  }

  // Checkbox toggles for item check-off
  container.querySelectorAll('input[data-action="toggle-shop-item"]').forEach(chk => {
    chk.onchange = (e) => {
      const itemId = chk.dataset.id;
      toggleShoppingItem(itemId);
      renderShoppingListView(container);
    };
  });

  // Quantity input adjustments
  container.querySelectorAll('.shop-item-qty-input').forEach(input => {
    input.onchange = (e) => {
      const itemId = input.dataset.id;
      const newQty = parseFloat(input.value) || 0;
      updateShoppingItemQty(itemId, newQty);
    };
  });
}

if (typeof window !== 'undefined') {
  window.renderShoppingListView = renderShoppingListView;
  window.ShoppingListView = { render: renderShoppingListView };
}
