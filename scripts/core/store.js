import { validatePlatePlanState } from './contracts.js?v=3.3.5';
import { pushStateToCloud } from '../services/firebase-service.js?v=3.3.5';

// Purge legacy backup keys on startup to prevent state resurrection bugs
if (typeof localStorage !== 'undefined') {
  ['plateplan_plan_backup', 'plateplan_offline_backup', 'plateplan_history_v2', 'plateplan_v1'].forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Decorates an array with standard Set-like .has() and .size properties
 * non-enumberably, so they do not show up in JSON.stringify() operations.
 */
export function decorateDeletedPlanIds(arr) {
  if (!Array.isArray(arr)) arr = [];
  if (!Object.prototype.hasOwnProperty.call(arr, 'has')) {
    Object.defineProperty(arr, 'has', {
      value: function(val) {
        return this.includes(val);
      },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
  if (!Object.prototype.hasOwnProperty.call(arr, 'size')) {
    Object.defineProperty(arr, 'size', {
      get: function() {
        return this.length;
      },
      configurable: true,
      enumerable: false
    });
  }
  return arr;
}

if (typeof window !== 'undefined') {
  window.state = window.state || {};
  window.plateplanSubscribers = window.plateplanSubscribers || [];
  
  // Sanitize initial deletedPlanIds
  let deletedList = window.state.deletedPlanIds;
  if (deletedList instanceof Set) {
    deletedList = Array.from(deletedList);
  }
  window.state.deletedPlanIds = decorateDeletedPlanIds(deletedList || []);

  // Intercept window.deletedPlanIds on window
  Object.defineProperty(window, 'deletedPlanIds', {
    get: function() {
      if (window.state && window.state.deletedPlanIds) {
        if (!(window.state.deletedPlanIds instanceof Set) && !Object.prototype.hasOwnProperty.call(window.state.deletedPlanIds, 'has')) {
          decorateDeletedPlanIds(window.state.deletedPlanIds);
        }
        return window.state.deletedPlanIds;
      }
      return [];
    },
    set: function(val) {
      if (val instanceof Set) {
        val = Array.from(val);
      }
      if (window.state) {
        window.state.deletedPlanIds = decorateDeletedPlanIds(val || []);
      }
    },
    configurable: true,
    enumerable: true
  });
}

export function subscribeToStore(callback) {
  if (typeof callback !== 'function') return () => {};
  if (typeof window !== 'undefined') {
    window.plateplanSubscribers = window.plateplanSubscribers || [];
    window.plateplanSubscribers.push(callback);
    return () => {
      window.plateplanSubscribers = window.plateplanSubscribers.filter(cb => cb !== callback);
    };
  }
  return () => {};
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

  const publish = detail => {
    const state = adapter.getState();
    const validation = validatePlatePlanState(state);
    const event = { state, validation, detail: detail || {} };
    listeners.forEach(listener => {
      try { listener(event); } catch (error) { console.error('PlatePlan store listener failed', error); }
    });
    if (typeof window !== 'undefined' && Array.isArray(window.plateplanSubscribers)) {
      window.plateplanSubscribers.forEach(cb => {
        try { cb(state); } catch (e) { console.error('PlatePlan subscriber failed', e); }
      });
    }
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
      if (saved) {
        publish(detail);
        pushStateToCloud().catch(err => console.error('Cloud push failed on save:', err));
      }
      return saved;
    },
    mutate: (reason, mutator, detail = {}) => {
      const state = adapter.getState();
      const result = mutator(state);
      savingThroughStore = true;
      const saved = adapter.saveState();
      savingThroughStore = false;
      if (saved) {
        publish({ ...detail, reason });
        pushStateToCloud().catch(err => console.error('Cloud push failed on mutate:', err));
      }
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

  // Synchronously remove backup key
  localStorage.removeItem('plateplan_plan_backup');

  // Ensure window.state.deletedPlanIds is an Array and add deleted ID
  window.state.deletedPlanIds = window.state.deletedPlanIds || [];
  if (window.state.deletedPlanIds instanceof Set) {
    window.state.deletedPlanIds = Array.from(window.state.deletedPlanIds);
  }
  window.state.deletedPlanIds = decorateDeletedPlanIds(window.state.deletedPlanIds);
  if (!window.state.deletedPlanIds.includes(planId)) {
    window.state.deletedPlanIds.push(planId);
  }

  // Filter planId out of local plans array
  window.state.plans = (window.state.plans || []).filter(p => p && p.id !== planId && p.planId !== planId);

  // Clear current active plan if it matches the deleted planId
  if (window.state.plan && (window.state.plan.id === planId || window.state.plan.planId === planId)) {
    window.state.plan = {};
  }
  if (typeof state !== 'undefined' && state) {
    if (state.plan && (state.plan.id === planId || state.plan.planId === planId)) {
      state.plan = {};
    }
    state.plans = (state.plans || []).filter(p => p && p.id !== planId && p.planId !== planId);
  }

  // Persist state locally
  localStorage.setItem('plateplan_v2', JSON.stringify(window.state));

  // If the modular store exists, publish the update
  if (window.PlatePlanModules?.store) {
    try {
      window.PlatePlanModules.store.publish({ reason: 'plan-deletion', planId });
    } catch (e) {
      console.error('Store publish failed', e);
    }
  }

  // Synchronously re-render all UI
  if (typeof window.renderAll === 'function') {
    window.renderAll();
  }

  // Execute cloud deletion via Firestore deleteDoc within a safe try/catch block
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      const householdDocRef = db.collection('households').doc(householdId);
      const currentDocRef = householdDocRef.collection('plans').doc('current');
      
      const deleteDoc = async (docRef) => {
        if (typeof docRef.delete === 'function') {
          return await docRef.delete();
        }
      };

      await deleteDoc(currentDocRef);

      const fb = window.firebase || (window.PLATEPLAN_FIREBASE && window.PLATEPLAN_FIREBASE.firebase) || (window.firebaseObj);
      if (fb) {
        await householdDocRef.update({ plan: fb.firestore.FieldValue.delete() });
      }
    }
  } catch (err) {
    console.error('[PLAN DELETE ERROR - ROLLING BACK]', err);
    // Rollback: restore the local state.plan from its in-memory clone and re-render
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
