/**
 * src/components/recipe/RecipeWizardState.js (v3.27.5)
 * Manages mutable state and step synchronisation for the Recipe Ingestion Wizard.
 */

export const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Snacking'];

export const wizardState = {
  currentStep: 0,
  choice: 'manual', // 'manual' | 'bulk'
  activeVariant: 'original', // 'original' | 'enhanced'
  bulkText: '',
  processingQueue: [],
  currentQueueTotal: 0,
  activeRecipe: {
    title: '',
    currentServings: 4,
    targetServings: 4,
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
  }
};

export function hasDistinctEnhancedVariant(recipe = wizardState.activeRecipe) {
  if (!recipe || !recipe.enhanced || typeof recipe.enhanced !== 'object') return false;
  
  const originalRecipe = {
    ingredients: recipe.ingredients || (recipe.ingredientSections || []).flatMap(s => s.ingredients).map(i => ({ name: i.name, qty: i.scaledQty || i.qty, unit: i.unit })),
    method: recipe.methodSteps || recipe.instructions || recipe.method || []
  };
  
  const enhancedRecipe = {
    ingredients: recipe.enhanced.ingredients || (recipe.enhanced.ingredientSections || []).flatMap(s => s.ingredients).map(i => ({ name: i.name, qty: i.scaledQty || i.qty, unit: i.unit })),
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
  return hasDistinctEnhancedVariant(recipe) ? 'Save Both Recipes' : 'Save Original Recipe';
}

export function resetWizardState() {
  wizardState.currentStep = 0;
  wizardState.choice = 'manual';
  wizardState.activeVariant = 'original';
  wizardState.bulkText = '';
  wizardState.processingQueue = [];
  wizardState.currentQueueTotal = 0;
  wizardState.activeRecipe = {
    title: '',
    currentServings: 4,
    targetServings: 4,
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
      wizardState.activeRecipe.ingredientSections[sIdx].sectionTitle = input.value.trim() || 'Section';
    }
  });

  // Quantities
  modalWrap.querySelectorAll('.wiz-ing-qty').forEach(input => {
    const sIdx = parseInt(input.dataset.sidx, 10);
    const iIdx = parseInt(input.dataset.iidx, 10);
    if (!isNaN(sIdx) && !isNaN(iIdx)) {
      const item = wizardState.activeRecipe.ingredientSections[sIdx]?.ingredients[iIdx];
      if (item) item.scaledQty = parseFloat(input.value) || item.qty;
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
        const val = input.dataset.taxVal || (input.value.startsWith('✨') ? 'new_item' : input.value);
        if (!val || val === 'new_item') {
          item.ingredientId = null;
          item.subtypeId = null;
          item.categoryId = null;
          item.isNewTaxonomyItem = true;
        } else if (val.startsWith('cat:')) {
          item.categoryId = val.slice(4);
          item.ingredientId = null;
          item.subtypeId = null;
          item.isNewTaxonomyItem = false;
        } else if (val.includes(':')) {
          const [ingId, subId] = val.split(':');
          item.ingredientId = ingId;
          item.subtypeId = subId;
          item.categoryId = null;
          item.isNewTaxonomyItem = false;
        } else {
          item.ingredientId = val;
          item.subtypeId = null;
          item.categoryId = null;
          item.isNewTaxonomyItem = false;
        }
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

  const serv = parseInt(modalWrap.querySelector('#wiz-rev-servings')?.value, 10);
  if (serv > 0) rec.targetServings = serv;

  const prepMins = parseInt(modalWrap.querySelector('#wiz-rev-prepm')?.value, 10) || 0;
  const cookMins = parseInt(modalWrap.querySelector('#wiz-rev-cookm')?.value, 10) || 0;
  rec.prepTime = { hours: Math.floor(prepMins / 60), minutes: prepMins % 60 };
  rec.cookTime = { hours: Math.floor(cookMins / 60), minutes: cookMins % 60 };

  const tags = Array.from(modalWrap.querySelectorAll('#wiz-review-tags-box input:checked')).map(i => i.value);
  if (tags.length) rec.mealSuitability = tags;
}
