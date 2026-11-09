/**
 * src/components/recipe/RecipeWizardStep2View.js (v3.36.0)
 * View rendering for Step 2: Sections, Interactive Target Servings Scaling & Taxonomy Autocomplete Mapping.
 */

import { wizardState, MEAL_TAGS } from './RecipeWizardState.js';
import { getState } from '../../store/store.js';
import { renderTaxonomySearchHTML, isIngredientUnlinked } from './RecipeWizardTaxonomySearch.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { recalculateWizardMacros } from './RecipeWizardStep3Handlers.js';
import { renderMacroBreakdownCrossbar } from './RecipeWizardStep3View.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';

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

export function renderStep2MacrosSummaryHTML(activeRecipe) {
  // Deprecated in favor of dual-profile crossbar (Elliott & Chloe Calories + Protein + Fit Score)
  return '';
}

export function renderStep2Footer() {
  const activeRecipe = wizardState.activeRecipe || {};
  const storeState = getState() || {};
  const ingredientsBank = storeState.rootItems || storeState.ingredients || [];
  const productsBank = storeState.products || [];

  const allIngs = (activeRecipe.ingredientSections || []).flatMap(s => s.ingredients || []);
  const unlinkedIngs = allIngs.filter(i => isIngredientUnlinked(i, productsBank, ingredientsBank));
  const isBlocked = unlinkedIngs.length > 0;

  return `
    <div class="ios-fullscreen-footer" id="wizard-step2-footer">
      <button type="button" class="btn ghost" id="wizard-back-btn">← Back</button>
      
      <button type="button" class="wiz-gate-pill ${isBlocked ? 'blocked' : 'ready'}" id="wiz-gate-pill" title="${isBlocked ? 'Click to jump to next unmapped ingredient' : 'All ingredients are linked'}">
        ${isBlocked
          ? `<span>⚠️</span> <span class="wiz-unlinked-count">${unlinkedIngs.length}</span> unmapped item(s) <span style="font-size:10px;text-decoration:underline;margin-left:2px;">(jump)</span>`
          : `<span>✓</span> All items linked`}
      </button>

      <button type="button" class="btn primary" id="btn-next-step2" ${isBlocked ? 'disabled style="opacity:0.6; cursor:not-allowed;" title="All ingredients must be linked before proceeding"' : ''}>
        Next: Final Inline Review →
      </button>
    </div>
  `;
}

export function renderState2Mapping() {
  const activeRecipe = wizardState.activeRecipe || {};
  const recipe = activeRecipe;
  const servings = Number(activeRecipe.servings || activeRecipe.serves || 4) || 4;
  activeRecipe.servings = servings;
  activeRecipe.serves = servings;

  const storeState = getState() || {};
  const ingredientsBank = storeState.rootItems || storeState.ingredients || [];
  const productsBank = storeState.products || [];

  let sectionsHtml = '';

  (recipe.ingredientSections || []).forEach((sec, sIdx) => {
    let rowsHtml = '';
    (sec.ingredients || []).forEach((item, iIdx) => {
      const qty = Number(item.qty) || 1;
      item.qty = qty;

      const isStock = String(item.name || '').toLowerCase().includes('stock') || String(item.name || '').toLowerCase().includes('bouillon') || String(item.name || '').toLowerCase().includes('cube') || String(item.raw || '').toLowerCase().includes('stock') || String(item.raw || '').toLowerCase().includes('bouillon') || String(item.raw || '').toLowerCase().includes('cube');

      if (isStock && item.waterMl === undefined) {
        const rawLower = String(item.raw || '').toLowerCase();
        const mlMatch = /(\d+)\s*(?:ml|millilitres|ml\b)/i.exec(rawLower);
        item.waterMl = mlMatch ? parseInt(mlMatch[1], 10) : 400;
      }

      const rawDisplay = item.raw || `${qty} ${item.unit || 'g'} ${item.name || ''}`.trim();
      const isUnlinked = isIngredientUnlinked(item, productsBank, ingredientsBank);

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
        <tr id="wiz-ing-row-${sIdx}-${iIdx}" data-sidx="${sIdx}" data-iidx="${iIdx}" class="${isUnlinked ? 'wiz-row-unlinked' : ''}" style="border-bottom: 1px solid var(--border, #eee); ${isUnlinked ? 'border-left: 3px solid #f43f5e;' : ''}">
          <td style="padding: 4px 6px; width: 125px; vertical-align: top;">
            <div style="display: flex; gap: 4px; align-items: center;">
              <input type="number" step="any" id="wiz-ing-qty-${sIdx}-${iIdx}" name="wiz_ing_qty_${sIdx}_${iIdx}" aria-label="Quantity for section ${sIdx} ingredient ${iIdx}" class="wiz-ing-qty" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${qty}" style="width: 54px; padding: 4px 6px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px; font-weight: 600;" />
              <select id="wiz-ing-unit-${sIdx}-${iIdx}" name="wiz_ing_unit_${sIdx}_${iIdx}" aria-label="Unit for section ${sIdx} ingredient ${iIdx}" class="wiz-ing-unit" data-sidx="${sIdx}" data-iidx="${iIdx}" style="width: 62px; padding: 4px 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;">
                ${['g', 'ml', 'qty'].map(u => `<option value="${u}" ${u === item.unit ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            </div>
          </td>
          <td style="padding: 4px 6px; vertical-align: top;">
            <input type="text" id="wiz-ing-name-${sIdx}-${iIdx}" name="wiz_ing_name_${sIdx}_${iIdx}" aria-label="Ingredient name for section ${sIdx} ingredient ${iIdx}" class="wiz-ing-name" data-sidx="${sIdx}" data-iidx="${iIdx}" value="${escapeAttr(item.name)}" style="width: 100%; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12px;" />
            <div class="wiz-raw-subtext" title="Raw: &quot;${escapeAttr(rawDisplay)}&quot;">Raw: "${escapeHtml(rawDisplay)}"</div>
            ${waterInputHtml}
          </td>
          <td style="padding: 4px 6px; min-width: 250px; vertical-align: top;">
            ${renderTaxonomySearchHTML(sIdx, iIdx, item, ingredientsBank, productsBank)}
          </td>
          <td style="padding: 4px 4px; width: 34px; text-align: center; vertical-align: top;">
            <button type="button" class="btn sm danger ghost wiz-del-ing-btn" data-sidx="${sIdx}" data-iidx="${iIdx}" title="Delete ingredient" style="padding: 4px 6px; font-size: 12px;">🗑️</button>
          </td>
        </tr>
      `;
    });

    sectionsHtml += `
      <div class="wiz-section-card" data-sidx="${sIdx}" style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 8px 12px; border-radius: 8px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <input type="text" id="wiz-section-title-input-${sIdx}" name="wiz_section_title_input_${sIdx}" aria-label="Section title for section ${sIdx}" class="wiz-section-title-input" data-sidx="${sIdx}" value="${escapeAttr(sec.sectionTitle)}" style="font-weight: 700; font-size: 13px; padding: 4px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; width: 60%; max-width: 280px; background: var(--surface);" />
            <span style="font-size: 11px; font-weight: 600; color: var(--text2, #6b7280); background: var(--border, #e5e7eb); padding: 2px 7px; border-radius: 999px;">
              ${(sec.ingredients || []).length} items
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button type="button" class="btn sm secondary wiz-add-line-btn" data-sidx="${sIdx}" style="padding: 2px 8px; font-size: 11px;">+ Add Line</button>
            <button type="button" class="btn sm ghost wiz-del-section-btn" data-sidx="${sIdx}" style="color: #ef4444; padding: 2px 6px; font-size: 11px;">Remove Section</button>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${rowsHtml || '<tr><td colspan="4" style="padding: 8px; color: var(--text2); font-size: 12px;">No ingredients in section.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  });

  // Compact Method steps rendering with delete buttons (preserve blank steps added via + Add Step)
  let stepsHtml = '';
  const hasExplicitMethodStepsArray = Array.isArray(recipe.methodSteps);
  const rawMethodSteps = hasExplicitMethodStepsArray
    ? recipe.methodSteps
    : (recipe.steps || recipe.method || recipe.instructions || []);
  const normalizedSteps = hasExplicitMethodStepsArray
    ? rawMethodSteps.map(s => typeof s === 'string' ? s : (s?.text || s?.instruction || s?.step || String(s ?? '')))
    : (Array.isArray(rawMethodSteps)
        ? rawMethodSteps.map(s => typeof s === 'string' ? s : (s?.text || s?.instruction || s?.step || String(s ?? ''))).filter(Boolean)
        : (typeof rawMethodSteps === 'string' ? rawMethodSteps.split('\n').filter(Boolean) : []));
  normalizedSteps.forEach((step, idx) => {
    stepsHtml += `
      <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: var(--text2); width: 20px; text-align: right; padding-top: 6px;">${idx + 1}.</span>
        <textarea id="wiz-step-input-${idx}" name="wiz_step_input_${idx}" aria-label="Method step instruction for step ${idx + 1}" class="wiz-step-input" data-idx="${idx}" rows="1" style="flex: 1; min-height: 32px; height: 32px; padding: 5px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 12.5px; font-family: inherit; line-height: 1.35; background: var(--surface); resize: vertical; overflow-y: hidden;">${escapeHtml(step)}</textarea>
        <button type="button" class="btn sm danger ghost wiz-del-step-btn" data-idx="${idx}" title="Delete step" style="margin-top: 2px; padding: 3px 6px; font-size: 11px;">🗑️</button>
      </div>
    `;
  });

  const currentVariant = wizardState.activeVariant || 'original';
  const isEnhancedTab = currentVariant === 'enhanced';
  const hasEnhanced = Boolean(
    activeRecipe.enhanced ||
    wizardState.baseOriginalRecipe?.enhanced ||
    wizardState.variantSnapshots?.enhanced
  );
  recalculateWizardMacros(activeRecipe);
  const targetMealType = activeRecipe.mealSuitability?.[0] || activeRecipe.types?.[0] || activeRecipe.type || 'dinner';
  const fitTagHtml = renderFitScoreBadge(activeRecipe, targetMealType, {
    variant: currentVariant,
    showLabel: true
  });
  const macroCrossbarHtml = renderMacroBreakdownCrossbar(activeRecipe, currentVariant, { compact: true, mealType: targetMealType });

  const selectedSuitability = activeRecipe.mealSuitability || activeRecipe.types || ['Dinner'];
  const normalizedSuitability = Array.isArray(selectedSuitability)
    ? selectedSuitability.map(s => String(s).toLowerCase())
    : [String(selectedSuitability).toLowerCase()];
  const mealTagsHtml = MEAL_TAGS.map(tag => {
    const isSelected = normalizedSuitability.includes(tag.toLowerCase());
    return `<label class="wiz-step2-meal-tag-label" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; padding: 2px 8px; border: 1px solid var(--border, #cbd5e1); border-radius: 999px; background: ${isSelected ? 'var(--purple-bg, #eef2ff)' : 'var(--surface, #fff)'}; color: ${isSelected ? 'var(--purple, #4f46e5)' : 'var(--text2, #475569)'}; cursor: pointer; user-select: none;">
      <input type="checkbox" id="wiz-step2-tag-${tag.toLowerCase()}" name="wiz_step2_meal_tag" class="wiz-step2-meal-tag" value="${tag}" ${isSelected ? 'checked' : ''} style="display: none;" />
      ${tag}
    </label>`;
  }).join(' ');

  const step2VariantToggleHtml = hasEnhanced ? `
    <div class="variant-toggle" id="wiz-step2-variant-toggle" style="display: inline-flex; background: var(--surface, #fff); padding: 2px; border-radius: 8px; border: 1px solid var(--border, #ccc);">
      <button type="button" class="btn sm ${!isEnhancedTab ? 'primary' : 'ghost'}" id="wiz-step2-tab-original" style="padding: 3px 10px; font-size: 11.5px; font-weight: 600;">
        Original
      </button>
      <button type="button" class="btn sm ${isEnhancedTab ? 'primary' : 'ghost'}" id="wiz-step2-tab-enhanced" style="padding: 3px 10px; font-size: 11.5px; font-weight: 600;">
        ✨ Enhanced
      </button>
    </div>
  ` : '';

  return `
    <div>
      <div class="wiz-step2-header-container" style="background: var(--surface2, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 8px; padding: 6px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #e0e7ff; color: #4338ca; padding: 2px 7px; border-radius: 4px;">
            Dish ${wizardState.currentQueueIndex || 1} of ${wizardState.initialQueueTotal || wizardState.processingQueue?.length || 1}
          </span>
          <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text, #0f172a); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeAttr(toTitleCase(activeRecipe.title || 'Untitled Recipe'))}">
            ${escapeHtml(toTitleCase(activeRecipe.title || 'Untitled Recipe'))}
          </h3>
          ${step2VariantToggleHtml}
          <div id="wiz-step2-fit-badge-container" style="display: inline-flex; align-items: center;">
            ${fitTagHtml}
          </div>
          <div id="wiz-step2-macro-crossbar-container" style="display: inline-flex; align-items: center;">
            ${macroCrossbarHtml}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 11px; font-weight: 600; color: var(--text2, #64748b);">Meal:</span>
            <div class="wiz-step2-meal-tags-container" style="display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap;">
              ${mealTagsHtml}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <label for="wiz-servings-input" style="font-size: 12px; font-weight: 600; color: var(--text2, #555);">Yield:</label>
            <input type="number" id="wiz-servings-input" min="1" max="50" step="1" value="${servings}" style="width: 48px; text-align: center; font-size: 12px; font-weight: 700; padding: 2px 4px; border: 1px solid var(--border, #ccc); border-radius: 6px; background: var(--surface);">
            <span style="font-size: 11px; color: var(--text2, #666);">servings</span>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0; font-size: 14px; font-weight: 700;">Ingredient Sections</h4>
        <button type="button" id="wiz-add-section-btn" class="btn sm secondary" style="padding: 2px 8px; font-size: 11px;">+ Add Section Header</button>
      </div>

      ${sectionsHtml}

      <div style="display: flex; justify-content: space-between; align-items: center; margin: 14px 0 6px;">
        <h4 style="margin: 0; font-size: 14px; font-weight: 700;">Method Steps (${normalizedSteps.length})</h4>
        <button type="button" id="wiz-add-step-btn" class="btn sm secondary" style="padding: 2px 8px; font-size: 11px;">+ Add Step</button>
      </div>

      <div style="margin-bottom: 20px;">
        ${stepsHtml || '<p style="color:var(--text2);font-size:12px;">No method steps.</p>'}
      </div>
    </div>
  `;
}
