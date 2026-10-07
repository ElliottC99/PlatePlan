/**
 * scripts/test_recipe_wizard.js
 * Verification test suite for Recipe Ingestion Wizard:
 * - Validates Step 2 input synchronisation without ReferenceError exceptions
 * - Validates strict mealSuitability categories ('Breakfast', 'Lunch', 'Dinner', 'Snacking')
 * - Validates searchable taxonomy mappings
 */

import { strict as assert } from 'assert';
import { wizardState, resetWizardState, syncStep2InputsToState, MEAL_TAGS } from '../src/components/recipe/RecipeWizardState.js';

console.log('=== RUNNING RECIPE WIZARD VERIFICATION SUITE ===');

// Test 1: Validate Allowed Meal Tags
console.log('--- Test 1: Strict Meal Suitability Tags ---');
const expectedTags = ['Breakfast', 'Lunch', 'Dinner', 'Snacking'];
assert.deepEqual(MEAL_TAGS, expectedTags, 'MEAL_TAGS must strictly match [Breakfast, Lunch, Dinner, Snacking]');
assert(!MEAL_TAGS.includes('Side'), 'MEAL_TAGS must not include Side');
assert(!MEAL_TAGS.includes('Dessert'), 'MEAL_TAGS must not include Dessert');
console.log('✅ Test 1 Passed: Meal suitability tags strictly constrained to [Breakfast, Lunch, Dinner, Snacking].');

// Test 2: Validate syncStep2InputsToState DOM Emulation without ReferenceError
console.log('--- Test 2: syncStep2InputsToState Execution ---');
resetWizardState();
wizardState.activeRecipe.currentServings = 4;
wizardState.activeRecipe.targetServings = 6;
wizardState.activeRecipe.ingredientSections = [
  {
    sectionTitle: 'Main Ingredients',
    ingredients: [
      { raw: '200g firm tofu', qty: 200, unit: 'g', name: 'firm tofu', ingredientId: null, subtypeId: null, isNewTaxonomyItem: true }
    ]
  }
];

// Mock DOM wrapper
const mockModalWrap = {
  querySelectorAll: (selector) => {
    if (selector === '.wiz-section-title-input') {
      return [{ dataset: { sidx: '0' }, value: 'Curry Base' }];
    }
    if (selector === '.wiz-ing-qty') {
      return [{ dataset: { sidx: '0', iidx: '0' }, value: '300' }];
    }
    if (selector === '.wiz-ing-unit') {
      return [{ dataset: { sidx: '0', iidx: '0' }, value: 'g' }];
    }
    if (selector === '.wiz-ing-name') {
      return [{ dataset: { sidx: '0', iidx: '0' }, value: 'Extra Firm Tofu' }];
    }
    if (selector === '.wiz-ing-tax-search') {
      return [{ dataset: { sidx: '0', iidx: '0', taxVal: 'ing-tofu-1:sub-extra-firm' }, value: '🏷️ Extra Firm (Firm Tofu)' }];
    }
    if (selector === '.wiz-step-input') {
      return [{ value: 'Press tofu block.' }, { value: 'Sauté in skillet.' }];
    }
    return [];
  }
};

try {
  syncStep2InputsToState(mockModalWrap);
  const updatedItem = wizardState.activeRecipe.ingredientSections[0].ingredients[0];
  assert.equal(wizardState.activeRecipe.ingredientSections[0].sectionTitle, 'Curry Base');
  assert.equal(updatedItem.scaledQty, 300);
  assert.equal(updatedItem.unit, 'g');
  assert.equal(updatedItem.name, 'Extra Firm Tofu');
  assert.equal(updatedItem.ingredientId, 'ing-tofu-1');
  assert.equal(updatedItem.subtypeId, 'sub-extra-firm');
  assert.equal(updatedItem.isNewTaxonomyItem, false);
  assert.equal(wizardState.activeRecipe.methodSteps.length, 2);
  console.log('✅ Test 2 Passed: syncStep2InputsToState executed cleanly without ReferenceError exceptions.');
} catch (err) {
  console.error('❌ Test 2 Failed with error:', err);
  process.exit(1);
}

console.log('=== ALL RECIPE WIZARD TESTS COMPLETED SUCCESSFULLY ===');
