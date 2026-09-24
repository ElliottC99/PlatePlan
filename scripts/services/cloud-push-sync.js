/**
 * scripts/services/cloud-push-sync.js
 * Firestore write execution, batch commit listeners, and retry handlers.
 */
  window.pushCloudSync = async function(force = false) {
    const state = window.PlatePlanCloud.State;
    if (!state.user || state.syncSuppress) return;
    if (state.isPushing && !force) {
      state.pendingPush = true;
      return;
    }

    state.isPushing = true;
    window.syncStatus = 'pending';

    try {
      console.log('[CloudPush] Starting push...');
      const refs = window.PlatePlanCloud.Refs;
      const db = state.authContext.db;
      const batch = db.batch();

      // Collect local data
      const plan = JSON.parse(localStorage.getItem('plateplan_current_plan') || '{}');
      const recipes = JSON.parse(localStorage.getItem('plateplan_recipes') || '[]');
      const ingredients = JSON.parse(localStorage.getItem('plateplan_ingredients') || '[]');
      const settings = JSON.parse(localStorage.getItem('plateplan_prefs') || '{}');

      // Sanitize
      const cleanPlan = window.sanitizePlanForFirestore(plan);

      // Add to batch
      batch.set(refs.getPlanDoc(), cleanPlan);
      batch.set(refs.getSettingsDoc(), settings);

      // For recipes and ingredients, we might need a more complex sync (e.g. merge by ID)
      // For now, we'll just push what we have if it's manageable
      // In a real app, we'd only push deltas
      
      await batch.commit();

      console.log('[CloudPush] Push successful.');
      window.syncStatus = 'synced';
      state.lastSyncedAt = Date.now();
      state.syncErrorCount = 0;
    } catch (e) {
      console.error('[CloudPush] Push failed:', e);
      state.syncErrorCount++;
      window.syncStatus = 'error';
      state.lastSyncError = e.message;
    } finally {
      state.isPushing = false;
      if (state.pendingPush) {
        state.pendingPush = false;
        setTimeout(() => window.pushCloudSync(), 1000);
      }
    }
  };

  // Alias for manual triggers
  window.pushStateToCloud = window.pushCloudSync;
