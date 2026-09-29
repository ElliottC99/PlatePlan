/**
 * src/components/pantry/PantryToolbar.js (v3.8.7)
 * Modular UI component for Pantry Inventory Toolbar:
 * - Inventory search inputs & category filter selects
 * - Add stock item triggers & shopping list sync actions
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function renderPantryToolbar({
  searchVal = '',
  selectedCategory = 'all',
  totalCount = 0
} = {}) {
  return `
    <div class="card pp-pantry-toolbar" style="padding:16px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <input type="text" id="pantry-search" class="input" style="width:100%" placeholder="Search pantry stock by name or category..." value="${escapeHtml(searchVal)}" oninput="renderIngredientBank()">
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn primary sm" onclick="openAddPantryStockModal()" style="font-weight:700">
            + Add Stock Item
          </button>
          <span style="font-size:12px;color:var(--text2);font-weight:600">${totalCount} stock items</span>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:11px;font-weight:700;color:var(--text2)">CATEGORY:</label>
          <select id="pantry-category-filter" class="select" style="font-size:12px" onchange="renderIngredientBank()">
            <option value="all" ${selectedCategory === 'all' ? 'selected' : ''}>All Categories</option>
            <option value="produce" ${selectedCategory === 'produce' ? 'selected' : ''}>Produce</option>
            <option value="dairy" ${selectedCategory === 'dairy' ? 'selected' : ''}>Dairy & Eggs</option>
            <option value="meat" ${selectedCategory === 'meat' ? 'selected' : ''}>Meat & Fish</option>
            <option value="pantry" ${selectedCategory === 'pantry' ? 'selected' : ''}>Store Cupboard</option>
            <option value="frozen" ${selectedCategory === 'frozen' ? 'selected' : ''}>Frozen</option>
          </select>
        </div>
      </div>
    </div>
  `;
}
