/**
 * scripts/test_today_view.js
 * Verification for the Today view's meal-eaten ticks:
 * 1. Ticks for Elliott, Chloe and both toggle on and off.
 * 2. stripPlanPayload keeps ticked meals, so saveCurrentPlan persists them.
 * 3. Unticked and malformed entries are dropped from the saved payload.
 */

import assert from 'node:assert';

if (typeof window === 'undefined') {
  global.window = {};
}
// src/config/firebase.js touches localStorage at import time
if (typeof localStorage === 'undefined') {
  const store = new Map();
  global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
}

const { calculateMealEatenUpdates, isMealEatenOnDate } = await import('../src/services/TodayViewService.js');
const { stripPlanPayload, sanitizeEatenMeals } = await import('../src/models/MealPlannerModel.js');

console.log('=== RUNNING TODAY VIEW VERIFICATION SUITE ===\n');

const day = '2026-10-27';

// 1. Toggling
let eaten = calculateMealEatenUpdates({}, day, 'dinner', 'e').nextEaten;
assert.ok(isMealEatenOnDate(eaten, day, 'dinner', 'e'), 'Elliott dinner should be ticked');
assert.ok(!isMealEatenOnDate(eaten, day, 'dinner', 'c'), 'Chloe dinner should not be ticked');
assert.ok(!isMealEatenOnDate(eaten, day, 'dinner', 'both'), 'Both should need Elliott and Chloe');

eaten = calculateMealEatenUpdates(eaten, day, 'dinner', 'c').nextEaten;
assert.ok(isMealEatenOnDate(eaten, day, 'dinner', 'both'), 'Both should be ticked once Elliott and Chloe are');

eaten = calculateMealEatenUpdates(eaten, day, 'dinner', 'both').nextEaten;
assert.ok(!isMealEatenOnDate(eaten, day, 'dinner', 'e'), 'Unticking both should untick Elliott');
assert.ok(!isMealEatenOnDate(eaten, day, 'dinner', 'c'), 'Unticking both should untick Chloe');
console.log('✅ Meal-eaten toggles work for Elliott, Chloe and both');

// 2. Persistence through stripPlanPayload
const plan = {
  days: 7,
  startDate: '2026-10-24',
  dayDates: { 4: day },
  slots: { 4: { dinner: { recipeId: 'rec-1', recipe: { name: 'heavy' } } } },
  mealPrepGroups: [],
  eatenMeals: { [`${day}:dinner:e`]: true, [`${day}:lunch`]: true }
};
const payload = stripPlanPayload(plan);
assert.deepStrictEqual(payload.eatenMeals, plan.eatenMeals, 'Ticked meals should survive stripPlanPayload');
assert.strictEqual(payload.slots[4].dinner.recipe, undefined, 'Heavy recipe data should still be stripped');
console.log('✅ stripPlanPayload keeps eaten meals and still strips heavy fields');

// 3. Sanitising
assert.deepStrictEqual(sanitizeEatenMeals({
  [`${day}:dinner:e`]: false,
  [`${day}:dinner:x`]: true,
  'not-a-key': true,
  [`${day}:breakfast:c`]: true
}), { [`${day}:breakfast:c`]: true }, 'Only ticked, well-formed keys should be kept');
assert.deepStrictEqual(stripPlanPayload({ slots: {} }).eatenMeals, {}, 'A plan without ticks saves an empty map');
console.log('✅ Unticked and malformed entries are dropped');

console.log('\n=== TODAY VIEW SUITE PASSED ===');
