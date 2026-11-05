/**
 * scripts/test_vault_enhanced_fit_and_wizard_gate.js
 * Regression tests for:
 * 1. Vault Enhanced Recipe Fit Score & Portion Formatting (preventing 0% Poor Match collapses and blank portions).
 * 2. Recipe Wizard Step 2 Strict Mapping Gating (preventing progression with "New Item" / unlinked ingredients).
 */

import assert from 'node:assert';

// Stubs for node environment
global.localStorage = { removeItem: () => {}, getItem: () => null, setItem: () => {} };
global.window = {
  localStorage: global.localStorage,
  isRecipeVariantFavourite: () => false,
  getState: () => ({
    preferences: {
      profiles: {
        elliott: { dailyKcal: 2100, dailyProtein: 140 },
        chloe: { dailyKcal: 1650, dailyProtein: 105 }
      }
    },
    products: [
      { id: 'prod_beef', name: 'Beef Burgers', kcal: 260, protein: 24, unit: 'qty' },
      { id: 'prod_tofu', name: 'Firm Tofu', kcal: 120, protein: 14, unit: 'g' }
    ],
    ingredients: [
      { id: 'root_tofu', name: 'Tofu', category: 'Refrigerated & Dairy' },
      { id: 'root_beef', name: 'Beef Burgers', category: 'Meat & Poultry' }
    ]
  })
};

console.log('--- Running Vault Enhanced Fit & Wizard Step 2 Gating Tests ---');

// 1. Test Enhanced Recipe Fit Score Calculation and Macro Extraction
{
  console.log('Testing Enhanced Recipe Fit Score & Macro Normalization...');
  const { calculateMealFitScore } = await import('../src/utils/fitScoreCalculator.js');
  const { extractRecipeMacros } = await import('../src/utils/macroScoringUtils.js');

  const recipe = {
    id: 'rec_smashed_burgers',
    name: 'Smashed Brooklyn Burgers',
    title: 'Smashed Brooklyn Burgers',
    type: 'dinner',
    types: ['dinner'],
    serves: 2,
    servings: 2,
    macros: { calories: 650, protein: 42, carbs: 45, fat: 25 },
    enhanced: {
      title: 'Smashed Brooklyn Burgers (Enhanced)',
      serves: 2,
      servings: 2,
      macros: { calories: 620, protein: 55, carbs: 40, fat: 16 },
      changes: 'Boost lean protein: 2qty -> 3qty Beef Burgers; Swap American Cheese -> Reduced Fat Cheese'
    }
  };

  // Original Macro extraction should preserve per-serving values (not divide by serves)
  const origMacros = extractRecipeMacros(recipe, 'original');
  assert.strictEqual(origMacros.cal, 650, 'Original calories should be preserved per-serving (650)');
  assert.strictEqual(origMacros.prot, 42, 'Original protein should be preserved per-serving (42)');

  // Enhanced Macro extraction should preserve enhanced per-serving values
  const enhMacros = extractRecipeMacros(recipe, 'enhanced');
  assert.strictEqual(enhMacros.cal, 620, 'Enhanced calories should be preserved per-serving (620)');
  assert.strictEqual(enhMacros.prot, 55, 'Enhanced protein should be preserved per-serving (55)');

  // Calculate Fit Scores
  const origFit = calculateMealFitScore(recipe, 'dinner', { variant: 'original', portionScaled: true });
  assert.ok(origFit.score >= 80, `Original fit score should be >= 80, got ${origFit.score}%`);
  assert.strictEqual(origFit.tier, 'green', 'Original tier should be green');

  const enhFit = calculateMealFitScore(recipe, 'dinner', { variant: 'enhanced', portionScaled: true });
  assert.ok(enhFit.score >= 80, `Enhanced fit score should be >= 80, got ${enhFit.score}%`);
  assert.notStrictEqual(enhFit.score, 0, 'Enhanced fit score must not collapse to 0%');
  assert.strictEqual(enhFit.tier, 'green', 'Enhanced tier should be green');

  console.log(`  ✓ Original Fit Score: ${origFit.score}% (${origFit.tierLabel})`);
  console.log(`  ✓ Enhanced Fit Score: ${enhFit.score}% (${enhFit.tierLabel})`);
}

// 2. Test Vault Card Rendering and Portion Text Display
{
  console.log('Testing Vault Recipe Card Rendering & Portion Targets...');
  const { calculateMealFitScore } = await import('../src/utils/fitScoreCalculator.js');
  global.window.calculateMealFitScore = calculateMealFitScore;

  const { renderVaultRecipeCard } = await import('../src/components/vault/VaultRecipeCard.js');

  const recipe = {
    id: 'rec_smashed_burgers',
    name: 'Smashed Brooklyn Burgers',
    type: 'dinner',
    types: ['dinner'],
    serves: 2,
    servings: 2,
    macros: { calories: 650, protein: 42, carbs: 45, fat: 25 },
    enhanced: {
      title: 'Smashed Brooklyn Burgers (Enhanced)',
      serves: 2,
      servings: 2,
      macros: { calories: 620, protein: 55, carbs: 40, fat: 16 },
      changes: 'Boost lean protein: 2qty -> 3qty Beef Burgers; Swap American Cheese -> Reduced Fat Cheese'
    }
  };

  const html = renderVaultRecipeCard(recipe);

  // Both Elliott and Chloe buttons must contain calorie and protein numbers (not blank "Elliott ")
  const elliottBtnMatches = html.match(/<button[^>]*data-person="e"[^>]*>(.*?)<\/button>/g) || [];
  assert.ok(elliottBtnMatches.length >= 2, 'Should render Elliott portion buttons for original and enhanced');
  elliottBtnMatches.forEach(btn => {
    assert.ok(/Elliott\s+\d+kcal,\s+\d+g/.test(btn), `Button text should contain formatted kcal and protein: ${btn}`);
  });

  const chloeBtnMatches = html.match(/<button[^>]*data-person="c"[^>]*>(.*?)<\/button>/g) || [];
  assert.ok(chloeBtnMatches.length >= 2, 'Should render Chloe portion buttons for original and enhanced');
  chloeBtnMatches.forEach(btn => {
    assert.ok(/Chloe\s+\d+kcal,\s+\d+g/.test(btn), `Button text should contain formatted kcal and protein: ${btn}`);
  });

  // Ensure no "0% · Poor Match" exists
  assert.ok(!html.includes('0% · Poor Match'), 'Card should not render 0% Poor Match');

  console.log('  ✓ Vault card rendered with formatted portion targets and active fit scores');
}

// 3. Test Step 2 isIngredientUnlinked Gating
{
  console.log('Testing isIngredientUnlinked validation rules...');
  const { isIngredientUnlinked } = await import('../src/components/recipe/RecipeWizardTaxonomySearch.js');

  const mockProducts = [{ id: 'prod_tofu', name: 'Firm Tofu' }];
  const mockIngredients = [{ id: 'root_tofu', name: 'Tofu', subtypes: [{ id: 'sub_firm', name: 'Firm Tofu' }] }];

  // Unlinked cases
  assert.strictEqual(isIngredientUnlinked({ isNewTaxonomyItem: true }), true, 'isNewTaxonomyItem should be unlinked');
  assert.strictEqual(isIngredientUnlinked({ ingredientId: 'new_item' }), true, 'ingredientId new_item should be unlinked');
  assert.strictEqual(isIngredientUnlinked({ ingredientId: 'New Item' }), true, '"New Item" string should be unlinked');
  assert.strictEqual(isIngredientUnlinked({ name: 'Unmapped Item' }), true, 'Bare item with no mapping should be unlinked');
  assert.strictEqual(isIngredientUnlinked({ categoryId: 'Store Cupboard' }), true, 'Fallback category without isCategoryDefault should be unlinked');

  // Linked cases
  assert.strictEqual(isIngredientUnlinked({ categoryId: 'Produce', isCategoryDefault: true }), false, 'Explicit category default should be linked');
  assert.strictEqual(isIngredientUnlinked({ categoryId: 'Refrigerated & Dairy' }), false, 'Valid specific category should be linked');
  assert.strictEqual(isIngredientUnlinked({ ingredientId: 'root_tofu' }), false, 'Valid root item should be linked');
  assert.strictEqual(isIngredientUnlinked({ subtypeId: 'sub_firm' }), false, 'Valid subtype should be linked');
  assert.strictEqual(isIngredientUnlinked({ productId: 'prod_tofu' }, mockProducts), false, 'Valid product should be linked');

  console.log('  ✓ isIngredientUnlinked correctly discriminates linked vs unlinked items');
}

// 4. Test Step 2 Input Sync Normalization
{
  console.log('Testing syncStep2InputsToState input handling for "New Item"...');
  const { wizardState, syncStep2InputsToState } = await import('../src/components/recipe/RecipeWizardState.js');

  wizardState.activeRecipe = {
    title: 'Gating Test Recipe',
    servings: 2,
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { name: 'Mystery Spice', ingredientId: null, isNewTaxonomyItem: true }
        ]
      }
    ],
    methodSteps: ['Step one']
  };

  const fakeModal = {
    querySelectorAll(selector) {
      if (selector === '.wiz-ing-tax-search') {
        return [
          {
            dataset: { sidx: '0', iidx: '0', taxVal: 'new_item' },
            value: '✨ New Item'
          }
        ];
      }
      return [];
    },
    querySelector() { return null; }
  };

  syncStep2InputsToState(fakeModal);

  const syncedItem = wizardState.activeRecipe.ingredientSections[0].ingredients[0];
  assert.strictEqual(syncedItem.isNewTaxonomyItem, true, 'Item with "✨ New Item" input must retain isNewTaxonomyItem: true');
  assert.strictEqual(syncedItem.ingredientId, null, 'Item with "✨ New Item" must not assign ingredientId');

  console.log('  ✓ syncStep2InputsToState normalizes "New Item" inputs reliably');
}

console.log('All Vault Enhanced Fit & Wizard Step 2 Gating tests passed! ✅');
