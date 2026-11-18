/**
 * scripts/run_tests.js
 * Runs all standalone Node test suites (excluding Firestore emulator rules).
 */

import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';

const PER_TEST_TIMEOUT_MS = 30000;

const scriptTests = readdirSync('scripts')
  .filter(f => f.startsWith('test_') && f.endsWith('.js') && f !== 'test_firestore_rules.js')
  .sort()
  .map(f => `scripts/${f}`);

const testFiles = [...scriptTests, 'test_vault_fit_score.js'];

let passed = 0;
const failures = [];
const startAll = Date.now();

console.log(`Running ${testFiles.length} test suites...\n`);

for (const file of testFiles) {
  const start = Date.now();
  const res = spawnSync(process.execPath, [file], {
    timeout: PER_TEST_TIMEOUT_MS,
    encoding: 'utf8'
  });
  const elapsedMs = Date.now() - start;

  if (res.status === 0 && !res.error) {
    passed++;
    console.log(`PASS ${file} (${elapsedMs}ms)`);
  } else {
    const reason = res.error
      ? res.error.message
      : `exit ${res.status}${res.signal ? ` (${res.signal})` : ''}`;
    console.error(`FAIL ${file} (${elapsedMs}ms) - ${reason}`);
    failures.push({
      file,
      reason,
      output: `${res.stdout || ''}\n${res.stderr || ''}`.trim()
    });
  }
}

const totalSec = ((Date.now() - startAll) / 1000).toFixed(1);
console.log(`\nSummary: ${passed} passed, ${failures.length} failed (${totalSec}s)`);

if (failures.length > 0) {
  console.error('\n--- Failure Details ---');
  for (const f of failures) {
    console.error(`\n[${f.file}] (${f.reason})`);
    const lines = f.output.split('\n').slice(-20).join('\n');
    if (lines) console.error(lines);
  }
  process.exit(1);
}
