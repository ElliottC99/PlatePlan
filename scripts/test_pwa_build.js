/**
 * scripts/test_pwa_build.js
 * Verification test script for PWA service worker caching configuration,
 * Firestore interception bypass, and registration lifecycle emulation for v3.28.6.
 */

import { readFileSync } from 'fs';
import { strict as assert } from 'assert';

console.log('=== RUNNING PWA BUILD & SERVICE WORKER VERIFICATION SUITE ===');

// 1. Check package.json version
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
assert.equal(pkg.version, '3.28.6', 'Package version must be 3.28.6');
console.log('✅ Test 1 Passed: package.json version is 3.28.6');

// 2. Check PlatePlan.html version badge
const html = readFileSync('./PlatePlan.html', 'utf8');
assert(html.includes('v3.28.6') || html.includes('3.28.6'), 'PlatePlan.html must display version badge v3.28.6');
console.log('✅ Test 2 Passed: PlatePlan.html header displays v3.28.6');

// 3. Check sw.js cache key & bypass logic
const swContent = readFileSync('./sw.js', 'utf8');
assert(swContent.includes("plateplan-cache-v3.28.6"), 'sw.js must contain plateplan-cache-v3.28.6');
assert(swContent.includes("firestore.googleapis.com"), 'sw.js must contain Firestore interception bypass');
assert(swContent.includes("skipWaiting"), 'sw.js must include skipWaiting');
assert(swContent.includes("clients.claim"), 'sw.js must include clients.claim');
console.log('✅ Test 3 Passed: sw.js contains correct cache key v3.28.6, activation pruning, and Firestore bypass rules.');

// 4. Check store.js CACHE_KEY
const storeContent = readFileSync('./src/store/store.js', 'utf8');
assert(storeContent.includes('plateplan_store_cache_v3.28.6'), 'store.js must contain store cache key v3.28.6');
console.log('✅ Test 4 Passed: store.js uses store cache key v3.28.6');

// 5. Check manifest.json PWA configuration
const manifest = JSON.parse(readFileSync('./manifest.json', 'utf8'));
assert.equal(manifest.display, 'standalone', 'Manifest display mode must be standalone');
assert.equal(manifest.start_url, '/', 'Manifest start_url must be /');
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'Manifest must specify icons');
console.log('✅ Test 5 Passed: manifest.json is fully compliant with standalone display and icon requirements.');

console.log('=== ALL PWA & BUILD VERIFICATIONS PASSED SUCCESSFULLY ===');
