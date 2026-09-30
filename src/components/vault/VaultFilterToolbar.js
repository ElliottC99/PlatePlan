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
          <label for="vault-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search recipes</label>
          <input type="text" id="vault-search" name="vaultSearch" aria-label="Search recipes" class="input" style="width:100%" placeholder="Search recipes by name, ingredient, or tag..." value="${escapeHtml(searchVal)}" oninput="renderVault()">
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button type="button" id="vault-filter-fav" class="btn ghost sm ${isFavOnly ? 'active' : ''}" data-action="toggle-favourites-filter" onclick="toggleVaultFavouritesFilter()" style="font-weight:600">
            ❤️ Favourites ${isFavOnly ? '(Active)' : ''}
          </button>
          <span style="font-size:12px;color:var(--text2);font-weight:600">${totalCount} recipes</span>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:nowrap;overflow-x:auto;">
        <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto;white-space:nowrap;">
          <label for="filter-type" style="font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">MEAL:</label>
          <select id="filter-type" name="filterType" aria-label="Filter by meal type" class="select" style="font-size:12px;white-space:nowrap;" onchange="renderVault()">
            <option value="all" ${selectedType === 'all' ? 'selected' : ''}>All Meals</option>
            <option value="breakfast" ${selectedType === 'breakfast' ? 'selected' : ''}>Breakfast</option>
            <option value="lunch" ${selectedType === 'lunch' ? 'selected' : ''}>Lunch</option>
            <option value="dinner" ${selectedType === 'dinner' ? 'selected' : ''}>Dinner</option>
            <option value="snack" ${selectedType === 'snack' ? 'selected' : ''}>Snack</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto;white-space:nowrap;">
          <label for="filter-who" style="font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">WHO:</label>
          <select id="filter-who" name="filterWho" aria-label="Filter by person" class="select" style="font-size:12px;white-space:nowrap;" onchange="renderVault()">
            <option value="all" ${selectedWho === 'all' ? 'selected' : ''}>Everyone</option>
            <option value="elliott" ${selectedWho === 'elliott' ? 'selected' : ''}>Elliott</option>
            <option value="chloe" ${selectedWho === 'chloe' ? 'selected' : ''}>Chloe</option>
            <option value="both" ${selectedWho === 'both' ? 'selected' : ''}>Shared</option>
          </select>
        </div>

        <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto;white-space:nowrap;">
          <label for="vault-sort" style="font-size:11px;font-weight:700;color:var(--text2);cursor:pointer">SORT:</label>
          <select id="vault-sort" name="vaultSort" aria-label="Sort options" class="select" style="font-size:12px;white-space:nowrap;" onchange="handleVaultSortChange(this.value)">
            <option value="fit-desc" ${sortBy === 'fit-desc' ? 'selected' : ''}>Fit Score: High to Low</option>
            <option value="fit-asc" ${sortBy === 'fit-asc' ? 'selected' : ''}>Fit Score: Low to High</option>
            <option value="name-asc" ${sortBy === 'name-asc' ? 'selected' : ''}>Name: A to Z</option>
            <option value="name-desc" ${sortBy === 'name-desc' ? 'selected' : ''}>Name: Z to A</option>
          </select>
        </div>
      </div>
    </div>
  `;
}
