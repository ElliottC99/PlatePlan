/**
 * src/components/shopping/ShoppingListUI.js (v3.26.0)
 * Upgraded Shopping List UI using Smart ShoppingListService consolidation engine.
 */

import { getState, toggleShoppingItem, addManualShoppingItem, updateShoppingItemQty, setShoppingList } from '../../store/store.js';
import { generateShoppingListFromPlan, AISLE_CATEGORIES } from '../../services/ShoppingListService.js';

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

export function renderShoppingSummary() {
  const summaryContainer = document.getElementById('shop-summary');
  if (!summaryContainer) return;

  const state = getState() || {};
  const list = state.shoppingList || [];
  let totalItems = 0;
  let totalPrice = 0;

  list.forEach(item => {
    if (!item.isChecked) {
      totalItems += 1;
      totalPrice += (Number(item.buyQty) || 1) * 1.85;
    }
  });

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
            <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:1px;">${totalItems} <span style="font-size:13px;font-weight:500;color:#64748b;">items</span></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" id="btn-generate-shopping" class="btn primary sm" style="font-size:12px;">🔄 Generate from Plan</button>
        </div>
      </div>
    </div>
  `;

  const btnGen = summaryContainer.querySelector('#btn-generate-shopping');
  if (btnGen) {
    btnGen.onclick = () => {
      const activePlan = state.currentPlan || state.plan;
      if (!activePlan) {
        alert('No active meal plan found. Please create or generate a meal plan first.');
        return;
      }
      const newList = generateShoppingListFromPlan(activePlan, state.inventory || [], state.recipes || [], state.ingredients || []);
      setShoppingList(newList);
      renderShoppingListUI();
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Generated smart shopping list from active plan!');
      }
    };
  }
}

export function renderShoppingListUI() {
  renderShoppingSummary();

  const contentContainer = document.getElementById('shop-content');
  if (!contentContainer) return;

  const state = getState() || {};
  const shoppingList = state.shoppingList || [];

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

    aislesHtml += `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);margin-bottom:14px;">
        <div style="background:#f8fafc;padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-weight:700;font-size:15px;color:#0f172a;">🛒 ${escapeHtml(cat)}</span>
            <span style="background:#e2e8f0;color:#475569;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${items.length}</span>
          </div>
        </div>
        <div>
          ${items.map(item => `
            <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;gap:12px;background:${item.isChecked ? '#f8fafc' : '#fff'};opacity:${item.isChecked ? '0.7' : '1'};">
              <div style="display:flex;align-items:center;gap:12px;flex:1;">
                <input type="checkbox" data-action="toggle-shop-item" data-id="${escapeAttr(item.id)}" ${item.isChecked ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb;" />
                <div>
                  <div style="font-weight:600;font-size:14px;color:#1e293b;text-decoration:${item.isChecked ? 'line-through' : 'none'};">
                    ${escapeHtml(item.buyQty)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}
                  </div>
                  <div style="font-size:11px;color:#64748b;margin-top:2px;">
                    Need ${escapeHtml(item.requiredQty)}${escapeHtml(item.unit)} &bull; In stock: ${escapeHtml(item.inStockQty)}${escapeHtml(item.unit)} ${item.isManualAdd ? '&bull; (Manual)' : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <input type="number" step="any" class="shop-item-qty-input" data-id="${escapeAttr(item.id)}" value="${item.buyQty}" style="width:65px;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
                <span style="font-size:11px;color:#64748b;">${escapeHtml(item.unit)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  contentContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:6px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#334155;">+ Quick Add Custom Item</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="manual-item-name" placeholder="Item name (e.g. Oat Milk)" style="flex:2;min-width:180px;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;" />
          <input type="number" step="any" id="manual-item-qty" value="1" placeholder="Qty" style="width:70px;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;" />
          <select id="manual-item-unit" style="width:90px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;">
            <option value="qty">qty</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
          <select id="manual-item-category" style="width:150px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;">
            ${AISLE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <button type="button" id="btn-add-manual-item" class="btn secondary sm" style="font-size:12px;">Add</button>
        </div>
      </div>

      ${aislesHtml || `
        <div style="padding:40px;text-align:center;color:#64748b;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="font-size:16px;font-weight:700;margin-bottom:6px;">Your shopping list is empty</div>
          <div style="font-size:13px;">Click "Generate from Plan" above to consolidate requirements based on your active meal plan and pantry stock.</div>
        </div>
      `}
    </div>
  `;

  bindEvents(contentContainer);
}

function bindEvents(container) {
  const btnAddManual = container.querySelector('#btn-add-manual-item');
  if (btnAddManual) {
    btnAddManual.onclick = () => {
      const name = container.querySelector('#manual-item-name')?.value?.trim();
      if (!name) {
        alert('Please enter a custom item name.');
        return;
      }
      const requiredQty = parseFloat(container.querySelector('#manual-item-qty')?.value) || 1;
      const unit = container.querySelector('#manual-item-unit')?.value || 'qty';
      const category = container.querySelector('#manual-item-category')?.value || 'Uncategorized';

      addManualShoppingItem({ name, requiredQty, buyQty: requiredQty, unit, category });
      renderShoppingListUI();
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Added "${name}" to shopping list!`);
      }
    };
  }

  container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.onchange = () => {
      const itemId = chk.dataset.id;
      if (itemId) {
        toggleShoppingItem(itemId);
        renderShoppingListUI();
      }
    };
  });

  container.querySelectorAll('.shop-item-qty-input').forEach(input => {
    input.onchange = () => {
      const itemId = input.dataset.id;
      const newQty = parseFloat(input.value) || 0;
      if (itemId) updateShoppingItemQty(itemId, newQty);
    };
  });
}

if (typeof window !== 'undefined') {
  window.renderShoppingListUI = renderShoppingListUI;
  window.renderShoppingSummary = renderShoppingSummary;
}
