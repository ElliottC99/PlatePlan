/**
 * scripts/test_firestore_rules.js
 * Checks firestore.rules in the Firestore emulator: the three household
 * UIDs can get, list, create, update and delete everything under
 * households/elliott-chloe, and everyone else is refused every one of those
 * operations there and everywhere else (other households, top-level paths).
 *
 * Run it through the emulator, never against the real project:
 *   npm run test:rules
 * That starts the emulator under the offline demo-plateplan project, runs
 * this script, and shuts the emulator down. `npm run deploy:rules` runs it
 * first and refuses to deploy if it fails.
 *
 * The UIDs below repeat the ones in firestore.rules on purpose, and the
 * first check compares the two lists, so adding or removing anyone fails
 * this test until the test is changed too. The second check does the same
 * for match blocks: a new one fails until the test is changed to cover it.
 *
 * HOUSEHOLD_COLLECTIONS lists every subcollection the app uses or the
 * 2026-10-28 backup holds, plus one made-up name. Add new collections here.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOUSEHOLD = 'households/elliott-chloe';
const HOUSEHOLD_UIDS = {
  Elliott: 'mXtYrVi2w5XEZksdCO2jw6tJ1U42',
  Chloe: '6wwrdUemBBPTIV4Am82NEPNs9Rp2',
  Barrie: 'VGcmLZJBhTN6oTxnNWY1USidYsh1'
};
const HOUSEHOLD_COLLECTIONS = [
  'data', 'ingredientFamilies', 'ingredientGroups', 'ingredients', 'inventory',
  'members', 'metadata', 'operations', 'overrides', 'plan_history', 'plans',
  'products', 'recipes', 'settings', 'shoppingLists', 'not-a-real-collection'
];
const OUTSIDER_UID = 'someone-else-entirely';

console.log('=== RUNNING FIRESTORE RULES VERIFICATION SUITE ===\n');

const rulesText = fs.readFileSync(path.join(REPO_ROOT, 'firestore.rules'), 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-plateplan',
  firestore: { rules: rulesText }
});

let testFailures = 0;
let testCount = 0;

function fail(name, message) {
  testFailures++;
  console.error(`❌ ${name}\n   ${message}`);
}

async function check(name, expectAllowed, operation) {
  testCount++;
  try {
    await (expectAllowed ? assertSucceeds(operation()) : assertFails(operation()));
  } catch (err) {
    fail(name, err.message);
  }
}

// The allowlist in the rules must be exactly the household, no more, no less.
testCount++;
const allowlist = rulesText.match(/request\.auth\.uid in \[([^\]]*)\]/);
const listedUids = allowlist ? [...allowlist[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort() : [];
const expectedUids = Object.values(HOUSEHOLD_UIDS).sort();
if (JSON.stringify(listedUids) !== JSON.stringify(expectedUids)) {
  fail('Rules allowlist is exactly the household UIDs',
    `rules list ${JSON.stringify(listedUids)}, expected ${JSON.stringify(expectedUids)}`);
}

// The only match blocks are the documents root and the household. Any other
// match, even on a made-up path no check below could guess, fails here.
testCount++;
const matchPaths = [...rulesText.matchAll(/^\s*match\s+(\S+)\s*\{/gm)].map((m) => m[1]);
const expectedMatches = ['/databases/{database}/documents', '/households/elliott-chloe/{document=**}'];
if (JSON.stringify(matchPaths) !== JSON.stringify(expectedMatches)) {
  fail('Rules contain only the household match',
    `rules match ${JSON.stringify(matchPaths)}, expected ${JSON.stringify(expectedMatches)}`);
}

// Seed documents with rules off, so update and delete checks hit real documents.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, HOUSEHOLD), { seeded: true });
  for (const c of HOUSEHOLD_COLLECTIONS) {
    for (const id of ['for-member', 'for-outsider', 'for-signed-out']) {
      await setDoc(doc(db, `${HOUSEHOLD}/${c}/${id}`), { seeded: true });
    }
  }
  await setDoc(doc(db, 'households/other-house'), { seeded: true });
  await setDoc(doc(db, 'settings/x'), { seeded: true });
});

const contexts = {
  member: { label: 'Chloe', db: testEnv.authenticatedContext(HOUSEHOLD_UIDS.Chloe).firestore(), allowed: true },
  outsider: { label: 'Unlisted account', db: testEnv.authenticatedContext(OUTSIDER_UID).firestore(), allowed: false },
  'signed-out': { label: 'Signed-out user', db: testEnv.unauthenticatedContext().firestore(), allowed: false }
};
const payload = { checkedBy: 'test_firestore_rules' };

// Every operation on every household collection: allowed for a member, refused for everyone else.
for (const [key, { label, db, allowed }] of Object.entries(contexts)) {
  for (const c of HOUSEHOLD_COLLECTIONS) {
    const existing = `${HOUSEHOLD}/${c}/for-${key}`;
    await check(`${label} gets ${c}`, allowed, () => getDoc(doc(db, existing)));
    await check(`${label} lists ${c}`, allowed, () => getDocs(collection(db, `${HOUSEHOLD}/${c}`)));
    await check(`${label} creates in ${c}`, allowed, () => setDoc(doc(db, `${HOUSEHOLD}/${c}/new-by-${key}`), payload));
    await check(`${label} updates in ${c}`, allowed, () => setDoc(doc(db, existing), payload));
    await check(`${label} deletes in ${c}`, allowed, () => deleteDoc(doc(db, existing)));
  }
  await check(`${label} gets the household document`, allowed, () => getDoc(doc(db, HOUSEHOLD)));
  await check(`${label} writes the household document`, allowed, () => setDoc(doc(db, HOUSEHOLD), payload));
}

// The other two household members can read and write too.
for (const name of ['Elliott', 'Barrie']) {
  const db = testEnv.authenticatedContext(HOUSEHOLD_UIDS[name]).firestore();
  await check(`${name} reads the current plan`, true, () => getDoc(doc(db, `${HOUSEHOLD}/plans/current`)));
  await check(`${name} writes the current plan`, true, () => setDoc(doc(db, `${HOUSEHOLD}/plans/current`), payload));
}

// Nobody, household included, can touch anything outside the household.
for (const { label, db } of Object.values(contexts)) {
  await check(`${label} lists all households`, false, () => getDocs(collection(db, 'households')));
  await check(`${label} reads another household`, false, () => getDoc(doc(db, 'households/other-house')));
  await check(`${label} writes another household`, false, () => setDoc(doc(db, 'households/other-house/data/x'), payload));
  await check(`${label} reads a top-level collection`, false, () => getDoc(doc(db, 'settings/x')));
  await check(`${label} writes a top-level collection`, false, () => setDoc(doc(db, 'settings/x'), payload));
}

await testEnv.cleanup();

console.log(testFailures === 0
  ? `=== ALL ${testCount} RULES CHECKS PASSED ===`
  : `\n=== ${testFailures} OF ${testCount} RULES CHECK(S) FAILED ===`);
process.exit(testFailures === 0 ? 0 : 1);
