/**
 * scripts/test_recipe_wizard.js
 * Comprehensive verification test suite for Recipe Wizard v3.22.1:
 * 1. "2 x 400g" parses to 800g.
 * 2. "1 cup flour" converts to ~120g via density lookup.
 * 3. "1 cup milk" converts to 240ml.
 * 4. Multi-recipe paste block creates a queue of 2+ recipes.
 * 5. Alias saving updates the taxonomy store.
 * 6. Unit output is strictly restricted to 'g', 'ml', or 'qty'.
 */

import { parseIngredientString, parseBulkRecipeText, matchIngredientTaxonomy } from '../src/services/RecipeImporter.js';
import { convertToStrictUnit } from '../src/services/UnitConversionService.js';
import { learnIngredientAlias } from '../src/store/store.js';

console.log('=== RUNNING RECIPE WIZARD v3.22.1 UPGRADE TEST SUITE ===\n');

let testFailures = 0;

// Mock window/document for node execution
if (typeof window === 'undefined') {
  global.window = {
    state: {
      recipes: [],
      ingredients: [
        { id: 'ing-flour-1', name: 'Plain Flour', category: 'Pantry', aliases: [] },
        { id: 'ing-milk-1', name: 'Almond Milk', category: 'Dairy', aliases: [] }
      ]
    },
    Store: { getState: () => global.window.state }
  };
}

// Test 1: "2 x 400g" multiplier parsing
async function testMultiplierParsing() {
  console.log('--- Test 1: Multiplier Expression Parsing ("2 x 400g") ---');
  const parsed = parseIngredientString("2 x 400g tinned tomatoes");
  console.log(`Parsed result for "2 x 400g tinned tomatoes":`, JSON.stringify(parsed, null, 2));

  if (parsed && parsed.qty === 800 && parsed.unit === 'g') {
    console.log('✅ Test 1 Passed: "2 x 400g" correctly parsed and multiplied to 800g.');
  } else {
    console.error('❌ Test 1 Failed: Multiplier expression failed.');
    testFailures++;
  }
  console.log('');
}

// Test 2: Density-Based Dry Volume Conversion ("1 cup flour" -> ~120g)
async function testDensityFlour() {
  console.log('--- Test 2: Density-Based Conversion ("1 cup flour" -> ~120g) ---');
  const parsed = parseIngredientString("1 cup flour");
  console.log(`Parsed result for "1 cup flour":`, JSON.stringify(parsed, null, 2));

  if (parsed && parsed.unit === 'g' && parsed.qty >= 115 && parsed.qty <= 125) {
    console.log(`✅ Test 2 Passed: "1 cup flour" converted to ${parsed.qty}g via density lookup.`);
  } else {
    console.error('❌ Test 2 Failed: Flour density conversion incorrect.');
    testFailures++;
  }
  console.log('');
}

// Test 3: Liquid Volume Conversion ("1 cup milk" -> 240ml)
async function testLiquidMilk() {
  console.log('--- Test 3: Liquid Volume Conversion ("1 cup milk" -> 240ml) ---');
  const parsed = parseIngredientString("1 cup milk");
  console.log(`Parsed result for "1 cup milk":`, JSON.stringify(parsed, null, 2));

  if (parsed && parsed.unit === 'ml' && parsed.qty === 240) {
    console.log('✅ Test 3 Passed: "1 cup milk" correctly converted to 240ml.');
  } else {
    console.error('❌ Test 3 Failed: Milk liquid volume conversion incorrect.');
    testFailures++;
  }
  console.log('');
}

// Test 4: Multi-Recipe Block Splitting
async function testMultiRecipeSplitting() {
  console.log('--- Test 4: Multi-Recipe Block Ingestion & Splitting ---');
  const bulkText = `
Recipe 1: Creamy Tofu Curry
Serves: 4
2 x 400g firm tofu
1 cup coconut milk

Method:
1. Fry tofu until crispy.
2. Simmer with coconut milk.

Recipe 2: Smoky Lentil Stew
Serves: 4
For the lentils:
200g brown lentils
1 tsp smoked paprika

Method:
1. Boil lentils for 25 mins.
  `;

  const parsedList = parseBulkRecipeText(bulkText);
  console.log(`Parsed Recipes Count: ${parsedList.length}`);
  parsedList.forEach((r, i) => {
    console.log(`  [${i + 1}] Title: "${r.title}", Sections: ${r.ingredientSections.length}, Steps: ${r.instructions.length}`);
  });

  if (parsedList.length >= 2 && parsedList[0].title.includes('Tofu') && parsedList[1].title.includes('Lentil')) {
    console.log('✅ Test 4 Passed: Multi-recipe text block successfully split into separate structured recipes.');
  } else {
    console.error('❌ Test 4 Failed: Multi-recipe splitting failed.');
    testFailures++;
  }
  console.log('');
}

// Test 5: Alias Learning & Taxonomy Matching
async function testAliasLearning() {
  console.log('--- Test 5: Alias Learning & Auto-Mapping ---');
  const storeIng = global.window.state.ingredients[0]; // Plain Flour
  
  // Learn new alias "all purpose organic flour"
  await learnIngredientAlias(storeIng.id, "all purpose organic flour");
  console.log(`Learned aliases for Plain Flour:`, storeIng.aliases);

  const testParsed = parseIngredientString("200g all purpose organic flour");
  const matched = matchIngredientTaxonomy(testParsed, global.window.state.ingredients);
  console.log(`Matched ingredient ID for "all purpose organic flour":`, matched.ingredientId);

  if (matched.ingredientId === storeIng.id && storeIng.aliases.includes("all purpose organic flour")) {
    console.log('✅ Test 5 Passed: Alias learned and successfully auto-matched future parse.');
  } else {
    console.error('❌ Test 5 Failed: Alias learning or auto-matching failed.');
    testFailures++;
  }
  console.log('');
}

// Test 6: Strict Unit Enforcement
async function testStrictUnits() {
  console.log('--- Test 6: Strict Unit Enforcement (g, ml, qty only) ---');
  const items = [
    parseIngredientString("3 cloves garlic"),
    parseIngredientString("2 tbsp olive oil"),
    parseIngredientString("500g spaghetti")
  ];

  let allStrict = true;
  items.forEach(item => {
    console.log(`Item "${item.name}": qty=${item.qty}, unit="${item.unit}"`);
    if (!['g', 'ml', 'qty'].includes(item.unit)) {
      allStrict = false;
    }
  });

  if (allStrict) {
    console.log('✅ Test 6 Passed: All parsed units strictly restricted to g, ml, or qty.');
  } else {
    console.error('❌ Test 6 Failed: Invalid units found.');
    testFailures++;
  }
  console.log('');
}

async function runSuite() {
  await testMultiplierParsing();
  await testDensityFlour();
  await testLiquidMilk();
  await testMultiRecipeSplitting();
  await testAliasLearning();
  await testStrictUnits();

  if (testFailures === 0) {
    console.log('=== ALL RECIPE WIZARD v3.22.1 UPGRADE TESTS PASSED ===');
    process.exit(0);
  } else {
    console.error(`=== TEST SUITE FAILED WITH ${testFailures} FAILURES ===`);
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
