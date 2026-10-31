/**
 * src/components/recipe/RecipeWizardStep2View.js (v3.32.6)
 * View rendering for Step 2: Sections, Interactive Target Servings Scaling & Taxonomy Autocomplete Mapping.
 */

import { wizardState } from './RecipeWizardState.js';
import { getState } from '../../store/store.js';
import { renderTaxonomySearchHTML } from './RecipeWizardTaxonomySearch.js';
import { scaleEmbeddedVolume } from '../../services/PortionCalculationService.js';
import { toTitleCase } from '../../utils/stringUtils.js';

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

export function renderState2Mapping() {
  const activeRecipe = wizardState.activeRecipe || {};
  const recipe = activeRecipe;
  const baseServings = Number(activeRecipe.servings || activeRecipe.currentServings) || 4;
  const targetServings = Number(wizardState.targetServings || activeRecipe.targetServings || baseServings);
  const scaleFactor = baseServings > 0 ? (targetServings / baseServings) : 1;

  const storeState = getState();
  const ingredientsBank = storeState.ingredients || [];

  let sectionsHtml = '';

  (recipe.ingredientSections || []).forEach((sec, sIdx) => {
    let rowsHtml = '';
    (sec.ingredients || []).forEach((item, iIdx) => {
      if (item.baseQty === undefined || item.baseQty === null) {
        item.baseQty = Number(item.qty) || 1;
      }
      const scaledQty = Number((item.baseQty * scaleFactor).toFixed(1));
      item.scaledQty = scaledQty;

      const fallbackBadge = item.isFallbackWeight
        ? `<span class="badge" style="background:#fef3c7;color:#92400e;font-size:10px;margin-left:4px;" title="Volume converted assuming density table">⚠️ Est. Weight</span>`
        : '';

      const isStock = String(item.name || '').toLowerCase().includes('stock') || String(item.name || '').toLowerCase().includes('bouillon') || String(item.name || '').toLowerCase().includes('cube') || String(item.raw || '').toLowerCase().includes('stock') || String(item.raw || '').toLowerCase().includes('bouillon') || String(item.raw || '').toLowerCase().includes('cube');

      if (isStock) {
        const rawLower = String(item.raw || '').toLowerCase();
        const mlMatch = /(\d+)\s*(?:ml|millilitres|ml\b)/i.exec(rawLower);
        if (item.baseWaterMl === undefined) {
          item.baseWaterMl = mlMatch ? parseInt(mlMatch[1], 10) : (item.waterMl ?? 400);
        }
        item.waterMl = Math.round(item.baseWaterMl * scaleFactor);
      }

      const scaledRaw = scaleEmbeddedVolume(item.raw || '', scaleFactor);

      const waterInputHtml = isStock ? `
        <div style="margin-top: 4px; display: flex; align-items: center; gap: 4px;">
          <span id="wiz-ing-water-label-${sIdx}-${iIdx}" style="font-size: 10px; color: var(--text2, #555); white-space: nowrap;">Water Volume:</span>
          <input type="number"
                 id="wiz-ing-water-ml-${sIdx}-${iIdx}"
                 name="wiz_ing_water_ml_${sIdx}_${iIdx}"
                 aria-labelledby="wiz-ing-water-label-${sIdx}-${iIdx}"
                 class="wiz-ing-water-ml"
                 data-sidx="${sIdx}"
                 data-iidx="${iIdx}"
                 value="${item.waterMl ?? 400}"
                 placeholder="400"
                 style="width: 55px; padding: 2px 4px; border: 1px solid var(--border, #ccc); border-radius: 4px; font-size: 10px;" />
          <span style="font-size: 10px; color: var(--text2, #555);">ml</span>
        </div>
      ` : '';

      rowsHtml += `
        <tr style="border-bottom: 1px solid var(--border, #eee);">
          <td style="padding: 6px;">
            <div style="font-size: 11px; color: var(--text2, #666); font-style: italic;">Raw: "${escapeHtml(scaledRaw)}"</div>
            ${fallbackBadge}
          </td>
          <td style="padding: 6px; width: 75px;">
            <input type="number" step="any" id="wiz-ing-qty-${sIdx}-${iIdx}" name="wiz_ing_qty_${sIdx}_${iIdx}" aria-label="Quantity for section ${sIdx} ingredient ${iIdx}" class="wiz-ing-qty" data-sidx="${sIdx}" data-iidx="${iIdx}" data-base-qty="${item.baseQty}" value="${scaledQty}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
          </td>
          <td style="padding: 6px; width: 75px;">
            <select id="wiz-ing-unit-${sIdx}-${iIdx}" name="wiz_ing_unit_${sIdx}_${iIdx}" aria-label="Unit for section ${sIdx} ingredient ${iIdx}" class="wiz-ing-unit" data-sidx="${sIdx}" data-iidx="${iIdx}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;">
              ${['g', 'ml', 'qty'].map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
            ${item.isEstimated ? `
              <span style="font-size: 10px; font-weight: 600; color: #b45309; background: #fef3c7; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; white-space: nowrap;">
                ⚠️ Est. Weight
              </span>
            ` : ''}
          </td>
          <td style="padding: 6px;">
            <input type="text" id="wiz-ing-name-${sIdx}-${iIdx}" name="wiz_ing_name_${sIdx}_${iIdx}" aria-label="Ingredient name for section ${sIdx} ingredient ${iIdx}" class="wiz-ing-name" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${escapeAttr(item.name)}" style="width: 100%; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
            ${waterInputHtml}
          </td>
          <td style="padding: 6px; min-width: 220px;">
            ${renderTaxonomySearchHTML(sIdx, iIdx, item, ingredientsBank)}
          </td>
          <td style="padding: 6px; width: 36px; text-align: center;">
            <button type="button" class="btn sm danger ghost wiz-del-ing-btn" data-sidx="${sIdx}" data-iidx="${iIdx}" title="Delete ingredient">🗑️</button>
          </td>
        </tr>
      `;
    });

    sectionsHtml += `
      <div style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 12px; border-radius: 10px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <input type="text" id="wiz-section-title-input-${sIdx}" name="wiz_section_title_input_${sIdx}" aria-label="Section title for section ${sIdx}" class="wiz-section-title-input" data-sidx="${sIdx}" value="${escapeAttr(sec.sectionTitle)}" style="font-weight: 700; font-size: 14px; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; width: 60%; background: var(--surface);" />
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn sm secondary wiz-add-line-btn" data-sidx="${sIdx}">+ Add Line</button>
            <button type="button" class="btn sm ghost wiz-del-section-btn" data-sidx="${sIdx}" style="color: #ef4444;">Remove Section</button>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="padding: 8px; color: var(--text2); font-size: 12px;">No ingredients in section.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  });

  // Method steps rendering with delete buttons
  let stepsHtml = '';
  (recipe.methodSteps || []).forEach((step, idx) => {
    stepsHtml += `
      <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text2); width: 24px; text-align: right;">${idx + 1}.</span>
        <input type="text" id="wiz-step-input-${idx}" name="wiz_step_input_${idx}" aria-label="Method step instruction for step ${idx + 1}" class="wiz-step-input" data-idx="${idx}" value="${escapeAttr(step)}" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 13px; background: var(--surface);" />
        <button type="button" class="btn sm danger ghost wiz-del-step-btn" data-idx="${idx}" title="Delete step">🗑️</button>
      </div>
    `;
  });

  return `
    <div>
      <div style="background: var(--surface2, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px;">
            Dish ${wizardState.currentQueueIndex || 1} of ${wizardState.initialQueueTotal || wizardState.processingQueue?.length || 1}
          </span>
          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text, #0f172a);">
            ${escapeHtml(toTitleCase(activeRecipe.title || 'Untitled Recipe'))}
          </h3>
        </div>
      </div>

      <div class="wiz-scaling-banner" id="wiz-scaling-banner" style="background: var(--purple-bg, #eef2ff); border: 1px solid rgba(79,70,229,0.2); padding: 10px 16px; border-radius: 10px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: 600; color: var(--purple, #4f46e5);">Scaling &amp; Density Normalization</span>
          <span style="font-size: 12px; color: var(--text2, #666);">(Base: <strong id="wiz-base-servings-label">${baseServings}</strong> servings)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label for="wiz-target-servings-input" style="font-size: 13px; font-weight: 600; color: var(--text, #111);">Target Servings:</label>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button type="button" id="wiz-scale-down-btn" class="btn sm secondary" style="padding: 2px 8px; font-weight: 700; cursor: pointer;">−</button>
            <input type="number" id="wiz-target-servings-input" min="1" max="24" step="1" value="${targetServings}" style="width: 50px; text-align: center; font-size: 13px; font-weight: 700; padding: 4px; border: 1px solid var(--border, #ccc); border-radius: 6px;">
            <button type="button" id="wiz-scale-up-btn" class="btn sm secondary" style="padding: 2px 8px; font-weight: 700; cursor: pointer;">+</button>
          </div>
          <span id="wiz-scale-factor-badge" class="badge" style="background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 12px;">
            ${scaleFactor.toFixed(2)}x
          </span>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0; font-size: 15px; font-weight: 700;">Ingredient Sections</h4>
        <button type="button" id="wiz-add-section-btn" class="btn sm secondary">+ Add Section Header</button>
      </div>

      ${sectionsHtml}

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px;">
        <h4 style="margin: 0; font-size: 15px; font-weight: 700;">Method Steps (${(recipe.methodSteps || []).length})</h4>
        <button type="button" id="wiz-add-step-btn" class="btn sm secondary">+ Add Step</button>
      </div>

      <div style="margin-bottom: 20px;">
        ${stepsHtml || '<p style="color:var(--text2);font-size:12px;">No method steps.</p>'}
      </div>

      ${(() => {
        const allIngs = (recipe.ingredientSections || []).flatMap(s => s.ingredients || []);
        const unlinkedIngs = allIngs.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
        if (!unlinkedIngs.length) return '';
        return `
          <div class="wiz-gate-warning" id="wiz-gate-warning-banner" style="margin-bottom: 12px; padding: 10px 14px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; color: #9f1239; font-size: 12.5px; display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span> <span><strong>Action Required:</strong> ${unlinkedIngs.length} ingredient(s) retain an unlinked "✨ New Item" status. Please click the search picker for each item to select or link it to a valid Category, Item, or Sub-Type before proceeding.</span>
          </div>
        `;
      })()}

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" id="wizard-back-btn">← Back</button>
        ${(() => {
          const allIngs = (recipe.ingredientSections || []).flatMap(s => s.ingredients || []);
          const unlinked = allIngs.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
          const isDisabled = unlinked.length > 0;
          return `<button type="button" class="btn primary" id="btn-next-step2" ${isDisabled ? 'disabled style="opacity:0.6; cursor:not-allowed;" title="All ingredients must be linked before proceeding"' : ''}>Next: Final Inline Review →</button>`;
        })()}
      </div>
    </div>
  `;
}
