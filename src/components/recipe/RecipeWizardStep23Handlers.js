/**
 * src/components/recipe/RecipeWizardStep23Handlers.js (v3.32.0)
 * Event bindings for Wizard Step 2 (Mapping) and Step 3 (Review & Queue Navigation).
 */

import { wizardState, syncStep2InputsToState, syncStep3InputsToState, getSaveButtonLabel, hasDistinctEnhancedVariant } from './RecipeWizardState.js';
import { bindTaxonomyAutocompleteEvents } from './RecipeWizardTaxonomySearch.js';
import { promptRecipeWizardAliases } from './RecipeWizardAliasesPrompt.js';
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

export function bindStep23Events(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard }) {
  if (!modalWrap) return;

  // Step 2 Events
  if (wizardState.currentStep === 2) {
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

  // Step 3 Events
  if (wizardState.currentStep === 3) {
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
        syncStep3InputsToState(modalWrap);
        const rec = wizardState.activeRecipe;
        const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients);
        const unlinked = allIngredients.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
        if (unlinked.length > 0) {
          showWizardNotice(`Cannot save recipe: ${unlinked.length} ingredient(s) retain an unlinked "✨ New Item" status. Please map all ingredients to a valid Category, Item, or Sub-Type before saving.`, 'warning');
          return;
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';

        const recipeToSave = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `recipe_${Date.now()}`,
          name: rec.title,
          title: rec.title,
          servings: rec.targetServings,
          serves: rec.targetServings,
          prepTime: rec.prepTime,
          cookTime: rec.cookTime,
          time: (rec.prepTime.hours * 60 + rec.prepTime.minutes) + (rec.cookTime.hours * 60 + rec.cookTime.minutes),
          mealSuitability: rec.mealSuitability,
          ingredientSections: rec.ingredientSections,
          ingredients: allIngredients.map(i => ({
            name: i.name,
            qty: i.scaledQty || i.qty,
            unit: i.unit,
            raw: i.raw,
            ingredientId: i.ingredientId || null,
            subtypeId: i.subtypeId || null,
            categoryId: i.categoryId || null,
            isCategoryDefault: i.isCategoryDefault || false,
            displayName: i.displayName || null,
            waterMl: i.waterMl || null,
            isNewTaxonomyItem: !!i.isNewTaxonomyItem
          })),
          instructions: rec.methodSteps,
          method: rec.methodSteps,
          macros: rec.macros,
          createdAt: new Date().toISOString()
        };

        if (hasDistinctEnhancedVariant(rec)) {
          recipeToSave.enhanced = rec.enhanced;
        }

        try {
          await saveRecipe(recipeToSave);

          for (const ing of allIngredients) {
            if (ing.ingredientId && ing.raw) {
              await learnIngredientAlias(ing.ingredientId, ing.raw);
            }
          }

          // Queue Navigation in Step 3 / Final Review
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
}
