/**
 * scripts/test_pantry_deletes.js
 * Checks that the pantry's Delete Item and Delete Sub-type open the guided delete, which saves
 * nothing until Delete, and that product delete asks first and refuses while a recipe uses it.
 * Firestore is a fake supplied through window.firebase, and the dialogs run against a stub DOM.
 * Run: node scripts/test_pantry_deletes.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

const deleted = [];
const saved = [];
function fakeCollection(path) {
  return { doc: id => fakeDoc(`${path}/${id}`), get: async () => ({ docs: [] }) };
}
const batches = [];
const fakeDb = {
  collection: name => fakeCollection(name),
  settings: () => {},
  batch() {
    const ops = [];
    const batch = {
      ops,
      set(ref) { ops.push(`set ${ref.path}`); },
      delete(ref) { ops.push(`delete ${ref.path}`); },
      commit: () => new Promise(resolve => setTimeout(resolve, 5))
    };
    batches.push(batch);
    return batch;
  }
};
function fakeDoc(path) {
  return {
    path,
    collection: name => fakeCollection(`${path}/${name}`),
    delete: async () => { deleted.push(path); },
    set: async data => { saved.push({ path, data }); },
    get: async () => ({ exists: false, data: () => ({}) })
  };
}

const elements = new Map();
function el(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id, innerHTML: '', value: '', textContent: '', hidden: false, onclick: null, dataset: {}, style: { setProperty() {} }, focus() { this.focused = true; },
      classes: new Set(),
      classList: { add(c) { this.owner.classes.add(c); }, remove(c) { this.owner.classes.delete(c); }, toggle() {}, contains(c) { return this.owner.classes.has(c); } },
      listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, setAttribute() {}, hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => []
    });
  }
  const e = elements.get(id);
  e.classList.owner = e;
  e.querySelectorAll = sel => {
    if (sel !== '.product-picker-cb') return [];
    if (e.boxesFor !== e.innerHTML) { e.boxesFor = e.innerHTML; e.boxes = [...e.innerHTML.matchAll(/class="product-picker-cb" value="([^"]+)"/g)].map(m => ({ value: m[1], checked: false, onchange: null })); }
    return e.boxes;
  };
  return e;
}

global.window = { firebase: { apps: [1], firestore: () => fakeDb }, addEventListener() {}, dispatchEvent() {}, location: { origin: '', pathname: '' } };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.document = {
  getElementById: id => (['view-modal-wrap', 'view-modal-content', 'btn-confirm-yes', 'btn-confirm-cancel', 'btn-alert-ok', 'bank-groups-panel', 'product-bank-cards-wrap', 'product-bank-search'].includes(id) || /^(mi-|picker-|tesco-|realloc|new-reallocate-|new-sub-|create-ingredient|btn-(review|cancel)-tesco|btn-confirm-(picker|realloc)|btn-(toggle|save|cancel)-create-sub)/.test(id) ? el(id) : null),
  querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {},
  createElement: () => el(`created-${elements.size}`), body: { style: {}, appendChild() {} }
};
global.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

const { getState, setIngredients, setProducts, setRecipes } = await import('../src/store/store.js');
const { openGuidedDelete } = await import('../src/components/pantry/GuidedDeleteModalUI.js');
const { handleDeleteProduct, openProductEditModal, renderProductBank } = await import('../src/views/ProductBankView.js');
const { routeAction } = await import('../src/services/ActionBridge.js');

const modalText = () => el('view-modal-content').innerHTML;
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
function reset({ ingredients = [], products = [], recipes = [] }) {
  deleted.length = 0;
  saved.length = 0;
  batches.length = 0;
  el('view-modal-content').innerHTML = '';
  el('btn-confirm-yes').onclick = null;
  setIngredients(ingredients);
  setProducts(products);
  setRecipes(recipes);
}

// Taps a guided-delete control the way the delegated listener on the modal content sees it.
function tap(gd, data = {}) {
  const target = { dataset: { gd, ...data }, disabled: false };
  return el('view-modal-content').listeners.click({ target: { closest: () => target } });
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

await check('Covers AE1: deleting "Test 1" through the guided delete is one confirm and one item delete', async () => {
  reset({ ingredients: [test1, { id: 'ing_keep', name: 'Bread', subtypes: [] }] });
  let done = 0;
  openGuidedDelete({ kind: 'item', id: 'ing_test1' }, { onDone: () => { done++; } });
  assert.match(modalText(), /Test 1/);
  assert.match(modalText(), /Nothing else uses it/);
  assert.match(modalText(), /data-gd="delete"/, 'Delete is offered on the first step');
  assert.equal(batches.length, 0, 'nothing is saved before Delete');
  await tap('delete');
  await settle();
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0].ops, ['delete households/elliott-chloe/ingredients/ing_test1']);
  assert.deepEqual(getState().ingredients.map(i => i.id), ['ing_keep']);
  assert.equal(done, 1, 'the pantry re-renders after the delete');
});

const withLinks = () => ({
  ingredients: [
    { id: 'ing_old', name: 'Old bread', category: 'Bakery', subtypes: [{ id: 'sub_old', name: 'Seeded' }] },
    { id: 'ing_keep', name: 'Bread', category: 'Bakery', subtypes: [{ id: 'sub_keep', name: 'White' }] }
  ],
  products: [{ id: 'p1', name: 'Seeded Loaf', ingredientId: 'ing_old', subtypeId: 'sub_old' }]
});

await check('Covers AE6: cancelling at the summary after choosing a home saves nothing', async () => {
  reset(withLinks());
  openGuidedDelete({ kind: 'item', id: 'ing_old' });
  await tap('next');
  assert.match(modalText(), /1 product still needs a home/);
  await tap('pick-productsAll');
  await tap('pick-row', { row: '0' });
  assert.match(modalText(), /Bread › White/);
  await tap('next');
  assert.match(modalText(), /data-gd="delete"/);
  await tap('cancel');
  await settle();
  assert.equal(batches.length, 0);
  assert.equal(getState().products[0].subtypeId, 'sub_old');
  assert.equal(getState().ingredients.length, 2);
});

await check('adding a new sub-type with no name keeps the name prompt open and adds nothing', async () => {
  reset(withLinks());
  openGuidedDelete({ kind: 'item', id: 'ing_old' });
  await tap('next');
  await tap('pick-productsAll');
  const rows = modalText().match(/data-row="(\d+)"[^>]*>New sub-type under Bread/);
  assert.ok(rows, 'the picker offers a new sub-type under Bread');
  await tap('pick-row', { row: rows[1] });
  await tap('new-add');
  assert.match(modalText(), /needs a name/);
  assert.match(modalText(), /gd-new-name/, 'still asking for the name');
  await tap('picker-cancel');
  await tap('picker-cancel');
  assert.match(modalText(), /1 product still needs a home/, 'no error left behind');
});

await check('offline, Delete opens no batch and says nothing was deleted', async () => {
  reset({ ingredients: [test1] });
  openGuidedDelete({ kind: 'item', id: 'ing_test1' });
  navigator.onLine = false;
  await tap('delete');
  navigator.onLine = true;
  await settle();
  assert.equal(batches.length, 0);
  assert.match(modalText(), /offline\. Nothing was deleted/);
});

await check('a second Delete tap while the first is saving opens no second batch', async () => {
  reset({ ingredients: [test1] });
  openGuidedDelete({ kind: 'item', id: 'ing_test1' });
  const first = tap('delete');
  const second = tap('delete');
  await Promise.all([first, second]);
  await settle();
  assert.equal(batches.length, 1);
});

await check('Delete Item and Delete Sub-type open the guided delete directly, not through window', () => {
  const source = fs.readFileSync(new URL('../src/views/PantryBankView.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('window.handleDeleteIngredient'), 'no window.handleDeleteIngredient lookup');
  assert.match(source, /label: 'Delete Item'[\s\S]{0,200}openGuidedDelete\(\{ kind: 'item'/);
  assert.match(source, /label: 'Delete Sub-type'[\s\S]{0,200}openGuidedDelete\(\{ kind: 'subtype'/);
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

await check('Product delete is refused while a recipe uses it', async () => {
  reset({ products: [{ id: 'p1', name: 'Seeded Loaf' }], recipes: [{ id: 'r1', ingredients: [{ productId: 'p1' }] }] });
  await handleDeleteProduct('p1');
  assert.match(modalText(), /recipe/);
  assert.equal(el('btn-confirm-yes').onclick, null);
  await settle();
  assert.deepEqual(deleted, []);
});

await check('Covers AE5: a product saved as a default but used in no recipe asks to confirm and is deleted', async () => {
  const cases = [
    { ingredients: [{ id: 'i1', name: 'Bread', defaultProductId: 'p1', subtypes: [] }] },
    { ingredients: [{ id: 'i1', name: 'Bread', subtypes: [{ id: 's1', name: 'Seeded', defaultProductId: 'p1' }] }] },
    { ingredients: [{ id: 'i1', name: 'Bread', autoDefaultProduct: 'Seeded Loaf', subtypes: [] }] }
  ];
  for (const c of cases) {
    reset({ products: [{ id: 'p1', name: 'Seeded Loaf' }], ...c });
    await handleDeleteProduct('p1');
    assert.match(modalText(), /Delete &quot;Seeded Loaf&quot;\?/);
    await el('btn-confirm-yes').onclick();
    await settle();
    assert.deepEqual(deleted, ['households/elliott-chloe/products/p1']);
  }
});

await check('deleting a product that is a saved default clears that default', async () => {
  reset({ products: [{ id: 'p1', name: 'Seeded Loaf' }], ingredients: [
    { id: 'i1', name: 'Bread', defaultProductId: 'p1', subtypes: [{ id: 's1', name: 'Seeded', defaultProductId: 'p1' }, { id: 's2', name: 'White', defaultProductId: 'p9' }] }
  ] });
  await handleDeleteProduct('p1');
  await el('btn-confirm-yes').onclick();
  await settle();
  const bread = getState().ingredients[0];
  assert.equal(bread.defaultProductId, null);
  assert.equal(bread.subtypes[0].defaultProductId, null);
  assert.equal(bread.subtypes[1].defaultProductId, 'p9', 'other defaults untouched');
});

// The bridge's document-level listener hands every data-action click to routeAction.
const route = (action, dataset = {}) => routeAction(action, { dataset, getAttribute: () => null, closest: () => null, value: '' }, { preventDefault() {}, stopPropagation() {} });
const dataOf = (html, action) => {
  const tag = html.match(new RegExp(`<[^>]*data-action="${action}"[^>]*>`))?.[0] || '';
  return { subtypeId: tag.match(/data-subtype-id="([^"]*)"/)?.[1], parentId: tag.match(/data-parent-id="([^"]*)"/)?.[1] };
};
const actionsIn = html => [...html.matchAll(/data-action="([^"]+)"[^>]*>([^<]*)</g)].map(m => [m[2].trim(), m[1]]);

await check('Edit product: Save saves the edited product', async () => {
  reset({ products: [{ id: 'p1', name: 'Seeded Loaf', category: 'Bakery' }] });
  openProductEditModal('p1');
  const save = actionsIn(modalText()).find(([label]) => label === 'Save');
  assert.ok(save, 'Save carries a data-action');
  el('mi-name').value = 'Seeded Loaf 800g';
  assert.equal(route(save[1]), true, 'the bridge routes Save');
  await settle();
  assert.ok(saved.some(w => w.path === 'households/elliott-chloe/products/p1' && w.data.name === 'Seeded Loaf 800g'), 'the product is written');
  assert.equal(getState().products.find(p => p.id === 'p1').name, 'Seeded Loaf 800g');
});

await check('Edit product: Cancel closes the form without saving', async () => {
  reset({ products: [{ id: 'p1', name: 'Seeded Loaf' }] });
  openProductEditModal('p1');
  assert.ok(el('view-modal-wrap').classList.contains('open'));
  const cancel = actionsIn(modalText()).find(([label]) => label === 'Cancel');
  assert.ok(cancel, 'Cancel carries a data-action');
  assert.equal(route(cancel[1]), true, 'the bridge routes Cancel');
  assert.ok(!el('view-modal-wrap').classList.contains('open'));
  assert.deepEqual(saved, []);
});

await check('Empty Product Bank: "+ Add Product" opens the product form and "Import Tesco" opens the Tesco import', async () => {
  reset({ products: [] });
  delete window.openTescoImportModal; // a fresh load: no Pantry dialog has put it on window yet
  renderProductBank();
  const buttons = Object.fromEntries(actionsIn(el('product-bank-cards-wrap').innerHTML));
  assert.ok(buttons['+ Add Product'] && buttons['Import Tesco'], 'both buttons carry a data-action');
  el('view-modal-content').innerHTML = '';
  assert.equal(route(buttons['+ Add Product']), true);
  assert.match(modalText(), /mi-save-btn/, 'the product form opened');
  assert.equal(route(buttons['Import Tesco']), true);
  await settle();
  assert.match(modalText(), /tesco-json-input/, 'the Tesco import opened');
});

await check('the Product Bank header\'s Import Tesco is a routed action', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const bank = html.slice(html.indexOf('<div id="view-bank"'), html.indexOf('<div id="view-planner"'));
  assert.match(bank, /data-action="tesco-import"[^>]*>Import Tesco</);
});

// ---- Pantry › sub-type › Link Product (plan 2026-10-29-2038, U1 and U2) ----

const bread = () => ({
  ingredients: [{ id: 'ing_bread', name: 'Bread', category: 'Bakery', subtypes: [{ id: 'sub_seeded', name: 'Seeded' }] }],
  products: [{ id: 'p_white', name: 'White Loaf', category: 'Bakery' }]
});
const { openSubtypeLinkSelectionModal, openSubtypeExistingProductPickerModal } = await import('../src/components/pantry/SubtypeProductLinkerModalUI.js');

async function linkRoute(action) {
  openSubtypeLinkSelectionModal('sub_seeded', 'ing_bread');
  assert.equal(route(action, dataOf(modalText(), action)), true, `${action} is routed`);
  await settle();
}

await check('Covers AE1: Link existing opens the picker for the sub-type, and Confirm links the product', async () => {
  reset(bread());
  await linkRoute('link-existing-product');
  assert.match(modalText(), /Select Existing Products for &quot;Seeded&quot;|Select Existing Products for "Seeded"/);
  const box = el('picker-product-list').querySelectorAll('.product-picker-cb').find(b => b.value === 'p_white');
  box.checked = true;
  box.onchange();
  await el('btn-confirm-picker-link').onclick();
  await settle();
  const linked = saved.find(w => w.path === 'households/elliott-chloe/products/p_white');
  assert.deepEqual([linked?.data.subtypeId, linked?.data.ingredientId], ['sub_seeded', 'ing_bread']);
});

await check('Add to Bank links an existing product with the picker\'s own save, in the right argument order', () => {
  const source = fs.readFileSync(new URL('../src/components/pantry/AddToBankHubUI.js', import.meta.url), 'utf8');
  assert.match(source, /openSubtypeExistingProductPickerModal\(targetSubtypeId, parentItemId\);/);
});

await check('Covers AE2: Add product manually opens the form pre-linked, and Save stores it on the sub-type', async () => {
  reset(bread());
  await linkRoute('link-manual-product');
  assert.match(modalText(), /mi-save-btn/);
  el('mi-name').value = 'Seeded Bloomer';
  route('save-manual-ing');
  await settle();
  const created = saved.find(w => w.path.startsWith('households/elliott-chloe/products/') && w.data.name === 'Seeded Bloomer');
  assert.deepEqual([created?.data.subtypeId, created?.data.ingredientId], ['sub_seeded', 'ing_bread']);
});

await check('Covers AE3: Import from Tesco reviews the bookmarklet output and Save stores it on the sub-type', async () => {
  reset(bread());
  await linkRoute('link-tesco-product');
  assert.match(modalText(), /tesco-json-input/);
  el('tesco-json-input').value = JSON.stringify({ title: 'Tesco Seeded Batch Loaf 800G', brand: 'Tesco', price: 1.4 });
  el('btn-review-tesco-import').onclick();
  await new Promise(resolve => setTimeout(resolve, 200)); // the review step opens the form after 150 ms
  assert.match(modalText(), /mi-save-btn/, 'the product form opened');
  route('save-manual-ing');
  await settle();
  const created = saved.find(w => w.path.startsWith('households/elliott-chloe/products/') && /Seeded Batch Loaf/.test(w.data.name));
  assert.deepEqual([created?.data.subtypeId, created?.data.ingredientId], ['sub_seeded', 'ing_bread']);
});

await check('a cancelled Add product manually does not pre-link the next new product', async () => {
  reset(bread());
  await linkRoute('link-manual-product');
  route('cancel-manual-ing');
  route('open-product-modal');
  el('mi-name').value = 'Unrelated Jam';
  route('save-manual-ing');
  await settle();
  const created = saved.find(w => w.data.name === 'Unrelated Jam');
  assert.ok(created, 'the product is written');
  assert.ok(!created.data.subtypeId && !created.data.ingredientId, 'not linked to Seeded');
});

await check('Covers AE4: Cancel closes the link, picker, Tesco import and reallocate dialogs without saving', async () => {
  const { promptReallocateProduct } = await import('../src/views/ProductBankView.js');
  const opens = [
    () => openSubtypeLinkSelectionModal('sub_seeded', 'ing_bread'),
    () => openSubtypeExistingProductPickerModal('sub_seeded', 'ing_bread'),
    async () => { (await import('../src/components/pantry/SubtypeProductLinkerModalUI.js')).openTescoImportModal('sub_seeded', 'ing_bread'); },
    () => promptReallocateProduct('p_white')
  ];
  for (const open of opens) {
    reset(bread());
    await open();
    await settle();
    assert.ok(el('view-modal-wrap').classList.contains('open'), 'the dialog opened');
    assert.match(modalText(), /data-action="close-pantry-dialog"/);
    assert.equal(route('close-pantry-dialog'), true);
    await settle();
    assert.ok(!el('view-modal-wrap').classList.contains('open'), 'the dialog closed');
    assert.deepEqual(saved, []);
  }
});

// ---- Edit product › Paste/update from Tesco (plan 2026-10-29-2038, U4) ----

const loaf = () => ({ products: [{ id: 'p1', name: 'Seeded Loaf', brand: 'Tesco', notes: 'Freeze half', price: 1.2, prot: 9, fibre: 5, storage: 'fridge', category: 'Bakery' }] });
const tescoPaste = JSON.stringify({
  name: 'Tesco Seeded Batch Loaf 800G', brand: 'Tesco', price: 1.45,
  diagnostics: { sourceValues: { cal: null, prot: '10.1g', carb: null, fat: null, fibre: null }, parsedValues: { cal: 0, prot: 10.1, carb: 0, fat: 0, fibre: 0 }, breadcrumbs: '', storageText: '' }
});
function openPaste() {
  openProductEditModal('p1');
  assert.match(modalText(), /data-action="tesco-update"/, 'Paste/update from Tesco is a routed action');
  assert.equal(el('mi-tesco-paste').hidden, true, 'the paste box starts closed');
  assert.equal(route('tesco-update'), true);
  assert.equal(el('mi-tesco-paste').hidden, false, 'the paste box opens');
  assert.ok(el('mi-tesco-json').focused, 'focus moves to the paste box');
}

await check('Covers AE5: pasting bookmarklet output updates only the fields it carries, and nothing is saved', () => {
  reset(loaf());
  openPaste();
  el('mi-tesco-json').value = tescoPaste;
  assert.equal(route('tesco-update-apply'), true);
  assert.equal(String(el('mi-price').value), '1.45');
  assert.equal(String(el('mi-prot').value), '10.1');
  assert.equal(String(el('mi-fibre').value), '5', 'fibre was not in the paste');
  assert.equal(el('mi-storage').value, 'fridge', 'no breadcrumbs, so storage is not guessed');
  assert.equal(el('mi-notes').value, 'Freeze half');
  assert.match(el('mi-tesco-updated').textContent, /price/);
  assert.match(el('mi-tesco-updated').textContent, /protein/);
  assert.doesNotMatch(el('mi-tesco-updated').textContent, /fibre/);
  assert.equal(el('mi-tesco-paste').hidden, true, 'the paste box closes');
  assert.equal(el('mi-tesco-json').value, '', 'the paste is cleared');
  assert.deepEqual(saved, []);
});

await check('Covers AE6: a paste that is not bookmarklet output shows an error and changes nothing', () => {
  for (const paste of ['not json at all', '']) {
    reset(loaf());
    openPaste();
    el('mi-tesco-json').value = paste;
    route('tesco-update-apply');
    assert.ok(el('mi-tesco-error').textContent.length > 0, `error shown for "${paste}"`);
    assert.equal(String(el('mi-price').value), '1.2');
    assert.equal(el('mi-tesco-paste').hidden, false, 'the box stays open');
  }
});

await check('tapping Paste/update from Tesco again hides the box', () => {
  reset(loaf());
  openPaste();
  route('tesco-update');
  assert.equal(el('mi-tesco-paste').hidden, true);
});

if (failures === 0) {
  console.log('\n=== ALL PANTRY DELETE TESTS PASSED ===');
  process.exit(0);
} else {
  console.error(`\n=== ${failures} PANTRY DELETE TESTS FAILED ===`);
  process.exit(1);
}
