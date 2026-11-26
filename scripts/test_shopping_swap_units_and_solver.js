/**
 * scripts/test_shopping_swap_units_and_solver.js
 * Regression suite for the 4 Shopping List / Product Swap / Solver bugs:
 * 1. Swap modal resolves live plan items, computes accurate Fit Score delta, and overrides pre-frozen slot selections.
 * 2. Productless sub-types (e.g. Mushroom Ketchup) and category-mapped lines (e.g. Harissa Paste) do not bleed into Tomato Ketchup or Passata.
 * 3. Same product across mixed units (e.g. 200g + 2 qty) combines into one row with recorded-unit header & per-recipe breakdown.
 * 4. Shopping List uses solveOptimalRecipeProducts (matching Recipe Detail) instead of static Pantry auto-default.
 */

import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem() {},
  removeItem() {}
};

const { aggregateShoppingListFromPlan } = await import('../src/services/ShoppingCalculationService.js');
const { renderShoppingItemRow } = await import('../src/components/shopping/ShoppingItemRow.js');
const {
  resolveTargetItem,
  evaluateSwapFitScoreForTarget,
  executeSwapInState
} = await import('../src/components/ProductSwapModal.js');
const { store } = await import('../src/store/store.js');

const ingredients = [
  {
    id: 'ing_ketchup',
    name: 'Ketchup',
    category: 'Condiments',
    defaultProductId: 'prod_tom_ketchup',
    subtypes: [
      { id: 'sub_tom_ketchup', name: 'Tomato Ketchup', defaultProductId: 'prod_tom_ketchup' },
      { id: 'sub_mush_ketchup', name: 'Mushroom Ketchup' } // productless sub-type!
    ]
  },
  {
    id: 'ing_passata',
    name: 'Passata',
    category: 'Tinned & Jarred',
    defaultProductId: 'prod_passata',
    subtypes: [{ id: 'sub_passata', name: 'Passata', defaultProductId: 'prod_passata' }]
  },
  {
    id: 'ing_harissa',
    name: 'Harissa Paste',
    category: 'Tinned & Jarred',
    defaultProductId: 'prod_harissa',
    subtypes: [{ id: 'sub_harissa', name: 'Harissa Paste', defaultProductId: 'prod_harissa' }]
  },
  {
    id: 'ing_chicken',
    name: 'Chicken',
    category: 'Meat & Fish',
    defaultProductId: 'prod_chicken_thigh',
    subtypes: [
      { id: 'sub_chicken_breast', name: 'Chicken Breast' },
      { id: 'sub_chicken_thigh', name: 'Chicken Thigh' }
    ]
  },
  {
    id: 'ing_onion',
    name: 'Onion',
    category: 'Produce',
    defaultProductId: 'prod_onion',
    subtypes: [{ id: 'sub_onion', name: 'Brown Onion', defaultProductId: 'prod_onion' }]
  },
  {
    id: 'ing_rice',
    name: 'Basmati Rice',
    category: 'Grains',
    defaultProductId: 'prod_rice',
    subtypes: [{ id: 'sub_rice', name: 'Basmati Rice', defaultProductId: 'prod_rice' }]
  }
];

const products = [
  { id: 'prod_tom_ketchup', name: 'Heinz Tomato Ketchup', brand: 'Heinz', ingredientId: 'ing_ketchup', subtypeId: 'sub_tom_ketchup', category: 'Condiments', cal: 100, prot: 1, price: 2.5, packSize: 460, packUnit: 'g' },
  { id: 'prod_passata', name: 'Tesco Passata', brand: 'Tesco', ingredientId: 'ing_passata', subtypeId: 'sub_passata', category: 'Tinned & Jarred', cal: 30, prot: 2, price: 0.7, packSize: 500, packUnit: 'g' },
  { id: 'prod_harissa', name: 'Belazu Harissa Paste', brand: 'Belazu', ingredientId: 'ing_harissa', subtypeId: 'sub_harissa', category: 'Tinned & Jarred', cal: 220, prot: 3, price: 3.0, packSize: 170, packUnit: 'g' },
  // Chicken: thigh is default (higher cal, lower prot/kcal); with rice base, breast hits dinner targets much better!
  { id: 'prod_chicken_thigh', name: 'Tesco Chicken Thighs', brand: 'Tesco', ingredientId: 'ing_chicken', subtypeId: 'sub_chicken_thigh', category: 'Meat & Fish', cal: 220, prot: 18, price: 3.5, packSize: 500, packUnit: 'g', isAutoDefault: true },
  { id: 'prod_chicken_breast', name: 'Tesco Chicken Breast', brand: 'Tesco', ingredientId: 'ing_chicken', subtypeId: 'sub_chicken_breast', category: 'Meat & Fish', cal: 110, prot: 24, price: 4.0, packSize: 500, packUnit: 'g' },
  { id: 'prod_onion', name: 'Tesco Brown Onions', brand: 'Tesco', ingredientId: 'ing_onion', subtypeId: 'sub_onion', category: 'Produce', cal: 40, prot: 1, price: 1.0, packSize: 1000, packUnit: 'g', itemWeight: 150 },
  { id: 'prod_rice', name: 'Tesco Basmati Rice', brand: 'Tesco', ingredientId: 'ing_rice', subtypeId: 'sub_rice', category: 'Grains', cal: 350, prot: 8, price: 1.2, packSize: 1000, packUnit: 'g' }
];

const recipes = [
  {
    id: 'rec_unrelated_first',
    name: 'Unrelated First Recipe',
    serves: 2,
    types: ['dinner'],
    ingredients: [{ name: 'Passata', qty: 200, unit: 'g', ingredientId: 'ing_passata', subtypeId: 'sub_passata' }]
  },
  {
    id: 'rec_harissa_potatoes',
    name: 'Sticky Harissa Potatoes',
    serves: 2,
    types: ['dinner'],
    ingredients: [
      // Category-only line whose name is "Harissa Paste" — must NOT resolve to Passata!
      { name: 'Harissa Paste', qty: 40, unit: 'g', categoryId: 'Tinned & Jarred' },
      // Productless sub-type "Mushroom Ketchup" — must NOT merge into Tomato Ketchup!
      { name: 'Mushroom Ketchup', qty: 15, unit: 'ml', ingredientId: 'ing_ketchup', subtypeId: 'sub_mush_ketchup' },
      // Onion in grams
      { name: 'Onion', qty: 200, unit: 'g', ingredientId: 'ing_onion', subtypeId: 'sub_onion' }
    ]
  },
  {
    id: 'rec_chicken_bowl',
    name: 'High Protein Chicken Bowl',
    serves: 2,
    types: ['dinner'],
    ingredients: [
      // Root-bound chicken: with rice base, solver should pick Chicken Breast over Chicken Thigh to lift Fit Score!
      { name: 'Chicken', qty: 400, unit: 'g', ingredientId: 'ing_chicken' },
      { name: 'Basmati Rice', qty: 200, unit: 'g', ingredientId: 'ing_rice', subtypeId: 'sub_rice' },
      // Onion in qty (mixed unit with Sticky Harissa Potatoes!)
      { name: 'Onion', qty: 2, unit: 'qty', ingredientId: 'ing_onion', subtypeId: 'sub_onion' }
    ]
  }
];

const preferences = {
  profiles: {
    elliott: { dailyKcal: 2100, dailyProtein: 140 },
    chloe: { dailyKcal: 1650, dailyProtein: 105 }
  }
};

const plan = {
  id: 'plan_test',
  slots: {
    day1: { dinnerE: { recipeId: 'rec_harissa_potatoes' }, dinnerC: { recipeId: 'rec_harissa_potatoes' } },
    day2: { dinnerE: { recipeId: 'rec_chicken_bowl' }, dinnerC: { recipeId: 'rec_chicken_bowl' } }
  },
  // Pre-frozen selection on day2 for chicken (simulating populatePlanProductSelections)
  productSelections: {
    'day2_dinnerE:ing_chicken': 'prod_chicken_breast',
    'day2_dinnerC:ing_chicken': 'prod_chicken_breast'
  },
  substitutions: {}
};

// Bug 2: No cross-recipe attribution confusion (Harissa Paste != Passata, Mushroom Ketchup != Tomato Ketchup)
{
  const agg = aggregateShoppingListFromPlan(plan, { recipes, ingredients, products, preferences });
  const passataRow = agg.items.find(i => /passata/i.test(i.name));
  assert.equal(passataRow, undefined, 'Passata must not appear in shopping list for Sticky Harissa Potatoes');

  const harissaRow = agg.items.find(i => /harissa/i.test(i.name));
  assert.ok(harissaRow, 'Harissa Paste must resolve to Belazu Harissa Paste');
  assert.equal(harissaRow.bankIng.id, 'prod_harissa');

  const tomKetchupRow = agg.items.find(i => /tomato ketchup/i.test(i.name));
  assert.equal(tomKetchupRow, undefined, 'Mushroom Ketchup must not bleed into Tomato Ketchup');

  const mushKetchupRow = agg.items.find(i => /mushroom ketchup/i.test(i.name));
  assert.ok(mushKetchupRow, 'Mushroom Ketchup should remain its own sub-type row');
  console.log('✓ Bug 2 passed: Harissa Paste & Mushroom Ketchup stay isolated from Passata & Tomato Ketchup');
}

// Bug 3: Mixed units for the same product combine into ONE row with recorded-unit header & breakdown
{
  const agg = aggregateShoppingListFromPlan(plan, { recipes, ingredients, products, preferences });
  const onionRows = agg.items.filter(i => i.bankIng?.id === 'prod_onion');
  assert.equal(onionRows.length, 1, 'Brown Onions used in g and qty must combine into ONE shopping list row');

  const onion = onionRows[0];
  assert.equal(onion.isMixedUnits, true);
  assert.equal(onion.quantity, '200g + 2 qty', `Expected combined recorded units "200g + 2 qty", got "${onion.quantity}"`);

  const harissaBreakdown = onion.recipeSummary.find(r => r.recipeName === 'Sticky Harissa Potatoes');
  const chickenBreakdown = onion.recipeSummary.find(r => r.recipeName === 'High Protein Chicken Bowl');
  assert.equal(harissaBreakdown.formattedQty, '200g');
  assert.equal(chickenBreakdown.formattedQty, '2 qty');

  const rowHtml = renderShoppingItemRow(onion);
  assert.ok(rowHtml.includes('200g + 2 qty'), 'Rendered header should show combined recorded units');
  assert.ok(rowHtml.includes('>200g<'), 'Rendered breakdown should show 200g for Sticky Harissa Potatoes');
  assert.ok(rowHtml.includes('>2 qty<'), 'Rendered breakdown should show 2 qty for High Protein Chicken Bowl');
  console.log('✓ Bug 3 passed: mixed units combine into one row with recorded-unit header & breakdown');
}

// Bug 4: Shopping List uses Fit-Score-optimal solver choices when no manual override exists
{
  const unfrozenPlan = { ...plan, productSelections: {} };
  const agg = aggregateShoppingListFromPlan(unfrozenPlan, { recipes, ingredients, products, preferences });
  const chickenRow = agg.items.find(i => i.ingredientId === 'ing_chicken');
  assert.ok(chickenRow, 'Chicken row must exist');
  assert.equal(
    chickenRow.bankIng.id,
    'prod_chicken_breast',
    'Shopping List must use Fit-Score-optimal Chicken Breast instead of static auto-default Chicken Thigh'
  );
  console.log('✓ Bug 4 passed: Shopping List uses Fit-Score-optimal solver choices');
}

// Bug 1: Swap modal resolves live items when state.shoppingList is empty, computes real Fit Score delta, and overrides pre-frozen slot selections
{
  store.setState({
    recipes,
    ingredients,
    rootItems: ingredients,
    products,
    preferences,
    currentPlan: JSON.parse(JSON.stringify(plan)),
    plan: JSON.parse(JSON.stringify(plan)),
    shoppingList: [] // Simulates Step 3 render before shoppingList is populated!
  });

  const { item: resolvedChicken } = resolveTargetItem('prod_chicken_breast', 'ing_chicken');
  assert.equal(resolvedChicken.bankIng?.id, 'prod_chicken_breast', 'resolveTargetItem must find live shopping item even when state.shoppingList is empty');
  assert.ok(resolvedChicken.recipeBreakdown.length > 0, 'resolveTargetItem must preserve recipeBreakdown');

  const deltaRes = evaluateSwapFitScoreForTarget(
    resolvedChicken,
    products.find(p => p.id === 'prod_chicken_thigh'),
    store.getState()
  );
  assert.equal(deltaRes.hasValidRecipe, true);
  assert.notEqual(deltaRes.delta, 0, `Swapping Chicken Breast -> Thigh must produce non-zero Fit Score delta (got ${deltaRes.delta})`);
  assert.ok(deltaRes.delta < 0, `Swapping Breast -> higher-cal/lower-prot Thigh should lower Fit Score (got ${deltaRes.delta})`);

  // Apply global swap (overrides pre-frozen day2_dinnerE:ing_chicken and day2_dinnerC:ing_chicken)
  await executeSwapInState(resolvedChicken, products.find(p => p.id === 'prod_chicken_thigh'));
  const afterSwapAgg = aggregateShoppingListFromPlan(store.getState().currentPlan, store.getState());
  const swappedChicken = afterSwapAgg.items.find(i => i.ingredientId === 'ing_chicken');
  assert.equal(
    swappedChicken?.bankIng?.id,
    'prod_chicken_thigh',
    'Applying swap must override pre-frozen event-scoped productSelections and stick on re-aggregation'
  );
  console.log('✓ Bug 1 passed: Swap modal resolves live item, computes Fit Score delta, and persists override over pre-frozen selections');
}

console.log('\nALL SHOPPING SWAP, ATTRIBUTION, MIXED-UNIT & SOLVER TESTS PASSED');
