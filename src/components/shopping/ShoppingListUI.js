/**
 * src/components/shopping/ShoppingListUI.js (v3.31.15)
 * Upgraded Shopping List UI using Smart ShoppingListService consolidation engine,
 * robust quantity/unit formatting, and expandable recipe usage breakdown accordions.
 */

import { getState, toggleShoppingItem, addManualShoppingItem, updateShoppingItemQty, setShoppingList } from '../../store/store.js';
import { generateShoppingListFromPlan, AISLE_CATEGORIES } from '../../services/ShoppingListService.js';
import { showCustomAlert } from '../pantry/IngredientActionModalsUI.js';


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

  const state = getState();
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
        if (typeof showCustomAlert === 'function') showCustomAlert('No active meal plan found. Please create or generate a meal plan first.');
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

  // Delegation
  if (!container.hasAttribute('data-delegated')) {
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const itemId = target.dataset.itemId;
      
      if (action === 'toggle-breakdown') {
        if (typeof window.toggleShoppingItemBreakdown === 'function') window.toggleShoppingItemBreakdown(itemId);
      } else if (action === 'swap-product') {
        const itemName = target.dataset.itemName;
        if (typeof window.renderScrollableSwapModal === 'function') window.renderScrollableSwapModal(itemId, itemName);
      } else if (action === 'back-to-plan') {
        if (typeof window.setPlannerWizardStep === 'function') window.setPlannerWizardStep(2);
      } else if (action === 'copy-list') {
        import('./ShoppingBatchToolbar.js').then(m => m.exportShoppingListToClipboard());
      } else if (action === 'commit-plan') {
        if (typeof window.commitPlannerWizardPlan === 'function') window.commitPlannerWizardPlan();
      }
    });
    container.setAttribute('data-delegated', 'true');
  }
}

export function renderShoppingListUI() {
  renderShoppingSummary();

  const contentContainer = document.getElementById('shop-content');
  if (!contentContainer) return;

  const state = getState();
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
          ${items.map(item => {
            const hasBreakdown = Array.isArray(item.recipeBreakdown) && item.recipeBreakdown.length > 0;
            return `
              <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;gap:6px;background:${item.isChecked ? '#f8fafc' : '#fff'};opacity:${item.isChecked ? '0.7' : '1'};">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                  <div style="display:flex;align-items:center;gap:12px;flex:1;">
                    <input type="checkbox" id="shop-item-cb-${escapeAttr(item.id)}" name="shop_item_cb_${escapeAttr(item.id)}" aria-label="Toggle ${escapeAttr(item.name)}" data-action="toggle-shop-item" data-id="${escapeAttr(item.id)}" ${item.isChecked ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb;" />
                    <div style="display:flex;flex-direction:column;min-width:0;">
                      <div style="font-weight:600;font-size:14px;color:#1e293b;text-decoration:${item.isChecked ? 'line-through' : 'none'};display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span>${escapeHtml(item.name)}</span>
                        <span style="font-weight:700;color:#0969da;font-size:13px;">${escapeHtml(item.requiredQty)}${escapeHtml(item.unit)}</span>
                      </div>
                      <div style="font-size:11.5px;color:#64748b;margin-top:2px;">
                        Buy: ${escapeHtml(item.buyQty)}${escapeHtml(item.unit)} &bull; In stock: ${escapeHtml(item.inStockQty)}${escapeHtml(item.unit)} ${item.isManualAdd ? '&bull; (Manual)' : ''}
                      </div>
                      ${hasBreakdown ? `
                        <button type="button" class="btn sm ghost btn-recipe-breakdown" data-action="toggle-breakdown" data-item-id="${escapeAttr(item.id)}" style="font-size:11px;padding:2px 6px;margin-top:4px;align-self:flex-start;color:#2563eb;">
                          ▼ Recipe Breakdown
                        </button>
                      ` : ''}
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    <input type="number" step="any" id="shop-item-qty-${escapeAttr(item.id)}" name="shop_item_qty_${escapeAttr(item.id)}" aria-label="Quantity for ${escapeAttr(item.name)}" class="shop-item-qty-input" data-id="${escapeAttr(item.id)}" value="${item.buyQty}" style="width:65px;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" />
                    <span style="font-size:11px;color:#64748b;">${escapeHtml(item.unit)}</span>
                    <button type="button" class="btn sm ghost" data-action="swap-product" data-item-id="${escapeAttr(item.id)}" data-item-name="${escapeAttr(item.name)}" style="font-size:11px;padding:4px 8px;">Swap Product ▾</button>
                  </div>
                </div>
                ${hasBreakdown ? `
                  <div id="breakdown-drawer-${escapeAttr(item.id)}" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-top:4px;flex-direction:column;gap:4px;">
                    <div style="font-weight:700;color:#334155;margin-bottom:2px;font-size:11px;text-transform:uppercase;letter-spacing:0.03em;">Recipe Usage Breakdown:</div>
                    ${item.recipeBreakdown.map(b => `
                      <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #edf2f7;font-size:12px;color:#1e293b;">
                        <span>Day ${b.day} (${b.mealType}): <strong>${escapeHtml(b.recipeName)}</strong> (${b.serves} serves)</span>
                        <span style="font-weight:600;color:#0969da;">${b.qty}${escapeHtml(item.unit)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });
  contentContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;"> 
      ${aislesHtml || `
        <div style="padding:40px;text-align:center;color:#64748b;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <div style="font-size:16px;font-weight:700;margin-bottom:6px;">Your shopping list is empty</div>
          <div style="font-size:13px;">Click "Generate from Plan" above to consolidate requirements based on your active meal plan and pantry stock.</div>
        </div>
      `}
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:6px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#334155;">+ Quick Add Custom Item</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="manual-item-name" placeholder="Item name" style="flex:1;min-width:150px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" />
          <input type="number" id="manual-item-qty" placeholder="Qty" style="width:60px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;" />
          <select id="manual-item-unit" style="padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;">
            <option value="item">item</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
          </select>
          <select id="manual-item-category" style="width:150px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#fff;">
            ${AISLE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <button type="button" id="btn-add-manual-item" class="btn secondary sm" style="font-size:12px;">Add</button>
        </div>
      </div>
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
        if (typeof showCustomAlert === 'function') showCustomAlert('Please enter a custom item name.');
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
  window.toggleShoppingItemBreakdown = function(itemId) {
    const el = document.getElementById(`breakdown-drawer-${itemId}`);
    const btn = document.getElementById(`breakdown-btn-${itemId}`);
    if (el) {
      const isHidden = el.style.display === 'none' || el.style.display === '';
      el.style.display = isHidden ? 'flex' : 'none';
      if (btn) {
        btn.textContent = isHidden ? '▲ Hide Breakdown' : '▼ Recipe Breakdown';
      }
    }
  };
}
