/**
 * src/components/recipe-editor/RecipeStepRow.js (v3.8.1)
 * UI component for recipe editor preparation steps, drag/reindex,
 * and method text manipulation.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function renderRecipeStepRow(stepText, index, prefix) {
  const stepId = `recipe-step-${prefix}-${index}`;
  return `<div class="rev-method-row" style="display:flex;gap:5px;margin-bottom:5px;align-items:flex-start;">
    <label for="${stepId}" style="font-size:12px;font-weight:600;margin-top:8px;width:20px;">${index + 1}.</label>
    <textarea id="${stepId}" name="step_${index}" class="r-step" style="flex:1;min-height:40px;" oninput="updateSaveBothVisibility()">${escapeHtml(stepText || '')}</textarea>
    <button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexModalMethod('${escapeAttr(prefix)}'); updateSaveBothVisibility();">&times;</button>
  </div>`;
}

export function renderModalMethodList(prefix, steps = []) {
  return (steps || []).map((s, i) => renderRecipeStepRow(s, i, prefix)).join('');
}

export function createBlankMethodRow(prefix) {
  const div = document.createElement('div');
  div.className = 'rev-method-row';
  div.style.cssText = 'display:flex;gap:5px;margin-bottom:5px;align-items:flex-start;';
  const stepId = `recipe-step-blank-${Date.now()}`;
  div.innerHTML = `
    <label for="${stepId}" class="visually-hidden">Step Description</label>
    <textarea id="${stepId}" name="${stepId}" class="r-step" style="flex:1;min-height:40px;" oninput="updateSaveBothVisibility()"></textarea>
    <button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexModalMethod('${escapeAttr(prefix)}'); updateSaveBothVisibility();">&times;</button>`;
  return div;
}

export function reindexModalMethodRows(prefix) {
  const rows = document.querySelectorAll(`#${prefix}-method-list .rev-method-row`);
  rows.forEach((r, i) => {
    const span = r.querySelector('.step-num');
    if (span) span.textContent = (i + 1) + '.';
  });
}

export function copyOriginalMethodToEnhanced() {
  const steps = Array.from(document.querySelectorAll('#orig-method-list .r-step'))
    .map(el => (el.value || '').trim())
    .filter(Boolean);
  const target = document.getElementById('enh-method-list');
  if (target) {
    target.innerHTML = renderModalMethodList('enh', steps);
    reindexModalMethodRows('enh');
  }
  if (typeof window.updateSaveBothVisibility === 'function') window.updateSaveBothVisibility();
}
