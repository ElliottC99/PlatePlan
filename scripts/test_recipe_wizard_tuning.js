/**
 * scripts/test_recipe_wizard_tuning.js
 * Verification suite for fine-tuned Recipe Wizard ingredient parsing:
 * 1. Fraction / mixed-number ranges with units (e.g., "¼–½ Tsp Cayenne Pepper")
 * 2. Dimensioned root items (e.g., "2.5cm piece of fresh ginger")
 * 3. Automatic "To Serve" section allocation for items with "(to serve)"
 */

import assert from 'node:assert/strict';
import { parseIngredientString } from '../src/services/RecipeIngredientParser.js';
import { parseSingleRecipeText } from '../src/services/RecipeParserService.js';

console.log('=== RUNNING RECIPE WIZARD TUNING TEST SUITE ===\n');

// --- Test 1: Fraction & Range Parsing with Metric Conversion ---
console.log('Test 1: Fraction & Range Parsing...');
const cayenne = parseIngredientString('¼–½ Tsp Cayenne Pepper');
assert(cayenne, 'Cayenne pepper must parse successfully');
assert.strictEqual(cayenne.name, 'Cayenne Pepper', 'Name must be clean Cayenne Pepper without range prefix');
assert.strictEqual(cayenne.unit, 'g', 'Teaspoon must convert to grams');
assert.strictEqual(cayenne.qty, 1.3, '0.375 tsp at 0.7 density must equal 1.3g');
assert.strictEqual(cayenne.isEstimated, true, 'Volume to weight conversion must be marked estimated');

// Additional fraction range variants
const oilRange = parseIngredientString('1 1/2 - 2 tbsp olive oil');
assert(oilRange, 'Olive oil range must parse');
assert.strictEqual(oilRange.unit, 'ml', 'Tablespoons of liquid must convert to ml');
assert.strictEqual(oilRange.qty, 26.3, '1.75 tbsp must equal 26.3ml');

console.log('✅ Test 1 Passed: Fraction and range parsing correctly converts measurements to metric.');

// --- Test 2: Dimensioned Produce / Root Conversion ---
console.log('\nTest 2: Dimensioned Produce / Root Conversion...');
const gingerCm = parseIngredientString('2.5cm piece of fresh ginger');
assert(gingerCm, 'Fresh ginger (cm) must parse');
assert.strictEqual(gingerCm.name, 'Fresh Ginger', 'Name must be clean Fresh Ginger without piece of prefix');
assert.strictEqual(gingerCm.unit, 'g', 'Length must convert to grams');
assert.strictEqual(gingerCm.qty, 12.5, '2.5cm piece must calculate to 12.5g');
assert.strictEqual(gingerCm.notes, '2.5cm piece', 'Notes must preserve author dimension specification');

const gingerInch = parseIngredientString('1 inch piece of fresh ginger');
assert(gingerInch, 'Fresh ginger (inch) must parse');
assert.strictEqual(gingerInch.name, 'Fresh Ginger');
assert.strictEqual(gingerInch.unit, 'g');
assert.strictEqual(gingerInch.qty, 12.7, '1 inch piece must calculate to 12.7g');
assert.strictEqual(gingerInch.notes, '1inch piece');

const gingerThumb = parseIngredientString('thumb-sized piece of ginger');
assert(gingerThumb, 'Thumb-sized piece of ginger must parse');
assert.strictEqual(gingerThumb.name, 'Ginger');
assert.strictEqual(gingerThumb.unit, 'g');
assert.strictEqual(gingerThumb.qty, 12.5);

console.log('✅ Test 2 Passed: Dimensioned produce converts to accurate gram weights with notes.');

// --- Test 3: Serving Qualifiers & Section Allocation ---
console.log('\nTest 3: Serving Qualifiers & Section Allocation...');
const peanuts = parseIngredientString('20g unsalted peanuts (to serve)');
assert(peanuts, 'Unsalted peanuts must parse');
assert.strictEqual(peanuts.name, 'Unsalted Peanuts', 'Name must be stripped of (to serve)');
assert.strictEqual(peanuts.qty, 20);
assert.strictEqual(peanuts.unit, 'g');
assert.strictEqual(peanuts.notes, 'to serve', 'Notes must record to serve');
assert.strictEqual(peanuts.isToServe, true, 'isToServe flag must be true');

// Test recipe parser allocating to "To Serve" section automatically
const sampleRecipeText = `
Tofu Satay Skewers
Serves: 4
Prep Time: 15 mins
Cook Time: 20 mins

Ingredients:
Main Ingredients:
400g firm tofu, pressed
1 tbsp soy sauce
1 tsp sesame oil
20g unsalted peanuts (to serve)
fresh coriander, to serve

Method:
1. Cut tofu into cubes.
2. Cook on skewers.
`;

const parsedRecipe = parseSingleRecipeText(sampleRecipeText, []);
assert(parsedRecipe, 'Recipe must parse successfully');
assert.strictEqual(parsedRecipe.ingredientSections.length, 2, 'Should create 2 distinct ingredient sections');
assert.strictEqual(parsedRecipe.ingredientSections[0].sectionTitle, 'Main Ingredients');
assert.strictEqual(parsedRecipe.ingredientSections[1].sectionTitle, 'To Serve', 'Second section must be titled To Serve');

const toServeIngs = parsedRecipe.ingredientSections[1].ingredients;
assert.strictEqual(toServeIngs.length, 2, 'To Serve section must contain peanuts and coriander');
assert.strictEqual(toServeIngs[0].name, 'Unsalted Peanuts');
assert.strictEqual(toServeIngs[1].name, 'Fresh Coriander');

console.log('✅ Test 3 Passed: Serving qualifiers automatically route to dedicated To Serve section.');

console.log('\n=== ALL RECIPE WIZARD TUNING TESTS PASSED ===');
