import { safeStringify } from '../core/utils.js?v=3.3.6';

export function createSyncService() {
  return Object.freeze({
    saveLocalFirst: () => {
      try {
        const state = window.state || {};
        localStorage.setItem('plateplan_v2', safeStringify(state));
        return true;
      } catch (e) {
        return false;
      }
    },
    refreshDerived: options => {
      if (typeof window.renderAll === 'function') window.renderAll();
    },
    status: () => document.getElementById('sync-status')?.dataset.status || 'local',
  });
}

