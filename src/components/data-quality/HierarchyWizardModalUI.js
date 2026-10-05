/**
 * src/components/data-quality/HierarchyWizardModalUI.js (v3.19.78)
 * Progressive Cascading Hierarchy Alignment Wizard with Title Case Normalisation & Auto-Default Sync.
 */
import { getState, setIngredients } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { safeGetProducts, commitProductUpdates } from './ResolveUnlinkedModalUI.js';

let wizardQueue = [], currentIndex = 0, wizardStage = 1;
let selectedSubtypeId = null, selectedIngredientId = null, selectedCategory = '';
let newSubtypeName = '', newIngredientName = '';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function getCategoryName(cat) {
  if (!cat) return '';
  return typeof cat === 'string' ? cat : (cat.name || cat.categoryName || cat.id || '');
}

function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function syncIngredientAutoDefault(parentIng, linkedProduct) {
  if (!parentIng || !linkedProduct) return false;
  const state = window.Store?.getState?.() || getState() || {};
  const products = state.products || safeGetProducts() || [];
  const currentDefaultId = parentIng.defaultProductId || parentIng.autoDefaultProductId || parentIng.autoDefaultProduct;
  const currentValid = currentDefaultId && products.some(p => String(p.id) === String(currentDefaultId));

  if (!currentValid) {
    parentIng.defaultProductId = linkedProduct.id;
    parentIng.autoDefault = linkedProduct.name || linkedProduct.title || '';
    parentIng.autoDefaultProduct = linkedProduct.id;
    parentIng.updatedAt = new Date().toISOString();
    
    const ingredients = (state.ingredients || []).map(i => String(i.id) === String(parentIng.id) ? parentIng : i);
    if (typeof setIngredients === 'function') setIngredients(ingredients);
    if (window.Store?.setState) window.Store.setState({ ingredients });
    saveIngredient(parentIng);
    return true;
  }
  return false;
}

export function closeHierarchyWizardModal() {
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  wizardQueue = []; currentIndex = 0; wizardStage = 1;
  selectedSubtypeId = null; selectedIngredientId = null; selectedCategory = '';
  newSubtypeName = ''; newIngredientName = '';
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildWizardQueue() {
  const products = safeGetProducts(), queue = [];
  products.forEach(p => {
    if (!p.ingredientId || !(p.subtypeId || p.subTypeId)) {
      queue.push({
        id: p.id, name: p.name, brand: p.brand || 'Generic', price: p.price || 0,
        pack: p.pack || 100, packUnit: p.packUnit || 'g', category: p.category || 'Uncategorised'
      });
    }
  });
  return queue;
}

export function handleWizardSubtypeSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-subtype-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const options = [];
  (state.ingredients || []).forEach(ing => {
    const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
    if (!subTypes.length) options.push({ id: ing.id, name: `${ing.name} (Ingredient)`, ingredientId: ing.id, subtypeId: null, category: ing.category });
    subTypes.forEach(st => options.push({ id: st.id, name: `${ing.name} › ${st.name}`, ingredientId: ing.id, subtypeId: st.id, category: ing.category }));
  });
  const filtered = options.filter(o => !q || String(o.name).toLowerCase().includes(q) || String(o.category).toLowerCase().includes(q)).slice(0, 7);
  
  let html = filtered.map(o => `
    <div class="wizard-st-item" data-ing-id="${escapeAttr(o.ingredientId)}" data-sub-id="${escapeAttr(o.subtypeId || '')}" data-name="${escapeAttr(o.name)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600">${escapeHtml(o.name)}</span>
      <span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2,#78716c)">${escapeHtml(o.category || 'Uncategorised')}</span>
    </div>
  `).join('');

  const displayQuery = toTitleCase(q || wizardQueue[currentIndex]?.name || 'Item');
  html += `<div class="wizard-st-create" data-name="${escapeAttr(displayQuery)}" style="padding:8px 10px;font-size:12px;cursor:pointer;background:#eff6ff;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:6px"><span>➕ Create new sub-type "${escapeHtml(displayQuery)}"</span></div>`;

  container.innerHTML = html; container.style.display = 'block';

  container.querySelectorAll('.wizard-st-item').forEach(el => {
    el.onclick = () => {
      selectedIngredientId = el.dataset.ingId; selectedSubtypeId = el.dataset.subId || null; newSubtypeName = '';
      const input = document.getElementById('wizard-subtype-search-input');
      if (input) input.value = el.dataset.name;
      container.style.display = 'none';
      const btn = document.getElementById('wizard-link-subtype-btn');
      if (btn) btn.disabled = false;
    };
  });

  container.querySelectorAll('.wizard-st-create').forEach(el => {
    el.onclick = () => { newSubtypeName = toTitleCase(el.dataset.name); container.style.display = 'none'; wizardStage = 2; renderWizardStep(); };
  });
}

export async function handleWizardLinkSubtype() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem || !selectedIngredientId) { alert('Please select a sub-type first.'); return; }
  const state = window.Store?.getState?.() || getState() || {};
  const parentIng = (state.ingredients || []).find(i => String(i.id) === String(selectedIngredientId));
  if (!parentIng) return;

  let subtypeId = selectedSubtypeId;
  if (!subtypeId) {
    if (!Array.isArray(parentIng.subtypes) || !parentIng.subtypes.length) {
      const newSub = { id: `sub_${Date.now()}`, name: parentIng.name, isDefault: true, createdAt: new Date().toISOString() };
      parentIng.subtypes = [newSub]; subtypeId = newSub.id; saveIngredient(parentIng);
    } else subtypeId = parentIng.subtypes[0].id;
  }

  const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
    ...p, ingredientId: selectedIngredientId, subtypeId, subTypeId: subtypeId, isAutoDefault: false, updatedAt: new Date().toISOString()
  } : p);
  commitProductUpdates(products);
  const updatedProd = products.find(p => String(p.id) === String(currentItem.id));
  try { await saveProduct(updatedProd); } catch (e) {}
  if (parentIng && updatedProd) syncIngredientAutoDefault(parentIng, updatedProd);
  advanceHierarchyWizardStep();
}

export function handleWizardIngredientSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-ingredient-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const filtered = (state.ingredients || []).filter(i => !q || String(i.name).toLowerCase().includes(q)).slice(0, 7);

  let html = filtered.map(i => `
    <div class="wizard-ing-item" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600">${escapeHtml(i.name)}</span>
      <span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2,#78716c)">${escapeHtml(i.category || 'Uncategorised')}</span>
    </div>
  `).join('');

  const displayQuery = toTitleCase(q || newSubtypeName || 'Ingredient');
  html += `<div class="wizard-ing-create" data-name="${escapeAttr(displayQuery)}" style="padding:8px 10px;font-size:12px;cursor:pointer;background:#eff6ff;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:6px"><span>➕ Create new ingredient "${escapeHtml(displayQuery)}"</span></div>`;

  container.innerHTML = html; container.style.display = 'block';

  container.querySelectorAll('.wizard-ing-item').forEach(el => {
    el.onclick = () => {
      selectedIngredientId = el.dataset.id; selectedSubtypeId = null; newIngredientName = '';
      const input = document.getElementById('wizard-ingredient-search-input');
      if (input) input.value = el.dataset.name;
      container.style.display = 'none';
      const btn = document.getElementById('wizard-create-link-btn');
      if (btn) btn.disabled = false;
    };
  });

  container.querySelectorAll('.wizard-ing-create').forEach(el => {
    el.onclick = () => { newIngredientName = toTitleCase(el.dataset.name); container.style.display = 'none'; wizardStage = 3; renderWizardStep(); };
  });
}

export function handleWizardCategorySearch(query) {
  const cleanQuery = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-category-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const activeCategories = Array.isArray(state.categories) ? state.categories : [];
  const matches = activeCategories.filter(cat => getCategoryName(cat).toLowerCase().includes(cleanQuery));

  container.innerHTML = '';
  if (!matches.length) { 
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text2,#78716c);padding:8px;text-align:center;">No matching category in Category Bank. Please manage categories in Category Manager.</div>`; 
    container.style.display = 'block';
    const btn = document.getElementById('wizard-create-link-btn');
    if (btn) btn.disabled = true;
    return; 
  }

  matches.forEach(cat => {
    const catName = getCategoryName(cat);
    const div = document.createElement('div');
    div.className = 'wizard-category-option';
    div.style.cssText = 'padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;';
    const span = document.createElement('span');
    span.style.fontWeight = '600';
    span.textContent = catName;
    div.appendChild(span);
    div.onclick = () => window.selectWizardCategory(catName);
    container.appendChild(div);
  });
  container.style.display = 'block';
}

export function selectWizardCategory(catName) {
  selectedCategory = catName;
  const input = document.getElementById('wizard-category-search-input');
  if (input) input.value = catName;
  const container = document.getElementById('wizard-category-search-results');
  if (container) container.style.display = 'none';
  const btn = document.getElementById('wizard-create-link-btn');
  if (btn) btn.disabled = false;
}

export async function handleWizardCreateAndLink() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem) return;
  const state = window.Store?.getState?.() || getState() || {};
  let parentIng = null;

  const normalizedSubName = toTitleCase(newSubtypeName || currentItem.name);
  const normalizedIngName = toTitleCase(newIngredientName);
  const activeCategories = Array.isArray(state.categories) ? state.categories : [];
  let categoryObj = activeCategories.find(c => getCategoryName(c).toLowerCase() === (selectedCategory || '').toLowerCase());

  if (!categoryObj && activeCategories.length > 0) categoryObj = activeCategories[0];
  const finalCatName = getCategoryName(categoryObj) || selectedCategory || 'Uncategorised';

  if (normalizedIngName) {
    const newSub = { id: `sub_${Date.now()}`, name: normalizedSubName, isDefault: false, createdAt: new Date().toISOString() };
    parentIng = { id: `ing_${Date.now()}`, name: normalizedIngName, category: finalCatName, subtypes: [newSub], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updatedIngredients = [...(state.ingredients || []), parentIng];
    if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
    if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients });
    await saveIngredient(parentIng);
    selectedIngredientId = parentIng.id;
  } else if (selectedIngredientId) {
    parentIng = (state.ingredients || []).find(i => String(i.id) === String(selectedIngredientId));
    if (!parentIng) return;
    const newSub = { id: `sub_${Date.now()}`, name: normalizedSubName, isDefault: false, createdAt: new Date().toISOString() };
    parentIng.subtypes = [...(parentIng.subtypes || []), newSub];
    saveIngredient(parentIng);
  } else { alert('Please select or create an ingredient.'); return; }

  const parentSub = parentIng.subtypes[parentIng.subtypes.length - 1];
  const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
    ...p, ingredientId: parentIng.id, subtypeId: parentSub.id, subTypeId: parentSub.id, isAutoDefault: false, updatedAt: new Date().toISOString()
  } : p);
  commitProductUpdates(products);
  const updatedProd = products.find(p => String(p.id) === String(currentItem.id));
  try { await saveProduct(updatedProd); } catch (e) {}
  if (parentIng && updatedProd) syncIngredientAutoDefault(parentIng, updatedProd);
  advanceHierarchyWizardStep();
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
  wizardStage = 1; selectedSubtypeId = null; selectedIngredientId = null; selectedCategory = '';
  newSubtypeName = ''; newIngredientName = '';
  if (++currentIndex >= wizardQueue.length) renderWizardComplete(); else renderWizardStep();
}

export const refreshHierarchyWizardStep = () => renderWizardStep();

export function renderWizardStep() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  if (wizardQueue.length === 0 || currentIndex >= wizardQueue.length) { renderWizardComplete(); return; }
  const item = wizardQueue[currentIndex], total = wizardQueue.length, stepNum = currentIndex + 1, pct = Math.round((stepNum / total) * 100);

  if (wizardStage === 3 && !selectedCategory) {
    const activeCategories = window.Store?.getState?.()?.categories || getState()?.categories || [];
    selectedCategory = activeCategories.length > 0 ? (getCategoryName(activeCategories[0]) || 'Uncategorised') : 'Uncategorised';
  }

  card.innerHTML = `
    <div style="flex-shrink:0;padding:12px 16px 8px;border-bottom:1px solid var(--border,#e7e5e4);display:flex;align-items:center;justify-content:space-between">
      <div><h3 style="margin:0;font-size:16px;font-weight:750">🪄 Cascading Hierarchy Wizard</h3><div style="font-size:11px;color:var(--text2,#78716c);margin-top:2px">Unlinked Product ${stepNum} of ${total}</div></div>
      <button type="button" class="btn sm ghost" onclick="window.closeHierarchyWizardModal()" style="font-size:18px;line-height:1">&times;</button>
    </div>
    <div style="flex-shrink:0;width:100%;background:#e5e7eb;height:4px;overflow:hidden"><div style="width:${pct}%;background:var(--primary);height:100%"></div></div>
    <div class="wizard-modal-body" style="flex:1 1 auto;overflow-y:auto;min-height:0;padding:14px">
      <div style="background:var(--surface2,#f5f5f4);border-radius:10px;padding:10px;border:1px solid var(--border,#e7e5e4);margin-bottom:12px">
        <div style="font-size:10.5px;color:var(--text3,#78716c);text-transform:uppercase;font-weight:750">Active Product Status: Unlinked</div>
        <div style="font-size:16px;font-weight:750;margin-top:2px">${escapeHtml(item.name)}</div>
        <div style="font-size:11.5px;color:var(--text2,#78716c);margin-top:3px">Brand: <strong>${escapeHtml(item.brand)}</strong> · Pack: <strong>${item.pack}${escapeHtml(item.packUnit)}</strong> · Price: <strong style="color:var(--green,#10b981)">£${Number(item.price || 0).toFixed(2)}</strong></div>
      </div>

      <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:10px">
        ${wizardStage >= 1 ? `
          <div>
            <div style="font-size:12.5px;font-weight:750;margin-bottom:4px">Stage 1: Search Sub-type</div>
            ${newSubtypeName ? `<div style="display:inline-block;background:#e0e7ff;color:var(--primary);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:650;margin-bottom:6px">Sub-type: ${escapeHtml(newSubtypeName)}</div>` : ''}
            <div style="position:relative">
              <input type="text" id="wizard-subtype-search-input" value="${escapeAttr(newSubtypeName)}" placeholder="Search sub-type..." style="width:100%;padding:6px 8px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box;text-transform:capitalize" oninput="window.handleWizardSubtypeSearch(this.value)" onfocus="window.handleWizardSubtypeSearch(this.value)" autocomplete="off" ${wizardStage > 1 ? 'disabled style="background:#f9fafb"' : ''} />
              <div id="wizard-subtype-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:160px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            ${wizardStage === 1 ? `<button type="button" class="btn sm primary" id="wizard-link-subtype-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardLinkSubtype()" disabled>Link Product</button>` : ''}
          </div>
        ` : ''}

        ${wizardStage >= 2 ? `
          <div style="border-top:1px dashed var(--border,#e7e5e4);padding-top:8px">
            <div style="font-size:12.5px;font-weight:750;margin-bottom:4px">Stage 2: Search Ingredient</div>
            ${newIngredientName ? `<div style="display:inline-block;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:650;margin-bottom:6px">Ingredient: ${escapeHtml(newIngredientName)}</div>` : ''}
            <div style="position:relative">
              <input type="text" id="wizard-ingredient-search-input" value="${escapeAttr(newIngredientName)}" placeholder="Search parent ingredient to link..." style="width:100%;padding:6px 8px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box;text-transform:capitalize" oninput="window.handleWizardIngredientSearch(this.value)" onfocus="window.handleWizardIngredientSearch(this.value)" autocomplete="off" ${wizardStage > 2 ? 'disabled style="background:#f9fafb"' : ''} />
              <div id="wizard-ingredient-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:160px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            ${wizardStage === 2 ? `<button type="button" class="btn sm primary" id="wizard-create-link-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardCreateAndLink()" disabled>Create Sub-type &amp; Link Product</button>` : ''}
          </div>
        ` : ''}

        ${wizardStage >= 3 ? `
          <div style="border-top:1px dashed var(--border,#e7e5e4);padding-top:8px">
            <div style="font-size:12.5px;font-weight:750;margin-bottom:4px">Stage 3: Assign Category</div>
            <div style="position:relative">
              <input type="text" id="wizard-category-search-input" value="${escapeAttr(selectedCategory)}" placeholder="Search category from Category Bank..." style="width:100%;padding:6px 8px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box;text-transform:capitalize" oninput="window.handleWizardCategorySearch(this.value)" onkeyup="window.handleWizardCategorySearch(this.value)" onfocus="window.handleWizardCategorySearch(this.value)" autocomplete="off" />
              <div id="wizard-category-search-results" style="display:none;position:absolute;z-index:1050;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:220px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            <button type="button" class="btn sm primary" id="wizard-create-link-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardCreateAndLink()">Create Hierarchy &amp; Link Product</button>
          </div>
        ` : ''}
      </div>
    </div>
    <div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;background:#fff">
      <button type="button" class="btn sm" id="wizard-bulk-btn" style="background:rgba(16,185,129,0.1);color:var(--green,#10b981);font-weight:700" onclick="window.bulkProvisionAllDefaults()">⚡ Bulk Bind All</button>
      <div style="display:flex;gap:6px"><button type="button" class="btn sm ghost" onclick="window.skipWizardStep()">Skip &rarr;</button><button type="button" class="btn sm" onclick="window.closeHierarchyWizardModal()">Exit</button></div>
    </div>
  `;
  if (wizardStage === 1) window.handleWizardSubtypeSearch(''); else if (wizardStage === 2) window.handleWizardIngredientSearch(''); else if (wizardStage === 3) window.handleWizardCategorySearch('');
}

function renderWizardComplete() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  card.innerHTML = `<div style="padding:24px 16px;text-align:center"><div style="font-size:40px;margin-bottom:8px">🎉</div><h3 style="font-size:17px;font-weight:750;margin:0 0 4px 0">All Products Aligned!</h3><p style="font-size:12.5px;color:var(--text2,#78716c);margin:0 0 16px 0">All products successfully bound in hierarchy.</p><button type="button" class="btn primary" style="padding:0 20px;font-weight:700;font-size:13px" onclick="window.closeHierarchyWizardModal()">Done</button></div>`;
}

export function openHierarchyWizardModal() {
  wizardQueue = buildWizardQueue(); currentIndex = 0; wizardStage = 1;
  selectedSubtypeId = null; selectedIngredientId = null; selectedCategory = '';
  newSubtypeName = ''; newIngredientName = '';
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
    openHierarchyWizardModal, closeHierarchyWizardModal, handleWizardSubtypeSearch, handleWizardLinkSubtype,
    handleWizardIngredientSearch, handleWizardCategorySearch, selectWizardCategory, handleWizardCreateAndLink,
    skipWizardStep, bulkProvisionAllDefaults, refreshHierarchyWizardStep, advanceHierarchyWizardStep, syncIngredientAutoDefault
  });
}
