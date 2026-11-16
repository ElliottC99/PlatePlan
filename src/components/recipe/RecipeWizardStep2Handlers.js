/**
 * src/components/recipe/RecipeWizardStep2Handlers.js (v3.34.0)
 * Event bindings for Wizard Step 2: Interactive Servings Scaling, Section Editing, Line Editing & Taxonomy Linking.
 */

import { wizardState, syncStep2InputsToState, switchWizardVariant, isMultiRecipeQueueFlow } from './RecipeWizardState.js';
import { bindTaxonomyAutocompleteEvents, isIngredientUnlinked, getIngredientQtyValidationIssue } from './RecipeWizardTaxonomySearch.js';
import { promptRecipeWizardAliases } from './RecipeWizardAliasesPrompt.js';
import { getState, setProducts } from '../../store/store.js';
import { saveProduct } from '../../services/ProductRepository.js';
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
    const invalidQty = allIngs.filter(i => getIngredientQtyValidationIssue(i, prods, ings).invalid);
    const unlinkedCount = Math.max(unlinked.length, taxInputs.filter(inp => /new[\s_]*item/i.test(inp.dataset.taxVal || inp.value || '')).length);
    const isBlocked = unlinkedCount > 0 || hasDomUnlinked || invalidQty.length > 0;

    const btnNext = modalWrap.querySelector('#btn-next-step2');
    if (btnNext) {
      btnNext.disabled = isBlocked;
      btnNext.style.opacity = isBlocked ? '0.6' : '1';
      btnNext.style.cursor = isBlocked ? 'not-allowed' : 'pointer';
      btnNext.title = isBlocked ? 'All ingredients must be linked and have calculable weights before proceeding' : '';
    }

    const warningBanner = modalWrap.querySelector('#wiz-gate-warning-banner');
    if (warningBanner) {
      warningBanner.style.display = isBlocked ? 'flex' : 'none';
      const countSpan = warningBanner.querySelector('.wiz-unlinked-count');
      if (countSpan) {
        countSpan.textContent = Math.max(unlinkedCount + invalidQty.length, 1);
      }
    }

    const gatePill = modalWrap.querySelector('#wiz-gate-pill');
    if (gatePill) {
      if (isBlocked) {
        gatePill.className = 'wiz-gate-pill blocked';
        if (unlinkedCount > 0 && invalidQty.length > 0) {
          gatePill.title = 'Click to jump to next unmapped or invalid qty ingredient';
          gatePill.innerHTML = `<span>⚠️</span> <span class="wiz-unlinked-count">${unlinkedCount}</span> unmapped item(s), <span class="wiz-invalid-qty-count">${invalidQty.length}</span> qty weight issue(s) <span style="font-size:10px;text-decoration:underline;margin-left:2px;">(jump)</span>`;
        } else if (unlinkedCount > 0 || hasDomUnlinked) {
          const count = Math.max(unlinkedCount, 1);
          gatePill.title = 'Click to jump to next unmapped ingredient';
          gatePill.innerHTML = `<span>⚠️</span> <span class="wiz-unlinked-count">${count}</span> unmapped item(s) <span style="font-size:10px;text-decoration:underline;margin-left:2px;">(jump)</span>`;
        } else {
          gatePill.title = 'Click to jump to next ingredient with uncalculable qty weight';
          gatePill.innerHTML = `<span>⚠️</span> <span class="wiz-invalid-qty-count">${invalidQty.length}</span> qty weight issue(s) <span style="font-size:10px;text-decoration:underline;margin-left:2px;">(jump)</span>`;
        }
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
      macroBarContainer.innerHTML = renderMacroBreakdownCrossbar(wizardState.activeRecipe, currentVariant, { compact: true, mealType: targetMealType });
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
    if (e.target && e.target.matches('.wiz-step2-meal-tag')) {
      const clickedTag = e.target.value;
      const allChecked = Array.from(modalWrap.querySelectorAll('.wiz-step2-meal-tag:checked')).map(el => el.value);
      let selected = allChecked.length > 0 ? allChecked : ['Dinner'];
      if (e.target.checked && clickedTag) {
        selected = [clickedTag, ...selected.filter(t => t !== clickedTag)];
      }
      wizardState.activeRecipe.mealSuitability = selected;
      wizardState.activeRecipe.types = selected.map(t => t.toLowerCase());
      wizardState.activeRecipe.mealType = wizardState.activeRecipe.types[0];

      modalWrap.querySelectorAll('.wiz-step2-meal-tag').forEach(input => {
        const label = input.closest('label');
        if (label) {
          label.style.background = input.checked ? 'var(--purple-bg, #eef2ff)' : 'var(--surface, #fff)';
          label.style.color = input.checked ? 'var(--purple, #4f46e5)' : 'var(--text2, #475569)';
        }
      });
      updateLiveStep2NutritionDOM();
      return;
    }
    if (e.target && e.target.matches('.wiz-ing-unit')) {
      syncStep2InputsToState(modalWrap);
      safeRender({ syncInputs: false });
      return;
    }
    if (e.target && e.target.matches('.wiz-ing-qty, .wiz-ing-name, .wiz-ing-water-ml, #wiz-servings-input')) {
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

  // Interactive gating pill jump: smooth scroll to first unlinked or invalid-qty ingredient row
  const gatePill = modalWrap.querySelector('#wiz-gate-pill');
  if (gatePill) {
    gatePill.onclick = () => {
      const targetRow = modalWrap.querySelector('tr.wiz-row-unlinked') ||
        modalWrap.querySelector('tr.wiz-row-invalid-qty') ||
        Array.from(modalWrap.querySelectorAll('tr[id^="wiz-ing-row-"]')).find(r => {
          const inp = r.querySelector('.wiz-ing-tax-search');
          const val = (inp?.dataset?.taxVal || inp?.value || '').trim();
          return !val || val === 'new_item' || /new[\s_]*item/i.test(val);
        });
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusEl = targetRow.classList.contains('wiz-row-invalid-qty')
          ? (targetRow.querySelector('.wiz-inline-item-weight') || targetRow.querySelector('.wiz-ing-unit'))
          : targetRow.querySelector('.wiz-ing-tax-search');
        if (focusEl) {
          focusEl.focus();
          focusEl.style.outline = '2px solid #e11d48';
          setTimeout(() => { if (focusEl) focusEl.style.outline = ''; }, 1500);
        }
      }
    };
  }

  // Inline quick-fix actions for invalid-qty rows
  modalWrap.querySelectorAll('.wiz-quick-switch-unit-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      const iIdx = parseInt(btn.dataset.iidx, 10);
      const targetUnit = btn.dataset.unit || 'g';
      const item = wizardState.activeRecipe?.ingredientSections?.[sIdx]?.ingredients?.[iIdx];
      if (item) {
        item.unit = targetUnit;
        item.isInvalidQtyUnit = false;
        safeRender({ syncInputs: false });
      }
    };
  });

  modalWrap.querySelectorAll('.wiz-save-inline-item-weight-btn').forEach(btn => {
    btn.onclick = async () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      const iIdx = parseInt(btn.dataset.iidx, 10);
      const prodId = btn.dataset.prodId;
      const weightInput = modalWrap.querySelector(`#wiz-inline-item-weight-${sIdx}-${iIdx}`);
      const weightVal = parseFloat(weightInput?.value);
      if (!weightVal || weightVal <= 0) {
        showWizardNotice('Please enter a valid single-item weight in grams (e.g. 150).', 'warning');
        if (weightInput) weightInput.focus();
        return;
      }
      const state = getState() || {};
      const prods = Array.isArray(state.products) ? [...state.products] : [];
      const pIdx = prods.findIndex(p => String(p.id) === String(prodId));
      if (pIdx >= 0) {
        const updatedProd = {
          ...prods[pIdx],
          itemWeight: weightVal,
          itemWeightUnit: 'g'
        };
        prods[pIdx] = updatedProd;
        setProducts(prods);
        await saveProduct(updatedProd);
        if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Saved 1 Usable item size (${weightVal}g) on "${updatedProd.name}".`);
        }
        safeRender({ syncInputs: false });
      }
    };
  });

  modalWrap.querySelectorAll('.wiz-remap-item-btn').forEach(btn => {
    btn.onclick = () => {
      const sIdx = btn.dataset.sidx;
      const iIdx = btn.dataset.iidx;
      const taxInp = modalWrap.querySelector(`#wiz-ing-tax-search-${sIdx}-${iIdx}`);
      if (taxInp) {
        taxInp.focus();
        taxInp.select?.();
      }
    };
  });

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

  // Reorder ingredients up or down within section
  modalWrap.querySelectorAll('.wiz-reorder-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      const iIdx = parseInt(btn.dataset.iidx, 10);
      const direction = btn.dataset.direction;
      const sec = wizardState.activeRecipe.ingredientSections?.[sIdx];
      if (!sec || !Array.isArray(sec.ingredients)) return;

      const targetIdx = direction === 'up' ? iIdx - 1 : iIdx + 1;
      if (targetIdx < 0 || targetIdx >= sec.ingredients.length) return;

      const temp = sec.ingredients[iIdx];
      sec.ingredients[iIdx] = sec.ingredients[targetIdx];
      sec.ingredients[targetIdx] = temp;

      safeRender({ syncInputs: false });
    };
  });

  // Copy method steps from base/original recipe into enhanced variant
  const btnCopyMethod = modalWrap.querySelector('#wiz-copy-method-btn');
  if (btnCopyMethod) {
    btnCopyMethod.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const base = wizardState.baseOriginalRecipe || wizardState.originalRecipe || wizardState.variantSnapshots?.original;
      if (!base) {
        showWizardNotice('Original recipe instructions not found.', 'warning');
        return;
      }
      const rawSteps = Array.isArray(base.methodSteps)
        ? base.methodSteps
        : (base.steps || base.method || base.instructions || []);
      const copiedSteps = Array.isArray(rawSteps)
        ? rawSteps.map(s => typeof s === 'string' ? s : (s?.text || s?.instruction || s?.step || String(s ?? ''))).filter(Boolean)
        : (typeof rawSteps === 'string' ? rawSteps.split('\n').filter(Boolean) : []);

      if (!copiedSteps.length) {
        showWizardNotice('Original recipe has no method steps to copy.', 'warning');
        return;
      }

      wizardState.activeRecipe.methodSteps = [...copiedSteps];
      safeRender({ syncInputs: false });
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Copied ${copiedSteps.length} method steps from original recipe.`);
      }
    };
  }

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
      const invalidQty = allIngs.filter(i => getIngredientQtyValidationIssue(i, prods, ings).invalid);
      if (unlinked.length > 0 || hasDomUnlinked) {
        const count = Math.max(unlinked.length, taxInputs.filter(inp => /new[\s_]*item/i.test(inp.dataset.taxVal || inp.value || '')).length, 1);
        showWizardNotice(`Cannot proceed: ${count} ingredient(s) retain an unlinked "✨ New Item" status. Please map each ingredient to a valid Category, Item, or Sub-Type.`, 'warning');
        updateStep2NextButtonState();
        return;
      }
      if (invalidQty.length > 0) {
        showWizardNotice(`Cannot proceed: ${invalidQty.length} ingredient(s) are measured in "qty" without a calculable single-item weight. Switch their unit to g/ml, set a single-item weight, or re-map them.`, 'warning');
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
