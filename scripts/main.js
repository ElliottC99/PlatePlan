import { assertAuthoritativeInterfaces } from './core/contracts.js?v=21.0';
import { createPlatePlanStore } from './core/store.js?v=21.0';
import { createPlatePlanRuntime } from './core/runtime.js?v=21.0';
import { createFirebaseService } from './services/firebase.js?v=21.0';
import { createSyncService } from './services/sync.js?v=21.0';
import { createRecoveryService } from './services/recovery.js?v=21.0';
import { createUpdateService } from './services/updates.js?v=21.0';
import { installDelegatedActions } from './ui/actions.js?v=21.0';
import { installNavigation } from './ui/navigation.js?v=21.0';
import { createWorkspaceService } from './ui/workspaces.js?v=21.0';

const legacy = globalThis.PlatePlanLegacy;
assertAuthoritativeInterfaces(legacy);

const store = createPlatePlanStore(legacy);
const context = Object.freeze({
  legacy,
  store,
  firebase: createFirebaseService(legacy),
  sync: createSyncService(legacy),
  recovery: createRecoveryService(legacy),
  updates: createUpdateService(legacy),
  workspaces: createWorkspaceService(),
});
const runtime = createPlatePlanRuntime(context);
const actions = installDelegatedActions(legacy);
const uninstallNavigation = installNavigation(runtime);
const syncRuntimeMarker = () => {
  document.documentElement.dataset.plateplanRuntime = '21.0';
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
  uninstallNavigation,
  version: '21.0',
});

window.dispatchEvent(new CustomEvent('plateplan:modules-ready', {
  detail: { version: '21.0', loadedViews: runtime.loadedViews() },
}));
