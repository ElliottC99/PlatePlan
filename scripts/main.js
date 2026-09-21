import { assertAuthoritativeInterfaces } from './core/contracts.js?v=3.3.0';
import { createPlatePlanStore } from './core/store.js?v=3.3.0';
import { createPlatePlanRuntime } from './core/runtime.js?v=3.3.0';
import { createFirebaseService } from './services/firebase.js?v=3.3.0';
import { createSyncService } from './services/sync.js?v=3.3.0';
import { createRecoveryService } from './services/recovery.js?v=3.3.0';
import { createUpdateService } from './services/updates.js?v=3.3.0';
import { installDelegatedActions } from './ui/actions.js?v=3.3.0';
import { installNavigation } from './ui/navigation.js?v=3.3.0';
import { createWorkspaceService } from './ui/workspaces.js?v=3.3.0';

window.APP_VERSION = '3.3.0';

const legacy = globalThis.PlatePlanLegacy;
assertAuthoritativeInterfaces(legacy);

const store = createPlatePlanStore(legacy);
const workspaces = createWorkspaceService();
const updates = createUpdateService({
  legacy,
  workspaces,
  appVersion: '3.3.0',
  expectedCache: 'plateplan-shell-v90',
});
const context = Object.freeze({
  legacy,
  store,
  firebase: createFirebaseService(legacy),
  sync: createSyncService(legacy),
  recovery: createRecoveryService(legacy),
  updates,
  workspaces,
});
const runtime = createPlatePlanRuntime(context);
const actions = installDelegatedActions(legacy);
const uninstallNavigation = installNavigation(runtime);
const syncRuntimeMarker = () => {
  document.documentElement.dataset.plateplanRuntime = '3.3.0';
  document.documentElement.dataset.plateplanLoadedViews = runtime.loadedViews().sort().join(',');
};
window.addEventListener('plateplan:feature-loaded', syncRuntimeMarker);

// Wire deletePlan globally to our store's resilient deletePlan implementation
import { deletePlan } from './core/store.js?v=3.3.0';
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

// Explicitly trigger render for the currently active view container in the DOM
const activeViewElement = document.querySelector('.view.active');
if (activeViewElement) {
  const activeId = activeViewElement.id.replace('view-', '');
  // Map element IDs to correct feature IDs
  const featureId = activeId === 'vault' ? 'vault' : (activeId === 'data' ? 'data' : activeId);
  if (coreFeatures.includes(featureId)) {
    try {
      await runtime.renderView(featureId);
    } catch (err) {
      console.error(`Failed to trigger initial render for active view: ${featureId}`, err);
    }
  }
}

syncRuntimeMarker();

globalThis.PlatePlanModules = Object.freeze({
  ...runtime,
  store,
  actions,
  updates,
  workspaces,
  uninstallNavigation,
  version: '3.3.0',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '3.3.0', loadedViews: runtime.loadedViews() },
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updates.register(), { once: true });
} else {
  updates.register();
}
