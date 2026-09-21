import { createPlatePlanStore } from './core/store.js?v=3.3.15';
import { createPlatePlanRuntime } from './core/runtime.js?v=3.3.15';
import { createFirebaseService } from './services/firebase.js?v=3.3.15';
import { initFirebaseService } from './services/firebase-service.js?v=3.3.15';
import { createSyncService } from './services/sync.js?v=3.3.15';
import { createRecoveryService } from './services/recovery.js?v=3.3.15';
import { createUpdateService } from './services/updates.js?v=3.3.15';
import { installDelegatedActions } from './ui/actions.js?v=3.3.15';
import { installNavigation } from './ui/navigation.js?v=3.3.15';
import { createWorkspaceService } from './ui/workspaces.js?v=3.3.15';

import { renderVault } from './features/recipes.js?v=3.3.15';
import { renderPlanner } from './features/planner.js?v=3.3.15';
import { renderIngredientBank } from './features/ingredients.js?v=3.3.15';
import { renderProductBank } from './features/products.js?v=3.3.15';
import { renderDataQuality } from './features/data-quality.js?v=3.3.15';
import { renderPreferences } from './features/preferences.js?v=3.3.15';

window.renderVault = renderVault;
window.renderPlanner = renderPlanner;
window.renderIngredients = renderIngredientBank;
window.renderProducts = renderProductBank;
window.renderDataQuality = renderDataQuality;
window.renderPreferences = renderPreferences;

console.log('[PlatePlan v3.3.15] Engine initialized');

window.APP_VERSION = '3.3.15';

// Step 1: Initialize store and load local fallback state
const store = createPlatePlanStore();
store.getState();

const workspaces = createWorkspaceService();
const updates = createUpdateService({
  workspaces,
  appVersion: '3.3.15',
  expectedCache: 'plate-plan-cache-v3.3.15',
});
const context = Object.freeze({
  store,
  firebase: createFirebaseService(),
  sync: createSyncService(),
  recovery: createRecoveryService(),
  updates,
  workspaces,
});
const runtime = createPlatePlanRuntime(context);
const actions = installDelegatedActions();
const uninstallNavigation = installNavigation(runtime);
const syncRuntimeMarker = () => {
  document.documentElement.dataset.plateplanRuntime = '3.3.15';
  document.documentElement.dataset.plateplanLoadedViews = runtime.loadedViews().sort().join(',');
};
window.addEventListener('plateplan:feature-loaded', syncRuntimeMarker);

// Wire deletePlan globally to our store's resilient deletePlan implementation
import { deletePlan } from './core/store.js?v=3.3.15';
window.deletePlan = deletePlan;
window.showView = (id) => {
  runtime.renderView(id);
  // Update sidebar active classes
  document.querySelectorAll('.ntab, [data-view]').forEach(tab => {
    tab.classList.remove('active');
    if (tab.dataset.view === id || tab.id === `tab-${id}`) {
      tab.classList.add('active');
    }
  });
};
window.openSearchResult = (type, id, title) => {
  if (type === 'recipe') {
    window.showView('vault');
  } else if (type === 'plan') {
    window.showView('today');
  } else {
    window.showView('bank');
  }
};
window.clearProductGroupFilter = () => { console.log('clearProductGroupFilter called'); };


// Eagerly load core feature modules to establish DOM ownership, attach listeners, and claim active modular view ownership
const coreFeatures = ['today', 'vault', 'planner', 'data'];
for (const id of coreFeatures) {
  try {
    await runtime.loadFeature(id);
  } catch (err) {
    console.error(`Failed to eagerly load feature: ${id}`, err);
  }
}

// Step 2: Render the active view immediately (so the user never sees a blank screen)
const activeViewElement = document.querySelector('.view.active') || document.getElementById('view-today');
if (activeViewElement) {
  const activeId = activeViewElement.id.replace('view-', '');
  const featureId = activeId === 'vault' ? 'vault' : (activeId === 'data' ? 'data' : (activeId === 'today' ? 'today' : activeId));
  if (coreFeatures.includes(featureId)) {
    try {
      await runtime.renderView(featureId);
    } catch (err) {
      console.error(`Failed to trigger initial render for active view: ${featureId}`, err);
    }
  }
}

// Step 3: Initialize Firebase services and attach live Firestore listeners (Step 4: reactive updates trigger automatically via store subscribers)
initFirebaseService();

syncRuntimeMarker();

globalThis.PlatePlanModules = Object.freeze({
  ...runtime,
  store,
  actions,
  updates,
  workspaces,
  uninstallNavigation,
  version: '3.3.15',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '3.3.15', loadedViews: runtime.loadedViews() },
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updates.register(), { once: true });
} else {
  updates.register();
}
