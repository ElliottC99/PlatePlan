import { createLegacyView } from './create-legacy-view.js?v=3.0.9';

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

export default createLegacyView({ id: 'planner', rootId: 'view-planner' });
