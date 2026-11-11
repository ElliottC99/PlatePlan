/**
 * scripts/test_recipe_taxonomy_elevation.js
 * Comprehensive automated verification test suite for Retrospective Taxonomy Elevation:
 * 1. Category and Root Item Auto-default resolution (explicit vs strategy-ranked).
 * 2. Candidate Partitioning: Category candidates isolated from Root candidates.
 * 3. Batch Root Item elevation: complete pointer stripping (subtypeId + productId) & macro recalculation.
 * 4. Category candidate interactive actions (Category, Root, Keep sub-type).
 * 5. Multi-variant (original + enhanced) synchronized recalculation.
 */

import assert from 'node:assert';
import {
  resolveEffectiveDefaultProduct,
  resolveCategoryDefaultProduct,
  scanRecipeTaxonomyElevations,
  recalculateRecipeNutritionAndFit,
  applyRootElevationsToRecipe,
  applyCategoryElevationToRecipe,
  commitRecipeElevations
} from '../src/services/RecipeTaxonomyElevationService.js';
import { getState, setRecipes, setIngredients, setProducts } from '../src/store/store.js';

console.log('=== RUNNING RETROSPECTIVE TAXONOMY ELEVATION TEST SUITE ===\n');

// Mock window & globals for standalone Node environment
if (typeof window === 'undefined') {
  global.window = {
    Store: { getState, setState: () => {} },
    getState,
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } }
  };
}

// -------------------------------------------------------------
// Test Fixtures
// -------------------------------------------------------------
const mockIngredients = [
  {
    id: 'ing_maple',
    name: 'Maple Syrup',
    category: 'Syrups & Sweeteners',
    defaultProductId: 'prod_standard_maple',
    subtypes: [
      { id: 'sub_standard_maple', name: 'Standard Maple Syrup', defaultProductId: 'prod_standard_maple' },
      { id: 'sub_zero_cal_maple', name: 'Zero Calorie Maple Syrup', defaultProductId: 'prod_zero_cal_maple' }
    ]
  },
  {
    id: 'ing_honey',
    name: 'Honey',
    category: 'Syrups & Sweeteners',
    subtypes: [
      { id: 'sub_raw_honey', name: 'Raw Honey', defaultProductId: 'prod_raw_honey' }
    ]
  },
  {
    id: 'ing_cheddar',
    name: 'Cheddar Cheese',
    category: 'Dairy & Cheese',
    subtypes: [
      { id: 'sub_mature_cheddar', name: 'Mature Cheddar' },
      { id: 'sub_light_cheddar', name: 'Light Cheddar' }
    ]
  },
  {
    id: 'ing_cottage_cheese',
    name: 'Cottage Cheese',
    category: 'Dairy & Cheese',
    defaultProductId: 'prod_cottage_cheese',
    subtypes: [
      { id: 'sub_fat_free_cottage', name: 'Fat Free Cottage Cheese', defaultProductId: 'prod_cottage_cheese' }
    ]
  }
];

const mockProducts = [
  {
    id: 'prod_standard_maple',
    name: 'Clarks Maple Syrup',
    ingredientId: 'ing_maple',
    subtypeId: 'sub_standard_maple',
    packUnit: 'ml',
    kcal: 260,
    prot: 0,
    isAutoDefault: false
  },
  {
    id: 'prod_zero_cal_maple',
    name: 'The Skinny Co Zero Calorie Maple Syrup',
    ingredientId: 'ing_maple',
    subtypeId: 'sub_zero_cal_maple',
    packUnit: 'ml',
    kcal: 5,
    prot: 0,
    isAutoDefault: true // Explicitly flagged as auto-default for category
  },
  {
    id: 'prod_raw_honey',
    name: 'Rowse Raw Honey',
    ingredientId: 'ing_honey',
    subtypeId: 'sub_raw_honey',
    packUnit: 'g',
    kcal: 330,
    prot: 0.3
  },
  {
    id: 'prod_mature_cheddar',
    name: 'Cathedral City Mature Cheddar',
    ingredientId: 'ing_cheddar',
    subtypeId: 'sub_mature_cheddar',
    packUnit: 'g',
    kcal: 416,
    prot: 25.4,
    isAutoDefault: false
  },
  {
    id: 'prod_light_cheddar',
    name: 'Eatlean Protein Cheese',
    ingredientId: 'ing_cheddar',
    subtypeId: 'sub_light_cheddar',
    packUnit: 'g',
    kcal: 169,
    prot: 37.0
  },
  {
    id: 'prod_cottage_cheese',
    name: 'Arla Protein Cottage Cheese',
    ingredientId: 'ing_cottage_cheese',
    subtypeId: 'sub_fat_free_cottage',
    packUnit: 'g',
    kcal: 75,
    prot: 12.0,
    isAutoDefault: true // Explicit auto-default for Dairy & Cheese category
  }
];

setIngredients(mockIngredients);
setProducts(mockProducts);

// --- TEST 1: Auto-default resolution (Explicit vs Strategy-ranked) ---
console.log('--- Test 1: Auto-Default Product Resolution ---');
{
  // 1a. Explicit defaultProductId on entity
  const defMaple = resolveEffectiveDefaultProduct(mockIngredients[0], mockProducts);
  assert.strictEqual(defMaple.product.id, 'prod_standard_maple', 'Explicit defaultProductId must take precedence');
  assert.strictEqual(defMaple.matchType, 'explicit_default');

  // 1b. Strategy rank on Cheddar (Eatlean cheese has highest protein per kcal)
  const defCheddar = resolveEffectiveDefaultProduct(mockIngredients[2], mockProducts, 'highest_protein_per_kcal');
  assert.strictEqual(defCheddar.product.id, 'prod_light_cheddar', 'Strategy ranking should pick highest protein per kcal');
  assert.strictEqual(defCheddar.matchType, 'strategy_rank');

  // 1c. Category Auto-default (Zero Calorie Maple has isAutoDefault: true)
  const defCat = resolveCategoryDefaultProduct('Syrups & Sweeteners', mockIngredients, mockProducts);
  assert.strictEqual(defCat.product.id, 'prod_zero_cal_maple');
  assert.strictEqual(defCat.matchType, 'explicit_default');

  console.log('✅ Test 1 Passed: Root and Category auto-defaults correctly resolved.\n');
}

// --- TEST 2: Candidate Partitioning (Category Candidates Excluded from Root Elevations) ---
console.log('--- Test 2: Candidate Partitioning ---');
{
  const mockRecipes = [
    {
      id: 'rec_pancakes',
      title: 'Fluffy Pancakes',
      servings: 2,
      ingredients: [
        // This ingredient matches the Category auto-default ('prod_zero_cal_maple' under 'sub_zero_cal_maple')
        { name: 'Maple Syrup', qty: 30, unit: 'ml', ingredientId: 'ing_maple', subtypeId: 'sub_zero_cal_maple', productId: 'prod_zero_cal_maple' },
        // This ingredient matches only the Root Item strategy default ('prod_light_cheddar' under 'sub_light_cheddar')
        { name: 'Cheddar', qty: 40, unit: 'g', ingredientId: 'ing_cheddar', subtypeId: 'sub_light_cheddar', productId: 'prod_light_cheddar' }
      ]
    }
  ];

  const scan = scanRecipeTaxonomyElevations(mockRecipes, mockIngredients, mockProducts);

  assert.strictEqual(scan.categoryCandidates.length, 1, 'Should find exactly 1 Category Candidate');
  assert.strictEqual(scan.categoryCandidates[0].recipeId, 'rec_pancakes');
  assert.strictEqual(scan.categoryCandidates[0].currentSubtypeId, 'sub_zero_cal_maple');
  assert.strictEqual(scan.categoryCandidates[0].category, 'Syrups & Sweeteners');

  assert.strictEqual(scan.rootElevations.length, 1, 'Should find exactly 1 Root Item Candidate');
  assert.strictEqual(scan.rootElevations[0].currentSubtypeId, 'sub_light_cheddar');

  // CRITICAL INVARIANT: The category candidate MUST NOT be in rootElevations!
  const hasCategoryInRoot = scan.rootElevations.some(e => e.currentSubtypeId === 'sub_zero_cal_maple');
  assert.strictEqual(hasCategoryInRoot, false, 'Candidate Partitioning: Category candidates must be strictly excluded from rootElevations');

  console.log('✅ Test 2 Passed: Category candidates are cleanly partitioned from Root Item candidates.\n');
}

// --- TEST 3: Batch Root Item Elevation & Pointer Stripping ---
console.log('--- Test 3: Batch Root Item Elevation & Nutrition Recalculation ---');
{
  const testRecipe = {
    id: 'rec_toast',
    title: 'Cheese on Toast',
    servings: 1,
    calories: 200,
    protein: 10,
    ingredients: [
      { name: 'Cheddar', qty: 50, unit: 'g', ingredientId: 'ing_cheddar', subtypeId: 'sub_light_cheddar', productId: 'prod_light_cheddar' }
    ],
    ingredientSections: [
      {
        sectionTitle: 'Topping',
        ingredients: [
          { name: 'Cheddar', qty: 50, unit: 'g', ingredientId: 'ing_cheddar', subtypeId: 'sub_light_cheddar', productId: 'prod_light_cheddar' }
        ]
      }
    ]
  };

  const keyToElevate = 'rec_toast:original:0:0';
  const elevated = applyRootElevationsToRecipe(testRecipe, [keyToElevate], {
    products: mockProducts,
    ingredients: mockIngredients
  });

  const elevatedItem = elevated.ingredients[0];
  const sectionItem = elevated.ingredientSections[0].ingredients[0];

  assert.strictEqual(elevatedItem.subtypeId, undefined, 'subtypeId must be stripped');
  assert.strictEqual(elevatedItem.productId, undefined, 'productId must be stripped');
  assert.strictEqual(elevatedItem.ingredientId, 'ing_cheddar', 'ingredientId must be preserved');

  assert.strictEqual(sectionItem.subtypeId, undefined, 'Section ingredient subtypeId must be stripped');
  assert.strictEqual(sectionItem.productId, undefined, 'Section ingredient productId must be stripped');
  assert.strictEqual(sectionItem.ingredientId, 'ing_cheddar', 'Section ingredient ingredientId must be preserved');

  // Check nutrition recalculation
  assert(typeof elevated.calories === 'number' && elevated.calories > 0, 'Calories must be recalculated');
  assert(typeof elevated.protein === 'number' && elevated.protein > 0, 'Protein must be recalculated');
  assert(typeof elevated.fitScore === 'number' && elevated.fitScore >= 0, 'Fit score must be recalculated');

  console.log('✅ Test 3 Passed: Root Item elevation strips pointers and recalculates nutrition.\n');
}

// --- TEST 4: Category Interactive Decision Actions ---
console.log('--- Test 4: Category Interactive Actions (Category, Root, Keep Sub-type) ---');
{
  const baseRecipe = {
    id: 'rec_porridge',
    title: 'Morning Porridge',
    servings: 1,
    ingredients: [
      { name: 'Maple Syrup', qty: 20, unit: 'ml', ingredientId: 'ing_maple', subtypeId: 'sub_zero_cal_maple', productId: 'prod_zero_cal_maple' }
    ]
  };

  // Action 1: Elevate to Category
  const catElevated = applyCategoryElevationToRecipe(baseRecipe, {
    action: 'category',
    targetCategory: 'Syrups & Sweeteners',
    rootId: 'ing_maple',
    ingredientIndex: 0
  }, { products: mockProducts, ingredients: mockIngredients });

  assert.strictEqual(catElevated.ingredients[0].category, 'Syrups & Sweeteners');
  assert.strictEqual(catElevated.ingredients[0].categoryId, 'Syrups & Sweeteners');
  assert.strictEqual(catElevated.ingredients[0].ingredientId, undefined, 'ingredientId stripped on category promotion');
  assert.strictEqual(catElevated.ingredients[0].subtypeId, undefined, 'subtypeId stripped on category promotion');
  assert.strictEqual(catElevated.ingredients[0].productId, undefined, 'productId stripped on category promotion');

  // Action 2: Elevate to Root Item
  const rootElevated = applyCategoryElevationToRecipe(baseRecipe, {
    action: 'root',
    targetCategory: 'Syrups & Sweeteners',
    rootId: 'ing_maple',
    ingredientIndex: 0
  }, { products: mockProducts, ingredients: mockIngredients });

  assert.strictEqual(rootElevated.ingredients[0].ingredientId, 'ing_maple', 'ingredientId set to rootId');
  assert.strictEqual(rootElevated.ingredients[0].subtypeId, undefined, 'subtypeId stripped on root elevation');

  // Action 3: Keep Sub-type (No-op)
  const kept = applyCategoryElevationToRecipe(baseRecipe, {
    action: 'subtype',
    targetCategory: 'Syrups & Sweeteners',
    rootId: 'ing_maple',
    ingredientIndex: 0
  });

  assert.strictEqual(kept.ingredients[0].subtypeId, 'sub_zero_cal_maple', 'Keep sub-type preserves exact mapping');

  console.log('✅ Test 4 Passed: Category interactive actions work as specified.\n');
}

// --- TEST 5: Multi-Variant (Original + Enhanced) Synchronized Recalculation ---
console.log('--- Test 5: Multi-Variant Recalculation ---');
{
  const recipeWithEnhanced = {
    id: 'rec_multi',
    title: 'Protein Pancakes',
    servings: 2,
    ingredients: [
      { name: 'Maple Syrup', qty: 30, unit: 'ml', ingredientId: 'ing_maple', subtypeId: 'sub_zero_cal_maple' }
    ],
    enhanced: {
      servings: 2,
      ingredients: [
        { name: 'Maple Syrup', qty: 30, unit: 'ml', ingredientId: 'ing_maple', subtypeId: 'sub_zero_cal_maple' }
      ]
    }
  };

  const elevated = applyRootElevationsToRecipe(recipeWithEnhanced, [
    'rec_multi:original:0:0',
    'rec_multi:enhanced:0:0'
  ], { products: mockProducts, ingredients: mockIngredients });

  assert.strictEqual(elevated.ingredients[0].subtypeId, undefined);
  assert.strictEqual(elevated.enhanced.ingredients[0].subtypeId, undefined);
  assert(typeof elevated.enhanced.fitScore === 'number', 'Enhanced fit score recalculated');
  assert(typeof elevated.enhancedFitScore === 'number', 'enhancedFitScore recalculated');

  console.log('✅ Test 5 Passed: Original and enhanced variants synchronized cleanly.\n');
}

// --- TEST 6: Commit Service & Store State Synchronization ---
console.log('--- Test 6: Commit Service ---');
{
  const fakeRecipe = { id: 'rec_commit_test', title: 'Commit Test', calories: 250, protein: 15 };
  setRecipes([fakeRecipe]);

  const commitRes = await commitRecipeElevations([{ ...fakeRecipe, calories: 260 }]);
  assert.strictEqual(commitRes.success, true);
  assert.strictEqual(getState().recipes[0].calories, 260, 'Store state must reflect committed recipe');

  console.log('✅ Test 6 Passed: Commit service synchronized Store state.\n');
}

// --- TEST 7: Batch Apply Multi-Recipe Candidates for Matching Root Item ---
console.log('--- Test 7: Batch Apply Multi-Recipe Matching Candidates ---');
{
  const recipeA = {
    id: 'rec_batch_a',
    title: 'Batch Pancakes',
    servings: 2,
    ingredients: [
      { name: 'Maple Syrup', qty: 30, unit: 'ml', ingredientId: 'ing_maple', subtypeId: 'sub_zero_cal_maple', productId: 'prod_zero_cal_maple' }
    ]
  };
  const recipeB = {
    id: 'rec_batch_b',
    title: 'Batch Waffles',
    servings: 2,
    ingredients: [
      { name: 'Maple Syrup', qty: 25, unit: 'ml', ingredientId: 'ing_maple', subtypeId: 'sub_zero_cal_maple', productId: 'prod_zero_cal_maple' }
    ]
  };

  const scan = scanRecipeTaxonomyElevations([recipeA, recipeB], mockIngredients, mockProducts);
  assert.strictEqual(scan.categoryCandidates.length, 2, 'Both recipes should produce category candidates');

  // Verify grouping and batch elevation to Category
  const matchingTargets = scan.categoryCandidates.filter(c => String(c.rootId) === 'ing_maple');
  assert.strictEqual(matchingTargets.length, 2, 'Both candidates match ing_maple root item');

  const modified = [];
  const recipesMap = new Map([['rec_batch_a', recipeA], ['rec_batch_b', recipeB]]);

  matchingTargets.forEach(t => {
    const r = recipesMap.get(t.recipeId);
    const updated = applyCategoryElevationToRecipe(r, {
      action: 'category',
      variant: t.variant,
      sectionIndex: t.sectionIndex,
      ingredientIndex: t.ingredientIndex,
      targetCategory: t.category,
      rootId: t.rootId
    }, { products: mockProducts, ingredients: mockIngredients });
    recipesMap.set(t.recipeId, updated);
  });

  const finalA = recipesMap.get('rec_batch_a');
  const finalB = recipesMap.get('rec_batch_b');

  assert.strictEqual(finalA.ingredients[0].category, 'Syrups & Sweeteners');
  assert.strictEqual(finalA.ingredients[0].subtypeId, undefined);
  assert.strictEqual(finalB.ingredients[0].category, 'Syrups & Sweeteners');
  assert.strictEqual(finalB.ingredients[0].subtypeId, undefined);

  // Commit batch
  const commitRes = await commitRecipeElevations([finalA, finalB]);
  assert.strictEqual(commitRes.success, true);
  assert.strictEqual(commitRes.count, 2);

  console.log('✅ Test 7 Passed: Multi-recipe matching candidates elevated in batch successfully.\n');
}

console.log('🎉 ALL RETROSPECTIVE TAXONOMY ELEVATION TESTS PASSED SUCCESSFULLY!\n');
