/**
 * scripts/test_recipe_wizard.js (v3.27.4)
 * Automated verification test suite for:
 * 1. Compound stock parsing ("1 stock cube + 400ml water" -> qty: 1, name: "Vegetable Stock Cube")
 * 2. Universal Title Case normalization (Titles, Ingredients, Section Headers)
 * 3. Dynamic Save button label based on variant existence ("Save Original Recipe" vs "Save Both Recipes")
 */

import { strict as assert } from 'assert';
import { parseIngredientString, parseBulkRecipeText, toTitleCase } from '../src/services/RecipeImporter.js';
import { getSaveButtonLabel, hasDistinctEnhancedVariant } from '../src/components/recipe/RecipeWizardState.js';

console.log('=== RUNNING RECIPE WIZARD v3.27.4 VERIFICATION SUITE ===');

// --- Test 1: Compound Stock Parsing ---
console.log('\n--- Test 1: Compound Stock & Liquid Parsing ---');

const stockTest1 = parseIngredientString('1 stock cube + 400ml water');
console.log('Input: "1 stock cube + 400ml water"');
console.log('Parsed:', JSON.stringify(stockTest1, null, 2));
assert.equal(stockTest1.qty, 1, 'Quantity should be 1');
assert.equal(stockTest1.unit, 'qty', 'Unit should be qty');
assert.equal(stockTest1.name, 'Vegetable Stock Cube', 'Name should be Vegetable Stock Cube');
assert(stockTest1.notes.includes('400ml water'), 'Notes should contain liquid instruction');
console.log('✅ Passed: "1 stock cube + 400ml water" parses to Vegetable Stock Cube (qty: 1)');

const stockTest2 = parseIngredientString('0.5 stock cube in 200ml boiling water');
console.log('\nInput: "0.5 stock cube in 200ml boiling water"');
console.log('Parsed:', JSON.stringify(stockTest2, null, 2));
assert.equal(stockTest2.qty, 0.5, 'Quantity should be 0.5');
assert.equal(stockTest2.unit, 'qty', 'Unit should be qty');
assert.equal(stockTest2.name, 'Vegetable Stock Cube', 'Name should be Vegetable Stock Cube');
assert(stockTest2.notes.includes('200ml boiling water'), 'Notes should contain boiling water');
console.log('✅ Passed: "0.5 stock cube in 200ml boiling water" parses to Vegetable Stock Cube (qty: 0.5)');

const stockTest3 = parseIngredientString('1 chicken stock cube dissolved in 500ml water');
console.log('\nInput: "1 chicken stock cube dissolved in 500ml water"');
console.log('Parsed:', JSON.stringify(stockTest3, null, 2));
assert.equal(stockTest3.qty, 1, 'Quantity should be 1');
assert.equal(stockTest3.name, 'Chicken Stock Cube', 'Name should be Chicken Stock Cube');
console.log('✅ Passed: Chicken stock cube recognized and parsed');

// --- Test 2: Universal Title Case Normalization ---
console.log('\n--- Test 2: Universal Title Case Normalization ---');

assert.equal(toTitleCase('tomato pasta'), 'Tomato Pasta');
assert.equal(toTitleCase('tinned tomatoes'), 'Tinned Tomatoes');
assert.equal(toTitleCase('for the salsa'), 'For The Salsa');
assert.equal(toTitleCase('main ingredients'), 'Main Ingredients');
console.log('✅ Passed: toTitleCase utility formats all strings properly');

const parsedIng1 = parseIngredientString('200g firm tofu, cubed');
assert.equal(parsedIng1.name, 'Firm Tofu', 'Ingredient name must be Title Cased');
console.log('✅ Passed: parseIngredientString outputs Title Cased ingredient name ("Firm Tofu")');

const rawBulk = `tomato and lentil curry
Serves: 4

main ingredients:
400g tinned tomatoes
1 stock cube + 400ml water
1 tsp smoked paprika

Method:
1. Simmer ingredients.`;

const bulkParsed = parseBulkRecipeText(rawBulk);
assert.equal(bulkParsed.length, 1);
assert.equal(bulkParsed[0].title, 'Tomato And Lentil Curry', 'Recipe title must be Title Cased');
assert.equal(bulkParsed[0].ingredientSections[0].sectionTitle, 'Main Ingredients', 'Section title must be Title Cased');
assert.equal(bulkParsed[0].ingredients[0].name, 'Tinned Tomatoes', 'Ingredients must be Title Cased');
assert.equal(bulkParsed[0].ingredients[1].name, 'Vegetable Stock Cube', 'Stock cube must be Title Cased');
console.log('✅ Passed: parseBulkRecipeText normalizes Recipe Title, Section Headers, and Ingredients to Title Case');

// --- Test 3: Dynamic Save Button Label ---
console.log('\n--- Test 3: Dynamic Save Button Label ---');

const baseRecipe = {
  title: 'Smoky Tofu Bowl',
  ingredients: [{ name: 'Tofu', qty: 200, unit: 'g' }],
  methodSteps: ['Bake tofu.'],
  enhanced: null
};

assert.equal(hasDistinctEnhancedVariant(baseRecipe), false);
assert.equal(getSaveButtonLabel(baseRecipe), 'Save Original Recipe');
console.log('✅ Passed: Original-only recipe resolves to "Save Original Recipe"');

const recipeWithEnhanced = {
  title: 'Smoky Tofu Bowl',
  ingredients: [{ name: 'Tofu', qty: 200, unit: 'g' }],
  methodSteps: ['Bake tofu.'],
  enhanced: {
    title: 'Smoky Tofu Bowl (Enhanced)',
    ingredients: [{ name: 'Tofu', qty: 300, unit: 'g' }, { name: 'Nutritional Yeast', qty: 15, unit: 'g' }],
    methodSteps: ['Air fry tofu with nutritional yeast.']
  }
};

assert.equal(hasDistinctEnhancedVariant(recipeWithEnhanced), true);
assert.equal(getSaveButtonLabel(recipeWithEnhanced), 'Save Both Recipes');
console.log('✅ Passed: Distinct enhanced variant resolves to "Save Both Recipes"');

console.log('\n=== ALL RECIPE WIZARD v3.27.3 TESTS PASSED SUCCESSFULLY ===');
