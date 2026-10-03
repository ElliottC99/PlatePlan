/**
 * src/components/data-quality/HierarchyWizardModalUI.js (v3.19.60)
 * Streamlined Product-Led Hierarchy Alignment Wizard (Option A & Option B).
 */
import { getState, setIngredients } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { safeGetProducts, commitProductUpdates } from './ResolveUnlinkedModalUI.js';

let wizardQueue = [], currentIndex = 0;
let selectedSubtypeId = null, selectedIngredientId = null, selectedParentId = null;
let createNewCore = false, selectedCategory = 'General';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

export function closeHierarchyWizardModal() {
  const overlay = document.getElementById('hierarchy-wizard-modal-overlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  wizardQueue = []; currentIndex = 0; selectedSubtypeId = null; selectedIngredientId = null; selectedParentId = null; createNewCore = false; selectedCategory = 'General';
  if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
}

export function buildWizardQueue() {
  const products = safeGetProducts();
  const queue = [];
  products.forEach(p => {
    const hasIng = !!p.ingredientId;
    const hasSub = !!(p.subtypeId || p.subTypeId);
    if (!hasIng || !hasSub) {
      queue.push({
        id: p.id, name: p.name, brand: p.brand || 'Generic', price: p.price || 0,
        pack: p.pack || 100, packUnit: p.packUnit || 'g', category: p.category || 'General'
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
    if (!subTypes.length) {
      options.push({ id: ing.id, name: `${ing.name} (Core)`, ingredientId: ing.id, subtypeId: null, category: ing.category });
    }
    subTypes.forEach(st => {
      options.push({ id: st.id, name: `${ing.name} › ${st.name}`, ingredientId: ing.id, subtypeId: st.id, category: ing.category });
    });
  });
  const filtered = options.filter(o => !q || String(o.name).toLowerCase().includes(q) || String(o.category).toLowerCase().includes(q)).slice(0, 8);
  if (!filtered.length) {
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching sub-types found.</div>`;
    container.style.display = 'block';
    return;
  }
  container.innerHTML = filtered.map(o => `
    <div class="wizard-st-item" data-ing-id="${escapeAttr(o.ingredientId)}" data-sub-id="${escapeAttr(o.subtypeId || '')}" data-name="${escapeAttr(o.name)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600">${escapeHtml(o.name)}</span>
      <span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2)">${escapeHtml(o.category || 'General')}</span>
    </div>
  `).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-st-item').forEach(el => {
    el.onclick = () => {
      selectedIngredientId = el.dataset.ingId;
      selectedSubtypeId = el.dataset.subId || null;
      const input = document.getElementById('wizard-subtype-search-input');
      if (input) input.value = el.dataset.name;
      container.style.display = 'none';
      const btn = document.getElementById('wizard-link-subtype-btn');
      if (btn) btn.disabled = false;
    };
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
      parentIng.subtypes = [newSub]; subtypeId = newSub.id;
      saveIngredient(parentIng);
    } else subtypeId = parentIng.subtypes[0].id;
  }

  const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
    ...p, ingredientId: selectedIngredientId, subtypeId, subTypeId: subtypeId, isAutoDefault: false, updatedAt: new Date().toISOString()
  } : p);
  commitProductUpdates(products);
  try { await saveProduct(products.find(p => String(p.id) === String(currentItem.id))); } catch (e) {}
  advanceHierarchyWizardStep();
}

export function handleWizardParentSearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-parent-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const filtered = (state.ingredients || []).filter(i => !q || String(i.name).toLowerCase().includes(q)).slice(0, 6);
  if (!filtered.length) {
    container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching core ingredients.</div>`;
    container.style.display = 'block';
    return;
  }
  container.innerHTML = filtered.map(i => `<div class="wizard-parent-opt" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);font-weight:600">${escapeHtml(i.name)}</div>`).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-parent-opt').forEach(el => {
    el.onclick = () => {
      selectedParentId = el.dataset.id;
      const input = document.getElementById('wizard-parent-search-input');
      if (input) input.value = el.dataset.name;
      container.style.display = 'none';
    };
  });
}

export function toggleWizardCreateCore(show) {
  createNewCore = show;
  const coreBox = document.getElementById('wizard-new-core-box');
  const parentSearchBox = document.getElementById('wizard-parent-search-wrap');
  if (coreBox) coreBox.style.display = show ? 'block' : 'none';
  if (parentSearchBox) parentSearchBox.style.display = show ? 'none' : 'block';
  if (show) selectedParentId = null;
}

export function handleWizardCategorySearch(query) {
  const q = String(query || '').toLowerCase().trim();
  const container = document.getElementById('wizard-category-search-results');
  if (!container) return;
  const state = window.Store?.getState?.() || getState() || {};
  const cats = Array.isArray(state.categories) && state.categories.length ? state.categories : ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'General'];
  const filtered = cats.filter(c => !q || String(c).toLowerCase().includes(q));
  if (!filtered.length) { container.innerHTML = `<div style="font-size:11.5px;color:var(--text3);padding:6px;text-align:center;">No matching categories.</div>`; container.style.display = 'block'; return; }
  container.innerHTML = filtered.map(c => `<div class="wizard-cat-opt" data-cat="${escapeAttr(c)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border)">${escapeHtml(c)}</div>`).join('');
  container.style.display = 'block';
  container.querySelectorAll('.wizard-cat-opt').forEach(el => {
    el.onclick = () => {
      selectedCategory = el.dataset.cat;
      const input = document.getElementById('wizard-category-search-input');
      if (input) input.value = selectedCategory;
      container.style.display = 'none';
    };
  });
}

export async function handleWizardCreateAndLink() {
  const currentItem = wizardQueue[currentIndex];
  if (!currentItem) return;
  const subtypeName = document.getElementById('wizard-new-subtype-name')?.value?.trim();
  if (!subtypeName) { alert('Please enter a new sub-type name.'); return; }

  const state = window.Store?.getState?.() || getState() || {};
  let parentIng = null;

  if (createNewCore) {
    const coreName = document.getElementById('wizard-new-core-name')?.value?.trim();
    if (!coreName) { alert('Please enter a new core ingredient name.'); return; }
    const newSub = { id: `sub_${Date.now()}`, name: subtypeName, isDefault: false, createdAt: new Date().toISOString() };
    parentIng = { id: `ing_${Date.now()}`, name: coreName, category: selectedCategory, subtypes: [newSub], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updatedIngredients = [...(state.ingredients || []), parentIng];
    if (typeof setIngredients === 'function') setIngredients(updatedIngredients);
    if (window.Store?.setState) window.Store.setState({ ingredients: updatedIngredients });
    await saveIngredient(parentIng);
  } else {
    if (!selectedParentId) { alert('Please select an existing core ingredient or create a new one.'); return; }
    parentIng = (state.ingredients || []).find(i => String(i.id) === String(selectedParentId));
    if (!parentIng) return;
    const newSub = { id: `sub_${Date.now()}`, name: subtypeName, isDefault: false, createdAt: new Date().toISOString() };
    parentIng.subtypes = [...(parentIng.subtypes || []), newSub];
    saveIngredient(parentIng);
  }

  const parentSub = parentIng.subtypes[parentIng.subtypes.length - 1];
  const products = safeGetProducts().map(p => String(p.id) === String(currentItem.id) ? {
    ...p, ingredientId: parentIng.id, subtypeId: parentSub.id, subTypeId: parentSub.id, isAutoDefault: false, updatedAt: new Date().toISOString()
  } : p);
  commitProductUpdates(products);
  try { await saveProduct(products.find(p => String(p.id) === String(currentItem.id))); } catch (e) {}
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
  selectedSubtypeId = null; selectedIngredientId = null; selectedParentId = null; createNewCore = false; selectedCategory = 'General';
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
      <div><h3 style="margin:0;font-size:16px;font-weight:750">🪄 Product-Led Hierarchy Wizard</h3><div style="font-size:11px;color:var(--text2);margin-top:2px">Unlinked Product ${stepNum} of ${total}</div></div>
      <button type="button" class="btn sm ghost" onclick="window.closeHierarchyWizardModal()" style="font-size:18px;line-height:1">&times;</button>
    </div>
    <div style="flex-shrink:0;width:100%;background:#e5e7eb;height:4px;overflow:hidden"><div style="width:${pct}%;background:var(--primary);height:100%"></div></div>
    <div class="wizard-modal-body" style="flex:1 1 auto;overflow-y:auto;min-height:0;padding:14px">
      <div style="background:var(--surface2);border-radius:10px;padding:10px;border:1px solid var(--border);margin-bottom:12px">
        <div style="font-size:10.5px;color:var(--text3);text-transform:uppercase;font-weight:750">Active Product Status: Unlinked</div>
        <div style="font-size:16px;font-weight:750;margin-top:2px">${escapeHtml(item.name)}</div>
        <div style="font-size:11.5px;color:var(--text2);margin-top:3px">Brand: <strong>${escapeHtml(item.brand)}</strong> · Pack: <strong>${item.pack}${escapeHtml(item.packUnit)}</strong> · Price: <strong style="color:var(--green)">£${Number(item.price || 0).toFixed(2)}</strong></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <!-- Option A -->
        <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid var(--border)">
          <div style="font-size:13px;font-weight:750;margin-bottom:6px;color:var(--primary)">Option A: Link to Existing Sub-type</div>
          <div style="position:relative">
            <input type="text" id="wizard-subtype-search-input" placeholder="🔍 Search existing sub-types or core ingredients..." style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" oninput="window.handleWizardSubtypeSearch(this.value)" onfocus="window.handleWizardSubtypeSearch(this.value)" autocomplete="off" />
            <div id="wizard-subtype-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:150px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
          </div>
          <button type="button" class="btn sm primary" id="wizard-link-subtype-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardLinkSubtype()" disabled>Link to Selected Sub-type</button>
        </div>

        <!-- Option B -->
        <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid var(--border)">
          <div style="font-size:13px;font-weight:750;margin-bottom:6px;color:var(--primary)">Option B: Create New Sub-type</div>
          <div class="field" style="margin-bottom:8px">
            <label style="font-size:11.5px;font-weight:650">New Sub-type Name</label>
            <input type="text" id="wizard-new-subtype-name" value="${escapeAttr(item.name)}" placeholder="e.g. Organic Chopped..." style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" />
          </div>
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <label style="font-size:11.5px;font-weight:650">Parent Core Ingredient</label>
              <button type="button" class="btn xs ghost" onclick="window.toggleWizardCreateCore(${!createNewCore})">${createNewCore ? '🔍 Select Existing' : '➕ Create New Core'}</button>
            </div>
            <div id="wizard-parent-search-wrap" style="display:${createNewCore ? 'none' : 'block'};position:relative">
              <input type="text" id="wizard-parent-search-input" placeholder="🔍 Search existing core ingredients..." style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" oninput="window.handleWizardParentSearch(this.value)" onfocus="window.handleWizardParentSearch(this.value)" autocomplete="off" />
              <div id="wizard-parent-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:130px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            <div id="wizard-new-core-box" style="display:${createNewCore ? 'block' : 'none'}">
              <input type="text" id="wizard-new-core-name" placeholder="New Core Ingredient Name..." style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box;margin-bottom:6px" />
              <div style="position:relative">
                <input type="text" id="wizard-category-search-input" value="General" placeholder="Search category..." oninput="window.handleWizardCategorySearch(this.value)" onfocus="window.handleWizardCategorySearch(this.value)" autocomplete="off" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-sizing:border-box" />
                <div id="wizard-category-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:130px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
              </div>
            </div>
          </div>
          <button type="button" class="btn sm primary" style="width:100%;margin-top:6px" onclick="window.handleWizardCreateAndLink()">Create Hierarchy &amp; Link Product</button>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:#fff">
      <button type="button" class="btn sm" id="wizard-bulk-btn" style="background:rgba(16,185,129,0.1);color:var(--green);font-weight:700" onclick="window.bulkProvisionAllDefaults()">⚡ Bulk Bind All</button>
      <div style="display:flex;gap:6px"><button type="button" class="btn sm ghost" onclick="window.skipWizardStep()">Skip &rarr;</button><button type="button" class="btn sm" onclick="window.closeHierarchyWizardModal()">Exit</button></div>
    </div>
  `;
  window.handleWizardSubtypeSearch('');
  window.handleWizardParentSearch('');
  window.handleWizardCategorySearch('');
}

function renderWizardComplete() {
  const card = document.getElementById('hierarchy-wizard-modal-card');
  if (!card) return;
  card.innerHTML = `<div style="padding:24px 16px;text-align:center"><div style="font-size:40px;margin-bottom:8px">🎉</div><h3 style="font-size:17px;font-weight:750;margin:0 0 4px 0">All Products Aligned!</h3><p style="font-size:12.5px;color:var(--text2);margin:0 0 16px 0">All products successfully bound in hierarchy.</p><button type="button" class="btn primary" style="padding:0 20px;font-weight:700;font-size:13px" onclick="window.closeHierarchyWizardModal()">Done</button></div>`;
}

export function openHierarchyWizardModal() {
  wizardQueue = buildWizardQueue();
  currentIndex = 0; selectedSubtypeId = null; selectedIngredientId = null; selectedParentId = null; createNewCore = false; selectedCategory = 'General';
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
    handleWizardParentSearch, toggleWizardCreateCore, handleWizardCategorySearch, handleWizardCreateAndLink,
    skipWizardStep, bulkProvisionAllDefaults, refreshHierarchyWizardStep, advanceHierarchyWizardStep
  });
}
