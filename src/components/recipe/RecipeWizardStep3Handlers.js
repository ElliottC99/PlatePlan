/**
 * src/components/recipe/RecipeWizardStep3Handlers.js (v3.32.1)
 * Event bindings for Wizard Step 3: Variant Switching, Saving & Queue Navigation.
 */

import { wizardState, syncStep3InputsToState, getSaveButtonLabel, hasDistinctEnhancedVariant } from './RecipeWizardState.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { learnIngredientAlias } from '../../store/store.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function buildFinalRecipePayload(draftRecipe, activeState) {
  const cleanTitle = toTitleCase(document.getElementById('wiz-rev-title')?.value || draftRecipe.title || draftRecipe.name || 'Untitled Recipe');
  const cleanServes = parseInt(document.getElementById('wiz-rev-servings')?.value || draftRecipe.serves || draftRecipe.servings || 2, 10) || 2;
  
  return {
    ...draftRecipe,
    name: cleanTitle,
    title: cleanTitle,
    serves: cleanServes,
    servings: cleanServes,
    targetServings: cleanServes,
    macros: activeState.macros,
    _computedFitScore: activeState._computedFitScore || calculateMealFitScore(activeState, activeState.mealSuitability?.[0] || 'dinner'),
    ingredients: activeState.ingredients,
    ingredientSections: activeState.ingredientSections
  };
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
      const recipeToSave = buildFinalRecipePayload(wizardState.activeRecipe, wizardState.activeRecipe);

      const allIngredients = (recipeToSave.ingredientSections || []).flatMap(s => s.ingredients);
      const unlinked = allIngredients.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
      if (unlinked.length > 0) {
        showWizardNotice(`Cannot save recipe: ${unlinked.length} ingredient(s) retain an unlinked "✨ New Item" status. Please map all ingredients to a valid Category, Item, or Sub-Type before saving.`, 'warning');
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';

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
              // Capture final state of CURRENT recipe before loading next
              wizardState.processingQueue[wizardState.currentQueueIndex] = recipeToSave;
              loadNextRecipeFromQueue();
              wizardState.currentStep = 2;
              renderWizardModal();
            };
          }
        } else {
          closeRecipeWizard();
          if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Recipe "${recipeToSave.title}" saved successfully!`, 'success');
          }
        }
      } catch (e) {
        console.error('[RecipeWizard] Error saving recipe:', e);
        showWizardNotice(`Error saving recipe: ${e.message}`, 'error');
        btnSave.disabled = false;
        btnSave.textContent = `💾 ${getSaveButtonLabel(recipeToSave)}`;
      }
    };
  }
}
