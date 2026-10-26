/**
 * src/components/data-quality/HierarchyWizardRenderService.js (v3.38.65)
 * Pure rendering service for the Hierarchy Alignment Wizard.
 * Isolates HTML template factories from controller logic.
 */
import { escapeHtml, escapeAttr, toTitleCase } from '../../utils/stringUtils.js';

/**
 * Renders the list of subtype search results.
 */
export function renderSubtypeOptions(filtered, displayQuery) {
  let html = filtered.map(o => `
    <div class="wizard-st-item" data-ing-id="${escapeAttr(o.ingredientId)}" data-sub-id="${escapeAttr(o.subtypeId || '')}" data-name="${escapeAttr(o.name)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600">${escapeHtml(o.name)}</span>
      <span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2,#78716c)">${escapeHtml(o.category || 'Uncategorised')}</span>
    </div>
  `).join('');

  const titleQuery = toTitleCase(displayQuery);
  html += `<div class="wizard-st-create" data-name="${escapeAttr(titleQuery)}" style="padding:8px 10px;font-size:12px;cursor:pointer;background:#eff6ff;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:6px"><span>➕ Create new sub-type "${escapeHtml(titleQuery)}"</span></div>`;
  return html;
}

/**
 * Renders the list of ingredient search results.
 */
export function renderIngredientOptions(filtered, displayQuery) {
  let html = filtered.map(i => `
    <div class="wizard-ing-item" data-id="${escapeAttr(i.id)}" data-name="${escapeAttr(i.name)}" style="padding:6px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:600">${escapeHtml(i.name)}</span>
      <span style="font-size:10.5px;background:#f3f4f6;padding:1px 5px;border-radius:4px;color:var(--text2,#78716c)">${escapeHtml(i.category || 'Uncategorised')}</span>
    </div>
  `).join('');

  const titleQuery = toTitleCase(displayQuery);
  html += `<div class="wizard-ing-create" data-name="${escapeAttr(titleQuery)}" style="padding:8px 10px;font-size:12px;cursor:pointer;background:#eff6ff;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:6px"><span>➕ Create new ingredient "${escapeHtml(titleQuery)}"</span></div>`;
  return html;
}

/**
 * Renders the full wizard step template.
 */
export function renderWizardStepTemplate({ 
  item, stepNum, total, pct, wizardStage, 
  newSubtypeName, newIngredientName, selectedCategory 
}) {
  return `
    <div style="flex-shrink:0;padding:14px 18px 10px;border-bottom:1px solid var(--border,#e7e5e4);display:flex;align-items:center;justify-content:space-between">
      <div><h3 style="margin:0;font-size:16px;font-weight:750">🪄 Cascading Hierarchy Wizard</h3><div style="font-size:11px;color:var(--text2,#78716c);margin-top:2px">Unlinked Product ${stepNum} of ${total}</div></div>
      <button type="button" class="modal-close-btn btn sm btn-ghost ghost" onclick="window.closeHierarchyWizardModal()" aria-label="Close modal">✕</button>
    </div>
    <div style="flex-shrink:0;width:100%;background:#e5e7eb;height:4px;overflow:hidden"><div style="width:${pct}%;background:var(--primary);height:100%"></div></div>
    <div class="wizard-modal-body" style="flex:1 1 auto;overflow-y:auto;min-height:0;padding:14px">
      <div style="background:var(--surface2,#f5f5f4);border-radius:10px;padding:10px;border:1px solid var(--border,#e7e5e4);margin-bottom:12px">
        <div style="font-size:10.5px;color:var(--text3,#78716c);text-transform:uppercase;font-weight:750">Active Product Status: Unlinked</div>
        <div style="font-size:16px;font-weight:750;margin-top:2px">${escapeHtml(item.name)}</div>
        <div style="font-size:11.5px;color:var(--text2,#78716c);margin-top:3px">Brand: <strong>${escapeHtml(item.brand)}</strong> · Pack: <strong>${item.pack}${escapeHtml(item.packUnit)}</strong> · Price: <strong style="color:var(--green,#10b981)">£${Number(item.price || 0).toFixed(2)}</strong></div>
      </div>

      <div style="background:#fff;border-radius:8px;padding:12px;border:1px solid var(--border,#e7e5e4);display:flex;flex-direction:column;gap:10px">
        ${wizardStage >= 1 ? `
          <div>
            <div style="font-size:12.5px;font-weight:750;margin-bottom:4px">Stage 1: Search Sub-type</div>
            ${newSubtypeName ? `<div style="display:inline-block;background:#e0e7ff;color:var(--primary);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:650;margin-bottom:6px">Sub-type: ${escapeHtml(newSubtypeName)}</div>` : ''}
            <div style="position:relative">
              <label for="wizard-subtype-search-input" class="sr-only">Search sub-type</label>
              <input type="text" id="wizard-subtype-search-input" value="${escapeAttr(newSubtypeName)}" placeholder="Search sub-type..." style="width:100%;padding:6px 8px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box;text-transform:capitalize" oninput="window.handleWizardSubtypeSearch(this.value)" onfocus="window.handleWizardSubtypeSearch(this.value)" autocomplete="off" name="wizard-subtype-search-input" ${wizardStage > 1 ? 'disabled style="background:#f9fafb"' : ''} />
              <div id="wizard-subtype-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:160px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            ${wizardStage === 1 ? `<button type="button" class="btn sm primary" id="wizard-link-subtype-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardLinkSubtype()" disabled>Link Product</button>` : ''}
          </div>
        ` : ''}

        ${wizardStage >= 2 ? `
          <div style="border-top:1px dashed var(--border,#e7e5e4);padding-top:8px">
            <div style="font-size:12.5px;font-weight:750;margin-bottom:4px">Stage 2: Search Ingredient</div>
            ${newIngredientName ? `<div style="display:inline-block;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:650;margin-bottom:6px">Ingredient: ${escapeHtml(newIngredientName)}</div>` : ''}
            <div style="position:relative">
              <label for="wizard-ingredient-search-input" class="sr-only">Search parent ingredient</label>
              <input type="text" id="wizard-ingredient-search-input" value="${escapeAttr(newIngredientName)}" placeholder="Search parent ingredient to link..." style="width:100%;padding:6px 8px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box;text-transform:capitalize" oninput="window.handleWizardIngredientSearch(this.value)" onfocus="window.handleWizardIngredientSearch(this.value)" autocomplete="off" name="wizard-ingredient-search-input" ${wizardStage > 2 ? 'disabled style="background:#f9fafb"' : ''} />
              <div id="wizard-ingredient-search-results" style="display:none;position:absolute;z-index:1000;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:160px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            ${wizardStage === 2 ? `<button type="button" class="btn sm primary" id="wizard-create-link-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardCreateAndLink()" disabled>Create Sub-type &amp; Link Product</button>` : ''}
          </div>
        ` : ''}

        ${wizardStage >= 3 ? `
          <div style="border-top:1px dashed var(--border,#e7e5e4);padding-top:8px">
            <div style="font-size:12.5px;font-weight:750;margin-bottom:4px">Stage 3: Assign Category</div>
            <div style="position:relative">
              <label for="wizard-category-search-input" class="sr-only">Search category</label>
              <input type="text" id="wizard-category-search-input" value="${escapeAttr(selectedCategory)}" placeholder="Search category from Category Bank..." style="width:100%;padding:6px 8px;border:1px solid var(--border,#e7e5e4);border-radius:6px;font-size:12px;box-sizing:border-box;text-transform:capitalize" oninput="window.handleWizardCategorySearch(this.value)" onkeyup="window.handleWizardCategorySearch(this.value)" onfocus="window.handleWizardCategorySearch(this.value)" autocomplete="off" name="wizard-category-search-input" />
              <div id="wizard-category-search-results" style="display:none;position:absolute;z-index:1050;background:#fff;border:1px solid #d1d1d6;border-radius:8px;max-height:220px;overflow-y:auto;width:100%;box-shadow:0 4px 12px rgba(0,0,0,0.1);left:0;top:100%"></div>
            </div>
            <button type="button" class="btn sm primary" id="wizard-create-link-btn" style="width:100%;margin-top:8px" onclick="window.handleWizardCreateAndLink()">Create Hierarchy &amp; Link Product</button>
          </div>
        ` : ''}
      </div>
    </div>
    <div style="flex-shrink:0;padding:10px 16px;border-top:1px solid var(--border,#e7e5e4);display:flex;justify-content:space-between;align-items:center;background:#fff">
      <button type="button" class="btn sm btn-secondary secondary" id="wizard-bulk-btn" style="background:rgba(16,185,129,0.1);color:var(--green,#10b981);font-weight:700" onclick="window.bulkProvisionAllDefaults()">⚡ Bulk Bind All</button>
      <div style="display:flex;gap:6px"><button type="button" class="btn sm btn-ghost ghost" onclick="window.skipWizardStep()">Skip &rarr;</button><button type="button" class="btn sm btn-outline outline" onclick="window.closeHierarchyWizardModal()">Exit</button></div>
    </div>
  `;
}

/**
 * Renders the wizard complete state.
 */
export function renderWizardCompleteTemplate() {
  return `
    <div style="padding:24px 16px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">🎉</div>
      <h3 style="font-size:17px;font-weight:750;margin:0 0 4px 0">All Products Aligned!</h3>
      <p style="font-size:12.5px;color:var(--text2,#78716c);margin:0 0 16px 0">All products successfully bound in hierarchy.</p>
      <button type="button" class="btn primary" style="padding:0 20px;font-weight:700;font-size:13px" onclick="window.closeHierarchyWizardModal()">Done</button>
    </div>
  `;
}
