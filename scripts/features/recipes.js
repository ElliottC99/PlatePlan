/**
 * PlatePlan v3.3.1-mod - Recipe Vault Module
 * Extracted from monolith for modular maintenance.
 */
import { createLegacyView } from './create-legacy-view.js?v=3.3.0';

export function isRecipeVariantFavourite(recipeId, variantKey = 'original') {
  if (!recipeId) return false;
  const list = typeof window.ensureVariantFavoritingPrefs === 'function'
    ? window.ensureVariantFavoritingPrefs()
    : (window.state?.userPrefs?.favouriteVariantIds || window.state?.prefs?.favouriteVariantIds || []);
  const key = `${recipeId}_${variantKey}`;
  if (Array.isArray(list) && list.includes(key)) {
    return true;
  }
  const hasInit = typeof window.hasVariantFavoritingInitialized === 'function'
    ? window.hasVariantFavoritingInitialized()
    : false;
  if (!hasInit && variantKey === 'original') {
    const rec = (window.state?.recipes || []).find(r => r && r.id === recipeId);
    if (rec && (rec.isFavourite || rec.isFavorite)) return true;
  }
  return false;
}
export const isRecipeVariantFavorite = isRecipeVariantFavourite;

// == DUAL-PROFILE MEAL-SLOT TARGET RESOLVER ==
// (Internal dependency for fit scores)
function getMealTypeTargets(mealType = 'dinner') {
  const mt = (mealType || 'dinner').toLowerCase();
  const eTgt = typeof window.getBudgets === 'function' ? window.getBudgets('e', mt) : { cal: 840, prot: 45.5 };
  const cTgt = typeof window.getBudgets === 'function' ? window.getBudgets('c', mt) : { cal: 595, prot: 35 };
  return {
    mealType: mt,
    targetCal_E: Number(eTgt?.cal) || 0,
    targetProt_E: Number(eTgt?.prot) || 0,
    targetCal_C: Number(cTgt?.cal) || 0,
    targetProt_C: Number(cTgt?.prot) || 0,
    e: eTgt,
    c: cTgt
  };
}

function getVaultTargetMacros(mealType = 'dinner') {
  return getMealTypeTargets(mealType);
}

function computeProfileFitScore(actualCal, targetCal, actualProt, targetProt) {
  const aCal = Number(actualCal) || 0;
  const tCal = Number(targetCal) || 0;
  const aProt = Number(actualProt) || 0;
  const tProt = Number(targetProt) || 0;

  let calScore = 100;
  if (tCal > 0) {
    const calError = Math.abs(aCal - tCal) / tCal;
    calScore = Math.max(0, 100 - (calError * 100));
  }

  let protScore = 100;
  if (tProt > 0) {
    protScore = aProt >= tProt
      ? 100
      : Math.max(0, 100 - (((tProt - aProt) / tProt) * 100));
  }

  return (calScore * 0.50) + (protScore * 0.50);
}

// == v3.0.6 DUAL-PORTION MEAL-TYPE FIT SCORE ENGINE ==
function calculateMacroFitTierAndScore(calActualOrRecipe, mealTypeOrTargets, protAct, protTgt) {
  let mealType = 'dinner';
  let variant = 'original';
  let recipeObj = null;
  let customTargets = null;

  let actualCal_E = 0, targetCal_E = 0, actualProt_E = 0, targetProt_E = 0;
  let actualCal_C = 0, targetCal_C = 0, actualProt_C = 0, targetProt_C = 0;
  let whoKey = 'both';

  if (typeof calActualOrRecipe === 'object' && calActualOrRecipe !== null) {
    recipeObj = calActualOrRecipe.recipe || calActualOrRecipe;
    variant = calActualOrRecipe.variant || 'original';

    if (typeof mealTypeOrTargets === 'string') {
      mealType = mealTypeOrTargets;
    } else if (typeof mealTypeOrTargets === 'object' && mealTypeOrTargets !== null) {
      if (mealTypeOrTargets.mealType) mealType = mealTypeOrTargets.mealType;
      if (mealTypeOrTargets.variant) variant = mealTypeOrTargets.variant;
      customTargets = mealTypeOrTargets;
    } else if (calActualOrRecipe.mealType) {
      mealType = calActualOrRecipe.mealType;
    } else {
      const types = recipeObj.types || [recipeObj.type || 'dinner'];
      mealType = types[0] || 'dinner';
    }

    whoKey = String(recipeObj.who || 'both').trim().toLowerCase();

    // Resolve meal slot targets
    const slotTargets = customTargets || getMealTypeTargets(mealType);
    targetCal_E = Number(slotTargets.targetCal_E ?? slotTargets.eCal ?? slotTargets.e?.cal ?? slotTargets.cal) || 0;
    targetProt_E = Number(slotTargets.targetProt_E ?? slotTargets.eProt ?? slotTargets.e?.prot ?? slotTargets.prot) || 0;
    targetCal_C = Number(slotTargets.targetCal_C ?? slotTargets.cCal ?? slotTargets.c?.cal ?? slotTargets.cal) || 0;
    targetProt_C = Number(slotTargets.targetProt_C ?? slotTargets.cProt ?? slotTargets.c?.prot ?? slotTargets.prot) || 0;

    // Resolve split portions
    let portions = calActualOrRecipe.portions;
    if (!portions && typeof window.calculateRecipeDisplayNutrition === 'function' && (recipeObj.ingredients || recipeObj.enhanced || recipeObj.name)) {
      try {
        const bundle = window.calculateRecipeDisplayNutrition({ recipe: recipeObj, variant, mealType });
        portions = bundle?.portions;
      } catch (e) {}
    }

    if (!portions && typeof window.calcPortions === 'function') {
      const perServing = recipeObj.perServing || recipeObj.nutrition || recipeObj;
      portions = window.calcPortions(perServing, window.state?.prefs || {}, recipeObj.serves || 2, recipeObj.who || 'both', mealType);
    }

    if (portions) {
      actualCal_E = Number(portions.eCal) || 0;
      actualProt_E = Number(portions.eProt) || 0;
      actualCal_C = Number(portions.cCal) || 0;
      actualProt_C = Number(portions.cProt) || 0;
    } else {
      const ps = recipeObj.perServing || recipeObj.nutrition || recipeObj;
      const cal = Number(ps.cal ?? ps.calories ?? ps.kcal) || 0;
      const prot = Number(ps.prot ?? ps.protein) || 0;
      actualCal_E = cal;
      actualProt_E = prot;
      actualCal_C = cal;
      actualProt_C = prot;
    }
  } else {
    // Positional arguments
    const actCal = Number(calActualOrRecipe) || 0;
    const tgtCal = Number(mealTypeOrTargets) || 0;
    const actProt = Number(protAct) || 0;
    const tgtProt = Number(protTgt) || 0;

    actualCal_E = actCal;
    targetCal_E = tgtCal;
    actualProt_E = actProt;
    targetProt_E = tgtProt;

    actualCal_C = actCal;
    targetCal_C = tgtCal;
    actualProt_C = actProt;
    targetProt_C = tgtProt;
  }

  const score_Elliott = computeProfileFitScore(actualCal_E, targetCal_E, actualProt_E, targetProt_E);
  const score_Chloe = computeProfileFitScore(actualCal_C, targetCal_C, actualProt_C, targetProt_C);

  let finalScore = 0;
  if (whoKey === 'elliott' || whoKey === 'e') {
    finalScore = Math.round(score_Elliott);
  } else if (whoKey === 'chloe' || whoKey === 'c') {
    finalScore = Math.round(score_Chloe);
  } else {
    finalScore = Math.round((score_Elliott * 0.50) + (score_Chloe * 0.50));
  }

  const clampedScore = Math.max(0, Math.min(100, finalScore));

  let tier = 'red';
  let label = 'Poor Fit';
  let color = '#EF4444';
  let colors = 'background-color:#EF4444;color:#FFFFFF;';

  if (clampedScore >= 85) {
    tier = 'green';
    label = 'Ideal Fit';
    color = '#10B981';
    colors = 'background-color:#10B981;color:#FFFFFF;';
  } else if (clampedScore >= 65) {
    tier = 'amber-green';
    label = 'Acceptable Fit';
    color = '#84CC16';
    colors = 'background-color:#84CC16;color:#FFFFFF;';
  } else if (clampedScore >= 40) {
    tier = 'amber-red';
    label = 'Suboptimal Fit';
    color = '#F59E0B';
    colors = 'background-color:#F59E0B;color:#FFFFFF;';
  } else {
    tier = 'red';
    label = 'Poor Fit';
    color = '#EF4444';
    colors = 'background-color:#EF4444;color:#FFFFFF;';
  }

  const badgeStyle = `${colors}border-radius:4px;padding:2px 8px;font-weight:600;font-size:11px;display:inline-block;`;

  return {
    tier,
    score: clampedScore,
    raw: clampedScore,
    color,
    label,
    colors,
    badgeStyle,
    score_E: score_Elliott,
    score_C: score_Chloe
  };
}

// == RECIPE VAULT CARD RENDERER ==
function renderRecipeCard(r, options = {}) {
  const targetMacros = options.targetMacros || getVaultTargetMacros();
  const types = r.types || [r.type || 'dinner'];
  const mealType = options.mealType || window.getContextMealType(r, null, types[0] || 'dinner');
  const eTgt = options.eTgt || window.getBudgets('e', mealType);
  const cTgt = options.cTgt || window.getBudgets('c', mealType);
  const whoKey = String(r.who || 'both').toLowerCase();
  const showE = options.showE !== undefined ? options.showE : (whoKey === 'both' || whoKey === 'elliott' || whoKey === 'e');
  const showC = options.showC !== undefined ? options.showC : (whoKey === 'both' || whoKey === 'chloe' || whoKey === 'c');
  const personLabel = whoKey === 'both' ? 'Shared' : (whoKey === 'elliott' || whoKey === 'e' ? 'Elliott' : (whoKey === 'chloe' || whoKey === 'c' ? 'Chloe' : r.who || 'Shared'));
  const badges = types.map(t => '<span class="badge ' + (t === 'breakfast' ? 'badge-green' : t === 'lunch' ? 'badge-purple' : 'badge-coral') + '">' + window.ppEscapeHtml(window.toTitleCase(t)) + '</span>').join(' ');

  const origFav = window.isRecipeVariantFavourite(r.id, 'original') || (!window.hasVariantFavoritingInitialized() && (r.isFavourite || r.isFavorite));
  const enhFav = window.isRecipeVariantFavourite(r.id, 'enhanced');
  const isAnyFav = origFav || enhFav;
  const favTag = isAnyFav ? `<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span>` : '';
  const meta = [
    favTag,
    badges,
    `<span class="tag">${window.ppEscapeHtml(personLabel)}</span>`,
    r.serves ? `<span class="tag">Serves ${window.ppEscapeHtml(r.serves)}</span>` : '',
    r.time ? `<span class="tag">${window.ppEscapeHtml(r.time)}m</span>` : ''
  ].filter(Boolean).join(' ');

  const buildFit = (active, useEnhanced = false) => {
    const bundle = window.calculateRecipeDisplayNutrition({ recipe: r, variant: useEnhanced ? 'enhanced' : 'original', mealType });
    const portions = bundle?.portions || window.calcPortions({}, window.state.prefs, r.serves || 2, r.who || 'both', mealType);
    const parts = [];
    if (showE) {
      const fitE = window.calculateFit(portions.eCal, portions.eProt, eTgt.cal, eTgt.prot);
      parts.push(`<button type="button" class="fit-detail-button" onclick="openVaultFitDetails(this,'${window.ppEscapeAttr(r.id)}','${useEnhanced ? 'enhanced' : 'original'}','e')">Elliott ${fitE.label.split(' ')[0]} ${window.ppEscapeHtml(portions.e)}</button>`);
    }
    if (showC) {
      const fitC = window.calculateFit(portions.cCal, portions.cProt, cTgt.cal, cTgt.prot);
      parts.push(`<button type="button" class="fit-detail-button" onclick="openVaultFitDetails(this,'${window.ppEscapeAttr(r.id)}','${useEnhanced ? 'enhanced' : 'original'}','c')">Chloe ${fitC.label.split(' ')[0]} ${window.ppEscapeHtml(portions.c)}</button>`);
    }

    const { score, color, label } = calculateMacroFitTierAndScore({ recipe: r, variant: useEnhanced ? 'enhanced' : 'original', portions }, mealType);
    const fitTag = `<span class="tag" style="background-color:${color};color:#FFFFFF;border-color:${color};font-weight:600" title="${window.ppEscapeAttr(label)}">Fit score ${score}${useEnhanced ? ' · enhanced' : ''}</span>`;
    return { portions, html: `<div class="recipe-fit">${parts.join('')} ${fitTag}</div>` };
  };

  const originalFit = buildFit(r, false);
  const enhancedActive = r.enhanced ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : null;
  const enhancedFit = enhancedActive ? buildFit(enhancedActive, true) : null;
  const enhancedChanges = r.enhanced?.changes ? `<div style="font-size:12px;color:var(--text2);margin-top:6px">${window.ppEscapeHtml(r.enhanced.changes)}</div>` : '';

  return `<div class="recipe-card ${isAnyFav ? 'is-favorite' : ''}">
    <div class="recipe-card-layout">
      <div class="recipe-card-main">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          ${window.renderExpandableText(r.name, `recipe-${r.id}`, 'recipe-card-name')}
          <button type="button" class="recipe-fav-btn ${origFav ? 'active' : ''}" onclick="toggleRecipeFavourite('${window.ppEscapeAttr(r.id)}', event, 'original')" aria-label="${origFav ? 'Remove original from favourites' : 'Add original to favourites'}" title="${origFav ? 'Original variant favourited' : 'Add original to favourites'}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="${origFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        </div>
        <div class="recipe-card-meta">${meta}</div>
        ${originalFit.html}
      </div>
      <div class="recipe-card-actions">
        <button class="btn sm primary mobile-primary" onclick="viewRecipe('${window.ppEscapeAttr(r.id)}', null)">View</button>
        <button class="btn sm ghost mobile-more" onclick="openRecipeActions('${window.ppEscapeAttr(r.id)}')">More</button>
      </div>
    </div>
    ${r.enhanced ? `<div class="enhanced-box">
      <div class="enhanced-layout">
        <div style="min-width:0;flex:1">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div class="enhanced-lbl" style="margin-bottom:0">Enhanced version</div>
            <button type="button" class="recipe-fav-btn sm ${enhFav ? 'active' : ''}" onclick="toggleRecipeFavourite('${window.ppEscapeAttr(r.id)}', event, 'enhanced')" aria-label="${enhFav ? 'Remove enhanced from favourites' : 'Add enhanced to favourites'}" title="${enhFav ? 'Enhanced variant favourited' : 'Add enhanced to favourites'}" style="padding:2px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${enhFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
          </div>
          ${enhancedFit.html}
          ${enhancedChanges}
        </div>
        <div class="enhanced-actions">
          <button class="btn sm primary enhanced-primary-action" onclick="viewRecipe('${window.ppEscapeAttr(r.id)}', null, 'enhanced')">View</button>
          <button class="btn sm ghost enhanced-more-action" onclick="openEnhancedRecipeActions('${window.ppEscapeAttr(r.id)}')">More</button>
        </div>
      </div>
    </div>` : ''}
  </div>`;
}

function renderVault() {
  const ft = document.getElementById('filter-type')?.value || 'all';
  const fw = document.getElementById('filter-who')?.value || 'all';
  const q = (document.getElementById('vault-search')?.value || '').trim().toLowerCase();
  const sort = (document.getElementById('vault-sort')?.value) || 'name';
  const list = document.getElementById('vault-list');

  if (!list) return;

  if (!window.state?.isCloudHydrated) {
    list.innerHTML = `<div class="ios-activity-skeleton">
      <div class="spinner"></div>
      <span class="ios-activity-skeleton-text">Syncing live recipes from cloud...</span>
    </div>`;
    return;
  }

  const favFilterBtn = document.getElementById('vault-filter-fav');
  if (favFilterBtn) {
    favFilterBtn.classList.toggle('active', !!window.vaultFilterFavouritesOnly);
    favFilterBtn.setAttribute('aria-pressed', window.vaultFilterFavouritesOnly ? 'true' : 'false');
  }

  if (typeof window.ensureVariantFavoritingPrefs === 'function') {
    window.ensureVariantFavoritingPrefs();
  }
  const recipes = (window.state?.recipes || []).filter(r => {
    const hasAnyFav = isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced') || (!window.hasVariantFavoritingInitialized() && (r.isFavourite || r.isFavorite));
    if (window.vaultFilterFavouritesOnly && !hasAnyFav) return false;
    const types = r.types || [r.type];
    const searchable = [
      r.name,
      r.source,
      r.who,
      ...(types || []),
      ...(r.ingredients || []).map(ing => (typeof window.ingRaw === 'function' ? window.ingRaw(ing) : (ing?.name || '')))
    ].join(' ').toLowerCase();
    return (ft === 'all' || types.includes(ft)) && (fw === 'all' || r.who === fw) && (!q || searchable.includes(q));
  });

  const selectedMealType = ft !== 'all' ? ft : 'dinner';
  const sortedRecipes = (typeof window.getSortedRecipes === 'function')
    ? window.getSortedRecipes(recipes, sort, selectedMealType)
    : recipes;

  if (!sortedRecipes.length) { list.innerHTML = '<div class="empty">No matching recipes found.</div>'; return; }
  const listSignature = [ft, fw, q, sort, window.vaultFilterFavouritesOnly ? 'fav' : 'all'].join('|');
  if (typeof window.resetProgressiveList === 'function') {
    window.resetProgressiveList('vault', listSignature);
  }
  const totalRecipes = sortedRecipes.length;
  const visibleCount = window.platePlanListLimits?.vault || 24;
  const visibleRecipes = sortedRecipes.slice(0, visibleCount);
  const progBtn = typeof window.progressiveListButton === 'function'
    ? window.progressiveListButton('vault', totalRecipes, visibleRecipes.length)
    : '';
  list.innerHTML = visibleRecipes.map(r => renderRecipeCard(r, { mealType: selectedMealType })).join('') + progBtn;
}

function viewRecipe(id, instanceId = null, tab = 'original', servingMode = 'both') {
  const r = window.state.recipes.find(x => x.id === id);
  if (!r) return;
  window.previewBaseRecipe = window.clonePlatePlanValue(r);
  window.currentPreviewInstanceId = instanceId;
  window.currentViewTab = (tab === 'enhanced' && r.enhanced) ? 'enhanced' : 'original';
  window.currentPreviewServingMode = servingMode || 'both';
  window.currentPreviewSingleServes = 1;

  if (instanceId && window.state.overrides[instanceId]?.substitutions && !window.state.overrides[instanceId]?.productOverrides) {
    const subs = window.state.overrides[instanceId].substitutions;
    const applySubs = (ings) => {
      if (!ings) return;
      ings.forEach(ing => {
        if (ing.bankId && subs[ing.bankId]) {
          const subId = subs[ing.bankId];
          const subIng = window.state.ingredients.find(i => i.id === subId);
          if (subIng) {
            ing.originalBankId = ing.bankId;
            ing.originalName = ing.name;
            ing.bankId = subIng.id;
            ing.name = subIng.name;
            ing.isSubstituted = true;
          }
        }
      });
    };
    applySubs(window.previewBaseRecipe.ingredients);
    if (window.previewBaseRecipe.enhanced) applySubs(window.previewBaseRecipe.enhanced.ingredients);
  }

  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) wrap.classList.add('open');
  window.renderRecipePreview(window.previewBaseRecipe.serves || 2);
}

function toggleRecipeFavourite(recipeId, event, variantKey = 'original') {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const r = (window.state.recipes || []).find(x => x.id === recipeId);
  if (!r) return;
  const list = window.ensureVariantFavoritingPrefs();
  const key = `${recipeId}_${variantKey}`;
  const idx = list.indexOf(key);
  const willBeFav = (idx === -1);
  if (willBeFav) {
    list.push(key);
  } else {
    list.splice(idx, 1);
  }
  const isNowFav = window.isRecipeVariantFavourite(r.id, 'original') || window.isRecipeVariantFavourite(r.id, 'enhanced');
  r.isFavourite = isNowFav;
  r.isFavorite = isNowFav;
  r.updatedAt = new Date().toISOString();

  window.saveState(true);
  try {
    const householdId = (window.state && window.state.householdId) || window.ACTIVE_HOUSEHOLD_ID || 'elliott-chloe';
    if (window.platePlanDb) {
      window.platePlanDb.collection('households').doc(householdId).collection('data').doc('meta').set({
        prefs: window.state.prefs,
        userPrefs: window.state.userPrefs
      }, { merge: true }).catch(e => console.warn('[PREFS SYNC ERROR]', e));
      window.platePlanDb.collection('households').doc(householdId).collection('recipes').doc(String(r.id)).set(
        window.sanitizePayloadForFirestore(window.unwrapAndCleanItem(r)),
        { merge: true }
      ).catch(e => console.warn('[RECIPE FAVORITE SYNC ERROR]', e));
    }
  } catch (e) {}

  renderVault();

  if (typeof window.previewBaseRecipe !== 'undefined' && window.previewBaseRecipe && window.previewBaseRecipe.id === recipeId) {
    window.previewBaseRecipe.isFavourite = r.isFavourite;
    window.previewBaseRecipe.isFavorite = r.isFavorite;
    const activeKey = (typeof window.currentViewTab !== 'undefined' && window.currentViewTab === 'enhanced') ? 'enhanced' : 'original';
    const isCurrentActiveFav = window.isRecipeVariantFavourite(recipeId, activeKey);
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
  window.showPlatePlanToast(willBeFav ? `Added "${r.name} (${variantLabel})" to favourites ❤️` : `Removed "${r.name} (${variantLabel})" from favourites`);
}

function openRecipeActions(recipeId) {
  const recipe = window.getProductIndexRecipe(recipeId) || (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return;
  window.openMobileActionSheet(recipe.name, [
    { label: 'Review recipe', onclick: `editRecipeModalView('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Recipe card', onclick: `downloadRecipeCard('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Duplicate', onclick: `duplicateRecipe('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Edit source recipe', onclick: `editRecipe('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Delete', onclick: `deleteRecipe('${window.ppEscapeAttr(recipeId)}')`, danger: true }
  ]);
}

function openEnhancedRecipeActions(recipeId) {
  const recipe = window.getProductIndexRecipe(recipeId) || (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return;
  if (!recipe.enhanced) {
    window.openMobileActionSheet(recipe.name, [
      { label: 'Create enhanced version', onclick: `editEnhancedRecipe('${window.ppEscapeAttr(recipeId)}')` },
      { label: 'Review recipe', onclick: `editRecipeModalView('${window.ppEscapeAttr(recipeId)}')` }
    ]);
    return;
  }
  window.openMobileActionSheet(`${recipe.name} · Enhanced`, [
    { label: 'Review enhanced recipe', onclick: `reviewEnhancedRecipe('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Recipe card', onclick: `downloadRecipeCard('${window.ppEscapeAttr(recipeId)}','enhanced')` },
    { label: 'Duplicate complete recipe', onclick: `duplicateRecipe('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Edit enhanced recipe', onclick: `editEnhancedRecipe('${window.ppEscapeAttr(recipeId)}')` },
    { label: 'Delete enhanced version', onclick: `deleteEnhancedRecipe('${window.ppEscapeAttr(recipeId)}')`, danger: true }
  ]);
}

export function replaceRecipeIngredient(recipeId, oldIngredientId, newIngredient) {
  const recipe = (window.state?.recipes || []).find(r => r.id === recipeId);
  if (!recipe) return false;
  let replaced = false;
  const replaceInList = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach(item => {
      if (item && (item.bankId === oldIngredientId || item.id === oldIngredientId)) {
        if (typeof newIngredient === 'string') {
          item.name = newIngredient;
        } else if (newIngredient && typeof newIngredient === 'object') {
          Object.assign(item, newIngredient);
        }
        replaced = true;
      }
    });
  };
  replaceInList(recipe.ingredients);
  if (recipe.enhanced) replaceInList(recipe.enhanced.ingredients);
  if (replaced && typeof window.saveState === 'function') {
    window.saveState(true);
  }
  return replaced;
}

// Bind to window for global exposure and inline HTML handlers
window.renderVault = renderVault;
window.renderRecipeCard = renderRecipeCard;
window.viewRecipe = viewRecipe;
window.toggleRecipeFavourite = toggleRecipeFavourite;
window.toggleRecipeFavorite = toggleRecipeFavourite;
window.openRecipeActions = openRecipeActions;
window.openEnhancedRecipeActions = openEnhancedRecipeActions;
window.computeProfileFitScore = computeProfileFitScore;
window.calculateMacroFitTierAndScore = calculateMacroFitTierAndScore;
window.getMealTypeTargets = getMealTypeTargets;
window.getVaultTargetMacros = getVaultTargetMacros;
window.isRecipeVariantFavourite = isRecipeVariantFavourite;
window.isRecipeVariantFavorite = isRecipeVariantFavourite;

export {
  renderVault,
  renderRecipeCard,
  viewRecipe,
  toggleRecipeFavourite,
  calculateMacroFitTierAndScore,
  getMealTypeTargets,
  getVaultTargetMacros,
  computeProfileFitScore,
  openRecipeActions,
  openEnhancedRecipeActions
};

export default createLegacyView({ id: 'vault', rootId: 'view-vault' });
