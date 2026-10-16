/**
 * src/services/AuthService.js (v3.31.10)
 * Resolves Firebase Auth state safely for household synchronization.
 * Singleton guarded to eliminate duplicate authentication listeners.
 */

import { auth, onAuthStateChanged } from './firebase.js';

let authPromise = null;
let authLogged = false;

export function waitForAuth(timeoutMs = 5000) {
  if (authPromise) return authPromise;

  authPromise = new Promise((resolve) => {
    const targetAuth = auth || (typeof window !== 'undefined' && window.firebase?.auth?.());
    if (!targetAuth) {
      authPromise = null;
      return resolve(null);
    }

    if (targetAuth.currentUser) {
      if (!authLogged) {
        authLogged = true;
        console.log(`[AuthService] Active user session: ${targetAuth.currentUser.email || targetAuth.currentUser.uid}`);
      }
      return resolve(targetAuth.currentUser);
    }

    let resolved = false;
    let unsubscribe = () => {};

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsubscribe();
        console.warn('[Auth] Auth state resolution timed out.');
        resolve(null);
      }
    }, timeoutMs);

    unsubscribe = onAuthStateChanged(targetAuth, async (user) => {
      if (!resolved) {
        if (user) {
          resolved = true;
          clearTimeout(timer);
          unsubscribe();
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
            if (typeof targetAuth.signInAnonymously === 'function') {
              const cred = await targetAuth.signInAnonymously();
              resolved = true;
              clearTimeout(timer);
              unsubscribe();
              resolve(cred.user);
              return;
            }
          } catch (e) {
            console.warn('[AuthService] Anonymous login failed:', e?.message || e);
          }
          resolved = true;
          clearTimeout(timer);
          unsubscribe();
          resolve(null);
        }
      }
    }, (error) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        unsubscribe();
        authPromise = null;
        console.warn('[AuthService] onAuthStateChanged error:', error);
        resolve(null);
      }
    });
  });

  return authPromise;
}
