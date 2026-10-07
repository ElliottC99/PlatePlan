/**
 * src/components/recipe/RecipeWizardViews.js (v3.27.2)
 * Template view rendering functions for all steps of the Recipe Ingestion Wizard.
 */

import { wizardState, MEAL_TAGS } from './RecipeWizardState.js';
import { getState } from '../../store/store.js';
import { renderTaxonomySearchHTML } from './RecipeWizardTaxonomySearch.js';

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

export function renderStepBadge() {
  const step = wizardState.currentStep;
  if (step === 0) return `<span class="badge" style="background:var(--surface2, #e8e6df);color:var(--text2, #555);">Choice</span>`;
  if (step === 1) return `<span class="badge badge-purple" style="background:#eef2ff;color:#4f46e5;">Step 1: Ingestion</span>`;
  if (step === 2) return `<span class="badge badge-green" style="background:#ecfdf5;color:#059669;">Step 2: Sections & Mapping</span>`;
  if (step === 3) return `<span class="badge badge-coral" style="background:#fef2f2;color:#dc2626;">Step 3: Inline Review & Save</span>`;
  return '';
}

export function renderState0Choice() {
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

export function renderState1AManual() {
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
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Prep Time (Hours & Mins)</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="wiz-prep-hours" placeholder="0 hr" value="${recipe.prepTime.hours}" min="0" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
              <input type="number" id="wiz-prep-mins" placeholder="15 min" value="${recipe.prepTime.minutes}" min="0" max="59" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Cook Time (Hours & Mins)</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="wiz-cook-hours" placeholder="0 hr" value="${recipe.cookTime.hours}" min="0" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
              <input type="number" id="wiz-cook-mins" placeholder="30 min" value="${recipe.cookTime.minutes}" min="0" max="59" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
            </div>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;">Meal Suitability</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;" id="wiz-meal-tags-container">
            ${mealTagsHtml}
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Ingredients (1 per line or sections with headers e.g. "For the sauce:")</label>
          <textarea id="wiz-ingredients-raw" rows="6" placeholder="Main Ingredients:&#10;2 x 400g block firm tofu, pressed&#10;1 tsp smoked paprika&#10;&#10;For the dressing:&#10;2 tbsp tahini&#10;1 clove garlic, minced" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; resize: vertical;">${escapeHtml(recipe.ingredientsRaw)}</textarea>
        </div>

        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Method Instructions (1 step per line)</label>
          <textarea id="wiz-method-raw" rows="4" placeholder="1. Press the tofu block and cube.&#10;2. Sauté garlic in olive oil.&#10;3. Add tomatoes and simmer." style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; resize: vertical;">${escapeHtml(recipe.methodRaw)}</textarea>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 20px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
        <button type="button" class="btn primary" id="btn-next-step1a">Next: Parse & Map →</button>
      </div>
    </div>
  `;
}

export function renderState1BBulk() {
  return `
    <div>
      <p style="color: var(--text2, #666); font-size: 13px; margin-bottom: 12px;">Paste multiple recipes separated by headers like "Recipe X:", double line breaks, or full recipe text blocks.</p>

      <textarea id="wiz-bulk-text" rows="12" placeholder="Recipe 1: High-Protein Tofu Bowl&#10;Serves: 4&#10;2 x 400g firm tofu&#10;1 cup milk&#10;&#10;Method:&#10;1. Bake tofu.&#10;&#10;Recipe 2: Smoky Lentil Soup&#10;Serves: 4&#10;200g brown lentils..." style="width: 100%; padding: 12px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; background: var(--surface2, #fbfbf9); resize: vertical; margin-bottom: 16px;">${escapeHtml(wizardState.bulkText)}</textarea>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
        <button type="button" class="btn primary" id="btn-next-step1b">Parse Text & Next →</button>
      </div>
    </div>
  `;
}

export function renderState2Mapping() {
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

      const fallbackBadge = item.isFallbackWeight 
        ? `<span class="badge" style="background:#fef3c7;color:#92400e;font-size:10px;margin-left:4px;" title="Volume converted assuming density table">⚠️ Est. Weight</span>`
        : '';

      rowsHtml += `
        <tr style="border-bottom: 1px solid var(--border, #eee);">
          <td style="padding: 6px;">
            <div style="font-size: 11px; color: var(--text2, #666); font-style: italic;">Raw: "${escapeHtml(item.raw)}"</div>
            ${fallbackBadge}
          </td>
          <td style="padding: 6px; width: 75px;">
            <input type="number" step="any" class="wiz-ing-qty" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${scaledQty}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
          </td>
          <td style="padding: 6px; width: 75px;">
            <select class="wiz-ing-unit" data-sidx="${sIdx}" data-iidx="${iIdx}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;">
              ${['g', 'ml', 'qty'].map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </td>
          <td style="padding: 6px;">
            <input type="text" class="wiz-ing-name" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${escapeAttr(item.name)}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
          </td>
          <td style="padding: 6px; min-width: 220px;">
            ${renderTaxonomySearchHTML(sIdx, iIdx, item, ingredientsBank)}
          </td>
          <td style="padding: 6px; width: 36px; text-align: center;">
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
          ${currServ} servings ➔ ${tgtServ} servings (${scaleFactor.toFixed(2)}x) | Units: g, ml, qty
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

export function renderState3Review() {
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
  (recipe.methodSteps || []).forEach((s) => {
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
