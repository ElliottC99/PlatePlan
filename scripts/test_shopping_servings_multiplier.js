/**
 * scripts/test_shopping_servings_multiplier.js
 * Verification of dynamic recipe yield and serving scaling in ShoppingCalculationService.
 */

import assert from 'node:assert';
import { aggregateShoppingListFromPlan } from '../src/services/ShoppingCalculationService.js';

console.log('=== RUNNING SHOPPING LIST SERVINGS MULTIPLIER TEST SUITE ===\n');

// 1. Mock Vault Recipes
const vaultRecipes = [
  {
    id: 'rec_harissa_chicken',
    title: 'Harissa Chicken & Grain Salad',
    serves: 4,
    ingredients: [
      { name: 'Red Peppers', qty: 3, unit: 'qty' },
      { name: 'Chicken Breast', qty: 500, unit: 'g' }
    ]
  },
  {
    id: 'rec_cheesy_macaroni',
    title: 'Cheesy Chilli Macaroni',
    serves: 2,
    ingredients: [
      { name: 'Red Peppers', qty: 1, unit: 'qty' },
      { name: 'Macaroni', qty: 200, unit: 'g' }
    ]
  },
  {
    id: 'rec_protein_shake',
    title: 'Morning Protein Shake',
    serves: 1,
    ingredients: [
      { name: 'Banana', qty: 1, unit: 'qty' },
      { name: 'Protein Powder', qty: 30, unit: 'g' }
    ]
  },
  {
    id: 'rec_batch_chilli',
    title: 'Big Batch Chilli',
    serves: 6,
    ingredients: [
      { name: 'Minced Beef', qty: 600, unit: 'g' }
    ]
  }
];

const ingredientsBank = [
  { id: 'ing_peppers', name: 'Red Peppers', category: 'Produce', defaultProductId: 'prod_peppers' },
  { id: 'ing_chicken', name: 'Chicken Breast', category: 'Meat & Poultry', defaultProductId: 'prod_chicken' },
  { id: 'ing_macaroni', name: 'Macaroni', category: 'Pantry', defaultProductId: 'prod_macaroni' },
  { id: 'ing_banana', name: 'Banana', category: 'Produce', defaultProductId: 'prod_banana' },
  { id: 'ing_beef', name: 'Minced Beef', category: 'Meat & Poultry', defaultProductId: 'prod_beef' }
];

const productsBank = [
  { id: 'prod_peppers', name: 'Red Peppers Each', brand: 'Tesco', price: 0.70, packSize: 1, packUnit: 'qty', isAutoDefault: true },
  { id: 'prod_chicken', name: 'Chicken Breast 500g', brand: 'Tesco', price: 3.50, packSize: 500, packUnit: 'g', isAutoDefault: true },
  { id: 'prod_macaroni', name: 'Macaroni 500g', brand: 'Tesco', price: 1.20, packSize: 500, packUnit: 'g', isAutoDefault: true },
  { id: 'prod_banana', name: 'Banana Each', brand: 'Tesco', price: 0.18, packSize: 1, packUnit: 'qty', isAutoDefault: true },
  { id: 'prod_beef', name: 'Beef Mince 500g', brand: 'Tesco', price: 3.00, packSize: 500, packUnit: 'g', isAutoDefault: true }
];

// --- TEST CASE 1: 4-Serving Recipe across 2 people x 2 days (User's Exact Scenario) ---
console.log('--- Test 1: Harissa Chicken (serves 4, 3 peppers) for 2 people x 2 days ---');
const planHarissa = {
  slots: {
    d1: {
      lunchE: { recipeId: 'rec_harissa_chicken' },
      lunchC: { recipeId: 'rec_harissa_chicken' }
    },
    d2: {
      lunchE: { recipeId: 'rec_harissa_chicken' },
      lunchC: { recipeId: 'rec_harissa_chicken' }
    }
  },
  prepGroups: [
    { recipeId: 'rec_harissa_chicken', days: [1, 2], id: 'prep_harissa' }
  ]
};

const result1 = aggregateShoppingListFromPlan(planHarissa, vaultRecipes, ingredientsBank, productsBank);
const pepperItem1 = result1.items.find(i => i.name.includes('Red Pepper') || i.name === 'Red Peppers Each');
assert(pepperItem1, 'Red Peppers item must be present in shopping list');
console.log(`  Calculated buyQty for Harissa Chicken: ${pepperItem1.buyQty} (expected: 3)`);
assert.strictEqual(pepperItem1.buyQty, 3, '4 planned servings of a 4-serving recipe calling for 3 peppers must yield exactly 3 peppers (not 6)');
assert.strictEqual(pepperItem1.recipeSummary[0].totalQty, 3, 'Recipe usage breakdown must show 3qty');
console.log('✅ Test 1 Passed: Harissa Chicken yields exactly 3 Red Peppers for 4 person-portions.\n');

// --- TEST CASE 2: Combined Plan with Harissa Chicken & Cheesy Chilli Macaroni ---
console.log('--- Test 2: Combined Plan (Harissa Chicken + Cheesy Chilli Macaroni) ---');
const combinedPlan = {
  slots: {
    d1: {
      lunchE: { recipeId: 'rec_harissa_chicken' },
      lunchC: { recipeId: 'rec_harissa_chicken' },
      dinnerE: { recipeId: 'rec_cheesy_macaroni' },
      dinnerC: { recipeId: 'rec_cheesy_macaroni' }
    },
    d2: {
      lunchE: { recipeId: 'rec_harissa_chicken' },
      lunchC: { recipeId: 'rec_harissa_chicken' }
    }
  },
  prepGroups: [
    { recipeId: 'rec_harissa_chicken', days: [1, 2], id: 'prep_harissa' }
  ]
};

const result2 = aggregateShoppingListFromPlan(combinedPlan, vaultRecipes, ingredientsBank, productsBank);
const pepperItem2 = result2.items.find(i => i.name.includes('Red Pepper') || i.name === 'Red Peppers Each');
console.log(`  Combined Red Peppers total buyQty: ${pepperItem2.buyQty} (expected: 4)`);
assert.strictEqual(pepperItem2.buyQty, 4, 'Total peppers must be 4 (3 from Harissa + 1 from Macaroni)');

const harissaSummary = pepperItem2.recipeSummary.find(r => r.recipeName.includes('Harissa Chicken'));
const macaroniSummary = pepperItem2.recipeSummary.find(r => r.recipeName.includes('Cheesy Chilli Macaroni'));
assert.strictEqual(harissaSummary.totalQty, 3, 'Harissa Chicken breakdown must be 3qty');
assert.strictEqual(macaroniSummary.totalQty, 1, 'Cheesy Chilli Macaroni breakdown must be 1qty');
console.log('✅ Test 2 Passed: Combined plan accurately yields 4 Red Peppers (3 Harissa + 1 Macaroni).\n');

// --- TEST CASE 3: 1-Serving Recipe for 1 Person ---
console.log('--- Test 3: 1-Serving Recipe (Smoothie, serves 1, 1 banana) ---');
const planSingle = {
  slots: {
    d1: {
      breakfastE: { recipeId: 'rec_protein_shake' }
    }
  }
};

const result3 = aggregateShoppingListFromPlan(planSingle, vaultRecipes, ingredientsBank, productsBank);
const bananaItem = result3.items.find(i => i.name.includes('Banana'));
console.log(`  Banana buyQty for 1 person: ${bananaItem.buyQty} (expected: 1)`);
assert.strictEqual(bananaItem.buyQty, 1, '1-serving recipe for 1 person must buy 1 banana, not 0.5');
console.log('✅ Test 3 Passed: 1-serving recipes do not get halved.\n');

// --- TEST CASE 4: 6-Serving Batch Recipe for 4 person-slots ---
console.log('--- Test 4: 6-Serving Batch Recipe (Chilli, 600g beef) for 4 person-slots ---');
const planBatch = {
  slots: {
    d1: {
      dinnerE: { recipeId: 'rec_batch_chilli' },
      dinnerC: { recipeId: 'rec_batch_chilli' }
    },
    d2: {
      dinnerE: { recipeId: 'rec_batch_chilli' },
      dinnerC: { recipeId: 'rec_batch_chilli' }
    }
  }
};

const result4 = aggregateShoppingListFromPlan(planBatch, vaultRecipes, ingredientsBank, productsBank);
const beefItem = result4.items.find(i => i.name.includes('Beef') || i.name.includes('Mince'));
console.log(`  Mince buyQty for 4 servings out of 6: ${beefItem.buyQty}g (expected: 400g)`);
assert.strictEqual(beefItem.buyQty, 400, '4 portions of a 6-serving recipe calling for 600g must buy 400g');
console.log('✅ Test 4 Passed: 6-serving batch recipe scaled accurately to 400g.\n');

// --- TEST CASE 5: Split Slot Node Support ---
console.log('--- Test 5: Split Slot Node Support (isSplit: true) ---');
const planSplit = {
  slots: {
    d1: {
      lunch: {
        isSplit: true,
        elliott: { recipeId: 'rec_harissa_chicken' },
        chloe: { recipeId: 'rec_protein_shake' }
      }
    }
  }
};

const result5 = aggregateShoppingListFromPlan(planSplit, vaultRecipes, ingredientsBank, productsBank);
const pepperSplit = result5.items.find(i => i.name.includes('Red Pepper') || i.name === 'Red Peppers Each');
const bananaSplit = result5.items.find(i => i.name.includes('Banana'));
console.log(`  Pepper for 1 portion of Harissa Chicken in split slot: ${pepperSplit.buyQty} (expected: 0.8)`);
console.log(`  Banana for 1 portion of Shake in split slot: ${bananaSplit.buyQty} (expected: 1)`);
assert.strictEqual(pepperSplit.buyQty, 0.8, '1 portion of 4-serving recipe calling for 3 peppers is 0.75 -> rounded to 0.8');
assert.strictEqual(bananaSplit.buyQty, 1, '1 portion of 1-serving recipe calling for 1 banana is 1.0');
console.log('✅ Test 5 Passed: Split slot nodes calculate independent per-person servings accurately.\n');

console.log('=== ALL SHOPPING LIST SERVINGS MULTIPLIER TESTS PASSED SUCCESSFULLY! ===');
