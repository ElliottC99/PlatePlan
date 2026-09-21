/** Firebase remains supplied by the pinned browser compatibility SDK. */
export function createFirebaseService(legacy) {
  return Object.freeze({
    configured: () => Boolean(window.PLATEPLAN_FIREBASE?.configured),
    initialise: () => legacy?.initCloudSync?.() || (typeof window.initCloudSync === 'function' ? window.initCloudSync() : null),
    signOut: () => legacy?.signOut?.() || (typeof window.signOut === 'function' ? window.signOut() : null),
  });
}
