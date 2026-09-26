/**
 * src/views/RecipeVaultView.js (v3.3.37)
 * Phase 5.4 Hotfix: Recipe Vault favoriting persistence via savePreferences and clean state dispatch.
 */
import { savePreferences } from '../services/HouseholdRepository.js';

export function renderRecipeCard(r, options = {}) {
  const targetMacros = options.targetMacros || (typeof window.getVaultTargetMacros === 'function' ? window.getVaultTargetMacros() : {});
  const types = r.types || [r.type || 'dinner'];
  const mealType = options.mealType || (typeof window.getContextMealType === 'function' ? window.getContextMealType(r, null, types[0] || 'dinner') : (types[0] || 'dinner'));
  const eTgt = options.eTgt || (typeof window.getBudgets === 'function' ? window.getBudgets('e', mealType) : { cal: 500, prot: 35 });
  const cTgt = options.cTgt || (typeof window.getBudgets === 'function' ? window.getBudgets('c', mealType) : { cal: 500, prot: 35 });
  const whoKey = String(r.who || 'both').toLowerCase();
  const showE = options.showE !== undefined ? options.showE : (whoKey === 'both' || whoKey === 'elliott' || whoKey === 'e');
  const showC = options.showC !== undefined ? options.showC : (whoKey === 'both' || whoKey === 'chloe' || whoKey === 'c');
  const personLabel = whoKey === 'both' ? 'Shared' : (whoKey === 'elliott' || whoKey === 'e' ? 'Elliott' : (whoKey === 'chloe' || whoKey === 'c' ? 'Chloe' : r.who || 'Shared'));
  
  const escapeHtml = window.ppEscapeHtml || (s => String(s || ''));
  const escapeAttr = window.ppEscapeAttr || (s => String(s || ''));
  const titleCase = window.toTitleCase || (s => String(s || ''));

  const badges = types.map(t => '<span class="badge ' + (t === 'breakfast' ? 'badge-green' : t === 'lunch' ? 'badge-purple' : 'badge-coral') + '">' + escapeHtml(titleCase(t)) + '</span>').join(' ');

  const origFav = isRecipeVariantFavourite(r.id, 'original') || (!hasVariantFavoritingInitialized() && (r.isFavourite || r.isFavorite));
  const enhFav = isRecipeVariantFavourite(r.id, 'enhanced');
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
    const portions = bundle?.portions || (typeof window.calcPortions === 'function' ? window.calcPortions({}, window.state?.prefs || {}, r.serves || 2, r.who || 'both', mealType) : { eCal: 0, eProt: 0, cCal: 0, cProt: 0, e: '', c: '' });
    const parts = [];
    if (showE) {
      const fitE = typeof window.calculateFit === 'function' ? window.calculateFit(portions.eCal, portions.eProt, eTgt.cal, eTgt.prot) : { label: 'Good' };
      parts.push(`<button type="button" class="fit-detail-button" onclick="openVaultFitDetails(this,'${escapeAttr(r.id)}','${useEnhanced ? 'enhanced' : 'original'}','e')">Elliott ${(fitE.label || '').split(' ')[0]} ${escapeHtml(portions.e || '')}</button>`);
    }
    if (showC) {
      const fitC = typeof window.calculateFit === 'function' ? window.calculateFit(portions.cCal, portions.cProt, cTgt.cal, cTgt.prot) : { label: 'Good' };
      parts.push(`<button type="button" class="fit-detail-button" onclick="openVaultFitDetails(this,'${escapeAttr(r.id)}','${useEnhanced ? 'enhanced' : 'original'}','c')">Chloe ${(fitC.label || '').split(' ')[0]} ${escapeHtml(portions.c || '')}</button>`);
    }

    const { score, color, label } = typeof window.calculateMacroFitTierAndScore === 'function' ? window.calculateMacroFitTierAndScore({ recipe: r, variant: useEnhanced ? 'enhanced' : 'original', portions }, mealType) : { score: '80', color: '#10b981', label: 'Good' };
    const fitTag = `<span class="tag" style="background-color:${color};color:#FFFFFF;border-color:${color};font-weight:600" title="${escapeAttr(label)}">Fit score ${score}${useEnhanced ? ' · enhanced' : ''}</span>`;
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
          <button type="button" class="recipe-fav-btn ${origFav ? 'active' : ''}" onclick="toggleRecipeFavourite('${escapeAttr(r.id)}', event, 'original')" aria-label="${origFav ? 'Remove original from favourites' : 'Add original to favourites'}" title="${origFav ? 'Original variant favourited' : 'Add original to favourites'}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${origFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        </div>
        <div class="recipe-card-meta">${meta}</div>
        ${originalFit.html}
      </div>
      <div class="recipe-card-actions">
        <button class="btn sm primary mobile-primary" onclick="viewRecipe('${escapeAttr(r.id)}', null)">View</button>
        <button class="btn sm ghost mobile-more" onclick="openRecipeActions('${escapeAttr(r.id)}')">More</button>
      </div>
    </div>
    ${r.enhanced ? `<div class="enhanced-box">
      <div class="enhanced-layout">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div class="enhanced-lbl" style="margin-bottom:0">Enhanced version</div>
            <button type="button" class="recipe-fav-btn sm ${enhFav ? 'active' : ''}" onclick="toggleRecipeFavourite('${escapeAttr(r.id)}', event, 'enhanced')" aria-label="${enhFav ? 'Remove enhanced from favourites' : 'Add enhanced to favourites'}" title="${enhFav ? 'Enhanced variant favourited' : 'Add enhanced to favourites'}" style="padding:2px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${enhFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          ${enhancedFit.html}
          ${enhancedChanges}
        </div>
        <div class="enhanced-actions">
          <button class="btn sm primary enhanced-primary-action" onclick="viewRecipe('${escapeAttr(r.id)}', null, 'enhanced')">View</button>
          <button class="btn sm ghost enhanced-more-action" onclick="openEnhancedRecipeActions('${escapeAttr(r.id)}')">More</button>
        </div>
      </div>
    </div>` : ''}
  </div>`;
}

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

  // Persist directly via savePreferences without triggering plan-save logic
  if (window.state?.userPrefs) {
    try {
      await savePreferences(window.state.userPrefs, window.state.settings || {});
    } catch (e) {
      console.warn('[RecipeVault] Failed to save favorite preferences:', e);
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
  const sort = document.getElementById('vault-sort')?.value || 'name';
  const list = document.getElementById('vault-list');

  if (!window.state?.isCloudHydrated) {
    if (list) {
      list.innerHTML = `<div class="ios-activity-skeleton">
        <div class="spinner"></div>
        <span class="ios-activity-skeleton-text">Syncing live recipes from cloud...</span>
      </div>`;
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
    return (ft === 'all' || types.includes(ft)) && (fw === 'all' || r.who === fw) && (!q || searchable.includes(q));
  });

  const selectedMealType = ft !== 'all' ? ft : 'dinner';
  const sortedRecipes = typeof window.getSortedRecipes === 'function' ? window.getSortedRecipes(recipes, sort, selectedMealType) : recipes;

  if (!list) return;
  if (!sortedRecipes.length) {
    list.innerHTML = '<div class="empty">No matching recipes found.</div>';
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

  list.innerHTML = visibleRecipes.map(r => renderRecipeCard(r, { mealType: selectedMealType })).join('') + progressiveBtn;
}

// Global Aliases Mount
if (typeof window !== 'undefined') {
  window.renderVault = renderRecipeVault;
  window.renderRecipeVault = renderRecipeVault;
  window.renderVaultGrid = renderRecipeVault;
  window.renderRecipeCard = renderRecipeCard;
  window.toggleRecipeFavourite = toggleRecipeFavourite;
  window.toggleRecipeFavorite = toggleRecipeFavourite;
  window.isRecipeVariantFavourite = isRecipeVariantFavourite;
  window.isRecipeVariantFavorite = isRecipeVariantFavourite;
  window.toggleVaultFavouritesFilter = toggleVaultFavouritesFilter;
  window.toggleVaultFavoritesFilter = toggleVaultFavouritesFilter;
}

console.log('[RecipeVaultView v3.3.37] Loaded successfully.');
