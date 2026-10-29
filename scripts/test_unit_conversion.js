/**
 * scripts/test_unit_conversion.js
 * Regression test for the one unit converter (src/services/UnitConversionService.js).
 * Every made-up line in scripts/fixtures/unit-conversion-lines.json must convert to its
 * committed result, so a rule change shows up here before it reaches a shopping list.
 * Run: node scripts/test_unit_conversion.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

const { convertToStrictUnit, toGrams, isLiquidIngredient } = await import('../src/services/UnitConversionService.js');

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/unit-conversion-lines.json', import.meta.url), 'utf8'));

let failures = 0;
function check(label, fn) {
  try {
    fn();
  } catch (err) {
    failures++;
    console.error(`❌ ${label}: ${err.message}`);
  }
}

console.log('=== RUNNING UNIT CONVERSION REGRESSION SUITE ===\n');

for (const line of fixture.strict) {
  const label = `${line.qty} ${line.unit} ${line.name}`;
  check(label, () => {
    const got = convertToStrictUnit(line.qty, line.unit, line.name);
    assert.deepEqual(
      { qty: got.qty, unit: got.unit, isEstimated: got.isEstimated, isFallbackWeight: got.isFallbackWeight },
      line.expect
    );
  });
}

for (const line of fixture.grams) {
  const label = `toGrams ${line.qty} ${line.unit} ${line.name}${line.itemWeight ? ` (itemWeight ${line.itemWeight})` : ''}`;
  check(label, () => {
    assert.equal(toGrams(line.qty, line.unit, line.name, line.itemWeight), line.expect);
  });
}

for (const line of fixture.liquid) {
  check(`isLiquidIngredient ${line.name}`, () => {
    assert.equal(isLiquidIngredient(line.name), line.expect);
  });
}

// Every caller goes through the owner, so one line gives one answer everywhere.
const UnitConverter = await import('../src/utils/unitConverter.js');
const { parseIngredientString } = await import('../src/services/RecipeIngredientParser.js');
const { calculateItemNutrition } = await import('../src/services/NutritionService.js');
// 100 kcal per 100 g, so kcal equals grams.
const per100 = { name: 'rice', cal: 100 };

const callerChecks = [
  ['AE1: "1 cup rice" is 192 g on import', () => {
    const got = parseIngredientString('1 cup rice');
    assert.deepEqual([got.qty, got.unit], [192, 'g']);
  }],
  ['AE1: "1 cup rice" is 192 g in the recipe editor', () => {
    const got = UnitConverter.parseIngredientLine('1 cup rice');
    assert.deepEqual([got.qty, got.unit], [192, 'g']);
  }],
  ['AE1: "1 cup rice" is 192 g on the shopping list', () => {
    const got = convertToStrictUnit(1, 'cup', 'rice');
    assert.deepEqual([got.qty, got.unit], [192, 'g']);
  }],
  ['AE1: "1 cup rice" is 192 g for nutrition', () => {
    assert.equal(calculateItemNutrition(per100, 1, 'cup').kcal, 192);
  }],
  ['AE3: stored 125 g rice is unchanged in the editor and on the shopping list', () => {
    assert.deepEqual(UnitConverter.normaliseRecipeAmountForUi({ qty: 125, unit: 'g', name: 'rice' }), { qty: 125, unit: 'g' });
    const got = convertToStrictUnit(125, 'g', 'rice');
    assert.deepEqual([got.qty, got.unit], [125, 'g']);
  }],
  ['stored ml and qty lines are unchanged in the editor and on the shopping list', () => {
    assert.deepEqual(UnitConverter.normaliseRecipeAmountForUi({ qty: 30, unit: 'ml', name: 'olive oil' }), { qty: 30, unit: 'ml' });
    assert.deepEqual(UnitConverter.normaliseRecipeAmountForUi({ qty: 2, unit: 'qty', name: 'onion' }), { qty: 2, unit: 'qty' });
    assert.deepEqual([convertToStrictUnit(30, 'ml', 'olive oil').qty, convertToStrictUnit(2, 'qty', 'onion').qty], [30, 2]);
  }],
  ['stored 12.345 g is not rounded when the editor opens it', () => {
    assert.deepEqual(UnitConverter.normaliseRecipeAmountForUi({ qty: 12.345, unit: 'g', name: 'salt' }), { qty: 12.345, unit: 'g' });
  }],
  ['"2 x 400g tins chickpeas" keeps its name and 800 g in the editor', () => {
    const got = UnitConverter.parseIngredientLine('2 x 400g tins chickpeas');
    assert.deepEqual([got.qty, got.unit, got.name], [800, 'g', 'chickpeas']);
  }],
  ['"pinch of salt" is 0.5 g in the editor', () => {
    const got = UnitConverter.parseIngredientLine('pinch of salt');
    assert.deepEqual([got.qty, got.unit], [0.5, 'g']);
  }],
  ['the editor\'s liquid check uses the owner\'s list', () => {
    assert.equal(UnitConverter.isLikelyLiquidIngredientName('tomato paste'), false);
    assert.equal(UnitConverter.isLikelyLiquidIngredientName('soy sauce'), true);
  }],
  ['window.UnitConverter still offers what the recipe editor rows call', () => {
    for (const fn of ['parseIngredientLine', 'normaliseRecipeAmountForUi', 'inferParsedUnitForIngredient']) {
      assert.equal(typeof UnitConverter[fn], 'function', fn);
    }
  }]
];
for (const [label, fn] of callerChecks) check(label, fn);

const total = fixture.strict.length + fixture.grams.length + fixture.liquid.length + callerChecks.length;
if (failures === 0) {
  console.log(`=== ALL ${total} UNIT CONVERSION CHECKS PASSED ===`);
  process.exit(0);
} else {
  console.error(`=== ${failures} OF ${total} UNIT CONVERSION CHECKS FAILED ===`);
  process.exit(1);
}
