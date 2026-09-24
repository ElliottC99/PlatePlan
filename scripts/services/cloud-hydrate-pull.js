/**
 * scripts/services/cloud-hydrate-pull.js
 * Firestore document fetch routines and remote delta queries.
 */
  window.pullCloudHydrate = async function() {
    const state = window.PlatePlanCloud?.State;
    if (!state || !state.user || !state.user.uid || state.isHydrating) return;

    state.isHydrating = true;
    window.syncStatus = 'pending';

    try {
      console.log('[CloudHydrate] Starting pull...');
      const refs = window.PlatePlanCloud.Refs;
      
      const [planDoc, settingsDoc, recipesSnap, ingredientsSnap] = await Promise.all([
        refs.getPlanDoc().get(),
        refs.getSettingsDoc().get(),
        refs.getRecipesColl().get(),
        refs.getIngredientsColl().get()
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
