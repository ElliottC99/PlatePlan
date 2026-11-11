#!/usr/bin/env node
import assert from 'node:assert/strict';

// Stub minimal browser window/store environment
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};

const { setRecipes } = await import('../src/store/store.js');
const { scanUnlinkedRecipeIngredients } = await import('../src/components/data-quality/UnlinkedSweeperUI.js');

setRecipes([
  {
    id: 'rec-1',
    title: 'Apple Pie',
    ingredientSections: [
      {
        ingredients: [
          // Valid category assignment -> linked
          { raw: 'Apples', categoryId: 'Fresh Produce' },
          // Generic fallback category without default -> unlinked
          { raw: 'Salt', categoryId: 'Store Cupboard' },
          // Generic fallback category with default -> linked
          { raw: 'Sugar', categoryId: 'Store Cupboard', isCategoryDefault: true },
          // Explicit new item -> unlinked
          { raw: 'Secret Spice', ingredientId: 'new_item', categoryId: 'Spices' },
          // Subtype linked -> linked
          { raw: 'Butter', subtypeId: 'sub-butter-1' },
          // Completely unlinked
          { raw: 'Unknown Glaze' }
        ]
      }
    ]
  }
]);

console.log('Testing scanUnlinkedRecipeIngredients() category alignment...');

const unlinked = scanUnlinkedRecipeIngredients();
console.log('Unlinked items returned:', unlinked.map(u => u.displayName));

// Apples (Fresh Produce), Sugar (Store Cupboard with isCategoryDefault), and Butter (subtype) must NOT be unlinked
assert.ok(!unlinked.some(u => /apples/i.test(u.displayName)), 'Fresh Produce category must be recognized as linked');
assert.ok(!unlinked.some(u => /sugar/i.test(u.displayName)), 'Category default Store Cupboard must be recognized as linked');
assert.ok(!unlinked.some(u => /butter/i.test(u.displayName)), 'Subtype item must be recognized as linked');

// Salt (Store Cupboard without default), Secret Spice (new_item), and Unknown Glaze must be unlinked
assert.ok(unlinked.some(u => /salt/i.test(u.displayName)), 'Generic Store Cupboard without default must be flagged as unlinked');
assert.ok(unlinked.some(u => /secret spice/i.test(u.displayName)), 'new_item must be flagged as unlinked');
assert.ok(unlinked.some(u => /unknown glaze/i.test(u.displayName)), 'Unmapped ingredient must be flagged as unlinked');

assert.equal(unlinked.length, 3, 'Expected exactly 3 unlinked phrases');

console.log('✅ Unlinked Sweeper Category Alignment tests passed!');
