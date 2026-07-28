import { validatePlatePlanState } from './contracts.js?v=21.3.2';

/**
 * Small observable adapter around PlatePlan's existing local-first state.
 * Feature modules use this boundary instead of reaching into global variables.
 * @param {{getState:()=>object, saveState:()=>boolean}} adapter
 */
export function createPlatePlanStore(adapter) {
  const listeners = new Set();
  let savingThroughStore = false;

  const publish = detail => {
    const state = adapter.getState();
    const validation = validatePlatePlanState(state);
    const event = { state, validation, detail: detail || {} };
    listeners.forEach(listener => {
      try { listener(event); } catch (error) { console.error('PlatePlan store listener failed', error); }
    });
    return event;
  };

  window.addEventListener('plateplan:state-saved', event => {
    if (!savingThroughStore) publish(event.detail);
  });
  window.addEventListener('plateplan:remote-state-applied', event => publish(event.detail));

  return Object.freeze({
    getState: () => adapter.getState(),
    validate: () => validatePlatePlanState(adapter.getState()),
    save: (detail = {}) => {
      savingThroughStore = true;
      const saved = adapter.saveState();
      savingThroughStore = false;
      if (saved) publish(detail);
      return saved;
    },
    mutate: (reason, mutator, detail = {}) => {
      const state = adapter.getState();
      const result = mutator(state);
      savingThroughStore = true;
      const saved = adapter.saveState();
      savingThroughStore = false;
      if (saved) publish({ ...detail, reason });
      return { saved, result };
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish,
  });
}
