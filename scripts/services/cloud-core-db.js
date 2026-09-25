/**
 * scripts/services/cloud-core-db.js
 * Firestore database reference builders and batch payload formatting.
 */
(function() {
  'use strict';
  window.PlatePlanCloud = window.PlatePlanCloud || {};
  
  // Enable IndexedDB offline persistence BEFORE executing any pulls
  window.enableFirestoreOfflinePersistence = function() {
    if (window.firebase && typeof window.firebase.firestore === 'function') {
      try {
        window.firebase.firestore().enablePersistence({ synchronizeTabs: true })
          .then(() => console.log('[Firestore] Offline persistence enabled with tab synchronization.'))
          .catch(err => console.warn('[Firestore] Persistence error:', err.code || err));
      } catch (err) {
        console.warn('[Firestore] Persistence error:', err);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.enableFirestoreOfflinePersistence();
  }

  const getDb = () => window.PlatePlanCloud.State?.authContext?.db || (window.firebase?.firestore ? window.firebase.firestore() : null);
  const getUid = () => window.PlatePlanCloud.State?.user?.uid;

  window.PlatePlanCloud.Refs = {
    getPlanDoc: () => getDb()?.collection('users').doc(getUid()).collection('plans').doc('current'),
    getRecipesColl: () => getDb()?.collection('users').doc(getUid()).collection('recipes'),
    getIngredientsColl: () => getDb()?.collection('users').doc(getUid()).collection('ingredients'),
    getSettingsDoc: () => getDb()?.collection('users').doc(getUid()).collection('settings').doc('prefs'),
    getAuditColl: () => getDb()?.collection('users').doc(getUid()).collection('audit')
  };

  window.sanitizePlanForFirestore = function(plan) {
    if (typeof window.PlatePlanCloudSync?.sanitizePlanForFirestore === 'function') {
      return window.PlatePlanCloudSync.sanitizePlanForFirestore(plan);
    }
    return JSON.parse(JSON.stringify(plan || {}));
  };
})();
