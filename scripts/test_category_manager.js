/**
 * scripts/test_category_manager.js
 * Verification test suite for Category Management & Hierarchy Enforcement:
 * 1. Unified category aggregation across categories, ingredients, subtypes, and products.
 * 2. In-memory state synchronization on saveCategories.
 * 3. Cascading category rename across ingredients, subtypes, and products.
 * 4. Safe category deletion with mandatory cascading reallocation.
 * 5. Full hierarchy atomic creation (Category -> Item -> Sub-type -> Product).
 */

import assert from 'node:assert';

// Mock window/DOM for Node environment
if (typeof window === 'undefined') {
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent {
      constructor(name, detail) {
        this.name = name;
        this.detail = detail;
      }
    }
  };
}
if (typeof document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true
  };
}

import { getState, setCategories, setIngredients, setProducts } from '../src/store/store.js';
import { getUnifiedCategories, saveCategories } from '../src/services/CategoryRepository.js';
import { renameCategory, deleteCategory } from '../src/services/CategoryManagementRepository.js';
import { commitAtomicChain } from '../src/services/PantryTaxonomyService.js';

console.log('=== RUNNING CATEGORY MANAGEMENT & HIERARCHY TEST SUITE ===\n');

let failures = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    failures++;
    console.error(`❌ Failed: ${name}\n  Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    failures++;
    console.error(`❌ Failed: ${name}\n  Error: ${err.message}`);
  }
}

// 1. Unified Categories Aggregation
runTest('getUnifiedCategories aggregates and de-duplicates case and punctuation variants', () => {
  const mockState = {
    categories: ['Baking, Chocolate and Sweets', 'Dairy'],
    ingredients: [
      { id: 'ing-1', name: 'Dark Chocolate', category: 'Baking, Chocolate And Sweets', subtypes: [] },
      { id: 'ing-2', name: 'Apples', category: 'Fruit & Veg', subtypes: [] }
    ],
    products: [
      { id: 'prod-1', name: 'Frozen Peas', category: 'Frozen' }
    ]
  };

  const unified = getUnifiedCategories(mockState);
  assert.deepStrictEqual(unified, ['Baking, Chocolate and Sweets', 'Dairy', 'Frozen', 'Fruit & Veg']);
});

// 2. State synchronization on saveCategories
await runAsyncTest('saveCategories updates in-memory store state', async () => {
  setCategories(['Baking', 'Dairy']);
  const updatedList = ['Baking', 'Dairy', 'International'];
  await saveCategories(updatedList);
  const currentState = getState();
  assert.ok(Array.isArray(currentState.categories), 'state.categories should be array');
  assert.ok(currentState.categories.includes('International'), 'state.categories must include International');
});

// 3. Category Rename Cascading
await runAsyncTest('renameCategory cascades to ingredients, subtypes, and products', async () => {
  setCategories(['Produce', 'Dairy']);
  setIngredients([
    {
      id: 'ing-carrot',
      name: 'Carrot',
      category: 'Produce',
      subtypes: [
        { id: 'sub-baby-carrot', name: 'Baby Carrots', category: 'Produce' }
      ]
    }
  ]);
  setProducts([
    {
      id: 'prod-carrot-pack',
      name: 'Organic Carrots 500g',
      category: 'Produce',
      ingredientId: 'ing-carrot',
      subtypeId: 'sub-baby-carrot'
    }
  ]);

  const res = await renameCategory('Produce', 'Fresh Produce');
  assert.ok(res.success, 'renameCategory should succeed');

  const state = getState();
  assert.ok(state.categories.includes('Fresh Produce'), 'New category name should be in state.categories');
  assert.ok(!state.categories.includes('Produce'), 'Old category name should be removed');

  const ing = state.ingredients.find(i => i.id === 'ing-carrot');
  assert.strictEqual(ing.category, 'Fresh Produce', 'Ingredient category must be updated');
  assert.strictEqual(ing.subtypes[0].category, 'Fresh Produce', 'Subtype category must be updated');

  const prod = state.products.find(p => p.id === 'prod-carrot-pack');
  assert.strictEqual(prod.category, 'Fresh Produce', 'Product category must be updated');
});

// 4. Safe Category Deletion with Reallocation
await runAsyncTest('deleteCategory reallocates items, subtypes, and products to target category', async () => {
  setCategories(['Snacks', 'Pantry']);
  setIngredients([
    {
      id: 'ing-chips',
      name: 'Crisps',
      category: 'Snacks',
      subtypes: [{ id: 'sub-crisp-salted', name: 'Salted', category: 'Snacks' }]
    }
  ]);
  setProducts([
    {
      id: 'prod-crisps-walker',
      name: 'Walkers Ready Salted 6pk',
      category: 'Snacks',
      ingredientId: 'ing-chips',
      subtypeId: 'sub-crisp-salted'
    }
  ]);

  const res = await deleteCategory('Snacks', 'Pantry');
  assert.ok(res.success, 'deleteCategory should succeed');

  const state = getState();
  assert.ok(!state.categories.includes('Snacks'), 'Deleted category must be removed');

  const ing = state.ingredients.find(i => i.id === 'ing-chips');
  assert.strictEqual(ing.category, 'Pantry', 'Ingredient must be reallocated to Pantry');
  assert.strictEqual(ing.subtypes[0].category, 'Pantry', 'Subtype must be reallocated to Pantry');

  const prod = state.products.find(p => p.id === 'prod-crisps-walker');
  assert.strictEqual(prod.category, 'Pantry', 'Product must be reallocated to Pantry');
});

// 5. Complete Hierarchy Atomic Creation
await runAsyncTest('commitAtomicChain creates Category -> Item -> Sub-type -> Product', async () => {
  setCategories(['Bakery']);
  setIngredients([]);
  setProducts([]);

  const res = await commitAtomicChain({
    category: 'Bakery',
    rootItemName: 'Sourdough Bread',
    subtypeName: 'Seeded Loaf',
    productName: 'Tesco Finest Seeded Sourdough 800g',
    unit: 'loaf'
  });

  assert.ok(res.rootItem, 'Must return created rootItem');
  assert.ok(res.subtype, 'Must return created subtype');
  assert.ok(res.product, 'Must return created product');

  const state = getState();
  const root = state.ingredients.find(i => i.name === 'Sourdough Bread');
  assert.ok(root, 'Root item must exist in state');
  assert.strictEqual(root.category, 'Bakery');

  const sub = (root.subtypes || []).find(s => s.name === 'Seeded Loaf');
  assert.ok(sub, 'Subtype must exist under root item');

  const prod = (state.products || []).find(p => p.name === 'Tesco Finest Seeded Sourdough 800g');
  assert.ok(prod, 'Product must exist in state');
  assert.strictEqual(String(prod.ingredientId), String(root.id), 'Product must be linked to rootItem id');
  assert.strictEqual(String(prod.subtypeId), String(sub.id), 'Product must be linked to subtype id');
});

console.log('\n=== CATEGORY MANAGEMENT & HIERARCHY TEST RUN COMPLETE ===');
if (failures > 0) {
  console.error(`Total Failures: ${failures}`);
  process.exit(1);
} else {
  console.log('All tests passed successfully!');
}
