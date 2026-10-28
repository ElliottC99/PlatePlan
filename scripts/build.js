/**
 * scripts/build.js
 * Production build script for PlatePlan PWA.
 * Copies and packages all client assets and modules into dist/ so deployment
 * artifact upload produces valid, populated web output.
 */

import fs from 'fs/promises';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const APP_VERSION_PLACEHOLDER = '__APP_VERSION__';
const BUILD_ID_PLACEHOLDER = '__BUILD_ID__';

async function build() {
  console.log('=== BUILDING PLATEPLAN FOR PRODUCTION DEPLOYMENT ===');
  console.log(`Root Directory: ${rootDir}`);
  console.log(`Dist Directory: ${distDir}`);

  // 1. Clean and create dist directory
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
  }
  mkdirSync(distDir, { recursive: true });

  // 2. Copy directory trees using fs.promises.cp
  const directoriesToCopy = ['src', 'styles', 'vendor', 'scripts'];
  for (const dir of directoriesToCopy) {
    const srcPath = path.join(rootDir, dir);
    const destPath = path.join(distDir, dir);
    if (existsSync(srcPath)) {
      await fs.cp(srcPath, destPath, { recursive: true });
      console.log(`✅ Copied directory: ${dir}/`);
    }
  }

  // 3. Copy individual files
  const filesToCopy = [
    'index.html',
    'manifest.json',
    'metadata.json',
    'icon-192.png',
    'icon-192-maskable.png',
    'icon-512.png',
    'icon-512-maskable.png',
    'server.js',
    'package.json'
  ];

  for (const file of filesToCopy) {
    const srcPath = path.join(rootDir, file);
    const destPath = path.join(distDir, file);
    if (existsSync(srcPath)) {
      await fs.copyFile(srcPath, destPath);
      console.log(`✅ Copied file: ${file}`);
    }
  }

  // 4. Ensure dist/index.html exists
  const indexSrc = path.join(rootDir, 'index.html');
  const distIndex = path.join(distDir, 'index.html');
  if (existsSync(indexSrc) && !existsSync(distIndex)) {
    await fs.copyFile(indexSrc, distIndex);
    console.log('✅ Generated dist/index.html from index.html');
  }

  // 4b. Stamp __APP_VERSION__ and __BUILD_ID__ into dist/index.html
  const pkgRaw = await fs.readFile(path.join(rootDir, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const appVersion = pkg.version;
  let gitHash = 'unknown';
  try {
    gitHash = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (err) {
    console.warn('⚠️ Failed to resolve git commit hash, falling back to "unknown":', err.message);
  }

  const stampedIndex = (await fs.readFile(distIndex, 'utf8'))
    .replaceAll(APP_VERSION_PLACEHOLDER, appVersion)
    .replaceAll(BUILD_ID_PLACEHOLDER, gitHash);
  await fs.writeFile(distIndex, stampedIndex, 'utf8');
  console.log(`✅ Stamped index.html (${APP_VERSION_PLACEHOLDER}=${appVersion}, ${BUILD_ID_PLACEHOLDER}=${gitHash})`);

  // 5. Verify build artifact validity
  const requiredArtifacts = [
    'index.html',
    'manifest.json',
    'src/config/firebase-config.js',
    'metadata.json',
    'src/main.js',
    'styles/tokens.css',
    'styles/components.css',
    'styles/responsive.css'
  ];

  let missingCount = 0;
  for (const artifact of requiredArtifacts) {
    const artifactPath = path.join(distDir, artifact);
    if (!existsSync(artifactPath)) {
      console.error(`❌ Missing build artifact: ${artifact}`);
      missingCount++;
    }
  }

  if (missingCount > 0) {
    console.error(`Build failed: ${missingCount} required artifacts missing.`);
    process.exit(1);
  }

  // 6. Refuse to publish a page that still holds a version placeholder.
  // dist/scripts/ is build and test tooling that names the placeholders on purpose.
  const leftovers = await findLeftoverPlaceholders(distDir, path.join(distDir, 'scripts'));
  if (leftovers.length > 0) {
    for (const file of leftovers) {
      console.error(`❌ Unstamped version placeholder in: ${path.relative(distDir, file)}`);
    }
    console.error(`Build failed: ${leftovers.length} published file(s) still hold ${APP_VERSION_PLACEHOLDER} or ${BUILD_ID_PLACEHOLDER}.`);
    process.exit(1);
  }

  const fileCount = (await fs.readdir(distDir)).length;
  console.log(`=== BUILD SUCCEEDED: ${fileCount} top-level entries in dist/ ===`);
}

async function findLeftoverPlaceholders(dir, excludedDir) {
  const leftovers = [];
  for (const entry of await fs.readdir(dir, { recursive: true, withFileTypes: true })) {
    const entryPath = path.join(entry.parentPath, entry.name);
    if (!entry.isFile() || entryPath.startsWith(excludedDir + path.sep)) continue;
    if (!/\.(html|js|mjs|css|json|webmanifest|txt|md)$/.test(entry.name)) continue;
    const content = await fs.readFile(entryPath, 'utf8');
    if (content.includes(APP_VERSION_PLACEHOLDER) || content.includes(BUILD_ID_PLACEHOLDER)) leftovers.push(entryPath);
  }
  return leftovers;
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
