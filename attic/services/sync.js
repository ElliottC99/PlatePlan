export function createSyncService(legacy) {
  return Object.freeze({
    saveLocalFirst: () => legacy.saveState(),
    refreshDerived: options => legacy.refreshPlatePlanDerivedState(options),
    status: () => document.getElementById('sync-status')?.dataset.status || 'local',
  });
}
