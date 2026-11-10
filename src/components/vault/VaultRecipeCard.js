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

export function getNormalizedRecipeTypes(recipe) {
  const r = recipe?.recipe || recipe || {};
  const typesSet = new Set();
  const add = (t) => {
    if (!t) return;
    if (Array.isArray(t)) {
      t.forEach(add);
      return;
    }
    const rawStr = String(t || '').trim().toLowerCase();
    if (!rawStr) return;
    if (rawStr.includes(',')) {
      rawStr.split(',').forEach(add);
      return;
    }
    typesSet.add(rawStr);
    if (rawStr === 'snack') typesSet.add('snacking');
    if (rawStr === 'snacking') typesSet.add('snack');
  };

  add(r.types);
  add(r.mealSuitability);
  add(r.type);
  add(r.mealType);

  return typesSet.size > 0 ? Array.from(typesSet) : ['dinner'];
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

  dropdown.innerHTML = renderRecipeActionsItems(recipeId, isFav, variant);

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

  const closeMenu = () => {
    dropdown.remove();
    document.removeEventListener('click', dismiss, true);
  };

  const dismiss = (event) => {
    if (!dropdown.contains(event.target)) {
      closeMenu();
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss, true), 10);

  // Delegated event listener for all dropdown actions (immune to conditionally omitted items)
  dropdown.addEventListener('click', async (clickEvt) => {
    const item = clickEvt.target.closest('[data-action]');
    if (!item) return;
    clickEvt.stopPropagation();
    closeMenu();

    const action = item.dataset.action;
    switch (action) {
      case 'menu-view':
        if (typeof window.viewRecipe === 'function') {
          window.viewRecipe(recipeId, null, variant);
        }
        break;

      case 'menu-enhance':
        if (typeof window.openEnhanceRecipeModalForCurrent === 'function') {
          window.openEnhanceRecipeModalForCurrent(recipeId);
        }
        break;

      case 'menu-edit':
        if (typeof window.openRecipeWizard === 'function') {
          window.openRecipeWizard('manual', recipeId);
        } else if (typeof window.openRecipeEditor === 'function') {
          window.openRecipeEditor(recipeId);
        }
        break;

      case 'menu-review':
        if (typeof window.openRecipeWizard === 'function') {
          window.openRecipeWizard('review', recipeId, variant);
        }
        break;

      case 'menu-duplicate': {
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
        break;
      }

      case 'menu-favorite':
        if (typeof window.toggleRecipeFavourite === 'function') {
          window.toggleRecipeFavourite(recipeId, clickEvt, variant);
        }
        break;

      case 'menu-delete':
        confirmDeleteVaultRecipe(recipe, async () => {
          try {
            if (variant === 'enhanced') {
              const { deleteRecipeVariant } = await import('../../services/HouseholdRepository.js');
              await deleteRecipeVariant(recipeId, 'enhanced');
              const allRecipes = getState()?.recipes;
              if (Array.isArray(allRecipes)) {
                const r = allRecipes.find(x => x.id === recipeId);
                if (r) {
                  delete r.enhanced;
                  delete r.enhancedFitScore;
                  if (r.variants) delete r.variants.enhanced;
                  r._bestVariant = 'original';
                }
              }
              const favList = getState()?.userPrefs?.variantFavourites;
              if (Array.isArray(favList)) {
                const idx = favList.indexOf(`${recipeId}_enhanced`);
                if (idx !== -1) favList.splice(idx, 1);
              }
              document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: getState()?.recipes }));
              if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
              if (typeof window.showPlatePlanToast === 'function') {
                window.showPlatePlanToast(`Removed enhanced variant from "${recipe.name || recipe.title}"`);
              }
            } else {
              const { deleteRecipe } = await import('../../services/HouseholdRepository.js');
              await deleteRecipe(recipeId);
              if (getState()?.recipes) {
                getState().recipes = getState().recipes.filter(r => r.id !== recipeId);
              }
              document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: getState()?.recipes }));
              if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
              if (typeof window.showPlatePlanToast === 'function') {
                window.showPlatePlanToast(`Deleted "${recipe.name || recipe.title}"`);
              }
            }
          } catch (err) {
            console.error('[VaultRecipeCard] Error deleting recipe/variant:', err);
          }
        }, variant);
        break;
    }
  });
}

function confirmDeleteVaultRecipe(recipe, onConfirm, variant = 'original') {
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
  content.innerHTML = renderDeleteConfirmationContent(recipeTitle, variant);
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
  const types = getNormalizedRecipeTypes(r);
  const requestedMealType = options.mealType || 'all';
  const activeProfile = options.activeProfile || 'everyone';
  const whoKey = String(r.who || 'both').toLowerCase();
  const showE = whoKey === 'both' || whoKey === 'elliott' || whoKey === 'e';
  const showC = whoKey === 'both' || whoKey === 'chloe' || whoKey === 'c';
  const personLabel = whoKey === 'both' ? 'Shared' : (whoKey === 'elliott' || whoKey === 'e' ? 'Elliott' : 'Chloe');

  const displayTypes = Array.from(new Set(types.map(t => (t === 'snack' ? 'snacking' : t))));
  const badges = displayTypes.map(t => {
    let cls = 'badge-coral';
    if (t === 'breakfast') cls = 'badge-green';
    else if (t === 'lunch') cls = 'badge-purple';
    else if (t === 'snack' || t === 'snacking') cls = 'badge-amber';
    return `<span class="badge ${cls}">${escapeHtml(t.toUpperCase())}</span>`;
  }).join(' ');

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

  const buildFit = (_active, useEnhanced = false) => {
    const variantKey = useEnhanced ? 'enhanced' : 'original';
    const liveFitData = typeof window.calculateMealFitScore === 'function'
      ? window.calculateMealFitScore(_active, requestedMealType, { activeProfile, variant: variantKey, portionScaled: true })
      : null;
    const resolvedMealType = liveFitData?.mealType || (requestedMealType !== 'all' ? requestedMealType : (types[0] || 'dinner'));
    
    // Derive portion display directly from liveFitData details
    const e = liveFitData?.details?.elliott;
    const c = liveFitData?.details?.chloe;
    const portions = {
      eCal: e?.recipeKcal || 0,
      eProt: e?.recipeProtein || 0,
      cCal: c?.recipeKcal || 0,
      cProt: c?.recipeProtein || 0,
      e: e && e.recipeKcal ? `${Math.round(e.recipeKcal)}kcal, ${Math.round(e.recipeProtein)}g` : '',
      c: c && c.recipeKcal ? `${Math.round(c.recipeKcal)}kcal, ${Math.round(c.recipeProtein)}g` : ''
    };

    if (liveFitData && typeof liveFitData.score === 'number' && !liveFitData.isMissingMacros) {
      if (!useEnhanced) {
        r.fitScore = liveFitData.score;
        r._computedFitScore = liveFitData.score;
      } else {
        r.enhancedFitScore = liveFitData.score;
        if (r.enhanced && typeof r.enhanced === 'object') {
          r.enhanced.fitScore = liveFitData.score;
          r.enhanced._computedFitScore = liveFitData.score;
        }
      }
    }

    const fitTagHtml = renderFitScoreBadge(_active, resolvedMealType, {
      activeProfile,
      variant: variantKey,
      portions,
      portionScaled: true,
      precomputedFit: liveFitData,
      showLabel: true
    });
    const html = renderFitBlock({ showE, showC, portions, recipeId: r.id, variant: variantKey, fitTagHtml });
    return { portions, html, mealType: resolvedMealType };
  };

  const originalFit = buildFit(r, false);
  const enhancedActive = r.enhanced ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : null;
  const enhancedFit = enhancedActive ? buildFit(enhancedActive, true) : null;
  const enhancedChanges = r.enhanced?.changes ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">${escapeHtml(r.enhanced.changes)}</div>` : '';
  const recipeDisplayName = r.name || r.title || 'Untitled Recipe';
  const expandableName = typeof window.renderExpandableText === 'function' ? window.renderExpandableText(recipeDisplayName, `recipe-${r.id}`, 'recipe-card-name') : escapeHtml(recipeDisplayName);

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
