/**
 * src/components/pantry/PantryStockToolbar.js (v3.9.4)
 * Modular ES6 component for Pantry Stock control toolbar.
 * - Handles stock search filters
 * - Storage zone dropdown filters
 * - "Add Item" triggers and zero-waste recipe link elements
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

/**
 * Renders the pantry inventory toolbar.
 * @param {Object} state Toolbar state variables
 * @returns {string} HTML template literal
 */
export function renderPantryStockToolbar(state = {}) {
  const query = state.searchQuery || '';
  const activeZone = state.selectedZone || 'all';

  return `
    <div class="card pantry-stock-toolbar" style="margin-bottom:16px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <!-- Search and Filters -->
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:280px;flex-wrap:wrap">
          <input type="text" id="pantry-search-input" value="${escapeHtml(query)}" placeholder="Search stock (e.g. Garlic, Eggs)..." style="flex:1;min-width:180px;padding:8px 12px;font-size:13px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)" oninput="handlePantrySearchFilter()">
          
          <select id="pantry-zone-select" style="padding:8px 12px;font-size:13px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);outline:none;font-weight:600" onchange="handlePantryZoneChange()">
            <option value="all" ${activeZone === 'all' ? 'selected' : ''}>All Storage Zones</option>
            <option value="fridge" ${activeZone === 'fridge' ? 'selected' : ''}>Fridge Only</option>
            <option value="freezer" ${activeZone === 'freezer' ? 'selected' : ''}>Freezer Only</option>
            <option value="pantry" ${activeZone === 'pantry' ? 'selected' : ''}>Pantry Only</option>
          </select>
        </div>

        <!-- Toolbar Actions -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <button class="btn sm ghost" type="button" onclick="triggerZeroWasteRecipes()" style="font-size:12px;font-weight:700">
            🍲 Zero-Waste Recipes
          </button>
          <button class="btn sm primary" type="button" onclick="openAddPantryStockModal()" style="font-size:12px;font-weight:700">
            + Add Stock Item
          </button>
        </div>
      </div>
    </div>
  `;
}
