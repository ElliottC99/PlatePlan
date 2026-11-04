/**
 * scripts/test_meal_plan_library_and_rotation.js
 * Verification suite for Meal Plan Library auto-archiving, interactive history management,
 * and 30-day recipe rotation / repeat-avoidance in the Generator.
 */

import assert from 'node:assert';
import { createPlanArchivePayload } from '../src/repositories/PlanRepository.js';
import { getPlanRecipeIds, getPlanDateRangeLabel, renderHistoryPanel } from '../src/components/planner/PlannerGridUI.js';
import { getRecentRecipeUsageMap, generateMealPlan } from '../src/services/MealPlanGeneratorService.js';

console.log('=== RUNNING MEAL PLAN LIBRARY & 30-DAY ROTATION TEST SUITE ===\n');

// --------------------------------------------------------------------------
// TEST 1: createPlanArchivePayload constructs clean, date-stamped snapshots
// --------------------------------------------------------------------------
console.log('--- Test 1: Plan Archive Payload Generation ---');
{
  const mockPlan = {
    startDate: '2026-11-04',
    days: 7,
    slots: {
      1: { dinnerE: { id: 'rec-curry', recipeId: 'rec-curry' }, dinnerC: { id: 'rec-curry', recipeId: 'rec-curry' } },
      2: { dinnerE: { id: 'rec-pasta', recipeId: 'rec-pasta' }, dinnerC: { id: 'rec-pasta', recipeId: 'rec-pasta' } }
    },
    score: { score: 88, macroMatchPct: 95 }
  };

  const payload = createPlanArchivePayload(mockPlan);
  assert.ok(payload.id.startsWith('plan_20261104_'), 'Payload ID must start with plan_YYYYMMDD');
  assert.strictEqual(payload.days, 7, 'Days count preserved');
  assert.strictEqual(payload.startDate, '2026-11-04', 'Start date preserved');
  assert.strictEqual(payload.endDate, '2026-11-10', 'End date accurately calculated from start + days - 1');
  assert.ok(payload.name.includes('4 Nov') && payload.name.includes('10 Nov'), 'Default title includes readable dates');
  assert.ok(payload.archivedAt, 'Archived timestamp present');

  console.log('✅ Test 1 Passed: Archive payload generated with date range, calculated end date, and stable ID.');
}

// --------------------------------------------------------------------------
// TEST 2: getPlanRecipeIds extracts distinct recipe IDs and ignores skips
// --------------------------------------------------------------------------
console.log('\n--- Test 2: Recipe Extraction from Plan Slots ---');
{
  const planWithSkips = {
    slots: {
      1: {
        breakfastE: { recipeId: 'rec-oats' },
        dinnerE: { recipeId: 'rec-stirfry' },
        dinnerC: { recipeId: 'rec-stirfry' }
      },
      2: {
        breakfastE: { isSkipped: true },
        lunchE: { id: 'rec-salad' },
        dinnerE: { skipped: true }
      }
    }
  };

  const recipeIds = getPlanRecipeIds(planWithSkips);
  assert.strictEqual(recipeIds.length, 3, 'Should extract exactly 3 unique non-skipped recipes');
  assert.ok(recipeIds.includes('rec-oats'), 'Includes rec-oats');
  assert.ok(recipeIds.includes('rec-stirfry'), 'Includes rec-stirfry');
  assert.ok(recipeIds.includes('rec-salad'), 'Includes rec-salad');

  console.log('✅ Test 2 Passed: Recipe IDs extracted cleanly without duplicates or skipped slots.');
}

// --------------------------------------------------------------------------
// TEST 3: getRecentRecipeUsageMap captures last 30 days and ignores older plans
// --------------------------------------------------------------------------
console.log('\n--- Test 3: Recent Recipe Usage 30-Day Window Extraction ---');
{
  const now = new Date();
  const recentDate = new Date(now.getTime() - (5 * 86400000)).toISOString().split('T')[0]; // 5 days ago
  const oldDate = new Date(now.getTime() - (45 * 86400000)).toISOString().split('T')[0]; // 45 days ago

  const recentPlan = {
    startDate: recentDate,
    slots: {
      1: { dinnerE: { recipeId: 'rec-recent-tacos' } }
    }
  };

  const oldPlan = {
    startDate: oldDate,
    slots: {
      1: { dinnerE: { recipeId: 'rec-old-stew' } }
    }
  };

  const usageMap = getRecentRecipeUsageMap([oldPlan], recentPlan, 30);
  assert.ok(usageMap.has('rec-recent-tacos'), 'Recent recipe within 30 days must be in usage map');
  assert.ok(!usageMap.has('rec-old-stew'), 'Old recipe from 45 days ago must be excluded from 30-day usage map');

  console.log('✅ Test 3 Passed: 30-day window strictly enforced; recent recipes captured and older ones filtered.');
}

// --------------------------------------------------------------------------
// TEST 4: Meal Plan Generator strictly avoids recent recipes with fallback
// --------------------------------------------------------------------------
console.log('\n--- Test 4: Generator 30-Day Recipe Repeat Avoidance & Fallback ---');
{
  // 6 dinner recipes
  const mockRecipes = [
    { id: 'rec-1', name: 'Fresh Salmon', types: ['dinner'] },
    { id: 'rec-2', name: 'Fresh Risotto', types: ['dinner'] },
    { id: 'rec-3', name: 'Fresh Curry', types: ['dinner'] },
    { id: 'rec-4', name: 'Fresh Pasta', types: ['dinner'] },
    { id: 'rec-used-1', name: 'Recent Pizza', types: ['dinner'] },
    { id: 'rec-used-2', name: 'Recent Burgers', types: ['dinner'] }
  ];

  const now = new Date();
  const recentDate = new Date(now.getTime() - (3 * 86400000)).toISOString().split('T')[0];

  const pastPlan = {
    startDate: recentDate,
    slots: {
      1: { dinnerE: { recipeId: 'rec-used-1' } },
      2: { dinnerE: { recipeId: 'rec-used-2' } }
    }
  };

  // Case A: 4 days with dinner cadence 1 = 4 recipes needed. We have 4 fresh recipes.
  const planA = generateMealPlan({
    days: 4,
    recipes: mockRecipes,
    planHistory: [pastPlan],
    cooldownDays: 30,
    cadence: { breakfast: 1, lunch: 1, dinner: 1 }
  });

  const plannedRecipesA = getPlanRecipeIds(planA);
  assert.ok(!plannedRecipesA.includes('rec-used-1'), 'Generator must avoid rec-used-1 when fresh recipes suffice');
  assert.ok(!plannedRecipesA.includes('rec-used-2'), 'Generator must avoid rec-used-2 when fresh recipes suffice');
  assert.strictEqual(plannedRecipesA.length, 4, 'All 4 planned slots must be fresh recipes');

  // Case B: 6 days needed with dinner cadence 1 = 6 recipes needed.
  // We only have 4 fresh recipes, so it MUST fall back to the used recipes gracefully without failing.
  const planB = generateMealPlan({
    days: 6,
    recipes: mockRecipes,
    planHistory: [pastPlan],
    cooldownDays: 30,
    cadence: { breakfast: 1, lunch: 1, dinner: 1 }
  });

  const plannedRecipesB = getPlanRecipeIds(planB);
  assert.strictEqual(plannedRecipesB.length, 6, 'Generator must gracefully fulfill all 6 slots using LRU fallback');
  assert.ok(plannedRecipesB.includes('rec-1'), 'Includes fresh recipe');
  assert.ok(plannedRecipesB.includes('rec-used-1'), 'Gracefully included fallback used recipe');

  console.log('✅ Test 4 Passed: Generator strictly avoids recent recipes when sufficient, and falls back gracefully when pool is small.');
}

// --------------------------------------------------------------------------
// TEST 5: renderHistoryPanel renders active plan badge and action buttons
// --------------------------------------------------------------------------
console.log('\n--- Test 5: Meal Plan Library UI Panel Rendering ---');
{
  const activePlan = {
    name: 'Active Autumn Week',
    startDate: '2026-11-04',
    days: 7,
    score: { score: 92 },
    slots: { 1: { dinnerE: { recipeId: 'rec-1' } } }
  };

  const historyPlans = [
    {
      id: 'plan_20261020',
      name: 'Past October Plan',
      startDate: '2026-10-20',
      days: 7,
      score: { score: 85 },
      slots: { 1: { dinnerE: { recipeId: 'rec-old' } } }
    }
  ];

  const html = renderHistoryPanel({ activePlan, historyPlans, recipes: [{ id: 'rec-1', name: 'Fresh Salmon' }] });
  assert.ok(html.includes('Currently Active Plan'), 'Must render active plan section');
  assert.ok(html.includes('● Active in Planner & Today'), 'Must display active plan badge');
  assert.ok(html.includes('data-action="restore-saved-plan"'), 'Historical card must have Load Plan action');
  assert.ok(html.includes('data-action="open-saved-plan-recipe-cards"'), 'Historical card must have Recipe Cards action');
  assert.ok(html.includes('data-action="delete-saved-plan"'), 'Historical card must have Delete action');

  console.log('✅ Test 5 Passed: Library panel renders active plan card, saved archives, and action buttons cleanly.');
}

console.log('\n=== ALL MEAL PLAN LIBRARY & ROTATION TESTS PASSED! ===');
