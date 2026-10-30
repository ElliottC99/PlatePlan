/**
 * scripts/test_planner_controls.js
 * Checks the visible planner controls against a fake Firestore:
 * 1. Commit (Step 3 "Save Shopping List & Plan", Step 4 "Commit Plan Now") writes plans/current
 *    once, keeps the at-home tick, the swap, the slots and the day dates, and survives a reload.
 * 2. After commit the wizard is at Step 2 and the app asks for the Today view.
 * 3. With no plan loaded, commit writes nothing and doesn't throw.
 * 4. Start Fresh resets the wizard to Step 1 (pins, days, start date) and leaves the saved plan alone.
 * 5. Step 2 "Swap ▾" changes the slot on the loaded plan (currentPlan), writes plans/current with it,
 *    keeps the ticks and swaps, and survives a reload, even with a stale state.plan after a product swap.
 * 6. Step 2 day headings show the day's date once and "Day N" once; a day with no date shows "Day N" only.
 * 7. The restored slot helpers: meal type from a slot key, and a slot in the generator's shape.
 * 8. Smoke render: Steps 1, 2 and 3 still draw their markup, and the hidden legacy grid is not drawn.
 * 9. Generate uses the Step 1 day count and start date (Start Fresh's 10 days from today, or the
 *    person's edit), then the loaded plan's, then 10 days from today, as Step 1 shows.
 * 10. A failed save: commit shows the error toast and doesn't open Today; swap shows the error toast.
 * "Reload" runs the real hydration against what was written.
 * Run: node scripts/test_planner_controls.js
 */

import assert from 'node:assert/strict';

const docs = {};
const writes = [];
// When true, every fake doc.set rejects, as a write does when the network is down.
let failSets = false;
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
      if (failSets) throw new Error('offline (test)');
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


// 5. Step 2 "Swap ▾" edits the loaded plan and saves it; a shared swap sets both people's slot.
{
  const { openSearchableRecipeSwapModal, selectAndSwapRecipe } = await import('../src/components/planner/PlannerMealSlot.js');
  getState().recipes = [{ id: 'r1', name: 'Tofu Curry' }, { id: 'r2', name: 'Lentil Soup' }, { id: 'r3', name: 'Chickpea Stew' }, { id: 'r9', name: 'Bean Chilli', enhanced: { name: 'Bean Chilli+' } }];

  // Tuesday (day 2) dinner, shared by both people.
  docs[CURRENT] = JSON.parse(JSON.stringify(generatedPlan()));
  await reload();
  getState().plan = undefined;
  writes.length = 0;
  openSearchableRecipeSwapModal(2, 'dinnerE', true);
  assert.doesNotThrow(() => selectAndSwapRecipe('r9', 'enhanced'), 'the shared swap does not throw');
  const cp = getState().currentPlan;
  assert.equal(cp.slots[2].dinnerE.recipeId, 'r9', "Elliott's Tuesday dinner is the new recipe in currentPlan");
  assert.equal(cp.slots[2].dinnerC.recipeId, 'r9', "Chloe's Tuesday dinner is the new recipe in currentPlan");
  assert.equal(cp.slots[2].dinnerE.variant, 'enhanced', 'the chosen variant is kept');
  assert.notEqual(cp.slots[2].dinnerE, cp.slots[2].dinnerC, 'the two people get separate slot objects');
  assert.equal(cp.slots[2].dinnerE.instanceId, cp.slots[2].dinnerC.instanceId, 'a shared meal is one cooking event, as the generator makes it');
  await settle();
  let planWrites = writes.filter(w => w.path.includes('/plans/'));
  assert.equal(planWrites.length, 1, `the swap writes the plan once: ${planWrites.map(w => w.path)}`);
  assert.equal(planWrites[0].path, CURRENT, 'the swap writes plans/current');
  assert.equal(planWrites[0].merge, false, 'the swap writes the whole document');
  assert.equal(planWrites[0].data.slots[2].dinnerE.recipeId, 'r9', 'the written plan has the new recipe');
  assert.equal(planWrites[0].data.slots[1].dinnerE.recipeId, 'r1', 'the other days are written unchanged');
  assert.deepEqual(planWrites[0].data.shoppingAtHome, { 'ing:tofu': true }, 'the at-home tick is kept');
  assert.equal(planWrites[0].data.substitutions['ing:rice'].productId, 'p9', 'the product swap is kept');
  assert.deepEqual(planWrites[0].data.productSelections, { 'ing:rice': 'p9' }, 'the product selection is kept');
  assert.deepEqual(planWrites[0].data.eatenMeals, { '2026-11-02:dinner:e': true }, 'the eaten tick is kept');
  const afterShared = await reload();
  assert.equal(afterShared.slots[2].dinnerE.recipeId, 'r9', 'the shared swap survives a reload');
  assert.equal(afterShared.slots[2].dinnerC.recipeId, 'r9', "Chloe's side survives a reload");

  // One person's meal, with a stale state.plan left by a product swap.
  const stale = { slots: { 1: { dinnerC: { id: 'stale' } } } };
  getState().plan = stale;
  writes.length = 0;
  openSearchableRecipeSwapModal(1, 'dinnerC', false);
  assert.doesNotThrow(() => selectAndSwapRecipe('r3', 'original'), 'the swap with a stale state.plan does not throw');
  assert.equal(getState().currentPlan.slots[1].dinnerC.recipeId, 'r3', "Chloe's Monday dinner changes in currentPlan");
  assert.equal(getState().currentPlan.slots[1].dinnerE.recipeId, 'r1', "Elliott's Monday dinner is left alone");
  assert.equal(stale.slots[1].dinnerC.id, 'stale', 'the stale state.plan is not edited');
  await settle();
  planWrites = writes.filter(w => w.path.includes('/plans/'));
  assert.equal(planWrites.length, 1, 'the one-person swap writes the plan once');
  assert.equal(planWrites[0].data.slots[1].dinnerC.recipeId, 'r3', 'the written plan has the new recipe');
  assert.equal((await reload()).slots[1].dinnerC.recipeId, 'r3', 'the one-person swap survives a reload');
  getState().plan = undefined;

  // No loaded plan: nothing is written and nothing throws.
  getState().currentPlan = null;
  writes.length = 0;
  openSearchableRecipeSwapModal(1, 'dinnerE', false);
  assert.doesNotThrow(() => selectAndSwapRecipe('r3', 'original'), 'the swap with no plan does not throw');
  await settle();
  assert.deepEqual(writes, [], 'nothing is written with no plan loaded');
  console.log('PASS 5: Step 2 swap edits currentPlan, writes plans/current, keeps ticks and swaps, survives a reload');
}

// 6. Step 2 day headings show the date once and "Day N" once.
{
  const { renderWizardStep2 } = await import('../src/views/PlannerRenderService.js');
  window.PlannerMealSlot = await import('../src/components/planner/PlannerMealSlot.js');
  window.PlannerDayCard = await import('../src/components/planner/PlannerDayCard.js');

  const plan = { days: 2, dayDates: { 1: '2026-11-02' }, slots: { 1: {}, 2: {} } };

  const html = renderWizardStep2(plan);
  const headings = [...html.matchAll(/<div class="dense-plan-day-card">\s*<div[^>]*>\s*<div>([\s\S]*?)<\/div>/g)].map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  assert.equal(headings.length, 2, `two day headings render: ${JSON.stringify(headings)}`);
  assert.equal(headings[0], 'Day 1 Mon 2 Nov', 'day 1 heading shows "Day 1" once and its date once');
  assert.equal(headings[1], 'Day 2', 'a day with no date shows "Day 2" with no date text');
  console.log('PASS 6: Step 2 headings show the date once and "Day N" once');
}

// 7. The restored slot helpers.
{
  const { getMealTypeFromSlotKey, makePlanSlot } = await import('../src/services/MealPlanGeneratorService.js');
  assert.equal(getMealTypeFromSlotKey('dinnerE'), 'dinner');
  assert.equal(getMealTypeFromSlotKey('breakfastC'), 'breakfast');
  assert.equal(getMealTypeFromSlotKey('lunchE'), 'lunch');
  assert.equal(getMealTypeFromSlotKey('snackC'), 'snack');
  assert.equal(getMealTypeFromSlotKey('other'), '');
  assert.equal(getMealTypeFromSlotKey(undefined), '');

  const slot = makePlanSlot('r5');
  assert.deepEqual(Object.keys(slot).sort(), ['id', 'instanceId', 'isSkipped', 'isSplit', 'pinned', 'recipeId', 'skipped', 'variant'], 'the generator slot keys');
  assert.equal(slot.id, 'r5'); assert.equal(slot.recipeId, 'r5'); assert.equal(slot.variant, 'original');
  assert.ok(slot.instanceId, 'an instance id is set');
  assert.equal(slot.isSkipped, false); assert.equal(slot.skipped, false); assert.equal(slot.isSplit, false); assert.equal(slot.pinned, false);
  assert.equal(makePlanSlot('r5', 'enhanced').variant, 'enhanced', 'the enhanced variant is kept');
  const fromValue = makePlanSlot('r5::enhanced');
  assert.equal(fromValue.recipeId, 'r5', 'an "id::enhanced" value gives the bare id');
  assert.equal(fromValue.variant, 'enhanced', 'an "id::enhanced" value gives the enhanced variant');
  assert.notEqual(makePlanSlot('r5').instanceId, makePlanSlot('r5').instanceId, 'each slot gets its own instance id');
  console.log('PASS 7: getMealTypeFromSlotKey and makePlanSlot build the generator slot shape');
}

// 8. Smoke render: with the hidden legacy grid removed, Steps 1, 2 and 3 still draw their markup,
//    and nothing is written into the hidden #plan-content any more.
{
  window.GeneratorWizardModal = await import('../src/components/generator/GeneratorWizardModal.js');
  window.ShoppingBatchToolbar = await import('../src/components/shopping/ShoppingBatchToolbar.js');
  window.ShoppingCategoryGroup = await import('../src/components/shopping/ShoppingCategoryGroup.js');
  const host = { innerHTML: '', hasAttribute: () => true, setAttribute() {}, addEventListener() {}, querySelectorAll: () => [] };
  const planContent = { innerHTML: 'untouched' };
  const realGetById = document.getElementById;
  document.getElementById = id => (id === 'planner-wizard-host' ? host : id === 'plan-content' ? planContent : null);
  getState().recipes = [{ id: 'r1', name: 'Tofu Curry' }, { id: 'r2', name: 'Lentil Soup' }, { id: 'r3', name: 'Chickpea Stew' }];
  getState().currentPlan = {
    days: 2, dayDates: { 1: '2026-11-02', 2: '2026-11-03' },
    slots: { 1: { dinnerE: { id: 'r1', recipeId: 'r1' }, dinnerC: { id: 'r2', recipeId: 'r2' } }, 2: { dinnerE: { id: 'r3', recipeId: 'r3' }, dinnerC: { id: 'r3', recipeId: 'r3' } } }
  };
  const render = step => { getState().currentPlannerStep = step; host.innerHTML = ''; window.renderPlanner(); return host.innerHTML; };

  const step1 = render(1);
  assert.match(step1, /pp-generator-constraints-card/, 'Step 1 draws the requests form');
  assert.match(step1, /id="wizard-plan-days"/, 'Step 1 has the plan length control');
  const step2 = render(2);
  assert.match(step2, /class="dense-plan-day-card"/, 'Step 2 draws the day cards');
  assert.match(step2, /Mon 2 Nov/, 'Step 2 headings carry the date');
  assert.match(step2, /Tofu Curry/, 'Step 2 lists the planned meals');
  assert.match(step2, /data-action="searchable-swap-slot"/, 'Step 2 has the Swap button');
  const step3 = render(3);
  assert.match(step3, /data-action="commit-plan"/, 'Step 3 has the save and commit button');
  assert.equal(planContent.innerHTML, 'untouched', 'the hidden legacy grid is not drawn');
  document.getElementById = realGetById;
  console.log('PASS 8: Steps 1, 2 and 3 still render, and the hidden legacy grid is not drawn');
}

// 9. Generate uses the Step 1 form values, as the old runtime's generate read state.plannerDays
//    and the start date; then the loaded plan's; then 10 days from today.
{
  const { generatePlan } = await import('../src/services/MealPlanGeneratorService.js');
  const recipes = [{ id: 'r1', name: 'Tofu Curry' }, { id: 'r2', name: 'Lentil Soup' }, { id: 'r3', name: 'Chickpea Stew' }];
  const today = new Date().toISOString().split('T')[0];
  const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };
  const generate = async () => {
    getState().recipes = recipes;
    toasts.length = 0;
    await generatePlan();
    assert.deepEqual(toasts.filter(t => t.type === 'error'), [], 'Generate shows no error');
    const plan = getState().currentPlan;
    await settle();
    return plan;
  };

  // After Start Fresh: 10 days starting today.
  docs[CURRENT] = JSON.parse(JSON.stringify(generatedPlan()));
  await reload();
  window.resetPlannerStartFresh();
  let plan = await generate();
  assert.equal(plan.days, 10, 'after Start Fresh, Generate builds 10 days');
  assert.equal(Object.keys(plan.dayDates).length, 10, 'ten day dates');
  assert.equal(plan.dayDates[1], today, 'the plan starts today');
  assert.equal(plan.dayDates[10], addDays(today, 9), 'the tenth day is nine days on');

  // An edit on Step 1: 14 days from a chosen date.
  getState().currentPlannerDays = 14;
  getState().currentPlannerStartDate = '2026-11-09';
  plan = await generate();
  assert.equal(plan.days, 14, 'Generate builds the 14 days set on Step 1');
  assert.equal(plan.startDate, '2026-11-09', 'the plan starts on the date set on Step 1');
  assert.equal(plan.dayDates[1], '2026-11-09', 'day 1 is the chosen date');
  assert.equal(plan.dayDates[14], '2026-11-22', 'day 14 is thirteen days on');

  // No form values: the loaded plan's length and first day, which Step 1 shows.
  getState().currentPlannerDays = undefined;
  getState().currentPlannerStartDate = undefined;
  getState().currentPlan = generatedPlan();
  plan = await generate();
  assert.equal(plan.days, 2, "with no form values, Generate uses the loaded plan's length");
  assert.equal(plan.dayDates[1], '2026-11-02', "with no form values, Generate starts on the loaded plan's first day");

  // No form values and no plan: 10 days from today, the default Step 1 shows.
  getState().currentPlannerDays = undefined;
  getState().currentPlannerStartDate = undefined;
  getState().currentPlan = null;
  plan = await generate();
  assert.equal(plan.days, 10, 'with no form values and no plan, Generate builds 10 days');
  assert.equal(plan.dayDates[1], today, 'with no form values and no plan, the plan starts today');
  console.log('PASS 9: Generate uses the Step 1 day count and start date, then the loaded plan, then 10 days from today');
}

// 10. A failed save shows the error toast; commit then doesn't open Today.
{
  const { openSearchableRecipeSwapModal, selectAndSwapRecipe } = await import('../src/components/planner/PlannerMealSlot.js');
  getState().recipes = [{ id: 'r1', name: 'Tofu Curry' }, { id: 'r2', name: 'Lentil Soup' }, { id: 'r3', name: 'Chickpea Stew' }];
  const errorToasts = () => toasts.filter(t => t.type === 'error').map(t => t.m);
  // A plan whose save throws inside saveCurrentPlan, so its promise rejects rather than resolving false.
  const throwingPlan = () => {
    const plan = generatedPlan();
    Object.defineProperty(plan, 'days', { get() { throw new Error('bad plan (test)'); }, enumerable: true });
    return plan;
  };
  const quiet = console.error; const quietWarn = console.warn;
  console.error = () => {}; console.warn = () => {};

  // Commit, doc.set rejects: saveCurrentPlan resolves false.
  getState().currentPlan = generatedPlan();
  failSets = true; toasts.length = 0; viewsShown.length = 0;
  window.commitPlannerWizardPlan();
  await settle();
  failSets = false;
  assert.deepEqual(viewsShown, [], 'a failed commit does not open Today');
  assert.deepEqual(errorToasts(), ['Failed to commit meal plan. Check network connection.'], 'a failed commit shows the error toast');
  assert.ok(!toasts.some(t => t.type === 'success'), 'a failed commit shows no success toast');

  // Commit, saveCurrentPlan rejects.
  getState().currentPlan = throwingPlan();
  toasts.length = 0; viewsShown.length = 0;
  window.commitPlannerWizardPlan();
  await settle();
  assert.deepEqual(viewsShown, [], 'a commit whose save rejects does not open Today');
  assert.deepEqual(errorToasts(), ['Failed to commit meal plan. Check network connection.'], 'a commit whose save rejects shows the error toast');

  // Swap, doc.set rejects.
  getState().currentPlan = generatedPlan();
  failSets = true; toasts.length = 0;
  openSearchableRecipeSwapModal(1, 'dinnerE', false);
  selectAndSwapRecipe('r3', 'original');
  await settle();
  failSets = false;
  assert.deepEqual(errorToasts(), ['Failed to save the swap. Check network connection.'], 'a failed swap save shows the error toast');

  // Swap, saveCurrentPlan rejects.
  getState().currentPlan = throwingPlan();
  toasts.length = 0;
  openSearchableRecipeSwapModal(1, 'dinnerE', false);
  selectAndSwapRecipe('r3', 'original');
  await settle();
  assert.deepEqual(errorToasts(), ['Failed to save the swap. Check network connection.'], 'a swap whose save rejects shows the error toast');

  console.error = quiet; console.warn = quietWarn;
  getState().currentPlan = null;
  console.log('PASS 10: a failed save shows the error toast, and a failed commit does not open Today');
}


console.log('\nAll planner control checks passed.');
process.exit(0);
