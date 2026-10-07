// src/config/firebase.js

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

// Initialize Firestore from CDN global
export const db = (typeof window !== 'undefined' && window.firebase) ? window.firebase.firestore() : null;

// Expose window.db for global/DevTools access
if (db) {
  window.db = db;
}

// Modern Firebase v10 CDN Persistence Setup (No deprecated method calls)
try {
  if (db && typeof window.firebase.firestore.persistentLocalCache === 'function') {
    db.settings({
      localCache: window.firebase.firestore.persistentLocalCache({
        tabManager: window.firebase.firestore.persistentMultipleTabManager()
      })
    });
  }
} catch (err) {
  // Gracefully handle if settings were already configured during hot-reloads
  console.debug('[Firebase] Cache settings already initialized or deferred:', err.message);
}
