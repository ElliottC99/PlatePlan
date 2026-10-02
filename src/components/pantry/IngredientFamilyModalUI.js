/**
 * src/components/pantry/IngredientFamilyModalUI.js (v3.19.35)
 * Encapsulates presentation, labeling, and real-time Tesco helper search integrations for the Ingredient Family modal.
 */

import { addSubtypeToIngredient } from '../../models/PantryHierarchyModel.js';

export function updateIngredientFamilyModalUI(ing, parent) {
  const labelEl = document.getElementById('ingredient-family-details-name-label');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const parentWrap = document.getElementById('parent-ingredient-display-wrap');
  const actionsWrap = document.getElementById('subtype-product-actions-wrap');
  const tescoEl = document.getElementById('tesco-search-helper-link');

  // 1. Reset dynamic fields
  if (tescoEl) tescoEl.innerHTML = '';
  if (nameEl) nameEl.oninput = null; // Clear previous listener

  // 2. Handle sub-type vs standard ingredient mode
  if (parent && !ing) {
    if (labelEl) labelEl.textContent = 'Sub-type Name';
    if (nameEl) {
      nameEl.placeholder = 'e.g. Mini 4 Pack, Sourdough, Frozen';
    }
    if (parentWrap) {
      parentWrap.style.display = 'block';
      parentWrap.style.padding = '10px';
      parentWrap.style.background = '#f3f4f6';
      parentWrap.style.borderRadius = '8px';
      parentWrap.style.marginBottom = '12px';
      parentWrap.innerHTML = `<strong>Parent Ingredient:</strong> <span style="color:#4f46e5;">${parent.name}</span>`;
    }
    if (actionsWrap) actionsWrap.style.display = 'flex';

    // Real-time Tesco search helper
    if (nameEl && tescoEl) {
      const updateTescoLink = () => {
        const val = nameEl.value.trim();
        const query = `${parent.name} ${val}`.trim();
        tescoEl.innerHTML = `
          <a id="tesco-dynamic-link" href="https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(query)}" 
             target="_blank" rel="noopener" 
             style="font-size: 0.85em; display: inline-block; margin-top: 4px; color:var(--primary,#4f46e5); font-weight: 600;">
            🔍 Search Tesco for "${query}" ↗
          </a>
        `;
      };
      nameEl.oninput = updateTescoLink;
      updateTescoLink();
    }
  } else {
    // Standard mode / Edit mode
    if (labelEl) labelEl.textContent = 'Ingredient name';
    if (nameEl) nameEl.placeholder = 'e.g. Pasta, Asparagus, Tofu';
    if (parentWrap) parentWrap.style.display = 'none';
    if (actionsWrap) actionsWrap.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.transitionFromSubtypeToProduct = async function(actionType) {
    const nameEl = document.getElementById('ingredient-family-details-name');
    const wrapEl = document.getElementById('ingredient-family-details-wrap');
    if (!wrapEl) return;
    const parentId = wrapEl.dataset.parentId;
    const subtypeName = nameEl ? nameEl.value.trim() : '';

    if (!subtypeName) {
      alert("Please enter a Sub-type Name first.");
      return;
    }

    const notesEl = document.getElementById('ingredient-family-details-notes');
    const subtypeNotes = notesEl ? notesEl.value.trim() : '';

    // 1. Save the Sub-Type first so the product has a valid ID to link to
    const sub = await addSubtypeToIngredient(parentId, subtypeName, subtypeNotes);
    const newSubtypeId = sub ? sub.id : 'sub_' + Date.now();

    // 2. CLOSE the current modal to prevent the dark background z-index collision
    if (typeof window.closeIngredientFamilyDetailsModal === 'function') {
      window.closeIngredientFamilyDetailsModal();
    }

    // 3. Set the global context binding for the Product flow
    window.__prefilledResolveBinding = {
      ingredientId: parentId,
      subtypeId: newSubtypeId
    };

    // 4. Launch Native Flows
    setTimeout(() => {
      if (actionType === 'manual') {
        if (typeof window.openProductEditModal === 'function') {
          window.openProductEditModal(null);
        }
      } else if (actionType === 'link') {
        alert("Sub-type saved. Ready to link existing product.");
      }
    }, 150); // slight delay to ensure DOM clears the first modal backdrop
  };
}
