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
import { closeModal, showModal, formatBrandProductLabel, setupModalDelegation, executePromoteSubtypeToItem, executeMoveSubtypeToParent, executeMergeSubtype } from './SubtypeActionModalsUI.js';
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

  // Move dropdown binding
  const moveInput = document.getElementById('reorg-move-input');
  const moveHidden = document.getElementById('reorg-move-target-id');
  const moveDropdown = document.getElementById('reorg-move-dropdown');
  if (moveInput && moveHidden && moveDropdown) {
    const renderMoveOpts = () => {
      const q = moveInput.value.trim().toLowerCase();
      const filtered = targetParents.filter(p => !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
      moveDropdown.innerHTML = filtered.map(p => `
        <div class="dd-item" data-id="${escapeHTML(p.id)}" data-name="${escapeHTML(p.name)}" style="padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
          <div style="font-weight:600;">${escapeHTML(p.name)}</div>
          <div style="font-size:11px; color:var(--text2);">Category: ${escapeHTML(p.category || 'Pantry')}</div>
        </div>
      `).join('') || `<div style="padding:10px; font-size:12px; color:var(--text2); font-style:italic;">No matching parent item</div>`;
      moveDropdown.style.display = 'block';

      moveDropdown.querySelectorAll('.dd-item').forEach(el => {
        el.onclick = () => {
          moveHidden.value = el.dataset.id;
          moveInput.value = el.dataset.name;
          moveDropdown.style.display = 'none';
        };
      });
    };
    moveInput.addEventListener('input', renderMoveOpts);
    moveInput.addEventListener('focus', renderMoveOpts);
  }

  // Merge dropdown binding
  const mergeInput = document.getElementById('reorg-merge-input');
  const mergeHidden = document.getElementById('reorg-merge-target-id');
  const mergeDropdown = document.getElementById('reorg-merge-dropdown');
  if (mergeInput && mergeHidden && mergeDropdown) {
    const renderMergeOpts = () => {
      const q = mergeInput.value.trim().toLowerCase();
      const filtered = siblingSubtypes.filter(s => !q || s.name.toLowerCase().includes(q));
      mergeDropdown.innerHTML = filtered.map(s => `
        <div class="dd-item" data-id="${escapeHTML(s.id)}" data-name="${escapeHTML(s.name)}" style="padding:10px 14px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
          <div style="font-weight:600;">${escapeHTML(s.name)}</div>
        </div>
      `).join('') || `<div style="padding:10px; font-size:12px; color:var(--text2); font-style:italic;">No matching sibling sub-type</div>`;
      mergeDropdown.style.display = 'block';

      mergeDropdown.querySelectorAll('.dd-item').forEach(el => {
        el.onclick = () => {
          mergeHidden.value = el.dataset.id;
          mergeInput.value = el.dataset.name;
          mergeDropdown.style.display = 'none';
        };
      });
    };
    mergeInput.addEventListener('input', renderMergeOpts);
    mergeInput.addEventListener('focus', renderMergeOpts);
  }

  const btnPromote = document.getElementById('btn-reorg-promote');
  if (btnPromote) {
    btnPromote.onclick = async () => {
      closeModal();
      await executePromoteSubtypeToItem(subtypeId, parentId);
    };
  }

  const btnMove = document.getElementById('btn-reorg-move');
  if (btnMove) {
    btnMove.onclick = async () => {
      const targetParentId = document.getElementById('reorg-move-target-id')?.value;
      if (!targetParentId) { alert('Please select a target parent item from the list.'); return; }
      closeModal();
      await executeMoveSubtypeToParent(subtypeId, parentId, targetParentId);
    };
  }

  const btnMerge = document.getElementById('btn-reorg-merge');
  if (btnMerge) {
    btnMerge.onclick = async () => {
      const targetSubtypeId = document.getElementById('reorg-merge-target-id')?.value;
      if (!targetSubtypeId) { alert('Please select a target sibling sub-type from the list.'); return; }
      closeModal();
      await executeMergeSubtype(subtypeId, targetSubtypeId, parentId);
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
