/**
 * scripts/test_no_active_stock.js
 * Fails when Active Stock comes back into the app (plan
 * docs/plans/2026-10-30-0748-refactor-remove-active-stock-plan.md, KTD4 and U5).
 * Scans every src/ module and index.html, but not attic/, for:
 *   - "Active Stock" wording;
 *   - "inventory" in any case, apart from the allowlisted lines below;
 *   - a stock use-up flag (isUseUp) or a stock store action;
 *   - the removed useup-desc / pantry-desc Vault sorts.
 * Product-based use-up names (useUpProducts, UseUpFinderModalUI) are allowed.
 * Run: node scripts/test_no_active_stock.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function listJs(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? listJs(rel) : e.name.endsWith('.js') ? [rel] : [];
  });
}

const RULES = [
  { pattern: /active[\s-]?stock/i, what: '"Active Stock"' },
  { pattern: /inventory/i, what: '"inventory"' },
  { pattern: /\bisUseUp\b/, what: 'the stock use-up flag isUseUp' },
  { pattern: /\b(setInventory|addPantryItem|updatePantryItem|removePantryItem|toggleUseUpStatus)\b/, what: 'a stock store action' },
  { pattern: /\b(useup-desc|pantry-desc)\b/, what: 'a removed stock sort' }
];

// Each permitted match, with its reason. Add an entry here and to KTD4 together.
const ALLOWED = [
  {
    file: 'src/store/cacheSlice.js',
    line: /localStorage\.removeItem\('plateplan_inventory'\)/,
    reason: 'clears the stock list cached by releases before 3.50.0 (R4, KTD3)'
  }
];

function findStockReferences(files) {
  const hits = [];
  for (const { name, text } of files) {
    text.split('\n').forEach((line, i) => {
      for (const rule of RULES) {
        if (!rule.pattern.test(line)) continue;
        if (ALLOWED.some(a => a.file === name && a.line.test(line))) continue;
        hits.push(`${name}:${i + 1} mentions ${rule.what}`);
      }
    });
  }
  return hits;
}

function appFiles() {
  return ['index.html', ...listJs('src')].map(f => ({ name: f, text: read(f) }));
}

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

console.log('=== RUNNING NO ACTIVE STOCK SUITE ===\n');

const fixture = (text, name = 'src/fixture.js') => findStockReferences([{ name, text }]);

check('Active Stock wording is reported with file and line', () => {
  assert.deepEqual(fixture('ok\ntoast(`Added to Active Stock`);'), ['src/fixture.js:2 mentions "Active Stock"']);
});

check('a Firestore inventory collection and a state.inventory read are reported', () => {
  assert.equal(fixture("db.collection('households').doc(id).collection('inventory');").length, 1);
  assert.equal(fixture('const list = state.inventory || [];').length, 1);
});

check('a removed stock sort is reported', () => {
  assert.equal(fixture('<option value="useup-desc">Use-Up First</option>').length, 1);
});

check('product-based use-up names are not reported', () => {
  assert.deepEqual(fixture('const useUpProducts = plan.useUpProducts || {};\nimport * as UseUpFinderModalUI from "./UseUpFinderModalUI.js";'), []);
});

check('the allowlisted cache-clearing line passes only in its own file', () => {
  const line = "localStorage.removeItem('plateplan_inventory');";
  assert.deepEqual(fixture(line, 'src/store/cacheSlice.js'), []);
  assert.equal(fixture(line, 'src/store/otherSlice.js').length, 1);
});

check('attic/ is not scanned', () => {
  assert.ok(appFiles().every(f => !f.name.startsWith('attic')));
});

check('no Active Stock references in src/ or index.html', () => {
  const hits = findStockReferences(appFiles());
  assert.deepEqual(hits, [], `\n  ${hits.join('\n  ')}`);
});

if (failures === 0) {
  console.log('\n=== ALL NO ACTIVE STOCK TESTS PASSED ===');
  process.exit(0);
} else {
  console.error(`\n=== ${failures} NO ACTIVE STOCK TESTS FAILED ===`);
  process.exit(1);
}
