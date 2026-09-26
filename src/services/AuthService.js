/**
 * src/services/AuthService.js (v3.3.7)
 * Halts application hydration until Firebase Auth state is fully resolved.
 */

export function waitForAuth() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.firebase || !window.firebase.auth) {
      return reject(new Error("[AuthService] Firebase Auth SDK not found."));
    }
    const unsubscribe = window.firebase.auth().onAuthStateChanged(user => {
      unsubscribe();
      if (user) {
        console.log(`[AuthService] v3.3.7 - Authenticated as: ${user.email}`);
        resolve(user);
      } else {
        console.warn('[AuthService] v3.3.7 - No user session detected.');
        resolve(null);
      }
    }, error => reject(error));
  });
}
