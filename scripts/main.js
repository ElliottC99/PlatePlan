import { assertAuthoritativeInterfaces } from './core/contracts.js?v=3.0.9';
import { createPlatePlanStore } from './core/store.js?v=3.0.9';
import { createPlatePlanRuntime } from './core/runtime.js?v=3.0.9';
import { createFirebaseService } from './services/firebase.js?v=3.0.9';
import { createSyncService } from './services/sync.js?v=3.0.9';
import { createRecoveryService } from './services/recovery.js?v=3.0.9';
import { createUpdateService } from './services/updates.js?v=3.0.9';
import { installDelegatedActions } from './ui/actions.js?v=3.0.9';
import { installNavigation } from './ui/navigation.js?v=3.0.9';
import { createWorkspaceService } from './ui/workspaces.js?v=3.0.9';

window.APP_VERSION = '3.0.9';

const legacy = globalThis.PlatePlanLegacy;
assertAuthoritativeInterfaces(legacy);

const store = createPlatePlanStore(legacy);
const workspaces = createWorkspaceService();
const updates = createUpdateService({
  legacy,
  workspaces,
  appVersion: '3.0.9',
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
  document.documentElement.dataset.plateplanRuntime = '3.0.9';
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
  version: '3.0.9',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '3.0.9', loadedViews: runtime.loadedViews() },
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updates.register(), { once: true });
} else {
  updates.register();
}
