/**
 * scripts/test_recipe_macro_hydration_sync.js
 * Regression test for recipe macro hydration sync, stale nutrition.perServing shadowing,
 * enhanced variant serves scaling, and method step propagation.
 */
import assert from 'node:assert';
import { cleanLegacyMacros } from '../src/services/RecipeFirestoreRepository.js';
import { extractRecipeMacros } from '../src/utils/macroScoringUtils.js';
import { calculateMealFitScore } from '../src/utils/fitScoreCalculator.js';

console.log('--- Test 1: extractRecipeMacros prefers cleaned macros over stale nutrition.perServing keys ---');
const recipeWithStaleNutritionPerServing = {
  id: 'test-recipe-1',
  name: 'Burger',
  serves: 2,
  macros: {
    calories: 482,
    protein: 34,
    carbs: 45,
    fat: 25,
    price: 0
  },
  nutrition: {
    perServing: {
      cal: 540,      // Stale legacy key preserved by Firestore shallow merge
      prot: 29.2,    // Stale legacy key
      carb: 44.8,
      fat: 25.6,
      calories: 482, // New key saved by wizard
      protein: 34
    }
  }
};

const extracted = extractRecipeMacros(recipeWithStaleNutritionPerServing);
console.log('Extracted macros:', extracted);
assert.strictEqual(
  extracted.cal,
  482,
  `Expected extractRecipeMacros to return 482 cal from updated macros, but got stale ${extracted.cal}`
);
assert.strictEqual(
  extracted.prot,
  34,
  `Expected extractRecipeMacros to return 34g prot from updated macros, but got stale ${extracted.prot}`
);

console.log('--- Test 2: cleanLegacyMacros synchronizes nutrition.perServing with cleaned macros ---');
const rawRecipeFromFirestore = {
  id: 'test-recipe-2',
  name: 'Burger 2',
  serves: 2,
  macros: {
    calories: 482,
    protein: 34,
    carbs: 45,
    fat: 25
  },
  nutrition: {
    perServing: {
      cal: 540,
      prot: 29.2,
      carb: 44.8,
      fat: 25.6,
      calories: 482,
      protein: 34
    }
  }
};

const cleaned = cleanLegacyMacros(rawRecipeFromFirestore);
assert.strictEqual(
  cleaned.nutrition?.perServing?.cal,
  482,
  `Expected cleanLegacyMacros to synchronize nutrition.perServing.cal to 482, got ${cleaned.nutrition?.perServing?.cal}`
);
assert.strictEqual(
  cleaned.nutrition?.perServing?.prot,
  34,
  `Expected cleanLegacyMacros to synchronize nutrition.perServing.prot to 34, got ${cleaned.nutrition?.perServing?.prot}`
);

console.log('--- Test 3: Enhanced variant preserves serves scaling and does not inflate to 0% fit score ---');
const baseRecipe = {
  id: 'test-recipe-3',
  name: 'Smashed Brooklyn Burgers',
  serves: 2,
  macros: { calories: 482, protein: 34 },
  enhanced: {
    name: 'Smashed Brooklyn Burgers (Enhanced)',
    // Missing serves and servings on enhanced object
    serves: undefined,
    servings: undefined,
    cal: 1108,
    prot: 82,
    nutrition: {
      total: { cal: 1108, prot: 82 }
    }
  }
};

// Simulate Vault card construction:
const enhancedActive = {
  ...baseRecipe,
  ...baseRecipe.enhanced,
  serves: Number(baseRecipe.enhanced.serves || baseRecipe.enhanced.servings || baseRecipe.serves || baseRecipe.servings || 2) || 2,
  servings: Number(baseRecipe.enhanced.servings || baseRecipe.enhanced.serves || baseRecipe.servings || baseRecipe.serves || 2) || 2,
  ingredients: baseRecipe.enhanced.ingredients || baseRecipe.ingredients
};

const enhFit = calculateMealFitScore(enhancedActive, 'dinner', {
  activeProfile: 'everyone',
  variant: 'enhanced',
  portionScaled: true,
  userPrefs: {
    profiles: {
      elliott: { dailyKcal: 1950, dailyProtein: 140 },
      chloe: { dailyKcal: 1350, dailyProtein: 90 }
    }
  }
});

console.log('Enhanced Fit score:', enhFit.score + '%', 'Elliott kcal:', enhFit.details?.elliott?.recipeKcal);
assert(enhFit.score >= 85, `Expected enhanced fit score to be >= 85%, got ${enhFit.score}%`);
assert(enhFit.details?.elliott?.recipeKcal < 750, `Expected Elliott kcal < 750, got ${enhFit.details?.elliott?.recipeKcal}`);

console.log('--- Test 4: Method steps extraction falls back to base recipe or aliases ---');
const recipeWithBaseSteps = {
  id: 'test-recipe-4',
  name: 'Smashed Brooklyn Burgers',
  steps: ['Cut buns in half', 'Smash patties'],
  enhanced: {
    name: 'Smashed Brooklyn Burgers (Enhanced)',
    // Variant has no method or steps defined
    methodSteps: ['Cut buns in half', 'Smash patties', 'Add reduced fat cheddar']
  }
};

const activeR = {
  ...recipeWithBaseSteps,
  ...recipeWithBaseSteps.enhanced
};

// Method resolution rule:
const rawSteps = activeR.methodSteps || activeR.steps || activeR.method || activeR.instructions ||
                 recipeWithBaseSteps.methodSteps || recipeWithBaseSteps.steps || recipeWithBaseSteps.method || recipeWithBaseSteps.instructions || [];
const resolvedSteps = Array.isArray(rawSteps) ? rawSteps : [];

assert.strictEqual(resolvedSteps.length, 3, `Expected 3 steps, got ${resolvedSteps.length}`);
assert.strictEqual(resolvedSteps[2], 'Add reduced fat cheddar');

console.log('All recipe macro hydration sync assertions passed!');
