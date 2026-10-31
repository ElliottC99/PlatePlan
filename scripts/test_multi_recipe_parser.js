/**
 * scripts/test_multi_recipe_parser.js
 * Verification test suite for multi-recipe paste & parse instruction allocation.
 */

import assert from 'node:assert';
import { unpackAndSplitRecipeBlocks, parseSingleRecipeText, parseBulkRecipeText } from '../src/services/RecipeParserService.js';

console.log('=== RUNNING MULTI-RECIPE PARSER VERIFICATION SUITE ===\n');

let failures = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    failures++;
    console.error(`❌ Failed: ${name}\n  Error: ${err.message}`);
  }
}

// Test 1: Standard unnumbered recipes separated by whitespace
runTest('Unnumbered recipes split cleanly and assign instructions to each individual recipe', () => {
  const text = `Tofu Stir Fry
Ingredients:
200g firm tofu
1 tbsp soy sauce
Method:
1. Cube and fry tofu until golden.
2. Toss with soy sauce.

Smoky Lentil Soup
Ingredients:
150g red lentils
1 can chopped tomatoes
Instructions:
1. Simmer lentils in vegetable stock.
2. Blend until smooth and creamy.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2, `Expected 2 blocks, got ${blocks.length}`);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2, `Expected 2 parsed recipes, got ${parsed.length}`);

  assert.strictEqual(parsed[0].title, 'Tofu Stir Fry');
  assert.strictEqual(parsed[0].instructions.length, 2);
  assert.ok(parsed[0].instructions[0].includes('Cube and fry tofu'));
  assert.ok(parsed[0].instructions[1].includes('Toss with soy sauce'));

  assert.strictEqual(parsed[1].title, 'Smoky Lentil Soup');
  assert.strictEqual(parsed[1].instructions.length, 2);
  assert.ok(parsed[1].instructions[0].includes('Simmer lentils'));
  assert.ok(parsed[1].instructions[1].includes('Blend until smooth'));
});

// Test 2: Double newlines between numbered method steps inside a single recipe (must NOT drop step 2)
runTest('Numbered steps with double newlines do not drop steps or false-split', () => {
  const text = `Recipe 1: Crispy Baked Tofu
Ingredients:
400g extra firm tofu
2 tbsp cornflour

Method:
1. Preheat oven to 200C and cube tofu.

2. Toss tofu in cornflour and spread on baking sheet.

3. Bake for 25 minutes until crispy.

Recipe 2: Garlic Greens
Ingredients:
200g kale
2 cloves garlic

Method:
1. Heat oil in a skillet.

2. Sauté garlic and kale until wilted.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2, `Expected 2 blocks, got ${blocks.length}`);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].instructions.length, 3, `Expected 3 steps in Recipe 1, got ${parsed[0].instructions.length}`);
  assert.strictEqual(parsed[1].instructions.length, 2, `Expected 2 steps in Recipe 2, got ${parsed[1].instructions.length}`);
});

// Test 3: Recipes separated by horizontal dividers (---, ===)
runTest('Recipes separated by horizontal dividers split into distinct recipes', () => {
  const text = `Creamy Tomato Pasta
Ingredients:
200g penne
400g passata
Method:
1. Boil pasta.
2. Mix with passata.
---
Berry Oatmeal
Ingredients:
50g rolled oats
100ml almond milk
Method:
1. Microwave oats for 2 minutes.
2. Stir in berries.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].title, 'Creamy Tomato Pasta');
  assert.strictEqual(parsed[1].title, 'Berry Oatmeal');
  assert.strictEqual(parsed[0].instructions.length, 2);
  assert.strictEqual(parsed[1].instructions.length, 2);
});

// Test 4: Recipes with Markdown Headings (# Title, ## Method)
runTest('Markdown formatted recipes split and isolate methods correctly', () => {
  const text = `# Vegan Chili
Ingredients:
1 can black beans
1 can kidney beans
## Method
1. Combine all beans and spices in a large pot.
2. Simmer on low heat for 30 minutes.

# Golden Turmeric Rice
Ingredients:
200g basmati rice
1 tsp ground turmeric
## Instructions
1. Rinse rice until water runs clear.
2. Cook with turmeric until tender.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].title, 'Vegan Chili');
  assert.strictEqual(parsed[1].title, 'Golden Turmeric Rice');
  assert.strictEqual(parsed[0].instructions.length, 2);
  assert.strictEqual(parsed[1].instructions.length, 2);
});

// Test 5: Single newline separation between recipes
runTest('Recipes separated by only a single newline still detect boundaries', () => {
  const text = `Recipe 1: Chickpea Salad
Ingredients:
1 can chickpeas
1 cucumber
Method:
1. Dice cucumber and mix with chickpeas.
Recipe 2: Green Smoothie
Ingredients:
1 banana
1 cup spinach
Method:
1. Blend all ingredients until smooth.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2, `Expected 2 blocks with single newline separator, got ${blocks.length}`);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].instructions.length, 1);
  assert.strictEqual(parsed[1].instructions.length, 1);
});

// Test 6: Grouped layouts (Ingredients listed top, methods listed bottom)
runTest('Grouped layout matches and reallocates methods to corresponding recipes by title', () => {
  const text = `Recipe 1: Spiced Sweet Potato
Ingredients:
2 sweet potatoes
1 tsp cumin

Recipe 2: Lemon Herb Quinoa
Ingredients:
150g quinoa
1 lemon

Instructions:
Spiced Sweet Potato:
1. Roast sweet potatoes with cumin at 200C for 35 mins.

Lemon Herb Quinoa:
1. Rinse quinoa and boil in salted water.
2. Toss with fresh lemon juice and herbs.`;

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2, `Expected 2 parsed recipes, got ${parsed.length}`);
  assert.strictEqual(parsed[0].title, 'Spiced Sweet Potato');
  assert.ok(parsed[0].instructions.length >= 1, `Recipe 1 instructions missing, got ${parsed[0].instructions.length}`);
  assert.ok(parsed[0].instructions[0].includes('Roast sweet potatoes'));

  assert.strictEqual(parsed[1].title, 'Lemon Herb Quinoa');
  assert.ok(parsed[1].instructions.length >= 1, `Recipe 2 instructions missing, got ${parsed[1].instructions.length}`);
  assert.ok(parsed[1].instructions[0].includes('Rinse quinoa'));
});

console.log(`\n=== MULTI-RECIPE PARSER TEST RUN COMPLETE ===`);
if (failures > 0) {
  console.error(`Total Failures: ${failures}`);
  process.exit(1);
} else {
  console.log(`All tests passed successfully!`);
}
