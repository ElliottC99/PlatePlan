/** Firebase remains supplied by the pinned browser compatibility SDK. */
export function createFirebaseService() {
  return Object.freeze({
    configured: () => Boolean(window.PLATEPLAN_FIREBASE?.configured),
    initialise: () => console.log('Cloud sync initialized'),
    signOut: () => {
      try { localStorage.clear(); } catch(e) {}
      window.location.reload();
    },
  });
}

