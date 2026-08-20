/**
 * PlatePlan bootstrap.
 *
 * The parsed shell can paint before the compatibility layer is evaluated.
 * Holding DOMContentLoaded with top-level await preserves the existing boot
 * contract while feature modules continue moving out of the legacy source.
 */
const CURRENT_BUILD_ID = '2.3.3-v30';
try {
  if (localStorage.getItem('plateplan_installed_build') !== CURRENT_BUILD_ID) {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
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
await loadClassicScript('./scripts/plateplan-app.js?v=2.3.3');
await import('./main.js?v=2.3.3');
document.documentElement.dataset.plateplanBoot = 'ready';

