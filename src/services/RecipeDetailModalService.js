/**
 * src/services/RecipeDetailModalService.js (v3.20.03)
 * ES6 Recipe Detail Modal Coordinator & Lifecycle Manager.
 * Orchestrates recipe inspection, live scaling, enhanced variant switching,
 * and live HSL Lerp fit score badge generation without external legacy scripts.
 */

import { renderRecipeDetailModalContent, formatRecipeIngredientRow, renderRecipeIngredientsListHTML } from '../components/recipe/RecipeDetailModalUI.js';
import { isRecipeVariantFavourite } from '../views/RecipeVaultView.js';
import { calculateMealFitScore } from '../utils/fitScoreCalculator.js';
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

export function updateRecipePreviewScale(val) {
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 0) {
    previewState.targetServes = parsed;
    renderRecipePreview();
  }
}

export function updateSinglePersonServes(val) {
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 0) {
    previewState.singleServes = parsed;
    renderRecipePreview();
  }
}

function formatIngredientDisplay(ing, scaleMultiplier = 1) {
  const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
  return formatRecipeIngredientRow(ing, state, scaleMultiplier);
}

function renderComparisonBadge(actual, target) {
  if (!target || target <= 0) return '';
  const diffPct = Math.round(((actual - target) / target) * 100);
  if (Math.abs(diffPct) <= 5) {
    return `<span class="tag" style="background:rgba(16,185,129,0.12);color:var(--green,#10b981);font-weight:700;font-size:11px">On target</span>`;
  }
  const isBelow = diffPct < 0;
  const absDiff = Math.abs(diffPct);
  const label = `${absDiff}% ${isBelow ? 'below' : 'above'} target`;
  const isModerate = absDiff <= 20;
  const color = isModerate ? 'var(--amber,#f59e0b)' : 'var(--red,#ef4444)';
  const bg = isModerate ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return `<span class="tag" style="background:${bg};color:${color};font-weight:700;font-size:11px">${label}</span>`;
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

  // Scale multiplier for ingredients
  const scaleMultiplier = previewState.servingMode === 'both'
    ? (previewState.targetServes / serves)
    : (previewState.singleServes / serves);

  // Render ingredients list handling all schema variations
  const rawIngs = activeR.ingredients || activeR.parsedIngredients || activeR.rawIngredients ||
                  r.ingredients || r.parsedIngredients || r.rawIngredients || [];
  const ingredients = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);

  const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
  const ingredientsHtml = renderRecipeIngredientsListHTML(ingredients, state, scaleMultiplier);

  // Render method steps
  const steps = Array.isArray(activeR.method || activeR.steps) ? (activeR.method || activeR.steps) : [];
  const methodHtml = `
    <ol class="recipe-view-method-list" style="padding-left:20px;margin:0;display:flex;flex-direction:column;gap:8px">
      ${steps.map((st, i) => {
        const text = typeof st === 'string' ? st : (st.instruction || st.text || JSON.stringify(st));
        return `<li style="font-size:13px;line-height:1.5;color:var(--text)">${text}</li>`;
      }).join('')}
    </ol>
  `;

  // Calculate dual-profile per-portion macros & live target comparison badges
  const userPrefs = state.preferences || state.userPrefs || {};
  const profiles = userPrefs.profiles || {};
  const eProf = profiles.elliott || profiles.e || {};
  const cProf = profiles.chloe || profiles.c || {};

  const totalKcalBudget = (Number(eProf.dailyKcal) || 0) + (Number(cProf.dailyKcal) || 0);
  const eShare = totalKcalBudget > 0 ? (Number(eProf.dailyKcal) / totalKcalBudget) : 0.59;
  const cShare = totalKcalBudget > 0 ? (Number(cProf.dailyKcal) / totalKcalBudget) : 0.41;
  const eSharePct = Math.round(eShare * 100);
  const cSharePct = Math.round(cShare * 100);

  const fitScoreResult = calculateMealFitScore(activeR, mealType, {
    variant: previewState.currentTab,
    activeProfile: previewState.servingMode,
    userPrefs
  });

  const eDetails = fitScoreResult.details?.elliott || {};
  const cDetails = fitScoreResult.details?.chloe || {};

  const baselineCal = Number(activeR.calories ?? activeR.cal ?? 0);
  const baselineProt = Number(activeR.protein ?? activeR.prot ?? 0);

  const batchServes = (serves === 1) ? 1 : 2;
  const eKcal = Math.round(eDetails.scaledKcal ?? (baselineCal * batchServes * eShare));
  const eProt = Math.round((eDetails.scaledProtein ?? (baselineProt * batchServes * eShare)) * 10) / 10;
  const eTargetCal = eDetails.kcalTarget || 0;
  const eTargetProt = eDetails.proteinTarget || 0;

  const cKcal = Math.round(cDetails.scaledKcal ?? (baselineCal * batchServes * cShare));
  const cProt = Math.round((cDetails.scaledProtein ?? (baselineProt * batchServes * cShare)) * 10) / 10;
  const cTargetCal = cDetails.kcalTarget || 0;
  const cTargetProt = cDetails.proteinTarget || 0;

  const macroCardsHtml = `
    <div class="per-portion-macro-breakdown" style="display:flex;flex-direction:column;gap:10px;margin:14px 0;">
      <div style="font-size:13px;font-weight:750;color:var(--text);display:flex;align-items:center;justify-content:space-between">
        <span>Per-Portion Macro Breakdown</span>
        <span style="font-size:11px;color:var(--text2);font-weight:600">Elliott (${eSharePct}%) / Chloe (${cSharePct}%)</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));gap:10px;">
        <div class="card portion-macro-card" style="padding:12px;border-radius:10px;background:var(--surface2);border:1px solid ${previewState.servingMode === 'elliott' ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'}">
          <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
            <span>👤 Elliott's Portion</span>
            <span style="font-size:11px;font-weight:600;color:var(--text2)">${eSharePct}% split</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
              <span>🔥 <strong>${eKcal} kcal</strong></span>
              ${renderComparisonBadge(eKcal, eTargetCal)}
            </div>
            ${eTargetCal ? `<div style="font-size:11px;color:var(--text3)">Target: ${eTargetCal} kcal</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;margin-top:2px">
              <span>🥩 <strong>${eProt}g protein</strong></span>
              ${renderComparisonBadge(eProt, eTargetProt)}
            </div>
            ${eTargetProt ? `<div style="font-size:11px;color:var(--text3)">Target: ${eTargetProt}g</div>` : ''}
          </div>
        </div>

        <div class="card portion-macro-card" style="padding:12px;border-radius:10px;background:var(--surface2);border:1px solid ${previewState.servingMode === 'chloe' ? 'var(--primary,#4f46e5)' : 'var(--border,#e7e5e4)'}">
          <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between">
            <span>👤 Chloe's Portion</span>
            <span style="font-size:11px;font-weight:600;color:var(--text2)">${cSharePct}% split</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
              <span>🔥 <strong>${cKcal} kcal</strong></span>
              ${renderComparisonBadge(cKcal, cTargetCal)}
            </div>
            ${cTargetCal ? `<div style="font-size:11px;color:var(--text3)">Target: ${cTargetCal} kcal</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;margin-top:2px">
              <span>🥩 <strong>${cProt}g protein</strong></span>
              ${renderComparisonBadge(cProt, cTargetProt)}
            </div>
            ${cTargetProt ? `<div style="font-size:11px;color:var(--text3)">Target: ${cTargetProt}g</div>` : ''}
          </div>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--text2);display:flex;justify-content:space-between;padding:0 2px">
        <span>Baseline: ${baselineCal} kcal · ${baselineProt}g protein</span>
        <span>Serves: ${serves} baseline</span>
      </div>
    </div>
  `;

  const html = renderRecipeDetailModalContent({
    r,
    activeR,
    hasEnh,
    isEnh,
    isFav,
    mealType,
    servingMode: previewState.servingMode,
    targetServes: previewState.targetServes,
    singleServes: previewState.singleServes,
    instanceId: previewState.instanceId,
    servingModeBannerHtml: '',
    allocationAndTargetHtml: '',
    sourceHtml: r.source ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Source: ${r.source}</div>` : '',
    ingredientsHtml,
    methodHtml,
    macroCardsHtml
  });

  modalContent.innerHTML = html;
}

export function viewRecipe(recipeId, instanceId = null, variant = 'original', targetPerson = 'both') {
  if (!recipeId) return;
  const recipes = window.state?.recipes || [];
  const recipe = recipes.find(r => r && r.id === recipeId);
  if (!recipe) {
    console.warn(`[RecipeDetailModalService] Recipe not found for id: ${recipeId}`);
    return;
  }

  previewState = {
    recipe,
    instanceId,
    currentTab: (variant === 'enhanced' && recipe.enhanced) ? 'enhanced' : 'original',
    servingMode: (targetPerson === 'elliott' || targetPerson === 'chloe') ? targetPerson : 'both',
    targetServes: Number(recipe.serves) || 2,
    singleServes: 1
  };

  if (typeof window !== 'undefined') {
    window.previewBaseRecipe = recipe;
    window.currentViewTab = previewState.currentTab;
  }

  renderRecipePreview();

  const modalWrap = document.getElementById('view-modal-wrap');
  if (modalWrap) {
    modalWrap.classList.add('open');
  }
}

// Global browser registration
if (typeof window !== 'undefined') {
  window.viewRecipe = viewRecipe;
  window.closeRecipePreview = closeRecipePreview;
  window.switchViewTab = switchViewTab;
  window.switchPreviewServingMode = switchPreviewServingMode;
  window.updateRecipePreviewScale = updateRecipePreviewScale;
  window.updateSinglePersonServes = updateSinglePersonServes;
  window.renderRecipePreview = renderRecipePreview;
  window.openRecipeModal = viewRecipe;
}
