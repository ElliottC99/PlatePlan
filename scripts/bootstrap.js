/**
 * PlatePlan bootstrap.
 *
 * The parsed shell can paint before the compatibility layer is evaluated.
 * Holding DOMContentLoaded with top-level await preserves the existing boot
 * contract while feature modules continue moving out of the legacy source.
 */
const CURRENT_BUILD_ID = '2.7.0-v50';
// 1. Nuclear Cache Reset on Boot
try {
  if (localStorage.getItem('plateplan_version') !== '2.7.0') {
    console.log('[v2.7.0 NUCLEAR PURGE] Resetting local caches in bootstrap...');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('plateplan')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    if (window.indexedDB) {
      if (typeof indexedDB.databases === 'function') {
        try {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              try { indexedDB.deleteDatabase(db.name); } catch (_e) {}
            }
          }
        } catch (_e) {}
      }
      ['plateplan', 'plateplan-db', 'plateplan_store', 'plateplan_cache', 'keyval-store'].forEach(name => {
        try { indexedDB.deleteDatabase(name); } catch (_e) {}
      });
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    localStorage.setItem('plateplan_version', '2.7.0');
    localStorage.setItem('plateplan_installed_build', CURRENT_BUILD_ID);
  }
} catch (_e) {}

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
await loadClassicScript('./scripts/plateplan-app.js?v=2.7.0');
await import('./main.js?v=2.7.0');
document.documentElement.dataset.plateplanBoot = 'ready';

