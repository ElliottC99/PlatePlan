/**
 * src/components/pantry/PantryInventoryRenderService.js (v3.38.68)
 * Pure template generation service for the Pantry Inventory UI.
 * Isolates HTML string building from inventory controllers.
 */

import { renderPantryCategoryGroup } from './PantryCategoryGroup.js';

/**
 * Escapes HTML characters.
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

/**
 * Escapes attribute characters.
 */
function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

/**
 * Renders the empty state placeholder when no stock is found.
 */
export function renderEmptyStockPlaceholder() {
  return `<div class="card pantry-empty" style="padding:32px 20px;text-align:center;color:var(--text2,#78716c);font-size:13px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px">
    <div style="font-size:30px;margin-bottom:8px">📦</div>
    <h3 style="margin:0 0 6px 0;font-size:16px;font-weight:750;color:var(--text,#1c1917)">No Active Stock Recorded</h3>
    <p style="margin:0 0 14px 0;font-size:12.5px;color:var(--text2,#78716c)">Add Items or Sub-types from your Pantry Bank (Master Catalog) with 1 click, or record a stock item directly.</p>
    <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn sm secondary" onclick="window.switchPantryTab('master-catalog')">🏛️ Browse Master Catalog</button>
      <button type="button" class="btn sm primary" onclick="window.openAddPantryStockModal()">+ Add Stock Item</button>
    </div>
  </div>`;
}

/**
 * Renders a category grouping card for the inventory list.
 */
export function renderInventoryCategoryCard(catName, groupItems) {
  return `
    <div class="card" style="padding:14px 16px;margin-bottom:14px;background:var(--surface,#fff);border:1px solid var(--border,#e7e5e4);border-radius:14px">
      ${renderPantryCategoryGroup(catName, groupItems)}
    </div>
  `;
}

/**
 * Renders the content for the Add Stock Modal.
 */
export function renderAddStockModalTemplate(ingredients = []) {
  const ingOptions = (Array.isArray(ingredients) ? ingredients : [])
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map(i => `<option value="${escapeAttr(i.id)}">${escapeHtml(i.name)} (${escapeHtml(i.category || 'General')})</option>`)
    .join('');

  return `
    <div class="modal-backdrop" id="add-stock-modal-backdrop"></div>
    <div class="modal" style="max-width:460px;width:92%;padding:20px;background:var(--surface,#fff);border-radius:14px;border:1px solid var(--border,#e7e5e4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h3 style="margin:0;font-size:16px;font-weight:750">📦 Add Item to Active Stock</h3>
        <button type="button" class="btn sm ghost" id="btn-close-add-stock-modal">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label for="stock-modal-ing-select" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Link to Pantry Bank Item (Optional)</label>
          <select id="stock-modal-ing-select" name="stockModalIngSelect" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
            <option value="">-- Custom / Unlinked Item --</option>
            ${ingOptions}
          </select>
        </div>
        <div>
          <label for="stock-modal-name-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Item Name *</label>
          <input type="text" id="stock-modal-name-input" name="stockModalNameInput" placeholder="e.g. Extra Firm Tofu, Oat Milk" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          <div>
            <label for="stock-modal-qty-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Quantity</label>
            <input type="number" id="stock-modal-qty-input" name="stockModalQtyInput" value="1" min="0.1" step="any" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
          </div>
          <div>
            <label for="stock-modal-unit-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Unit</label>
            <input type="text" id="stock-modal-unit-input" name="stockModalUnitInput" value="qty" placeholder="g, ml, qty" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
          </div>
          <div>
            <label for="stock-modal-storage-select" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Storage</label>
            <select id="stock-modal-storage-select" name="stockModalStorageSelect" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;background:var(--surface,#fff)">
              <option value="cupboard">🥫 Cupboard</option>
              <option value="fridge">❄️ Fridge</option>
              <option value="freezer">🧊 Freezer</option>
            </select>
          </div>
        </div>
        <div>
          <label for="stock-modal-expiry-input" style="display:block;font-size:12px;font-weight:700;margin-bottom:4px">Expiry Date (Optional)</label>
          <input type="date" id="stock-modal-expiry-input" name="stockModalExpiryInput" style="width:100%;padding:8px 10px;border:1px solid var(--border,#e7e5e4);border-radius:8px;font-size:13px;box-sizing:border-box" />
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
          <button type="button" class="btn ghost" id="btn-cancel-add-stock-modal">Cancel</button>
          <button type="button" class="btn primary" id="btn-save-add-stock-modal">Add to Active Stock</button>
        </div>
      </div>
    </div>
  `;
}
