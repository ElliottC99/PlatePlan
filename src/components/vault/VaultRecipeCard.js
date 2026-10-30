/**
 * src/components/vault/VaultRecipeCard.js (v3.38.71)
 * Modular UI component for Recipe Vault Card.
 * Strictly modular (<350 lines).
 */
import { getState } from '../../store/coreState.js';

import { renderFitScoreBadge } from '../FitScoreBadge.js';
import { 
  renderFitBlock, 
  renderRecipeCardShell, 
  renderRecipeActionsItems, 
  renderDeleteConfirmationContent 
} from './VaultRecipeCardRenderService.js';

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

  const allRecipes = (getState()?.recipes || []).concat(window.Store?.getState()?.recipes || []);
  const recipe = allRecipes.find(r => r && r.id === recipeId);
  if (!recipe) return;

  const targetBtn = e?.currentTarget || (e?.target ? e.target.closest('button') : null) || document.querySelector(`[data-recipe-id="${recipeId}"][data-action*="actions"]`);

  const dropdown = document.createElement('div');
  dropdown.className = 'recipe-actions-dropdown-menu';
  dropdown.style.cssText = `
    position: fixed;
    z-index: 9999;
    pointer-events: auto;
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

  const isFav = typeof window.isRecipeVariantFavourite === 'function'
    ? window.isRecipeVariantFavourite(recipeId, variant)
    : (recipe.isFavourite || recipe.isFavorite);

  dropdown.innerHTML = renderRecipeActionsItems(recipeId, isFav);

  if (targetBtn) {
    const rect = targetBtn.getBoundingClientRect();
    const left = Math.max(10, Math.min(rect.right - 180, window.innerWidth - 190));
    dropdown.style.left = `${left}px`;
    
    // Append temporarily to measure height
    document.body.appendChild(dropdown);
    const dropdownHeight = dropdown.offsetHeight || 200;
    dropdown.remove();

    if (rect.bottom + dropdownHeight > window.innerHeight) {
      // Open upwards
      dropdown.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      dropdown.style.top = 'auto';
    } else {
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.bottom = 'auto';
    }
  } else {
    dropdown.style.top = '50%';
    dropdown.style.left = '50%';
    dropdown.style.transform = 'translate(-50%, -50%)';
  }

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
      window.openRecipeWizard('manual', recipeId);
    } else if (typeof window.openRecipeEditor === 'function') {
      window.openRecipeEditor(recipeId);
    }
  };

  dropdown.querySelector('[data-action="menu-review"]').onclick = (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    if (typeof window.openRecipeWizard === 'function') {
      window.openRecipeWizard('review', recipeId);
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
      if (getState()?.recipes) getState().recipes.unshift(dup);
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

  dropdown.querySelector('[data-action="menu-delete"]').onclick = (clickEvt) => {
    clickEvt.stopPropagation();
    dropdown.remove();
    confirmDeleteVaultRecipe(recipe, async () => {
      try {
        const { deleteRecipe } = await import('../../services/HouseholdRepository.js');
        await deleteRecipe(recipeId);
        if (getState()?.recipes) {
          getState().recipes = getState().recipes.filter(r => r.id !== recipeId);
        }
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
        if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`Deleted "${recipe.name || recipe.title}"`);
      } catch (err) {
        console.error('[VaultRecipeCard] Error deleting recipe:', err);
      }
    });
  };
}

function confirmDeleteVaultRecipe(recipe, onConfirm) {
  let wrap = document.getElementById('view-modal-wrap');
  let content = document.getElementById('view-modal-content');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'view-modal-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }
  if (!content) {
    content = document.createElement('div');
    content.id = 'view-modal-content';
    content.className = 'modal';
    wrap.appendChild(content);
  }

  const recipeTitle = recipe.name || recipe.title || 'this recipe';
  content.innerHTML = renderDeleteConfirmationContent(recipeTitle);
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';

  const close = () => {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  };

  const cancelBtn = content.querySelector('#btn-cancel-vault-del');
  if (cancelBtn) cancelBtn.onclick = close;

  const confirmBtn = content.querySelector('#btn-confirm-vault-del');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      close();
      if (typeof onConfirm === 'function') await onConfirm();
    };
  }
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

    const targetMealType = r.types?.[0] || r.type || 'dinner';
    const liveFitData = typeof window.calculateMealFitScore === 'function' ? window.calculateMealFitScore(r, targetMealType) : null;
    if (liveFitData && typeof liveFitData.score === 'number') {
      r.fitScore = liveFitData.score;
      r._computedFitScore = liveFitData.score;
    }

    const fitTagHtml = renderFitScoreBadge(r, mealType, {
      activeProfile: 'everyone',
      variant: useEnhanced ? 'enhanced' : 'original',
      portions,
      portionScaled: true,
      showLabel: true
    });
    const html = renderFitBlock({ showE, showC, portions, recipeId: r.id, variant: useEnhanced ? 'enhanced' : 'original', fitTagHtml });
    return { portions, html };
  };

  const originalFit = buildFit(r, false);
  const enhancedActive = r.enhanced ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : null;
  const enhancedFit = enhancedActive ? buildFit(enhancedActive, true) : null;
  const enhancedChanges = r.enhanced?.changes ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">${escapeHtml(r.enhanced.changes)}</div>` : '';
  const expandableName = typeof window.renderExpandableText === 'function' ? window.renderExpandableText(r.name, `recipe-${r.id}`, 'recipe-card-name') : escapeHtml(r.name);

  return renderRecipeCardShell({
    recipe: r,
    isAnyFav,
    origFav,
    enhFav,
    expandableName,
    meta,
    originalFitHtml: originalFit.html,
    enhancedFitHtml: enhancedFit ? enhancedFit.html : '',
    enhancedChangesHtml: enhancedChanges
  });
}

if (typeof window !== 'undefined') {
  window.openRecipeActions = openRecipeActions;
  window.openEnhancedRecipeActions = openEnhancedRecipeActions;
}
