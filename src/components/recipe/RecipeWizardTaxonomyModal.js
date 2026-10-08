/**
 * src/components/recipe/RecipeWizardTaxonomyModal.js (v3.27.3)
 * Interactive Decision Tree Modal for creating new Taxonomy Ingredients, Sub-types,
 * Supermarket Categories, and Linked Products during Recipe Ingestion Mapping.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient, saveProduct } from '../../services/HouseholdRepository.js';
import { toTitleCase } from '../../services/RecipeImporter.js';

const STANDARD_CATEGORIES = [
  'Store Cupboard',
  'Produce',
  'Refrigerated & Dairy',
  'Frozen',
  'Bakery',
  'Spices & Oils'
];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

export function openTaxonomyCreationModal({ sIdx, iIdx, initialName = '', onComplete = null } = {}) {
  const storeState = getState() || {};
  const ingredients = storeState.ingredients || [];
  const existingCategories = Array.from(
    new Set([...STANDARD_CATEGORIES, ...(storeState.categories || []), ...ingredients.map(i => i.category).filter(Boolean)])
  );

  const cleanInitialName = toTitleCase(initialName || 'New Ingredient');

  let modalEl = document.getElementById('wizard-taxonomy-create-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'wizard-taxonomy-create-modal';
    modalEl.className = 'modal-wrap';
    modalEl.style.zIndex = '1200';
    document.body.appendChild(modalEl);
  }

  const parentOptionsHtml = ingredients.map(ing => `
    <option value="${escapeAttr(ing.id)}">${escapeHtml(ing.name)} [${escapeHtml(ing.category || 'General')}]</option>
  `).join('');

  const categoryOptionsHtml = existingCategories.map(cat => `
    <option value="${escapeAttr(cat)}">${escapeHtml(cat)}</option>
  `).join('');

  modalEl.innerHTML = `
    <div class="modal-backdrop" id="wizard-tax-modal-backdrop"></div>
    <div class="modal" style="max-width: 540px; width: 92%; max-height: 90vh; overflow-y: auto; padding: 22px; background: var(--surface, #fff); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.3); border: 1px solid var(--border, #ddd);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border, #eee); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">✨</span>
          <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text, #111);">Create New Taxonomy Item</h3>
        </div>
        <button type="button" class="btn sm ghost" id="btn-close-tax-modal" style="font-size: 16px;">✕</button>
      </div>

      <form id="wizard-tax-form" style="display: flex; flex-direction: column; gap: 14px;">
        <!-- 1. Sub-Type Name -->
        <div>
          <label for="tax-sub-name" style="display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; color: var(--text);">
            1) Sub-Type / Item Name <span style="color:#dc2626">*</span>
          </label>
          <input type="text" id="tax-sub-name" value="${escapeAttr(cleanInitialName)}" required placeholder="e.g. Extra Firm Tofu, Smoked Paprika" style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface); color: var(--text);" name="tax-sub-name" />
          <small style="font-size: 11px; color: var(--text2, #666);">Normalized to Title Case upon saving.</small>
        </div>

        <!-- 2. Parent Ingredient Decision Tree -->
        <div style="background: var(--surface2, #f9f8f6); padding: 12px; border-radius: 8px; border: 1px solid var(--border, #e5e7eb);">
          <label style="display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 8px; color: var(--text);">
            2) Parent Ingredient Family
          </label>
          <div style="display: flex; gap: 16px; margin-bottom: 10px;">
            <label for="tax-parent-type-existing" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
              <input type="radio" id="tax-parent-type-existing" name="tax-parent-type" value="existing" ${ingredients.length ? 'checked' : ''} />
              <span>Link to Existing Parent</span>
            </label>
            <label for="tax-parent-type-new" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
              <input type="radio" id="tax-parent-type-new" name="tax-parent-type" value="new" ${!ingredients.length ? 'checked' : ''} />
              <span>Create New Parent</span>
            </label>
          </div>

          <div id="tax-parent-existing-box" style="${ingredients.length ? 'display: block;' : 'display: none;'}">
            <label for="tax-parent-select" class="sr-only">Parent Ingredient Select</label>
            <select id="tax-parent-select" style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" name="tax-parent-select">
              ${parentOptionsHtml || '<option value="">No existing ingredients</option>'}
            </select>
          </div>

          <div id="tax-parent-new-box" style="${!ingredients.length ? 'display: block;' : 'display: none;'}">
            <label for="tax-new-parent-name" class="sr-only">New Parent Ingredient Name</label>
            <input type="text" id="tax-new-parent-name" placeholder="e.g. Tofu, Paprika, Stock Cubes" value="${escapeAttr(cleanInitialName)}" style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" name="tax-new-parent-name" />
          </div>
        </div>

        <!-- 3. Supermarket Category / Aisle -->
        <div>
          <label for="tax-cat-select" style="display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; color: var(--text);">
            3) Supermarket Category / Aisle <span style="color:#dc2626">*</span>
          </label>
          <div style="display: flex; gap: 8px;">
            <select id="tax-cat-select" style="flex: 1; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" name="tax-cat-select">
              ${categoryOptionsHtml}
              <option value="__custom__">+ Add Custom Category...</option>
            </select>
            <label for="tax-custom-cat" class="sr-only">Custom Category Name</label>
            <input type="text" id="tax-custom-cat" placeholder="Category Name" style="display:none; flex: 1; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" name="tax-custom-cat" />
          </div>
        </div>

        <!-- 4. Linked Product -->
        <div style="background: var(--surface2, #f9f8f6); padding: 12px; border-radius: 8px; border: 1px solid var(--border, #e5e7eb);">
          <label style="display: block; font-size: 12.5px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
            4) Linked Store Product
          </label>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div>
              <label for="tax-prod-name" style="display: block; font-size: 11px; color: var(--text2); margin-bottom: 2px;">Product Title</label>
              <input type="text" id="tax-prod-name" value="${escapeAttr(cleanInitialName)}" placeholder="e.g. Organic Firm Tofu 400g" style="width: 100%; padding: 7px 9px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px; background: var(--surface);" name="tax-prod-name" />
            </div>
            <div>
              <label for="tax-prod-brand" style="display: block; font-size: 11px; color: var(--text2); margin-bottom: 2px;">Store / Brand</label>
              <input type="text" id="tax-prod-brand" value="Tesco" placeholder="e.g. Tesco, Kallo" style="width: 100%; padding: 7px 9px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px; background: var(--surface);" name="tax-prod-brand" />
            </div>
          </div>
          <div>
            <label for="tax-prod-size" style="display: block; font-size: 11px; color: var(--text2); margin-bottom: 2px;">Pack Size / Quantity</label>
            <input type="text" id="tax-prod-size" value="1 pack" placeholder="e.g. 400g, 1 pack, 6 pack" style="width: 100%; padding: 7px 9px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px; background: var(--surface);" name="tax-prod-size" />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border, #eee); padding-top: 12px;">
          <button type="button" class="btn ghost" id="btn-cancel-tax-modal">Cancel</button>
          <button type="submit" class="btn primary" id="btn-confirm-tax-modal">✨ Create & Link Taxonomy</button>
        </div>
      </form>
    </div>
  `;

  modalEl.classList.add('open');

  const closeModal = () => {
    modalEl.classList.remove('open');
  };

  modalEl.querySelector('#btn-close-tax-modal').onclick = closeModal;
  modalEl.querySelector('#btn-cancel-tax-modal').onclick = closeModal;
  modalEl.querySelector('#wizard-tax-modal-backdrop').onclick = closeModal;

  // Radio toggling
  modalEl.querySelectorAll('input[name="tax-parent-type"]').forEach(radio => {
    radio.onchange = () => {
      const isNew = radio.value === 'new';
      modalEl.querySelector('#tax-parent-existing-box').style.display = isNew ? 'none' : 'block';
      modalEl.querySelector('#tax-parent-new-box').style.display = isNew ? 'block' : 'none';
    };
  });

  // Custom Category selection toggle
  const catSelect = modalEl.querySelector('#tax-cat-select');
  const customCatInput = modalEl.querySelector('#tax-custom-cat');
  catSelect.onchange = () => {
    if (catSelect.value === '__custom__') {
      customCatInput.style.display = 'block';
      customCatInput.focus();
    } else {
      customCatInput.style.display = 'none';
    }
  };

  // Form submission
  const form = modalEl.querySelector('#wizard-tax-form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btnSubmit = modalEl.querySelector('#btn-confirm-tax-modal');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Saving...';

    try {
      const subtypeName = toTitleCase(modalEl.querySelector('#tax-sub-name').value.trim());
      if (!subtypeName) {
        alert('Please enter a Sub-Type / Item Name');
        btnSubmit.disabled = false;
        btnSubmit.textContent = '✨ Create & Link Taxonomy';
        return;
      }

      const isNewParent = modalEl.querySelector('input[name="tax-parent-type"]:checked').value === 'new';
      let selectedCategory = catSelect.value;
      if (selectedCategory === '__custom__') {
        selectedCategory = toTitleCase(customCatInput.value.trim()) || 'Store Cupboard';
      }

      const currentStoreState = getState() || {};
      const currentIngredients = [...(currentStoreState.ingredients || [])];
      const currentProducts = [...(currentStoreState.products || [])];

      let parentId = '';
      let parentName = '';
      let subtypeId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let targetParent = null;

      if (isNewParent) {
        parentName = toTitleCase(modalEl.querySelector('#tax-new-parent-name').value.trim()) || subtypeName;
        parentId = `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        const newSub = {
          id: subtypeId,
          name: subtypeName,
          defaultProductId: null,
          aliases: [subtypeName.toLowerCase()]
        };

        targetParent = {
          id: parentId,
          name: parentName,
          category: selectedCategory,
          cat: selectedCategory.toLowerCase().replace(/\s+/g, '_'),
          subtypes: [newSub],
          aliases: [parentName.toLowerCase(), subtypeName.toLowerCase()],
          updatedAt: new Date().toISOString()
        };

        currentIngredients.push(targetParent);
      } else {
        parentId = modalEl.querySelector('#tax-parent-select').value;
        targetParent = currentIngredients.find(i => String(i.id) === String(parentId));
        if (!targetParent) {
          throw new Error('Selected parent ingredient not found.');
        }
        parentName = targetParent.name;

        const newSub = {
          id: subtypeId,
          name: subtypeName,
          defaultProductId: null,
          aliases: [subtypeName.toLowerCase()]
        };

        targetParent.subtypes = [...(targetParent.subtypes || []), newSub];
        targetParent.aliases = Array.from(new Set([...(targetParent.aliases || []), subtypeName.toLowerCase()]));
        targetParent.updatedAt = new Date().toISOString();
      }

      // Create linked product
      const prodName = toTitleCase(modalEl.querySelector('#tax-prod-name').value.trim()) || subtypeName;
      const prodBrand = toTitleCase(modalEl.querySelector('#tax-prod-brand').value.trim()) || 'Tesco';
      const prodSize = modalEl.querySelector('#tax-prod-size').value.trim() || '1 pack';
      const prodId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const newProduct = {
        id: prodId,
        name: prodName,
        brand: prodBrand,
        ingredientId: parentId,
        subtypeId: subtypeId,
        size: prodSize,
        isAutoDefault: true,
        updatedAt: new Date().toISOString()
      };

      currentProducts.push(newProduct);

      // Save to Store
      setIngredients(currentIngredients);
      setProducts(currentProducts);

      // Persist to database asynchronously
      try {
        await Promise.all([
          saveIngredient(targetParent),
          saveProduct(newProduct)
        ]);
      } catch (err) {
        console.warn('[RecipeWizardTaxonomyModal] Cloud persistence warning (cached locally):', err);
      }

      closeModal();

      if (typeof onComplete === 'function') {
        onComplete({
          ingredientId: parentId,
          subtypeId: subtypeId,
          productId: prodId,
          subtypeName: subtypeName,
          parentName: parentName,
          sIdx,
          iIdx
        });
      }
    } catch (err) {
      console.error('[RecipeWizardTaxonomyModal] Creation failed:', err);
      alert(`Could not create taxonomy item: ${err.message}`);
      btnSubmit.disabled = false;
      btnSubmit.textContent = '✨ Create & Link Taxonomy';
    }
  };
}
