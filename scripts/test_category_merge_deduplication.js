#!/usr/bin/env node
import assert from 'node:assert/strict';

// Setup browser DOM / store stubs
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};
global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};
global.document = {
  body: { style: {} },
  getElementById: () => null,
  dispatchEvent: () => true
};

const { getState, setCategories, setIngredients, setProducts } = await import('../src/store/store.js');
const { findDuplicateCategoryClusters } = await import('../src/components/pantry/CategoryMergeModalUI.js');
const { mergeCategory } = await import('../src/services/CategoryMergeRepository.js');

console.log('Testing Category Deduplication & Cascading Merge...');

// 1. Setup Mock State with Duplicate Category Clusters
setCategories(['Bakery', 'bakery', 'Dairy', 'Fresh Produce']);
setIngredients([
  {
    id: 'ing-1',
    name: 'White Bread',
    category: 'bakery',
    subtypes: [{ id: 'sub-1', name: 'Thick Sliced', category: 'bakery' }]
  },
  {
    id: 'ing-2',
    name: 'Croissant',
    category: 'Bakery',
    subtypes: [{ id: 'sub-2', name: 'All Butter', category: 'Bakery' }]
  },
  {
    id: 'ing-3',
    name: 'Milk',
    category: 'Dairy',
    subtypes: []
  }
]);
setProducts([
  {
    id: 'prod-1',
    name: 'Tesco White Bread',
    category: 'bakery',
    cat: 'bakery',
    ingredientId: 'ing-1'
  },
  {
    id: 'prod-2',
    name: 'Tesco Croissant 4pk',
    category: 'Bakery',
    cat: 'bakery',
    ingredientId: 'ing-2'
  }
]);

// 2. Test Cluster Discovery
const clusters = findDuplicateCategoryClusters();
console.log('Found clusters:', clusters.map(c => ({ slug: c.slug, variants: c.variants.map(v => v.name) })));

assert.equal(clusters.length, 1, 'Expected exactly 1 duplicate cluster');
assert.equal(clusters[0].slug, 'bakery');
assert.equal(clusters[0].variants.length, 2);
assert.ok(clusters[0].variants.some(v => v.name === 'Bakery'));
assert.ok(clusters[0].variants.some(v => v.name === 'bakery'));

// 3. Test Cascading Category Merge
console.log('Merging "bakery" into canonical "Bakery"...');
const mergeRes = await mergeCategory('bakery', 'Bakery');
assert.ok(mergeRes.success, 'mergeCategory must succeed');

const state = getState();
console.log('Updated categories in store:', state.categories);

// Categories should now have single "Bakery" and no "bakery"
assert.ok(!state.categories.includes('bakery'), 'Lowercase "bakery" must be removed from categories');
assert.ok(state.categories.includes('Bakery'), 'Canonical "Bakery" must be retained in categories');

// Ingredients must be cascaded
const updatedIng1 = state.ingredients.find(i => i.id === 'ing-1');
assert.equal(updatedIng1.category, 'Bakery', 'Ingredient category must be cascaded to Bakery');
assert.equal(updatedIng1.subtypes[0].category, 'Bakery', 'Subtype category must be cascaded to Bakery');

// Products must be cascaded
const updatedProd1 = state.products.find(p => p.id === 'prod-1');
assert.equal(updatedProd1.category, 'Bakery', 'Product category must be cascaded to Bakery');

// Re-scanning clusters must now return empty
const afterClusters = findDuplicateCategoryClusters();
assert.equal(afterClusters.length, 0, 'No duplicate clusters should remain after merge');

console.log('✅ Category Deduplication & Cascading Merge tests passed!');
