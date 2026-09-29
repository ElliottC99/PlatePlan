/**
 * src/components/shopping/ShoppingCategoryGroup.js (v3.8.1)
 * UI component for grouping shopping items by supermarket aisle/category,
 * rendering category containers, item counts, and cost subtotals.
 */

import { renderShoppingItemRow } from './ShoppingItemRow.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function groupShoppingItemsByCategory(items = []) {
  const categories = {};
  items.forEach(item => {
    const cat = item.cat || item.category || 'General';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });
  return categories;
}

export function renderShoppingCategoryGroup(categoryName, catItems = []) {
  const count = catItems.length;
  const catCost = catItems.reduce((sum, it) => sum + (it.isAtHome ? 0 : (Number(it.cost) || 0)), 0);
  const costSubtotal = catCost > 0 ? `<span style="font-size:12px;font-weight:600;color:var(--text2)">£${catCost.toFixed(2)}</span>` : '';

  return `
    <div class="card" style="padding:16px;background:var(--surface,#fff)">
      <div style="font-weight:750;font-size:14px;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <span>${escapeHtml(categoryName)}</span>
          <span style="background:var(--surface2,#f0f0f0);color:var(--text2);font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${count} item${count > 1 ? 's' : ''}</span>
        </div>
        ${costSubtotal}
      </div>
      <div style="display:flex;flex-direction:column;gap:1px;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA">
        ${catItems.map(item => renderShoppingItemRow(item)).join('')}
      </div>
    </div>
  `;
}

export function renderShoppingCategoriesList(items = []) {
  const categories = groupShoppingItemsByCategory(items);
  const entries = Object.entries(categories);
  if (!entries.length) {
    return `<div class="card" style="padding:24px;text-align:center;color:var(--text3)">No items in the shopping list.</div>`;
  }
  return `
    <div style="display:flex;flex-direction:column;gap:14px">
      ${entries.map(([cat, catItems]) => renderShoppingCategoryGroup(cat, catItems)).join('')}
    </div>
  `;
}
