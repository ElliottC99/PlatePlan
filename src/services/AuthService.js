/**
 * src/services/AuthService.js (v3.8.1)
 * Resolves Firebase Auth state safely for household synchronization.
 */

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) {
      return reject(new Error("[AuthService] Firebase Auth SDK not found."));
    }
    const unsubscribe = window.firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        console.log(`[AuthService] Authenticated as: ${user.email}`);
        resolve(user);
      } else {
        console.warn('[AuthService] No user session detected.');
        resolve(null);
      }
    }, error => reject(error));
  });
}
