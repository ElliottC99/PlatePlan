/**
 * scripts/test_dq_servings_mealtype_review.js
 * Regression test for Area C: Data Quality Servings & Meal-Type Review Wizard.
 * Covers AE1 (smart flagging), AE2 (apply/keep persistence + clean history safety),
 * and AE3 (reset reviewed choices).
 */

import assert from 'node:assert/strict';

globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem() {},
  removeItem() {}
};

const {
  scanServingsAndMealTypeMismatches,
  computeScaledRecipePreview,
  markRecipeMetadataReviewed,
  resetReviewedRecipeMetadata,
  applyRecipeMetadataReview
} = await import('../src/services/DataQualityScanner.js');
const { whitelistPreferences } = await import('../src/services/PreferenceRepository.js');
const { sanitizePreferences } = await import('../src/store/actions/pantryActions.js');
const { setRecipes, setPreferences, getState } = await import('../src/store/store.js');
const { handleCleanHistoryCache } = await import('../src/views/DataQualityTableRenderService.js');

// Household targets (Elliott 2100 kcal / 140g P, Chloe 1650 kcal / 105g P)
const basePrefs = {
  profiles: {
    elliott: { dailyKcal: 2100, dailyProtein: 140 },
    chloe: { dailyKcal: 1650, dailyProtein: 105 }
  },
  dismissedQualityAdvisories: Array.from({ length: 25 }, (_, i) => `advisory:old:${i}`),
  reviewedRecipeMetadata: {}
};

const recipeA = {
  id: 'rec-oats',
  name: 'Overnight Cinnamon Oats',
  serves: 1,
  types: ['dinner'],
  mealSuitability: ['Dinner'],
  macros: { calories: 1150, protein: 60, carbs: 140, fat: 30 },
  cal: 1150,
  prot: 60
};

const recipeB = {
  id: 'rec-curry',
  name: 'Chicken Curry',
  serves: 2,
  types: ['dinner'],
  mealSuitability: ['Dinner'],
  macros: { calories: 650, protein: 48, carbs: 60, fat: 22 },
  cal: 650,
  prot: 48
};

// AE1: Smart flagging catches suspicious servings + meal type and ignores healthy recipe
{
  const flagged = scanServingsAndMealTypeMismatches({
    recipes: [recipeA, recipeB],
    ingredients: [],
    products: [],
    preferences: basePrefs
  });

  assert.equal(flagged.length, 1, 'Expected only Recipe A to be flagged');
  const itemA = flagged[0];
  assert.equal(itemA.recipeId, 'rec-oats');
  assert.equal(itemA.hasMealTypeMismatch, true, 'Expected meal-type mismatch for Overnight Cinnamon Oats');
  assert.ok(itemA.suggestedMealTypes.includes('breakfast'), 'Expected Breakfast to be suggested');
  assert.equal(itemA.hasServingsMismatch, true, 'Expected servings mismatch for 1150 kcal breakfast');
  assert.ok(itemA.suggestedServes >= 2 && itemA.suggestedServes <= 3, `Expected suggestedServes 2 or 3, got ${itemA.suggestedServes}`);
  assert.ok(itemA.suggestedMacros.cal < 650, 'Expected scaled per-serving calories to drop into reasonable meal range');
  console.log('✓ AE1 passed: suspicious servings & meal type flagged, healthy recipe ignored');
}

// Live preview scaling check (including stale macros.cal / nutrition.perServing shadowing guard)
{
  const legacyRecipe = {
    ...recipeA,
    macros: { calories: 1150, cal: 1150, protein: 60, prot: 60, carbs: 140, fat: 30 },
    nutrition: { perServing: { cal: 1150, prot: 60 } }
  };
  const preview1 = computeScaledRecipePreview(legacyRecipe, 1, ['breakfast'], { preferences: basePrefs });
  const preview2 = computeScaledRecipePreview(legacyRecipe, 2, ['breakfast'], { preferences: basePrefs });
  const preview4 = computeScaledRecipePreview(legacyRecipe, 4, ['breakfast'], { preferences: basePrefs });
  assert.equal(preview2.serves, 2);
  assert.equal(preview2.macros.cal, 575, 'Expected 1150 / 2 = 575 kcal per serving');
  assert.equal(preview2.macros.prot, 30, 'Expected 60 / 2 = 30g protein per serving');
  assert.deepEqual(preview2.mealTypes, ['breakfast']);
  assert.notEqual(preview2.fitScore, preview4.fitScore, 'Scaled Fit Score must respond to servings change even when legacy macros.cal / nutrition.perServing exist');
  assert.ok(preview1.fitScore >= 0);

  // Overnight Marinated Chicken should not false-positive as Breakfast
  const overnightChicken = {
    id: 'rec-overnight-chicken',
    name: 'Overnight Marinated Chicken',
    serves: 2,
    types: ['dinner'],
    macros: { calories: 640, protein: 50, carbs: 45, fat: 22 }
  };
  const chickenFlagged = scanServingsAndMealTypeMismatches({
    recipes: [overnightChicken],
    ingredients: [],
    products: [],
    preferences: basePrefs
  });
  assert.equal(chickenFlagged.length, 0, 'Overnight Marinated Chicken must not false-positive as Breakfast');
  console.log('✓ Live preview scaling & legacy macro shadowing guard passed');
}

// Preferences whitelist & sanitizer must preserve reviewedRecipeMetadata
{
  const testPrefs = {
    ...basePrefs,
    reviewedRecipeMetadata: {
      'rec-oats': { status: 'kept', serves: 1, mealTypes: ['dinner'], reviewedAt: '2026-11-26T16:00:00.000Z' }
    }
  };
  const sanitized = sanitizePreferences(testPrefs);
  assert.ok(sanitized.reviewedRecipeMetadata?.['rec-oats'], 'sanitizePreferences must preserve reviewedRecipeMetadata');
  const whitelisted = whitelistPreferences(testPrefs);
  assert.ok(whitelisted.reviewedRecipeMetadata?.['rec-oats'], 'whitelistPreferences must preserve reviewedRecipeMetadata');
  console.log('✓ Preference sanitizer & whitelist preserve reviewedRecipeMetadata');
}

// AE2: Keep Current & Remember persists, suppresses re-prompting, and survives Clean History Cache
{
  setRecipes([recipeA, recipeB]);
  setPreferences(basePrefs);

  await markRecipeMetadataReviewed('rec-oats', {
    status: 'kept',
    serves: 1,
    mealTypes: ['dinner']
  });

  const afterKeep = scanServingsAndMealTypeMismatches(getState());
  assert.equal(afterKeep.length, 0, 'Reviewed recipe must disappear from subsequent scans');
  assert.equal(getState().preferences.reviewedRecipeMetadata['rec-oats'].status, 'kept');

  // Run Clean History Cache (prunes dismissedQualityAdvisories to last 20)
  await handleCleanHistoryCache();
  assert.equal(getState().preferences.dismissedQualityAdvisories.length, 20, 'Clean History Cache should still prune dismissedQualityAdvisories');
  assert.ok(getState().preferences.reviewedRecipeMetadata?.['rec-oats'], 'Clean History Cache must NOT erase reviewedRecipeMetadata');
  console.log('✓ AE2 (Keep & Clean History Cache safety) passed');
}

// AE3: Reset Reviewed restores flagged recipe
{
  await resetReviewedRecipeMetadata();
  assert.deepEqual(getState().preferences.reviewedRecipeMetadata, {});
  const afterReset = scanServingsAndMealTypeMismatches(getState());
  assert.equal(afterReset.length, 1, 'Resetting reviewed decisions must restore flagged recipe');
  assert.equal(afterReset[0].recipeId, 'rec-oats');
  console.log('✓ AE3 (Reset Reviewed) passed');
}

// AE2 (Apply & Remember): updates recipe serves, mealSuitability, types, and recalculated macros
{
  const updated = await applyRecipeMetadataReview('rec-oats', {
    serves: 2,
    mealTypes: ['breakfast']
  });
  assert.equal(updated.serves, 2);
  assert.equal(updated.servings, 2);
  assert.deepEqual(updated.types, ['breakfast']);
  assert.deepEqual(updated.mealSuitability, ['Breakfast']);
  assert.equal(updated.macros.calories, 575);
  assert.equal(updated.macros.protein, 30);
  assert.equal(getState().preferences.reviewedRecipeMetadata['rec-oats'].status, 'applied');

  const afterApply = scanServingsAndMealTypeMismatches(getState());
  assert.equal(afterApply.length, 0, 'Applied & remembered recipe should not re-flag');
  console.log('✓ AE2 (Apply & Remember) passed');
}

console.log('\nALL SERVINGS & MEAL-TYPE REVIEW TESTS PASSED');
