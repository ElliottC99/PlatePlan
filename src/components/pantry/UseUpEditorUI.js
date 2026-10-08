/**
 * src/components/pantry/UseUpEditorUI.js (v3.9.4)
 * Presentation Component for Use Up Products Editor & Suggestions
 */

function escapeHtml(str) {
  if (typeof window !== 'undefined' && window.ppEscapeHtml) {
    return window.ppEscapeHtml(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (typeof window !== 'undefined' && window.ppEscapeAttr) {
    return window.ppEscapeAttr(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function getHierarchyText(entry) {
  if (typeof window !== 'undefined' && window.getIngredientGroup && window.getGroupHierarchyText) {
    const group = window.getIngredientGroup(entry.product?.groupId) || { cat: entry.product?.cat, name: entry.product?.name };
    return window.getGroupHierarchyText(group);
  }
  return entry.product?.cat || '';
}

/**
 * Render HTML for #use-up-products-editor inner content
 */
export function renderEditor(entries = []) {
  const listItemsHtml = entries.length
    ? entries.map(entry => {
        const pName = escapeHtml(entry.product.name);
        const pAttr = escapeAttr(entry.productId);
        const hierarchy = escapeHtml(getHierarchyText(entry));
        const qtyVal = entry.quantity || '';
        const unitVal = entry.unit || 'unknown';

        const unitOptions = [
          ['unknown', 'Unknown'],
          ['g', 'grams'],
          ['ml', 'millilitres'],
          ['item', 'items'],
          ['pack', 'packs']
        ].map(([val, label]) => `<option value="${val}"${unitVal === val ? ' selected' : ''}>${label}</option>`).join('');

        return `<div class="use-up-row">
          <div class="use-up-product">
            <strong>${pName}</strong>
            <small>${hierarchy}</small>
          </div>
          <input type="number" min="0" step="0.1" value="${qtyVal}" aria-label="Available quantity for ${escapeAttr(entry.product.name)}" oninput="updateUseUpProduct('${pAttr}','quantity',this.value,false)" name="input-field">
          <select aria-label="Available unit for ${escapeAttr(entry.product.name)}" onchange="updateUseUpProduct('${pAttr}','unit',this.value,false)" name="select-field">
            ${unitOptions}
          </select>
          <button class="btn sm ghost" type="button" onclick="removeUseUpProduct('${pAttr}')">Remove</button>
        </div>`;
      }).join('')
    : '<div class="empty compact">No products added yet.</div>';

  return `<div class="use-up-add">
    <div class="mapping-search-container">
      <input id="use-up-product-search" type="search" placeholder="Search Product Bank…" autocomplete="off" oninput="renderUseUpProductSuggestions(this.value)" onfocus="renderUseUpProductSuggestions(this.value)" name="use-up-product-search">
      <div class="map-dropdown" id="use-up-product-suggestions" style="display:none"></div>
    </div>
  </div>
  <div class="use-up-list">${listItemsHtml}</div>`;
}

/**
 * Render HTML for #use-up-product-suggestions inner content
 */
export function renderSuggestions(products = []) {
  if (!products.length) {
    return '<div class="empty compact">No matching products.</div>';
  }

  return products.map(product => {
    const pName = escapeHtml(product.name);
    const pAttr = escapeAttr(product.id);
    let hierarchy = '';
    if (typeof window !== 'undefined' && window.getIngredientGroup && window.getGroupHierarchyText) {
      const grp = window.getIngredientGroup(product.groupId) || { cat: product.cat, name: product.name };
      hierarchy = escapeHtml(window.getGroupHierarchyText(grp));
    } else {
      hierarchy = escapeHtml(product.cat || '');
    }

    return `<button type="button" class="map-drop-item" onclick="addUseUpProduct('${pAttr}')">
      <strong>${pName}</strong>
      <small>${hierarchy}</small>
    </button>`;
  }).join('');
}
