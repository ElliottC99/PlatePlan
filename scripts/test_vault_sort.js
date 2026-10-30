/**
 * scripts/test_vault_sort.js
 * Checks the Vault sorter (getSortedRecipes in src/services/FitScoreService.js) after the
 * stock sorts went with Active Stock: a request for 'useup-desc', 'pantry-desc' or any
 * unknown sort falls back to fit-score order (high to low) instead of failing or keeping
 * the input order, and the fit and name sorts keep their order.
 * Run: node scripts/test_vault_sort.js
 */

import assert from 'node:assert/strict';

// FitScoreService pulls in the store, which touches window and localStorage on import.
global.window = global.window || {};
global.localStorage = global.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { getSortedRecipes } = await import('../src/services/FitScoreService.js');

// Items that carry fitScore and fitRes keep that score, so the order doesn't depend on
// household targets. The input order (b, c, a) is neither fit order nor name order.
const recipes = [
  { id: 'b', title: 'Bean Chilli', fitScore: 55, fitRes: {} },
  { id: 'c', title: 'Curry', fitScore: 90, fitRes: {} },
  { id: 'a', title: 'Aubergine Bake', fitScore: 70, fitRes: {} }
];
const ids = sortBy => getSortedRecipes(recipes.map(r => ({ ...r })), sortBy).map(r => r.id);

assert.deepEqual(ids('fit-desc'), ['c', 'a', 'b'], 'fit-desc sorts high to low');
assert.deepEqual(ids('fit-asc'), ['b', 'a', 'c'], 'fit-asc sorts low to high');
assert.deepEqual(ids('name-asc'), ['a', 'b', 'c'], 'name-asc sorts A to Z');

for (const removed of ['useup-desc', 'pantry-desc', 'no-such-sort']) {
  assert.deepEqual(ids(removed), ids('fit-desc'), `${removed} falls back to fit-desc order`);
}

console.log('test_vault_sort: all assertions passed');
