import { assertAuthoritativeInterfaces } from './core/contracts.js?v=2.6.14';
import { createPlatePlanStore } from './core/store.js?v=2.6.14';
import { createPlatePlanRuntime } from './core/runtime.js?v=2.6.14';
import { createFirebaseService } from './services/firebase.js?v=2.6.14';
import { createSyncService } from './services/sync.js?v=2.6.14';
import { createRecoveryService } from './services/recovery.js?v=2.6.14';
import { createUpdateService } from './services/updates.js?v=2.6.14';
import { installDelegatedActions } from './ui/actions.js?v=2.6.14';
import { installNavigation } from './ui/navigation.js?v=2.6.14';
import { createWorkspaceService } from './ui/workspaces.js?v=2.6.14';

const legacy = globalThis.PlatePlanLegacy;
assertAuthoritativeInterfaces(legacy);

const store = createPlatePlanStore(legacy);
const workspaces = createWorkspaceService();
const updates = createUpdateService({
  legacy,
  workspaces,
  appVersion: '2.6.14',
  expectedCache: 'plateplan-shell-v60',
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
  document.documentElement.dataset.plateplanRuntime = '2.6.14';
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
  version: '2.6.14',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '2.6.14', loadedViews: runtime.loadedViews() },
}));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => updates.register(), { once: true });
} else {
  updates.register();
}
