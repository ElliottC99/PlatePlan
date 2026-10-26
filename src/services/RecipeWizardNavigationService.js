/**
 * src/services/RecipeWizardNavigationService.js (v3.38.64)
 * Manages step transitions and input bindings for the Recipe Wizard.
 * Decomposed: Uses Filter, Validation, and StepValidator services.
 */

import { getState } from '../store/store.js';
import { 
  bindCategoryAutocomplete, 
  filterItems, 
  filterSubtypes, 
  filterProducts 
} from './RecipeWizardFilterService.js';
import { consolidateStep2Data } from './RecipeWizardValidationService.js';
import { validateStep1Name } from './RecipeWizardStepValidator.js';
import { renderStep2SubtypeFields } from './RecipeWizardStep2RenderService.js';
import { renderStep2ItemCategorySection } from './RecipeWizardStep2FieldsRenderService.js';

export function bindNavigationHandlers({
  modalEl,
  wizardData,
  currentStep,
  renderWizard,
  existingCategories,
  existingSubtypes,
  ingredients,
  defaultCat,
  syncTierStateFromStep1,
  showProductSearch,
  productSearchQuery
}) {
  const commonFilterArgs = { modalEl, wizardData, ingredients, defaultCat, renderWizard };

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
        if (!validateStep1Name(nameVal)) return;
        
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
      itemInput.onfocus = () => filterItems({ ...commonFilterArgs, query: itemInput.value });
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
        filterItems({ ...commonFilterArgs, query: val });
      };
    }

    bindCategoryAutocomplete({ modalEl, wizardData, existingCategories, defaultCat });

    const subInput = modalEl.querySelector('#map-sub-name-input');
    if (subInput) {
      if (wizardData.entityType === 'item') {
        subInput.onfocus = () => filterSubtypes({ ...commonFilterArgs, query: subInput.value, existingSubtypes });
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
          filterSubtypes({ ...commonFilterArgs, query: val, existingSubtypes });
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

    const searchInput = modalEl.querySelector('#wiz-product-search-input');
    if (searchInput) {
      const products = getState()?.products || [];
      const filterArgs = { modalEl, wizardData, products, productSearchQuery, showProductSearch, renderWizard };
      searchInput.onfocus = () => filterProducts({ ...filterArgs, query: searchInput.value });
      searchInput.oninput = (e) => filterProducts({ ...filterArgs, query: e.target.value });
    }
  }
}
