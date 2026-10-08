/**
 * src/components/recipe/RecipeWizardModal.js (v3.28.0)
 * Controller Module for Multi-Step Ingestion & Recipe Creation Wizard Modal.
 * Integrates:
 * - State 0: Choice (Manual vs Bulk)
 * - State 1: Ingestion & Input (Timings, Strict Meal Suitability Tags)
 * - State 2: Sections, Scaled Quantities & Searchable Taxonomy Autocomplete Mapping
 * - State 3: Final Inline Review with Macro Crossbar, Variant Switcher & Dynamic Persistence
 */

import { parseIngredientString, matchIngredientTaxonomy, parseBulkRecipeText, toTitleCase } from '../../services/RecipeImporter.js';
import { getState, learnIngredientAlias } from '../../store/store.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { wizardState, resetWizardState, syncStep2InputsToState, syncStep3InputsToState, MEAL_TAGS, getSaveButtonLabel, hasDistinctEnhancedVariant } from './RecipeWizardState.js';
import { renderStepBadge, renderState0Choice, renderState1AManual, renderState1BBulk, renderState2Mapping, renderState3Review } from './RecipeWizardViews.js';
import { bindTaxonomyAutocompleteEvents } from './RecipeWizardTaxonomySearch.js';

export function openRecipeWizard(initialMode = 'manual') {
  resetWizardState();
  if (initialMode === 'bulk' || initialMode === 'parse') {
    wizardState.choice = 'bulk';
    wizardState.currentStep = 1;
  } else if (initialMode === 'manual') {
    wizardState.choice = 'manual';
    wizardState.currentStep = 1;
  } else {
    wizardState.currentStep = 0;
  }

  ensureModalDOM();
  renderWizardModal();
}

export function closeRecipeWizard() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (modalWrap) {
    modalWrap.classList.remove('open');
  }
}

function ensureModalDOM() {
  let modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) {
    modalWrap = document.createElement('div');
    modalWrap.id = 'recipe-wizard-modal-wrap';
    modalWrap.className = 'modal-wrap';
    modalWrap.style.zIndex = '500';
    document.body.appendChild(modalWrap);
  }
  modalWrap.classList.add('open');
}

export function renderWizardModal() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) return;

  let bodyContent = '';

  if (wizardState.currentStep === 0) {
    bodyContent = renderState0Choice();
  } else if (wizardState.currentStep === 1) {
    bodyContent = wizardState.choice === 'bulk' ? renderState1BBulk() : renderState1AManual();
  } else if (wizardState.currentStep === 2) {
    bodyContent = renderState2Mapping();
  } else if (wizardState.currentStep === 3) {
    bodyContent = renderState3Review();
  }

  modalWrap.innerHTML = `
    <div class="modal-backdrop" onclick="closeRecipeWizard()"></div>
    <div class="modal" style="max-width: 920px; width: 94%; max-height: 92vh; display: flex; flex-direction: column; padding: 24px; background: var(--surface, #fff); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.25);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border, #eee); padding-bottom: 14px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text, #111);">Recipe Wizard</h2>
          ${renderStepBadge()}
        </div>
        <button type="button" class="btn sm ghost" onclick="closeRecipeWizard()" aria-label="Close Wizard">✕</button>
      </div>
      <div id="wizard-modal-body" style="flex: 1; overflow-y: auto; padding-right: 4px;">
        ${bodyContent}
      </div>
    </div>
  `;

  bindWizardEvents();
}

function bindWizardEvents() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) return;

  // Choice buttons
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

  // Meal tag toggles in Step 1A
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

  // Step 1A -> Next
  const btnNext1A = modalWrap.querySelector('#btn-next-step1a');
  if (btnNext1A) {
    btnNext1A.onclick = () => {
      const rawTitle = modalWrap.querySelector('#wiz-title')?.value.trim() || 'Untitled Recipe';
      const title = toTitleCase(rawTitle);
      const curServ = parseInt(modalWrap.querySelector('#wiz-current-servings')?.value, 10) || 4;
      const tgtServ = parseInt(modalWrap.querySelector('#wiz-target-servings')?.value, 10) || 4;
      const prepH = parseInt(modalWrap.querySelector('#wiz-prep-hours')?.value, 10) || 0;
      const prepM = parseInt(modalWrap.querySelector('#wiz-prep-mins')?.value, 10) || 0;
      const cookH = parseInt(modalWrap.querySelector('#wiz-cook-hours')?.value, 10) || 0;
      const cookM = parseInt(modalWrap.querySelector('#wiz-cook-mins')?.value, 10) || 0;
      const ingRaw = modalWrap.querySelector('#wiz-ingredients-raw')?.value.trim() || '';
      const metRaw = modalWrap.querySelector('#wiz-method-raw')?.value.trim() || '';

      const rawSections = parseSectionedIngredients(ingRaw);
      const storeState = getState() || {};
      const ingredientsBank = storeState.ingredients || [];

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
      wizardState.activeRecipe.currentServings = curServ;
      wizardState.activeRecipe.targetServings = tgtServ;
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

  // Step 1B -> Next
  const btnNext1B = modalWrap.querySelector('#btn-next-step1b');
  if (btnNext1B) {
    btnNext1B.onclick = () => {
      const text = modalWrap.querySelector('#wiz-bulk-text')?.value.trim() || '';
      wizardState.bulkText = text;
      if (!text) {
        alert('Please paste recipe text before proceeding.');
        return;
      }

      const storeState = getState() || {};
      const ingredientsBank = storeState.ingredients || [];
      const parsedRecipes = parseBulkRecipeText(text, ingredientsBank);

      if (!parsedRecipes.length) {
        alert('Could not detect any valid recipes in text. Please check format.');
        return;
      }

      wizardState.processingQueue = parsedRecipes;
      wizardState.currentQueueTotal = parsedRecipes.length;
      loadNextRecipeFromQueue();

      wizardState.currentStep = 2;
      renderWizardModal();
    };
  }

  // Step 2 Events
  if (wizardState.currentStep === 2) {
    // Add section header
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

    // Add ingredient line to section
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

    // Delete section header
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

    // Delete ingredient item
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

    // Add step button
    const btnAddStep = modalWrap.querySelector('#wiz-add-step-btn');
    if (btnAddStep) {
      btnAddStep.onclick = () => {
        syncStep2InputsToState(modalWrap);
        wizardState.activeRecipe.methodSteps.push('New step instruction');
        renderWizardModal();
      };
    }

    // Delete step button
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

    // Bind Searchable Taxonomy Autocomplete
    bindTaxonomyAutocompleteEvents(modalWrap, (sIdx, iIdx, val) => {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) {
        if (!val || val === 'new_item') {
          item.ingredientId = null;
          item.subtypeId = null;
          item.isNewTaxonomyItem = true;
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
    });

    // Next to Step 3
    const btnNext2 = modalWrap.querySelector('#btn-next-step2');
    if (btnNext2) {
      btnNext2.onclick = () => {
        syncStep2InputsToState(modalWrap);
        wizardState.currentStep = 3;
        renderWizardModal();
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
          // Initialize enhanced variant with a copy
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
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';

        const rec = wizardState.activeRecipe;
        const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients);

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

          // Learn aliases for mapped items
          for (const ing of allIngredients) {
            if (ing.ingredientId && ing.raw) {
              await learnIngredientAlias(ing.ingredientId, ing.raw);
            }
          }

          if (wizardState.processingQueue.length > 0) {
            loadNextRecipeFromQueue();
            wizardState.currentStep = 2;
            renderWizardModal();
          } else {
            closeRecipeWizard();
            if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
              window.showPlatePlanToast(`Recipe "${rec.title}" saved successfully!`, 'success');
            }
          }
        } catch (e) {
          console.error('[RecipeWizard] Error saving recipe:', e);
          alert(`Error saving recipe: ${e.message}`);
          btnSave.disabled = false;
          btnSave.textContent = `💾 ${getSaveButtonLabel(rec)}`;
        }
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

function loadNextRecipeFromQueue() {
  if (!wizardState.processingQueue.length) return;
  const next = wizardState.processingQueue.shift();

  const ingRawText = (next.ingredientSections || []).map(sec => {
    const header = sec.sectionTitle && sec.sectionTitle !== 'Main Ingredients' ? `${sec.sectionTitle}:\n` : '';
    const items = sec.ingredients.map(i => i.raw || `${i.qty} ${i.unit} ${i.name}`).join('\n');
    return `${header}${items}`;
  }).join('\n\n');

  const methodRawText = (next.instructions || []).join('\n');

  wizardState.activeRecipe = {
    title: next.title || 'Imported Recipe',
    currentServings: next.servings || 4,
    targetServings: next.servings || 4,
    prepTime: next.prepTime || { hours: 0, minutes: 15 },
    cookTime: next.cookTime || { hours: 0, minutes: 30 },
    mealSuitability: next.mealSuitability || ['Dinner'],
    ingredientsRaw: ingRawText,
    methodRaw: methodRawText,
    ingredientSections: next.ingredientSections || [{ sectionTitle: 'Main Ingredients', ingredients: next.ingredients || [] }],
    methodSteps: next.instructions || [],
    macros: next.macros || { calories: 450, protein: 28, carbs: 40, fat: 16 }
  };
}

if (typeof window !== 'undefined') {
  window.openRecipeWizard = openRecipeWizard;
  window.closeRecipeWizard = closeRecipeWizard;
  window.goToWizardStep = function(step) {
    const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
    if (modalWrap && wizardState.currentStep === 2) {
      syncStep2InputsToState(modalWrap);
    }
    wizardState.currentStep = step;
    renderWizardModal();
  };
  window.openBulkRecipeImporterModal = () => openRecipeWizard('bulk');
  window.openRecipeEditor = () => openRecipeWizard('manual');
}
