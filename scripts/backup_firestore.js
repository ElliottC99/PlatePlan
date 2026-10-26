/**
 * scripts/backup_firestore.js
 * Full backup of the PlatePlan Firestore database to a dated JSON file.
 *
 * Runs locally with the Firebase Admin SDK, which works on the free Spark
 * plan and bypasses security rules, so it works before and after the rules
 * are tightened. It walks every collection and subcollection from the root,
 * including documents that only exist as parents of subcollections.
 *
 * Firestore types (Timestamp, GeoPoint, DocumentReference, Bytes) are tagged
 * so a later restore can rebuild them exactly.
 *
 * Usage:
 *   npm install --no-save firebase-admin
 *   node scripts/backup_firestore.js --key ~/.config/plateplan/service-account.json
 *   node scripts/backup_firestore.js --key <path> --out ~/PlatePlan-backups
 *
 * The key can also come from GOOGLE_APPLICATION_CREDENTIALS.
 * NEVER put the service account key or a backup inside this repo: it is public.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const READ_BATCH_SIZE = 300;
const DEFAULT_OUT_DIR = path.join(os.homedir(), 'PlatePlan-backups');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--key') args.key = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function expandHome(p) {
  return p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

function isInsideRepo(p) {
  const rel = path.relative(REPO_ROOT, path.resolve(p));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Converts Firestore values into JSON, tagging the types JSON can't hold. */
export function encodeValue(value, admin) {
  const { Timestamp, GeoPoint, DocumentReference } = admin;
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) {
    return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof DocumentReference) {
    return { __type: 'reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __type: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { __type: 'number', value: String(value) };
  }
  if (Array.isArray(value)) return value.map((v) => encodeValue(v, admin));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = encodeValue(v, admin);
    return out;
  }
  return value;
}

export async function backupCollection(db, collectionRef, admin, stats) {
  const docRefs = await collectionRef.listDocuments();
  const result = {};

  for (let i = 0; i < docRefs.length; i += READ_BATCH_SIZE) {
    const batch = docRefs.slice(i, i + READ_BATCH_SIZE);
    const snaps = await db.getAll(...batch);

    for (const snap of snaps) {
      const entry = {};
      if (snap.exists) {
        entry.data = encodeValue(snap.data(), admin);
        stats.documents++;
      }
      const subcollections = await snap.ref.listCollections();
      if (subcollections.length) {
        entry.collections = {};
        for (const sub of subcollections) {
          entry.collections[sub.id] = await backupCollection(db, sub, admin, stats);
        }
      }
      result[snap.id] = entry;
    }
  }

  stats.byCollection[collectionRef.path] = docRefs.length;
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/backup_firestore.js --key <service-account.json> [--out <dir>]');
    return;
  }

  const keyPath = expandHome(args.key || process.env.GOOGLE_APPLICATION_CREDENTIALS);
  if (!keyPath) throw new Error('No service account key. Pass --key <path> or set GOOGLE_APPLICATION_CREDENTIALS.');
  if (!fs.existsSync(keyPath)) throw new Error(`Service account key not found: ${keyPath}`);
  if (isInsideRepo(keyPath)) {
    throw new Error('The service account key is inside the repo folder. Move it outside the repo first (the repo is public).');
  }

  const outDir = expandHome(args.out || DEFAULT_OUT_DIR);
  if (isInsideRepo(outDir)) {
    throw new Error('The backup folder is inside the repo folder. Choose one outside the repo (the repo is public).');
  }

  let appModule, firestoreModule;
  try {
    appModule = await import('firebase-admin/app');
    firestoreModule = await import('firebase-admin/firestore');
  } catch {
    throw new Error('firebase-admin is not installed. Run: npm install --no-save firebase-admin');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  appModule.initializeApp({ credential: appModule.cert(serviceAccount) });
  const db = firestoreModule.getFirestore();

  console.log(`Backing up project ${serviceAccount.project_id}...`);
  const stats = { documents: 0, byCollection: {} };
  const collections = {};
  for (const col of await db.listCollections()) {
    collections[col.id] = await backupCollection(db, col, firestoreModule, stats);
  }

  const startedAt = new Date();
  const backup = {
    format: 'plateplan-firestore-backup/1',
    projectId: serviceAccount.project_id,
    createdAt: startedAt.toISOString(),
    stats,
    collections,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `plateplan-backup-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), { mode: 0o600 });

  console.log('\nDocuments per collection:');
  for (const [p, n] of Object.entries(stats.byCollection).sort()) console.log(`  ${p}: ${n}`);
  console.log(`\nTotal documents with data: ${stats.documents}`);
  console.log(`Saved: ${outFile}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`Backup failed: ${err.message}`);
    process.exit(1);
  });
}
