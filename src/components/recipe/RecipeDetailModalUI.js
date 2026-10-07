/**
 * src/components/recipe/RecipeDetailModalUI.js (v3.20.14)
 * Modular Presentation Component for Recipe Detail & Scaling Preview Modal.
 * Renders Recipe Ingredient rows as: [Ingredient] / [Sub-type] - [Brand Name] [Product Name]
 * with graceful fallbacks if brand/product are unmapped.
 */

import { calculateMealFitScore } from '../../services/FitScoreService.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';
import { formatGarlicQuantity, UNIT_TO_GRAMS } from '../../utils/unitConverter.js';

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

function toTitle(str) {
  if (typeof window !== 'undefined' && window.toTitleCase) {
    return window.toTitleCase(str);
  }
  return String(str || '').charAt(0).toUpperCase() + String(str || '').slice(1);
}

function formatBrandProductPair(product, fallbackBrand = '', fallbackProductName = '') {
  const brand = String(product?.brand ?? fallbackBrand ?? '').trim();
  let productName = String(product?.name ?? product?.title ?? fallbackProductName ?? '').trim();
  if (brand && productName.toLowerCase().startsWith(brand.toLowerCase())) {
    productName = productName.slice(brand.length).replace(/^[\s\-–—:]+/, '').trim();
  }
  if (brand && productName) return `${brand} ${productName}`;
  return productName || brand || '';
}

/**
 * Formats a recipe ingredient row as:
 * "[Ingredient] / [Sub-type] - [Brand Name] [Product Name]"
 * (e.g., "Beans / Baked - Heinz Baked Beans") with graceful fallbacks when unmapped.
 */
export function formatRecipeIngredientRow(ing, state = null, scaleMultiplier = 1) {
  if (!ing) return '';
  if (typeof ing === 'string') return ing.trim();

  const appState = state || (typeof window !== 'undefined' ? (window.Store?.getState?.() || window.state || {}) : {});
  const pantryIngs = Array.isArray(appState.ingredients) ? appState.ingredients : [];
  const products = Array.isArray(appState.products) ? appState.products : [];

  const ingId = ing.ingredientId || ing.groupId || ing.familyId || ing.ingId || '';
  const subId = ing.subtypeId || ing.subTypeId || '';
  const prodId = ing.productId || ing.mappedProductId || ing.defaultProductId || '';

  let ingObj = ingId ? pantryIngs.find(i => String(i?.id) === String(ingId)) : null;
  if (!ingObj) {
    const rawIngName = String(ing.ingredientName || ing.family || ing.name || ing.ingredient || '').trim().toLowerCase();
    if (rawIngName) {
      ingObj = pantryIngs.find(i => String(i?.name || '').trim().toLowerCase() === rawIngName) || null;
    }
  }

  let prodObj = prodId ? products.find(p => String(p?.id) === String(prodId)) : null;

  let subObj = null;
  const subtypes = Array.isArray(ingObj?.subtypes) ? ingObj.subtypes : [];
  if (subId && subtypes.length) {
    subObj = subtypes.find(s => String(s?.id) === String(subId)) || null;
  }
  if (!subObj && (ing.subtypeName || ing.subtype) && subtypes.length) {
    const targetSub = String(ing.subtypeName || ing.subtype).trim().toLowerCase();
    subObj = subtypes.find(s => String(s?.name || '').trim().toLowerCase() === targetSub) || null;
  }
  if (!subObj && prodObj?.subtypeId && subtypes.length) {
    subObj = subtypes.find(s => String(s?.id) === String(prodObj.subtypeId)) || null;
  }

  if (!prodObj) {
    if (subObj) {
      const subDefaultId = subObj.defaultProductId || subObj.defaultProduct?.id || '';
      prodObj = subDefaultId
        ? products.find(p => String(p?.id) === String(subDefaultId))
        : products.find(p => String(p?.subtypeId || p?.subTypeId || '') === String(subObj.id));
    }
    if (!prodObj && ingObj) {
      const ingDefaultId = ingObj.defaultProductId || ingObj.autoDefaultProduct || '';
      prodObj = ingDefaultId
        ? products.find(p => String(p?.id) === String(ingDefaultId))
        : (products.find(p => String(p?.ingredientId) === String(ingObj.id) && p?.isAutoDefault) ||
           products.find(p => String(p?.ingredientId) === String(ingObj.id)));
    }
  }

  const ingredientLabel = String(
    ingObj?.name || ing.ingredientName || ing.family || ing.name || ing.ingredient || ing.title || ing.item || ing.raw || ing.rawText || ''
  ).trim();
  const subtypeLabel = String(subObj?.name || ing.subtypeName || ing.subtype || '').trim();
  const brandProductLabel = formatBrandProductPair(prodObj, ing.brand, ing.productName || (!ingObj && prodObj ? prodObj.name : ''));

  let hierarchyPart = ingredientLabel || 'Unmapped Ingredient';
  if (subtypeLabel && subtypeLabel.toLowerCase() !== hierarchyPart.toLowerCase()) {
    hierarchyPart = `${hierarchyPart} / ${subtypeLabel}`;
  }

  let formattedLine = hierarchyPart;
  if (brandProductLabel && brandProductLabel.toLowerCase() !== ingredientLabel.toLowerCase() && brandProductLabel.toLowerCase() !== subtypeLabel.toLowerCase()) {
    formattedLine = `${hierarchyPart} - ${brandProductLabel}`;
  } else if (!brandProductLabel && ingObj?.autoDefault) {
    const fallbackAuto = formatBrandProductPair(null, '', ingObj.autoDefault);
    if (fallbackAuto && fallbackAuto.toLowerCase() !== ingredientLabel.toLowerCase()) {
      formattedLine = `${hierarchyPart} - ${fallbackAuto}`;
    }
  }

  const qty = ing.qty ?? ing.quantity ?? ing.amount;
  const unit = String(ing.unit || ing.u || '').trim();
  const comment = String(ing.comment || ing.notes || '').trim();

  const num = Number(qty);
  const scaledQty = !isNaN(num) && num > 0
    ? (Math.round(num * scaleMultiplier * 10) / 10)
    : qty;

  const isFreshGarlic = ingObj?.id === 'garlic_fresh' || 
                        String(ingObj?.name || '').trim().toLowerCase() === 'garlic' ||
                        String(ingredientLabel).trim().toLowerCase() === 'garlic';

  if (isFreshGarlic) {
    const weightG = (unit === 'g' || unit === 'gram' || !unit) ? (scaledQty) : ((scaledQty) * (UNIT_TO_GRAMS[unit] || 6));
    formattedLine = formatGarlicQuantity(ingObj || { name: ingredientLabel, id: ingObj?.id || 'garlic_fresh' }, weightG);
  }


  let qtyPrefix = '';
  if (!isFreshGarlic && qty !== undefined && qty !== null && qty !== '') {
    qtyPrefix = [scaledQty, unit].filter(Boolean).join('');
  }

  const fullText = qtyPrefix ? `${formattedLine} (${qtyPrefix})` : formattedLine;
  return comment ? `${fullText} — ${comment}` : fullText;
}

export function renderRecipeIngredientsListHTML(ingredients = [], state = null, scaleMultiplier = 1) {
  const list = Array.isArray(ingredients) ? ingredients : [];
  if (!list.length) {
    return `<div style="font-size:12.5px;color:var(--text2);font-style:italic">No ingredients listed.</div>`;
  }
  return `
    <ul class="recipe-view-ingredients-list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
      ${list.map(ing => {
        const text = formatRecipeIngredientRow(ing, state, scaleMultiplier);
        return `<li style="font-size:13px;color:var(--text);padding:5px 0;border-bottom:1px solid var(--border)">• ${escapeHtml(text)}</li>`;
      }).join('')}
    </ul>
  `;
}

export function renderRecipeDetailModalContent({
  r = {},
  activeR = {},
  hasEnh = false,
  isEnh = false,
  isFav = false,
  mealType = 'dinner',
  servingMode = 'both',
  targetServes = 2,
  singleServes = 1,
  instanceId = null,
  servingModeBannerHtml = '',
  allocationAndTargetHtml = '',
  sourceHtml = '',
  ingredientsHtml = '',
  methodHtml = '',
  macroCardsHtml = ''
} = {}) {
  const variantKey = isEnh ? 'enhanced' : 'original';
  const name = escapeHtml(activeR.name || r.name || 'Untitled Recipe');
  const favBtnClass = isFav ? 'active' : '';

  // Compute live score for active profile and slot
  const recipe = activeR || r;
  const slot = mealType || 'dinner';
  const fitBadgeHtml = renderFitScoreBadge(recipe, slot, { 
    activeProfile: servingMode === 'both' ? 'everyone' : servingMode, 
    variant: variantKey,
    portionScaled: true,
    showLabel: true
  });

  return `
    <div class="recipe-view-sheet">
      <div class="recipe-view-nav">
        <div class="recipe-view-nav-title">
          <h2>${name}</h2>
          <div class="recipe-view-nav-subtitle">
            ${isFav ? '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span>' : ''}
            ${isEnh ? '<span class="tag enhanced-pill">✨ Enhanced</span>' : ''}
            ${activeR.time ? `<span>⏱ ${activeR.time}m prep</span> · ` : ''}
            <span>${toTitle(mealType || 'Dinner')}</span>
            <span>·</span>
            <span>Serves ${activeR.serves || 1} baseline</span>
            ${instanceId ? '<span class="tag" style="background:var(--purple-bg);color:var(--purple);font-size:11px">Planned Meal</span>' : ''}
            <span class="tag recipe-header-fit-pill" style="padding:0;border:none;background:transparent">${fitBadgeHtml}</span>
          </div>
        </div>
        <div class="recipe-view-nav-actions" style="display:flex;align-items:center;gap:8px">
          <button type="button" id="modal-recipe-fav-btn" class="recipe-fav-btn ${favBtnClass}" onclick="toggleRecipeFavourite('${escapeAttr(r.id)}', event, '${variantKey}')" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          <button type="button" class="modal-close-btn recipe-view-close-btn" onclick="closeRecipePreview()" aria-label="Close">&times;</button>
        </div>
      </div>
      <div class="recipe-view-body">
        <style>
          .recipe-view-grid-layout {
            display: grid;
            grid-template-columns: 40% 60%;
            gap: 24px;
            align-items: start;
          }
          @media (max-width: 768px) {
            .recipe-view-grid-layout {
              grid-template-columns: 1fr;
              gap: 16px;
            }
          }
        </style>
        <div class="recipe-view-grid-layout">
          <!-- Left Column (40%): Portion selector, Macros, Source, Ingredients -->
          <div class="recipe-view-left-col" style="display:flex;flex-direction:column;gap:14px;min-width:0">
            <div class="recipe-view-controls-bar">
              ${hasEnh ? `
                <div class="segmented-control" role="tablist" style="width:fit-content;margin-bottom:8px;">
                  <button type="button" role="tab" class="${!isEnh ? 'active' : ''}" onclick="switchViewTab('original')">Original</button>
                  <button type="button" role="tab" class="${isEnh ? 'active' : ''}" onclick="switchViewTab('enhanced')">✨ Enhanced</button>
                </div>
              ` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                <div class="segmented-control" role="tablist">
                  <button type="button" role="tab" class="${servingMode === 'both' ? 'active' : ''}" onclick="switchPreviewServingMode('both')">Shared (${activeR.serves || 2})</button>
                  <button type="button" role="tab" class="${servingMode === 'elliott' ? 'active' : ''}" onclick="switchPreviewServingMode('elliott')">👤 Elliott only</button>
                  <button type="button" role="tab" class="${servingMode === 'chloe' ? 'active' : ''}" onclick="switchPreviewServingMode('chloe')">👤 Chloe only</button>
                </div>
                ${servingMode === 'both' ? `
                  <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                    <label for="preview-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                    <input type="number" id="preview-serves" name="previewServes" value="${targetServes}" oninput="updateRecipePreviewScale(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
                  </div>
                ` : `
                  <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                    <label for="preview-single-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                    <input type="number" id="preview-single-serves" name="previewSingleServes" value="${singleServes}" oninput="updateSinglePersonServes(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
                  </div>
                `}
              </div>
            </div>
            ${servingModeBannerHtml}
            ${allocationAndTargetHtml}
            ${sourceHtml}
            ${macroCardsHtml}
            <div class="recipe-view-section">
              <h3 style="margin-bottom:10px;font-size:15px;font-weight:700;color:var(--text)">Ingredients</h3>
              ${ingredientsHtml}
            </div>
          </div>

          <!-- Right Column (60%): Method instructions -->
          <div class="recipe-view-right-col" style="display:flex;flex-direction:column;gap:14px;min-width:0">
            <div class="recipe-view-section">
              <h3 style="margin-bottom:10px;font-size:15px;font-weight:700;color:var(--text)">Method</h3>
              ${methodHtml}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
