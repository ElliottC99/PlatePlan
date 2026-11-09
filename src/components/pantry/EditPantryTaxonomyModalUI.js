/**
 * src/components/pantry/EditPantryTaxonomyModalUI.js
 * Unified editing modal for Root Items and Sub-Types.
 * Supports inline renaming, category/lineage adjustment, and alias management.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/CategoryRepository.js';
import { renameRootItem, renameSubtype } from '../../services/PantryTaxonomyService.js';
import { showCustomAlert } from '../ui/DialogHelpers.js';
import { escapeHtml, escapeAttr } from '../../utils/stringUtils.js';

export function closeEditTaxonomyModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openEditItemModal(itemId, { focusTab = 'name' } = {}) {
  const state = getState() || {};
  const rootItems = state.rootItems || state.ingredients || [];
  const item = rootItems.find(r => String(r.id) === String(itemId));
  if (!item) {
    if (typeof showCustomAlert === 'function') showCustomAlert('Item not found in pantry.');
    return;
  }

  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (!wrap || !content) return;

  const categories = getUnifiedCategories(state, { includeDefaults: true });
  const initialAliases = Array.isArray(item.aliases) ? item.aliases.join(', ') : '';

  content.innerHTML = `
    <div style="padding:22px 24px; max-width:500px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border,#e7e5e4); padding-bottom:10px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:6px;">
          <span>✏️</span> Edit Item
        </h3>
        <button type="button" class="btn xs ghost" id="btn-edit-tax-close" style="font-weight:700;">✕</button>
      </div>

      <div style="margin-bottom:12px;">
        <label for="edit-item-name" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text,#1c1917);">Item Name <span style="color:#ef4444;">*</span></label>
        <input type="text" id="edit-item-name" value="${escapeAttr(item.name || '')}" placeholder="e.g. Tomatoes" style="width:100%; padding:8px 12px; font-size:13px; border-radius:8px; border:1px solid var(--border,#ccc); box-sizing:border-box; background:var(--surface,#fff); color:var(--text,#1c1917);">
      </div>

      <div style="margin-bottom:12px;">
        <label for="edit-item-category" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text,#1c1917);">Category</label>
        <select id="edit-item-category" style="width:100%; padding:8px 12px; font-size:13px; border-radius:8px; border:1px solid var(--border,#ccc); box-sizing:border-box; background:var(--surface,#fff); color:var(--text,#1c1917);">
          ${categories.map(c => `<option value="${escapeAttr(c)}" ${c.toLowerCase() === (item.category || '').toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:18px;">
        <label for="edit-item-aliases" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text,#1c1917);">Search Aliases (comma-separated)</label>
        <input type="text" id="edit-item-aliases" value="${escapeAttr(initialAliases)}" placeholder="e.g. plum tomatoes, beef tomatoes, canned tomatoes" style="width:100%; padding:8px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--border,#ccc); box-sizing:border-box; background:var(--surface,#fff); color:var(--text,#1c1917);">
        <div style="font-size:11px; color:var(--text2,#78716c); margin-top:3px;">Helps the recipe wizard recognise and auto-link this item.</div>
      </div>

      <div id="edit-item-error" role="alert" style="display:none; font-size:12px; color:#ef4444; margin-bottom:12px;"></div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:14px;">
        <button type="button" class="btn sm ghost" id="btn-edit-tax-cancel">Cancel</button>
        <button type="button" class="btn sm primary" id="btn-edit-tax-save" style="font-weight:650;">Save Changes</button>
      </div>
    </div>
  `;

  wrap.style.setProperty('z-index', '25005', 'important');
  content.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';

  const closeBtn = content.querySelector('#btn-edit-tax-close');
  const cancelBtn = content.querySelector('#btn-edit-tax-cancel');
  const saveBtn = content.querySelector('#btn-edit-tax-save');
  const nameInput = content.querySelector('#edit-item-name');
  const catInput = content.querySelector('#edit-item-category');
  const aliasInput = content.querySelector('#edit-item-aliases');
  const errorEl = content.querySelector('#edit-item-error');

  if (closeBtn) closeBtn.onclick = closeEditTaxonomyModal;
  if (cancelBtn) cancelBtn.onclick = closeEditTaxonomyModal;

  if (focusTab === 'aliases' && aliasInput) {
    aliasInput.focus();
  } else if (nameInput) {
    nameInput.focus();
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const newName = (nameInput.value || '').trim();
      if (!newName) {
        errorEl.textContent = 'Item name cannot be empty.';
        errorEl.style.display = 'block';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const newCat = catInput ? catInput.value : item.category;
      const aliases = aliasInput ? aliasInput.value.split(',').map(a => a.trim()).filter(Boolean) : [];

      try {
        await renameRootItem(itemId, newName, { newCategory: newCat, aliases });
        closeEditTaxonomyModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        errorEl.textContent = err.message || 'Error updating item.';
        errorEl.style.display = 'block';
      }
    };
  }
}

export function openEditSubtypeModal(parentId, subtypeId, { focusTab = 'name' } = {}) {
  const state = getState() || {};
  const rootItems = state.rootItems || state.ingredients || [];
  const parent = rootItems.find(r => String(r.id) === String(parentId));
  const sub = parent?.subtypes?.find(s => String(s.id) === String(subtypeId));

  if (!parent || !sub) {
    if (typeof showCustomAlert === 'function') showCustomAlert('Sub-type not found in pantry.');
    return;
  }

  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (!wrap || !content) return;

  const initialAliases = Array.isArray(sub.aliases) ? sub.aliases.join(', ') : '';

  content.innerHTML = `
    <div style="padding:22px 24px; max-width:500px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.15);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; border-bottom:1px solid var(--border,#e7e5e4); padding-bottom:10px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:6px;">
          <span>✏️</span> Edit Sub-type
        </h3>
        <button type="button" class="btn xs ghost" id="btn-edit-sub-close" style="font-weight:700;">✕</button>
      </div>

      <div style="display:inline-flex; align-items:center; gap:6px; padding:6px 10px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:6px; font-size:12px; margin-bottom:14px;">
        <span>📂 ${escapeHtml(parent.category || 'General')}</span>
        <span style="opacity:0.5;">›</span>
        <span>📦 <strong>${escapeHtml(parent.name)}</strong></span>
      </div>

      <div style="margin-bottom:12px;">
        <label for="edit-sub-name" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text,#1c1917);">Sub-type Name <span style="color:#ef4444;">*</span></label>
        <input type="text" id="edit-sub-name" value="${escapeAttr(sub.name || '')}" placeholder="e.g. Cherry Tomatoes" style="width:100%; padding:8px 12px; font-size:13px; border-radius:8px; border:1px solid var(--border,#ccc); box-sizing:border-box; background:var(--surface,#fff); color:var(--text,#1c1917);">
      </div>

      <div style="margin-bottom:18px;">
        <label for="edit-sub-aliases" style="display:block; font-size:12px; font-weight:700; margin-bottom:4px; color:var(--text,#1c1917);">Search Aliases (comma-separated)</label>
        <input type="text" id="edit-sub-aliases" value="${escapeAttr(initialAliases)}" placeholder="e.g. baby cherry tomatoes, piccolo tomatoes" style="width:100%; padding:8px 12px; font-size:12.5px; border-radius:8px; border:1px solid var(--border,#ccc); box-sizing:border-box; background:var(--surface,#fff); color:var(--text,#1c1917);">
        <div style="font-size:11px; color:var(--text2,#78716c); margin-top:3px;">Helps recipe mapping link directly to this specific sub-type.</div>
      </div>

      <div id="edit-sub-error" role="alert" style="display:none; font-size:12px; color:#ef4444; margin-bottom:12px;"></div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:14px;">
        <button type="button" class="btn sm ghost" id="btn-edit-sub-cancel">Cancel</button>
        <button type="button" class="btn sm primary" id="btn-edit-sub-save" style="font-weight:650;">Save Changes</button>
      </div>
    </div>
  `;

  wrap.style.setProperty('z-index', '25005', 'important');
  content.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';

  const closeBtn = content.querySelector('#btn-edit-sub-close');
  const cancelBtn = content.querySelector('#btn-edit-sub-cancel');
  const saveBtn = content.querySelector('#btn-edit-sub-save');
  const nameInput = content.querySelector('#edit-sub-name');
  const aliasInput = content.querySelector('#edit-sub-aliases');
  const errorEl = content.querySelector('#edit-sub-error');

  if (closeBtn) closeBtn.onclick = closeEditTaxonomyModal;
  if (cancelBtn) cancelBtn.onclick = closeEditTaxonomyModal;

  if (focusTab === 'aliases' && aliasInput) {
    aliasInput.focus();
  } else if (nameInput) {
    nameInput.focus();
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const newName = (nameInput.value || '').trim();
      if (!newName) {
        errorEl.textContent = 'Sub-type name cannot be empty.';
        errorEl.style.display = 'block';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const aliases = aliasInput ? aliasInput.value.split(',').map(a => a.trim()).filter(Boolean) : [];

      try {
        await renameSubtype(parentId, subtypeId, newName, { aliases });
        closeEditTaxonomyModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        errorEl.textContent = err.message || 'Error updating sub-type.';
        errorEl.style.display = 'block';
      }
    };
  }
}
