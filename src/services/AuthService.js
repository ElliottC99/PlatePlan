/**
 * src/services/AuthService.js (v3.19.23)
 * Resolves Firebase Auth state safely for household synchronization.
 * Singleton guarded to eliminate duplicate authentication listeners.
 */

let authPromise = null;
let authLogged = false;

export function waitForAuth() {
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) {
      authPromise = null;
      return reject(new Error("[AuthService] Firebase Auth SDK not found."));
    }

    const current = window.firebase.auth().currentUser;
    if (current) {
      if (!authLogged) {
        authLogged = true;
        console.log(`[AuthService] Active user session: ${current.email}`);
      }
      return resolve(current);
    }

    const unsubscribe = window.firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        if (!authLogged) {
          authLogged = true;
          console.log(`[AuthService] Authenticated as: ${user.email}`);
        }
        resolve(user);
      } else {
        if (!authLogged) {
          authLogged = true;
          console.warn('[AuthService] No user session detected.');
        }
        resolve(null);
      }
    }, error => {
      authPromise = null;
      reject(error);
    });
  });

  return authPromise;
}
