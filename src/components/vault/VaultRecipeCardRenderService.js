/**
 * src/components/vault/VaultRecipeCardRenderService.js (v3.38.71)
 * Pure template generation service for Vault Recipe Cards.
 * Isolates HTML string building from action controllers.
 */

import { renderFitScoreBadge } from '../FitScoreBadge.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const escapeAttr = (str) => escapeHtml(str).replace(/`/g, '&#96;');

/**
 * Renders the fit block for a recipe variant.
 */
export function renderFitBlock({ showE, showC, portions, recipeId, variant, fitTagHtml }) {
  const parts = [];
  const rId = escapeAttr(recipeId);
  const v = escapeAttr(variant);

  if (showE) {
    parts.push(`<button type="button" class="fit-detail-button" data-action="open-fit-details" data-recipe-id="${rId}" data-variant="${v}" data-person="e" onclick="openVaultFitDetails(this,'${rId}','${v}','e')">Elliott ${escapeHtml(portions.e || '')}</button>`);
  }
  if (showC) {
    parts.push(`<button type="button" class="fit-detail-button" data-action="open-fit-details" data-recipe-id="${rId}" data-variant="${v}" data-person="c" onclick="openVaultFitDetails(this,'${rId}','${v}','c')">Chloe ${escapeHtml(portions.c || '')}</button>`);
  }

  return `<div class="recipe-fit">${parts.join('')} ${fitTagHtml}</div>`;
}

/**
 * Renders the main recipe card shell.
 */
export function renderRecipeCardShell({ 
  recipe, isAnyFav, origFav, enhFav, expandableName, meta, originalFitHtml, enhancedFitHtml, enhancedChangesHtml 
}) {
  const rId = escapeAttr(recipe.id);
  const heartFill = origFav ? 'currentColor' : 'none';
  const enhHeartFill = enhFav ? 'currentColor' : 'none';

  const enhancedBox = recipe.enhanced ? `
    <div class="enhanced-box">
      <div class="enhanced-layout">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div class="enhanced-lbl" style="margin-bottom:0">Enhanced version</div>
            <button type="button" class="recipe-fav-btn sm ${enhFav ? 'active' : ''}" data-action="toggle-favorite" data-recipe-id="${rId}" data-variant="enhanced" onclick="toggleRecipeFavourite('${rId}', event, 'enhanced')" style="padding:2px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${enhHeartFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          ${enhancedFitHtml}
          ${enhancedChangesHtml}
        </div>
        <div class="enhanced-actions">
          <button class="btn sm btn-primary primary enhanced-primary-action" data-action="view-recipe" data-recipe-id="${rId}" data-variant="enhanced" onclick="viewRecipe('${rId}', null, 'enhanced')">View</button>
          <button class="btn sm btn-ghost ghost enhanced-more-action" data-action="open-enhanced-recipe-actions" data-recipe-id="${rId}" data-variant="enhanced" onclick="openEnhancedRecipeActions(event, '${rId}')">More</button>
        </div>
      </div>
    </div>
  ` : '';

  return `
    <div class="recipe-card ${isAnyFav ? 'is-favorite' : ''}">
      <div class="recipe-card-layout">
        <div class="recipe-card-main">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
            ${expandableName}
            <button type="button" class="recipe-fav-btn ${origFav ? 'active' : ''}" data-action="toggle-favorite" data-recipe-id="${rId}" data-variant="original" onclick="toggleRecipeFavourite('${rId}', event, 'original')" aria-label="${origFav ? 'Remove original from favourites' : 'Add original to favourites'}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${heartFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          <div class="recipe-card-meta">${meta}</div>
          ${originalFitHtml}
        </div>
        <div class="recipe-card-actions">
          <button class="btn sm btn-primary primary mobile-primary" data-action="view-recipe" data-recipe-id="${rId}" data-variant="original" onclick="viewRecipe('${rId}', null)">View</button>
          <button class="btn sm btn-ghost ghost mobile-more" data-action="open-recipe-actions" data-recipe-id="${rId}" data-variant="original" onclick="openRecipeActions(event, '${rId}', 'original')">More</button>
        </div>
      </div>
      ${enhancedBox}
    </div>
  `;
}

/**
 * Renders the recipe actions dropdown items.
 */
export function renderRecipeActionsItems(recipeId, isFav) {
  const rId = escapeAttr(recipeId);
  return `
    <button type="button" class="action-menu-item" data-action="menu-view" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>👁️</span> View Details
    </button>
    <button type="button" class="action-menu-item" data-action="menu-edit" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>✏️</span> Edit Recipe
    </button>
    <button type="button" class="action-menu-item" data-action="menu-review" data-id="${rId}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>🔍</span> Review Recipe
    </button>
    <button type="button" class="action-menu-item" data-action="menu-duplicate" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>📋</span> Duplicate Recipe
    </button>
    <button type="button" class="action-menu-item" data-action="menu-favorite" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>${isFav ? '❤️' : '🤍'}</span> ${isFav ? 'Remove Favourite' : 'Add Favourite'}
    </button>
    <div style="height:1px;background:var(--border, #eee);margin:4px 0"></div>
    <button type="button" class="action-menu-item" data-action="menu-delete" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:#ef4444;">
      <span>🗑️</span> Delete Recipe
    </button>
  `;
}

/**
 * Renders the delete confirmation dialog content.
 */
export function renderDeleteConfirmationContent(recipeTitle) {
  return `
    <div style="padding: 24px; max-width: 440px; width: 100%; margin: 0 auto; background: var(--surface,#fff); border-radius: 14px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">🗑️</div>
      <h3 style="margin-top:0; margin-bottom: 10px; font-size: 1.15rem; font-weight: 750; color: var(--red,#ef4444)">Delete Recipe?</h3>
      <p style="font-size: 13.5px; color: var(--text2,#78716c); margin: 0 0 24px 0; line-height: 1.5;">
        Are you sure you want to delete <strong>"${escapeHtml(recipeTitle)}"</strong>?
      </p>
      <div style="display:flex; gap:8px; justify-content: center;">
        <button type="button" class="btn" style="padding: 8px 16px;" id="btn-cancel-vault-del">Cancel</button>
        <button type="button" class="btn danger" style="padding: 8px 16px;" id="btn-confirm-vault-del">Confirm Delete</button>
      </div>
    </div>
  `;
}
