/**
 * src/components/pantry/PantryStockToolbar.js (v3.29.0)
 * Modular ES6 component for Pantry Stock control toolbar.
 * - Handles stock search filters
 * - Storage zone dropdown filters
 * - Use-Up filter toggle and "Add Stock Item" / "Browse Master Catalog" triggers
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

export function renderPantryStockToolbar(state = {}) {
  const query = state.searchQuery || '';
  const activeZone = state.selectedZone || 'all';
  const onlyUseUp = Boolean(state.onlyUseUp);

  return `
    <div class="card pantry-stock-toolbar" style="margin-bottom:16px;padding:14px 16px;border:1px solid var(--border,#e7e5e4);border-radius:12px;background:var(--surface,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:260px;flex-wrap:wrap">
          <label for="pantry-search-input" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search stock</label>
          <input type="search" id="pantry-search-input" name="pantryStockSearch" aria-label="Search stock" value="${escapeHtml(query)}" placeholder="Search active stock (e.g. Tofu, Milk, Garlic)..." style="flex:1;min-width:180px;padding:8px 12px;font-size:13px;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff);color:var(--text,#1c1917)" oninput="window.handlePantrySearchFilter(this.value)">
          
          <label for="pantry-zone-select" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Storage zones</label>
          <select id="pantry-zone-select" name="pantryZone" aria-label="Storage zones" style="padding:8px 12px;font-size:13px;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff);color:var(--text,#1c1917);outline:none;font-weight:600;width:auto" onchange="window.handlePantryZoneChange(this.value)">
            <option value="all" ${activeZone === 'all' ? 'selected' : ''}>All Storage Zones</option>
            <option value="fridge" ${activeZone === 'fridge' ? 'selected' : ''}>❄️ Fridge Only</option>
            <option value="freezer" ${activeZone === 'freezer' ? 'selected' : ''}>🧊 Freezer Only</option>
            <option value="cupboard" ${(activeZone === 'cupboard' || activeZone === 'pantry') ? 'selected' : ''}>🥫 Cupboard Only</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn sm ${onlyUseUp ? 'secondary' : 'ghost'}" type="button" onclick="window.togglePantryUseUpFilter()" style="font-size:12px;font-weight:700;${onlyUseUp ? 'background:#fef3c7;color:#b45309;border:1px solid #f59e0b;' : ''}">
            🔥 ${onlyUseUp ? 'Showing Use-Up Only' : 'Filter Use-Up'}
          </button>
          <button class="btn sm ghost" type="button" onclick="window.switchPantryTab('master-catalog')" style="font-size:12px;font-weight:700">
            🏛️ Master Catalog
          </button>
          <button class="btn sm primary" type="button" onclick="window.openAddPantryStockModal()" style="font-size:12px;font-weight:700">
            + Add Stock Item
          </button>
        </div>
      </div>
    </div>
  `;
}
