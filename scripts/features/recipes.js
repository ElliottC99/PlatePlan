/**
 * PlatePlan v3.3.6-mod - Recipe Vault Module
 * Extracted from monolith for modular maintenance.
 */
import { createLegacyView } from './create-legacy-view.js?v=3.3.6-mod';

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
  const prefs = window.state?.prefs || (typeof state !== 'undefined' ? state?.prefs : null) || {};
  const ecal = Number(prefs.ecal) || 2400;
  const eprot = Number(prefs.eprot) || 130;
  const ccal = Number(prefs.ccal) || 1700;
  const cprot = Number(prefs.cprot) || 100;

  const eAlloc = prefs.eAlloc || { b: 15, l: 25, d: 45, s: 15 };
  const cAlloc = prefs.cAlloc || { b: 25, l: 30, d: 35, s: 10 };
  const eProtAlloc = prefs.eProtAlloc || eAlloc;
  const cProtAlloc = prefs.cProtAlloc || cAlloc;

  let mKey = 'd';
  if (mt.includes('breakfast')) mKey = 'b';
  else if (mt.includes('lunch')) mKey = 'l';
  else if (mt.includes('snack')) mKey = 's';
  else if (mt.includes('dinner')) mKey = 'd';

  const eCalPct = (eAlloc[mKey] ?? 45) / 100;
  const eProtPct = (eProtAlloc[mKey] ?? eAlloc[mKey] ?? 45) / 100;
  const cCalPct = (cAlloc[mKey] ?? 35) / 100;
  const cProtPct = (cProtAlloc[mKey] ?? cAlloc[mKey] ?? 35) / 100;

  const targetCal_E = ecal * eCalPct;
  const targetProt_E = eprot * eProtPct;
  const targetCal_C = ccal * cCalPct;
  const targetProt_C = cprot * cProtPct;

  return {
    mealType: mt,
    targetCal_E,
    targetProt_E,
    targetCal_C,
    targetProt_C,
    e: { cal: targetCal_E, prot: targetProt_E },
    c: { cal: targetCal_C, prot: targetProt_C },
    prefs: { ecal, eprot, ccal, cprot }
  };
}

function getVaultTargetMacros(mealType = 'dinner') {
  return getMealTypeTargets(mealType);
}

function computeProfileFitScore(actualCal, targetCal, actualProt, targetProt, person = null) {
  const prefs = window.state?.prefs || (typeof state !== 'undefined' ? state?.prefs : null) || {};
  const ecal = Number(prefs.ecal) || 2400;
  const eprot = Number(prefs.eprot) || 130;
  const ccal = Number(prefs.ccal) || 1700;
  const cprot = Number(prefs.cprot) || 100;

  let tCal = Number(targetCal) || 0;
  let tProt = Number(targetProt) || 0;

  if (person === 'elliott' || person === 'e') {
    if (!tCal) tCal = ecal * 0.45;
    if (!tProt) tProt = eprot * 0.45;
  } else if (person === 'chloe' || person === 'c') {
    if (!tCal) tCal = ccal * 0.35;
    if (!tProt) tProt = cprot * 0.35;
  }

  if (tCal <= 0) {
    tCal = ((ecal * 0.45) + (ccal * 0.35)) / 2;
  }
  if (tProt <= 0) {
    tProt = ((eprot * 0.45) + (cprot * 0.35)) / 2;
  }

  const aCal = Number(actualCal) || 0;
  const aProt = Number(actualProt) || 0;

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

    // Resolve meal slot targets using window.state.prefs
    const slotTargets = customTargets || getMealTypeTargets(mealType);
    const prefs = window.state?.prefs || (typeof state !== 'undefined' ? state?.prefs : null) || {};
    const ecal = Number(prefs.ecal) || 2400;
    const eprot = Number(prefs.eprot) || 130;
    const ccal = Number(prefs.ccal) || 1700;
    const cprot = Number(prefs.cprot) || 100;

    targetCal_E = Number(slotTargets.targetCal_E ?? slotTargets.eCal ?? slotTargets.e?.cal ?? slotTargets.cal) || (ecal * 0.45);
    targetProt_E = Number(slotTargets.targetProt_E ?? slotTargets.eProt ?? slotTargets.e?.prot ?? slotTargets.prot) || (eprot * 0.45);
    targetCal_C = Number(slotTargets.targetCal_C ?? slotTargets.cCal ?? slotTargets.c?.cal ?? slotTargets.cal) || (ccal * 0.35);
    targetProt_C = Number(slotTargets.targetProt_C ?? slotTargets.cProt ?? slotTargets.c?.prot ?? slotTargets.prot) || (cprot * 0.35);

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

  const score_Elliott = computeProfileFitScore(actualCal_E, targetCal_E, actualProt_E, targetProt_E, 'elliott');
  const score_Chloe = computeProfileFitScore(actualCal_C, targetCal_C, actualProt_C, targetProt_C, 'chloe');

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
  const types = r.types || [r.type || 'dinner'];
  const mealType = options.mealType || (typeof window.getContextMealType === 'function' ? window.getContextMealType(r, null, types[0] || 'dinner') : (types[0] || 'dinner'));
  const targetMacros = options.targetMacros || getVaultTargetMacros(mealType);
  const eTgt = options.eTgt || targetMacros.e || (typeof window.getBudgets === 'function' ? window.getBudgets('e', mealType) : { cal: 840, prot: 45.5 });
  const cTgt = options.cTgt || targetMacros.c || (typeof window.getBudgets === 'function' ? window.getBudgets('c', mealType) : { cal: 595, prot: 35 });
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

    const { score, color, label } = calculateMacroFitTierAndScore({ recipe: r, variant: useEnhanced ? 'enhanced' : 'original', portions }, { mealType, targetCal_E: eTgt.cal, targetProt_E: eTgt.prot, targetCal_C: cTgt.cal, targetProt_C: cTgt.prot });
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

  // Directive 4: Check if #vault-filter-fav has .active class or window.state.vaultFavOnly is true
  const favFilterBtn = document.getElementById('vault-filter-fav');
  const isFavOnly = !!(favFilterBtn?.classList.contains('active') || window.state?.vaultFavOnly || window.vaultFilterFavouritesOnly);
  if (favFilterBtn) {
    favFilterBtn.classList.toggle('active', isFavOnly);
    favFilterBtn.setAttribute('aria-pressed', isFavOnly ? 'true' : 'false');
    // Directive 4: Bind a click listener to #vault-filter-fav that toggles its .active class and re-runs renderVault()
    if (!favFilterBtn.dataset.boundFavFilter) {
      favFilterBtn.dataset.boundFavFilter = 'true';
      favFilterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        favFilterBtn.classList.toggle('active');
        const active = favFilterBtn.classList.contains('active');
        favFilterBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (window.state) window.state.vaultFavOnly = active;
        window.vaultFilterFavouritesOnly = active;
        renderVault();
      });
    }
  }

  if (typeof window.ensureVariantFavoritingPrefs === 'function') {
    window.ensureVariantFavoritingPrefs();
  }

  // Directive 4: If active, filter window.state.recipes to only include recipes where isFavorite or isFavourite is truthy
  const recipes = (window.state?.recipes || []).filter(r => {
    if (!r) return false;
    if (isFavOnly) {
      const isFav = !!(r.isFavorite || r.isFavourite || isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced'));
      if (!isFav) return false;
    }
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

  // Directive 2: Update macro target sources to use window.state.prefs:
  // Elliott Targets: window.state.prefs.ecal and window.state.prefs.eprot
  // Chloe Targets: window.state.prefs.ccal and window.state.prefs.cprot
  const prefs = window.state?.prefs || (typeof state !== 'undefined' ? state?.prefs : null) || {};
  const ecal = Number(prefs.ecal) || 2400;
  const eprot = Number(prefs.eprot) || 130;
  const ccal = Number(prefs.ccal) || 1700;
  const cprot = Number(prefs.cprot) || 100;

  const eAlloc = prefs.eAlloc || { b: 15, l: 25, d: 45, s: 15 };
  const cAlloc = prefs.cAlloc || { b: 25, l: 30, d: 35, s: 10 };
  const eProtAlloc = prefs.eProtAlloc || eAlloc;
  const cProtAlloc = prefs.cProtAlloc || cAlloc;

  let mKey = 'd';
  if (selectedMealType.includes('breakfast')) mKey = 'b';
  else if (selectedMealType.includes('lunch')) mKey = 'l';
  else if (selectedMealType.includes('snack')) mKey = 's';
  else if (selectedMealType.includes('dinner')) mKey = 'd';

  const eTgt = {
    cal: ecal * ((eAlloc[mKey] ?? 45) / 100),
    prot: eprot * ((eProtAlloc[mKey] ?? eAlloc[mKey] ?? 45) / 100)
  };
  const cTgt = {
    cal: ccal * ((cAlloc[mKey] ?? 35) / 100),
    prot: cprot * ((cProtAlloc[mKey] ?? cAlloc[mKey] ?? 35) / 100)
  };
  const targetMacros = {
    mealType: selectedMealType,
    targetCal_E: eTgt.cal,
    targetProt_E: eTgt.prot,
    targetCal_C: cTgt.cal,
    targetProt_C: cTgt.prot,
    e: eTgt,
    c: cTgt,
    prefs: { ecal, eprot, ccal, cprot }
  };

  const sortedRecipes = (typeof window.getSortedRecipes === 'function')
    ? window.getSortedRecipes(recipes, sort, selectedMealType)
    : recipes;

  if (!sortedRecipes.length) { list.innerHTML = '<div class="empty">No matching recipes found.</div>'; return; }
  const listSignature = [ft, fw, q, sort, isFavOnly ? 'fav' : 'all'].join('|');
  if (typeof window.resetProgressiveList === 'function') {
    window.resetProgressiveList('vault', listSignature);
  }
  const totalRecipes = sortedRecipes.length;
  const visibleCount = window.platePlanListLimits?.vault || 24;
  const visibleRecipes = sortedRecipes.slice(0, visibleCount);
  const progBtn = typeof window.progressiveListButton === 'function'
    ? window.progressiveListButton('vault', totalRecipes, visibleRecipes.length)
    : '';
  list.innerHTML = visibleRecipes.map(r => renderRecipeCard(r, { mealType: selectedMealType, eTgt, cTgt, targetMacros })).join('') + progBtn;
}

// Directive 1: Fix viewRecipe Modal Population
function viewRecipe(id, instanceId = null, tab = 'ingredients', servingMode = null) {
  const r = (typeof window.findRecipeByIdOrInstance === 'function')
    ? window.findRecipeByIdOrInstance(id || instanceId)
    : (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && (x.id === id || x.id === instanceId));
  if (!r) {
    console.error('[viewRecipe] Recipe not found:', id, instanceId);
    return;
  }

  // Ensure modal wrap is attached to body
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && wrap.parentElement && wrap.parentElement !== document.body && wrap.parentElement.id !== 'app-container') {
    document.body.appendChild(wrap);
  }

  // Ensure previewBaseRecipe is attached to window.previewBaseRecipe
  const cloneFn = typeof window.clonePlatePlanValue === 'function'
    ? window.clonePlatePlanValue
    : (val => JSON.parse(JSON.stringify(val)));
  window.previewBaseRecipe = cloneFn(r);
  window.currentPreviewInstanceId = instanceId;
  window.currentViewTab = (tab === 'enhanced' && r.enhanced) ? 'enhanced' : (tab === 'original' ? 'original' : tab);
  window.currentPreviewServingMode = servingMode || 'both';
  window.currentPreviewSingleServes = 1;

  if (instanceId && window.state?.overrides?.[instanceId]?.substitutions && !window.state?.overrides?.[instanceId]?.productOverrides) {
    const subs = window.state.overrides[instanceId].substitutions;
    const applySubs = (ings) => {
      if (!ings) return;
      ings.forEach(ing => {
        if (ing.bankId && subs[ing.bankId]) {
          const subId = subs[ing.bankId];
          const subIng = (window.state.ingredients || []).find(i => i.id === subId);
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

  // 1. Invoke renderRecipePreview before applying visibility styles
  if (typeof window.renderRecipePreview === 'function') {
    window.renderRecipePreview(window.previewBaseRecipe.serves || 2);
  }

  // 2. Explicitly set modal display properties on #view-modal-wrap
  if (wrap) {
    wrap.classList.add('open', 'active');
    wrap.style.setProperty('display', 'flex', 'important');
    wrap.style.setProperty('visibility', 'visible', 'important');
    wrap.style.setProperty('opacity', '1', 'important');
    wrap.style.setProperty('z-index', '99999', 'important');
    wrap.style.setProperty('overflow-y', 'auto', 'important');
  }
  if (content) {
    content.style.setProperty('max-height', 'calc(100vh - 40px)', 'important');
    content.style.setProperty('overflow-y', 'auto', 'important');
    content.style.setProperty('display', 'block', 'important');
    content.style.setProperty('visibility', 'visible', 'important');
    content.style.setProperty('opacity', '1', 'important');
  }
  document.body.classList.add('modal-open');
}
window.viewRecipe = viewRecipe;

window.editRecipeModalView = function(id, initialTab = 'ingredients') {
  const recipeData = (typeof window.findRecipeByIdOrInstance === 'function')
    ? window.findRecipeByIdOrInstance(id)
    : (window.state?.recipes || []).find(x => x.id === id);
  if (!recipeData) {
    console.error('[editRecipeModalView] Failed to resolve recipe data for ID:', id);
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Recipe data could not be loaded', 'error');
    }
    return;
  }
  if (typeof window.openModal === 'function') {
    window.openModal(recipeData.name || 'Recipe Details', recipeData, false, { instanceId: id, tab: initialTab });
  } else if (typeof openModal === 'function') {
    openModal(recipeData.name || 'Recipe Details', recipeData, false, { instanceId: id, tab: initialTab });
  }
};

function toggleRecipeFavourite(recipeId, event, variantKey = 'original') {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const r = (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && x.id === recipeId);
  if (!r) return;
  const list = typeof window.ensureVariantFavoritingPrefs === 'function'
    ? window.ensureVariantFavoritingPrefs()
    : (window.state?.userPrefs?.favouriteVariantIds || []);
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

  if (typeof window.saveState === 'function') {
    window.saveState(true);
  }
  try {
    const householdId = (window.state && window.state.householdId) || window.ACTIVE_HOUSEHOLD_ID || 'elliott-chloe';
    if (window.platePlanDb) {
      window.platePlanDb.collection('households').doc(householdId).collection('data').doc('meta').set({
        prefs: window.state?.prefs || {},
        userPrefs: window.state?.userPrefs || {}
      }, { merge: true }).catch(e => console.warn('[PREFS SYNC ERROR]', e));
      window.platePlanDb.collection('households').doc(householdId).collection('recipes').doc(String(r.id)).set(
        window.sanitizePayloadForFirestore(window.unwrapAndCleanItem(r)),
        { merge: true }
      ).catch(e => console.warn('[RECIPE FAVORITE SYNC ERROR]', e));
    }
  } catch (e) {}

  // Directive 2: Ensure that re-rendering after toggling a favorite uses exact preference paths
  renderVault();

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

window.executeSheetAction = function(actionFnName, ...args) {
  const sheet = document.getElementById('mobile-action-sheet');
  const overlay = document.getElementById('mobile-action-sheet-overlay');
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  if (sheet) sheet.classList.remove('open', 'active');
  if (overlay) overlay.classList.remove('open', 'active');
  if (wrap) wrap.classList.remove('open', 'active');

  setTimeout(() => {
    if (typeof window[actionFnName] === 'function') {
      window[actionFnName](...args);
    } else if (typeof actionFnName === 'function') {
      actionFnName(...args);
    } else {
      console.error(`[executeSheetAction] Function '${actionFnName}' not found on window.`);
    }
  }, 50);
};

// Directive 3: Fix "More" Recipe Actions Sheet (openRecipeActions)
// 1. Target #mobile-action-sheet-wrap and #mobile-action-sheet
// 2. Ensure calling openRecipeActions(id) adds open class to #mobile-action-sheet-wrap and renders context options
function openRecipeActions(recipeId) {
  const recipe = (typeof window.getProductIndexRecipe === 'function' ? window.getProductIndexRecipe(recipeId) : null) ||
    (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(r => r && r.id === recipeId);
  if (!recipe) return;

  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;

  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  const escapeHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => s);
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${escapeHtml(recipe.name || 'Actions')}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      <button type="button" class="btn" onclick="executeSheetAction('editRecipeModalView', '${window.ppEscapeAttr(recipeId)}')">Review recipe</button>
      <button type="button" class="btn" onclick="executeSheetAction('downloadRecipeCard', '${window.ppEscapeAttr(recipeId)}')">Recipe card</button>
      <button type="button" class="btn" onclick="executeSheetAction('duplicateRecipe', '${window.ppEscapeAttr(recipeId)}')">Duplicate</button>
      <button type="button" class="btn" onclick="executeSheetAction('editRecipe', '${window.ppEscapeAttr(recipeId)}')">Edit source recipe</button>
      <button type="button" class="btn danger" onclick="executeSheetAction('deleteRecipe', '${window.ppEscapeAttr(recipeId)}')">Delete</button>
    </div>
  `;

  if (wrap) {
    wrap.classList.add('open');
    if (typeof window.markMobileLayerForBack === 'function') {
      window.markMobileLayerForBack(wrap, 'actions');
    }
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}

function openEnhancedRecipeActions(recipeId) {
  const recipe = (typeof window.getProductIndexRecipe === 'function' ? window.getProductIndexRecipe(recipeId) : null) ||
    (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(r => r && r.id === recipeId);
  if (!recipe) return;

  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;

  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  const escapeHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => s);
  const title = !recipe.enhanced ? (recipe.name || 'Actions') : `${recipe.name || 'Recipe'} · Enhanced`;
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${escapeHtml(title)}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      ${!recipe.enhanced ? `
        <button type="button" class="btn" onclick="executeSheetAction('editEnhancedRecipe', '${window.ppEscapeAttr(recipeId)}')">Create enhanced version</button>
        <button type="button" class="btn" onclick="executeSheetAction('editRecipeModalView', '${window.ppEscapeAttr(recipeId)}')">Review recipe</button>
      ` : `
        <button type="button" class="btn" onclick="executeSheetAction('reviewEnhancedRecipe', '${window.ppEscapeAttr(recipeId)}')">Review enhanced recipe</button>
        <button type="button" class="btn" onclick="executeSheetAction('downloadRecipeCard', '${window.ppEscapeAttr(recipeId)}', 'enhanced')">Recipe card</button>
        <button type="button" class="btn" onclick="executeSheetAction('duplicateRecipe', '${window.ppEscapeAttr(recipeId)}')">Duplicate complete recipe</button>
        <button type="button" class="btn" onclick="executeSheetAction('editEnhancedRecipe', '${window.ppEscapeAttr(recipeId)}')">Edit enhanced recipe</button>
        <button type="button" class="btn danger" onclick="executeSheetAction('deleteEnhancedRecipe', '${window.ppEscapeAttr(recipeId)}')">Delete enhanced version</button>
      `}
    </div>
  `;

  if (wrap) {
    wrap.classList.add('open');
    if (typeof window.markMobileLayerForBack === 'function') {
      window.markMobileLayerForBack(wrap, 'actions');
    }
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
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

