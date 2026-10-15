/**
 * scripts/build.js
 * Production build script for PlatePlan PWA.
 * Copies and packages all client assets and modules into dist/ so deployment
 * artifact upload produces valid, populated web output.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

console.log('=== BUILDING PLATEPLAN FOR PRODUCTION DEPLOYMENT ===');
console.log(`Root Directory: ${rootDir}`);
console.log(`Dist Directory: ${distDir}`);

// 1. Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Helper to recursively copy directories
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Helper to copy single file
function copyFileSync(src, dest) {
  if (fs.existsSync(src)) {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
  }
}

// 4. Copy directory trees
const directoriesToCopy = ['src', 'styles', 'vendor', 'scripts'];
for (const dir of directoriesToCopy) {
  const srcPath = path.join(rootDir, dir);
  const destPath = path.join(distDir, dir);
  if (fs.existsSync(srcPath)) {
    copyDirSync(srcPath, destPath);
    console.log(`✅ Copied directory: ${dir}/`);
  }
}

// 5. Copy individual files
const filesToCopy = [
  'PlatePlan.html',
  'manifest.json',
  'sw.js',
  'firebase-config.js',
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
  if (fs.existsSync(srcPath)) {
    copyFileSync(srcPath, destPath);
    console.log(`✅ Copied file: ${file}`);
  }
}

// 6. Generate dist/index.html from PlatePlan.html
// PlatePlan.html is the real single-page app. Copying PlatePlan.html as dist/index.html
// ensures static hosting serves the full application at / with zero redirect latency,
// while also preserving dist/PlatePlan.html for existing links and routes.
const platePlanSrc = path.join(rootDir, 'PlatePlan.html');
const distIndex = path.join(distDir, 'index.html');
if (fs.existsSync(platePlanSrc)) {
  fs.copyFileSync(platePlanSrc, distIndex);
  console.log('✅ Generated dist/index.html directly from PlatePlan.html for instant static serving');
}

// 7. Verify build artifact validity
const requiredArtifacts = [
  'index.html',
  'PlatePlan.html',
  'manifest.json',
  'sw.js',
  'firebase-config.js',
  'metadata.json',
  'src/main.js',
  'styles/tokens.css',
  'styles/components.css',
  'styles/responsive.css'
];

let missingCount = 0;
for (const artifact of requiredArtifacts) {
  const artifactPath = path.join(distDir, artifact);
  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ Missing build artifact: ${artifact}`);
    missingCount++;
  }
}

if (missingCount > 0) {
  console.error(`Build failed: ${missingCount} required artifacts missing.`);
  process.exit(1);
}

const fileCount = fs.readdirSync(distDir).length;
console.log(`=== BUILD SUCCEEDED: ${fileCount} top-level entries in dist/ ===`);
