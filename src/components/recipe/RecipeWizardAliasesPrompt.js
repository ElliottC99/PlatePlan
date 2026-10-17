/**
 * src/components/recipe/RecipeWizardAliasesPrompt.js (v3.32.0)
 * Modal prompt to optionally learn raw ingredient text as taxonomy aliases.
 */

import { getState, learnIngredientAlias } from '../../store/store.js';

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
 * Prompts user to save mapped ingredients as aliases before proceeding to Step 3.
 * @param {Array} allIngs
 * @param {Function} onProceed
 */
export function promptRecipeWizardAliases(allIngs, onProceed) {
  const storeState = getState() || {};
  const bank = storeState.ingredients || [];

  const candidates = [];
  allIngs.forEach(ing => {
    if (!ing.raw || !ing.ingredientId) return;
    const targetIng = bank.find(i => String(i.id) === String(ing.ingredientId));
    if (!targetIng) return;

    let targetName = targetIng.name;
    let targetDoc = targetIng;
    if (ing.subtypeId && Array.isArray(targetIng.subtypes)) {
      const sub = targetIng.subtypes.find(s => String(s.id) === String(ing.subtypeId));
      if (sub) {
        targetName = `${targetIng.name} (${sub.name})`;
        targetDoc = sub;
      }
    }

    const rawClean = String(ing.raw).trim().toLowerCase();
    const existingAliases = (targetDoc.aliases || []).map(a => String(a).toLowerCase());
    const isAlreadyKnown = rawClean === targetName.toLowerCase() || existingAliases.includes(rawClean);

    if (!isAlreadyKnown && rawClean.length > 2) {
      candidates.push({ ing, targetName, rawClean });
    }
  });

  if (candidates.length === 0) {
    onProceed();
    return;
  }

  let promptEl = document.getElementById('wiz-alias-prompt-modal');
  if (!promptEl) {
    promptEl = document.createElement('div');
    promptEl.id = 'wiz-alias-prompt-modal';
    promptEl.className = 'modal-wrap open';
    promptEl.style.zIndex = '1300';
    document.body.appendChild(promptEl);
  }

  promptEl.innerHTML = `
    <div class="modal-backdrop" id="wiz-alias-backdrop"></div>
    <div class="modal" style="max-width: 480px; width: 90%; padding: 22px; background: var(--surface, #fff); border-radius: 14px; box-shadow: 0 16px 48px rgba(0,0,0,0.3); border: 1px solid var(--border, #ddd);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 20px;">💡</span>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Save Raw Text as Learned Aliases?</h3>
      </div>
      <p style="font-size: 12.5px; color: var(--text2, #555); margin: 0 0 14px 0; line-height: 1.4;">
        Would you like to save these raw ingredient text strings as aliases to their mapped Category / Item / Sub-Type for future auto-matching?
      </p>

      <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; background: var(--surface2, #f9f8f6); padding: 10px; border-radius: 8px; border: 1px solid var(--border, #e5e7eb);">
        ${candidates.map((c, idx) => `
          <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" class="wiz-alias-check" data-idx="${idx}" checked style="margin-top: 2px;" />
            <span>"${escapeHtml(c.ing.raw)}" ➔ <strong>${escapeHtml(c.targetName)}</strong></span>
          </label>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border, #eee); padding-top: 12px;">
        <button type="button" class="btn ghost sm" id="btn-skip-aliases">Skip & Continue →</button>
        <button type="button" class="btn primary sm" id="btn-save-aliases">Save Selected Aliases & Continue →</button>
      </div>
    </div>
  `;

  const closePrompt = () => promptEl.remove();

  const btnSkip = promptEl.querySelector('#btn-skip-aliases');
  if (btnSkip) {
    btnSkip.onclick = () => {
      closePrompt();
      onProceed();
    };
  }

  const btnSave = promptEl.querySelector('#btn-save-aliases');
  if (btnSave) {
    btnSave.onclick = async () => {
      const checks = promptEl.querySelectorAll('.wiz-alias-check:checked');
      for (const chk of checks) {
        const idx = parseInt(chk.dataset.idx, 10);
        const item = candidates[idx];
        if (item && item.ing.ingredientId) {
          await learnIngredientAlias(item.ing.ingredientId, item.ing.raw, item.ing.subtypeId);
        }
      }
      closePrompt();
      onProceed();
    };
  }
}
