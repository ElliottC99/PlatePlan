/**
 * src/components/pantry/ReallocateProductModalUI.js (v3.19.73)
 * Clean Reallocate Product Modal with Stacked Column Layout & Searchable Category Control.
 * Apple HIG compliant touch targets (min 44px) and free-text category creation.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

function showModal(html) {
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && content) {
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

export function toggleCreateCoreIngredientBox(show = true) {
  const box = document.getElementById('create-core-ingredient-box');
  if (!box) return;
  const shouldShow = typeof show === 'boolean' ? show : (box.style.display === 'none');
  box.style.display = shouldShow ? 'block' : 'none';
  if (shouldShow) {
    populateReallocateCategoryDatalist();
    const nameInput = document.getElementById('new-reallocate-ingredient-name');
    if (nameInput) nameInput.focus();
  }
}

export function populateReallocateCategoryDatalist() {
  const datalist = document.getElementById('reallocate-categories-datalist');
  if (!datalist) return;

  const state = (window.Store && typeof window.Store.getState === 'function') 
    ? window.Store.getState() 
    : (typeof getState === 'function' ? getState() : {});
  const ingredients = state.ingredients || state.pantry?.ingredients || [];

  const categoriesSet = new Set();
  ingredients.forEach(ing => { if (ing.category) categoriesSet.add(ing.category); });
  if (Array.isArray(state.categories)) {
    state.categories.forEach(c => categoriesSet.add(typeof c === 'string' ? c : c.name));
  }

  datalist.innerHTML = Array.from(categoriesSet)
    .sort()
    .map(cat => `<option value="${escapeAttr(cat)}">${escapeHtml(cat)}</option>`)
    .join('');
}

let activeReallocateState = {
  productId: null,
  selectedIngId: null,
  selectedSubId: null,
  renderIngredientList: null,
  renderSubtypeList: null
};

export function selectTargetParentIngredient(ingId, ingName = '') {
  activeReallocateState.selectedIngId = ingId;
  activeReallocateState.selectedSubId = null;
  if (typeof activeReallocateState.renderIngredientList === 'function') activeReallocateState.renderIngredientList();
  if (typeof activeReallocateState.renderSubtypeList === 'function') activeReallocateState.renderSubtypeList();
  const searchInput = document.getElementById('realloc-ing-search');
  if (searchInput && ingName) searchInput.placeholder = `Selected: ${ingName} (type to change...)`;
}

export async function submitCreateNewCoreIngredientFromReallocate() {
  const nameInput = document.getElementById('new-reallocate-ingredient-name');
  const categoryInput = document.getElementById('new-reallocate-ingredient-category');
  
  if (!nameInput || !nameInput.value.trim()) {
    if (typeof window.showCustomAlert === 'function') window.showCustomAlert('Please enter an ingredient name.');
    else alert('Please enter an ingredient name.');
    return;
  }

  const name = nameInput.value.trim();
  const category = (categoryInput && categoryInput.value.trim()) ? categoryInput.value.trim() : 'General';
  const newIng = {
    id: `ing_${Date.now()}`,
    name,
    category,
    aliases: [],
    subtypes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const state = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : (getState() || {});
  const currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  currentIngs.push(newIng);

  if (typeof setIngredients === 'function') setIngredients(currentIngs);
  if (window.Store && typeof window.Store.setState === 'function') window.Store.setState({ ingredients: currentIngs });

  if (window.PantryRepository && typeof window.PantryRepository.saveIngredient === 'function') {
    try { await window.PantryRepository.saveIngredient(newIng); } catch (err) { console.warn('[ReallocateModal] Firestore sync warning:', err); }
  } else {
    try { await saveIngredient(newIng); } catch (err) { console.warn('[ReallocateModal] Repository sync warning:', err); }
  }

  selectTargetParentIngredient(newIng.id, newIng.name);
  toggleCreateCoreIngredientBox(false);
  nameInput.value = '';
  if (categoryInput) categoryInput.value = '';

  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
}

export function promptReallocateProduct(productId) {
  const state = (window.Store && typeof window.Store.getState === 'function') ? window.Store.getState() : (getState() || {});
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const prods = Array.isArray(state.products) ? state.products : [];
  const prod = prods.find(p => String(p.id) === String(productId));
  if (!prod) return;

  activeReallocateState.productId = productId;
  activeReallocateState.selectedIngId = prod.ingredientId || prod.groupId || (currentIngs[0]?.id || null);
  activeReallocateState.selectedSubId = prod.subtypeId || null;

  const html = `
    <div style="padding: 24px; max-width: 520px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px;">
      <h3 style="margin:0 0 6px 0; font-size: 1.15rem; font-weight: 750;">📦 Reallocate Product: ${escapeHtml(prod.name)}</h3>
      <p style="font-size: 12.5px; color: var(--text2,#78716c); margin: 0 0 14px 0;">Search and select the target parent ingredient and optional sub-type.</p>

      <!-- 1. Searchable Core Ingredient Filter -->
      <div class="field" style="margin-bottom: 14px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label style="font-weight: 600; font-size: 0.85rem;">1. Target Core Ingredient</label>
          <button type="button" class="btn xs ghost" id="btn-toggle-create-ing" onclick="toggleCreateCoreIngredientBox()" style="color:var(--primary,#4f46e5); font-weight:600; font-size:11.5px;">➕ Create New Ingredient</button>
        </div>

        <!-- Stacked Column Layout: Create New Core Ingredient Sub-panel -->
        <div id="create-core-ingredient-box" class="subpanel-card" style="display: none; background: var(--system-grouped-bg, #f2f2f7); padding: 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid rgba(0,0,0,0.08);">
          <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600;">Create New Core Ingredient</h4>
          <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <label for="new-reallocate-ingredient-name" style="font-size: 12px; font-weight: 600; color: #666;">Ingredient Name</label>
              <input type="text" id="new-reallocate-ingredient-name" placeholder="e.g. Granulated Sugar" style="width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; box-sizing: border-box;" />
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <label for="new-reallocate-ingredient-category" style="font-size: 12px; font-weight: 600; color: #666;">Category</label>
              <input type="text" id="new-reallocate-ingredient-category" list="reallocate-categories-datalist" placeholder="Search existing or type new category..." style="width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 15px; box-sizing: border-box;" />
              <datalist id="reallocate-categories-datalist"></datalist>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
              <button type="button" onclick="toggleCreateCoreIngredientBox(false)" style="min-height: 44px; padding: 0 16px; border-radius: 8px; border: 1px solid #ccc; background: #fff; font-weight: 500; cursor: pointer;">Cancel</button>
              <button type="button" onclick="submitCreateNewCoreIngredientFromReallocate()" style="min-height: 44px; padding: 0 16px; border-radius: 8px; border: none; background: #007aff; color: #fff; font-weight: 600; cursor: pointer;">Add Ingredient</button>
            </div>
          </div>
        </div>

        <input type="text" id="realloc-ing-search" class="input" placeholder="🔍 Type core ingredient or category name..." style="width:100%; min-height:44px; padding:0 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:14px; box-sizing:border-box;" />
        <div id="realloc-ing-results" style="margin-top:6px; max-height:140px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:8px; background:var(--surface2,#f5f5f4); padding:4px;"></div>
      </div>

      <!-- 2. Searchable Sub-type Filter -->
      <div class="field" style="margin-bottom: 20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label style="font-weight: 600; font-size: 0.85rem;">2. Target Sub-type (Optional)</label>
          <button type="button" class="btn xs ghost" id="btn-toggle-create-sub" style="color:var(--primary,#4f46e5); font-weight:600; font-size:11.5px;">➕ Create New Sub-type</button>
        </div>
        <div id="realloc-create-sub-panel" style="display:none; padding:12px; background:var(--surface2,#f5f5f4); border:1px solid var(--border,#e7e5e4); border-radius:8px; margin-bottom:8px;">
          <div style="font-weight:700; font-size:12px; margin-bottom:6px;">Create Sub-type for Selected Ingredient</div>
          <div style="display:flex; gap:6px; margin-bottom:6px;">
            <input type="text" id="new-sub-name-input" placeholder="Sub-type name (e.g. Sourdough)..." style="flex:1; min-height:40px; padding:0 10px; border:1px solid var(--border); border-radius:6px; font-size:13px; box-sizing:border-box;" />
          </div>
          <div style="display:flex; gap:6px; justify-content:flex-end;">
            <button type="button" class="btn xs ghost" id="btn-cancel-create-sub" style="min-height:36px; padding:0 12px;">Cancel</button>
            <button type="button" class="btn xs primary" id="btn-save-create-sub" style="min-height:36px; padding:0 12px;">Add Sub-type</button>
          </div>
        </div>
        <input type="text" id="realloc-sub-search" class="input" placeholder="🔍 Filter sub-types..." style="width:100%; min-height:44px; padding:0 12px; border:1px solid var(--border,#e7e5e4); border-radius:8px; font-size:14px; box-sizing:border-box;" />
        <div id="realloc-sub-results" style="margin-top:6px; max-height:120px; overflow-y:auto; border:1px solid var(--border,#e7e5e4); border-radius:8px; background:var(--surface2,#f5f5f4); padding:4px;"></div>
      </div>

      <div style="display:flex; gap:8px; justify-content: flex-end;">
        <button type="button" class="btn" style="min-height:44px; padding:0 16px;" onclick="window.closeSubtypeActionModal()">Cancel</button>
        <button type="button" class="btn primary" style="min-height:44px; padding:0 16px;" id="btn-confirm-realloc">Reallocate Product</button>
      </div>
    </div>
  `;
  showModal(html);
  populateReallocateCategoryDatalist();

  const ingSearch = document.getElementById('realloc-ing-search');
  const ingResults = document.getElementById('realloc-ing-results');
  const subSearch = document.getElementById('realloc-sub-search');
  const subResults = document.getElementById('realloc-sub-results');

  const renderSubtypeList = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const st = getState() || {};
    const ings = Array.isArray(st.ingredients) ? st.ingredients : currentIngs;
    const ing = ings.find(i => String(i.id) === String(activeReallocateState.selectedIngId));
    const subtypes = (ing && Array.isArray(ing.subtypes)) ? ing.subtypes : [];
    const filtered = subtypes.filter(s => !q || (s.name || '').toLowerCase().includes(q));
    const isTopLevelSelected = !activeReallocateState.selectedSubId;

    let itemsHtml = `
      <div class="realloc-sub-option" data-id="" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isTopLevelSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isTopLevelSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isTopLevelSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
        <span style="font-size:12.5px; font-weight:650;">None (Top-level ${escapeHtml(ing ? ing.name : 'Ingredient')})</span>
      </div>
    `;

    filtered.forEach(s => {
      const isSelected = String(s.id) === String(activeReallocateState.selectedSubId);
      itemsHtml += `
        <div class="realloc-sub-option" data-id="${escapeAttr(s.id)}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
          <span style="font-size:12.5px; font-weight:650;">${escapeHtml(s.name)}</span>
        </div>
      `;
    });

    subResults.innerHTML = itemsHtml;
    subResults.querySelectorAll('.realloc-sub-option').forEach(el => {
      el.onclick = () => { activeReallocateState.selectedSubId = el.dataset.id || null; renderSubtypeList(subSearch.value); };
    });
  };

  const renderIngredientList = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const st = getState() || {};
    const ings = Array.isArray(st.ingredients) ? st.ingredients : currentIngs;
    const filtered = ings.filter(i => !q || (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));

    if (!filtered.length) {
      ingResults.innerHTML = `<div style="padding:10px; font-size:12px; color:var(--text3,#a8a29e); text-align:center;">No matching ingredients found.</div>`;
      return;
    }

    ingResults.innerHTML = filtered.map(i => {
      const isSelected = String(i.id) === String(activeReallocateState.selectedIngId);
      return `
        <div class="realloc-ing-option" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; margin-bottom:2px; border-radius:6px; cursor:pointer; background:${isSelected ? 'var(--primary,#4f46e5)' : '#fff'}; color:${isSelected ? '#fff' : 'var(--text,#1c1917)'}; border:1px solid ${isSelected ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'};">
          <span style="font-size:12.5px; font-weight:650;">${escapeHtml(i.name)}</span>
          <span style="font-size:11px; opacity:0.85;">${escapeHtml(i.category || 'General')}</span>
        </div>
      `;
    }).join('');

    ingResults.querySelectorAll('.realloc-ing-option').forEach(el => {
      el.onclick = () => { selectTargetParentIngredient(el.dataset.id, el.dataset.name); };
    });
  };

  activeReallocateState.renderIngredientList = () => renderIngredientList(ingSearch.value);
  activeReallocateState.renderSubtypeList = () => renderSubtypeList(subSearch.value);

  ingSearch.oninput = () => renderIngredientList(ingSearch.value);
  subSearch.oninput = () => renderSubtypeList(subSearch.value);

  const createSubPanel = document.getElementById('realloc-create-sub-panel');
  document.getElementById('btn-toggle-create-sub').onclick = () => {
    createSubPanel.style.display = createSubPanel.style.display === 'none' ? 'block' : 'none';
  };
  document.getElementById('btn-cancel-create-sub').onclick = () => { createSubPanel.style.display = 'none'; };

  document.getElementById('btn-save-create-sub').onclick = async () => {
    const subNameInput = document.getElementById('new-sub-name-input');
    const newSubName = (subNameInput ? subNameInput.value : '').trim();
    if (!newSubName || !activeReallocateState.selectedIngId) return;

    const st = getState() || {};
    const ings = Array.isArray(st.ingredients) ? st.ingredients : currentIngs;
    const ing = ings.find(i => String(i.id) === String(activeReallocateState.selectedIngId));
    if (!ing) return;
    if (!Array.isArray(ing.subtypes)) ing.subtypes = [];

    const newSub = { id: `sub_${Date.now()}`, name: newSubName, aliases: [], createdAt: new Date().toISOString() };
    ing.subtypes.push(newSub);
    ing.updatedAt = new Date().toISOString();
    setIngredients([...ings]);
    activeReallocateState.selectedSubId = newSub.id;
    createSubPanel.style.display = 'none';
    if (subNameInput) subNameInput.value = '';

    renderSubtypeList();
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    await saveIngredient(ing);
  };

  const initialIng = currentIngs.find(i => String(i.id) === String(activeReallocateState.selectedIngId));
  if (initialIng) ingSearch.placeholder = `Current: ${initialIng.name} (type to search...)`;
  renderIngredientList();
  renderSubtypeList();

  document.getElementById('btn-confirm-realloc').onclick = async () => {
    if (!activeReallocateState.selectedIngId) return;
    const subtypeId = activeReallocateState.selectedSubId || null;
    const st = getState() || {};
    const ings = Array.isArray(st.ingredients) ? st.ingredients : currentIngs;
    const ing = ings.find(i => String(i.id) === String(activeReallocateState.selectedIngId));
    if (!ing) return;
    closeModal();

    const prodsList = [...(st.products || [])];
    const targetProd = prodsList.find(p => String(p.id) === String(productId));
    if (targetProd) {
      targetProd.ingredientId = ing.id;
      targetProd.subtypeId = subtypeId;
      targetProd.category = ing.category || 'General';
      targetProd.updatedAt = new Date().toISOString();

      setProducts(prodsList);
      if (!ing.defaultProductId && !ing.autoDefault) {
        ing.defaultProductId = targetProd.id;
        ing.autoDefault = targetProd.name || targetProd.title || '';
        ing.autoDefaultProduct = targetProd.id;
        ing.updatedAt = new Date().toISOString();
        saveIngredient(ing);
      }
      if (typeof window.renderProductBank === 'function') window.renderProductBank();
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      await saveProduct(targetProd);
    }
  };
}

export const openProductReallocateModal = promptReallocateProduct;

if (typeof window !== 'undefined') {
  window.toggleCreateCoreIngredientBox = toggleCreateCoreIngredientBox;
  window.populateReallocateCategoryDatalist = populateReallocateCategoryDatalist;
  window.submitCreateNewCoreIngredientFromReallocate = submitCreateNewCoreIngredientFromReallocate;
  window.selectTargetParentIngredient = selectTargetParentIngredient;
  window.promptReallocateProduct = promptReallocateProduct;
  window.openProductReallocateModal = promptReallocateProduct;
}
