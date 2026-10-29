/**
 * src/components/pantry/ReallocateProductModalUI.js (v3.38.74)
 * Modular Controller for Product Reallocation Modal.
 * Strictly modular (<350 lines).
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveRootItem as saveIngredient } from '../../services/RootItemRepository.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { 
  renderReallocateModalBase, 
  renderSubtypeListItems, 
  renderIngredientListItems,
  escapeHtml,
  escapeAttr
} from './ReallocateProductModalRenderService.js';
import { showCustomAlert } from '../ui/DialogHelpers.js';


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

export function toggleCreateIngredientBox(show = true) {
  const box = document.getElementById('create-ingredient-box');
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

  const state = getState();
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

export async function submitCreateNewIngredientFromReallocate() {
  const nameInput = document.getElementById('new-reallocate-ingredient-name');
  const categoryInput = document.getElementById('new-reallocate-ingredient-category');
  
  if (!nameInput || !nameInput.value.trim()) {
    if (typeof showCustomAlert === 'function') showCustomAlert('Please enter an ingredient name.');
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

  const state = getState();
  const currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  currentIngs.push(newIng);

  if (typeof setIngredients === 'function') setIngredients(currentIngs);

  try { await saveIngredient(newIng); } catch (err) { console.warn('[ReallocateModal] Repository sync warning:', err); }

  selectTargetParentIngredient(newIng.id, newIng.name);
  toggleCreateIngredientBox(false);
  nameInput.value = '';
  if (categoryInput) categoryInput.value = '';

  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
}

export function promptReallocateProduct(productId) {
  const state = getState();
  const currentIngs = Array.isArray(state.ingredients) ? state.ingredients : [];
  const prods = Array.isArray(state.products) ? state.products : [];
  const prod = prods.find(p => String(p.id) === String(productId));
  if (!prod) return;

  activeReallocateState.productId = productId;
  activeReallocateState.selectedIngId = prod.ingredientId || prod.groupId || (currentIngs[0]?.id || null);
  activeReallocateState.selectedSubId = prod.subtypeId || null;

  showModal(renderReallocateModalBase(prod));
  populateReallocateCategoryDatalist();

  const ingSearch = document.getElementById('realloc-ing-search');
  const ingResults = document.getElementById('realloc-ing-results');
  const subSearch = document.getElementById('realloc-sub-search');
  const subResults = document.getElementById('realloc-sub-results');

  const renderSubtypeList = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const st = getState();
    const ings = Array.isArray(st.ingredients) ? st.ingredients : currentIngs;
    const ing = ings.find(i => String(i.id) === String(activeReallocateState.selectedIngId));
    const subtypes = (ing && Array.isArray(ing.subtypes)) ? ing.subtypes : [];
    const filtered = subtypes.filter(s => !q || (s.name || '').toLowerCase().includes(q));

    subResults.innerHTML = renderSubtypeListItems(filtered, activeReallocateState.selectedSubId, ing ? ing.name : 'Ingredient');
    subResults.querySelectorAll('.realloc-sub-option').forEach(el => {
      el.onclick = () => { activeReallocateState.selectedSubId = el.dataset.id || null; renderSubtypeList(subSearch.value); };
    });
  };

  const renderIngredientList = (query = '') => {
    const q = String(query || '').trim().toLowerCase();
    const st = getState();
    const ings = Array.isArray(st.ingredients) ? st.ingredients : currentIngs;
    const filtered = ings.filter(i => !q || (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));

    ingResults.innerHTML = renderIngredientListItems(filtered, activeReallocateState.selectedIngId);
    ingResults.querySelectorAll('.realloc-ing-option').forEach(el => {
      el.onclick = () => { selectTargetParentIngredient(el.dataset.id, el.dataset.name); };
    });
  };

  activeReallocateState.renderIngredientList = () => renderIngredientList(ingSearch.value);
  activeReallocateState.renderSubtypeList = () => renderSubtypeList(subSearch.value);

  ingSearch.oninput = () => renderIngredientList(ingSearch.value);
  subSearch.oninput = () => renderSubtypeList(subSearch.value);

  const createSubPanel = document.getElementById('realloc-create-sub-panel');
  if (document.getElementById('btn-toggle-create-sub')) {
    document.getElementById('btn-toggle-create-sub').onclick = () => {
      createSubPanel.style.display = createSubPanel.style.display === 'none' ? 'block' : 'none';
    };
  }
  if (document.getElementById('btn-cancel-create-sub')) {
    document.getElementById('btn-cancel-create-sub').onclick = () => { createSubPanel.style.display = 'none'; };
  }

  if (document.getElementById('btn-save-create-sub')) {
    document.getElementById('btn-save-create-sub').onclick = async () => {
      const subNameInput = document.getElementById('new-sub-name-input');
      const newSubName = (subNameInput ? subNameInput.value : '').trim();
      if (!newSubName || !activeReallocateState.selectedIngId) return;

      const st = getState();
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
  }

  const initialIng = currentIngs.find(i => String(i.id) === String(activeReallocateState.selectedIngId));
  if (initialIng) ingSearch.placeholder = `Current: ${initialIng.name} (type to search...)`;
  renderIngredientList();
  renderSubtypeList();

  if (document.getElementById('btn-confirm-realloc')) {
    document.getElementById('btn-confirm-realloc').onclick = async () => {
      if (!activeReallocateState.selectedIngId) return;
      const subtypeId = activeReallocateState.selectedSubId || null;
      const st = getState();
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
          const brand = String(targetProd.brand || '').trim();
          let pName = String(targetProd.name || targetProd.title || '').trim();
          if (brand && pName.toLowerCase().startsWith(brand.toLowerCase())) {
            pName = pName.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim();
          }
          ing.defaultProductId = targetProd.id;
          ing.autoDefault = (brand && pName) ? `${brand} ${pName}` : (pName || brand);
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
}

export const openProductReallocateModal = promptReallocateProduct;

if (typeof window !== 'undefined') {
  window.toggleCreateIngredientBox = toggleCreateIngredientBox;
  window.populateReallocateCategoryDatalist = populateReallocateCategoryDatalist;
  window.submitCreateNewIngredientFromReallocate = submitCreateNewIngredientFromReallocate;
  window.selectTargetParentIngredient = selectTargetParentIngredient;
  window.promptReallocateProduct = promptReallocateProduct;
  window.openProductReallocateModal = promptReallocateProduct;
}
