/**
 * src/components/prep/PrepStepCard.js (v3.9.1)
 * Modular ES6 Component for Meal Prep Step Cards:
 * - Handles step-by-step cooking instructions and sequence numbering
 * - Built-in countdown timer triggers & alerts
 * - Interactive ingredient checklist toggles per step
 */

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

/**
 * Renders a single step-by-step prep cooking card with timers and checklist toggles.
 * @param {Object} step Step object { stepNumber, instruction, timerSeconds, ingredients, completed }
 * @param {number} index Step index
 * @returns {string} HTML template literal
 */
export function renderPrepStepCard(step = {}, index = 0) {
  const num = step.stepNumber || (index + 1);
  const text = step.instruction || step.step || '';
  const timer = +step.timerSeconds || +step.timeMinutes * 60 || 0;
  const ingredients = Array.isArray(step.ingredients) ? step.ingredients : [];
  const completed = !!step.completed;

  const timerHtml = timer > 0 ? `
    <button type="button" class="btn sm ghost prep-timer-btn" onclick="startPrepTimer(${timer}, 'Step ${num}')" style="font-size:11px;color:var(--purple);border-color:var(--purple);padding:2px 8px">
      ⏱️ Start Timer (${Math.ceil(timer / 60)} mins)
    </button>
  ` : '';

  const checklistHtml = ingredients.length ? `
    <div class="prep-step-checklist" style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border);font-size:12px;color:var(--text2)">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);margin-bottom:4px">Ingredients for this step:</div>
      ${ingredients.map((ing, i) => `
        <label style="display:flex;align-items:center;gap:6px;margin-bottom:3px;cursor:pointer">
          <input type="checkbox" onchange="togglePrepStepIngredient(${index}, ${i}, this.checked)" ${ing.checked ? 'checked' : ''}>
          <span style="${ing.checked ? 'text-decoration:line-through;color:var(--text3)' : ''}">${escapeHtml(ing.name || ing)}</span>
        </label>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="card prep-step-card ${completed ? 'completed' : ''}" data-step-index="${index}" style="margin-bottom:10px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);transition:opacity 0.2s">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="display:flex;align-items:flex-start;gap:10px;flex:1">
          <span class="prep-step-num" style="background:var(--purple);color:#fff;font-weight:700;font-size:12px;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${num}</span>
          <div style="flex:1">
            <div class="prep-step-text" style="font-size:13.5px;color:var(--text);line-height:1.45;${completed ? 'text-decoration:line-through;color:var(--text3)' : ''}">
              ${escapeHtml(text)}
            </div>
            ${checklistHtml}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <button type="button" class="btn sm ${completed ? 'ghost' : 'primary'}" onclick="togglePrepStepComplete(${index})" style="font-size:11px;padding:3px 8px">
            ${completed ? '✓ Done' : 'Mark Done'}
          </button>
          ${timerHtml}
        </div>
      </div>
    </div>
  `;
}
