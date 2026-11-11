#!/usr/bin/env node
import assert from 'node:assert/strict';

// Minimal browser DOM environment
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.CustomEvent = class CustomEvent {
  constructor(type, params) { this.type = type; this.detail = params?.detail; }
};
global.document = {
  body: { style: {} },
  getElementById: () => null,
  createElement: () => ({ style: {} }),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {},
  dispatchEvent: () => true
};
global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};

console.log('=== TESTING SUBTYPE REALLOCATION & PROMOTION SUITE ===');

const { getState, setIngredients, setProducts, setRecipes } = await import('../src/store/store.js');
const { executeSubtypeReallocation } = await import('../src/services/PantryTaxonomyService.js');

// 1. Test promote_to_item using sourceParentItemId and sourceSubtypeId (ReorganiseModalUI call shape)
const rootItems1 = [
  {
    id: 'ing_maple',
    name: 'Maple Syrup',
    category: 'Syrups',
    subtypes: [
      { id: 'sub_zero', name: 'Zero Calorie Maple Syrup', defaultProductId: 'prod_walden' },
      { id: 'sub_pure', name: 'Pure Canadian Maple Syrup', defaultProductId: 'prod_clarks' }
    ]
  }
];

const products1 = [
  { id: 'prod_walden', name: 'Walden Farms Maple', ingredientId: 'ing_maple', subtypeId: 'sub_zero' },
  { id: 'prod_clarks', name: 'Clarks Pure Maple', ingredientId: 'ing_maple', subtypeId: 'sub_pure' }
];

const recipes1 = [
  {
    id: 'rec_pancakes',
    title: 'Protein Pancakes',
    ingredients: [
      { name: 'Maple Syrup', ingredientId: 'ing_maple', subtypeId: 'sub_zero', pantryItemId: 'ing_maple' }
    ]
  }
];

setIngredients(rootItems1);
setProducts(products1);
setRecipes(recipes1);

console.log('--- Test 1: Promote Sub-type using sourceParentItemId & sourceSubtypeId ---');
const promoteRes = await executeSubtypeReallocation({
  mode: 'promote_to_item',
  sourceParentItemId: 'ing_maple',
  sourceSubtypeId: 'sub_zero'
});

assert.ok(promoteRes.success, 'promote_to_item must report success');
const currentRoots1 = getState().ingredients || [];
const mapleParent = currentRoots1.find(r => r.id === 'ing_maple');
assert.equal(mapleParent.subtypes.length, 1, 'Original parent must have 1 subtype remaining');
assert.equal(mapleParent.subtypes[0].id, 'sub_pure', 'Pure Canadian subtype stays on original parent');

const newRoot = currentRoots1.find(r => r.name === 'Zero Calorie Maple Syrup');
assert.ok(newRoot, 'New standalone root item for Zero Calorie Maple Syrup must be created');
assert.equal(newRoot.category, 'Syrups', 'New root item inherits category from parent');

const currentProducts1 = getState().products || [];
const waldenProd = currentProducts1.find(p => p.id === 'prod_walden');
assert.equal(waldenProd.ingredientId, newRoot.id, 'Linked product must be reparented to new root item ID');

const currentRecipes1 = getState().recipes || [];
const pancakeRec = currentRecipes1.find(r => r.id === 'rec_pancakes');
assert.equal(pancakeRec.ingredients[0].ingredientId, newRoot.id, 'Recipe ingredient must be remapped to new root item ID');
console.log('✅ Test 1 Passed: promote_to_item successfully extracted sub-type to root item, reparented products, and remapped recipes.');

// 2. Test move_parent using sourceParentItemId, sourceSubtypeId & targetParentItemId
console.log('\n--- Test 2: Move Sub-type to New Parent ---');
const rootItems2 = [
  {
    id: 'ing_syrups',
    name: 'Syrups',
    category: 'Syrups',
    subtypes: [
      { id: 'sub_agave', name: 'Agave Nectar' }
    ]
  },
  {
    id: 'ing_sweeteners',
    name: 'Sweeteners',
    category: 'Baking',
    subtypes: []
  }
];
setIngredients(rootItems2);

const moveRes = await executeSubtypeReallocation({
  mode: 'move_parent',
  sourceParentItemId: 'ing_syrups',
  sourceSubtypeId: 'sub_agave',
  targetParentItemId: 'ing_sweeteners'
});

assert.ok(moveRes.success, 'move_parent must report success');
const currentRoots2 = getState().ingredients || [];
const syrupsParent = currentRoots2.find(r => r.id === 'ing_syrups');
const sweetenersParent = currentRoots2.find(r => r.id === 'ing_sweeteners');
assert.equal(syrupsParent.subtypes.length, 0, 'Source parent loses moved subtype');
assert.equal(sweetenersParent.subtypes.length, 1, 'Target parent gains moved subtype');
assert.equal(sweetenersParent.subtypes[0].id, 'sub_agave', 'Target parent contains moved subtype ID');
console.log('✅ Test 2 Passed: move_parent transferred sub-type between parent items cleanly.');

// 3. Test merge using sourceParentItemId, sourceSubtypeId & targetSubtypeId
console.log('\n--- Test 3: Merge Sibling Sub-types ---');
const rootItems3 = [
  {
    id: 'ing_onions',
    name: 'Onions',
    category: 'Produce',
    subtypes: [
      { id: 'sub_brown', name: 'Brown Onions', aliases: ['Yellow Onion'] },
      { id: 'sub_yellow', name: 'Yellow Onions', aliases: [] }
    ]
  }
];
setIngredients(rootItems3);

const mergeRes = await executeSubtypeReallocation({
  mode: 'merge',
  sourceParentItemId: 'ing_onions',
  sourceSubtypeId: 'sub_yellow',
  targetSubtypeId: 'sub_brown'
});

assert.ok(mergeRes.success, 'merge must report success');
const currentRoots3 = getState().ingredients || [];
const onionsParent = currentRoots3.find(r => r.id === 'ing_onions');
assert.equal(onionsParent.subtypes.length, 1, 'Parent retains only the merged canonical subtype');
assert.equal(onionsParent.subtypes[0].id, 'sub_brown', 'Canonical subtype remains');
assert.ok(onionsParent.subtypes[0].aliases.includes('Yellow Onions'), 'Merged subtype name added as alias to canonical subtype');
console.log('✅ Test 3 Passed: merge consolidated sibling subtypes and merged aliases.');

// 4. Test auto-discovery of parentId when only subtypeId is provided
console.log('\n--- Test 4: Auto-discovery of parent item when parentId is omitted ---');
const rootItems4 = [
  {
    id: 'ing_citrus',
    name: 'Citrus',
    category: 'Produce',
    subtypes: [
      { id: 'sub_lemon', name: 'Lemons' }
    ]
  }
];
setIngredients(rootItems4);

const autoParentRes = await executeSubtypeReallocation({
  mode: 'promote_to_item',
  subtypeId: 'sub_lemon'
});
assert.ok(autoParentRes.success, 'Subtype promotion must succeed even when parentId is omitted');
const currentRoots4 = getState().ingredients || [];
assert.ok(currentRoots4.some(r => r.name === 'Lemons'), 'Standalone Lemons root item created via auto-discovery');
console.log('✅ Test 4 Passed: Parent item auto-discovered via sub-type lookup.');

console.log('\n🎉 ALL SUBTYPE REALLOCATION & PROMOTION TESTS PASSED!');
