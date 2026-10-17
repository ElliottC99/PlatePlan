/**
 * src/components/recipe/RecipeWizardAliasesPrompt.js (v3.34.0)
 * Modal prompt to optionally learn raw ingredient text as taxonomy aliases.
 * Redesigned for Apple HIG with inset grouped cards and refined typography.
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
    <div class="modal" style="max-width: 480px; width: 92%; padding: 24px; background: var(--surface, #fff); border-radius: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.2); border: 1px solid var(--border, #ddd); display: flex; flex-direction: column;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <div style="width: 32px; height: 32px; background: #e0f2fe; color: #0284c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">💡</div>
        <h3 style="margin: 0; font-size: 17px; font-weight: 700; color: var(--text); letter-spacing: -0.01em;">Learn Ingredient Aliases?</h3>
      </div>
      <p style="font-size: 13px; color: var(--text2, #64748b); margin: 0 0 18px 0; line-height: 1.5;">
        Save these phrases to auto-match them in the future.
      </p>

      <div class="wiz-alias-inset-card" style="background: var(--surface2, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 4px 14px; max-height: 260px; overflow-y: auto; margin-bottom: 20px;">
        ${candidates.map((c, idx) => `
          <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: ${idx === candidates.length - 1 ? 'none' : '1px solid var(--border, #f1f5f9)'}; cursor: pointer;">
            <div style="flex: 1; min-width: 0; padding-right: 12px;">
              <div style="font-size: 12.5px; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${escapeHtml(c.ing.raw)}"</div>
              <div style="font-size: 11px; color: var(--text2); opacity: 0.7;">➔ ${escapeHtml(c.targetName)}</div>
            </div>
            <input type="checkbox" class="wiz-alias-check" data-idx="${idx}" checked style="width: 18px; height: 18px; border-radius: 5px; accent-color: var(--primary, #0284c7); cursor: pointer;" />
          </label>
        `).join('')}
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" class="btn sm" id="btn-skip-aliases" style="padding: 8px 16px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--text2); font-weight: 500;">Skip</button>
        <button type="button" class="btn primary sm" id="btn-save-aliases" style="padding: 8px 20px; border-radius: 10px; background: var(--primary, #0284c7); color: #fff; font-weight: 600;">Save Selected</button>
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
      if (checks.length > 0) {
        for (const chk of checks) {
          const idx = parseInt(chk.dataset.idx, 10);
          const item = candidates[idx];
          if (item && item.ing.ingredientId) {
            await learnIngredientAlias(item.ing.ingredientId, item.ing.raw, item.ing.subtypeId);
          }
        }
      }
      closePrompt();
      onProceed();
    };
  }
}
