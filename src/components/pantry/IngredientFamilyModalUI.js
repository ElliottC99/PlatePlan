/**
 * src/components/pantry/IngredientFamilyModalUI.js (v3.30.0)
 * Encapsulates presentation, labelling, and real-time Tesco helper search integrations for the Catalog Item modal.
 */

import { addSubtypeToIngredient } from '../../models/PantryHierarchyModel.js';

const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function updateIngredientFamilyModalUI(ing, parent) {
  const labelEl = document.getElementById('ingredient-family-details-name-label');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const parentWrap = document.getElementById('parent-ingredient-display-wrap');
  const actionsWrap = document.getElementById('subtype-product-actions-wrap');
  const tescoLinkEl = document.getElementById('tesco-search-link');
  const catEl = document.getElementById('ingredient-family-details-cat');

  // 1. Reset listeners and display styles
  if (nameEl) nameEl.oninput = null;
  if (tescoLinkEl) {
    tescoLinkEl.style.display = 'none';
    tescoLinkEl.innerHTML = '';
  }
  if (catEl && catEl.parentNode) {
    catEl.parentNode.style.display = 'block'; // Restore category visibility by default
  }

  // 2. Handle sub-type vs standard ingredient mode
  if (parent) {
    // Hide standard category dropdown
    if (catEl && catEl.parentNode) {
      catEl.parentNode.style.display = 'none';
    }

    // Set Parent Ingredient and Category badges
    if (parentWrap) {
      parentWrap.style.display = 'block';
      parentWrap.style.padding = '0';
      parentWrap.style.background = 'transparent';
      parentWrap.style.border = 'none';
      parentWrap.style.marginBottom = '12px';
      parentWrap.innerHTML = `
        <div class="hierarchy-banner-stack" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
          <div class="cat-hierarchy-badge" style="background: #eef2ff; color: #3730a3; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">
            🏷️ ${escapeHTML(parent.category || 'Uncategorized')}
          </div>
          <div class="parent-hierarchy-badge" style="background: #f3f4f6; color: #4b5563; padding: 6px 12px; border-radius: 6px; font-size: 0.85rem;">
            <strong>Parent Item:</strong> <span style="color: #111827; font-weight: 500;">${escapeHTML(parent.name)}</span>
          </div>
        </div>
      `;
    }

    if (labelEl) labelEl.textContent = 'Sub-type Name';
    if (nameEl) {
      nameEl.placeholder = 'e.g. Mini 4 Pack, Sourdough, Frozen';
    }

    // Ensure the Product Actions card is ALWAYS visible in sub-type modes
    if (actionsWrap) {
      actionsWrap.style.display = 'flex';
    }

    // Dynamic Tesco Search Link directly under Product Actions
    if (nameEl && tescoLinkEl) {
      const updateTescoLink = () => {
        const subVal = nameEl.value.trim();
        const query = subVal || parent.name;
        tescoLinkEl.textContent = `🔍 Search Tesco for "${query}" ↗`;
        tescoLinkEl.href = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(query)}`;
        tescoLinkEl.style.display = 'inline-block';
      };
      nameEl.oninput = updateTescoLink;
      updateTescoLink();
    }

    // Sub-type empty-state save validation
    const saveBtn = document.getElementById('save-ingredient-family-btn') || document.getElementById('ingredient-family-save-btn');
    if (saveBtn) {
      const state = (typeof window !== 'undefined' && window.Store?.getState) ? window.Store.getState() : {};
      const products = state?.products || [];
      const targetId = ing?.id;
      const linkedProds = targetId ? products.filter(p => String(p.ingredientId) === String(targetId) || String(p.groupId) === String(targetId)) : [];
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
  } else {
    // Standard Core Item Mode
    if (labelEl) labelEl.textContent = 'Item Name';
    if (nameEl) nameEl.placeholder = 'e.g. Pasta, Asparagus, Tofu';
    if (parentWrap) parentWrap.style.display = 'none';
    if (actionsWrap) actionsWrap.style.display = 'none';
    const saveBtn = document.getElementById('save-ingredient-family-btn') || document.getElementById('ingredient-family-save-btn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.title = "";
      saveBtn.style.opacity = '1';
    }
  }
}

export function openIngredientFamilyDetailsModal(ingredientId = null, parentId = null) {
  if (typeof window !== 'undefined' && typeof window.openIngredientFamilyDetailsModal === 'function' && window.openIngredientFamilyDetailsModal !== openIngredientFamilyDetailsModal) {
    window.openIngredientFamilyDetailsModal(ingredientId, parentId);
  }
  const state = (typeof window !== 'undefined' && window.Store?.getState) ? window.Store.getState() : {};
  const products = state?.products || [];
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
}

if (typeof window !== 'undefined') {
  window.handleSubtypeProductAction = function(actionType) {
    const nameEl = document.getElementById('ingredient-family-details-name');
    const notesEl = document.getElementById('ingredient-family-details-notes');
    const wrapEl = document.getElementById('ingredient-family-details-wrap');
    const name = nameEl ? nameEl.value.trim() : '';

    if (!name) {
      const msgEl = document.getElementById('ingredient-family-details-msg');
      if (msgEl) {
        msgEl.innerHTML = `<div style="padding: 10px; background: #fee2e2; color: #ef4444; border-radius: 8px; font-weight: 600; margin-bottom: 12px;">⚠️ Please enter a Sub-type Name first.</div>`;
      }
      nameEl?.focus();
      return;
    }

    // Capture in-memory draft state (DO NOT persist to Firestore yet)
    window.__draftSubtypePayload = {
      parentId: wrapEl.dataset.parentId,
      name: name,
      notes: notesEl ? notesEl.value.trim() : ''
    };

    // Close the sub-type details modal
    if (typeof window.closeIngredientFamilyDetailsModal === 'function') {
      window.closeIngredientFamilyDetailsModal();
    }

    // Launch direct product path pre-bound with draft context
    const editingSubtypeId = wrapEl.dataset.editingIngredientId || null;
    const parentId = wrapEl.dataset.parentId;

    setTimeout(() => {
      if (actionType === 'manual') {
        import('../../views/ProductBankView.js').then((module) => {
          window.__prefilledResolveBinding = { parentId, subtypeId: editingSubtypeId, subtypeDraftName: window.__draftSubtypePayload.name };
          if (typeof module.openProductEditModal === 'function') {
            module.openProductEditModal(null);
          }
        }).catch(err => console.error('Failed to load manual product modal', err));
      } else if (actionType === 'link') {
        import('./SubtypeProductLinkerModalUI.js').then((module) => {
          if (typeof module.openSubtypeExistingProductPickerModal === 'function') {
            module.openSubtypeExistingProductPickerModal(editingSubtypeId, parentId);
          }
        }).catch(err => console.error('Failed to load link modal', err));
      } else if (actionType === 'tesco') {
        import('./TescoImportModalUI.js').then((module) => {
          if (typeof module.openTescoImportModal === 'function') {
            module.openTescoImportModal(editingSubtypeId, parentId);
          }
        }).catch(err => console.error('Failed to load tesco modal', err));
      }
    }, 150);
  };
}
