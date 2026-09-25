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
await loadClassicScript('./scripts/core/router-guards.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/router-core.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/router-renderers.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/router-events.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/nutrition-math.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/nutrition-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/nutrition-derivation.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/nutrition.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/state.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/ingredient-parse.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/ingredient-resolvers.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/ingredients.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/dom.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/planner-dates.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/planner-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/cloud-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/vault-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/bank-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/backup-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-state.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-core-auth.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-core-db.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-hydrate-pull.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-hydrate-merge.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-push-queue.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-push-sync.js?v=3.3.7-mod');
await loadClassicScript('./scripts/services/cloud-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/planner-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/planner-swap.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/planner-modals.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/planner-studio.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/shopping-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/shopping-list-alloc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/shopping-list-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/shopping-list-subst.js?v=3.3.7-mod');
await loadClassicScript('./scripts/utils/recipe-calc.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-products-core.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-products-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-products-modal.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-products-filters.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-ingredients-core.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-ingredients-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-ingredients-modal.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-ui-main.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-ui-events.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/bank-fillers.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-state.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-ui-main.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-ui-fields.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-ui-steps.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-preview-card.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-preview-nutrition.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-mapping-table.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipe-editor-mapping-modal.js?v=3.3.7-mod');

await loadClassicScript('./scripts/features/modals-core.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/modals-dialogs.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/modals-forms.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipes-core.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipes-actions.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/recipes-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/settings-core.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/settings-backup-export.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/settings-backup-import.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/settings-backup-audit-diff.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/settings-backup-audit-log.js?v=3.3.7-mod');
await loadClassicScript('./scripts/features/today-ui.js?v=3.3.7-mod');
await loadClassicScript('./scripts/core/app.js?v=3.3.7-mod');
await import('./main.js?v=3.3.7-mod');

sanitizeModalDOMHierarchy();
document.documentElement.dataset.plateplanBoot = 'ready';
console.log('[PlatePlan v3.3.7-mod] Engine & Modal Resolution initialized.');

// Initialize Cloud Sync if available
if (typeof window.initPlatePlanCloudSync === 'function') {
  window.initPlatePlanCloudSync();
}

try {
  document.querySelectorAll('.app, body > *').forEach(el => {
    if (el instanceof HTMLElement && el.id !== 'plateplan-auth-screen' && el.id !== 'baked-state-recovery-banner') {
      el.inert = false;
      el.removeAttribute('aria-hidden');
    }
  });
} catch(_e) {}
