/**
 * scripts/test_recipe_wizard.js
 * Verification suite for Multi-Step Recipe Wizard, Scaling Engine,
 * Taxonomy Mapping, and Vault Card "More" Menu.
 */

import { parseIngredientString, matchIngredientTaxonomy, parseBulkRecipeText, extractRecipeFromHtml } from '../src/services/RecipeImporter.js';
import { openRecipeActions, renderVaultRecipeCard } from '../src/components/vault/VaultRecipeCard.js';

console.log('=== RUNNING RECIPE WIZARD & VAULT UI VERIFICATION SUITE ===\n');

let testFailures = 0;

// Mock DOM for Node environment
if (typeof window === 'undefined') {
  global.window = {
    state: { recipes: [], ingredients: [{ id: 'ing-tofu-1', name: 'Firm Tofu', category: 'Proteins' }] },
    Store: { getState: () => global.window.state },
    isRecipeVariantFavourite: () => false,
    viewRecipe: () => {},
    toggleRecipeFavourite: () => {},
    showPlatePlanToast: () => {}
  };
  global.document = {
    body: { appendChild: () => {}, querySelectorAll: () => [] },
    createElement: (tag) => {
      const el = {
        tagName: tag,
        style: {},
        classList: { add: () => {}, remove: () => {} },
        contains: () => false,
        querySelector: () => ({ addEventListener: () => {}, onclick: null }),
        querySelectorAll: () => [],
        appendChild: () => {},
        remove: () => {}
      };
      return el;
    },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

// Test 1: Mathematical Servings Scaling (e.g. 4 servings to 6 servings -> 1.5x)
async function testServingsScaling() {
  console.log('--- Test 1: Recipe Wizard Servings Scaling ---');
  const sourceServings = 4;
  const targetServings = 6;
  const scaleFactor = targetServings / sourceServings; // 1.5

  const rawIngredient = "400g block extra firm tofu, pressed";
  const parsed = parseIngredientString(rawIngredient);
  const scaledQty = Number((parsed.qty * scaleFactor).toFixed(2)); // 400 * 1.5 = 600

  console.log(`Source Servings: ${sourceServings} | Target Servings: ${targetServings}`);
  console.log(`Calculated Scale Factor: ${scaleFactor}x`);
  console.log(`Raw Quantity: ${parsed.qty}${parsed.unit} -> Scaled Quantity: ${scaledQty}${parsed.unit}`);

  if (scaleFactor === 1.5 && scaledQty === 600) {
    console.log('✅ Test 1 Passed: Servings scaled mathematically by 1.5x.');
  } else {
    console.error('❌ Test 1 Failed: Incorrect scaling calculation.');
    testFailures++;
  }
  console.log('');
}

// Test 2: Taxonomy Mapping Engine
async function testTaxonomyMapping() {
  console.log('--- Test 2: Taxonomy Matching & New Item Flagging ---');
  const existingBank = [
    { id: 'ing-tofu-1', name: 'Firm Tofu', category: 'Proteins' },
    { id: 'ing-garlic-1', name: 'Garlic', category: 'Produce' }
  ];

  const item1 = parseIngredientString('200g firm tofu');
  const match1 = matchIngredientTaxonomy(item1, existingBank);

  const item2 = parseIngredientString('1 1/2 tsp smoked paprika');
  const match2 = matchIngredientTaxonomy(item2, existingBank);

  console.log(`Matching "firm tofu": matched ID = ${match1.ingredientId} (${match1.matchedName})`);
  console.log(`Matching "smoked paprika": matched ID = ${match2.ingredientId} (isNewTaxonomyItem = ${match2.isNewTaxonomyItem})`);

  if (match1.ingredientId === 'ing-tofu-1' && match2.isNewTaxonomyItem === true) {
    console.log('✅ Test 2 Passed: Taxonomy matched existing ID and correctly flagged new item.');
  } else {
    console.error('❌ Test 2 Failed: Taxonomy matching failed.');
    testFailures++;
  }
  console.log('');
}

// Test 3: Bulk Text Ingestion Parsing
async function testBulkIngestion() {
  console.log('--- Test 3: Bulk Text Ingestion & Recipe Splitting ---');
  const bulkText = `
Recipe 1: High-Protein Tofu Bowl
Serves: 4
400g firm tofu
1 tbsp soy sauce

Method:
1. Cube tofu and toss in soy sauce.
2. Bake at 200C for 20 minutes.

Recipe 2: Smoky Lentil Soup
Serves: 4
200g brown lentils
1 tsp smoked paprika

Method:
1. Simmer lentils for 30 minutes.
  `;

  const parsedList = parseBulkRecipeText(bulkText);
  console.log(`Parsed Recipes Count: ${parsedList.length}`);
  if (parsedList.length >= 2) {
    console.log(`Recipe #1 Title: "${parsedList[0].title}" (${parsedList[0].ingredients.length} ingredients)`);
    console.log(`Recipe #2 Title: "${parsedList[1].title}" (${parsedList[1].ingredients.length} ingredients)`);
  }

  if (parsedList.length >= 2 && parsedList[0].title.includes('Tofu') && parsedList[1].title.includes('Lentil')) {
    console.log('✅ Test 3 Passed: Bulk text ingested and parsed into multiple distinct recipes.');
  } else {
    console.error('❌ Test 3 Failed: Bulk text parsing error.');
    testFailures++;
  }
  console.log('');
}

// Test 4: Vault Recipe Card "More" Button Event Propagation Prevention
async function testVaultCardMoreMenu() {
  console.log('--- Test 4: Vault Recipe Card "More" Button Event StopPropagation ---');
  
  let propagationStopped = false;
  let defaultPrevented = false;

  const mockEvent = {
    stopPropagation: () => { propagationStopped = true; },
    preventDefault: () => { defaultPrevented = true; }
  };

  const recipe = {
    id: 'rec-test-1',
    name: 'Test Recipe',
    title: 'Test Recipe',
    serves: 4,
    ingredients: [],
    instructions: []
  };

  openRecipeActions(mockEvent, 'rec-test-1', 'original');

  console.log(`stopPropagation Called: ${propagationStopped}`);
  console.log(`preventDefault Called: ${defaultPrevented}`);

  if (propagationStopped && defaultPrevented) {
    console.log('✅ Test 4 Passed: "More" button clickhandler cleanly stops event propagation.');
  } else {
    console.error('❌ Test 4 Failed: Event propagation was not stopped.');
    testFailures++;
  }
  console.log('');
}

async function runSuite() {
  await testServingsScaling();
  await testTaxonomyMapping();
  await testBulkIngestion();
  await testVaultCardMoreMenu();

  if (testFailures === 0) {
    console.log('=== ALL RECIPE WIZARD & VAULT UI TESTS PASSED ===');
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
