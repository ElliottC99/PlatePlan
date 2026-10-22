import { getState } from '../store/coreState.js';
import store from "../store/store.js";
/**
 * src/views/RecipeVaultView.js (v3.20.15)
 * Atomic Recipe Vault Component & Actions Module.
 * Decoupled from direct Firestore SDK, pure reactive Store interactions.
 * Features real-time Cloud subscription synchronization and DocumentFragment rendering.
 */
import { savePreferences } from '../services/HouseholdRepository.js';
import { renderVaultRecipeCard } from '../components/vault/VaultRecipeCard.js';
import { renderVaultGridContainer } from '../components/vault/VaultGridContainer.js';
import * as VaultFilterToolbar from '../components/vault/VaultFilterToolbar.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { getSortedRecipes } from '../services/FitScoreService.js';
import { formatRecipeIngredientRow, renderRecipeIngredientsListHTML } from '../components/recipe/RecipeDetailModalUI.js';
import { subscribe } from '../store/store.js';

export { renderVaultRecipeCard, renderVaultGridContainer, VaultFilterToolbar, calculateMealFitScore, getSortedRecipes, formatRecipeIngredientRow, renderRecipeIngredientsListHTML };

let currentRecipeSearchQuery = '';

export function hasVariantFavoritingInitialized() {
  const state = getState() || {};
  const prefs = state.userPrefs || state.prefs || {};
  const list = prefs.favouriteVariantIds || prefs.favoriteVariantIds;
  return Array.isArray(list);
}

export function ensureVariantFavoritingPrefs() {
  const state = getState() || {};
  if (!state.prefs) state.prefs = {};
  if (!state.userPrefs) state.userPrefs = state.prefs;
  
  const prefs = state.userPrefs;
  const existing = prefs.favouriteVariantIds || prefs.favoriteVariantIds;
  
  if (!Array.isArray(existing)) {
    prefs.favouriteVariantIds = (state.recipes || [])
      .filter(r => r?.id && (r.isFavourite || r.isFavorite))
      .map(r => `${r.id}_original`);
  } else {
    prefs.favouriteVariantIds = existing;
  }
  
  state.prefs.favouriteVariantIds = prefs.favouriteVariantIds;
  state.prefs.favoriteVariantIds = prefs.favouriteVariantIds;
  
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
  const r = (getState()?.recipes || []).find(x => x.id === recipeId);
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

  if (getState()?.userPrefs) {
    try {
      await savePreferences(getState().userPrefs, getState().settings || {});
    } catch (e) {
      console.warn('[RecipeVault v3.8.6] Failed to save favorite preferences:', e);
    }
  }

  document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: getState()?.recipes }));
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

export function renderRecipeGrid(recipesToRender) {
  const list = document.getElementById('vault-list');
  if (!list) return;

  const ftEl = document.getElementById('filter-type');
  const fwEl = document.getElementById('filter-who');
  const ft = ftEl ? ftEl.value : 'all';
  const fw = fwEl ? fwEl.value : 'all';
  const fwNorm = String(fw || 'all').toLowerCase();
  const activeProfile = (fwNorm === 'elliott' || fwNorm === 'chloe') ? fwNorm : 'everyone';
  const sort = document.getElementById('vault-sort')?.value || 'fit-desc';
  const selectedMealType = ft !== 'all' ? ft : 'dinner';

  const sortedRecipes = getSortedRecipes(recipesToRender || [], sort, selectedMealType, { activeProfile });

  if (!sortedRecipes.length) {
    list.innerHTML = renderVaultGridContainer({ recipes: [] });
    return;
  }

  const listSignature = [ft, fw, currentRecipeSearchQuery, sort].join('|');
  if (typeof window.resetProgressiveList === 'function') {
    window.resetProgressiveList('vault', listSignature);
  }
  const totalRecipes = sortedRecipes.length;
  const limit = window.platePlanListLimits?.vault || 50;
  const visibleRecipes = sortedRecipes.slice(0, limit);
  const progressiveBtn = typeof window.progressiveListButton === 'function' ? window.progressiveListButton('vault', totalRecipes, visibleRecipes.length) : '';

  list.innerHTML = renderVaultGridContainer({ recipes: visibleRecipes, mealType: selectedMealType, activeProfile, progressiveBtn });

  if (!list.hasAttribute('data-delegated')) {
    list.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const recipeId = target.dataset.recipeId;
      const variant = target.dataset.variant || 'original';
      
      if (action === 'view-recipe') {
        if (typeof window.viewRecipe === 'function') window.viewRecipe(recipeId, null, variant);
      } else if (action === 'toggle-favorite') {
        if (typeof window.toggleRecipeFavourite === 'function') window.toggleRecipeFavourite(recipeId, e, variant);
      } else if (action === 'open-recipe-actions') {
        if (typeof window.openRecipeActions === 'function') window.openRecipeActions(e, recipeId, variant);
      } else if (action === 'open-enhanced-recipe-actions') {
        if (typeof window.openEnhancedRecipeActions === 'function') window.openEnhancedRecipeActions(e, recipeId);
      } else if (action === 'open-fit-details') {
        const person = target.dataset.person;
        if (typeof window.openVaultFitDetails === 'function') window.openVaultFitDetails(target, recipeId, variant, person);
      }
    });
    list.setAttribute('data-delegated', 'true');
  }
}

export function handleRecipeSearch(query) {
  currentRecipeSearchQuery = (query || '').toLowerCase().trim();

  const state = (window.Store && typeof window.Store.getState === 'function')
    ? window.Store.getState()
    : {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : (getState()?.recipes || []);

  const filtered = recipes.filter(recipe => {
    if (!currentRecipeSearchQuery) return true;
    const nameMatch = String(recipe.name || recipe.title || '').toLowerCase().includes(currentRecipeSearchQuery);
    const catMatch = String(recipe.category || '').toLowerCase().includes(currentRecipeSearchQuery);
    const tagMatch = Array.isArray(recipe.tags) && recipe.tags.some(t => String(t).toLowerCase().includes(currentRecipeSearchQuery));
    const ingMatch = Array.isArray(recipe.ingredients) && recipe.ingredients.some(i => String(i.name || i).toLowerCase().includes(currentRecipeSearchQuery));
    const enh = recipe.enhanced;
    const enhNameMatch = enh && String(enh.name || enh.title || '').toLowerCase().includes(currentRecipeSearchQuery);
    const enhChangesMatch = enh && String(enh.changes || '').toLowerCase().includes(currentRecipeSearchQuery);
    const enhIngMatch = enh && Array.isArray(enh.ingredients) && enh.ingredients.some(i => String(i.name || i).toLowerCase().includes(currentRecipeSearchQuery));
    return nameMatch || catMatch || tagMatch || ingMatch || enhNameMatch || enhChangesMatch || enhIngMatch;
  });

  renderRecipeGrid(filtered);
}

export function renderRecipeVault() {
  if (typeof window !== 'undefined') window.renderRecipeVault = renderRecipeVault;
  const ftEl = document.getElementById('filter-type');
  const fwEl = document.getElementById('filter-who');
  const ft = ftEl ? ftEl.value : 'all';
  const fw = fwEl ? fwEl.value : 'all';
  const searchInput = document.getElementById('recipe-search-input') || document.getElementById('vault-search');
  if (searchInput && searchInput.value && !currentRecipeSearchQuery) {
    currentRecipeSearchQuery = searchInput.value.trim().toLowerCase();
  }
  const q = currentRecipeSearchQuery;
  const list = document.getElementById('vault-list');

  // Inject Recipe Actions Bar
  const actionsBar = document.createElement('div');
  actionsBar.className = 'recipe-actions-bar';
  actionsBar.style.display = 'flex';
  actionsBar.style.gap = '6px';
  actionsBar.style.marginBottom = '10px';
  actionsBar.innerHTML = `
    <button id="btn-manual-recipe" class="btn primary sm">Create Recipe</button>
    <button id="btn-import-recipe" class="btn secondary sm">Paste & Parse Recipes</button>
  `;
  
  // Clear existing before adding if it exists
  const existingBar = list?.parentElement?.querySelector('.recipe-actions-bar');
  if (existingBar) existingBar.remove();
  if (list?.parentElement) list.parentElement.insertBefore(actionsBar, list);

  // Bind actions
  actionsBar.querySelector('#btn-manual-recipe').addEventListener('click', () => {
    if (typeof window.openRecipeWizard === 'function') window.openRecipeWizard('manual');
    else if (typeof window.openRecipeEditor === 'function') window.openRecipeEditor();
  });
  
  actionsBar.querySelector('#btn-import-recipe').addEventListener('click', () => {
    if (typeof window.openRecipeWizard === 'function') window.openRecipeWizard('bulk');
    else if (typeof window.openBulkRecipeImporterModal === 'function') window.openBulkRecipeImporterModal();
  });



  const favFilterBtn = document.getElementById('vault-filter-fav');
  const isFavOnly = typeof window.vaultFilterFavouritesOnly !== 'undefined' ? window.vaultFilterFavouritesOnly : false;
  if (favFilterBtn) {
    favFilterBtn.classList.toggle('active', !!isFavOnly);
    favFilterBtn.setAttribute('aria-pressed', isFavOnly ? 'true' : 'false');
  }

  ensureVariantFavoritingPrefs();
  const fwNorm = String(fw || 'all').toLowerCase();

  const allRecipes = getState()?.recipes || (window.Store && typeof window.Store.getState === 'function' ? window.Store.getState().recipes : []) || [];
  const recipes = allRecipes.filter(r => {
    const hasAnyFav = isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced') || (!hasVariantFavoritingInitialized() && (r.isFavourite || r.isFavorite));
    if (isFavOnly && !hasAnyFav) return false;
    const types = r.types || [r.type];
    const enh = r.enhanced;
    const searchable = [
      r.name,
      r.title,
      r.category,
      r.source,
      r.who,
      ...(types || []),
      ...(Array.isArray(r.tags) ? r.tags : []),
      ...(r.ingredients || []).map(ing => formatRecipeIngredientRow(ing, getState())),
      enh?.name,
      enh?.title,
      enh?.changes,
      ...(enh?.ingredients || []).map(ing => formatRecipeIngredientRow(ing, getState()))
    ].filter(Boolean).join(' ').toLowerCase();

    const rWhoNorm = String(r.who || 'both').toLowerCase();
    const matchesWho = fwNorm === 'all' || rWhoNorm === fwNorm || (fwNorm === 'both' && (rWhoNorm === 'both' || !r.who));

    return (ft === 'all' || types.includes(ft)) && matchesWho && (!q || searchable.includes(q));
  });

  renderRecipeGrid(recipes);
  bindSearchListeners();
  
  const toolbar = document.querySelector('.pp-vault-filter-toolbar');
  if (toolbar && !toolbar.hasAttribute('data-delegated')) {
    toolbar.addEventListener('change', (e) => {
      if (e.target.classList.contains('pp-vault-filter-input')) {
        renderRecipeVault();
      }
    });
    toolbar.addEventListener('input', (e) => {
      if (e.target.classList.contains('pp-vault-filter-input')) {
        renderRecipeVault();
      }
    });
    toolbar.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'toggle-favourites-filter') {
        if (typeof window.toggleVaultFavouritesFilter === 'function') window.toggleVaultFavouritesFilter();
      }
    });
    toolbar.setAttribute('data-delegated', 'true');
  }
}

function bindSearchListeners() {
  const searchEl = document.getElementById('recipe-search-input') || document.getElementById('vault-search') || document.getElementById('global-search-input');
  if (searchEl && !searchEl.__recipeSearchBound) {
    searchEl.__recipeSearchBound = true;
    searchEl.addEventListener('input', (e) => {
      handleRecipeSearch(e.target.value);
    });
    searchEl.addEventListener('search', (e) => {
      handleRecipeSearch(e.target.value);
    });
  }
}

// Global Aliases Mount removed for migration to module-based interaction


let vaultUnsub = null;
let vaultTimer = null;

function handlePreferencesUpdated() {
  if (getState()?.recipes) {
    getState().recipes.forEach(r => {
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
  bindSearchListeners();

  if (container && !container.__vaultFilterDelegated) {
    container.__vaultFilterDelegated = true;
    container.addEventListener('change', (e) => {
      if (e.target.matches('.pp-vault-filter-input')) {
        renderRecipeVault();
      }
    });
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

export function handleVaultSortChange(val) {
  const sortSelect = document.getElementById('vault-sort');
  if (sortSelect && val) {
    sortSelect.value = val;
  }
  renderRecipeVault();
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
