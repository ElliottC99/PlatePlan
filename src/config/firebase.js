/**
 * src/config/firebase.js
 * Firebase configuration, safe initialization, and database instance export.
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

  // Enable Firestore offline persistence if available
  if (typeof window.firebase.firestore === 'function') {
    window.firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Multiple tabs open; persistence active in primary tab only.');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Current browser environment does not support offline persistence.');
      }
    });
  }
}

export const db = (typeof window !== 'undefined' && window.firebase && typeof window.firebase.firestore === 'function')
  ? window.firebase.firestore()
  : null;
