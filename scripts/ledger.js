/**
 * scripts/ledger.js
 * Writes LEDGER.md: every module under src/ labelled live, live shim, dead shim,
 * dead or "needs a check", with a scoreboard that also counts the parallel
 * versions listed in the owner table in plateplan-architecture.md and the files
 * waiting in attic/.
 *
 * Usage: npm run ledger            (repo root)
 *        node scripts/ledger.js DIR  (another tree; scripts/test_ledger.js uses this)
 *
 * A module is live when the browser can load it: it is reached from a src/
 * script tag in index.html through static imports, re-exports or import()
 * calls. Globals on window and data-action strings only reach modules that are
 * already loaded, so they need no separate pass. An unreachable module is
 * labelled "needs a check" rather than dead when its folder-plus-name path
 * (for example services/firebase.js) appears in another file's code, when it
 * sits under a folder used by an import() built with ${}, or when a script
 * outside src/ imports it. Only what is left is dead.
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const OWNER_TABLE_FILE = 'plateplan-architecture.md';
const OWNER_TABLE_HEADER = ['Job', 'Owner', 'Parallel versions'];
const ATTIC_INDEX_FILE = 'attic/README.md';
const ATTIC_TABLE_HEADER = ['File', 'Moved', 'Delete after'];
const LABELS = ['live', 'live shim', 'needs a check', 'dead shim', 'dead'];

const STATIC_IMPORT = /\b(import|export)\s+((?:(?!\b(?:import|export)\b)[^'"`;])*?)\s*\bfrom\s*(['"])([^'"]+)\3|\bimport\s*(['"])([^'"]+)\5/g;
const DYNAMIC_IMPORT = /\bimport\(\s*(['"`])([^'"`]*)\1\s*\)/g;
const COMPUTED_IMPORT = /\bimport\(\s*(?!['"`])/g;

class LedgerError extends Error {}

const toPosix = (p) => p.split(path.sep).join('/');
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Removes // and /* */ comments while leaving string and template contents intact.
function stripComments(code) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === '/' && next === '/') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (ch === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === '\\') j++;
        if (ch !== '`' && code[j] === '\n') break;
        j++;
      }
      out += code.slice(i, j + 1);
      i = j + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

async function listFiles(dir, test) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of await fs.readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    if (test(full)) files.push(toPosix(path.relative(rootDir, full)));
  }
  return files.sort(byText);
}

// Resolves a relative specifier from a repo-relative file; returns null for URLs and packages.
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  const clean = specifier.split('?')[0].split('#')[0];
  return toPosix(path.normalize(path.join(path.dirname(fromFile), clean)));
}

function parseImports(file, code) {
  const imports = [];
  for (const m of code.matchAll(STATIC_IMPORT)) {
    const isPlainImport = m[6] !== undefined;
    const specifier = isPlainImport ? m[6] : m[4];
    imports.push({
      specifier,
      target: resolveSpecifier(file, specifier),
      kind: isPlainImport ? 'side-effect' : m[1],
      clause: isPlainImport ? '' : m[2]
    });
  }
  const interpolatedDirs = [];
  for (const m of code.matchAll(DYNAMIC_IMPORT)) {
    const specifier = m[2];
    if (m[1] === '`' && specifier.includes('${')) {
      const prefix = specifier.slice(0, specifier.indexOf('${'));
      const dir = resolveSpecifier(file, prefix.endsWith('/') ? prefix : path.posix.dirname(prefix) + '/');
      interpolatedDirs.push(dir || toPosix(path.dirname(file)));
    } else {
      imports.push({ specifier, target: resolveSpecifier(file, specifier), kind: 'dynamic', clause: '' });
    }
  }
  if (COMPUTED_IMPORT.test(code)) interpolatedDirs.push(toPosix(path.dirname(file)));
  COMPUTED_IMPORT.lastIndex = 0;
  return { imports, interpolatedDirs };
}

// A shim is a file whose only statements re-export another module.
function isShim(code) {
  let hasReexport = false;
  const rest = code.replace(/\bexport\s+(\*(\s+as\s+\w+)?|\{[^}]*\})\s*from\s*(['"])[^'"]+\3\s*;?/g, () => {
    hasReexport = true;
    return '';
  });
  return hasReexport && rest.trim() === '';
}

function parseExports(code) {
  const names = new Set();
  for (const m of code.matchAll(/\bexport\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of code.matchAll(/\bexport\s+default\b/g)) names.add('default');
  for (const m of code.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

// Names an import clause takes from its target; null means "all of them".
function importedNames(entry) {
  if (entry.kind === 'dynamic') return null;
  if (entry.kind === 'side-effect') return new Set();
  const clause = entry.clause.trim();
  if (entry.kind === 'export') {
    if (clause.startsWith('*')) return null;
  } else if (/\*\s*as\s+/.test(clause)) {
    return null;
  }
  const names = new Set();
  const braces = clause.match(/\{([^}]*)\}/);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  const beforeBraces = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
  if (entry.kind === 'import' && beforeBraces) names.add('default');
  return names;
}

function parseMarkdownTable(text, header, sourceName) {
  const lines = text.split('\n');
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const start = lines.findIndex((line) => {
    if (!line.trim().startsWith('|')) return false;
    const row = cells(line);
    return header.every((h, i) => row[i] === h);
  });
  if (start === -1) return null;
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const row = cells(lines[i]);
    if (row.length < header.length) {
      throw new LedgerError(`${sourceName}: malformed table row: ${lines[i].trim()}`);
    }
    rows.push(row);
  }
  return rows;
}

const backtickPaths = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

async function readOwnerTable() {
  const file = path.join(rootDir, OWNER_TABLE_FILE);
  if (!existsSync(file)) throw new LedgerError(`${OWNER_TABLE_FILE} not found`);
  const rows = parseMarkdownTable(await fs.readFile(file, 'utf8'), OWNER_TABLE_HEADER, OWNER_TABLE_FILE);
  if (!rows) {
    throw new LedgerError(`${OWNER_TABLE_FILE}: no owner table with the header | ${OWNER_TABLE_HEADER.join(' | ')} |`);
  }
  const jobs = [];
  for (const [job, ownerCell, parallelCell] of rows) {
    const owner = backtickPaths(ownerCell)[0];
    if (!job || !owner) throw new LedgerError(`${OWNER_TABLE_FILE}: owner table row "${job}" needs a job and a \`path\` owner`);
    const parallels = backtickPaths(parallelCell);
    for (const p of [owner, ...parallels]) {
      if (!existsSync(path.join(rootDir, p))) {
        throw new LedgerError(`${OWNER_TABLE_FILE}: owner table row "${job}" names ${p}, which does not exist`);
      }
    }
    jobs.push({ job, owner, parallels });
  }
  return jobs;
}

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function readAttic() {
  const files = await listFiles(path.join(rootDir, 'attic'), (f) => toPosix(path.relative(rootDir, f)) !== ATTIC_INDEX_FILE);
  const indexFile = path.join(rootDir, ATTIC_INDEX_FILE);
  const rows = existsSync(indexFile)
    ? parseMarkdownTable(await fs.readFile(indexFile, 'utf8'), ATTIC_TABLE_HEADER, ATTIC_INDEX_FILE) || []
    : [];
  const moved = new Map();
  for (const [fileCell, movedCell] of rows) {
    const original = backtickPaths(fileCell)[0];
    if (original) moved.set(original, movedCell);
  }
  return files.map((atticPath) => {
    const original = atticPath.replace(/^attic\//, '');
    const date = moved.get(original);
    return { atticPath, original, moved: date || null, deleteAfter: date ? addDays(date, 14) : null };
  });
}

async function buildLedger() {
  const srcFiles = await listFiles(path.join(rootDir, 'src'), (f) => f.endsWith('.js'));
  const srcSet = new Set(srcFiles);
  const code = new Map();
  for (const f of srcFiles) code.set(f, stripComments(await fs.readFile(path.join(rootDir, f), 'utf8')));

  const indexPath = path.join(rootDir, 'index.html');
  const indexHtml = existsSync(indexPath) ? await fs.readFile(indexPath, 'utf8') : '';
  const entries = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
    .map((m) => m[1].split('?')[0].replace(/^\.\//, ''))
    .filter((src) => srcSet.has(src));

  const parsed = new Map();
  const interpolatedDirs = [];
  const brokenImports = [];
  for (const f of srcFiles) {
    const result = parseImports(f, code.get(f));
    parsed.set(f, result.imports);
    interpolatedDirs.push(...result.interpolatedDirs);
    for (const imp of result.imports) {
      if (imp.target && !srcSet.has(imp.target) && !existsSync(path.join(rootDir, imp.target))) {
        brokenImports.push(`${f} imports ${imp.specifier}`);
      }
    }
  }

  // Reachability from the script tags.
  const reachable = new Set();
  const queue = [...entries];
  while (queue.length) {
    const f = queue.shift();
    if (reachable.has(f)) continue;
    reachable.add(f);
    for (const imp of parsed.get(f)) if (imp.target && srcSet.has(imp.target)) queue.push(imp.target);
  }

  // Modules imported by scripts outside src/ (tests, backups, tools).
  const outsideFiles = [
    ...(await listFiles(path.join(rootDir, 'scripts'), (f) => f.endsWith('.js'))),
    ...(await fs.readdir(rootDir)).filter((f) => f.endsWith('.js')).sort(byText)
  ];
  const importedFromOutside = new Set();
  for (const f of outsideFiles) {
    const { imports } = parseImports(f, stripComments(await fs.readFile(path.join(rootDir, f), 'utf8')));
    for (const imp of imports) if (imp.target && srcSet.has(imp.target)) importedFromOutside.add(imp.target);
  }

  // Text each file shows to the mention check: its code minus specifiers that resolved to a file.
  const mentionText = new Map();
  for (const f of srcFiles) {
    let text = code.get(f);
    for (const imp of parsed.get(f)) {
      if (imp.target && existsSync(path.join(rootDir, imp.target))) text = text.split(imp.specifier).join('');
    }
    mentionText.set(f, text);
  }
  const mentionedBy = (file) => {
    const key = file.split('/').slice(-2).join('/');
    if (indexHtml.includes(key)) return 'index.html';
    return srcFiles.find((other) => other !== file && mentionText.get(other).includes(key)) || null;
  };

  const modules = srcFiles.map((f) => {
    const shim = isShim(code.get(f));
    if (reachable.has(f)) return { path: f, label: shim ? 'live shim' : 'live' };
    const dir = interpolatedDirs.find((d) => f.startsWith(d.endsWith('/') ? d : `${d}/`));
    if (dir) return { path: f, label: 'needs a check', reason: `a computed import() can load files under ${dir}` };
    if (importedFromOutside.has(f)) return { path: f, label: 'needs a check', reason: 'a script outside src/ imports it' };
    const mention = mentionedBy(f);
    if (mention) return { path: f, label: 'needs a check', reason: `its path appears in ${mention}` };
    return { path: f, label: shim ? 'dead shim' : 'dead' };
  });

  // Unused exports in live modules that aren't shims.
  const usedNames = new Map();
  const allUsed = new Set();
  for (const f of srcFiles) {
    for (const imp of parsed.get(f)) {
      if (!imp.target) continue;
      const names = importedNames(imp);
      if (names === null) allUsed.add(imp.target);
      else {
        if (!usedNames.has(imp.target)) usedNames.set(imp.target, new Set());
        for (const n of names) usedNames.get(imp.target).add(n);
      }
    }
  }
  let unusedExports = 0;
  for (const m of modules) {
    if (m.label !== 'live' || allUsed.has(m.path)) continue;
    for (const name of parseExports(code.get(m.path))) {
      if (usedNames.get(m.path)?.has(name)) continue;
      if (name !== 'default') {
        const word = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
        if (word.test(indexHtml) || srcFiles.some((other) => other !== m.path && word.test(code.get(other)))) continue;
      }
      unusedExports++;
    }
  }

  return {
    modules,
    jobs: await readOwnerTable(),
    attic: await readAttic(),
    unusedExports,
    brokenImports: brokenImports.sort(byText)
  };
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function render({ modules, jobs, attic, unusedExports, brokenImports }) {
  const byLabel = Object.fromEntries(LABELS.map((l) => [l, modules.filter((m) => m.label === l)]));
  const parallelJobs = jobs.filter((j) => j.parallels.length > 0);
  const parallelCount = parallelJobs.reduce((n, j) => n + j.parallels.length, 0);
  const dates = attic.map((a) => a.deleteAfter).filter(Boolean).sort(byText);

  const lines = [
    '# Code Ledger',
    '',
    'Generated by `npm run ledger` (`scripts/ledger.js`). Don\'t edit it by hand: run the command again after changing code, the owner table in `plateplan-architecture.md`, or the attic.',
    '',
    '## Scoreboard',
    '',
    `- ${plural(byLabel.dead.length, 'dead file')} and ${plural(byLabel['dead shim'].length, 'dead shim')} outside the attic. Nothing loads them; move them to \`attic/\`.`,
    `- ${plural(byLabel['needs a check'].length, 'file')} ${byLabel['needs a check'].length === 1 ? 'needs' : 'need'} a check: nothing imports ${byLabel['needs a check'].length === 1 ? 'it' : 'them'}, but something might still load ${byLabel['needs a check'].length === 1 ? 'it' : 'them'}.`,
    `- ${plural(parallelCount, 'parallel module')} across ${plural(parallelJobs.length, 'job')}, from the owner table in \`plateplan-architecture.md\`. Each one does a job another module already owns.`,
    `- ${plural(unusedExports, 'unused export')} in live files.`,
    attic.length
      ? `- ${plural(attic.length, 'file')} waiting in \`attic/\`${dates.length ? `; the first can be deleted after ${dates[0]}` : ''}.`
      : '- Nothing is waiting in `attic/`.',
    `- ${plural(byLabel.live.length + byLabel['live shim'].length, 'live module')}, ${byLabel['live shim'].length} of them re-export shims.`,
    '',
    '| Label | Count |',
    '|---|---|',
    ...LABELS.map((l) => `| ${l} | ${byLabel[l].length} |`),
    `| parallel versions | ${parallelCount} |`,
    `| unused exports | ${unusedExports} |`,
    `| in the attic | ${attic.length} |`,
    ''
  ];

  const section = (title, intro, items) => {
    lines.push(`## ${title}`, '', intro, '');
    if (items.length) lines.push(...items, '');
    else lines.push('None.', '');
  };

  section('Dead', 'Nothing loads these files.', byLabel.dead.map((m) => `- \`${m.path}\``));
  section('Dead shims', 'Re-export files that nothing loads.', byLabel['dead shim'].map((m) => `- \`${m.path}\``));
  section('Needs a check', 'Nothing imports these files, but the reason given means something might still load them. Check by hand before moving one.', byLabel['needs a check'].map((m) => `- \`${m.path}\`: ${m.reason}`));
  section('Parallel versions', 'Jobs with more than one module, from the owner table in `plateplan-architecture.md`.', parallelJobs.map((j) => `- ${j.job}: owner \`${j.owner}\`; also ${j.parallels.map((p) => `\`${p}\``).join(', ')}`));
  section('In the attic', 'Moved out of `src/`; see `attic/README.md`. Delete after two weeks of normal use on both phones with no related problem.', attic.map((a) => `- \`${a.original}\`: ${a.moved ? `moved ${a.moved}, delete after ${a.deleteAfter}` : 'no date'}`));
  if (brokenImports.length) section('Broken imports', 'Imports whose target file is missing.', brokenImports.map((b) => `- ${b}`));
  section('Live shims', 'Re-export files something still loads. Point their importers at the real module, then they become dead shims.', byLabel['live shim'].map((m) => `- \`${m.path}\``));
  section('Live', 'Everything else the app loads.', byLabel.live.map((m) => `- \`${m.path}\``));

  return lines.join('\n').replace(/\n+$/, '\n');
}

async function main() {
  console.log('=== WRITING CODE LEDGER ===');
  let ledger;
  try {
    ledger = await buildLedger();
  } catch (err) {
    if (err instanceof LedgerError) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  await fs.writeFile(path.join(rootDir, 'LEDGER.md'), render(ledger));
  const count = (label) => ledger.modules.filter((m) => m.label === label).length;
  console.log(`✅ LEDGER.md: ${count('dead')} dead, ${count('dead shim')} dead shims, ${count('needs a check')} to check, ${ledger.jobs.reduce((n, j) => n + j.parallels.length, 0)} parallel, ${ledger.attic.length} in the attic`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
