/**
 * src/components/recipe/RecipeWizardStep15View.js (v3.33.1)
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
  const state = getState();
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
      <div class="card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; margin-bottom: 10px; background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: transform 0.1s ease;">
        <div style="flex: 1; min-width: 0; padding-right: 14px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--purple, #6366f1); background: #eef2ff; padding: 1px 6px; border-radius: 4px; letter-spacing: 0.02em;">#${idx + 1}</span>
            <h4 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--text, #111); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.01em;">
              ${escapeHtml(title)}
            </h4>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 11.5px;">
            <span style="color: var(--text2, #64748b); font-weight: 500;">🍽️ ${servings} serves</span>
            <span style="color: var(--text2, #64748b); opacity: 0.5;">•</span>
            <span style="color: var(--text2, #64748b); font-weight: 500;">🥗 ${ingCount} ingr.</span>
            <span style="color: var(--text2, #64748b); opacity: 0.5;">•</span>
            <span style="color: var(--text2, #64748b); font-weight: 500;">📋 ${stepCount} step${stepCount === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- HIG Segmented Stepper Pill -->
          <div class="queue-reorder-stepper" style="display: flex; flex-direction: column; background: var(--surface2, #f1f5f9); border: 1px solid var(--border, #e2e8f0); border-radius: 8px; overflow: hidden; width: 28px;">
            <button 
              type="button" 
              class="move-up" 
              data-index="${idx}" 
              ${idx === 0 ? 'disabled' : ''} 
              style="background: transparent; border: none; padding: 5px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted, #64748b); font-size: 9px; line-height: 1; transition: all 0.15s ease;"
              title="Move dish up"
              aria-label="Move dish up"
            >
              ▲
            </button>
            <div style="height: 1px; background: var(--border, #e2e8f0); width: 100%;"></div>
            <button 
              type="button" 
              class="move-down" 
              data-index="${idx}" 
              ${idx === queueCount - 1 ? 'disabled' : ''} 
              style="background: transparent; border: none; padding: 5px 0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted, #64748b); font-size: 9px; line-height: 1; transition: all 0.15s ease;"
              title="Move dish down"
              aria-label="Move dish down"
            >
              ▼
            </button>
          </div>

          <!-- Delete Action Icon Button -->
          <button 
            type="button" 
            class="wiz-queue-remove-btn" 
            data-qidx="${idx}" 
            style="background: transparent; border: 1px solid transparent; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text2, #94a3b8); transition: all 0.15s ease;"
            title="Remove recipe from queue"
            aria-label="Remove recipe from queue"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <style>
      .queue-reorder-stepper button:hover:not(:disabled) { background: rgba(0, 0, 0, 0.05); color: var(--text, #0f172a) !important; }
      .queue-reorder-stepper button:disabled { opacity: 0.2; cursor: not-allowed; }
      .wiz-queue-remove-btn:hover { color: var(--danger, #ef4444) !important; background: #fef2f2 !important; border-color: #fecdd3 !important; }
    </style>
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
