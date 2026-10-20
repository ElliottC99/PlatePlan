/**
 * src/components/pantry/CategoryManagerTemplates.js (v3.35.40)
 * Pure Template Builder Functions for Category Manager Modal UI.
 */

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export { escapeHtml, escapeAttr };

export function renderListStepHtml(catObjects, ingredients, state) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🏷️</span><h3 style="margin:0;font-size:16px;font-weight:750">Category Manager</h3></div>
      <button type="button" class="modal-close-btn btn sm btn-ghost ghost" data-action="close" aria-label="Close modal">✕</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span style="font-size:12px;color:var(--text2,#78716c)">${catObjects.length} raw database entries</span>
      <button id="btn-merge-duplicates" type="button" class="btn xs btn-secondary secondary" data-action="merge-duplicates" title="Deduplicate and standardise category names across database">✨ Merge Duplicates</button>
    </div>
    <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      ${catObjects.map(cat => {
        const catName = (cat.name || '').trim();
        const ingCount = ingredients.filter(i => (i.category || '').trim() === catName).length;
        const subCount = ingredients.flatMap(i => Array.isArray(i.subtypes) ? i.subtypes : []).filter(s => (s.category || '').trim() === catName).length;
        const prodCount = (state.products || []).filter(p => (p.category || '').trim() === catName).length;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2,#f5f5f4);border-radius:var(--radius-md,10px);border:1px solid var(--border,#e7e5e4)">
          <div><span style="font-size:13px;font-weight:650">${escapeHtml(cat.name)}</span><span style="font-size:11px;color:var(--text2,#78716c);margin-left:6px">(${ingCount} Items, ${subCount} Sub-types, ${prodCount} Products)</span></div>
          <div style="display:flex;gap:4px">
            <button type="button" class="btn xs btn-ghost ghost" data-action="start-rename" data-category="${escapeAttr(cat.name)}">Rename</button>
            <button type="button" class="btn xs btn-ghost ghost" data-action="start-merge" data-category="${escapeAttr(cat.name)}">Merge</button>
            <button type="button" class="btn xs btn-ghost ghost" style="color:var(--red,#ef4444)" data-action="prompt-delete" data-category="${escapeAttr(cat.name)}">Delete</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <input type="text" id="cat-manager-add-input" name="cat_manager_add_input" placeholder="New category name..." aria-label="New category name" style="flex:1;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13px">
      <button id="btn-submit-add-cat" type="button" class="btn btn-primary primary sm" data-action="submit-add">+ Add</button>
    </div>`;
}

export function renderRenameStepHtml(activeCat) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
      <h3 style="margin:0;font-size:15px;font-weight:750">Rename "${escapeHtml(activeCat)}"</h3>
      <button type="button" class="modal-close-btn btn sm btn-ghost ghost" data-action="close" aria-label="Close modal">✕</button>
    </div>
    <div style="margin-bottom:16px">
      <label for="cat-rename-input" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">New Category Name</label>
      <input type="text" id="cat-rename-input" name="cat_rename_input" value="${escapeAttr(activeCat)}" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13.5px;box-sizing:border-box">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button type="button" class="btn btn-ghost ghost sm" data-action="nav-step" data-step="list">Back</button>
      <button id="btn-submit-rename-cat" type="button" class="btn btn-primary primary sm" data-action="submit-rename">Apply Rename</button>
    </div>`;
}

export function renderMergeStepHtml(activeCat) {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
      <h3 style="margin:0;font-size:15px;font-weight:750">Merge "${escapeHtml(activeCat)}"</h3>
      <button type="button" class="modal-close-btn btn sm btn-ghost ghost" data-action="close" aria-label="Close modal">✕</button>
    </div>
    <div style="margin-bottom:16px">
      <label for="cat-merge-search-input" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Select Target Destination Category</label>
      <div style="position:relative;">
        <input type="text" id="cat-merge-search-input" name="cat_merge_search_input" placeholder="Search target category..." autocomplete="off" data-action="merge-search-input" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13.5px;box-sizing:border-box">
        <div id="cat-merge-dropdown-list" style="position:absolute;top:100%;left:0;right:0;max-height:150px;overflow-y:auto;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);box-shadow:0 4px 12px rgba(0,0,0,0.08);z-index:9999;display:none;margin-top:4px;"></div>
      </div>
      <div id="cat-merge-validation-warning" style="display:none; color:var(--red,#ef4444); font-size:12.5px; font-weight:600; margin-top:8px; line-height:1.4;"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button type="button" class="btn btn-ghost ghost sm" data-action="nav-step" data-step="list">Back</button>
      <button id="btn-submit-merge-cat" type="button" class="btn btn-primary primary sm" data-action="submit-merge">Confirm Merge</button>
    </div>`;
}

export function renderReassignStepHtml(activeCat, reassignMode, allBound, otherCats, reassignSearch, massTargetCat, individualCatMap) {
  const filteredItems = allBound.filter(i => (i.name || i.title || '').toLowerCase().includes(reassignSearch.toLowerCase().trim()));
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
      <div>
        <h3 style="margin:0;font-size:15px;font-weight:750">Reassign Items (${allBound.length})</h3>
        <p style="margin:2px 0 0 0;font-size:11.5px;color:var(--text2,#78716c)">Reassign items before deleting "${escapeHtml(activeCat)}".</p>
      </div>
      <button type="button" class="modal-close-btn btn sm btn-ghost ghost" data-action="close" aria-label="Close modal">✕</button>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button type="button" class="btn xs ${reassignMode === 'mass' ? 'btn-primary primary' : 'btn-ghost ghost'}" data-action="set-reassign-mode" data-mode="mass">Mass Reassign</button>
      <button type="button" class="btn xs ${reassignMode === 'individual' ? 'btn-primary primary' : 'btn-ghost ghost'}" data-action="set-reassign-mode" data-mode="individual">Individual Sorting</button>
    </div>
    ${reassignMode === 'mass' ? `
      <div style="margin-bottom:16px">
        <label for="cat-mass-search-input" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Reassign all ${allBound.length} items to:</label>
        <div style="position:relative;">
          <input type="text" id="cat-mass-search-input" name="cat_mass_search_input" placeholder="Search target category..." value="${escapeAttr(massTargetCat)}" autocomplete="off" data-action="mass-search-input" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13.5px;box-sizing:border-box">
          <div id="cat-mass-dropdown-list" style="position:absolute;top:100%;left:0;right:0;max-height:150px;overflow-y:auto;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);box-shadow:0 4px 12px rgba(0,0,0,0.08);z-index:9999;display:none;margin-top:4px;"></div>
        </div>
      </div>` : `
      <div style="margin-bottom:8px">
        <input type="text" id="cat-reassign-filter" name="reassign_filter" aria-label="Filter items by name" placeholder="Filter items by name..." value="${escapeAttr(reassignSearch)}" data-action="reassign-filter-input" style="width:100%;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box">
      </div>
      <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
        ${filteredItems.map(item => {
          const currentSel = individualCatMap[item.id] || otherCats[0] || 'Uncategorised';
          const selId = `cat-select-${item.id}`;
          const labelText = item.name || item.title || 'Item';
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--surface2,#f5f5f4);border-radius:6px;border:1px solid var(--border,#e7e5e4)">
            <label for="${selId}" style="font-size:12px;font-weight:600;flex:1;margin-right:8px;word-break:break-word;">${escapeHtml(labelText)}</label>
            <input type="text" id="${selId}" list="cat-options-datalist" data-action="individual-cat-select" data-ing-id="${escapeAttr(item.id)}" value="${escapeAttr(currentSel)}" style="padding:4px 6px;font-size:11.5px;border:1px solid var(--border,#e7e5e4);border-radius:6px;background:var(--surface,#fff);width:140px;">
          </div>`;
        }).join('') || '<div style="font-size:12px;color:var(--text2,#78716c);padding:8px">No matching items found.</div>'}
        <datalist id="cat-options-datalist">
          ${otherCats.map(c => `<option value="${escapeAttr(c)}">`).join('')}
        </datalist>
      </div>`}
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button type="button" class="btn ghost sm" data-action="nav-step" data-step="list">Cancel</button>
      <button id="btn-submit-reassign-delete" type="button" class="btn primary sm" style="background:var(--red,#ef4444)" data-action="submit-reassign-delete">Reassign & Delete</button>
    </div>`;
}

export function renderDeleteConfirmModalHtml(categoryName, categoryId) {
  return `
    <div style="background:#ffffff; border-radius:16px; padding:20px; width:100%; max-width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; margin-bottom:10px; font-size:1.15rem; font-weight:750; color:var(--red,#ef4444);">Delete "${escapeHtml(categoryName)}"</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0; line-height:1.4">Are you sure you want to delete this category? This action is permanent.</p>
      <div style="display:flex; gap:8px; justify-content:flex-end">
        <button type="button" class="btn sm" data-action="close-delete-confirm">Cancel</button>
        <button type="button" class="btn sm primary" style="background:var(--red,#ef4444); color:#fff;" id="btn-confirm-delete-cat" data-action="confirm-delete" data-category="${escapeAttr(categoryId || categoryName)}">Delete</button>
      </div>
    </div>
  `;
}
