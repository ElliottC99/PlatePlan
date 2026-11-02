/**
 * scripts/test_auto_default_and_recipe_recalculation.js
 * Verification test suite for:
 * 1. Default strategy is highest_protein_per_kcal & legacy keys aliased.
 * 2. PreferenceRepository whitelisting preserves autoDefaultStrategy.
 * 3. resolveDefaultProduct precedence and strategy sorting.
 * 4. sweepAndRecalibrateIngredientDefaults synchronizes isAutoDefault product flags.
 * 5. recalculateAllRecipeMacros recomputes macros, nutrition, and fit scores across Vault recipes.
 */

import assert from 'node:assert';
import { whitelistPreferences } from '../src/services/PreferenceRepository.js';
import { compareProductsByStrategy, resolveDefaultProduct } from '../src/services/PantryHierarchyService.js';
import { sweepAndRecalibrateIngredientDefaults } from '../src/services/HydrationService.js';
import { recalculateAllRecipeMacros } from '../src/services/MaintenanceService.js';
import { getState, setRecipes, setIngredients, setProducts } from '../src/store/store.js';

console.log('=== RUNNING AUTO-DEFAULT STRATEGY & RECIPE RECALCULATION TEST SUITE ===\n');

// Mock window environment for standalone Node testing
if (typeof window === 'undefined') {
  global.window = {
    Store: { getState, setState: () => {} },
    getState
  };
}

// --- TEST 1: Whitelisting in PreferenceRepository ---
console.log('--- Test 1: Preference Whitelisting ---');
const rawPrefs = {
  autoDefaultStrategy: 'highest_protein_per_kcal',
  autoDefaultCriterion: 'highest_protein_per_kcal',
  productPriority: 'protein_per_kcal',
  theme: 'dark',
  unauthorizedKey: 'drop_me'
};
const cleaned = whitelistPreferences(rawPrefs);
assert.strictEqual(cleaned.autoDefaultStrategy, 'highest_protein_per_kcal', 'autoDefaultStrategy must be whitelisted');
assert.strictEqual(cleaned.autoDefaultCriterion, 'highest_protein_per_kcal', 'autoDefaultCriterion must be whitelisted');
assert.strictEqual(cleaned.unauthorizedKey, undefined, 'unauthorized keys must still be dropped');
console.log('✅ Test 1 Passed: autoDefaultStrategy & autoDefaultCriterion are whitelisted.\n');

// --- TEST 2: Comparator & Strategy Fallback ---
console.log('--- Test 2: Strategy Fallback & Comparator ---');
const prodStandardSausages = {
  id: 'prod_standard_sausages',
  name: 'Standard Sausages',
  price: 2.00,
  packSize: 400,
  packUnit: 'g',
  kcal: 148,
  prot: 8.7,
  isAutoDefault: false
};
const prodLindaSausages = {
  id: 'prod_linda_sausages',
  name: 'Linda McCartney Vegan Sausages',
  price: 2.50,
  packSize: 300,
  packUnit: 'g',
  kcal: 123,
  prot: 17.0,
  isAutoDefault: false
};

// Default comparator call without explicit criterion should prioritize highest_protein_per_kcal
const cmpDefault = compareProductsByStrategy(prodStandardSausages, prodLindaSausages);
assert(cmpDefault > 0, 'Linda McCartney sausages should rank ahead of standard sausages by default (highest protein per kcal)');
console.log('✅ Test 2 Passed: Default product comparison prioritises highest protein density.\n');

// --- TEST 3: resolveDefaultProduct Precedence ---
console.log('--- Test 3: resolveDefaultProduct Precedence ---');
const ingredientSausages = {
  id: 'ing_sausages',
  name: 'Sausages',
  subtypes: []
};
const productPool = [
  { ...prodStandardSausages, ingredientId: 'ing_sausages', isAutoDefault: true }, // Legacy flag on standard
  { ...prodLindaSausages, ingredientId: 'ing_sausages', isAutoDefault: false }
];

// Strategy sort should pick Linda McCartney even if standard had legacy isAutoDefault: true
const resolvedDefault = resolveDefaultProduct(ingredientSausages, productPool);
assert.strictEqual(resolvedDefault.id, 'prod_linda_sausages', 'Should resolve Linda McCartney as optimal default product');

// If ingredient explicitly pins defaultProductId, that explicit choice must be respected
const pinnedIngredient = {
  ...ingredientSausages,
  defaultProductId: 'prod_standard_sausages'
};
const resolvedPinned = resolveDefaultProduct(pinnedIngredient, productPool);
assert.strictEqual(resolvedPinned.id, 'prod_standard_sausages', 'Explicit ingredient.defaultProductId must be respected');
console.log('✅ Test 3 Passed: resolveDefaultProduct prioritises explicit assignments and strategy sorting over legacy product flags.\n');

// --- TEST 4: sweepAndRecalibrateIngredientDefaults Synchronizes Product Flags ---
console.log('--- Test 4: sweepAndRecalibrateIngredientDefaults Product Flag Sync ---');
setIngredients([ingredientSausages]);
setProducts(productPool);
getState().settings = { autoDefaultStrategy: 'highest_protein_per_kcal' };

const updatedCount = await sweepAndRecalibrateIngredientDefaults();
assert(updatedCount >= 1, 'Should recalibrate at least 1 ingredient default');

const currentIngs = getState().ingredients;
const currentProds = getState().products;
const sausageIng = currentIngs.find(i => i.id === 'ing_sausages');
const lindaProd = currentProds.find(p => p.id === 'prod_linda_sausages');
const standardProd = currentProds.find(p => p.id === 'prod_standard_sausages');

assert.strictEqual(sausageIng.defaultProductId, 'prod_linda_sausages', 'Ingredient defaultProductId must point to Linda McCartney');
assert.strictEqual(lindaProd.isAutoDefault, true, 'Linda McCartney product must be set to isAutoDefault: true');
assert.strictEqual(standardProd.isAutoDefault, false, 'Standard sausage product must be set to isAutoDefault: false');
console.log('✅ Test 4 Passed: sweepAndRecalibrateIngredientDefaults updates both ingredient defaultProductId and product isAutoDefault flags.\n');

// --- TEST 5: recalculateAllRecipeMacros across Vault Recipes ---
console.log('--- Test 5: recalculateAllRecipeMacros Updates Macros & Fit Scores ---');
const mockRecipe = {
  id: 'rec_sausage_bake',
  name: 'Sausage Potato Bake',
  serves: 2,
  servings: 2,
  types: ['dinner'],
  macros: { calories: 1186, protein: 46.6, fat: 37.7, carbs: 153.5 },
  nutrition: {
    perServing: { cal: 1186, prot: 46.6, fat: 37.7, carb: 153.5 },
    total: { cal: 2372, prot: 93.2, fat: 75.4, carb: 307.0 }
  },
  fitScore: 39,
  ingredients: [
    {
      name: 'Sausages',
      ingredientId: 'ing_sausages',
      productId: 'prod_standard_sausages', // Old product pinned in ingredient
      qty: 200,
      unit: 'g'
    }
  ],
  enhanced: {
    name: 'Sausage Potato Bake (Enhanced)',
    serves: 2,
    ingredients: [
      {
        name: 'Sausages',
        ingredientId: 'ing_sausages',
        qty: 200,
        unit: 'g'
      }
    ]
  }
};

const beforeMacros = { ...mockRecipe.macros };
setRecipes([mockRecipe]);
const recalcResult = await recalculateAllRecipeMacros({ dryRun: true });
assert.strictEqual(recalcResult.success, true, 'Recalculation must succeed');
assert.strictEqual(recalcResult.updatedCount, 1, 'Should update 1 recipe');

const updatedRecipes = getState().recipes;
const updatedRecipe = updatedRecipes.find(r => r.id === 'rec_sausage_bake');

console.log('  Old Recipe Macros:', beforeMacros);
console.log('  New Recalculated Macros:', updatedRecipe.macros);
console.log('  New Recalculated Fit Score:', updatedRecipe.fitScore);

assert(updatedRecipe.macros.calories < beforeMacros.calories, 'Recipe calories must be updated from optimal default product');
assert(updatedRecipe.enhanced.macros.protein > 0, 'Enhanced variant macros must also be recalculated');
assert(typeof updatedRecipe.fitScore === 'number' && updatedRecipe.fitScore >= 0, 'Fit score must be recalculated');
console.log('✅ Test 5 Passed: recalculateAllRecipeMacros cleanly recalculates original and enhanced recipe macros from optimal defaults.\n');

console.log('=== ALL AUTO-DEFAULT AND RECIPE RECALCULATION TESTS PASSED SUCCESSFULLY! ===');
