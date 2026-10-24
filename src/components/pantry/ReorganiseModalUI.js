/**
 * src/components/pantry/ReorganiseModalUI.js (v3.43.4)
 * Unified Reorganise & Modal Dialogs Controller (Category, Root Item, Sub-type).
 * Includes lightweight custom alert, confirm, and copy dialogs.
 * Strictly under 350 lines.
 */

import { getState, setIngredients, setCategories, setProducts, saveStateCache } from '../../store/store.js';
import { getCategories, saveCategories } from '../../services/CategoryRepository.js';
import { saveRootItem, deleteRootItem } from '../../services/RootItemRepository.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function showModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    content.innerHTML = html;
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function showCustomAlert(message, title = 'Notice') {
  const html = `
    <div style="padding:20px; max-width:420px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px; text-align:center;">
      <h3 style="margin:0 0 8px 0; font-size:1.1rem; font-weight:750;">${escapeHtml(title)}</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0;">${escapeHtml(message)}</p>
      <button type="button" class="btn primary sm" id="btn-alert-ok">OK</button>
    </div>
  `;
  showModal(html);
  const btn = document.getElementById('btn-alert-ok');
  if (btn) btn.onclick = closeModal;
}

export function showCustomConfirm(message, title = 'Confirm Action', onConfirm) {
  const html = `
    <div style="padding:20px; max-width:420px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px; text-align:center;">
      <h3 style="margin:0 0 8px 0; font-size:1.1rem; font-weight:750;">${escapeHtml(title)}</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0;">${escapeHtml(message)}</p>
      <div style="display:flex; gap:8px; justify-content:center;">
        <button type="button" class="btn sm" id="btn-confirm-cancel">Cancel</button>
        <button type="button" class="btn primary sm" id="btn-confirm-yes">Confirm</button>
      </div>
    </div>
  `;
  showModal(html);
  const cancelBtn = document.getElementById('btn-confirm-cancel');
  if (cancelBtn) cancelBtn.onclick = closeModal;
  const yesBtn = document.getElementById('btn-confirm-yes');
  if (yesBtn) {
    yesBtn.onclick = () => {
      closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
}

export function showCustomCopyModal(title, textToCopy) {
  const html = `
    <div style="padding:20px; max-width:460px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:12px;">
      <h3 style="margin:0 0 8px 0; font-size:1.1rem; font-weight:750;">${escapeHtml(title)}</h3>
      <textarea id="copy-modal-text" name="copy_modal_text" aria-label="Text to copy" style="width:100%; height:120px; font-family:monospace; font-size:12px; padding:8px; border:1px solid var(--border,#e7e7e4); border-radius:8px; margin-bottom:12px; resize:none;" readonly>${escapeHtml(textToCopy)}</textarea>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button type="button" class="btn sm" id="btn-copy-close">Close</button>
        <button type="button" class="btn primary sm" id="btn-copy-action">📋 Copy</button>
      </div>
    </div>
  `;
  showModal(html);
  const closeBtn = document.getElementById('btn-copy-close');
  if (closeBtn) closeBtn.onclick = closeModal;
  const copyBtn = document.getElementById('btn-copy-action');
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(textToCopy);
      copyBtn.textContent = '✅ Copied!';
      setTimeout(closeModal, 800);
    };
  }
}

export function openReorganiseModal(entityType, entityData) {
  const state = getState();
  const rootItems = state.rootItems || state.ingredients || [];
  const categories = state.categories || [];

  const entityName = entityData?.name || entityData?.title || 'Selected Item';
  const entityId = entityData?.id || entityData;
  const parentId = entityData?.parentId;

  let targetSelection = null;

  const html = `
    <div style="padding:24px; max-width:500px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px;">
      <h3 style="margin-top:0; margin-bottom:6px; font-size:1.15rem; font-weight:750;">⚙️ Reorganise: ${escapeHtml(entityName)}</h3>
      <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 16px 0;">Select how you want to restructure or relocate this item in your catalog.</p>

      <div style="margin-bottom:16px;">
        <label for="reorg-action-select" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Action Mode</label>
        <select id="reorg-action-select" name="reorg_action_select" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:12.5px; background:#fff;">
          <option value="move">Move to Another Category / Parent</option>
          <option value="promote">Promote Up Hierarchy Level</option>
        </select>
      </div>

      <div id="reorg-target-container" style="margin-bottom:20px;">
        <label style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Target Destination</label>
        <div id="reorg-search-mount"></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn" id="btn-reorg-cancel">Cancel</button>
        <button type="button" class="btn primary" id="btn-reorg-confirm">Apply Changes</button>
      </div>
    </div>
  `;

  showModal(html);

  const mountEl = document.getElementById('reorg-search-mount');
  const actionSelect = document.getElementById('reorg-action-select');

  if (mountEl) {
    createTaxonomySearchInput({
      container: mountEl,
      categories,
      rootItems,
      placeholder: 'Select destination category or item...',
      onSelect: (item) => {
        targetSelection = item;
      }
    });
  }

  const cancelBtn = document.getElementById('btn-reorg-cancel');
  if (cancelBtn) cancelBtn.onclick = closeModal;

  const confirmBtn = document.getElementById('btn-reorg-confirm');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const mode = actionSelect?.value || 'move';
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Applying...';

      try {
        if (entityType === 'item' || entityType === 'rootItem') {
          const item = rootItems.find(r => String(r.id) === String(entityId));
          if (item) {
            if (mode === 'promote') {
              if (!categories.includes(item.name)) {
                categories.push(item.name);
                setCategories(categories);
                await saveCategories(categories);
              }
            } else if (mode === 'move' && targetSelection) {
              let catName = targetSelection.label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
              item.category = catName;
              await saveRootItem(item);
            }
          }
        } else if (entityType === 'subtype') {
          const parent = rootItems.find(r => String(r.id) === String(parentId));
          if (parent && Array.isArray(parent.subtypes)) {
            if (mode === 'promote') {
              const sub = parent.subtypes.find(s => String(s.id) === String(entityId));
              if (sub) {
                parent.subtypes = parent.subtypes.filter(s => String(s.id) !== String(entityId));
                const newRoot = {
                  id: 'ing_' + Date.now(),
                  name: sub.name,
                  category: parent.category || 'General',
                  subtypes: [],
                  updatedAt: new Date().toISOString()
                };
                rootItems.push(newRoot);
                setIngredients(rootItems);
                await saveRootItem(parent);
                await saveRootItem(newRoot);
              }
            }
          }
        }

        invalidateHierarchyCache();
        closeModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
      } catch (err) {
        console.error('[ReorganiseModalUI] Error:', err);
        closeModal();
      }
    };
  }
}
