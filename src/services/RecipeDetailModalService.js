/**
 * src/services/RecipeDetailModalService.js (v3.31.18)
 * ES6 Recipe Detail Modal Coordinator & Lifecycle Manager.
 * Orchestrates recipe inspection, calorie-driven portion scaling, enhanced variant switching,
 * and live HSL Lerp fit score badge generation with zero layout shifts.
 */

import { renderRecipeDetailModalContent, formatRecipeIngredientRow, renderRecipeIngredientsListHTML } from '../components/recipe/RecipeDetailModalUI.js';
import { isRecipeVariantFavourite } from '../views/RecipeVaultView.js';
import { calculateMealFitScore, getFitScoreTierMeta, extractRecipeMacros } from '../utils/fitScoreCalculator.js';
import { resolveMealSplitPercentages } from '../utils/nutritionCalculator.js';
import { getState } from '../store/store.js';

let previewState = {
  recipe: null,
  instanceId: null,
  currentTab: 'original',
  servingMode: 'both',
  targetServes: 2,
  singleServes: 1
};

export function closeRecipePreview() {
  const modalWrap = document.getElementById('view-modal-wrap');
  if (modalWrap) {
    modalWrap.classList.remove('open');
  }
  previewState.recipe = null;
  if (typeof window !== 'undefined') {
    window.previewBaseRecipe = null;
  }
}

export function switchViewTab(tabKey = 'original') {
  previewState.currentTab = tabKey;
  if (typeof window !== 'undefined') {
    window.currentViewTab = tabKey;
  }
  renderRecipePreview();
}

export function switchPreviewServingMode(mode = 'both') {
  previewState.servingMode = mode;
  renderRecipePreview();
}

function computeRecipeScaleMultiplier(activeR, mode, targetServes = 2, singleServes = 1) {
  const baseServes = Number(activeR.serves ?? activeR.servings ?? 2) || 2;
  const targetServings = Number(targetServes) || baseServes;
  const single = Number(singleServes) || 1;

  if (mode === 'elliott' || mode === 'e' || mode === 'chloe' || mode === 'c') {
    const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
    const userPrefs = state.preferences || state.userPrefs || {};
    const profiles = userPrefs.profiles || {};
    const eProf = profiles.elliott || profiles.e || { dailyKcal: 1950 };
    const cProf = profiles.chloe || profiles.c || { dailyKcal: 1350 };
    const eDaily = Number(eProf.dailyKcal) || 1950;
    const cDaily = Number(cProf.dailyKcal) || 1350;

    const mealType = String(activeR.types?.[0] || activeR.type || 'dinner').toLowerCase();
    const eSplits = typeof resolveMealSplitPercentages === 'function' ? resolveMealSplitPercentages(userPrefs, 'elliott').calories : { breakfast: 25, lunch: 30, snacking: 10, dinner: 35 };
    const cSplits = typeof resolveMealSplitPercentages === 'function' ? resolveMealSplitPercentages(userPrefs, 'chloe').calories : { breakfast: 25, lunch: 30, snacking: 10, dinner: 35 };
    const ePct = Number(eSplits[mealType] ?? eSplits.dinner ?? 35) / 100;
    const cPct = Number(cSplits[mealType] ?? cSplits.dinner ?? 35) / 100;

    const eMealTarget = eDaily * ePct;
    const cMealTarget = cDaily * cPct;
    const totalKcalBudget = eMealTarget + cMealTarget;
    const eShare = totalKcalBudget > 0 ? (eMealTarget / totalKcalBudget) : 0.59;
    const cShare = totalKcalBudget > 0 ? (cMealTarget / totalKcalBudget) : 0.41;

    const splitRatio = (mode === 'elliott' || mode === 'e') ? eShare : cShare;
    return (splitRatio * 2 / baseServes) * single;
  }

  // When "Shared (2)" is selected, the multiplier should strictly be (targetServings / baselineServings).
  return targetServings / baseServes;
}

export function updateRecipePreviewScale(val) {
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 0) {
    previewState.targetServes = parsed;
    // Update ingredients DOM list directly without wiping modalContent to preserve input focus
    const ingListEl = document.getElementById('recipe-modal-ingredients-list');
    if (ingListEl && previewState.recipe) {
      const r = previewState.recipe;
      const isEnh = previewState.currentTab === 'enhanced' && !!r.enhanced;
      const activeR = isEnh ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : r;
      const scaleMultiplier = computeRecipeScaleMultiplier(activeR, previewState.servingMode, previewState.targetServes, previewState.singleServes);
      const rawIngs = activeR.ingredients || activeR.parsedIngredients || activeR.rawIngredients || r.ingredients || [];
      const ingredients = Array.isArray(rawIngs) ? rawIngs : Object.values(rawIngs);
      const sections = Array.isArray(activeR.ingredientSections) && activeR.ingredientSections.length > 0 ? activeR.ingredientSections : (r.ingredientSections || []);
      const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
      ingListEl.innerHTML = renderRecipeIngredientsListHTML(ingredients, state, scaleMultiplier, sections);
    } else {
      renderRecipePreview();
    }
  }
}

export function updateSinglePersonServes(val, person = 'elliott') {
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 0) {
    previewState.singleServes = parsed;
    previewState.servingMode = person;
    const ingListEl = document.getElementById('recipe-modal-ingredients-list');
    if (ingListEl && previewState.recipe) {
      const r = previewState.recipe;
      const isEnh = previewState.currentTab === 'enhanced' && !!r.enhanced;
      const activeR = isEnh ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : r;
      const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
      const scaleMultiplier = computeRecipeScaleMultiplier(activeR, person, previewState.targetServes, previewState.singleServes);
      const rawIngs = activeR.ingredients || activeR.parsedIngredients || activeR.rawIngredients || r.ingredients || [];
      const ingredients = Array.isArray(rawIngs) ? rawIngs : Object.values(rawIngs);
      const sections = Array.isArray(activeR.ingredientSections) && activeR.ingredientSections.length > 0 ? activeR.ingredientSections : (r.ingredientSections || []);
      ingListEl.innerHTML = renderRecipeIngredientsListHTML(ingredients, state, scaleMultiplier, sections);
    } else {
      renderRecipePreview();
    }
  }
}

function renderComparisonBadge(actual, target) {
  if (!target || target <= 0) return '';
  const diff = actual - target;
  const pctDiff = Math.round((diff / target) * 100);
  const isNear = Math.abs(pctDiff) <= 10;
  const isOver = pctDiff > 10;

  let bg = 'rgba(16,185,129,0.12)';
  let color = '#059669';
  let label = 'On Target';

  if (isOver) {
    bg = 'rgba(239,68,68,0.12)';
    color = '#dc2626';
    label = `+${Math.abs(pctDiff)}%`;
  } else if (!isNear) {
    bg = 'rgba(245,158,11,0.12)';
    color = '#d97706';
    label = `${pctDiff}%`;
  }

  return `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${bg};color:${color};line-height:1">${label}</span>`;
}

export function renderRecipePreview() {
  const modalContent = document.getElementById('view-modal-content');
  if (!modalContent || !previewState.recipe) return;

  const r = previewState.recipe;
  const isEnh = previewState.currentTab === 'enhanced' && !!r.enhanced;
  const hasEnh = Boolean(r.enhanced || (r.variants && r.variants.enhanced));
  const activeR = isEnh 
    ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients }
    : r;

  const isFav = isRecipeVariantFavourite(r.id, previewState.currentTab);
  const types = r.types || [r.type || 'dinner'];
  const mealType = types[0] || 'dinner';
  const baseServes = Number(activeR?.serves || activeR?.servings || r?.serves || r?.servings || 2) || 2;

  // Multiplier for ingredients
  const scaleMultiplier = computeRecipeScaleMultiplier(activeR, previewState.servingMode, previewState.targetServes, previewState.singleServes);

  // Render ingredients list handling all schema variations & sections
  const rawIngs = activeR.ingredients || activeR.parsedIngredients || activeR.rawIngredients ||
                  r.ingredients || r.parsedIngredients || r.rawIngredients || [];
  const ingredients = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);
  const sections = Array.isArray(activeR.ingredientSections) && activeR.ingredientSections.length > 0
    ? activeR.ingredientSections
    : (Array.isArray(r.ingredientSections) && r.ingredientSections.length > 0 ? r.ingredientSections : []);

  const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
  const ingredientsHtml = renderRecipeIngredientsListHTML(ingredients, state, scaleMultiplier, sections);

  // Render method steps
  const steps = Array.isArray(activeR.method || activeR.steps) ? (activeR.method || activeR.steps) : [];
  const methodHtml = steps.length ? `
    <div class="recipe-view-method-list" style="display:flex;flex-direction:column;gap:10px">
      ${steps.map((st, i) => {
        const text = typeof st === 'string' ? st : (st.instruction || st.text || JSON.stringify(st));
        return `
          <div class="recipe-method-step-card">
            <span class="step-num">${i + 1}</span>
            <div>${text}</div>
          </div>
        `;
      }).join('')}
    </div>
  ` : '<div style="color:var(--text3);font-size:13px">No method steps specified.</div>';

  // Dual Macro Split Calculations
  const userPrefs = state.preferences || state.userPrefs || {};
  const profiles = userPrefs.profiles || {};
  const eProf = profiles.elliott || profiles.e || { dailyKcal: 1950, dailyProtein: 140 };
  const cProf = profiles.chloe || profiles.c || { dailyKcal: 1350, dailyProtein: 100 };
  const eDailyKcal = Number(eProf.dailyKcal) || 1950;
  const cDailyKcal = Number(cProf.dailyKcal) || 1350;
  const eDailyProt = Number(eProf.dailyProtein) || 140;
  const cDailyProt = Number(cProf.dailyProtein) || 100;

  const eSplits = typeof resolveMealSplitPercentages === 'function' ? resolveMealSplitPercentages(userPrefs, 'elliott') : { calories: { dinner: 35 }, protein: { dinner: 35 } };
  const cSplits = typeof resolveMealSplitPercentages === 'function' ? resolveMealSplitPercentages(userPrefs, 'chloe') : { calories: { dinner: 35 }, protein: { dinner: 35 } };
  const eCalPct = Number(eSplits.calories?.[mealType] ?? eSplits.calories?.dinner ?? 35) / 100;
  const cCalPct = Number(cSplits.calories?.[mealType] ?? cSplits.calories?.dinner ?? 35) / 100;
  const eProtPct = Number(eSplits.protein?.[mealType] ?? eSplits.protein?.dinner ?? 35) / 100;
  const cProtPct = Number(cSplits.protein?.[mealType] ?? cSplits.protein?.dinner ?? 35) / 100;

  const eMealTargetKcal = Math.round(eDailyKcal * eCalPct);
  const cMealTargetKcal = Math.round(cDailyKcal * cCalPct);
  const eMealTargetProt = Math.round(eDailyProt * eProtPct);
  const cMealTargetProt = Math.round(cDailyProt * cProtPct);

  const totalKcalBudget = eMealTargetKcal + cMealTargetKcal;
  const eShare = totalKcalBudget > 0 ? (eMealTargetKcal / totalKcalBudget) : 0.59;
  const cShare = totalKcalBudget > 0 ? (cMealTargetKcal / totalKcalBudget) : 0.41;
  const eSharePct = Math.round(eShare * 100);
  const cSharePct = Math.round(cShare * 100);

  const macros = typeof extractRecipeMacros === 'function' ? extractRecipeMacros(r, isEnh ? 'enhanced' : 'original') : {};
  const perServCal = Number(macros.cal ?? macros.calories ?? activeR.calories ?? 450);
  const perServProt = Number(macros.prot ?? macros.protein ?? activeR.protein ?? 28);

  const batchServings = previewState.servingMode === 'both' ? previewState.targetServes : 2;
  const batchCal = perServCal * batchServings;
  const batchProt = perServProt * batchServings;

  const eKcal = Math.round(batchCal * eShare);
  const eProt = Math.round((batchProt * eShare) * 10) / 10;
  const cKcal = Math.round(batchCal * cShare);
  const cProt = Math.round((batchProt * cShare) * 10) / 10;

  const eCalBadge = renderComparisonBadge(eKcal, eMealTargetKcal);
  const eProtBadge = renderComparisonBadge(eProt, eMealTargetProt);
  const cCalBadge = renderComparisonBadge(cKcal, cMealTargetKcal);
  const cProtBadge = renderComparisonBadge(cProt, cMealTargetProt);

  const macroSplitHtml = `
    <div class="recipe-modal-crossbar-macros" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--surface, #fff); border: 1px solid var(--border, #e7e5e4); font-size: 11.5px;">
        <span style="font-weight:700;">👤 Elliott (${eSharePct}%):</span>
        <span>🔥 <strong>${eKcal} kcal</strong> ${eCalBadge}</span>
        <span>🥩 <strong>${eProt}g</strong> ${eProtBadge}</span>
      </div>

      <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--surface, #fff); border: 1px solid var(--border, #e7e5e4); font-size: 11.5px;">
        <span style="font-weight:700;">👤 Chloe (${cSharePct}%):</span>
        <span>🔥 <strong>${cKcal} kcal</strong> ${cCalBadge}</span>
        <span>🥩 <strong>${cProt}g</strong> ${cProtBadge}</span>
      </div>
    </div>
  `;

  // Fit score calculation
  const fitResult = typeof calculateMealFitScore === 'function' ? calculateMealFitScore(activeR, mealType, {
    activeProfile: previewState.servingMode === 'both' ? 'everyone' : previewState.servingMode,
    variant: isEnh ? 'enhanced' : 'original',
    portionScaled: true
  }) : null;
  const fitScore = Math.round(Number(fitResult?.score) || 0);
  const meta = typeof getFitScoreTierMeta === 'function' ? getFitScoreTierMeta(fitScore) : { tier: 'red', icon: '🔴', label: 'Poor Match', color: '#ef4444', bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5' };
  const fitPillHtml = `<span class="badge ${meta.tier}" style="background:${meta.bg};color:${meta.text};border:1px solid ${meta.border}">${meta.icon} ${fitScore}% - ${meta.label}</span>`;

  modalContent.innerHTML = renderRecipeDetailModalContent({
    r,
    recipe: activeR,
    activeR,
    hasEnh,
    hasEnhanced: hasEnh,
    isEnh,
    isFav,
    isFavourite: isFav,
    variantTab: previewState.currentTab,
    servingMode: previewState.servingMode,
    targetServes: previewState.targetServes,
    singleServes: previewState.singleServes,
    mealType,
    baseServes,
    ingredientsHtml,
    methodHtml,
    macroSplitHtml,
    macroCardsHtml: macroSplitHtml,
    fitPillHtml,
    fitBadgeHtml: fitPillHtml,
    eKcal,
    cKcal,
    eProt,
    cProt,
    eSharePct,
    cSharePct,
    eTargetKcal: eMealTargetKcal,
    cTargetKcal: cMealTargetKcal,
    eTargetProt: eMealTargetProt,
    cTargetProt: cMealTargetProt
  });

  const modalWrap = document.getElementById('view-modal-wrap');
  if (modalWrap) {
    modalWrap.classList.add('open');
  }
}

export function openRecipePreview(recipeId, initialTab = 'original') {
  const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const found = recipes.find(rec => String(rec.id) === String(recipeId));
  if (!found) return;

  previewState.recipe = found;
  previewState.currentTab = initialTab;
  previewState.servingMode = 'both';
  previewState.targetServes = Number(found.serves ?? 2) || 2;
  previewState.singleServes = 1;

  if (typeof window !== 'undefined') {
    window.previewBaseRecipe = found;
    window.currentViewTab = initialTab;
  }

  renderRecipePreview();
}

export function openRecipeModal(recipeId, instanceId, variant, targetPerson) {
  return openRecipePreview(recipeId, variant || 'original');
}
export const viewRecipe = openRecipePreview;

if (typeof window !== 'undefined') {
  Object.assign(window, {
    closeRecipePreview,
    switchViewTab,
    switchPreviewServingMode,
    updateRecipePreviewScale,
    updateSinglePersonServes,
    openRecipePreview,
    openRecipeModal,
    viewRecipe
  });
}
