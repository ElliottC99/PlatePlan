/**
 * src/services/AuthService.js (v3.5.0)
 * Resolves Firebase Auth state safely for household synchronization.
 */

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) {
      return reject(new Error("[AuthService v3.5.0] Firebase Auth SDK not found."));
    }
    const unsubscribe = window.firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        console.log(`[AuthService v3.5.0] Authenticated as: ${user.email}`);
        resolve(user);
      } else {
        console.warn('[AuthService v3.5.0] No user session detected.');
        resolve(null);
      }
    }, error => reject(error));
  });
}
