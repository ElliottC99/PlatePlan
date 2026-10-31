/**
 * src/components/recipe/RecipeWizardStep2Handlers.js (v3.34.0)
 * Event bindings for Wizard Step 2: Interactive Servings Scaling, Section Editing, Line Editing & Taxonomy Linking.
 */

import { wizardState, syncStep2InputsToState } from './RecipeWizardState.js';
import { bindTaxonomyAutocompleteEvents } from './RecipeWizardTaxonomySearch.js';
import { promptRecipeWizardAliases } from './RecipeWizardAliasesPrompt.js';
import { getState } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { recalculateWizardMacros } from './RecipeWizardStep3Handlers.js';

export function bindStep2Events(modalWrap, { renderWizardModal, showWizardNotice }) {
  if (!modalWrap || wizardState.currentStep !== 2) return;

  const safeRender = () => {
    recalculateWizardMacros(wizardState.activeRecipe);
    const wb = document.getElementById('wizard-modal-body') || document.querySelector('.modal-body');
    const st = wb ? wb.scrollTop : 0;
    renderWizardModal();
    const newWb = document.getElementById('wizard-modal-body') || document.querySelector('.modal-body');
    if (newWb) newWb.scrollTop = st;
  };

  const servingsInput = modalWrap.querySelector('#wiz-servings-input');
  if (servingsInput) {
    servingsInput.oninput = (e) => {
      const val = Math.max(1, parseInt(e.target.value, 10) || 4);
      wizardState.activeRecipe.servings = val;
      wizardState.activeRecipe.serves = val;
      recalculateWizardMacros(wizardState.activeRecipe);
    };
  }

  const btnAddSection = modalWrap.querySelector('#wiz-add-section-btn');
  if (btnAddSection) {
    btnAddSection.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.ingredientSections.push({
        sectionTitle: toTitleCase('New Section'),
        ingredients: []
      });
      safeRender();
    };
  }

  modalWrap.querySelectorAll('.wiz-add-line-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      if (!isNaN(sIdx) && wizardState.activeRecipe.ingredientSections[sIdx]) {
        if (!wizardState.activeRecipe.ingredientSections[sIdx].ingredients) {
          wizardState.activeRecipe.ingredientSections[sIdx].ingredients = [];
        }
        wizardState.activeRecipe.ingredientSections[sIdx].ingredients.push({
          raw: '',
          name: '',
          qty: 1,
          unit: 'g'
        });
        safeRender();
      }
    };
  });

  modalWrap.querySelectorAll('.wiz-del-section-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      if (!isNaN(sIdx)) {
        wizardState.activeRecipe.ingredientSections.splice(sIdx, 1);
        if (!wizardState.activeRecipe.ingredientSections.length) {
          wizardState.activeRecipe.ingredientSections = [{ sectionTitle: 'Main Ingredients', ingredients: [] }];
        }
        safeRender();
      }
    };
  });

  modalWrap.querySelectorAll('.wiz-del-ing-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      const iIdx = parseInt(btn.dataset.iidx, 10);
      if (!isNaN(sIdx) && !isNaN(iIdx)) {
        wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients.splice(iIdx, 1);
        safeRender();
      }
    };
  });

  const btnAddStep = modalWrap.querySelector('#wiz-add-step-btn');
  if (btnAddStep) {
    btnAddStep.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.methodSteps.push('New step instruction');
      safeRender();
    };
  }

  modalWrap.querySelectorAll('.wiz-del-step-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const idx = parseInt(btn.dataset.idx, 10);
      if (!isNaN(idx)) {
        wizardState.activeRecipe.methodSteps.splice(idx, 1);
        safeRender();
      }
    };
  });

  bindTaxonomyAutocompleteEvents(modalWrap, (sIdx, iIdx, val) => {
    const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
    if (item) {
      if (!val || val === 'new_item') {
        item.ingredientId = null;
        item.subtypeId = null;
        item.isNewTaxonomyItem = true;
      } else if (val.startsWith('cat:')) {
        item.categoryId = val.replace('cat:', '');
        item.ingredientId = null;
        item.subtypeId = null;
        item.isNewTaxonomyItem = false;
      } else if (val.includes(':')) {
        const [ingId, subId] = val.split(':');
        item.ingredientId = ingId;
        item.subtypeId = subId;
        item.isNewTaxonomyItem = false;
      } else {
        item.ingredientId = val;
        item.subtypeId = null;
        item.isNewTaxonomyItem = false;
      }
    }
    safeRender();
  });

  const btnNext2 = modalWrap.querySelector('#btn-next-step2');
  if (btnNext2) {
    btnNext2.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const finalServings = Number(wizardState.activeRecipe.servings || wizardState.activeRecipe.serves || 4) || 4;
      wizardState.activeRecipe.servings = finalServings;
      wizardState.activeRecipe.serves = finalServings;
      
      // Auto-format all section headers to Title Case
      if (wizardState.activeRecipe.ingredientSections) {
        wizardState.activeRecipe.ingredientSections.forEach(sec => {
          if (sec.sectionTitle) sec.sectionTitle = toTitleCase(sec.sectionTitle);
        });
      }

      const allIngs = (wizardState.activeRecipe.ingredientSections || []).flatMap(s => s.ingredients || []);
      const unlinked = allIngs.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
      if (unlinked.length > 0) {
        showWizardNotice(`Cannot proceed: ${unlinked.length} ingredient(s) retain an unlinked "✨ New Item" status. Please map each ingredient to a valid Category, Item, or Sub-Type.`, 'warning');
        return;
      }

      // Live recalculation before entering Step 3 review
      recalculateWizardMacros(wizardState.activeRecipe);

      promptRecipeWizardAliases(allIngs, () => {
        wizardState.currentStep = 3;
        renderWizardModal();
      });
    };
  }

  const btnBack = modalWrap.querySelector('#wizard-back-btn');
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (wizardState.currentStep === 2) {
        syncStep2InputsToState(modalWrap);
      }
      wizardState.currentStep = 1.5;
      renderWizardModal();
    });
  }
}
