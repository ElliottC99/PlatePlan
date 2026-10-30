/**
 * scripts/test_plan_generator.js
 * Checks the weekly plan generator (generateWeeklyPlan in src/services/MealPlanGeneratorService.js).
 * The expected plan was recorded from the generator before Active Stock was removed, run on
 * these fixtures with an empty stock list, so it proves the stock weighting left no trace.
 * Run: node scripts/test_plan_generator.js
 */

import assert from 'node:assert/strict';

// Day names come from the local time zone, so pin it before anything reads a date.
process.env.TZ = 'UTC';
// The generator pulls in the store, which touches window and localStorage on import.
global.window = global.window || {};
global.localStorage = global.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { generateWeeklyPlan, detectPrimaryProteinKeyword } = await import('../src/services/MealPlanGeneratorService.js');

// High-protein vegetarian recipe fixtures
const mockRecipes = [
  {
    id: 'rec-tofu-curry',
    title: 'Crispy Tofu Curry',
    macros: { calories: 600, protein: 35, carbs: 50, fat: 18 },
    ingredients: [
      { ingredientId: 'ing-tofu-1', name: 'Extra Firm Tofu', qty: 200, unit: 'g' },
      { ingredientId: 'ing-garlic-1', name: 'Garlic', qty: 2, unit: 'clove' }
    ]
  },
  {
    id: 'rec-tempeh-stirfry',
    title: 'Smoky Tempeh Stir-Fry',
    macros: { calories: 550, protein: 32, carbs: 45, fat: 16 },
    ingredients: [
      { ingredientId: 'ing-tempeh-1', name: 'Organic Tempeh', qty: 180, unit: 'g' }
    ]
  },
  {
    id: 'rec-halloumi-wrap',
    title: 'Grilled Halloumi & Lentil Salad',
    macros: { calories: 650, protein: 38, carbs: 55, fat: 22 },
    ingredients: [
      { ingredientId: 'ing-halloumi-1', name: 'Halloumi Cheese', qty: 150, unit: 'g' },
      { ingredientId: 'ing-lentils-1', name: 'Green Lentils', qty: 200, unit: 'g' }
    ]
  },
  {
    id: 'rec-seitan-roast',
    title: 'Herb Roasted Seitan Steak',
    macros: { calories: 580, protein: 42, carbs: 30, fat: 12 },
    ingredients: [
      { ingredientId: 'ing-seitan-1', name: 'Vital Wheat Gluten / Seitan', qty: 150, unit: 'g' }
    ]
  },
  {
    id: 'rec-protein-snack',
    title: 'Edamame & Pea Protein Bowl',
    macros: { calories: 250, protein: 20, carbs: 20, fat: 5 },
    ingredients: [
      { ingredientId: 'ing-edamame-1', name: 'Shelled Edamame', qty: 150, unit: 'g' }
    ]
  }
];

// --- Protein keyword per recipe (drives the rotation penalty) ---
assert.deepEqual(
  mockRecipes.map(r => [r.id, detectPrimaryProteinKeyword(r)]),
  [
    ['rec-tofu-curry', 'tofu'],
    ['rec-tempeh-stirfry', 'tempeh'],
    ['rec-halloumi-wrap', 'halloumi'],
    ['rec-seitan-roast', 'seitan'],
    ['rec-protein-snack', 'edamame']
  ]
);

// --- Weekly plan matches the recorded empty-stock plan ---
const plan = generateWeeklyPlan({
  days: 7,
  startDate: '2026-10-12',
  dailyTargets: { calories: 2000, protein: 140, carbs: 200, fat: 65 },
  recipes: mockRecipes,
  proteinRotation: true
});

// Lunch and snack are the same every day; dinner alternates seitan and tempeh because
// the rotation penalty stops the same protein two dinners running.
const lunch = ['lunch', 'rec-protein-snack', 3, { calories: 750, protein: 60, carbs: 60, fat: 15 }];
const snack = ['snack', 'rec-seitan-roast', 0.5, { calories: 290, protein: 21, carbs: 15, fat: 6 }];
const seitanDay = {
  meals: [lunch, ['dinner', 'rec-seitan-roast', 1.5, { calories: 870, protein: 63, carbs: 45, fat: 18 }], snack],
  dailyTotals: { calories: 1910, protein: 144, carbs: 120, fat: 39 },
  proteinDeltaPct: 3
};
const tempehDay = {
  meals: [lunch, ['dinner', 'rec-tempeh-stirfry', 2, { calories: 1100, protein: 64, carbs: 90, fat: 32 }], snack],
  dailyTotals: { calories: 2140, protein: 145, carbs: 165, fat: 53 },
  proteinDeltaPct: 4
};
const expectedDays = [
  { date: '2026-10-12', dayName: 'Monday', ...seitanDay },
  { date: '2026-10-13', dayName: 'Tuesday', ...tempehDay },
  { date: '2026-10-14', dayName: 'Wednesday', ...seitanDay },
  { date: '2026-10-15', dayName: 'Thursday', ...tempehDay },
  { date: '2026-10-16', dayName: 'Friday', ...seitanDay },
  { date: '2026-10-17', dayName: 'Saturday', ...tempehDay },
  { date: '2026-10-18', dayName: 'Sunday', ...seitanDay }
];

assert.equal(plan.startDate, '2026-10-12');
assert.equal(plan.endDate, '2026-10-18');
assert.deepEqual(plan.macroTargets, { calories: 2000, protein: 140, carbs: 200, fat: 65 });
assert.deepEqual(
  plan.days.map(d => ({
    date: d.date,
    dayName: d.dayName,
    meals: d.meals.map(m => [m.mealType, m.recipeId, m.servings, m.macros]),
    dailyTotals: d.dailyTotals,
    proteinDeltaPct: d.proteinDeltaPct
  })),
  expectedDays
);

// --- No stock summary on the plan ---
assert.equal('pantrySummary' in plan, false, 'plan has no pantrySummary');

console.log('test_plan_generator: all assertions passed');
