/**
 * scripts/services/cloud-hydrate-pull.js
 * Firestore document fetch routines and remote delta queries.
 */
  window.pullCloudHydrate = async function() {
    const cloud = window.PlatePlanCloud;
    const state = cloud?.State;
    if (!state || state.isHydrating || state.isSyncing) return;

    const firebaseAuth = window.firebase && firebase.auth ? firebase.auth() : null;
    const currentUser = state.user || (firebaseAuth ? firebaseAuth.currentUser : null);
    
    if (!currentUser || !currentUser.uid) {
      console.warn('[CloudHydrate] Pull skipped: No authenticated user found.');
      state.syncStatus = 'local_only';
      return;
    }

    state.isSyncing = true;
    state.isHydrating = true;
    window.syncStatus = 'pending';

    try {
      console.log('[CloudHydrate] Starting batch pull...');
      const refs = cloud.Refs;

      const planRef = refs.getPlanDoc();
      const settingsRef = refs.getSettingsDoc();
      const recipesRef = refs.getRecipesColl();
      const ingredientsRef = refs.getIngredientsColl();

      console.log('[CloudHydrate] Fetching plan from path:', planRef ? planRef.path : 'null');
      console.log('[CloudHydrate] Fetching settings from path:', settingsRef ? settingsRef.path : 'null');
      console.log('[CloudHydrate] Fetching recipes from path:', recipesRef ? recipesRef.path : 'null');
      console.log('[CloudHydrate] Fetching ingredients from path:', ingredientsRef ? ingredientsRef.path : 'null');
      
      const [planDoc, settingsDoc, recipesSnap, ingredientsSnap] = await Promise.all([
        planRef.get(),
        settingsRef.get(),
        recipesRef.get(),
        ingredientsRef.get()
      ]);

      const remoteData = {
        plan: planDoc.exists ? planDoc.data() : null,
        settings: settingsDoc.exists ? settingsDoc.data() : null,
        recipes: recipesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ingredients: ingredientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      };

      if (typeof window.mergeCloudState === 'function') {
        await window.mergeCloudState(remoteData);
      }

      state.isCloudHydrated = true;
      window.syncStatus = 'synced';
      state.lastSyncedAt = Date.now();
    } catch (e) {
      console.error('[CloudHydrate] Pull failed:', e);
      window.syncStatus = 'error';
      state.lastSyncError = e.message;
    } finally {
      state.isHydrating = false;
      state.isSyncing = false;
    }
  };

  window.isCloudHydrated = function() {
    return window.PlatePlanCloud.State.isCloudHydrated;
  };
