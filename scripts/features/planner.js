import { createLegacyView } from './create-legacy-view.js?v=3.0.8';

/**
 * Resilient plan deletion with synchronous state update, UI re-render, and try/catch rollback
 */
export async function deletePlan(planId) {
  if (!planId) return;

  if (!window.state) window.state = {};
  window.state.deletedPlanIds = window.state.deletedPlanIds || new Set();
  window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;

  // 1. Synchronously add planId to window.state.deletedPlanIds
  window.state.deletedPlanIds.add(planId);

  // Preserve removed plan for rollback
  let previousPlan = null;
  if (Array.isArray(window.state.plans)) {
    previousPlan = window.state.plans.find(p => p && (p.id === planId || p.planId === planId));
    // 2. Synchronously filter planId out of window.state.plans
    window.state.plans = window.state.plans.filter(p => p && p.id !== planId && p.planId !== planId);
  }

  // 3. Trigger a UI re-render
  if (typeof window.renderPlanHistory === 'function') window.renderPlanHistory();
  if (typeof window.renderPlan === 'function') window.renderPlan();
  if (typeof window.renderAll === 'function') window.renderAll();

  // 4. Execute the Firestore deleteDoc wrapped in a try/catch
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      await db.collection('households').doc(householdId).collection('plans').doc(planId).delete();
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Plan deleted successfully. ✓');
      }
    }
  } catch (err) {
    console.error('[PLAN DELETE ERROR - ROLLING BACK]', err);
    // 5. In the catch block, remove planId from deleted set, restore it to plans, re-render, and show error toast
    window.state.deletedPlanIds.delete(planId);
    if (previousPlan) {
      if (!Array.isArray(window.state.plans)) window.state.plans = [];
      window.state.plans.push(previousPlan);
    }
    if (typeof window.renderPlanHistory === 'function') window.renderPlanHistory();
    if (typeof window.renderPlan === 'function') window.renderPlan();
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to delete plan from cloud. Restored.', 'error');
    }
  }
}

export default createLegacyView({ id: 'planner', rootId: 'view-planner' });
