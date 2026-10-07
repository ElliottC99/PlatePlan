/**
 * src/components/recipe/RecipeWizardModal.js (v3.22.0)
 * Multi-Step Ingestion & Recipe Creation Wizard Modal.
 * Centralized modal component managing UI states:
 * - State 0: Ingestion Choice ("1) Add Recipe" vs "2) Parse Recipe(s)")
 * - State 1A: Manual Entry Form (Title, Servings, Ingredients, Method)
 * - State 1B: Bulk Text Ingestion (Pasted text/markup multi-recipe parsing & queueing)
 * - State 2: Ingredient Scaling & Taxonomy Mapping
 * - State 3: Final Review & Save
 * - State 4: Queue Loop Resolution
 */

import { parseIngredientString, matchIngredientTaxonomy, parseBulkRecipeText, extractRecipeFromHtml } from '../../services/RecipeImporter.js';
import { getState } from '../../store/store.js';
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
    ingredientsRaw: '',
    methodRaw: '',
    mappedIngredients: [],
    methodSteps: [],
    macros: { calories: 400, protein: 25, carbs: 45, fat: 15 }
  }
};

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
      ingredientsRaw: '',
      methodRaw: '',
      mappedIngredients: [],
      methodSteps: [],
      macros: { calories: 400, protein: 25, carbs: 45, fat: 15 }
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
    <div class="modal" style="max-width: 860px; width: 92%; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; background: var(--surface, #fff); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.25);">
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

function renderStepBadge() {
  const step = wizardState.currentStep;
  if (step === 0) return `<span class="badge" style="background:var(--surface2, #e8e6df);color:var(--text2, #555);">Choice</span>`;
  if (step === 1) return `<span class="badge badge-purple" style="background:#eef2ff;color:#4f46e5;">Step 1: Ingestion</span>`;
  if (step === 2) return `<span class="badge badge-green" style="background:#ecfdf5;color:#059669;">Step 2: Scaling & Mapping</span>`;
  if (step === 3) return `<span class="badge badge-coral" style="background:#fef2f2;color:#dc2626;">Step 3: Review & Save</span>`;
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
          <span style="font-size: 13px; color: var(--text2, #666);">Enter details, ingredients, and method manually in structured fields.</span>
        </button>

        <button type="button" id="btn-choice-bulk" class="btn" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; border: 2px solid var(--border, #ddd); border-radius: 12px; background: var(--surface2, #f9f8f6); text-align: left; cursor: pointer; transition: all 0.2s;">
          <span style="font-size: 24px;">📋</span>
          <strong style="font-size: 16px; color: var(--text, #111);">2) Parse Recipe(s) (Raw Text)</strong>
          <span style="font-size: 13px; color: var(--text2, #666);">Paste unstructured text, HTML markup, or JSON-LD to import single or batch recipes.</span>
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

  return `
    <div>
      ${queueInfo}
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Recipe Title</label>
          <input type="text" id="wiz-title" value="${escapeAttr(recipe.title)}" placeholder="e.g. High-Protein Crispy Tofu Curry" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff); color: var(--text, #111);" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Current Servings (Source)</label>
            <input type="number" id="wiz-current-servings" value="${recipe.currentServings}" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff); color: var(--text, #111);" />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Target Servings (Desired Output)</label>
            <input type="number" id="wiz-target-servings" value="${recipe.targetServings}" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff); color: var(--text, #111);" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Ingredients (One line per item)</label>
          <textarea id="wiz-ingredients-raw" rows="6" placeholder="e.g.&#10;400g block extra firm tofu, pressed&#10;1 1/2 tsp smoked paprika&#10;2 cloves garlic, minced" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: inherit; background: var(--surface, #fff); color: var(--text, #111); resize: vertical;">${escapeHtml(recipe.ingredientsRaw)}</textarea>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Method / Instructions (One step per line)</label>
          <textarea id="wiz-method-raw" rows="6" placeholder="e.g.&#10;Press the tofu block and cut into 2cm cubes.&#10;Sauté garlic and smoked paprika in olive oil.&#10;Add chopped tomatoes and simmer for 20 minutes." style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: inherit; background: var(--surface, #fff); color: var(--text, #111); resize: vertical;">${escapeHtml(recipe.methodRaw)}</textarea>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
          <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
          <button type="button" class="btn primary" id="btn-next-step1a">Next: Scale & Map Ingredients →</button>
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
        Paste raw recipe text, HTML markup with JSON-LD schema, or multiple recipes separated by double newlines below.
      </p>

      <textarea id="wiz-bulk-text" rows="12" placeholder="Paste recipe text or HTML markup here...&#10;&#10;Example:&#10;Recipe 1: High-Protein Tofu Bowl&#10;Serves: 4&#10;Ingredients:&#10;200g firm tofu&#10;1 tbsp soy sauce&#10;&#10;Method:&#10;1. Bake tofu at 200°C for 20 mins." style="width: 100%; padding: 12px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; background: var(--surface2, #fbfbf9); color: var(--text, #111); resize: vertical; margin-bottom: 16px;">${escapeHtml(wizardState.bulkText)}</textarea>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
        <button type="button" class="btn primary" id="btn-next-step1b">Parse Text & Next →</button>
      </div>
    </div>
  `;
}

// State 2: Parsing & Taxonomy Mapping
function renderState2Mapping() {
  const recipe = wizardState.activeRecipe;
  const currServ = Number(recipe.currentServings) || 1;
  const tgtServ = Number(recipe.targetServings) || 1;
  const scaleFactor = tgtServ / currServ;

  const storeState = getState() || {};
  const ingredientsBank = storeState.ingredients || [];
  const categoriesBank = storeState.categories || [];

  let tableRows = '';
  recipe.mappedIngredients.forEach((item, idx) => {
    const scaledQty = Number((item.qty * scaleFactor).toFixed(2));
    item.scaledQty = scaledQty;

    let taxOptions = `<option value="new_item" ${!item.ingredientId ? 'selected' : ''}>✨ New Taxonomy Item (${escapeAttr(item.name)})</option>`;
    ingredientsBank.forEach(ing => {
      const isSel = ing.id === item.ingredientId;
      taxOptions += `<option value="${escapeAttr(ing.id)}" ${isSel ? 'selected' : ''}>${escapeHtml(ing.name)} (${escapeHtml(ing.category || 'General')})</option>`;
    });

    tableRows += `
      <tr style="border-bottom: 1px solid var(--border, #eee);">
        <td style="padding: 8px; font-size: 12px; color: var(--text2, #666); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeAttr(item.raw)}">${escapeHtml(item.raw)}</td>
        <td style="padding: 8px; width: 90px;">
          <input type="number" step="any" class="wiz-ing-qty" data-index="${idx}" value="${scaledQty}" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
        </td>
        <td style="padding: 8px; width: 90px;">
          <select class="wiz-ing-unit" data-index="${idx}" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;">
            ${renderUnitSelectOptions(item.unit)}
          </select>
        </td>
        <td style="padding: 8px;">
          <input type="text" class="wiz-ing-name" data-index="${idx}" value="${escapeAttr(item.name)}" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
        </td>
        <td style="padding: 8px; min-width: 180px;">
          <select class="wiz-ing-tax" data-index="${idx}" style="width: 100%; padding: 4px 6px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px; background: var(--surface2, #fbfbf9);">
            ${taxOptions}
          </select>
        </td>
      </tr>
    `;
  });

  let methodHtml = '';
  recipe.methodSteps.forEach((step, idx) => {
    methodHtml += `<li style="margin-bottom: 6px; font-size: 13px; color: var(--text, #333);">${escapeHtml(step)}</li>`;
  });

  return `
    <div>
      <div style="background: var(--surface2, #f3f4f6); border: 1px solid var(--border, #e5e7eb); padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 14px; font-weight: 600; color: var(--text, #111);">Scaling Calculation</span>
        <span style="font-size: 13px; color: var(--purple, #4f46e5); font-weight: 700;">
          ${currServ} servings ➔ ${tgtServ} servings (${scaleFactor.toFixed(2)}x multiplier)
        </span>
      </div>

      <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 700;">Review & Adjust Scaled Ingredients</h4>
      <div style="overflow-x: auto; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border, #ccc); font-size: 12px; color: var(--text2, #555);">
              <th style="padding: 8px;">Raw Item</th>
              <th style="padding: 8px;">Qty</th>
              <th style="padding: 8px;">Unit</th>
              <th style="padding: 8px;">Name</th>
              <th style="padding: 8px;">Taxonomy Mapping</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>

      <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 700;">Method Steps (${recipe.methodSteps.length})</h4>
      <ol style="padding-left: 20px; margin: 0 0 20px;">
        ${methodHtml || '<p style="color:var(--text2);font-size:12px;">No steps provided.</p>'}
      </ol>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(1)">← Back</button>
        <button type="button" class="btn primary" id="btn-next-step2">Next: Final Review →</button>
      </div>
    </div>
  `;
}

function renderUnitSelectOptions(selectedUnit) {
  const units = ['g', 'kg', 'ml', 'l', 'tbsp', 'tsp', 'cup', 'clove', 'can', 'pinch', 'block', 'piece', 'qty'];
  return units.map(u => `<option value="${u}" ${u === selectedUnit ? 'selected' : ''}>${u}</option>`).join('');
}

// State 3: Final Review & Save
function renderState3Review() {
  const recipe = wizardState.activeRecipe;

  let ingRows = '';
  recipe.mappedIngredients.forEach(ing => {
    const taxLabel = ing.ingredientId ? `<span class="badge badge-purple" style="font-size:10px;padding:2px 6px;">Mapped</span>` : `<span class="badge badge-green" style="font-size:10px;padding:2px 6px;">New Item</span>`;
    ingRows += `
      <tr style="border-bottom: 1px solid var(--border, #eee); font-size: 13px;">
        <td style="padding: 6px 8px; font-weight: 600;">${ing.scaledQty || ing.qty} ${ing.unit}</td>
        <td style="padding: 6px 8px;">${escapeHtml(ing.name)} ${ing.notes ? `<span style="color:var(--text2);font-size:11px;">(${escapeHtml(ing.notes)})</span>` : ''}</td>
        <td style="padding: 6px 8px; text-align: right;">${taxLabel}</td>
      </tr>
    `;
  });

  let stepsHtml = '';
  recipe.methodSteps.forEach(s => {
    stepsHtml += `<li style="margin-bottom: 6px; font-size: 13px; color: var(--text, #333);">${escapeHtml(s)}</li>`;
  });

  return `
    <div>
      <div style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 18px; border-radius: 12px; margin-bottom: 18px;">
        <h3 style="margin: 0 0 6px; font-size: 18px; color: var(--text, #111);">${escapeHtml(recipe.title)}</h3>
        <p style="margin: 0 0 14px; font-size: 13px; color: var(--text2, #666);">Target Servings: <strong>${recipe.targetServings}</strong></p>

        <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 700;">Final Mapped Ingredients</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <tbody>
            ${ingRows}
          </tbody>
        </table>

        <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 700;">Method Steps</h4>
        <ol style="padding-left: 20px; margin: 0;">
          ${stepsHtml}
        </ol>
      </div>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(2)">← Back</button>
        <button type="button" class="btn primary" id="btn-save-wizard-recipe">💾 Save Recipe to Vault</button>
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

  // Step 1A Next button
  const btnNext1A = modalWrap.querySelector('#btn-next-step1a');
  if (btnNext1A) {
    btnNext1A.onclick = () => {
      const title = modalWrap.querySelector('#wiz-title')?.value?.trim() || 'Untitled Recipe';
      const currServ = parseFloat(modalWrap.querySelector('#wiz-current-servings')?.value) || 4;
      const tgtServ = parseFloat(modalWrap.querySelector('#wiz-target-servings')?.value) || 4;
      const ingRaw = modalWrap.querySelector('#wiz-ingredients-raw')?.value || '';
      const methodRaw = modalWrap.querySelector('#wiz-method-raw')?.value || '';

      wizardState.activeRecipe.title = title;
      wizardState.activeRecipe.currentServings = currServ;
      wizardState.activeRecipe.targetServings = tgtServ;
      wizardState.activeRecipe.ingredientsRaw = ingRaw;
      wizardState.activeRecipe.methodRaw = methodRaw;

      // Parse ingredients and method
      const ingLines = ingRaw.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedIngs = ingLines.map(line => {
        const parsed = parseIngredientString(line);
        return matchIngredientTaxonomy(parsed);
      }).filter(Boolean);

      wizardState.activeRecipe.mappedIngredients = parsedIngs;
      wizardState.activeRecipe.methodSteps = methodRaw.split('\n').map(l => l.trim()).filter(Boolean);

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

      // Parse using html JSON-LD or text chunks
      let parsedList = [];
      const singleExtracted = extractRecipeFromHtml(text);
      if (singleExtracted) {
        parsedList.push(singleExtracted);
      } else {
        parsedList = parseBulkRecipeText(text);
      }

      if (!parsedList.length) {
        alert('Could not identify any recipes in the pasted text. Please check the formatting.');
        return;
      }

      wizardState.processingQueue = parsedList;
      wizardState.currentQueueTotal = parsedList.length;

      // Load first recipe from queue into active state
      loadNextRecipeFromQueue();
      wizardState.choice = 'manual';
      wizardState.currentStep = 1;
      renderWizardModal();
    };
  }

  // Step 2 Next button
  const btnNext2 = modalWrap.querySelector('#btn-next-step2');
  if (btnNext2) {
    btnNext2.onclick = () => {
      // Collect edits from table inputs
      const qtyInputs = modalWrap.querySelectorAll('.wiz-ing-qty');
      const unitSelects = modalWrap.querySelectorAll('.wiz-ing-unit');
      const nameInputs = modalWrap.querySelectorAll('.wiz-ing-name');
      const taxSelects = modalWrap.querySelectorAll('.wiz-ing-tax');

      wizardState.activeRecipe.mappedIngredients.forEach((item, idx) => {
        if (qtyInputs[idx]) item.scaledQty = parseFloat(qtyInputs[idx].value) || item.qty;
        if (unitSelects[idx]) item.unit = unitSelects[idx].value;
        if (nameInputs[idx]) item.name = nameInputs[idx].value.trim();
        if (taxSelects[idx]) {
          const val = taxSelects[idx].value;
          if (val === 'new_item') {
            item.ingredientId = null;
            item.isNewTaxonomyItem = true;
          } else {
            item.ingredientId = val;
            item.isNewTaxonomyItem = false;
          }
        }
      });

      wizardState.currentStep = 3;
      renderWizardModal();
    };
  }

  // Step 3 Save button
  const btnSave = modalWrap.querySelector('#btn-save-wizard-recipe');
  if (btnSave) {
    btnSave.onclick = async () => {
      btnSave.disabled = true;
      btnSave.textContent = 'Saving...';

      const rec = wizardState.activeRecipe;
      const finalRecipe = {
        id: crypto.randomUUID(),
        name: rec.title,
        title: rec.title,
        serves: rec.targetServings,
        servings: rec.targetServings,
        ingredients: rec.mappedIngredients.map(ing => ({
          qty: ing.scaledQty || ing.qty,
          unit: ing.unit,
          name: ing.name,
          ingredientId: ing.ingredientId || null,
          notes: ing.notes || '',
          isNewTaxonomyItem: !!ing.isNewTaxonomyItem
        })),
        instructions: rec.methodSteps,
        steps: rec.methodSteps,
        macros: rec.macros || { calories: 400, protein: 25, carbs: 45, fat: 15 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        await saveRecipe(finalRecipe);

        const storeState = getState() || (window.state || {});
        if (Array.isArray(storeState.recipes)) {
          storeState.recipes.unshift(finalRecipe);
        }

        // Check if there are remaining items in the processing queue
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
        console.error('[RecipeWizard] Failed to save recipe:', e);
        alert(`Error saving recipe: ${e.message}`);
        btnSave.disabled = false;
        btnSave.textContent = '💾 Save Recipe to Vault';
      }
    };
  }
}

function loadNextRecipeFromQueue() {
  if (!wizardState.processingQueue.length) return;
  const next = wizardState.processingQueue.shift();

  const ingRawText = (next.ingredients || []).map(i => {
    if (i.raw) return i.raw;
    const qtyStr = i.qty ? `${i.qty} ` : '';
    const unitStr = i.unit && i.unit !== 'qty' ? `${i.unit} ` : '';
    return `${qtyStr}${unitStr}${i.name || ''}`;
  }).join('\n');

  const methodRawText = (next.instructions || []).join('\n');

  wizardState.activeRecipe = {
    title: next.title || 'Imported Recipe',
    currentServings: next.servings || 4,
    targetServings: next.servings || 4,
    ingredientsRaw: ingRawText,
    methodRaw: methodRawText,
    mappedIngredients: next.ingredients || [],
    methodSteps: next.instructions || [],
    macros: next.macros || { calories: 400, protein: 25, carbs: 45, fat: 15 }
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

// Global window mounts
if (typeof window !== 'undefined') {
  window.openRecipeWizard = openRecipeWizard;
  window.closeRecipeWizard = closeRecipeWizard;
  window.goToWizardStep = function(step) {
    wizardState.currentStep = step;
    renderWizardModal();
  };
  window.openBulkRecipeImporterModal = () => openRecipeWizard('bulk');
  window.openRecipeEditor = () => openRecipeWizard('manual');
}
