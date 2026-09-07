/**
 * PlatePlan bootstrap.
 *
 * The parsed shell can paint before the compatibility layer is evaluated.
 * Holding DOMContentLoaded with top-level await preserves the existing boot
 * contract while feature modules continue moving out of the legacy source.
 */
const CURRENT_BUILD_ID = '2.6.14-v60';

// Expose global window actions immediately on app load before any async operations execute
window.logout = function() {
  if (typeof signOutPlatePlan === 'function') {
    try { signOutPlatePlan(); } catch(e) {}
  } else if (window.firebase && firebase.auth) {
    try { firebase.auth().signOut(); } catch(e) {}
  }
  try { localStorage.clear(); } catch(e) {}
  try { sessionStorage.clear(); } catch(e) {}
  window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
};

window.syncNow = async function() {
  console.log('[MANUAL SYNC TRIGGERED]');
  if (typeof pushStateToCloud === 'function') {
    await pushStateToCloud(true);
  } else if (typeof loadSharedPlatePlan === 'function') {
    await loadSharedPlatePlan();
  }
};

function loadClassicScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error(`Could not load ${source}`)), { once: true });
    document.head.appendChild(script);
  });
}

document.documentElement.dataset.plateplanBoot = 'shell';
await new Promise(resolve => requestAnimationFrame(resolve));
document.documentElement.dataset.plateplanBoot = 'loading-core';
await loadClassicScript('./scripts/plateplan-app.js?v=2.6.14');
await import('./main.js?v=2.6.14');
document.documentElement.dataset.plateplanBoot = 'ready';

