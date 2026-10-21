/**
 * src/components/pantry/CategoryManagerModalUI.js (v3.35.37)
 * In-App Multi-Step Category Operations Wizard, Raw Exposure & Deep State Merge Modal.
 * Unified allBound item handling across root ingredients, subtypes, and products.
 */

import { getState } from '../../store/store.js';
import { getUnifiedCategories } from '../../services/HouseholdRepository.js';
import { slugCategory, invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { resetCategoryFilter } from '../../views/PantryBankView.js';
import { 
  renderListStepHtml, 
  renderRenameStepHtml, 
  renderMergeStepHtml, 
  renderReassignStepHtml, 
  renderDeleteConfirmModalHtml, 
  escapeHtml, 
  escapeAttr 
} from './CategoryManagerTemplates.js';
import { 
  resolveCategory, 
  submitAddCat, 
  submitMergeDuplicateCategories, 
  submitRenameCat, 
  submitMergeCat, 
  submitReassignAndDelete, 
  handleDeleteCategory 
} from './CategoryManagerOperations.js';

const DROPDOWN_BLUR_DELAY_MS = 200;

let wizardStep = 'list', activeCat = null, reassignMode = 'mass', reassignSearch = '', massTargetCat = '', individualCatMap = {};

export function getCategoryName(cat) {
  return !cat ? '' : typeof cat === 'string' ? cat : (cat.name || cat.categoryName || cat.id || '');
}

export function getCategoryObjects(state = {}) {
  return getUnifiedCategories(state).map(name => ({ id: name, name }));
}

export function getRawCategories(state = {}) {
  return getUnifiedCategories(state);
}

export function resetModalState() {
  wizardStep = 'list'; activeCat = null; reassignSearch = ''; massTargetCat = ''; individualCatMap = {};
  const confirmModal = document.getElementById('category-delete-confirm-modal');
  if (confirmModal) confirmModal.remove();
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

function filterCatMergeOptions(query) {
  const listDiv = document.getElementById('cat-merge-dropdown-list');
  if (!listDiv) return;
  const state = getState();
  const catObjects = getCategoryObjects(state);
  const otherCats = catObjects.filter(c => String(c.name || '').trim() !== String(activeCat || '').trim());
  const filtered = otherCats.filter(c => String(c.name).toLowerCase().includes(String(query || '').toLowerCase()));

  listDiv.innerHTML = filtered.length === 0
    ? `<div style="padding:8px 10px; font-size:12px; color:var(--text2,#78716c); font-style:italic;">No matching categories</div>`
    : filtered.map(c => {
        const total = (state.ingredients || []).filter(i => slugCategory(i.category) === slugCategory(c.name)).length + (state.products || []).filter(p => slugCategory(p.category) === slugCategory(c.name)).length;
        return `<div class="cat-merge-search-option" data-action="select-merge-option" data-category="${escapeAttr(c.name)}" style="padding:8px 10px; font-size:13px; cursor:pointer; font-weight:550; color:var(--text);">${escapeHtml(c.name)} (${total} items)</div>`;
      }).join('');
  listDiv.style.display = 'block';
}

function filterCatMassOptions(query) {
  const listDiv = document.getElementById('cat-mass-dropdown-list');
  if (!listDiv) return;
  const state = getState();
  const catObjects = getCategoryObjects(state);
  const otherCats = catObjects.filter(c => String(c.name || '').trim() !== String(activeCat || '').trim());
  if (!otherCats.some(c => c.name === 'Uncategorised')) otherCats.push({ id: 'Uncategorised', name: 'Uncategorised' });
  const filtered = otherCats.filter(c => String(c.name).toLowerCase().includes(String(query || '').toLowerCase()));

  listDiv.innerHTML = filtered.length === 0
    ? `<div style="padding:8px 10px; font-size:12px; color:var(--text2,#78716c); font-style:italic;">No matching categories</div>`
    : filtered.map(c => `<div class="cat-mass-search-option" data-action="select-mass-option" data-category="${escapeAttr(c.name)}" style="padding:8px 10px; font-size:13px; cursor:pointer; font-weight:550; color:var(--text);">📂 [Category] ${escapeHtml(c.name)}</div>`).join('');
  listDiv.style.display = 'block';
}

export function promptDeleteCategory(categoryId) {
  if (!categoryId) return;
  const category = resolveCategory(categoryId); if (!category?.name) return;
  const state = getState(), ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];

  const boundIngs = ings.filter(i => slugCategory(i.category) === slugCategory(category.name));
  const boundSubtypes = ings.flatMap(i => i.subtypes || []).filter(s => slugCategory(s.category) === slugCategory(category.name));
  const boundProds = prods.filter(p => slugCategory(p.category) === slugCategory(category.name));
  const allBound = [...boundIngs, ...boundSubtypes, ...boundProds];

  if (allBound.length > 0) {
    activeCat = category.name; wizardStep = 'reassign'; reassignMode = 'mass'; reassignSearch = '';
    const otherCats = getRawCategories(state).filter(c => c !== category.name);
    massTargetCat = otherCats[0] || 'Uncategorised'; individualCatMap = {};
    allBound.forEach(item => { if (item?.id) individualCatMap[item.id] = massTargetCat; });
    renderCategoryManagerModal();
    return;
  }

  const existingOverlay = document.getElementById('category-delete-confirm-modal');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'category-delete-confirm-modal';
  overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  overlay.innerHTML = renderDeleteConfirmModalHtml(category.name, category.id);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]'); if (!btn) return;
    e.preventDefault(); e.stopPropagation();

    const action = btn.dataset.action;
    if (action === 'close-delete-confirm') { overlay.remove(); return; }
    if (action === 'confirm-delete') {
      const catVal = btn.dataset.category;
      btn.disabled = true; btn.textContent = 'Deleting...';
      try {
        await handleDeleteCategory(catVal);
      } catch (err) {
        console.error('[CategoryManager] Delete confirm error:', err);
      } finally {
        overlay.remove();
        resetModalState();
        renderCategoryManagerModal();
      }
    }
  });
}

export function renderCategoryManagerModal() {
  let modal = document.getElementById('category-manager-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'category-manager-modal';
    modal.className = 'modal-wrap';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    document.body.appendChild(modal);
  } else if (modal.dataset.wizardStep) {
    wizardStep = modal.dataset.wizardStep;
  }

  const renderCurrentStep = () => {
    const state = getState(), catObjects = getCategoryObjects(state), ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
    let bodyHtml = '';

    if (wizardStep === 'list') {
      bodyHtml = renderListStepHtml(catObjects, ingredients, state);
    } else if (wizardStep === 'rename') {
      bodyHtml = renderRenameStepHtml(activeCat);
    } else if (wizardStep === 'merge') {
      bodyHtml = renderMergeStepHtml(activeCat);
    } else if (wizardStep === 'reassign') {
      const rawCategories = getRawCategories(state);
      const boundIngs = ingredients.filter(i => slugCategory(i.category) === slugCategory(activeCat));
      const boundSubtypes = ingredients.flatMap(i => i.subtypes || []).filter(s => slugCategory(s.category) === slugCategory(activeCat));
      const boundProds = (state.products || []).filter(p => slugCategory(p.category) === slugCategory(activeCat));
      const allBound = [...boundIngs, ...boundSubtypes, ...boundProds];

      const otherCats = rawCategories.filter(c => c !== activeCat);
      if (!otherCats.includes('Uncategorised')) otherCats.push('Uncategorised');
      bodyHtml = renderReassignStepHtml(activeCat, reassignMode, allBound, otherCats, reassignSearch, massTargetCat, individualCatMap);
    }

    modal.innerHTML = `<div class="card" style="width:100%;max-width:420px;background:var(--surface,#fff);padding:20px;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,0.15)">${bodyHtml}</div>`;
  };

  if (!modal.dataset.listenersBound) {
    modal.dataset.listenersBound = 'true';

    modal.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]'); if (!btn) return;
      const action = btn.dataset.action; if (!action) return;

      e.preventDefault(); e.stopPropagation();

      const category = btn.dataset.category, step = btn.dataset.step, mode = btn.dataset.mode;

      try {
        if (action === 'close') { closeCategoryManagerModal(); return; }
        if (action === 'nav-step') { wizardStep = step || 'list'; reassignSearch = ''; renderCurrentStep(); return; }
        if (action === 'start-rename') { activeCat = category; wizardStep = 'rename'; renderCurrentStep(); return; }
        if (action === 'start-merge') { activeCat = category; wizardStep = 'merge'; renderCurrentStep(); return; }
        if (action === 'prompt-delete') { promptDeleteCategory(category); return; }
        if (action === 'set-reassign-mode') { reassignMode = mode || 'mass'; renderCurrentStep(); return; }
        if (action === 'select-merge-option') {
          const input = document.getElementById('cat-merge-search-input');
          if (input) { input.value = category; input.dataset.selectedVal = category; }
          const listDiv = document.getElementById('cat-merge-dropdown-list');
          if (listDiv) listDiv.style.display = 'none';
          return;
        }
        if (action === 'select-mass-option') {
          massTargetCat = category;
          const input = document.getElementById('cat-mass-search-input');
          if (input) input.value = category;
          const listDiv = document.getElementById('cat-mass-dropdown-list');
          if (listDiv) listDiv.style.display = 'none';
          return;
        }
        if (action === 'submit-add') {
          btn.disabled = true; const origText = btn.textContent; btn.textContent = '...';
          try {
            const input = document.getElementById('cat-manager-add-input');
            await submitAddCat(input ? input.value.trim() : '');
          } finally {
            btn.disabled = false; btn.textContent = origText;
            resetModalState(); renderCurrentStep();
          }
          return;
        }
        if (action === 'merge-duplicates') {
          btn.disabled = true; btn.textContent = 'Merging...';
          try {
            await submitMergeDuplicateCategories();
          } finally {
            resetModalState(); renderCurrentStep();
          }
          return;
        }
        if (action === 'submit-rename') {
          btn.disabled = true; btn.textContent = 'Saving...';
          try {
            const input = document.getElementById('cat-rename-input');
            await submitRenameCat(activeCat, input ? input.value : '');
          } finally {
            resetModalState(); renderCurrentStep();
          }
          return;
        }
        if (action === 'submit-merge') {
          btn.disabled = true; btn.textContent = 'Merging...';
          try {
            const input = document.getElementById('cat-merge-search-input');
            const targetCat = input ? (input.dataset.selectedVal || input.value.trim()) : '';
            await submitMergeCat(activeCat, targetCat);
          } catch (err) {
            const warning = document.getElementById('cat-merge-validation-warning');
            if (warning) { warning.textContent = err.message || 'Merge failed.'; warning.style.display = 'block'; }
          } finally {
            resetModalState(); renderCategoryManagerModal();
          }
          return;
        }
        if (action === 'submit-reassign-delete') {
          btn.disabled = true; btn.textContent = 'Deleting...';
          try {
            await submitReassignAndDelete(activeCat, reassignMode, massTargetCat, individualCatMap);
          } finally {
            closeCategoryManagerModal();
          }
          return;
        }
      } catch (err) {
        console.error(`[CategoryManager] Action execution error (${action}):`, err);
      }
    });

    modal.addEventListener('input', (e) => {
      const action = e.target?.dataset?.action;
      if (action === 'merge-search-input') filterCatMergeOptions(e.target.value);
      else if (action === 'mass-search-input') filterCatMassOptions(e.target.value);
      else if (action === 'reassign-filter-input') { reassignSearch = e.target.value || ''; renderCurrentStep(); }
    });

    modal.addEventListener('focusin', (e) => {
      const action = e.target?.dataset?.action;
      if (action === 'merge-search-input') filterCatMergeOptions(e.target.value);
      else if (action === 'mass-search-input') filterCatMassOptions(e.target.value);
    });

    modal.addEventListener('focusout', (e) => {
      const action = e.target?.dataset?.action;
      if (action === 'merge-search-input') {
        setTimeout(() => { const listDiv = document.getElementById('cat-merge-dropdown-list'); if (listDiv) listDiv.style.display = 'none'; }, DROPDOWN_BLUR_DELAY_MS);
      } else if (action === 'mass-search-input') {
        setTimeout(() => { const listDiv = document.getElementById('cat-mass-dropdown-list'); if (listDiv) listDiv.style.display = 'none'; }, DROPDOWN_BLUR_DELAY_MS);
      }
    });

    modal.addEventListener('change', (e) => {
      const action = e.target?.dataset?.action;
      if (action === 'individual-cat-select') {
        const ingId = e.target.dataset.ingId;
        if (ingId) individualCatMap[ingId] = e.target.value;
      }
    });
  }

  renderCurrentStep();
  Object.assign(modal.style, { opacity: '1', pointerEvents: 'all' });
  modal.classList.add('open');
}

if (typeof window !== 'undefined') {
  window.openCategoryManagerModal = () => { resetModalState(); renderCategoryManagerModal(); };
  window.closeCategoryManagerModal = () => { closeCategoryManagerModal(); };
}
