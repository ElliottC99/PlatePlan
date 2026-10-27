/**
 * src/services/RecipeWizardStep3RenderService.js (v3.38.13)
 * Renders Step 3 product linking summary and options for the Recipe Wizard Taxonomy Modal.
 */

import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';

export function renderStep3Template(wizardData, showProductSearch, productSearchQuery) {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 14px; border-radius: 10px; font-size: 12.5px; color: #166534; display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 16px; margin-top: -1px;">✅</span>
        <div style="flex: 1; min-width: 0;">
          <strong style="font-size: 13px;">Hierarchy Structured:</strong>
          <div style="font-size: 12px; color: #15803d; margin-top: 3px; line-height: 1.4;">
            Category ➔ <strong>${escapeHtml(wizardData.selectedCategory)}</strong> | Item ➔ <strong>${escapeHtml(wizardData.newItemName)}</strong> | Sub-Type ➔ <strong>${escapeHtml(wizardData.subTypeName)}</strong>
          </div>
        </div>
      </div>

      <div>
        <label style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
          3) Link Tesco / Grocery Product (Optional)
        </label>
        <p style="font-size: 12px; color: var(--text2); margin-top: 0; margin-bottom: 10px;">
          Attach a default supermarket product for automated basket matching and pricing calculations.
        </p>

        ${wizardData.linkedProduct ? `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; margin-bottom: 10px;">
            <div>
              <strong style="font-size: 13px; color: #065f46;">🛒 ${escapeHtml(wizardData.linkedProduct.name || wizardData.linkedProduct.title)}</strong>
              <div style="font-size: 11.5px; color: #047857; margin-top: 2px;">${escapeHtml(wizardData.linkedProduct.brand || 'Tesco')} · £${Number(wizardData.linkedProduct.price || 0).toFixed(2)}</div>
            </div>
            <button type="button" id="btn-remove-linked-product" class="btn ghost" style="font-size: 11px; padding: 4px 8px; color: #dc2626;">Unlink</button>
          </div>
        ` : `
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
            <button type="button" id="btn-wiz-open-add-product" class="btn secondary" style="flex: 1; font-size: 12.5px; padding: 9px 12px;">
              + Create Manual Product
            </button>
            <button type="button" id="btn-wiz-open-tesco-import" class="btn secondary" style="flex: 1; font-size: 12.5px; padding: 9px 12px;">
              🔍 Import via Tesco Search
            </button>
          </div>
          <button type="button" id="btn-wiz-toggle-link-existing" class="btn ghost" style="width: 100%; font-size: 12px; padding: 8px; color: var(--primary);">
            ${showProductSearch ? '▲ Hide Existing Product Picker' : '▼ Link Existing Product from Product Bank'}
          </button>
        `}

        ${showProductSearch ? `
          <div style="margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: var(--surface2);">
            <input type="text" 
                   id="wiz-product-search-input" 
                   name="wiz_product_search_input"
                   value="${escapeAttr(productSearchQuery)}" 
                   placeholder="Search products by name or brand..." 
                   autocomplete="off"
                   style="width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 12.5px; background: var(--surface); box-sizing: border-box;" />
            <div id="wiz-product-search-dropdown" style="display:none; max-height:160px; overflow-y:auto; background:var(--surface); border:1px solid var(--border); border-radius:6px; margin-top:4px;"></div>
          </div>
        ` : ''}
      </div>

      <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" id="btn-back-step3">← Back</button>
        <button type="button" class="btn primary" id="btn-complete-map-wiz" style="background: #047857; color: #fff;">✨ Complete & Link Item</button>
      </div>
    </div>
  `;
}
