/**
 * src/components/shopping/ShoppingAisleGroup.js (v3.8.8)
 * Modular UI component for Supermarket Aisle Routing & Grouping:
 * - Store aisle grouping headers & route sequence badges
 * - Category item counters and aisle routing order
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

export function renderShoppingAisleGroup(aisleName = 'Aisle', items = [], aisleIndex = 1) {
  const count = items.length;
  const aisleCost = items.reduce((sum, it) => sum + (it.isAtHome ? 0 : (Number(it.cost) || 0)), 0);
  const costSubtotal = aisleCost > 0 ? `<span style="font-size:12px;font-weight:600;color:var(--text2)">£${aisleCost.toFixed(2)}</span>` : '';

  return `
    <div class="card pp-aisle-group" style="padding:16px;background:var(--surface,#fff);margin-bottom:12px">
      <div style="font-weight:750;font-size:14px;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="tag" style="background:var(--action);color:#fff;font-weight:700;padding:2px 6px;border-radius:6px">Aisle ${aisleIndex}</span>
          <span>${escapeHtml(aisleName)}</span>
          <span style="background:var(--surface2,#f0f0f0);color:var(--text2);font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;">${count} item${count > 1 ? 's' : ''}</span>
        </div>
        ${costSubtotal}
      </div>
      <div style="display:flex;flex-direction:column;gap:1px;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA">
        ${items.map(item => renderShoppingItemRow(item)).join('')}
      </div>
    </div>
  `;
}
