/**
 * src/components/recipe/RecipeWizardStep15View.js (v3.32.0)
 * View rendering for Step 1.5: Multi-Recipe Batch Review Queue.
 */

import { wizardState } from './RecipeWizardState.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { getState } from '../../store/store.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders the Step 1.5 Recipe Review Queue screen.
 * @returns {string} HTML markup
 */
export function renderStep1Point5() {
  const state = getState() || {};
  const queue = state.draftRecipes || wizardState.processingQueue || [];
  const queueCount = queue.length;

  if (queueCount === 0) {
    return `
      <div style="text-align: center; padding: 40px 16px;">
        <p style="font-size: 16px; color: var(--text2, #666); margin-bottom: 20px;">No recipes currently in the queue.</p>
        <button type="button" id="btn-repaste-text" class="btn secondary">← Back to Paste Text</button>
      </div>
    `;
  }

  const cardsHtml = queue.map((recipe, idx) => {
    const rawIngs = recipe.ingredients || (recipe.ingredientSections || []).flatMap(s => s.ingredients || []);
    const ingCount = rawIngs.length;
    const steps = recipe.instructions || recipe.methodSteps || [];
    const stepCount = steps.length;
    const servings = recipe.servings || 4;
    const title = toTitleCase(recipe.title || 'Untitled Recipe');

    return `
      <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; margin-bottom: 12px; background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="flex: 1; min-width: 0; padding-right: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--purple, #6366f1); background: #eef2ff; padding: 2px 8px; border-radius: 4px;">#${idx + 1}</span>
            <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--text, #111); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(title)}
            </h4>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px;">
            <span style="background: var(--surface2, #f3f4f6); color: var(--text2, #4b5563); padding: 2px 8px; border-radius: 4px; font-weight: 500;">
              🍽️ Servings: ${servings}
            </span>
            <span style="background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 4px; font-weight: 500;">
              🥗 ${ingCount} ingredient${ingCount === 1 ? '' : 's'}
            </span>
            <span style="background: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 4px; font-weight: 500;">
              📋 ${stepCount} step${stepCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <button type="button" class="btn-icon move-up" data-index="${idx}" aria-label="Move Up" ${idx === 0 ? 'disabled' : ''} style="cursor: ${idx === 0 ? 'not-allowed' : 'pointer'}; opacity: ${idx === 0 ? '0.3' : '1'};">▲</button>
            <button type="button" class="btn-icon move-down" data-index="${idx}" aria-label="Move Down" ${idx === queueCount - 1 ? 'disabled' : ''} style="cursor: ${idx === queueCount - 1 ? 'not-allowed' : 'pointer'}; opacity: ${idx === queueCount - 1 ? '0.3' : '1'};">▼</button>
          </div>
          <button type="button" class="btn ghost sm wiz-queue-remove-btn" data-qidx="${idx}" aria-label="Remove recipe from queue" title="Remove recipe" style="color: #9ca3af; padding: 6px 10px; border-radius: 6px; font-size: 16px; cursor: pointer; border: none; background: transparent;">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="padding: 4px 2px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px;">
        <div>
          <h3 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: var(--text, #111);">Review Recipe Queue</h3>
          <p style="margin: 0; font-size: 13px; color: var(--text2, #6b7280);">
            We identified <strong>${queueCount} distinct recipe${queueCount === 1 ? '' : 's'}</strong> in your pasted text. Review the list below or import them all.
          </p>
        </div>
      </div>

      <div id="wiz-queue-list-container" style="max-height: 48vh; overflow-y: auto; margin-bottom: 20px; padding-right: 4px;">
        ${cardsHtml}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 16px; margin-top: 10px;">
        <button type="button" id="btn-repaste-text" class="btn ghost sm" style="cursor: pointer;">
          ← Re-paste Text
        </button>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button type="button" id="btn-import-all-direct" class="btn secondary sm" style="cursor: pointer; font-weight: 600;">
            ⚡ Import All Recipes Directly
          </button>
          <button type="button" id="btn-start-queue-review" class="btn primary sm" style="cursor: pointer; font-weight: 600;">
            Review & Map Recipes (1 of ${queueCount}) →
          </button>
        </div>
      </div>
    </div>
  `;
}
