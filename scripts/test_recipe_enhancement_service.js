/**
 * scripts/test_recipe_enhancement_service.js
 * Verification suite for Automated Recipe Enhancement to 85+ Fit Score Engine.
 */

import assert from 'node:assert/strict';
import { 
  quantizeQuantity, 
  classifyIngredientRole, 
  resolveRecipeTargets, 
  generateEnhancementPlan 
} from '../src/services/RecipeEnhancementService.js';

console.log('=== RUNNING RECIPE ENHANCEMENT ENGINE VERIFICATION SUITE ===\n');

// --- Test 1: Culinary Quantization ---
console.log('--- Test 1: Culinary Quantization ---');
assert.equal(quantizeQuantity(137, 'g'), 140, '137g should round to 140g');
assert.equal(quantizeQuantity(23, 'g'), 25, '23g should round to 25g');
assert.equal(quantizeQuantity(1.34, 'tbsp'), 1.5, '1.34 tbsp should round to 1.5 tbsp');
assert.equal(quantizeQuantity(0.72, 'can'), 0.5, '0.72 can should round to 0.5 can');
assert.equal(quantizeQuantity(0.85, 'can'), 1.0, '0.85 can should round to 1.0 can');
assert.equal(quantizeQuantity(2.13, 'breast'), 2, '2.13 breasts should round to 2 breasts');
console.log('✅ Test 1 Passed: Culinary quantization produces natural kitchen increments.\n');

// --- Test 2: Role Classification ---
console.log('--- Test 2: Role Classification ---');
assert.equal(classifyIngredientRole({ name: 'Olive Oil' }), 'cooking_fat');
assert.equal(classifyIngredientRole({ name: 'Butter' }), 'cooking_fat');
assert.equal(classifyIngredientRole({ name: 'Chicken Breast' }), 'primary_protein');
assert.equal(classifyIngredientRole({ name: 'Organic Firm Tofu' }), 'primary_protein');
assert.equal(classifyIngredientRole({ name: 'Jasmine Rice' }), 'starch_carb');
assert.equal(classifyIngredientRole({ name: 'Penne Pasta' }), 'starch_carb');
assert.equal(classifyIngredientRole({ name: 'Coconut Milk' }), 'rich_dairy_fat');
assert.equal(classifyIngredientRole({ name: 'Bell Pepper' }), 'produce');
assert.equal(classifyIngredientRole({ name: 'Fresh Ginger' }), 'produce');
console.log('✅ Test 2 Passed: Role classification accurately categorizes ingredients.\n');

// --- Test 3: Audience and Meal Target Resolution ---
console.log('--- Test 3: Audience and Meal Target Resolution ---');
const optionsMock = {
  userPrefs: {
    profiles: {
      elliott: { dailyKcal: 2100, dailyProtein: 140 },
      chloe: { dailyKcal: 1650, dailyProtein: 105 }
    }
  }
};

const targetBoth = resolveRecipeTargets({ who: 'both', mealSuitability: ['dinner'] }, optionsMock);
assert.ok(targetBoth.targetKcal >= 630 && targetBoth.targetKcal <= 680, `Household dinner target kcal expected ~656, got ${targetBoth.targetKcal}`);
assert.ok(targetBoth.targetProt >= 40 && targetBoth.targetProt <= 46, `Household dinner target prot expected ~43, got ${targetBoth.targetProt}`);

const targetElliott = resolveRecipeTargets({ who: 'elliott', mealSuitability: ['dinner'] }, optionsMock);
assert.equal(targetElliott.targetKcal, 735, 'Elliott dinner kcal should be 735');
assert.equal(targetElliott.targetProt, 49, 'Elliott dinner prot should be 49');

const targetChloe = resolveRecipeTargets({ who: 'chloe', mealSuitability: ['dinner'] }, optionsMock);
assert.equal(targetChloe.targetKcal, 578, 'Chloe dinner kcal should be 578');
assert.equal(targetChloe.targetProt, 37, 'Chloe dinner prot should be 37');
console.log('✅ Test 3 Passed: Dynamic audience & meal targets accurately resolve.\n');

// --- Test 4: End-to-End Optimization to 85+ Fit Score ---
console.log('--- Test 4: End-to-End Optimization to 85+ Fit Score ---');

// Mock a high-calorie, low-protein curry (Serves 2)
// Total Kcal: 30ml oil (270) + 160g rice (576) + 200g chicken (260) + 200ml coconut milk (360) = 1466 kcal (733 kcal/serv)
// Prot: chicken (44g) + rice (12g) = 56g total (28g/serv). Below 43g target!
const sampleRecipe = {
  id: 'rec_thai_curry_123',
  name: 'Thai Red Chicken Curry',
  serves: 2,
  servings: 2,
  types: ['dinner'],
  mealSuitability: ['dinner'],
  who: 'both',
  cal: 733,
  prot: 28,
  perServing: { cal: 733, prot: 28 },
  ingredientSections: [
    {
      name: 'Curry Base',
      ingredients: [
        { name: 'Vegetable Oil', qty: 30, unit: 'ml' },
        { name: 'Chicken Breast', qty: 200, unit: 'g' },
        { name: 'Coconut Milk', qty: 200, unit: 'ml' }
      ]
    },
    {
      name: 'To Serve',
      ingredients: [
        { name: 'Jasmine Rice', qty: 160, unit: 'g' }
      ]
    }
  ],
  ingredients: [
    { name: 'Vegetable Oil', qty: 30, unit: 'ml' },
    { name: 'Chicken Breast', qty: 200, unit: 'g' },
    { name: 'Coconut Milk', qty: 200, unit: 'ml' },
    { name: 'Jasmine Rice', qty: 160, unit: 'g' }
  ],
  method: ['Heat oil.', 'Add chicken.', 'Pour coconut milk.', 'Serve with rice.']
};

const mockProducts = [
  { id: 'p_oil', name: 'Vegetable Oil', cal: 900, prot: 0, carb: 0, fat: 100 },
  { id: 'p_chicken', name: 'Chicken Breast Fillets', cal: 130, prot: 24, carb: 0, fat: 2.5 },
  { id: 'p_coconut', name: 'Coconut Milk', cal: 180, prot: 1.5, carb: 2.5, fat: 18 },
  { id: 'p_rice', name: 'Jasmine Rice', cal: 360, prot: 7.5, carb: 78, fat: 1 }
];

const mockIngredients = [
  { id: 'ing_oil', name: 'Vegetable Oil', defaultProductId: 'p_oil' },
  { id: 'ing_chicken', name: 'Chicken Breast', defaultProductId: 'p_chicken' },
  { id: 'ing_coconut', name: 'Coconut Milk', defaultProductId: 'p_coconut' },
  { id: 'ing_rice', name: 'Jasmine Rice', defaultProductId: 'p_rice' }
];

const plan = generateEnhancementPlan(sampleRecipe, {
  products: mockProducts,
  ingredients: mockIngredients,
  ...optionsMock
});

console.log(`Initial Fit Score: ${plan.beforeScore}%`);
console.log(`Predicted Fit Score: ${plan.predictedScore}%`);
console.log('Adjustments generated:');
plan.adjustments.forEach(a => console.log(` - ${a.label}`));

assert.ok(plan.predictedScore >= 85, `Predicted Fit Score must be >= 85%, got ${plan.predictedScore}%`);
assert.ok(plan.adjustments.length > 0, 'Must produce at least one adjustment');

// Verify section preservation
const enh = plan.enhancedRecipePayload;
assert.ok(Array.isArray(enh.ingredientSections) && enh.ingredientSections.length === 2, 'Must preserve 2 ingredient sections');
assert.equal(enh.ingredientSections[0].name, 'Curry Base');
assert.equal(enh.ingredientSections[1].name, 'To Serve');

// Verify original recipe immutability
assert.equal(sampleRecipe.serves, 2);
assert.equal(sampleRecipe.ingredientSections[0].ingredients[0].qty, 30, 'Original recipe oil qty must remain 30ml');
assert.equal(sampleRecipe.ingredientSections[0].ingredients[1].qty, 200, 'Original chicken qty must remain 200g');
console.log('✅ Test 4 Passed: Optimization hits >= 85% fit score while strictly preserving sections and original immutability.\n');

// --- Test 5: Discrete Units (Burgers / Patties) ---
console.log('--- Test 5: Discrete Units (Burgers / Patties) ---');
const burgerRecipe = {
  id: 'burger_test_1',
  name: 'Smashed Brooklyn Burgers',
  serves: 2,
  servings: 2,
  types: ['dinner'],
  who: 'both',
  cal: 650,
  prot: 26,
  perServing: { cal: 650, prot: 26 },
  ingredients: [
    { id: 'i1', name: 'Beef Burgers (Smashed Burgers)', qty: 2, unit: 'qty', ingredientId: 'ing_burger' },
    { id: 'i2', name: 'Brioche Burger Buns', qty: 2, unit: 'qty', ingredientId: 'ing_bun' },
    { id: 'i3', name: 'Cheddar Cheese Slices', qty: 2, unit: 'slice', ingredientId: 'ing_cheese' }
  ]
};

const burgerProducts = [
  { id: 'p_burger', ingredientId: 'ing_burger', name: 'Beef Burgers', cal: 240, prot: 17, carb: 0, fat: 18, packSize: 454 },
  { id: 'p_bun', ingredientId: 'ing_bun', name: 'Brioche Buns', cal: 280, prot: 8, carb: 48, fat: 5, packSize: 200 },
  { id: 'p_cheese', ingredientId: 'ing_cheese', name: 'Cheddar Cheese Slices', cal: 400, prot: 25, carb: 0, fat: 34, packSize: 200 }
];

const burgerIngredients = [
  { id: 'ing_burger', name: 'Beef Burgers', defaultProductId: 'p_burger' },
  { id: 'ing_bun', name: 'Brioche Buns', defaultProductId: 'p_bun' },
  { id: 'ing_cheese', name: 'Cheddar Cheese Slices', defaultProductId: 'p_cheese' }
];

const burgerPlan = generateEnhancementPlan(burgerRecipe, {
  products: burgerProducts,
  ingredients: burgerIngredients,
  ...optionsMock
});

console.log(`Burger Initial Score: ${burgerPlan.beforeScore}%`);
console.log(`Burger Predicted Score: ${burgerPlan.predictedScore}%`);
burgerPlan.adjustments.forEach(a => console.log(` - ${a.label}`));

const protAdj = burgerPlan.adjustments.find(a => a.type === 'quantity' && a.ingredientName.includes('Beef Burgers'));
assert.ok(protAdj, 'Should have protein adjustment for beef burgers');
assert.ok(protAdj.proposedQty <= 4, `Discrete count should scale sanely (<= 4), got ${protAdj.proposedQty}`);
assert.ok(protAdj.proposedQty > 2, `Discrete count should increase from 2, got ${protAdj.proposedQty}`);
assert.ok(protAdj.deltaProt > 0, `Protein delta must be positive, got ${protAdj.deltaProt}`);
assert.ok(burgerPlan.predictedScore >= 85, `Burger predicted score must reach >= 85%, got ${burgerPlan.predictedScore}%`);
console.log('✅ Test 5 Passed: Discrete units scale sanely by item count without gram-inflation.\n');

// --- Test 6: Pantry Bank (Category / Root Item / Subtype) & Linked Product Tracking ---
console.log('--- Test 6: Pantry Bank & Linked Product Pre/Post Swap Tracking ---');
const swapAdj = burgerPlan.adjustments.find(a => a.type === 'swap');
assert.ok(swapAdj, 'Should have at least one swap adjustment');
assert.ok(swapAdj.preTaxonomy, 'Swap adjustment must include preTaxonomy');
assert.ok(swapAdj.postTaxonomy, 'Swap adjustment must include postTaxonomy');

console.log('Pre-Swap Taxonomy:', swapAdj.preTaxonomy);
console.log('Post-Swap Taxonomy:', swapAdj.postTaxonomy);

assert.ok(swapAdj.preTaxonomy.category, 'Pre-swap must have category');
assert.ok(swapAdj.preTaxonomy.rootItem, 'Pre-swap must have rootItem');
assert.ok(swapAdj.preTaxonomy.subtype, 'Pre-swap must have subtype');
assert.ok(swapAdj.preTaxonomy.productName, 'Pre-swap must have linked product name');

assert.ok(swapAdj.postTaxonomy.category, 'Post-swap must have category');
assert.ok(swapAdj.postTaxonomy.rootItem, 'Post-swap must have rootItem');
assert.ok(swapAdj.postTaxonomy.subtype, 'Post-swap must have subtype');
assert.ok(swapAdj.postTaxonomy.productName, 'Post-swap must have linked product name');
console.log('✅ Test 6 Passed: Pre-swap and post-swap accurately expose Category, Root Item, Subtype, and Linked Product.\n');

console.log('=============================================================');
console.log('ALL RECIPE ENHANCEMENT ENGINE ACCEPTANCE TESTS PASSED! ✅');
console.log('=============================================================');
