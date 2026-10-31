/**
 * src/components/pantry/ReorganiseModalUI.js
 * Reorganise Modal for Root Items and Sub-types.
 * Segmented button operation controls, live search taxonomy inputs,
 * unified categories SSOT, and lineage breadcrumbs.
 * Strictly under 350 lines.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/CategoryRepository.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { executeSafeReallocation, executeSubtypeReallocation } from '../../services/PantryTaxonomyService.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { openCategoryManagerModal } from './CategoryManagerModalUI.js';

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
  const categories = getUnifiedCategories(state, { includeDefaults: true });

  if (entityType === 'category') {
    openCategoryManagerModal();
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
  let opMode = 'move';

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
        <label style="font-size:12px; font-weight:700; display:block; margin-bottom:8px;">Choose Operation</label>
        <div class="reorg-op-buttons" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <button type="button" class="btn sm primary reorg-op-btn" data-mode="move" style="font-size:12px; font-weight:650; text-align:center;">1. Move Category</button>
          <button type="button" class="btn sm ghost reorg-op-btn" data-mode="merge" style="font-size:12px; font-weight:650; text-align:center;">2. Merge Item</button>
          <button type="button" class="btn sm ghost reorg-op-btn" data-mode="transform_to_subtype" style="font-size:12px; font-weight:650; text-align:center;">3. Make Sub-type</button>
          <button type="button" class="btn sm ghost reorg-op-btn" data-mode="promote_to_category" style="font-size:12px; font-weight:650; text-align:center;">4. Promote to Cat</button>
        </div>
      </div>

      <div id="reorg-target-section" style="margin-bottom:20px;">
        <label id="reorg-target-label" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select Target Category</label>
        <div id="reorg-search-container"></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn sm" id="btn-reorg-cancel">Cancel</button>
        <button type="button" class="btn primary sm" id="btn-reorg-submit">Apply Reorganisation</button>
      </div>
    </div>
  `;

  showModal(html);

  const targetLabel = document.getElementById('reorg-target-label');
  const searchContainer = document.getElementById('reorg-search-container');
  const closeBtn = document.getElementById('btn-reorg-close');
  const cancelBtn = document.getElementById('btn-reorg-cancel');
  const submitBtn = document.getElementById('btn-reorg-submit');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  const mountSearch = (mode) => {
    if (activeSearchInstance && typeof activeSearchInstance.destroy === 'function') {
      activeSearchInstance.destroy();
      activeSearchInstance = null;
    }
    selectedTargetValue = null;

    if (mode === 'move') {
      if (targetLabel) targetLabel.textContent = 'Select Target Category';
      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories,
          rootItems: [],
          newItemType: 'category',
          placeholder: 'Search or type target category...',
          onNewClick: (typedCat) => {
            const clean = (typedCat || '').trim();
            if (!clean) return;
            selectedTargetValue = clean;
            const inputEl = searchContainer.querySelector('.wiz-ing-tax-search');
            if (inputEl) inputEl.value = clean;
            const dropEl = searchContainer.querySelector('.wiz-tax-dropdown');
            if (dropEl) dropEl.style.display = 'none';
          },
          onSelect: ({ label, val }) => {
            let cat = label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
            if (val && val.startsWith('cat:')) cat = val.replace('cat:', '');
            selectedTargetValue = cat;
          }
        });
      }
    } else if (mode === 'merge' || mode === 'transform_to_subtype') {
      if (targetLabel) targetLabel.textContent = mode === 'merge' ? 'Select Target Item to Merge Into' : 'Select Target Parent Item';
      const filteredRootItems = rootItems.filter(r => r && String(r.id) !== String(activeItemId));
      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories: [],
          rootItems: filteredRootItems,
          newItemType: 'none',
          placeholder: 'Search target item...',
          onSelect: ({ val }) => {
            selectedTargetValue = val;
          }
        });
      }
    } else if (mode === 'promote_to_category') {
      if (targetLabel) targetLabel.textContent = 'New Category Preview';
      if (searchContainer) {
        searchContainer.innerHTML = `
          <div style="padding:10px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12.5px; color:var(--text,#1c1917);">
            <strong>📂 ${escapeHtml(itemName)}</strong> will become a new top-level category. All existing sub-types will be preserved under this item.
          </div>
        `;
        selectedTargetValue = itemName;
      }
    }
  };

  document.querySelectorAll('.reorg-op-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.reorg-op-btn').forEach(b => {
        b.classList.remove('primary');
        b.classList.add('ghost');
      });
      btn.classList.remove('ghost');
      btn.classList.add('primary');
      opMode = btn.dataset.mode;
      mountSearch(opMode);
    };
  });

  mountSearch('move');

  if (submitBtn) {
    submitBtn.onclick = async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Applying...';

      try {
        const inputFallback = (document.querySelector('#reorg-search-container .wiz-ing-tax-search')?.value || '').trim();
        await executeSafeReallocation({
          mode: opMode,
          sourceItemId: activeItemId,
          targetCategoryName: opMode === 'move' ? (selectedTargetValue || inputFallback) : null,
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
  let opMode = 'move_parent';

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
        <label style="font-size:12px; font-weight:700; display:block; margin-bottom:8px;">Choose Operation</label>
        <div class="sub-reorg-op-buttons" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
          <button type="button" class="btn sm primary sub-reorg-op-btn" data-mode="move_parent" style="font-size:11.5px; font-weight:650;">1. Move Parent</button>
          <button type="button" class="btn sm ghost sub-reorg-op-btn" data-mode="merge" style="font-size:11.5px; font-weight:650;">2. Merge Sub-type</button>
          <button type="button" class="btn sm ghost sub-reorg-op-btn" data-mode="promote_to_item" style="font-size:11.5px; font-weight:650;">3. Promote to Item</button>
        </div>
      </div>

      <div id="sub-reorg-target-section" style="margin-bottom:20px;">
        <label id="sub-target-label" style="font-size:12px; font-weight:700; display:block; margin-bottom:6px;">Select New Parent Item</label>
        <div id="sub-search-container"></div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn sm" id="btn-reorg-cancel">Cancel</button>
        <button type="button" class="btn primary sm" id="btn-reorg-submit">Apply Reorganisation</button>
      </div>
    </div>
  `;

  showModal(html);

  const targetLabel = document.getElementById('sub-target-label');
  const searchContainer = document.getElementById('sub-search-container');
  const closeBtn = document.getElementById('btn-reorg-close');
  const cancelBtn = document.getElementById('btn-reorg-cancel');
  const submitBtn = document.getElementById('btn-reorg-submit');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  const mountSubtypeSearch = (mode) => {
    if (activeSearchInstance && typeof activeSearchInstance.destroy === 'function') {
      activeSearchInstance.destroy();
      activeSearchInstance = null;
    }
    selectedTargetValue = null;

    if (mode === 'move_parent') {
      if (targetLabel) targetLabel.textContent = 'Select New Parent Root Item';
      const filteredParents = rootItems.filter(r => String(r.id) !== String(parentId));
      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories: [],
          rootItems: filteredParents,
          newItemType: 'none',
          placeholder: 'Search new parent item...',
          onSelect: ({ val }) => {
            selectedTargetValue = val;
          }
        });
      }
    } else if (mode === 'merge') {
      if (targetLabel) targetLabel.textContent = 'Select Sibling Sub-type to Merge Into';
      const siblingSubtypes = subtypes
        .filter(s => String(s.id) !== String(subtypeId))
        .map(s => ({ id: s.id, name: s.name, category: parentItem.category, subtypes: [] }));

      if (searchContainer) {
        activeSearchInstance = createTaxonomySearchInput({
          container: searchContainer,
          categories: [],
          rootItems: siblingSubtypes,
          newItemType: 'none',
          placeholder: 'Search sibling sub-type...',
          onSelect: ({ val }) => {
            selectedTargetValue = val;
          }
        });
      }
    } else if (mode === 'promote_to_item') {
      if (targetLabel) targetLabel.textContent = 'Standalone Item Preview';
      if (searchContainer) {
        searchContainer.innerHTML = `
          <div style="padding:10px 12px; background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; font-size:12.5px; color:var(--text,#1c1917);">
            <strong>📦 ${escapeHtml(activeSubtype.name)}</strong> will be extracted from <strong>${escapeHtml(parentItem.name)}</strong> and become a standalone item in category <strong>${escapeHtml(parentItem.category || 'General')}</strong>.
          </div>
        `;
        selectedTargetValue = activeSubtype.name;
      }
    }
  };

  document.querySelectorAll('.sub-reorg-op-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.sub-reorg-op-btn').forEach(b => {
        b.classList.remove('primary');
        b.classList.add('ghost');
      });
      btn.classList.remove('ghost');
      btn.classList.add('primary');
      opMode = btn.dataset.mode;
      mountSubtypeSearch(opMode);
    };
  });

  mountSubtypeSearch('move_parent');

  if (submitBtn) {
    submitBtn.onclick = async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Applying...';

      try {
        await executeSubtypeReallocation({
          mode: opMode,
          sourceParentItemId: parentId,
          sourceSubtypeId: subtypeId,
          targetParentItemId: opMode === 'move_parent' ? selectedTargetValue : null,
          targetSubtypeId: opMode === 'merge' ? selectedTargetValue : null
        });
        invalidateHierarchyCache();
        closeModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      } catch (err) {
        console.error('[ReorganiseModalUI] Subtype Reorganisation failed:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Reorganisation';
      }
    };
  }
}
