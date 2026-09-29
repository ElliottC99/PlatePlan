/**
 * src/components/vault/VaultFilterToolbar.js (v3.8.6)
 * Modular UI component for Recipe Vault Filter Toolbar:
 * - Recipe search inputs & debounce triggers
 * - Category filter pills & who filter selects
 * - Fit score sorting & favorite toggle button
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

export function renderVaultFilterToolbar({
  searchVal = '',
  selectedType = 'all',
  selectedWho = 'all',
  sortBy = 'name',
  isFavOnly = false,
  totalCount = 0
} = {}) {
  return `
    <div class="card pp-vault-filter-toolbar" style="padding:16px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <input type="text" id="vault-search" class="input" style="width:100%" placeholder="Search recipes by name, ingredient, or tag..." value="${escapeHtml(searchVal)}" oninput="renderVault()">
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" id="vault-filter-fav" class="btn ghost sm ${isFavOnly ? 'active' : ''}" data-action="toggle-favourites-filter" onclick="toggleVaultFavouritesFilter()" style="font-weight:600">
            ❤️ Favourites ${isFavOnly ? '(Active)' : ''}
          </button>
          <span style="font-size:12px;color:var(--text2);font-weight:600">${totalCount} recipes</span>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:11px;font-weight:700;color:var(--text2)">MEAL:</label>
          <select id="filter-type" class="select" style="font-size:12px" onchange="renderVault()">
            <option value="all" ${selectedType === 'all' ? 'selected' : ''}>All Meals</option>
            <option value="breakfast" ${selectedType === 'breakfast' ? 'selected' : ''}>Breakfast</option>
            <option value="lunch" ${selectedType === 'lunch' ? 'selected' : ''}>Lunch</option>
            <option value="dinner" ${selectedType === 'dinner' ? 'selected' : ''}>Dinner</option>
            <option value="snack" ${selectedType === 'snack' ? 'selected' : ''}>Snack</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:11px;font-weight:700;color:var(--text2)">WHO:</label>
          <select id="filter-who" class="select" style="font-size:12px" onchange="renderVault()">
            <option value="all" ${selectedWho === 'all' ? 'selected' : ''}>Everyone</option>
            <option value="elliott" ${selectedWho === 'elliott' ? 'selected' : ''}>Elliott</option>
            <option value="chloe" ${selectedWho === 'chloe' ? 'selected' : ''}>Chloe</option>
            <option value="both" ${selectedWho === 'both' ? 'selected' : ''}>Shared</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;gap:6px">
          <label style="font-size:11px;font-weight:700;color:var(--text2)">SORT:</label>
          <select id="vault-sort" class="select" style="font-size:12px" onchange="renderVault()">
            <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Recipe Name (A-Z)</option>
            <option value="fit" ${sortBy === 'fit' ? 'selected' : ''}>Macro Fit Score</option>
            <option value="protein" ${sortBy === 'protein' ? 'selected' : ''}>Protein (High-Low)</option>
            <option value="calories" ${sortBy === 'calories' ? 'selected' : ''}>Calories (Low-High)</option>
            <option value="time" ${sortBy === 'time' ? 'selected' : ''}>Prep Time</option>
          </select>
        </div>
      </div>
    </div>
  `;
}
