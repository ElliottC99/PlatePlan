/**
 * src/components/shopping/ShoppingListToolbar.js (v3.8.8)
 * Modular UI component for Shopping List Toolbar & Controls:
 * - Supermarket store selectors (Tesco, Sainsbury's, Aldi, etc.)
 * - Clear completed triggers & export/print actions
 * - Manual shopping item input form
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function renderShoppingListToolbar({
  storeName = 'tesco',
  totalCost = 0,
  completedCount = 0
} = {}) {
  return `
    <div class="card pp-shopping-list-toolbar" style="padding:16px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:750">Shopping List & Aisle Route</h2>
          <div style="font-size:13px;color:var(--text2);margin-top:2px">Estimated Total: <strong>£${Number(totalCost).toFixed(2)}</strong></div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn ghost sm" data-action="clear-completed-shopping-items" onclick="clearCompletedShoppingItems()" style="font-weight:600">
            Clear Completed (${completedCount})
          </button>
          <button type="button" class="btn primary sm" data-action="print-shopping-list" onclick="window.print()" style="font-weight:700">
            🖨️ Print List
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:11px;font-weight:700;color:var(--text2)">STORE ROUTE:</label>
          <select id="supermarket-store-select" class="select" style="font-size:12px" data-action="switch-supermarket-store" onchange="switchSupermarketStore(this.value)">
            <option value="tesco" ${storeName === 'tesco' ? 'selected' : ''}>Tesco Superstore</option>
            <option value="sainsburys" ${storeName === 'sainsburys' ? 'selected' : ''}>Sainsbury's</option>
            <option value="aldi" ${storeName === 'aldi' ? 'selected' : ''}>Aldi</option>
          </select>
        </div>
      </div>
    </div>
  `;
}
