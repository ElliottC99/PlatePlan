/**
 * src/components/recipe/RecipeWizardModal.js (v3.32.1)
 * Controller Module for Multi-Step Ingestion & Recipe Creation Wizard Modal.
 * Integrates:
 * - State 0: Choice (Manual vs Bulk)
 * - State 1: Ingestion & Input (Timings, Meal Tags)
 * - State 1.5: Batch Queue Review (Pills, Trash Removal, Direct Bulk Import)
 * - State 2: Sections, Scaled Quantities & Searchable Taxonomy Autocomplete Mapping
 * - State 3: Final Inline Review with Macro Crossbar, Variant Switcher & Queue Navigation
 */

import { wizardState, resetWizardState, syncStep2InputsToState } from './RecipeWizardState.js';
import { renderStepBadge, renderState0Choice, renderState1AManual, renderState1BBulk, renderState3Review } from './RecipeWizardViews.js';
import { renderState2Mapping } from './RecipeWizardStep2View.js';
import { renderStep1Point5 } from './RecipeWizardStep15View.js';
import { bindStep01Events } from './RecipeWizardStep1Handlers.js';
import { bindStep2Events } from './RecipeWizardStep2Handlers.js';
import { bindStep3Events } from './RecipeWizardStep3Handlers.js';

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

export function showWizardNotice(msg, type = 'error') {
  if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(msg, type);
    return;
  }
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (modalWrap) {
    let banner = modalWrap.querySelector('.wiz-notice-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'wiz-notice-banner';
      banner.style.cssText = 'background:#fee2e2;color:#991b1b;padding:10px 14px;border-radius:8px;margin:12px 16px 0;font-size:14px;font-weight:500;border:1px solid #fca5a5;';
      const container = modalWrap.querySelector('.modal-card') || modalWrap;
      container.prepend(banner);
    }
    banner.textContent = msg;
    setTimeout(() => { if (banner && banner.parentNode) banner.remove(); }, 4000);
  }
}

export function loadNextRecipeFromQueue() {
  if (!wizardState.processingQueue.length) return;
  const next = wizardState.processingQueue.shift();

  const ingRawText = (next.ingredientSections || []).map(sec => {
    const header = sec.sectionTitle && sec.sectionTitle !== 'Main Ingredients' ? `${sec.sectionTitle}:\n` : '';
    const items = sec.ingredients.map(i => i.raw || `${i.qty} ${i.unit} ${i.name}`).join('\n');
    return `${header}${items}`;
  }).join('\n\n');

  const methodRawText = (next.instructions || next.methodSteps || []).join('\n');

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
    methodSteps: next.instructions || next.methodSteps || [],
    macros: next.macros || { calories: 450, protein: 28, carbs: 40, fat: 16 }
  };
}

export function renderWizardModal() {
  const modalWrap = document.getElementById('recipe-wizard-modal-wrap');
  if (!modalWrap) return;

  let bodyContent = '';

  if (wizardState.currentStep === 0) {
    bodyContent = renderState0Choice();
  } else if (wizardState.currentStep === 1) {
    bodyContent = wizardState.choice === 'bulk' ? renderState1BBulk() : renderState1AManual();
  } else if (wizardState.currentStep === 1.5) {
    bodyContent = renderStep1Point5();
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

  const handlersContext = {
    renderWizardModal,
    showWizardNotice,
    loadNextRecipeFromQueue,
    closeRecipeWizard
  };

  bindStep01Events(modalWrap, handlersContext);
  bindStep2Events(modalWrap, handlersContext);
  bindStep3Events(modalWrap, handlersContext);
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
