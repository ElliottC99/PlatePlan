/**
 * src/components/pantry/PantryInventoryUI.js (v3.9.7)
 * Modular Presentation Component for Pantry Stock Items & Inventory Wrappers
 */

import { renderPantryItemRow } from './PantryItemRow.js';
import { renderPantryCategoryGroup } from './PantryCategoryGroup.js';
import { renderPantryToolbar } from './PantryToolbar.js';

export function renderPantryInventoryList(items = []) {
  if (!items || !items.length) {
    return `<div class="pantry-empty" style="padding:20px;text-align:center;color:var(--text3, #888);font-size:13px">
      No pantry items recorded. Use "Add Item" to track pantry stock.
    </div>`;
  }
  return items.map(item => renderPantryItemRow(item)).join('');
}

export {
  renderPantryItemRow,
  renderPantryCategoryGroup,
  renderPantryToolbar
};
