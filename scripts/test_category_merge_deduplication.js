#!/usr/bin/env node
import assert from 'node:assert/strict';

// Setup browser DOM / store / Firestore stubs
const firestoreStore = {
  ingredients: new Map(),
  products: new Map(),
  settings: new Map()
};

function makeCollection(colName) {
  const map = firestoreStore[colName] || new Map();
  return {
    doc(id = `doc_${Date.now()}`) {
      const key = String(id);
      return {
        id: key,
        async get() {
          const val = map.get(key);
          return { exists: val !== undefined, id: key, data: () => (val ? JSON.parse(JSON.stringify(val)) : undefined) };
        },
        async set(data, opts) {
          const prev = (opts?.merge && map.get(key)) ? map.get(key) : {};
          map.set(key, JSON.parse(JSON.stringify({ ...prev, ...data })));
        },
        async delete() {
          map.delete(key);
        },
        collection(subCol) {
          return makeCollection(subCol);
        }
      };
    },
    async get() {
      const docs = Array.from(map.entries()).map(([id, val]) => ({
        id,
        data: () => JSON.parse(JSON.stringify(val))
      }));
      return { docs, empty: docs.length === 0 };
    }
  };
}

global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};
global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true,
  firebase: {
    apps: [{}],
    initializeApp: () => {},
    auth: () => ({ onAuthStateChanged: () => {}, currentUser: { uid: 'test-uid' } }),
    firestore: () => ({
      collection: (name) => makeCollection(name)
    })
  }
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

// 4. Test Reload Persistence (Firestore round-trip + enforceCategorySSOT + Hydration normalization)
console.log('Testing persistence across Firestore save and reload...');
const { getRootItems } = await import('../src/services/RootItemRepository.js');
const { getProducts } = await import('../src/services/ProductRepository.js');
const { getCategories } = await import('../src/services/CategoryRepository.js');
const { normalizeIngredientRecord, normalizeProductRecord } = await import('../src/services/HydrationService.js');

// Seed raw Firestore documents (including a lowercase-conjunction category and a legacy `cat`-only record)
firestoreStore.settings.set('categories', { categories: ['Grains, Nuts and Seeds', 'Store Cupboard'] });
firestoreStore.ingredients.clear();
firestoreStore.ingredients.set('ing-oats', {
  name: 'Oats',
  category: 'Grains, Nuts and Seeds',
  subtypes: [{ id: 'sub-rolled', name: 'Rolled Oats', category: 'Grains, Nuts and Seeds' }]
});
firestoreStore.ingredients.set('ing-almonds', {
  name: 'Almonds',
  category: 'Grains, Nuts And Seeds',
  subtypes: [{ id: 'sub-flaked', name: 'Flaked Almonds', category: 'Grains, Nuts And Seeds' }]
});
firestoreStore.ingredients.set('ing-salt', {
  name: 'Sea Salt',
  cat: 'store-cupboard',
  subtypes: []
});
firestoreStore.products.clear();
firestoreStore.products.set('prod-oats', {
  name: 'Tesco Rolled Oats',
  ingredientId: 'ing-oats',
  subtypeId: 'sub-rolled',
  category: 'Grains, Nuts And Seeds'
});

// Hydrate initial state from Firestore just as HydrationService does
setCategories(await getCategories());
setIngredients((await getRootItems()).map(normalizeIngredientRecord));
setProducts((await getProducts()).map(normalizeProductRecord));

const reloadClustersBefore = findDuplicateCategoryClusters();
assert.equal(reloadClustersBefore.length, 2, 'Should detect both duplicate clusters before merge');

await mergeCategory('Grains, Nuts And Seeds', 'Grains, Nuts and Seeds');
await mergeCategory('store-cupboard', 'Store Cupboard');

// Simulate full page reload from Firestore via getCategories, getRootItems, getProducts + normalizers
setCategories(await getCategories());
setIngredients((await getRootItems()).map(normalizeIngredientRecord));
setProducts((await getProducts()).map(normalizeProductRecord));

const reloadClustersAfter = findDuplicateCategoryClusters();
assert.equal(
  reloadClustersAfter.length,
  0,
  `Merged categories must not reappear after reload (found: ${JSON.stringify(reloadClustersAfter.map(c => c.variants.map(v => v.name)))})`
);

console.log('✅ Category Deduplication & Cascading Merge tests passed!');
