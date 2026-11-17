/**
 * scripts/test_parser_aliases_and_leaves.js
 * Verification suite for:
 * - Multi-pass alias measurement & container stripping (cleanIngredientPhraseForAlias)
 * - Botanical leaf noun preservation (Bay Leaves, Curry Leaves, Lime Leaves, Vine Leaves)
 * - Non-discrete bulk ingredient qty detection (isNonDiscreteBulkIngredient / isInvalidQtyUnit)
 * - Historical alias & product itemWeight sanitization (sanitizeStoredAliasesAndItemWeights)
 */

import assert from 'node:assert/strict';

if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}
if (typeof global.window === 'undefined') {
  global.window = {
    localStorage: global.localStorage,
    dispatchEvent: () => {}
  };
}

const {
  parseIngredientString,
  cleanIngredientPhraseForAlias,
  stemIngredientName,
  matchIngredientTaxonomy
} = await import('../src/services/RecipeIngredientParser.js');
const { toGrams, isNonDiscreteBulkIngredient } = await import('../src/services/UnitConversionService.js');
const { sanitizeStoredAliasesAndItemWeights } = await import('../src/services/MaintenanceService.js');
const { getState, setIngredients, setProducts } = await import('../src/store/store.js');

console.log('=== RUNNING PARSER ALIASES, BOTANICAL LEAVES & BULK QTY SUITE ===\n');

// 1. Alias Measurement & Container Stripping
console.log('--- Test 1: Multi-Pass Alias Measurement & Container Stripping ---');
assert.strictEqual(
  cleanIngredientPhraseForAlias('2 x 400g tins of best-quality chopped tomatoes'),
  'best quality chopped tomatoes',
  'Should strip multiplier, weight, and tin container'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('2x400g cans chickpeas in water'),
  'chickpeas in water',
  'Should strip no-space multiplier and cans container'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('Cheddar Cheese 100g'),
  'cheddar cheese',
  'Should strip trailing weight measurement'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('Vegetable Stock 500ml'),
  'vegetable stock',
  'Should strip trailing volume measurement'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('1 pouch (250g) cooked basmati rice'),
  'cooked basmati rice',
  'Should strip pouch container and parenthetical weight'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('1 pot 150g natural yoghurt'),
  'natural yoghurt',
  'Should strip pot container and mid-string weight'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('6 small/medium white potatoes (about 8.5cm long)'),
  'small medium white potatoes',
  'Should strip leading count and parenthetical dimension'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('1 tbsp / 15ml dark soy sauce'),
  'dark soy sauce',
  'Should strip dual spoon/ml measurements'
);
assert.strictEqual(
  cleanIngredientPhraseForAlias('30g sachet taco seasoning'),
  'taco seasoning',
  'Should strip weight and sachet container'
);
console.log('✅ Test 1 Passed: All measurements and containers stripped from aliases.\n');

// 2. Botanical Leaf Noun Preservation
console.log('--- Test 2: Botanical Leaf Noun Preservation ---');
const bay1 = parseIngredientString('2 bay leaves');
assert.strictEqual(bay1.qty, 2);
assert.strictEqual(bay1.unit, 'qty', '2 bay leaves should have unit qty');
assert.strictEqual(bay1.name, 'Bay Leaves', '2 bay leaves must keep name "Bay Leaves" instead of "Bay"');
assert.strictEqual(toGrams(bay1.qty, bay1.unit, bay1.name), 2, '2 qty Bay Leaves should weigh 2g');

const bay2 = parseIngredientString('2 large dried bay leaves');
assert.strictEqual(bay2.qty, 2);
assert.strictEqual(bay2.unit, 'qty');
assert.strictEqual(bay2.name, 'Large Dried Bay Leaves');

const curryLeaves = parseIngredientString('8 fresh curry leaves');
assert.strictEqual(curryLeaves.qty, 8);
assert.strictEqual(curryLeaves.unit, 'qty');
assert.strictEqual(curryLeaves.name, 'Fresh Curry Leaves');

const limeLeaves = parseIngredientString('4 kaffir lime leaves');
assert.strictEqual(limeLeaves.qty, 4);
assert.strictEqual(limeLeaves.unit, 'qty');
assert.strictEqual(limeLeaves.name, 'Kaffir Lime Leaves');

const basilLeaves = parseIngredientString('4 leaves of fresh basil');
assert.strictEqual(basilLeaves.qty, 4);
assert.strictEqual(basilLeaves.name, 'Fresh Basil', '"leaves of fresh basil" should parse name as Fresh Basil');

assert.strictEqual(
  stemIngredientName('Bay Leaves'),
  stemIngredientName('Bay Leaf'),
  'Singular and plural Bay Leaf/Leaves must stem identically'
);
assert(
  stemIngredientName('Bay Leaves').includes('leaf'),
  'Stemmed Bay Leaves must retain "leaf" so it does not collide with unrelated words'
);

const matchedBay = matchIngredientTaxonomy(bay1, [
  { id: 'ing_bay', name: 'Bay Leaves', category: 'Herbs & Spices', subtypes: [] }
]);
assert.strictEqual(matchedBay.ingredientId, 'ing_bay', 'Parsed Bay Leaves must match Bay Leaves root item');
console.log('✅ Test 2 Passed: Botanical leaf nouns preserved as qty and matched accurately.\n');

// 3. Non-Discrete Bulk Ingredient qty Flagging
console.log('--- Test 3: Non-Discrete Bulk Ingredient qty Flagging ---');
assert.strictEqual(typeof isNonDiscreteBulkIngredient, 'function', 'isNonDiscreteBulkIngredient must be exported');
assert.strictEqual(isNonDiscreteBulkIngredient('Natural Yoghurt'), true);
assert.strictEqual(isNonDiscreteBulkIngredient('Greek Yogurt'), true);
assert.strictEqual(isNonDiscreteBulkIngredient('Soy Sauce'), true);
assert.strictEqual(isNonDiscreteBulkIngredient('Basmati Rice'), true);
assert.strictEqual(isNonDiscreteBulkIngredient('Plain Flour'), true);
assert.strictEqual(isNonDiscreteBulkIngredient('Chopped Tomatoes'), true);
assert.strictEqual(isNonDiscreteBulkIngredient('Red Onion'), false);
assert.strictEqual(isNonDiscreteBulkIngredient('Tortilla Wraps'), false);
assert.strictEqual(isNonDiscreteBulkIngredient('Bay Leaves'), false);
assert.strictEqual(isNonDiscreteBulkIngredient('Vegetable Stock Cube'), false);

const yogParsed = parseIngredientString('1 natural yoghurt');
assert.strictEqual(yogParsed.unit, 'qty');
assert.strictEqual(yogParsed.isInvalidQtyUnit, true, '"1 natural yoghurt" in qty must be flagged with isInvalidQtyUnit: true');

const yogPotParsed = parseIngredientString('1 pot natural yoghurt');
assert.strictEqual(yogPotParsed.unit, 'qty');
assert.strictEqual(yogPotParsed.isInvalidQtyUnit, true, '"1 pot natural yoghurt" in qty must be flagged with isInvalidQtyUnit: true');

const onionParsed = parseIngredientString('2 red onions');
assert.strictEqual(onionParsed.unit, 'qty');
assert.strictEqual( Boolean(onionParsed.isInvalidQtyUnit), false, '"2 red onions" is discrete and valid in qty');
console.log('✅ Test 3 Passed: Non-discrete bulk ingredients in qty accurately flagged.\n');

// 4. Historical Alias & Bogus Product itemWeight Sanitization
console.log('--- Test 4: Historical Alias & Product itemWeight Sanitization ---');
setIngredients([
  {
    id: 'ing_tom',
    name: 'Chopped Tomatoes',
    category: 'Store Cupboard',
    aliases: ['400g chopped tomatoes', '2 x 400g tins chopped tomatoes', '1 tin Italian plum tomatoes', 'italian plum tomatoes'],
    subtypes: [
      {
        id: 'sub_plum',
        name: 'Plum Tomatoes',
        aliases: ['400g can plum tomatoes', '1 tin plum tomatoes', '2x400g Italian plum tomatoes']
      }
    ]
  }
]);
setProducts([
  {
    id: 'prod_yog',
    name: 'Tesco Natural Yoghurt 500G',
    category: 'Dairy & Eggs',
    packSize: 500,
    packUnit: 'g',
    itemWeight: 500,
    itemCount: 1
  },
  {
    id: 'prod_saus',
    name: 'Linda McCartney 6 Vegan Sausages',
    category: 'Meat Substitutes',
    packSize: 270,
    packUnit: 'g',
    itemWeight: 270,
    itemCount: 1
  }
]);

const sanRes = await sanitizeStoredAliasesAndItemWeights({ dryRun: true });
assert.strictEqual(sanRes.success, true);
const cleanedIng = getState().ingredients.find(i => i.id === 'ing_tom');
assert.deepStrictEqual(
  cleanedIng.aliases,
  ['italian plum tomatoes'],
  'Should strip measurements, remove self-matching "chopped tomatoes", and deduplicate "italian plum tomatoes"'
);
assert.deepStrictEqual(
  cleanedIng.subtypes[0].aliases,
  ['italian plum tomatoes'],
  'Subtype aliases should strip measurements, remove self-matching "plum tomatoes", and keep "italian plum tomatoes"'
);

const cleanedYog = getState().products.find(p => p.id === 'prod_yog');
assert.strictEqual(cleanedYog.itemWeight, null, 'Bulk yoghurt product with bogus itemWeight === packSize (500) must have itemWeight cleared to null');

const cleanedSaus = getState().products.find(p => p.id === 'prod_saus');
assert.strictEqual(cleanedSaus.itemWeight, 45, 'Multipack product (6 Sausages 270g) with bogus itemWeight === packSize must recalculate to 45g');
console.log('✅ Test 4 Passed: Historical aliases and bogus itemWeights sanitized.\n');

// Test 5: Sized handfuls convert to grams (small = 10g, default = 20g, large/generous/big = 30g)
const smallHandful = parseIngredientString('Small Handful Of Fresh Thai Basil');
assert.strictEqual(smallHandful.qty, 10);
assert.strictEqual(smallHandful.unit, 'g');
assert.strictEqual(smallHandful.isEstimated, true);
assert.strictEqual(smallHandful.name, 'Fresh Thai Basil');

const defaultHandful = parseIngredientString('Handful Of Fresh Mint');
assert.strictEqual(defaultHandful.qty, 20);
assert.strictEqual(defaultHandful.unit, 'g');
assert.strictEqual(defaultHandful.isEstimated, true);
assert.strictEqual(defaultHandful.name, 'Fresh Mint');

const largeHandful = parseIngredientString('Large Handful Of Fresh Coriander');
assert.strictEqual(largeHandful.qty, 30);
assert.strictEqual(largeHandful.unit, 'g');
assert.strictEqual(largeHandful.isEstimated, true);
assert.strictEqual(largeHandful.name, 'Fresh Coriander');

const generousHandful = parseIngredientString('1 generous handful coriander');
assert.strictEqual(generousHandful.qty, 30);
assert.strictEqual(generousHandful.unit, 'g');
assert.strictEqual(generousHandful.isEstimated, true);
assert.strictEqual(generousHandful.name, 'Coriander');
console.log('✅ Test 5 Passed: Sized handfuls parse into grams.\n');

console.log('🎉 ALL PARSER ALIASES, BOTANICAL LEAVES & BULK QTY TESTS PASSED!');
