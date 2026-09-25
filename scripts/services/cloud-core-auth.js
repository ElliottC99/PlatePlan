/**
 * scripts/services/cloud-core-auth.js
 * Authentication context, token handling, and connection checks.
 */
  window.initPlatePlanCloudSync = function() {
    const state = window.PlatePlanCloud.State;
    if (state.isReady) return;

    const firebaseConfig = window.PLATEPLAN_FIREBASE?.config;
    if (!window.firebase || !firebaseConfig) {
      console.warn('[CloudAuth] Firebase or Config missing, staying in local mode.');
      window.syncStatus = 'local_only';
      return;
    }

    try {
      if (!firebase.apps.length) {
        state.authContext.firebaseApp = firebase.initializeApp(firebaseConfig);
      } else {
        state.authContext.firebaseApp = firebase.app();
      }

      state.authContext.auth = firebase.auth();
      state.authContext.db = firebase.firestore();

      state.authContext.auth.onAuthStateChanged(async (user) => {
        if (user) {
          state.user = user;
          state.authContext.user = user;
          console.log('[CloudAuth] User logged in:', user.email);
          state.syncStatus = 'syncing';
          if (typeof window.pullCloudHydrate === 'function') {
            await window.pullCloudHydrate();
          }
        } else {
          console.log('[CloudAuth] User logged out');
          state.user = null;
          state.authContext.user = null;
          state.syncStatus = 'local_only';
          window.PlatePlanCloud.resetState();
        }
      });

      state.isReady = true;
    } catch (e) {
      console.error('[CloudAuth] Initialization failed:', e);
      window.syncStatus = 'error';
    }
  };

  window.signOutPlatePlan = function() {
    const auth = window.PlatePlanCloud.State.authContext.auth;
    if (auth) auth.signOut();
  };

  window.addEventListener('online', () => {
    window.PlatePlanCloud.State.isOnline = true;
    if (window.PlatePlanCloud.State.user) window.syncStatus = 'pending';
  });

  window.addEventListener('offline', () => {
    window.PlatePlanCloud.State.isOnline = false;
    window.syncStatus = 'offline';
  });
