import { createPlatePlanStore, initializeStoreState } from './core/store.js?v=3.1.2';
import { createPlatePlanRuntime } from './core/runtime.js?v=3.1.2';
import { createFirebaseService } from './services/firebase.js?v=3.1.2';
import { createSyncService } from './services/sync.js?v=3.1.2';
import { createRecoveryService } from './services/recovery.js?v=3.1.2';
import { createUpdateService } from './services/updates.js?v=3.1.2';
import { installDelegatedActions } from './ui/actions.js?v=3.1.2';
import { installNavigation } from './ui/navigation.js?v=3.1.2';
import { createWorkspaceService } from './ui/workspaces.js?v=3.1.2';

window.APP_VERSION = '3.1.2';

const legacy = globalThis.PlatePlanLegacy || null;

// Initialize window.state and state hydration entirely via store.js
initializeStoreState(legacy);

const store = createPlatePlanStore(legacy);
const workspaces = createWorkspaceService();
const updates = createUpdateService({
  legacy,
  workspaces,
  appVersion: '3.1.2',
  expectedCache: 'plateplan-shell-v89',
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
  document.documentElement.dataset.plateplanRuntime = '3.1.2';
  document.documentElement.dataset.plateplanLoadedViews = runtime.loadedViews().sort().join(',');
};
window.addEventListener('plateplan:feature-loaded', syncRuntimeMarker);

// Today is the only feature evaluated eagerly. All other feature modules are
// imported when their destination is first requested.
await runtime.loadFeature('today');
syncRuntimeMarker();

globalThis.PlatePlanModules = Object.freeze({
  ...runtime,
  store,
  actions,
  updates,
  workspaces,
  uninstallNavigation,
  version: '3.1.2',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '3.1.2', loadedViews: runtime.loadedViews() },
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updates.register(), { once: true });
} else {
  updates.register();
}
