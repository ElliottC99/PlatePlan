// scripts/backup-db.js
// Extracts all documents and subcollections under households/elliott-chloe to households_elliott-chloe_backup.json

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIREBASE_CONFIG, HOUSEHOLD_ID } from '../src/config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, `households_${HOUSEHOLD_ID}_backup.json`);

const KNOWN_SUBCOLLECTIONS = [
  'ingredients',
  'inventory',
  'metadata',
  'plan_history',
  'plans',
  'products',
  'recipes',
  'settings',
  'shoppingLists',
  'rootItems',
  'subtypes',
  'categories',
  'pantry',
  'shopping'
];

const BASE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

/**
 * Unwraps a Firestore REST API typed value into a native JS value.
 */
function unwrapFirestoreValue(valObj) {
  if (!valObj || typeof valObj !== 'object') return valObj;
  if ('nullValue' in valObj) return null;
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('referenceValue' in valObj) return valObj.referenceValue;
  if ('bytesValue' in valObj) return valObj.bytesValue;
  if ('geoPointValue' in valObj) return valObj.geoPointValue;
  if ('arrayValue' in valObj) {
    const values = valObj.arrayValue?.values || [];
    return values.map(unwrapFirestoreValue);
  }
  if ('mapValue' in valObj) {
    const fields = valObj.mapValue?.fields || {};
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = unwrapFirestoreValue(v);
    }
    return out;
  }
  return valObj;
}

/**
 * Unwraps a Firestore REST document resource into a clean record.
 */
function unwrapFirestoreDoc(doc) {
  const docId = doc.name ? doc.name.split('/').pop() : undefined;
  const fields = doc.fields || {};
  const data = {};
  for (const [k, v] of Object.entries(fields)) {
    data[k] = unwrapFirestoreValue(v);
  }
  return {
    id: docId,
    createTime: doc.createTime || null,
    updateTime: doc.updateTime || null,
    data
  };
}

/**
 * Attempt to obtain an anonymous Firebase Auth ID token if allowed by project settings.
 */
async function tryGetAnonymousIdToken() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[Backup] Anonymous auth not used (${res.status}): ${errText.slice(0, 160)}`);
    return null;
  }
  const payload = await res.json();
  return payload.idToken || null;
}

function buildHeaders(idToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

/**
 * Discover subcollection IDs dynamically via :listCollectionIds if supported.
 */
async function discoverSubcollections(docRelativePath, idToken) {
  const url = `${BASE_DOC_URL}/${docRelativePath}:listCollectionIds?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(idToken),
    body: JSON.stringify({ pageSize: 100 })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn(`[Backup] listCollectionIds returned ${res.status} on ${docRelativePath}: ${errText.slice(0, 160)}`);
    return [];
  }
  const payload = await res.json();
  return Array.isArray(payload.collectionIds) ? payload.collectionIds : [];
}

/**
 * Fetch a single Firestore document by relative path.
 */
async function fetchDocument(docRelativePath, idToken) {
  const url = `${BASE_DOC_URL}/${docRelativePath}?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}`;
  const res = await fetch(url, { headers: buildHeaders(idToken) });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch document ${docRelativePath} (${res.status}): ${errText}`);
  }
  const rawDoc = await res.json();
  return unwrapFirestoreDoc(rawDoc);
}

/**
 * Fetch all documents in a collection, following nextPageToken pagination.
 */
async function fetchCollection(collectionRelativePath, idToken) {
  const docs = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      key: FIREBASE_CONFIG.apiKey,
      pageSize: '300'
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `${BASE_DOC_URL}/${collectionRelativePath}?${params.toString()}`;
    const res = await fetch(url, { headers: buildHeaders(idToken) });
    if (res.status === 404) {
      return [];
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch collection ${collectionRelativePath} (${res.status}): ${errText}`);
    }

    const payload = await res.json();
    if (Array.isArray(payload.documents)) {
      for (const rawDoc of payload.documents) {
        docs.push(unwrapFirestoreDoc(rawDoc));
      }
    }
    pageToken = payload.nextPageToken || null;
  } while (pageToken);

  return docs;
}

async function runBackup() {
  const householdDocPath = `households/${HOUSEHOLD_ID}`;
  console.log(`[Backup] Connecting to Firestore project "${FIREBASE_CONFIG.projectId}" for "${householdDocPath}"...`);

  const cliTokenIdx = process.argv.indexOf('--token');
  const cliToken = cliTokenIdx !== -1 ? process.argv[cliTokenIdx + 1] : null;
  let idToken = cliToken || process.env.FIREBASE_ID_TOKEN || await tryGetAnonymousIdToken();


  // Fetch root household document (retry without token if anonymous token was rejected by rules)
  let rootDoc;
  try {
    rootDoc = await fetchDocument(householdDocPath, idToken);
  } catch (err) {
    if (idToken) {
      console.warn(`[Backup] Retrying unauthenticated after token error: ${err.message}`);
      idToken = null;
      rootDoc = await fetchDocument(householdDocPath, null);
    } else {
      throw err;
    }
  }

  // Merge dynamically discovered subcollections with all known codebase subcollections
  const discovered = await discoverSubcollections(householdDocPath, idToken);
  const allSubcollectionNames = Array.from(new Set([...discovered, ...KNOWN_SUBCOLLECTIONS])).sort();

  console.log(`[Backup] Checking ${allSubcollectionNames.length} subcollections: ${allSubcollectionNames.join(', ')}`);

  const subcollections = {};
  const summary = {};

  for (const subName of allSubcollectionNames) {
    const colPath = `${householdDocPath}/${subName}`;
    const docs = await fetchCollection(colPath, idToken);
    if (docs.length > 0 || discovered.includes(subName)) {
      const docMap = {};
      for (const d of docs) {
        docMap[d.id] = d;
      }
      subcollections[subName] = docMap;
      summary[subName] = docs.length;
      console.log(`[Backup]   - ${subName}: ${docs.length} document(s)`);
    }
  }

  const backupPayload = {
    meta: {
      exportedAt: new Date().toISOString(),
      projectId: FIREBASE_CONFIG.projectId,
      householdId: HOUSEHOLD_ID,
      documentPath: householdDocPath,
      collectionCounts: summary
    },
    householdDocument: rootDoc,
    subcollections
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(backupPayload, null, 2), 'utf8');
  console.log(`[Backup] Successfully wrote backup to ${OUTPUT_FILE}`);
}

runBackup().catch((err) => {
  console.error('[Backup] FATAL ERROR:', err);
  process.exit(1);
});
