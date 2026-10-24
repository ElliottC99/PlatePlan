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
export function recalculateWizardMacros(recipeObj) {
  if (!recipeObj || typeof recipeObj !== 'object') return null;

  const state = (typeof window !== 'undefined' ? getState() : {}) || {};
  const globalProducts = Array.isArray(state.products) ? state.products : [];
  const globalIngredients = Array.isArray(state.rootItems) ? state.rootItems : (Array.isArray(state.ingredients) ? state.ingredients : []);

  const productMap = new Map();
  globalProducts.forEach(p => { if (p?.id) productMap.set(String(p.id), p); });

  const ingredientMap = new Map();
  globalIngredients.forEach(i => { if (i?.id) ingredientMap.set(String(i.id), i); });

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
    let matchedSource = null;

    if (item.productId && productMap.has(String(item.productId))) {
      matchedSource = productMap.get(String(item.productId));
    }
    if (!matchedSource && item.ingredientId) {
      const ing = ingredientMap.get(String(item.ingredientId));
      if (ing) {
        if (item.subtypeId && Array.isArray(ing.subtypes)) {
          const sub = ing.subtypes.find(s => String(s.id) === String(item.subtypeId));
          if (sub?.defaultProduct && productMap.has(String(sub.defaultProduct))) {
            matchedSource = productMap.get(String(sub.defaultProduct));
          }
        }
        if (!matchedSource && ing.defaultProduct && productMap.has(String(ing.defaultProduct))) {
          matchedSource = productMap.get(String(ing.defaultProduct));
        }
        if (!matchedSource) {
          matchedSource = globalProducts.find(p => String(p.ingredientId) === String(item.ingredientId) && p.isAutoDefault) 
                       || globalProducts.find(p => String(p.ingredientId) === String(item.ingredientId));
        }
      }
    }
    if (!matchedSource && (item.categoryId || item.isCategoryDefault)) {
      const catName = String(item.categoryId || '').toLowerCase();
      matchedSource = globalProducts.find(p => (String(p.category || p.cat || '').toLowerCase() === catName) && p.isAutoDefault) ||
                      globalProducts.find(p => String(p.category || p.cat || '').toLowerCase() === catName);
    }
    if (!matchedSource && item.name) {
      const qName = String(item.name).toLowerCase().trim();
      matchedSource = globalProducts.find(p => String(p.name || '').toLowerCase().includes(qName)) ||
                      globalIngredients.find(i => String(i.name || '').toLowerCase().includes(qName));
    }

    if (matchedSource) {
      const qty = Number(item.scaledQty ?? item.qty ?? item.amount ?? 1) || 1;
      const unit = item.unit || 'g';
      const nut = calcFn(matchedSource, qty, unit);
      totalCal += (nut.kcal ?? nut.cal ?? 0);
      totalProt += (nut.protein ?? nut.prot ?? 0);
      totalCarb += (nut.carbs ?? nut.carb ?? 0);
      totalFat += (nut.fat ?? 0);
    }
  });

  const serves = Number(recipeObj.servings || recipeObj.serves || recipeObj.targetServings || 2) || 2;
  const perServing = {
    calories: Math.round(totalCal / serves),
    protein: Math.round((totalProt / serves) * 10) / 10,
    carbs: Math.round((totalCarb / serves) * 10) / 10,
    fat: Math.round((totalFat / serves) * 10) / 10
  };

  recipeObj.macros = perServing;
  recipeObj.nutrition = {
    calories: perServing.calories,
    protein: perServing.protein,
    carbs: perServing.carbs,
    fat: perServing.fat
  };

  return perServing;
}

/**
 * Handle queue transition to the next recipe dish, enforcing live macro calculation.
 */
export function onNextDish(modalWrap, { loadNextRecipeFromQueue, renderWizardModal }) {
  if (wizardState.activeRecipe) {
    recalculateWizardMacros(wizardState.activeRecipe);
  }
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
  const servingsInput = document.getElementById('wiz-rev-servings') || modalWrap.querySelector('#wiz-rev-servings');

  const safeTitle = toTitleCase(titleInput?.value || rec.title || 'Untitled');
  const safeServings = parseInt(servingsInput?.value, 10) || rec.targetServings || rec.servings || 2;

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
}
