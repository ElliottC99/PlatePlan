/**
 * src/components/recipe/RecipeDetailModalUI.js (v3.9.6)
 * Modular Presentation Component for Recipe Detail & Scaling Preview Modal
 */

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
          </div>
        </div>
        <div class="recipe-view-nav-actions" style="display:flex;align-items:center;gap:8px">
          <button type="button" id="modal-recipe-fav-btn" class="recipe-fav-btn ${favBtnClass}" onclick="toggleRecipeFavourite('${escapeAttr(r.id)}', event, '${variantKey}')" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          <button type="button" class="recipe-view-close-btn" onclick="closeRecipePreview()" aria-label="Close recipe">✕</button>
        </div>
      </div>
      <div class="recipe-view-body">
        <div class="recipe-view-controls-bar">
          ${hasEnh ? `
            <div class="segmented-control" role="tablist" style="width:fit-content;margin-bottom:4px;">
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
                <input type="number" id="preview-serves" value="${targetServes}" oninput="updateRecipePreviewScale(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
              </div>
            ` : `
              <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                <label for="preview-single-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                <input type="number" id="preview-single-serves" value="${singleServes}" oninput="updateSinglePersonServes(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
              </div>
            `}
          </div>
        </div>
        ${servingModeBannerHtml}
        ${allocationAndTargetHtml}
        ${sourceHtml}
        ${macroCardsHtml}
        <div class="recipe-view-sections">
          <div class="recipe-view-section">
            <h3 style="margin-bottom:10px;font-size:15px;font-weight:700;color:var(--text)">Ingredients</h3>
            ${ingredientsHtml}
          </div>
          <div class="recipe-view-section">
            <h3 style="margin-bottom:10px;font-size:15px;font-weight:700;color:var(--text)">Method / Steps</h3>
            ${methodHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}
