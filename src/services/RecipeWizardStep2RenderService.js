/**
 * src/services/RecipeWizardStep2RenderService.js (v3.38.12)
 * Renders Step 2 hierarchy fields for the Recipe Wizard Taxonomy Modal.
 */

import { escapeAttr } from '../utils/stringUtils.js';

export function renderStep2SubtypeFields(wizardData) {
  return `
    <div>
      <label for="map-item-search-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
        1) Parent Item <span style="color:#dc2626">*</span>
      </label>
      <div style="position: relative;">
        <input type="text" 
               id="map-item-search-input" 
               name="map_item_search_input"
               value="${escapeAttr(wizardData.newItemName || wizardData.item)}" 
               placeholder="Search existing Item or type to create new..." 
               autocomplete="off"
               style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface); box-sizing: border-box;" />
        <div id="map-item-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ccc); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:13000; margin-top:2px;"></div>
      </div>
    </div>

    <div id="map-subtype-cat-section">
      ${wizardData.isExistingParentItem ? `
        <div>
          <label for="map-cat-locked-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
            2) Parent Category <span style="font-size: 11px; font-weight: 600; color: #047857; margin-left: 6px;">🔒 Auto-Locked from Existing Item</span>
          </label>
          <input type="text"
                 id="map-cat-locked-input"
                 name="map_cat_locked_input"
                 value="${escapeAttr(wizardData.selectedCategory)}"
                 readonly
                 disabled
                 style="width: 100%; padding: 8px 10px; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 13px; background: #ecfdf5; color: #065f46; font-weight: 600; cursor: not-allowed; box-sizing: border-box;" />
        </div>
      ` : `
        <div>
          <label for="map-cat-search-input" style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
            2) Parent Category (New Item) <span style="color:#dc2626">*</span>
          </label>
          <div style="position: relative;">
            <input type="text" 
                   id="map-cat-search-input" 
                   name="map_cat_search_input"
                   value="${escapeAttr(wizardData.selectedCategory)}" 
                   placeholder="Type to search or create Parent Category..." 
                   autocomplete="off"
                   style="width: 100%; padding: 8px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface); box-sizing: border-box;" />
            <div id="map-cat-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; max-height:160px; overflow-y:auto; background:var(--surface,#fff); border:1px solid var(--border,#ccc); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.15); z-index:13000; margin-top:2px;"></div>
          </div>
        </div>
      `}
    </div>
  `;
}
