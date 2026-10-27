/**
 * src/components/pantry/PantryCategoryGroup.js (v3.8.7)
 * Modular UI component for Pantry Category Grouping:
 * - Category grouping headers & stock count indicators
 * - Accordion expand/collapse container logic for pantry inventory
 */

import { renderPantryItemRow } from './PantryItemRow.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function renderPantryCategoryGroup(categoryName = 'Uncategorized', items = []) {
  if (!items || items.length === 0) return '';

  const rows = items.map(item => renderPantryItemRow(item)).join('');

  return `
    <div class="pantry-category-group" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">
        <h3 style="margin:0;font-size:14px;font-weight:750;color:var(--text)">${escapeHtml(categoryName)}</h3>
        <span class="tag" style="background:var(--surface2);color:var(--text2);font-weight:600">${items.length} item${items.length === 1 ? '' : 's'}</span>
      </div>
      <div class="pantry-category-items">
        ${rows}
      </div>
    </div>
  `;
}
