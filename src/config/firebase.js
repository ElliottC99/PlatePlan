/**
 * src/config/firebase.js (v3.21.5)
 * Firebase configuration, safe initialization, CDN-compatible persistence, and database instance export.
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

// Ensure global firebase is loaded via CDN script tags
export const db = (typeof window !== 'undefined' && window.firebase) ? window.firebase.firestore() : null;

// Attach db to window for global access and DevTools verification
if (db) {
  window.db = db;
}

// Configure modern persistence or fallback cleanly for CDN Compat SDK
try {
  if (db && typeof window.firebase.firestore.persistentLocalCache === 'function') {
    db.settings({
      cache: window.firebase.firestore.persistentLocalCache({
        tabManager: window.firebase.firestore.persistentMultipleTabManager()
      })
    });
  } else if (db && typeof db.enablePersistence === 'function') {
    // Legacy CDN fallback with error suppression
    db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Multiple tabs open, persistence enabled in single tab');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Browser does not support persistence');
      }
    });
  }
} catch (e) {
  console.warn('[Firebase] Persistence initialization notice:', e.message);
}

if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.firestore === 'function' && typeof window.firebase.firestore.setLogLevel === 'function') {
  try {
    window.firebase.firestore.setLogLevel('error');
  } catch (e) {}
}