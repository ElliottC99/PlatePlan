/**
 * src/components/recipe/RecipeWizardViews.js (v3.35.2)
 * Template view rendering functions for Choice and Ingestion steps of the Recipe Ingestion Wizard.
 */

import { wizardState, MEAL_TAGS } from './RecipeWizardState.js';

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

export { renderState2Mapping } from './RecipeWizardStep2View.js';
export { renderState3Review, renderMacroBreakdownCrossbar } from './RecipeWizardStep3View.js';

export function renderStepBadge() {
  const step = wizardState.currentStep;
  if (step === 0) return `<span class="badge" style="background:var(--surface2, #e8e6df);color:var(--text2, #555);">Choice</span>`;
  if (step === 1) return `<span class="badge badge-purple" style="background:#eef2ff;color:#4f46e5;">Step 1: Ingestion</span>`;
  if (step === 1.5) return `<span class="badge badge-amber" style="background:#fef3c7;color:#b45309;font-weight:600;">Step 1.5: Recipe Review Queue (${wizardState.processingQueue.length} Detected)</span>`;
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
  const queueInfo = wizardState.initialQueueTotal > 1
    ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 16px;">
        📌 Batch Queue: Recipe ${wizardState.currentQueueIndex || 1} of ${wizardState.initialQueueTotal} (${wizardState.processingQueue.length} remaining)
       </div>`
    : '';

  const mealTagsHtml = MEAL_TAGS.map(tag => {
    const isSelected = recipe.mealSuitability.includes(tag);
    return `<label style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 10px; border: 1px solid var(--border, #ccc); border-radius: 999px; background: ${isSelected ? 'var(--purple-bg, #eef2ff)' : 'var(--surface, #fff)'}; color: ${isSelected ? 'var(--purple, #4f46e5)' : 'var(--text, #333)'}; cursor: pointer;">
      <input type="checkbox" id="wiz-meal-tag-${tag.toLowerCase()}" name="wiz_meal_tag_${tag.toLowerCase()}" aria-label="Meal tag ${tag}" class="wiz-meal-tag" value="${tag}" ${isSelected ? 'checked' : ''} style="display:none;" />
      ${tag}
    </label>`;
  }).join(' ');

  return `
    <div>
      ${queueInfo}
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <label for="wiz-title" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Recipe Title</label>
          <input type="text" id="wiz-title" name="title" value="${escapeAttr(recipe.title)}" placeholder="e.g. High-Protein Crispy Tofu Curry" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff); color: var(--text, #111);" />
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          <div>
            <label for="wiz-current-servings" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Current Servings</label>
            <input type="number" id="wiz-current-servings" name="current_servings" value="${recipe.currentServings}" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff);" />
          </div>
          <div>
            <label for="wiz-target-servings" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Target Servings</label>
            <input type="number" id="wiz-target-servings" name="target_servings" value="${recipe.targetServings}" min="1" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 14px; background: var(--surface, #fff);" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          <div>
            <label for="wiz-prep-hours" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Prep Time (Hours & Mins)</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="wiz-prep-hours" name="prep_hours" aria-label="Prep hours" placeholder="0 hr" value="${recipe.prepTime.hours}" min="0" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
              <input type="number" id="wiz-prep-mins" name="prep_minutes" aria-label="Prep minutes" placeholder="15 min" value="${recipe.prepTime.minutes}" min="0" max="59" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
            </div>
          </div>
          <div>
            <label for="wiz-cook-hours" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Cook Time (Hours & Mins)</label>
            <div style="display: flex; gap: 6px;">
              <input type="number" id="wiz-cook-hours" name="cook_hours" aria-label="Cook hours" placeholder="0 hr" value="${recipe.cookTime.hours}" min="0" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
              <input type="number" id="wiz-cook-mins" name="cook_minutes" aria-label="Cook minutes" placeholder="30 min" value="${recipe.cookTime.minutes}" min="0" max="59" style="width: 50%; padding: 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px;" />
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
          <label for="wiz-ingredients-raw" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Ingredients (1 per line or sections with headers e.g. "For the sauce:")</label>
          <textarea id="wiz-ingredients-raw" name="wiz_ingredients_raw" rows="6" placeholder="Main Ingredients:&#10;2 x 400g block firm tofu, pressed&#10;1 tsp smoked paprika&#10;&#10;For the dressing:&#10;2 tbsp tahini&#10;1 clove garlic, minced" style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; resize: vertical;">${escapeHtml(recipe.ingredientsRaw)}</textarea>
        </div>

        <div>
          <label for="wiz-method-raw" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Method Instructions (1 step per line)</label>
          <textarea id="wiz-method-raw" name="method_raw" rows="4" placeholder="1. Press the tofu block and cube.&#10;2. Sauté garlic in olive oil.&#10;3. Add tomatoes and simmer." style="width: 100%; padding: 10px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; resize: vertical;">${escapeHtml(recipe.methodRaw)}</textarea>
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

      <textarea id="wiz-bulk-text" name="bulk_text" aria-label="Paste bulk recipe text" rows="12" placeholder="Recipe 1: High-Protein Tofu Bowl&#10;Serves: 4&#10;2 x 400g firm tofu&#10;1 cup milk&#10;&#10;Method:&#10;1. Bake tofu.&#10;&#10;Recipe 2: Smoky Lentil Soup&#10;Serves: 4&#10;200g brown lentils..." style="width: 100%; padding: 12px; border: 1px solid var(--border, #ccc); border-radius: 8px; font-size: 13px; font-family: monospace; background: var(--surface2, #fbfbf9); resize: vertical; margin-bottom: 16px;">${escapeHtml(wizardState.bulkText)}</textarea>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(0)">← Choice</button>
        <button type="button" class="btn primary" id="btn-next-step1b">Parse Text & Next →</button>
      </div>
    </div>
  `;
}
