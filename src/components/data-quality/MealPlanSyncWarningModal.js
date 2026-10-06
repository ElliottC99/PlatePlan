/**
 * src/components/data-quality/MealPlanSyncWarningModal.js
 * Warning overlay when meal plan snapshots are out of sync with recipe templates.
 * Allows atomic syncing of current active week meal plan slot macros.
 */

import { getState, setCurrentPlan } from '../../store/store.js';
import { saveCurrentPlan } from '../../services/HouseholdRepository.js';

const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openMealPlanSyncWarningModal(issue = {}) {
  const state = getState() || {};
  const currentPlan = state.currentPlan || null;

  if (!currentPlan) {
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('No active meal plan found to sync.', 'warning');
    }
    return;
  }

  const { dayKey, mealKey, recipeId, recipeName, nodeCal, nodeProt, tempCal, tempProt } = issue;

  let modal = document.getElementById('meal-plan-sync-warning-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'meal-plan-sync-warning-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'modal active';
  modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';

  modal.innerHTML = `
    <div class="card" style="width:100%; max-width:500px; padding:24px; border-radius:14px; background:var(--surface,#fff); box-shadow:0 12px 36px rgba(0,0,0,0.25); display:flex; flex-direction:column; box-sizing:border-box;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div>
          <h2 style="font-size:18px; font-weight:750; margin:0; color:var(--text,#1c1917);">Active Meal Plan Desync Warning</h2>
          <p style="font-size:12.5px; color:var(--text2,#78716c); margin:4px 0 0 0;">Outdated recipe macro snapshots detected inside your active weekly meal plan.</p>
        </div>
        <button type="button" class="btn sm ghost" style="padding:4px 8px; font-size:16px; line-height:1;" onclick="window.closeMealPlanSyncWarningModal()">✕</button>
      </div>

      <div style="padding:14px; background:#fffbf7; border:1px solid #fed7aa; border-radius:10px; margin-bottom:18px;">
        <div style="font-weight:700; font-size:13px; color:#c2410c; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          <span>⚠️ Snapshot Comparison:</span> <strong>${escapeHtml(recipeName)}</strong>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; text-align:center; font-size:13px; margin-top:10px;">
          <div style="background:#fef3c7; padding:8px; border-radius:6px; border:1px solid #fde68a;">
            <div style="font-weight:700; color:#92400e; font-size:11px; text-transform:uppercase;">Active Plan Slot</div>
            <strong style="font-size:14px; color:#78350f;">${Math.round(nodeCal)} kcal</strong>
            <div style="font-size:11px; color:#b45309;">Protein: ${nodeProt}g</div>
          </div>
          <div style="background:#dcfce7; padding:8px; border-radius:6px; border:1px solid #bbf7d0;">
            <div style="font-weight:700; color:#166534; font-size:11px; text-transform:uppercase;">Base Recipe Template</div>
            <strong style="font-size:14px; color:#15803d;">${Math.round(tempCal)} kcal</strong>
            <div style="font-size:11px; color:#16a34a;">Protein: ${tempProt}g</div>
          </div>
        </div>
      </div>

      <p style="font-size:12.5px; color:var(--text2); line-height:1.5; margin:0 0 20px 0;">
        Would you like to synchronise this meal slot to use the latest base template macros, or preserve the static snapshot?
      </p>

      <div style="display:flex; flex-direction:column; gap:8px;">
        <button type="button" id="btn-sync-active-plan" class="btn primary" style="font-weight:700; padding:10px; border-radius:8px; background:var(--primary,#4f46e5); color:#fff; cursor:pointer;">
          🔄 Update Active Week Meal Plan Snapshots
        </button>
        <button type="button" id="btn-preserve-snapshot" class="btn ghost" style="padding:10px; border-radius:8px; border:1px solid var(--border); cursor:pointer;">
          Keep Base Template Only (Preserve Snapshot)
        </button>
      </div>
    </div>
  `;

  // Option 1: Update Active Week Meal Plan Snapshots
  document.getElementById('btn-sync-active-plan').onclick = async () => {
    window.closeMealPlanSyncWarningModal();

    const plan = { ...currentPlan };
    if (plan.slots && plan.slots[dayKey] && plan.slots[dayKey][mealKey]) {
      const node = { ...plan.slots[dayKey][mealKey] };

      // Update the snapshot macros to match the base template
      node.cal = tempCal;
      node.calories = tempCal;
      node.protein = tempProt;
      node.prot = tempProt;
      if (node.macros) {
        node.macros.calories = tempCal;
        node.macros.cal = tempCal;
        node.macros.protein = tempProt;
        node.macros.prot = tempProt;
      }

      plan.slots[dayKey][mealKey] = node;

      // 1. Optimistic Store Update
      setCurrentPlan(plan);
      if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();

      // 2. Persist to Firestore
      try {
        await saveCurrentPlan(plan);
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Successfully synchronised meal plan snapshot.', 'success');
        }
      } catch (e) {
        console.error('[MealPlanSyncWarningModal] Failed to save plan:', e);
        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Failed to save meal plan online. Rolled back.', 'error');
        }
        // Rollback
        setCurrentPlan(currentPlan);
        if (typeof window.renderDataQualityView === 'function') window.renderDataQualityView();
      }
    }
  };

  // Option 2: Keep Base Template Only
  document.getElementById('btn-preserve-snapshot').onclick = () => {
    window.closeMealPlanSyncWarningModal();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Preserved static snapshot macros.', 'info');
    }
  };
}

export function closeMealPlanSyncWarningModal() {
  const modal = document.getElementById('meal-plan-sync-warning-modal');
  if (modal) {
    modal.className = 'modal';
    modal.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.openMealPlanSyncWarningModal = openMealPlanSyncWarningModal;
  window.closeMealPlanSyncWarningModal = closeMealPlanSyncWarningModal;
}
