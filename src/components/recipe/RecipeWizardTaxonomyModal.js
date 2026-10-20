/**
 * src/components/recipe/RecipeWizardTaxonomyModal.js (v3.38.15)
 * New Ingredient Mapping Wizard Modal component.
 * 3-step wizard for mapping raw recipe ingredients into Category -> Item -> Sub-Type hierarchy.
 * Fully decomposed and compliant with the 350-line file limit.
 */

import { getState, setIngredients, setProducts, setCategories } from '../../store/store.js';
import { toTitleCase } from '../../services/RecipeImporter.js';
import { STANDARD_CATEGORIES, formatTaxonomyName, buildExistingSubtypesCatalog, computeAvailableCategories } from '../../services/RecipeTaxonomyManager.js';
import { renderStep1Template } from '../../services/RecipeWizardStepRenderService.js';
import { renderStep2SubtypeFields } from '../../services/RecipeWizardStep2RenderService.js';
import { renderStep2ItemFields, renderStep2CategoryFields } from '../../services/RecipeWizardStep2FieldsRenderService.js';
import { renderStep3Template } from '../../services/RecipeWizardStep3RenderService.js';
import { bindNavigationHandlers } from '../../services/RecipeWizardNavigationService.js';
import { handleWizardSubmission } from '../../services/RecipeWizardSubmissionService.js';
import { escapeHtml } from '../../utils/stringUtils.js';

export function openNewIngredientMappingWizardModal({ sIdx, iIdx, initialName = '', onComplete = null } = {}) {
  const storeState = getState() || {};
  const ingredients = storeState.ingredients || [];
  const existingCategories = computeAvailableCategories(storeState.categories || [], ingredients);

  const cleanInitialName = formatTaxonomyName(initialName || 'New Item');
  const defaultCat = existingCategories[0] || 'Store Cupboard';

  const existingSubtypes = buildExistingSubtypesCatalog(ingredients, defaultCat);

  let currentStep = 1;
  let showProductSearch = false;
  let productSearchQuery = '';

  let wizardData = {
    entityType: 'subtype',
    name: cleanInitialName,
    category: defaultCat,
    item: cleanInitialName,
    subType: cleanInitialName,
    selectedItemId: '',
    isExistingParentItem: false,
    selectedSubtypeId: '',
    isExistingChildSubtype: false,
    newItemName: cleanInitialName,
    selectedCategory: defaultCat,
    subTypeName: cleanInitialName,
    createdIngredientId: null,
    createdSubtypeId: null,
    linkedProduct: null
  };

  let modalEl = document.getElementById('new-ingredient-mapping-wizard-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'new-ingredient-mapping-wizard-modal';
    modalEl.className = 'modal-wrap';
    modalEl.style.zIndex = '12000';
    document.body.appendChild(modalEl);
  }

  const syncTierStateFromStep1 = (rawName, type) => {
    const cleanName = toTitleCase(rawName || wizardData.name || 'New Item');
    wizardData.name = cleanName;
    wizardData.entityType = type;

    if (type === 'subtype') {
      wizardData.subType = cleanName;
      wizardData.subTypeName = cleanName;
      wizardData.selectedSubtypeId = '';
      wizardData.isExistingChildSubtype = false;
      const matchedItem = ingredients.find(i => (i.name || '').toLowerCase() === cleanName.toLowerCase());
      if (matchedItem) {
        wizardData.selectedItemId = matchedItem.id;
        wizardData.isExistingParentItem = true;
        wizardData.item = matchedItem.name;
        wizardData.newItemName = matchedItem.name;
        wizardData.category = matchedItem.category || defaultCat;
        wizardData.selectedCategory = wizardData.category;
      } else {
        wizardData.selectedItemId = '';
        wizardData.isExistingParentItem = false;
        wizardData.item = cleanName;
        wizardData.newItemName = cleanName;
        wizardData.category = wizardData.selectedCategory || defaultCat;
        wizardData.selectedCategory = wizardData.category;
      }
    } else if (type === 'item') {
      wizardData.item = cleanName;
      wizardData.newItemName = cleanName;
      wizardData.subType = cleanName;
      wizardData.subTypeName = cleanName;
      wizardData.selectedSubtypeId = '';
      wizardData.isExistingChildSubtype = false;
      const matchedItem = ingredients.find(i => (i.name || '').toLowerCase() === cleanName.toLowerCase());
      wizardData.selectedItemId = matchedItem ? matchedItem.id : '';
      wizardData.isExistingParentItem = Boolean(matchedItem);
      wizardData.category = matchedItem?.category || wizardData.selectedCategory || defaultCat;
      wizardData.selectedCategory = wizardData.category;
    } else if (type === 'category') {
      wizardData.category = cleanName;
      wizardData.selectedCategory = cleanName;
      wizardData.item = cleanName;
      wizardData.newItemName = cleanName;
      wizardData.subType = cleanName;
      wizardData.subTypeName = cleanName;
      wizardData.selectedItemId = '';
      wizardData.isExistingParentItem = false;
      wizardData.selectedSubtypeId = '';
      wizardData.isExistingChildSubtype = false;
    }
  };

  const renderWizard = () => {
    let stepHtml = '';

    if (currentStep === 1) {
      stepHtml = renderStep1Template(wizardData, existingCategories);
    } else if (currentStep === 2) {
      const tierLabel = wizardData.entityType === 'category'
        ? `Category: ${wizardData.selectedCategory}`
        : wizardData.entityType === 'item'
          ? `Item: ${wizardData.newItemName}`
          : `Sub-Type: ${wizardData.subTypeName}`;

      stepHtml = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: #eef2ff; border: 1px solid #c7d2fe; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; color: #3730a3;">
            Assigned Tier: <strong>${escapeHtml(tierLabel)}</strong>
          </div>

          ${wizardData.entityType === 'subtype'
            ? renderStep2SubtypeFields(wizardData)
            : wizardData.entityType === 'item'
              ? renderStep2ItemFields(wizardData)
              : renderStep2CategoryFields(wizardData)}

          <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
            <button type="button" class="btn ghost" id="btn-back-step2">← Back</button>
            <button type="button" class="btn primary" id="btn-next-step2">Next: Linked Product →</button>
          </div>
        </div>
      `;
    } else if (currentStep === 3) {
      stepHtml = renderStep3Template(wizardData, showProductSearch, productSearchQuery);
    }

    modalEl.innerHTML = `
      <div class="modal-backdrop" id="map-wiz-backdrop"></div>
      <div class="modal" style="max-width: 520px; width: 92%; max-height: 90vh; overflow-y: auto; padding: 22px; background: var(--surface, #fff); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.3); border: 1px solid var(--border, #ddd);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border, #eee); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">✨</span>
            <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text, #111);">New Ingredient Mapping Wizard</h3>
          </div>
          <button type="button" class="btn sm ghost" id="btn-close-map-wiz-top" style="font-size: 16px;">✕</button>
        </div>
        ${stepHtml}
      </div>
    `;

    const closeModal = () => modalEl.classList.remove('open');

    bindNavigationHandlers({
      modalEl,
      wizardData,
      currentStep: { get: () => currentStep, set: (v) => { currentStep = v; } },
      renderWizard,
      existingCategories,
      existingSubtypes,
      ingredients,
      defaultCat,
      syncTierStateFromStep1,
      showProductSearch: { get: () => showProductSearch, set: (v) => { showProductSearch = v; } },
      productSearchQuery: { get: () => productSearchQuery, set: (v) => { productSearchQuery = v; } }
    });

    const btnComplete = modalEl.querySelector('#btn-complete-map-wiz');
    if (btnComplete) {
      btnComplete.onclick = () => handleWizardSubmission({ modalEl, wizardData, closeModal, onComplete, sIdx, iIdx });
    }
  };

  syncTierStateFromStep1(cleanInitialName, wizardData.entityType);
  renderWizard();
  modalEl.classList.add('open');
}

export const openTaxonomyCreationModal = openNewIngredientMappingWizardModal;
