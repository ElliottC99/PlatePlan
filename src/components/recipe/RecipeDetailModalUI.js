/**
 * src/components/recipe/RecipeDetailModalUI.js (v3.27.1)
 * Modular Presentation Component for Recipe Detail & Scaling Preview Modal.
 * Renders Full-Width Header Crossbar & Two-Column Grid (Ingredients Left, Method Right).
 */

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
 * Formats a recipe ingredient row with hierarchical taxonomy and scaled volumes.
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

/**
 * Renders ingredients list with section groupings or flat items.
 */
export function renderRecipeIngredientsListHTML(ingredients = [], state = null, scaleMultiplier = 1, sections = []) {
  if (Array.isArray(sections) && sections.length > 0) {
    return `
      <div class="recipe-view-sections-wrapper" style="display:flex;flex-direction:column;gap:14px">
        ${sections.map(sec => {
          const secTitle = escapeHtml(sec.sectionTitle || 'Ingredients');
          const secList = Array.isArray(sec.ingredients) ? sec.ingredients : [];
          return `
            <div class="recipe-ingredient-section-group">
              <h4 style="font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px 0;padding-bottom:4px;border-bottom:1px solid var(--border)">${secTitle}</h4>
              <ul class="recipe-view-ingredients-list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px">
                ${secList.map(ing => {
                  const text = formatRecipeIngredientRow(ing, state, scaleMultiplier);
                  return `<li style="font-size:13px;color:var(--text);padding:4px 0;border-bottom:1px solid var(--border-subtle, rgba(0,0,0,0.04))">• ${escapeHtml(text)}</li>`;
                }).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

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

/**
 * Main View Recipe Modal Content Renderer with Full-Width Crossbar & Two-Column Grid.
 */
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
  macroCardsHtml = '',
  ingredientsCount = 0,
  stepsCount = 0
} = {}) {
  const variantKey = isEnh ? 'enhanced' : 'original';
  const name = escapeHtml(activeR.name || r.name || 'Untitled Recipe');
  const favBtnClass = isFav ? 'active' : '';

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

      <style>
        .recipe-modal-crossbar {
          width: 100%;
          background: var(--surface2, #f5f4ee);
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 20px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }
        .recipe-modal-crossbar-controls {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          flex: 1 1 300px;
        }
        .recipe-modal-crossbar-macros {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex: 1 1 360px;
        }
        .recipe-modal-body {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 22px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .recipe-modal-crossbar {
            flex-direction: column;
            align-items: stretch;
            padding: 12px;
            gap: 12px;
          }
          .recipe-modal-crossbar-macros {
            justify-content: stretch;
          }
          .recipe-modal-body {
            grid-template-columns: 1fr;
            gap: 18px;
          }
        }
        .recipe-modal-col-card {
          background: var(--surface, #ffffff);
          border: 1px solid var(--border, #e5e5e5);
          border-radius: 12px;
          padding: 16px 18px;
        }
        .recipe-method-step-card {
          position: relative;
          padding: 12px 14px 12px 42px;
          margin-bottom: 10px;
          background: var(--surface2, #faf9f6);
          border: 1px solid var(--border, #eee);
          border-radius: 10px;
          font-size: 13.5px;
          line-height: 1.6;
          color: var(--text);
        }
        .recipe-method-step-card:last-child {
          margin-bottom: 0;
        }
        .recipe-method-step-card .step-num {
          position: absolute;
          left: 12px;
          top: 12px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--text, #292524);
          color: var(--bg, #fff);
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      </style>

      ${sourceHtml ? `<div class="recipe-source-bar" style="font-size:12px;color:var(--text2);margin-bottom:12px">${sourceHtml}</div>` : ''}

      <!-- Top Full-Width Horizontal Crossbar -->
      <div class="recipe-modal-crossbar">
        <!-- Left: Controls -->
        <div class="recipe-modal-crossbar-controls">
          ${hasEnh ? `
            <div class="segmented-control" role="tablist" style="width:fit-content;">
              <button type="button" role="tab" class="${!isEnh ? 'active' : ''}" onclick="switchViewTab('original')">Original</button>
              <button type="button" role="tab" class="${isEnh ? 'active' : ''}" onclick="switchViewTab('enhanced')">✨ Enhanced</button>
            </div>
          ` : ''}
          <div class="segmented-control" role="tablist">
            <button type="button" role="tab" class="${servingMode === 'both' ? 'active' : ''}" onclick="switchPreviewServingMode('both')">Shared (${activeR.serves || 2})</button>
            <button type="button" role="tab" class="${servingMode === 'elliott' ? 'active' : ''}" onclick="switchPreviewServingMode('elliott')">👤 Elliott</button>
            <button type="button" role="tab" class="${servingMode === 'chloe' ? 'active' : ''}" onclick="switchPreviewServingMode('chloe')">👤 Chloe</button>
          </div>
          ${servingMode === 'both' ? `
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;">
              <label for="preview-serves" style="font-weight:650;color:var(--text)">Servings:</label>
              <input type="number" id="preview-serves" name="previewServes" value="${targetServes}" oninput="updateRecipePreviewScale(this.value)" style="width:62px;min-height:34px;padding:4px 6px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-weight:700;text-align:center" min="1" step="1">
            </div>
          ` : `
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;">
              <label for="preview-single-serves" style="font-weight:650;color:var(--text)">Servings:</label>
              <input type="number" id="preview-single-serves" name="previewSingleServes" value="${singleServes}" oninput="updateSinglePersonServes(this.value)" style="width:62px;min-height:34px;padding:4px 6px;border-radius:8px;border:1px solid var(--border);background:var(--surface);font-weight:700;text-align:center" min="1" step="1">
            </div>
          `}
        </div>

        <!-- Right: Per-Portion Macro Breakdown Compact Cards -->
        <div class="recipe-modal-crossbar-macros">
          ${macroCardsHtml}
        </div>
      </div>

      ${servingModeBannerHtml ? `<div style="margin-bottom:12px">${servingModeBannerHtml}</div>` : ''}
      ${allocationAndTargetHtml ? `<div style="margin-bottom:12px">${allocationAndTargetHtml}</div>` : ''}

      <!-- Main Body: Two-Column Side-by-Side Grid (Ingredients Left, Method Right) -->
      <div class="recipe-modal-body recipe-view-grid-layout">
        <!-- Left Column: Ingredients -->
        <div class="recipe-modal-col-ingredients recipe-modal-col-card" style="min-width:0">
          <h3 style="margin-top:0;margin-bottom:12px;font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;justify-content:space-between">
            <span>🥗 Ingredients</span>
            ${ingredientsCount > 0 ? `<span style="font-size:12px;font-weight:600;color:var(--text2)">${ingredientsCount} items</span>` : ''}
          </h3>
          ${ingredientsHtml}
        </div>

        <!-- Right Column: Method Steps -->
        <div class="recipe-modal-col-method recipe-modal-col-card" style="min-width:0">
          <h3 style="margin-top:0;margin-bottom:12px;font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;justify-content:space-between">
            <span>👨‍🍳 Method</span>
            ${stepsCount > 0 ? `<span style="font-size:12px;font-weight:600;color:var(--text2)">${stepsCount} steps</span>` : ''}
          </h3>
          ${methodHtml}
        </div>
      </div>
    </div>
  `;
}
