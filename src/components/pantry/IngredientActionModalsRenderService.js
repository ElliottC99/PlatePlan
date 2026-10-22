/**
 * src/components/pantry/IngredientActionModalsRenderService.js (v3.38.70)
 * Pure template generation service for Ingredient Action Modals.
 */

const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Renders the Manage Aliases modal content.
 */
export function renderAddAliasTemplate(ing, aliases) {
  return `
    <div style="padding: 20px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🏷️ Manage Aliases: ${escapeHTML(ing.name)}</h3>
      
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom: 16px; padding: 10px; background: var(--surface2,#f5f5f4); border-radius:8px; min-height: 50px;">
        ${aliases.map(a => `
          <span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; background: #fff; border: 1px solid var(--border,#e7e5e4); display: flex; align-items: center; gap: 4px;">
            ${escapeHTML(a)}
            <span style="cursor:pointer; font-weight:bold; color:var(--red,#ef4444);" onclick="window.handleIngredientAliasRemove('${escapeHTML(a)}')">&times;</span>
          </span>
        `).join('') || '<span style="font-size:12px; color:var(--text2); font-style:italic; padding:6px 0;">No aliases defined yet</span>'}
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 20px;">
        <input type="text" id="new-ing-alias-input" placeholder="e.g. Sourdough loaf" style="flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size: 12px;" name="new-ing-alias-input" />
        <button type="button" class="btn primary sm" id="btn-add-ing-alias">Add Alias</button>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Close</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Promote Sub-type confirmation modal.
 */
export function renderPromoteSubtypeTemplate() {
  return `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🚀</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750;">Promote Sub-type?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to promote this sub-type to a standalone Ingredient?
      </p>

      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" style="padding: 8px 16px;" id="btn-confirm-sub-promote">Confirm Promote</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Demote Ingredient to Sub-type modal.
 */
export function renderDemoteTemplate(candidates) {
  return `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">⬇️ Move Ingredient to Sub-type</h3>
      <p style="font-size: 13px; color: var(--text2); margin-bottom: 16px;">Select which parent ingredient you want to nest this under as a child sub-type.</p>

      <div style="display:flex; gap:8px; margin-bottom: 20px;">
        <select id="demote-parent-select" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px;" name="demote-parent-select">
          ${candidates.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('')}
        </select>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-confirm-demote">Set as Sub-type</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Merge Ingredient modal.
 */
export function renderMergeTemplate(candidates) {
  return `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 12px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">🔀 Merge Ingredient</h3>
      <p style="font-size: 13px; color: var(--text2); margin-bottom: 16px;">Select another ingredient to merge into. This will combine all aliases, sub-types, and products into the target.</p>

      <div style="display:flex; gap:8px; margin-bottom: 20px;">
        <select id="merge-target-select" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px;" name="merge-target-select">
          ${candidates.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('')}
        </select>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" id="btn-confirm-merge">Merge Ingredients</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Delete Ingredient confirmation modal.
 */
export function renderDeleteIngredientTemplate(targetName) {
  return `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Ingredient?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHTML(targetName)}"</strong>? <br />This will remove it from the pantry bank and clear all relationships.
      </p>

      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-ing-delete">Confirm Delete</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Delete Product confirmation modal.
 */
export function renderDeleteProductTemplate(targetName) {
  return `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🗑️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Product?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHTML(targetName)}"</strong> from your bank?
      </p>

      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-prod-delete">Confirm Delete</button>
      </div>
    </div>
  `;
}

/**
 * Renders a custom alert modal.
 */
export function renderCustomAlertTemplate(message) {
  return `
    <div style="padding: 24px; max-width: 400px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750;">Notification</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 20px 0; line-height: 1.5;">
        ${escapeHTML(message)}
      </p>
      <div style="display:flex; justify-content: center;">
        <button type="button" class="btn primary" style="padding: 8px 24px;" onclick="window.closeSubtypeActionModal()">OK</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Reorganise Ingredient modal.
 */
export function renderReorganiseTemplate(ing, targetCandidates) {
  return `
    <div style="padding: 24px; max-width: 500px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 6px; font-size: 1.15rem; font-weight: 750;">🔀 Reorganise Ingredient: ${escapeHTML(ing.name)}</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 18px 0;">Select how you want to restructure or consolidate this ingredient.</p>

      <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 14px; background: var(--surface2,#fafaf9);">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">🔀 Option A: Merge into another Ingredient</div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Transfers all sub-types, linked products, and aliases to the target ingredient before removing this source.</p>
        <div style="display:flex; gap:8px;">
          <input type="text" list="pantry-items-list-ing-merge" id="reorg-ing-merge-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" placeholder="Search or select target ingredient..." ${targetCandidates.length === 0 ? 'disabled' : ''} name="reorgIngMergeSelect">
          <datalist id="pantry-items-list-ing-merge">
            ${targetCandidates.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('') || '<option value="">No other ingredients available</option>'}
          </datalist>
          <button type="button" class="btn primary sm" id="btn-reorg-ing-merge" ${targetCandidates.length === 0 ? 'disabled' : ''}>Merge</button>
        </div>
      </div>

      <div style="padding: 14px; border: 1px solid var(--border,#e7e5e4); border-radius: 10px; margin-bottom: 20px; background: var(--surface2,#fafaf9);">
        <div style="font-weight: 750; font-size: 13px; margin-bottom: 4px; color: var(--text,#1c1917);">⬇️ Option B: Convert to Sub-type of...</div>
        <p style="margin: 0 0 10px 0; font-size: 11.5px; color: var(--text2,#78716c);">Nests this ingredient as a child sub-type under the chosen parent, preserving all linked products.</p>
        <div style="display:flex; gap:8px;">
          <input type="text" list="pantry-items-list-ing-demote" id="reorg-ing-demote-select" style="flex:1; padding:7px; border:1px solid var(--border,#e7e5e4); border-radius:6px; font-size:12px; background:#fff;" placeholder="Search or select parent ingredient..." ${targetCandidates.length === 0 ? 'disabled' : ''} name="reorgIngDemoteSelect">
          <datalist id="pantry-items-list-ing-demote">
            ${targetCandidates.map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.category || 'Other')})</option>`).join('') || '<option value="">No parent ingredients available</option>'}
          </datalist>
          <button type="button" class="btn primary sm" id="btn-reorg-ing-demote" ${targetCandidates.length === 0 ? 'disabled' : ''}>Convert</button>
        </div>
      </div>

      <div style="display:flex; justify-content: flex-end;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Cancel</button>
      </div>
    </div>
  `;
}

/**
 * Renders a custom confirmation modal.
 */
export function renderCustomConfirmTemplate(message, title = 'Confirm Action') {
  return `
    <div style="padding: 24px; max-width: 400px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">❓</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750;">${escapeHTML(title)}</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 20px 0; line-height: 1.5;">
        ${escapeHTML(message)}
      </p>
      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 24px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" style="padding: 8px 24px;" id="btn-confirm-custom">Confirm</button>
      </div>
    </div>
  `;
}

/**
 * Renders a modal for copying text.
 */
export function renderCopyTextModalTemplate(title, text) {
  return `
    <div style="padding: 24px; max-width: 480px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin-top:0; margin-bottom: 12px; font-size: 1.15rem; font-weight: 750;">${escapeHTML(title)}</h3>
      <textarea id="copy-modal-textarea" readonly style="width:100%; height: 200px; padding: 12px; border: 1px solid var(--border,#e7e5e4); border-radius: 8px; font-size: 12px; font-family: monospace; background: var(--surface2,#fafaf9); margin-bottom: 16px; resize: none;">${escapeHTML(text)}</textarea>
      <div style="display:flex; justify-content: flex-end; gap:8px;">
        <button type="button" class="btn" onclick="window.closeSubtypeActionModal()">Close</button>
        <button type="button" class="btn primary" id="btn-copy-modal-text">Copy to Clipboard</button>
      </div>
    </div>
  `;
}
