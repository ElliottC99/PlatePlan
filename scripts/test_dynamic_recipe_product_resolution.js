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
