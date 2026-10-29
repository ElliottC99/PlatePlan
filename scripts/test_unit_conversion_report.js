/**
 * scripts/test_unit_conversion_report.js
 * Checks the comparison logic of scripts/unit_conversion_report.js on a small made-up backup.
 * The "old" module set returns the pre-merge results for a few named lines and the new
 * results for everything else, so only those lines should show as changed.
 * Run: node scripts/test_unit_conversion_report.js
 */

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareConversions, renderReport, loadModuleSet, assertOutsideRepo } from './unit_conversion_report.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owner = await import('../src/services/UnitConversionService.js');
const newMods = await loadModuleSet(REPO_ROOT);

// Pre-merge results, as the old converters gave them.
const oldMods = {
  ...newMods,
  parseIngredientString: raw => (raw === '1 tbsp flour' ? { qty: 14, unit: 'g' } : newMods.parseIngredientString(raw)),
  normaliseRecipeAmountForUi: line => (line.name === 'honey' ? { qty: 30, unit: 'g' } : newMods.normaliseRecipeAmountForUi(line)),
  convertToStrictUnit: (qty, unit, name) => {
    if (name === 'honey') return { qty: 30, unit: 'ml' };
    if (name === 'spinach') return { qty, unit: 'qty' };
    if (name === 'passata') return { qty: 140, unit: 'g' };
    return newMods.convertToStrictUnit(qty, unit, name);
  }
};

const backup = {
  collections: { households: { 'elliott-chloe': { collections: { recipes: {
    r1: { data: { title: 'Test Stir Fry', ingredients: [
      { qty: 2, unit: 'tbsp', name: 'honey', raw: '2 tbsp honey' },
      { qty: 2, unit: 'handful', name: 'spinach', raw: '2 handfuls spinach' },
      { qty: 200, unit: 'ml', name: 'passata', raw: '200ml passata' },
      { qty: 125, unit: 'g', name: 'rice', raw: '125g rice' },
      '1 tbsp flour'
    ] } }
  } } } } }
};

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`✅ ${label}`);
  } catch (err) {
    failures++;
    console.error(`❌ ${label}: ${err.message}`);
  }
}

console.log('=== RUNNING UNIT CONVERSION REPORT SUITE ===\n');

const result = compareConversions({ backup, fixture: { strict: [] }, oldMods, newMods, owner });
const changed = caller => result.changed.backup[caller].map(r => r.text);

check('AE2: a saved "2 tbsp honey" line is listed as a raw-unit line with its shopping amounts', () => {
  const honey = result.rawUnitLines.find(r => r.text === '2 tbsp honey');
  assert.ok(honey, 'honey is listed');
  assert.deepEqual([honey.old, honey.new], [{ qty: 30, unit: 'ml' }, { qty: 30, unit: 'ml' }]);
  assert.ok(!changed('shopping').includes('2 tbsp honey'), 'honey was already liquid on the shopping list');
});

check('the honey line counts as changed when the editor opens it (30 g to 30 ml)', () => {
  const row = result.changed.backup.editorOpen.find(r => r.text === '2 tbsp honey');
  assert.deepEqual([row.old, row.new], [{ qty: 30, unit: 'g' }, { qty: 30, unit: 'ml' }]);
});

check('a saved handful line is a raw-unit line and changes on the shopping list (2 qty to 60 g)', () => {
  assert.ok(result.rawUnitLines.some(r => r.text === '2 handfuls spinach'));
  const row = result.changed.backup.shopping.find(r => r.text === '2 handfuls spinach');
  assert.deepEqual([row.old, row.new], [{ qty: 2, unit: 'qty' }, { qty: 60, unit: 'g' }]);
});

check('a saved 200 ml passata line changes on the shopping list for the liquid list', () => {
  const row = result.changed.backup.shopping.find(r => r.text === '200ml passata');
  assert.deepEqual([row.old, row.new, row.why], [{ qty: 140, unit: 'g' }, { qty: 200, unit: 'ml' }, 'liquid (whole-word match)']);
});

check('a saved 125 g rice line is unchanged everywhere and is not a raw-unit line', () => {
  for (const caller of Object.keys(result.changed.backup)) assert.ok(!changed(caller).includes('125g rice'), caller);
  assert.ok(!result.rawUnitLines.some(r => r.text === '125g rice'));
});

check('"1 tbsp flour" changes on import from 14 g to 7.5 g with its density as the reason', () => {
  const row = result.changed.backup.import.find(r => r.text === '1 tbsp flour');
  assert.deepEqual([row.old, row.new, row.why], [{ qty: 14, unit: 'g' }, { qty: 7.5, unit: 'g' }, 'not liquid, density 0.5 g/ml']);
});

check('every line is counted, and unchanged lines only add to the count', () => {
  assert.equal(result.counts.backup.import.checked, 5);
  assert.equal(result.counts.backup.shopping.checked, 4);
  assert.equal(result.counts.backup.shopping.changed, 2);
});

check('identical module sets report no changes', () => {
  const same = compareConversions({ backup, fixture: { strict: [{ qty: 1, unit: 'cup', name: 'rice' }] }, oldMods: newMods, newMods, owner });
  for (const group of ['backup', 'fixture']) {
    for (const [caller, counts] of Object.entries(same.counts[group])) assert.equal(counts.changed, 0, `${group} ${caller}`);
  }
});

check('the rendered report names each section and the changed lines', () => {
  const md = renderReport(result, { backupName: 'test.json', baseRef: 'base', baseCommit: 'abc1234', headCommit: 'def5678', generatedAt: 'now' });
  for (const text of ['## Counts', '## Saved lines that still hold a raw unit', '## Changed saved recipe lines', '200ml passata', '140 g', '200 ml']) {
    assert.ok(md.includes(text), text);
  }
});

check('the report refuses to write inside the repo', () => {
  assert.throws(() => assertOutsideRepo(path.join(REPO_ROOT, 'scripts')), /Refusing to write inside the repo/);
  assert.throws(() => assertOutsideRepo(REPO_ROOT), /Refusing to write inside the repo/);
  assert.doesNotThrow(() => assertOutsideRepo(path.join(os.tmpdir(), 'plateplan-reports')));
});

if (failures === 0) {
  console.log('\n=== ALL UNIT CONVERSION REPORT TESTS PASSED ===');
  process.exit(0);
} else {
  console.error(`\n=== ${failures} UNIT CONVERSION REPORT TESTS FAILED ===`);
  process.exit(1);
}
