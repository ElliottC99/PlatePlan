/**
 * src/components/recipe/RecipeWizardState.js (v3.27.2)
 * Manages mutable state and step synchronisation for the Recipe Ingestion Wizard.
 */

export const MEAL_TAGS = ['Breakfast', 'Lunch', 'Dinner', 'Snacking'];

export const wizardState = {
  currentStep: 0,
  choice: 'manual', // 'manual' | 'bulk'
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
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
  }
};

export function resetWizardState() {
  wizardState.currentStep = 0;
  wizardState.choice = 'manual';
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
    macros: { calories: 450, protein: 28, carbs: 40, fat: 16 }
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
          item.isNewTaxonomyItem = true;
        } else if (val.includes(':')) {
          const [ingId, subId] = val.split(':');
          item.ingredientId = ingId;
          item.subtypeId = subId;
          item.isNewTaxonomyItem = false;
        } else {
          item.ingredientId = val;
          item.subtypeId = null;
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
