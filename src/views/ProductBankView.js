/**
 * src/views/ProductBankView.js (v3.19.52)
 * Modular ES6 View for Product Bank.
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
}

export function openProductEditModal(productId = null) {
  const panel = document.getElementById('manual-ing-panel');
  if (!panel) return;

  activeEditingProductId = productId;
  const state = getState() || {};
  const products = Array.isArray(state.products) ? state.products : [];
  const prod = productId ? products.find(p => String(p.id) === String(productId)) : null;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  const titleEl = document.getElementById('mi-title');
  if (titleEl) titleEl.textContent = prod ? `Edit product: ${prod.name}` : 'Add product';

  const binding = window.__prefilledResolveBinding || {};
  const tescoData = binding.tescoImportData;

  if (!prod && tescoData) {
    setVal('mi-name', tescoData.title || tescoData.name || binding.subtypeDraftName || '');
    setVal('mi-brand', tescoData.brand || 'Tesco');
    setVal('mi-cat-search', tescoData.category || binding.parentCategory || 'General');
    setVal('mi-price', tescoData.price || '');
    setVal('mi-pack', tescoData.pack || tescoData.size || '');
    setVal('mi-pack-unit', tescoData.packUnit || tescoData.unit || 'g');
    setVal('mi-cal', tescoData.cal ?? tescoData.calories ?? '');
    setVal('mi-fat', tescoData.fat ?? '');
    setVal('mi-carb', tescoData.carb ?? tescoData.carbs ?? '');
    setVal('mi-fibre', tescoData.fibre ?? '');
    setVal('mi-prot', tescoData.prot ?? tescoData.protein ?? '');
    setVal('mi-notes', tescoData.url || tescoData.tescoUrl ? `Tesco: ${tescoData.url || tescoData.tescoUrl}` : (tescoData.notes || ''));
  } else if (!prod) {
    setVal('mi-name', prod?.name || binding.subtypeDraftName || '');
    setVal('mi-brand', prod?.brand || '');
    setVal('mi-cat-search', prod?.category || prod?.cat || 'General');
    setVal('mi-storage', prod?.storage || 'cupboard');
    setVal('mi-cal', prod?.cal ?? prod?.calories);
    setVal('mi-fat', prod?.fat);
    setVal('mi-carb', prod?.carb ?? prod?.carbs);
    setVal('mi-fibre', prod?.fibre);
    setVal('mi-prot', prod?.prot ?? prod?.protein);
    setVal('mi-price', prod?.price);
    setVal('mi-pack', prod?.pack);
    setVal('mi-pack-unit', prod?.packUnit || 'g');
    setVal('mi-item-weight', prod?.itemWeight);
    setVal('mi-drained-weight', prod?.drainedWeight);
    setVal('mi-notes', prod?.notes);
  } else {
    setVal('mi-name', prod.name);
    setVal('mi-brand', prod.brand);
    setVal('mi-cat-search', prod.category || prod.cat || 'General');
    setVal('mi-storage', prod.storage || 'cupboard');
    setVal('mi-cal', prod.cal ?? prod.calories);
    setVal('mi-fat', prod.fat);
    setVal('mi-carb', prod.carb ?? prod.carbs);
    setVal('mi-fibre', prod.fibre);
    setVal('mi-prot', prod.prot ?? prod.protein);
    setVal('mi-price', prod.price);
    setVal('mi-pack', prod.pack);
    setVal('mi-pack-unit', prod.packUnit || 'g');
    setVal('mi-item-weight', prod.itemWeight);
    setVal('mi-drained-weight', prod.drainedWeight);
    setVal('mi-notes', prod.notes);
  }

  const catOptsEl = document.getElementById('mi-cat-category-options');
  if (catOptsEl) {
    const categories = getActiveCategories(state);
    catOptsEl.innerHTML = categories.map(c => `<option value="${escapeAttr(c)}"></option>`).join('');
  }

  document.body.style.overflow = 'hidden';
  panel.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;backdrop-filter:blur(8px);overflow-y:auto;';
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

  // Clear draft payload
  window.__draftSubtypePayload = null;

  const updatedProd = {
    ...(activeEditingProductId ? currentProds.find(p => String(p.id) === String(activeEditingProductId)) : {}),
    id: activeEditingProductId || `prod_${Date.now()}`,
    name,
    brand: getVal('mi-brand'),
    category: getVal('mi-cat-search') || 'General',
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

export async function handleDeleteProduct(productId, prodName) {
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
  const products = Array.isArray(state.products) ? state.products : [];
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];

  if (products.length === 0) {
    container.innerHTML = `
      <div class="card" style="padding:32px 20px;text-align:center;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px;margin-top:12px;">
        <div style="font-size:32px;margin-bottom:8px">📦</div>
        <h3 style="font-size:16px;font-weight:700;margin:0 0 6px 0">No products in product bank</h3>
        <p style="font-size:13px;color:var(--text2,#78716c);margin:0 0 16px 0">Import groceries from Tesco or add products to calculate prices and nutrition.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn primary sm" type="button" data-pp-click="showAddIng()">+ Add Product</button>
          <button class="btn sm" type="button" data-pp-click="showTescoImport()" style="background:var(--purple-bg,#f3e8ff);color:var(--purple,#7e22ce)">Import Tesco</button>
        </div>
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

  const html = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => `
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
              <!-- Top Row: Name, Brand, Price -->
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

              <!-- Hierarchy / Parent Mapping Badge -->
              <div style="display:flex;align-items:center;gap:6px;font-size:11px">
                <span style="color:var(--text3);font-weight:600">Maps to:</span>
                ${mappedIng ? `
                  <span class="tag" style="background:var(--surface,#fff);font-weight:600">↳ ${escapeHtml(mappedIng.name)}</span>
                ` : '<span style="color:var(--amber,#f59e0b);font-style:italic">Unallocated</span>'}
                ${p.isAutoDefault ? '<span class="tag" style="background:rgba(16,185,129,0.15);color:var(--green,#10b981);font-weight:700">⭐ Default</span>' : ''}
              </div>

              <!-- Nutritional Pills Grid (P, C, F, Kcal) -->
              <div style="display:flex;gap:4px;flex-wrap:wrap;font-size:11px">
                <span class="tag" style="background:var(--surface,#fff);font-weight:650">🔥 ${p.cal || 0} kcal</span>
                <span class="tag" style="background:var(--surface,#fff);font-weight:650;color:var(--primary,#4f46e5)">🫘 ${p.prot || 0}g P</span>
                <span class="tag" style="background:var(--surface,#fff);font-weight:650">🍞 ${p.carb || 0}g C</span>
                <span class="tag" style="background:var(--surface,#fff);font-weight:650">🥑 ${p.fat || 0}g F</span>
                ${p.fibre ? `<span class="tag" style="background:var(--surface,#fff);font-weight:650">🌾 ${p.fibre}g Fib</span>` : ''}
                ${efficiency ? `<span class="tag" style="background:rgba(16,185,129,0.12);color:var(--green,#10b981);font-weight:700">💪 ${efficiency}</span>` : ''}
              </div>

              <!-- Action Toolbar -->
              <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px solid var(--border,#e7e5e4);width:100%">
                <button type="button" class="btn xs ghost" onclick="openProductEditModal('${escapeAttr(p.id)}')" style="height:32px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:500">Edit</button>
                <button type="button" class="btn xs ghost" onclick="promptReallocateProduct('${escapeAttr(p.id)}')" style="height:32px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:500">Reallocate</button>
                ${mappedIng && !p.isAutoDefault ? `<button type="button" class="btn xs ghost" onclick="handleMakeAutoDefault('${escapeAttr(p.id)}', '${escapeAttr(mappedIng.id)}')" style="height:32px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:500">Default</button>` : ''}
                <a href="${escapeAttr(tescoSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn xs ghost" style="text-decoration:none;font-size:13px;font-weight:500;color:var(--primary);height:32px;padding:0 10px;border-radius:8px;display:inline-flex;align-items:center" title="Search on Tesco">Tesco ↗</a>
                <button type="button" class="btn xs ghost" onclick="handleDeleteProduct('${escapeAttr(p.id)}', '${escapeAttr(p.name)}')" style="color:var(--red,#ef4444);height:32px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:500" title="Delete product">🗑️</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

export function clearProductGroupFilter() {
  // Clear any active product filter/search state
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
