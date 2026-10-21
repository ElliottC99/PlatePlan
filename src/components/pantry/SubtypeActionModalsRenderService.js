/**
 * src/components/pantry/SubtypeActionModalsRenderService.js (v3.38.57)
 * Modal controller and event binding service for Sub-type action modals.
 * Consumes pure template builders from SubtypeModalRenderService.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { deleteSubtype } from '../../services/SubtypeActionService.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { saveIngredient } from '../../services/IngredientRepository.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { promoteSubtype, moveSubtype, mergeSubtype } from '../../services/SubtypeRepository.js';
import { closeModal, showModal, formatBrandProductLabel, setupModalDelegation } from './SubtypeActionModalsUI.js';
import {
  renderEditSubtypeModalHTML,
  renderReorganizeModalHTML,
  renderManageAliasesModalHTML,
  renderDeleteSubtypeModalHTML,
  escapeHTML
} from '../../views/SubtypeModalRenderService.js';

// 1. EDIT SUB-TYPE MODAL
export function openEditSubtypeModal(subtypeId, parentId) {
  const state = getState();
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;

  const linkedProds = (state.products || []).filter(p => String(p.subtypeId) === String(subtypeId));

  const html = renderEditSubtypeModalHTML({
    sub,
    parentId,
    subtypeId,
    linkedProds,
    formatBrandProductLabel
  });

  showModal(html);
  setupModalDelegation();

  const saveBtn = document.getElementById('save-edit-sub-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const nameInput = document.getElementById('edit-sub-name');
      const notesInput = document.getElementById('edit-sub-notes');
      const newName = nameInput ? nameInput.value.trim() : '';
      if (!newName) return;

      sub.name = newName;
      if (notesInput) sub.notes = notesInput.value.trim();
      parent.updatedAt = new Date().toISOString();

      setIngredients([...state.ingredients]);
      closeModal();
      invalidateHierarchyCache();
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      await saveIngredient(parent);
    };
  }

  const cancelBtn = document.getElementById('btn-cancel-edit-sub');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      closeModal();
    };
  }

  const unlinkBtns = document.querySelectorAll('.btn-unlink-prod');
  unlinkBtns.forEach(btn => {
    btn.onclick = async () => {
      const prodId = btn.getAttribute('data-prod-id');
      const prods = [...(state.products || [])];
      const prod = prods.find(p => String(p.id) === String(prodId));
      if (prod) {
        prod.subtypeId = null;
        prod.isAutoDefault = false;
        prod.updatedAt = new Date().toISOString();
        setProducts(prods);
        openEditSubtypeModal(subtypeId, parentId);
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
        await saveProduct(prod);
      }
    };
  });
}

// 2. CONSOLIDATED REORGANISE MODAL (Promote, Move, Merge)
export function openSubtypeReorganizeModal(subtypeId, parentId) {
  const state = getState();
  const currentIngs = state.ingredients || [];
  const parent = currentIngs.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;

  const targetParents = currentIngs.filter(i => String(i.id) !== String(parentId));
  const siblingSubtypes = parent.subtypes.filter(s => String(s.id) !== String(subtypeId));

  const html = renderReorganizeModalHTML({
    sub,
    parent,
    targetParents,
    siblingSubtypes
  });

  showModal(html);

  const btnCancel = document.getElementById('btn-reorg-cancel');
  if (btnCancel) {
    btnCancel.onclick = () => closeModal();
  }

  const btnPromote = document.getElementById('btn-reorg-promote');
  if (btnPromote) {
    btnPromote.onclick = async () => {
      closeModal();
      try {
        const res = await promoteSubtype(parentId, subtypeId);
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Promoted to standalone ingredient (${res.modifiedRecipesCount || 0} recipes updated)`, 'success');
        }
      } catch (err) {
        console.error('[SubtypeActionModalsUI] Promote failed:', err);
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Failed to promote sub-type.', 'error');
      }
    };
  }

  const btnMove = document.getElementById('btn-reorg-move');
  if (btnMove) {
    btnMove.onclick = async () => {
      const moveSelect = document.getElementById('reorg-move-select');
      const targetParentId = moveSelect ? moveSelect.value : '';
      if (!targetParentId) return;
      closeModal();
      try {
        const res = await moveSubtype(parentId, subtypeId, targetParentId);
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Moved sub-type to new parent (${res.modifiedRecipesCount || 0} recipes updated)`, 'success');
        }
      } catch (err) {
        console.error('[SubtypeActionModalsUI] Move failed:', err);
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Failed to move sub-type.', 'error');
      }
    };
  }

  const btnMerge = document.getElementById('btn-reorg-merge');
  if (btnMerge) {
    btnMerge.onclick = async () => {
      const mergeSelect = document.getElementById('reorg-merge-select');
      const targetSubtypeId = mergeSelect ? mergeSelect.value : '';
      if (!targetSubtypeId) return;
      closeModal();
      try {
        const res = await mergeSubtype(parentId, subtypeId, targetSubtypeId);
        invalidateHierarchyCache();
        if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
        if (typeof window.renderProductBank === 'function') window.renderProductBank();
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Merged sub-type into sibling (${res.modifiedRecipesCount || 0} recipes updated)`, 'success');
        }
      } catch (err) {
        console.error('[SubtypeActionModalsUI] Merge failed:', err);
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Failed to merge sub-type.', 'error');
      }
    };
  }
}

// 3. MANAGE ALIASES MODAL
export function openSubtypeAliasModal(subtypeId, parentId) {
  const state = getState();
  const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;
  const aliases = Array.isArray(sub.aliases) ? sub.aliases : [];

  const html = renderManageAliasesModalHTML({ sub, aliases });
  showModal(html);

  const btnClose = document.getElementById('btn-close-aliases');
  if (btnClose) {
    btnClose.onclick = () => closeModal();
  }

  const removeBtns = document.querySelectorAll('.btn-remove-sub-alias');
  removeBtns.forEach(btn => {
    btn.onclick = async () => {
      const aliasToRemove = btn.getAttribute('data-alias');
      if (!aliasToRemove) return;
      sub.aliases = aliases.filter(a => a !== aliasToRemove);
      parent.updatedAt = new Date().toISOString();
      setIngredients([...state.ingredients]);
      openSubtypeAliasModal(subtypeId, parentId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      await saveIngredient(parent);
    };
  });

  const addBtn = document.getElementById('btn-add-alias');
  if (addBtn) {
    addBtn.onclick = async () => {
      const input = document.getElementById('new-alias-input');
      const val = (input?.value || '').trim();
      if (!val) return;
      if (!sub.aliases) sub.aliases = [];
      if (!sub.aliases.includes(val)) sub.aliases.push(val);
      parent.updatedAt = new Date().toISOString();
      setIngredients([...state.ingredients]);
      openSubtypeAliasModal(subtypeId, parentId);
      if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
      await saveIngredient(parent);
    };
  }
}

// 4. DELETE SUB-TYPE MODAL
export function openSubtypeDeleteModal(subtypeId, parentId) {
  const state = getState();
  const ingredients = (state.ingredients && state.ingredients.length) ? state.ingredients : (getState()?.ingredients || []);
  let parent = ingredients.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes) || !parent.subtypes.some(s => String(s.id) === String(subtypeId))) {
    parent = ingredients.find(i => Array.isArray(i.subtypes) && i.subtypes.some(s => String(s.id) === String(subtypeId)));
  }
  if (!parent || !Array.isArray(parent.subtypes)) return;
  const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
  if (!sub) return;

  const html = renderDeleteSubtypeModalHTML({
    sub,
    parentId: parent.id,
    subtypeId
  });

  showModal(html);
  setupModalDelegation();

  const confirmBtn = document.getElementById('btn-confirm-sub-delete');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      closeModal();
      await deleteSubtype(parent.id, subtypeId);
    };
  }

  const cancelBtn = document.getElementById('btn-cancel-sub-delete');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      closeModal();
    };
  }
}
