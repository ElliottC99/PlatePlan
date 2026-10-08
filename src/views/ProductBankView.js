/**
 * src/views/ProductBankView.js (v3.20.14)
 * Modular ES6 View for Product Bank with real-time search filtering.
 * Displays nutritional pills (P, C, F, Kcal), P/£ efficiency, Tesco links, and Reallocation modal.
 */

import { getState, setProducts } from '../store/store.js';
import { saveProduct, deleteProduct } from '../services/HouseholdRepository.js';
import { reallocateProduct, setAutoDefaultProduct, getActiveCategories, addSubtypeToIngredient } from '../models/PantryHierarchyModel.js';
import { promptReallocateProduct as openReallocateModal } from '../components/pantry/ReallocateProductModalUI.js';

let activeEditingProductId = null;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

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

  const state = getState() || {};
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
  panel.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:25000;backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);overflow-y:auto;padding:16px;box-sizing:border-box;';
}

export async function saveManualIng() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
  const getNum = (id) => {
    const v = document.getElementById(id)?.value;
    return v !== undefined && v !== '' ? Number(v) : null;
  };

  const name = getVal('mi-name');
  if (!name) return;

  const state = getState() || {};
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
  if (typeof openReallocateModal === 'function') {
    openReallocateModal(productId);
  } else if (typeof window.promptReallocateProduct === 'function') {
    window.promptReallocateProduct(productId);
  }
}

export const openProductReallocateModal = promptReallocateProduct;

export async function handleDeleteProduct(productId, prodName = null) {
  if (typeof window.handleDeleteProduct === 'function') {
    window.handleDeleteProduct(productId, prodName);
  }
}

export async function handleMakeAutoDefault(productId, ingredientId) {
  if (!ingredientId) {
    if (typeof window.showCustomAlert === 'function') {
      window.showCustomAlert('Please reallocate this product to an ingredient before setting as auto-default.');
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

  const state = getState() || {};
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
    container.innerHTML = `
      <div style="margin-bottom:14px;display:flex;gap:8px;align-items:center">
        <label for="product-bank-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search products</label>
        <input type="search" id="product-bank-search" name="product-bank-search" placeholder="Search products, brands, or categories..." value="${escapeAttr(query)}" style="width:100%;padding:8px 12px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff);box-sizing:border-box" />
      </div>
      <div id="product-bank-cards-wrap"></div>
    `;
    cardsWrap = document.getElementById('product-bank-cards-wrap');
    searchInput = document.getElementById('product-bank-search');
    if (searchInput) {
      searchInput.oninput = () => renderProductBank();
    }
  }

  if (allProducts.length === 0) {
    cardsWrap.innerHTML = `
      <div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
        <div style="font-size:32px;margin-bottom:8px">📦</div>
        <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No products in product bank</h3>
        <p style="font-size:13px;color:var(--text2,#78716c);margin:0 0 16px 0">Import groceries from Tesco or add products to calculate prices and nutrition.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary primary sm" type="button" data-pp-click="showAddIng()">+ Add Product</button>
          <button class="btn btn-outline outline sm" type="button" data-pp-click="showTescoImport()" style="background:var(--purple-bg,#f3e8ff);color:var(--purple,#7e22ce)">Import Tesco</button>
        </div>
      </div>
    `;
    return;
  }

  if (products.length === 0) {
    cardsWrap.innerHTML = `
      <div class="card" style="padding:24px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;font-size:13.5px;color:var(--text2)">
        No matching products found for "${escapeHtml(query)}".
      </div>
    `;
    return;
  }

  // Group by category
  const groups = {};
  products.forEach(p => {
    const cat = p.category || p.cat || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });

  const cardsHtml = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => `
    <div class="card" style="margin-bottom:16px;padding:16px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
        <h3 style="margin:0;font-size:15px;font-weight:750;text-transform:capitalize">${escapeHtml(cat)}</h3>
        <span class="tag" style="font-size:11px;font-weight:600;background:var(--surface2,#f5f5f4)">${items.length} products</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px">
        ${items.map(p => {
          const efficiency = calculateProteinEfficiency(p);
          const mappedIng = ingredients.find(i => String(i.id) === String(p.ingredientId) || String(i.id) === String(p.groupId));
          const tescoSearchUrl = p.tescoUrl || `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(p.name)}`;

          return `
            <div class="product-bank-card-item" style="padding:12px;border-radius:10px;background:var(--surface2,#f5f5f4);border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
                <div>
                  <div style="font-size:13.5px;font-weight:750;color:var(--text,#1c1917)">${escapeHtml(p.name)}</div>
                  ${p.brand ? `<div style="font-size:11px;color:var(--text2,#78716c);font-weight:600">${escapeHtml(p.brand)}</div>` : ''}
                </div>
                <div style="text-align:right">
                  <div style="font-size:13.5px;font-weight:750;color:var(--green,#10b981)">£${Number(p.price || 0).toFixed(2)}</div>
                  ${p.pack ? `<div style="font-size:10.5px;color:var(--text3,#a8a29e)">${p.pack}${escapeHtml(p.packUnit || 'g')}</div>` : ''}
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:6px;font-size:11px;flex-wrap:wrap">
                <span style="color:var(--text3);font-weight:600">Maps to:</span>
                ${mappedIng ? `
                  <span class="tag" style="background:var(--surface,#fff);font-weight:600">↳ ${escapeHtml(mappedIng.name)}</span>
                ` : '<span style="color:var(--amber,#f59e0b);font-style:italic">Unallocated</span>'}
                ${(p.isAutoDefault || (mappedIng && (mappedIng.defaultProductId === p.id || mappedIng.autoDefaultProduct === p.id))) ? `
                  <span class="badge badge-success" style="background:rgba(16,185,129,0.15);color:var(--green,#10b981);font-weight:700;padding:2px 8px;border-radius:6px">Auto default for: ${escapeHtml(mappedIng ? mappedIng.name : 'Ingredient')}</span>
                ` : ''}
              </div>

              <div style="display:flex;gap:4px;flex-wrap:wrap;font-size:11px">
                <span class="tag" style="background:var(--surface,#fff);font-weight:650">🔥 ${p.cal || 0} kcal</span>
                <span class="tag" style="background:var(--surface,#fff);font-weight:650;color:var(--primary,#4f46e5)">🫘 ${p.prot || 0}g P</span>
                <span class="tag" style="background:var(--surface,#fff);font-weight:650">🍞 ${p.carb || 0}g C</span>
                <span class="tag" style="background:var(--surface,#fff);font-weight:650">🥑 ${p.fat || 0}g F</span>
                ${p.fibre ? `<span class="tag" style="background:var(--surface,#fff);font-weight:650">🌾 ${p.fibre}g Fib</span>` : ''}
                ${efficiency ? `<span class="tag" style="background:rgba(16,185,129,0.12);color:var(--green,#10b981);font-weight:700">💪 ${efficiency}</span>` : ''}
              </div>

              <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px solid var(--border,#e7e5e4);width:100%">
                <button type="button" class="btn xs btn-ghost ghost" data-action="edit-product" data-product-id="${escapeAttr(p.id)}" style="height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500">Edit</button>
                <button type="button" class="btn xs btn-ghost ghost" data-action="reallocate-product" data-product-id="${escapeAttr(p.id)}" style="height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500">Reallocate</button>
                ${mappedIng && !p.isAutoDefault ? `<button type="button" class="btn xs btn-ghost ghost" data-action="make-auto-default" data-product-id="${escapeAttr(p.id)}" data-ingredient-id="${escapeAttr(mappedIng.id)}" style="height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500">Default</button>` : ''}
                <a href="${escapeAttr(tescoSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn xs btn-ghost ghost" style="text-decoration:none;font-size:13px;font-weight:500;color:var(--primary);height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);display:inline-flex;align-items:center" title="Search on Tesco">Tesco ↗</a>
                <button type="button" class="btn xs btn-ghost ghost" data-action="delete-product" data-product-id="${escapeAttr(p.id)}" style="color:var(--red,#ef4444);height:32px;padding:0 10px;border-radius:var(--radius-sm,6px);font-size:13px;font-weight:500" title="Delete product">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  cardsWrap.innerHTML = cardsHtml;

  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const pid = btn.dataset.productId;
    const ingId = btn.dataset.ingredientId;
    if (action === 'edit-product') {
      openProductEditModal(pid);
    } else if (action === 'reallocate-product') {
      promptReallocateProduct(pid);
    } else if (action === 'make-auto-default') {
      handleMakeAutoDefault(pid, ingId);
    } else if (action === 'delete-product') {
      handleDeleteProduct(pid);
    }
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
  window.renderProductBank = renderProductBank;
  window.renderBank = renderProductBank;
  window.clearProductGroupFilter = clearProductGroupFilter;
  window.openProductEditModal = openProductEditModal;
  window.showAddIng = () => openProductEditModal(null);
  window.showTescoImport = showTescoImport;
  window.saveManualIng = saveManualIng;
  window.cancelManualIng = cancelManualIng;
  window.promptReallocateProduct = promptReallocateProduct;
  window.handleDeleteProduct = handleDeleteProduct;
  window.handleMakeAutoDefault = handleMakeAutoDefault;
}
