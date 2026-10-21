/**
 * src/views/ProductBankView.js (v3.38.61)
 * Modular ES6 View for Product Bank with real-time search filtering.
 * Decomposed: HTML template rendering moved to ProductBankRenderService.js.
 */

import { getState, setProducts } from '../store/store.js';
import { saveProduct, deleteProduct } from '../services/ProductRepository.js';
import { reallocateProduct, setAutoDefaultProduct, getActiveCategories, addSubtypeToIngredient } from '../models/PantryHierarchyModel.js';
import { promptReallocateProduct as openReallocateModal } from '../components/pantry/ReallocateProductModalUI.js';
import { showCustomAlert } from '../components/pantry/IngredientActionModalsUI.js';
import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';

import { 
  renderProductBankBase, 
  renderEmptyProductBank, 
  renderNoMatchingProducts, 
  renderProductCard, 
  renderCategoryGroup 
} from './ProductBankRenderService.js';

let activeEditingProductId = null;

export function cancelManualIng() {
  const panel = document.getElementById('manual-ing-panel');
  if (panel) panel.style.display = 'none';
  document.body.style.overflow = '';
  activeEditingProductId = null;

  if (window.__modalContext && window.__modalContext.returnTo === 'data-quality') {
    const ctx = window.__modalContext;
    window.__modalContext = null;
    if (typeof window.showView === 'function') {
      window.showView('data');
    }
  }
}

export function openProductEditModal(productIdOrDraft = null) {
  const panel = document.getElementById('manual-ing-panel');
  if (!panel) return;

  const state = getState();
  const products = Array.isArray(state.products) ? state.products : [];

  let prod = null;
  let isDraft = false;

  if (productIdOrDraft && typeof productIdOrDraft === 'object') {
    prod = productIdOrDraft;
    isDraft = true;
    activeEditingProductId = prod.id && !prod.id.startsWith('draft_') && !prod.id.startsWith('prod_draft') ? prod.id : null;
  } else if (productIdOrDraft) {
    activeEditingProductId = productIdOrDraft;
    prod = products.find(p => String(p.id) === String(productIdOrDraft)) || null;
  } else {
    activeEditingProductId = null;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  const titleEl = document.getElementById('mi-title');
  if (titleEl) {
    titleEl.textContent = (!isDraft && prod?.name) ? `Edit product: ${prod.name}` : (isDraft && prod?.name ? `Add product: ${prod.name}` : 'Add product');
  }

  const binding = window.__prefilledResolveBinding || {};
  const tescoData = binding.tescoImportData;

  if (prod) {
    setVal('mi-name', prod.name || binding.subtypeDraftName || '');
    setVal('mi-brand', prod.brand || '');
    setVal('mi-cat-search', prod.category || prod.cat || binding.parentCategory || 'General');
    setVal('mi-storage', prod.storage || 'cupboard');
    setVal('mi-cal', prod.cal ?? prod.calories ?? '');
    setVal('mi-fat', prod.fat ?? '');
    setVal('mi-carb', prod.carb ?? prod.carbs ?? '');
    setVal('mi-fibre', prod.fibre ?? '');
    setVal('mi-prot', prod.prot ?? prod.protein ?? '');
    setVal('mi-price', prod.price ?? '');
    setVal('mi-pack', prod.pack ?? prod.packSize ?? '');
    setVal('mi-pack-unit', prod.packUnit || prod.unit || 'g');
    setVal('mi-item-weight', prod.itemWeight ?? '');
    setVal('mi-drained-weight', prod.drainedWeight ?? '');
    setVal('mi-notes', prod.notes ?? '');
  } else if (tescoData) {
    setVal('mi-name', tescoData.title || tescoData.name || binding.subtypeDraftName || '');
    setVal('mi-brand', tescoData.brand || 'Tesco');
    setVal('mi-cat-search', tescoData.category || binding.parentCategory || 'General');
    setVal('mi-storage', tescoData.storage || 'cupboard');
    setVal('mi-price', tescoData.price || '');
    setVal('mi-pack', tescoData.pack || tescoData.packSize || tescoData.size || '');
    setVal('mi-pack-unit', tescoData.packUnit || tescoData.unit || 'g');
    setVal('mi-cal', tescoData.cal ?? tescoData.calories ?? '');
    setVal('mi-fat', tescoData.fat ?? '');
    setVal('mi-carb', tescoData.carb ?? tescoData.carbs ?? '');
    setVal('mi-fibre', tescoData.fibre ?? '');
    setVal('mi-prot', tescoData.prot ?? tescoData.protein ?? '');
    setVal('mi-item-weight', tescoData.itemWeight ?? '');
    setVal('mi-drained-weight', tescoData.drainedWeight ?? '');
    setVal('mi-notes', tescoData.notes || (tescoData.url || tescoData.tescoUrl ? `Tesco: ${tescoData.url || tescoData.tescoUrl}` : ''));
  } else {
    setVal('mi-name', binding.subtypeDraftName || '');
    setVal('mi-brand', '');
    setVal('mi-cat-search', binding.parentCategory || 'General');
    setVal('mi-storage', 'cupboard');
    setVal('mi-cal', '');
    setVal('mi-fat', '');
    setVal('mi-carb', '');
    setVal('mi-fibre', '');
    setVal('mi-prot', '');
    setVal('mi-price', '');
    setVal('mi-pack', '');
    setVal('mi-pack-unit', 'g');
    setVal('mi-item-weight', '');
    setVal('mi-drained-weight', '');
    setVal('mi-notes', '');
  }

  const catOptsEl = document.getElementById('mi-cat-category-options');
  if (catOptsEl) {
    const categories = getActiveCategories(state);
    catOptsEl.innerHTML = categories.map(c => `<option value="${escapeAttr(c)}"></option>`).join('');
  }

  document.body.style.overflow = 'hidden';
  if (panel.parentElement === document.body) {
    document.body.appendChild(panel);
  }
  panel.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:25005 !important;backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);overflow-y:auto;padding:16px;box-sizing:border-box;';
}

export async function saveManualIng() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const getNum = (id) => {
    const v = document.getElementById(id)?.value;
    return v !== undefined && v !== '' ? Number(v) : null;
  };

  const name = getVal('mi-name');
  if (!name) return;

  const state = getState();
  const currentProds = Array.isArray(state.products) ? [...state.products] : [];

  let draftSubtypeId = null;
  if (window.__draftSubtypePayload) {
    try {
      const draft = window.__draftSubtypePayload;
      const newSub = await addSubtypeToIngredient(draft.parentId, draft.name, draft.notes);
      if (newSub && newSub.id) {
        draftSubtypeId = newSub.id;
      }
    } catch (e) {
      console.error('[ProductBankView] Error saving draft subtype:', e);
    }
  }

  const binding = window.__prefilledResolveBinding || {};
  const ingredientId = window.__draftSubtypePayload?.parentId || binding.ingredientId || null;
  const subtypeId = draftSubtypeId || binding.subtypeId || null;
  const isAutoDefault = !!ingredientId;

  window.__draftSubtypePayload = null;

  const finalIngId = activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.ingredientId || null) : ingredientId;
  const parentIng = finalIngId ? (state.ingredients || []).find(i => String(i.id) === String(finalIngId)) : null;
  const inheritedCategory = parentIng?.category || getVal('mi-cat-search') || 'General';

  const updatedProd = {
    ...(activeEditingProductId ? currentProds.find(p => String(p.id) === String(activeEditingProductId)) : {}),
    id: activeEditingProductId || `prod_${Date.now()}`,
    name,
    brand: getVal('mi-brand'),
    category: inheritedCategory,
    storage: getVal('mi-storage') || 'cupboard',
    cal: getNum('mi-cal') || 0,
    fat: getNum('mi-fat') || 0,
    carb: getNum('mi-carb') || 0,
    fibre: getNum('mi-fibre') || 0,
    prot: getNum('mi-prot') || 0,
    price: getNum('mi-price') || 0,
    pack: getNum('mi-pack') || 0,
    packUnit: getVal('mi-pack-unit') || 'g',
    itemWeight: getNum('mi-item-weight'),
    drainedWeight: getNum('mi-drained-weight'),
    notes: getVal('mi-notes'),
    ingredientId: activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.ingredientId || null) : ingredientId,
    subtypeId: activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.subtypeId || null) : subtypeId,
    isAutoDefault: activeEditingProductId ? (currentProds.find(p => String(p.id) === String(activeEditingProductId))?.isAutoDefault || false) : isAutoDefault,
    updatedAt: new Date().toISOString()
  };

  if (window.__prefilledResolveBinding) {
    window.__prefilledResolveBinding = null;
  }

  const existingIdx = currentProds.findIndex(p => String(p.id) === String(updatedProd.id));
  if (existingIdx >= 0) {
    currentProds[existingIdx] = updatedProd;
  } else {
    currentProds.push(updatedProd);
  }

  setProducts(currentProds);
  cancelManualIng();
  renderProductBank();

  try {
    await saveProduct(updatedProd);
  } catch (e) {
    console.warn('[ProductBankView] Cloud sync fallback for product:', e);
  }
}

export async function promptReallocateProduct(productId) {
  const openModal = typeof openReallocateModal === 'function' ? openReallocateModal : window.promptReallocateProduct;
  if (typeof openModal === 'function') openModal(productId);
}

export const openProductReallocateModal = promptReallocateProduct;

export async function handleDeleteProduct(productId, prodName = null) {
  if (typeof window.handleDeleteProduct === 'function') {
    window.handleDeleteProduct(productId, prodName);
  }
}

export async function handleMakeAutoDefault(productId, ingredientId) {
  if (!ingredientId) {
    if (typeof showCustomAlert === 'function') {
      showCustomAlert('Please reallocate this product to an ingredient before setting as auto-default.');
    }
    return;
  }

  await setAutoDefaultProduct(productId, ingredientId);
  renderProductBank();
}

function calculateProteinEfficiency(prod) {
  const price = Number(prod.price) || 0;
  const pack = Number(prod.pack) || 0;
  const protPer100 = Number(prod.prot) || 0;
  if (price <= 0 || pack <= 0 || protPer100 <= 0) return null;

  const totalProteinGrams = (pack / 100) * protPer100;
  const protPerPound = totalProteinGrams / price;
  return `${protPerPound.toFixed(1)}g P/£`;
}

export function renderProductBank() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('bank-groups-panel');
  if (!container) return;

  const state = getState();
  const allProducts = Array.isArray(state.products) ? state.products : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  let searchInput = document.getElementById('product-bank-search');
  const query = (searchInput?.value || '').trim().toLowerCase();

  let products = allProducts;
  if (query.length > 0) {
    products = allProducts.filter(p => {
      const pName = (p.name || '').toLowerCase();
      const pBrand = (p.brand || '').toLowerCase();
      const pCat = (p.category || p.cat || '').toLowerCase();
      return pName.includes(query) || pBrand.includes(query) || pCat.includes(query);
    });
  }

  let cardsWrap = document.getElementById('product-bank-cards-wrap');
  if (!cardsWrap || !searchInput) {
    container.innerHTML = renderProductBankBase(query);
    cardsWrap = document.getElementById('product-bank-cards-wrap');
    searchInput = document.getElementById('product-bank-search');
    if (searchInput) searchInput.oninput = () => renderProductBank();
  }

  if (allProducts.length === 0) {
    cardsWrap.innerHTML = renderEmptyProductBank();
    return;
  }

  if (products.length === 0) {
    cardsWrap.innerHTML = renderNoMatchingProducts(query);
    return;
  }

  const groups = {};
  products.forEach(p => {
    const cat = p.category || p.cat || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });

  cardsWrap.innerHTML = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
    const cardsHtml = items.map(p => {
      const efficiency = calculateProteinEfficiency(p);
      const mappedIng = ingredients.find(i => String(i.id) === String(p.ingredientId) || String(i.id) === String(p.groupId));
      const tescoSearchUrl = p.tescoUrl || `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(p.name)}`;
      return renderProductCard({ p, mappedIng, efficiency, tescoSearchUrl });
    }).join('');
    return renderCategoryGroup(cat, items.length, cardsHtml);
  }).join('');

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, productId: pid, ingredientId: ingId } = btn.dataset;
    if (action === 'edit-product') openProductEditModal(pid);
    else if (action === 'reallocate-product') promptReallocateProduct(pid);
    else if (action === 'make-auto-default') handleMakeAutoDefault(pid, ingId);
    else if (action === 'delete-product') handleDeleteProduct(pid);
  };
}

export function clearProductGroupFilter() {
  const searchInput = document.getElementById('product-bank-search');
  if (searchInput) searchInput.value = '';
  renderProductBank();
}

export function showTescoImport() {
  if (typeof window.openTescoImportModal === 'function') {
    window.openTescoImportModal(null, null);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    renderProductBank, renderBank: renderProductBank,
    clearProductGroupFilter, openProductEditModal,
    showAddIng: () => openProductEditModal(null),
    showTescoImport, saveManualIng, cancelManualIng,
    promptReallocateProduct, handleDeleteProduct, handleMakeAutoDefault
  });
}
