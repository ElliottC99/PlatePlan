/**
 * src/components/pantry/ReallocateProductModalRenderService.js (v3.38.74)
 * Pure template generation service for the Reallocate Product Modal.
 * Isolates HTML string building from the main controller.
 */

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

/**
 * Renders the base shell of the reallocation modal.
 */
export function renderReallocateModalBase(prod) {
  return `
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin:0 0 6px 0; font-size: 1.15rem; font-weight: 750;">📦 Reallocate Product: ${escapeHtml(prod.name)}</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 14px 0;">Search and select the target parent ingredient and optional sub-type.</p>

      <!-- 1. Searchable Ingredient Filter -->
      <div class="field" style="margin-bottom: 14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label style="font-weight: 600; font-size: 0.85rem;">1. Target Ingredient</label>
          <button type="button" class="btn xs ghost" id="btn-toggle-create-ing" onclick="toggleCreateIngredientBox()" style="color:var(--primary,#4f46e5); font-weight:600; font-size:11.5px;">➕ Create New Ingredient</button>
        </div>

        <!-- Stacked Column Layout: Create New Ingredient Sub-panel -->
        <div id="create-ingredient-box" class="subpanel-card" style="display: none; background: var(--system-grouped-bg, #f2f2f7); padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid rgba(0,0,0,0.08);">
          <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">Create New Ingredient</h4>
          <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <label for="new-reallocate-ingredient-name" style="font-size: 12px; font-weight: 600; color: #666;">Ingredient Name</label>
              <input type="text" id="new-reallocate-ingredient-name" placeholder="e.g. Granulated Sugar" style="width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; box-sizing: border-box;" name="new-reallocate-ingredient-name" />
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <label for="new-reallocate-ingredient-category" style="font-size: 12px; font-weight: 600; color: #666;">Category</label>
              <input type="text" id="new-reallocate-ingredient-category" list="reallocate-categories-datalist" placeholder="Search existing or type new category..." style="width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; box-sizing: border-box;" name="new-reallocate-ingredient-category" />
              <datalist id="reallocate-categories-datalist"></datalist>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
              <button type="button" onclick="toggleCreateIngredientBox(false)" style="min-height: 44px; padding: 0 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; font-weight: 500; cursor: pointer;">Cancel</button>
              <button type="button" onclick="submitCreateNewIngredientFromReallocate()" style="min-height: 44px; padding: 0 16px; border-radius: 8px; border: none; background: #007aff; color: #fff; font-weight: 600; cursor: pointer;">Add Ingredient</button>
            </div>
          </div>
        </div>

        <input type="text" id="realloc-ing-search" class="input" placeholder="🔍 Type ingredient or category name..." style="width:100%; min-height:44px; padding:0 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:14px; box-sizing:border-box;" name="realloc-ing-search" />
        <div id="realloc-ing-results" style="margin-top:6px; max-height:140px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:8px; background:var(--surface2,#f5f5f4); padding:4px;"></div>
      </div>

      <!-- 2. Searchable Sub-type Filter -->
      <div class="field" style="margin-bottom: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label style="font-weight: 600; font-size: 0.85rem;">2. Target Sub-type (Optional)</label>
          <button type="button" class="btn xs ghost" id="btn-toggle-create-sub" style="color:var(--primary,#4f46e5); font-weight:600; font-size:11.5px;">➕ Create New Sub-type</button>
        </div>
        <div id="realloc-create-sub-panel" style="display:none; padding:12px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom:8px;">
          <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Create Sub-type for Selected Ingredient</div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input type="text" id="new-sub-name-input" placeholder="Sub-type name (e.g. Sourdough)..." style="flex:1; min-height:40px; padding:0 10px; border:1px solid var(--border); border-radius:6px; font-size:13px; box-sizing:border-box;" name="new-sub-name-input" />
          </div>
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button type="button" class="btn xs ghost" id="btn-cancel-create-sub" style="min-height:36px; padding:0 12px;">Cancel</button>
            <button type="button" class="btn xs primary" id="btn-save-create-sub" style="min-height:36px; padding:0 12px;">Add Sub-type</button>
          </div>
        </div>
        <input type="text" id="realloc-sub-search" class="input" placeholder="🔍 Filter sub-types..." style="width:100%; min-height:44px; padding:0 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:14px; box-sizing:border-box;" name="realloc-sub-search" />
        <div id="realloc-sub-results" style="margin-top:6px; max-height:120px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:8px; background:var(--surface2,#f5f5f4); padding:4px;"></div>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary secondary" style="min-height:44px; padding:0 16px;" data-action="close-pantry-dialog">Cancel</button>
        <button type="button" class="btn btn-primary primary" style="min-height:44px; padding:0 16px;" id="btn-confirm-realloc">Reallocate Product</button>
      </div>
    </div>
  `;
}

/**
 * Renders the list of sub-types for a specific ingredient.
 */
export function renderSubtypeListItems(subtypes, selectedSubId, parentIngName = 'Ingredient') {
  const isTopLevelSelected = !selectedSubId;
  
  let itemsHtml = `
    <div class="realloc-sub-option" data-id="" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isTopLevelSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isTopLevelSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isTopLevelSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
      <span style="font-size:12.5px; font-weight:650;">None (Top-level ${escapeHtml(parentIngName)})</span>
    </div>
  `;

  subtypes.forEach(s => {
    const isSelected = String(s.id) === String(selectedSubId);
    itemsHtml += `
      <div class="realloc-sub-option" data-id="${escapeAttr(s.id)}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
        <span style="font-size:12.5px; font-weight:650;">${escapeHtml(s.name)}</span>
      </div>
    `;
  });

  return itemsHtml;
}

/**
 * Renders the list of matching ingredients for the selection results.
 */
export function renderIngredientListItems(ingredients, selectedIngId) {
  if (!ingredients.length) {
    return `<div style="padding:10px; font-size:12px; color:var(--text3,#a8a29e); text-align:center;">No matching ingredients found.</div>`;
  }

  return ingredients.map(i => {
    const isSelected = String(i.id) === String(selectedIngId);
    return `
      <div class="realloc-ing-option" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
        <span style="font-size:12.5px; font-weight:650;">${escapeHtml(i.name)}</span>
        <span style="font-size:11px; opacity:0.85;">${escapeHtml(i.category || 'General')}</span>
      </div>
    `;
  }).join('');
}
