/**
 * scripts/test_firestore_rules.js
 * Checks firestore.rules in the Firestore emulator: the three household
 * UIDs can read and write households/elliott-chloe and everything under it,
 * and everything else is refused (other accounts, signed-out users, other
 * households, top-level paths).
 *
 * Run it through the emulator, never against the real project:
 *   npm run test:rules
 * That starts the emulator under the offline demo-plateplan project, runs
 * this script, and shuts the emulator down. `npm run deploy:rules` runs it
 * first and refuses to deploy if it fails.
 *
 * The UIDs below repeat the ones in firestore.rules on purpose, so a change
 * to who has access fails this test until the test is changed too.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOUSEHOLD_UIDS = {
  Elliott: 'mXtYrVi2w5XEZksdCO2jw6tJ1U42',
  Chloe: '6wwrdUemBBPTIV4Am82NEPNs9Rp2',
  Barrie: 'VGcmLZJBhTN6oTxnNWY1USidYsh1'
};
const OUTSIDER_UID = 'someone-else-entirely';

console.log('=== RUNNING FIRESTORE RULES VERIFICATION SUITE ===\n');

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-plateplan',
  firestore: { rules: fs.readFileSync(path.join(REPO_ROOT, 'firestore.rules'), 'utf8') }
});

let testFailures = 0;

async function check(name, expectAllowed, operation) {
  try {
    await (expectAllowed ? assertSucceeds(operation()) : assertFails(operation()));
    console.log(`✅ ${name}`);
  } catch (err) {
    testFailures++;
    console.error(`❌ ${name}\n   ${err.message}`);
  }
}

const asUser = (uid) => testEnv.authenticatedContext(uid).firestore();
const signedOut = () => testEnv.unauthenticatedContext().firestore();
const read = (db, p) => () => getDoc(doc(db, p));
const write = (db, p) => () => setDoc(doc(db, p), { checkedBy: 'test_firestore_rules' });

// Household members: allowed everywhere under the household.
const chloe = asUser(HOUSEHOLD_UIDS.Chloe);
await check('Chloe reads a recipe', true, read(chloe, 'households/elliott-chloe/recipes/r1'));
await check('Chloe writes a recipe', true, write(chloe, 'households/elliott-chloe/recipes/r1'));
for (const name of ['Elliott', 'Barrie']) {
  const db = asUser(HOUSEHOLD_UIDS[name]);
  await check(`${name} reads the current plan`, true, read(db, 'households/elliott-chloe/plans/current'));
  await check(`${name} writes the current plan`, true, write(db, 'households/elliott-chloe/plans/current'));
}
const elliott = asUser(HOUSEHOLD_UIDS.Elliott);
await check('Elliott reads the household document itself', true, read(elliott, 'households/elliott-chloe'));
await check('Elliott writes the household document itself', true, write(elliott, 'households/elliott-chloe'));
await check('Elliott writes settings/preferences', true, write(elliott, 'households/elliott-chloe/settings/preferences'));

// Another signed-in account: refused.
const outsider = asUser(OUTSIDER_UID);
await check('Unlisted account reads the current plan', false, read(outsider, 'households/elliott-chloe/plans/current'));
await check('Unlisted account writes the current plan', false, write(outsider, 'households/elliott-chloe/plans/current'));

// Signed out: refused.
const anon = signedOut();
await check('Signed-out reads a recipe', false, read(anon, 'households/elliott-chloe/recipes/r1'));
await check('Signed-out reads the household document', false, read(anon, 'households/elliott-chloe'));

// Household members outside the household path: refused.
await check('Elliott writes another household', false, write(elliott, 'households/other-house/data/x'));
await check('Elliott writes a top-level collection', false, write(elliott, 'settings/x'));
await check('Elliott reads another household document', false, read(elliott, 'households/other-house'));

await testEnv.cleanup();

console.log(`\n=== ${testFailures === 0 ? 'ALL RULES CHECKS PASSED' : `${testFailures} RULES CHECK(S) FAILED`} ===`);
process.exit(testFailures === 0 ? 0 : 1);
