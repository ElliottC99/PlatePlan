/**
 * src/components/pantry/CategoryManagerModalUI.js
 * Dedicated Category Manager modal:
 * - Scrollable category list with item and product counts.
 * - Add category guides through the hierarchy.
 * - Inline rename category with cascading updates.
 * - Safe delete: instant for empty categories, forced reallocation for non-empty.
 * Strictly under 350 lines.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/CategoryRepository.js';
import { renameCategory, deleteCategory } from '../../services/CategoryManagementRepository.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { showCustomAlert } from '../ui/DialogHelpers.js';
import { openAddItemWizard } from './AddItemWizardUI.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let activeReallocSearchInstance = null;

function showModal(html) {
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

export function closeCategoryManagerModal() {
  if (activeReallocSearchInstance && typeof activeReallocSearchInstance.destroy === 'function') {
    activeReallocSearchInstance.destroy();
    activeReallocSearchInstance = null;
  }
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function refreshBankViews() {
  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}

export function openCategoryManagerModal() {
  if (activeReallocSearchInstance && typeof activeReallocSearchInstance.destroy === 'function') {
    activeReallocSearchInstance.destroy();
    activeReallocSearchInstance = null;
  }

  const state = getState();
  const categories = getUnifiedCategories(state);
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];

  const countsMap = new Map();
  categories.forEach(cat => {
    const norm = String(cat).toLowerCase().replace(/[^a-z0-9]/g, '');
    const rootItemsInCat = ingredients.filter(i => {
      const iCat = String(i?.category || i?.cat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return iCat === norm;
    });
    const rootCount = rootItemsInCat.length;
    let subtypeCount = 0;
    rootItemsInCat.forEach(i => {
      subtypeCount += Array.isArray(i.subtypes) ? i.subtypes.length : 0;
    });
    const prodCount = products.filter(p => {
      const pCat = String(p?.category || p?.cat || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pCat === norm;
    }).length;
    countsMap.set(cat, { rootCount, subtypeCount, prodCount });
  });

  const html = `
    <div style="padding:24px; max-width:540px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
        <h3 style="margin:0; font-size:1.18rem; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:8px;">
          <span>🗂️</span> Manage Categories
        </h3>
        <button type="button" class="btn xs ghost" id="btn-cat-mgr-close" style="font-weight:700;">✕</button>
      </div>
      <p style="font-size:12px; color:var(--text2,#78716c); margin:0 0 16px 0;">
        Organise aisles and sections. Renaming or deleting safely updates all ingredients and products.
      </p>

      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input type="text" id="cat-mgr-new-input" placeholder="Create new category..." style="flex:1; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
        <button type="button" class="btn primary sm" id="btn-cat-mgr-add" style="white-space:nowrap; font-weight:700;">+ Add</button>
      </div>

      <div style="max-height:360px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:10px; background:var(--surface2,#fbfbf9); padding:4px;">
        ${categories.length === 0 ? `
          <div style="padding:24px; text-align:center; font-size:13px; color:var(--text2,#78716c);">No categories found.</div>
        ` : categories.map(cat => {
          const counts = countsMap.get(cat) || { itemCount: 0, prodCount: 0 };
          return `
            <div class="cat-mgr-row" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--surface,#fff); border-radius:8px; margin-bottom:4px; border:1px solid var(--border,#eee);">
              <div style="min-width:0; flex:1; margin-right:10px;">
                <div style="font-size:13px; font-weight:750; color:var(--text,#1c1917); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  📂 ${escapeHtml(cat)}
                </div>
                <div style="font-size:11px; color:var(--text2,#78716c); margin-top:2px;">
                  ${counts.rootCount} root ${counts.rootCount === 1 ? 'item' : 'items'} · ${counts.subtypeCount} sub-${counts.subtypeCount === 1 ? 'type' : 'types'} · ${counts.prodCount} ${counts.prodCount === 1 ? 'product' : 'products'}
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-shrink:0;">
                <button type="button" class="btn xs ghost btn-cat-rename" data-category="${escapeAttr(cat)}" style="font-size:11.5px; font-weight:600;">Rename</button>
                <button type="button" class="btn xs ghost btn-cat-delete" data-category="${escapeAttr(cat)}" style="font-size:11.5px; font-weight:600; color:var(--red,#dc2626);">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:16px; border-top:1px solid var(--border,#e7e5e4); padding-top:12px;">
        <button type="button" class="btn sm" id="btn-cat-mgr-done">Done</button>
      </div>
    </div>
  `;

  showModal(html);

  const closeBtn = document.getElementById('btn-cat-mgr-close');
  const doneBtn = document.getElementById('btn-cat-mgr-done');
  if (closeBtn) closeBtn.onclick = closeCategoryManagerModal;
  if (doneBtn) doneBtn.onclick = closeCategoryManagerModal;

  const addBtn = document.getElementById('btn-cat-mgr-add');
  const inputEl = document.getElementById('cat-mgr-new-input');
  if (addBtn && inputEl) {
    const handleAdd = () => {
      const newCatName = inputEl.value.trim();
      if (!newCatName) return;
      if (categories.some(c => c.toLowerCase() === newCatName.toLowerCase())) {
        showCustomAlert(`Category "${newCatName}" already exists.`, 'Category Exists');
        return;
      }
      closeCategoryManagerModal();
      openAddItemWizard({ startAt: 'category', category: newCatName });
    };
    addBtn.onclick = handleAdd;
    inputEl.onkeydown = (e) => { if (e.key === 'Enter') handleAdd(); };
  }

  document.querySelectorAll('.btn-cat-rename').forEach(btn => {
    btn.onclick = () => {
      const catName = btn.dataset.category;
      openRenameCategoryPrompt(catName, categories);
    };
  });

  document.querySelectorAll('.btn-cat-delete').forEach(btn => {
    btn.onclick = () => {
      const catName = btn.dataset.category;
      const counts = countsMap.get(catName) || { itemCount: 0, prodCount: 0 };
      openSafeDeleteCategoryModal(catName, categories, counts);
    };
  });
}

function openRenameCategoryPrompt(oldName, allCategories) {
  const html = `
    <div style="padding:22px; max-width:440px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750;">✏️ Rename Category</h3>
        <button type="button" class="btn xs ghost" id="btn-rename-close" style="font-weight:700;">✕</button>
      </div>
      <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 14px 0;">
        Enter a new name for <strong>${escapeHtml(oldName)}</strong>. All linked ingredients and products will update automatically.
      </p>
      <input type="text" id="cat-rename-input" value="${escapeAttr(oldName)}" style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:13px; margin-bottom:16px;" />
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn sm" id="btn-rename-cancel">Cancel</button>
        <button type="button" class="btn primary sm" id="btn-rename-submit">Save New Name</button>
      </div>
    </div>
  `;
  showModal(html);

  const input = document.getElementById('cat-rename-input');
  if (input) {
    input.focus();
    input.select();
  }

  const cancel = () => openCategoryManagerModal();
  document.getElementById('btn-rename-close')?.addEventListener('click', cancel);
  document.getElementById('btn-rename-cancel')?.addEventListener('click', cancel);

  const submitBtn = document.getElementById('btn-rename-submit');
  const executeRename = async () => {
    const newName = input ? input.value.trim() : '';
    if (!newName || newName.toLowerCase() === oldName.toLowerCase()) {
      openCategoryManagerModal();
      return;
    }
    if (allCategories.some(c => c.toLowerCase() === newName.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) {
      showCustomAlert(`Category "${newName}" already exists.`, 'Name In Use');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Renaming...';
    await renameCategory(oldName, newName);
    refreshBankViews();
    openCategoryManagerModal();
  };

  if (submitBtn) submitBtn.onclick = executeRename;
  if (input) input.onkeydown = (e) => { if (e.key === 'Enter') executeRename(); };
}

function openSafeDeleteCategoryModal(catToDelete, allCategories, counts) {
  let selectedFallbackCategory = null;
  const remainingCategories = allCategories.filter(c => c.toLowerCase() !== catToDelete.toLowerCase());
  const isEmpty = (counts.rootCount === 0 && counts.subtypeCount === 0 && counts.prodCount === 0);

  const html = `
    <div style="padding:22px; max-width:460px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--red,#dc2626);">🗑️ Delete Category</h3>
        <button type="button" class="btn xs ghost" id="btn-del-close" style="font-weight:700;">✕</button>
      </div>
      <p style="font-size:12.5px; color:var(--text,#1c1917); margin:0 0 10px 0;">
        Are you sure you want to delete <strong>${escapeHtml(catToDelete)}</strong>?
      </p>
      ${isEmpty ? `
        <div style="background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; padding:10px 12px; margin-bottom:16px; font-size:12px; color:var(--text2,#64748b);">
          This category is empty (0 items, 0 products) and can be removed immediately.
        </div>
      ` : `
        <div style="background:var(--surface2,#fef2f2); border:1px solid #fee2e2; border-radius:8px; padding:10px 12px; margin-bottom:14px; font-size:12px; color:#991b1b;">
          Contains <strong>${counts.rootCount} root items</strong>, <strong>${counts.subtypeCount} sub-types</strong>, and <strong>${counts.prodCount} products</strong>. To keep your pantry safe, select where to move them:
        </div>

        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:6px;">Target Reallocation Category</label>
        <div id="cat-del-realloc-search-host" style="margin-bottom:18px;"></div>
      `}

      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" class="btn sm" id="btn-del-cancel">Cancel</button>
        <button type="button" class="btn primary sm" id="btn-del-confirm" ${isEmpty ? '' : 'disabled'} style="background:var(--red,#dc2626); border-color:var(--red,#dc2626);">
          ${isEmpty ? 'Delete Category' : 'Reallocate &amp; Delete'}
        </button>
      </div>
    </div>
  `;
  showModal(html);

  const searchHost = document.getElementById('cat-del-realloc-search-host');
  const confirmBtn = document.getElementById('btn-del-confirm');

  if (!isEmpty && searchHost) {
    activeReallocSearchInstance = createTaxonomySearchInput({
      container: searchHost,
      categories: remainingCategories,
      rootItems: [],
      placeholder: 'Search target category...',
      onSelect: ({ label, val }) => {
        let cat = label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
        if (val && val.startsWith('cat:')) cat = val.replace('cat:', '');
        selectedFallbackCategory = cat;
        if (confirmBtn) {
          confirmBtn.disabled = !selectedFallbackCategory;
          confirmBtn.textContent = selectedFallbackCategory ? `Move to "${selectedFallbackCategory}" & Delete` : 'Reallocate & Delete';
        }
      }
    });
  }

  const cancel = () => openCategoryManagerModal();
  document.getElementById('btn-del-close')?.addEventListener('click', cancel);
  document.getElementById('btn-del-cancel')?.addEventListener('click', cancel);

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      if (!isEmpty && !selectedFallbackCategory) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
      const targetCat = isEmpty ? (remainingCategories[0] || 'General') : selectedFallbackCategory;
      await deleteCategory(catToDelete, targetCat);
      refreshBankViews();
      openCategoryManagerModal();
    };
  }
}
