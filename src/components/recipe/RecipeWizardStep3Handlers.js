/**
 * src/components/recipe/RecipeWizardStep3Handlers.js (v3.32.1)
 * Event bindings for Wizard Step 3: Variant Switching, Saving & Queue Navigation.
 */

import { wizardState, syncStep3InputsToState, getSaveButtonLabel, hasDistinctEnhancedVariant } from './RecipeWizardState.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { learnIngredientAlias, getState } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import * as NutritionService from '../../services/NutritionService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';

function recalculateWizardMacros(recipeObj) {
  if (!recipeObj) return;
  const targetServings = Number(recipeObj.servings || recipeObj.targetServings || 2);
  const storeState = getState() || {};
  const products = storeState.products || [];
  const allIngredients = (recipeObj.ingredientSections || []).flatMap(s => s.ingredients || []);
  const nutritionList = allIngredients.map(ing => {
    const prodId = ing.productId || ing.mappedItemId || ing.productMatch?.id;
    const product = prodId ? products.find(p => String(p.id) === String(prodId)) : null;
    if (!product) return { kcal: 0, prot: 0, carb: 0, fat: 0 };
    return NutritionService.calculateItemNutrition(product, ing.scaledQty || ing.qty, ing.unit);
  });
  const rolled = NutritionService.rollupNutritionTotals(nutritionList, targetServings);
  recipeObj.macros = {
    calories: Math.round(rolled.perServing?.cal || rolled.perServing?.kcal || 0),
    protein: Math.round((rolled.perServing?.prot || rolled.perServing?.protein || 0) * 10) / 10,
    carbs: Math.round((rolled.perServing?.carb || rolled.perServing?.carbs || 0) * 10) / 10,
    fat: Math.round((rolled.perServing?.fat || 0) * 10) / 10
  };
  recipeObj._computedFitScore = calculateMealFitScore(recipeObj, recipeObj.mealSuitability?.[0] || 'dinner').score;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
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
    btnSave.onclick = async () => {
      const rec = wizardState.activeRecipe;
      recalculateWizardMacros(rec);

      const uiTitleInput = document.getElementById('wiz-rev-title');
      const uiServingsInput = document.getElementById('tp-serving-size');

      const safeTitle = toTitleCase(uiTitleInput?.value || rec.title || rec.name || 'Untitled Recipe');
      const safeServings = parseInt(uiServingsInput?.value, 10) || rec.servings || rec.serves || 2;

      const recipeToSave = {
        ...rec,
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `recipe_${Date.now()}`,
        name: safeTitle,
        title: safeTitle,
        servings: safeServings,
        serves: safeServings,
        macros: rec.macros,
        _computedFitScore: rec._computedFitScore || calculateMealFitScore(rec, rec.mealSuitability?.[0] || 'dinner').score,
        ingredientSections: rec.ingredientSections.map(s => ({
          ...s,
          sectionTitle: toTitleCase(s.sectionTitle)
        })),
        ingredients: (rec.ingredientSections || []).flatMap(s => s.ingredients.map(i => ({
          ...i,
          productId: i.productId || i.mappedItemId || i.productMatch?.id || null
        }))),
        instructions: rec.methodSteps,
        method: rec.methodSteps,
        createdAt: new Date().toISOString()
      };

      if (hasDistinctEnhancedVariant(rec)) {
        recipeToSave.enhanced = rec.enhanced;
      }

      const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients);
      try {
        await saveRecipe(recipeToSave);

        for (const ing of allIngredients) {
          if (ing.ingredientId && ing.raw) {
            await learnIngredientAlias(ing.ingredientId, ing.raw);
          }
        }

        if (wizardState.processingQueue.length > 0) {
          const nextDishTitle = wizardState.processingQueue[0]?.title || 'Next Recipe';
          const actionContainer = btnSave.parentElement || modalWrap;
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
            mapNextBtn.onclick = () => {
              loadNextRecipeFromQueue();
              wizardState.currentStep = 2;
              renderWizardModal();
            };
          }
        } else {
          closeRecipeWizard();
          if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Recipe "${rec.title}" saved successfully!`, 'success');
          }
        }
      } catch (e) {
        console.error('[RecipeWizard] Error saving recipe:', e);
        showWizardNotice(`Error saving recipe: ${e.message}`, 'error');
        btnSave.disabled = false;
        btnSave.textContent = `💾 ${getSaveButtonLabel(rec)}`;
      }
    };
  }
}
