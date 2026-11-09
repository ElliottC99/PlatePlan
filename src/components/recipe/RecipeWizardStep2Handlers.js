/**
 * src/components/recipe/RecipeWizardStep2Handlers.js (v3.34.0)
 * Event bindings for Wizard Step 2: Interactive Servings Scaling, Section Editing, Line Editing & Taxonomy Linking.
 */

import { wizardState, syncStep2InputsToState, switchWizardVariant, isMultiRecipeQueueFlow } from './RecipeWizardState.js';
import { bindTaxonomyAutocompleteEvents, isIngredientUnlinked } from './RecipeWizardTaxonomySearch.js';
import { promptRecipeWizardAliases } from './RecipeWizardAliasesPrompt.js';
import { getState } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { recalculateWizardMacros, resolveProductForIngredient } from './RecipeWizardStep3Handlers.js';
import { renderMacroBreakdownCrossbar } from './RecipeWizardStep3View.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';

export function bindStep2Events(modalWrap, { renderWizardModal, showWizardNotice }) {
  if (!modalWrap || wizardState.currentStep !== 2) return;

  const updateStep2NextButtonState = () => {
    const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' ? window.getState?.() : null)) || {};
    const prods = state.products || [];
    const ings = state.rootItems || state.ingredients || [];
    const allIngs = (wizardState.activeRecipe?.ingredientSections || []).flatMap(s => s.ingredients || []);

    const taxInputs = Array.from(modalWrap.querySelectorAll('.wiz-ing-tax-search'));
    const hasDomUnlinked = taxInputs.some(inp => {
      const val = (inp.dataset.taxVal || inp.value || '').trim();
      return !val || val === 'new_item' || /new[\s_]*item/i.test(val);
    });

    const unlinked = allIngs.filter(i => isIngredientUnlinked(i, prods, ings));
    const isBlocked = unlinked.length > 0 || hasDomUnlinked;

    const btnNext = modalWrap.querySelector('#btn-next-step2');
    if (btnNext) {
      btnNext.disabled = isBlocked;
      btnNext.style.opacity = isBlocked ? '0.6' : '1';
      btnNext.style.cursor = isBlocked ? 'not-allowed' : 'pointer';
      btnNext.title = isBlocked ? 'All ingredients must be linked before proceeding' : '';
    }

    const warningBanner = modalWrap.querySelector('#wiz-gate-warning-banner');
    if (warningBanner) {
      warningBanner.style.display = isBlocked ? 'flex' : 'none';
      const countSpan = warningBanner.querySelector('.wiz-unlinked-count');
      if (countSpan) {
        countSpan.textContent = Math.max(unlinked.length, taxInputs.filter(inp => /new[\s_]*item/i.test(inp.dataset.taxVal || inp.value || '')).length, 1);
      }
    }

    const gatePill = modalWrap.querySelector('#wiz-gate-pill');
    if (gatePill) {
      const count = Math.max(unlinked.length, taxInputs.filter(inp => /new[\s_]*item/i.test(inp.dataset.taxVal || inp.value || '')).length, 1);
      if (isBlocked) {
        gatePill.className = 'wiz-gate-pill blocked';
        gatePill.title = 'Click to jump to next unmapped ingredient';
        gatePill.innerHTML = `<span>⚠️</span> <span class="wiz-unlinked-count">${count}</span> unmapped item(s) <span style="font-size:10px;text-decoration:underline;margin-left:2px;">(jump)</span>`;
      } else {
        gatePill.className = 'wiz-gate-pill ready';
        gatePill.title = 'All ingredients are linked';
        gatePill.innerHTML = `<span>✓</span> All items linked`;
      }
    }
  };

  const updateLiveStep2NutritionDOM = () => {
    syncStep2InputsToState(modalWrap);
    recalculateWizardMacros(wizardState.activeRecipe);

    const fitContainer = modalWrap.querySelector('#wiz-step2-fit-badge-container');
    const macroBarContainer = modalWrap.querySelector('#wiz-step2-macro-crossbar-container');

    const currentVariant = wizardState.activeVariant || 'original';
    const targetMealType = wizardState.activeRecipe?.mealSuitability?.[0] || wizardState.activeRecipe?.types?.[0] || wizardState.activeRecipe?.type || 'dinner';

    if (fitContainer) {
      fitContainer.innerHTML = renderFitScoreBadge(wizardState.activeRecipe, targetMealType, {
        variant: currentVariant,
        showLabel: true
      });
    }
    if (macroBarContainer) {
      macroBarContainer.innerHTML = renderMacroBreakdownCrossbar(wizardState.activeRecipe, currentVariant, { compact: true });
    }
    updateStep2NextButtonState();
  };

  const safeRender = ({ syncInputs = true } = {}) => {
    if (syncInputs) {
      syncStep2InputsToState(modalWrap);
    }
    recalculateWizardMacros(wizardState.activeRecipe);
    const wb = document.getElementById('wizard-modal-body') || document.querySelector('.modal-body');
    const st = wb ? wb.scrollTop : 0;
    renderWizardModal();
    const newWb = document.getElementById('wizard-modal-body') || document.querySelector('.modal-body');
    if (newWb) newWb.scrollTop = st;
  };

  // Step 2 Variant toggle buttons (Original <-> Enhanced)
  const step2TabOrig = modalWrap.querySelector('#wiz-step2-tab-original');
  if (step2TabOrig) {
    step2TabOrig.onclick = () => {
      switchWizardVariant('original', modalWrap);
      safeRender({ syncInputs: false });
    };
  }

  const step2TabEnh = modalWrap.querySelector('#wiz-step2-tab-enhanced');
  if (step2TabEnh) {
    step2TabEnh.onclick = () => {
      switchWizardVariant('enhanced', modalWrap);
      safeRender({ syncInputs: false });
    };
  }

  // Live input delegation on table inputs: qty, unit, name, water ml, servings
  modalWrap.addEventListener('input', (e) => {
    if (e.target && e.target.matches('.wiz-ing-qty, .wiz-ing-unit, .wiz-ing-name, .wiz-ing-water-ml, #wiz-servings-input')) {
      updateLiveStep2NutritionDOM();
    }
  });

  modalWrap.addEventListener('change', (e) => {
    if (e.target && e.target.matches('.wiz-ing-qty, .wiz-ing-unit, .wiz-ing-name, .wiz-ing-water-ml, #wiz-servings-input')) {
      updateLiveStep2NutritionDOM();
    }
  });

  const servingsInput = modalWrap.querySelector('#wiz-servings-input');
  if (servingsInput) {
    servingsInput.oninput = (e) => {
      const val = Math.max(1, parseInt(e.target.value, 10) || 4);
      wizardState.activeRecipe.servings = val;
      wizardState.activeRecipe.serves = val;
      updateLiveStep2NutritionDOM();
    };
  }

  // Interactive gating pill jump: smooth scroll to first unlinked ingredient row
  const gatePill = modalWrap.querySelector('#wiz-gate-pill');
  if (gatePill) {
    gatePill.onclick = () => {
      const unlinkedRow = modalWrap.querySelector('tr.wiz-row-unlinked') ||
        Array.from(modalWrap.querySelectorAll('tr[id^="wiz-ing-row-"]')).find(r => {
          const inp = r.querySelector('.wiz-ing-tax-search');
          const val = (inp?.dataset?.taxVal || inp?.value || '').trim();
          return !val || val === 'new_item' || /new[\s_]*item/i.test(val);
        });
      if (unlinkedRow) {
        unlinkedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inp = unlinkedRow.querySelector('.wiz-ing-tax-search');
        if (inp) {
          inp.focus();
          inp.style.outline = '2px solid #e11d48';
          setTimeout(() => { if (inp) inp.style.outline = ''; }, 1500);
        }
      }
    };
  }

  // Compact auto-fitting method step textarea resizing
  modalWrap.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches('.wiz-step-input')) {
      e.target.style.height = 'auto';
      e.target.style.height = Math.max(32, e.target.scrollHeight) + 'px';
      e.target.style.overflowY = 'auto';
    }
  });

  modalWrap.addEventListener('input', (e) => {
    if (e.target && e.target.matches('.wiz-step-input')) {
      e.target.style.height = 'auto';
      e.target.style.height = Math.max(32, e.target.scrollHeight) + 'px';
    }
  });

  modalWrap.addEventListener('focusout', (e) => {
    if (e.target && e.target.matches('.wiz-step-input')) {
      if (e.target.value.length < 80 && !e.target.value.includes('\n')) {
        e.target.style.height = '32px';
        e.target.style.overflowY = 'hidden';
      }
    }
  });

  const btnAddSection = modalWrap.querySelector('#wiz-add-section-btn');
  if (btnAddSection) {
    btnAddSection.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.ingredientSections.push({
        sectionTitle: toTitleCase('New Section'),
        ingredients: []
      });
      safeRender({ syncInputs: false });
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
        safeRender({ syncInputs: false });
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
        safeRender({ syncInputs: false });
      }
    };
  });

  modalWrap.querySelectorAll('.wiz-del-ing-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      const iIdx = parseInt(btn.dataset.iidx, 10);
      if (!isNaN(sIdx) && !isNaN(iIdx)) {
        wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients?.splice(iIdx, 1);
        safeRender({ syncInputs: false });
      }
    };
  });

  const btnAddStep = modalWrap.querySelector('#wiz-add-step-btn');
  if (btnAddStep) {
    btnAddStep.onclick = () => {
      syncStep2InputsToState(modalWrap);
      if (!Array.isArray(wizardState.activeRecipe.methodSteps)) {
        wizardState.activeRecipe.methodSteps = [];
      }
      wizardState.activeRecipe.methodSteps.push('');
      safeRender({ syncInputs: false });
    };
  }

  modalWrap.querySelectorAll('.wiz-del-step-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const idx = parseInt(btn.dataset.idx, 10);
      if (!isNaN(idx) && Array.isArray(wizardState.activeRecipe.methodSteps)) {
        wizardState.activeRecipe.methodSteps.splice(idx, 1);
        safeRender({ syncInputs: false });
      }
    };
  });

  bindTaxonomyAutocompleteEvents(modalWrap, (sIdx, iIdx, val) => {
    const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
    if (item) {
      // Clear previous direct product matches when changing taxonomy mapping
      item.productId = null;
      item.bankId = null;
      delete item.mappedItemId;
      delete item.productMatch;

      if (!val || val === 'new_item') {
        item.ingredientId = null;
        item.subtypeId = null;
        item.categoryId = null;
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
        item.categoryId = null;
        item.isNewTaxonomyItem = false;
      } else {
        item.ingredientId = val;
        item.subtypeId = null;
        item.categoryId = null;
        item.isNewTaxonomyItem = false;
      }

      // Auto resolve product and update live nutrition
      const storeState = getState() || {};
      const resolvedProd = resolveProductForIngredient(item, {
        products: storeState.products || [],
        ingredients: storeState.rootItems || storeState.ingredients || []
      });
      if (resolvedProd) {
        item.productId = resolvedProd.id;
        item.productName = resolvedProd.name || resolvedProd.productName;
      }
    }
    updateLiveStep2NutritionDOM();
    safeRender({ syncInputs: false });
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

      const state = getState() || {};
      const prods = state.products || [];
      const ings = state.rootItems || state.ingredients || [];
      const allIngs = (wizardState.activeRecipe.ingredientSections || []).flatMap(s => s.ingredients || []);
      const taxInputs = Array.from(modalWrap.querySelectorAll('.wiz-ing-tax-search'));
      const hasDomUnlinked = taxInputs.some(inp => {
        const val = (inp.dataset.taxVal || inp.value || '').trim();
        return !val || val === 'new_item' || /new[\s_]*item/i.test(val);
      });
      const unlinked = allIngs.filter(i => isIngredientUnlinked(i, prods, ings));
      if (unlinked.length > 0 || hasDomUnlinked) {
        const count = Math.max(unlinked.length, taxInputs.filter(inp => /new[\s_]*item/i.test(inp.dataset.taxVal || inp.value || '')).length, 1);
        showWizardNotice(`Cannot proceed: ${count} ingredient(s) retain an unlinked "✨ New Item" status. Please map each ingredient to a valid Category, Item, or Sub-Type.`, 'warning');
        updateStep2NextButtonState();
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
      wizardState.currentStep = isMultiRecipeQueueFlow(wizardState) ? 1.5 : 1;
      renderWizardModal();
    });
  }
}
