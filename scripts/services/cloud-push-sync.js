/**
 * scripts/services/cloud-push-sync.js
 * Firestore write execution, batch commit listeners, and retry handlers.
 */
(function() {
  'use strict';

  let debouncePushTimer = null;

  window.debouncedPushCloudSync = function(delayMs = 350) {
    if (debouncePushTimer) {
      clearTimeout(debouncePushTimer);
    }
    debouncePushTimer = setTimeout(() => {
      debouncePushTimer = null;
      window.pushCloudSync();
    }, delayMs);
  };

  window.pushCloudSync = async function(force = false) {
    const cloud = window.PlatePlanCloud;
    const state = cloud?.State;
    if (!state || !state.user || state.syncSuppress) return;

    if ((state.isHydrating || state.isSyncing) && !force) {
      console.log('[CloudPush] Push deferred: Cloud hydration in progress.');
      return;
    }

    if (state.isPushing && !force) {
      state.pendingPush = true;
      return;
    }

    state.isPushing = true;
    window.syncStatus = 'pending';

    try {
      console.log('[CloudPush] Starting debounced push...');
      const refs = cloud.Refs;
      const db = state.authContext?.db || (window.firebase?.firestore ? window.firebase.firestore() : null);
      if (!db || !refs) {
        state.isPushing = false;
        return;
      }

      const batch = db.batch();

      // Collect local data
      const plan = window.state?.plan || JSON.parse(localStorage.getItem('plateplan_current_plan') || '{}');
      const settings = window.state?.prefs || JSON.parse(localStorage.getItem('plateplan_prefs') || '{}');

      // Sanitize
      const cleanPlan = (typeof window.sanitizePlanForFirestore === 'function') 
        ? window.sanitizePlanForFirestore(plan) 
        : plan;

      const planDocRef = refs.getPlanDoc();
      const settingsDocRef = refs.getSettingsDoc();

      if (planDocRef) batch.set(planDocRef, cleanPlan, { merge: true });
      if (settingsDocRef) batch.set(settingsDocRef, settings, { merge: true });

      await batch.commit();

      console.log('[CloudPush] Push successful.');
      window.syncStatus = 'synced';
      state.lastSyncedAt = Date.now();
      state.syncErrorCount = 0;
    } catch (e) {
      console.error('[CloudPush] Push failed:', e);
      state.syncErrorCount = (state.syncErrorCount || 0) + 1;
      window.syncStatus = 'error';
      state.lastSyncError = e.message;
    } finally {
      state.isPushing = false;
      if (state.pendingPush) {
        state.pendingPush = false;
        window.debouncedPushCloudSync(500);
      }
    }
  };

  // Alias for manual triggers
  window.pushStateToCloud = function(force = false) {
    if (force) {
      return window.pushCloudSync(true);
    }
    window.debouncedPushCloudSync(350);
  };
})();
