/**
 * src/components/vault/VaultRecipeCard.js (v3.22.0)
 * Modular UI component for Recipe Vault Card:
 * - Individual recipe card templates & layout
 * - Macro badges, fit score breakdown, and cooking time tags
 * - Action buttons for viewing, editing, duplication, favoriting, and deletion
 * - Fixed "More" menu dropdown with z-index & stopPropagation handling
 */

import { renderFitScoreBadge } from '../FitScoreBadge.js';
import { calculateRecipePantryMatch } from '../../services/InventoryService.js';

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

export function openRecipeActions(evt, recipeIdParam, variantParam = 'original') {
  let e = evt;
  let recipeId = recipeIdParam;
  let variant = variantParam;

  if (typeof evt === 'string') {
    recipeId = evt;
    e = recipeIdParam;
    variant = variantParam || 'original';
  }

  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
    e.preventDefault();
  }

  closeAllRecipeActionMenus();

  const allRecipes = (window.state?.recipes || []).concat(window.Store?.getState()?.recipes || []);
  const recipe = allRecipes.find(r => r && r.id === recipeId);
  if (!recipe) return;

  const targetBtn = e?.currentTarget || (e?.target ? e.target.closest('button') : null) || document.querySelector(`[data-recipe-id="${recipeId}"][data-action*="actions"]`);

  const dropdown = document.createElement('div');
  dropdown.className = 'recipe-actions-dropdown-menu';
  dropdown.style.cssText = `
    position: fixed;
    z-index: 99999;
    background: var(--surface, #ffffff);
    color: var(--text, #1f2937);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 10px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    padding: 6px;
    min-width: 180px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `;

  if (targetBtn) {
    const rect = targetBtn.getBoundingClientRect();
    const top = Math.min(rect.bottom + 4, window.innerHeight - 220);
    const left = Math.max(10, Math.min(rect.right - 180, window.innerWidth - 190));
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  } else {
    dropdown.style.top = '50%';
    dropdown.style.left = '50%';
    dropdown.style.transform = 'translate(-50%, -50%)';
  }

  const isFav = typeof window.isRecipeVariantFavourite === 'function'
    ? window.isRecipeVariantFavourite(recipeId, variant)
    : (recipe.isFavourite || recipe.isFavorite);

  dropdown.innerHTML = `
    <button type="button" class="action-menu-item" data-action="menu-view" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>👁️</span> View Details
    </button>
    <button type="button" class="action-menu-item" data-action="menu-edit" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:none;background:none;width:100%;text-align:left;cursor:pointer;border-radius:6px;font-weight:500;color:var(--text, #111);">
      <span>✏️</span> Edit Recipe
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

  document.body.appendChild(dropdown);

  const dismiss = (event) => {
    if (!dropdown.contains(event.target)) {
      dropdown.remove();
      document.removeEventListener('click', dismiss, true);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss, true), 10);

  dropdown.querySelector('[data-action="menu-view"]').onclick = (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    if (typeof window.viewRecipe === 'function') {
      window.viewRecipe(recipeId, null, variant);
    }
  };

  dropdown.querySelector('[data-action="menu-edit"]').onclick = (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    if (typeof window.openRecipeWizard === 'function') {
      window.openRecipeWizard('manual');
    } else if (typeof window.openRecipeEditor === 'function') {
      window.openRecipeEditor(recipeId);
    }
  };

  dropdown.querySelector('[data-action="menu-duplicate"]').onclick = async (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    const dup = {
      ...recipe,
      id: crypto.randomUUID(),
      name: `${recipe.name || recipe.title} (Copy)`,
      title: `${recipe.name || recipe.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      const { saveRecipe } = await import('../../services/HouseholdRepository.js');
      await saveRecipe(dup);
      if (window.state?.recipes) window.state.recipes.unshift(dup);
      if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
      if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`Duplicated "${recipe.name}"`);
    } catch (err) {
      console.error('[VaultRecipeCard] Error duplicating recipe:', err);
    }
  };

  dropdown.querySelector('[data-action="menu-favorite"]').onclick = (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    if (typeof window.toggleRecipeFavourite === 'function') {
      window.toggleRecipeFavourite(recipeId, clickEvt, variant);
    }
  };

  dropdown.querySelector('[data-action="menu-delete"]').onclick = async (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    if (confirm(`Delete "${recipe.name || recipe.title}"?`)) {
      try {
        const { deleteRecipe } = await import('../../services/HouseholdRepository.js');
        await deleteRecipe(recipeId);
        if (window.state?.recipes) {
          window.state.recipes = window.state.recipes.filter(r => r.id !== recipeId);
        }
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`Deleted "${recipe.name}"`);
      } catch (err) {
        console.error('[VaultRecipeCard] Error deleting recipe:', err);
      }
    }
  };
}

export function openEnhancedRecipeActions(evt, recipeId) {
  return openRecipeActions(evt, recipeId, 'enhanced');
}

function closeAllRecipeActionMenus() {
  document.querySelectorAll('.recipe-actions-dropdown-menu').forEach(m => m.remove());
}

export function renderVaultRecipeCard(r, options = {}) {
  const types = r.types || [r.type || 'dinner'];
  const mealType = options.mealType || (types[0] || 'dinner');
  const whoKey = String(r.who || 'both').toLowerCase();
  const showE = whoKey === 'both' || whoKey === 'elliott' || whoKey === 'e';
  const showC = whoKey === 'both' || whoKey === 'chloe' || whoKey === 'c';
  const personLabel = whoKey === 'both' ? 'Shared' : (whoKey === 'elliott' || whoKey === 'e' ? 'Elliott' : 'Chloe');

  const badges = types.map(t => `<span class="badge ${t === 'breakfast' ? 'badge-green' : t === 'lunch' ? 'badge-purple' : 'badge-coral'}">${escapeHtml(t.toUpperCase())}</span>`).join(' ');

  const origFav = typeof window.isRecipeVariantFavourite === 'function' ? window.isRecipeVariantFavourite(r.id, 'original') : (r.isFavourite || r.isFavorite);
  const enhFav = typeof window.isRecipeVariantFavourite === 'function' ? window.isRecipeVariantFavourite(r.id, 'enhanced') : false;
  const isAnyFav = origFav || enhFav;
  const favTag = isAnyFav ? `<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span>` : '';

  const matchData = r.pantryMatch || calculateRecipePantryMatch(r);
  const pantryTag = matchData && matchData.totalCount > 0 ? `<span class="tag pantry-tag" style="background:#e0f2fe;color:#0369a1;border-color:#bae6fd;font-weight:600" title="${matchData.matchedCount}/${matchData.totalCount} ingredients in pantry">📦 ${matchData.matchPercentage}% in pantry</span>` : '';
  const useUpTag = matchData && matchData.useUpMatches && matchData.useUpMatches.length > 0 ? `<span class="tag useup-tag" style="background:#fef3c7;color:#92400e;border-color:#fde68a;font-weight:700" title="Uses ${matchData.useUpMatches.length} use-up item(s)">🔥 ${matchData.useUpMatches.length} Use-Up</span>` : '';

  const meta = [
    favTag,
    useUpTag,
    pantryTag,
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
        <button class="btn sm btn-ghost ghost mobile-more" data-action="open-recipe-actions" data-recipe-id="${escapeAttr(r.id)}" data-variant="original" onclick="openRecipeActions(event, '${escapeAttr(r.id)}', 'original')">More</button>
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
          <button class="btn sm btn-ghost ghost enhanced-more-action" data-action="open-enhanced-recipe-actions" data-recipe-id="${escapeAttr(r.id)}" data-variant="enhanced" onclick="openEnhancedRecipeActions(event, '${escapeAttr(r.id)}')">More</button>
        </div>
      </div>
    </div>` : ''}
  </div>`;
}

if (typeof window !== 'undefined') {
  window.openRecipeActions = openRecipeActions;
  window.openEnhancedRecipeActions = openEnhancedRecipeActions;
}
