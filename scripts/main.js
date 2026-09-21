import { createPlatePlanStore } from './core/store.js?v=3.3.6';
import { createPlatePlanRuntime } from './core/runtime.js?v=3.3.6';
import { createFirebaseService } from './services/firebase.js?v=3.3.6';
import { initFirebaseService } from './services/firebase-service.js?v=3.3.6';
import { createSyncService } from './services/sync.js?v=3.3.6';
import { createRecoveryService } from './services/recovery.js?v=3.3.6';
import { createUpdateService } from './services/updates.js?v=3.3.6';
import { installDelegatedActions } from './ui/actions.js?v=3.3.6';
import { installNavigation } from './ui/navigation.js?v=3.3.6';
import { createWorkspaceService } from './ui/workspaces.js?v=3.3.6';

window.APP_VERSION = '3.3.6';

// Step 1: Initialize store and load local fallback state
const store = createPlatePlanStore();
store.getState();

const workspaces = createWorkspaceService();
const updates = createUpdateService({
  workspaces,
  appVersion: '3.3.6',
  expectedCache: 'plateplan-shell-v96',
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
  document.documentElement.dataset.plateplanRuntime = '3.3.6';
  document.documentElement.dataset.plateplanLoadedViews = runtime.loadedViews().sort().join(',');
};
window.addEventListener('plateplan:feature-loaded', syncRuntimeMarker);

// Wire deletePlan globally to our store's resilient deletePlan implementation
import { deletePlan } from './core/store.js?v=3.3.6';
window.deletePlan = deletePlan;


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
  version: '3.3.6',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '3.3.6', loadedViews: runtime.loadedViews() },
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updates.register(), { once: true });
} else {
  updates.register();
}
