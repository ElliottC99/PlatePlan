/**
 * src/services/RecipeWizardStepRenderService.js (v3.38.12)
 * Renders step templates and fields for the Recipe Wizard Taxonomy Modal.
 */

import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';

export function renderStep1Template(wizardData, existingCategories) {
  const currentType = wizardData.entityType || 'subtype';
  const nameVal = wizardData.name || '';

  return `
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: var(--text);">
        1) Name or Item Title <span style="color:#dc2626">*</span>
      </label>
      <input type="text" 
             id="wiz-entity-name-input" 
             name="wiz_entity_name_input"
             value="${escapeAttr(nameVal)}" 
             placeholder="e.g. Organic Oat Milk or Whole Foods..." 
             autocomplete="off"
             style="width: 100%; padding: 10px 12px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 14px; background: var(--surface); box-sizing: border-box;" />
    </div>

    <div style="margin-bottom: 16px;">
      <label style="display: block; font-size: 13px; font-weight: 700; margin-bottom: 8px; color: var(--text);">
        2) Entity Tier Level
      </label>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
        <button type="button" class="wiz-tier-btn ${currentType === 'subtype' ? 'active' : ''}" data-tier="subtype" style="padding: 10px 8px; border-radius: 6px; border: 1px solid ${currentType === 'subtype' ? '#047857' : 'var(--border)'}; background: ${currentType === 'subtype' ? '#ecfdf5' : 'var(--surface)'}; color: ${currentType === 'subtype' ? '#065f46' : 'var(--text)'}; font-weight: 600; font-size: 12px; cursor: pointer; text-align: center;">
          🌱 Sub-Type
          <div style="font-size: 10px; font-weight: 400; opacity: 0.8; margin-top: 2px;">Brand / Variant</div>
        </button>
        <button type="button" class="wiz-tier-btn ${currentType === 'item' ? 'active' : ''}" data-tier="item" style="padding: 10px 8px; border-radius: 6px; border: 1px solid ${currentType === 'item' ? '#047857' : 'var(--border)'}; background: ${currentType === 'item' ? '#ecfdf5' : 'var(--surface)'}; color: ${currentType === 'item' ? '#065f46' : 'var(--text)'}; font-weight: 600; font-size: 12px; cursor: pointer; text-align: center;">
          📦 Item
          <div style="font-size: 10px; font-weight: 400; opacity: 0.8; margin-top: 2px;">Canonical Base</div>
        </button>
        <button type="button" class="wiz-tier-btn ${currentType === 'category' ? 'active' : ''}" data-tier="category" style="padding: 10px 8px; border-radius: 6px; border: 1px solid ${currentType === 'category' ? '#047857' : 'var(--border)'}; background: ${currentType === 'category' ? '#ecfdf5' : 'var(--surface)'}; color: ${currentType === 'category' ? '#065f46' : 'var(--text)'}; font-weight: 600; font-size: 12px; cursor: pointer; text-align: center;">
          🗂️ Category
          <div style="font-size: 10px; font-weight: 400; opacity: 0.8; margin-top: 2px;">Aisle Group</div>
        </button>
      </div>
    </div>
  `;
}
