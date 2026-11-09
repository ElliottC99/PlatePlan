/**
 * src/components/recipe/RecipeWizardState.js (v3.35.2)
 * Manages mutable state and step synchronisation for the Recipe Ingestion Wizard.
 */

import { toTitleCase } from '../../utils/stringUtils.js';
import { getState } from '../../state/AppState.js';
import { resolveProductForIngredient } from './RecipeWizardStep3Handlers.js';
import { resolveHighestAutoDefaultTaxonomy } from './RecipeWizardTaxonomySearch.js';

export const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Snacking'];

export const wizardState = {
  currentStep: 0,
  choice: 'manual', // 'manual' | 'bulk'
  activeVariant: 'original', // 'original' | 'enhanced'
  bulkText: '',
  processingQueue: [],
  currentQueueTotal: 0,
  initialQueueTotal: 0,
  currentQueueIndex: 0,
  activeRecipe: {
    title: '',
    servings: 4,
    prepTime: { hours: '', minutes: '' },
    cookTime: { hours: '', minutes: '' },
    mealSuitability: [],
    sourceType: '', // '' | 'online' | 'book'
    sourceUrl: '',
    sourceBook: '',
    sourcePage: '',
    ingredientsRaw: '',
    methodRaw: '',
    ingredientSections: [
      { sectionTitle: 'Main Ingredients', ingredients: [] }
    ],
    methodSteps: [],
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 },
    enhanced: null
  },
  baseOriginalRecipe: null,
  variantSnapshots: {
    original: null,
    enhanced: null
  }
};

export function isMultiRecipeQueueFlow(stateObj = wizardState) {
  return Boolean(
    (stateObj.initialQueueTotal && stateObj.initialQueueTotal > 1) ||
    (stateObj.currentQueueTotal && stateObj.currentQueueTotal > 1) ||
    (Array.isArray(stateObj.processingQueue) && stateObj.processingQueue.length > 0) ||
    stateObj.currentStep === 1.5
  );
}

export function getWizardStepDisplayInfo(stateObj = wizardState) {
  const step = stateObj.currentStep;
  const multi = isMultiRecipeQueueFlow(stateObj);
  if (step === 0) {
    return { stepNumber: 0, totalSteps: multi ? 4 : 3, label: 'Choice' };
  }
  if (step === 1) {
    return { stepNumber: 1, totalSteps: multi ? 4 : 3, label: 'Step 1: Ingestion' };
  }
  if (step === 1.5) {
    const qLen = Array.isArray(stateObj.processingQueue) ? stateObj.processingQueue.length : 0;
    return { stepNumber: 2, totalSteps: 4, label: `Step 2: Recipe Review Queue (${qLen} Detected)` };
  }
  if (step === 2) {
    const num = multi ? 3 : 2;
    return { stepNumber: num, totalSteps: multi ? 4 : 3, label: `Step ${num}: Sections & Mapping` };
  }
  if (step === 3) {
    const num = multi ? 4 : 3;
    return { stepNumber: num, totalSteps: multi ? 4 : 3, label: `Step ${num}: Inline Review & Save` };
  }
  return { stepNumber: 1, totalSteps: 3, label: '' };
}

function cloneSections(sections = []) {
  return JSON.parse(JSON.stringify(Array.isArray(sections) ? sections : []));
}

export function stashActiveVariantSnapshot() {
  const rec = wizardState.activeRecipe;
  if (!rec) return;
  const v = wizardState.activeVariant === 'enhanced' ? 'enhanced' : 'original';
  const sections = cloneSections(rec.ingredientSections || [{ sectionTitle: 'Main Ingredients', ingredients: rec.ingredients || [] }]);
  const flatIngs = sections.flatMap(s => s.ingredients || []);
  const steps = Array.isArray(rec.methodSteps) ? [...rec.methodSteps] : [];
  const serves = Number(rec.servings || rec.serves || 4) || 4;
  const macros = rec.macros ? { ...rec.macros } : { calories: 450, protein: 28, carbs: 40, fat: 16 };

  if (!wizardState.variantSnapshots) {
    wizardState.variantSnapshots = { original: null, enhanced: null };
  }
  wizardState.variantSnapshots[v] = {
    ingredientSections: sections,
    ingredients: flatIngs,
    methodSteps: steps,
    servings: serves,
    macros,
    fitScore: rec.fitScore
  };

  if (v === 'enhanced' && rec.enhanced && typeof rec.enhanced === 'object') {
    rec.enhanced.ingredientSections = cloneSections(sections);
    rec.enhanced.ingredients = JSON.parse(JSON.stringify(flatIngs));
    rec.enhanced.methodSteps = [...steps];
    rec.enhanced.steps = [...steps];
    rec.enhanced.method = [...steps];
    rec.enhanced.instructions = [...steps];
    rec.enhanced.servings = serves;
    rec.enhanced.serves = serves;
    rec.enhanced.macros = { ...macros };
  }
}

export function switchWizardVariant(targetVariant, modalWrap = null) {
  const target = targetVariant === 'enhanced' ? 'enhanced' : 'original';
  const current = wizardState.activeVariant === 'enhanced' ? 'enhanced' : 'original';

  if (modalWrap) {
    if (wizardState.currentStep === 2) syncStep2InputsToState(modalWrap);
    else if (wizardState.currentStep === 3) syncStep3InputsToState(modalWrap);
  }
  stashActiveVariantSnapshot();

  if (target === current) return;

  const rec = wizardState.activeRecipe;
  if (!rec) return;

  if (target === 'enhanced') {
    if (!rec.enhanced || typeof rec.enhanced !== 'object') {
      const origSnap = wizardState.variantSnapshots?.original;
      rec.enhanced = {
        title: `${rec.title || 'Recipe'} (Enhanced)`,
        ingredientSections: cloneSections(origSnap?.ingredientSections || rec.ingredientSections || []),
        ingredients: JSON.parse(JSON.stringify(origSnap?.ingredients || rec.ingredients || [])),
        methodSteps: [...(origSnap?.methodSteps || rec.methodSteps || [])],
        servings: origSnap?.servings || rec.servings || 4,
        macros: { ...(origSnap?.macros || rec.macros || { calories: 500, protein: 35, carbs: 42, fat: 16 }) }
      };
    }

    const enhSnap = wizardState.variantSnapshots?.enhanced;
    const enhSource = enhSnap || rec.enhanced;
    let enhSections = Array.isArray(enhSource.ingredientSections) && enhSource.ingredientSections.length > 0
      ? cloneSections(enhSource.ingredientSections)
      : [{ sectionTitle: 'Main Ingredients', ingredients: JSON.parse(JSON.stringify(enhSource.ingredients || rec.ingredients || [])) }];

    const rawEnhSteps = enhSource.methodSteps || enhSource.steps || enhSource.method || enhSource.instructions || rec.methodSteps || [];
    const enhSteps = Array.isArray(rawEnhSteps)
      ? rawEnhSteps.map(s => typeof s === 'string' ? s : (s?.text || s?.instruction || s?.step || String(s ?? '')))
      : (typeof rawEnhSteps === 'string' ? rawEnhSteps.split('\n') : []);

    rec.ingredientSections = enhSections;
    rec.ingredients = enhSections.flatMap(s => s.ingredients || []);
    rec.methodSteps = [...enhSteps];
    rec.servings = Number(enhSource.servings || enhSource.serves || rec.servings || 4) || 4;
    rec.serves = rec.servings;
    if (enhSource.macros) rec.macros = { ...enhSource.macros };
    if (enhSource.fitScore !== undefined) rec.fitScore = enhSource.fitScore;
  } else {
    const origSnap = wizardState.variantSnapshots?.original || wizardState.baseOriginalRecipe;
    if (origSnap) {
      let origSections = Array.isArray(origSnap.ingredientSections) && origSnap.ingredientSections.length > 0
        ? cloneSections(origSnap.ingredientSections)
        : [{ sectionTitle: 'Main Ingredients', ingredients: JSON.parse(JSON.stringify(origSnap.ingredients || [])) }];
      const rawOrigSteps = origSnap.methodSteps || origSnap.steps || origSnap.method || origSnap.instructions || [];
      const origSteps = Array.isArray(rawOrigSteps)
        ? rawOrigSteps.map(s => typeof s === 'string' ? s : (s?.text || s?.instruction || s?.step || String(s ?? '')))
        : (typeof rawOrigSteps === 'string' ? rawOrigSteps.split('\n') : []);

      rec.ingredientSections = origSections;
      rec.ingredients = origSections.flatMap(s => s.ingredients || []);
      rec.methodSteps = [...origSteps];
      rec.servings = Number(origSnap.servings || origSnap.serves || rec.servings || 4) || 4;
      rec.serves = rec.servings;
      if (origSnap.macros) rec.macros = { ...origSnap.macros };
      if (origSnap.fitScore !== undefined) rec.fitScore = origSnap.fitScore;
    }
  }

  wizardState.activeVariant = target;
  stashActiveVariantSnapshot();
}

export function hasDistinctEnhancedVariant(recipe = wizardState.activeRecipe) {
  if (!recipe || !recipe.enhanced || typeof recipe.enhanced !== 'object') return false;
  const origSource = (wizardState.activeRecipe === recipe && wizardState.variantSnapshots?.original)
    ? wizardState.variantSnapshots.original
    : recipe;
  const enhSource = (wizardState.activeRecipe === recipe && wizardState.variantSnapshots?.enhanced)
    ? wizardState.variantSnapshots.enhanced
    : recipe.enhanced;

  const originalRecipe = {
    ingredients: (origSource.ingredientSections && origSource.ingredientSections.length
      ? origSource.ingredientSections.flatMap(s => s.ingredients || [])
      : (origSource.ingredients || [])).map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
    method: origSource.methodSteps || origSource.instructions || origSource.method || []
  };

  const enhancedRecipe = {
    ingredients: (enhSource.ingredientSections && enhSource.ingredientSections.length
      ? enhSource.ingredientSections.flatMap(s => s.ingredients || [])
      : (enhSource.ingredients || [])).map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
    method: enhSource.methodSteps || enhSource.instructions || enhSource.method || []
  };

  const hasDistinctEnhanced = Boolean(
    enhancedRecipe &&
    (JSON.stringify(enhancedRecipe.ingredients) !== JSON.stringify(originalRecipe.ingredients) ||
     JSON.stringify(enhancedRecipe.method) !== JSON.stringify(originalRecipe.method))
  );

  return hasDistinctEnhanced;
}

export function getSaveButtonLabel(recipe = wizardState.activeRecipe) {
  if (wizardState.activeVariant === 'enhanced') {
    return 'Save Enhanced Variant';
  }
  return hasDistinctEnhancedVariant(recipe) ? 'Save Both Recipes' : 'Save Original Recipe';
}

export function resetWizardState() {
  wizardState.currentStep = 0;
  wizardState.choice = 'manual';
  wizardState.activeVariant = 'original';
  wizardState.baseOriginalRecipe = null;
  wizardState.variantSnapshots = { original: null, enhanced: null };
  wizardState.bulkText = '';
  wizardState.processingQueue = [];
  wizardState.currentQueueTotal = 0;
  wizardState.initialQueueTotal = 0;
  wizardState.currentQueueIndex = 0;
  wizardState.activeRecipe = {
    title: '',
    servings: 4,
    prepTime: { hours: '', minutes: '' },
    cookTime: { hours: '', minutes: '' },
    mealSuitability: [],
    sourceType: '',
    sourceUrl: '',
    sourceBook: '',
    sourcePage: '',
    ingredientsRaw: '',
    methodRaw: '',
    ingredientSections: [
      { sectionTitle: 'Main Ingredients', ingredients: [] }
    ],
    methodSteps: [],
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 },
    enhanced: null
  };
}

export function syncStep2InputsToState(modalWrap) {
  if (!modalWrap) return;

  // Section titles
  modalWrap.querySelectorAll('.wiz-section-title-input').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    if (!isNaN(sIdx) && wizardState.activeRecipe.ingredientSections[sIdx]) {
      wizardState.activeRecipe.ingredientSections[sIdx].sectionTitle = toTitleCase(input.value.trim() || 'Section');
    }
  });

  // Quantities
  modalWrap.querySelectorAll('.wiz-ing-qty').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    if (!isNaN(sIdx) && !isNaN(iIdx)) {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) {
        const val = parseFloat(input.value) || 0;
        item.qty = val;
        delete item.scaledQty;
        delete item.baseQty;
      }
    }
  });

  // Units
  modalWrap.querySelectorAll('.wiz-ing-unit').forEach(select => {
    const sIdx = parseInt(select.dataset.sidx, 10);
    const iIdx = parseInt(select.dataset.iidx, 10);
    if (!isNaN(sIdx) && !isNaN(iIdx)) {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) item.unit = select.value;
    }
  });

  // Ingredient Names
  modalWrap.querySelectorAll('.wiz-ing-name').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    if (!isNaN(sIdx) && !isNaN(iIdx)) {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) item.name = input.value.trim();
    }
  });

  // Taxonomy Search Inputs
  modalWrap.querySelectorAll('.wiz-ing-tax-search').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    if (!isNaN(sIdx) && !isNaN(iIdx)) {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) {
        const rawVal = (input.dataset.taxVal || input.value || '').trim();
        const valText = String(input.value || '').trim();
        const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' ? window.getState?.() : null)) || {};

        if (!rawVal || rawVal === 'new_item' || /new[\s_]*item/i.test(rawVal) || /new[\s_]*item/i.test(valText) || valText.startsWith('✨')) {
          item.ingredientId = null;
          item.subtypeId = null;
          item.categoryId = null;
          item.productId = null;
          item.bankId = null;
          item.isCategoryDefault = false;
          item.displayName = null;
          item.isNewTaxonomyItem = true;
        } else if (rawVal.startsWith('cat:')) {
          item.categoryId = rawVal.slice(4);
          item.ingredientId = null;
          item.subtypeId = null;
          item.productId = null;
          item.bankId = null;
          item.isCategoryDefault = true;
          item.displayName = `Generic ${item.categoryId}`;
          item.isNewTaxonomyItem = false;
        } else if (rawVal.startsWith('prod:')) {
          const pId = rawVal.slice(5);
          const prod = (state.products || []).find(p => String(p.id) === String(pId));
          if (prod) {
            const resolved = resolveHighestAutoDefaultTaxonomy(prod, {
              ingredients: state.ingredients || state.rootItems || [],
              products: state.products || []
            });
            if (resolved.level === 'category') {
              item.categoryId = resolved.categoryId;
              item.ingredientId = null;
              item.subtypeId = null;
              item.isCategoryDefault = true;
            } else if (resolved.level === 'root') {
              item.ingredientId = resolved.ingredientId;
              item.subtypeId = null;
              item.categoryId = null;
              item.isCategoryDefault = false;
            } else if (resolved.level === 'subtype') {
              item.ingredientId = resolved.ingredientId;
              item.subtypeId = resolved.subtypeId;
              item.categoryId = null;
              item.isCategoryDefault = false;
            } else {
              item.productId = pId;
            }
          } else {
            item.productId = pId;
          }
          item.isNewTaxonomyItem = false;
        } else if (rawVal.includes(':')) {
          const [ingId, subId] = rawVal.split(':');
          item.ingredientId = ingId;
          item.subtypeId = subId;
          item.categoryId = null;
          item.productId = null;
          item.bankId = null;
          item.isCategoryDefault = false;
          item.displayName = null;
          item.isNewTaxonomyItem = false;
        } else {
          item.ingredientId = rawVal;
          item.subtypeId = null;
          item.categoryId = null;
          item.productId = null;
          item.bankId = null;
          item.isCategoryDefault = false;
          item.displayName = null;
          item.isNewTaxonomyItem = false;
        }

        // Dynamically resolve auto-default product for nutrition / display
        if (!item.isNewTaxonomyItem && typeof resolveProductForIngredient === 'function') {
          const autoDefProd = resolveProductForIngredient(item, {
            products: state.products || [],
            ingredients: state.ingredients || state.rootItems || []
          });
          if (autoDefProd) {
            item.productName = autoDefProd.name || autoDefProd.productName;
          }
        }
      }
    }
  });

  // Water Volume inputs
  modalWrap.querySelectorAll('.wiz-ing-water-ml').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    if (!isNaN(sIdx) && !isNaN(iIdx)) {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) {
        item.waterMl = parseInt(input.value, 10) || 400;
      }
    }
  });

  // Servings yield
  const servingsInput = modalWrap.querySelector?.('#wiz-servings-input');
  if (servingsInput) {
    const servVal = Math.max(1, parseInt(servingsInput.value, 10) || 4);
    wizardState.activeRecipe.servings = servVal;
    wizardState.activeRecipe.serves = servVal;
  }

  // Method steps edits (preserve in-progress editing including newly added blank steps and deletion down to 0 steps)
  const stepElements = modalWrap.querySelectorAll?.('.wiz-step-input') || [];
  const stepInputs = Array.from(stepElements).map(input => input.value);
  if (stepElements.length > 0 || modalWrap.querySelector?.('#wiz-add-step-btn')) {
    wizardState.activeRecipe.methodSteps = stepInputs;
  }

  // Keep activeRecipe.ingredients and variantSnapshots in sync
  if (wizardState.activeRecipe.ingredientSections) {
    wizardState.activeRecipe.ingredients = wizardState.activeRecipe.ingredientSections.flatMap(s => s.ingredients || []);
  }
  stashActiveVariantSnapshot();
}

export function syncStep3InputsToState(modalWrap) {
  if (!modalWrap) return;
  const rec = wizardState.activeRecipe;
  const title = modalWrap.querySelector('#wiz-rev-title')?.value?.trim();
  if (title) rec.title = title;

  const servInput = modalWrap.querySelector('#tp-serving-size') || modalWrap.querySelector('#wiz-rev-servings');
  const serv = parseInt(servInput?.value, 10);
  if (serv > 0) {
    rec.servings = serv;
    rec.serves = serv;
  }

  const prepEl = modalWrap.querySelector('#wiz-rev-prepm');
  const cookEl = modalWrap.querySelector('#wiz-rev-cookm');
  if (prepEl) {
    const rawPrep = prepEl.value.trim();
    if (rawPrep === '') {
      rec.prepTime = { hours: '', minutes: '' };
    } else {
      const prepMins = Math.max(0, parseInt(rawPrep, 10) || 0);
      rec.prepTime = { hours: Math.floor(prepMins / 60), minutes: prepMins % 60 };
    }
  }
  if (cookEl) {
    const rawCook = cookEl.value.trim();
    if (rawCook === '') {
      rec.cookTime = { hours: '', minutes: '' };
    } else {
      const cookMins = Math.max(0, parseInt(rawCook, 10) || 0);
      rec.cookTime = { hours: Math.floor(cookMins / 60), minutes: cookMins % 60 };
    }
  }

  const tagBox = modalWrap.querySelector('#wiz-review-tags-box');
  if (tagBox) {
    const tags = Array.from(tagBox.querySelectorAll('input:checked')).map(i => i.value);
    rec.mealSuitability = tags;
  }

  const srcTypeRadio = modalWrap.querySelector('input[name="wiz_rev_source_type"]:checked');
  if (srcTypeRadio) {
    rec.sourceType = srcTypeRadio.value;
  }
  const srcUrlEl = modalWrap.querySelector('#wiz-rev-source-url');
  if (srcUrlEl) rec.sourceUrl = srcUrlEl.value.trim();
  const srcBookEl = modalWrap.querySelector('#wiz-rev-source-book');
  if (srcBookEl) rec.sourceBook = srcBookEl.value.trim();
  const srcPageEl = modalWrap.querySelector('#wiz-rev-source-page');
  if (srcPageEl) rec.sourcePage = srcPageEl.value.trim();

  stashActiveVariantSnapshot();
}
