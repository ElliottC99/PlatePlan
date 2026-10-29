/**
 * src/views/ProductBankView.js (v3.38.61)
 * Modular ES6 View for Product Bank with real-time search filtering.
 * Decomposed: HTML template rendering moved to ProductBankRenderService.js.
 */

import { getState, setProducts } from '../store/store.js';
import { saveProduct, deleteProduct } from '../services/ProductRepository.js';
import { reallocateProduct, setAutoDefaultProduct, getActiveCategories, addSubtypeToIngredient } from '../models/PantryHierarchyModel.js';
import { promptReallocateProduct as openReallocateModal } from '../components/pantry/ReallocateProductModalUI.js';
import { showCustomAlert, showCustomConfirm } from '../components/ui/DialogHelpers.js';
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
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) wrap.classList.remove('open');
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
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (!wrap || !content) return;

  content.innerHTML = `
    <div id="mi-inner-wrap" style="background: var(--surface, #fff); border-radius: 14px; padding: 24px; max-width: 560px; width: 100%; margin: 0 auto;">
      <h3 id="mi-title">Edit product</h3>
      <div id="mi-tesco-actions" style="display: flex; justify-content: flex-end; margin: -4px 0px 12px;">
        <button type="button" class="btn sm ghost" data-pp-click="openTescoImportForIngredientEdit()">Paste/update from Tesco</button>
      </div>
      <div id="mi-linkage-container" style="margin-bottom: 12px;"></div>
      <div class="grid2">
        <div><label for="mi-name">Product name</label><input type="text" id="mi-name" name="mi-name" placeholder="Product name"></div>
        <div><label for="mi-brand">Brand</label><input type="text" id="mi-brand" name="mi-brand" placeholder="Quorn"></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="mi-cat-search">Category</label><input type="search" id="mi-cat-search" name="mi-cat-search" placeholder="Search category" list="mi-cat-category-options" style="width: 100%;"><datalist id="mi-cat-category-options"></datalist></div>
        <div class="field"><label for="mi-storage">Storage</label><select id="mi-storage" name="mi-storage"><option value="">-- Select --</option><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="cupboard">Cupboard</option></select></div>
      </div>
      <p class="section-label">Per 100g</p>
      <div class="grid3">
        <div><label for="mi-cal">Calories (Energy)</label><input type="number" id="mi-cal" name="mi-cal" placeholder="132"></div>
        <div><label for="mi-fat">Fat (g)</label><input type="number" id="mi-fat" name="mi-fat" placeholder="5.9"></div>
        <div><label for="mi-carb">Carbs (g)</label><input type="number" id="mi-carb" name="mi-carb" placeholder="5.4"></div>
        <div><label for="mi-fibre">Fibre (g)</label><input type="number" id="mi-fibre" name="mi-fibre" placeholder="4.5"></div>
        <div><label for="mi-prot">Protein (g)</label><input type="number" id="mi-prot" name="mi-prot" placeholder="14.5"></div>
      </div>
      <div class="grid3">
        <div><label for="mi-price">Price per pack (£)</label><input type="number" id="mi-price" name="mi-price" placeholder="2.50" step="0.01"></div>
        <div>
          <label for="mi-pack">Total pack size</label>
          <div style="display:flex; gap:5px;">
            <input type="number" id="mi-pack" name="mi-pack" placeholder="500">
            <select id="mi-pack-unit" name="mi-pack-unit" aria-label="Pack unit" style="width:70px; border:1px solid var(--border); border-radius:8px; padding:0 5px;">
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </div>
        </div>
        <div><label for="mi-item-weight">Weight / volume of 1 usable item</label><input type="number" id="mi-item-weight" name="mi-item-weight" placeholder="e.g. 75"></div>
        <div><label for="mi-drained-weight">Drained weight (usable content)</label><input type="number" id="mi-drained-weight" name="mi-drained-weight" placeholder="e.g. 235"></div>
      </div>
      <div class="field"><label for="mi-notes">Notes</label><input type="text" id="mi-notes" placeholder="e.g. Great in bolognese, buy frozen" name="mi-notes"></div>
      <div class="btn-row"><button type="button" class="btn primary" id="mi-save-btn" data-pp-click="saveManualIng()">Save</button><button type="button" class="btn ghost" data-pp-click="cancelManualIng()">Cancel</button></div>
      <div id="mi-msg"></div>
    </div>
  `;

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
  wrap.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
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

// Refuses while a recipe still points at the product. A default is recalculated from the preference
// metric when its product goes, so it never blocks a delete (R14).
export async function handleDeleteProduct(productId, prodName = null) {
  const state = getState();
  const product = (state.products || []).find(p => String(p.id) === String(productId));
  const name = prodName || product?.name || 'this product';
  const recipeCount = (state.recipes || []).filter(r => [...(r.ingredients || []), ...(r.enhanced?.ingredients || [])]
    .some(line => line && line.productId != null && String(line.productId) === String(productId))).length;
  if (recipeCount) {
    showCustomAlert(`"${name}" is used in ${recipeCount} recipe${recipeCount === 1 ? '' : 's'}. Swap it out first.`, 'Cannot delete yet');
    return;
  }

  showCustomConfirm(`Delete "${name}"? This can't be undone.`, 'Delete product', async () => {
    const result = await deleteProduct(productId);
    if (!result?.success) {
      showCustomAlert(`"${name}" was not deleted. Check your connection and try again.`, 'Delete failed');
      return;
    }
    setProducts((getState().products || []).filter(p => String(p.id) !== String(productId)));
    renderProductBank();
  });
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
