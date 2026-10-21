/**
 * src/components/data-quality/ResolveUnlinkedModalUI.js (v3.38.72)
 * Multi-Path Resolution Modal UI component for unlinked ingredients, sub-types, and recipe items.
 * Strictly modular (<350 lines).
 */

import { getState, setProducts, setRecipes } from '../../store/store.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { reallocateProduct, reparentSubtype, mergeIngredients } from '../../models/PantryHierarchyModel.js';
import { parseTescoProduct } from '../../services/TescoImportService.js';
import { openProductEditModal } from '../../views/ProductBankView.js';
import { renderResolveModalShell, renderRemapMatchRow, renderLinkProductRow } from './ResolveUnlinkedModalRenderService.js';

let activeTargetId = null, activeTargetType = 'ingredient', activeParentIngredientId = null, activeRecipeId = null, activeRecipeItemIndex = null, activeTargetName = '';

const MAX_MATCHES = 15;

const safeGetState = () => (typeof window !== 'undefined' ? (window.Store?.getState?.() ) : {});

export function safeGetProducts() {
  const st = safeGetState();
  if (Array.isArray(st.products) && st.products.length > 0) return [...st.products];
  if (Array.isArray(st.pantry?.products) && st.pantry.products.length > 0) return [...st.pantry.products];
  if (getState() && Array.isArray(getState().products) && getState().products.length > 0) return [...getState().products];
  return [];
}

export function commitProductUpdates(updatedProducts) {
  if (typeof setProducts === 'function') setProducts(updatedProducts);
  if (window.Store?.setState) window.Store.setState({ products: updatedProducts });
  if (getState()) getState().products = updatedProducts;
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

  return renderResolveModalShell({ targetName, searchTerm, tescoSearchUrl });
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

  const matches = q ? options.filter(o => o.label.toLowerCase().includes(q)).slice(0, MAX_MATCHES) : options.slice(0, MAX_MATCHES);
  container.style.display = 'block';
  if (!matches.length) {
    container.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text3,#a8a29e);text-align:center">No matching ingredients found.</div>';
    return;
  }
  container.innerHTML = matches.map(opt => renderRemapMatchRow(opt)).join('');
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
      if (getState()) getState().recipes = recipes;
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
  container.innerHTML = matches.map(p => renderLinkProductRow(p)).join('');
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
      const issueKey = target?.dataset?.issueKey || target?.getAttribute('data-issue-key') || '';
      if (issueKey && (issueKey.startsWith('advisory:') || issueKey.includes('recipe-macro-sync') || issueKey.includes('recipe-low-cal') || issueKey.includes('macro-sync'))) {
        const recipeId = issueKey.split(':').pop() || id || target?.dataset?.entityId;
        if (typeof window.autoRecalibrateRecipeMacros === 'function') {
          window.autoRecalibrateRecipeMacros(recipeId);
        }
        return; // CRITICAL: Early-return block to catch advisory issue keys before falling through
      }
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
