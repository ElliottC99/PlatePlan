/**
 * src/config/firebase.js (v3.20.15)
 * Firebase configuration, safe initialization, native multi-tab offline persistence, and database instance export.
 */

export const HOUSEHOLD_ID = 'elliott-chloe';

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBBIDYTpgjy1_HRxe3GCeMHFqit-rxod-w",
  authDomain: "plateplan-a5131.firebaseapp.com",
  projectId: "plateplan-a5131",
  storageBucket: "plateplan-a5131.firebasestorage.app",
  messagingSenderId: "504753226211",
  appId: "1:504753226211:web:8ee091c1da1f5c7023a0d6"
};

// Safe initialization guard for browser environments using Firebase CDN SDK
if (typeof window !== 'undefined' && window.firebase) {
  if (!window.firebase.apps || !window.firebase.apps.length) {
    const config = (window.PLATEPLAN_FIREBASE && window.PLATEPLAN_FIREBASE.config) || FIREBASE_CONFIG;
    window.firebase.initializeApp(config);
  }
}

export const db = (typeof window !== 'undefined' && window.firebase && typeof window.firebase.firestore === 'function')
  ? window.firebase.firestore()
  : null;

if (db && typeof db.settings === 'function') {
  try {
    db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
  } catch (e) {
    // Settings may already be configured
  }
}

// Enable native Firebase offline persistence with multi-tab synchronization
if (db && typeof db.enablePersistence === 'function') {
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      db.enablePersistence().catch(() => {});
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Native offline persistence is unimplemented in this browser.');
    }
  });
}

if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.firestore === 'function' && typeof window.firebase.firestore.setLogLevel === 'function') {
  try {
    window.firebase.firestore.setLogLevel('error');
  } catch (e) {}
}
