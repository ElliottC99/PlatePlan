/**
 * scripts/test_pantry_guided_delete.js
 * Checks the guided delete planner, the recipe-line remap rule and the one-batch apply in
 * src/services/PantryTaxonomyService.js (plan docs/plans/2026-10-29-1810-feat-pantry-guided-delete-plan.md).
 * Firestore is a fake supplied through window.firebase; every batch it opens is recorded.
 * Run: node scripts/test_pantry_guided_delete.js
 */

import assert from 'node:assert/strict';

const batches = [];
let failNextCommit = false;
function fakeDocRef(path) {
  return { path, collection: name => fakeCollection(`${path}/${name}`), set: async () => {}, delete: async () => {}, get: async () => ({ exists: false, data: () => ({}) }) };
}
function fakeCollection(path) {
  return { doc: id => fakeDocRef(`${path}/${id ?? 'auto'}`), get: async () => ({ docs: [] }) };
}
const fakeDb = {
  collection: name => fakeCollection(name),
  settings() {},
  batch() {
    const ops = [];
    const batch = {
      ops,
      committed: false,
      set(ref, data, options) { ops.push({ op: 'set', path: ref.path, data, options }); },
      delete(ref) { ops.push({ op: 'delete', path: ref.path }); },
      async commit() {
        if (failNextCommit) { failNextCommit = false; throw new Error('permission-denied'); }
        batch.committed = true;
      }
    };
    batches.push(batch);
    return batch;
  }
};

global.window = { firebase: { apps: [1], firestore: () => fakeDb }, addEventListener() {}, dispatchEvent() {}, location: { origin: '', pathname: '' } };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, dispatchEvent() {} };
global.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

const { getState, setIngredients, setProducts, setRecipes, setCategories } = await import('../src/store/store.js');
const { planGuidedDelete, applyGuidedDelete } = await import('../src/services/PantryTaxonomyService.js');

// The batch limit the plan sets (KTD2): one Firestore batch holds 500 writes, the delete stays under 450.
const WRITE_LIMIT = 450;

const HH = 'households/elliott-chloe';

function pantry() {
  return {
    categories: ['Bakery', 'Dairy', 'Grains'],
    ingredients: [
      { id: 'ing_test1', name: 'Test 1', category: 'Bakery', subtypes: [] },
      { id: 'ing_bread', name: 'Bread', category: 'Bakery', subtypes: [{ id: 'sub_seeded', name: 'Seeded', parentId: 'ing_bread' }, { id: 'sub_white', name: 'White', parentId: 'ing_bread' }] },
      { id: 'ing_rolls', name: 'Rolls', category: 'Bakery', subtypes: [{ id: 'sub_brioche', name: 'Brioche', parentId: 'ing_rolls' }] },
      { id: 'ing_milk', name: 'Milk', category: 'Dairy', subtypes: [{ id: 'sub_oat', name: 'Oat', parentId: 'ing_milk' }] },
      { id: 'ing_rice', name: 'Rice', category: 'Grains', subtypes: [{ id: 'sub_basmati', name: 'Basmati', parentId: 'ing_rice' }] }
    ],
    products: [
      { id: 'p_seeded1', name: 'Seeded Loaf', ingredientId: 'ing_bread', subtypeId: 'sub_seeded', subTypeId: 'sub_seeded', category: 'Bakery', isAutoDefault: true },
      { id: 'p_seeded2', name: 'Big Seeded', ingredientId: 'ing_bread', subtypeId: 'sub_seeded', category: 'Bakery' },
      { id: 'p_white', name: 'White Loaf', ingredientId: 'ing_bread', subtypeId: 'sub_white', category: 'Bakery' },
      { id: 'p_oat', name: 'Oat Drink', ingredientId: 'ing_milk', subtypeId: 'sub_oat', category: 'Dairy' }
    ],
    recipes: []
  };
}

function load(s) {
  batches.length = 0;
  setCategories(s.categories);
  setIngredients(s.ingredients);
  setProducts(s.products);
  setRecipes(s.recipes);
  return getState();
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

console.log('=== RUNNING PANTRY GUIDED DELETE SUITE ===\n');

// ---- U2: remap rule, driven through the planner ----

// Deletes Bread › Seeded (moving its products to Oat) with one recipe line on it, remapped to target.
function remapThroughPlan(line, target) {
  const s = pantry();
  s.recipes = [{ id: 'r_remap', name: 'Toast', ingredients: [line] }];
  const plan = planGuidedDelete(load(s), { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' }, linesAll: target });
  assert.deepEqual(plan.errors, []);
  return plan.writes.find(w => w.type === 'recipe').data.ingredients[0];
}

const lineOnSeeded = { name: 'Bread (Seeded)', qty: 2, unit: 'slice', raw: '2 slices seeded bread', ingredientId: 'ing_bread', pantryItemId: 'ing_bread', bankId: 'ing_bread', groupId: 'grp_ing_bread', subtypeId: 'sub_seeded', subtypeName: 'Seeded', productId: 'p_seeded1', productName: 'Seeded Loaf', categoryId: 'Bakery' };

await check('a line remapped to a root item points only at that item', () => {
  const out = remapThroughPlan(lineOnSeeded, { kind: 'item', itemId: 'ing_rolls' });
  assert.equal(out.ingredientId, 'ing_rolls');
  assert.equal(out.pantryItemId, 'ing_rolls');
  assert.equal(out.bankId, 'ing_rolls');
  assert.equal(out.groupId, 'grp_ing_rolls');
  assert.equal(out.categoryId, 'Bakery');
  for (const k of ['subtypeId', 'subtypeName', 'productId', 'productName']) assert.ok(!out[k], `${k} cleared`);
});

await check('a line remapped to a category keeps only the category', () => {
  const out = remapThroughPlan(lineOnSeeded, { kind: 'category', name: 'Grains' });
  assert.equal(out.categoryId, 'Grains');
  for (const k of ['ingredientId', 'pantryItemId', 'bankId', 'groupId', 'subtypeId', 'subtypeName', 'productId', 'productName']) assert.ok(!out[k], `${k} cleared`);
});

await check('a line remapped to a sub-type points at the sub-type and its parent', () => {
  const out = remapThroughPlan(lineOnSeeded, { kind: 'subtype', itemId: 'ing_milk', subtypeId: 'sub_oat' });
  assert.deepEqual([out.ingredientId, out.subtypeId, out.subtypeName, out.groupId, out.categoryId], ['ing_milk', 'sub_oat', 'Oat', 'grp_ing_milk', 'Dairy']);
  assert.ok(!out.productId);
});

await check('remapping keeps qty, unit and raw, and leaves no field naming the old target', () => {
  for (const target of [{ kind: 'item', itemId: 'ing_rolls' }, { kind: 'category', name: 'Grains' }, { kind: 'subtype', itemId: 'ing_milk', subtypeId: 'sub_oat' }]) {
    const out = remapThroughPlan(lineOnSeeded, target);
    assert.deepEqual([out.qty, out.unit, out.raw], [2, 'slice', '2 slices seeded bread']);
    const text = JSON.stringify(out);
    for (const old of ['ing_bread', 'sub_seeded', 'p_seeded1']) assert.ok(!text.includes(old), `${old} gone for ${target.kind}`);
  }
});

// ---- U1: planner ----

await check('Covers AE1: deleting "Test 1" with nothing linked is a single item delete', () => {
  const s = load(pantry());
  const plan = planGuidedDelete(s, { kind: 'item', id: 'ing_test1' });
  assert.equal(plan.products.length, 0);
  assert.equal(plan.lines.length, 0);
  assert.equal(plan.needsHome, 0);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.writes, [{ type: 'deleteItem', id: 'ing_test1' }]);
});

await check('an item with two sub-types and no links removes both sub-types with one item delete', () => {
  const s = pantry();
  s.products = s.products.filter(p => p.ingredientId !== 'ing_bread');
  const plan = planGuidedDelete(load(s), { kind: 'item', id: 'ing_bread' });
  assert.deepEqual(plan.removed.subtypes.map(st => st.id).sort(), ['sub_seeded', 'sub_white']);
  assert.deepEqual(plan.writes, [{ type: 'deleteItem', id: 'ing_bread' }]);
});

await check('a sub-type with two products lists both, then moves them all to one sub-type', () => {
  const s = load(pantry());
  const before = planGuidedDelete(s, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' });
  assert.deepEqual(before.products.filter(p => p.needsHome).map(p => p.product.id).sort(), ['p_seeded1', 'p_seeded2']);
  const plan = planGuidedDelete(s, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' } });
  assert.equal(plan.needsHome, 0);
  const moved = plan.writes.filter(w => w.type === 'product').map(w => w.data);
  assert.equal(moved.length, 2);
  for (const p of moved) assert.deepEqual([p.subtypeId, p.ingredientId, p.category], ['sub_oat', 'ing_milk', 'Dairy']);
  const item = plan.writes.find(w => w.type === 'item');
  assert.deepEqual(item.data.subtypes.map(st => st.id), ['sub_white']);
});

await check('a moved product is written with isAutoDefault false and its legacy subTypeId updated', () => {
  const s = load(pantry());
  const plan = planGuidedDelete(s, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' } });
  const p = plan.writes.find(w => w.type === 'product' && w.data.id === 'p_seeded1').data;
  assert.equal(p.isAutoDefault, false);
  assert.equal(p.subTypeId, 'sub_oat');
});

await check('Covers AE2: products moved to a new sub-type under another item create it in the same write list', () => {
  const s = load(pantry());
  const plan = planGuidedDelete(s, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' }, {
    newSubtypes: [{ id: 'sub_new', itemId: 'ing_rolls', name: 'Seeded rolls' }],
    productsAll: { itemId: 'ing_rolls', subtypeId: 'sub_new' }
  });
  assert.deepEqual(plan.errors, []);
  const rolls = plan.writes.find(w => w.type === 'item' && w.data.id === 'ing_rolls');
  assert.ok(rolls.data.subtypes.some(st => st.id === 'sub_new' && st.name === 'Seeded rolls' && st.parentId === 'ing_rolls'));
  const moved = plan.writes.filter(w => w.type === 'product');
  assert.equal(moved.length, 2);
  for (const w of moved) assert.equal(w.data.subtypeId, 'sub_new');
});

await check('a new sub-type with a blank or duplicate name is an error', () => {
  const s = load(pantry());
  for (const name of ['  ', 'brioche']) {
    const plan = planGuidedDelete(s, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' }, {
      newSubtypes: [{ id: 'sub_new', itemId: 'ing_rolls', name }], productsAll: { itemId: 'ing_rolls', subtypeId: 'sub_new' }
    });
    assert.ok(plan.errors.length > 0, `name "${name}" refused`);
  }
});

await check('a legacy product on the deleted item with no sub-type needs a home', () => {
  const s = pantry();
  s.products.push({ id: 'p_legacy', name: 'Old loaf', ingredientId: 'ing_bread', category: 'Bakery' });
  const plan = planGuidedDelete(load(s), { kind: 'item', id: 'ing_bread' });
  assert.ok(plan.products.some(p => p.product.id === 'p_legacy' && p.needsHome));
});

await check('Covers AE3: the item\'s own sub-type is refused as a destination', () => {
  const s = load(pantry());
  const plan = planGuidedDelete(s, { kind: 'item', id: 'ing_bread' }, { productsAll: { itemId: 'ing_bread', subtypeId: 'sub_white' } });
  assert.ok(plan.errors.length > 0);
});

function recipe(id, ingredients, extra = {}) {
  return { id, name: `Recipe ${id}`, ingredients, ...extra };
}

await check('recipe lines in sections, linked by grp_ only, or in the enhanced version are found', () => {
  const s = pantry();
  s.recipes = [
    recipe('r_sections', [], { ingredientSections: [{ title: 'Dough', ingredients: [{ name: 'Seeded', subtypeId: 'sub_seeded', ingredientId: 'ing_bread' }] }] }),
    recipe('r_grp', [{ name: 'Bread', groupId: 'grp_ing_bread' }]),
    recipe('r_other', [{ name: 'Rice', ingredientId: 'ing_rice' }])
  ];
  const plan = planGuidedDelete(load(s), { kind: 'item', id: 'ing_bread' });
  assert.deepEqual(plan.lines.map(l => l.recipeId).sort(), ['r_grp', 'r_sections']);
});

await check('Covers AE4: only the enhanced line of a recipe is listed when only it uses the sub-type', () => {
  const s = pantry();
  s.recipes = [recipe('r_enh', [{ name: 'Rice', ingredientId: 'ing_rice' }], { enhanced: { ingredients: [{ name: 'Seeded', ingredientId: 'ing_bread', subtypeId: 'sub_seeded' }] } })];
  const plan = planGuidedDelete(load(s), { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' } });
  assert.equal(plan.lines.length, 1);
  assert.match(plan.lines[0].where, /^enhanced/);
});

await check('Covers F2: remapping all lines to one target and overriding one gives one write per recipe', () => {
  const s = pantry();
  s.recipes = [
    recipe('r1', [{ name: 'Bread', ingredientId: 'ing_bread' }, { name: 'Seeded', ingredientId: 'ing_bread', subtypeId: 'sub_seeded' }]),
    recipe('r2', [{ name: 'Bread', groupId: 'grp_ing_bread' }])
  ];
  const st = load(s);
  const first = planGuidedDelete(st, { kind: 'item', id: 'ing_bread' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' } });
  const overrideKey = first.lines.find(l => l.recipeId === 'r1' && l.line.subtypeId).key;
  const plan = planGuidedDelete(st, { kind: 'item', id: 'ing_bread' }, {
    productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' },
    linesAll: { kind: 'item', itemId: 'ing_rolls' },
    lines: { [overrideKey]: { kind: 'subtype', itemId: 'ing_rice', subtypeId: 'sub_basmati' } }
  });
  assert.equal(plan.needsHome, 0);
  const recipes = plan.writes.filter(w => w.type === 'recipe');
  assert.deepEqual(recipes.map(w => w.data.id).sort(), ['r1', 'r2']);
  const r1 = recipes.find(w => w.data.id === 'r1').data.ingredients;
  assert.deepEqual(r1.map(l => l.ingredientId), ['ing_rolls', 'ing_rice']);
  assert.equal(r1[1].subtypeId, 'sub_basmati');
});

await check('Covers F3: deleting a category with its items removes every item, sub-type and category-mapped line', () => {
  const s = pantry();
  s.products = s.products.filter(p => p.category !== 'Bakery');
  s.recipes = [recipe('r_cat', [{ name: 'Bakery', categoryId: 'Bakery' }])];
  const plan = planGuidedDelete(load(s), { kind: 'category', name: 'Bakery' }, { linesAll: { kind: 'category', name: 'Grains' } });
  assert.deepEqual(plan.removed.items.map(i => i.id).sort(), ['ing_bread', 'ing_rolls', 'ing_test1']);
  assert.equal(plan.lines.length, 1);
  assert.deepEqual(plan.writes.find(w => w.type === 'categories').data, ['Dairy', 'Grains']);
  assert.equal(plan.writes.filter(w => w.type === 'deleteItem').length, 3);
});

await check('an empty category deletes with one categories write', () => {
  const s = pantry();
  s.categories.push('Snacks');
  const plan = planGuidedDelete(load(s), { kind: 'category', name: 'Snacks' });
  assert.deepEqual(plan.writes, [{ type: 'categories', data: ['Bakery', 'Dairy', 'Grains'] }]);
});

await check('a product without a destination still needs a home', () => {
  const s = load(pantry());
  const plan = planGuidedDelete(s, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' });
  assert.equal(plan.needsHome, 2);
  assert.deepEqual(plan.errors, []);
});

await check('more writes than the limit is refused', () => {
  const s = pantry();
  for (let i = 0; i <= WRITE_LIMIT; i++) s.recipes.push(recipe(`r${i}`, [{ name: 'Bread', ingredientId: 'ing_test1' }]));
  const plan = planGuidedDelete(load(s), { kind: 'item', id: 'ing_test1' });
  assert.ok(plan.errors.some(e => /too many/i.test(e)));
});

await check('Covers AE5: a product saved as a default does not block, and no write touches the default', () => {
  const s = pantry();
  s.ingredients[1].defaultProductId = 'p_white';
  s.products = s.products.filter(p => p.id !== 'p_seeded1' && p.id !== 'p_seeded2');
  const plan = planGuidedDelete(load(s), { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_white' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' } });
  assert.deepEqual(plan.errors, []);
  const item = plan.writes.find(w => w.type === 'item' && w.data.id === 'ing_bread');
  assert.equal(item.data.defaultProductId, 'p_white');
});

// ---- U3: apply ----

await check('Covers F2: applying commits one batch with every write, then updates the store', async () => {
  const s = pantry();
  s.recipes = [recipe('r1', [{ name: 'Seeded', ingredientId: 'ing_bread', subtypeId: 'sub_seeded' }])];
  const st = load(s);
  const plan = planGuidedDelete(st, { kind: 'item', id: 'ing_bread' }, { productsAll: { itemId: 'ing_milk', subtypeId: 'sub_oat' }, linesAll: { kind: 'item', itemId: 'ing_rolls' } });
  const res = await applyGuidedDelete(plan);
  assert.equal(res.success, true);
  assert.equal(batches.length, 1);
  const paths = batches[0].ops.map(o => `${o.op} ${o.path}`).sort();
  assert.deepEqual(paths, [
    `delete ${HH}/ingredients/ing_bread`,
    `set ${HH}/products/p_seeded1`,
    `set ${HH}/products/p_seeded2`,
    `set ${HH}/products/p_white`,
    `set ${HH}/recipes/r1`
  ]);
  for (const o of batches[0].ops.filter(o => o.op === 'set')) assert.deepEqual(o.options, { merge: true });
  const now = getState();
  assert.ok(!now.ingredients.some(i => i.id === 'ing_bread'));
  assert.equal(now.products.find(p => p.id === 'p_white').subtypeId, 'sub_oat');
  assert.equal(now.recipes.find(r => r.id === 'r1').ingredients[0].ingredientId, 'ing_rolls');
});

await check('a rejected commit leaves the store as it was', async () => {
  const st = load(pantry());
  const plan = planGuidedDelete(st, { kind: 'item', id: 'ing_test1' });
  failNextCommit = true;
  const res = await applyGuidedDelete(plan);
  assert.equal(res.success, false);
  assert.ok(getState().ingredients.some(i => i.id === 'ing_test1'));
});

await check('a write list with errors or homeless products opens no batch', async () => {
  const st = load(pantry());
  const plan = planGuidedDelete(st, { kind: 'subtype', itemId: 'ing_bread', subtypeId: 'sub_seeded' });
  const res = await applyGuidedDelete(plan);
  assert.equal(res.success, false);
  assert.equal(batches.length, 0);
});

await check('offline, the apply opens no batch and says so', async () => {
  const st = load(pantry());
  const plan = planGuidedDelete(st, { kind: 'item', id: 'ing_test1' });
  navigator.onLine = false;
  const res = await applyGuidedDelete(plan);
  navigator.onLine = true;
  assert.equal(res.success, false);
  assert.equal(res.offline, true);
  assert.equal(batches.length, 0);
});

if (failures === 0) {
  console.log('\n=== ALL PANTRY GUIDED DELETE TESTS PASSED ===');
  process.exit(0);
} else {
  console.error(`\n=== ${failures} PANTRY GUIDED DELETE TESTS FAILED ===`);
  process.exit(1);
}
