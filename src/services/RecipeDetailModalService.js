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
import { openEnhancementModal } from '../components/recipe/RecipeEnhancementModalUI.js';
import { saveRecipe } from './HouseholdRepository.js';

let previewState = {
  recipe: null,
  instanceId: null,
  currentTab: 'original',
  servingMode: 'both',
  mealType: 'all',
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
    const state = (typeof window !== 'undefined' ? getState() : {}) || {};
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
      const state = (typeof window !== 'undefined' ? getState() : {}) || {};
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
      const state = (typeof window !== 'undefined' ? getState() : {}) || {};
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

export function formatRecipeSourceHTML(r) {
  if (!r || typeof r !== 'object') return '';
  const esc = (str) => String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const srcType = String(r.sourceType || '').toLowerCase();
  const srcUrl = String(r.sourceUrl || '').trim();
  const srcBook = String(r.sourceBook || '').trim();
  const srcPage = String(r.sourcePage || '').trim();
  const legacySource = String(r.source || r.url || '').trim();

  if (srcType === 'online' || (!srcType && /^https?:\/\//i.test(srcUrl || legacySource))) {
    const url = srcUrl || legacySource;
    if (!url) return '';
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return `<span>🌐 Source: <a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="color:var(--primary,#4f46e5);text-decoration:underline;">${esc(url)}</a></span>`;
  }
  if (srcType === 'book' || srcBook) {
    const bookText = [srcBook, srcPage ? `p. ${srcPage}` : ''].filter(Boolean).join(', ');
    if (!bookText) return '';
    return `<span>📖 Source: <strong>${esc(bookText)}</strong></span>`;
  }
  if (legacySource) {
    return `<span>📌 Source: ${esc(legacySource)}</span>`;
  }
  return '';
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
  const baseServes = Number(activeR?.serves || activeR?.servings || r?.serves || r?.servings || 2) || 2;

  // 1. Calculate Universal Fit Score & Dynamic Macros first (picks best eligible mealType when 'all')
  const fitResult = typeof calculateMealFitScore === 'function' ? calculateMealFitScore(r, previewState.mealType || 'all', {
    activeProfile: previewState.servingMode === 'both' ? 'everyone' : previewState.servingMode,
    variant: isEnh ? 'enhanced' : 'original',
    portionScaled: true
  }) : null;
  const mealType = fitResult?.mealType || types[0] || 'dinner';

  // Multiplier for ingredients
  const scaleMultiplier = computeRecipeScaleMultiplier(activeR, previewState.servingMode, previewState.targetServes, previewState.singleServes);

  // Render ingredients list handling all schema variations & sections
  const rawIngs = activeR.ingredients || activeR.parsedIngredients || activeR.rawIngredients ||
                  r.ingredients || r.parsedIngredients || r.rawIngredients || [];
  const ingredients = Array.isArray(rawIngs) ? rawIngs : (typeof rawIngs === 'object' ? Object.values(rawIngs) : []);
  const sections = Array.isArray(activeR.ingredientSections) && activeR.ingredientSections.length > 0
    ? activeR.ingredientSections
    : (Array.isArray(r.ingredientSections) && r.ingredientSections.length > 0 ? r.ingredientSections : []);

  const state = (typeof window !== 'undefined' ? getState() : {}) || {};
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

  // 2. Extract live summed macros & targets directly from universal fitResult
  const eMealTargetKcal = Math.round(fitResult?.details?.elliott?.kcalTarget || 735);
  const cMealTargetKcal = Math.round(fitResult?.details?.chloe?.kcalTarget || 578);
  const eMealTargetProt = Math.round(fitResult?.details?.elliott?.proteinTarget || 49);
  const cMealTargetProt = Math.round(fitResult?.details?.chloe?.proteinTarget || 37);

  const totalKcalBudget = eMealTargetKcal + cMealTargetKcal;
  const eShare = totalKcalBudget > 0 ? (eMealTargetKcal / totalKcalBudget) : 0.56;
  const cShare = totalKcalBudget > 0 ? (cMealTargetKcal / totalKcalBudget) : 0.44;
  const eSharePct = Math.round(eShare * 100), cSharePct = Math.round(cShare * 100);

  const singleKcalE = Math.round(fitResult?.details?.elliott?.recipeKcal || 0);
  const singleProtE = Math.round(fitResult?.details?.elliott?.recipeProtein || 0);
  const singleKcalC = Math.round(fitResult?.details?.chloe?.recipeKcal || 0);
  const singleProtC = Math.round(fitResult?.details?.chloe?.recipeProtein || 0);

  const kcalDiffE = singleKcalE - eMealTargetKcal, protDiffE = singleProtE - eMealTargetProt;
  const kcalDiffC = singleKcalC - cMealTargetKcal, protDiffC = singleProtC - cMealTargetProt;
  const eKcal = singleKcalE, cKcal = singleKcalC, eProt = singleProtE, cProt = singleProtC;

  const fitScore = Math.round(Number(fitResult?.score) || 0);
  const meta = typeof getFitScoreTierMeta === 'function' ? getFitScoreTierMeta(fitScore) : { tier: 'red', icon: '🔴', label: 'Poor Match', color: 'var(--system-red)', bg: 'var(--badge-red-bg)', text: 'var(--badge-red-text)', border: 'var(--badge-red-border)' };
  const fitPillHtml = `<span class="badge ${meta.tier}" style="background:${meta.bg};color:${meta.text};border:1px solid ${meta.border}">${meta.icon} ${fitScore}% - ${meta.label}</span>`;

  const renderMacroBadge = (type, diff) => {
    const isKcal = type === 'kcal';
    // Calories: Negative/Zero is Good (Green), Positive is Bad (Red)
    // Protein: Positive/Zero is Good (Green), Negative is Bad (Red)
    const isGood = isKcal ? diff <= 0 : diff >= 0;
    const sign = diff > 0 ? '+' : '';
    const bg = isGood ? 'var(--badge-green-bg)' : 'var(--badge-red-bg)';
    const color = isGood ? 'var(--badge-green-text)' : 'var(--badge-red-text)';
    const border = isGood ? 'var(--badge-green-border)' : 'var(--badge-red-border)';
    return `<span style="display:inline-flex; align-items:center; justify-content:center; padding: 2px 6px; border-radius: 6px; background: ${bg}; color: ${color}; border: 1px solid ${border}; font-size: 10px; font-weight: 800; margin-left: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${sign}${diff}${isKcal ? '' : 'g'}</span>`;
  };

  const macroSplitHtml = `
    <div class="recipe-modal-crossbar-macros" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--surface, #fff); border: 1px solid var(--border, #e7e5e4); font-size: 11.5px;">
        <span style="font-weight:700;">👤 Elliott (${eSharePct}%):</span>
        <span>🔥 <strong>${singleKcalE} kcal</strong> ${renderMacroBadge('kcal', kcalDiffE)}</span>
        <span>💪 <strong>${singleProtE}g</strong> ${renderMacroBadge('prot', protDiffE)}</span>
      </div>

      <div style="display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: var(--surface, #fff); border: 1px solid var(--border, #e7e5e4); font-size: 11.5px;">
        <span style="font-weight:700;">👤 Chloe (${cSharePct}%):</span>
        <span>🔥 <strong>${singleKcalC} kcal</strong> ${renderMacroBadge('kcal', kcalDiffC)}</span>
        <span>💪 <strong>${singleProtC}g</strong> ${renderMacroBadge('prot', protDiffC)}</span>
      </div>
    </div>
  `;

  const sourceHtml = formatRecipeSourceHTML(activeR) || formatRecipeSourceHTML(r);

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
    sourceHtml,
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

export function openRecipePreview(recipeId, instanceOrTab = 'original', variantArg = null, targetPerson = null, mealTypeOverride = null) {
  const state = (typeof window !== 'undefined' ? getState() : {}) || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const found = recipes.find(rec => String(rec.id) === String(recipeId));
  if (!found) return;

  const isTwoArgVariant = (instanceOrTab === 'original' || instanceOrTab === 'enhanced') && !variantArg;
  const resolvedVariant = variantArg === 'enhanced' || (isTwoArgVariant && instanceOrTab === 'enhanced') ? 'enhanced' : 'original';
  const resolvedInstanceId = isTwoArgVariant ? null : (instanceOrTab || null);
  const normPerson = String(targetPerson || '').toLowerCase();
  const resolvedServingMode = (normPerson === 'elliott' || normPerson === 'e') ? 'elliott'
    : ((normPerson === 'chloe' || normPerson === 'c') ? 'chloe' : 'both');

  previewState.recipe = found;
  previewState.instanceId = resolvedInstanceId;
  previewState.currentTab = resolvedVariant;
  previewState.servingMode = resolvedServingMode;
  previewState.mealType = mealTypeOverride || 'all';
  previewState.targetServes = Number(found.serves ?? 2) || 2;
  previewState.singleServes = 1;

  if (typeof window !== 'undefined') {
    window.previewBaseRecipe = found;
    window.currentViewTab = resolvedVariant;
  }

  renderRecipePreview();
}

export function openRecipeModal(recipeId, instanceId, variant, targetPerson, mealTypeOverride) {
  return openRecipePreview(recipeId, instanceId, variant || 'original', targetPerson, mealTypeOverride);
}
export const viewRecipe = openRecipePreview;

export async function openEnhanceRecipeModalForCurrent(recipeId) {
  const state = (typeof window !== 'undefined' ? getState() : {}) || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const found = recipes.find(rec => String(rec.id) === String(recipeId)) || previewState.recipe;
  if (!found) return;

  openEnhancementModal(found, {
    onApply: async (enhancedPayload) => {
      const updatedRecipe = {
        ...found,
        enhanced: enhancedPayload,
        ...(enhancedPayload?.fitScore !== undefined ? { enhancedFitScore: enhancedPayload.fitScore } : {}),
        updatedAt: new Date().toISOString()
      };
      try {
        await saveRecipe(updatedRecipe);
        if (state.recipes) {
          const idx = state.recipes.findIndex(r => String(r.id) === String(found.id));
          if (idx !== -1) {
            state.recipes[idx] = updatedRecipe;
          }
        }
        previewState.recipe = updatedRecipe;
        previewState.currentTab = 'enhanced';
        if (typeof window.renderRecipeVault === 'function') {
          window.renderRecipeVault();
        }
        renderRecipePreview();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('✨ Enhanced recipe saved with 85+ Fit Score!');
        }
      } catch (err) {
        console.error('[RecipeDetailModalService] Failed saving enhanced recipe:', err);
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Failed to save enhanced recipe.', 'error');
        }
      }
    }
  });
}

export async function removeCurrentEnhancedVariant(recipeId) {
  const state = (typeof window !== 'undefined' ? getState() : {}) || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const r = previewState.recipe || recipes.find(rec => String(rec.id) === String(recipeId));
  if (!r) return;

  const { renderDeleteConfirmationContent } = await import('../components/vault/VaultRecipeCardRenderService.js');
  const recipeTitle = r.name || r.title || 'this recipe';

  const content = document.getElementById('view-modal-content');
  if (!content) return;

  content.innerHTML = renderDeleteConfirmationContent(recipeTitle, 'enhanced');

  const cancelBtn = content.querySelector('#btn-cancel-vault-del');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      renderRecipePreview();
    };
  }

  const confirmBtn = content.querySelector('#btn-confirm-vault-del');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      try {
        const { deleteRecipeVariant } = await import('./HouseholdRepository.js');
        await deleteRecipeVariant(recipeId, 'enhanced');

        if (previewState.recipe && String(previewState.recipe.id) === String(recipeId)) {
          delete previewState.recipe.enhanced;
          delete previewState.recipe.enhancedFitScore;
          if (previewState.recipe.variants) delete previewState.recipe.variants.enhanced;
          previewState.recipe._bestVariant = 'original';
        }

        const found = recipes.find(rec => String(rec.id) === String(recipeId));
        if (found) {
          delete found.enhanced;
          delete found.enhancedFitScore;
          if (found.variants) delete found.variants.enhanced;
          found._bestVariant = 'original';
        }

        const favList = state.userPrefs?.variantFavourites;
        if (Array.isArray(favList)) {
          const idx = favList.indexOf(`${recipeId}_enhanced`);
          if (idx !== -1) favList.splice(idx, 1);
        }

        previewState.currentTab = 'original';
        renderRecipePreview();

        document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: state.recipes }));
        if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast(`Removed enhanced variant from "${recipeTitle}"`);
        }
      } catch (err) {
        console.error('[RecipeDetailModalService] Error removing enhanced variant:', err);
        renderRecipePreview();
      }
    };
  }
}

export async function copyMethodFromOriginalRecipe(recipeId) {
  const state = (typeof window !== 'undefined' ? getState() : {}) || {};
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const r = previewState.recipe || recipes.find(rec => String(rec.id) === String(recipeId));
  if (!r) return;

  const originalSteps = r.methodSteps || r.method || r.steps || r.instructions || [];
  const normalizedSteps = Array.isArray(originalSteps)
    ? originalSteps.map(s => typeof s === 'string' ? s : (s?.text || s?.instruction || s?.step || String(s ?? ''))).filter(Boolean)
    : (typeof originalSteps === 'string' ? originalSteps.split('\n').filter(Boolean) : []);

  if (!normalizedSteps.length) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Original recipe has no method steps to copy.');
    }
    return;
  }

  if (!r.enhanced) r.enhanced = {};
  r.enhanced.method = [...normalizedSteps];
  r.enhanced.methodSteps = [...normalizedSteps];
  if (r.variants && r.variants.enhanced) {
    r.variants.enhanced.method = [...normalizedSteps];
    r.variants.enhanced.methodSteps = [...normalizedSteps];
  }

  try {
    const { saveRecipe } = await import('./RecipeFirestoreRepository.js');
    await saveRecipe(r);
    renderRecipePreview();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast(`Copied ${normalizedSteps.length} method steps from original recipe.`);
    }
  } catch (err) {
    console.error('[RecipeDetailModalService] Failed to save copied method:', err);
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    closeRecipePreview,
    switchViewTab,
    switchPreviewServingMode,
    updateRecipePreviewScale,
    updateSinglePersonServes,
    openRecipePreview,
    openRecipeModal,
    viewRecipe,
    openEnhanceRecipeModalForCurrent,
    removeCurrentEnhancedVariant,
    copyMethodFromOriginalRecipe
  });
}
