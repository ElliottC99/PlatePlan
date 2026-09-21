export function createSyncService(legacy) {
  return Object.freeze({
    saveLocalFirst: () => legacy?.saveState ? legacy.saveState() : (typeof window.saveState === 'function' ? window.saveState() : null),
    refreshDerived: options => legacy?.refreshPlatePlanDerivedState ? legacy.refreshPlatePlanDerivedState(options) : (typeof window.refreshPlatePlanDerivedState === 'function' ? window.refreshPlatePlanDerivedState(options) : null),
    status: () => document.getElementById('sync-status')?.dataset.status || 'local',
  });
}
