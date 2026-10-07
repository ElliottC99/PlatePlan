/**
 * src/components/recipe/RecipeWizardModal.js (v3.22.1)
 * Upgraded Multi-Step Recipe Ingestion & Creation Wizard Modal.
 * Supports prep/cook hours & mins, meal suitability tags, ingredient section headers,
 * strict unit dropdowns (g, ml, qty), raw source text chips, alias learning,
 * and completely inline-editable final review in Step 3.
 */

import { parseIngredientString, matchIngredientTaxonomy, parseBulkRecipeText, extractRecipeFromHtml } from '../../services/RecipeImporter.js';
import { getState, learnIngredientAlias } from '../../store/store.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';

let wizardState = {
  currentStep: 0,
  choice: 'manual', // 'manual' | 'bulk'
  bulkText: '',
  processingQueue: [],
  currentQueueTotal: 0,
  activeRecipe: {
    title: '',
    currentServings: 4,
    targetServings: 4,
    prepTime: { hours: 0, minutes: 15 },
    cookTime: { hours: 0, minutes: 30 },
    mealSuitability: ['Dinner'],
    ingredientsRaw: '',
    methodRaw: '',
    ingredientSections: [
      { sectionTitle: 'Main Ingredients', ingredients: [] }
    ],
    methodSteps: [],
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
  }
};

const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side', 'Dessert'];

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

function resetWizardState() {
  wizardState = {
    currentStep: 0,
    choice: 'manual',
    bulkText: '',
    processingQueue: [],
    currentQueueTotal: 0,
    activeRecipe: {
      title: '',
      currentServings: 4,
      targetServings: 4,
      prepTime: { hours: 0, minutes: 15 },
      cookTime: { hours: 0, minutes: 30 },
      mealSuitability: ['Dinner'],
      ingredientsRaw: '',
      methodRaw: '',
      ingredientSections: [
        { sectionTitle: 'Main Ingredients', ingredients: [] }
      ],
      methodSteps: [],
      macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
    }
  };
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
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text, #111);">Recipe Wizard (v3.22.1)</h2>
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

function renderStepBadge() {
  const step = wizardState.currentStep;
  if (step === 0) return `<span class="badge" style="background:var(--surface2, #e8e6df);color:var(--text2, #555);">Choice</span>`;
  if (step === 1) return `<span class="badge badge-purple" style="background:#eef2ff;color:#4f46e5;">Step 1: Ingestion</span>`;
  if (step === 2) return `<span class="badge badge-green" style="background:#ecfdf5;color:#059669;">Step 2: Sections & Mapping</span>`;
  if (step === 3) return `<span class="badge badge-coral" style="background:#fef2f2;color:#dc2626;">Step 3: Inline Review & Save</span>`;
  return '';
}

// State 0: Choice
function renderState0Choice() {
  return `
    <div style="text-align: center; padding: 20px 10px;">
      <h3 style="font-size: 18px; margin-bottom: 8px;">How would you like to add your recipe?</h3>
      <p style="color: var(--text2, #666); font-size: 14px; margin-bottom: 24px;">Select an option below to start creating or importing recipes.</p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 20px;">
        <button type="button" id="btn-choice-manual" class="btn" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; border: 2px solid var(--border, #ddd); border-radius: 12px; background: var(--surface2, #f9f8f6); text-align: left; cursor: pointer; transition: all 0.2s;">
          <span style="font-size: 24px;">✍️</span>
          <strong style="font-size: 16px; color: var(--text, #111);">1) Add Recipe (Manual)</strong>
          <span style="font-size: 13px; color: var(--text2, #666);">Enter details, meal tags, timings, ingredients, and method manually.</span>
        </button>

        <button type="button" id="btn-choice-bulk" class="btn" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; border: 2px solid var(--border, #ddd); border-radius: 12px; background: var(--surface2, #f9f8f6); text-align: left; cursor: pointer; transition: all 0.2s;">
          <span style="font-size: 24px;">📋</span>
          <strong style="font-size: 16px; color: var(--text, #111);">2) Parse Recipe(s) (Raw Text)</strong>
          <span style="font-size: 13px; color: var(--text2, #666);">Paste unstructured text, HTML markup, or multiple recipe blocks.</span>
        </button>
      </div>
    </div>
  `;
}

// State 1A: Manual Entry Form
function renderState1AManual() {
  const recipe = wizardState.activeRecipe;
  const queueInfo = wizardState.processingQueue.length > 0
    ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 16px;">
        📌 Batch Queue: Recipe ${wizardState.currentQueueTotal - wizardState.processingQueue.length + 1} of ${wizardState.currentQueueTotal} (${wizardState.processingQueue.length} remaining)
       </div>`
    : '';

  const mealTagsHtml = MEAL_TAGS.map(tag => {
    const isSelected = recipe.mealSuitability.includes(tag);
    return `<label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 10px; border: 1px solid var(--border, #ccc); border-radius: 999px; background: ${isSelected ? 'var(--purple-bg, #eef2ff)' : 'var(--surface, #fff)'}; color: ${isSelected ? 'var(--purple, #4f46e5)' : 'var(--text, #333)'}; cursor: pointer;">
      <input type="checkbox" class="wiz-meal-tag" value="${tag}" ${isSelected ? 'checked' : ''} style="display:none;" />
      ${tag}
    </label>`;
  }).join(' ');

  return `
    <div>
      ${queueInfo}
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Recipe Title</label>
          <input type="text" id="wiz-title" value="${escapeAttr(recipe.title)}" placeholder="e.g. High-Protein Crispy Tofu Curry" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff); color: var(--text, #111);" />
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Current Servings</label>
            <input type="number" id="wiz-current-servings" value="${recipe.currentServings}" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff);" />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Target Servings</label>
            <input type="number" id="wiz-target-servings" value="${recipe.targetServings}" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff);" />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Prep Time (Hours / Mins)</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="wiz-prep-h" value="${recipe.prepTime.hours}" min="0" placeholder="h" style="width: 50%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px;" />
              <input type="number" id="wiz-prep-m" value="${recipe.prepTime.minutes}" min="0" placeholder="m" style="width: 50%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px;" />
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Cook Time (Hours / Mins)</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="wiz-cook-h" value="${recipe.cookTime.hours}" min="0" placeholder="h" style="width: 50%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px;" />
              <input type="number" id="wiz-cook-m" value="${recipe.cookTime.minutes}" min="0" placeholder="m" style="width: 50%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px;" />
            </div>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Meal Suitability Tags</label>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="wiz-meal-tags-container">
            ${mealTagsHtml}
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Ingredients (Lines with section headers like "For the salsa:" are automatically grouped)</label>
          <textarea id="wiz-ingredients-raw" rows="6" placeholder="For the tofu:&#10;2 x 400g block extra firm tofu&#10;1 tbsp olive oil&#10;&#10;For the sauce:&#10;1 cup coconut milk&#10;2 tbsp soy sauce" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: inherit; background: var(--surface, #fff); resize: vertical;">${escapeHtml(recipe.ingredientsRaw)}</textarea>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Method / Instructions (One step per line)</label>
          <textarea id="wiz-method-raw" rows="6" placeholder="1. Press tofu and cut into cubes.&#10;2. Whisk coconut milk and soy sauce.&#10;3. Simmer together for 15 mins." style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: inherit; background: var(--surface, #fff); resize: vertical;">${escapeHtml(recipe.methodRaw)}</textarea>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
          <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
          <button type="button" class="btn primary" id="btn-next-step1a">Next: Sections & Mapping →</button>
        </div>
      </div>
    </div>
  `;
}

// State 1B: Bulk Text Ingestion
function renderState1BBulk() {
  return `
    <div>
      <p style="font-size: 13px; color: var(--text2, #666); margin-bottom: 12px;">
        Paste raw recipe text, HTML markup, or multiple recipe blocks separated by double page breaks or "Recipe 1:", "Recipe 2:" headers.
      </p>

      <textarea id="wiz-bulk-text" rows="12" placeholder="Recipe 1: High-Protein Tofu Bowl&#10;Serves: 4&#10;2 x 400g firm tofu&#10;1 cup milk&#10;&#10;Method:&#10;1. Bake tofu.&#10;&#10;Recipe 2: Smoky Lentil Soup&#10;Serves: 4&#10;200g brown lentils..." style="width: 100%; padding: 12px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; background: var(--surface2, #fbfbf9); resize: vertical; margin-bottom: 16px;">${escapeHtml(wizardState.bulkText)}</textarea>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
        <button type="button" class="btn primary" id="btn-next-step1b">Parse Text & Next →</button>
      </div>
    </div>
  `;
}

// State 2: Sections & Taxonomy Mapping
function renderState2Mapping() {
  const recipe = wizardState.activeRecipe;
  const currServ = Number(recipe.currentServings) || 1;
  const tgtServ = Number(recipe.targetServings) || 1;
  const scaleFactor = tgtServ / currServ;

  const storeState = getState() || {};
  const ingredientsBank = storeState.ingredients || [];

  let sectionsHtml = '';
  (recipe.ingredientSections || []).forEach((sec, sIdx) => {
    let rowsHtml = '';
    (sec.ingredients || []).forEach((item, iIdx) => {
      const scaledQty = Number((item.qty * scaleFactor).toFixed(1));
      item.scaledQty = scaledQty;

      // Autocomplete options distinguishing main ingredients vs sub-types
      let taxOptions = `<option value="new_item" ${!item.ingredientId ? 'selected' : ''}>✨ New Taxonomy Item (${escapeAttr(item.name)})</option>`;
      ingredientsBank.forEach(ing => {
        const isSel = ing.id === item.ingredientId;
        const subTypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];
        
        taxOptions += `<option value="${escapeAttr(ing.id)}" ${isSel ? 'selected' : ''} style="font-weight:700;">📦 ${escapeHtml(ing.name)} [Main: ${escapeHtml(ing.category || 'General')}]</option>`;
        
        subTypes.forEach(sub => {
          const subKey = `${ing.id}:${sub.id || sub.name}`;
          const isSubSel = item.ingredientId === subKey || item.subtypeId === sub.id;
          taxOptions += `<option value="${escapeAttr(subKey)}" ${isSubSel ? 'selected' : ''}>&nbsp;&nbsp;&nbsp;&nbsp;↳ 🏷️ Subtype: ${escapeHtml(sub.name)} (${escapeHtml(ing.name)})</option>`;
        });
      });

      const fallbackBadge = item.isFallbackWeight 
        ? `<span class="badge" style="background:#fef3c7;color:#92400e;font-size:10px;margin-left:4px;" title="Volume converted to grams assuming 1ml=1g density">⚠️ Check Weight (g)</span>`
        : '';

      rowsHtml += `
        <tr style="border-bottom: 1px solid var(--border, #eee);">
          <td style="padding: 6px;">
            <div style="font-size: 11px; color: var(--text2, #666); font-style: italic;">Raw: "${escapeHtml(item.raw)}"</div>
            ${fallbackBadge}
          </td>
          <td style="padding: 6px; width: 80px;">
            <input type="number" step="any" class="wiz-ing-qty" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${scaledQty}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
          </td>
          <td style="padding: 6px; width: 80px;">
            <select class="wiz-ing-unit" data-sidx="${sIdx}" data-iidx="${iIdx}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;">
              ${['g', 'ml', 'qty'].map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </td>
          <td style="padding: 6px;">
            <input type="text" class="wiz-ing-name" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${escapeAttr(item.name)}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
          </td>
          <td style="padding: 6px; min-width: 200px;">
            <select class="wiz-ing-tax" data-sidx="${sIdx}" data-iidx="${iIdx}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px; background: var(--surface2, #fbfbf9);">
              ${taxOptions}
            </select>
          </td>
          <td style="padding: 6px; width: 40px; text-align: center;">
            <button type="button" class="btn sm danger ghost wiz-del-ing-btn" data-sidx="${sIdx}" data-iidx="${iIdx}" title="Delete ingredient">🗑️</button>
          </td>
        </tr>
      `;
    });

    sectionsHtml += `
      <div style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 12px; border-radius: 10px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <input type="text" class="wiz-section-title-input" data-sidx="${sIdx}" value="${escapeAttr(sec.sectionTitle)}" style="font-weight: 700; font-size: 14px; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; width: 60%; background: var(--surface);" />
          <button type="button" class="btn sm ghost wiz-del-section-btn" data-sidx="${sIdx}" style="color: #ef4444;">Remove Section</button>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="padding: 8px; color: var(--text2); font-size: 12px;">No ingredients in section.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  });

  // Method steps rendering with delete buttons
  let stepsHtml = '';
  (recipe.methodSteps || []).forEach((step, idx) => {
    stepsHtml += `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text2); width: 24px; text-align: right;">${idx + 1}.</span>
        <input type="text" class="wiz-step-input" data-idx="${idx}" value="${escapeAttr(step)}" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
        <button type="button" class="btn sm danger ghost wiz-del-step-btn" data-idx="${idx}" title="Delete step">🗑️</button>
      </div>
    `;
  });

  return `
    <div>
      <div style="background: var(--purple-bg, #eef2ff); border: 1px solid rgba(79,70,229,0.2); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 14px; font-weight: 600; color: var(--purple, #4f46e5);">Scaling & Density Normalization</span>
        <span style="font-size: 13px; font-weight: 700;">
          ${currServ} servings ➔ ${tgtServ} servings (${scaleFactor.toFixed(2)}x) | Strict Units: g, ml, qty
        </span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0; font-size: 15px; font-weight: 700;">Ingredient Sections</h4>
        <button type="button" id="wiz-add-section-btn" class="btn sm secondary">+ Add Section Header</button>
      </div>

      ${sectionsHtml}

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px;">
        <h4 style="margin: 0; font-size: 15px; font-weight: 700;">Method Steps (${(recipe.methodSteps || []).length})</h4>
        <button type="button" id="wiz-add-step-btn" class="btn sm secondary">+ Add Step</button>
      </div>
      <div style="margin-bottom: 20px;">
        ${stepsHtml || '<p style="color:var(--text2);font-size:12px;">No method steps.</p>'}
      </div>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(1)">← Back</button>
        <button type="button" class="btn primary" id="btn-next-step2">Next: Final Inline Review →</button>
      </div>
    </div>
  `;
}

// State 3: Final Inline Review & Save
function renderState3Review() {
  const recipe = wizardState.activeRecipe;

  let sectionsReviewHtml = '';
  (recipe.ingredientSections || []).forEach(sec => {
    let rows = '';
    (sec.ingredients || []).forEach(ing => {
      const taxLabel = ing.ingredientId ? `<span class="badge badge-purple" style="font-size:10px;">Mapped</span>` : `<span class="badge badge-green" style="font-size:10px;">New Item</span>`;
      rows += `
        <tr style="border-bottom: 1px solid var(--border, #eee); font-size: 13px;">
          <td style="padding: 6px 8px; font-weight: 600; width: 100px;">${ing.scaledQty || ing.qty} ${ing.unit}</td>
          <td style="padding: 6px 8px;">${escapeHtml(ing.name)} ${ing.notes ? `<span style="color:var(--text2);font-size:11px;">(${escapeHtml(ing.notes)})</span>` : ''}</td>
          <td style="padding: 6px 8px; text-align: right;">${taxLabel}</td>
        </tr>
      `;
    });

    sectionsReviewHtml += `
      <div style="margin-bottom: 12px;">
        <h5 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: var(--purple, #4f46e5);">${escapeHtml(sec.sectionTitle)}</h5>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${rows || '<tr><td colspan="3" style="font-size:12px;color:var(--text2);">No ingredients</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  });

  let stepsReviewHtml = '';
  (recipe.methodSteps || []).forEach((s, i) => {
    stepsReviewHtml += `<li style="margin-bottom: 6px; font-size: 13px; color: var(--text, #333);">${escapeHtml(s)}</li>`;
  });

  let mealTagsHtml = MEAL_TAGS.map(tag => {
    const isSelected = recipe.mealSuitability.includes(tag);
    return `<label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 8px; border: 1px solid var(--border, #ccc); border-radius: 999px; background: ${isSelected ? '#eef2ff' : '#fff'}; color: ${isSelected ? '#4f46e5' : '#333'}; cursor: pointer;">
      <input type="checkbox" class="wiz-review-tag" value="${tag}" ${isSelected ? 'checked' : ''} style="display:none;" />
      ${tag}
    </label>`;
  }).join(' ');

  return `
    <div>
      <div style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 18px; border-radius: 12px; margin-bottom: 18px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 700; color: var(--text);">Inline Editable Review</h3>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div>
            <label style="display:block; font-size:11px; font-weight:600; color:var(--text2);">Recipe Title</label>
            <input type="text" id="wiz-rev-title" value="${escapeAttr(recipe.title)}" style="width:100%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="display:block; font-size:11px; font-weight:600; color:var(--text2);">Target Servings</label>
            <input type="number" id="wiz-rev-servings" value="${recipe.targetServings}" style="width:100%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px;" />
          </div>
          <div>
            <label style="display:block; font-size:11px; font-weight:600; color:var(--text2);">Prep / Cook (Mins)</label>
            <div style="display:flex; gap:4px;">
              <input type="number" id="wiz-rev-prepm" value="${(recipe.prepTime.hours * 60) + recipe.prepTime.minutes}" title="Prep Mins" style="width:50%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px;" />
              <input type="number" id="wiz-rev-cookm" value="${(recipe.cookTime.hours * 60) + recipe.cookTime.minutes}" title="Cook Mins" style="width:50%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px;" />
            </div>
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="display:block; font-size:11px; font-weight:600; color:var(--text2); margin-bottom: 4px;">Meal Suitability Tags</label>
          <div style="display:flex; flex-wrap:wrap; gap:6px;" id="wiz-review-tags-box">
            ${mealTagsHtml}
          </div>
        </div>

        <hr style="border:0; border-top:1px solid var(--border); margin:14px 0;" />

        <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 700;">Ingredient Sections Overview</h4>
        ${sectionsReviewHtml}

        <h4 style="margin: 14px 0 8px; font-size: 14px; font-weight: 700;">Method Steps</h4>
        <ol style="padding-left: 20px; margin: 0;">
          ${stepsReviewHtml}
        </ol>
      </div>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(2)">← Back to Mapping</button>
        <button type="button" class="btn primary" id="btn-save-wizard-recipe">💾 Save Upgraded Recipe to Vault</button>
      </div>
    </div>
  `;
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
  modalWrap.querySelectorAll('#wiz-meal-tags-container label, #wiz-review-tags-box label').forEach(lbl => {
    lbl.onclick = (e) => {
      const checkbox = lbl.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        lbl.style.background = checkbox.checked ? '#eef2ff' : '#fff';
        lbl.style.color = checkbox.checked ? '#4f46e5' : '#333';
      }
    };
  });

  // Step 1A Next button
  const btnNext1A = modalWrap.querySelector('#btn-next-step1a');
  if (btnNext1A) {
    btnNext1A.onclick = () => {
      const title = modalWrap.querySelector('#wiz-title')?.value?.trim() || 'Untitled Recipe';
      const currServ = parseFloat(modalWrap.querySelector('#wiz-current-servings')?.value) || 4;
      const tgtServ = parseFloat(modalWrap.querySelector('#wiz-target-servings')?.value) || 4;
      const prepH = parseInt(modalWrap.querySelector('#wiz-prep-h')?.value, 10) || 0;
      const prepM = parseInt(modalWrap.querySelector('#wiz-prep-m')?.value, 10) || 15;
      const cookH = parseInt(modalWrap.querySelector('#wiz-cook-h')?.value, 10) || 0;
      const cookM = parseInt(modalWrap.querySelector('#wiz-cook-m')?.value, 10) || 30;
      const ingRaw = modalWrap.querySelector('#wiz-ingredients-raw')?.value || '';
      const methodRaw = modalWrap.querySelector('#wiz-method-raw')?.value || '';

      const checkedTags = Array.from(modalWrap.querySelectorAll('#wiz-meal-tags-container input:checked')).map(i => i.value);

      wizardState.activeRecipe.title = title;
      wizardState.activeRecipe.currentServings = currServ;
      wizardState.activeRecipe.targetServings = tgtServ;
      wizardState.activeRecipe.prepTime = { hours: prepH, minutes: prepM };
      wizardState.activeRecipe.cookTime = { hours: cookH, minutes: cookM };
      wizardState.activeRecipe.mealSuitability = checkedTags.length ? checkedTags : ['Dinner'];
      wizardState.activeRecipe.ingredientsRaw = ingRaw;
      wizardState.activeRecipe.methodRaw = methodRaw;

      // Parse ingredients into section blocks
      const sectionsMap = { 'Main Ingredients': [] };
      let currentSec = 'Main Ingredients';

      ingRaw.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (/^for\s+the\s+.+:|^[a-zA-Z\s]+:$/.test(trimmed) && !/serves|yield|ingredients|method|instructions/i.test(trimmed)) {
          currentSec = trimmed.replace(':', '').trim();
          if (!sectionsMap[currentSec]) sectionsMap[currentSec] = [];
          return;
        }
        const parsed = parseIngredientString(trimmed);
        if (parsed) {
          const matched = matchIngredientTaxonomy(parsed);
          sectionsMap[currentSec].push(matched);
        }
      });

      wizardState.activeRecipe.ingredientSections = Object.entries(sectionsMap)
        .filter(([_, list]) => list.length > 0)
        .map(([secTitle, list]) => ({ sectionTitle: secTitle, ingredients: list }));

      if (wizardState.activeRecipe.ingredientSections.length === 0) {
        wizardState.activeRecipe.ingredientSections = [{ sectionTitle: 'Main Ingredients', ingredients: [] }];
      }

      wizardState.activeRecipe.methodSteps = methodRaw.split('\n').map(l => l.trim().replace(/^\d+\.\s*/, '')).filter(Boolean);

      wizardState.currentStep = 2;
      renderWizardModal();
    };
  }

  // Step 1B Next button
  const btnNext1B = modalWrap.querySelector('#btn-next-step1b');
  if (btnNext1B) {
    btnNext1B.onclick = () => {
      const text = modalWrap.querySelector('#wiz-bulk-text')?.value || '';
      wizardState.bulkText = text;

      if (!text.trim()) {
        alert('Please paste recipe text or HTML markup to parse.');
        return;
      }

      let parsedList = parseBulkRecipeText(text);
      if (!parsedList.length) {
        alert('Could not identify any recipes in the pasted text.');
        return;
      }

      wizardState.processingQueue = parsedList;
      wizardState.currentQueueTotal = parsedList.length;

      loadNextRecipeFromQueue();
      wizardState.choice = 'manual';
      wizardState.currentStep = 1;
      renderWizardModal();
    };
  }

  // Step 2 Add Section button
  const btnAddSec = modalWrap.querySelector('#wiz-add-section-btn');
  if (btnAddSec) {
    btnAddSec.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.ingredientSections.push({ sectionTitle: 'New Section', ingredients: [] });
      renderWizardModal();
    };
  }

  // Step 2 Add Step button
  const btnAddStep = modalWrap.querySelector('#wiz-add-step-btn');
  if (btnAddStep) {
    btnAddStep.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.activeRecipe.methodSteps.push('');
      renderWizardModal();
    };
  }

  // Step 2 Delete Section buttons
  modalWrap.querySelectorAll('.wiz-del-section-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      wizardState.activeRecipe.ingredientSections.splice(sIdx, 1);
      renderWizardModal();
    };
  });

  // Step 2 Delete Ingredient buttons
  modalWrap.querySelectorAll('.wiz-del-ing-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const sIdx = parseInt(btn.dataset.sidx, 10);
      const iIdx = parseInt(btn.dataset.iidx, 10);
      wizardState.activeRecipe.ingredientSections[sIdx].ingredients.splice(iIdx, 1);
      renderWizardModal();
    };
  });

  // Step 2 Delete Step buttons
  modalWrap.querySelectorAll('.wiz-del-step-btn').forEach(btn => {
    btn.onclick = () => {
      syncStep2InputsToState(modalWrap);
      const idx = parseInt(btn.dataset.idx, 10);
      wizardState.activeRecipe.methodSteps.splice(idx, 1);
      renderWizardModal();
    };
  });

  // Step 2 Next button
  const btnNext2 = modalWrap.querySelector('#btn-next-step2');
  if (btnNext2) {
    btnNext2.onclick = () => {
      syncStep2InputsToState(modalWrap);
      wizardState.currentStep = 3;
      renderWizardModal();
    };
  }

  // Step 3 Save button
  const btnSave = modalWrap.querySelector('#btn-save-wizard-recipe');
  if (btnSave) {
    btnSave.onclick = async () => {
      syncStep3InputsToState(modalWrap);
      btnSave.disabled = true;
      btnSave.textContent = 'Saving Upgraded Recipe...';

      const rec = wizardState.activeRecipe;
      const flatIngredients = (rec.ingredientSections || []).flatMap(sec => sec.ingredients.map(ing => ({
        qty: ing.scaledQty || ing.qty,
        unit: ing.unit,
        name: ing.name,
        ingredientId: ing.ingredientId || null,
        subtypeId: ing.subtypeId || null,
        notes: ing.notes || '',
        isNewTaxonomyItem: !!ing.isNewTaxonomyItem
      })));

      const finalRecipe = {
        id: crypto.randomUUID(),
        name: rec.title,
        title: rec.title,
        serves: rec.targetServings,
        servings: rec.targetServings,
        prepTime: rec.prepTime,
        cookTime: rec.cookTime,
        mealSuitability: rec.mealSuitability,
        ingredientSections: rec.ingredientSections,
        ingredients: flatIngredients,
        instructions: rec.methodSteps,
        steps: rec.methodSteps,
        macros: rec.macros || { calories: 450, protein: 28, carbs: 40, fat: 16 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        // Alias Learning & Persistence
        for (const sec of rec.ingredientSections || []) {
          for (const ing of sec.ingredients || []) {
            if (ing.ingredientId && ing.raw) {
              await learnIngredientAlias(ing.ingredientId, ing.name || ing.raw);
            }
          }
        }

        await saveRecipe(finalRecipe);

        const storeState = getState() || (window.state || {});
        if (Array.isArray(storeState.recipes)) {
          storeState.recipes.unshift(finalRecipe);
        }

        if (wizardState.processingQueue.length > 0) {
          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Saved "${rec.title}"! Loading next recipe...`);
          }
          loadNextRecipeFromQueue();
          wizardState.currentStep = 1;
          renderWizardModal();
        } else {
          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast(`Successfully saved "${rec.title}" to Recipe Vault!`);
          }
          closeRecipeWizard();
          if (typeof window.renderRecipeVault === 'function') {
            window.renderRecipeVault();
          }
        }
      } catch (e) {
        console.error('[RecipeWizard v3.22.1] Error saving recipe:', e);
        alert(`Error saving recipe: ${e.message}`);
        btnSave.disabled = false;
        btnSave.textContent = '💾 Save Upgraded Recipe to Vault';
      }
    };
  }
}

function syncStep2InputsToState(modalWrap) {
  const currServ = Number(wizardState.activeRecipe.currentServings) || 1;
  const tgtServ = Number(wizardState.activeRecipe.targetServings) || 1;
  const scaleFactor = tgtServ / currServ;

  // Section titles
  modalWrap.querySelectorAll('.wiz-section-title-input').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    if (wizardState.activeRecipe.ingredientSections[sIdx]) {
      wizardState.activeRecipe.ingredientSections[sIdx].sectionTitle = input.value.trim() || 'Section';
    }
  });

  // Ingredient table edits
  modalWrap.querySelectorAll('.wiz-ing-qty').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
    if (item) item.scaledQty = parseFloat(input.value) || item.qty;
  });

  modalWrap.querySelectorAll('.wiz-ing-unit').forEach(select => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
    if (item) item.unit = select.value;
  });

  modalWrap.querySelectorAll('.wiz-ing-name').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
    if (item) item.name = input.value.trim();
  });

  modalWrap.querySelectorAll('.wiz-ing-tax').forEach(select => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
    if (item) {
      const val = select.value;
      if (val === 'new_item') {
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

  // Method steps edits
  const stepInputs = [];
  modalWrap.querySelectorAll('.wiz-step-input').forEach(input => {
    stepInputs.push(input.value.trim());
  });
  if (stepInputs.length > 0) {
    wizardState.activeRecipe.methodSteps = stepInputs.filter(Boolean);
  }
}

function syncStep3InputsToState(modalWrap) {
  const rec = wizardState.activeRecipe;
  const title = modalWrap.querySelector('#wiz-rev-title')?.value?.trim();
  if (title) rec.title = title;

  const serv = parseInt(modalWrap.querySelector('#wiz-rev-servings')?.value, 10);
  if (serv > 0) rec.targetServings = serv;

  const prepMins = parseInt(modalWrap.querySelector('#wiz-rev-prepm')?.value, 10) || 0;
  const cookMins = parseInt(modalWrap.querySelector('#wiz-rev-cookm')?.value, 10) || 0;
  rec.prepTime = { hours: Math.floor(prepMins / 60), minutes: prepMins % 60 };
  rec.cookTime = { hours: Math.floor(cookMins / 60), minutes: cookMins % 60 };

  const tags = Array.from(modalWrap.querySelectorAll('#wiz-review-tags-box input:checked')).map(i => i.value);
  if (tags.length) rec.mealSuitability = tags;
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

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
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
