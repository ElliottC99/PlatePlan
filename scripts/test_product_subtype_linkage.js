#!/usr/bin/env node
import assert from 'node:assert/strict';

// Setup minimal browser DOM environment
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };

const domElements = new Map();
function createMockElement(id = '', tag = 'div') {
  const el = {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    innerHTML: '',
    textContent: '',
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    querySelector: (sel) => {
      if (sel.startsWith('#')) {
        const tid = sel.slice(1);
        if (!domElements.has(tid)) domElements.set(tid, createMockElement(tid));
        return domElements.get(tid);
      }
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  return el;
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
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true
};

global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => true
};

const { getState, setIngredients, setProducts } = await import('../src/store/store.js');
const { openProductEditModal, saveManualIng, renderLinkageContainer } = await import('../src/views/ProductBankView.js');

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

// 4. Verify draft sub-type displays locked chip in renderLinkageContainer instead of mandatory search dropdown
window.__prefilledResolveBinding = {
  ingredientId: 'ing-bread-1',
  subtypeDraftName: 'Sesame Brioche',
  parentCategory: 'Bakery'
};
renderLinkageContainer(null, window.__prefilledResolveBinding);
const linkageEl = document.getElementById('mi-linkage-container');
assert.ok(linkageEl.innerHTML.includes('New Sub-Type'), 'Draft sub-type must render New Sub-Type tag');
assert.ok(linkageEl.innerHTML.includes('Sesame Brioche'), 'Draft sub-type must display draft sub-type name');
assert.ok(linkageEl.innerHTML.includes('Bakery'), 'Draft sub-type must display category');
assert.ok(linkageEl.innerHTML.includes('Burger Buns'), 'Draft sub-type must display root item');
assert.ok(!linkageEl.innerHTML.includes('Pantry Sub-Type Linkage *'), 'Must not render search dropdown prompt when draft sub-type is bound');

// Verify clicking "Change" clears draft binding and falls back to search input
const changeBtn = domElements.get('mi-change-subtype-btn');
assert.ok(changeBtn && typeof changeBtn.onclick === 'function', 'Change button must be wired with an onclick handler');
changeBtn.onclick();
assert.equal(window.__prefilledResolveBinding.subtypeDraftName, null, 'Change button must clear subtypeDraftName');
assert.ok(linkageEl.innerHTML.includes('Pantry Sub-Type Linkage'), 'Linkage container must fall back to search input after clicking Change');
assert.ok(linkageEl.innerHTML.includes('mi-tax-search-mount'), 'Linkage container must render search mount after clicking Change');

// Re-bind draft sub-type for step 5
window.__prefilledResolveBinding = {
  ingredientId: 'ing-bread-1',
  subtypeDraftName: 'Sesame Brioche',
  parentCategory: 'Bakery'
};
renderLinkageContainer(null, window.__prefilledResolveBinding);

// 5. Verify saving with draft sub-type triggers atomic creation and binds new subtypeId
document.getElementById('mi-name').value = 'Artisan Sesame Brioche Buns';
await saveManualIng();

const ingsAfterDraft = getState().ingredients || [];
const rootItem = ingsAfterDraft.find(i => i.id === 'ing-bread-1');
assert.ok(rootItem, 'Parent root item must exist in ingredients');
const newSub = (rootItem.subtypes || []).find(s => s.name === 'Sesame Brioche');
assert.ok(newSub, 'New sub-type "Sesame Brioche" must be atomically created under root item');
assert.ok(newSub.id, 'New sub-type must have an assigned id');

const prodsAfterDraft = getState().products || [];
const savedDraftProd = prodsAfterDraft.find(p => p.name === 'Artisan Sesame Brioche Buns');
assert.ok(savedDraftProd, 'Product with draft sub-type must be saved in products');
assert.equal(savedDraftProd.ingredientId, 'ing-bread-1');
assert.equal(savedDraftProd.subtypeId, newSub.id, 'Product must be linked to the newly created sub-type ID');
assert.equal(savedDraftProd.category, 'Bakery');

console.log('✅ Product Sub-Type Linkage and Category Field Removal tests passed!');
