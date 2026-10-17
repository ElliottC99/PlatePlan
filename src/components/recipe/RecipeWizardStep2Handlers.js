/**
 * src/components/recipe/RecipeWizardStep2Handlers.js (v3.34.0)
 * Event bindings for Wizard Step 2: Interactive Servings Scaling, Section Editing, Line Editing & Taxonomy Linking.
 */

import { wizardState, syncStep2InputsToState } from './RecipeWizardState.js';
import { bindTaxonomyAutocompleteEvents } from './RecipeWizardTaxonomySearch.js';
import { promptRecipeWizardAliases } from './RecipeWizardAliasesPrompt.js';
import * as NutritionService from '../../services/NutritionService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';
import { getState } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';

/**
 * Recalculates per-serving macros and fit score for the active wizard recipe.
 */
function recalculateWizardMacros() {
  const rec = wizardState.activeRecipe;
  if (!rec) return;

  const targetServings = Number(wizardState.targetServings || rec.targetServings || 2);
  const storeState = getState() || {};
  const products = storeState.products || [];

  const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients || []);
  const nutritionList = allIngredients.map(ing => {
    const prodId = ing.productId || ing.mappedItemId || ing.productMatch?.id;
    const product = prodId ? products.find(p => String(p.id) === String(prodId)) : null;
    if (!product) return { kcal: 0, prot: 0, carb: 0, fat: 0 };
    return NutritionService.calculateItemNutrition(product, ing.scaledQty || ing.qty, ing.unit);
  });

  const rolled = NutritionService.rollupNutritionTotals(nutritionList, targetServings);
  
  rec.macros = {
    calories: Math.round(rolled.perServing?.cal || rolled.perServing?.kcal || 0),
    protein: Math.round((rolled.perServing?.prot || rolled.perServing?.protein || 0) * 10) / 10,
    carbs: Math.round((rolled.perServing?.carb || rolled.perServing?.carbs || 0) * 10) / 10,
    fat: Math.round((rolled.perServing?.fat || 0) * 10) / 10
  };

  // Recompute fit score
  const fitResult = calculateMealFitScore(rec, rec.mealSuitability?.[0] || 'dinner');
  rec.fitScore = fitResult.score;
  rec.fitTier = fitResult.tier;
}

export function bindStep2Events(modalWrap, { renderWizardModal, showWizardNotice }) {
  if (!modalWrap || wizardState.currentStep !== 2) return;

  const safeRender = () => {
    recalculateWizardMacros();
    const wb = document.getElementById('wizard-modal-body') || document.querySelector('.modal-body');
    const st = wb ? wb.scrollTop : 0;
    renderWizardModal();
    const newWb = document.getElementById('wizard-modal-body') || document.querySelector('.modal-body');
    if (newWb) newWb.scrollTop = st;
  };

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
      const scaledQty = Math.round(baseQty * newScale * 100) / 100;
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

    recalculateWizardMacros();
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
      recalculateWizardMacros();

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
