/**
 * scripts/services/cloud-state.js
 * Centralized state container and accessors for the Cloud Services domain.
 */
(function() {
  'use strict';
  
  window.PlatePlanCloud = window.PlatePlanCloud || {};
  window.PlatePlanCloud.State = window.PlatePlanCloud.State || {
    isReady: false,
    isOnline: navigator.onLine,
    isCloudHydrated: false,
    syncSuppress: false,
    isHydrating: false,
    isPushing: false,
    pendingPush: false,
    syncStatus: 'local_only', // 'synced' | 'pending' | 'offline' | 'local_only' | 'error'
    syncTimer: null,
    syncErrorCount: 0,
    lastSyncedAt: null,
    lastSyncError: null,
    user: null,
    authContext: {
        firebaseApp: null,
        auth: null,
        db: null,
        user: null,
        memberRole: 'member'
    }
  };

  // Proxies for legacy accessors
  Object.defineProperty(window, 'isCloudHydrated', {
    get: () => window.PlatePlanCloud.State.isCloudHydrated,
    set: (v) => { window.PlatePlanCloud.State.isCloudHydrated = v; }
  });
  Object.defineProperty(window, 'syncStatus', {
    get: () => window.PlatePlanCloud.State.syncStatus,
    set: (v) => { 
      window.PlatePlanCloud.State.syncStatus = v;
      if (typeof window.updateSyncStatusUi === 'function') window.updateSyncStatusUi(v);
    }
  });

  window.PlatePlanCloud.getCloudState = () => window.PlatePlanCloud.State;
  window.PlatePlanCloud.resetState = () => {
    window.PlatePlanCloud.State.isReady = false;
    window.PlatePlanCloud.State.isCloudHydrated = false;
    window.PlatePlanCloud.State.syncStatus = 'local_only';
    window.PlatePlanCloud.State.user = null;
    window.PlatePlanCloud.State.authContext.user = null;
  };
})();
