/**
 * src/components/data-quality/HierarchyWizardModalUI.js (v3.19.58)
 */
import { getState, setIngredients } from '../../store/store.js';
import { saveIngredient, deleteIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { safeGetProducts, commitProductUpdates } from './ResolveUnlinkedModalUI.js';
import { parseTescoProduct } from '../../services/TescoImportService.js';

let wizardQueue = [], currentIndex = 0, isRenaming = false, isReorganising = false;
let selectedProductIdToLink = null, selectedParentIdToAssign = null, productSearchQuery = '', parentSearchQuery = '';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function closeHierarchyWizardModal() {
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  wizardQueue = []; currentIndex = 0; isRenaming = false; isReorganising = false;
  selectedProductIdToLink = null; selectedParentIdToAssign = null; productSearchQuery = ''; parentSearchQuery = '';
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildWizardQueue() {
  const state = window.Store?.getState?.() || getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = safeGetProducts(), queue = [];
  ingredients.forEach(ing => {
    const ingProds = products.filter(p => String(p.ingredientId) === String(ing.id));
    const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    if (ingProds.length === 0) queue.push({ id: ing.id, name: ing.name, category: ing.category || 'General', entityType: 'ingredient', subtypesCount: subtypes.length });
    subtypes.forEach(st => {
      if (!products.some(p => String(p.subtypeId) === String(st.id))) {
        queue.push({ id: st.id, name: st.name, category: ing.category || 'General', entityType: 'subtype', parentId: ing.id, parentName: ing.name });
      }
    });
  });
  return queue;
}

export async function ensureDefaultSubtype(ingredientId) {
  const state = window.Store?.getState?.() || getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const idx = ingredients.findIndex(i => String(i.id) === String(ingredientId));
  if (idx === -1) return null;
  const ing = { ...ingredients[idx] };
  if (!Array.isArray(ing.subtypes)) ing.subtypes = [];
  if (ing.subtypes.length === 0) {
    const newSub = { id: `sub_${Date.now()}`, name: ing.name, isDefault: true, parentId: ing.id, aliases: [], createdAt: new Date().toISOString() };
    ing.subtypes = [newSub]; ing.updatedAt = new Date().toISOString(); ingredients[idx] = ing;
    if (typeof setIngredients === 'function') setIngredients(ingredients);
    if (window.Store?.setState) window.Store.setState({ ingredients });
    try { await saveIngredient(ing); } catch (e) {}
    document.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: ingredients }));
    return newSub;
  }
  return ing.subtypes[0];
}

async function resolveContext() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem) return null;
  let parentId = currentItem.entityType === 'subtype' ? currentItem.parentId : currentItem.id;
  let subtypeId = currentItem.entityType === 'subtype' ? currentItem.id : null;
  if (currentItem.entityType === 'ingredient' && currentItem.subtypesCount === 0) {
    const sub = await ensureDefaultSubtype(currentItem.id);
    if (sub) subtypeId = sub.id;
  }
  return { currentItem, parentId, subtypeId };
}

export function startWizardInlineRename() { isRenaming = true; isReorganising = false; renderWizardStep(); }
export function startWizardInlineReorganise() { isReorganising = true; isRenaming = false; renderWizardStep(); }
export function cancelWizardInlineAction() { isRenaming = false; isReorganising = false; renderWizardStep(); }

export async function submitWizardInlineRename() {
  const newName = document.getElementById('wizard-inline-rename-input')?.value?.trim();
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem || !newName || newName === currentItem.name) { cancelWizardInlineAction(); return; }
  const state = window.Store?.getState?.() || getState() || {};
  const ings = (state.ingredients || []).map(i => {
    if (String(i.id) === String(currentItem.id)) {
      const updated = { ...i, name: newName, updatedAt: new Date().toISOString() };
      saveIngredient(updated);
      return updated;
    }
    return i;
  });
  if (typeof setIngredients === 'function') setIngredients(ings);
  if (window.Store?.setState) window.Store.setState({ ingredients: ings });
  currentItem.name = newName; isRenaming = false; renderWizardStep();
}

export function toggleCreateParentMode(show) {
  const searchBox = document.getElementById('wizard-parent-search-box');
  const createBox = document.getElementById('wizard-create-parent-box');
  if (searchBox) searchBox.style.display = show ? 'none' : 'block';
  if (createBox) createBox.style.display = show ? 'flex' : 'none';
}

export function handleWizardParentSearch(query) {
  parentSearchQuery = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-parent-search-results');
  if (!container) return;
  const currentItem = wizardQueue[currentIndex];
  const state = window.Store?.getState?.() || getState() || {};
  const candidates = (state.ingredients || []).filter(i => String(i.id) !== String(currentItem?.id));
  const filtered = candidates.filter(i => !parentSearchQuery || String(i.name || '').toLowerCase().includes(parentSearchQuery) || String(i.category || '').toLowerCase().includes(parentSearchQuery)).slice(0, 8);
  if (!filtered.length) { container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching parent ingredients found.</div>`; return; }
  container.innerHTML = filtered.map(c => {
    const isSelected = String(c.id) === String(selectedParentIdToAssign);
    return `<div class="wizard-parent-item" data-id="${escapeAttr(c.id)}" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;border-radius:6px;cursor:pointer;background:${isSelected ? '#e0e7ff' : '#fff'};border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};"><span style="font-size:12px;font-weight:600;">${escapeHtml(c.name)}</span><span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2);">${escapeHtml(c.category || 'General')}</span></div>`;
  }).join('');
  container.querySelectorAll('.wizard-parent-item').forEach(el => {
    el.onclick = () => {
      selectedParentIdToAssign = el.dataset.id;
      handleWizardParentSearch(parentSearchQuery);
      const btn = document.getElementById('wizard-assign-parent-btn');
      if (btn) btn.disabled = false;
    };
  });
}

export function handleWizardCategorySearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-category-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const categories = Array.isArray(state.categories) && state.categories.length ? state.categories : ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'General'];
  const filtered = categories.filter(c => !q || String(c).toLowerCase().includes(q));
  if (!filtered.length) {
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching categories found.</div>`;
    container.style.display = 'block';
    return;
  }
  container.innerHTML = filtered.map(c => `<div class="wizard-category-item" data-category="${escapeAttr(c)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#eee);">${escapeHtml(c)}</div>`).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-category-item').forEach(el => {
    el.onclick = () => {
      const cat = el.dataset.category;
      const input = document.getElementById('wizard-category-search-input');
      if (input) { input.value = cat; input.dataset.categoryId = cat; }
      container.style.display = 'none';
    };
  });
}

export async function submitWizardInlineReorganise() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem || !selectedParentIdToAssign) { cancelWizardInlineAction(); return; }
  const state = window.Store?.getState?.() || getState() || {};
  const allIngredients = state.ingredients || [];
  const targetParent = allIngredients.find(i => String(i.id) === String(selectedParentIdToAssign));
  if (!targetParent) return;
  const newSubtype = { id: `sub_${Date.now()}`, name: currentItem.name, isDefault: false, createdAt: new Date().toISOString() };
  targetParent.subtypes = targetParent.subtypes || [];
  targetParent.subtypes.push(newSubtype);
  const updatedProducts = safeGetProducts().map(p => String(p.ingredientId) === String(currentItem.id) ? { ...p, subtypeId: newSubtype.id, subTypeId: newSubtype.id, ingredientId: targetParent.id } : p);
  const updatedIngredients = allIngredients.filter(i => String(i.id) !== String(currentItem.id));
  if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
  if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients, products: updatedProducts });
  await saveIngredient(targetParent);
  await deleteIngredient(currentItem.id);
  await commitProductUpdates(updatedProducts);
  advanceHierarchyWizardStep();
}

export async function handleCreateParentAndAssignSubtype(currentIngId) {
  const parentName = document.getElementById('wizard-new-parent-name')?.value?.trim();
  const catInput = document.getElementById('wizard-category-search-input');
  const currentItem = wizardQueue[currentIndex] || { id: currentIngId, name: 'Item', entityType: 'ingredient', category: 'General' };
  const parentCat = catInput?.value?.trim() || catInput?.dataset?.categoryId || currentItem.category || 'General';
  if (!parentName) { alert('Please enter a parent ingredient name.'); return; }
  const newSubtype = { id: `sub_${Date.now()}`, name: currentItem.name, isDefault: false, createdAt: new Date().toISOString() };
  const newParent = { id: `ing_${Date.now()}`, name: parentName, category: parentCat, subtypes: [newSubtype], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const state = window.Store?.getState?.() || getState() || {};
  const updatedIngredients = [...(state.ingredients || []).filter(i => String(i.id) !== String(currentIngId)), newParent];
  const updatedProducts = safeGetProducts().map(p => String(p.ingredientId) === String(currentIngId) ? { ...p, subtypeId: newSubtype.id, subTypeId: newSubtype.id, ingredientId: newParent.id } : p);
  if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
  if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients, products: updatedProducts });
  await saveIngredient(newParent);
  await deleteIngredient(currentIngId);
  await commitProductUpdates(updatedProducts);
  if (typeof window.refreshHierarchyWizardStep === 'function') window.refreshHierarchyWizardStep();
  else advanceHierarchyWizardStep();
}

export function handleWizardProductSearch(query) {
  productSearchQuery = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-product-results-list');
  if (!container) return;
  const filtered = safeGetProducts().filter(p => !productSearchQuery || String(p.name || '').toLowerCase().includes(productSearchQuery) || String(p.brand || '').toLowerCase().includes(productSearchQuery)).slice(0, 10);
  if (!filtered.length) { container.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:6px;text-align:center;">No matching products found.</div>`; return; }
  container.innerHTML = filtered.map(p => {
    const isSelected = String(p.id) === String(selectedProductIdToLink);
    return `<div class="wizard-prod-item" data-id="${escapeAttr(p.id)}" style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;cursor:pointer;background:${isSelected ? '#e0e7ff' : '#fff'};border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};"><div><div style="font-size:12.5px;font-weight:650;">${escapeHtml(p.name)}</div><div style="font-size:11px;color:var(--text2);">${escapeHtml(p.brand || 'Generic')} · ${p.pack || ''}${escapeHtml(p.packUnit || 'g')}</div></div><div style="font-size:12.5px;font-weight:700;color:var(--green);">£${Number(p.price || 0).toFixed(2)}</div></div>`;
  }).join('');
  container.querySelectorAll('.wizard-prod-item').forEach(el => {
    el.onclick = () => {
      selectedProductIdToLink = el.dataset.id;
      handleWizardProductSearch(productSearchQuery);
      const btn = document.getElementById('wizard-link-selected-btn');
      if (btn) btn.disabled = false;
    };
  });
}

export async function handleWizardLinkSelectedProduct() {
  if (!selectedProductIdToLink) return;
  const ctx = await resolveContext();
  if (!ctx) return;
  const existingProds = safeGetProducts();
  const prodIndex = existingProds.findIndex(p => String(p.id) === String(selectedProductIdToLink));
  if (prodIndex >= 0) {
    const updatedProd = { ...existingProds[prodIndex], ingredientId: ctx.parentId, subtypeId: ctx.subtypeId, isAutoDefault: true, updatedAt: new Date().toISOString() };
    const updated = [...existingProds]; updated[prodIndex] = updatedProd;
    commitProductUpdates(updated);
    try { await saveProduct(updatedProd); } catch (e) {}
  }
  selectedProductIdToLink = null; advanceHierarchyWizardStep();
}

export async function handleWizardTescoImport(subTypeId, ingredientId) {
  const val = document.getElementById('wizard-tesco-json-input')?.value?.trim();
  if (!val) return;
  try {
    const res = parseTescoProduct(val);
    const pData = res.success ? res.data : JSON.parse(val);
    if (!pData || !pData.name) throw new Error('Invalid product structure.');
    const ctx = await resolveContext();
    const newProduct = {
      id: `prod_${Date.now()}`, name: pData.name, brand: pData.brand || 'Tesco', price: Number(pData.price) || 0,
      pack: Number(pData.packSize || pData.pack || pData.size) || 100, packUnit: pData.packUnit || 'g',
      category: ctx?.currentItem?.category || pData.cat || 'General', storage: pData.storage || 'cupboard',
      cal: Number(pData.cal) || 0, prot: Number(pData.prot) || 0, carb: Number(pData.carb) || 0, fat: Number(pData.fat) || 0,
      subtypeId: subTypeId || ctx?.subtypeId, subTypeId: subTypeId || ctx?.subtypeId, ingredientId: ingredientId || ctx?.parentId,
      isAutoDefault: true, updatedAt: new Date().toISOString()
    };
    commitProductUpdates([...safeGetProducts(), newProduct]);
    try { await saveProduct(newProduct); } catch (e) {}
    advanceHierarchyWizardStep();
  } catch (err) { console.error('[HierarchyWizard] Tesco import error:', err); }
}

export async function handleWizardOpenAddProduct() {
  const ctx = await resolveContext();
  if (!ctx) return;
  window.__prefilledResolveBinding = { ingredientId: ctx.parentId, subtypeId: ctx.subtypeId, subtypeDraftName: ctx.currentItem.name, parentCategory: ctx.currentItem.category || 'General' };
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  const onResume = () => {
    document.removeEventListener('plateplan:state:products', onResume);
    if (overlay) overlay.style.display = 'flex';
    wizardQueue = buildWizardQueue();
    if (currentIndex >= wizardQueue.length) currentIndex = Math.max(0, wizardQueue.length - 1);
    renderWizardStep();
  };
  document.addEventListener('plateplan:state:products', onResume, { once: true });
  if (typeof window.openProductEditModal === 'function') window.openProductEditModal(null);
  else if (typeof window.showAddIng === 'function') window.showAddIng();
}

export function skipWizardStep() {
  if (currentIndex < wizardQueue.length - 1) { wizardQueue.push(wizardQueue.splice(currentIndex, 1)[0]); renderWizardStep(); }
  else advanceHierarchyWizardStep();
}

export async function bulkProvisionAllDefaults() {
  const btn = document.getElementById('wizard-bulk-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Bulk Provisioning...'; }
  const state = window.Store?.getState?.() || getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  let products = safeGetProducts();
  const createdProducts = [], modifiedIngredients = [];
  ingredients.forEach((ing) => {
    let changed = false;
    if (!Array.isArray(ing.subtypes) || !ing.subtypes.length) {
      ing.subtypes = [{ id: `sub_${Date.now()}`, name: ing.name, isDefault: true, parentId: ing.id, aliases: [], createdAt: new Date().toISOString() }];
      ing.updatedAt = new Date().toISOString(); changed = true;
    }
    if (!products.some(p => String(p.ingredientId) === String(ing.id))) {
      const shell = { id: `prod_${Date.now()}`, name: ing.name, brand: 'Standard', category: ing.category || 'General', storage: 'cupboard', cal: 100, prot: 5, carb: 10, fat: 2, price: 1.00, pack: 100, packUnit: 'g', ingredientId: ing.id, subtypeId: ing.subtypes[0]?.id || null, isAutoDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(shell); createdProducts.push(shell);
    }
    if (changed) modifiedIngredients.push(ing);
  });
  if (typeof setIngredients === 'function') setIngredients(ingredients);
  if (window.Store?.setState) window.Store.setState({ ingredients });
  await commitProductUpdates(products);
  for (const ing of modifiedIngredients) { try { await saveIngredient(ing); } catch (e) {} }
  for (const prod of createdProducts) { try { await saveProduct(prod); } catch (e) {} }
  wizardQueue = []; renderWizardComplete();
}

export function advanceHierarchyWizardStep() {
  isRenaming = false; isReorganising = false;
  selectedProductIdToLink = null; selectedParentIdToAssign = null; productSearchQuery = ''; parentSearchQuery = '';
  if (++currentIndex >= wizardQueue.length) renderWizardComplete(); else renderWizardStep();
}

export const refreshHierarchyWizardStep = () => renderWizardStep();

export function renderWizardStep() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  if (wizardQueue.length === 0 || currentIndex >= wizardQueue.length) { renderWizardComplete(); return; }
  const item = wizardQueue[currentIndex], total = wizardQueue.length, stepNum = currentIndex + 1;
  const pct = Math.round((stepNum / total) * 100);

  card.innerHTML = `
    <div style="flex-shrink:0;padding:12px 16px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div><h3 style="margin:0;font-size:16px;font-weight:750">🪄 Hierarchy Alignment Wizard</h3><div style="font-size:11px;color:var(--text2);margin-top:2px">Step ${stepNum} of ${total}</div></div>
      <button type="button" class="btn sm ghost" onclick="window.closeHierarchyWizardModal()" style="font-size:18px;line-height:1">&times;</button>
    </div>
    <div style="flex-shrink:0;width:100%;background:#e5e7eb;height:4px;overflow:hidden"><div style="width:${pct}%;background:var(--primary);height:100%;"></div></div>
    <div class="wizard-modal-body" style="flex:1 1 auto;overflow-y:auto;min-height:0;padding:14px">
      <div style="background:var(--surface2);border-radius:10px;padding:10px;border:1px solid var(--border);margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1"><div style="font-size:10.5px;color:var(--text3);text-transform:uppercase;font-weight:700">Unlinked ${item.entityType === 'subtype' ? 'Sub-type' : 'Core Ingredient'}</div><div style="font-size:15px;font-weight:750;margin-top:1px">${escapeHtml(item.name)}</div><div style="font-size:11px;color:var(--text2);margin-top:2px">Category: <strong>${escapeHtml(item.category)}</strong>${item.parentName ? ` · Parent: <strong>${escapeHtml(item.parentName)}</strong>` : ''}</div></div>
          <div style="display:flex;gap:4px"><button type="button" class="btn xs ghost" onclick="window.startWizardInlineRename()">✏️ Rename</button>${item.entityType === 'ingredient' ? `<button type="button" class="btn xs ghost" onclick="window.startWizardInlineReorganise()">⬇️ Reorganise as Sub-type</button>` : ''}</div>
        </div>
        ${isRenaming ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)"><input type="text" id="wizard-inline-rename-input" value="${escapeAttr(item.name)}" style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;" /><button type="button" class="btn sm primary" onclick="window.submitWizardInlineRename()">Save</button><button type="button" class="btn sm ghost" onclick="window.cancelWizardInlineAction()">Cancel</button></div>` : ''}
        ${isReorganising ? `
          <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:11px;font-weight:650">Select or Create Parent:</span>
              <button type="button" class="btn xs ghost" onclick="window.toggleCreateParentMode(true)">➕ New Parent</button>
            </div>
            <div id="wizard-parent-search-box" style="display:block">
              <input type="text" id="wizard-parent-search-input" placeholder="🔍 Search parent core ingredients..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" oninput="window.handleWizardParentSearch(this.value)" />
              <div id="wizard-parent-search-results" style="max-height:90px;overflow-y:auto;margin:4px 0;display:flex;flex-direction:column;gap:3px"></div>
              <div style="display:flex;gap:6px">
                <button type="button" class="btn sm primary" id="wizard-assign-parent-btn" style="flex:1" onclick="window.submitWizardInlineReorganise()" ${selectedParentIdToAssign ? '' : 'disabled'}>Assign Sub-type</button>
                <button type="button" class="btn sm ghost" onclick="window.cancelWizardInlineAction()">Cancel</button>
              </div>
            </div>
            <div id="wizard-create-parent-box" style="display:none;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px;margin-top:4px">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
                <input type="text" id="wizard-new-parent-name" placeholder="Parent Name..." style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px" />
                <div style="position:relative">
                  <input type="text" id="wizard-category-search-input" value="${escapeAttr(item.category || '')}" placeholder="Search category..." oninput="window.handleWizardCategorySearch(this.value)" onfocus="window.handleWizardCategorySearch(this.value)" autocomplete="off" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" />
                  <div id="wizard-category-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:140px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                <button type="button" class="btn sm primary" style="flex:1" onclick="window.handleCreateParentAndAssignSubtype('${escapeAttr(item.id)}')">Create &amp; Assign</button>
                <button type="button" class="btn sm ghost" onclick="window.toggleCreateParentMode(false)">Cancel</button>
              </div>
            </div>
          </div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
        <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid var(--border)"><div style="font-size:12.5px;font-weight:700;margin-bottom:4px">🔗 1. Link Product from Product Bank</div><input type="text" id="wizard-product-search-input" placeholder="🔍 Search product name or brand..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" oninput="window.handleWizardProductSearch(this.value)" /><div id="wizard-product-results-list" style="max-height:90px;overflow-y:auto;margin:4px 0;display:flex;flex-direction:column;gap:3px"></div><button type="button" class="btn sm primary" id="wizard-link-selected-btn" style="width:100%" onclick="window.handleWizardLinkSelectedProduct()" ${selectedProductIdToLink ? '' : 'disabled'}>Link Selected Product</button></div>
        <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid var(--border)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">🛒 2. Import from Tesco</span><a href="https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(item.name)}" target="_blank" rel="noopener noreferrer" style="color:#007aff;text-decoration:underline;font-size:12px;">Search on Tesco ↗</a></div><textarea id="wizard-tesco-json-input" placeholder='Paste raw JSON...' style="width:100%;height:32px;font-family:monospace;font-size:11px;padding:4px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box"></textarea><button type="button" class="btn sm ghost" style="width:100%;margin-top:2px" onclick="window.handleWizardTescoImport()">Parse &amp; Link Product</button></div>
        <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px"><div><div style="font-size:12.5px;font-weight:700">✨ 3. Create Custom Product</div><div style="font-size:11px;color:var(--text2)">Opens product form pre-filled.</div></div><button type="button" class="btn sm primary" onclick="window.handleWizardOpenAddProduct()">➕ Add Product</button></div>
      </div>
    </div>
    <div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:#fff">
      <button type="button" class="btn sm" id="wizard-bulk-btn" style="background:rgba(16,185,129,0.1);color:var(--green);font-weight:700" onclick="window.bulkProvisionAllDefaults()">⚡ Bulk Provision</button>
      <div style="display:flex;gap:6px"><button type="button" class="btn sm ghost" onclick="window.skipWizardStep()">Skip &rarr;</button><button type="button" class="btn sm" onclick="window.closeHierarchyWizardModal()">Exit</button></div>
    </div>
  `;
  window.handleWizardProductSearch('');
  if (isReorganising) window.handleWizardParentSearch('');
}

function renderWizardComplete() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  card.innerHTML = `<div style="padding:24px 16px;text-align:center"><div style="font-size:40px;margin-bottom:8px">🎉</div><h3 style="font-size:17px;font-weight:750;margin:0 0 4px 0">All Items Aligned!</h3><p style="font-size:12.5px;color:var(--text2);margin:0 0 16px 0">All items provisioned with mapped products.</p><button type="button" class="btn primary" style="padding:0 20px;font-weight:700;font-size:13px" onclick="window.closeHierarchyWizardModal()">Done</button></div>`;
}

export function openHierarchyWizardModal() {
  wizardQueue = buildWizardQueue();
  currentIndex = 0; isRenaming = false; isReorganising = false;
  selectedProductIdToLink = null; selectedParentIdToAssign = null; productSearchQuery = ''; parentSearchQuery = '';
  const existing = document.getElementById('hierarchy-wizard-modal-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'hierarchy-wizard-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  const card = document.createElement('div');
  card.id = 'hierarchy-wizard-modal-card';
  card.style.cssText = 'background:#ffffff;border-radius:20px;width:100%;max-width:640px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.2);overflow:hidden;';
  overlay.appendChild(card);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  renderWizardStep();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    openHierarchyWizardModal, closeHierarchyWizardModal, startWizardInlineRename, submitWizardInlineRename,
    startWizardInlineReorganise, submitWizardInlineReorganise, toggleCreateParentMode, handleCreateParentAndAssignSubtype,
    cancelWizardInlineAction, handleWizardParentSearch, handleWizardCategorySearch, handleWizardProductSearch,
    handleWizardLinkSelectedProduct, handleWizardTescoImport, handleWizardOpenAddProduct, refreshHierarchyWizardStep,
    advanceHierarchyWizardStep, skipWizardStep, bulkProvisionAllDefaults
  });
}