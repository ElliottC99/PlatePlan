/**
 * src/views/PantryBankModalService.js (v3.38.74)
 * Service for managing the Ingredient Family Details Modal in the Pantry Bank.
 * Isolates modal lifecycle and saving logic from the main view.
 */

import { getState, setIngredients } from '../store/store.js';
import { saveIngredient } from '../services/IngredientRepository.js';
import { getActiveCategories, slugCategory } from '../models/PantryHierarchyModel.js';
import { updateIngredientFamilyModalUI } from '../components/pantry/IngredientFamilyModalUI.js';
import { openProductEditModal } from './ProductBankView.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

let activeEditingIngredientId = null;

export function closeIngredientFamilyDetailsModal() {
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  if (modalWrap) {
    modalWrap.classList.remove('open');
    modalWrap.dataset.parentId = '';
    modalWrap.dataset.editingIngredientId = '';
  }
  const catEl = document.getElementById('ingredient-family-details-cat');
  if (catEl) catEl.disabled = false;
  const parentWrap = document.getElementById('parent-ingredient-display-wrap');
  if (parentWrap) parentWrap.style.display = 'none';
  const actionsWrap = document.getElementById('subtype-product-actions-wrap');
  if (actionsWrap) actionsWrap.style.display = 'none';
  const nameEl = document.getElementById('ingredient-family-details-name');
  if (nameEl) nameEl.oninput = null;
  const tescoEl = document.getElementById('tesco-search-helper-link');
  if (tescoEl) tescoEl.innerHTML = '';
  document.body.style.overflow = '';
  activeEditingIngredientId = null;

  if (window.__modalContext && window.__modalContext.returnTo === 'data-quality') {
    window.__modalContext = null;
    if (typeof window.showView === 'function') window.showView('data');
  }
}

export function openIngredientFamilyDetailsModal(ingredientId = null, parentId = null) {
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  if (!modalWrap) return;

  document.body.style.overflow = 'hidden';
  activeEditingIngredientId = ingredientId;
  modalWrap.dataset.parentId = parentId || '';
  modalWrap.dataset.editingIngredientId = ingredientId || '';

  const state = getState(), ingredients = state.ingredients || [], products = state.products || [];
  const ing = ingredientId ? ingredients.find(i => String(i.id) === String(ingredientId)) : null;
  const parent = parentId ? ingredients.find(i => String(i.id) === String(parentId)) : null;

  const titleEl = document.getElementById('ingredient-family-details-title');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const catEl = document.getElementById('ingredient-family-details-cat');
  const notesEl = document.getElementById('ingredient-family-details-notes');
  const msgEl = document.getElementById('ingredient-family-details-msg');

  if (titleEl) {
    titleEl.textContent = ing ? `Edit ${ing.name}` : (parent ? `Add Sub-type to ${parent.name}` : 'New Catalog Item');
  }
  if (nameEl) nameEl.value = ing?.name || '';
  if (notesEl) notesEl.value = ing?.notes || '';

  if (catEl) {
    const categories = getActiveCategories(state);
    const selectedCat = (ing?.category || parent?.category || '').toLowerCase();
    catEl.innerHTML = categories.map(c => `<option value="${escapeAttr(c.toLowerCase())}" ${selectedCat === c.toLowerCase() ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
    catEl.disabled = Boolean(parent && !ing);
    const targetCat = ing?.category || parent?.category || '';
    if (targetCat) catEl.value = targetCat;
    if (parent && !ing) {
      catEl.value = parent.category ? parent.category.toLowerCase() : '';
      catEl.disabled = true;
    }
  }

  if (msgEl && ing) {
    const linked = products.filter(p => String(p.ingredientId) === String(ing.id) || String(p.groupId) === String(ing.id));
    msgEl.innerHTML = `<div style="margin-top:14px;padding:10px;background:var(--surface2,#f5f5f4);border-radius:8px;border:1px solid var(--border,#e7e5e4)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;font-weight:750">Linked Products (${linked.length})</span>
        <button type="button" class="btn sm ghost" data-action="add-product" data-product-id="" style="font-size:11px">+ Add Product</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto">
        ${linked.map(p => `<div style="padding:6px 8px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:6px;display:flex;align-items:center;justify-content:space-between">
          <div><span style="font-size:12px;font-weight:600">${escapeHtml(p.name)}</span><div style="font-size:11px;color:var(--text2,#78716c)">${escapeHtml(p.brand || '')} · £${Number(p.price || 0).toFixed(2)}</div></div>
          <div style="display:flex;gap:4px">
            ${p.isAutoDefault ? '<span class="tag" style="font-size:10px;background:rgba(16,185,129,0.15);color:var(--green);font-weight:700">Default</span>' : `<button type="button" class="btn xs ghost" data-action="set-default-product" data-product-id="${escapeAttr(p.id)}" data-ingredient-id="${escapeAttr(ing.id)}">Default</button>`}
            <button type="button" class="btn xs ghost" data-action="edit-product" data-product-id="${escapeAttr(p.id)}">Edit</button>
          </div>
        </div>`).join('') || '<div style="font-size:12px;color:var(--text2)">No linked products.</div>'}
      </div>
    </div>`;
  } else if (msgEl) {
    msgEl.innerHTML = '';
  }

  updateIngredientFamilyModalUI(ing, parent);

  if (parentId) {
    const saveBtn = document.getElementById('save-ingredient-family-btn') || document.getElementById('ingredient-family-save-btn');
    if (saveBtn) {
      const linkedProds = products.filter(p => String(p.ingredientId) === String(ingredientId) || String(p.groupId) === String(ingredientId));
      if (linkedProds.length === 0) {
        saveBtn.disabled = true;
        saveBtn.title = "You must link at least one product before saving.";
        saveBtn.style.opacity = '0.5';
      } else {
        saveBtn.disabled = false;
        saveBtn.title = "";
        saveBtn.style.opacity = '1';
      }
    }
  }

  modalWrap.classList.add('open');

  if (!modalWrap.hasAttribute('data-delegated')) {
    modalWrap.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      
      if (action === 'add-product') {
        if (typeof openProductEditModal === 'function') openProductEditModal(null);
      } else if (action === 'set-default-product') {
        if (typeof window.handleSetDefaultProduct === 'function') window.handleSetDefaultProduct(target.dataset.productId, target.dataset.ingredientId);
      } else if (action === 'edit-product') {
        if (typeof openProductEditModal === 'function') openProductEditModal(target.dataset.productId);
      }
    });
    modalWrap.setAttribute('data-delegated', 'true');
  }
}

export async function saveIngredientFamilyDetailsModal(renderIngredientBank) {
  const name = (document.getElementById('ingredient-family-details-name')?.value || '').trim();
  if (!name) return;
  const rawCat = (document.getElementById('ingredient-family-details-cat')?.value || 'other').trim();
  const state = getState();
  const existingCats = state.categories || [];
  const matchedCat = existingCats.find(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return (cName || '').trim().toLowerCase() === rawCat.toLowerCase();
  });
  const category = matchedCat ? (typeof matchedCat === 'string' ? matchedCat : matchedCat.name) : rawCat;

  const notes = (document.getElementById('ingredient-family-details-notes')?.value || '').trim();
  const modalWrap = document.getElementById('ingredient-family-details-wrap');
  const parentId = modalWrap?.dataset?.parentId;

  if (parentId) {
    const currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
    const parent = currentIngs.find(p => String(p.id) === String(parentId));
    if (!parent) return;

    const hasProduct = activeEditingIngredientId && (state.products || []).some(p => String(p.subtypeId) === String(activeEditingIngredientId));
    if (!activeEditingIngredientId || !hasProduct) {
      const msgEl = document.getElementById('ingredient-family-details-msg');
      if (msgEl) {
        msgEl.innerHTML = `<div style="padding: 10px; background: #fee2e2; color: #ef4444; border-radius: 8px; font-weight: 600; margin-bottom: 12px;">⚠️ A sub-type must have at least one product attached or linked before saving.</div>`;
      }
      return;
    }

    if (!Array.isArray(parent.subtypes)) parent.subtypes = [];
    const sub = parent.subtypes.find(s => String(s.id) === String(activeEditingIngredientId));
    if (sub) {
      sub.name = name; sub.notes = notes; parent.updatedAt = new Date().toISOString();
      setIngredients(currentIngs); closeIngredientFamilyDetailsModal(); 
      if (typeof renderIngredientBank === 'function') renderIngredientBank();
      try { await saveIngredient(parent); } catch (e) {}
    }
    return;
  }

  const currentIngs = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  const updatedIng = {
    ...(activeEditingIngredientId ? currentIngs.find(i => String(i.id) === String(activeEditingIngredientId)) : {}),
    id: activeEditingIngredientId || `ing_${Date.now()}`, name, category, notes, updatedAt: new Date().toISOString()
  };
  const existingIdx = currentIngs.findIndex(i => String(i.id) === String(updatedIng.id));
  if (existingIdx >= 0) currentIngs[existingIdx] = updatedIng; else currentIngs.push(updatedIng);

  setIngredients(currentIngs); closeIngredientFamilyDetailsModal(); 
  if (typeof renderIngredientBank === 'function') renderIngredientBank();
  try { await saveIngredient(updatedIng); } catch (e) { console.warn('[PantryBankModalService] Sync error:', e); }
}
