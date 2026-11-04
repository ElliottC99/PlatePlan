/**
 * scripts/test_today_meal_rearrange.js
 * Automated test suite for Today view meal rearranging and day swapping.
 * Verifies slot swaps, split person slot preservation, eaten state resets, and sequential rotations.
 */

import assert from 'node:assert';
import { swapPlanMealSlots } from '../src/services/PlanSlotSwapService.js';
import { renderTodaySwapModalHtml } from '../src/components/today/TodaySwapMealModalUI.js';

console.log('=== RUNNING TODAY MEAL REARRANGE & SWAP TEST SUITE ===');

// Mock Plan Data
const mockPlan = {
  days: 5,
  startDate: '2026-11-04',
  dayDates: {
    '1': '2026-11-04',
    '2': '2026-11-05',
    '3': '2026-11-06',
    '4': '2026-11-07',
    '5': '2026-11-08'
  },
  slots: {
    '1': {
      breakfastE: { recipeId: 'rec-oats', name: 'Oats' },
      dinnerE: { recipeId: 'rec-curry', name: 'Chicken Curry', variant: 'original', servings: 2 },
      dinnerC: { recipeId: 'rec-curry', name: 'Chicken Curry', variant: 'original', servings: 2 }
    },
    '2': {
      breakfastE: { recipeId: 'rec-toast', name: 'Toast' },
      dinnerE: { recipeId: 'rec-spaghetti', name: 'Spaghetti Bolognese', variant: 'enhanced', servings: 2 },
      dinnerC: { recipeId: 'rec-spaghetti', name: 'Spaghetti Bolognese', variant: 'enhanced', servings: 2 }
    },
    '3': {
      dinnerE: { recipeId: 'rec-salad', name: 'Steak Salad', servings: 1 },
      dinnerC: { recipeId: 'rec-pasta', name: 'Pesto Pasta', servings: 1 }
    },
    '4': {
      dinner: { recipeId: 'rec-stirfry', name: 'Tofu Stir Fry', servings: 2 }
    },
    '5': {
      dinnerE: { recipeId: 'rec-pizza', name: 'Homemade Pizza', servings: 2 },
      dinnerC: { recipeId: 'rec-pizza', name: 'Homemade Pizza', servings: 2 }
    }
  },
  eatenMeals: {
    '2026-11-04:dinner': true,
    '2026-11-04:dinner:e': true,
    '2026-11-05:dinner:c': true,
    '2026-11-06:dinner': true,
    '2026-11-04:breakfast': true
  }
};

// --------------------------------------------------------------------------
// TEST 1: Pairwise Meal Slot Swap
// --------------------------------------------------------------------------
console.log('\n--- Test 1: Pairwise Meal Slot Swap ---');
{
  const res = swapPlanMealSlots(mockPlan, '1', '2', 'dinner');
  assert.strictEqual(res.success, true, 'Swap operation succeeded');
  const updatedSlots = res.plan.slots;

  // Day 1 should now have Day 2's dinner (Spaghetti)
  assert.strictEqual(updatedSlots['1'].dinnerE.recipeId, 'rec-spaghetti', 'Day 1 dinner is now Spaghetti');
  assert.strictEqual(updatedSlots['1'].dinnerE.variant, 'enhanced', 'Variant preserved on Day 1');

  // Day 2 should now have Day 1's dinner (Curry)
  assert.strictEqual(updatedSlots['2'].dinnerE.recipeId, 'rec-curry', 'Day 2 dinner is now Curry');

  // Breakfast on Day 1 should remain untouched
  assert.strictEqual(updatedSlots['1'].breakfastE.recipeId, 'rec-oats', 'Day 1 breakfast untouched');

  console.log('✅ Test 1 Passed: Meal slots swapped cleanly between Day 1 and Day 2.');
}

// --------------------------------------------------------------------------
// TEST 2: Split Person Slots Swap (Elliott vs Chloe distinct meals)
// --------------------------------------------------------------------------
console.log('\n--- Test 2: Split Person Slots Swap ---');
{
  // Swap Day 3 (split: Steak Salad for E, Pesto Pasta for C) with Day 4 (single dinner: Tofu Stir Fry)
  const res = swapPlanMealSlots(mockPlan, '3', '4', 'dinner');
  assert.strictEqual(res.success, true, 'Split slot swap succeeded');

  // Day 3 should now have Tofu Stir Fry
  assert.strictEqual(res.plan.slots['3'].dinner.recipeId, 'rec-stirfry', 'Day 3 has Stir Fry');
  assert.strictEqual(res.plan.slots['3'].dinnerE, undefined, 'Old split dinnerE cleared from Day 3');

  // Day 4 should now have the split dinnerE and dinnerC
  assert.strictEqual(res.plan.slots['4'].dinnerE.recipeId, 'rec-salad', 'Day 4 has Steak Salad for Elliott');
  assert.strictEqual(res.plan.slots['4'].dinnerC.recipeId, 'rec-pasta', 'Day 4 has Pesto Pasta for Chloe');
  assert.strictEqual(res.plan.slots['4'].dinner, undefined, 'Old single dinner cleared from Day 4');

  console.log('✅ Test 2 Passed: Split person slots swapped without corruption or orphan keys.');
}

// --------------------------------------------------------------------------
// TEST 3: Eaten Status Reset on Swapped Slots
// --------------------------------------------------------------------------
console.log('\n--- Test 3: Eaten Status Reset on Swapped Slots ---');
{
  const res = swapPlanMealSlots(mockPlan, '1', '2', 'dinner');
  const eaten = res.plan.eatenMeals;

  // Eaten ticks for Day 1 dinner (2026-11-04) and Day 2 dinner (2026-11-05) should be deleted
  assert.strictEqual(eaten['2026-11-04:dinner'], undefined, 'Day 1 dinner eaten tick removed');
  assert.strictEqual(eaten['2026-11-04:dinner:e'], undefined, 'Day 1 dinner:e eaten tick removed');
  assert.strictEqual(eaten['2026-11-05:dinner:c'], undefined, 'Day 2 dinner:c eaten tick removed');

  // Unrelated eaten ticks should be preserved (Day 1 breakfast, Day 3 dinner)
  assert.strictEqual(eaten['2026-11-04:breakfast'], true, 'Day 1 breakfast eaten tick preserved');
  assert.strictEqual(eaten['2026-11-06:dinner'], true, 'Day 3 dinner eaten tick preserved');

  console.log('✅ Test 3 Passed: Eaten ticks cleared for swapped dates and preserved for other meals.');
}

// --------------------------------------------------------------------------
// TEST 4: Multi-Step Sequential Rotation (Mon -> Tue -> Fri -> Mon)
// --------------------------------------------------------------------------
console.log('\n--- Test 4: Sequential Multi-Day Rotation ---');
{
  // User wants: Monday meal -> Tuesday, Tuesday meal -> Friday, Friday meal -> Monday
  // Step 1: Swap Day 1 (Mon Curry) with Day 2 (Tue Spaghetti)
  const step1 = swapPlanMealSlots(mockPlan, '1', '2', 'dinner');
  // Day 1 has Spaghetti, Day 2 has Curry

  // Step 2: Swap Day 2 (now Curry) with Day 5 (Fri Pizza)
  const step2 = swapPlanMealSlots(step1.plan, '2', '5', 'dinner');
  // Day 2 has Pizza, Day 5 has Curry

  // Result:
  // Day 1 has Spaghetti (originally Day 2)
  // Day 2 has Pizza (originally Day 5)
  // Day 5 has Curry (originally Day 1)
  assert.strictEqual(step2.plan.slots['1'].dinnerE.recipeId, 'rec-spaghetti', 'Day 1 now has Spaghetti');
  assert.strictEqual(step2.plan.slots['2'].dinnerE.recipeId, 'rec-pizza', 'Day 2 now has Pizza');
  assert.strictEqual(step2.plan.slots['5'].dinnerE.recipeId, 'rec-curry', 'Day 5 now has Curry');

  console.log('✅ Test 4 Passed: 3-way rotation cleanly executed through consecutive pairwise swaps.');
}

// --------------------------------------------------------------------------
// TEST 5: Modal UI Component Rendering & ActionBridge Contract
// --------------------------------------------------------------------------
console.log('\n--- Test 5: Modal UI Component Rendering ---');
{
  const mockRecipes = [
    { id: 'rec-curry', name: 'Chicken Curry' },
    { id: 'rec-spaghetti', name: 'Spaghetti Bolognese' },
    { id: 'rec-salad', name: 'Steak Salad' },
    { id: 'rec-pasta', name: 'Pesto Pasta' },
    { id: 'rec-stirfry', name: 'Tofu Stir Fry' },
    { id: 'rec-pizza', name: 'Homemade Pizza' }
  ];

  const html = renderTodaySwapModalHtml({
    plan: mockPlan,
    sourceDayKey: '1',
    mealType: 'dinner',
    recipes: mockRecipes
  });

  assert.ok(html.includes('id="today-swap-modal-wrap"'), 'Modal wrapper present');
  assert.ok(html.includes('Swap Dinner'), 'Title includes Swap Dinner');
  assert.ok(html.includes('data-action="close-today-swap-modal"'), 'Close button has data-action');
  assert.ok(html.includes('data-action="execute-today-slot-swap"'), 'Destination days have execute action');
  assert.ok(html.includes('data-source-day="1"'), 'Source day correctly bound');
  assert.ok(html.includes('data-target-day="2"'), 'Target day 2 present');
  assert.ok(html.includes('data-target-day="5"'), 'Target day 5 present');
  assert.ok(html.includes('Spaghetti Bolognese'), 'Destination meal title rendered in preview');

  console.log('✅ Test 5 Passed: Modal renders valid data-action attributes and previews.');
}

console.log('\n=== ALL TODAY MEAL REARRANGE TESTS PASSED! ===');
