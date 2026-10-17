/**
 * src/components/recipe/RecipeWizardStep2Handlers.js (v3.32.2)
 * Event bindings for Wizard Step 2: Interactive Servings Scaling, Section Editing, Line Editing & Taxonomy Linking.
 */

import { wizardState, syncStep2InputsToState } from './RecipeWizardState.js';
import { bindTaxonomyAutocompleteEvents } from './RecipeWizardTaxonomySearch.js';
import { promptRecipeWizardAliases } from './RecipeWizardAliasesPrompt.js';

export function bindStep2Events(modalWrap, { renderWizardModal, showWizardNotice }) {
  if (!modalWrap || wizardState.currentStep !== 2) return;

  const targetServingsInput = modalWrap.querySelector('#wiz-target-servings-input');
  const scaleDownBtn = modalWrap.querySelector('#wiz-scale-down-btn');
  const scaleUpBtn = modalWrap.querySelector('#wiz-scale-up-btn');
  const scaleFactorBadge = modalWrap.querySelector('#wiz-scale-factor-badge');

  const updateServingsScale = (newServings) => {
    const rec = wizardState.activeRecipe || {};
    const baseServings = Number(rec.servings || rec.currentServings) || 2;
    const targetServings = Math.max(1, Math.min(24, parseInt(newServings, 10) || baseServings));

    wizardState.targetServings = targetServings;
    rec.targetServings = targetServings;

    if (targetServingsInput) targetServingsInput.value = targetServings;

    const newScale = targetServings / baseServings;
    if (scaleFactorBadge) scaleFactorBadge.textContent = `${newScale.toFixed(2)}x`;

    modalWrap.querySelectorAll('.wiz-ing-qty').forEach(input => {
      const sIdx = parseInt(input.dataset.sidx, 10);
      const iIdx = parseInt(input.dataset.iidx, 10);
      const baseQty = parseFloat(input.dataset.baseQty) || parseFloat(input.value) || 1;
      const scaledQty = Math.round(baseQty * newScale * 10) / 10;
      input.value = scaledQty;

      const item = rec.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) {
        item.scaledQty = scaledQty;
        item.baseQty = baseQty;
      }
    });

    modalWrap.querySelectorAll('.wiz-ing-water-ml').forEach(input => {
      const sIdx = parseInt(input.dataset.sidx, 10);
      const iIdx = parseInt(input.dataset.iidx, 10);
      const item = rec.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item && item.baseWaterMl) {
        const scaledWater = Math.round(item.baseWaterMl * newScale);
        input.value = scaledWater;
        item.waterMl = scaledWater;
      }
    });
  };

  if (targetServingsInput) {
    targetServingsInput.oninput = (e) => updateServingsScale(e.target.value);
  }

  if (scaleDownBtn) {
    scaleDownBtn.onclick = () => {
      const current = parseInt(targetServingsInput?.value, 10) || (wizardState.activeRecipe.targetServings || 4);
      if (current > 1) updateServingsScale(current - 1);
    };
  }

  if (scaleUpBtn) {
    scaleUpBtn.onclick = () => {
      const current = parseInt(targetServingsInput?.value, 10) || (wizardState.activeRecipe.targetServings || 4);
      if (current < 24) updateServingsScale(current + 1);
    };
  }

  const btnAddSection = modalWrap.querySelector('#wiz-add-section-btn');
  if (btnAddSection) {
    btnAddSection.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.ingredientSections.push({
        sectionTitle: 'New Section',
        ingredients: []
      });
      renderWizardModal();
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
        renderWizardModal();
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
        renderWizardModal();
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
        renderWizardModal();
      }
    };
  });

  const btnAddStep = modalWrap.querySelector('#wiz-add-step-btn');
  if (btnAddStep) {
    btnAddStep.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.methodSteps.push('New step instruction');
      renderWizardModal();
    };
  }

  modalWrap.querySelectorAll('.wiz-del-step-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const idx = parseInt(btn.dataset.idx, 10);
      if (!isNaN(idx)) {
        wizardState.activeRecipe.methodSteps.splice(idx, 1);
        renderWizardModal();
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
    renderWizardModal();
  });

  const btnNext2 = modalWrap.querySelector('#btn-next-step2');
  if (btnNext2) {
    btnNext2.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const allIngs = (wizardState.activeRecipe.ingredientSections || []).flatMap(s => s.ingredients || []);
      const unlinked = allIngs.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
      if (unlinked.length > 0) {
        showWizardNotice(`Cannot proceed: ${unlinked.length} ingredient(s) retain an unlinked "✨ New Item" status. Please map each ingredient to a valid Category, Item, or Sub-Type.`, 'warning');
        return;
      }

      promptRecipeWizardAliases(allIngs, () => {
        wizardState.currentStep = 3;
        renderWizardModal();
      });
    };
  }
}
