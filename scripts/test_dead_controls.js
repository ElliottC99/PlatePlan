/**
 * scripts/test_dead_controls.js
 * Fails when a Pantry or Products control is wired to something that doesn't exist
 * (plan docs/plans/2026-10-29-2038-fix-pantry-products-dead-controls-plan.md, KTD5 and U6):
 *   - a data-pp-click / data-pp-change / data-pp-input attribute, which nothing reads;
 *   - an inline on* handler calling a function nothing defines;
 *   - a window.X call or typeof window.X check for an X nothing defines;
 *   - a data-action that neither ActionBridge.routeAction nor a listener in scope handles.
 * "Defined" means assigned to window anywhere in src/, or exported by a module that
 * componentRegistry spreads onto window. Every Pantry component is in scope.
 * Run: node scripts/test_dead_controls.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

function listJs(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? listJs(rel) : e.name.endsWith('.js') ? [rel] : [];
  });
}

// ---- the scope ----

function scopeFiles() {
  const html = read('index.html');
  const start = html.indexOf('<div id="view-ingredients"');
  const end = html.indexOf('<div id="view-planner"');
  assert.ok(start > 0 && end > start, 'index.html still has the Pantry and Product Bank sections');
  return [
    { name: 'index.html (view-ingredients, view-bank)', text: html.slice(start, end), lineBase: lineOf(html, start) - 1 },
    ...['src/views/PantryBankView.js', 'src/views/ProductBankView.js', 'src/views/ProductBankRenderService.js',
      ...listJs('src/components/pantry')]
      .map(f => ({ name: f, text: read(f), lineBase: 0 }))
  ];
}

// ---- what exists ----

function exportsOf(rel, seen = new Set()) {
  if (seen.has(rel) || !fs.existsSync(path.join(ROOT, rel))) return new Set();
  seen.add(rel);
  const t = read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const names = new Set();
  for (const m of t.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+(\w+)/g)) names.add(m[1]);
  for (const m of t.matchAll(/export\s*\{([^}]*)\}/g)) for (const part of m[1].split(',')) {
    const n = part.trim().split(/\s+as\s+/).pop().trim();
    if (n) names.add(n);
  }
  for (const m of t.matchAll(/export\s*\*\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) exportsOf(path.join(path.dirname(rel), m[1]), seen).forEach(n => names.add(n));
  return names;
}

function definedOnWindow() {
  const defined = new Set();
  for (const f of listJs('src')) {
    const t = read(f);
    for (const m of t.matchAll(/window\.(\w+)\s*(?:=(?!=)|\?\?=|\|\|=)/g)) defined.add(m[1]);
    for (const m of t.matchAll(/window\[['"](\w+)['"]\]\s*=(?!=)/g)) defined.add(m[1]);
    for (const m of t.matchAll(/Object\.assign\(\s*window\s*,\s*\{/g)) {
      let depth = 0, i = m.index + m[0].length - 1;
      const start = i;
      for (; i < t.length; i++) { if (t[i] === '{') depth++; else if (t[i] === '}' && --depth === 0) break; }
      let flat = '', d = 0;
      for (const ch of t.slice(start + 1, i)) { if (ch === '{' || ch === '(') d++; if (d === 0) flat += ch; if (ch === '}' || ch === ')') d--; }
      for (const k of flat.matchAll(/(?:^|,)\s*(?:async\s+)?(\w+)\s*(?=[:,(]|$)/gm)) defined.add(k[1]);
    }
  }
  const registry = read('src/components/componentRegistry.js');
  for (const m of registry.matchAll(/import \* as (\w+) from '\.\/(.+?)'/g)) {
    defined.add(m[1]);
    exportsOf(path.join('src/components', m[2])).forEach(n => defined.add(n));
  }
  return defined;
}

// Browser globals and the handful of names an inline handler may use without defining them.
const BUILTINS = new Set(('addEventListener removeEventListener dispatchEvent setTimeout clearTimeout requestAnimationFrame matchMedia ' +
  'scrollTo open print fetch alert confirm prompt structuredClone getComputedStyle location navigator firebase ' +
  'if this event document return Math String Number Boolean Array Object JSON parseInt parseFloat encodeURIComponent').split(' '));

function routedActions() {
  const bridge = read('src/services/ActionBridge.js') + read('src/services/RecipeActionBridge.js');
  return {
    exact: new Set([...bridge.matchAll(/normalizedAction\s*===\s*'([^']+)'/g)].map(m => m[1])),
    includes: [...bridge.matchAll(/normalizedAction\.(?:includes|startsWith)\('([^']+)'\)/g)].map(m => m[1])
  };
}

// ---- the checker ----

export function findDeadControls(files, { defined, routed }) {
  const local = new Set();
  for (const f of files) {
    for (const m of f.text.matchAll(/\baction\w*\s*===\s*['"]([^'"]+)['"]/g)) local.add(m[1]);
    for (const m of f.text.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)) local.add(m[1]);
  }
  const isRouted = v => routed.exact.has(v.toLowerCase()) || routed.includes.some(l => v.toLowerCase().includes(l)) || local.has(v);
  const isDefined = n => defined.has(n) || BUILTINS.has(n);
  const dead = [];
  for (const f of files) {
    const at = idx => `${f.name}:${f.lineBase + lineOf(f.text, idx)}`;
    for (const m of f.text.matchAll(/data-pp-(click|change|input)=/g)) dead.push(`${at(m.index)} data-pp-${m[1]} is never read`);
    for (const m of f.text.matchAll(/\son(?:click|change|input|submit|keyup|keydown)=(["'])(.*?)\1/g)) {
      // Template interpolation such as ${escapeAttr(id)} runs while the markup is built, not on the event.
      const handler = m[2].replace(/\$\{[^}]*\}/g, '');
      for (const call of handler.matchAll(/(?:^|[^.\w])(?:window\.)?([A-Za-z_]\w*)\s*\(/g)) {
        if (!isDefined(call[1])) dead.push(`${at(m.index)} inline handler calls ${call[1]}(), which nothing defines`);
      }
    }
    for (const m of f.text.matchAll(/window\.(\w+)\s*(?:\?\.)?\(|typeof\s+window\.(\w+)/g)) {
      const name = m[1] || m[2];
      if (!isDefined(name)) dead.push(`${at(m.index)} window.${name} is never defined`);
    }
    // Either quote may wrap the value, with the other inside it: data-action="fn('arg')".
    for (const m of f.text.matchAll(/data-action=(?:"([^"]*)"|'([^']*)')/g)) {
      const value = m[1] ?? m[2];
      if (value.includes('${')) continue; // built at render time; checked where the value is chosen
      if (!isRouted(value)) dead.push(`${at(m.index)} data-action="${value}" is not routed`);
    }
  }
  return dead;
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

console.log('=== RUNNING DEAD CONTROLS SUITE ===\n');

const context = { defined: definedOnWindow(), routed: routedActions() };
const fixture = text => findDeadControls([{ name: 'fixture.js', text, lineBase: 0 }], context);

check('Covers AE7: a data-pp-click button is reported', () => {
  assert.equal(fixture('<button data-pp-click="saveManualIng()">Save</button>').length, 1);
});

check('an inline handler calling a missing window function is reported, a defined one is not', () => {
  assert.equal(fixture('<div onclick="window.nope()">x</div>').length >= 1, true);
  assert.deepEqual(fixture('<div onclick="window.renderIngredientBank()">x</div>'), []);
  assert.deepEqual(fixture('<div onclick="window.renderIngredientBank(\'${escapeAttr(id)}\')">x</div>'), [], 'interpolation is not a handler call');
});

check('a data-action nothing routes is reported, a routed one is not', () => {
  assert.equal(fixture('<button data-action="nobody-routes-this">x</button>').length, 1);
  assert.deepEqual(fixture('<button data-action="tesco-import">x</button>'), []);
  assert.equal(fixture(`<button data-action="nobodyRoutes('x')">x</button>`).length, 1, 'the fn(\'arg\') form is checked too');
});

check('no dead controls on the Pantry and Product Bank screens', () => {
  const dead = findDeadControls(scopeFiles(), context);
  assert.deepEqual(dead, [], `\n  ${dead.join('\n  ')}`);
});

if (failures === 0) {
  console.log('\n=== ALL DEAD CONTROLS TESTS PASSED ===');
  process.exit(0);
} else {
  console.error(`\n=== ${failures} DEAD CONTROLS TESTS FAILED ===`);
  process.exit(1);
}
