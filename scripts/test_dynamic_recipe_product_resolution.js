#!/usr/bin/env node
import assert from 'node:assert/strict';

// Minimal browser DOM environment
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.CustomEvent = class CustomEvent {
  constructor(type, params) { this.type = type; this.detail = params?.detail; }
};
const domElements = new Map();
function createMockElement(id = '', tag = 'div') {
  return {
    id, tagName: tag.toUpperCase(), value: '', innerHTML: '', textContent: '',
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {}
  };
}
global.document = {
  body: { style: {} },
  getElementById: (id) => {
    if (!domElements.has(id)) domElements.set(id, createMockElement(id));
    return domElements.get(id);
  },
  createElement: (tag) => createMockElement('', tag),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {},
  dispatchEvent: () => true
};
global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};

console.log('=== RUNNING DYNAMIC RECIPE-TO-PANTRY RESOLUTION TEST SUITE ===');

const { getState, setIngredients, setProducts, setRecipes } = await import('../src/store/store.js');
const { resolveDynamicProductForIngredient } = await import('../src/services/PantryTaxonomyService.js');

// Seed test state
const testIngredients = [
  {
    id: 'ing_cheddar',
    name: 'Cheddar Cheese',
    category: 'Dairy',
    subtypes: [
      { id: 'sub_mature', name: 'Mature Cheddar', defaultProductId: 'prod_mature_tesco' },
      { id: 'sub_mild', name: 'Mild Cheddar', defaultProductId: 'prod_mild_tesco' }
    ]
  },
  {
    id: 'ing_bread',
    name: 'Bread',
    category: 'Bakery',
    subtypes: [
      { id: 'sub_brioche', name: 'Brioche Buns' }
    ]
  }
];

const testProducts = [
  { id: 'prod_mature_tesco', name: 'Tesco Mature Cheddar 400g', ingredientId: 'ing_cheddar', subtypeId: 'sub_mature', price: 3.00, pack: 400, packUnit: 'g', prot: 25, fat: 34, carb: 0.1, cal: 410 },
  { id: 'prod_mature_cathedral', name: 'Cathedral City Mature 350g', ingredientId: 'ing_cheddar', subtypeId: 'sub_mature', price: 2.50, pack: 350, packUnit: 'g', prot: 26, fat: 35, carb: 0.1, cal: 415 },
  { id: 'prod_mild_tesco', name: 'Tesco Mild Cheddar 400g', ingredientId: 'ing_cheddar', subtypeId: 'sub_mild', price: 2.80, pack: 400, packUnit: 'g', prot: 24, fat: 33, carb: 0.1, cal: 400 },
  { id: 'prod_brioche_albi', name: 'Albi Brioche Buns 4pk', ingredientId: 'ing_bread', subtypeId: 'sub_brioche', price: 1.20, pack: 200, packUnit: 'g', prot: 8, fat: 5, carb: 50, cal: 280, isAutoDefault: true }
];

setIngredients(testIngredients);
setProducts(testProducts);

// 1. Test Sub-Type Resolution: Explicit sub.defaultProductId wins
const lineSubtype = { name: 'Mature Cheddar', subtypeId: 'sub_mature', ingredientId: 'ing_cheddar' };
const resSubtype = resolveDynamicProductForIngredient(lineSubtype, { products: testProducts, ingredients: testIngredients });
assert.ok(resSubtype, 'Sub-type binding must resolve to a product');
assert.equal(resSubtype.id, 'prod_mature_tesco', 'Resolves to sub.defaultProductId');

// 2. Test Root Item Cascade Resolution: cascades to sub-types, uses preference metric
// Using lowest_unit_price (Tesco Mild: 2.80/400 = 0.0070/g vs Cathedral Mature: 2.50/350 = 0.00714/g)
const lineRoot = { name: 'Cheddar Cheese', ingredientId: 'ing_cheddar' };
const resRootLowestUnit = resolveDynamicProductForIngredient(lineRoot, {
  products: testProducts,
  ingredients: testIngredients,
  preferences: { autoDefaultStrategy: 'lowest_unit_price' }
});
assert.ok(resRootLowestUnit, 'Root item binding must cascade to sub-types and resolve');
assert.equal(resRootLowestUnit.id, 'prod_mild_tesco', 'Lowest unit price product must win across root item sub-types');

// 3. Test Dynamic Updates: changing isAutoDefault immediately updates resolution without editing recipe line
const updatedProducts = testProducts.map(p => ({
  ...p,
  isAutoDefault: p.id === 'prod_mature_cathedral'
}));
const resAfterUpdate = resolveDynamicProductForIngredient(lineSubtype, { products: updatedProducts, ingredients: testIngredients });
assert.equal(resAfterUpdate.id, 'prod_mature_tesco', 'Explicit defaultProductId still wins if defined');

// If sub.defaultProductId is cleared, autoDefault wins
const ingredientsNoDefault = testIngredients.map(i => ({
  ...i,
  subtypes: i.subtypes.map(s => s.id === 'sub_mature' ? { ...s, defaultProductId: null } : s)
}));
const resAuto = resolveDynamicProductForIngredient(lineSubtype, { products: updatedProducts, ingredients: ingredientsNoDefault });
assert.equal(resAuto.id, 'prod_mature_cathedral', 'AutoDefault product wins when no explicit sub default is defined');

// 4. Test Backward Compatibility: fallback to productId if taxonomy missing
const legacyLine = { name: 'Unknown Cheese', productId: 'prod_mild_tesco' };
const resLegacy = resolveDynamicProductForIngredient(legacyLine, { products: testProducts, ingredients: testIngredients });
assert.equal(resLegacy?.id, 'prod_mild_tesco', 'Falls back to direct productId when no taxonomy keys present');

// 5. Test Safe Null for text-only ingredients
const textOnlyLine = { name: 'pinch of salt' };
const resNull = resolveDynamicProductForIngredient(textOnlyLine, { products: testProducts, ingredients: testIngredients });
assert.equal(resNull, null, 'Returns null safely for text-only ingredient');

console.log('✅ Unit 1: Dynamic Taxonomy Resolver Engine verified!');

// ==========================================================
// UNIT 2: Recipe Wizard, Vault Scoring & Nutrition Decoupling
// ==========================================================
console.log('\n--- Unit 2: Decoupled Recipe Schema & Dynamic Nutrition ---');

const { stripProductIdsFromIngredients } = await import('../src/services/RecipeFirestoreRepository.js');
const { findProductForIngredient, computeDynamicMacrosFromIngredients } = await import('../src/utils/macroScoringUtils.js');
const { formatRecipeIngredientRow } = await import('../src/components/recipe/RecipeDetailModalUI.js');

// 1. Test stripProductIdsFromIngredients
const mockRecipeWithProductIds = {
  id: 'rec_cheesy_toast',
  title: 'Cheesy Toast',
  ingredients: [
    { name: 'Mature Cheddar', qty: 50, unit: 'g', subtypeId: 'sub_mature', ingredientId: 'ing_cheddar', productId: 'prod_mature_tesco', bankId: 'prod_mature_tesco' }
  ],
  ingredientSections: [
    {
      sectionTitle: 'Topping',
      ingredients: [
        { name: 'Mild Cheddar', qty: 25, unit: 'g', subtypeId: 'sub_mild', ingredientId: 'ing_cheddar', productId: 'prod_mild_tesco', bankId: 'prod_mild_tesco' }
      ]
    }
  ],
  enhanced: {
    ingredients: [
      { name: 'Brioche Bun', qty: 1, unit: 'item', subtypeId: 'sub_brioche', ingredientId: 'ing_bread', productId: 'prod_brioche_albi' }
    ]
  }
};

const stripped = stripProductIdsFromIngredients(mockRecipeWithProductIds);
assert.equal(stripped.ingredients[0].productId, undefined, 'Base ingredients must have productId stripped');
assert.equal(stripped.ingredients[0].bankId, undefined, 'Base ingredients must have bankId stripped');
assert.equal(stripped.ingredients[0].subtypeId, 'sub_mature', 'Base ingredients must retain subtypeId');
assert.equal(stripped.ingredientSections[0].ingredients[0].productId, undefined, 'Section ingredients must have productId stripped');
assert.equal(stripped.ingredientSections[0].ingredients[0].subtypeId, 'sub_mild', 'Section ingredients must retain subtypeId');
assert.equal(stripped.enhanced.ingredients[0].productId, undefined, 'Enhanced ingredients must have productId stripped');
assert.equal(stripped.enhanced.ingredients[0].subtypeId, 'sub_brioche', 'Enhanced ingredients must retain subtypeId');

// 2. Test findProductForIngredient in macroScoringUtils resolves dynamically
const foundProd = findProductForIngredient({ subtypeId: 'sub_mature', ingredientId: 'ing_cheddar' }, testProducts, { ingredients: testIngredients });
assert.ok(foundProd, 'findProductForIngredient must resolve product dynamically via taxonomy');
assert.equal(foundProd.id, 'prod_mature_tesco');

// 3. Test computeDynamicMacrosFromIngredients resolves dynamically via taxonomy keys
// 100g of Tesco Mature Cheddar: 410 kcal, 25g prot. Serves 1 -> 410 cal, 25 prot
const decoupledIngredients = [
  { name: 'Mature Cheddar', qty: 100, unit: 'g', subtypeId: 'sub_mature', ingredientId: 'ing_cheddar' }
];
const computedMacros = computeDynamicMacrosFromIngredients(decoupledIngredients, 1);
assert.ok(computedMacros, 'computeDynamicMacrosFromIngredients must succeed with decoupled ingredient');
assert.equal(computedMacros.cal, 410, 'Calories calculated dynamically from matched product');
assert.equal(computedMacros.prot, 25, 'Protein calculated dynamically from matched product');

// 4. Test formatRecipeIngredientRow dynamically resolves and displays product without baked-in productId
const rowHtml = formatRecipeIngredientRow(
  { name: 'Mature Cheddar', subtypeId: 'sub_mature', ingredientId: 'ing_cheddar' },
  { products: testProducts, ingredients: testIngredients, rootItems: testIngredients }
);
assert.ok(rowHtml.includes('Tesco Mature Cheddar 400g'), 'Ingredient row HTML must include dynamically resolved product name');
assert.ok(rowHtml.includes('data-product-id="prod_mature_tesco"'), 'Ingredient row HTML must include resolved product id data attribute');

console.log('✅ Unit 2: Recipe Wizard, Vault Scoring & Nutrition Decoupling verified!');

// ==========================================================
// UNIT 3: Meal Plan Product Freezing & Local Swaps
// ==========================================================
console.log('\n--- Unit 3: Meal Plan Product Freezing & Local Swaps ---');

const { freezeProductSelectionsForPlan, lockProductSelectionsForSlots } = await import('../src/services/PantryTaxonomyService.js');
const { executeSwapInState } = await import('../src/components/ProductSwapModal.js');
const { aggregateShoppingListFromPlan } = await import('../src/services/ShoppingCalculationService.js');

const recipeToast = {
  id: 'rec_toast',
  title: 'Cheesy Toast',
  ingredients: [
    { name: 'Mature Cheddar', qty: 100, unit: 'g', subtypeId: 'sub_mature', ingredientId: 'ing_cheddar' }
  ]
};

setRecipes([recipeToast]);

const mockPlan = {
  id: 'plan_test_week',
  slots: {
    '0': {
      dinner: { id: 'rec_toast', recipeId: 'rec_toast', variant: 'original' }
    }
  },
  productSelections: {}
};

// 1. Test Freezing: productSelections populated with resolved product IDs
const frozenSelections = freezeProductSelectionsForPlan(mockPlan, {
  products: testProducts,
  ingredients: testIngredients,
  recipes: [recipeToast]
});

assert.ok(frozenSelections['0_dinner:sub_mature'], 'Must freeze scoped product selection for 0_dinner:sub_mature');
assert.equal(frozenSelections['0_dinner:sub_mature'], 'prod_mature_tesco', 'Frozen product must be Tesco Mature Cheddar');

// 2. Test Decoupling: changing default product does NOT mutate frozen plan selection
const changedSubtypeIngredients = testIngredients.map(i => ({
  ...i,
  subtypes: i.subtypes.map(s => s.id === 'sub_mature' ? { ...s, defaultProductId: 'prod_mature_cathedral' } : s)
}));

const planWithFrozen = {
  ...mockPlan,
  productSelections: { ...frozenSelections }
};

// Re-freezing existing selections preserves previously frozen product
const refrozen = freezeProductSelectionsForPlan(planWithFrozen, {
  products: testProducts,
  ingredients: changedSubtypeIngredients,
  recipes: [recipeToast]
});
assert.equal(refrozen['0_dinner:sub_mature'], 'prod_mature_tesco', 'Existing frozen selection must not be overwritten by changed default');

// 3. Test Shopping List Aggregation uses frozen product selection
const shoppingResult = aggregateShoppingListFromPlan(
  planWithFrozen,
  { recipes: [recipeToast], preferences: {} },
  changedSubtypeIngredients,
  testProducts
);
assert.ok(shoppingResult.items.length > 0, 'Shopping items must be generated');
const cheeseShopItem = shoppingResult.items.find(i => i.bankIng?.id === 'prod_mature_tesco' || i.name.includes('Tesco Mature Cheddar'));
assert.ok(cheeseShopItem, 'Shopping list must buy frozen product Tesco Mature Cheddar, not changed default');

// 4. Test In-Plan Local Swap via executeSwapInState
const { store } = await import('../src/store/store.js');
store.setState({ currentPlan: planWithFrozen, products: testProducts, ingredients: testIngredients });

await executeSwapInState(
  { canonicalIngId: 'ing_cheddar', subtypeId: 'sub_mature', name: 'Mature Cheddar' },
  { id: 'prod_mature_cathedral', name: 'Cathedral City Mature 350g', price: 2.50 },
  { cookingEventId: '0_dinner' }
);

const swappedPlan = store.getState().currentPlan;
assert.equal(swappedPlan.productSelections['0_dinner:sub_mature'], 'prod_mature_cathedral', 'In-plan swap must update scoped product selection');
// Base recipe must remain completely untouched
const baseRecipeCheck = store.getState().recipes.find(r => r.id === 'rec_toast');
assert.equal(baseRecipeCheck.ingredients[0].productId, undefined, 'Base recipe must remain completely decoupled after in-plan swap');

console.log('✅ Unit 3: Meal Plan Product Freezing & Local Swaps verified!');

// ==========================================================
// UNIT 4: Unblock Pantry Product Deletion
// ==========================================================
console.log('\n--- Unit 4: Unblock Pantry Product Deletion ---');

// In a decoupled architecture, deleting a product used in recipes is unblocked.
// When Tesco Mature Cheddar is removed from productsBank, the recipe line dynamically falls back to Cathedral Mature!
const remainingProducts = testProducts.filter(p => p.id !== 'prod_mature_tesco');
const resolvedAfterDelete = resolveDynamicProductForIngredient(
  { name: 'Mature Cheddar', subtypeId: 'sub_mature', ingredientId: 'ing_cheddar' },
  { products: remainingProducts, ingredients: testIngredients }
);

assert.ok(resolvedAfterDelete, 'Recipe line must successfully resolve to remaining sub-type product');
assert.equal(resolvedAfterDelete.id, 'prod_mature_cathedral', 'Dynamically resolves to Cathedral City Mature after Tesco Mature deletion');

console.log('✅ Unit 4: Unblock Pantry Product Deletion verified!');

// ==========================================================
// UNIT 5: Startup Migration & Data Quality Scanner
// ==========================================================
console.log('\n--- Unit 5: Startup Migration & Data Quality Scanner ---');

const { migrateLegacyRecipeProductBindings } = await import('../src/services/MaintenanceService.js');
const { runAudit } = await import('../src/services/DataQualityScanner.js');

// 1. Test migrateLegacyRecipeProductBindings
const legacyRecipe = {
  id: 'rec_legacy_cheese',
  title: 'Legacy Cheese Sandwich',
  ingredients: [
    { name: 'Cheddar', qty: 50, unit: 'g', productId: 'prod_mature_tesco', bankId: 'prod_mature_tesco' }
  ]
};

setRecipes([legacyRecipe]);
setProducts(testProducts);
setIngredients(testIngredients);

const migrationResult = await migrateLegacyRecipeProductBindings({ dryRun: true });
assert.ok(migrationResult.success, 'Migration must succeed');
assert.equal(migrationResult.migratedCount, 1, 'Exactly 1 legacy recipe must be migrated');
const migratedRec = migrationResult.updates[0];
assert.equal(migratedRec.ingredients[0].subtypeId, 'sub_mature', 'Must resolve and copy subtypeId from product');
assert.equal(migratedRec.ingredients[0].ingredientId, 'ing_cheddar', 'Must resolve and copy ingredientId from product');
assert.equal(migratedRec.ingredients[0].productId, undefined, 'Must strip productId from ingredient line');
assert.equal(migratedRec.ingredients[0].bankId, undefined, 'Must strip bankId from ingredient line');

// 2. Test Data Quality Scanner for unlinked recipe ingredients & empty subtypes
const recipeWithOrphan = {
  id: 'rec_unlinked',
  title: 'Mysterious Brew',
  ingredients: [
    { name: 'Unicorn Stardust Herb', qty: 5, unit: 'g' } // No taxonomy match
  ]
};

const auditState = {
  recipes: [recipeWithOrphan],
  ingredients: [
    {
      id: 'ing_empty',
      name: 'Exotic Fruit',
      subtypes: [
        { id: 'sub_dragonfruit', name: 'Dragonfruit' } // No products in products catalog
      ]
    }
  ],
  products: testProducts
};

const auditResults = runAudit(auditState);

// Assert unlinked recipe ingredient detected
const unlinkedIssue = auditResults.unmappedItems.find(i => i.recipeId === 'rec_unlinked');
assert.ok(unlinkedIssue, 'Data Quality scanner must flag unlinked recipe ingredient in unmappedItems');
assert.match(unlinkedIssue.message, /Unicorn Stardust Herb/, 'Message must cite unlinked ingredient name');

// Assert empty sub-type detected
const emptySubtypeIssue = auditResults.orphans.find(i => i.subtypeId === 'sub_dragonfruit' && i.type === 'empty-subtype');
assert.ok(emptySubtypeIssue, 'Data Quality scanner must flag empty sub-type in orphans');
assert.match(emptySubtypeIssue.message, /Dragonfruit/, 'Message must cite empty sub-type name');

console.log('✅ Unit 5: Startup Migration & Data Quality Scanner verified!\n');

// ==========================================================
// CODE REVIEW FIX VERIFICATION
// ==========================================================
console.log('--- Code Review Findings Verification ---');

// 1. Generic Culinary Name Fallback matching root items
const chickenRoots = [{ id: 'ing_chicken', name: 'Chicken Breast', subtypes: [{ id: 'sub_fillets', name: 'Chicken Breast Fillets', defaultProductId: 'prod_chicken_fillets' }] }];
const chickenProducts = [{ id: 'prod_chicken_fillets', name: 'Tesco British Chicken Breast Fillets 650g', ingredientId: 'ing_chicken', subtypeId: 'sub_fillets', prot: 31, cal: 140, isAutoDefault: true }];
const resGenericName = resolveDynamicProductForIngredient({ name: 'Chicken Breast' }, { products: chickenProducts, ingredients: chickenRoots });
assert.ok(resGenericName, 'Generic culinary name must resolve via root item name fallback');
assert.equal(resGenericName.id, 'prod_chicken_fillets', 'Resolves to default product under matched root item');

// 2. CategoryId Key Resolution
const resCategoryId = resolveDynamicProductForIngredient({ categoryId: 'Dairy' }, { products: testProducts, ingredients: testIngredients });
assert.ok(resCategoryId, 'Must resolve via categoryId key');

// 3. Split Meal Plan Freezing
const splitPlan = {
  slots: {
    '0': {
      dinner: {
        isSplit: true,
        elliott: { recipeId: 'rec_toast', variant: 'original' },
        chloe: { recipeId: 'rec_toast', variant: 'original' }
      }
    }
  }
};
const splitFrozen = freezeProductSelectionsForPlan(splitPlan, { products: testProducts, ingredients: testIngredients, recipes: [recipeToast] });
assert.ok(splitFrozen['0_dinner_E:sub_mature'], 'Must freeze split selection for Elliott (dinner_E)');
assert.ok(splitFrozen['0_dinner_C:sub_mature'], 'Must freeze split selection for Chloe (dinner_C)');

console.log('✅ Code Review Findings Verified!\n');
console.log('🎉 ALL UNITS 1-5 FOR DYNAMIC RECIPE-TO-PANTRY RESOLUTION VERIFIED!');
