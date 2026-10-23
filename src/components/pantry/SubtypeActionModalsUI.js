/**
 * src/components/pantry/SubtypeActionModalsUI.js (v3.38.57)
 * Standardised custom styled dialogues and workflows for nested sub-types.
 * Eliminates all prompt(), alert(), and confirm() browser chrome calls.
 * Strictly modular (< 350 lines) and sanitised of legacy terminology.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { deleteSubtype } from '../../services/SubtypeActionService.js';
import { saveProduct } from '../../services/ProductRepository.js';
import { saveIngredient } from '../../services/IngredientRepository.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';
import { promptReallocateProduct, openProductReallocateModal } from './ReallocateProductModalUI.js';
import {
  openSubtypeLinkSelectionModal,
  openSubtypeExistingProductPickerModal,
  openTescoImportModal
} from './TescoImportModalUI.js';
import {
  promptAddAlias,
  promptRemoveAlias,
  handlePromoteSubtype,
  promptDemote,
  promptMerge,
  handleDeleteIngredient,
  handleDeleteProduct,
  showCustomAlert,
  showCustomConfirm,
  showCustomCopyModal,
  openIngredientReorganiseModal
} from './IngredientActionModalsUI.js';

import {
  openEditSubtypeModal as renderOpenEditSubtypeModal,
  openSubtypeReorganizeModal as renderOpenSubtypeReorganizeModal,
  openSubtypeAliasModal as renderOpenSubtypeAliasModal,
  openSubtypeDeleteModal as renderOpenSubtypeDeleteModal
} from './SubtypeActionModalsRenderService.js';

import {
  renderEditSubtypeModalHTML,
  renderReorganizeModalHTML,
  renderManageAliasesModalHTML,
  renderDeleteSubtypeModalHTML,
  buildSubtypeDropdownOptions,
  buildParentIngredientDropdownOptions,
  escapeHTML
} from '../../views/SubtypeModalRenderService.js';

export function openEditSubtypeModal(subtypeId, parentId) {
  return renderOpenEditSubtypeModal(subtypeId, parentId);
}

export function openSubtypeReorganizeModal(subtypeId, parentId) {
  return renderOpenSubtypeReorganizeModal(subtypeId, parentId);
}

export function openSubtypeAliasModal(subtypeId, parentId) {
  return renderOpenSubtypeAliasModal(subtypeId, parentId);
}

export function openSubtypeDeleteModal(subtypeId, parentId) {
  return renderOpenSubtypeDeleteModal(subtypeId, parentId);
}

export {
  promptReallocateProduct,
  openProductReallocateModal,
  openSubtypeLinkSelectionModal,
  openSubtypeExistingProductPickerModal,
  openTescoImportModal,
  promptAddAlias,
  promptRemoveAlias,
  handlePromoteSubtype,
  promptDemote,
  promptMerge,
  handleDeleteIngredient,
  handleDeleteProduct,
  showCustomAlert,
  showCustomConfirm,
  showCustomCopyModal,
  openIngredientReorganiseModal,
  renderEditSubtypeModalHTML,
  renderReorganizeModalHTML,
  renderManageAliasesModalHTML,
  renderDeleteSubtypeModalHTML,
  buildSubtypeDropdownOptions,
  buildParentIngredientDropdownOptions,
  escapeHTML
};

export function showModal(html) {
  let wrap = document.getElementById('view-modal-wrap');
  let content = document.getElementById('view-modal-content');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'view-modal-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }
  if (!content) {
    content = document.createElement('div');
    content.id = 'view-modal-content';
    content.className = 'modal';
    wrap.appendChild(content);
  }
  content.innerHTML = html;
  wrap.classList.add('open');
  wrap.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    wrap.style.display = 'none';
    document.body.style.overflow = '';
  }
  const content = document.getElementById('view-modal-content');
  if (content) content.innerHTML = '';
}

export function formatBrandProductLabel(p) {
  if (!p) return '';
  const brand = String(p.brand || '').trim();
  let pName = String(p.name || p.title || '').trim();
  if (brand && pName.toLowerCase().startsWith(brand.toLowerCase())) {
    pName = pName.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim();
  }
  return (brand && pName) ? `${brand} ${pName}` : (pName || brand || 'Unnamed Product');
}

export function setupModalDelegation() {
  const modalWrap = document.getElementById('view-modal-wrap');
  if (modalWrap && !modalWrap.__delegation_bound) {
    modalWrap.__delegation_bound = true;
    modalWrap.addEventListener('click', async (e) => {
      if (e.target === modalWrap) {
        closeModal();
        return;
      }

      const target = e.target;

      // 1. Cancel actions fallback
      if (target.closest('.btn-cancel-delete') || target.closest('.btn-cancel-edit-sub')) {
        closeModal();
        return;
      }

      // 2. Confirm Subtype Delete fallback
      const confirmDelete = target.closest('#btn-confirm-sub-delete, .btn-confirm-delete');
      if (confirmDelete) {
        const modalContent = target.closest('.modal-content');
        if (modalContent && modalContent.getAttribute('data-modal-type') === 'delete-subtype') {
          const subtypeId = modalContent.getAttribute('data-subtype-id');
          const parentId = modalContent.getAttribute('data-parent-id');
          if (subtypeId && parentId) {
            closeModal();
            await deleteSubtype(parentId, subtypeId);
          }
        }
        return;
      }

      // 3. Save Edit Subtype fallback
      const saveEdit = target.closest('#save-edit-sub-btn');
      if (saveEdit) {
        const modalContent = target.closest('.modal-content');
        if (modalContent && modalContent.getAttribute('data-modal-type') === 'edit-subtype') {
          const subtypeId = modalContent.getAttribute('data-subtype-id');
          const parentId = modalContent.getAttribute('data-parent-id');
          const nameInput = document.getElementById('edit-sub-name');
          const notesInput = document.getElementById('edit-sub-notes');
          if (subtypeId && parentId && nameInput) {
            const newName = nameInput.value.trim();
            if (newName) {
              const state = getState();
              const parent = (state.ingredients || []).find(i => String(i.id) === String(parentId));
              if (parent && Array.isArray(parent.subtypes)) {
                const sub = parent.subtypes.find(s => String(s.id) === String(subtypeId));
                if (sub) {
                  sub.name = newName;
                  if (notesInput) sub.notes = notesInput.value.trim();
                  parent.updatedAt = new Date().toISOString();
                  setIngredients([...state.ingredients]);
                  closeModal();
                  invalidateHierarchyCache();
                  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
                  await saveIngredient(parent);
                }
              }
            }
          }
        }
        return;
      }

      // 4. Unlink Product fallback
      const unlinkBtn = target.closest('.btn-unlink-prod');
      if (unlinkBtn) {
        const prodId = unlinkBtn.getAttribute('data-prod-id');
        const modalContent = target.closest('.modal-content');
        if (modalContent && prodId) {
          const subtypeId = modalContent.getAttribute('data-subtype-id');
          const parentId = modalContent.getAttribute('data-parent-id');
          const state = getState();
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
        }
        return;
      }
    });
  }
}

export function openTescoBookmarkletInstructionsModal() {
  openTescoImportModal(null, null);
}

export function handleSubtypeLinkRoute(action, subtypeId, parentId) {
  closeModal();
  window.__prefilledResolveBinding = { ingredientId: parentId, subtypeId: subtypeId || null };
  setTimeout(() => {
    if (action === 'manual' && typeof window.openProductEditModal === 'function') window.openProductEditModal(null);
    else if (action === 'link') openSubtypeExistingProductPickerModal(subtypeId, parentId);
    else if (action === 'tesco') openTescoImportModal(subtypeId, parentId);
  }, 150);
}

if (typeof window !== 'undefined') {
  window.handleSubtypeLinkRoute = handleSubtypeLinkRoute;
  window.closeSubtypeActionModal = closeModal;
}
