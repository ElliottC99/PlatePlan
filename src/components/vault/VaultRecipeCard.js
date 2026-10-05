/**
 * src/components/vault/VaultRecipeCard.js (v3.20.02)
 * Modular UI component for Recipe Vault Card:
 * - Individual recipe card templates & layout
 * - Macro badges, fit score breakdown, and cooking time tags
 * - Action buttons for viewing, editing, duplication, and favoriting
 */

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

export function renderVaultRecipeCard(r, options = {}) {
  const types = r.types || [r.type || 'dinner'];
  const mealType = options.mealType || (types[0] || 'dinner');
  const eTgt = options.eTgt || { cal: 500, prot: 35 };
  const cTgt = options.cTgt || { cal: 500, prot: 35 };
  const whoKey = String(r.who || 'both').toLowerCase();
  const showE = whoKey === 'both' || whoKey === 'elliott' || whoKey === 'e';
  const showC = whoKey === 'both' || whoKey === 'chloe' || whoKey === 'c';
  const personLabel = whoKey === 'both' ? 'Shared' : (whoKey === 'elliott' || whoKey === 'e' ? 'Elliott' : 'Chloe');

  const badges = types.map(t => `<span class="badge ${t === 'breakfast' ? 'badge-green' : t === 'lunch' ? 'badge-purple' : 'badge-coral'}">${escapeHtml(t.toUpperCase())}</span>`).join(' ');

  const origFav = typeof window.isRecipeVariantFavourite === 'function' ? window.isRecipeVariantFavourite(r.id, 'original') : (r.isFavourite || r.isFavorite);
  const enhFav = typeof window.isRecipeVariantFavourite === 'function' ? window.isRecipeVariantFavourite(r.id, 'enhanced') : false;
  const isAnyFav = origFav || enhFav;
  const favTag = isAnyFav ? `<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span>` : '';

  const meta = [
    favTag,
    badges,
    `<span class="tag">${escapeHtml(personLabel)}</span>`,
    r.serves ? `<span class="tag">Serves ${escapeHtml(r.serves)}</span>` : '',
    r.time ? `<span class="tag">${escapeHtml(r.time)}m</span>` : ''
  ].filter(Boolean).join(' ');

  const buildFit = (active, useEnhanced = false) => {
    const bundle = typeof window.calculateRecipeDisplayNutrition === 'function' ? window.calculateRecipeDisplayNutrition({ recipe: r, variant: useEnhanced ? 'enhanced' : 'original', mealType }) : null;
    const portions = bundle?.portions || { eCal: 0, eProt: 0, cCal: 0, cProt: 0, e: '', c: '' };
    const parts = [];
    if (showE) {
      parts.push(`<button type="button" class="fit-detail-button" data-action="open-fit-details" data-recipe-id="${escapeAttr(r.id)}" data-variant="${useEnhanced ? 'enhanced' : 'original'}" data-person="e" onclick="openVaultFitDetails(this,'${escapeAttr(r.id)}','${useEnhanced ? 'enhanced' : 'original'}','e')">Elliott ${escapeHtml(portions.e || '')}</button>`);
    }
    if (showC) {
      parts.push(`<button type="button" class="fit-detail-button" data-action="open-fit-details" data-recipe-id="${escapeAttr(r.id)}" data-variant="${useEnhanced ? 'enhanced' : 'original'}" data-person="c" onclick="openVaultFitDetails(this,'${escapeAttr(r.id)}','${useEnhanced ? 'enhanced' : 'original'}','c')">Chloe ${escapeHtml(portions.c || '')}</button>`);
    }

    const fitTag = renderFitScoreBadge(r, mealType, {
      activeProfile: options.activeProfile || (whoKey === 'elliott' || whoKey === 'e' ? 'elliott' : (whoKey === 'chloe' || whoKey === 'c' ? 'chloe' : 'everyone')),
      variant: useEnhanced ? 'enhanced' : 'original',
      portions,
      portionScaled: true,
      showLabel: true
    });
    return { portions, html: `<div class="recipe-fit">${parts.join('')} ${fitTag}</div>` };
  };

  const originalFit = buildFit(r, false);
  const enhancedActive = r.enhanced ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : null;
  const enhancedFit = enhancedActive ? buildFit(enhancedActive, true) : null;
  const enhancedChanges = r.enhanced?.changes ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">${escapeHtml(r.enhanced.changes)}</div>` : '';
  const expandableName = typeof window.renderExpandableText === 'function' ? window.renderExpandableText(r.name, `recipe-${r.id}`, 'recipe-card-name') : escapeHtml(r.name);

  return `<div class="recipe-card ${isAnyFav ? 'is-favorite' : ''}">
    <div class="recipe-card-layout">
      <div class="recipe-card-main">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          ${expandableName}
          <button type="button" class="recipe-fav-btn ${origFav ? 'active' : ''}" data-action="toggle-favorite" data-recipe-id="${escapeAttr(r.id)}" data-variant="original" onclick="toggleRecipeFavourite('${escapeAttr(r.id)}', event, 'original')" aria-label="${origFav ? 'Remove original from favourites' : 'Add original to favourites'}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${origFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        </div>
        <div class="recipe-card-meta">${meta}</div>
        ${originalFit.html}
      </div>
      <div class="recipe-card-actions">
        <button class="btn sm btn-primary primary mobile-primary" data-action="view-recipe" data-recipe-id="${escapeAttr(r.id)}" data-variant="original" onclick="viewRecipe('${escapeAttr(r.id)}', null)">View</button>
        <button class="btn sm btn-ghost ghost mobile-more" data-action="open-recipe-actions" data-recipe-id="${escapeAttr(r.id)}" data-variant="original" onclick="openRecipeActions('${escapeAttr(r.id)}')">More</button>
      </div>
    </div>
    ${r.enhanced ? `<div class="enhanced-box">
      <div class="enhanced-layout">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div class="enhanced-lbl" style="margin-bottom:0">Enhanced version</div>
            <button type="button" class="recipe-fav-btn sm ${enhFav ? 'active' : ''}" data-action="toggle-favorite" data-recipe-id="${escapeAttr(r.id)}" data-variant="enhanced" onclick="toggleRecipeFavourite('${escapeAttr(r.id)}', event, 'enhanced')" style="padding:2px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${enhFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          ${enhancedFit.html}
          ${enhancedChanges}
        </div>
        <div class="enhanced-actions">
          <button class="btn sm btn-primary primary enhanced-primary-action" data-action="view-recipe" data-recipe-id="${escapeAttr(r.id)}" data-variant="enhanced" onclick="viewRecipe('${escapeAttr(r.id)}', null, 'enhanced')">View</button>
          <button class="btn sm btn-ghost ghost enhanced-more-action" data-action="open-enhanced-recipe-actions" data-recipe-id="${escapeAttr(r.id)}" data-variant="enhanced" onclick="openEnhancedRecipeActions('${escapeAttr(r.id)}')">More</button>
        </div>
      </div>
    </div>` : ''}
  </div>`;
}
