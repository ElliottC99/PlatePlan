/**
 * PlatePlan bootstrap v3.3.9 - Pure ES Module Bootloader
 */
const CURRENT_BUILD_ID = '3.3.9-v91';

window.logout = function() {
  if (window.firebase && firebase.auth) {
    try { firebase.auth().signOut(); } catch(e) {}
  }
  try { localStorage.clear(); } catch(e) {}
  try { sessionStorage.clear(); } catch(e) {}
  window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
};

window.syncNow = async function() {
  console.log('[MANUAL SYNC TRIGGERED]');
  if (window.PlatePlanModules?.store) {
    window.PlatePlanModules.store.publish({ reason: 'manual-sync' });
  }
};

document.documentElement.dataset.plateplanBoot = 'shell';
await new Promise(resolve => requestAnimationFrame(resolve));
document.documentElement.dataset.plateplanBoot = 'loading-core';
await import('./main.js?v=3.3.9');
document.documentElement.dataset.plateplanBoot = 'ready';
try {
  document.querySelectorAll('.app, body > *').forEach(el => {
    if (el instanceof HTMLElement && el.id !== 'plateplan-auth-screen' && el.id !== 'baked-state-recovery-banner') {
      el.inert = false;
      el.removeAttribute('aria-hidden');
    }
  });
} catch(_e) {}
