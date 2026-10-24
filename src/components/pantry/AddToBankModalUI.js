/**
 * src/components/pantry/AddToBankModalUI.js (v3.42.21)
 * Master Modal for adding Categories, Items, Sub-types, and Products
 * with Atomic Draft Pipeline & crash-proof button bindings.
 */

import { getState, setIngredients, setProducts, setCategories } from '../../store/store.js';
import { getUnifiedCategories, saveCategories } from '../../services/CategoryRepository.js';
import { saveRootItem as saveIngredient } from '../../services/RootItemRepository.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { openSubtypeLinkSelectionModal, openTescoImportModal } from './TescoImportModalUI.js';

let draftCategory = '';
let draftItemName = '';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

function showModal(html) {
  let wrap = document.getElementById('view-modal-wrap');
  let content = document.getElementById('view-modal-content');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'view-modal-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }
  if (!content) {
    content = document.createElement('div');
    content.id = 'view-modal-content';
    content.className = 'modal';
    wrap.appendChild(content);
  }
  content.innerHTML = html;
  wrap.classList.add('open');
  wrap.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    wrap.style.display = 'none';
    document.body.style.overflow = '';
  }
  const content = document.getElementById('view-modal-content');
  if (content) content.innerHTML = '';
}

export function openAddToBankModal(initialType = 'item') {
  const state = getState();
  const categories = getUnifiedCategories(state);
  const ingredients = state.ingredients || [];

  const html = `
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; border: 1px solid var(--border,#e7e5e4);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border,#e7e5e4); padding-bottom: 12px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750;">🏛️ Add to Pantry Bank</h3>
        <button type="button" class="btn xs btn-ghost ghost" id="close-add-bank-modal" style="font-size:16px;">&times;</button>
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 16px; background: var(--surface2,#f5f5f4); padding: 4px; border-radius: 10px;">
        <button type="button" class="btn sm ${initialType === 'category' ? 'primary' : 'ghost'}" data-type-tab="category" style="flex:1; font-weight:700;">Category</button>
        <button type="button" class="btn sm ${initialType === 'item' ? 'primary' : 'ghost'}" data-type-tab="item" style="flex:1; font-weight:700;">Item</button>
        <button type="button" class="btn sm ${initialType === 'subtype' ? 'primary' : 'ghost'}" data-type-tab="subtype" style="flex:1; font-weight:700;">Sub-type</button>
        <button type="button" class="btn sm ${initialType === 'product' ? 'primary' : 'ghost'}" data-type-tab="product" style="flex:1; font-weight:700;">Product</button>
      </div>

      <div id="add-bank-error-box" style="display:none; margin-bottom: 14px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; font-size: 13px; font-weight: 600;"></div>

      <div id="add-bank-form-body">
        ${renderFormBody(initialType, categories, ingredients)}
      </div>
    </div>
  `;

  showModal(html);
  bindAddToBankEvents(initialType, categories, ingredients);
}

function renderFormBody(type, categories, ingredients) {
  if (type === 'category') {
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Category Name</label>
          <input type="text" id="add-bank-cat-name" value="${escapeAttr(draftCategory)}" placeholder="e.g. Condiments" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" autofocus />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn" id="cancel-add-bank">Cancel</button>
          <button type="button" class="btn primary" id="submit-add-bank">Next: Add Item</button>
        </div>
      </div>
    `;
  }

  if (type === 'subtype') {
    return `
      <div style="display:flex; flex-direction:column; gap:12px; position:relative;">
        <div style="position:relative;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Parent Item</label>
          <input type="text" id="add-bank-subtype-parent-search" placeholder="Search or select parent item..." autocomplete="off" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px; background:#fff;" />
          <input type="hidden" id="add-bank-subtype-parent-id" value="" />
          <div id="parent-search-dropdown" style="position:absolute; top:100%; left:0; right:0; z-index:9999; background:#fff; border:1px solid var(--border); border-radius:8px; max-height:180px; overflow-y:auto; display:none; margin-top:4px; box-shadow:0 8px 20px rgba(0,0,0,0.08);"></div>
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Sub-type Name</label>
          <input type="text" id="add-bank-subtype-name" placeholder="e.g. Sourdough loaf" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" />
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Notes / Description (Optional)</label>
          <input type="text" id="add-bank-subtype-notes" placeholder="e.g. Artisanal bakery loaf" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn" id="cancel-add-bank">Cancel</button>
          <button type="button" class="btn primary" id="submit-add-bank">Create Sub-type</button>
        </div>
      </div>
    `;
  }

  if (type === 'product') {
    const hierarchyPath = (draftCategory && draftItemName) 
      ? `${draftCategory} > ${draftItemName} > Default Sub-type`
      : 'Select anchor or complete previous steps';
    return `
      <div style="display:flex; flex-direction:column; gap:16px; position:relative;">
        <div style="padding:10px 14px; background:var(--surface2,#f5f5f4); border-radius:8px; font-size:12.5px; font-weight:600; color:var(--text2);">
          📍 Draft Path: <span style="color:var(--text);">${escapeHtml(hierarchyPath)}</span>
        </div>
        <div style="position:relative;">
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Or Select Existing Anchor</label>
          <input type="text" id="add-bank-prod-anchor-search" placeholder="Search sub-type or item..." autocomplete="off" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px; background:#fff;" />
          <input type="hidden" id="add-bank-prod-subtype-id" value="" />
          <input type="hidden" id="add-bank-prod-parent-id" value="" />
          <div id="prod-anchor-dropdown" style="position:absolute; top:100%; left:0; right:0; z-index:9999; background:#fff; border:1px solid var(--border); border-radius:8px; max-height:180px; overflow-y:auto; display:none; margin-top:4px; box-shadow:0 8px 20px rgba(0,0,0,0.08);"></div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
          <button type="button" class="btn primary" id="btn-prod-tesco" style="padding:12px; font-weight:700;">🛒 Import from Tesco</button>
          <button type="button" class="btn secondary" id="btn-prod-manual" style="padding:12px; font-weight:700;">➕ Add Product Manually</button>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
          <button type="button" class="btn" id="cancel-add-bank">Close</button>
        </div>
      </div>
    `;
  }

  // Default: Item
  return `
    <div style="display:flex; flex-direction:column; gap:12px; position:relative;">
      <div>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Item Name</label>
        <input type="text" id="add-bank-item-name" value="${escapeAttr(draftItemName)}" placeholder="e.g. Cheddar Cheese" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" autofocus />
      </div>
      <div style="position:relative;">
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Category</label>
        <input type="text" id="add-bank-item-cat-search" value="${escapeAttr(draftCategory)}" placeholder="Search or select category..." autocomplete="off" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px; background:#fff;" />
        <div id="cat-search-dropdown" style="position:absolute; top:100%; left:0; right:0; z-index:9999; background:#fff; border:1px solid var(--border); border-radius:8px; max-height:180px; overflow-y:auto; display:none; margin-top:4px; box-shadow:0 8px 20px rgba(0,0,0,0.08);"></div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
        <button type="button" class="btn" id="cancel-add-bank">Cancel</button>
        <button type="button" class="btn primary" id="submit-add-bank">Next: Add Product</button>
      </div>
    </div>
  `;
}

function bindAddToBankEvents(currentType, categories, ingredients) {
  const modalContent = document.getElementById('view-modal-content');
  if (!modalContent) return;

  const errorBox = document.getElementById('add-bank-error-box');
  const showError = (msg) => {
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }
  };

  modalContent.querySelectorAll('[data-type-tab]').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.typeTab;
      openAddToBankModal(type);
    };
  });

  const closeBtn = document.getElementById('close-add-bank-modal');
  const cancelBtn = document.getElementById('cancel-add-bank');
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  // Search dropdown bindings
  if (currentType === 'item') {
    const input = document.getElementById('add-bank-item-cat-search');
    const dropdown = document.getElementById('cat-search-dropdown');
    if (input && dropdown) {
      const renderCatOptions = () => {
        const q = input.value.trim().toLowerCase();
        const filtered = categories.filter(c => !q || c.toLowerCase().includes(q));
        dropdown.innerHTML = filtered.map(c => `
          <div class="dd-item" data-val="${escapeAttr(c)}" style="padding:10px 14px; cursor:pointer; font-size:13px; font-weight:550; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">${escapeHtml(c)}</div>
        `).join('') || `<div style="padding:10px; font-size:12px; color:var(--text2); font-style:italic;">No matching category</div>`;
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.dd-item').forEach(el => {
          el.onclick = () => {
            input.value = el.dataset.val;
            draftCategory = el.dataset.val;
            dropdown.style.display = 'none';
          };
        });
      };
      input.addEventListener('input', () => { draftCategory = input.value; renderCatOptions(); });
      input.addEventListener('focus', renderCatOptions);
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
      });
    }
  }

  if (currentType === 'subtype') {
    const input = document.getElementById('add-bank-subtype-parent-search');
    const hiddenId = document.getElementById('add-bank-subtype-parent-id');
    const dropdown = document.getElementById('parent-search-dropdown');
    if (input && dropdown && hiddenId) {
      const renderParentOptions = () => {
        const q = input.value.trim().toLowerCase();
        const filtered = ingredients.filter(i => !q || i.name.toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
        dropdown.innerHTML = filtered.map(i => `
          <div class="dd-item" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
            <div style="font-weight:600;">${escapeHtml(i.name)}</div>
            <div style="font-size:11px; color:var(--text2);">Category: ${escapeHtml(i.category || 'Pantry')}</div>
          </div>
        `).join('') || `<div style="padding:10px; font-size:12px; color:var(--text2); font-style:italic;">No matching item</div>`;
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.dd-item').forEach(el => {
          el.onclick = () => {
            hiddenId.value = el.dataset.id;
            input.value = el.dataset.name;
            dropdown.style.display = 'none';
          };
        });
      };
      input.addEventListener('input', renderParentOptions);
      input.addEventListener('focus', renderParentOptions);
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
      });
    }
  }

  if (currentType === 'product') {
    const input = document.getElementById('add-bank-prod-anchor-search');
    const hiddenSubId = document.getElementById('add-bank-prod-subtype-id');
    const hiddenParentId = document.getElementById('add-bank-prod-parent-id');
    const dropdown = document.getElementById('prod-anchor-dropdown');

    if (input && dropdown) {
      const renderAnchorOptions = () => {
        const q = input.value.trim().toLowerCase();
        const options = [];
        ingredients.forEach(i => {
          if (!q || i.name.toLowerCase().includes(q)) {
            options.push({ type: 'item', parentId: i.id, subtypeId: '', label: `Item: ${i.name} (${i.category || 'Pantry'})` });
          }
          if (Array.isArray(i.subtypes)) {
            i.subtypes.forEach(st => {
              if (!q || st.name.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) {
                options.push({ type: 'subtype', parentId: i.id, subtypeId: st.id, label: `Sub-type: ${st.name} (under ${i.name})` });
              }
            });
          }
        });

        dropdown.innerHTML = options.slice(0, 30).map(opt => `
          <div class="dd-item" data-parent-id="${escapeAttr(opt.parentId)}" data-subtype-id="${escapeAttr(opt.subtypeId)}" data-label="${escapeAttr(opt.label)}" style="padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
            <div style="font-weight:600;">${escapeHtml(opt.label)}</div>
          </div>
        `).join('') || `<div style="padding:10px; font-size:12px; color:var(--text2); font-style:italic;">No matching item or sub-type</div>`;
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.dd-item').forEach(el => {
          el.onclick = () => {
            hiddenParentId.value = el.dataset.parentId;
            hiddenSubId.value = el.dataset.subtypeId;
            input.value = el.dataset.label;
            dropdown.style.display = 'none';
          };
        });
      };
      input.addEventListener('input', renderAnchorOptions);
      input.addEventListener('focus', renderAnchorOptions);
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.style.display = 'none';
      });
    }

    const finalizeDraftAndRoute = async (actionRoute) => {
      const state = getState();
      const currentCats = getUnifiedCategories(state);
      const currentIngs = state.ingredients || [];

      let parentId = document.getElementById('add-bank-prod-parent-id')?.value;
      let subtypeId = document.getElementById('add-bank-prod-subtype-id')?.value;

      if (!parentId && (!draftItemName || !draftCategory)) {
        showError('⚠️ Please complete Item & Category steps or select an existing anchor.');
        return;
      }

      if (!parentId && draftItemName && draftCategory) {
        // 1. Ensure category exists
        const normalizedCat = draftCategory.toLowerCase();
        if (!currentCats.some(c => String(c).trim().toLowerCase() === normalizedCat)) {
          const newCats = [...currentCats, draftCategory].sort((a,b) => a.localeCompare(b));
          setCategories(newCats);
          await saveCategories(newCats);
        }

        // 2. Create Root Item & default subtype
        parentId = 'ing_' + Date.now() + Math.random().toString(36).substring(2, 6);
        subtypeId = 'sub_' + Date.now() + Math.random().toString(36).substring(2, 6);

        const newIng = {
          id: parentId,
          name: draftItemName,
          category: draftCategory,
          unit: '',
          subtypes: [{
            id: subtypeId,
            name: draftItemName,
            updatedAt: new Date().toISOString()
          }],
          aliases: [],
          updatedAt: new Date().toISOString()
        };

        setIngredients([...currentIngs, newIng]);
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        await saveIngredient(newIng);

        // Reset drafts
        draftCategory = '';
        draftItemName = '';
      }

      closeModal();
      if (actionRoute === 'tesco') {
        openTescoImportModal(subtypeId || null, parentId);
      } else {
        openSubtypeLinkSelectionModal(subtypeId || null, parentId);
      }
    };

    const btnTesco = document.getElementById('btn-prod-tesco');
    const btnManual = document.getElementById('btn-prod-manual');

    if (btnTesco) {
      btnTesco.type = 'button';
      btnTesco.onclick = () => finalizeDraftAndRoute('tesco');
    }

    if (btnManual) {
      btnManual.type = 'button';
      btnManual.onclick = () => finalizeDraftAndRoute('manual');
    }
  }

  const submitBtn = document.getElementById('submit-add-bank');
  if (submitBtn) {
    submitBtn.onclick = async () => {
      if (currentType === 'category') {
        const input = document.getElementById('add-bank-cat-name');
        const rawName = input ? input.value.trim() : '';
        if (!rawName) { showError('⚠️ Please enter a category name.'); return; }
        draftCategory = rawName;
        openAddToBankModal('item');
      } 
      else if (currentType === 'item') {
        const nameInput = document.getElementById('add-bank-item-name');
        const catInput = document.getElementById('add-bank-item-cat-search');

        const rawName = nameInput ? nameInput.value.trim() : '';
        const rawCat = catInput ? catInput.value.trim() : 'Pantry';

        if (!rawName) { showError('⚠️ Please enter an item name.'); return; }
        draftItemName = rawName;
        draftCategory = rawCat || 'Pantry';

        openAddToBankModal('product');
      }
      else if (currentType === 'subtype') {
        const parentId = document.getElementById('add-bank-subtype-parent-id')?.value;
        const nameInput = document.getElementById('add-bank-subtype-name');
        const notesInput = document.getElementById('add-bank-subtype-notes');

        const rawName = nameInput ? nameInput.value.trim() : '';
        const rawNotes = notesInput ? notesInput.value.trim() : '';

        if (!parentId) { showError('⚠️ Please select a parent item.'); return; }
        if (!rawName) { showError('⚠️ Please enter a sub-type name.'); return; }

        const parent = ingredients.find(i => String(i.id) === String(parentId));
        if (!parent) { showError('⚠️ Selected parent item not found.'); return; }

        const subtypes = Array.isArray(parent.subtypes) ? parent.subtypes : [];
        const normalized = rawName.toLowerCase();

        const exists = subtypes.some(s => String(s.name || '').trim().toLowerCase() === normalized);
        if (exists) {
          showError('⚠️ This sub-type already exists under this parent.');
          return;
        }

        const newSub = {
          id: 'sub_' + Date.now() + Math.random().toString(36).substring(2, 6),
          name: rawName,
          notes: rawNotes,
          updatedAt: new Date().toISOString()
        };

        parent.subtypes = [...subtypes, newSub];
        parent.updatedAt = new Date().toISOString();

        setIngredients([...ingredients]);
        closeModal();
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        await saveIngredient(parent);
      }
    };
  }
}
