/**
 * src/services/RecipeDetailModalService.js (v3.31.17)
 * ES6 Recipe Detail Modal Coordinator & Lifecycle Manager.
 * Orchestrates recipe inspection, calorie-driven portion scaling, enhanced variant switching,
 * and live HSL Lerp fit score badge generation with zero layout shifts.
 */

import { renderRecipeDetailModalContent, formatRecipeIngredientRow, renderRecipeIngredientsListHTML } from '../components/recipe/RecipeDetailModalUI.js';
import { isRecipeVariantFavourite } from '../views/RecipeVaultView.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
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
  const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
  const userPrefs = state.preferences || state.userPrefs || {};
  const profiles = userPrefs.profiles || {};
  const eProf = profiles.elliott || profiles.e || { dailyKcal: 1950 };
  const cProf = profiles.chloe || profiles.c || { dailyKcal: 1350 };
  const eDaily = Number(eProf.dailyKcal) || 1950;
  const cDaily = Number(cProf.dailyKcal) || 1350;

  const mealType = String(activeR.types?.[0] || activeR.type || 'dinner').toLowerCase();
  const eSplits = resolveMealSplitPercentages ? resolveMealSplitPercentages(userPrefs, 'elliott').calories : { breakfast: 25, lunch: 30, snacking: 10, dinner: 35 };
  const cSplits = resolveMealSplitPercentages ? resolveMealSplitPercentages(userPrefs, 'chloe').calories : { breakfast: 25, lunch: 30, snacking: 10, dinner: 35 };
  const ePct = Number(eSplits[mealType] ?? eSplits.dinner ?? 35) / 100;
  const cPct = Number(cSplits[mealType] ?? cSplits.dinner ?? 35) / 100;

  const eMealTarget = eDaily * ePct;
  const cMealTarget = cDaily * cPct;

  const baseKcalTotal = Number(activeR.calories || activeR.kcal || activeR.totalCalories || 500);
  const baseServes = Number(activeR.serves ?? 2) || 2;
  const baseKcalPerServing = baseKcalTotal > 0 ? (baseKcalTotal / baseServes) : 500;

  if (mode === 'elliott' || mode === 'e') {
    return eMealTarget / Math.max(100, baseKcalPerServing);
  }
  if (mode === 'chloe' || mode === 'c') {
    return cMealTarget / Math.max(100, baseKcalPerServing);
  }
  return ((eMealTarget + cMealTarget) / Math.max(100, baseKcalPerServing)) * (targetServes / baseServes);
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
  const diffPct = Math.round(((actual - target) / target) * 100);
  if (Math.abs(diffPct) <= 5) {
    return `<span class="tag" style="background:rgba(16,185,129,0.12);color:var(--green,#10b981);font-weight:700;font-size:10px;padding:2px 5px">On target</span>`;
  }
  const isBelow = diffPct < 0;
  const absDiff = Math.abs(diffPct);
  const label = `${absDiff}% ${isBelow ? '↓' : '↑'}`;
  const isModerate = absDiff <= 20;
  const color = isModerate ? 'var(--amber,#f59e0b)' : 'var(--red,#ef4444)';
  const bg = isModerate ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return `<span class="tag" style="background:${bg};color:${color};font-weight:700;font-size:10px;padding:2px 5px">${label}</span>`;
}

export function renderRecipePreview() {
  const modalContent = document.getElementById('view-modal-content');
  if (!modalContent || !previewState.recipe) return;

  const r = previewState.recipe;
  const isEnh = previewState.currentTab === 'enhanced' && !!r.enhanced;
  const hasEnh = !!r.enhanced;
  const activeR = isEnh 
    ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients }
    : r;

  const isFav = isRecipeVariantFavourite(r.id, previewState.currentTab);
  const types = r.types || [r.type || 'dinner'];
  const mealType = types[0] || 'dinner';
  const serves = Number(activeR.serves ?? r.serves ?? 2) || 2;

  // Calorie-driven scale multiplier for ingredients
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

  const baseKcal = Number(activeR.calories ?? activeR.kcal ?? 0);
  const baseProt = Number(activeR.protein ?? activeR.prot ?? 0);
  const eProf = state.preferences?.profiles?.elliott || state.userPrefs?.profiles?.elliott || { dailyKcal: 1950 };
  const cProf = state.preferences?.profiles?.chloe || state.userPrefs?.profiles?.chloe || { dailyKcal: 1350 };
  const eSplits = resolveMealSplitPercentages ? resolveMealSplitPercentages(state.preferences || state.userPrefs, 'elliott').calories : { dinner: 35 };
  const cSplits = resolveMealSplitPercentages ? resolveMealSplitPercentages(state.preferences || state.userPrefs, 'chloe').calories : { dinner: 35 };
  const ePct = Number(eSplits[mealType] ?? eSplits.dinner ?? 35) / 100;
  const cPct = Number(cSplits[mealType] ?? cSplits.dinner ?? 35) / 100;
  const eTargetKcal = Number(eProf.dailyKcal || 1950) * ePct;
  const cTargetKcal = Number(cProf.dailyKcal || 1350) * cPct;

  const totalKcalBudget = eTargetKcal + cTargetKcal;
  const eShare = totalKcalBudget > 0 ? (eTargetKcal / totalKcalBudget) : 0.59;
  const cShare = totalKcalBudget > 0 ? (cTargetKcal / totalKcalBudget) : 0.41;

  const batchServes = previewState.servingMode === 'both' ? previewState.targetServes : previewState.singleServes;
  const eKcal = Math.round(baseKcalTotalVal(baseKcal, baseServes, batchServes) * eShare);
  const cKcal = Math.round(baseKcalTotalVal(baseKcal, baseServes, batchServes) * cShare);

  modalContent.innerHTML = renderRecipeDetailModalContent({
    recipe: activeR,
    variantTab: previewState.currentTab,
    hasEnhanced: hasEnh,
    isFavourite: isFav,
    servingMode: previewState.servingMode,
    targetServes: previewState.targetServes,
    singleServes: previewState.singleServes,
    ingredientsHtml,
    methodHtml,
    eKcal,
    cKcal,
    eTargetKcal: Math.round(eTargetKcal),
    cTargetKcal: Math.round(cTargetKcal),
    eBadge: renderComparisonBadge(eKcal, Math.round(eTargetKcal)),
    cBadge: renderComparisonBadge(cKcal, Math.round(cTargetKcal))
  });

  const modalWrap = document.getElementById('view-modal-wrap');
  if (modalWrap) {
    modalWrap.classList.add('open');
  }
}

function baseKcalTotalVal(baseKcal, baseServes, batchServes) {
  if (baseKcal > 0) return baseKcal * (batchServes / baseServes);
  return 500 * batchServes;
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
