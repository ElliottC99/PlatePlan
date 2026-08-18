/**
 * PlatePlan Silent Auto-Update Service
 * 
 * Manages background Service Worker registration and silent updates.
 * No intrusive banners or modal interruptions; updates are cached in the
 * background and applied seamlessly on subsequent visits.
 */

export function createUpdateService({
  legacy = globalThis.PlatePlanLegacy || {},
  appVersion = '2.3.1',
  expectedCache = 'plateplan-shell-v28',
} = {}) {
  let registration = null;
  let checking = false;

  const updatePreferencesPanel = (statusMessage) => {
    const versionEl = document.getElementById('plateplan-update-version');
    const cacheEl = document.getElementById('plateplan-update-cache');
    const statusEl = document.getElementById('plateplan-update-status');
    const buttonEl = document.getElementById('plateplan-check-update');

    if (versionEl) versionEl.textContent = `v${appVersion}`;
    if (cacheEl) cacheEl.textContent = expectedCache;
    if (statusEl && statusMessage) statusEl.textContent = statusMessage;
    if (buttonEl) {
      buttonEl.disabled = checking;
      buttonEl.textContent = checking ? 'Checking…' : 'Check for updates';
    }
  };

  const register = async () => {
    if (!('serviceWorker' in navigator)) {
      updatePreferencesPanel('Offline caching not supported in this browser');
      return;
    }

    try {
      registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      
      // Auto-update if service worker changes
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updatePreferencesPanel('New version cached — will apply on next visit');
          }
        });
      });

      updatePreferencesPanel('Up to date');
    } catch (error) {
      updatePreferencesPanel('Offline caching active');
    }
  };

  const check = async ({ manual = false } = {}) => {
    if (!('serviceWorker' in navigator) || !registration) {
      if (manual) {
        updatePreferencesPanel('Service worker not active');
      }
      return;
    }

    if (navigator.onLine === false) {
      if (manual) {
        updatePreferencesPanel('Offline — reconnect to check for updates');
      }
      return;
    }

    try {
      checking = true;
      updatePreferencesPanel('Checking for updates…');

      await registration.update();
      
      // Check if an installing or waiting worker exists
      if (registration.installing || registration.waiting) {
        updatePreferencesPanel('New version downloaded! Will apply on next visit.');
      } else {
        updatePreferencesPanel(`You have the latest version (v${appVersion})`);
      }
    } catch (_err) {
      updatePreferencesPanel('Could not reach update server');
    } finally {
      checking = false;
      updatePreferencesPanel();
    }
  };

  // Initial panel sync
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => updatePreferencesPanel('Up to date'), { once: true });
  } else {
    updatePreferencesPanel('Up to date');
  }

  window.addEventListener('online', () => check({ manual: false }));

  return {
    register,
    check,
    get appVersion() { return appVersion; },
    get expectedCache() { return expectedCache; }
  };
}
