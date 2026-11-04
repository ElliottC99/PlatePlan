/**
 * src/components/shopping/ShoppingCategoryGroup.js (v3.8.2)
 * Apple HIG Compliant UI component for grouping shopping items by supermarket aisle/category.
 * Renders inside Apple Inset Grouped sections.
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
  const costSubtotal = catCost > 0 ? `<span style="font-size:12px; font-weight:600; color:var(--secondary-label);">£${catCost.toFixed(2)}</span>` : '';

  return `
    <div class="ios-grouped-section" style="margin: 0 0 16px 0;">
      <div class="ios-section-header" style="display:flex; justify-content:space-between; align-items:center;">
        <span>${escapeHtml(categoryName)} (${count})</span>
        ${costSubtotal}
      </div>
      <div class="ios-grouped-card">
        ${catItems.map(item => renderShoppingItemRow(item)).join('')}
      </div>
    </div>
  `;
}

export function renderShoppingCategoriesList(items = []) {
  const categories = groupShoppingItemsByCategory(items);
  const entries = Object.entries(categories);
  if (!entries.length) {
    return `
      <div class="ios-grouped-card" style="padding: 32px 16px; text-align: center; margin: 16px 0;">
        <div style="font-size: 28px; margin-bottom: 8px;">🛒</div>
        <div class="ios-headline" style="color:var(--label); margin-bottom: 4px;">Shopping List Empty</div>
        <div style="font-size: 13px; color: var(--secondary-label);">No items needed for this meal plan.</div>
      </div>
    `;
  }
  return `
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${entries.map(([cat, catItems]) => renderShoppingCategoryGroup(cat, catItems)).join('')}
    </div>
  `;
}
