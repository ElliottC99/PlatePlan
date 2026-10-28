/**
 * src/services/RecipeWizardEventService.js (v3.38.59)
 * Event controller for the Recipe Wizard Taxonomy Modal.
 * Decomposed into Filter, Validation, and Submission services.
 */

import { getState } from '../store/store.js';
import { toTitleCase } from './RecipeImporter.js';
import { openTescoImportModal } from '../components/pantry/SubtypeProductLinkerModalUI.js';
import { openProductEditModal } from '../../views/ProductBankView.js';
import { renderStep2SubtypeFields } from './RecipeWizardStep2RenderService.js';
import { renderStep2ItemCategorySection } from './RecipeWizardStep2FieldsRenderService.js';
import { handleWizardSubmission } from './RecipeWizardSubmissionService.js';
import { bindCategoryAutocomplete, filterItems, filterSubtypes, filterProducts } from './RecipeWizardFilterService.js';
import { consolidateStep2Data } from './RecipeWizardValidationService.js';

export function bindWizardEvents({
  modalEl,
  wizardData,
  currentStep,
  renderWizard,
  closeModal,
  existingCategories,
  existingSubtypes,
  ingredients,
  defaultCat,
  syncTierStateFromStep1,
  onComplete,
  sIdx,
  iIdx,
  showProductSearch,
  productSearchQuery
}) {
  modalEl.querySelector('#map-wiz-backdrop')?.addEventListener('click', closeModal);
  modalEl.querySelector('#btn-close-map-wiz-top')?.addEventListener('click', closeModal);
  modalEl.querySelector('#btn-close-map-wiz')?.addEventListener('click', closeModal);

  if (currentStep.get() === 1) {
    const nameInput = modalEl.querySelector('#map-wiz-name');
    if (nameInput) {
      nameInput.oninput = (e) => { wizardData.name = e.target.value; };
    }

    modalEl.querySelectorAll('input[name="wiz-entity-type"]').forEach(radio => {
      radio.onchange = (e) => {
        const currentNameVal = modalEl.querySelector('#map-wiz-name')?.value?.trim() || wizardData.name;
        syncTierStateFromStep1(currentNameVal, e.target.value);
        renderWizard();
      };
    });

    const btnNext1 = modalEl.querySelector('#btn-next-step1');
    if (btnNext1) {
      btnNext1.onclick = () => {
        const nameVal = modalEl.querySelector('#map-wiz-name')?.value.trim();
        if (!nameVal) {
          if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast('Please enter an Entity Name', 'warning');
          }
          return;
        }
        syncTierStateFromStep1(nameVal, wizardData.entityType);
        currentStep.set(2);
        renderWizard();
      };
    }
  } else if (currentStep.get() === 2) {
    modalEl.querySelector('#btn-back-step2').onclick = () => {
      currentStep.set(1);
      renderWizard();
    };

    const itemInput = modalEl.querySelector('#map-item-search-input');
    if (itemInput) {
      itemInput.onfocus = () => filterItems({ modalEl, wizardData, query: itemInput.value, ingredients, defaultCat, renderWizard });
      itemInput.oninput = (e) => {
        const val = e.target.value;
        wizardData.newItemName = val;
        wizardData.item = val;
        if (wizardData.entityType === 'subtype') {
          const exactMatch = ingredients.find(i => (i.name || '').toLowerCase() === val.trim().toLowerCase());
          const wasExisting = wizardData.isExistingParentItem;
          if (exactMatch) {
            wizardData.selectedItemId = exactMatch.id;
            wizardData.isExistingParentItem = true;
            wizardData.selectedCategory = exactMatch.category || defaultCat;
            wizardData.category = wizardData.selectedCategory;
          } else {
            wizardData.selectedItemId = '';
            wizardData.isExistingParentItem = false;
          }
          if (wasExisting !== wizardData.isExistingParentItem) {
            const catSection = modalEl.querySelector('#map-subtype-cat-section');
            if (catSection) {
              catSection.innerHTML = renderStep2SubtypeFields(wizardData).split('<div id="map-subtype-cat-section">')[1].replace(/<\/div>\s*$/, '');
              bindCategoryAutocomplete({ modalEl, wizardData, existingCategories, defaultCat });
            }
          }
        }
        filterItems({ modalEl, wizardData, query: val, ingredients, defaultCat, renderWizard });
      };
    }

    bindCategoryAutocomplete({ modalEl, wizardData, existingCategories, defaultCat });

    const subInput = modalEl.querySelector('#map-sub-name-input');
    if (subInput) {
      if (wizardData.entityType === 'item') {
        subInput.onfocus = () => filterSubtypes({ modalEl, wizardData, query: subInput.value, existingSubtypes, defaultCat, renderWizard });
        subInput.oninput = (e) => {
          const val = e.target.value;
          wizardData.subTypeName = val;
          wizardData.subType = val;

          const exactSub = existingSubtypes.find(s => (s.name || '').toLowerCase() === val.trim().toLowerCase());
          const wasExistingSub = wizardData.isExistingChildSubtype;
          const prevCat = wizardData.selectedCategory;
          if (exactSub) {
            wizardData.selectedSubtypeId = exactSub.id;
            wizardData.isExistingChildSubtype = true;
            wizardData.selectedCategory = exactSub.category || defaultCat;
            wizardData.category = wizardData.selectedCategory;
          } else {
            wizardData.selectedSubtypeId = '';
            wizardData.isExistingChildSubtype = false;
          }
          if (wasExistingSub !== wizardData.isExistingChildSubtype || (wizardData.isExistingChildSubtype && prevCat !== wizardData.selectedCategory)) {
            const catSection = modalEl.querySelector('#map-item-cat-section');
            if (catSection) {
              catSection.innerHTML = renderStep2ItemCategorySection(wizardData);
              bindCategoryAutocomplete({ modalEl, wizardData, existingCategories, defaultCat });
            }
          }
          filterSubtypes({ modalEl, wizardData, query: val, existingSubtypes, defaultCat, renderWizard });
        };
      } else {
        subInput.oninput = (e) => {
          wizardData.subTypeName = e.target.value;
          wizardData.subType = e.target.value;
        };
      }
    }

    const btnNext2 = modalEl.querySelector('#btn-next-step2');
    if (btnNext2) {
      btnNext2.onclick = () => {
        consolidateStep2Data({ modalEl, wizardData, ingredients, existingSubtypes, defaultCat });
        currentStep.set(3);
        renderWizard();
      };
    }
  } else if (currentStep.get() === 3) {
    modalEl.querySelector('#btn-back-step3').onclick = () => {
      currentStep.set(2);
      renderWizard();
    };

    modalEl.querySelector('#btn-remove-linked-product')?.addEventListener('click', () => {
      wizardData.linkedProduct = null;
      renderWizard();
    });

    modalEl.querySelector('#btn-wiz-open-add-product')?.addEventListener('click', () => {
      window.__prefilledResolveBinding = {
        ingredientId: wizardData.createdIngredientId,
        subtypeId: wizardData.createdSubtypeId,
        parentCategory: wizardData.selectedCategory,
        subtypeDraftName: wizardData.subTypeName
      };
      const openModal = typeof openProductEditModal === 'function' ? openProductEditModal : window.openProductEditModal;
      if (typeof openModal === 'function') openModal(null);
    });

    modalEl.querySelector('#btn-wiz-open-tesco-import')?.addEventListener('click', () => {
      window.__draftSubtypePayload = { name: wizardData.subTypeName, parentCategory: wizardData.selectedCategory };
      const openTesco = typeof openTescoImportModal === 'function' ? openTescoImportModal : window.openTescoImportModal;
      if (typeof openTesco === 'function') openTesco(wizardData.createdSubtypeId, wizardData.createdIngredientId);
      ['view-modal-wrap', 'tesco-modal-wrap'].forEach(id => document.getElementById(id)?.style.setProperty('z-index', '25005', 'important'));
    });

    modalEl.querySelector('#btn-wiz-toggle-link-existing')?.addEventListener('click', () => {
      showProductSearch.set(!showProductSearch.get());
      renderWizard();
      if (showProductSearch.get()) {
        setTimeout(() => modalEl.querySelector('#wiz-product-search-input')?.focus(), 50);
      }
    });

    const searchInput = modalEl.querySelector('#wiz-product-search-input');
    if (searchInput) {
      const products = getState()?.products || [];
      searchInput.onfocus = () => filterProducts({ modalEl, wizardData, query: searchInput.value, products, productSearchQuery, showProductSearch, renderWizard });
      searchInput.oninput = (e) => filterProducts({ modalEl, wizardData, query: e.target.value, products, productSearchQuery, showProductSearch, renderWizard });
    }

    modalEl.querySelector('#btn-complete-map-wiz')?.addEventListener('click', () => {
      handleWizardSubmission({ modalEl, wizardData, closeModal, onComplete, sIdx, iIdx });
    });
  }
}
