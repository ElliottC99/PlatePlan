/**
 * PlatePlan bootstrap.
 *
 * The parsed shell can paint before the compatibility layer is evaluated.
 * Holding DOMContentLoaded with top-level await preserves the existing boot
 * contract while feature modules continue moving out of the legacy source.
 */
const CURRENT_BUILD_ID = '3.3.3-mod-v90';

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
await loadClassicScript('./scripts/plateplan-app.js?v=3.3.3-mod');
await import('./features/recipes.js?v=3.3.3-mod');
await import('./main.js?v=3.3.3-mod');
document.documentElement.dataset.plateplanBoot = 'ready';
try {
  document.querySelectorAll('.app, body > *').forEach(el => {
    if (el instanceof HTMLElement && el.id !== 'plateplan-auth-screen' && el.id !== 'baked-state-recovery-banner') {
      el.inert = false;
      el.removeAttribute('aria-hidden');
    }
  });
} catch(_e) {}
