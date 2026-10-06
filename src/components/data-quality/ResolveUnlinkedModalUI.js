/**
 * src/components/data-quality/ResolveUnlinkedModalUI.js (v3.20.14)
 * Multi-Path Resolution Modal UI component for unlinked ingredients, sub-types, and recipe items.
 * Mounts directly to document.body for flawless viewport presentation.
 * Features re-mapping to existing ingredients/subtypes, safe product retrieval & state-driven editor review.
 */

import { getState, setProducts, setRecipes } from '../../store/store.js';
import { saveProduct, saveRecipe } from '../../services/HouseholdRepository.js';
import { reallocateProduct, reparentSubtype, mergeIngredients } from '../../models/PantryHierarchyModel.js';
import { parseTescoProduct } from '../../services/TescoImportService.js';
import { openProductEditModal } from '../../views/ProductBankView.js';

let activeTargetId = null, activeTargetType = 'ingredient', activeParentIngredientId = null, activeRecipeId = null, activeRecipeItemIndex = null, activeTargetName = '';

const safeEscapeHtml = (str) => String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const safeEscapeAttr = (str) => safeEscapeHtml(str).replace(/`/g, '&#96;');
const safeGetState = () => getState() || (typeof window !== 'undefined' ? (window.Store?.getState?.() || window.state || {}) : {});

export function safeGetProducts() {
  const st = safeGetState();
  if (Array.isArray(st.products) && st.products.length > 0) return [...st.products];
  if (Array.isArray(st.pantry?.products) && st.pantry.products.length > 0) return [...st.pantry.products];
  if (window.state && Array.isArray(window.state.products) && window.state.products.length > 0) return [...window.state.products];
  return [];
}

export function commitProductUpdates(updatedProducts) {
  if (typeof setProducts === 'function') setProducts(updatedProducts);
  if (window.Store?.setState) window.Store.setState({ products: updatedProducts });
  if (window.state) window.state.products = updatedProducts;
  if (window.PantryHierarchyModel?.setProducts) window.PantryHierarchyModel.setProducts(updatedProducts);
  if (Array.isArray(updatedProducts)) {
    Promise.all(updatedProducts.map(p => saveProduct(p))).catch(err => console.warn('[ResolveUnlinkedModalUI] Firebase write-through failed:', err));
  }
  document.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: updatedProducts }));
}

export function closeResolveUnlinkedModal() {
  const overlay = document.getElementById('resolve-unlinked-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  activeTargetId = null; activeParentIngredientId = null; activeRecipeId = null; activeRecipeItemIndex = null; activeTargetName = '';
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildModalHTML(target, targetType = 'ingredient', parentIngredientId = null) {
  let targetId = target, type = targetType, parentId = parentIngredientId;
  if (target && typeof target === 'object') {
    targetId = target.id || target.entityId || target.targetId || target.recipeId;
    type = target.type || target.entityType || target.targetType || 'ingredient';
    parentId = target.parentId || target.parentIngredientId || null;
  }
  const state = safeGetState();
  let targetName = target?.name || target?.title || 'Unnamed Item', searchTerm = 'grocery';

  if (type === 'recipe' || type === 'recipe-ingredient' || type === 'recipe_ingredient') {
    const rec = (state.recipes || []).find(r => String(r.id) === String(targetId));
    targetName = rec ? `Recipe: ${rec.name || rec.title}` : (target?.name || 'Recipe');
    searchTerm = rec ? (rec.name || 'recipe') : 'recipe';
  } else if (type === 'subtype') {
    const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
    const sub = parent?.subtypes?.find(s => String(s.id) === String(targetId));
    targetName = sub ? `${parent ? parent.name : 'Ingredient'} ➔ ${sub.name}` : (target?.name || targetId || 'Sub-type');
    searchTerm = sub ? sub.name : (parent ? parent.name : 'grocery');
  } else {
    const ing = (state.ingredients || []).find(i => String(i.id) === String(targetId));
    targetName = ing ? ing.name : (target?.name || targetId || 'Ingredient');
    searchTerm = ing ? ing.name : (target?.name || 'grocery');
  }
  const tescoSearchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(searchTerm)}`;

  return `
    <div style="width:100%;max-width:580px;max-height:85vh;overflow-y:auto;padding:20px;box-sizing:border-box;background:var(--system-grouped-bg,#f2f2f7);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,0.25);position:relative">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
        <div>
          <h2 style="font-size:18px;font-weight:750;margin:0;color:var(--text,#1c1917)">Resolve Unlinked Item</h2>
          <div style="font-size:13px;color:var(--text2,#78716c);margin-top:4px">Target Item: <strong style="color:var(--text,#1c1917)">${safeEscapeHtml(targetName)}</strong></div>
        </div>
        <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="closeResolveUnlinkedModal()" title="Close" aria-label="Close modal">✕</button>
      </div>
      <p style="font-size:12.5px;color:var(--text2,#78716c);line-height:1.5;margin-bottom:16px">Choose one of the resolution paths below to attach grocery items or link directly to an existing Pantry Bank entity:</p>
      
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <label for="resolve-remap-search" style="font-weight:750;font-size:13.5px;margin-bottom:4px;color:var(--text,#1c1917);display:block">🔄 Re-map to Existing Ingredient / Sub-type</label>
          <div style="font-size:12px;color:var(--text2,#78716c);margin-bottom:8px">Point this item directly to an existing Pantry Bank ingredient or sub-type without creating products.</div>
          <input type="search" id="resolve-remap-search" class="input" placeholder="Search ingredient or sub-type..." style="font-size:12.5px;padding:7px 10px;width:100%;border-radius:8px;border:1px solid var(--border,#e7e5e4);box-sizing:border-box" oninput="filterResolveRemapOptions(this.value)" onfocus="filterResolveRemapOptions(this.value)">
          <div id="resolve-remap-results" style="margin-top:6px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff)"></div>
        </div>

        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <label for="resolve-link-search" style="font-weight:750;font-size:13.5px;margin-bottom:4px;color:var(--text,#1c1917);display:block">🔗 1. Link Existing Product</label>
          <div style="font-size:12px;color:var(--text2,#78716c);margin-bottom:8px">Search your Product Bank and re-bind an existing product to this item.</div>
          <input type="search" id="resolve-link-search" class="input" placeholder="Search product by name or brand..." style="font-size:12.5px;padding:7px 10px;width:100%;border-radius:8px;border:1px solid var(--border,#e7e5e4);box-sizing:border-box" oninput="filterResolveLinkProducts(this.value)">
          <div id="resolve-link-results" style="margin-top:6px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border,#e7e5e4);border-radius:8px;background:var(--surface,#fff)"></div>
        </div>

        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04)">
          <label for="resolve-tesco-json" style="font-weight:750;font-size:13.5px;color:var(--text,#1c1917);margin-bottom:4px;display:block">🛒 2. Import from Tesco</label>
          <div style="margin-bottom:8px"><a href="${safeEscapeAttr(tescoSearchUrl)}" target="_blank" rel="noopener noreferrer" class="btn sm ghost" style="display:inline-flex;align-items:center;gap:6px;color:var(--primary,#4f46e5);font-weight:600;font-size:12px;padding:4px 8px;border:1px solid rgba(79,70,229,0.2);background:rgba(79,70,229,0.05);border-radius:6px;text-decoration:none">🔍 Search Tesco for "${safeEscapeHtml(searchTerm)}" ↗</a></div>
          <textarea id="resolve-tesco-json" placeholder='{"name":"Tesco Bagels 4 Pack","price":1.50,"brand":"Tesco",...}' style="width:100%;height:75px;font-family:monospace;font-size:11.5px;padding:6px;border:1px solid var(--border,#e7e5e4);border-radius:6px;background:#fff;color:var(--text,#1c1917);box-sizing:border-box;resize:vertical"></textarea>
          <div id="resolve-tesco-error" style="display:none;color:var(--red,#ef4444);font-size:12px;margin-top:4px;font-weight:600"></div>
          <button type="button" class="btn sm btn-primary primary" style="width:100%;margin-top:6px;font-weight:700" onclick="submitResolveTescoImport()">Parse &amp; Link Product</button>
        </div>

        <div style="background:#fff;border-radius:14px;padding:14px;border:1px solid var(--border-color,#e5e7eb);box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;" onclick="submitResolveNewProduct()">
          <div style="font-weight:750;font-size:13.5px;margin-bottom:2px;color:var(--text,#1c1917);display:flex;align-items:center;justify-content:space-between">
            <span>✨ 3. Create New Product</span><span class="btn sm btn-ghost ghost" style="pointer-events:none;font-size:11.5px">Open Blank Form &rarr;</span>
          </div>
          <div style="font-size:12px;color:var(--text2,#78716c)">Manually insert and configure a custom grocery product.</div>
        </div>
      </div>
    </div>
  `;
}

export function openResolveUnlinkedModal(target, targetType = 'ingredient', parentIngredientId = null) {
  try {
    let targetId = target, type = targetType, parentId = parentIngredientId;
    if (target && typeof target === 'object') {
      targetId = target.id || target.entityId || target.targetId || target.recipeId;
      type = target.type || target.entityType || target.targetType || 'ingredient';
      parentId = target.parentId || target.parentIngredientId || null;
      activeRecipeId = target.recipeId || (type === 'recipe' ? target.id : null);
      activeRecipeItemIndex = target.itemIndex !== undefined ? target.itemIndex : null;
      activeTargetName = target.name || target.title || '';
    } else {
      activeRecipeId = type === 'recipe' ? targetId : null;
      activeRecipeItemIndex = null; activeTargetName = '';
    }
    activeTargetId = targetId; activeTargetType = type; activeParentIngredientId = parentId;

    const existing = document.getElementById('resolve-unlinked-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'resolve-unlinked-modal-overlay';
    overlay.className = 'modal active';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '999999',
      background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(14px) saturate(160%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflowY: 'auto'
    });
    overlay.innerHTML = buildModalHTML(target, type, parentId);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
  } catch (err) {
    console.error('[ResolveUnlinkedModalUI] Modal error:', err);
  }
}

export function filterResolveRemapOptions(query) {
  const container = document.getElementById('resolve-remap-results');
  if (!container) return;
  const q = String(query || '').trim().toLowerCase();
  const state = safeGetState(), ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const options = [];
  ingredients.forEach(ing => {
    if (!ing?.name) return;
    options.push({ ingredientId: ing.id, subtypeId: '', label: ing.name, type: 'Ingredient' });
    if (Array.isArray(ing.subtypes)) {
      ing.subtypes.forEach(st => {
        if (st?.name) options.push({ ingredientId: ing.id, subtypeId: st.id, label: `${ing.name} ➔ ${st.name}`, type: 'Sub-type' });
      });
    }
  });

  const matches = q ? options.filter(o => o.label.toLowerCase().includes(q)).slice(0, 15) : options.slice(0, 15);
  container.style.display = 'block';
  if (!matches.length) {
    container.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text3,#a8a29e);text-align:center">No matching ingredients found.</div>';
    return;
  }
  container.innerHTML = matches.map(opt => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border,#e7e5e4)">
      <div>
        <div style="font-size:12.5px;font-weight:700;color:var(--text,#1c1917)">${safeEscapeHtml(opt.label)}</div>
        <div style="font-size:11px;color:var(--text2,#78716c)">${opt.type}</div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="submitResolveRemapTarget('${safeEscapeAttr(opt.ingredientId)}', '${safeEscapeAttr(opt.subtypeId)}')">Re-map</button>
    </div>
  `).join('');
}

export async function submitResolveRemapTarget(ingId, subtypeId = '') {
  const state = safeGetState();
  const targetIng = (state.ingredients || []).find(i => String(i.id) === String(ingId));
  const targetSub = subtypeId ? (targetIng?.subtypes || []).find(s => String(s.id) === String(subtypeId)) : null;
  const targetRecipeId = activeRecipeId || (activeTargetType === 'recipe' ? activeTargetId : null);

  if (targetRecipeId) {
    const recipes = Array.isArray(state.recipes) ? [...state.recipes] : [];
    const recIndex = recipes.findIndex(r => String(r.id) === String(targetRecipeId));
    if (recIndex >= 0) {
      const rec = { ...recipes[recIndex] };
      const ingsList = Array.isArray(rec.ingredients) ? [...rec.ingredients] : [];
      let itemIdx = activeRecipeItemIndex ?? ingsList.findIndex(item => {
        const name = String(item?.name || item?.ingredientName || item?.ingredient || '').trim().toLowerCase();
        return name && activeTargetName && name === activeTargetName.trim().toLowerCase();
      });
      if (itemIdx < 0) itemIdx = ingsList.findIndex(item => !item.ingredientId && !item.productId);
      if (itemIdx >= 0 && itemIdx < ingsList.length) {
        const item = typeof ingsList[itemIdx] === 'object' ? { ...ingsList[itemIdx] } : { name: String(ingsList[itemIdx]) };
        item.ingredientId = ingId; item.subtypeId = subtypeId || null;
        item.ingredientName = targetIng ? targetIng.name : item.ingredientName;
        item.subtypeName = targetSub ? targetSub.name : '';
        ingsList[itemIdx] = item;
      }
      rec.ingredients = ingsList; rec.updatedAt = new Date().toISOString();
      recipes[recIndex] = rec;
      if (typeof setRecipes === 'function') setRecipes(recipes);
      if (window.Store?.setState) window.Store.setState({ recipes });
      if (window.state) window.state.recipes = recipes;
      if (typeof window.recipes !== 'undefined') window.recipes = recipes;
      try { await saveRecipe(rec); } catch (e) {}
      document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: recipes }));
      document.dispatchEvent(new CustomEvent('plateplan:recipes-updated', { detail: recipes }));
    }
  } else if (activeTargetType === 'subtype' && targetIng) {
    try { await reparentSubtype(activeTargetId, targetIng.id); } catch (e) {}
  } else if (activeTargetType === 'ingredient' && targetIng && String(activeTargetId) !== String(targetIng.id)) {
    try { await mergeIngredients(activeTargetId, targetIng.id); } catch (e) {}
  }
  closeResolveUnlinkedModal();
}

export function filterResolveLinkProducts(query) {
  const container = document.getElementById('resolve-link-results');
  if (!container) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) { container.style.display = 'none'; return; }
  const matches = safeGetProducts().filter(p => String(p.name || '').toLowerCase().includes(q) || String(p.brand || '').toLowerCase().includes(q)).slice(0, 10);
  container.style.display = 'block';
  if (!matches.length) {
    container.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text3,#a8a29e);text-align:center">No matching products found.</div>';
    return;
  }
  container.innerHTML = matches.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border,#e7e5e4)">
      <div>
        <div style="font-size:12.5px;font-weight:700;color:var(--text,#1c1917)">${safeEscapeHtml(p.name)}</div>
        <div style="font-size:11px;color:var(--text2,#78716c)">${safeEscapeHtml(p.brand || 'No brand')} · £${Number(p.price || 0).toFixed(2)}</div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="submitResolveLinkExisting('${safeEscapeAttr(p.id)}')">Link</button>
    </div>
  `).join('');
}

export async function submitResolveLinkExisting(productId) {
  const parentIngId = activeTargetType === 'subtype' ? activeParentIngredientId : activeTargetId;
  const subId = activeTargetType === 'subtype' ? activeTargetId : null;
  const existingProds = safeGetProducts(), prodIndex = existingProds.findIndex(p => String(p.id) === String(productId));
  if (prodIndex >= 0) {
    const updatedProd = { ...existingProds[prodIndex], ingredientId: parentIngId, subtypeId: subId, isAutoDefault: true, updatedAt: new Date().toISOString() };
    const updatedProds = [...existingProds]; updatedProds[prodIndex] = updatedProd;
    commitProductUpdates(updatedProds);
    try { await saveProduct(updatedProd); } catch (e) {}
  }
  if (typeof reallocateProduct === 'function') {
    try { await reallocateProduct(productId, parentIngId, subId); } catch (e) {}
  }
  closeResolveUnlinkedModal();
}

export const submitResolveLinkProduct = submitResolveLinkExisting;

export async function submitResolveTescoImport() {
  const txtArea = document.getElementById('resolve-tesco-json'), errDiv = document.getElementById('resolve-tesco-error');
  if (!txtArea || !errDiv) return;
  errDiv.style.display = 'none';
  const val = txtArea.value.trim();
  if (!val) { errDiv.textContent = 'Please paste Tesco bookmarklet JSON.'; errDiv.style.display = 'block'; return; }
  const res = parseTescoProduct(val);
  if (!res.success) { errDiv.textContent = res.error || 'Parsing error.'; errDiv.style.display = 'block'; return; }

  const state = safeGetState(), pData = res.data;
  const parentIngId = activeTargetType === 'subtype' ? activeParentIngredientId : activeTargetId;
  const subId = activeTargetType === 'subtype' ? activeTargetId : null;
  const targetIng = (state.ingredients || []).find(i => String(i.id) === String(parentIngId));

  const draftProduct = {
    name: pData.name,
    brand: pData.brand || 'Tesco',
    category: targetIng?.category || pData.category || pData.cat || 'General',
    storage: pData.storage || 'cupboard',
    cal: pData.cal || 0,
    prot: pData.prot || 0,
    carb: pData.carb || 0,
    fat: pData.fat || 0,
    fibre: pData.fibre || 0,
    price: pData.price || 0,
    pack: pData.packSize || pData.pack || 0,
    packUnit: pData.packUnit || 'g',
    itemWeight: pData.itemWeight || null,
    drainedWeight: pData.drainedWeight || null,
    notes: pData.notes || (pData.raw?.url ? `Tesco: ${pData.raw.url}` : ''),
    ingredientId: parentIngId,
    subtypeId: subId,
    isAutoDefault: true
  };

  closeResolveUnlinkedModal();
  window.__prefilledResolveBinding = { ingredientId: parentIngId, subtypeId: subId };
  openProductEditModal(draftProduct);
}

export function submitResolveNewProduct() {
  const parentIngId = activeTargetType === 'subtype' ? activeParentIngredientId : activeTargetId;
  const subId = activeTargetType === 'subtype' ? activeTargetId : null;
  const state = safeGetState();
  const targetIng = (state.ingredients || []).find(i => String(i.id) === String(parentIngId));
  const targetSub = subId ? (targetIng?.subtypes || []).find(s => String(s.id) === String(subId)) : null;

  closeResolveUnlinkedModal();
  window.__prefilledResolveBinding = { ingredientId: parentIngId, subtypeId: subId };
  openProductEditModal({
    name: targetSub?.name || targetIng?.name || '',
    category: targetIng?.category || 'General',
    ingredientId: parentIngId,
    subtypeId: subId,
    isAutoDefault: true
  });
}

if (typeof document !== 'undefined' && !window.__resolve_unlinked_action_bound) {
  window.__resolve_unlinked_action_bound = true;
  document.addEventListener('plateplan-action', (e) => {
    const { action, target, id } = e.detail || {};
    if (action === 'fix-recipe' || action === 'resolve-unlinked' || action === 'fix-issue') {
      const entityId = id || target?.dataset?.entityId || target?.dataset?.recipeId;
      const type = target?.dataset?.entityType || 'recipe';
      const parentId = target?.dataset?.parentId || null;
      if (entityId && typeof openResolveUnlinkedModal === 'function') {
        openResolveUnlinkedModal(entityId, type, parentId);
      }
    }
  });
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    safeGetProducts, commitProductUpdates, openResolveUnlinkedModal, closeResolveUnlinkedModal,
    filterResolveRemapOptions, submitResolveRemapTarget, filterResolveLinkProducts,
    submitResolveLinkExisting, submitResolveLinkProduct, submitResolveTescoImport, submitResolveNewProduct
  });
}
