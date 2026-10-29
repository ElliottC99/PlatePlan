/**
 * src/components/pantry/AddToBankHubUI.js (v3.45.2)
 * 4-Tile Master Router for Pantry Bank: Category ➔ Item ➔ Sub-type ➔ Product.
 * Uses RecipeSearchDropdownHelper for taxonomy locking.
 * Strictly under 350 lines.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories, saveCategories } from '../../services/CategoryRepository.js';
import { createTaxonomySearchInput } from './RecipeSearchDropdownHelper.js';
import { saveRootItem } from '../../services/RootItemRepository.js';
import { commitAtomicChain } from '../../services/PantryTaxonomyService.js';
import { openTescoImportModal, openSubtypeExistingProductPickerModal } from './SubtypeProductLinkerModalUI.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let activeDropdownInstance = null;

function showHubModal(html) {
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

export function closeAddToBankModal() {
  if (activeDropdownInstance && typeof activeDropdownInstance.destroy === 'function') {
    activeDropdownInstance.destroy();
    activeDropdownInstance = null;
  }
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openAddToBankModal(initialMode = null, prefillData = {}) {
  if (activeDropdownInstance && typeof activeDropdownInstance.destroy === 'function') {
    activeDropdownInstance.destroy();
    activeDropdownInstance = null;
  }

  if (!initialMode) {
    renderHubTilesGrid();
  } else {
    renderSpecificForm(initialMode, prefillData);
  }
}

function renderHubTilesGrid() {
  const html = `
    <div class="add-to-bank-hub-modal" style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">🏛️ Add to Pantry Catalog</h3>
        <button type="button" class="btn xs ghost" id="btn-hub-close" style="font-weight:700;">✕</button>
      </div>
      <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 20px 0;">Select what record type you would like to create in your Pantry Bank:</p>

      <div class="hub-tiles-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
        <button type="button" class="hub-tile-btn" data-hub-mode="category" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">📂</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Category</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">Create a new aisle section</span>
        </button>
        <button type="button" class="hub-tile-btn" data-hub-mode="item" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">📦</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Item</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">Create a new root ingredient</span>
        </button>
        <button type="button" class="hub-tile-btn" data-hub-mode="subtype" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">🏷️</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Sub-type</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">Add a variant under an item</span>
        </button>
        <button type="button" class="hub-tile-btn" data-hub-mode="product" style="padding:16px 14px; border:1px solid var(--border,#e7e5e4); border-radius:12px; background:var(--surface2,#fbfbf9); text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:22px;">🛒</span>
          <span style="font-size:13.5px; font-weight:750; color:var(--text,#1c1917);">Product</span>
          <span style="font-size:11px; color:var(--text2,#78716c);">Link branded store item</span>
        </button>
      </div>
    </div>
  `;

  showHubModal(html);

  const closeBtn = document.getElementById('btn-hub-close');
  if (closeBtn) closeBtn.onclick = closeAddToBankModal;

  document.querySelectorAll('.hub-tile-btn').forEach(btn => {
    btn.onclick = () => {
      const mode = btn.dataset.hubMode;
      renderSpecificForm(mode);
    };
  });
}

function renderSpecificForm(mode, prefillData = {}) {
  const state = getState();
  const categories = getUnifiedCategories(state) || [];
  const rootItems = state.rootItems || state.ingredients || [];

  let title = 'Add to Pantry Catalog';
  if (mode === 'category') title = '📂 Add New Category';
  if (mode === 'item') title = '📦 Add New Root Item';
  if (mode === 'subtype') title = '🏷️ Add New Sub-type';
  if (mode === 'product') title = '🛒 Attach Product to Sub-type';

  const html = `
    <div class="add-to-bank-hub-modal" style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; position:relative;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h3 style="margin:0; font-size:1.1rem; font-weight:750; color:var(--text,#1c1917);">${title}</h3>
        <button type="button" class="btn xs ghost" id="btn-hub-close" style="font-weight:700;">✕</button>
      </div>

      ${mode === 'category' ? `
        <div style="margin-bottom:18px;">
          <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">Category Name</label>
          <input type="text" id="hub-cat-input" placeholder="e.g. Baking & Sweets, Chilled, Pantry..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
        </div>
      ` : ''}

      ${mode === 'item' ? `
        <div style="margin-bottom:18px; display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">1. Item Name</label>
            <input type="text" id="hub-item-name-input" placeholder="e.g. Cheddar Cheese, Flour, Milk..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
          </div>
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">2. Target Category</label>
            <div id="hub-item-cat-container"></div>
          </div>
        </div>
      ` : ''}

      ${mode === 'subtype' ? `
        <div style="margin-bottom:18px; display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">1. Select Parent Root Item</label>
            <div id="hub-subtype-parent-container"></div>
          </div>
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">2. Sub-type Name</label>
            <input type="text" id="hub-subtype-name-input" placeholder="e.g. Mature Cheddar, Extra Virgin, Whole..." style="width:100%; padding:8px 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:12.5px;" />
          </div>
        </div>
      ` : ''}

      ${mode === 'product' ? `
        <div style="margin-bottom:18px; display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12.5px; font-weight:700; margin-bottom:6px;">Select Target Sub-type / Item</label>
            <div id="hub-product-subtype-container"></div>
          </div>
        </div>
      ` : ''}

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid var(--border,#e7e5e4); padding-top:16px;">
        <button type="button" class="btn" id="btn-hub-back">‹ Back to Hub</button>
        <button type="button" class="btn primary" id="btn-hub-save">Save &amp; Commit</button>
      </div>
    </div>
  `;

  showHubModal(html);

  let selectedCategory = prefillData.category || '';
  let selectedParentItem = prefillData.parentId ? rootItems.find(r => String(r.id) === String(prefillData.parentId)) : null;
  let selectedSubtypeId = prefillData.subtypeId || null;

  // Mount Search Helpers
  if (mode === 'item') {
    const container = document.getElementById('hub-item-cat-container');
    activeDropdownInstance = createTaxonomySearchInput({
      container, categories, rootItems,
      placeholder: 'Type or pick category...',
      initialValue: selectedCategory,
      onSelect: ({ label, val }) => {
        let cat = label.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
        if (val && val.startsWith('cat:')) cat = val.replace('cat:', '');
        selectedCategory = cat;
      }
    });
  } else if (mode === 'subtype') {
    const container = document.getElementById('hub-subtype-parent-container');
    const initialLabel = selectedParentItem ? `📦 ${selectedParentItem.name} [${selectedParentItem.category || 'General'}]` : '';
    activeDropdownInstance = createTaxonomySearchInput({
      container, categories, rootItems,
      placeholder: 'Type or search parent root item...',
      initialValue: initialLabel,
      onSelect: ({ label, val }) => {
        const found = rootItems.find(r => String(r.id) === String(val));
        if (found) selectedParentItem = found;
      }
    });
  } else if (mode === 'product') {
    const container = document.getElementById('hub-product-subtype-container');
    activeDropdownInstance = createTaxonomySearchInput({
      container, categories, rootItems,
      placeholder: 'Type or search target item / sub-type...',
      onSelect: ({ label, val }) => {
        closeAddToBankModal();
        let targetSubtypeId = val;
        let parentItemId = null;
        if (val && val.includes(':')) {
          const parts = val.split(':');
          parentItemId = parts[0];
          targetSubtypeId = parts[1];
        }
        // No onSuccess: with one, the picker returns before it links and saves the products.
        openSubtypeExistingProductPickerModal(targetSubtypeId, parentItemId);
      }
    });
  }

  // Event Listeners
  const closeBtn = document.getElementById('btn-hub-close');
  if (closeBtn) closeBtn.onclick = closeAddToBankModal;

  const backBtn = document.getElementById('btn-hub-back');
  if (backBtn) backBtn.onclick = () => renderHubTilesGrid();

  const saveBtn = document.getElementById('btn-hub-save');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        if (mode === 'category') {
          const catInput = document.getElementById('hub-cat-input');
          const catName = catInput ? catInput.value.trim() : '';
          if (!catName) return;
          const currentCats = Array.isArray(state.categories) ? [...state.categories] : [];
          if (!currentCats.some(c => String(c).toLowerCase() === catName.toLowerCase())) {
            currentCats.push(catName);
            await saveCategories(currentCats);
          }
        } else if (mode === 'item') {
          const nameInput = document.getElementById('hub-item-name-input');
          const itemName = nameInput ? nameInput.value.trim() : '';
          const catInputEl = document.querySelector('#hub-item-cat-container .wiz-ing-tax-search');
          if (catInputEl && catInputEl.value.trim()) {
            selectedCategory = catInputEl.value.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
          }
          if (!itemName || !selectedCategory) return;
          await commitAtomicChain({
            category: selectedCategory,
            rootItemName: itemName,
            subtypeName: ''
          });
        } else if (mode === 'subtype') {
          const subInput = document.getElementById('hub-subtype-name-input');
          const subtypeName = subInput ? subInput.value.trim() : '';
          const parentInputEl = document.querySelector('#hub-subtype-parent-container .wiz-ing-tax-search');
          let parentName = selectedParentItem ? selectedParentItem.name : '';
          let parentCategory = selectedParentItem ? selectedParentItem.category : 'General';
          if (parentInputEl && parentInputEl.value.trim()) {
            parentName = parentInputEl.value.replace(/^[📂📦🏷️✨\s\[Category\]]+/, '').trim();
          }
          if (!subtypeName || !parentName) return;
          await commitAtomicChain({
            category: parentCategory,
            rootItemName: parentName,
            subtypeName
          });
        }
        closeAddToBankModal();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
      } catch (err) {
        console.error('[AddToBankHubUI] Save error:', err);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save & Commit';
      }
    };
  }
}
