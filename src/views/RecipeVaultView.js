/**
 * src/views/RecipeVaultView.js (v3.19.3)
 * Atomic Recipe Vault Component & Actions Module.
 * Decoupled from direct Firestore SDK, pure reactive Store interactions.
 * Features optimized DocumentFragment rendering and instant offline caching.
 */
import { savePreferences } from '../services/HouseholdRepository.js';
import { renderVaultRecipeCard } from '../components/vault/VaultRecipeCard.js';
import { renderVaultGridContainer } from '../components/vault/VaultGridContainer.js';
import * as VaultFilterToolbar from '../components/vault/VaultFilterToolbar.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { getSortedRecipes } from '../services/FitScoreService.js';

export { renderVaultRecipeCard, renderVaultGridContainer, VaultFilterToolbar, calculateMealFitScore, getSortedRecipes };

export function hasVariantFavoritingInitialized() {
  const prefs = window.state?.userPrefs || window.state?.prefs || {};
  const list = prefs.favouriteVariantIds || prefs.favoriteVariantIds;
  return Array.isArray(list);
}

export function ensureVariantFavoritingPrefs() {
  if (!window.state) window.state = {};
  if (!window.state.prefs) window.state.prefs = {};
  if (!window.state.userPrefs) window.state.userPrefs = window.state.prefs;
  const prefs = window.state.userPrefs;
  const existing = prefs.favouriteVariantIds || prefs.favoriteVariantIds;
  if (!Array.isArray(existing)) {
    prefs.favouriteVariantIds = [];
    (window.state.recipes || []).forEach(r => {
      if (r && r.id && (r.isFavourite || r.isFavorite)) {
        const key = `${r.id}_original`;
        if (!prefs.favouriteVariantIds.includes(key)) {
          prefs.favouriteVariantIds.push(key);
        }
      }
    });
  } else {
    prefs.favouriteVariantIds = existing;
  }
  window.state.prefs.favouriteVariantIds = prefs.favouriteVariantIds;
  window.state.userPrefs.favoriteVariantIds = prefs.favouriteVariantIds;
  window.state.prefs.favoriteVariantIds = prefs.favouriteVariantIds;
  return prefs.favouriteVariantIds;
}

export function isRecipeVariantFavourite(recipeId, variantKey = 'original') {
  const list = ensureVariantFavoritingPrefs();
  const key = `${recipeId}_${variantKey}`;
  return list.includes(key);
}

export async function toggleRecipeFavourite(recipeId, event, variantKey = 'original') {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const r = (window.state?.recipes || []).find(x => x.id === recipeId);
  if (!r) return;
  const list = ensureVariantFavoritingPrefs();
  const key = `${recipeId}_${variantKey}`;
  const idx = list.indexOf(key);
  const willBeFav = (idx === -1);
  if (willBeFav) {
    list.push(key);
  } else {
    list.splice(idx, 1);
  }
  const isNowFav = isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced');
  r.isFavourite = isNowFav;
  r.isFavorite = isNowFav;
  r.updatedAt = new Date().toISOString();

  if (window.state?.userPrefs) {
    try {
      await savePreferences(window.state.userPrefs, window.state.settings || {});
    } catch (e) {
      console.warn('[RecipeVault v3.8.6] Failed to save favorite preferences:', e);
    }
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: window.state?.recipes }));
  renderRecipeVault();

  if (typeof window.previewBaseRecipe !== 'undefined' && window.previewBaseRecipe && window.previewBaseRecipe.id === recipeId) {
    window.previewBaseRecipe.isFavourite = r.isFavourite;
    window.previewBaseRecipe.isFavorite = r.isFavorite;
    const activeKey = (typeof window.currentViewTab !== 'undefined' && window.currentViewTab === 'enhanced') ? 'enhanced' : 'original';
    const isCurrentActiveFav = isRecipeVariantFavourite(recipeId, activeKey);
    const favBtn = document.getElementById('modal-recipe-fav-btn');
    if (favBtn) {
      favBtn.classList.toggle('active', isCurrentActiveFav);
      const svg = favBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isCurrentActiveFav ? 'currentColor' : 'none');
      favBtn.setAttribute('aria-label', isCurrentActiveFav ? 'Remove from favourites' : 'Add to favourites');
      favBtn.setAttribute('title', isCurrentActiveFav ? 'Favourited' : 'Add to favourites');
    }
    const navSub = document.querySelector('.recipe-view-nav-subtitle');
    if (navSub) {
      const existingTag = navSub.querySelector('.fav-tag');
      if (isCurrentActiveFav && !existingTag) {
        navSub.insertAdjacentHTML('afterbegin', '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span> ');
      } else if (!isCurrentActiveFav && existingTag) {
        existingTag.remove();
      }
    }
  }
  const variantLabel = variantKey === 'enhanced' ? 'Enhanced' : 'Original';
  if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast(willBeFav ? `Added "${r.name} (${variantLabel})" to favourites ❤️` : `Removed "${r.name} (${variantLabel})" from favourites`);
  }
}

export function toggleVaultFavouritesFilter() {
  if (typeof window.vaultFilterFavouritesOnly !== 'undefined') {
    window.vaultFilterFavouritesOnly = !window.vaultFilterFavouritesOnly;
  } else {
    window.vaultFilterFavouritesOnly = true;
  }
  renderRecipeVault();
}

export function renderRecipeVault() {
  const ftEl = document.getElementById('filter-type');
  const fwEl = document.getElementById('filter-who');
  const ft = ftEl ? ftEl.value : 'all';
  const fw = fwEl ? fwEl.value : 'all';
  const q = (document.getElementById('vault-search')?.value || '').trim().toLowerCase();
  const sort = document.getElementById('vault-sort')?.value || 'fit-desc';
  const list = document.getElementById('vault-list');

  const hasData = (window.state?.recipes?.length > 0) || window.state?.isCachedHydrated;
  if (!window.state?.isCloudHydrated && !hasData) {
    if (list) {
      list.innerHTML = renderVaultGridContainer({ isLoading: true });
    }
    return;
  }

  const favFilterBtn = document.getElementById('vault-filter-fav');
  const isFavOnly = typeof window.vaultFilterFavouritesOnly !== 'undefined' ? window.vaultFilterFavouritesOnly : false;
  if (favFilterBtn) {
    favFilterBtn.classList.toggle('active', !!isFavOnly);
    favFilterBtn.setAttribute('aria-pressed', isFavOnly ? 'true' : 'false');
  }

  ensureVariantFavoritingPrefs();
  const fwNorm = String(fw || 'all').toLowerCase();
  const activeProfile = (fwNorm === 'elliott' || fwNorm === 'chloe') ? fwNorm : 'everyone';

  const recipes = (window.state.recipes || []).filter(r => {
    const hasAnyFav = isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced') || (!hasVariantFavoritingInitialized() && (r.isFavourite || r.isFavorite));
    if (isFavOnly && !hasAnyFav) return false;
    const types = r.types || [r.type];
    const searchable = [
      r.name,
      r.source,
      r.who,
      ...(types || []),
      ...(r.ingredients || []).map(ing => (typeof window.ingRaw === 'function' ? window.ingRaw(ing) : String(ing)))
    ].join(' ').toLowerCase();

    const rWhoNorm = String(r.who || 'both').toLowerCase();
    const matchesWho = fwNorm === 'all' || rWhoNorm === fwNorm || (fwNorm === 'both' && (rWhoNorm === 'both' || !r.who));

    return (ft === 'all' || types.includes(ft)) && matchesWho && (!q || searchable.includes(q));
  });

  const selectedMealType = ft !== 'all' ? ft : 'dinner';
  const sortedRecipes = getSortedRecipes(recipes, sort, selectedMealType, { activeProfile });

  if (!list) return;
  if (!sortedRecipes.length) {
    list.innerHTML = renderVaultGridContainer({ recipes: [] });
    return;
  }

  const listSignature = [ft, fw, q, sort, isFavOnly ? 'fav' : 'all'].join('|');
  if (typeof window.resetProgressiveList === 'function') {
    window.resetProgressiveList('vault', listSignature);
  }
  const totalRecipes = sortedRecipes.length;
  const limit = window.platePlanListLimits?.vault || 50;
  const visibleRecipes = sortedRecipes.slice(0, limit);
  const progressiveBtn = typeof window.progressiveListButton === 'function' ? window.progressiveListButton('vault', totalRecipes, visibleRecipes.length) : '';

  list.innerHTML = renderVaultGridContainer({ recipes: visibleRecipes, mealType: selectedMealType, activeProfile, progressiveBtn });
}

// Global Aliases Mount
if (typeof window !== 'undefined') {
  window.renderVault = renderRecipeVault;
  window.renderRecipeVault = renderRecipeVault;
  window.renderVaultGrid = renderRecipeVault;
  window.renderRecipeCard = renderVaultRecipeCard;
  window.toggleRecipeFavourite = toggleRecipeFavourite;
  window.toggleRecipeFavorite = toggleRecipeFavourite;
  window.isRecipeVariantFavourite = isRecipeVariantFavourite;
  window.isRecipeVariantFavorite = isRecipeVariantFavourite;
  window.toggleVaultFavouritesFilter = toggleVaultFavouritesFilter;
  window.toggleVaultFavoritesFilter = toggleVaultFavouritesFilter;
  window.handleVaultSortChange = function(val) {
    const el = document.getElementById('vault-sort');
    if (el) el.value = val;
    renderRecipeVault();
  };
  window.VaultFilterToolbar = VaultFilterToolbar;
  window.VaultRecipeCard = { renderVaultRecipeCard };
  window.VaultGridContainer = { renderVaultGridContainer };
}

import { subscribe } from '../store/store.js';

let vaultUnsub = null;
let vaultTimer = null;

function handlePreferencesUpdated() {
  if (window.state?.recipes) {
    window.state.recipes.forEach(r => {
      delete r._computedFitScore;
      delete r._computedFitResult;
    });
  }
  if (typeof renderRecipeVault === 'function') {
    renderRecipeVault();
  }
}

export function mount(container) {
  if (typeof renderRecipeVault === 'function') {
    renderRecipeVault();
  }
  vaultUnsub = subscribe('recipes', (recipes) => {
    if (typeof renderRecipeVault === 'function') {
      renderRecipeVault();
    }
  });

  // Re-render on hydration or preference changes
  document.addEventListener('plateplan:state:preferences', handlePreferencesUpdated);
  document.addEventListener('plateplan:state:hydrated', handlePreferencesUpdated);
  window.addEventListener('plateplan:preferences-updated', handlePreferencesUpdated);
}

export function unmount() {
  if (typeof vaultUnsub === 'function') {
    vaultUnsub();
    vaultUnsub = null;
  }
  document.removeEventListener('plateplan:state:preferences', handlePreferencesUpdated);
  document.removeEventListener('plateplan:state:hydrated', handlePreferencesUpdated);
  window.removeEventListener('plateplan:preferences-updated', handlePreferencesUpdated);
  if (vaultTimer) {
    clearTimeout(vaultTimer);
    vaultTimer = null;
  }
}
