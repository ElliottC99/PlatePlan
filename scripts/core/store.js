import { validatePlatePlanState } from './contracts.js?v=3.0.9';

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
 * Safely parses any timestamp representation (Date string, Milliseconds, Firestore Timestamp) to Epoch milliseconds
 */
export function parseTimestamp(val) {
  if (!val) return 0;
  if (typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (val.seconds !== undefined) {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  if (val._seconds !== undefined) {
    return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1000000);
  }
  const d = new Date(val);
  const time = d.getTime();
  return isNaN(time) ? 0 : time;
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
      const localTime = parseTimestamp(localR.updatedAt);
      const cloudTime = parseTimestamp(cloudR.updatedAt);

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

/**
 * Resilient plan deletion with synchronous state update, UI re-render, and try/catch rollback
 */
export async function deletePlan(planId) {
  if (!window.state) window.state = {};
  const previousPlan = window.state.plan ? JSON.parse(JSON.stringify(window.state.plan)) : {};

  // 1. Clear plan from state: state.plan = {}
  window.state.plan = {};
  if (typeof state !== 'undefined' && state) {
    state.plan = {};
  }

  // 2. Erase from localStorage
  localStorage.removeItem('plateplan_plan_backup');

  // 3. Synchronously call renderAll()
  if (typeof window.renderAll === 'function') {
    window.renderAll();
  }

  // 4. Run Firestore update within a try/catch
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      const householdDocRef = db.collection('households').doc(householdId);
      await householdDocRef.collection('plans').doc('current').delete();
      const fb = window.firebase || (window.PLATEPLAN_FIREBASE && window.PLATEPLAN_FIREBASE.firebase) || (window.firebaseObj);
      if (fb) {
        await householdDocRef.update({ plan: fb.firestore.FieldValue.delete() });
      }
    }
  } catch (err) {
    console.error('[PLAN DELETE ERROR - ROLLING BACK]', err);
    // 5. Rollback to restore the local state.plan from its in-memory clone and re-render
    window.state.plan = previousPlan;
    if (typeof state !== 'undefined' && state) {
      state.plan = previousPlan;
    }
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to delete plan from cloud. Plan restored.', 'error');
    }
  }
}
