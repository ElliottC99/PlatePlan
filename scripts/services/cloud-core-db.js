/**
 * scripts/services/cloud-core-db.js
 * Firestore database reference builders and batch payload formatting.
 */
  window.PlatePlanCloud = window.PlatePlanCloud || {};
  
  const getDb = () => window.PlatePlanCloud.State.authContext.db;
  const getUid = () => window.PlatePlanCloud.State.user?.uid;

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
