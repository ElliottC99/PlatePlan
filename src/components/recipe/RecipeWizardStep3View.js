/**
 * src/components/recipe/RecipeWizardStep3View.js (v3.35.2)
 * View rendering for Step 3: Final Inline Review, Macro Breakdown & Save.
 */

import { wizardState, MEAL_TAGS, getSaveButtonLabel } from './RecipeWizardState.js';
import { getState } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { recalculateWizardMacros, resolveProductForIngredient } from './RecipeWizardStep3Handlers.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';
import { isIngredientUnlinked } from './RecipeWizardTaxonomySearch.js';

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

function renderComparisonBadge(actual, target) {
  if (!target || target <= 0) return '';
  const diff = actual - target;
  const pctDiff = Math.round((diff / target) * 100);
  const isNear = Math.abs(pctDiff) <= 10;
  const isOver = pctDiff > 10;
  
  let bg = 'rgba(16,185,129,0.12)';
  let color = '#059669';
  let label = 'On Target';

  if (isOver) {
    bg = 'rgba(239,68,68,0.12)';
    color = '#dc2626';
    label = `+${Math.abs(pctDiff)}%`;
  } else if (!isNear) {
    bg = 'rgba(245,158,11,0.12)';
    color = '#d97706';
    label = `${pctDiff}%`;
  }

  return `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${bg};color:${color};line-height:1">${label}</span>`;
}

export function renderMacroBreakdownCrossbar(recipe, variant = 'original') {
  const activeRec = (variant === 'enhanced' && recipe.enhanced) ? { ...recipe, ...recipe.enhanced } : recipe;
  const targetMealType = activeRec.mealSuitability?.[0] || activeRec.types?.[0] || activeRec.type || 'dinner';

  // 1. Calculate Universal Fit Score & Dynamic Macros directly via calculateMealFitScore with portionScaled: true
  const fitResult = typeof calculateMealFitScore === 'function' ? calculateMealFitScore(activeRec, targetMealType, {
    activeProfile: 'everyone',
    variant: variant === 'enhanced' ? 'enhanced' : 'original',
    portionScaled: true
  }) : null;

  const eMealTargetKcal = Math.round(fitResult?.details?.elliott?.kcalTarget || 735);
  const cMealTargetKcal = Math.round(fitResult?.details?.chloe?.kcalTarget || 578);
  const eMealTargetProt = Math.round(fitResult?.details?.elliott?.proteinTarget || 49);
  const cMealTargetProt = Math.round(fitResult?.details?.chloe?.proteinTarget || 37);

  const totalKcalBudget = eMealTargetKcal + cMealTargetKcal;
  const eShare = totalKcalBudget > 0 ? (eMealTargetKcal / totalKcalBudget) : 0.59;
  const cShare = totalKcalBudget > 0 ? (cMealTargetKcal / totalKcalBudget) : 0.41;
  const eSharePct = Math.round(eShare * 100);
  const cSharePct = Math.round(cShare * 100);

  const eKcal = Math.round(fitResult?.details?.elliott?.recipeKcal || 0);
  const eProt = Math.round(fitResult?.details?.elliott?.recipeProtein || 0);
  const cKcal = Math.round(fitResult?.details?.chloe?.recipeKcal || 0);
  const cProt = Math.round(fitResult?.details?.chloe?.recipeProtein || 0);

  const kcalDiffE = eKcal - eMealTargetKcal;
  const protDiffE = eProt - eMealTargetProt;
  const kcalDiffC = cKcal - cMealTargetKcal;
  const protDiffC = cProt - cMealTargetProt;

  const renderMacroBadge = (type, diff) => {
    const isKcal = type === 'kcal';
    const isGood = isKcal ? diff <= 0 : diff >= 0;
    const sign = diff > 0 ? '+' : '';
    const bg = isGood ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
    const color = isGood ? '#166534' : '#991b1b';
    const border = isGood ? '#86efac' : '#fca5a5';
    return `<span style="display:inline-flex; align-items:center; justify-content:center; padding: 2px 6px; border-radius: 6px; background: ${bg}; color: ${color}; border: 1px solid ${border}; font-size: 10px; font-weight: 800; margin-left: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${sign}${diff}${isKcal ? '' : 'g'}</span>`;
  };

  const servesCount = activeRec.servings || activeRec.serves || recipe.servings || recipe.serves || 2;

  return `
    <div class="recipe-modal-crossbar" style="width: 100%; background: var(--surface2, #f5f4ee); border: 1px solid var(--border, #e5e5e5); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px;">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text);">Dual-Profile Per-Portion Split</span>
        <span style="font-size: 11px; color: var(--text2);">(${servesCount} servings)</span>
      </div>

      <div class="recipe-modal-crossbar-macros" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--surface, #fff); border: 1px solid var(--border, #e7e5e4); font-size: 11.5px;">
          <span style="font-weight:700;">👤 Elliott (${eSharePct}%):</span>
          <span>🔥 <strong>${eKcal} kcal</strong> ${renderMacroBadge('kcal', kcalDiffE)}</span>
          <span>💪 <strong>${eProt}g</strong> ${renderMacroBadge('prot', protDiffE)}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--surface, #fff); border: 1px solid var(--border, #e7e5e4); font-size: 11.5px;">
          <span style="font-weight:700;">👤 Chloe (${cSharePct}%):</span>
          <span>🔥 <strong>${cKcal} kcal</strong> ${renderMacroBadge('kcal', kcalDiffC)}</span>
          <span>💪 <strong>${cProt}g</strong> ${renderMacroBadge('prot', protDiffC)}</span>
        </div>
      </div>
    </div>
  `;
}

export function renderState3Review() {
  const recipe = wizardState.activeRecipe;
  const currentVariant = wizardState.activeVariant || 'original';
  const isEnhancedTab = currentVariant === 'enhanced';
  const displayRecipe = (isEnhancedTab && recipe.enhanced)
    ? {
        ...recipe,
        ...recipe.enhanced,
        ingredientSections: recipe.ingredientSections || recipe.enhanced.ingredientSections,
        ingredients: (recipe.ingredientSections ? recipe.ingredientSections.flatMap(s => s.ingredients || []) : null) || recipe.ingredients || recipe.enhanced.ingredients,
        macros: recipe.macros || recipe.enhanced.macros,
        servings: recipe.servings || recipe.serves || recipe.enhanced.servings || recipe.enhanced.serves || 4
      }
    : recipe;
  const targetMealType = displayRecipe.mealSuitability?.[0] || displayRecipe.types?.[0] || displayRecipe.type || 'dinner';
  const fitTagHtml = typeof renderFitScoreBadge === 'function' ? renderFitScoreBadge(displayRecipe, targetMealType, {
    variant: currentVariant,
    showLabel: true
  }) : '';

  const identityBanner = `
    <div style="background: var(--surface2, #f8fafc); border: 1px solid var(--border, #e2e8f0); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: #e0e7ff; color: #4338ca; padding: 2px 8px; border-radius: 4px;">
          Dish ${wizardState.currentQueueIndex || 1} of ${wizardState.initialQueueTotal || wizardState.processingQueue?.length || 1}:
        </span>
        <span style="font-size: 14px; font-weight: 700; color: var(--text, #0f172a);">
          ${escapeHtml(toTitleCase(recipe.title || 'Untitled Recipe'))}
        </span>
        ${isEnhancedTab ? '<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:700;">✨ Enhanced Variant</span>' : ''}
      </div>
      <div style="display: flex; align-items: center;">
        ${fitTagHtml}
      </div>
    </div>
  `;

  const saveBtnText = getSaveButtonLabel(recipe);
  const macroCrossbarHtml = renderMacroBreakdownCrossbar(recipe, currentVariant);

  let sectionsReviewHtml = '';
  const activeSections = displayRecipe.ingredientSections || [{ sectionTitle: 'Main Ingredients', ingredients: displayRecipe.ingredients || [] }];
  activeSections.forEach(sec => {
    let rows = '';
    (sec.ingredients || []).forEach(ing => {
      let taxLabel = '';
      let isMapped = !!(ing.ingredientId || ing.isCategoryDefault || ing.categoryId);
      
      let notesHtml = '';
      const cleanNotes = (ing.notes || '').replace(/Est\.?\s*Weight/gi, '').replace(/dissolved in \d+\s*ml water/gi, '').replace(/\b\d+\s*ml water\b/gi, '').trim().replace(/^[\(\s,]+|[\)\s,]+$/g, '');
      if (ing.waterMl) {
        notesHtml = ` (dissolved in ${ing.waterMl}ml water)`;
        if (cleanNotes) {
          notesHtml = ` (${escapeHtml(cleanNotes)})` + notesHtml;
        }
      } else if (cleanNotes) {
        notesHtml = ` (${escapeHtml(cleanNotes)})`;
      }

      const cleanName = String(ing.name || '').replace(/\(Est\.?\s*Weight\)/gi, '').trim();
      let mainLineText = `${escapeHtml(cleanName)}${notesHtml}`;

      const storeState = getState();
      const globalProducts = storeState.products || [];
      const globalIngredients = storeState.ingredients || storeState.rootItems || [];

      // Resolve linked product or taxonomy auto-default
      const resolvedProduct = resolveProductForIngredient(ing, {
        products: globalProducts,
        ingredients: globalIngredients
      });

      const isUnlinked = isIngredientUnlinked(ing, globalProducts, globalIngredients);

      if (resolvedProduct) {
        const brandStr = resolvedProduct.brand ? `${resolvedProduct.brand} ` : '';
        const prodTitle = `${brandStr}${resolvedProduct.name || resolvedProduct.title || ''}`.trim();
        const searchUrl = resolvedProduct.tescoUrl || `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(prodTitle)}`;
        mainLineText += ` - <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary,#4f46e5); text-decoration:underline;">${escapeHtml(prodTitle)}</a>`;
        taxLabel = `<span class="badge" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">Mapped</span>`;
      } else if (!isUnlinked) {
        taxLabel = `<span class="badge" style="background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">Mapped</span>`;
      } else {
        taxLabel = `<span class="badge" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">Unmapped</span>`;
      }

      rows += `
        <tr style="border-bottom: 1px solid var(--border, #eee); font-size: 13px;">
          <td style="padding: 6px 8px; font-weight: 600; width: 100px;">${ing.scaledQty || ing.qty} ${ing.unit}</td>
          <td style="padding: 6px 8px;">${mainLineText}</td>
          <td style="padding: 6px 8px; text-align: right;">${taxLabel}</td>
        </tr>
      `;
    });

    sectionsReviewHtml += `
      <div style="margin-bottom: 12px;">
        <h5 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: var(--purple, #4f46e5);">${escapeHtml(sec.sectionTitle)}</h5>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${rows || '<tr><td colspan="3" style="font-size:12px;color:var(--text2);">No ingredients</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  });

  let stepsReviewHtml = '';
  const activeSteps = displayRecipe.methodSteps || displayRecipe.instructions || [];
  activeSteps.forEach((s) => {
    stepsReviewHtml += `<li style="margin-bottom: 6px; font-size: 13px; color: var(--text, #333);">${escapeHtml(s)}</li>`;
  });

  let mealTagsHtml = MEAL_TAGS.map(tag => {
    const isSelected = (recipe.mealSuitability || []).includes(tag);
    return `<label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 8px; border: 1px solid var(--border, #ccc); border-radius: 999px; background: ${isSelected ? '#eef2ff' : '#fff'}; color: ${isSelected ? '#4f46e5' : '#333'}; cursor: pointer;">
      <input type="checkbox" id="wiz-review-tag-${tag.toLowerCase()}" name="wiz_review_tag_${tag.toLowerCase()}" aria-label="Review tag ${tag}" class="wiz-review-tag" value="${tag}" ${isSelected ? 'checked' : ''} style="display:none;" />
      ${tag}
    </label>`;
  }).join(' ');

  return `
    <div>
      ${identityBanner}
      ${macroCrossbarHtml}

      <div style="background: var(--surface2, #f9f8f6); border: 1px solid var(--border, #e5e7eb); padding: 18px; border-radius: 12px; margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Inline Editable Review</h3>
          
          <div style="display:flex;align-items:center;gap:8px;">
            ${isEnhancedTab ? `
              <button type="button" class="btn sm" id="btn-wiz-auto-enhance" style="background:#16a34a;color:#fff;border-color:#15803d;font-weight:700;font-size:12px;padding:4px 10px;display:inline-flex;align-items:center;gap:4px;">
                ⚡ Auto-Optimize to 85+ Fit
              </button>
            ` : ''}
            <div class="variant-toggle" style="display: inline-flex; background: var(--surface, #fff); padding: 3px; border-radius: 8px; border: 1px solid var(--border, #ccc);">
              <button type="button" class="btn sm ${!isEnhancedTab ? 'primary' : 'ghost'}" id="wiz-tab-original" style="padding: 4px 12px; font-size: 12px; font-weight: 600;">
                Original
              </button>
              <button type="button" class="btn sm ${isEnhancedTab ? 'primary' : 'ghost'}" id="wiz-tab-enhanced" style="padding: 4px 12px; font-size: 12px; font-weight: 600;">
                ✨ Enhanced
              </button>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
          <div>
            <label for="wiz-rev-title" style="display:block; font-size:11px; font-weight:600; color:var(--text2);">Recipe Title</label>
            <input type="text" id="wiz-rev-title" name="rev_title" value="${escapeAttr(toTitleCase(recipe.title || recipe.name))}" style="width:100%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background: var(--surface);" />
          </div>
          <div>
            <label for="tp-serving-size" style="display:block; font-size:11px; font-weight:600; color:var(--text2);">Servings</label>
            <input type="number" id="tp-serving-size" name="rev_servings" value="${recipe.servings || recipe.serves || 4}" style="width:100%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background: var(--surface);" />
          </div>
          <div>
            <label for="wiz-rev-prepm" style="display:block; font-size:11px; font-weight:600; color:var(--text2);">Prep / Cook (Mins)</label>
            <div style="display:flex; gap:4px;">
              <input type="number" id="wiz-rev-prepm" name="rev_prepm" value="${(recipe.prepTime.hours * 60) + recipe.prepTime.minutes}" aria-label="Prep mins" style="width:50%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background: var(--surface);" />
              <input type="number" id="wiz-rev-cookm" name="rev_cookm" value="${(recipe.cookTime.hours * 60) + recipe.cookTime.minutes}" aria-label="Cook mins" style="width:50%; padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background: var(--surface);" />
            </div>
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <label style="display:block; font-size:11px; font-weight:600; color:var(--text2); margin-bottom: 4px;">Meal Suitability Tags</label>
          <div style="display:flex; flex-wrap:wrap; gap:6px;" id="wiz-review-tags-box">
            ${mealTagsHtml}
          </div>
        </div>

        <hr style="border:0; border-top:1px solid var(--border); margin:14px 0;" />

        <h4 style="margin: 0 0 8px; font-size: 14px; font-weight: 700;">
          ${isEnhancedTab ? '✨ Enhanced Ingredient Sections' : 'Ingredient Sections Overview'}
        </h4>
        ${sectionsReviewHtml}

        <h4 style="margin: 14px 0 8px; font-size: 14px; font-weight: 700;">
          ${isEnhancedTab ? '✨ Enhanced Method Steps' : 'Method Steps'}
        </h4>
        <ol style="padding-left: 20px; margin: 0;">
          ${stepsReviewHtml || '<li style="font-size:12px; color:var(--text2);">No method steps.</li>'}
        </ol>
      </div>

      <div style="display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border, #eee); padding-top: 14px;">
        <button type="button" class="btn ghost" onclick="goToWizardStep(2)">← Back to Mapping</button>
        <button type="button" class="btn primary" id="btn-save-wizard-recipe">💾 ${escapeHtml(saveBtnText)}</button>
      </div>
    </div>
  `;
}
