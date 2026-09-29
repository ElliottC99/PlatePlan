/**
 * src/components/recipe-editor/IngredientEditorRows.js (v3.8.9)
 * Modular UI component for Recipe Ingredient Editor Rows:
 * - Dynamic ingredient row templates & quantity/unit pickers
 * - Section input fields, ingredient search dropdowns, and reorder controls
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
 * Renders a single ingredient editor row template for authoring forms.
 */
export function renderIngredientEditorRow(ing = {}, index = 0, prefix = 'orig') {
  const name = ing.name || ing.item || '';
  const qty = ing.amount || ing.qty || '';
  const unit = ing.unit || 'g';
  const section = ing.section || '';

  return `
    <div class="ingredient-editor-row" data-index="${index}" data-prefix="${prefix}" draggable="true" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span class="drag-handle" style="cursor:grab;color:var(--text3);font-size:16px">⋮⋮</span>
      <input type="text" class="input input-qty" style="width:70px" placeholder="Qty" value="${escapeAttr(qty)}" onchange="updateIngredientRowField('${prefix}', ${index}, 'amount', this.value)">
      <select class="select select-unit" style="width:80px" onchange="updateIngredientRowField('${prefix}', ${index}, 'unit', this.value)">
        <option value="g" ${unit === 'g' ? 'selected' : ''}>g</option>
        <option value="kg" ${unit === 'kg' ? 'selected' : ''}>kg</option>
        <option value="ml" ${unit === 'ml' ? 'selected' : ''}>ml</option>
        <option value="l" ${unit === 'l' ? 'selected' : ''}>l</option>
        <option value="tsp" ${unit === 'tsp' ? 'selected' : ''}>tsp</option>
        <option value="tbsp" ${unit === 'tbsp' ? 'selected' : ''}>tbsp</option>
        <option value="cup" ${unit === 'cup' ? 'selected' : ''}>cup</option>
        <option value="clove" ${unit === 'clove' ? 'selected' : ''}>clove</option>
        <option value="item" ${unit === 'item' || unit === 'qty' ? 'selected' : ''}>item</option>
        <option value="pinch" ${unit === 'pinch' ? 'selected' : ''}>pinch</option>
      </select>
      <input type="text" class="input input-name" style="flex:1;min-width:140px" placeholder="Ingredient name" value="${escapeAttr(name)}" oninput="handleReviewIngredientNameInput(this, '${prefix}')">
      <input type="text" class="input input-section" style="width:110px" placeholder="Section (opt)" value="${escapeAttr(section)}" onchange="updateIngredientRowField('${prefix}', ${index}, 'section', this.value)">
      <button type="button" class="btn sm danger" onclick="removeReviewIngredientRow(this, '${prefix}')" title="Remove ingredient">×</button>
    </div>
  `;
}

/**
 * Renders the full container list of ingredient editor rows.
 */
export function renderIngredientEditorList(ingredients = [], prefix = 'orig') {
  if (!ingredients || ingredients.length === 0) {
    return `<div style="font-size:12px;color:var(--text2);padding:12px 0;text-align:center">No ingredients added yet. Click "+ Add Ingredient" to start.</div>`;
  }
  return ingredients.map((ing, idx) => renderIngredientEditorRow(ing, idx, prefix)).join('');
}
