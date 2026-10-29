/**
 * scripts/test_unit_conversion.js
 * Regression test for the one unit converter (src/services/UnitConversionService.js).
 * Every made-up line in scripts/fixtures/unit-conversion-lines.json must convert to its
 * committed result, so a rule change shows up here before it reaches a shopping list.
 * Run: node scripts/test_unit_conversion.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

if (typeof window === 'undefined') {
  global.window = {};
}

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

const total = fixture.strict.length + fixture.grams.length + fixture.liquid.length;
if (failures === 0) {
  console.log(`=== ALL ${total} UNIT CONVERSION CHECKS PASSED ===`);
  process.exit(0);
} else {
  console.error(`=== ${failures} OF ${total} UNIT CONVERSION CHECKS FAILED ===`);
  process.exit(1);
}
