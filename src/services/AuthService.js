/**
 * src/services/AuthService.js (v3.19.23)
 * Resolves Firebase Auth state safely for household synchronization.
 * Singleton guarded to eliminate duplicate authentication listeners.
 */

let authPromise = null;
let authLogged = false;

export function waitForAuth(timeoutMs = 5000) {
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    let settled = false;
    const safeResolve = (user) => {
      if (!settled) {
        settled = true;
        resolve(user);
      }
    };

    const timer = setTimeout(() => {
      if (!settled) {
        console.warn('[Auth] Auth state resolution timed out.');
        safeResolve(null);
      }
    }, timeoutMs);

    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) {
      clearTimeout(timer);
      authPromise = null;
      return safeResolve(null);
    }

    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      if (window.PLATEPLAN_FIREBASE && window.PLATEPLAN_FIREBASE.config) {
        window.firebase.initializeApp(window.PLATEPLAN_FIREBASE.config);
      } else {
        clearTimeout(timer);
        authPromise = null;
        return safeResolve(null);
      }
    }

    const authInstance = window.firebase.auth();
    const current = authInstance.currentUser;
    if (current) {
      clearTimeout(timer);
      if (!authLogged) {
        authLogged = true;
        console.log(`[AuthService] Active user session: ${current.email || current.uid}`);
      }
      return safeResolve(current);
    }

    const unsubscribe = authInstance.onAuthStateChanged(async (user) => {
      unsubscribe();
      clearTimeout(timer);
      if (user) {
        if (!authLogged) {
          authLogged = true;
          console.log(`[AuthService] Authenticated as: ${user.email || user.uid}`);
        }
        safeResolve(user);
      } else {
        if (!authLogged) {
          authLogged = true;
          console.warn('[AuthService] No user session detected. Signing in anonymously...');
        }
        try {
          const cred = await authInstance.signInAnonymously();
          safeResolve(cred.user);
        } catch (e) {
          console.warn('[AuthService] Anonymous login failed:', e);
          safeResolve(null);
        }
      }
    }, (error) => {
      clearTimeout(timer);
      authPromise = null;
      console.warn('[AuthService] onAuthStateChanged error:', error);
      safeResolve(null);
    });
  });

  return authPromise;
}
