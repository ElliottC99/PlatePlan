/**
 * scripts/services/cloud-hydrate-pull.js
 * Firestore document fetch routines and remote delta queries.
 */
  window.pullCloudHydrate = async function() {
    const state = window.PlatePlanCloud?.State;
    if (!state || state.isHydrating) return;

    const firebaseAuth = window.firebase && firebase.auth ? firebase.auth() : null;
    const currentUser = state.user || (firebaseAuth ? firebaseAuth.currentUser : null);
    
    if (!currentUser || !currentUser.uid) {
      console.warn('[CloudHydrate] Pull skipped: No authenticated user found.');
      state.syncStatus = 'local_only';
      return;
    }

    state.isHydrating = true;
    window.syncStatus = 'pending';

    try {
      console.log('[CloudHydrate] Starting pull...');
      const refs = window.PlatePlanCloud.Refs;

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
        plan: planDoc.data() || null,
        settings: settingsDoc.data() || null,
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
    }
  };

  window.isCloudHydrated = function() {
    return window.PlatePlanCloud.State.isCloudHydrated;
  };
