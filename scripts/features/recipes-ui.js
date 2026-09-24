/**
 * PlatePlan Recipes UI (Rendering & Controls)
 */
(function() {
  window.PlatePlanRecipes = window.PlatePlanRecipes || {};
  const RecipesState = window.PlatePlanRecipes.State;

  function renderRecipeCard(recipe, options = {}) {
    if (!recipe) return '';
    const { mealType = 'dinner', targetMacros = null } = options;
    const ppEscapeHtml = window.ppEscapeHtml || (s => s);
    const ppEscapeAttr = window.ppEscapeAttr || (s => s);
    const isFavFn = window.isRecipeVariantFavourite || (() => false);
    
    const isFavOrig = isFavFn(recipe.id, 'original');
    const isFavEnh = recipe.enhanced ? isFavFn(recipe.id, 'enhanced') : false;
    
    const cal = Math.round(recipe.perServing?.cal || recipe.cal || 0);
    const prot = Math.round((recipe.perServing?.prot || recipe.prot || 0) * 10) / 10;
    
    let fitHtml = '';
    if (targetMacros) {
      const fit = (window.calculateFit || (() => ({})))(cal, prot, targetMacros.e?.cal, targetMacros.e?.prot);
      if (fit.label) {
        fitHtml = `<div class="recipe-fit" style="color:${fit.status === 'green' ? 'var(--green)' : fit.status === 'amber' ? 'var(--amber)' : 'var(--red)'}">${ppEscapeHtml(fit.label)}</div>`;
      }
    }

    return `
      <article class="recipe-card" id="recipe-card-${ppEscapeAttr(recipe.id)}">
        <div class="recipe-card-layout">
          <div class="recipe-card-main">
            <div class="recipe-card-name font-bold">${ppEscapeHtml(recipe.name || 'Untitled Recipe')}</div>
            <div class="recipe-card-meta text-xs text-zinc-500">
              <span>${cal} kcal</span> · <span>${prot}g protein</span>
              ${recipe.source ? ` · <span class="italic">${ppEscapeHtml(recipe.source)}</span>` : ''}
            </div>
            ${fitHtml}
          </div>
          <div class="recipe-card-actions">
            <button class="btn sm ghost ${isFavOrig ? 'active' : ''}" onclick="favoriteRecipe('${ppEscapeAttr(recipe.id)}', 'original')" aria-label="Favorite original">
              ${isFavOrig ? '★' : '☆'}
            </button>
            <button class="btn sm primary mobile-primary" onclick="viewRecipe('${ppEscapeAttr(recipe.id)}')">View</button>
            <button class="btn sm ghost mobile-more" onclick="openRecipeActions('${ppEscapeAttr(recipe.id)}')">Actions</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderVault() {
    const list = document.getElementById('vault-list');
    if (!list) return;

    const allRecipes = (window.state?.recipes || []);
    if (!allRecipes.length && !window.state?.isCloudHydrated) {
      list.innerHTML = `<div class="ios-activity-skeleton"><div class="spinner"></div><span class="ios-activity-skeleton-text">Syncing live recipes from cloud...</span></div>`;
      return;
    }

    // Sync State from DOM
    const ftEl = document.getElementById('filter-type');
    const fwEl = document.getElementById('filter-who');
    const qEl = document.getElementById('vault-search');
    const sortEl = document.getElementById('vault-sort');
    
    if (ftEl) RecipesState.activeFilterType = ftEl.value;
    if (fwEl) RecipesState.activeFilterWho = fwEl.value;
    if (qEl) RecipesState.searchQuery = qEl.value;
    if (sortEl) RecipesState.activeSort = sortEl.value;

    const filtered = window.PlatePlanRecipes.getFilteredRecipes(allRecipes);
    const sortFn = window.PlatePlanRecipes.getSortedRecipes || ((r) => r);
    const mealType = RecipesState.activeFilterType !== 'all' ? RecipesState.activeFilterType : 'dinner';
    const sorted = sortFn(filtered, RecipesState.activeSort, mealType);

    if (!sorted.length) {
      list.innerHTML = '<div class="empty p-8 text-center text-zinc-500 italic">No matching recipes found.</div>';
      return;
    }

    if (typeof resetProgressiveList === 'function') {
      const listSignature = [RecipesState.activeFilterType, RecipesState.activeFilterWho, RecipesState.searchQuery, RecipesState.activeSort, RecipesState.vaultFavOnly ? 'fav' : 'all'].join('|');
      resetProgressiveList('vault', listSignature);
    }

    const prefs = window.state?.prefs || {};
    const targetMacros = (window.PlatePlanRecipes.calculateVaultTargetMacros || (() => null))(prefs, mealType);
    const { e: eTgt, c: cTgt } = targetMacros || { e: {}, c: {} };

    const limit = (window.platePlanListLimits?.vault || 24);
    const visibleRecipes = sorted.slice(0, limit);
    const progBtn = typeof progressiveListButton === 'function' ? progressiveListButton('vault', sorted.length, visibleRecipes.length) : '';

    list.innerHTML = visibleRecipes.map(r => renderRecipeCard(r, { mealType, eTgt, cTgt, targetMacros })).join('') + progBtn;
  }

  function renderExpandableText(text, key, className = '') {
    const value = String(text || '');
    const safeKey = String(key || ('copy-' + (window.dataQualityFingerprint?.(value) || Date.now()))).replace(/[^a-zA-Z0-9_-]/g, '-');
    const needsToggle = value.length > 46;
    const ppEscapeHtml = window.ppEscapeHtml || (s => s);
    const ppEscapeAttr = window.ppEscapeAttr || (s => s);
    
    return `
      <span id="expand-${ppEscapeAttr(safeKey)}" class="${ppEscapeAttr(className)}${needsToggle ? ' clamp-copy' : ''}">
        ${ppEscapeHtml(value)}
      </span>
      ${needsToggle ? `<button type="button" class="btn text-expand-btn text-[10px] text-zinc-400 hover:text-zinc-800 ml-1" onclick="toggleExpandableText(this,'expand-${ppEscapeAttr(safeKey)}')">Show more</button>` : ''}
    `;
  }

  function toggleExpandableText(button, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const expanded = target.classList.toggle('expanded');
    button.textContent = expanded ? 'Show less' : 'Show more';
  }

  function toggleVaultFavouritesFilter() {
    RecipesState.vaultFavOnly = !RecipesState.vaultFavOnly;
    const btn = document.getElementById('vault-filter-fav');
    if (btn) {
      btn.classList.toggle('active', RecipesState.vaultFavOnly);
    }
    renderVault();
  }

  function openVaultFitDetails(trigger, recipeId, variant = 'original', personKey = 'e') {
    const recipe = (typeof getProductIndexRecipe === 'function') ? getProductIndexRecipe(recipeId) : null;
    if (!recipe) return;
    
    const mealType = (typeof getContextMealType === 'function') ? getContextMealType(recipe, null, (recipe.types || [recipe.type || 'dinner'])[0]) : 'dinner';
    const bundle = (typeof calculateRecipeDisplayNutrition === 'function') ? calculateRecipeDisplayNutrition({ recipe, variant, mealType }) : null;
    const portions = bundle?.portions || {};
    const person = personKey === 'c' ? 'Chloe' : 'Elliott';
    const targets = (window.getBudgets || (() => ({cal:0, prot:0})))(personKey, mealType);
    const calories = personKey === 'c' ? portions.cCal : portions.eCal;
    const protein = personKey === 'c' ? portions.cProt : portions.eProt;
    const recipePct = personKey === 'c' ? portions.c : portions.e;
    const fit = (window.calculateFit || (() => ({warn:[]})))(calories, protein, targets.cal, targets.prot);
    const profileScore = (window.computeProfileFitScore || (() => 0))(calories, targets.cal, protein, targets.prot);
    
    const ppEscapeHtml = window.ppEscapeHtml || (s => s);
    const html = `<div style="font-weight:750;font-size:16px;margin-bottom:8px">${ppEscapeHtml(person)} · ${ppEscapeHtml(recipe.name)}</div><div class="nutrition-detail-row"><span>Allocated recipe portion</span><strong>${ppEscapeHtml(recipePct || 'Not allocated')}</strong></div><div class="nutrition-detail-row"><span>Calories</span><strong>${Math.round(calories || 0)} / ${Math.round(targets.cal || 0)} kcal</strong></div><div class="nutrition-detail-row"><span>Protein</span><strong>${(Math.round((protein || 0) * 10) / 10)} / ${(Math.round((targets.prot || 0) * 10) / 10)}g</strong></div><div class="nutrition-detail-row"><span>Slot Fit Score (${person})</span><strong>${Math.round(profileScore)}%</strong></div><div class="msg ${fit.warn.length ? 'info' : 'success'}" style="margin:10px 0 0">${ppEscapeHtml(fit.warn.join(', ') || 'This portion is on target.')}</div>`;
    
    if (typeof showReviewTooltip === 'function') {
      showReviewTooltip(trigger, html, `${person} nutrition and fit details`);
    }
  }

  Object.assign(window.PlatePlanRecipes, {
    renderRecipeCard,
    renderVault,
    renderExpandableText,
    toggleExpandableText,
    toggleVaultFavouritesFilter,
    openVaultFitDetails
  });

  window.renderRecipeCard = renderRecipeCard;
  window.renderVault = renderVault;
  window.renderRecipes = renderVault;
  window.renderExpandableText = renderExpandableText;
  window.toggleExpandableText = toggleExpandableText;
  window.toggleVaultFavouritesFilter = toggleVaultFavouritesFilter;
  window.openVaultFitDetails = openVaultFitDetails;
})();
