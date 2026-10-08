/**
 * src/components/pantry/CategoryManagerModalUI.js (v3.28.3)
 * In-App Multi-Step Category Operations Wizard, Raw Exposure & Deep State Merge Modal.
 * Wrapped with Try-Catch-Finally block exception handling and state resets to eliminate screen freezes.
 * Fully accessible Form fields with explicit id, name, and paired labels.
 */

import { getState, setCategories, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveCategories, saveHouseholdState } from '../../services/HouseholdRepository.js';
import { slugCategory, slugifyToKebab, invalidateHierarchyCache, toCanonicalCategoryName } from '../../models/PantryHierarchyModel.js';
import { resetCategoryFilter } from '../../views/PantryBankView.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let wizardStep = 'list', activeCat = null, reassignMode = 'mass', reassignSearch = '', massTargetCat = '', individualCatMap = {};

export function getCategoryName(cat) {
  return !cat ? '' : typeof cat === 'string' ? cat : (cat.name || cat.categoryName || cat.id || '');
}

export function getRawCategories(state = {}) {
  const rawSet = new Set();
  (Array.isArray(state.categories) ? state.categories : []).forEach(c => {
    const name = typeof c === 'string' ? c : c?.name;
    if (name !== undefined && name !== null && String(name).length > 0) rawSet.add(String(name));
  });
  (Array.isArray(state.ingredients) ? state.ingredients : []).forEach(i => {
    if (i?.category !== undefined && i?.category !== null && String(i.category).length > 0) rawSet.add(String(i.category));
    if (Array.isArray(i?.subtypes)) {
      i.subtypes.forEach(st => {
        if (st?.category !== undefined && st?.category !== null && String(st.category).length > 0) rawSet.add(String(st.category));
      });
    }
  });
  (Array.isArray(state.products) ? state.products : []).forEach(p => {
    if (p?.category !== undefined && p?.category !== null && String(p.category).length > 0) rawSet.add(String(p.category));
  });
  return Array.from(rawSet).sort((a, b) => a.localeCompare(b));
}

export function getCategoryObjects(state = {}) {
  const cats = state.categories || [];
  const list = [];
  
  cats.forEach(c => {
    if (typeof c === 'string') {
      if (!list.some(item => item.id === c)) {
        list.push({ id: c, name: c });
      }
    } else if (c && typeof c === 'object') {
      const name = c.name || c.categoryName || c.id || '';
      const id = c.id || name;
      if (!list.some(item => item.id === id)) {
        list.push({ id, name });
      }
    }
  });

  const stateRaw = getRawCategories(state);
  stateRaw.forEach(raw => {
    if (!list.some(c => c.id === raw)) {
      list.push({ id: raw, name: raw });
    }
  });

  return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' }));
}

const resolveCategory = (id) => {
  const cats = getState()?.categories || [];
  for (const c of cats) {
    const cName = getCategoryName(c);
    if (typeof c === 'string' && (c === id || slugCategory(c) === slugCategory(id))) return { id: c, name: c };
    if (c && typeof c === 'object' && (String(c.id) === String(id) || String(cName) === String(id) || slugCategory(cName) === slugCategory(id))) return { id: c.id || cName, name: cName };
  }
  return { id, name: id };
};

export function resetModalState() {
  wizardStep = 'list';
  activeCat = null;
  reassignSearch = '';
  massTargetCat = '';
  individualCatMap = {};
  
  // Clean up any potential loading states, overlays, or confirm modals
  const confirmModal = document.getElementById('category-delete-confirm-modal');
  if (confirmModal) confirmModal.remove();
  
  const modal = document.getElementById('category-manager-modal');
  if (modal) {
    const spinner = modal.querySelector('.loading-spinner, .spinner');
    if (spinner) spinner.remove();
  }
}

export function closeCategoryManagerModal() {
  const el = document.getElementById('category-manager-modal');
  if (el) {
    el.dataset.wizardStep = 'list';
    Object.assign(el.style, { opacity: '0', pointerEvents: 'none' });
    el.classList.remove('open');
  }
  resetModalState();
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

export function renderCategoryManagerModal() {
  let modal = document.getElementById('category-manager-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'category-manager-modal';
    modal.className = 'modal-wrap';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(modal);
  } else if (modal.dataset.wizardStep) wizardStep = modal.dataset.wizardStep;

  const renderCurrentStep = () => {
    const state = getState() || {}, catObjects = getCategoryObjects(state), ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
    let bodyHtml = '';

    if (wizardStep === 'list') {
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">🏷️</span><h3 style="margin:0;font-size:16px;font-weight:750">Category Manager</h3></div>
          <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="window.closeCategoryManagerModal()" aria-label="Close modal">✕</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:12px;color:var(--text2,#78716c)">${catObjects.length} raw database entries</span>
          <button id="btn-merge-duplicates" type="button" class="btn xs btn-secondary secondary" onclick="window.submitMergeDuplicateCategories()" title="Deduplicate and standardise category names across database">✨ Merge Duplicates</button>
        </div>
        <div style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${catObjects.map(cat => {
            const ingCount = ingredients.filter(i => (i.category === cat.name || i.cat === cat.id || slugCategory(i.category) === slugCategory(cat.name) || (Array.isArray(i.subtypes) && i.subtypes.some(st => st.category === cat.name || st.cat === cat.id || slugCategory(st.category) === slugCategory(cat.name))))).length;
            const prodCount = (state.products || []).filter(p => p.category === cat.name || p.cat === cat.id || slugCategory(p.category) === slugCategory(cat.name)).length;
            const count = ingCount + prodCount;
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface2,#f5f5f4);border-radius:var(--radius-md,10px);border:1px solid var(--border,#e7e5e4)">
              <div><span style="font-size:13px;font-weight:650">${escapeHtml(cat.name)}</span><span style="font-size:11px;color:var(--text2,#78716c);margin-left:6px">(${count} items)</span></div>
              <div style="display:flex;gap:4px">
                <button type="button" class="btn xs btn-ghost ghost" onclick="window.startRenameCat('${escapeAttr(cat.name)}')">Rename</button>
                <button type="button" class="btn xs btn-ghost ghost" onclick="window.startMergeCat('${escapeAttr(cat.name)}')">Merge</button>
                <button type="button" class="btn xs btn-ghost ghost" style="color:var(--red,#ef4444)" onclick="window.promptDeleteCategory('${escapeAttr(cat.name)}')">Delete</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="cat-manager-add-input" name="cat_manager_add_input" placeholder="New category name..." aria-label="New category name" style="flex:1;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13px">
          <button id="btn-submit-add-cat" type="button" class="btn btn-primary primary sm" onclick="window.submitAddCat()">+ Add</button>
        </div>`;
    } else if (wizardStep === 'rename') {
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <h3 style="margin:0;font-size:15px;font-weight:750">Rename "${escapeHtml(activeCat)}"</h3>
          <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="window.closeCategoryManagerModal()" aria-label="Close modal">✕</button>
        </div>
        <div style="margin-bottom:16px">
          <label for="cat-rename-input" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">New Category Name</label>
          <input type="text" id="cat-rename-input" name="cat_rename_input" value="${escapeAttr(activeCat)}" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13.5px;box-sizing:border-box">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost ghost sm" onclick="window.navCatStep('list')">Back</button>
          <button id="btn-submit-rename-cat" type="button" class="btn btn-primary primary sm" onclick="window.submitRenameCat()">Apply Rename</button>
        </div>`;
    } else if (wizardStep === 'merge') {
      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border,#e7e5e4)">
          <h3 style="margin:0;font-size:15px;font-weight:750">Merge "${escapeHtml(activeCat)}"</h3>
          <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="window.closeCategoryManagerModal()" aria-label="Close modal">✕</button>
        </div>
        <div style="margin-bottom:16px">
          <label for="cat-merge-search-input" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Select Target Destination Category</label>
          <div style="position:relative;">
            <input type="text" id="cat-merge-search-input" name="cat_merge_search_input" placeholder="Search target category..." autocomplete="off" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);font-size:13.5px;box-sizing:border-box" oninput="window.filterCatMergeOptions(this.value)" onfocus="window.filterCatMergeOptions(this.value)" onblur="setTimeout(() => { const listDiv = document.getElementById('cat-merge-dropdown-list'); if (listDiv) listDiv.style.display = 'none'; }, 200)">
            <div id="cat-merge-dropdown-list" style="position:absolute;top:100%;left:0;right:0;max-height:150px;overflow-y:auto;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:var(--radius-sm,6px);box-shadow:0 4px 12px rgba(0,0,0,0.08);z-index:9999;display:none;margin-top:4px;"></div>
          </div>
          <div id="cat-merge-validation-warning" style="display:none; color:var(--red,#ef4444); font-size:12.5px; font-weight:600; margin-top:8px; line-height:1.4;"></div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost ghost sm" onclick="window.navCatStep('list')">Back</button>
          <button id="btn-submit-merge-cat" type="button" class="btn btn-primary primary sm" onclick="window.submitMergeCat()">Confirm Merge</button>
        </div>`;
    } else if (wizardStep === 'reassign') {
      const rawCategories = getRawCategories(state);
      const boundIngs = ingredients.filter(i => (i.category === activeCat || i.cat === activeCat || slugCategory(i.category) === slugCategory(activeCat)));
      const otherCats = rawCategories.filter(c => c !== activeCat);
      if (!otherCats.includes('Uncategorised')) otherCats.push('Uncategorised');
      const filteredIngs = boundIngs.filter(i => (i.name || '').toLowerCase().includes(reassignSearch.toLowerCase().trim()));

      bodyHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e7e5e4)">
          <div>
            <h3 style="margin:0;font-size:15px;font-weight:750">Reassign Items (${boundIngs.length})</h3>
            <p style="margin:2px 0 0 0;font-size:11.5px;color:var(--text2,#78716c)">Reassign ingredients before deleting "${escapeHtml(activeCat)}".</p>
          </div>
          <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="window.closeCategoryManagerModal()" aria-label="Close modal">✕</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <button type="button" class="btn xs ${reassignMode === 'mass' ? 'btn-primary primary' : 'btn-ghost ghost'}" onclick="window.setCatReassignMode('mass')">Mass Reassign</button>
          <button type="button" class="btn xs ${reassignMode === 'individual' ? 'btn-primary primary' : 'btn-ghost ghost'}" onclick="window.setCatReassignMode('individual')">Individual Sorting</button>
        </div>
        ${reassignMode === 'mass' ? `
          <div style="margin-bottom:16px">
            <label for="cat-mass-target-select" style="display:block;font-size:12px;font-weight:600;margin-bottom:6px;color:var(--text2,#78716c)">Reassign all ${boundIngs.length} items to:</label>
            <select id="cat-mass-target-select" name="cat_mass_target" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
              ${otherCats.map(c => `<option value="${escapeAttr(c)}" ${c === massTargetCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>` : `
          <div style="margin-bottom:8px">
            <input type="text" id="cat-reassign-filter" name="reassign_filter" aria-label="Filter items by name" placeholder="Filter items by name..." value="${escapeAttr(reassignSearch)}" oninput="window.handleReassignSearch(this.value)" style="width:100%;padding:6px 10px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box">
          </div>
          <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
            ${filteredIngs.map(ing => {
              const currentSel = individualCatMap[ing.id] || otherCats[0] || 'Uncategorised';
              const selId = `cat-select-${ing.id}`;
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--surface2,#f5f5f4);border-radius:6px;border:1px solid var(--border,#e7e5e4)">
                <label for="${selId}" style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ing.name)}</label>
                <select id="${selId}" name="cat_select_${ing.id}" onchange="window.updateIndividualCatMap('${escapeAttr(ing.id)}', this.value)" style="padding:4px 6px;font-size:11.5px;border:1px solid var(--border,#e7e5e4);border-radius:6px;background:var(--surface,#fff)">
                  ${otherCats.map(c => `<option value="${escapeAttr(c)}" ${c === currentSel ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
              </div>`;
            }).join('') || '<div style="font-size:12px;color:var(--text2,#78716c);padding:8px">No matching items found.</div>'}
          </div>`}
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn ghost sm" onclick="window.navCatStep('list')">Cancel</button>
          <button id="btn-submit-reassign-delete" type="button" class="btn primary sm" style="background:var(--red,#ef4444)" onclick="window.submitReassignAndDelete()">Reassign & Delete</button>
        </div>`;
    }

    modal.innerHTML = `<div class="card" style="width:100%;max-width:420px;background:var(--surface,#fff);padding:20px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.15)">${bodyHtml}</div>`;
  };

  renderCurrentStep();
  Object.assign(modal.style, { opacity: '1', pointerEvents: 'all' }); modal.classList.add('open');

  window.closeCategoryManagerModal = closeCategoryManagerModal;
  window.navCatStep = (step) => { wizardStep = step; reassignSearch = ''; renderCurrentStep(); };

  window.filterCatMergeOptions = (query) => {
    const listDiv = document.getElementById('cat-merge-dropdown-list');
    if (!listDiv) return;

    const state = getState() || {};
    const catObjects = getCategoryObjects(state);
    const otherCats = catObjects.filter(c => c.id !== activeCat && slugCategory(c.name) !== slugCategory(activeCat));
    const filtered = otherCats.filter(c => String(c.name).toLowerCase().includes(String(query || '').toLowerCase()));

    if (filtered.length === 0) {
      listDiv.innerHTML = `<div style="padding:8px 10px; font-size:12px; color:var(--text2,#78716c); font-style:italic;">No matching categories</div>`;
    } else {
      listDiv.innerHTML = filtered.map(c => {
        const ingCount = (state.ingredients || []).filter(i => slugCategory(i.category) === slugCategory(c.name)).length;
        const prodCount = (state.products || []).filter(p => slugCategory(p.category) === slugCategory(c.name)).length;
        const total = ingCount + prodCount;
        return `
          <div class="cat-merge-search-option" data-cat="${escapeAttr(c.name)}" style="padding:8px 10px; font-size:13px; cursor:pointer; font-weight:550; color:var(--text);" onmouseover="this.style.background='var(--surface2,#f5f5f4)'" onmouseout="this.style.background='transparent'" onmousedown="window.selectCatMergeOption('${escapeAttr(c.name)}')">
            ${escapeHtml(c.name)} (${total} items)
          </div>
        `;
      }).join('');
    }
    listDiv.style.display = 'block';
  };

  window.selectCatMergeOption = (cat) => {
    const input = document.getElementById('cat-merge-search-input');
    if (input) {
      input.value = cat;
      input.dataset.selectedVal = cat;
    }
    const listDiv = document.getElementById('cat-merge-dropdown-list');
    if (listDiv) listDiv.style.display = 'none';

    // Hide any previous warning when they select a valid category
    const warning = document.getElementById('cat-merge-validation-warning');
    if (warning) {
      warning.style.display = 'none';
      warning.textContent = '';
    }
  };

  window.submitAddCat = async () => {
    const input = document.getElementById('cat-manager-add-input'), val = input ? input.value.trim() : '';
    if (!val) return;
    
    const btn = document.getElementById('btn-submit-add-cat');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const state = getState() || {}, categories = Array.isArray(state.categories) ? [...state.categories] : [];
      if (!categories.some(c => slugCategory(c) === slugCategory(val))) {
        categories.push(toCanonicalCategoryName(val));
        setCategories(categories); 
        await saveCategories(categories);
      }
    } catch (err) {
      console.error('Failed to add category:', err);
    } finally {
      resetModalState();
      renderCurrentStep();
    }
  };

  window.submitMergeDuplicateCategories = async () => {
    const btn = document.getElementById('btn-merge-duplicates');
    if (btn) { btn.disabled = true; btn.textContent = 'Merging...'; }

    try {
      const repo = await import('../../services/HouseholdRepository.js');
      const res = await repo.mergeAllDuplicates();

      if (res && res.success) {
        // Hydrate local state store with the fresh deduplicated list
        const state = getState() || {};
        const freshIngredients = await repo.getIngredients();
        const freshProducts = await repo.getProducts();

        setCategories(res.categories); 
        setIngredients(freshIngredients); 
        setProducts(freshProducts);

        if (window.Store?.setState) {
          window.Store.setState({ 
            categories: res.categories, 
            ingredients: freshIngredients, 
            products: freshProducts 
          });
        }

        invalidateHierarchyCache();
        
        document.dispatchEvent(new CustomEvent('plateplan:state:categories', { detail: res.categories }));
        document.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: freshIngredients }));
        document.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: freshProducts }));

        if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();

        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Successfully merged duplicate categories!', 'success');
        }
      }
    } catch (err) {
      console.error('Failed to merge duplicate categories:', err);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Network error occurred while merging duplicates. Please try again.', 'error');
      }
    } finally {
      resetModalState();
      renderCurrentStep();
    }
  };

  window.startRenameCat = (cat) => { activeCat = cat; wizardStep = 'rename'; renderCurrentStep(); };
  
  window.submitRenameCat = async () => {
    const input = document.getElementById('cat-rename-input'), newName = input ? toCanonicalCategoryName(input.value) : '', oldCat = activeCat;
    if (!newName || !oldCat || newName === oldCat) { resetModalState(); renderCurrentStep(); return; }

    const btn = document.getElementById('btn-submit-rename-cat');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      const targetOld = oldCat, newCatKebab = slugifyToKebab(newName), state = getState() || {};
      const ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
      ings.forEach(i => {
        let changed = false;
        if (i.category === targetOld || i.cat === targetOld) { i.category = newName; i.cat = newCatKebab; changed = true; }
        if (Array.isArray(i.subtypes)) {
          i.subtypes.forEach(st => {
            if (st.category === targetOld || st.cat === targetOld) { st.category = newName; st.cat = newCatKebab; changed = true; }
          });
        }
        if (changed) i.updatedAt = new Date().toISOString();
      });

      prods.forEach(p => {
        if (p.category === targetOld || p.cat === targetOld) { p.category = newName; p.cat = newCatKebab; p.updatedAt = new Date().toISOString(); }
      });

      const categories = (state.categories || []).map(c => c === targetOld ? newName : c);
      setCategories(categories); setIngredients(ings); setProducts(prods);
      await saveHouseholdState({ categories, ingredients: ings, products: prods });
      invalidateHierarchyCache();
    } catch (err) {
      console.error('Failed to rename category:', err);
    } finally {
      resetModalState();
      renderCurrentStep();
    }
  };

  window.startMergeCat = (cat) => { activeCat = cat; wizardStep = 'merge'; renderCurrentStep(); };
  
  window.submitMergeCat = async () => {
    const input = document.getElementById('cat-merge-search-input');
    const targetCat = input ? (input.dataset.selectedVal || input.value.trim()) : '';
    const sourceCat = activeCat;

    const warning = document.getElementById('cat-merge-validation-warning');

    if (!targetCat || !sourceCat) {
      if (warning) {
        warning.textContent = 'Please select a valid destination category.';
        warning.style.display = 'block';
      }
      return;
    }

    if (slugCategory(targetCat) === slugCategory(sourceCat)) {
      if (warning) {
        warning.textContent = 'Source and target categories must be different';
        warning.style.display = 'block';
      }
      return;
    }

    const btn = document.getElementById('btn-submit-merge-cat');
    if (btn) { btn.disabled = true; btn.textContent = 'Merging...'; }

    let success = false;
    try {
      await mergeCategory(sourceCat, targetCat);
      success = true;
    } catch (err) {
      console.error('Failed to merge categories:', err);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Network error occurred while merging categories. Please try again.', 'error');
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Confirm Merge';
      }
    } finally {
      if (success) {
        closeCategoryManagerModal();
      }
    }
  };

  window.setCatReassignMode = (mode) => { reassignMode = mode; renderCurrentStep(); };
  window.handleReassignSearch = (text) => { reassignSearch = text || ''; renderCurrentStep(); };
  window.updateIndividualCatMap = (ingId, targetCat) => { individualCatMap[ingId] = targetCat; };

  window.submitReassignAndDelete = async () => {
    const deletedCat = activeCat; if (!deletedCat) return;

    const btn = document.getElementById('btn-submit-reassign-delete');
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }

    try {
      const state = getState() || {}, ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
      const massTarget = document.getElementById('cat-mass-target-select')?.value || massTargetCat || 'Uncategorised';
      ings.forEach(i => {
        if (i.category === deletedCat || i.cat === deletedCat) {
          const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
          i.category = dest; i.cat = slugifyToKebab(dest); i.updatedAt = new Date().toISOString();
        }
      });
      prods.forEach(p => {
        if (p.category === deletedCat || p.cat === deletedCat) {
          p.category = reassignMode === 'mass' ? massTarget : 'Uncategorised'; p.cat = slugifyToKebab(massTarget); p.updatedAt = new Date().toISOString();
        }
      });
      const categories = (state.categories || []).filter(c => c !== deletedCat);
      setCategories(categories); setIngredients(ings); setProducts(prods);
      await saveHouseholdState({ categories, ingredients: ings, products: prods });
      if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
      invalidateHierarchyCache();
    } catch (err) {
      console.error('Failed to reassign and delete category:', err);
    } finally {
      closeCategoryManagerModal();
    }
  };
}

window.closeDeleteCategoryModal = function closeDeleteCategoryModal() {
  const overlay = document.getElementById('category-delete-confirm-modal');
  if (overlay) overlay.remove();
};

window.handleDeleteCategory = async function handleDeleteCategory(identifier) {
  if (!identifier) return;
  const category = resolveCategory(identifier);
  if (!category?.name) return;
  const targetId = category.id, targetName = category.name;
  try {
    const { deleteCategory } = await import('../../services/HouseholdRepository.js');
    await deleteCategory(targetId || targetName);
    
    // Also update local state to reflect the delete and re-parent
    const state = getState() || {};
    const fallbackCatName = 'Uncategorised';
    const fallbackKebab = slugifyToKebab(fallbackCatName);

    const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    ings.forEach(i => {
      let changed = false;
      if (i.category === targetName || i.cat === slugifyToKebab(targetName)) {
        i.category = fallbackCatName;
        i.cat = fallbackKebab;
        changed = true;
      }
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (st.category === targetName || st.cat === slugifyToKebab(targetName)) {
            st.category = fallbackCatName;
            st.cat = fallbackKebab;
            changed = true;
          }
        });
      }
      if (changed) i.updatedAt = new Date().toISOString();
    });

    const prods = Array.isArray(state.products) ? [...state.products] : [];
    prods.forEach(p => {
      if (p.category === targetName || p.cat === slugifyToKebab(targetName)) {
        p.category = fallbackCatName;
        p.cat = fallbackKebab;
        p.updatedAt = new Date().toISOString();
      }
    });

    const categories = (state.categories || []).filter(c => {
      const cName = typeof c === 'string' ? c : c?.name;
      return cName !== targetName && slugCategory(cName) !== slugCategory(targetName);
    });

    setCategories(categories); 
    setIngredients(ings); 
    setProducts(prods);

    invalidateHierarchyCache();
  } catch (err) {
    console.error('Failed to delete category:', err);
  } finally {
    resetModalState();
    if (typeof window.openCategoryManagerModal === 'function') window.openCategoryManagerModal();
  }
};

window.promptDeleteCategory = function promptDeleteCategory(categoryId) {
  if (!categoryId) return;
  const category = resolveCategory(categoryId);
  if (!category?.name) return;
  const state = getState() || {};
  const ings = Array.isArray(state.ingredients) ? state.ingredients : [];
  const prods = Array.isArray(state.products) ? state.products : [];

  const boundIngs = ings.filter(i => (
    i.category === category.name || i.cat === category.name || slugCategory(i.category) === slugCategory(category.name) ||
    (Array.isArray(i.subtypes) && i.subtypes.some(st => st.category === category.name || st.cat === category.name || slugCategory(st.category) === slugCategory(category.name)))
  ));
  const boundProds = prods.filter(p => p.category === category.name || p.cat === category.name || slugCategory(p.category) === slugCategory(category.name));
  const totalBound = boundIngs.length + boundProds.length;

  if (totalBound > 0) {
    activeCat = category.name; wizardStep = 'reassign'; reassignMode = 'mass'; reassignSearch = '';
    const otherCats = getRawCategories(state).filter(c => c !== category.name);
    massTargetCat = otherCats[0] || 'Uncategorised'; individualCatMap = {};
    boundIngs.forEach(i => { individualCatMap[i.id] = massTargetCat; });
    renderCategoryManagerModal(); return;
  }

  window.closeDeleteCategoryModal();
  const overlay = document.createElement('div');
  overlay.id = 'category-delete-confirm-modal';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div style="background:#ffffff; border-radius:16px; padding:20px; width:100%; max-width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; margin-bottom:10px; font-size:1.15rem; font-weight:750; color:var(--red,#ef4444);">Delete "${escapeHtml(category.name)}"</h3>
      <p style="font-size:13px; color:var(--text2,#78716c); margin:0 0 16px 0; line-height:1.4">Are you sure you want to delete this category? This action is permanent.</p>
      <div style="display:flex; gap:8px; justify-content:flex-end">
        <button type="button" class="btn sm" onclick="window.closeDeleteCategoryModal()">Cancel</button>
        <button type="button" class="btn sm primary" style="background:var(--red,#ef4444); color:#fff;" id="btn-confirm-delete-cat">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('btn-confirm-delete-cat').onclick = () => window.handleDeleteCategory(category.id || category.name);
};

if (typeof window !== 'undefined') {
  window.openCategoryManagerModal = () => { 
    resetModalState(); 
    renderCategoryManagerModal(); 
  };
}

export async function mergeCategory(sourceCat, targetCat) {
  if (!sourceCat || !targetCat) {
    throw new Error('Missing source or target category');
  }
  if (slugCategory(sourceCat) === slugCategory(targetCat)) {
    throw new Error('Source and target categories must be different');
  }

  const targetKebab = slugifyToKebab(targetCat), state = getState() || {};
  const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const prods = Array.isArray(state.products) ? [...state.products] : [];
  
  ings.forEach(i => {
    if (i.category === sourceCat || i.cat === sourceCat) { 
      i.category = targetCat; 
      i.cat = targetKebab; 
      i.updatedAt = new Date().toISOString(); 
    }
  });
  prods.forEach(p => {
    if (p.category === sourceCat || p.cat === sourceCat) { 
      p.category = targetCat; 
      p.cat = targetKebab; 
      p.updatedAt = new Date().toISOString(); 
    }
  });
  
  const categories = (state.categories || []).filter(c => c !== sourceCat);
  setCategories(categories); 
  setIngredients(ings); 
  setProducts(prods);
  
  await saveHouseholdState({ categories, ingredients: ings, products: prods });
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}
