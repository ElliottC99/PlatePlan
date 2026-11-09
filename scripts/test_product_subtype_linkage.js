#!/usr/bin/env node
import assert from 'node:assert/strict';

// Setup minimal browser DOM environment
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };

const domElements = new Map();
function createMockElement(id = '', tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    innerHTML: '',
    textContent: '',
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
}

global.CustomEvent = class CustomEvent {
  constructor(type, params) {
    this.type = type;
    this.detail = params?.detail;
  }
};

global.document = {
  body: { style: {} },
  getElementById: (id) => {
    if (!domElements.has(id)) {
      domElements.set(id, createMockElement(id));
    }
    return domElements.get(id);
  },
  createElement: (tag) => createMockElement('', tag),
  querySelector: () => null,
  querySelectorAll: () => [],
  dispatchEvent: () => true
};

global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};

const { getState, setIngredients, setProducts } = await import('../src/store/store.js');
const { openProductEditModal, saveManualIng } = await import('../src/views/ProductBankView.js');

console.log('Testing Product Sub-Type Linkage and Category Field Removal...');

// Setup test state with Category > Root Item > Sub-Type
setIngredients([
  {
    id: 'ing-bread-1',
    name: 'Burger Buns',
    category: 'Bakery',
    subtypes: [
      { id: 'sub-brioche-1', name: 'Brioche Buns' }
    ]
  }
]);

// 1. Verify modal shell has no #mi-cat-search input and all three unit selects carry g, ml, units
openProductEditModal();
const modalContent = document.getElementById('view-modal-content');
assert.ok(!modalContent.innerHTML.includes('id="mi-cat-search"'), 'Category search input #mi-cat-search must be removed');
assert.ok(modalContent.innerHTML.includes('id="mi-drained-weight-unit"'), 'Drained weight unit selector must be present');

for (const selectId of ['mi-pack-unit', 'mi-item-weight-unit', 'mi-drained-weight-unit']) {
  const regex = new RegExp(`<select[^>]*id="${selectId}"[\\s\\S]*?<\\/select>`);
  const selectHtml = modalContent.innerHTML.match(regex)?.[0] || '';
  assert.ok(selectHtml.includes('value="g"'), `${selectId} must include g option`);
  assert.ok(selectHtml.includes('value="ml"'), `${selectId} must include ml option`);
  assert.ok(selectHtml.includes('value="units"'), `${selectId} must include units option`);
}

// Verify changing one unit dropdown synchronizes all three
const packUnitEl = document.getElementById('mi-pack-unit');
const itemUnitEl = document.getElementById('mi-item-weight-unit');
const drainedUnitEl = document.getElementById('mi-drained-weight-unit');

packUnitEl.value = 'ml';
packUnitEl.onchange({ target: packUnitEl });
assert.equal(itemUnitEl.value, 'ml', 'Changing pack unit to ml must sync item weight unit to ml');
assert.equal(drainedUnitEl.value, 'ml', 'Changing pack unit to ml must sync drained weight unit to ml');

drainedUnitEl.value = 'units';
drainedUnitEl.onchange({ target: drainedUnitEl });
assert.equal(packUnitEl.value, 'units', 'Changing drained unit to units must sync pack unit to units');
assert.equal(itemUnitEl.value, 'units', 'Changing drained unit to units must sync item weight unit to units');

itemUnitEl.value = 'g';
itemUnitEl.onchange({ target: itemUnitEl });
assert.equal(packUnitEl.value, 'g', 'Changing item unit to g must sync pack unit to g');
assert.equal(drainedUnitEl.value, 'g', 'Changing item unit to g must sync drained weight unit to g');

// 2. Verify saving standalone product without linked Sub-Type inherits General category cleanly
document.getElementById('mi-name').value = 'Test Standalone Jam';
window.__prefilledResolveBinding = null;
await saveManualIng();

const prodsAfterStandalone = getState().products || [];
const standaloneProd = prodsAfterStandalone.find(p => p.name === 'Test Standalone Jam');
assert.ok(standaloneProd, 'Standalone product must save even when unlinked');
assert.equal(standaloneProd.category, 'General', 'Unlinked product defaults to General');

// 3. Verify saving with linked Sub-Type inherits Category automatically
window.__prefilledResolveBinding = {
  ingredientId: 'ing-bread-1',
  subtypeId: 'sub-brioche-1'
};
document.getElementById('mi-name').value = 'Gourmet Brioche Buns';
document.getElementById('mi-drained-weight').value = '250';
document.getElementById('mi-drained-weight-unit').value = 'g';

await saveManualIng();

const prods = getState().products || [];
const savedProduct = prods.find(p => p.name === 'Gourmet Brioche Buns');

assert.ok(savedProduct, 'Product must be saved when Sub-Type is linked');
assert.equal(savedProduct.name, 'Gourmet Brioche Buns');
assert.equal(savedProduct.subtypeId, 'sub-brioche-1');
assert.equal(savedProduct.ingredientId, 'ing-bread-1');
assert.equal(savedProduct.category, 'Bakery', 'Category must be automatically derived from parent Root Item');
assert.equal(savedProduct.cat, 'bakery', 'Category slug cat must be derived automatically');
assert.equal(savedProduct.drainedWeight, 250);
assert.equal(savedProduct.drainedWeightUnit, 'g');

console.log('✅ Product Sub-Type Linkage and Category Field Removal tests passed!');
