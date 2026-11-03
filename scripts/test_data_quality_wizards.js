/**
 * scripts/test_data_quality_wizards.js
 * Verification suite for:
 * 1. Liquid-Aware Density Filtering (silencing common kitchen liquids)
 * 2. Grouped Dry-Goods Density Mismatches per Ingredient
 * 3. Duplicate Ingredient Detection with Sorensen-Dice similarity
 * 4. Orphaned Product Detection
 * 5. Macro Drift Calculation & Auto-Recalibration
 * 6. UI Action Delegation Markup
 */

import assert from 'node:assert';

// Mock DOM & Storage globals
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}
global.localStorage = new MockLocalStorage();

global.window = {
  localStorage: global.localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
  dispatchEvent: () => true,
  document: {
    createElement: (tag) => ({ tagName: tag, style: {}, classList: { add: () => {}, remove: () => {} }, querySelector: () => null, querySelectorAll: () => [], appendChild: () => {} }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    dispatchEvent: () => true,
    body: { style: {}, appendChild: () => {} }
  }
};
global.document = global.window.document;

// Import target scanner & view modules
import { 
  runAudit, 
  scanDataQualitySummary, 
  getStringSimilarity, 
  autoRecalibrateRecipeDrift,
  calculateRecipeDynamicMacros 
} from '../src/services/DataQualityScanner.js';

import { isLiquidIngredient } from '../src/services/UnitConversionService.js';
import { renderAuditCard } from '../src/views/DataQualityTableRenderService.js';

console.log('=== RUNNING DATA QUALITY SCANNER & WIZARDS VERIFICATION SUITE ===\n');

// --- Test 1: Liquid-Aware Volume Density Filtering ---
console.log('--- Test 1: Liquid-Aware Volume Density Filtering ---');
{
  assert(isLiquidIngredient('Soy Sauce'), 'Soy Sauce must be recognized as liquid');
  assert(isLiquidIngredient('Toasted Sesame Oil'), 'Sesame Oil must be recognized as liquid');
  assert(isLiquidIngredient('Rice Wine Vinegar'), 'Vinegar must be recognized as liquid');
  assert(isLiquidIngredient('Whole Milk'), 'Milk must be recognized as liquid');
  assert(isLiquidIngredient('Chicken Broth'), 'Broth must be recognized as liquid');
  assert(!isLiquidIngredient('Plain Flour'), 'Plain Flour must NOT be recognized as liquid');
  assert(!isLiquidIngredient('Rolled Oats'), 'Rolled Oats must NOT be recognized as liquid');

  const mockIngredients = [
    { id: 'ing_oil', name: 'Sesame Oil', category: 'Store Cupboard' },
    { id: 'ing_vinegar', name: 'Rice Wine Vinegar', category: 'Store Cupboard' },
    { id: 'ing_sugar', name: 'Granulated Sugar', category: 'Baking' }, // Staple with known density in UnitConversionService
    { id: 'ing_couscous', name: 'Dried Couscous', category: 'Grains' } // Dry good without known density
  ];

  const mockProducts = [
    { id: 'p_oil', name: 'Toasted Sesame Oil', ingredientId: 'ing_oil', packUnit: 'ml', cal: 890, prot: 0 },
    { id: 'p_vinegar', name: 'Rice Wine Vinegar', ingredientId: 'ing_vinegar', packUnit: 'ml', cal: 20, prot: 0 },
    { id: 'p_sugar', name: 'Granulated Sugar', ingredientId: 'ing_sugar', packUnit: 'g', cal: 400, prot: 0 },
    { id: 'p_couscous', name: 'Dried Couscous', ingredientId: 'ing_couscous', packUnit: 'g', cal: 350, prot: 12 }
  ];

  const mockRecipes = [
    {
      id: 'r_stirfry_1',
      name: 'Stir Fry 1',
      ingredients: [
        { ingredientId: 'ing_oil', qty: 15, unit: 'ml' },
        { ingredientId: 'ing_vinegar', qty: 10, unit: 'ml' },
        { ingredientId: 'ing_sugar', qty: 2, unit: 'tbsp' }, // Known staple density
        { ingredientId: 'ing_couscous', qty: 1, unit: 'cup' } // Volume dry good
      ]
    },
    {
      id: 'r_stirfry_2',
      name: 'Stir Fry 2',
      ingredients: [
        { ingredientId: 'ing_oil', qty: 30, unit: 'ml' },
        { ingredientId: 'ing_couscous', qty: 2, unit: 'cup' } // Volume dry good in another recipe
      ]
    }
  ];

  const audit = runAudit({
    recipes: mockRecipes,
    ingredients: mockIngredients,
    products: mockProducts
  });

  // Verify that Sesame Oil and Vinegar produce ZERO density warnings
  const oilWarning = audit.densityMismatch.find(d => d.ingredientId === 'ing_oil');
  assert(!oilWarning, 'Recognized liquid "Sesame Oil" must NEVER produce a density warning');

  const vinegarWarning = audit.densityMismatch.find(d => d.ingredientId === 'ing_vinegar');
  assert(!vinegarWarning, 'Recognized liquid "Rice Wine Vinegar" must NEVER produce a density warning');

  // Verify that Sugar produces ZERO density warnings because it has known density (0.85) in UnitConversionService
  const sugarWarning = audit.densityMismatch.find(d => d.ingredientId === 'ing_sugar');
  assert(!sugarWarning, 'Staple "Granulated Sugar" with known density must NEVER produce a density warning');

  // Verify that Couscous produces EXACTLY 1 grouped warning across both recipes
  assert.strictEqual(audit.densityMismatch.length, 1, `Expected exactly 1 density mismatch for Couscous, got ${audit.densityMismatch.length}`);
  const couscousWarning = audit.densityMismatch[0];
  assert.strictEqual(couscousWarning.ingredientId, 'ing_couscous');
  assert.strictEqual(couscousWarning.recipes.length, 2, 'Couscous warning must group all 2 affected recipes');
  console.log('✅ Test 1 Passed: Recognized kitchen liquids and known staple densities silenced; dry goods grouped cleanly.');
}

// --- Test 2: Duplicate Ingredient Detection (Sorensen-Dice) ---
console.log('\n--- Test 2: Duplicate Ingredient Detection ---');
{
  const sim1 = getStringSimilarity('Medium Noodles', 'Medium Noodles 2');
  assert(sim1 >= 0.85, `Expected similarity >= 0.85 for Medium Noodles, got: ${sim1}`);

  const sim2 = getStringSimilarity('Sesame Oil', 'Beef Mince');
  assert(sim2 < 0.3, `Expected low similarity between Sesame Oil and Beef Mince, got: ${sim2}`);

  const mockIngredients = [
    { id: 'ing_noodles_1', name: 'Medium Noodles', category: 'Pasta & Noodles' },
    { id: 'ing_noodles_2', name: 'Medium Noodles 2', category: 'Pasta & Noodles' },
    { id: 'ing_tofu', name: 'Firm Tofu', category: 'Proteins' }
  ];

  const audit = runAudit({
    recipes: [],
    ingredients: mockIngredients,
    products: []
  });

  assert.strictEqual(audit.duplicates.length, 1, 'Must detect exactly 1 duplicate candidate pair');
  assert.strictEqual(audit.duplicates[0].ing1Id, 'ing_noodles_1');
  assert.strictEqual(audit.duplicates[0].ing2Id, 'ing_noodles_2');
  console.log('✅ Test 2 Passed: Duplicate candidates accurately identified above 85% threshold.');
}

// --- Test 3: Orphaned Grocery Product Detection ---
console.log('\n--- Test 3: Orphaned Grocery Product Detection ---');
{
  const mockIngredients = [
    {
      id: 'ing_wraps',
      name: 'Tortilla Wraps',
      subtypes: [{ id: 'sub_large', name: 'Large Wraps' }]
    }
  ];

  const mockProducts = [
    {
      id: 'p_wrap_valid',
      name: 'Large Plain Wraps',
      ingredientId: 'ing_wraps',
      subtypeId: 'sub_large'
    },
    {
      id: 'p_wrap_orphan_sub',
      name: 'Mini White Wraps',
      ingredientId: 'ing_wraps',
      subtypeId: 'sub_deleted_id' // Non-existent subtype
    },
    {
      id: 'p_orphan_no_ing',
      name: 'Mystery Product',
      ingredientId: 'ing_non_existent' // Non-existent parent ingredient
    }
  ];

  const audit = runAudit({
    recipes: [],
    ingredients: mockIngredients,
    products: mockProducts
  });

  assert.strictEqual(audit.orphans.length, 2, 'Must detect both orphaned products');
  assert(audit.orphans.some(o => o.productId === 'p_wrap_orphan_sub' && o.type === 'no-subtype'));
  assert(audit.orphans.some(o => o.productId === 'p_orphan_no_ing' && o.type === 'no-ingredient'));
  console.log('✅ Test 3 Passed: Orphaned products with missing parent ingredients or subtypes caught.');
}

// --- Test 4: Recipe Macro Drift Calculation & Auto-Recalibration ---
console.log('\n--- Test 4: Recipe Macro Drift Calculation & Auto-Recalibration ---');
{
  const mockIngredients = [
    { id: 'ing_tofu', name: 'Tofu', cal: 120, prot: 14 }
  ];
  const mockProducts = [
    { id: 'p_tofu', name: 'Firm Tofu', ingredientId: 'ing_tofu', isAutoDefault: true, cal: 120, prot: 14 }
  ];

  const driftedRecipe = {
    id: 'r_drifted',
    name: 'Drifted Tofu Dish',
    serves: 1,
    ingredients: [
      { ingredientId: 'ing_tofu', qty: 200, unit: 'g' } // 240 kcal, 28g protein
    ],
    macros: {
      calories: 500, // Stored macros far off from 240 kcal
      protein: 10,
      carbs: 0,
      fat: 0
    }
  };

  const audit = runAudit({
    recipes: [driftedRecipe],
    ingredients: mockIngredients,
    products: mockProducts
  });

  assert.strictEqual(audit.macroDrift.length, 1, 'Must detect recipe macro drift > 2%');
  assert.strictEqual(audit.macroDrift[0].recipeId, 'r_drifted');
  assert.strictEqual(audit.macroDrift[0].stored.cal, 500);
  assert.strictEqual(audit.macroDrift[0].calculated.cal, 240);

  // Test Auto-Recalibration for high calorie drift
  const recalResult = autoRecalibrateRecipeDrift(driftedRecipe, mockIngredients, mockProducts);
  assert(recalResult.updated, 'autoRecalibrateRecipeDrift must update drifted recipe');
  assert.strictEqual(driftedRecipe.macros.calories, 240, 'Recalibrated calories must equal calculated 240 kcal');
  assert.strictEqual(driftedRecipe.macros.protein, 28, 'Recalibrated protein must equal calculated 28g');

  // Test Auto-Recalibration when calories are identical (0% diff) but protein drifted
  const proteinDriftedRecipe = {
    id: 'r_prot_drift',
    name: 'Protein Drift Recipe',
    serves: 1,
    ingredients: [
      { ingredientId: 'ing_tofu', qty: 200, unit: 'g' } // 240 kcal, 28g protein
    ],
    macros: {
      calories: 240, // Exact same calories (0% diff)
      protein: 14,   // 14g vs 28g (100% diff)
      carbs: 0,
      fat: 0
    }
  };

  const auditProt = runAudit({
    recipes: [proteinDriftedRecipe],
    ingredients: mockIngredients,
    products: mockProducts
  });
  assert.strictEqual(auditProt.macroDrift.length, 1, 'Must detect macro drift even when calories match but protein drifted');
  assert(auditProt.macroDrift[0].message.includes('Protein:'), 'Audit message must clearly indicate protein drifted');

  const recalProt = autoRecalibrateRecipeDrift(proteinDriftedRecipe, mockIngredients, mockProducts);
  assert(recalProt.updated, 'autoRecalibrateRecipeDrift must update when protein drifted even if calories match');
  assert.strictEqual(proteinDriftedRecipe.macros.protein, 28, 'Protein must be updated to 28g');

  console.log('✅ Test 4 Passed: Macro drift detected and auto-recalibrated accurately across all macros.');
}

// --- Test 5: UI Card Markup with data-action-dq Attributes ---
console.log('\n--- Test 5: UI Card Markup & Action Delegation Attributes ---');
{
  const mockItems = [
    { ing1Id: 'ing_1', ing2Id: 'ing_2', ing1Name: 'Noodles', ing2Name: 'Noodles 2', message: '95% similarity' }
  ];

  const cardHtml = renderAuditCard('Duplicate Candidates', '👥', mockItems, (item) => `
    <button type="button" class="btn sm primary dq-action-btn" 
      data-action-dq="merge-duplicate" 
      data-ing1-id="${item.ing1Id}" 
      data-ing2-id="${item.ing2Id}">Review &amp; Merge</button>
  `);

  assert(cardHtml.includes('data-action-dq="merge-duplicate"'), 'Card HTML must include delegated action attribute');
  assert(cardHtml.includes('data-ing1-id="ing_1"'), 'Card HTML must carry ing1 ID');
  assert(cardHtml.includes('data-ing2-id="ing_2"'), 'Card HTML must carry ing2 ID');
  console.log('✅ Test 5 Passed: UI cards carry standardized delegated action attributes.');
}

console.log('\n=== ALL DATA QUALITY TESTS PASSED SUCCESSFULLY! ===');
