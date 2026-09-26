/**
 * scripts/services/cloud-core-db.js
 * Shared Household Firebase Firestore initialization and reference builders.
 */
(function() {
  'use strict';

  // 1. Hardcoded Fallback Firebase Configuration
  const firebaseConfig = (typeof window !== 'undefined' && window.PLATEPLAN_FIREBASE?.config) || {
    apiKey: "AIzaSyBBIDYTpgjy1_HRxe3GCeMHFqit-rxod-w",
    authDomain: "plateplan-a5131.firebaseapp.com",
    projectId: "plateplan-a5131",
    storageBucket: "plateplan-a5131.firebasestorage.app",
    messagingSenderId: "504753226211",
    appId: "1:504753226211:web:8ee091c1da1f5c7023a0d6"
  };

  // 2. Ensure Firebase App is Initialized BEFORE Firestore or Persistence
  window.ensureFirebaseAppInitialized = function() {
    if (typeof window === 'undefined' || !window.firebase) return null;
    if (!window.firebase.apps.length) {
      try {
        const app = window.firebase.initializeApp(firebaseConfig);
        console.log("[FIREBASE] Initialized successfully with household config.");
        return app;
      } catch (err) {
        console.warn('[FIREBASE] initializeApp warning:', err);
      }
    }
    return window.firebase.apps.length ? window.firebase.app() : null;
  };

  // 3. Initialize Firebase App & Setup Firestore Persistence
  let db = null;
  if (typeof window !== 'undefined' && window.firebase) {
    window.ensureFirebaseAppInitialized();
    if (window.firebase.apps.length && typeof window.firebase.firestore === 'function') {
      try {
        db = window.firebase.firestore();
        db.enablePersistence({ synchronizeTabs: true })
          .then(() => console.log("[FIRESTORE] Offline persistence active with tab synchronization."))
          .catch((err) => console.warn("[FIRESTORE] Persistence warning:", err.code || err));
      } catch (err) {
        console.warn("[FIRESTORE] Setup error:", err);
      }
    }
  }

  const getDb = () => {
    if (!db) {
      window.ensureFirebaseAppInitialized();
      if (window.firebase?.apps?.length && typeof window.firebase.firestore === 'function') {
        db = window.firebase.firestore();
      }
    }
    return db || null;
  };

  // 4. Export globally with the required Refs structure targeting the shared Household path
  const HOUSEHOLD_ID = (typeof window !== 'undefined' && window.PLATEPLAN_FIREBASE?.householdId) || 'elliott-chloe';

  window.PlatePlanCloud = window.PlatePlanCloud || {};
  window.PlatePlanCloud.getDb = getDb;

  window.PlatePlanCloud.Refs = {
    getPlanDoc: () => getDb()?.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current'),
    getRecipesColl: () => getDb()?.collection('households').doc(HOUSEHOLD_ID).collection('recipes'),
    getIngredientsColl: () => getDb()?.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'),
    getSettingsDoc: () => getDb()?.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences'),
    getAuditColl: () => getDb()?.collection('households').doc(HOUSEHOLD_ID).collection('audit')
  };

  // Top-level helper bindings for direct access
  window.PlatePlanCloud.getPlanDoc = window.PlatePlanCloud.Refs.getPlanDoc;
  window.PlatePlanCloud.getRecipesColl = window.PlatePlanCloud.Refs.getRecipesColl;
  window.PlatePlanCloud.getIngredientsColl = window.PlatePlanCloud.Refs.getIngredientsColl;
  window.PlatePlanCloud.getSettingsDoc = window.PlatePlanCloud.Refs.getSettingsDoc;
})();