/** Firebase remains supplied by the pinned browser compatibility SDK. */
export function createFirebaseService(legacy) {
  return Object.freeze({
    configured: () => Boolean(window.PLATEPLAN_FIREBASE?.configured),
    initialise: () => legacy.initCloudSync?.(),
    signOut: () => legacy.signOut?.(),
  });
}
