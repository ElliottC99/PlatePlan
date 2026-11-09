import { getState } from '../store/coreState.js';
import store from "../store/store.js";
/**
 * src/views/RecipeVaultView.js (v3.20.15)
 * Atomic Recipe Vault Component & Actions Module.
 * Decoupled from direct Firestore SDK, pure reactive Store interactions.
 * Features real-time Cloud subscription synchronization and DocumentFragment rendering.
 */
import { savePreferences } from '../services/HouseholdRepository.js';
import { renderVaultRecipeCard, getNormalizedRecipeTypes } from '../components/vault/VaultRecipeCard.js';
import { renderVaultGridContainer } from '../components/vault/VaultGridContainer.js';
import * as VaultFilterToolbar from '../components/vault/VaultFilterToolbar.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
import { getSortedRecipes } from '../services/FitScoreService.js';
import { formatRecipeIngredientRow, renderRecipeIngredientsListHTML } from '../components/recipe/RecipeDetailModalUI.js';
import { subscribe } from '../store/store.js';
import { findDuplicateRecipeClusters, mergeDuplicateRecipeCluster } from '../services/RecipeFirestoreRepository.js';
import { escapeHtml, escapeAttr } from '../utils/stringUtils.js';

export { renderVaultRecipeCard, getNormalizedRecipeTypes, renderVaultGridContainer, VaultFilterToolbar, calculateMealFitScore, getSortedRecipes, formatRecipeIngredientRow, renderRecipeIngredientsListHTML, findDuplicateRecipeClusters, mergeDuplicateRecipeCluster };

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
  const selectedMealType = ft !== 'all' ? ft : 'all';

  const sortedRecipes = getSortedRecipes(recipesToRender || [], sort, selectedMealType, { activeProfile });

  if (!sortedRecipes.length) {
    list.innerHTML = renderVaultGridContainer({ recipes: [] });
    return;
  }

  list.innerHTML = renderVaultGridContainer({ recipes: sortedRecipes, mealType: selectedMealType, activeProfile });

  if (!list.hasAttribute('data-delegated')) {
    list.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const recipeId = target.dataset.recipeId;
      const variant = target.dataset.variant || 'original';
      
      if (action === 'view-recipe') {
        if (typeof window.viewRecipe === 'function') window.viewRecipe(recipeId, null, variant, activeProfile, target.dataset.mealType || selectedMealType);
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
  renderRecipeVault();
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

  const allRecipesForDedup = getState()?.recipes || (window.Store && typeof window.Store.getState === 'function' ? window.Store.getState().recipes : []) || [];
  const favListForDedup = ensureVariantFavoritingPrefs();
  const duplicateClusters = findDuplicateRecipeClusters(allRecipesForDedup, favListForDedup);
  const clusterCount = duplicateClusters.length;

  // Inject Recipe Actions Bar
  const actionsBar = document.createElement('div');
  actionsBar.className = 'recipe-actions-bar';
  actionsBar.style.display = 'flex';
  actionsBar.style.gap = '6px';
  actionsBar.style.marginBottom = '10px';
  actionsBar.style.flexWrap = 'wrap';
  actionsBar.innerHTML = `
    <button id="btn-manual-recipe" class="btn primary sm">Create Recipe</button>
    <button id="btn-import-recipe" class="btn secondary sm">Paste & Parse Recipes</button>
    <button id="btn-dedup-recipe" class="btn ghost sm" style="font-weight:600; color:var(--text); ${clusterCount > 0 ? 'background:var(--surface2);' : ''}">
      🧹 Deduplicate Recipes ${clusterCount > 0 ? `(${clusterCount})` : ''}
    </button>
  `;
  
  // Clear existing before adding if it exists
  const existingBar = list?.parentElement?.querySelector('.recipe-actions-bar');
  if (existingBar) existingBar.remove();
  if (list?.parentElement) list.parentElement.insertBefore(actionsBar, list);

  // Bind actions
  const btnManual = actionsBar.querySelector('#btn-manual-recipe');
  if (btnManual) {
    btnManual.addEventListener('click', () => {
      if (typeof window.openRecipeWizard === 'function') window.openRecipeWizard('manual');
      else if (typeof window.openRecipeEditor === 'function') window.openRecipeEditor();
    });
  }
  
  const btnImport = actionsBar.querySelector('#btn-import-recipe');
  if (btnImport) {
    btnImport.addEventListener('click', () => {
      if (typeof window.openRecipeWizard === 'function') window.openRecipeWizard('bulk');
      else if (typeof window.openBulkRecipeImporterModal === 'function') window.openBulkRecipeImporterModal();
    });
  }

  const btnDedup = actionsBar.querySelector('#btn-dedup-recipe');
  if (btnDedup) {
    btnDedup.addEventListener('click', () => {
      openRecipeDeduplicationModal();
    });
  }



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
    const ftNorm = String(ft || 'all').toLowerCase();
    const types = getNormalizedRecipeTypes(r);
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

    return (ftNorm === 'all' || types.includes(ftNorm)) && matchesWho && (!q || searchable.includes(q));
  });

  renderRecipeGrid(recipes);
  bindSearchListeners();
  
  if (!window.__vaultGlobalListener) {
    window.__vaultGlobalListener = true;
    
    // Handle Filter Changes
    document.addEventListener('change', (e) => {
      if (e.target.matches('#filter-type, #filter-who, #vault-sort, .pp-vault-filter-input')) {
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
      }
    });

    // Handle Dropdown Clipping (Bottom Viewport Collision)
    document.addEventListener('click', (e) => {
      const moreBtn = e.target.closest('.btn-more, [data-action="toggle-menu"]');
      if (moreBtn) {
        const menu = moreBtn.parentElement.querySelector('.dropdown-menu, .menu-options');
        if (menu) {
          const rect = moreBtn.getBoundingClientRect();
          // If button is within 150px of the bottom of the screen, pop upwards
          if (rect.bottom > window.innerHeight - 150) {
            menu.style.top = 'auto';
            menu.style.bottom = '100%';
          } else {
            menu.style.top = '100%';
            menu.style.bottom = 'auto';
          }
        }
      }
    });
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

export function closeRecipeDeduplicationModal() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }
}

export function openRecipeDeduplicationModal() {
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

  const state = getState() || {};
  const allRecipes = state.recipes || (window.Store && typeof window.Store.getState === 'function' ? window.Store.getState().recipes : []) || [];
  const favList = ensureVariantFavoritingPrefs();
  const clusters = findDuplicateRecipeClusters(allRecipes, favList);

  if (clusters.length === 0) {
    content.innerHTML = `
      <div style="padding:28px 24px; max-width:480px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.15); text-align:center;">
        <div style="font-size:36px; margin-bottom:8px;">🎉</div>
        <h3 style="margin:0 0 8px 0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917);">All Recipes Unique</h3>
        <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 20px 0;">No duplicate recipe clusters detected across your Recipe Vault.</p>
        <button type="button" class="btn sm primary" id="btn-rec-dedup-done" style="padding:6px 18px; font-weight:650;">Done</button>
      </div>
    `;
    wrap.style.setProperty('z-index', '25005', 'important');
    content.style.setProperty('z-index', '25005', 'important');
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';

    const doneBtn = content.querySelector('#btn-rec-dedup-done');
    if (doneBtn) doneBtn.onclick = closeRecipeDeduplicationModal;
    return;
  }

  content.innerHTML = `
    <div style="padding:24px; max-width:620px; width:100%; margin:0 auto; background:var(--surface,#fff); border-radius:14px; position:relative; box-shadow:0 10px 25px rgba(0,0,0,0.15); max-height:85vh; display:flex; flex-direction:column;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid var(--border,#e7e5e4); padding-bottom:10px;">
        <h3 style="margin:0; font-size:1.15rem; font-weight:750; color:var(--text,#1c1917); display:flex; align-items:center; gap:6px;">
          <span>🧹</span> Deduplicate Recipes
        </h3>
        <button type="button" class="btn xs ghost" id="btn-rec-dedup-close" style="font-weight:700;">✕</button>
      </div>

      <p style="font-size:12.5px; color:var(--text2,#78716c); margin:0 0 14px 0;">
        Found <strong>${clusters.length}</strong> duplicate recipe cluster${clusters.length === 1 ? '' : 's'}. Select the canonical version to keep for each dish. Any enhanced variant, favourite status, tags, and active Meal Plan slots will be consolidated into the chosen recipe before duplicates are removed.
      </p>

      <div id="rec-clusters-list" style="overflow-y:auto; flex:1; margin-bottom:16px; padding-right:4px;">
        ${clusters.map((cluster, cIdx) => `
          <div class="rec-cluster-card" data-cidx="${cIdx}" style="background:var(--surface2,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:10px; padding:12px 14px; margin-bottom:12px;">
            <div style="font-size:11px; font-weight:700; color:var(--text2,#64748b); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
              Cluster: "${escapeHtml(cluster.title)}" (${cluster.variants.length} copies)
            </div>
            ${cluster.variants.map((v, vIdx) => {
              const hasEnh = Boolean(v.enhanced);
              const ingCount = Array.isArray(v.ingredients) ? v.ingredients.length : 0;
              const serves = v.servings || v.serves || 4;
              const isFav = Boolean(v.isFavourite || v.isFavorite || favList.includes(`${v.id}_original`));
              const tags = Array.isArray(v.mealSuitability) && v.mealSuitability.length ? v.mealSuitability.join(', ') : (Array.isArray(v.types) ? v.types.join(', ') : 'Dinner');

              return `
                <label style="display:flex; align-items:center; justify-content:space-between; padding:9px 12px; background:var(--surface,#fff); border:1px solid var(--border,#eee); border-radius:8px; margin-bottom:6px; cursor:pointer;">
                  <div style="display:flex; align-items:flex-start; gap:10px; min-width:0;">
                    <input type="radio" name="rec_cluster_${cIdx}" value="${escapeAttr(v.id)}" ${vIdx === 0 ? 'checked' : ''} style="margin-top:3px; cursor:pointer;" />
                    <div style="min-width:0;">
                      <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        <strong style="font-size:13px; color:var(--text,#1c1917);">${escapeHtml(v.name || v.title)}</strong>
                        ${vIdx === 0 ? '<span style="font-size:10px; background:var(--badge-green-bg); color:var(--badge-green-text); font-weight:700; padding:1px 6px; border-radius:4px;">Recommended</span>' : ''}
                        ${hasEnh ? '<span style="font-size:10px; background:var(--badge-blue-bg); color:var(--badge-blue-text); font-weight:700; padding:1px 6px; border-radius:4px;">✨ Enhanced</span>' : ''}
                        ${isFav ? '<span style="font-size:10px; color:#ef4444;">❤️</span>' : ''}
                      </div>
                      <div style="font-size:11.5px; color:var(--text2,#64748b); margin-top:2px;">
                        Tags: ${escapeHtml(tags)} · ${ingCount} ingredients · Serves ${serves}
                      </div>
                    </div>
                  </div>
                  <span style="font-size:11px; color:var(--text2,#64748b); background:var(--surface2,#f1f5f9); padding:2px 8px; border-radius:6px; white-space:nowrap; margin-left:8px;">
                    ${v._stats?.linkedIngCount || 0} mapped
                  </span>
                </label>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border,#e7e5e4); padding-top:12px;">
        <button type="button" class="btn sm ghost" id="btn-rec-dedup-cancel">Cancel</button>
        <button type="button" class="btn sm primary" id="btn-rec-dedup-apply" style="font-weight:650; background:#6366f1; color:#fff;">⚡ Merge Selected (${clusters.length})</button>
      </div>
    </div>
  `;

  wrap.style.setProperty('z-index', '25005', 'important');
  content.style.setProperty('z-index', '25005', 'important');
  wrap.classList.add('open');
  document.body.style.overflow = 'hidden';

  const closeBtn = content.querySelector('#btn-rec-dedup-close');
  const cancelBtn = content.querySelector('#btn-rec-dedup-cancel');
  const applyBtn = content.querySelector('#btn-rec-dedup-apply');

  if (closeBtn) closeBtn.onclick = closeRecipeDeduplicationModal;
  if (cancelBtn) cancelBtn.onclick = closeRecipeDeduplicationModal;

  if (applyBtn) {
    applyBtn.onclick = async () => {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Merging recipes...';

      try {
        let totalMerged = 0;
        for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
          const cluster = clusters[cIdx];
          const checkedRadio = content.querySelector(`input[name="rec_cluster_${cIdx}"]:checked`);
          const targetId = checkedRadio ? checkedRadio.value : cluster.variants[0].id;
          const res = await mergeDuplicateRecipeCluster(cluster.variants, targetId);
          if (res?.success) totalMerged++;
        }

        closeRecipeDeduplicationModal();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Recipe deduplication complete! (${totalMerged} cluster${totalMerged === 1 ? '' : 's'} consolidated)`, 'success');
        }
        if (typeof renderRecipeVault === 'function') renderRecipeVault();
        if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
      } catch (err) {
        console.error('[RecipeDeduplication] Error merging recipes:', err);
        applyBtn.disabled = false;
        applyBtn.textContent = `⚡ Merge Selected (${clusters.length})`;
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Error merging recipes: ${err.message}`, 'error');
        }
      }
    };
  }
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

if (typeof window !== 'undefined') {
  window.toggleRecipeFavourite = toggleRecipeFavourite;
  window.toggleVaultFavouritesFilter = toggleVaultFavouritesFilter;
  window.handleVaultSortChange = handleVaultSortChange;
  window.openRecipeDeduplicationModal = openRecipeDeduplicationModal;
  window.closeRecipeDeduplicationModal = closeRecipeDeduplicationModal;
}
