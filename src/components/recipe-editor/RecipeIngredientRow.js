/**
 * src/components/recipe-editor/RecipeIngredientRow.js (v3.8.1)
 * UI component for recipe editor ingredient rows, unit selectors,
 * drag-and-drop handles, and quantity inputs.
 */

import { checkStockCubeWaterRequirement } from '../../utils/unitConverter.js';

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

export function renderReviewUnitSelect(unit, prefix, name = '') {
  const inferFn = window.UnitConverter?.inferParsedUnitForIngredient || (i => i?.unit || 'g');
  const current = inferFn({ unit, name });
  const units = ['g', 'ml', 'qty'];
  const options = units.map(u => `<option value="${u}" ${current === u ? 'selected' : ''}>${u}</option>`).join('');
  return `<select id="${escapeAttr(prefix)}-r-unit" class="r-unit" aria-label="Unit" style="width:100%;min-width:0;border:1px solid var(--border);border-radius:8px;padding:0 5px;background:var(--surface);color:var(--text)" onchange="recalcModal('${escapeAttr(prefix)}')" name="unit">${options}</select>`;
}

export function renderSectionInput(className, value, listId, onChange, width = '120px') {
  return `<input id="${escapeAttr(listId)}-section" type="search" aria-label="Section" class="${escapeAttr(className)}" value="${escapeAttr(value || '')}" list="${escapeAttr(listId)}" placeholder="Section" title="Optional mini-section, e.g. For the Burger" style="width:${width};" oninput="${onChange}" name="section">`;
}

export function renderIngredientRowHtml(p, prefix, options = {}) {
  const amount = window.UnitConverter?.normaliseRecipeAmountForUi(p) || { qty: parseFloat(p?.qty) || 1, unit: p?.unit || 'qty' };
  const family = p.ingredientId && window.getIngredientFamily ? window.getIngredientFamily(p.ingredientId) : null;
  const displayName = p.mappedViaIngredient && family ? family.name : (p.name || '');
  const groupId = p.groupId || (window.getRecipeIngredientGroupId ? window.getRecipeIngredientGroupId(p) : '') || '';
  const group = groupId && window.getIngredientGroup ? window.getIngredientGroup(groupId) : null;
  const resolved = window.resolveProductForIngredient ? window.resolveProductForIngredient({ ...p, groupId }) : {};
  const product = resolved.product;
  const mappingText = group ? `${window.getGroupHierarchyText ? window.getGroupHierarchyText(group) : group.name}${product?.name ? ` · ${product.name}` : ''}` : (product?.name || 'Not mapped yet');

  const stockCheck = checkStockCubeWaterRequirement({ ...p, name: displayName });
  const waterInputHtml = stockCheck.requiresWaterInput ? `
    <div class="r-stock-water-wrapper" style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--surface2); border-radius:6px; font-size:11.5px; margin-top:4px; border:1px dashed var(--border);">
      <span style="font-weight:600; color:var(--text);">💧 Required Water Volume for Stock Cube (ml):</span>
      <input id="${escapeAttr(prefix)}-stock-water" type="number" aria-label="Required stock water volume (ml)" class="r-stock-water" value="${escapeAttr(p.stockWaterMl || stockCheck.defaultWaterMlPerCube || '400')}" style="width:90px; padding:3px 6px; font-size:11.5px;" min="0" step="50" oninput="recalcModal('${escapeAttr(prefix)}')" name="stockWaterMl">
      <span style="color:var(--text2);">(ml water needed)</span>
    </div>
  ` : '';

  return `<div class="rev-ing-row review-ingredient-row mobile-editor-card" draggable="true" ondragstart="startReviewIngredientDrag(event)" ondragover="overReviewIngredientDrag(event)" ondragend="endReviewIngredientDrag(event, '${escapeAttr(prefix)}')" data-bankid="${escapeAttr(p.bankId || '')}" data-original-bankid="${escapeAttr(p.originalBankId || p.bankId || '')}" data-original-key="${escapeAttr(p.originalKey || p.originalGroupId || p.originalBankId || (window.getRecipeIngredientKey ? window.getRecipeIngredientKey(p) : ''))}" data-groupid="${escapeAttr(groupId)}" data-ingredientid="${escapeAttr(p.ingredientId || '')}" data-mapped-via-ingredient="${p.mappedViaIngredient ? '1' : ''}" data-prefix="${escapeAttr(prefix)}" data-stock-water="${escapeAttr(p.stockWaterMl || '')}">
    <span class="review-drag-handle" title="Drag to reorder" style="cursor:grab;color:var(--text3);font-size:16px;text-align:center;line-height:1;user-select:none;">⋮</span>
    <div class="review-ingredient-qty"><span class="mobile-field-label">Quantity</span><input id="${escapeAttr(prefix)}-r-qty" type="number" aria-label="Quantity" class="r-qty" value="${amount.qty || 1}" style="width:100%;min-width:0" step="0.1" min="0" oninput="recalcModal('${escapeAttr(prefix)}')" name="qty"></div>
    <div class="review-ingredient-unit"><span class="mobile-field-label">Unit</span>${renderReviewUnitSelect(amount.unit || 'qty', prefix, p.name || '')}</div>
    <div class="review-ingredient-section"><span class="mobile-field-label">Section</span>${renderSectionInput('r-section', p.section || '', `${prefix}-section-options`, `refreshReviewSectionOptions('${escapeAttr(prefix)}'); recalcModal('${escapeAttr(prefix)}')`, '100%')}</div>
    <div class="review-ingredient-name" style="position:relative;min-width:0"><span class="mobile-field-label">Ingredient</span><input id="${escapeAttr(prefix)}-r-name" type="text" name="name" aria-label="Ingredient name" class="r-name" value="${escapeAttr(displayName || '')}" style="width:100%;min-width:0" oninput="handleReviewIngredientNameInput(this, '${escapeAttr(prefix)}')" onfocus="renderReviewIngredientSearch(this, '${escapeAttr(prefix)}')" onblur="setTimeout(function(){closeReviewIngredientSearchDropdown(this.closest('.rev-ing-row'))},160)"><div class="review-mapping-status${group || product ? '' : ' unmapped'}" onclick="openReviewMappingModalFromStatus(this)" style="cursor:pointer" title="Click to map or change product">${escapeHtml(mappingText)}</div><div class="r-row-error" style="display:none;color:var(--red);font-size:10px;line-height:1.25;margin-top:3px;"></div></div>
    <label class="review-exclude-control" title="Keep this in the recipe and shopping list, but exclude it from nutrition totals."><input id="${escapeAttr(prefix)}-r-exclude" type="checkbox" aria-label="Exclude from nutrition" class="r-exclude-nutrition" ${p.excludeNutrition ? 'checked' : ''} onchange="recalcModal('${escapeAttr(prefix)}')" name="excludeNutrition"><span class="review-exclude-label">Not eaten / exclude from nutrition</span></label>
    <div class="review-desktop-actions" style="display:flex;gap:4px;justify-content:flex-end;align-items:center;">
      <button type="button" class="btn sm ghost r-edit-ing" onclick="editModalRowIngredient(this)" style="padding:4px 6px;font-size:10px;display:${p.bankId ? 'inline-block' : 'none'}">Edit</button>
      <button type="button" class="btn sm ghost r-replace-ing" onclick="openModalIngredientReplace(this)" style="padding:4px 6px;font-size:10px">Replace</button>
      <button class="btn sm danger ghost" onclick="removeReviewIngredientRow(this, '${escapeAttr(prefix)}')">&times;</button>
    </div>
    <div class="review-mobile-actions"><button type="button" class="btn ghost r-replace-ing" onclick="openModalIngredientReplace(this)">Replace</button><button type="button" class="btn ghost" onclick="openReviewIngredientActions(this, '${escapeAttr(prefix)}')">More</button></div>
    ${waterInputHtml}
  </div>`;
}

export function renderModalIngredientsList(prefix, ings = []) {
  const header = `<div class="rev-ing-header review-ingredient-row" style="margin-bottom:4px;font-size:11px;color:var(--text2);font-weight:600;">
     <span></span>
     <span>Qty</span>
     <span>Unit</span>
     <span>Section</span>
     <span>Ingredient</span>
     <span style="text-align:center;" title="Keep in the recipe and shopping list, but exclude from nutrition totals.">Not eaten</span>
     <span style="text-align:center;">Actions</span>
  </div>`;
  const rows = (ings || []).map(ing => {
    const p = typeof ing === 'string' ? (window.UnitConverter?.parseIngredientLine?.(ing) || { raw: ing, name: ing, qty: 1, unit: 'qty' }) : ing;
    if (!p) return '';
    return renderIngredientRowHtml(p, prefix);
  }).join('');
  return header + rows + `<datalist id="${prefix}-section-options"></datalist>`;
}

export function createBlankIngredientRow(prefix) {
  const div = document.createElement('div');
  div.className = 'rev-ing-row review-ingredient-row mobile-editor-card';
  div.dataset.bankid = '';
  div.dataset.originalBankid = '';
  div.dataset.originalKey = '';
  div.dataset.groupid = '';
  div.dataset.ingredientid = '';
  div.dataset.mappedViaIngredient = '';
  div.dataset.prefix = prefix;
  div.draggable = true;
  div.setAttribute('ondragstart', 'startReviewIngredientDrag(event)');
  div.setAttribute('ondragover', 'overReviewIngredientDrag(event)');
  div.setAttribute('ondragend', `endReviewIngredientDrag(event, '${prefix}')`);
  div.innerHTML = `<span class="review-drag-handle" title="Drag to reorder" style="cursor:grab;color:var(--text3);font-size:16px;text-align:center;line-height:1;user-select:none;">⋮</span>
     <div class="review-ingredient-qty"><span class="mobile-field-label">Quantity</span><input id="${prefix}-r-qty" type="number" aria-label="Quantity" class="r-qty" value="1" style="width:100%;min-width:0" step="0.1" min="0" oninput="recalcModal('${prefix}')" name="qty"></div>
     <div class="review-ingredient-unit"><span class="mobile-field-label">Unit</span>${renderReviewUnitSelect('qty', prefix)}</div>
     <div class="review-ingredient-section"><span class="mobile-field-label">Section</span>${renderSectionInput('r-section', '', `${prefix}-section-options`, `refreshReviewSectionOptions('${prefix}'); recalcModal('${prefix}')`, '100%')}</div>
     <div class="review-ingredient-name" style="position:relative;min-width:0"><span class="mobile-field-label">Ingredient</span><input id="${prefix}-r-name" type="text" name="name" aria-label="Ingredient name" class="r-name" value="" style="width:100%;min-width:0" oninput="handleReviewIngredientNameInput(this, '${prefix}')" onfocus="renderReviewIngredientSearch(this, '${prefix}')" onblur="setTimeout(function(){closeReviewIngredientSearchDropdown(this.closest('.rev-ing-row'))},160)"><div class="review-mapping-status unmapped" onclick="openReviewMappingModalFromStatus(this)" style="cursor:pointer" title="Click to map product">Not mapped yet</div><div class="r-row-error" style="display:none;color:var(--red);font-size:10px;line-height:1.25;margin-top:3px;"></div></div>
     <label class="review-exclude-control" title="Keep this in the recipe and shopping list, but exclude it from nutrition totals."><input id="${prefix}-r-exclude" type="checkbox" aria-label="Exclude from nutrition" class="r-exclude-nutrition" onchange="recalcModal('${prefix}')" name="excludeNutrition"><span class="review-exclude-label">Not eaten / exclude from nutrition</span></label>
     <div class="review-desktop-actions" style="display:flex;gap:4px;justify-content:flex-end;align-items:center;">
       <button type="button" class="btn sm ghost r-edit-ing" onclick="editModalRowIngredient(this)" style="padding:4px 6px;font-size:10px;display:none">Edit</button>
       <button type="button" class="btn sm ghost r-replace-ing" onclick="openModalIngredientReplace(this)" style="padding:4px 6px;font-size:10px">Replace</button>
       <button class="btn sm danger ghost" onclick="removeReviewIngredientRow(this, '${prefix}')">&times;</button>
     </div>
     <div class="review-mobile-actions"><button type="button" class="btn ghost r-replace-ing" onclick="openModalIngredientReplace(this)">Replace</button><button type="button" class="btn ghost" onclick="openReviewIngredientActions(this, '${prefix}')">More</button></div>`;
  return div;
}
