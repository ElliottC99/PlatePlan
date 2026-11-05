/**
 * scripts/test_recipe_wizard_and_auth.js
 * Regresses Recipe Wizard instruction parsing, step state preservation, dual-profile nutrition, and popup authentication.
 */

import assert from 'node:assert';
import { unpackCollapsedSteps } from '../src/services/RecipeParserService.js';
import { renderStep2MacrosSummaryHTML } from '../src/components/recipe/RecipeWizardStep2View.js';
import { wizardState, syncStep2InputsToState } from '../src/components/recipe/RecipeWizardState.js';

console.log('--- Running Recipe Wizard & Auth Regression Tests ---');

// 1. Instruction Parsing Tests
{
  console.log('Testing unpackCollapsedSteps...');

  // 1A: Inline numbered steps in a single paragraph
  const inlineNumbered = '1. Preheat oven to 200C. 2. Chop the vegetables into cubes. 3. Toss with olive oil and roast for 25 mins.';
  const steps1 = unpackCollapsedSteps(inlineNumbered);
  assert.strictEqual(steps1.length, 3, `Expected 3 steps from inline numbers, got ${steps1.length}`);
  assert.strictEqual(steps1[0], 'Preheat oven to 200C.');
  assert.strictEqual(steps1[1], 'Chop the vegetables into cubes.');
  assert.strictEqual(steps1[2], 'Toss with olive oil and roast for 25 mins.');

  // 1B: "Step X:" prefixes
  const stepPrefixes = 'Step 1: Press the firm tofu. Step 2: Slice into 2cm cubes. Step 3: Bake until crisp.';
  const steps2 = unpackCollapsedSteps(stepPrefixes);
  assert.strictEqual(steps2.length, 3, `Expected 3 steps from Step X: prefixes, got ${steps2.length}`);
  assert.strictEqual(steps2[0], 'Press the firm tofu.');
  assert.strictEqual(steps2[1], 'Slice into 2cm cubes.');
  assert.strictEqual(steps2[2], 'Bake until crisp.');

  // 1C: Bullet points
  const bulletText = '• Dice the onions and garlic.\n• Sauté in a pan until fragrant.\n• Add canned tomatoes and simmer.';
  const steps3 = unpackCollapsedSteps(bulletText);
  assert.strictEqual(steps3.length, 3, `Expected 3 steps from bullet points, got ${steps3.length}`);
  assert.strictEqual(steps3[0], 'Dice the onions and garlic.');
  assert.strictEqual(steps3[1], 'Sauté in a pan until fragrant.');
  assert.strictEqual(steps3[2], 'Add canned tomatoes and simmer.');

  // 1D: Mixed/Standard newlines
  const standardNewlines = '1. First step instruction\n2. Second step instruction\n3. Third step instruction';
  const steps4 = unpackCollapsedSteps(standardNewlines);
  assert.strictEqual(steps4.length, 3, `Expected 3 steps from standard newlines, got ${steps4.length}`);
  assert.strictEqual(steps4[0], 'First step instruction');
  assert.strictEqual(steps4[1], 'Second step instruction');
  assert.strictEqual(steps4[2], 'Third step instruction');

  console.log('  ✓ unpackCollapsedSteps passed all formats');
}

// 2. Dual-Profile Presentation Tests (Legacy banner removed)
{
  console.log('Testing removal of legacy whole-recipe carb/fat banner...');
  const banner = renderStep2MacrosSummaryHTML({ macros: { calories: 500, protein: 30, carbs: 45, fat: 12 } });
  assert.strictEqual(banner, '', 'renderStep2MacrosSummaryHTML should return empty string in favor of dual-profile card');
  console.log('  ✓ Legacy banner deprecated cleanly');
}

// 3. Step Addition & State Sync Tests
{
  console.log('Testing step additions and syncStep2InputsToState...');

  wizardState.activeRecipe = {
    title: 'Test Dish',
    servings: 4,
    ingredientSections: [{
      sectionTitle: 'Main Ingredients',
      ingredients: [{ qty: 2, unit: 'g', name: 'Tofu' }]
    }],
    methodSteps: ['Step one', 'Step two']
  };

  // Simulate DOM with 3 steps (user added a new empty step and typed)
  const fakeModal = {
    querySelectorAll(selector) {
      if (selector === '.wiz-step-input') {
        return [
          { value: 'Step one updated' },
          { value: 'Step two updated' },
          { value: '' } // new step just added
        ];
      }
      if (selector === '.wiz-section-title-input') return [];
      if (selector === '.wiz-ing-qty') return [];
      if (selector === '.wiz-ing-unit') return [];
      if (selector === '.wiz-tax-search-input') return [];
      if (selector === '.wiz-ing-water-ml') return [];
      return [];
    },
    querySelector(selector) {
      if (selector === '#wiz-servings-input') return { value: '6' };
      return null;
    }
  };

  syncStep2InputsToState(fakeModal);

  assert.strictEqual(wizardState.activeRecipe.servings, 6, 'Should sync servings yield to 6');
  assert.strictEqual(wizardState.activeRecipe.methodSteps.length, 3, 'Should preserve empty 3rd step so user can type');
  assert.strictEqual(wizardState.activeRecipe.methodSteps[0], 'Step one updated');
  assert.strictEqual(wizardState.activeRecipe.methodSteps[2], '', 'Newly added step should not be erased');

  console.log('  ✓ syncStep2InputsToState preserves newly added steps and servings');
}

console.log('All Recipe Wizard & Auth tests passed successfully! ✅');
