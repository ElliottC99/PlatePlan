/**
 * scripts/test_recipe_wizard_edit.js
 * Test suite verifying Recipe Wizard edit mode pre-population and yield calibration.
 */

import assert from 'node:assert/strict';

// Mock DOM environment for Node
if (typeof global.window === 'undefined') {
  global.window = {};
}
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tag) => {
      const el = {
        tagName: tag,
        className: '',
        style: {},
        innerHTML: '',
        textContent: '',
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild: () => {},
        prepend: () => {},
        remove: () => {}
      };
      return el;
    },
    getElementById: (id) => null,
    body: {
      appendChild: () => {}
    }
  };
}

import { AppState, getState } from '../src/state/AppState.js';
import { openRecipeWizard } from '../src/components/recipe/RecipeWizardModal.js';
import { wizardState, resetWizardState } from '../src/components/recipe/RecipeWizardState.js';
import { renderRecipeDetailModalContent } from '../src/components/recipe/RecipeDetailModalUI.js';

// Setup mock state with Sausage Party Pizza
const mockPizzaRecipe = {
  id: 'rec_pizza_1',
  title: 'Sausage Party Pizza',
  servings: 2,
  serves: 2,
  time: 45,
  prepTime: 45,
  types: ['dinner'],
  ingredientSections: [
    {
      sectionTitle: 'Pizza Bases',
      ingredients: [
        { name: 'Strong White Flour', qty: 850, unit: 'g', raw: '850g strong bread flour', ingredientId: 'ing_flour_1', productId: 'prod_flour_1' },
        { name: 'Semolina', qty: 150, unit: 'g', raw: '150g semolina', ingredientId: 'ing_semo_1' },
        { name: 'Rock Salt', qty: 3.5, unit: 'g', raw: '3.5g salt' },
        { name: 'Fast Action Yeast', qty: 14, unit: 'g', raw: '14g dried yeast' }
      ]
    },
    {
      sectionTitle: 'Sauce',
      ingredients: [
        { name: 'Brown Onions', qty: 1, unit: 'qty', raw: '1 onion', ingredientId: 'ing_onion_1' },
        { name: 'Garlic Cloves', qty: 3, unit: 'clove', raw: '3 cloves of garlic' },
        { name: 'Finely Chopped Tomatoes', qty: 400, unit: 'g', raw: '400g chopped tomatoes' }
      ]
    }
  ],
  steps: [
    'In a stand mixer fitted with a dough hook, mix the bread flour, semolina flour, salt, yeast, sugar, and olive oil.',
    'Pour in the lukewarm water and knead on low speed for 10 minutes.',
    'Transfer the dough to an oiled bowl, cover, and let rise in a warm spot for 30 to 45 minutes.',
    'For the pizza sauce, finely dice the onion and grate the garlic.',
    'Heat 40ml olive oil in a saucepan over low-medium heat, sweating the onion and garlic for 10 minutes.',
    'Increase the heat, add the chopped tomatoes, sugar, salt, and dried oregano, bringing to a boil.'
  ],
  macros: {
    calories: 2909,
    protein: 81,
    carbs: 468,
    fat: 65
  }
};

// Test 1: Recipe lookup & pre-population in RecipeWizardModal
console.log('Testing Test 1: Recipe lookup & pre-population...');
const state = getState();
state.recipes = [mockPizzaRecipe];

openRecipeWizard('manual', 'rec_pizza_1');

assert.strictEqual(wizardState.activeRecipe.id, 'rec_pizza_1', 'Recipe ID must match');
assert.strictEqual(wizardState.activeRecipe.title, 'Sausage Party Pizza', 'Recipe Title must be prefilled');
assert.strictEqual(wizardState.activeRecipe.servings, 2, 'Servings must be prefilled with author baseline (2)');
assert.strictEqual(wizardState.activeRecipe.prepTime.hours, 0, 'Prep hours must be normalized (0)');
assert.strictEqual(wizardState.activeRecipe.prepTime.minutes, 45, 'Prep minutes must be normalized (45)');
assert.deepStrictEqual(wizardState.activeRecipe.mealSuitability, ['Dinner'], 'Meal suitability must be prefilled (Dinner)');

assert(wizardState.activeRecipe.ingredientsRaw.includes('Pizza Bases:'), 'Ingredients raw text must include section header Pizza Bases:');
assert(wizardState.activeRecipe.ingredientsRaw.includes('850g strong bread flour'), 'Ingredients raw text must include strong bread flour');
assert(wizardState.activeRecipe.ingredientsRaw.includes('Sauce:'), 'Ingredients raw text must include section header Sauce:');
assert(wizardState.activeRecipe.ingredientsRaw.includes('3 cloves of garlic'), 'Ingredients raw text must include garlic cloves');

assert(wizardState.activeRecipe.methodRaw.includes('1. In a stand mixer'), 'Method raw text must be numbered lines');
assert(wizardState.activeRecipe.methodRaw.includes('6. Increase the heat'), 'Method raw text must include step 6');

console.log('✅ Test 1 passed: RecipeWizard pre-population successful!');

// Test 2: Recipe Detail Modal renders Edit Recipe button
console.log('Testing Test 2: RecipeDetailModal renders Edit button...');
const detailHtml = renderRecipeDetailModalContent({
  r: mockPizzaRecipe,
  recipe: mockPizzaRecipe,
  activeR: mockPizzaRecipe
});

assert(detailHtml.includes('modal-recipe-review-btn') || detailHtml.includes('modal-recipe-edit-btn'), 'Detail modal must include modal-recipe-review-btn or modal-recipe-edit-btn');
assert(detailHtml.includes('openRecipeWizard(\'review\', \'rec_pizza_1\'') || detailHtml.includes('openRecipeWizard(\'manual\', \'rec_pizza_1\''), 'Button must call openRecipeWizard with rec_pizza_1');
console.log('✅ Test 2 passed: Recipe Detail Modal renders Review/Edit button!');

// Test 3: Fallback recipe retrieval via window.Store / window.allRecipes
console.log('Testing Test 3: Fallback recipe retrieval...');
state.recipes = [];
window.allRecipes = [mockPizzaRecipe];
resetWizardState();
openRecipeWizard('manual', 'rec_pizza_1');
assert.strictEqual(wizardState.activeRecipe.id, 'rec_pizza_1', 'Fallback recipe lookup must find rec_pizza_1');
assert.strictEqual(wizardState.activeRecipe.title, 'Sausage Party Pizza', 'Fallback pre-population must succeed');
console.log('✅ Test 3 passed: Fallback retrieval successful!');

console.log('\nAll Recipe Wizard Edit tests passed successfully!');
