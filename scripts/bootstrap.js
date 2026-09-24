/**
 * PlatePlan bootstrap v3.3.7-mod.
 *
 * The parsed shell can paint before the compatibility layer is evaluated.
 * Holding DOMContentLoaded with top-level await preserves the existing boot
 * contract while feature modules continue moving out of the legacy source.
 */

const CURRENT_BUILD_ID = '3.3.7-mod-v94';

export function sanitizeModalDOMHierarchy() {
  // Move top-level wrappers to <body>
  const topLevelWrappers = [
    'view-modal-wrap',
    'modal-wrap',
    'tesco-modal-wrap',
    'mobile-action-sheet-wrap',
    'app-confirm-modal',
    'app-confirm-wrap',
    'manual-ing-panel',
    'parse-modal-wrap',
    'mapping-modal-wrap',
    'unified-mapping-modal-wrap',
    'subst-modal-wrap',
    'merge-modal-wrap',
    'replace-ing-wrap',
    'mini-ing-wrap',
    'ingredient-family-details-wrap'
  ];

  topLevelWrappers.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement && el.parentElement !== document.body && el.parentElement.id !== 'app-container') {
      if (typeof window !== 'undefined' && window.PP_DEBUG) {
        console.warn(`[PlatePlan DOM Engine] Reparenting top-level #${id} to <body>`);
      }
      document.body.appendChild(el);
    }
  });

  // Ensure #mobile-action-sheet remains INSIDE #mobile-action-sheet-wrap
  const sheet = document.getElementById('mobile-action-sheet');
  const sheetWrap = document.getElementById('mobile-action-sheet-wrap');
  if (sheet && sheetWrap && sheet.parentElement !== sheetWrap) {
    sheetWrap.appendChild(sheet);
  }
}

window.sanitizeModalDOMHierarchy = sanitizeModalDOMHierarchy;
document.addEventListener('DOMContentLoaded', sanitizeModalDOMHierarchy);
if (document.readyState !== 'loading') sanitizeModalDOMHierarchy();

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

await loadClassicScript('./scripts/core/config.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/bridge.js?v=3.3.7-mod');
await loadClassicScript('./scripts/recipes.js?v=3.3.7-mod').catch(() => {});
await loadClassicScript('./scripts/actions.js?v=3.3.7-mod').catch(() => {});
await loadClassicScript('./scripts/utils/nutrition.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/state.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/ingredients.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/dom.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-sync.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/planner.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/shopping-list.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/ingredient-bank.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/settings-backup.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/views-today-vault.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/modals.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/router.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/app.js?v=3.3.7-mod');
await import('./features/recipes.js?v=3.3.7-mod');
await import('./main.js?v=3.3.7-mod');

sanitizeModalDOMHierarchy();
document.documentElement.dataset.plateplanBoot = 'ready';
console.log('[PlatePlan v3.3.7-mod] Engine & Modal Resolution initialized.');

try {
  document.querySelectorAll('.app, body > *').forEach(el => {
    if (el instanceof HTMLElement && el.id !== 'plateplan-auth-screen' && el.id !== 'baked-state-recovery-banner') {
      el.inert = false;
      el.removeAttribute('aria-hidden');
    }
  });
} catch(_e) {}
