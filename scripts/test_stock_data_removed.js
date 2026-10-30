/**
 * scripts/test_stock_data_removed.js
 * Checks that the app keeps no household stock list: the local cache drops the old
 * plateplan_inventory key and never carries a stock field, ticking a shopping item writes
 * nothing to Firestore, and the startup hydration never asks Firestore for stock records.
 * IndexedDB, localStorage, the document and Firestore are fakes.
 * Run: node scripts/test_stock_data_removed.js
 */

import assert from 'node:assert/strict';

// ---------- Fake Firestore: records every collection path asked for ----------
const collectionPaths = [];
const firestoreWrites = [];
const fixtures = {
  'households/elliott-chloe/recipes': [{ id: 'r1', name: 'Tofu Bowl', ingredients: [] }],
  'households/elliott-chloe/ingredients': [{ id: 'i1', name: 'Tofu', category: 'Tofu, Tempeh and Seitan' }],
  'households/elliott-chloe/products': [{ id: 'p1', name: 'Firm Tofu', ingredientId: 'i1', category: 'Tofu, Tempeh and Seitan' }],
  'households/elliott-chloe/inventory': [{ id: 'inv_i1', ingredientId: 'i1', status: 'in_stock' }]
};
const docFixtures = {
  'households/elliott-chloe/settings/preferences': { marker: 'prefs-from-cloud' },
  'households/elliott-chloe/settings/categories': { categories: ['Tofu, Tempeh and Seitan', 'Hydration Test Category'] },
  'households/elliott-chloe/plans/current': { weekStart: '2026-10-26', days: [] }
};
function fakeCollection(path) {
  collectionPaths.push(path);
  return {
    path,
    doc: id => fakeDoc(`${path}/${id || 'auto'}`),
    get: async () => ({ docs: (fixtures[path] || []).map(d => ({ id: d.id, data: () => ({ ...d }) })) }),
    onSnapshot: () => () => {},
    where() { return this; },
    orderBy() { return this; },
    limit() { return this; }
  };
}
function fakeDoc(path) {
  return {
    path,
    id: path.split('/').pop(),
    collection: name => fakeCollection(`${path}/${name}`),
    get: async () => ({ exists: Boolean(docFixtures[path]), id: path.split('/').pop(), data: () => ({ ...(docFixtures[path] || {}) }) }),
    set: async data => { firestoreWrites.push({ op: 'set', path, data }); },
    update: async data => { firestoreWrites.push({ op: 'update', path, data }); },
    delete: async () => { firestoreWrites.push({ op: 'delete', path }); },
    onSnapshot: () => () => {}
  };
}
const fakeDb = {
  collection: name => fakeCollection(name),
  settings: () => {},
  batch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} })
};

// ---------- Fake IndexedDB: one object store, behaviour switchable per test ----------
const idb = { blob: null, fail: false, puts: [] };
function later(req, fn) { setTimeout(() => { try { req.result = fn(); req.onsuccess && req.onsuccess(); } catch (e) { req.error = e; req.onerror && req.onerror(); } }, 0); return req; }
global.indexedDB = {
  open() {
    const req = {};
    setTimeout(() => {
      if (idb.fail) { req.error = new Error('IDB blocked'); req.onerror && req.onerror(); return; }
      req.result = {
        objectStoreNames: { contains: () => true },
        transaction: () => ({
          objectStore: () => ({
            get: () => later({}, () => (idb.blob ? JSON.parse(JSON.stringify(idb.blob)) : undefined)),
            put: payload => later({}, () => { idb.puts.push(JSON.parse(JSON.stringify(payload))); }),
            delete: () => later({}, () => undefined)
          })
        })
      };
      req.onsuccess && req.onsuccess();
    }, 0);
    return req;
  }
};

// ---------- Fake localStorage, document and window ----------
const ls = new Map();
global.localStorage = {
  getItem: k => (ls.has(k) ? ls.get(k) : null),
  setItem: (k, v) => { ls.set(k, String(v)); },
  removeItem: k => { ls.delete(k); }
};
const dispatched = [];
global.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
global.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, dispatchEvent: e => { dispatched.push(e.type); return true; },
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
  body: { style: {}, appendChild() {} }
};
const fakeUser = { uid: 'test-uid', email: 'test@example.invalid' };
global.window = {
  firebase: {
    apps: [1],
    firestore: () => fakeDb,
    auth: () => ({ currentUser: fakeUser, getRedirectResult: async () => null, onAuthStateChanged: () => () => {} })
  },
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  location: { origin: '', pathname: '' }
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

const settle = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));
const oldStock = [{ id: 'inv_old', ingredientId: 'i9', status: 'in_stock', isUseUp: true }];

const { loadStateCache, saveStateCache, initStoreCache } = await import('../src/store/cacheSlice.js');

// 1. AE1: IndexedDB holds recipes and a stale stock array; localStorage holds the old key.
{
  ls.clear();
  ls.set('plateplan_inventory', JSON.stringify(oldStock));
  idb.fail = false;
  idb.blob = { recipes: [{ id: 'r1', name: 'Cached Bowl' }], ingredients: [], products: [], inventory: oldStock };
  const target = {};
  await initStoreCache(target);
  assert.equal(ls.has('plateplan_inventory'), false, 'loading the cache removes plateplan_inventory even when IndexedDB has recipes');
  assert.equal(target.recipes.length, 1, 'the IndexedDB recipes still load');
  assert.equal('inventory' in target, false, 'initStoreCache puts no stock list into state');
  console.log('PASS 1: IndexedDB path clears the old key and loads no stock list');
}

// 2. AE1: IndexedDB fails and the localStorage fallback runs.
for (const mode of ['empty', 'fails']) {
  ls.clear();
  ls.set('plateplan_inventory', JSON.stringify(oldStock));
  ls.set('plateplan_recipes', JSON.stringify([{ id: 'r2', name: 'Fallback Bowl' }]));
  idb.fail = mode === 'fails';
  idb.blob = null;
  const loaded = await loadStateCache();
  assert.equal(loaded.recipes[0].id, 'r2', `the fallback runs (${mode})`);
  assert.equal('inventory' in loaded, false, `the fallback cache has no stock list (${mode})`);
  assert.equal(ls.has('plateplan_inventory'), false, `plateplan_inventory is removed (${mode})`);
  ls.set('plateplan_inventory', JSON.stringify(oldStock));
  const target = {};
  await initStoreCache(target);
  assert.equal(target.recipes[0].id, 'r2');
  assert.equal('inventory' in target, false, `initStoreCache puts no stock list into state (${mode})`);
  assert.equal(ls.has('plateplan_inventory'), false);
  console.log(`PASS 2 (${mode}): localStorage fallback clears the old key and carries no stock list`);
}

// 3. Saving the cache writes no stock field, even if state still has one.
{
  idb.fail = false;
  idb.puts.length = 0;
  saveStateCache({ recipes: [{ id: 'r1' }], ingredients: [], products: [], inventory: oldStock, shoppingList: [] });
  await settle(150);
  assert.equal(idb.puts.length, 1, 'one cache payload saved');
  assert.equal('inventory' in idb.puts[0], false, 'the saved payload has no stock field');
  assert.equal(idb.puts[0].recipes[0].id, 'r1');
  console.log('PASS 3: saveStateCache writes no stock field');
}

// 4. AE2: ticking a shopping item saves the tick and writes nothing to Firestore.
const { getState, toggleShoppingItem } = await import('../src/store/store.js');
{
  const state = getState();
  state.recipes = [{ id: 'r1' }];
  state.shoppingList = [{ id: 's1', ingredientId: 'i1', name: 'Tofu', buyQty: 2, unit: 'pack', isChecked: false }];
  await settle(150);
  collectionPaths.length = 0;
  firestoreWrites.length = 0;
  dispatched.length = 0;
  idb.puts.length = 0;
  await toggleShoppingItem('s1');
  await settle(150);
  assert.equal(state.shoppingList[0].isChecked, true, 'the item is ticked');
  assert.equal(idb.puts.length, 1, 'the tick is saved to the cache');
  assert.equal(idb.puts[0].shoppingList[0].isChecked, true, 'the saved cache holds the tick');
  assert.ok(dispatched.includes('plateplan:state:shoppingList'), 'plateplan:state:shoppingList is dispatched');
  assert.deepEqual(collectionPaths, [], 'no Firestore collection is touched');
  assert.deepEqual(firestoreWrites, [], 'nothing is written to Firestore');
  assert.equal(state.inventory, undefined, 'no stock list appears in state');
  console.log('PASS 4: toggleShoppingItem ticks, caches and dispatches with no Firestore call');
}

// 5. Hydration asks Firestore for no stock records, and every other read still reaches the store.
{
  const { hydrateHouseholdData, teardownRealtimeSubscriptions } = await import('../src/services/HydrationService.js');
  collectionPaths.length = 0;
  const result = await hydrateHouseholdData({ force: true });
  assert.equal(result.success, true, 'hydration succeeds');
  assert.equal(collectionPaths.some(p => /inventory/i.test(p)), false, `no stock collection requested: ${collectionPaths.filter(p => /inventory/i.test(p))}`);
  const state = getState();
  assert.deepEqual(state.recipes.map(r => r.id), ['r1'], 'recipes reach the store');
  assert.deepEqual(state.ingredients.map(i => i.id), ['i1'], 'ingredients reach the store');
  assert.deepEqual(state.products.map(p => p.id), ['p1'], 'products reach the store');
  assert.ok(state.categories.includes('Hydration Test Category'), 'categories reach the store');
  assert.equal(state.preferences.marker, 'prefs-from-cloud', 'preferences reach the store');
  assert.equal(state.currentPlan.weekStart, '2026-10-26', 'the plan reaches the store');
  assert.equal(state.inventory, undefined, 'no stock list appears in state');
  await settle(350);
  teardownRealtimeSubscriptions();
  console.log('PASS 5: hydration reads no stock and still sets recipes, ingredients, products, categories, preferences and plan');
}

console.log('\nAll stock data removal checks passed.');
process.exit(0);
