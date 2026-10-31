/**
 * src/components/recipe/RecipeWizardStep1Handlers.js (v3.32.6)
 * Event bindings for Wizard Step 0, Step 1A (Manual), Step 1B (Bulk), and Step 1.5 (Queue Review).
 */

import { unpackAndSplitRecipeBlocks, parseSingleRecipeText } from '../../services/RecipeParserService.js';
import { parseIngredientString, matchIngredientTaxonomy } from '../../services/RecipeImporter.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { getState, updateState, reorderDraftRecipes } from '../../state/AppState.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { wizardState } from './RecipeWizardState.js';

export function bindStep01Events(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard }) {
  if (!modalWrap) return;

  // Step 0: Choice buttons
  const btnManual = modalWrap.querySelector('#btn-choice-manual');
  if (btnManual) {
    btnManual.onclick = () => {
      wizardState.choice = 'manual';
      wizardState.currentStep = 1;
      renderWizardModal();
    };
  }

  const btnBulk = modalWrap.querySelector('#btn-choice-bulk');
  if (btnBulk) {
    btnBulk.onclick = () => {
      wizardState.choice = 'bulk';
      wizardState.currentStep = 1;
      renderWizardModal();
    };
  }

  // Step 1A: Meal tag toggles
  modalWrap.querySelectorAll('.wiz-meal-tag').forEach(cb => {
    cb.onchange = () => {
      const selected = Array.from(modalWrap.querySelectorAll('.wiz-meal-tag:checked')).map(i => i.value);
      wizardState.activeRecipe.mealSuitability = selected.length ? selected : ['Dinner'];
      const parentLabel = cb.closest('label');
      if (parentLabel) {
        parentLabel.style.background = cb.checked ? 'var(--purple-bg, #eef2ff)' : 'var(--surface, #fff)';
        parentLabel.style.color = cb.checked ? 'var(--purple, #4f46e5)' : 'var(--text, #333)';
      }
    };
  });

  // Step 1A: Next
  const btnNext1A = modalWrap.querySelector('#btn-next-step1a');
  if (btnNext1A) {
    btnNext1A.onclick = () => {
      const rawTitle = modalWrap.querySelector('#wiz-title')?.value.trim() || 'Untitled Recipe';
      const title = toTitleCase(rawTitle);
      const serv = parseInt(modalWrap.querySelector('#wiz-servings')?.value, 10) || 4;
      const prepH = parseInt(modalWrap.querySelector('#wiz-prep-hours')?.value, 10) || 0;
      const prepM = parseInt(modalWrap.querySelector('#wiz-prep-mins')?.value, 10) || 0;
      const cookH = parseInt(modalWrap.querySelector('#wiz-cook-hours')?.value, 10) || 0;
      const cookM = parseInt(modalWrap.querySelector('#wiz-cook-mins')?.value, 10) || 0;
      const ingRaw = modalWrap.querySelector('#wiz-ingredients-raw')?.value.trim() || '';
      const metRaw = modalWrap.querySelector('#wiz-method-raw')?.value.trim() || '';

      const rawSections = parseSectionedIngredients(ingRaw);
      const storeState = getState();
      const ingredientsBank = storeState.rootItems || storeState.ingredients || [];

      const parsedSections = rawSections.map(sec => ({
        sectionTitle: toTitleCase(sec.sectionTitle),
        ingredients: sec.lines.map(line => {
          const parsed = parseIngredientString(line);
          const matched = matchIngredientTaxonomy(parsed, ingredientsBank);
          return {
            raw: line,
            qty: parsed.qty,
            scaledQty: parsed.qty,
            unit: parsed.unit,
            name: parsed.name,
            notes: parsed.notes,
            isFallbackWeight: parsed.isFallbackWeight,
            ingredientId: matched?.ingredientId || null,
            subtypeId: matched?.subtypeId || null,
            isNewTaxonomyItem: !matched
          };
        })
      }));

      const methodSteps = metRaw.split('\n')
        .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);

      wizardState.activeRecipe.title = title;
      wizardState.activeRecipe.servings = serv;
      wizardState.activeRecipe.serves = serv;
      wizardState.activeRecipe.prepTime = { hours: prepH, minutes: prepM };
      wizardState.activeRecipe.cookTime = { hours: cookH, minutes: cookM };
      wizardState.activeRecipe.ingredientsRaw = ingRaw;
      wizardState.activeRecipe.methodRaw = metRaw;
      wizardState.activeRecipe.ingredientSections = parsedSections.length ? parsedSections : [{ sectionTitle: 'Main Ingredients', ingredients: [] }];
      wizardState.activeRecipe.methodSteps = methodSteps;

      wizardState.currentStep = 2;
      renderWizardModal();
    };
  }

  // Step 1B: Parse Button
  const btnNext1B = modalWrap.querySelector('#btn-next-step1b');
  if (btnNext1B) {
    btnNext1B.onclick = () => {
      const text = modalWrap.querySelector('#wiz-bulk-text')?.value.trim() || '';
      wizardState.bulkText = text;
      if (!text) {
        showWizardNotice('Please paste recipe text before proceeding.', 'warning');
        return;
      }

      const storeState = getState();
      const ingredientsBank = storeState.rootItems || storeState.ingredients || [];
      const blocks = unpackAndSplitRecipeBlocks(text);
      const parsedRecipes = blocks.map(b => parseSingleRecipeText(b, ingredientsBank)).filter(r => r && (r.title || (r.ingredientSections && r.ingredientSections.length)));

      if (!parsedRecipes.length) {
        showWizardNotice('Could not detect any valid recipes in text. Please check format.', 'warning');
        return;
      }

      wizardState.processingQueue = parsedRecipes;
      wizardState.currentQueueTotal = parsedRecipes.length;
      wizardState.currentQueueIndex = 0;
      updateState({ draftRecipes: parsedRecipes });

      if (parsedRecipes.length > 1) {
        wizardState.currentStep = 1.5;
      } else {
        loadNextRecipeFromQueue();
        wizardState.currentStep = 2;
      }
      renderWizardModal();
    };
  }

  // Step 1.5: Queue Review Events
  if (wizardState.currentStep === 1.5) {
    // Remove individual dish from queue
    modalWrap.querySelectorAll('.wiz-queue-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = parseInt(btn.dataset.qidx, 10);
        if (!isNaN(qIdx) && wizardState.processingQueue[qIdx]) {
          wizardState.processingQueue.splice(qIdx, 1);
          wizardState.currentQueueTotal = wizardState.processingQueue.length;
          updateState({ draftRecipes: [...wizardState.processingQueue] });
          renderWizardModal();
        }
      });
    });

    // Move Up
    modalWrap.querySelectorAll('.move-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          reorderDraftRecipes(idx, idx - 1);
          // Sync back to wizardState for internal logic
          wizardState.processingQueue = [...getState().draftRecipes];
          renderWizardModal();
        }
      });
    });

    // Move Down
    modalWrap.querySelectorAll('.move-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        const recipes = getState().draftRecipes || [];
        if (idx < recipes.length - 1) {
          reorderDraftRecipes(idx, idx + 1);
          // Sync back to wizardState for internal logic
          wizardState.processingQueue = [...getState().draftRecipes];
          renderWizardModal();
        }
      });
    });

    // Re-paste text
    const btnRepaste = modalWrap.querySelector('#btn-repaste-text');
    if (btnRepaste) {
      btnRepaste.onclick = () => {
        wizardState.currentStep = 1;
        renderWizardModal();
      };
    }

    // Import all directly
    const btnImportAll = modalWrap.querySelector('#btn-import-all-direct');
    if (btnImportAll) {
      btnImportAll.onclick = async () => {
        const recipes = [...wizardState.processingQueue];
        if (!recipes.length) return;

        btnImportAll.disabled = true;
        btnImportAll.textContent = 'Importing...';

        try {
          for (const rec of recipes) {
            const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients || []);
            const recipeToSave = {
              id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name: rec.title,
              title: rec.title,
              servings: rec.servings || 4,
              serves: rec.servings || 4,
              prepTime: rec.prepTime || { hours: 0, minutes: 15 },
              cookTime: rec.cookTime || { hours: 0, minutes: 30 },
              time: (rec.prepTime?.hours || 0) * 60 + (rec.prepTime?.minutes || 15) + (rec.cookTime?.hours || 0) * 60 + (rec.cookTime?.minutes || 30),
              mealSuitability: rec.mealSuitability || ['Dinner'],
              ingredientSections: rec.ingredientSections,
              ingredients: allIngredients.map(i => ({
                name: i.name,
                qty: i.qty || 1,
                unit: i.unit || 'qty',
                raw: i.raw || i.name,
                ingredientId: i.ingredientId || null,
                subtypeId: i.subtypeId || null,
                categoryId: i.categoryId || null,
                isCategoryDefault: i.isCategoryDefault || false,
                displayName: i.displayName || null,
                waterMl: i.waterMl || null,
                isNewTaxonomyItem: !!i.isNewTaxonomyItem
              })),
              instructions: rec.instructions || rec.methodSteps || [],
              method: rec.instructions || rec.methodSteps || [],
              macros: rec.macros || { calories: 450, protein: 28, carbs: 40, fat: 16 },
              createdAt: new Date().toISOString()
            };
            await saveRecipe(recipeToSave);
          }
          wizardState.processingQueue = [];
          closeRecipeWizard();
          if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Successfully imported ${recipes.length} recipes!`, 'success');
          }
        } catch (err) {
          console.error('[RecipeWizard] Error importing recipes directly:', err);
          showWizardNotice(`Failed to import all recipes: ${err.message}`, 'error');
          btnImportAll.disabled = false;
          btnImportAll.textContent = '⚡ Import All Recipes Directly';
        }
      };
    }

    // Start Step-by-Step Queue Review
    const btnStartReview = modalWrap.querySelector('#btn-start-queue-review');
    if (btnStartReview) {
      btnStartReview.onclick = () => {
        wizardState.initialQueueTotal = wizardState.processingQueue.length;
        wizardState.currentQueueIndex = 0;
        loadNextRecipeFromQueue();
        wizardState.currentStep = 2;
        renderWizardModal();
      };
    }
  }
}

function parseSectionedIngredients(rawText) {
  if (!rawText) return [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const sections = [];
  let currentSection = { sectionTitle: 'Main Ingredients', lines: [] };

  lines.forEach(line => {
    if (line.endsWith(':') || line.startsWith('#') || line.startsWith('For ')) {
      if (currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        sectionTitle: line.replace(/[:#]/g, '').trim(),
        lines: []
      };
    } else {
      currentSection.lines.push(line);
    }
  });

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}
