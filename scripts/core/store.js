import { validatePlatePlanState } from './contracts.js?v=3.1.0';
import { loadState, saveState } from './utils.js?v=3.1.0';

if (typeof window !== 'undefined') {
  window.state = window.state || {};
  window.state.deletedPlanIds = window.state.deletedPlanIds || [];
  window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;
}

/**
 * Initialise window.state entirely through scripts/core/store.js
 */
export function initializeStoreState(legacy) {
  if (typeof window !== 'undefined') {
    if (legacy && typeof legacy.loadState === 'function') {
      window.state = legacy.loadState();
      window.appState = window.state;
    } else {
      window.state = loadState();
      window.appState = window.state;
    }
    window.state.deletedPlanIds = window.state.deletedPlanIds || [];
    window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;
  }
  return window.state;
}

/**
 * Filter out plans whose IDs are tracked in deletedPlanIds array
 */
export function filterPlansSnapshot(plansList, deletedList) {
  if (!Array.isArray(plansList)) return [];
  const list = deletedList || window.state?.deletedPlanIds || window.deletedPlanIds;
  if (!list || !Array.isArray(list) || list.length === 0) return plansList;
  return plansList.filter(plan => plan && !list.includes(plan.id) && !list.includes(plan.planId));
}

/**
 * Safely parses any timestamp representation to Epoch milliseconds
 */
export function parseTimestamp(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (ts && typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
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

      // Only overwrite if cloud timestamp is strictly newer than local timestamp
      if (!localTime || cloudTime > localTime) {
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

  const getState = () => adapter?.getState ? adapter.getState() : (window.state || {});

  const publish = detail => {
    const state = getState();
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
    getState,
    validate: () => validatePlatePlanState(getState()),
    save: (detail = {}) => {
      savingThroughStore = true;
      const saved = adapter?.saveState ? adapter.saveState() : saveState(getState());
      savingThroughStore = false;
      if (saved) publish(detail);
      return saved;
    },
    mutate: (reason, mutator, detail = {}) => {
      const state = getState();
      const result = mutator(state);
      savingThroughStore = true;
      const saved = adapter?.saveState ? adapter.saveState() : saveState(getState());
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

  // Purge backup key
  localStorage.removeItem('plateplan_plan_backup');

  // Migrate to Array and add deleted ID
  window.state.deletedPlanIds = window.state.deletedPlanIds || [];
  if (!window.state.deletedPlanIds.includes(planId)) {
    window.state.deletedPlanIds.push(planId);
  }
  // Remove the plan from the local array
  window.state.plans = (window.state.plans || []).filter(p => p.id !== planId);
  localStorage.setItem('plateplan_v2', JSON.stringify(window.state));

  // 1. Clear plan from state: state.plan = {}
  window.state.plan = {};
  if (typeof state !== 'undefined' && state) {
    state.plan = {};
  }

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
