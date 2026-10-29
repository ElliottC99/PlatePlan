/**
 * src/components/pantry/ReorganiseModalUI.js (v3.45.5)
 * Reorganise Modal for Root Items, Sub-types, and Categories.
 * Features Lineage Breadcrumbs, 4 Item operations, 3 Sub-type operations, Category Safe Reallocation,
 * infinite loop blocks on dropdown searches, and complete DOM accessibility compliance.
 * Strictly under 350 lines.
 */

import { getState } from '../../store/store.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { executeSafeReallocation, executeSubtypeReallocation, executeCategoryReallocation } from '../../services/PantryTaxonomyService.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { openGuidedDelete } from './GuidedDeleteModalUI.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let activeSearchInstance = null;

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
  if (activeSearchInstance && typeof activeSearchInstance.destroy === 'function') {
    activeSearchInstance.destroy();
    activeSearchInstance = null;
  }
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openReorganiseModal(entityType, entityData) {
  if (activeSearchInstance && typeof activeSearchInstance.destroy === 'function') {
    activeSearchInstance.destroy();
    activeSearchInstance = null;
  }

  const state = getState();
  const rootItems = state.rootItems || state.ingredients || [];
  const categories = state.categories || [];

  if (entityType === 'category') {
    renderCategoryModal(entityData, categories, rootItems);
    return;
  }

  if (entityType === 'subtype') {
    renderSubtypeModal(entityData, categories, rootItems);
    return;
  }

  renderItemModal(entityData, categories, rootItems);
}

function renderItemModal(entityData, categories, rootItems) {
  const activeItemId = typeof entityData === 'object' ? entityData.id : entityData;
  const activeItem = rootItems.find(r => String(r.id) === String(activeItemId)) || (typeof entityData === 'object' ? entityData : { id: activeItemId, name: 'Item', category: 'General' });
  const itemName = activeItem.name || 'Selected Item';
  const category = activeItem.category || 'General';

  let selectedTargetValue = null;

  const html = `
    <div style="padding:24px; max-width:500px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">⚙️ Reorganise Item</h3>
        <button type="button" class="btn xs ghost" id="btn-reorg-close" style="font-weight:700;">✕</button>
      </div>

      <div class="lineage-breadcrumbs" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12px; font-weight:650; color:var(--text2,#64748b); margin-bottom:16px;">
        <span>📂 ${escapeHtml(category)}</span>
        <span style="opacity:0.5;">›</span>
        <span style="color:var(--text,#1c1917); font-weight:750;">📦 ${escapeHtml(itemName)}</span>
      </div>

      <div style="margin-bottom:16px;">
        <label for="reorg-operation-select" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select Reorganisation Operation</label>
        <select id="reorg-operation-select" name="reorg_operation_select" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:12.5px; background:#fff;">
          <option value="move">1. Move to New Category</option>
          <option value="merge">2. Merge with Another Item</option>
          <option value="transform_to_subtype">3. Transform into Sub-type</option>
          <option value="promote_to_category">4. Promote to Category</option>
        </select>
      </div>

      <div id="reorg-target-section" style="margin-bottom:20px;">
        <label id="reorg-target-label" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select Target Category</label>
        <div id="reorg-search-container"></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn" id="btn-reorg-cancel">Cancel</button>
        <button type="button" class="btn primary" id="btn-reorg-submit">Apply Reorganisation</button>
      </div>
    </div>
  `;

  showModal(html);

  const operationSelect = document.getElementById('reorg-operation-select');
  const targetLabel = document.getElementById('reorg-target-label');
  const searchContainer = document.getElementById('reorg-search-container');
  const closeBtn = document.getElementById('btn-reorg-close');
  const cancelBtn = document.getElementById('btn-reorg-cancel');
  const submitBtn = document.getElementById('btn-reorg-submit');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  const mountSearchForOperation = (opMode) => {
    if (activeSearchInstance && typeof activeSearchInstance.destroy === 'function') {
      activeSearchInstance.destroy();
      activeSearchInstance = null;
    }
    selectedTargetValue = null;

    if (opMode === 'move') {
      if (targetLabel) targetLabel.textContent = 'Select Target Category';
      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories,
          rootItems: [],
          placeholder: 'Search or type target category...',
          onSelect: ({ label, val }) => {
            let cat = label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
            if (val && val.startsWith('cat:')) cat = val.replace('cat:', '');
            selectedTargetValue = cat;
          }
        });
      }
    } else if (opMode === 'merge' || opMode === 'transform_to_subtype') {
      if (targetLabel) targetLabel.textContent = opMode === 'merge' ? 'Select Target Item to Merge Into' : 'Select Target Parent Item';
      const filteredRootItems = rootItems.filter(r => r && String(r.id) !== String(activeItemId));

      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories: [],
          rootItems: filteredRootItems,
          placeholder: opMode === 'merge' ? 'Search target item to merge into...' : 'Search target parent item...',
          onSelect: ({ val }) => { selectedTargetValue = val; }
        });
      }
    } else if (opMode === 'promote_to_category') {
      if (targetLabel) targetLabel.textContent = 'Notice: Item name will become a Category aisle, and its sub-types elevated to root items.';
      if (searchContainer) {
        searchContainer.innerHTML = `<div style="padding:10px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12px; color:var(--text2,#64748b);">New Category Name: <strong style="color:var(--text,#1c1917);">${escapeHtml(itemName)}</strong></div>`;
      }
    }
  };

  mountSearchForOperation('move');
  if (operationSelect) operationSelect.onchange = () => mountSearchForOperation(operationSelect.value);

  if (submitBtn) {
    submitBtn.onclick = async () => {
      const opMode = operationSelect?.value || 'move';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Applying...';
      try {
        await executeSafeReallocation({
          mode: opMode,
          sourceItemId: activeItemId,
          targetCategoryName: opMode === 'move' ? (selectedTargetValue || (document.querySelector('#reorg-search-container .wiz-ing-tax-search')?.value || '').trim()) : null,
          targetItemId: opMode === 'merge' ? selectedTargetValue : null,
          targetParentItemId: opMode === 'transform_to_subtype' ? selectedTargetValue : null
        });
        invalidateHierarchyCache();
        closeModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      } catch (err) {
        console.error('[ReorganiseModalUI] Item Reorganisation failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Reorganisation';
      }
    };
  }
}

function renderSubtypeModal(entityData, categories, rootItems) {
  const subtypeId = entityData?.id;
  const parentId = entityData?.parentId;

  const parentItem = rootItems.find(r => String(r.id) === String(parentId)) || { name: 'Parent Item', category: 'General' };
  const subtypes = Array.isArray(parentItem.subtypes) ? parentItem.subtypes : [];
  const activeSubtype = subtypes.find(s => String(s.id) === String(subtypeId)) || { name: entityData?.name || 'Sub-type' };

  let selectedTargetValue = null;

  const html = `
    <div style="padding:24px; max-width:500px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">⚙️ Reorganise Sub-type</h3>
        <button type="button" class="btn xs ghost" id="btn-reorg-close" style="font-weight:700;">✕</button>
      </div>

      <div class="lineage-breadcrumbs" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12px; font-weight:650; color:var(--text2,#64748b); margin-bottom:16px;">
        <span>📂 ${escapeHtml(parentItem.category || 'General')}</span>
        <span style="opacity:0.5;">›</span>
        <span>📦 ${escapeHtml(parentItem.name)}</span>
        <span style="opacity:0.5;">›</span>
        <span style="color:var(--text,#1c1917); font-weight:750;">🏷️ ${escapeHtml(activeSubtype.name)}</span>
      </div>

      <div style="margin-bottom:16px;">
        <label for="sub-reorg-op" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select Operation</label>
        <select id="sub-reorg-op" name="sub_reorg_op" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:12.5px; background:#fff;">
          <option value="move_parent">1. Move to Different Parent Item</option>
          <option value="merge">2. Merge with Another Sub-type</option>
          <option value="promote_to_item">3. Promote to Standalone Root Item</option>
        </select>
      </div>

      <div id="sub-reorg-target-section" style="margin-bottom:20px;">
        <label id="sub-target-label" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select New Parent Item</label>
        <div id="sub-search-container"></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn" id="btn-reorg-cancel">Cancel</button>
        <button type="button" class="btn primary" id="btn-reorg-submit">Apply Reorganisation</button>
      </div>
    </div>
  `;

  showModal(html);

  const opSelect = document.getElementById('sub-reorg-op');
  const targetLabel = document.getElementById('sub-target-label');
  const searchContainer = document.getElementById('sub-search-container');
  const closeBtn = document.getElementById('btn-reorg-close');
  const cancelBtn = document.getElementById('btn-reorg-cancel');
  const submitBtn = document.getElementById('btn-reorg-submit');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  const mountSubtypeSearch = (opMode) => {
    if (activeSearchInstance && typeof activeSearchInstance.destroy === 'function') {
      activeSearchInstance.destroy();
      activeSearchInstance = null;
    }
    selectedTargetValue = null;

    if (opMode === 'move_parent') {
      if (targetLabel) targetLabel.textContent = 'Select New Parent Root Item';
      const filteredParents = rootItems.filter(r => String(r.id) !== String(parentId));
      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories: [],
          rootItems: filteredParents,
          placeholder: 'Search new parent item...',
          onSelect: ({ val }) => { selectedTargetValue = val; }
        });
      }
    } else if (opMode === 'merge') {
      if (targetLabel) targetLabel.textContent = 'Select Target Sibling Sub-type to Merge Into';
      const siblingSubtypes = subtypes.filter(s => String(s.id) !== String(subtypeId));
      if (searchContainer) {
        searchContainer.innerHTML = `
          <label for="sibling-subtype-select" style="display:none">Select sibling target sub-type</label>
          <select id="sibling-subtype-select" name="sibling_subtype_select" aria-label="Select sibling target sub-type" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:12.5px;">
            <option value="">-- Select target sub-type --</option>
            ${siblingSubtypes.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        `;
      }
    } else if (opMode === 'promote_to_item') {
      if (targetLabel) targetLabel.textContent = 'Notice: Sub-type will be elevated to a standalone Root Item.';
      if (searchContainer) {
        searchContainer.innerHTML = `<div style="padding:10px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12px; color:var(--text2,#64748b);">New Root Item Name: <strong style="color:var(--text,#1c1917);">${escapeHtml(activeSubtype.name)}</strong></div>`;
      }
    }
  };

  mountSubtypeSearch('move_parent');
  if (opSelect) opSelect.onchange = () => mountSubtypeSearch(opSelect.value);

  if (submitBtn) {
    submitBtn.onclick = async () => {
      const opMode = opSelect?.value || 'move_parent';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Applying...';
      try {
        if (opMode === 'merge') {
          const siblingSelect = document.getElementById('sibling-subtype-select');
          selectedTargetValue = siblingSelect ? siblingSelect.value : null;
        }
        await executeSubtypeReallocation({
          mode: opMode,
          subtypeId,
          parentId,
          targetParentItemId: opMode === 'move_parent' ? selectedTargetValue : null,
          targetSubtypeId: opMode === 'merge' ? selectedTargetValue : null
        });
        invalidateHierarchyCache();
        closeModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      } catch (err) {
        console.error('[ReorganiseModalUI] Sub-type Reorganisation failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Reorganisation';
      }
    };
  }
}

function renderCategoryModal(categoryData, categories, rootItems) {
  const categoryName = typeof categoryData === 'string' ? categoryData : (categoryData?.name || 'Category');
  const itemsInCat = rootItems.filter(r => r && r.category === categoryName);

  const html = `
    <div style="padding:24px; max-width:500px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">⚙️ Manage Category</h3>
        <button type="button" class="btn xs ghost" id="btn-reorg-close" style="font-weight:700;">✕</button>
      </div>

      <div class="lineage-breadcrumbs" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12px; font-weight:650; color:var(--text2,#64748b); margin-bottom:16px;">
        <span style="color:var(--text,#1c1917); font-weight:750;">📂 Category: ${escapeHtml(categoryName)}</span>
        <span class="badge" style="background:var(--surface2,#f5f4ee); color:var(--text2,#78716c); font-weight:700; padding:2px 8px; border-radius:12px; font-size:11px;">${itemsInCat.length} items</span>
      </div>

      <div style="margin-bottom:16px;">
        <label for="cat-reorg-op" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select Action</label>
        <select id="cat-reorg-op" name="cat_reorg_op" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:12.5px; background:#fff;">
          <option value="rename">1. Rename Category</option>
          <option value="delete">2. Delete Category (Safe Reallocation)</option>
        </select>
      </div>

      <div id="cat-action-section" style="margin-bottom:20px;">
        <div>
          <label for="cat-new-name-input" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">New Category Name</label>
          <input type="text" id="cat-new-name-input" name="cat_new_name_input" value="${escapeHtml(categoryName)}" style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn" id="btn-reorg-cancel">Cancel</button>
        <button type="button" class="btn primary" id="btn-reorg-submit">Apply Changes</button>
      </div>
    </div>
  `;

  showModal(html);

  const catOpSelect = document.getElementById('cat-reorg-op');
  const actionSection = document.getElementById('cat-action-section');
  const closeBtn = document.getElementById('btn-reorg-close');
  const cancelBtn = document.getElementById('btn-reorg-cancel');
  const submitBtn = document.getElementById('btn-reorg-submit');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (catOpSelect) {
    catOpSelect.onchange = () => {
      const mode = catOpSelect.value;
      if (mode === 'rename') {
        actionSection.innerHTML = `
          <div>
            <label for="cat-new-name-input" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">New Category Name</label>
            <input type="text" id="cat-new-name-input" name="cat_new_name_input" value="${escapeHtml(categoryName)}" style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
          </div>
        `;
      } else if (mode === 'delete') {
        const otherCats = categories.filter(c => c !== categoryName);
        if (itemsInCat.length > 0) {
          actionSection.innerHTML = `
            <div style="padding:10px 12px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; margin-bottom:12px; font-size:12px; color:#dc2626;">
              ⚠️ Category contains ${itemsInCat.length} items. Move them to another category, or delete them too:
            </div>
            <fieldset style="border:0; padding:0; margin:0 0 12px;">
              <legend style="font-size:12px; font-weight:700; margin-bottom:6px;">What happens to the items</legend>
              <label style="display:flex; gap:8px; align-items:center; font-size:12.5px; min-height:32px;"><input type="radio" name="cat_items_fate" value="move" checked> Move them to another category</label>
              <label style="display:flex; gap:8px; align-items:center; font-size:12.5px; min-height:32px;"><input type="radio" name="cat_items_fate" value="delete"> Delete the items and their sub-types too</label>
            </fieldset>
            <label for="cat-realloc-select" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Destination Category</label>
            <select id="cat-realloc-select" name="cat_realloc_select" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border,#e7e5e4); font-size:12.5px;">
              <option value="">-- Select destination category --</option>
              ${otherCats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
            </select>
          `;
        } else {
          actionSection.innerHTML = `<div style="padding:10px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12px; color:var(--text2,#64748b);">Category is empty and ready for deletion.</div>`;
        }
      }
    };
  }

  if (submitBtn) {
    submitBtn.onclick = async () => {
      const mode = catOpSelect?.value || 'rename';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Applying...';

      try {
        let newName = null;
        let migrationTarget = null;
        if (mode === 'rename') {
          const input = document.getElementById('cat-new-name-input');
          newName = input ? input.value.trim() : null;
        } else if (mode === 'delete') {
          // An empty category, or "delete the items too", goes through the guided delete (KTD6).
          const fate = document.querySelector('input[name="cat_items_fate"]:checked')?.value;
          if (itemsInCat.length === 0 || fate === 'delete') {
            openGuidedDelete({ kind: 'category', name: categoryName }, { onDone: () => { if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank(); } });
            return;
          }
          const reallocSelect = document.getElementById('cat-realloc-select');
          migrationTarget = reallocSelect ? reallocSelect.value : null;
        }

        await executeCategoryReallocation({
          mode,
          categoryName,
          newCategoryName: newName,
          targetCategoryName: migrationTarget
        });

        invalidateHierarchyCache();
        closeModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      } catch (err) {
        console.error('[ReorganiseModalUI] Category operation failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Changes';
      }
    };
  }
}
