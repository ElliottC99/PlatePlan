/**
 * src/components/recipe/RecipeWizardStep3Handlers.js (v3.34.0)
 * Event bindings for Wizard Step 3: Variant Switching, Saving & Queue Navigation.
 * Includes live macro recalculation and dual-key state synchronization.
 */

import { wizardState, syncStep3InputsToState, getSaveButtonLabel, hasDistinctEnhancedVariant } from './RecipeWizardState.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { getState, updateRecipeInStore, learnIngredientAlias } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { calculateItemNutrition } from '../../services/NutritionService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Synchronous live macro recalculation for recipe objects in the wizard.
 * Resolves ingredient references against global product and ingredient catalogs.
 * @param {Object} recipeObj 
 * @returns {Object} Per-serving macro totals
 */
export function resolveProductForIngredient(item, { products = [], ingredients = [] } = {}) {
  if (!item || typeof item !== 'object') return null;

  // 1. Direct product ID
  const directId = item.productId || item.bankId || item.mappedItemId || item.productMatch?.id;
  if (directId) {
    const prod = products.find(p => String(p.id) === String(directId));
    if (prod) return prod;
  }

  // 2. Subtype mapping
  if (item.subtypeId) {
    if (item.ingredientId) {
      const parentIng = ingredients.find(i => String(i.id) === String(item.ingredientId));
      if (parentIng && Array.isArray(parentIng.subtypes)) {
        const sub = parentIng.subtypes.find(s => String(s.id) === String(item.subtypeId));
        const subDefId = sub?.defaultProductId || sub?.defaultProduct;
        if (subDefId) {
          const prod = products.find(p => String(p.id) === String(subDefId));
          if (prod) return prod;
        }
      }
    }
    const subAuto = products.find(p => String(p.subtypeId) === String(item.subtypeId) && p.isAutoDefault);
    if (subAuto) return subAuto;
    const subAny = products.find(p => String(p.subtypeId) === String(item.subtypeId));
    if (subAny) return subAny;
  }

  // 3. Root item mapping
  if (item.ingredientId) {
    const parentIng = ingredients.find(i => String(i.id) === String(item.ingredientId));
    const ingDefId = parentIng?.defaultProductId || parentIng?.defaultProduct;
    if (ingDefId) {
      const prod = products.find(p => String(p.id) === String(ingDefId));
      if (prod) return prod;
    }
    const ingAuto = products.find(p => String(p.ingredientId) === String(item.ingredientId) && p.isAutoDefault);
    if (ingAuto) return ingAuto;
    const ingAny = products.find(p => String(p.ingredientId) === String(item.ingredientId));
    if (ingAny) return ingAny;
  }

  // 4. Category mapping
  if (item.categoryId || item.isCategoryDefault) {
    const catName = String(item.categoryId || '').toLowerCase();
    const catAuto = products.find(p => (String(p.category || p.cat || '').toLowerCase() === catName) && p.isAutoDefault);
    if (catAuto) return catAuto;
    const catAny = products.find(p => (String(p.category || p.cat || '').toLowerCase() === catName));
    if (catAny) return catAny;
  }

  // 5. Name matching (exact or partial)
  const rawSearchName = String(item.matchedName || item.name || '').trim().toLowerCase();
  if (rawSearchName) {
    const exactProd = products.find(p => String(p.name || '').trim().toLowerCase() === rawSearchName);
    if (exactProd) return exactProd;

    const partialProd = products.find(p => {
      const pName = String(p.name || '').trim().toLowerCase();
      return pName && (pName.includes(rawSearchName) || rawSearchName.includes(pName));
    });
    if (partialProd) return partialProd;

    const matchedIng = ingredients.find(i => String(i.name || '').trim().toLowerCase() === rawSearchName);
    if (matchedIng) {
      const defId = matchedIng.defaultProductId || matchedIng.defaultProduct;
      if (defId) {
        const prod = products.find(p => String(p.id) === String(defId));
        if (prod) return prod;
      }
      const pAuto = products.find(p => String(p.ingredientId) === String(matchedIng.id) && p.isAutoDefault);
      if (pAuto) return pAuto;
      const pAny = products.find(p => String(p.ingredientId) === String(matchedIng.id));
      if (pAny) return pAny;
    }
  }

  return null;
}

export function recalculateWizardMacros(recipeObj) {
  if (!recipeObj || typeof recipeObj !== 'object') return null;

  const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' && typeof window.getState === 'function' ? window.getState() : {})) || {};
  const globalProducts = Array.isArray(state.products) ? state.products : [];
  const globalIngredients = Array.isArray(state.rootItems) 
    ? state.rootItems 
    : (Array.isArray(state.ingredients) ? state.ingredients : []);

  const allIngredients = (recipeObj.ingredientSections && recipeObj.ingredientSections.length > 0)
    ? recipeObj.ingredientSections.flatMap(s => s.ingredients || [])
    : (Array.isArray(recipeObj.ingredients) ? recipeObj.ingredients : []);

  const calcFn = (typeof window !== 'undefined' && window.NutritionService?.calculateItemNutrition)
    ? window.NutritionService.calculateItemNutrition
    : calculateItemNutrition;

  let totalCal = 0;
  let totalProt = 0;
  let totalCarb = 0;
  let totalFat = 0;

  allIngredients.forEach(item => {
    if (!item || item.excludeNutrition) return;
    const matchedProduct = resolveProductForIngredient(item, {
      products: globalProducts,
      ingredients: globalIngredients
    });

    if (matchedProduct) {
      const qty = Number(item.scaledQty ?? item.qty ?? item.amount ?? 1) || 1;
      const unit = item.unit || 'g';
      const nut = calcFn(matchedProduct, qty, unit);
      totalCal += (nut.kcal ?? nut.cal ?? 0);
      totalProt += (nut.protein ?? nut.prot ?? 0);
      totalCarb += (nut.carbs ?? nut.carb ?? 0);
      totalFat += (nut.fat ?? 0);
    }
  });

  const serves = Number(recipeObj.targetServings || recipeObj.servings || recipeObj.serves || 4) || 4;
  const perServing = {
    calories: Math.round(totalCal / serves),
    protein: Math.round((totalProt / serves) * 10) / 10,
    carbs: Math.round((totalCarb / serves) * 10) / 10,
    fat: Math.round((totalFat / serves) * 10) / 10
  };

  recipeObj.macros = perServing;
  recipeObj.calories = perServing.calories;
  recipeObj.protein = perServing.protein;
  recipeObj.carbs = perServing.carbs;
  recipeObj.fat = perServing.fat;
  recipeObj.perServing = { ...perServing, cal: perServing.calories, prot: perServing.protein };
  recipeObj.nutrition = {
    ...perServing,
    cal: perServing.calories,
    prot: perServing.protein,
    perServing: { ...perServing, cal: perServing.calories, prot: perServing.protein }
  };

  const targetMealType = recipeObj.mealSuitability?.[0] || recipeObj.types?.[0] || recipeObj.type || 'dinner';
  const fitResult = calculateMealFitScore(recipeObj, targetMealType);
  if (fitResult && typeof fitResult.score === 'number') {
    recipeObj.fitScore = fitResult.score;
    recipeObj.fitTier = fitResult.tier;
    recipeObj._computedFitScore = fitResult.score;
  }

  return perServing;
}

/**
 * Handle queue transition to the next recipe dish, enforcing live macro calculation.
 */
export function onNextDish(modalWrap, { loadNextRecipeFromQueue, renderWizardModal }) {
  if (wizardState.activeRecipe) {
    recalculateWizardMacros(wizardState.activeRecipe);
  }
  delete wizardState.targetServings;
  loadNextRecipeFromQueue();
  wizardState.currentStep = 2;
  renderWizardModal();
}

/**
 * Handle recipe saving with DOM input extraction, dynamic formatting, live macros, and Store dispatch.
 */
export async function onSaveRecipe(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard }) {
  syncStep3InputsToState(modalWrap);
  const rec = wizardState.activeRecipe;
  const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients);
  const unlinked = allIngredients.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
  
  if (unlinked.length > 0) {
    showWizardNotice(`Cannot save recipe: ${unlinked.length} ingredient(s) retain an unlinked "✨ New Item" status. Please map all ingredients to a valid Category, Item, or Sub-Type before saving.`, 'warning');
    return;
  }

  const btnSave = modalWrap.querySelector('#btn-save-wizard-recipe');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';
  }

  // Read verified v3.34.0 DOM selectors
  const titleInput = document.getElementById('wiz-rev-title') || modalWrap.querySelector('#wiz-rev-title');
  const servingsInput = document.getElementById('tp-serving-size') || document.getElementById('wiz-rev-servings') || modalWrap.querySelector('#tp-serving-size') || modalWrap.querySelector('#wiz-rev-servings');

  const safeTitle = toTitleCase(titleInput?.value || rec.title || 'Untitled');
  const safeServings = parseInt(servingsInput?.value, 10) || rec.targetServings || rec.servings || 4;

  rec.title = safeTitle;
  rec.name = safeTitle;
  rec.targetServings = safeServings;
  rec.servings = safeServings;
  rec.serves = safeServings;

  rec.ingredients = allIngredients.map(i => {
    const resolvedId = i.productId || i.bankId || i.mappedItemId || i.productMatch?.id || i.ingredientId || null;
    return { 
      ...i, 
      productId: resolvedId, 
      bankId: resolvedId, 
      ingredientId: resolvedId 
    };
  });
  rec.types = (rec.mealSuitability && rec.mealSuitability.length > 0) ? rec.mealSuitability.map(t => t.toLowerCase()) : ['dinner'];
  rec.mealType = rec.types[0];

  // Force live macro recalculation
  recalculateWizardMacros(rec);

  // Force strict sync between nutrition keys
  const finalMacros = (rec.nutrition && rec.nutrition.calories > (rec.macros?.calories || 0)) ? rec.nutrition : rec.macros;
  rec.macros = finalMacros;
  rec.nutrition = finalMacros;

  let finalComputedScore = rec.fitScore || 0;
  const targetMealType = rec.types?.[0] || rec.type || 'dinner';
  if (typeof window.calculateMealFitScore === 'function') {
    const fitData = window.calculateMealFitScore(rec, targetMealType);
    if (fitData && typeof fitData.score === 'number') finalComputedScore = fitData.score;
  }
  rec.fitScore = finalComputedScore;
  rec._computedFitScore = finalComputedScore;

  const recipeToSave = {
    id: rec.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `recipe_${Date.now()}`),
    name: safeTitle,
    title: safeTitle,
    servings: safeServings,
    serves: safeServings,
    targetServings: safeServings,
    prepTime: rec.prepTime,
    cookTime: rec.cookTime,
    time: (rec.prepTime.hours * 60 + rec.prepTime.minutes) + (rec.cookTime.hours * 60 + rec.cookTime.minutes),
    mealSuitability: rec.mealSuitability,
    types: rec.types,
    mealType: rec.mealType,
    ingredientSections: rec.ingredientSections,
    ingredients: rec.ingredients.map(i => ({
      name: i.name,
      qty: i.scaledQty || i.qty,
      unit: i.unit,
      raw: i.raw,
      ingredientId: i.ingredientId,
      productId: i.productId,
      bankId: i.bankId,
      subtypeId: i.subtypeId || null,
      categoryId: i.categoryId || null,
      isCategoryDefault: i.isCategoryDefault || false,
      displayName: i.displayName || null,
      waterMl: i.waterMl || null,
      isNewTaxonomyItem: !!i.isNewTaxonomyItem
    })),
    instructions: rec.methodSteps,
    method: rec.methodSteps,
    macros: {
      calories: finalMacros.calories || finalMacros.cal || 0,
      protein: finalMacros.protein || finalMacros.prot || 0,
      carbs: finalMacros.carbs || 0,
      fat: finalMacros.fat || 0
    },
    nutrition: {
      perServing: {
        calories: finalMacros.calories || finalMacros.cal || 0,
        protein: finalMacros.protein || finalMacros.prot || 0,
        carbs: finalMacros.carbs || 0,
        fat: finalMacros.fat || 0
      },
      calories: finalMacros.calories || finalMacros.cal || 0,
      protein: finalMacros.protein || finalMacros.prot || 0,
      carbs: finalMacros.carbs || 0,
      fat: finalMacros.fat || 0
    },
    fitScore: finalComputedScore,
    _computedFitScore: finalComputedScore,
    createdAt: rec.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (hasDistinctEnhancedVariant(rec) && rec.enhanced) {
    recalculateWizardMacros(rec.enhanced);
    const finalEnhMacros = (rec.enhanced.nutrition && rec.enhanced.nutrition.calories > (rec.enhanced.macros?.calories || 0)) ? rec.enhanced.nutrition : rec.enhanced.macros;
    rec.enhanced.macros = finalEnhMacros;
    rec.enhanced.nutrition = finalEnhMacros;
    recipeToSave.enhanced = rec.enhanced;
  }

  try {
    await saveRecipe(recipeToSave);
    updateRecipeInStore(recipeToSave);

    for (const ing of allIngredients) {
      if (ing.ingredientId && ing.raw) {
        await learnIngredientAlias(ing.ingredientId, ing.raw);
      }
    }

    if (wizardState.processingQueue.length > 0) {
      const nextDishTitle = wizardState.processingQueue[0]?.title || 'Next Recipe';
      const actionContainer = btnSave ? btnSave.parentElement : modalWrap;
      const banner = document.createElement('div');
      banner.id = 'wiz-queue-saved-banner';
      banner.style.cssText = 'background: #ecfdf5; border: 1px solid #10b981; border-radius: 10px; padding: 14px 18px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;';
      banner.innerHTML = `
        <div style="font-size: 13.5px; font-weight: 600; color: #065f46;">
          ✅ Recipe saved! Remaining in queue: <strong>${wizardState.processingQueue.length}</strong>
        </div>
        <button type="button" id="btn-wiz-map-next-recipe" class="btn primary sm" style="font-weight: 600; cursor: pointer;">
          Map Next Recipe (${escapeHtml(nextDishTitle)}) →
        </button>
      `;
      actionContainer.replaceChildren(banner);

      const mapNextBtn = banner.querySelector('#btn-wiz-map-next-recipe');
      if (mapNextBtn) {
        mapNextBtn.onclick = () => onNextDish(modalWrap, { loadNextRecipeFromQueue, renderWizardModal });
      }
    } else {
      closeRecipeWizard();
      if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Recipe "${safeTitle}" saved successfully!`, 'success');
      }
    }
  } catch (e) {
    console.error('[RecipeWizard] Error saving recipe:', e);
    showWizardNotice(`Error saving recipe: ${e.message}`, 'error');
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = `💾 ${getSaveButtonLabel(rec)}`;
    }
  }
}

export function bindStep3Events(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard }) {
  if (!modalWrap || wizardState.currentStep !== 3) return;

  const tabOrig = modalWrap.querySelector('#wiz-tab-original');
  if (tabOrig) {
    tabOrig.onclick = () => {
      syncStep3InputsToState(modalWrap);
      wizardState.activeVariant = 'original';
      renderWizardModal();
    };
  }

  const tabEnh = modalWrap.querySelector('#wiz-tab-enhanced');
  if (tabEnh) {
    tabEnh.onclick = () => {
      syncStep3InputsToState(modalWrap);
      wizardState.activeVariant = 'enhanced';
      if (!wizardState.activeRecipe.enhanced) {
        wizardState.activeRecipe.enhanced = {
          title: `${wizardState.activeRecipe.title} (Enhanced)`,
          ingredientSections: JSON.parse(JSON.stringify(wizardState.activeRecipe.ingredientSections || [])),
          ingredients: JSON.parse(JSON.stringify(wizardState.activeRecipe.ingredients || [])),
          methodSteps: [...(wizardState.activeRecipe.methodSteps || [])],
          macros: { ...(wizardState.activeRecipe.macros || { calories: 500, protein: 35, carbs: 42, fat: 16 }) }
        };
      }
      renderWizardModal();
    };
  }

  const btnSave = modalWrap.querySelector('#btn-save-wizard-recipe');
  if (btnSave) {
    btnSave.onclick = () => onSaveRecipe(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard });
  }

  const servInput = modalWrap.querySelector('#wiz-rev-servings') || modalWrap.querySelector('#tp-serving-size');
  if (servInput) {
    servInput.onchange = () => {
      syncStep3InputsToState(modalWrap);
      recalculateWizardMacros(wizardState.activeRecipe);
      if (wizardState.activeRecipe.enhanced) {
        recalculateWizardMacros(wizardState.activeRecipe.enhanced);
      }
      renderWizardModal();
    };
  }
}
