/**
 * src/components/data-quality/HierarchyWizardModalUI.js (v3.19.59)
 */
import { getState, setIngredients } from '../../store/store.js';
import { saveIngredient, deleteIngredient, saveProduct, deleteProduct } from '../../services/HouseholdRepository.js';
import { safeGetProducts, commitProductUpdates } from './ResolveUnlinkedModalUI.js';
import { parseTescoProduct } from '../../services/TescoImportService.js';

let wizardQueue = [], currentIndex = 0, isRenaming = false, isMerging = false;
let selectedSubtypeIdToBind = null, selectedMergeTargetId = null;

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function closeHierarchyWizardModal() {
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  wizardQueue = []; currentIndex = 0; isRenaming = false; isMerging = false;
  selectedSubtypeIdToBind = null; selectedMergeTargetId = null;
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildWizardQueue() {
  const state = window.Store?.getState?.() || getState() || {};
  const products = safeGetProducts();
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const queue = [];

  products.forEach(p => {
    const hasIng = p.ingredientId && ingredients.some(i => String(i.id) === String(p.ingredientId));
    const hasSub = p.subtypeId || p.subTypeId;
    if (!hasIng || !hasSub) {
      queue.push({
        id: p.id, name: p.name, brand: p.brand || 'Generic', price: p.price || 0,
        pack: p.pack || 100, packUnit: p.packUnit || 'g', category: p.category || 'General', entityType: 'product'
      });
    }
  });

  ingredients.forEach(ing => {
    const ingProds = products.filter(p => String(p.ingredientId) === String(ing.id));
    if (ingProds.length === 0) queue.push({ id: ing.id, name: ing.name, category: ing.category || 'General', entityType: 'ingredient' });
  });

  return queue;
}

export function startWizardInlineRename() { isRenaming = true; isMerging = false; renderWizardStep(); }
export function toggleWizardMergePanel(show) { isMerging = show; isRenaming = false; renderWizardStep(); }
export function cancelWizardInlineAction() { isRenaming = false; isMerging = false; renderWizardStep(); }

export async function submitWizardInlineRename() {
  const newName = document.getElementById('wizard-inline-rename-input')?.value?.trim();
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem || !newName || newName === currentItem.name) { cancelWizardInlineAction(); return; }
  const state = window.Store?.getState?.() || getState() || {};
  
  if (currentItem.entityType === 'product') {
    const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p);
    commitProductUpdates(products);
    try { await saveProduct(products.find(p => String(p.id) === String(currentItem.id))); } catch (e) {}
  } else {
    const ings = (state.ingredients || []).map(i => String(i.id) === String(currentItem.id) ? { ...i, name: newName, updatedAt: new Date().toISOString() } : i);
    if (typeof setIngredients === 'function') setIngredients(ings);
    if (window.Store?.setState) window.Store.setState({ ingredients: ings });
    try { await saveIngredient(ings.find(i => String(i.id) === String(currentItem.id))); } catch (e) {}
  }
  currentItem.name = newName; isRenaming = false; renderWizardStep();
}

export function handleWizardSubtypeSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-subtype-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const options = [];
  (state.ingredients || []).forEach(ing => {
    const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    if (!subTypes.length) options.push({ id: ing.id, name: `${ing.name} (Core)`, ingredientId: ing.id, subtypeId: null, category: ing.category });
    subTypes.forEach(st => options.push({ id: st.id, name: `${ing.name} › ${st.name}`, ingredientId: ing.id, subtypeId: st.id, category: ing.category }));
  });
  const filtered = options.filter(o => !q || String(o.name).toLowerCase().includes(q) || String(o.category).toLowerCase().includes(q)).slice(0, 8);
  if (!filtered.length) { container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching ingredients or sub-types.</div>`; container.style.display = 'block'; return; }
  container.innerHTML = filtered.map(o => `<div class="wizard-subtype-item" data-ing-id="${escapeAttr(o.ingredientId)}" data-sub-id="${escapeAttr(o.subtypeId || '')}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;"><span style="font-weight:600">${escapeHtml(o.name)}</span><span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2)">${escapeHtml(o.category || 'General')}</span></div>`).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-subtype-item').forEach(el => {
    el.onclick = () => {
      selectedSubtypeIdToBind = el.dataset.subId || 'true';
      const input = document.getElementById('wizard-subtype-search-input');
      if (input) { input.value = el.querySelector('span')?.textContent || ''; input.dataset.ingredientId = el.dataset.ingId; input.dataset.subtypeId = el.dataset.subId || ''; }
      container.style.display = 'none';
      const btn = document.getElementById('wizard-bind-subtype-btn');
      if (btn) btn.disabled = false;
    };
  });
}

export async function handleWizardBindSubtype() {
  const input = document.getElementById('wizard-subtype-search-input');
  const ingredientId = input?.dataset?.ingredientId;
  let subtypeId = input?.dataset?.subtypeId;
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem || !ingredientId) { alert('Please select a valid core ingredient or sub-type.'); return; }
  const state = window.Store?.getState?.() || getState() || {};
  const parentIng = (state.ingredients || []).find(i => String(i.id) === String(ingredientId));
  if (!parentIng) return;
  if (!subtypeId) {
    if (!Array.isArray(parentIng.subtypes) || !parentIng.subtypes.length) {
      const newSub = { id: `sub_${Date.now()}`, name: parentIng.name, isDefault: true, createdAt: new Date().toISOString() };
      parentIng.subtypes = [newSub]; subtypeId = newSub.id;
      saveIngredient(parentIng);
    } else subtypeId = parentIng.subtypes[0].id;
  }
  if (currentItem.entityType === 'product') {
    const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? { ...p, ingredientId, subtypeId, subTypeId: subtypeId, isAutoDefault: false, updatedAt: new Date().toISOString() } : p);
    commitProductUpdates(products);
    try { await saveProduct(products.find(p => String(p.id) === String(currentItem.id))); } catch (e) {}
  } else {
    const products = safeGetProducts().map(p => String(p.ingredientId) === String(currentItem.id) ? { ...p, ingredientId, subtypeId, subTypeId: subtypeId } : p);
    commitProductUpdates(products);
    try { await deleteIngredient(currentItem.id); } catch (e) {}
  }
  advanceHierarchyWizardStep();
}

export function handleWizardMergeSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-merge-search-results');
  if (!container) return;
  const currentItem = wizardQueue[currentIndex];
  const state = window.Store?.getState?.() || getState() || {};
  const filtered = (state.ingredients || []).filter(i => String(i.id) !== String(currentItem?.id) && (!q || String(i.name).toLowerCase().includes(q))).slice(0, 8);
  if (!filtered.length) { container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching target items found.</div>`; container.style.display = 'block'; return; }
  container.innerHTML = filtered.map(i => `<div class="wizard-merge-item" data-id="${escapeAttr(i.id)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;"><span style="font-weight:600">${escapeHtml(i.name)}</span><span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2)">${escapeHtml(i.category || 'General')}</span></div>`).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-merge-item').forEach(el => {
    el.onclick = () => {
      selectedMergeTargetId = el.dataset.id;
      const input = document.getElementById('wizard-merge-target-input');
      if (input) { input.value = el.querySelector('span')?.textContent || ''; input.dataset.targetId = el.dataset.id; }
      container.style.display = 'none';
      const btn = document.getElementById('wizard-confirm-merge-btn');
      if (btn) btn.disabled = false;
    };
  });
}

export async function handleWizardMergeItems() {
  const currentItem = wizardQueue[currentIndex];
  const targetId = selectedMergeTargetId;
  if (!currentItem || !targetId) { alert('Please select a target item to merge into.'); return; }
  const state = window.Store?.getState?.() || getState() || {};
  const targetIng = (state.ingredients || []).find(i => String(i.id) === String(targetId));
  if (!targetIng) return;
  if (currentItem.entityType === 'ingredient') {
    const sourceIng = (state.ingredients || []).find(i => String(i.id) === String(currentItem.id));
    if (sourceIng) {
      targetIng.subtypes = [...(targetIng.subtypes || []), ...(sourceIng.subtypes || [])];
      saveIngredient(targetIng);
      const products = safeGetProducts().map(p => String(p.ingredientId) === String(currentItem.id) ? { ...p, ingredientId: targetIng.id } : p);
      commitProductUpdates(products);
      await deleteIngredient(currentItem.id);
    }
  } else if (currentItem.entityType === 'product') {
    try { await deleteProduct(currentItem.id); } catch (e) {}
  }
  advanceHierarchyWizardStep();
}

export function handleWizardCategorySearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-category-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const categories = Array.isArray(state.categories) && state.categories.length ? state.categories : ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'General'];
  const filtered = categories.filter(c => !q || String(c).toLowerCase().includes(q));
  if (!filtered.length) { container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching categories.</div>`; container.style.display = 'block'; return; }
  container.innerHTML = filtered.map(c => `<div class="wizard-category-item" data-category="${escapeAttr(c)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border)">${escapeHtml(c)}</div>`).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-category-item').forEach(el => {
    el.onclick = () => {
      const input = document.getElementById('wizard-category-search-input');
      if (input) { input.value = el.dataset.category; input.dataset.categoryId = el.dataset.category; }
      container.style.display = 'none';
    };
  });
}

export async function handleCreateParentAndAssignSubtype(currentIngId) {
  const parentName = document.getElementById('wizard-new-parent-name')?.value?.trim();
  const catInput = document.getElementById('wizard-category-search-input');
  const currentItem = wizardQueue[currentIndex] || { id: currentIngId, name: 'Item', entityType: 'product', category: 'General' };
  const parentCat = catInput?.value?.trim() || catInput?.dataset?.categoryId || currentItem.category || 'General';
  if (!parentName) { alert('Please enter a parent ingredient name.'); return; }
  const newSubtype = { id: `sub_${Date.now()}`, name: currentItem.name, isDefault: false, createdAt: new Date().toISOString() };
  const newParent = { id: `ing_${Date.now()}`, name: parentName, category: parentCat, subtypes: [newSubtype], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const state = window.Store?.getState?.() || getState() || {};
  const updatedIngredients = [...(state.ingredients || []), newParent];
  if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
  if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients });
  await saveIngredient(newParent);
  if (currentItem.entityType === 'product') {
    const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? { ...p, ingredientId: newParent.id, subtypeId: newSubtype.id, subTypeId: newSubtype.id, isAutoDefault: false, updatedAt: new Date().toISOString() } : p);
    commitProductUpdates(products);
    try { await saveProduct(products.find(p => String(p.id) === String(currentItem.id))); } catch (e) {}
  }
  advanceHierarchyWizardStep();
}

export async function handleWizardTescoImport() {
  const val = document.getElementById('wizard-tesco-json-input')?.value?.trim();
  if (!val) return;
  try {
    const res = parseTescoProduct(val);
    const pData = res.success ? res.data : JSON.parse(val);
    if (!pData || !pData.name) throw new Error('Invalid product structure.');
    const currentItem = wizardQueue[currentIndex];
    if (currentItem?.entityType === 'product') {
      const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
        ...p, name: pData.name, brand: pData.brand || p.brand, price: Number(pData.price) || p.price,
        pack: Number(pData.packSize || pData.pack || pData.size) || p.pack, packUnit: pData.packUnit || p.packUnit, updatedAt: new Date().toISOString()
      } : p);
      commitProductUpdates(products);
      try { await saveProduct(products.find(p => String(p.id) === String(currentItem.id))); } catch (e) {}
      advanceHierarchyWizardStep();
    }
  } catch (err) { console.error('[HierarchyWizard] Tesco import error:', err); }
}

export function skipWizardStep() {
  if (currentIndex < wizardQueue.length - 1) { wizardQueue.push(wizardQueue.splice(currentIndex, 1)[0]); renderWizardStep(); }
  else advanceHierarchyWizardStep();
}

export async function bulkProvisionAllDefaults() {
  const btn = document.getElementById('wizard-bulk-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Bulk Binding...'; }
  const state = window.Store?.getState?.() || getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  let products = safeGetProducts();
  products.forEach((p) => {
    if (!p.ingredientId || !p.subtypeId) {
      let matchIng = ingredients.find(i => String(i.name || '').toLowerCase() === String(p.name || '').toLowerCase()) || ingredients[0];
      if (matchIng) {
        if (!Array.isArray(matchIng.subtypes) || !matchIng.subtypes.length) matchIng.subtypes = [{ id: `sub_${Date.now()}`, name: matchIng.name, isDefault: true, createdAt: new Date().toISOString() }];
        p.ingredientId = matchIng.id; p.subtypeId = matchIng.subtypes[0].id; p.subTypeId = matchIng.subtypes[0].id; p.isAutoDefault = true;
      }
    }
  });
  if (typeof setIngredients === 'function') setIngredients(ingredients);
  if (window.Store?.setState) window.Store.setState({ ingredients });
  await commitProductUpdates(products);
  wizardQueue = []; renderWizardComplete();
}

export function advanceHierarchyWizardStep() {
  isRenaming = false; isMerging = false; selectedSubtypeIdToBind = null; selectedMergeTargetId = null;
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
      <div><h3 style="margin:0;font-size:16px;font-weight:750">🪄 Product-Centric Alignment Wizard</h3><div style="font-size:11px;color:var(--text2);margin-top:2px">Step ${stepNum} of ${total}</div></div>
      <button type="button" class="btn sm ghost" onclick="window.closeHierarchyWizardModal()" style="font-size:18px;line-height:1">&times;</button>
    </div>
    <div style="flex-shrink:0;width:100%;background:#e5e7eb;height:4px;overflow:hidden"><div style="width:${pct}%;background:var(--primary);height:100%"></div></div>
    <div class="wizard-modal-body" style="flex:1 1 auto;overflow-y:auto;min-height:0;padding:14px">
      <div style="background:var(--surface2);border-radius:10px;padding:10px;border:1px solid var(--border);margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <div style="font-size:10.5px;color:var(--text3);text-transform:uppercase;font-weight:750">Unbound ${item.entityType === 'product' ? 'Product' : 'Ingredient'}</div>
            <div style="font-size:15px;font-weight:750;margin-top:1px">${escapeHtml(item.name)}</div>
            ${item.entityType === 'product' ? `<div style="font-size:11.5px;color:var(--text2);margin-top:2px">Brand: <strong>${escapeHtml(item.brand)}</strong> · Pack: <strong>${item.pack}${escapeHtml(item.packUnit)}</strong> · Price: <strong style="color:var(--green)">£${Number(item.price || 0).toFixed(2)}</strong></div>` : `<div style="font-size:11.5px;color:var(--text2);margin-top:2px">Category: <strong>${escapeHtml(item.category)}</strong></div>`}
          </div>
          <div style="display:flex;gap:4px">
            <button type="button" class="btn xs ghost" onclick="window.startWizardInlineRename()">✏️ Rename</button>
            <button type="button" class="btn xs ghost" onclick="window.toggleWizardMergePanel(true)">🔀 Merge</button>
          </div>
        </div>
        ${isRenaming ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)"><input type="text" id="wizard-inline-rename-input" value="${escapeAttr(item.name)}" style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px" /><button type="button" class="btn sm primary" onclick="window.submitWizardInlineRename()">Save</button><button type="button" class="btn sm ghost" onclick="window.cancelWizardInlineAction()">Cancel</button></div>` : ''}
        ${isMerging ? `
          <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border)">
            <div style="font-size:11px;font-weight:650;margin-bottom:4px">Merge into Target:</div>
            <div style="position:relative">
              <input type="text" id="wizard-merge-target-input" placeholder="🔍 Search target item..." style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" oninput="window.handleWizardMergeSearch(this.value)" onfocus="window.handleWizardMergeSearch(this.value)" autocomplete="off" />
              <div id="wizard-merge-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:140px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px">
              <button type="button" class="btn sm primary" id="wizard-confirm-merge-btn" style="flex:1" onclick="window.handleWizardMergeItems()" ${selectedMergeTargetId ? '' : 'disabled'}>Confirm Merge</button>
              <button type="button" class="btn sm ghost" onclick="window.toggleWizardMergePanel(false)">Cancel</button>
            </div>
          </div>` : ''}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
        <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:4px">🔗 1. Bind to Core Ingredient / Sub-type</div>
          <div style="position:relative">
            <input type="text" id="wizard-subtype-search-input" placeholder="🔍 Search Core Ingredients or Sub-types..." style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" oninput="window.handleWizardSubtypeSearch(this.value)" onfocus="window.handleWizardSubtypeSearch(this.value)" autocomplete="off" />
            <div id="wizard-subtype-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:150px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
          </div>
          <button type="button" class="btn sm primary" id="wizard-bind-subtype-btn" style="width:100%;margin-top:6px" onclick="window.handleWizardBindSubtype()" ${selectedSubtypeIdToBind ? '' : 'disabled'}>Bind Product to Selection</button>
        </div>

        <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:4px">✨ 2. Or Create New Core / Sub-type on the Fly</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
            <input type="text" id="wizard-new-parent-name" placeholder="Parent Core Name..." style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px" />
            <div style="position:relative">
              <input type="text" id="wizard-category-search-input" value="${escapeAttr(item.category || 'General')}" placeholder="Search category..." oninput="window.handleWizardCategorySearch(this.value)" onfocus="window.handleWizardCategorySearch(this.value)" autocomplete="off" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" />
              <div id="wizard-category-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:140px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
          </div>
          <button type="button" class="btn sm primary" style="width:100%" onclick="window.handleCreateParentAndAssignSubtype('${escapeAttr(item.id)}')">Create &amp; Bind Product</button>
        </div>

        <div style="background:#fff;border-radius:8px;padding:10px;border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:12.5px;font-weight:700">🛒 3. Import from Tesco</span><a href="https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(item.name)}" target="_blank" rel="noopener noreferrer" style="color:#007aff;text-decoration:underline;font-size:12px;">Search on Tesco ↗</a></div>
          <textarea id="wizard-tesco-json-input" placeholder='Paste raw JSON...' style="width:100%;height:32px;font-family:monospace;font-size:11px;padding:4px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box"></textarea>
          <button type="button" class="btn sm ghost" style="width:100%;margin-top:2px" onclick="window.handleWizardTescoImport()">Parse &amp; Update Product</button>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:#fff">
      <button type="button" class="btn sm" id="wizard-bulk-btn" style="background:rgba(16,185,129,0.1);color:var(--green);font-weight:700" onclick="window.bulkProvisionAllDefaults()">⚡ Bulk Bind All</button>
      <div style="display:flex;gap:6px"><button type="button" class="btn sm ghost" onclick="window.skipWizardStep()">Skip &rarr;</button><button type="button" class="btn sm" onclick="window.closeHierarchyWizardModal()">Exit</button></div>
    </div>
  `;
  window.handleWizardSubtypeSearch('');
  window.handleWizardCategorySearch('');
}

function renderWizardComplete() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  card.innerHTML = `<div style="padding:24px 16px;text-align:center"><div style="font-size:40px;margin-bottom:8px">🎉</div><h3 style="font-size:17px;font-weight:750;margin:0 0 4px 0">All Products Aligned!</h3><p style="font-size:12.5px;color:var(--text2);margin:0 0 16px 0">All items and products are successfully bound in hierarchy.</p><button type="button" class="btn primary" style="padding:0 20px;font-weight:700;font-size:13px" onclick="window.closeHierarchyWizardModal()">Done</button></div>`;
}

export function openHierarchyWizardModal() {
  wizardQueue = buildWizardQueue();
  currentIndex = 0; isRenaming = false; isMerging = false;
  selectedSubtypeIdToBind = null; selectedMergeTargetId = null;
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
    toggleWizardMergePanel, handleWizardSubtypeSearch, handleWizardBindSubtype, handleWizardMergeSearch,
    handleWizardMergeItems, handleWizardCategorySearch, cancelWizardInlineAction, handleCreateParentAndAssignSubtype,
    handleWizardTescoImport, handleWizardOpenAddProduct: () => {}, refreshHierarchyWizardStep,
    advanceHierarchyWizardStep, skipWizardStep, bulkProvisionAllDefaults
  });
}
