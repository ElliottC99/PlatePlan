/**
 * src/services/AuthService.js (v3.31.14)
 * Resolves Firebase Auth state safely for household synchronization.
 * Singleton guarded to eliminate duplicate authentication listeners.
 */

let authPromise = null;
let authLogged = false;

export function waitForAuth(timeoutMs = 5000) {
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.firebase || typeof window.firebase.auth !== 'function') {
      authPromise = null;
      return resolve(null);
    }

    const authInstance = window.firebase.auth();
    if (authInstance.currentUser) {
      if (!authLogged) {
        authLogged = true;
        console.log(`[AuthService] Active user session: ${authInstance.currentUser.email || authInstance.currentUser.uid}`);
      }
      return resolve(authInstance.currentUser);
    }

    let resolved = false;
    let unsubscribe = () => {};

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (typeof unsubscribe === 'function') unsubscribe();
        console.warn('[Auth] Auth state resolution timed out.');
        resolve(window.firebase?.auth()?.currentUser || null);
      }
    }, timeoutMs);

    unsubscribe = authInstance.onAuthStateChanged(async (user) => {
      if (!resolved) {
        if (user) {
          resolved = true;
          clearTimeout(timer);
          if (typeof unsubscribe === 'function') unsubscribe();
          if (!authLogged) {
            authLogged = true;
            console.log(`[AuthService] Authenticated as: ${user.email || user.uid}`);
          }
          resolve(user);
        } else {
          if (!authLogged) {
            authLogged = true;
            console.warn('[AuthService] No user session detected. Signing in anonymously...');
          }
          try {
            if (typeof authInstance.signInAnonymously === 'function') {
              const cred = await authInstance.signInAnonymously();
              resolved = true;
              clearTimeout(timer);
              if (typeof unsubscribe === 'function') unsubscribe();
              resolve(cred.user);
              return;
            }
          } catch (e) {
            console.warn('[AuthService] Anonymous login failed:', e?.message || e);
          }
          resolved = true;
          clearTimeout(timer);
          if (typeof unsubscribe === 'function') unsubscribe();
          resolve(null);
        }
      }
    }, (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        if (typeof unsubscribe === 'function') unsubscribe();
        authPromise = null;
        console.warn('[AuthService] onAuthStateChanged error:', error);
        resolve(null);
      }
    });
  });

  return authPromise;
}

