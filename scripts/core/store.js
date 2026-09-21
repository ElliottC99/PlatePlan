import { validatePlatePlanState } from './contracts.js?v=3.0.8';

if (typeof window !== 'undefined') {
  window.state = window.state || {};
  window.state.deletedPlanIds = window.state.deletedPlanIds || new Set();
  window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;
}

/**
 * Filter out plans whose IDs are tracked in deletedPlanIds set
 */
export function filterPlansSnapshot(plansList, deletedSet) {
  if (!Array.isArray(plansList)) return [];
  const set = deletedSet || window.state?.deletedPlanIds || window.deletedPlanIds;
  if (!set || !(set instanceof Set) || set.size === 0) return plansList;
  return plansList.filter(plan => plan && !set.has(plan.id) && !set.has(plan.planId));
}

/**
 * Merge incoming cloud recipe snapshot with local state recipes, preserving local optimistic edits
 */
export function mergeRecipesSnapshot(localRecipes, cloudRecipes) {
  const localList = Array.isArray(localRecipes) ? localRecipes : [];
  const cloudList = Array.isArray(cloudRecipes) ? cloudRecipes : [];
  const recipeMap = new Map();

  localList.forEach(r => {
    if (r && r.id) recipeMap.set(String(r.id), { ...r });
  });

  cloudList.forEach(cloudR => {
    if (!cloudR) return;
    const id = String(cloudR.id || cloudR.recipeId || '');
    if (!id) return;

    if (recipeMap.has(id)) {
      const localR = recipeMap.get(id);
      const localTime = new Date(localR.updatedAt || 0).getTime() || Number(localR.updatedAt || 0);
      const cloudTime = new Date(cloudR.updatedAt || 0).getTime() || Number(cloudR.updatedAt || 0);

      // Only overwrite if cloud timestamp is equal to or newer than local timestamp
      if (!localTime || cloudTime >= localTime) {
        recipeMap.set(id, { ...localR, ...cloudR });
      }
    } else {
      recipeMap.set(id, { ...cloudR });
    }
  });

  return Array.from(recipeMap.values());
}

/**
 * Small observable adapter around PlatePlan's existing local-first state.
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

  if (typeof window !== 'undefined') {
    window.addEventListener('plateplan:state-saved', event => {
      if (!savingThroughStore) publish(event.detail);
    });
    window.addEventListener('plateplan:remote-state-applied', event => publish(event.detail));
  }

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
    filterPlansSnapshot,
    mergeRecipesSnapshot
  });
}
