/**
 * src/views/SubtypeModalRenderService.js (v3.38.57)
 * Pure DOM template literal factories and HTML structure builders for Sub-type action modals.
 * Completely decoupled from Firebase, database operations, and state mutations.
 */

export const escapeHTML = (str) =>
  String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

/**
 * Builds HTML option elements for sub-type siblings dropdown.
 */
export function buildSubtypeDropdownOptions(subtypes = [], selectedId = '') {
  if (!Array.isArray(subtypes) || subtypes.length === 0) {
    return '<option value="">No siblings available</option>';
  }
  return subtypes.map(s => {
    const isSelected = String(s.id) === String(selectedId) ? ' selected' : '';
    return `<option value="${escapeHTML(s.id)}"${isSelected}>${escapeHTML(s.name)}</option>`;
  }).join('');
}

/**
 * Builds HTML option elements for target parent ingredients dropdown.
 */
export function buildParentIngredientDropdownOptions(parents = [], selectedId = '') {
  if (!Array.isArray(parents) || parents.length === 0) {
    return '<option value="">No parent ingredients available</option>';
  }
  return parents.map(p => {
    const isSelected = String(p.id) === String(selectedId) ? ' selected' : '';
    const catLabel = p.category ? ` (${escapeHTML(p.category)})` : '';
    return `<option value="${escapeHTML(p.id)}"${isSelected}>${escapeHTML(p.name)}${catLabel}</option>`;
  }).join('');
}

/**
 * Builds HTML string for Edit Sub-type modal.
 */
export function renderEditSubtypeModalHTML({ sub, parentId, subtypeId, linkedProds = [], formatBrandProductLabel }) {
  const safeFormat = typeof formatBrandProductLabel === 'function'
    ? formatBrandProductLabel
    : (p) => p.name || 'Unnamed Product';

  return `
    <div class="modal-content" data-modal-type="edit-subtype" data-subtype-id="${escapeHTML(subtypeId)}" data-parent-id="${escapeHTML(parentId)}" style="padding: 20px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 16px; font-size: 1.15rem; font-weight: 750;">📝 Edit Sub-type: ${escapeHTML(sub.name)}</h3>
      
      <div class="field" style="margin-bottom: 12px;">
        <label for="edit-sub-name" style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Sub-type Name</label>
        <input type="text" id="edit-sub-name" class="input" value="${escapeHTML(sub.name)}" style="width:100%;" name="edit-sub-name" />
      </div>

      <div class="field" style="margin-bottom: 16px;">
        <label for="edit-sub-notes" style="font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px;">Notes</label>
        <textarea id="edit-sub-notes" class="input" style="width:100%; min-height: 70px;" name="edit-sub-notes">${escapeHTML(sub.notes || '')}</textarea>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 0.85rem; font-weight: 750; margin: 0 0 8px 0;">Linked Products (${linkedProds.length})</h4>
        <div style="display:flex; flex-direction:column; gap:6px; max-height:140px; overflow-y:auto; background:var(--surface2,#f5f5f4); padding:8px; border-radius:8px;">
          ${linkedProds.map(p => `
            <div style="font-size:12px; display:flex; justify-content:space-between; align-items:center; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid var(--border,#e7e5e4)">
              <div>
                <span style="font-weight:600;">${escapeHTML(safeFormat(p))}</span>
              </div>
              <button type="button" class="btn xs ghost btn-unlink-prod" data-prod-id="${escapeHTML(p.id)}" style="color:var(--red,#ef4444); font-weight:bold;" title="Unlink product">&times; Unlink</button>
            </div>
          `).join('') || '<div style="font-size:12px; color:var(--text2); text-align:center; padding:10px 0;">No products linked yet.</div>'}
        </div>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn btn-cancel-edit-sub" id="btn-cancel-edit-sub">Cancel</button>
        <button type="button" class="btn primary" id="save-edit-sub-btn">Save Changes</button>
      </div>
    </div>
  `;
}

/**
 * Builds HTML string for Reorganize (Promote, Move, Merge) modal.
 */
export function renderReorganizeModalHTML({ sub, parent, targetParents = [], siblingSubtypes = [] }) {
  return `
    <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
      <h3 style="margin-top:0; margin-bottom: 16px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganise: ${escapeHTML(sub.name)}</h3>
      
      <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; background: #f8fafc;">
        <div style="font-weight: 750; font-size: 13px; display:flex; align-items:center; justify-content:space-between">
          <span>🚀 Option A: Promote to Standalone Ingredient</span>
          <button type="button" class="btn primary sm" id="btn-reorg-promote" style="font-weight:600">Promote</button>
        </div>
        <p style="margin:4px 0 0 0; font-size:11px; color:var(--text2)">Ejects this sub-type from parent "${escapeHTML(parent.name)}" into a standalone card.</p>
      </div>

      <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; background: #f8fafc;">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">📦 Option B: Move to another Parent Ingredient</div>
        <div style="display:flex; gap:8px;">
          <input type="text" list="pantry-items-list" id="reorg-move-select" style="flex:1; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:13px; background:var(--surface,#fff); outline:none;" placeholder="Search or select parent ingredient..." name="reorgMoveSelect">
          <datalist id="pantry-items-list">
            ${buildParentIngredientDropdownOptions(targetParents)}
          </datalist>
          <button type="button" class="btn primary sm" id="btn-reorg-move" style="font-weight:600">Move</button>
        </div>
      </div>

      <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 20px; background: #f8fafc;">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 6px;">🔀 Option C: Merge into another Sub-type sibling</div>
        <div style="display:flex; gap:8px;">
          <input type="text" list="pantry-items-list-sibling" id="reorg-merge-select" style="flex:1; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:13px; background:var(--surface,#fff); outline:none;" placeholder="Search or select sibling..." ${siblingSubtypes.length === 0 ? 'disabled' : ''} name="reorgMergeSelect">
          <datalist id="pantry-items-list-sibling">
            ${buildSubtypeDropdownOptions(siblingSubtypes)}
          </datalist>
          <button type="button" class="btn primary sm" id="btn-reorg-merge" style="font-weight:600" ${siblingSubtypes.length === 0 ? 'disabled' : ''}>Merge</button>
        </div>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn ghost sm" id="btn-reorg-cancel" style="font-weight:600">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Builds HTML string for Manage Aliases modal.
 */
export function renderManageAliasesModalHTML({ sub, aliases = [] }) {
  return `
    <div style="padding: 20px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🏷️ Manage Aliases: ${escapeHTML(sub.name)}</h3>
      
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 16px; padding: 10px; background: var(--surface2,#f5f5f4); border-radius:8px; min-height: 50px;" id="alias-chips-container">
        ${aliases.map(a => `
          <span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--border,#e7e5e4); display: flex; align-items: center; gap: 4px;">
            ${escapeHTML(a)}
            <button type="button" class="btn-remove-sub-alias" data-alias="${escapeHTML(a)}" style="background:none; border:none; cursor:pointer; font-weight:bold; color:var(--red,#ef4444); padding:0 2px; line-height:1;" title="Remove alias">&times;</button>
          </span>
        `).join('') || '<span style="font-size:12px; color:var(--text2); font-style:italic; padding:6px 0;">No aliases defined yet</span>'}
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 20px;">
        <label for="new-alias-input" style="display:none;">Add New Alias</label>
        <input type="text" id="new-alias-input" placeholder="e.g. Sourdough loaf" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size: 12px;" name="new-alias-input" />
        <button type="button" class="btn primary sm" id="btn-add-alias">Add Alias</button>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" id="btn-close-aliases">Close</button>
      </div>
    </div>
  `;
}

/**
 * Builds HTML string for Delete Sub-type confirmation modal.
 */
export function renderDeleteSubtypeModalHTML({ sub, parentId, subtypeId }) {
  return `
    <div class="modal-content" data-modal-type="delete-subtype" data-subtype-id="${escapeHTML(subtypeId)}" data-parent-id="${escapeHTML(parentId)}" style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Sub-type?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHTML(sub.name)}"</strong>? <br /><span style="font-size:12px; color:var(--text2);">Linked products will remain in your Product Bank but will be unlinked.</span>
      </p>
      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn btn-cancel-delete" id="btn-cancel-sub-delete" style="padding: 8px 16px;">Cancel</button>
        <button type="button" class="btn danger btn-confirm-delete" id="btn-confirm-sub-delete" style="padding: 8px 16px;">Confirm Delete</button>
      </div>
    </div>
  `;
}
