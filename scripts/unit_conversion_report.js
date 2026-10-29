/**
 * scripts/unit_conversion_report.js
 * Before/after change report for the one unit converter. It runs every ingredient line
 * in a Firestore backup, plus the made-up lines in scripts/fixtures/unit-conversion-lines.json,
 * through the old code (from a base commit) and the new code (this working tree), for each
 * caller that converts units, and lists every line whose result changes.
 *
 * It reads the backup file only, never Firestore. The report holds household data, so it is
 * written outside the repo (default ~/PlatePlan-backups/reports/) and never committed.
 *
 * Usage:
 *   node scripts/unit_conversion_report.js
 *   node scripts/unit_conversion_report.js --backup <file> --base <git-ref> --out <dir>
 *
 * Defaults: the newest plateplan-backup-*.json in ~/PlatePlan-backups, the merge-base of HEAD
 * and origin/development, and ~/PlatePlan-backups/reports.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKUP_DIR = path.join(os.homedir(), 'PlatePlan-backups');
const HOUSEHOLD_ID = 'elliott-chloe';

const CALLERS = [
  ['import', 'Recipe import (parseIngredientString on the original text)'],
  ['editorPaste', 'Recipe editor, pasted text (parseIngredientLine on the original text)'],
  ['editorOpen', 'Recipe editor, opening a saved recipe (normaliseRecipeAmountForUi)'],
  ['shopping', 'Shopping list (convertToStrictUnit on the stored amount)'],
  ['nutrition', 'Nutrition (grams counted by calculateItemNutrition)'],
  ['detailGarlic', 'Recipe detail view, garlic lines (grams before turning into cloves)']
];
const STORED_UNITS = new Set(['g', 'ml', 'qty']);

/** Loads the functions each caller converts through, from a checkout's src/ directory. */
export async function loadModuleSet(rootDir) {
  const load = rel => import(pathToFileURL(path.join(rootDir, 'src', rel)).href);
  const parser = await load('services/RecipeIngredientParser.js');
  const utils = await load('utils/unitConverter.js');
  const owner = await load('services/UnitConversionService.js');
  const nutrition = await load('services/NutritionService.js');
  // Before the merge the detail view multiplied by UNIT_TO_GRAMS (6 g when the unit was missing).
  const garlicGrams = utils.UNIT_TO_GRAMS
    ? (qty, unit) => qty * (utils.UNIT_TO_GRAMS[unit] || 6)
    : (qty, unit) => owner.toGrams(qty, unit, 'garlic');
  return {
    parseIngredientString: parser.parseIngredientString,
    parseIngredientLine: utils.parseIngredientLine,
    normaliseRecipeAmountForUi: utils.normaliseRecipeAmountForUi,
    convertToStrictUnit: owner.convertToStrictUnit,
    calculateItemNutrition: nutrition.calculateItemNutrition,
    garlicGrams
  };
}

function lineName(line) {
  return line.name || line.ingredient || line.title || line.item || line.raw || '';
}

function isGarlic(line) {
  return line.ingredientId === 'garlic_fresh' || String(lineName(line)).trim().toLowerCase() === 'garlic';
}

function amount(result) {
  if (!result || result.qty === undefined || result.qty === null) return null;
  return { qty: Number(result.qty), unit: String(result.unit || '') };
}

function safely(fn) {
  try {
    return fn();
  } catch (err) {
    return { error: err.message };
  }
}

function sameAmount(a, b) {
  if (a?.error || b?.error) return a?.error === b?.error;
  if (!a || !b) return a === b;
  return a.unit === b.unit && Math.abs(a.qty - b.qty) < 1e-9;
}

/** Runs one line through one module set for every caller that applies to it. */
function runLine(mods, line, pantryItem) {
  const out = {};
  const name = lineName(line);
  if (typeof line.raw === 'string' && line.raw.trim()) {
    out.import = safely(() => amount(mods.parseIngredientString(line.raw)));
    out.editorPaste = safely(() => amount(mods.parseIngredientLine(line.raw)));
  }
  if (line.qty !== undefined || line.quantity !== undefined || line.amount !== undefined || line.unit !== undefined) {
    const qty = Number(line.qty ?? line.quantity ?? line.amount ?? 1);
    const unit = String(line.unit || '').trim();
    out.editorOpen = safely(() => amount(mods.normaliseRecipeAmountForUi(line)));
    out.shopping = safely(() => amount(mods.convertToStrictUnit(qty, unit, name)));
    // A stand-in item of 100 kcal per 100 g, so kcal equals the grams nutrition counts.
    const item = {
      name: pantryItem?.name || name,
      cal: 100,
      itemWeight: pantryItem?.itemWeight,
      drainedWeight: pantryItem?.drainedWeight,
      packSize: pantryItem?.packSize
    };
    out.nutrition = safely(() => ({ qty: mods.calculateItemNutrition(item, qty, unit || 'g').kcal, unit: 'g' }));
    if (isGarlic(line)) {
      out.detailGarlic = safely(() => {
        const plain = unit === 'g' || unit === 'gram' || !unit;
        return { qty: plain ? qty : mods.garlicGrams(qty, unit), unit: 'g' };
      });
    }
  }
  return out;
}

function explain(owner, line, caller) {
  if (!owner || caller === 'detailGarlic') return '';
  const name = lineName(line);
  const density = () => `not liquid, density ${owner.getIngredientDensity(name)} g/ml`;
  if (caller === 'import' || caller === 'editorPaste') {
    return owner.isLiquidIngredient(name) ? 'liquid (whole-word match)' : density();
  }
  const r = owner.convertToStrictUnit(line.qty ?? line.quantity ?? line.amount, line.unit, name);
  if (r.unit === 'ml') return 'liquid (whole-word match)';
  if (r.unit === 'qty') return 'count unit';
  if (/pinch|dash|handful|bunch/i.test(String(line.unit))) return 'loose measure';
  if (r.isEstimated) return density();
  return 'weight unit';
}

/**
 * Compares the old and new module sets over a backup and the fixture.
 * Returns per-caller counts, changed lines, and stored lines that still hold a raw unit (R8).
 */
export function compareConversions({ backup, fixture, oldMods, newMods, owner }) {
  const household = backup?.collections?.households?.[HOUSEHOLD_ID]?.collections || {};
  const docs = coll => Object.values(household[coll] || {}).map(d => d.data || d);
  const pantry = new Map();
  for (const item of [...docs('ingredients'), ...docs('products')]) {
    if (item?.id && !pantry.has(String(item.id))) pantry.set(String(item.id), item);
  }

  const sources = [];
  for (const recipe of docs('recipes')) {
    const title = recipe.title || recipe.name || '(untitled recipe)';
    for (const raw of recipe.ingredients || []) {
      const line = typeof raw === 'string' ? { raw } : raw;
      sources.push({ group: 'backup', title, line });
    }
  }
  for (const f of fixture?.strict || []) {
    const line = { qty: f.qty, unit: f.unit, name: f.name, raw: `${f.qty} ${f.unit} ${f.name}`.replace(/\s+/g, ' ').trim() };
    sources.push({ group: 'fixture', title: 'Made-up line', line });
  }

  const result = { counts: {}, changed: {}, rawUnitLines: [] };
  for (const group of ['backup', 'fixture']) {
    result.counts[group] = {};
    result.changed[group] = {};
    for (const [caller] of CALLERS) {
      result.counts[group][caller] = { checked: 0, changed: 0 };
      result.changed[group][caller] = [];
    }
  }

  for (const { group, title, line } of sources) {
    const pantryItem = pantry.get(String(line.ingredientId || line.productId || line.bankId || ''));
    const before = runLine(oldMods, line, pantryItem);
    const after = runLine(newMods, line, pantryItem);
    for (const [caller] of CALLERS) {
      if (!(caller in after) && !(caller in before)) continue;
      const counts = result.counts[group][caller];
      counts.checked++;
      if (sameAmount(before[caller], after[caller])) continue;
      counts.changed++;
      result.changed[group][caller].push({
        title,
        text: line.raw || `${line.qty} ${line.unit} ${lineName(line)}`,
        old: before[caller],
        new: after[caller],
        why: explain(owner, line, caller)
      });
    }
    const unit = String(line.unit ?? '').trim().toLowerCase();
    if (group === 'backup' && line.unit !== undefined && !STORED_UNITS.has(unit)) {
      result.rawUnitLines.push({ title, text: line.raw || lineName(line), old: before.shopping, new: after.shopping });
    }
  }
  return result;
}

function show(a) {
  if (!a) return '—';
  if (a.error) return `error: ${a.error}`;
  return `${Math.round(a.qty * 100) / 100} ${a.unit}`;
}

function cell(text) {
  return String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

/** Renders the comparison as a Markdown report. */
export function renderReport(result, meta) {
  const out = [];
  out.push('# Unit conversion change report', '');
  out.push(`- Backup: \`${meta.backupName}\``);
  out.push(`- Old code: \`${meta.baseRef}\` (${meta.baseCommit})`);
  out.push(`- New code: working tree at ${meta.headCommit}`);
  out.push(`- Generated: ${meta.generatedAt}`, '');
  out.push('This file holds household recipe data. Keep it out of the repo.', '');

  out.push('## Counts', '');
  out.push('| Caller | Saved recipe lines checked | Changed | Made-up lines checked | Changed |', '|---|---|---|---|---|');
  for (const [caller, label] of CALLERS) {
    const b = result.counts.backup[caller];
    const f = result.counts.fixture[caller];
    out.push(`| ${label} | ${b.checked} | ${b.changed} | ${f.checked} | ${f.changed} |`);
  }
  out.push('');

  out.push('## Saved lines that still hold a raw unit', '');
  out.push('Their shopping amount is converted every time a list is built, so the household sees any change here.', '');
  if (!result.rawUnitLines.length) {
    out.push('None. Every saved line is stored in g, ml or qty.', '');
  } else {
    out.push('| Recipe | Line | Shopping before | Shopping after |', '|---|---|---|---|');
    for (const r of result.rawUnitLines) out.push(`| ${cell(r.title)} | ${cell(r.text)} | ${show(r.old)} | ${show(r.new)} |`);
    out.push('');
  }

  for (const [group, heading] of [['backup', 'Changed saved recipe lines'], ['fixture', 'Changed made-up lines']]) {
    out.push(`## ${heading}`, '');
    let any = false;
    for (const [caller, label] of CALLERS) {
      const rows = result.changed[group][caller];
      if (!rows.length) continue;
      any = true;
      out.push(`### ${label}`, '');
      out.push('| Recipe | Line | Before | After | Why |', '|---|---|---|---|---|');
      for (const r of rows) out.push(`| ${cell(r.title)} | ${cell(r.text)} | ${show(r.old)} | ${show(r.new)} | ${cell(r.why)} |`);
      out.push('');
    }
    if (!any) out.push('No changes.', '');
  }
  return out.join('\n');
}

/** Throws when a path is inside the repo, which is public. */
export function assertOutsideRepo(target, repoRoot = REPO_ROOT) {
  const rel = path.relative(fs.realpathSync(repoRoot), path.resolve(target));
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`Refusing to write inside the repo (${target}): the report holds household data.`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--backup') args.backup = argv[++i];
    else if (argv[i] === '--base') args.base = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function newestBackup() {
  const files = fs.existsSync(BACKUP_DIR)
    ? fs.readdirSync(BACKUP_DIR).filter(f => /^plateplan-backup-.*\.json$/.test(f)).sort()
    : [];
  if (!files.length) throw new Error(`No plateplan-backup-*.json found in ${BACKUP_DIR}. Pass --backup <file>.`);
  return path.join(BACKUP_DIR, files[files.length - 1]);
}

function extractSrc(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plateplan-old-src-'));
  const archive = execFileSync('git', ['archive', '--format=tar', ref, 'src'], { cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  fs.writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');
  return dir;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backupPath = path.resolve(args.backup || newestBackup());
  const baseRef = args.base || git('merge-base', 'HEAD', 'origin/development');
  let baseCommit;
  try {
    baseCommit = git('rev-parse', '--short', `${baseRef}^{commit}`);
  } catch {
    throw new Error(`Base ref ${baseRef} is not a commit in this repo. Pass --base <git-ref>.`);
  }
  const headCommit = git('rev-parse', '--short', 'HEAD');
  const outDir = path.resolve(args.out || path.join(BACKUP_DIR, 'reports'));
  assertOutsideRepo(outDir);

  const oldDir = extractSrc(baseRef);
  try {
    const oldMods = await loadModuleSet(oldDir);
    const newMods = await loadModuleSet(REPO_ROOT);
    const owner = await import(pathToFileURL(path.join(REPO_ROOT, 'src/services/UnitConversionService.js')).href);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const fixture = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts/fixtures/unit-conversion-lines.json'), 'utf8'));

    const generatedAt = new Date().toISOString();
    const result = compareConversions({ backup, fixture, oldMods, newMods, owner });
    const report = renderReport(result, { backupName: path.basename(backupPath), baseRef, baseCommit, headCommit, generatedAt });

    fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
    const outFile = path.join(outDir, `unit-conversion-report-${generatedAt.replace(/[:.]/g, '-')}.md`);
    fs.writeFileSync(outFile, report, { mode: 0o600 });
    console.log(`Report written to ${outFile}`);
    for (const [caller, label] of CALLERS) {
      const c = result.counts.backup[caller];
      console.log(`  ${label}: ${c.changed} of ${c.checked} saved lines changed`);
    }
    console.log(`  Saved lines with a raw unit: ${result.rawUnitLines.length}`);
  } finally {
    fs.rmSync(oldDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}
