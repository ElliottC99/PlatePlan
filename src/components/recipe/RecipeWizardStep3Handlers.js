/**
 * src/components/recipe/RecipeWizardStep3Handlers.js (v3.34.0)
 * Event bindings for Wizard Step 3: Variant Switching, Saving & Queue Navigation.
 * Includes live macro recalculation and dual-key state synchronization.
 */

import { wizardState, syncStep3InputsToState, getSaveButtonLabel, hasDistinctEnhancedVariant, stashActiveVariantSnapshot, switchWizardVariant } from './RecipeWizardState.js';
import { isIngredientUnlinked } from './RecipeWizardTaxonomySearch.js';
import { saveRecipe } from '../../services/HouseholdRepository.js';
import { findExistingRecipeByTitle } from '../../services/RecipeFirestoreRepository.js';
import { getState, updateRecipeInStore, learnIngredientAlias } from '../../store/store.js';
import { toTitleCase } from '../../utils/stringUtils.js';
import { calculateItemNutrition } from '../../services/NutritionService.js';
import { calculateMealFitScore } from '../../utils/fitScoreCalculator.js';
import { openEnhancementModal } from './RecipeEnhancementModalUI.js';
import { cleanIngredientPhraseForAlias, stemIngredientName } from '../../services/RecipeIngredientParser.js';
import { renderMacroBreakdownCrossbar } from './RecipeWizardStep3View.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';
import { resolveDynamicProductForIngredient } from '../../services/PantryTaxonomyService.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Synchronous live macro recalculation for recipe objects in the wizard.
 * Resolves ingredient references against global product and ingredient catalogs.
 * @param {Object} recipeObj 
 * @returns {Object} Per-serving macro totals
 */
export function resolveProductForIngredient(item, { products = [], ingredients = [], preferences } = {}) {
  if (!item || typeof item !== 'object') return null;
  return resolveDynamicProductForIngredient(item, { products, ingredients, preferences });
}

export function recalculateWizardMacros(recipeObj) {
  if (!recipeObj || typeof recipeObj !== 'object') return null;

  const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' && typeof window.getState === 'function' ? window.getState() : {})) || {};
  const globalProducts = Array.isArray(state.products) ? state.products : [];
  const globalIngredients = Array.isArray(state.rootItems) 
    ? state.rootItems 
    : (Array.isArray(state.ingredients) ? state.ingredients : []);

  const allIngredients = (recipeObj.ingredientSections && recipeObj.ingredientSections.length > 0)
    ? recipeObj.ingredientSections.flatMap(s => s.ingredients || [])
    : (Array.isArray(recipeObj.ingredients) ? recipeObj.ingredients : []);

  const calcFn = (typeof window !== 'undefined' && window.NutritionService?.calculateItemNutrition)
    ? window.NutritionService.calculateItemNutrition
    : calculateItemNutrition;

  let totalCal = 0;
  let totalProt = 0;
  let totalCarb = 0;
  let totalFat = 0;

  allIngredients.forEach(item => {
    if (!item || item.excludeNutrition) return;
    const matchedProduct = resolveProductForIngredient(item, {
      products: globalProducts,
      ingredients: globalIngredients
    });

    if (matchedProduct) {
      const qty = Number(item.qty ?? item.amount ?? 1) || 1;
      const unit = item.unit || 'g';
      const nut = calcFn(matchedProduct, qty, unit);
      totalCal += (nut.kcal ?? nut.cal ?? 0);
      totalProt += (nut.protein ?? nut.prot ?? 0);
      totalCarb += (nut.carbs ?? nut.carb ?? 0);
      totalFat += (nut.fat ?? 0);
    }
  });

  const serves = Number(recipeObj.servings || recipeObj.serves || 4) || 4;
  const perServing = {
    calories: Math.round(totalCal / serves),
    protein: Math.round((totalProt / serves) * 10) / 10,
    carbs: Math.round((totalCarb / serves) * 10) / 10,
    fat: Math.round((totalFat / serves) * 10) / 10
  };

  recipeObj.macros = perServing;
  recipeObj.calories = perServing.calories;
  recipeObj.protein = perServing.protein;
  recipeObj.carbs = perServing.carbs;
  recipeObj.fat = perServing.fat;
  recipeObj.perServing = { ...perServing, cal: perServing.calories, prot: perServing.protein };
  recipeObj.nutrition = {
    ...perServing,
    cal: perServing.calories,
    prot: perServing.protein,
    perServing: { ...perServing, cal: perServing.calories, prot: perServing.protein }
  };

  const isEnh = (typeof wizardState !== 'undefined' && wizardState.activeVariant === 'enhanced') || Boolean(recipeObj.enhanced && recipeObj._isEnhanced);
  if (recipeObj.enhanced && (typeof wizardState !== 'undefined' ? wizardState.activeVariant === 'enhanced' : true)) {
    if (typeof recipeObj.enhanced === 'object') {
      recipeObj.enhanced.macros = { ...perServing };
      recipeObj.enhanced.nutrition = {
        ...recipeObj.nutrition,
        perServing: { ...perServing, cal: perServing.calories, prot: perServing.protein },
        total: {
          cal: Math.round(perServing.calories * serves),
          prot: Math.round(perServing.protein * serves),
          carb: Math.round(perServing.carbs * serves),
          fat: Math.round(perServing.fat * serves)
        }
      };
      recipeObj.enhanced.calories = perServing.calories;
      recipeObj.enhanced.protein = perServing.protein;
      recipeObj.enhanced.carbs = perServing.carbs;
      recipeObj.enhanced.fat = perServing.fat;
      if (recipeObj.ingredientSections) {
        recipeObj.enhanced.ingredientSections = recipeObj.ingredientSections;
      }
      if (recipeObj.ingredients) {
        recipeObj.enhanced.ingredients = recipeObj.ingredients;
      }
    }
  }

  const activeVar = (typeof wizardState !== 'undefined' && wizardState.activeVariant) ? wizardState.activeVariant : (recipeObj.enhanced ? 'enhanced' : 'original');
  const targetMealType = recipeObj.mealSuitability?.[0] || recipeObj.types?.[0] || recipeObj.type || 'dinner';
  const fitResult = calculateMealFitScore(recipeObj, targetMealType, { variant: activeVar });
  if (fitResult && typeof fitResult.score === 'number') {
    recipeObj.fitScore = fitResult.score;
    recipeObj.fitTier = fitResult.tier;
    recipeObj._computedFitScore = fitResult.score;
    if (activeVar === 'enhanced') {
      recipeObj.enhancedFitScore = fitResult.score;
      recipeObj._scoreEnhanced = fitResult.score;
      if (recipeObj.enhanced && typeof recipeObj.enhanced === 'object') {
        recipeObj.enhanced.fitScore = fitResult.score;
        recipeObj.enhanced._computedFitScore = fitResult.score;
      }
    }
  }

  return perServing;
}

/**
 * Handle queue transition to the next recipe dish, enforcing live macro calculation.
 */
export function onNextDish(modalWrap, { loadNextRecipeFromQueue, renderWizardModal }) {
  if (wizardState.activeRecipe) {
    recalculateWizardMacros(wizardState.activeRecipe);
  }
  loadNextRecipeFromQueue();
  wizardState.currentStep = 2;
  renderWizardModal();
}

/**
 * Handle recipe saving with DOM input extraction, dynamic formatting, live macros, and Store dispatch.
 */
export async function onSaveRecipe(modalWrap, { renderWizardModal = () => {}, showWizardNotice = () => {}, loadNextRecipeFromQueue = () => {}, closeRecipeWizard = () => {} } = {}) {
  syncStep3InputsToState(modalWrap);
  stashActiveVariantSnapshot();
  const rec = wizardState.activeRecipe;

  if (!Array.isArray(rec.mealSuitability) || rec.mealSuitability.length === 0) {
    showWizardNotice('Please select at least one Meal Suitability tag (Breakfast, Lunch, Dinner, or Snacking) before saving.', 'warning');
    return;
  }

  const allIngredients = (rec.ingredientSections || []).flatMap(s => s.ingredients || []);
  const inactiveSnap = wizardState.activeVariant === 'enhanced'
    ? wizardState.variantSnapshots?.original
    : wizardState.variantSnapshots?.enhanced;
  const inactiveIngredients = inactiveSnap
    ? (inactiveSnap.ingredientSections || []).flatMap(s => s.ingredients || [])
    : [];
  const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' ? window.getState?.() : null)) || {};
  const products = state.products || [];
  const ingredients = state.rootItems || state.ingredients || [];
  const unlinked = [...allIngredients, ...inactiveIngredients].filter(i => isIngredientUnlinked(i, products, ingredients));
  
  if (unlinked.length > 0) {
    showWizardNotice(`Cannot save recipe: ${unlinked.length} ingredient(s) retain an unlinked "✨ New Item" status. Please map all ingredients to a valid Category, Item, or Sub-Type before saving.`, 'warning');
    return;
  }

  const btnSave = modalWrap.querySelector('#btn-save-wizard-recipe');
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';
  }

  // Read verified v3.34.0 DOM selectors
  const titleInput = document.getElementById('wiz-rev-title') || modalWrap.querySelector('#wiz-rev-title');
  const servingsInput = document.getElementById('tp-serving-size') || document.getElementById('wiz-rev-servings') || modalWrap.querySelector('#tp-serving-size') || modalWrap.querySelector('#wiz-rev-servings');

  const safeTitle = toTitleCase(titleInput?.value || rec.title || 'Untitled');
  const safeServings = parseInt(servingsInput?.value, 10) || rec.servings || rec.serves || 4;

  rec.title = safeTitle;
  rec.name = safeTitle;
  rec.servings = safeServings;
  rec.serves = safeServings;

  const mapIngredientItem = (i) => {
    const resolvedProd = resolveProductForIngredient(i, { products, ingredients, preferences: state.preferences || state.settings });
    
    // Explicit mapping level preservation (prevents auto-collapsing Root Items or Categories to default product sub-types)
    let finalCat = null;
    let finalIngId = null;
    let finalSubId = null;
    let isCatDefault = false;

    if (i.categoryId || (i.category && !i.ingredientId && !i.subtypeId)) {
      finalCat = i.categoryId || i.category;
      finalIngId = null;
      finalSubId = null;
      isCatDefault = true;
    } else if (i.ingredientId && !i.subtypeId) {
      finalIngId = i.ingredientId;
      finalSubId = null;
      finalCat = i.category || resolvedProd?.category || null;
      isCatDefault = false;
    } else if (i.subtypeId) {
      finalSubId = i.subtypeId;
      finalIngId = i.ingredientId || resolvedProd?.ingredientId || null;
      finalCat = i.category || resolvedProd?.category || null;
      isCatDefault = false;
    } else {
      finalIngId = resolvedProd?.ingredientId || null;
      finalSubId = resolvedProd?.subtypeId || null;
      finalCat = resolvedProd?.category || null;
    }

    const mapped = {
      ...i,
      name: i.name,
      qty: Number(i.qty) || 1,
      unit: i.unit || '',
      raw: i.raw || `${i.qty || 1} ${i.unit || ''} ${i.name || ''}`.trim(),
      ingredientId: finalIngId,
      subtypeId: finalSubId,
      category: finalCat,
      categoryId: finalCat,
      isCategoryDefault: isCatDefault,
      displayName: i.displayName || null,
      waterMl: i.waterMl || null,
      isNewTaxonomyItem: !!i.isNewTaxonomyItem
    };
    delete mapped.productId;
    delete mapped.bankId;
    return mapped;
  };

  rec.ingredients = allIngredients.map(mapIngredientItem);
  rec.types = rec.mealSuitability.map(t => t.toLowerCase());
  rec.mealType = rec.types[0];

  // Force live macro recalculation
  recalculateWizardMacros(rec);
  stashActiveVariantSnapshot();

  // Force strict sync between nutrition keys
  const finalMacros = (rec.nutrition && rec.nutrition.calories > (rec.macros?.calories || 0)) ? rec.nutrition : rec.macros;
  rec.macros = finalMacros;
  rec.nutrition = finalMacros;

  let finalComputedScore = rec.fitScore || 0;
  const targetMealType = rec.mealSuitability?.[0] || rec.types?.[0] || rec.type || 'dinner';
  const scoreVariant = wizardState.activeVariant || 'original';
  const calcMealScore = (typeof calculateMealFitScore === 'function') ? calculateMealFitScore : (typeof window !== 'undefined' ? window.calculateMealFitScore : null);
  if (typeof calcMealScore === 'function') {
    const fitData = calcMealScore(rec, targetMealType, { variant: scoreVariant });
    if (fitData && typeof fitData.score === 'number') finalComputedScore = fitData.score;
  }
  rec.fitScore = finalComputedScore;
  rec._computedFitScore = finalComputedScore;
  if (scoreVariant === 'enhanced') {
    rec.enhancedFitScore = finalComputedScore;
    rec._scoreEnhanced = finalComputedScore;
  }

  let recipeToSave;
  const baseOrig = wizardState.baseOriginalRecipe || {};
  const origSnap = wizardState.variantSnapshots?.original;
  const enhSnap = wizardState.variantSnapshots?.enhanced;

  const cleanPrepH = Number(rec.prepTime?.hours) || 0;
  const cleanPrepM = Number(rec.prepTime?.minutes) || 0;
  const cleanCookH = Number(rec.cookTime?.hours) || 0;
  const cleanCookM = Number(rec.cookTime?.minutes) || 0;
  const normalizedPrepTime = { hours: cleanPrepH, minutes: cleanPrepM };
  const normalizedCookTime = { hours: cleanCookH, minutes: cleanCookM };
  const totalTimeMins = (cleanPrepH * 60 + cleanPrepM) + (cleanCookH * 60 + cleanCookM);

  const sourceType = rec.sourceType || baseOrig.sourceType || '';
  const sourceUrl = sourceType === 'online' ? (rec.sourceUrl ?? baseOrig.sourceUrl ?? '') : '';
  const sourceBook = sourceType === 'book' ? (rec.sourceBook ?? baseOrig.sourceBook ?? '') : '';
  const sourcePage = sourceType === 'book' ? (rec.sourcePage ?? baseOrig.sourcePage ?? '') : '';
  const sourceFormatted = sourceType === 'online'
    ? sourceUrl
    : (sourceType === 'book'
        ? [sourceBook, sourcePage ? `p. ${sourcePage}` : ''].filter(Boolean).join(', ')
        : (rec.source || baseOrig.source || ''));

  const buildEnhancedPayload = (enhSourceObj) => {
    const enhSections = (enhSourceObj.ingredientSections && enhSourceObj.ingredientSections.length)
      ? enhSourceObj.ingredientSections.map(s => ({
          ...s,
          ingredients: (s.ingredients || []).map(mapIngredientItem)
        }))
      : [{ sectionTitle: 'Main Ingredients', ingredients: (enhSourceObj.ingredients || []).map(mapIngredientItem) }];
    const enhIngs = enhSections.flatMap(s => s.ingredients || []);
    const enhStepsRaw = enhSourceObj.methodSteps || enhSourceObj.steps || enhSourceObj.method || enhSourceObj.instructions || baseOrig.steps || baseOrig.method || [];
    const enhSteps = (Array.isArray(enhStepsRaw) ? enhStepsRaw : String(enhStepsRaw || '').split('\n'))
      .map(s => typeof s === 'string' ? s.trim() : String(s?.text || s?.instruction || s || '').trim())
      .filter(Boolean);
    const enhServes = Number(enhSourceObj.servings || enhSourceObj.serves || safeServings) || safeServings;

    const tempEnhRec = {
      ...rec,
      servings: enhServes,
      serves: enhServes,
      ingredientSections: enhSections,
      ingredients: enhIngs,
      methodSteps: enhSteps
    };
    const prevVar = wizardState.activeVariant;
    wizardState.activeVariant = 'enhanced';
    const enhMacros = recalculateWizardMacros(tempEnhRec) || enhSourceObj.macros || finalMacros || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    wizardState.activeVariant = prevVar;
    let enhScore = tempEnhRec.enhancedFitScore || tempEnhRec.fitScore || 0;
    if (typeof calcMealScore === 'function') {
      const liveEnhFit = calcMealScore(tempEnhRec, targetMealType, { variant: 'enhanced' });
      if (liveEnhFit && typeof liveEnhFit.score === 'number' && !liveEnhFit.isMissingMacros) {
        enhScore = liveEnhFit.score;
      }
    }
    if (!enhScore) enhScore = finalComputedScore || 0;

    return {
      ...(baseOrig.enhanced || {}),
      name: `${safeTitle.replace(/\s*\(enhanced\)\s*$/i, '')} (enhanced)`,
      title: `${safeTitle.replace(/\s*\(enhanced\)\s*$/i, '')} (enhanced)`,
      servings: enhServes,
      serves: enhServes,
      ingredients: enhIngs,
      ingredientSections: enhSections,
      steps: enhSteps,
      methodSteps: enhSteps,
      method: enhSteps.join('\n'),
      instructions: enhSteps,
      macros: {
        calories: enhMacros.calories || enhMacros.cal || 0,
        protein: enhMacros.protein || enhMacros.prot || 0,
        carbs: enhMacros.carbs || 0,
        fat: enhMacros.fat || 0
      },
      nutrition: {
        perServing: {
          calories: enhMacros.calories || enhMacros.cal || 0,
          protein: enhMacros.protein || enhMacros.prot || 0,
          carbs: enhMacros.carbs || 0,
          fat: enhMacros.fat || 0
        },
        calories: enhMacros.calories || enhMacros.cal || 0,
        protein: enhMacros.protein || enhMacros.prot || 0,
        carbs: enhMacros.carbs || 0,
        fat: enhMacros.fat || 0
      },
      fitScore: enhScore,
      _computedFitScore: enhScore,
      updatedAt: new Date().toISOString()
    };
  };

  // Determine Original source data (prefer snapshot if user switched to Enhanced, else current rec / baseOrig)
  const origSource = (wizardState.activeVariant === 'enhanced')
    ? (origSnap || baseOrig || rec)
    : rec;

  const origSections = (origSource.ingredientSections && origSource.ingredientSections.length)
    ? origSource.ingredientSections.map(s => ({
        ...s,
        ingredients: (s.ingredients || []).map(mapIngredientItem)
      }))
    : [{ sectionTitle: 'Main Ingredients', ingredients: (origSource.ingredients || []).map(mapIngredientItem) }];
  const origIngs = origSections.flatMap(s => s.ingredients || []);
  const origStepsRaw = origSource.methodSteps || origSource.steps || origSource.method || origSource.instructions || [];
  const origSteps = (Array.isArray(origStepsRaw) ? origStepsRaw : String(origStepsRaw || '').split('\n'))
    .map(s => typeof s === 'string' ? s.trim() : String(s?.text || s?.instruction || s || '').trim())
    .filter(Boolean);
  const origServes = Number(origSource.servings || origSource.serves || safeServings) || safeServings;

  const tempOrigRec = {
    ...rec,
    servings: origServes,
    serves: origServes,
    ingredientSections: origSections,
    ingredients: origIngs,
    methodSteps: origSteps
  };
  const prevVarForOrig = wizardState.activeVariant;
  wizardState.activeVariant = 'original';
  const origMacros = recalculateWizardMacros(tempOrigRec) || origSource.macros || finalMacros || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  wizardState.activeVariant = prevVarForOrig;
  const origScore = tempOrigRec.fitScore || baseOrig.fitScore || finalComputedScore || 0;

  const cleanTitle = safeTitle.replace(/\s*\(enhanced\)\s*$/i, '');
  const existingMatch = findExistingRecipeByTitle(
    state.recipes || (typeof window !== 'undefined' && window.getState ? window.getState()?.recipes : []) || [],
    cleanTitle,
    rec.id || baseOrig.id
  );

  const finalId = rec.id || baseOrig.id || existingMatch?.id || ((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `recipe_${Date.now()}`);
  const finalCreatedAt = rec.createdAt || baseOrig.createdAt || existingMatch?.createdAt || new Date().toISOString();

  const combinedSuitability = existingMatch && Array.isArray(existingMatch.mealSuitability)
    ? Array.from(new Set([...existingMatch.mealSuitability, ...rec.mealSuitability]))
    : rec.mealSuitability;
  const combinedTypes = combinedSuitability.map(t => String(t).toLowerCase());

  recipeToSave = {
    ...baseOrig,
    ...rec,
    id: finalId,
    name: cleanTitle,
    title: cleanTitle,
    servings: origServes,
    serves: origServes,
    prepTime: normalizedPrepTime,
    cookTime: normalizedCookTime,
    time: totalTimeMins,
    mealSuitability: combinedSuitability,
    types: combinedTypes,
    mealType: combinedTypes[0] || 'dinner',
    sourceType,
    sourceUrl,
    sourceBook,
    sourcePage,
    source: sourceFormatted,
    ingredientSections: origSections,
    ingredients: origIngs,
    instructions: origSteps,
    method: origSteps,
    methodSteps: origSteps,
    steps: origSteps,
    macros: {
      calories: origMacros.calories || origMacros.cal || 0,
      protein: origMacros.protein || origMacros.prot || 0,
      carbs: origMacros.carbs || 0,
      fat: origMacros.fat || 0
    },
    nutrition: {
      perServing: {
        calories: origMacros.calories || origMacros.cal || 0,
        protein: origMacros.protein || origMacros.prot || 0,
        carbs: origMacros.carbs || 0,
        fat: origMacros.fat || 0
      },
      calories: origMacros.calories || origMacros.cal || 0,
      protein: origMacros.protein || origMacros.prot || 0,
      carbs: origMacros.carbs || 0,
      fat: origMacros.fat || 0
    },
    fitScore: origScore,
    _computedFitScore: origScore,
    createdAt: finalCreatedAt,
    updatedAt: new Date().toISOString()
  };

  if (existingMatch && (existingMatch.isFavourite || existingMatch.isFavorite)) {
    recipeToSave.isFavourite = true;
    recipeToSave.isFavorite = true;
  }

  const hasEnh = Boolean(wizardState.activeVariant === 'enhanced' || enhSnap || rec.enhanced || baseOrig.enhanced);
  if (hasEnh) {
    const enhSource = (wizardState.activeVariant === 'enhanced')
      ? rec
      : (enhSnap || rec.enhanced || baseOrig.enhanced);
    const editedEnhancedPayload = buildEnhancedPayload(enhSource);
    recipeToSave.enhanced = editedEnhancedPayload;
    recipeToSave.enhancedFitScore = editedEnhancedPayload.fitScore;
    recipeToSave._scoreEnhanced = editedEnhancedPayload.fitScore;
  } else if (existingMatch && existingMatch.enhanced) {
    recipeToSave.enhanced = existingMatch.enhanced;
    recipeToSave.enhancedFitScore = existingMatch.enhancedFitScore;
    recipeToSave._scoreEnhanced = existingMatch._scoreEnhanced;
  }

  try {
    const saveRes = await saveRecipe(recipeToSave);
    if (saveRes && saveRes.success === false && !saveRes.offline) {
      const errMsg = typeof saveRes?.error === 'string'
        ? saveRes.error
        : (saveRes?.error?.message || 'Database save failed');
      throw new Error(errMsg);
    }
    updateRecipeInStore(recipeToSave);

    const resolvedForLearning = [
      ...(recipeToSave.ingredients || []),
      ...(recipeToSave.enhanced?.ingredients || [])
    ];
    for (const ing of resolvedForLearning) {
      if (ing.ingredientId && (ing.raw || ing.name) && !ing._aliasPromptHandled) {
        const cleaned = cleanIngredientPhraseForAlias(ing);
        if (cleaned) {
          await learnIngredientAlias(ing.ingredientId, cleaned, ing.subtypeId || null);
        }
      }
    }

    if (wizardState.processingQueue.length > 0) {
      const nextDishTitle = wizardState.processingQueue[0]?.title || 'Next Recipe';
      const actionContainer = btnSave ? btnSave.parentElement : modalWrap;
      const banner = document.createElement('div');
      banner.id = 'wiz-queue-saved-banner';
      banner.style.cssText = 'background: #ecfdf5; border: 1px solid #10b981; border-radius: 10px; padding: 14px 18px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;';
      banner.innerHTML = `
        <div style="font-size: 13.5px; font-weight: 600; color: #065f46;">
          ✅ Recipe saved! Remaining in queue: <strong>${wizardState.processingQueue.length}</strong>
        </div>
        <button type="button" id="btn-wiz-map-next-recipe" class="btn primary sm" style="font-weight: 600; cursor: pointer;">
          Map Next Recipe (${escapeHtml(nextDishTitle)}) →
        </button>
      `;
      actionContainer.replaceChildren(banner);

      const mapNextBtn = banner.querySelector('#btn-wiz-map-next-recipe');
      if (mapNextBtn) {
        mapNextBtn.onclick = () => onNextDish(modalWrap, { loadNextRecipeFromQueue, renderWizardModal });
      }
    } else {
      closeRecipeWizard();
      if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast(`Recipe "${safeTitle}" saved successfully!`, 'success');
      }
    }
  } catch (e) {
    console.error('[RecipeWizard] Error saving recipe:', e);
    showWizardNotice(`Error saving recipe: ${e.message}`, 'error');
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = `💾 ${getSaveButtonLabel(rec)}`;
    }
  }
}

export function bindStep3Events(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard }) {
  if (!modalWrap || wizardState.currentStep !== 3) return;

  // Step 3: Meal tag toggles
  modalWrap.querySelectorAll('.wiz-review-tag').forEach(cb => {
    cb.onchange = () => {
      let selected = Array.from(modalWrap.querySelectorAll('#wiz-review-tags-box input:checked')).map(i => i.value);
      if (selected.length === 0) {
        selected = ['Dinner'];
      }
      if (cb.checked && cb.value) {
        selected = [cb.value, ...selected.filter(v => v !== cb.value)];
      }
      wizardState.activeRecipe.mealSuitability = selected;
      wizardState.activeRecipe.types = selected.map(t => t.toLowerCase());
      wizardState.activeRecipe.mealType = wizardState.activeRecipe.types[0];

      modalWrap.querySelectorAll('#wiz-review-tags-box .wiz-review-tag').forEach(input => {
        const parentLabel = input.closest('label');
        if (parentLabel) {
          parentLabel.style.background = input.checked ? 'var(--badge-blue-bg)' : 'var(--surface)';
          parentLabel.style.color = input.checked ? 'var(--badge-blue-text)' : 'var(--text)';
        }
      });

      const currentVariant = wizardState.activeVariant || 'original';
      const targetMealType = wizardState.activeRecipe.mealSuitability[0];
      const fitContainer = modalWrap.querySelector('#wiz-step3-fit-badge-container');
      const macroCrossbarContainer = modalWrap.querySelector('#wiz-step3-macro-crossbar-container');
      if (fitContainer) {
        fitContainer.innerHTML = renderFitScoreBadge(wizardState.activeRecipe, targetMealType, {
          variant: currentVariant,
          showLabel: true
        });
      }
      if (macroCrossbarContainer) {
        macroCrossbarContainer.innerHTML = renderMacroBreakdownCrossbar(wizardState.activeRecipe, currentVariant, { mealType: targetMealType });
      }
    };
  });

  // Step 3: Source type radios
  modalWrap.querySelectorAll('.wiz-rev-source-type-radio').forEach(radio => {
    radio.onchange = () => {
      const selectedType = radio.value || '';
      wizardState.activeRecipe.sourceType = selectedType;
      modalWrap.querySelectorAll('.wiz-rev-source-type-pill').forEach(lbl => {
        const inp = lbl.querySelector('input');
        const isSel = inp && inp.checked;
        lbl.style.background = isSel ? 'var(--badge-blue-bg)' : 'var(--surface)';
        lbl.style.color = isSel ? 'var(--badge-blue-text)' : 'var(--text)';
        lbl.style.fontWeight = isSel ? '600' : '500';
      });
      const onlineDiv = modalWrap.querySelector('#wiz-rev-source-online-fields');
      const bookDiv = modalWrap.querySelector('#wiz-rev-source-book-fields');
      if (onlineDiv) onlineDiv.style.display = selectedType === 'online' ? 'block' : 'none';
      if (bookDiv) bookDiv.style.display = selectedType === 'book' ? 'grid' : 'none';
    };
  });

  const tabOrig = modalWrap.querySelector('#wiz-tab-original');
  if (tabOrig) {
    tabOrig.onclick = () => {
      switchWizardVariant('original', modalWrap);
      renderWizardModal();
    };
  }

  const tabEnh = modalWrap.querySelector('#wiz-tab-enhanced');
  if (tabEnh) {
    tabEnh.onclick = () => {
      switchWizardVariant('enhanced', modalWrap);
      renderWizardModal();
    };
  }

  const btnAutoEnh = modalWrap.querySelector('#btn-wiz-auto-enhance');
  if (btnAutoEnh) {
    btnAutoEnh.onclick = () => {
      syncStep3InputsToState(modalWrap);
      stashActiveVariantSnapshot();
      const baseRec = wizardState.activeRecipe;
      openEnhancementModal(baseRec, {
        onApply: (enhancedPayload) => {
          wizardState.activeRecipe.enhanced = enhancedPayload;
          if (wizardState.variantSnapshots) {
            wizardState.variantSnapshots.enhanced = {
              ingredientSections: enhancedPayload.ingredientSections
                ? JSON.parse(JSON.stringify(enhancedPayload.ingredientSections))
                : [{ sectionTitle: 'Main Ingredients', ingredients: JSON.parse(JSON.stringify(enhancedPayload.ingredients || [])) }],
              ingredients: JSON.parse(JSON.stringify(enhancedPayload.ingredients || [])),
              methodSteps: [...(enhancedPayload.methodSteps || enhancedPayload.steps || enhancedPayload.method || baseRec.methodSteps || [])],
              servings: enhancedPayload.servings || enhancedPayload.serves || baseRec.servings || 4,
              macros: { ...(enhancedPayload.macros || baseRec.macros || { calories: 500, protein: 35, carbs: 42, fat: 16 }) }
            };
          }
          switchWizardVariant('enhanced');
          recalculateWizardMacros(wizardState.activeRecipe);
          stashActiveVariantSnapshot();
          renderWizardModal();
          if (typeof window.showPlatePlanToast === 'function') {
            window.showPlatePlanToast('✨ Enhanced variant updated with 85+ Fit Score!');
          }
        }
      });
    };
  }

  const btnSave = modalWrap.querySelector('#btn-save-wizard-recipe');
  if (btnSave) {
    btnSave.onclick = () => onSaveRecipe(modalWrap, { renderWizardModal, showWizardNotice, loadNextRecipeFromQueue, closeRecipeWizard });
  }

  const servInput = modalWrap.querySelector('#wiz-rev-servings') || modalWrap.querySelector('#tp-serving-size');
  if (servInput) {
    servInput.onchange = () => {
      syncStep3InputsToState(modalWrap);
      recalculateWizardMacros(wizardState.activeRecipe);
      if (wizardState.activeRecipe.enhanced) {
        recalculateWizardMacros(wizardState.activeRecipe.enhanced);
      }
      renderWizardModal();
    };
  }
}
