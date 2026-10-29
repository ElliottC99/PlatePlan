/**
 * scripts/test_pantry_deletes.js
 * Checks that deleting a pantry item or a product asks first, deletes the Firestore doc on
 * Confirm, and refuses while something still links to it.
 * Firestore is a fake supplied through window.firebase, and the dialogs run against a stub DOM.
 * Run: node scripts/test_pantry_deletes.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

const deleted = [];
function fakeDoc(path) {
  return {
    collection: name => fakeCollection(`${path}/${name}`),
    delete: async () => { deleted.push(path); },
    set: async () => {},
    get: async () => ({ exists: false, data: () => ({}) })
  };
}
function fakeCollection(path) {
  return { doc: id => fakeDoc(`${path}/${id}`), get: async () => ({ docs: [] }) };
}
const fakeDb = { collection: name => fakeCollection(name), settings: () => {} };

const elements = new Map();
function el(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id, innerHTML: '', onclick: null, dataset: {}, style: { setProperty() {} },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      addEventListener() {}, setAttribute() {}, hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => []
    });
  }
  return elements.get(id);
}

global.window = { firebase: { apps: [1], firestore: () => fakeDb }, addEventListener() {}, dispatchEvent() {}, location: { origin: '', pathname: '' } };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.document = {
  getElementById: id => (['view-modal-wrap', 'view-modal-content', 'btn-confirm-yes', 'btn-confirm-cancel', 'btn-alert-ok'].includes(id) ? el(id) : null),
  querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {},
  createElement: () => el(`created-${elements.size}`), body: { style: {}, appendChild() {} }
};
global.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };

const { getState, setIngredients, setProducts, setRecipes } = await import('../src/store/store.js');
const { handleDeleteIngredient } = await import('../src/views/PantryBankView.js');
const { handleDeleteProduct } = await import('../src/views/ProductBankView.js');

const modalText = () => el('view-modal-content').innerHTML;
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
function reset({ ingredients = [], products = [], recipes = [] }) {
  deleted.length = 0;
  el('view-modal-content').innerHTML = '';
  el('btn-confirm-yes').onclick = null;
  setIngredients(ingredients);
  setProducts(products);
  setRecipes(recipes);
}

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (err) {
    failures++;
    console.error(`❌ ${label}: ${err.message}`);
  }
}

console.log('=== RUNNING PANTRY DELETE SUITE ===\n');

const test1 = { id: 'ing_test1', name: 'Test 1', category: 'Bakery', subtypes: [] };

await check('Pantry "Delete Item" asks first, then deletes the item from Firestore and the store', async () => {
  reset({ ingredients: [test1, { id: 'ing_keep', name: 'Bread', subtypes: [] }] });
  assert.equal(typeof handleDeleteIngredient, 'function', 'PantryBankView exports handleDeleteIngredient');
  handleDeleteIngredient('ing_test1');
  assert.match(modalText(), /Test 1/, 'the confirm names the item');
  assert.deepEqual(deleted, [], 'nothing is deleted before Confirm');
  await el('btn-confirm-yes').onclick();
  await settle();
  assert.deepEqual(deleted, ['households/elliott-chloe/ingredients/ing_test1']);
  assert.deepEqual(getState().ingredients.map(i => i.id), ['ing_keep']);
});

await check('Pantry delete is refused while the item has sub-types, products or recipes linked', async () => {
  const cases = [
    { ingredients: [{ ...test1, subtypes: [{ id: 'st1', name: 'Seeded' }] }], expect: /sub-type/ },
    { ingredients: [test1], products: [{ id: 'p1', name: 'Loaf', ingredientId: 'ing_test1' }], expect: /product/ },
    { ingredients: [test1], recipes: [{ id: 'r1', name: 'Toast', ingredients: [{ ingredientId: 'ing_test1', name: 'Test 1' }] }], expect: /recipe/ }
  ];
  for (const c of cases) {
    reset(c);
    handleDeleteIngredient('ing_test1');
    assert.match(modalText(), c.expect);
    assert.equal(el('btn-confirm-yes').onclick, null, 'no Confirm button is offered');
    await settle();
    assert.deepEqual(deleted, []);
    assert.equal(getState().ingredients.length, 1);
  }
});

await check('The pantry "Delete Item" option calls the handler directly, not through window', () => {
  const source = fs.readFileSync(new URL('../src/views/PantryBankView.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('window.handleDeleteIngredient'), 'no window.handleDeleteIngredient lookup');
  assert.match(source, /label: 'Delete Item'[\s\S]{0,200}handleDeleteIngredient\(id\)/);
});

await check('Product delete asks first, then deletes the product from Firestore and the store', async () => {
  reset({ products: [{ id: 'p1', name: 'Seeded Loaf' }, { id: 'p2', name: 'Rolls' }] });
  await handleDeleteProduct('p1');
  assert.match(modalText(), /Seeded Loaf/);
  assert.deepEqual(deleted, []);
  await el('btn-confirm-yes').onclick();
  await settle();
  assert.deepEqual(deleted, ['households/elliott-chloe/products/p1']);
  assert.deepEqual(getState().products.map(p => p.id), ['p2']);
});

await check('Product delete does not call itself through window (it overflowed the stack)', async () => {
  reset({ products: [{ id: 'p1', name: 'Seeded Loaf' }] });
  window.handleDeleteProduct = handleDeleteProduct;
  await handleDeleteProduct('p1');
  assert.match(modalText(), /Seeded Loaf/);
});

await check('Product delete is refused while a recipe or a pantry default uses it', async () => {
  const cases = [
    { products: [{ id: 'p1', name: 'Seeded Loaf' }], recipes: [{ id: 'r1', ingredients: [{ productId: 'p1' }] }], expect: /recipe/ },
    { products: [{ id: 'p1', name: 'Seeded Loaf' }], ingredients: [{ id: 'i1', name: 'Bread', defaultProductId: 'p1', subtypes: [] }], expect: /default/ },
    { products: [{ id: 'p1', name: 'Seeded Loaf' }], ingredients: [{ id: 'i1', name: 'Bread', subtypes: [{ id: 's1', name: 'Seeded', defaultProductId: 'p1' }] }], expect: /default/ },
    // Saved items hold the auto-default product by name, not by ID.
    { products: [{ id: 'p1', name: 'Seeded Loaf' }], ingredients: [{ id: 'i1', name: 'Bread', autoDefaultProduct: 'Seeded Loaf', subtypes: [] }], expect: /default/ }
  ];
  for (const c of cases) {
    reset(c);
    await handleDeleteProduct('p1');
    assert.match(modalText(), c.expect);
    assert.equal(el('btn-confirm-yes').onclick, null);
    await settle();
    assert.deepEqual(deleted, []);
  }
});

if (failures === 0) {
  console.log('\n=== ALL PANTRY DELETE TESTS PASSED ===');
  process.exit(0);
} else {
  console.error(`\n=== ${failures} PANTRY DELETE TESTS FAILED ===`);
  process.exit(1);
}
