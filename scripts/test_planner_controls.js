/**
 * scripts/test_planner_controls.js
 * Checks the visible planner controls against a fake Firestore:
 * 1. Commit (Step 3 "Save Shopping List & Plan", Step 4 "Commit Plan Now") writes plans/current
 *    once, keeps the at-home tick, the swap, the slots and the day dates, and survives a reload.
 * 2. After commit the wizard is at Step 2 and the app asks for the Today view.
 * 3. With no plan loaded, commit writes nothing and doesn't throw.
 * 4. Start Fresh resets the wizard to Step 1 (pins, days, start date) and leaves the saved plan alone.
 * "Reload" runs the real hydration against what was written.
 * Run: node scripts/test_planner_controls.js
 */

import assert from 'node:assert/strict';

const docs = {};
const writes = [];
function fakeCollection(path) {
  return {
    path,
    doc: id => fakeDoc(`${path}/${id || 'auto'}`),
    get: async () => ({ docs: [] }),
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
    get: async () => ({ exists: Boolean(docs[path]), id: path.split('/').pop(), data: () => JSON.parse(JSON.stringify(docs[path] || {})) }),
    set: async (data, opts) => {
      writes.push({ op: 'set', path, data: JSON.parse(JSON.stringify(data)), merge: Boolean(opts?.merge) });
      docs[path] = opts?.merge ? { ...(docs[path] || {}), ...data } : JSON.parse(JSON.stringify(data));
    },
    update: async data => { writes.push({ op: 'update', path, data }); },
    delete: async () => { writes.push({ op: 'delete', path }); delete docs[path]; },
    onSnapshot: () => () => {}
  };
}
const fakeDb = {
  collection: name => fakeCollection(name),
  settings: () => {},
  batch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} })
};

const ls = new Map();
global.localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => { ls.set(k, String(v)); }, removeItem: k => { ls.delete(k); } };
global.CustomEvent = class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } };
global.document = {
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} }),
  body: { style: {}, appendChild() {} }
};
const fakeUser = { uid: 'test-uid', email: 'test@example.invalid' };
const viewsShown = [];
const toasts = [];
global.window = {
  firebase: {
    apps: [1],
    firestore: () => fakeDb,
    auth: () => ({ currentUser: fakeUser, getRedirectResult: async () => null, onAuthStateChanged: () => () => {} })
  },
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  location: { origin: '', pathname: '', hash: '' },
  showView: v => { viewsShown.push(v); },
  showPlatePlanToast: (m, type) => { toasts.push({ m, type }); }
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });

const settle = (ms = 800) => new Promise(resolve => setTimeout(resolve, ms));
const CURRENT = 'households/elliott-chloe/plans/current';

const { getState } = await import('../src/store/store.js');
await import('../src/views/PlannerView.js');
const { hydrateHouseholdData, teardownRealtimeSubscriptions } = await import('../src/services/HydrationService.js');

async function reload() {
  getState().currentPlan = null;
  const result = await hydrateHouseholdData({ force: true });
  assert.equal(result.success, true, 'hydration succeeds');
  teardownRealtimeSubscriptions();
  return getState().currentPlan;
}

function generatedPlan() {
  return {
    id: 'current',
    days: 2,
    startDate: '2026-11-02',
    dayDates: { 1: '2026-11-02', 2: '2026-11-03' },
    slots: {
      1: { dinnerE: { recipeId: 'r1', isSplit: true }, dinnerC: { recipeId: 'r2', isSplit: true } },
      2: { dinnerE: { recipeId: 'r3' }, dinnerC: { recipeId: 'r3' } }
    },
    shoppingAtHome: { 'ing:tofu': true },
    substitutions: { 'ing:rice': { productId: 'p9', productName: 'Basmati', brand: 'Tilda', price: 2.5, timestamp: 1 } },
    productSelections: { 'ing:rice': 'p9' },
    eatenMeals: { '2026-11-02:dinner:e': true }
  };
}

function checkPlanKept(plan, label) {
  assert.ok(plan, `${label}: a plan is present`);
  assert.deepEqual(plan.dayDates, { 1: '2026-11-02', 2: '2026-11-03' }, `${label}: day dates kept`);
  assert.equal(plan.slots[1].dinnerE.recipeId, 'r1', `${label}: Elliott's day 1 dinner kept`);
  assert.equal(plan.slots[1].dinnerC.recipeId, 'r2', `${label}: Chloe's day 1 dinner kept`);
  assert.equal(plan.slots[2].dinnerE.recipeId, 'r3', `${label}: day 2 dinner kept`);
  assert.deepEqual(plan.shoppingAtHome, { 'ing:tofu': true }, `${label}: at-home tick kept`);
  assert.equal(plan.substitutions['ing:rice'].productId, 'p9', `${label}: swap kept`);
  assert.deepEqual(plan.productSelections, { 'ing:rice': 'p9' }, `${label}: product selection kept`);
  assert.deepEqual(plan.eatenMeals, { '2026-11-02:dinner:e': true }, `${label}: eaten tick kept`);
}

// 1 + 2. Commit saves the loaded plan, sets Step 2 and opens Today; the plan survives a reload.
{
  assert.equal(typeof window.commitPlannerWizardPlan, 'function', 'commitPlannerWizardPlan is defined on window');
  getState().currentPlan = generatedPlan();
  getState().currentPlannerStep = 4;
  writes.length = 0; viewsShown.length = 0;
  window.commitPlannerWizardPlan();
  await settle();
  const planWrites = writes.filter(w => w.path.includes('/plans/'));
  assert.equal(planWrites.length, 1, `exactly one plan write: ${planWrites.map(w => w.path)}`);
  assert.equal(planWrites[0].path, CURRENT, 'the write goes to plans/current');
  assert.equal(planWrites[0].merge, false, 'the write is the whole document');
  checkPlanKept(planWrites[0].data, 'written document');
  assert.equal(getState().currentPlannerStep, 2, 'the wizard step is 2, as the old commit set it');
  assert.deepEqual(viewsShown, ['today'], 'the app asks for the Today view');
  checkPlanKept(await reload(), 'after reload');
  console.log('PASS 1-2: commit writes plans/current once, keeps ticks, swaps, slots and dates, sets Step 2 and opens Today');
}

// 3. No plan loaded: commit writes nothing and doesn't throw.
{
  for (const empty of [null, {}, { days: 2, dayDates: {} }]) {
    getState().currentPlan = empty;
    getState().currentPlannerStep = 4;
    writes.length = 0; viewsShown.length = 0;
    assert.doesNotThrow(() => window.commitPlannerWizardPlan(), 'commit with no plan does not throw');
    await settle();
    assert.deepEqual(writes, [], `nothing is written with plan ${JSON.stringify(empty)}`);
    assert.deepEqual(viewsShown, [], 'Today is not opened without a plan');
    assert.equal(getState().currentPlannerStep, 4, 'the wizard step is unchanged');
  }
  console.log('PASS 3: commit with no plan loaded writes nothing and does not throw');
}

// 4. Start Fresh resets the wizard as the old runtime did and leaves the saved plan alone.
{
  docs[CURRENT] = JSON.parse(JSON.stringify(generatedPlan()));
  assert.ok((await reload())?.slots?.[1], 'the saved plan loads before Start Fresh');
  const savedBefore = JSON.stringify(docs[CURRENT]);
  getState().currentPlannerStep = 3;
  getState().currentPlanOptions = { pinnedMeals: { pinnedRecipes: ['r-pinned'] } };
  writes.length = 0;
  window.resetPlannerStartFresh();
  await settle();
  assert.deepEqual(writes.filter(w => w.path.includes('/plans/')), [], 'Start Fresh writes no plan');
  assert.equal(JSON.stringify(docs[CURRENT]), savedBefore, 'the saved plan is unchanged');
  assert.ok(getState().currentPlan?.slots?.[1], 'the loaded plan is still there for Today');
  assert.equal(getState().currentPlannerStep, 1, 'the wizard is back at Step 1');
  assert.deepEqual(getState().currentPlanOptions.pinnedMeals.pinnedRecipes, [], 'pinned meals are cleared');
  assert.equal(getState().currentPlannerDays, 10, 'the day count resets to 10');
  assert.equal(getState().currentPlannerStartDate, new Date().toISOString().split('T')[0], 'the start date resets to today');
  const loaded = await reload();
  assert.ok(loaded?.slots?.[1], 'the plan is still there after reload');
  console.log('PASS 4: Start Fresh resets the wizard to Step 1 and leaves the saved plan alone');
}


console.log('\nAll planner control checks passed.');
process.exit(0);
