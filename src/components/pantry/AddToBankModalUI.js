/**
 * src/components/pantry/AddToBankModalUI.js (v3.42.11)
 * Master Modal for adding Categories, Items, Sub-types, and Products
 * with strict case-insensitive duplicate safeguards.
 */

import { getState, setIngredients, setProducts, setCategories } from '../../store/store.js';
import { getUnifiedCategories, saveCategories } from '../../services/CategoryRepository.js';
import { saveIngredient } from '../../services/IngredientRepository.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { invalidateHierarchyCache, slugCategory } from '../../models/PantryHierarchyModel.js';

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
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.12);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border,#e7e5e4); padding-bottom: 12px;">
        <h3 style="margin:0; font-size:1.2rem; font-weight:750;">🏛️ Add to Pantry Bank</h3>
        <button type="button" class="btn xs btn-ghost ghost" id="close-add-bank-modal" style="font-size:16px;">&times;</button>
      </div>

      <div style="display:flex; gap:6px; margin-bottom: 16px; background: var(--surface2,#f5f5f4); padding: 4px; border-radius: 10px;">
        <button type="button" class="btn sm ${initialType === 'item' ? 'primary' : 'ghost'}" data-type-tab="item" style="flex:1; font-weight:700;">Item</button>
        <button type="button" class="btn sm ${initialType === 'subtype' ? 'primary' : 'ghost'}" data-type-tab="subtype" style="flex:1; font-weight:700;">Sub-type</button>
        <button type="button" class="btn sm ${initialType === 'category' ? 'primary' : 'ghost'}" data-type-tab="category" style="flex:1; font-weight:700;">Category</button>
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
          <input type="text" id="add-bank-cat-name" placeholder="e.g. Condiments" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" autofocus />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn" id="cancel-add-bank">Cancel</button>
          <button type="button" class="btn primary" id="submit-add-bank">Create Category</button>
        </div>
      </div>
    `;
  }

  if (type === 'subtype') {
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Parent Item</label>
          <select id="add-bank-subtype-parent" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px; background:#fff;">
            <option value="">Select Parent Item...</option>
            ${ingredients.map(i => `<option value="${escapeAttr(i.id)}">${escapeHtml(i.name)} (${escapeHtml(i.category || 'General')})</option>`).join('')}
          </select>
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
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Product Name</label>
          <input type="text" id="add-bank-prod-name" placeholder="e.g. Whole Milk 4pt" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" autofocus />
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Brand (Optional)</label>
          <input type="text" id="add-bank-prod-brand" placeholder="e.g. Tesco" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" />
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Category</label>
          <list id="add-bank-cat-list"></list>
          <input type="text" id="add-bank-prod-cat" list="add-bank-cat-datalist" placeholder="Select or type category..." style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" />
          <datalist id="add-bank-cat-datalist">
            ${categories.map(c => `<option value="${escapeAttr(c)}">`).join('')}
          </datalist>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" class="btn" id="cancel-add-bank">Cancel</button>
          <button type="button" class="btn primary" id="submit-add-bank">Create Product</button>
        </div>
      </div>
    `;
  }

  // Default: Item
  return `
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Item Name</label>
        <input type="text" id="add-bank-item-name" placeholder="e.g. Cheddar Cheese" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" autofocus />
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Category</label>
        <input type="text" id="add-bank-item-cat" list="add-bank-cat-datalist" placeholder="Select or type category..." style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" />
        <datalist id="add-bank-cat-datalist">
          ${categories.map(c => `<option value="${escapeAttr(c)}">`).join('')}
        </datalist>
      </div>
      <div>
        <label style="display:block; font-size:12px; font-weight:700; margin-bottom:4px;">Unit (Optional)</label>
        <input type="text" id="add-bank-item-unit" placeholder="e.g. g, ml, pcs" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13.5px;" />
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
        <button type="button" class="btn" id="cancel-add-bank">Cancel</button>
        <button type="button" class="btn primary" id="submit-add-bank">Create Item</button>
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

  const submitBtn = document.getElementById('submit-add-bank');
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const state = getState();
      const currentCats = getUnifiedCategories(state);
      const currentIngs = state.ingredients || [];
      const currentProds = state.products || [];

      if (currentType === 'category') {
        const input = document.getElementById('add-bank-cat-name');
        const rawName = input ? input.value.trim() : '';
        if (!rawName) { showError('⚠️ Please enter a category name.'); return; }
        const normalized = rawName.toLowerCase();

        // Check duplicate
        const exists = currentCats.some(c => String(c).trim().toLowerCase() === normalized);
        if (exists) {
          showError('⚠️ This category already exists.');
          return;
        }

        const newCats = [...currentCats, rawName].sort((a,b) => a.localeCompare(b));
        setCategories(newCats);
        closeModal();
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        await saveCategories(newCats);
      } 
      else if (currentType === 'item') {
        const nameInput = document.getElementById('add-bank-item-name');
        const catInput = document.getElementById('add-bank-item-cat');
        const unitInput = document.getElementById('add-bank-item-unit');

        const rawName = nameInput ? nameInput.value.trim() : '';
        const rawCat = catInput ? catInput.value.trim() : 'Pantry';
        const rawUnit = unitInput ? unitInput.value.trim() : '';

        if (!rawName) { showError('⚠️ Please enter an item name.'); return; }
        const normalized = rawName.toLowerCase();

        // Check duplicate item name in catalog
        const exists = currentIngs.some(i => String(i.name || '').trim().toLowerCase() === normalized);
        if (exists) {
          showError('⚠️ This item already exists in the catalog.');
          return;
        }

        const newIng = {
          id: 'ing_' + Date.now() + Math.random().toString(36).substring(2, 6),
          name: rawName,
          category: rawCat || 'Pantry',
          unit: rawUnit || '',
          subtypes: [],
          aliases: [],
          updatedAt: new Date().toISOString()
        };

        const updatedIngs = [...currentIngs, newIng];
        setIngredients(updatedIngs);
        closeModal();
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        await saveIngredient(newIng);
      }
      else if (currentType === 'subtype') {
        const parentSelect = document.getElementById('add-bank-subtype-parent');
        const nameInput = document.getElementById('add-bank-subtype-name');
        const notesInput = document.getElementById('add-bank-subtype-notes');

        const parentId = parentSelect ? parentSelect.value : '';
        const rawName = nameInput ? nameInput.value.trim() : '';
        const rawNotes = notesInput ? notesInput.value.trim() : '';

        if (!parentId) { showError('⚠️ Please select a parent item.'); return; }
        if (!rawName) { showError('⚠️ Please enter a sub-type name.'); return; }

        const parent = currentIngs.find(i => String(i.id) === String(parentId));
        if (!parent) { showError('⚠️ Selected parent item not found.'); return; }

        const subtypes = Array.isArray(parent.subtypes) ? parent.subtypes : [];
        const normalized = rawName.toLowerCase();

        // Check duplicate under parent
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

        setIngredients([...currentIngs]);
        closeModal();
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        await saveIngredient(parent);
      }
      else if (currentType === 'product') {
        const nameInput = document.getElementById('add-bank-prod-name');
        const brandInput = document.getElementById('add-bank-prod-brand');
        const catInput = document.getElementById('add-bank-prod-cat');

        const rawName = nameInput ? nameInput.value.trim() : '';
        const rawBrand = brandInput ? brandInput.value.trim() : '';
        const rawCat = catInput ? catInput.value.trim() : 'Pantry';

        if (!rawName) { showError('⚠️ Please enter a product name.'); return; }

        const newProd = {
          id: 'prod_' + Date.now() + Math.random().toString(36).substring(2, 6),
          name: rawName,
          brand: rawBrand,
          category: rawCat || 'Pantry',
          updatedAt: new Date().toISOString()
        };

        const updatedProds = [...currentProds, newProd];
        setProducts(updatedProds);
        closeModal();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
        await saveProduct(newProd);
      }
    };
  }
}
