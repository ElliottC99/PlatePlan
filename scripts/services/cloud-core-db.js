/**
 * scripts/services/cloud-core-db.js
 * Household-scoped Firestore database initialization and collection reference builders.
 */
(function() {
  'use strict';

  window.PlatePlanCloud = window.PlatePlanCloud || {};

  // 1. Hardcoded Firebase Configuration Fallback
  const firebaseConfig = (typeof window !== 'undefined' && window.PLATEPLAN_FIREBASE?.config) || {
    apiKey: "AIzaSyBBIDYTpgjy1_HRxe3GCeMHFqit-rxod-w",
    authDomain: "plateplan-a5131.firebaseapp.com",
    projectId: "plateplan-a5131",
    storageBucket: "plateplan-a5131.firebasestorage.app",
    messagingSenderId: "504753226211",
    appId: "1:504753226211:web:8ee091c1da1f5c7023a0d6"
  };

  // 2. Strict Sequential Initialization
  let db = null;
  if (typeof window !== 'undefined' && window.firebase) {
    if (!window.firebase.apps.length) {
      try {
        window.firebase.initializeApp(firebaseConfig);
        console.log("[FIREBASE] App initialized successfully with household config.");
      } catch (err) {
        console.warn("[FIREBASE] Initialization warning:", err);
      }
    }
    
    if (window.firebase.apps.length && typeof window.firebase.firestore === 'function') {
      try {
        db = window.firebase.firestore();
        db.enablePersistence({ synchronizeTabs: true })
          .then(() => console.log("[FIRESTORE] Offline persistence active with tab synchronization."))
          .catch((err) => console.warn("[FIRESTORE] Persistence warning:", err.code || err));
      } catch (err) {
        console.warn("[FIRESTORE] Setup warning:", err);
      }
    }
  }

  const getDb = () => {
    if (!db && typeof window !== 'undefined' && window.firebase) {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      if (window.firebase.apps.length && typeof window.firebase.firestore === 'function') {
        db = window.firebase.firestore();
      }
    }
    return db;
  };

  window.PlatePlanCloud.getDb = getDb;

  // 3. Fixed Household Collection References (Elliotti & Chloe Household)
  window.PlatePlanCloud.Refs = {
    getPlanDoc: () => getDb()?.collection('households').doc('elliott-chloe').collection('plans').doc('current'),
    getSettingsDoc: () => getDb()?.collection('households').doc('elliott-chloe').collection('settings').doc('preferences'),
    getRecipesColl: () => getDb()?.collection('households').doc('elliott-chloe').collection('recipes'),
    getIngredientsColl: () => getDb()?.collection('households').doc('elliott-chloe').collection('ingredients')
  };
})();
