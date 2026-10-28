/**
 * scripts/test_ledger.js
 * Checks scripts/ledger.js against small fixture trees built in a temp folder:
 * the labels, the owner-table count and its errors, unused exports, the attic
 * dates, and that a second run writes byte-identical output.
 *
 * Run: node scripts/test_ledger.js
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LEDGER_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ledger.js');

const OWNER_TABLE = [
  '# Architecture',
  '',
  '| Job | Owner | Parallel versions |',
  '|---|---|---|',
  '| Units | `src/units/A.js` | `src/units/B.js`, `src/units/C.js`, `src/units/D.js` |',
  '| Sheets | `src/sheets/Nav.js` | `src/sheets/Pantry.js` |',
  '| Config | `src/config.js` | — |',
  ''
].join('\n');

// A small app that exercises every label.
const BASE_TREE = {
  'index.html': '<html><script src="src/main.js?v=__BUILD_ID__" type="module"></script>\n<button data-path="widgets/Mentioned.js">x</button></html>\n',
  'plateplan-architecture.md': OWNER_TABLE,
  'src/main.js': [
    "import { a } from './units/A.js';",
    "import * as Reg from './registry.js';",
    "import { shimmed } from './LiveShim.js';",
    "import def, { used } from './exports.js';",
    "// import { x } from './Commented.js';",
    '/* import { y } from "./Commented.js"; */',
    "import { real } from './real/Card.js';",
    'export function boot() { return import(`./sheets/Pantry.js`).then(() => import(\'./sheets/Nav.js\')); }',
    "const view = (name) => import(`./views/${name}.js`);",
    "import { B } from './units/B.js'; import { C } from './units/C.js'; import { D } from './units/D.js'; import './config.js';",
    "const page = (n) => import('./pages/' + n + '.js');",
    "import { gone } from './missing.js';",
    // The regex literal looks like the start of a /* comment to a naive stripper.
    "const trim = (s) => s.replace(/\\/*$/, ''); function lazy() { return import('./re/Hidden.js'); }",
    '/** end */',
    ''
  ].join('\n'),
  'src/pages/Home.js': 'export const home = 1;\n',
  'src/re/Hidden.js': 'export const hidden = 1;\n',
  'src/units/A.js': 'export const a = 1;\n',
  'src/units/B.js': 'export const B = 1;\n',
  'src/units/C.js': 'export const C = 1;\n',
  'src/units/D.js': 'export const D = 1;\n',
  'src/config.js': 'export const config = {};\n',
  'src/registry.js': 'export function onlyViaWindow() {}\n',
  'src/LiveShim.js': "/** src/LiveShim.js */\nexport * from './units/A.js';\nexport { a as shimmed } from './units/A.js';\n",
  'src/exports.js': 'export default 1;\nexport const used = 1;\nexport const nobodyNamesThis = 1;\nexport function mentionedInHtmlName() {}\n',
  'src/sheets/Pantry.js': 'export const p = 1;\n',
  'src/sheets/Nav.js': 'export const n = 1;\n',
  'src/real/Card.js': 'export const real = 1;\n',
  'src/views/Lazy.js': 'export const lazy = 1;\n',
  'src/Commented.js': 'export const x = 1;\n',
  'src/DeadShim.js': "export * from './units/A.js';\n",
  'src/Dead.js': '/** src/Dead.js */\nexport function gone() {}\n',
  'src/cycle/One.js': "import './Two.js';\n",
  'src/cycle/Two.js': "import './One.js';\n",
  'src/widgets/Mentioned.js': 'export const m = 1;\n',
  'src/tested/OnlyByTests.js': 'export const t = 1;\n',
  'scripts/test_something.js': "import { t } from '../src/tested/OnlyByTests.js';\n",
  // Same name as the live src/real/Card.js; only its own header names its path.
  'src/old/Card.js': "/** src/old/Card.js */\nexport * from '../real/Card.js';\n",
  'attic/README.md': '| File | Moved | Delete after |\n|---|---|---|\n| `src/gone/Dated.js` | 2026-10-28 | 2026-11-11 |\n',
  'attic/src/gone/Dated.js': 'export const d = 1;\n',
  'attic/src/gone/Undated.js': 'export const u = 1;\n'
};
// main.js names mentionedInHtmlName nowhere, but index.html does.
BASE_TREE['index.html'] = BASE_TREE['index.html'].replace('</html>', '<i data-action="mentionedInHtmlName()"></i></html>');

let testFailures = 0;
let testCount = 0;
const tempDirs = [];

function check(name, condition, detail = '') {
  testCount++;
  if (!condition) {
    testFailures++;
    console.error(`❌ ${name}${detail ? `\n   ${detail}` : ''}`);
  }
}

function makeTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
  tempDirs.push(dir);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function runLedger(dir) {
  const result = spawnSync(process.execPath, [LEDGER_SCRIPT, dir], { encoding: 'utf8' });
  const ledgerPath = path.join(dir, 'LEDGER.md');
  return {
    status: result.status,
    stderr: result.stderr,
    ledger: fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, 'utf8') : ''
  };
}

// The label section a path is listed under.
function labelOf(ledger, file) {
  let current = null;
  for (const line of ledger.split('\n')) {
    if (line.startsWith('## ')) current = line.slice(3);
    if (line.startsWith(`- \`${file}\``)) return current;
  }
  return null;
}

console.log('=== RUNNING CODE LEDGER VERIFICATION SUITE ===\n');

const dir = makeTree(BASE_TREE);
const first = runLedger(dir);
check('Ledger runs on a valid tree', first.status === 0, first.stderr);
const { ledger } = first;

const expectLabel = (file, section) => {
  const actual = labelOf(ledger, file);
  check(`${file} is listed under ${section}`, actual === section, `found under ${actual}`);
};
expectLabel('src/units/A.js', 'Live');
expectLabel('src/sheets/Pantry.js', 'Live'); // template-string import() with no ${}
expectLabel('src/sheets/Nav.js', 'Live');
expectLabel('src/LiveShim.js', 'Live shims');
expectLabel('src/DeadShim.js', 'Dead shims');
expectLabel('src/Dead.js', 'Dead');
expectLabel('src/Commented.js', 'Needs a check'); // only a commented-out import names it
expectLabel('src/cycle/One.js', 'Dead');
expectLabel('src/cycle/Two.js', 'Dead');
expectLabel('src/widgets/Mentioned.js', 'Needs a check');
expectLabel('src/views/Lazy.js', 'Needs a check');
expectLabel('src/tested/OnlyByTests.js', 'Needs a check');
expectLabel('src/old/Card.js', 'Dead shims');
expectLabel('src/pages/Home.js', 'Needs a check'); // import('./pages/' + n + '.js')
expectLabel('src/re/Hidden.js', 'Needs a check'); // import() hidden from the stripper by a regex literal
check('A missing import target is listed as broken', ledger.includes('- src/main.js imports ./missing.js'));
check('A needs-a-check entry says why', /`src\/widgets\/Mentioned\.js`: its path appears in index\.html/.test(ledger));
check('Attic files are not labelled as src modules', labelOf(ledger, 'attic/src/gone/Dated.js') === null);

check('Scoreboard counts parallel modules across jobs', ledger.includes('- 4 parallel modules across 2 jobs'));
check('Parallel versions list each job with extras', ledger.includes('- Units: owner `src/units/A.js`; also `src/units/B.js`, `src/units/C.js`, `src/units/D.js`'));
check('A job with no parallel versions is left out of the list', !ledger.includes('- Config: owner'));

// Exported but named nowhere: nobodyNamesThis, and main.js's own boot. The default
// and `used` are imported, mentionedInHtmlName appears in index.html, and
// registry.js is imported with import *.
check('Only exports nobody names count as unused', ledger.includes('- 2 unused exports in live files.'), ledger.split('\n').find((l) => l.includes('unused export')));

check('An attic row gives the move date and the date 14 days later', ledger.includes('- `src/gone/Dated.js`: moved 2026-10-28, delete after 2026-11-11'));
check('An attic file with no row shows no date', ledger.includes('- `src/gone/Undated.js`: no date'));
check('Scoreboard names the first deletion date', ledger.includes('- 2 files waiting in `attic/`; the first can be deleted after 2026-11-11.'));

const second = runLedger(dir);
check('A second run writes byte-identical output', second.ledger === ledger);
check('The ledger holds no timestamp', !/\d{2}:\d{2}/.test(ledger));

// Removing a parallel path lowers the count.
const fewer = makeTree({
  ...BASE_TREE,
  'plateplan-architecture.md': OWNER_TABLE.replace(', `src/units/D.js`', '')
});
check('Removing a parallel path lowers the count', runLedger(fewer).ledger.includes('- 3 parallel modules across 2 jobs'));

// Owner-table errors stop the run.
const missingPath = makeTree({
  ...BASE_TREE,
  'plateplan-architecture.md': OWNER_TABLE.replace('`src/units/D.js`', '`src/units/Gone.js`')
});
const missingResult = runLedger(missingPath);
check('An owner table naming a missing file stops the run', missingResult.status !== 0);
check('The error names the missing file', missingResult.stderr.includes('src/units/Gone.js'), missingResult.stderr);
check('No ledger is written when the table is wrong', missingResult.ledger === '');

const noTable = makeTree({ ...BASE_TREE, 'plateplan-architecture.md': '# Architecture\n\nNo table here.\n' });
const noTableResult = runLedger(noTable);
check('A missing owner table stops the run', noTableResult.status !== 0 && noTableResult.stderr.includes('no owner table'), noTableResult.stderr);

// An import() built from a variable could load anything, so nothing unreachable is dead.
const variableImport = makeTree({
  ...BASE_TREE,
  'src/main.js': `${BASE_TREE['src/main.js']}export const load = (p) => import(p);\n`
});
const variableLedger = runLedger(variableImport).ledger;
check('A variable import() keeps every unreachable file out of Dead', labelOf(variableLedger, 'src/Dead.js') === 'Needs a check' && labelOf(variableLedger, 'src/DeadShim.js') === 'Needs a check');

// Without an entry point every module would look dead, so the run stops instead.
const { 'index.html': _, ...noIndexTree } = BASE_TREE;
const noIndex = runLedger(makeTree(noIndexTree));
check('A missing index.html stops the run', noIndex.status !== 0 && noIndex.stderr.includes('index.html not found') && noIndex.ledger === '', noIndex.stderr);
const noEntry = runLedger(makeTree({ ...BASE_TREE, 'index.html': '<html><script type="module">import "./src/main.js";</script></html>\n' }));
check('An index.html with no src/ script tag stops the run', noEntry.status !== 0 && noEntry.stderr.includes('no <script src='), noEntry.stderr);

for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });

console.log(testFailures === 0
  ? `=== ALL ${testCount} LEDGER CHECKS PASSED ===`
  : `\n=== ${testFailures} OF ${testCount} LEDGER CHECK(S) FAILED ===`);
process.exit(testFailures === 0 ? 0 : 1);
