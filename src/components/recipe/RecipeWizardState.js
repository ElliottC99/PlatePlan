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
    prepTime: { hours: 0, minutes: 15 },
    cookTime: { hours: 0, minutes: 30 },
    mealSuitability: ['Dinner'],
    ingredientsRaw: '',
    methodRaw: '',
    ingredientSections: [
      { sectionTitle: 'Main Ingredients', ingredients: [] }
    ],
    methodSteps: [],
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 },
    enhanced: null
  },
  baseOriginalRecipe: null
};

export function hasDistinctEnhancedVariant(recipe = wizardState.activeRecipe) {
  if (!recipe || !recipe.enhanced || typeof recipe.enhanced !== 'object') return false;
  
  const originalRecipe = {
    ingredients: recipe.ingredients || (recipe.ingredientSections || []).flatMap(s => s.ingredients).map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
    method: recipe.methodSteps || recipe.instructions || recipe.method || []
  };
  
  const enhancedRecipe = {
    ingredients: recipe.enhanced.ingredients || (recipe.enhanced.ingredientSections || []).flatMap(s => s.ingredients).map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
    method: recipe.enhanced.methodSteps || recipe.enhanced.instructions || recipe.enhanced.method || []
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
  wizardState.bulkText = '';
  wizardState.processingQueue = [];
  wizardState.currentQueueTotal = 0;
  wizardState.initialQueueTotal = 0;
  wizardState.currentQueueIndex = 0;
  wizardState.activeRecipe = {
    title: '',
    servings: 4,
    prepTime: { hours: 0, minutes: 15 },
    cookTime: { hours: 0, minutes: 30 },
    mealSuitability: ['Dinner'],
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
        const rawVal = input.dataset.taxVal || (input.value.startsWith('✨') ? 'new_item' : input.value);
        const state = (typeof getState === 'function' ? getState() : (typeof window !== 'undefined' ? window.getState?.() : null)) || {};

        if (!rawVal || rawVal === 'new_item') {
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

  // Method steps edits
  const stepInputs = [];
  modalWrap.querySelectorAll('.wiz-step-input').forEach(input => {
    stepInputs.push(input.value.trim());
  });
  if (stepInputs.length > 0) {
    wizardState.activeRecipe.methodSteps = stepInputs.filter(Boolean);
  }
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

  const prepMins = parseInt(modalWrap.querySelector('#wiz-rev-prepm')?.value, 10) || 0;
  const cookMins = parseInt(modalWrap.querySelector('#wiz-rev-cookm')?.value, 10) || 0;
  rec.prepTime = { hours: Math.floor(prepMins / 60), minutes: prepMins % 60 };
  rec.cookTime = { hours: Math.floor(cookMins / 60), minutes: cookMins % 60 };

  const tags = Array.from(modalWrap.querySelectorAll('#wiz-review-tags-box input:checked')).map(i => i.value);
  if (tags.length) rec.mealSuitability = tags;
}
