/**
 * src/components/pantry/IngredientFamilyModalUI.js (v3.19.36)
 * Encapsulates presentation, labeling, and real-time Tesco helper search integrations for the Ingredient Family modal.
 */

import { addSubtypeToIngredient } from '../../models/PantryHierarchyModel.js';

const escapeHTML = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function updateIngredientFamilyModalUI(ing, parent) {
  const labelEl = document.getElementById('ingredient-family-details-name-label');
  const nameEl = document.getElementById('ingredient-family-details-name');
  const parentWrap = document.getElementById('parent-ingredient-display-wrap');
  const actionsWrap = document.getElementById('subtype-product-actions-wrap');
  const tescoEl = document.getElementById('tesco-search-helper-link');
  const catEl = document.getElementById('ingredient-family-details-cat');

  // 1. Reset dynamic fields & listeners
  if (tescoEl) tescoEl.innerHTML = '';
  if (nameEl) nameEl.oninput = null;
  if (catEl && catEl.parentNode) {
    catEl.parentNode.style.display = 'block'; // Restore default visibility
  }

  // 2. Handle sub-type vs standard ingredient mode
  if (parent && !ing) {
    // 2a. Hierarchy banners in sub-type mode
    if (catEl && catEl.parentNode) {
      catEl.parentNode.style.display = 'none'; // Hide/remove the Category dropdown
    }

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
            <strong>Parent Ingredient:</strong> <span style="color: #111827; font-weight: 500;">${escapeHTML(parent.name)}</span>
          </div>
        </div>
      `;
    }

    if (labelEl) labelEl.textContent = 'Sub-type Name';
    if (nameEl) {
      nameEl.placeholder = 'e.g. Mini 4 Pack, Sourdough, Frozen';
    }

    // New Sub-type Mode: Hide product action buttons
    if (actionsWrap) actionsWrap.style.display = 'none';

    // Real-time Tesco search helper
    if (nameEl && tescoEl) {
      tescoEl.innerHTML = `<a id="tesco-dynamic-link" href="#" target="_blank" rel="noopener"></a>`;
      const tescoLinkEl = document.getElementById('tesco-dynamic-link');
      const updateTescoLink = () => {
        const subVal = nameEl.value.trim();
        const query = subVal || parent.name;
        tescoLinkEl.textContent = `🔍 Search Tesco for "${query}" ↗`;
        tescoLinkEl.href = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(query)}`;
        tescoLinkEl.style.fontSize = '0.85em';
        tescoLinkEl.style.display = 'inline-block';
        tescoLinkEl.style.marginTop = '4px';
        tescoLinkEl.style.color = 'var(--primary,#4f46e5)';
        tescoLinkEl.style.fontWeight = '600';
      };
      nameEl.oninput = updateTescoLink;
      updateTescoLink();
    }
  } else if (parent && ing) {
    // 2b. Edit Sub-type Mode
    if (catEl && catEl.parentNode) {
      catEl.parentNode.style.display = 'none'; // Hide category dropdown
    }

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
            <strong>Parent Ingredient:</strong> <span style="color: #111827; font-weight: 500;">${escapeHTML(parent.name)}</span>
          </div>
        </div>
      `;
    }

    if (labelEl) labelEl.textContent = 'Sub-type Name';
    if (nameEl) nameEl.placeholder = 'e.g. Mini 4 Pack, Sourdough, Frozen';

    // Edit Sub-type Mode: Enable product action buttons
    if (actionsWrap) actionsWrap.style.display = 'flex';

    // Real-time Tesco search helper
    if (nameEl && tescoEl) {
      tescoEl.innerHTML = `<a id="tesco-dynamic-link" href="#" target="_blank" rel="noopener"></a>`;
      const tescoLinkEl = document.getElementById('tesco-dynamic-link');
      const updateTescoLink = () => {
        const subVal = nameEl.value.trim();
        const query = subVal || parent.name;
        tescoLinkEl.textContent = `🔍 Search Tesco for "${query}" ↗`;
        tescoLinkEl.href = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(query)}`;
        tescoLinkEl.style.fontSize = '0.85em';
        tescoLinkEl.style.display = 'inline-block';
        tescoLinkEl.style.marginTop = '4px';
        tescoLinkEl.style.color = 'var(--primary,#4f46e5)';
        tescoLinkEl.style.fontWeight = '600';
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
  window.transitionFromSubtypeToProduct = function(actionType) {
    const wrapEl = document.getElementById('ingredient-family-details-wrap');
    if (!wrapEl) return;
    const parentId = wrapEl.dataset.parentId;
    const existingSubtypeId = wrapEl.dataset.editingIngredientId || '';

    if (!existingSubtypeId) {
      alert("Product actions are only available after saving the sub-type.");
      return;
    }

    // 1. Close current modal to prevent stacked overlay backdrop issues
    if (typeof window.closeIngredientFamilyDetailsModal === 'function') {
      window.closeIngredientFamilyDetailsModal();
    }

    // 2. Set global context binding
    window.__prefilledResolveBinding = {
      ingredientId: parentId,
      subtypeId: existingSubtypeId
    };

    // 3. Launch Native Product Flows after short clearing delay
    setTimeout(() => {
      if (actionType === 'manual') {
        if (typeof window.openProductEditModal === 'function') {
          window.openProductEditModal(null);
        }
      } else if (actionType === 'link') {
        if (typeof window.linkProductToSubtype === 'function') {
          window.linkProductToSubtype(parentId, existingSubtypeId);
        }
      }
    }, 150);
  };
}
