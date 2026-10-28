/**
 * scripts/test_pwa_build.js
 * Verification for release version stamping and the removed service worker:
 * 1. The build stamps package.json's version and the commit ID into dist/index.html.
 * 2. The build fails, naming the file, when a placeholder survives in what the page loads.
 * 3. The header version reads "3.46.0 (abc1234)", or "dev" on an unbuilt page.
 * 4. No service worker is registered or published, and the old-worker cleanup stays.
 * 5. manifest.json keeps the installable PWA settings.
 *
 * The build runs in a temporary copy of the repo so no dist/ is left behind
 * for `npm run dev` to serve.
 */

import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(path.join(rootDir, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));

console.log('=== RUNNING PWA BUILD & VERSION STAMPING VERIFICATION ===');

// Copy what scripts/build.js reads into a temporary root and run the build there.
// GIT_DIR points git at this repo so the build still finds the real commit ID.
const BUILD_INPUTS = [
  'src', 'styles', 'vendor', 'scripts', 'index.html', 'manifest.json', 'metadata.json',
  'icon-192.png', 'icon-192-maskable.png', 'icon-512.png', 'icon-512-maskable.png',
  'server.js', 'package.json'
];
const tempRoots = [];
function buildInTempCopy(prepare = () => {}) {
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'plateplan-build-'));
  tempRoots.push(tempRoot);
  for (const input of BUILD_INPUTS) {
    if (existsSync(path.join(rootDir, input))) {
      cpSync(path.join(rootDir, input), path.join(tempRoot, input), { recursive: true });
    }
  }
  prepare(tempRoot);
  const result = spawnSync(process.execPath, [path.join(tempRoot, 'scripts', 'build.js')], {
    cwd: tempRoot,
    env: { ...process.env, GIT_DIR: path.join(rootDir, '.git') },
    encoding: 'utf8'
  });
  return { tempRoot, distDir: path.join(tempRoot, 'dist'), status: result.status, output: `${result.stdout}${result.stderr}` };
}

function listFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

try {
  // 1. The build stamps one version source and the commit ID
  assert.equal(pkg.version, '3.46.0', 'package.json version should be 3.46.0');
  const commitId = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).stdout.trim();

  const good = buildInTempCopy();
  assert.equal(good.status, 0, `build should succeed:\n${good.output}`);
  const distHtml = readFileSync(path.join(good.distDir, 'index.html'), 'utf8');
  assert(!distHtml.includes('__APP_VERSION__'), 'dist/index.html should have no version placeholder');
  assert(!distHtml.includes('__BUILD_ID__'), 'dist/index.html should have no build-ID placeholder');
  assert(distHtml.includes(`<meta name="app-version" content="${pkg.version}">`), 'version meta should equal package.json version');
  assert(distHtml.includes(`<meta name="build-id" content="${commitId}">`), 'build-ID meta should equal the commit ID');
  assert.match(commitId, /^[0-9a-f]{7,}$/, 'commit ID should be a short hex hash');
  const versionStrings = [...distHtml.matchAll(/\?v=([^"]+)"/g)].map(m => m[1]);
  assert.equal(versionStrings.length, 6, 'four stylesheets and two scripts should carry ?v=');
  assert(versionStrings.every(v => v === commitId), 'every ?v= value should be the commit ID');
  console.log('✅ Test 1 Passed: dist/index.html carries the package.json version and the commit ID');

  // 2. A placeholder left in what the page loads fails the build and is named
  const bad = buildInTempCopy(tempRoot => {
    writeFileSync(path.join(tempRoot, 'src', 'leftover-placeholder.js'), "export const v = '__BUILD_ID__';\n");
  });
  assert.notEqual(bad.status, 0, 'build should fail when a placeholder survives');
  assert(bad.output.includes(path.join('src', 'leftover-placeholder.js')), `failure should name the file:\n${bad.output}`);
  console.log('✅ Test 2 Passed: a leftover placeholder fails the build and names the file');

  // 3. The header version string
  const { formatAppVersion } = await import('../src/core/AppInitializer.js');
  assert.equal(formatAppVersion('3.46.0', 'abc1234'), '3.46.0 (abc1234)');
  assert.equal(formatAppVersion('', 'abc1234'), 'dev', 'an empty version shows dev');
  assert.equal(formatAppVersion('3.46.0', ''), 'dev', 'an empty build ID shows dev');
  assert.equal(formatAppVersion('__APP_VERSION__', '__BUILD_ID__'), 'dev', 'an unstamped page shows dev');
  assert.equal(formatAppVersion('3.46.0', '__BUILD_ID__'), 'dev', 'a half-stamped page shows dev');
  const mainJs = read('src/main.js');
  assert(!/\bAPP_VERSION\s*=/.test(mainJs), 'src/main.js should not declare an APP_VERSION constant');
  assert(!/['"`]v?\d+\.\d+\.\d+['"`]/.test(mainJs), 'src/main.js should hold no quoted version string');
  const srcFiles = listFiles(path.join(rootDir, 'src')).filter(f => /\.(js|css|html|json)$/.test(f));
  const withLiterals = srcFiles.filter(f => /__APP_VERSION__|__BUILD_ID__/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(withLiterals, [], 'no file under src/ should contain a literal placeholder');
  console.log('✅ Test 3 Passed: the header shows "3.46.0 (abc1234)", or "dev" when unstamped');

  // 4. No service worker is registered or published; the cleanup stays
  assert(!existsSync(path.join(rootDir, 'sw.js')), 'sw.js should be removed from the repo');
  assert(!existsSync(path.join(good.distDir, 'sw.js')), 'sw.js should not be published');
  const registering = [...srcFiles, path.join(rootDir, 'index.html')]
    .filter(f => /serviceWorker\s*\.\s*register\s*\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(registering, [], 'nothing should register a service worker');
  assert(mainJs.includes('getRegistrations') && mainJs.includes('unregister()'), 'src/main.js should still unregister old service workers');
  assert(mainJs.includes('caches.delete'), 'src/main.js should still delete old caches');
  console.log('✅ Test 4 Passed: no service worker is registered or published, and old workers are cleaned up');

  // 5. manifest.json keeps the installable PWA settings
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.display, 'standalone', 'manifest display should be standalone');
  assert.equal(manifest.start_url, './', 'manifest start_url should be ./');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'manifest should list at least four icons');
  console.log('✅ Test 5 Passed: manifest.json keeps standalone display, ./ start URL and icons');

  console.log('=== ALL PWA BUILD & VERSION STAMPING CHECKS PASSED ===');
} finally {
  for (const tempRoot of tempRoots) rmSync(tempRoot, { recursive: true, force: true });
}
