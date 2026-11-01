/**
 * scripts/test_planner_wizard_pipeline.js
 * Verification suite for Meal Planner Wizard Pipeline & Crash-Proof Persistence.
 */

import assert from 'node:assert/strict';

console.log('=== RUNNING MEAL PLANNER PIPELINE VERIFICATION SUITE ===\n');

// 1. Mock store & globals
let lastCachedState = null;
let lastActivePlan = null;
let lastSavedCurrentPlan = null;

const mockState = {
  currentPlannerDays: 10,
  currentPlannerStartDate: '2026-11-02',
  prefs: {
    mealRepeatCadence: { breakfast: 1, lunch: 2, dinner: 2 }
  },
  currentPlan: null,
  recipes: [
    { id: 'r1', name: 'Scrambled Eggs', type: 'breakfast', types: ['breakfast'], calories: 350, protein: 25 },
    { id: 'r2', name: 'Chicken Salad', type: 'lunch', types: ['lunch'], calories: 450, protein: 40 },
    { id: 'r3', name: 'Steak & Veg', type: 'dinner', types: ['dinner'], calories: 650, protein: 55 }
  ]
};

global.window = {
  AppState: {
    getState: () => mockState
  },
  HouseholdRepository: {
    saveCurrentPlan: async (plan) => {
      lastSavedCurrentPlan = plan;
      return Promise.resolve(true);
    }
  }
};

const saveStateCache = (state) => {
  lastCachedState = state;
};

const setActivePlan = (plan) => {
  lastActivePlan = plan;
};

const getState = () => mockState;

// Implementation of window.saveState as in src/main.js
function saveState(stateData) {
  try {
    const state = typeof getState === 'function' ? getState() : (window.AppState ? window.AppState.getState() : null);
    const data = stateData || state;

    const rawPlan = (data?.slots ? data : null)
      || data?.plan
      || data?.currentPlan
      || state?.currentPlan
      || state?.plan;

    if (typeof saveStateCache === 'function') {
      saveStateCache(data);
    }

    if (rawPlan && rawPlan.slots && typeof rawPlan.slots === 'object') {
      if (typeof setActivePlan === 'function') {
        setActivePlan(rawPlan);
      }
      if (window.HouseholdRepository && typeof window.HouseholdRepository.saveCurrentPlan === 'function') {
        window.HouseholdRepository.saveCurrentPlan(rawPlan);
      }
    }
  } catch (err) {
    console.warn('[Persistence] Handled warning in window.saveState:', err);
  }
}

// --- Test 1: Zero-argument invocation of saveState (Pre-generation Step 1) ---
console.log('--- Test 1: Zero-argument invocation of saveState ---');
assert.doesNotThrow(() => {
  saveState();
}, 'saveState() with no arguments must never throw an unhandled TypeError');

assert.ok(lastCachedState, 'saveState() must persist in-memory state to local cache');
assert.equal(lastActivePlan, null, 'No plan dispatched when rawPlan has no slots');
console.log('✅ Test 1 Passed: saveState() with zero arguments executes cleanly.\n');

// --- Test 2: Invocations with null or undefined ---
console.log('--- Test 2: Invocations with null and undefined ---');
assert.doesNotThrow(() => {
  saveState(null);
  saveState(undefined);
}, 'saveState(null / undefined) must never throw');
console.log('✅ Test 2 Passed: Nullable arguments handled safely.\n');

// --- Test 3: Plan with .slots directly passed ---
console.log('--- Test 3: Plan with .slots passed directly ---');
const samplePlan = {
  id: 'plan_123',
  days: 7,
  slots: {
    1: { dinnerE: { id: 'r3', variant: 'original' }, dinnerC: { id: 'r3', variant: 'original' } }
  }
};

saveState(samplePlan);
assert.equal(lastActivePlan, samplePlan, 'Active plan must be dispatched to store');
assert.equal(lastSavedCurrentPlan, samplePlan, 'Plan must be committed to HouseholdRepository');
console.log('✅ Test 3 Passed: Direct plan object correctly delegates to store and repository.\n');

// --- Test 4: Container object with currentPlan ---
console.log('--- Test 4: Container object with currentPlan ---');
lastActivePlan = null;
lastSavedCurrentPlan = null;

saveState({ currentPlan: samplePlan });
assert.equal(lastActivePlan, samplePlan, 'currentPlan extracted and dispatched');
assert.equal(lastSavedCurrentPlan, samplePlan, 'currentPlan committed to repository');
console.log('✅ Test 4 Passed: Container with { currentPlan } successfully extracted.\n');

// --- Test 5: MealPlanGeneratorService option resolution ---
console.log('--- Test 5: Generator option resolution ---');
import { generateMealPlan } from '../src/services/MealPlanGeneratorService.js';

const generated = generateMealPlan({
  days: 3,
  startDate: '2026-11-09',
  cadence: { breakfast: 1, lunch: 3, dinner: 3 },
  recipes: mockState.recipes
});

assert.ok(generated, 'Plan should be successfully generated');
assert.equal(generated.days, 3, 'Days must match requested 3');
assert.equal(generated.dayDates[1], '2026-11-09', 'Start date must match requested 2026-11-09');
assert.deepEqual(generated.cadence, { breakfast: 1, lunch: 3, dinner: 3 }, 'Custom cadence must be preserved');
console.log('✅ Test 5 Passed: Generator honors custom cadence and start dates without dropping.\n');

// --- Test 6: Constraint event binding simulation ---
console.log('--- Test 6: Constraint event binding simulation ---');
import { bindConstraintEvents } from '../src/components/generator/GeneratorConstraintsForm.js';
import { getState as getCoreState, state as coreState } from '../src/store/coreState.js';

let reRenderCount = 0;
const mockInputs = [
  { dataset: { key: 'plannerDays' }, value: '5', onchange: null },
  { dataset: { key: 'plannerStartDate' }, value: '2026-11-15', onchange: null },
  { dataset: { key: 'cadenceBreakfast' }, value: '2', onchange: null },
  { dataset: { key: 'cadenceLunch' }, value: '3', onchange: null },
  { dataset: { key: 'cadenceDinner' }, value: '4', onchange: null }
];

const mockContainer = {
  querySelectorAll: (selector) => {
    if (selector === '.pp-constraint-input') return mockInputs;
    if (selector === '.pp-gen-plan-btn') return [];
    return [];
  }
};

bindConstraintEvents(mockContainer, () => {
  reRenderCount++;
});

// Trigger all onchange events
mockInputs.forEach(input => input.onchange({ target: input }));

const appState = getCoreState();
assert.equal(appState.currentPlannerDays, 5, 'plannerDays updated to 5');
assert.equal(appState.currentPlannerStartDate, '2026-11-15', 'plannerStartDate updated to 2026-11-15');
assert.equal(appState.prefs.mealRepeatCadence.breakfast, 2, 'cadenceBreakfast updated to 2');
assert.equal(appState.prefs.mealRepeatCadence.lunch, 3, 'cadenceLunch updated to 3');
assert.equal(appState.prefs.mealRepeatCadence.dinner, 4, 'cadenceDinner updated to 4');
assert.equal(reRenderCount, 5, 'onRender called for each parameter change');
console.log('✅ Test 6 Passed: bindConstraintEvents correctly handles all parameter and cadence changes.\n');

console.log('===============================================================');
console.log('🎯 ALL MEAL PLANNER PIPELINE TESTS PASSED SUCCESSFULLY');
console.log('===============================================================');
