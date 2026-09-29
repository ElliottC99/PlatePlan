/**
 * src/components/shopping/ShoppingBatchToolbar.js (v3.8.1)
 * UI component for shopping list batch action toolbar, aisle filters,
 * export formatters, and checked-item clearance.
 */

import { renderShoppingCategoriesList } from './ShoppingCategoryGroup.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function renderShoppingBatchToolbar({ totalCost = 0, items = [], onBack = 'setPlannerWizardStep(2)', onCommit = 'commitPlannerWizardPlan()' } = {}) {
  const totalItems = items.length;
  const toBuyItems = items.filter(x => !x.isAtHome);
  const atHomeItems = items.filter(x => !!x.isAtHome);

  return `
    <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700">Step 3: Shopping List &amp; Substitutions</h2>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">
          Total Estimated Cost: <strong style="color:var(--action,#0969da)">£${totalCost.toFixed(2)}</strong> (${toBuyItems.length} items to buy${atHomeItems.length ? `, ${atHomeItems.length} marked at home` : ''})
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn ghost sm" onclick="${onBack}">← Back to Plan</button>
        <button type="button" class="btn ghost sm" onclick="exportShoppingListToClipboard()">📋 Copy List</button>
        <button type="button" class="btn primary sm" style="font-weight:700" onclick="${onCommit}">✓ Save Shopping List &amp; Commit Plan →</button>
      </div>
    </div>
  `;
}

export function exportShoppingListToText(items = []) {
  if (!items.length) return 'PlatePlan Shopping List: (Empty)';
  let out = '🛒 PlatePlan Shopping List\n';
  const categories = {};
  items.forEach(item => {
    const cat = item.cat || item.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });

  Object.entries(categories).forEach(([cat, catItems]) => {
    out += `\n[ ${cat} ]\n`;
    catItems.forEach(item => {
      const status = item.isAtHome ? '[x]' : '[ ]';
      const qty = item.needUnit === 'item' ? `${item.needQty} item${item.needQty > 1 ? 's' : ''}` : `${Math.round(item.grams || 0)}g`;
      const brand = item.bankIng?.brand ? ` (${item.bankIng.brand})` : '';
      const price = item.cost > 0 ? ` - £${item.cost.toFixed(2)}` : '';
      out += `${status} ${item.name}${brand} - ${qty}${price}\n`;
    });
  });
  return out;
}

export function clearCheckedShoppingItems(state) {
  if (!state?.plan) return;
  state.plan.shoppingAtHome = {};
  if (typeof window.saveState === 'function') window.saveState();
  if (typeof window.renderShopping === 'function') window.renderShopping();
  if (typeof window.renderPlannerWizard === 'function') window.renderPlannerWizard();
  if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Cleared checked shopping items.');
}

export function exportShoppingListToClipboard() {
  const plan = window.state?.plan;
  const { items = [] } = window.computeWizardShoppingAgg ? window.computeWizardShoppingAgg(plan) : { items: [] };
  const text = exportShoppingListToText(items);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Shopping list copied to clipboard! 📋');
    }).catch(() => {
      prompt('Copy your shopping list:', text);
    });
  } else {
    prompt('Copy your shopping list:', text);
  }
}
