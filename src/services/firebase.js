/**
 * src/services/firebase.js
 * Dedicated Firebase service adapter and exports for Auth and Firestore persistence.
 */

export * from '../config/firebase.js';
export { db, auth, ensureAuthPersistence, HOUSEHOLD_ID, FIREBASE_CONFIG } from '../config/firebase.js';

export function onAuthStateChanged(authInstance, nextOrObserver, error, completed) {
  const targetAuth = authInstance || (typeof window !== 'undefined' && window.firebase?.auth?.());
  if (targetAuth && typeof targetAuth.onAuthStateChanged === 'function') {
    return targetAuth.onAuthStateChanged(nextOrObserver, error, completed);
  }
  return () => {};
}
