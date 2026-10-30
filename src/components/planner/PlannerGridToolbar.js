/**
 * src/components/planner/PlannerGridToolbar.js (v3.20.14)
 * UI component for planner week controls, date range selectors,
 * banners, clear plan modal triggers, and target setters.
 */
export function renderPlannerEmptyError() {
  return `
    <div class="card" style="padding:24px;text-align:center;margin:16px 0;">
      <h3 style="margin-top:0">Unable to display meal plan</h3>
      <p style="color:var(--text2);font-size:13px">There was an unexpected error rendering the meal planner schedule.</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn btn-primary primary sm" onclick="renderPlan()">Reload Plan</button>
        <button class="btn btn-ghost ghost sm" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button>
      </div>
    </div>
  `;
}

export function renderPlanDaySlotRow({ d, sl, isEx, showRecipe, r, rId, instanceId, slotInfo, lblLines, calStr, rowPerson, rowCal, rowProt, slotReason, slotReasonLabel, isPinned }) {
  const rowAttrs = showRecipe ? ` data-plan-person="${rowPerson}" data-plan-cal="${rowCal}" data-plan-prot="${rowProt}"` : '';
  const slotActionsHtml = showRecipe
    ? `<div class="slot-actions"><span class="slot-macro">${calStr}</span><button class="btn sm btn-primary primary" onclick="viewRecipe('${rId}', '${instanceId || ''}', '${slotInfo.variant}')">View</button><button class="btn sm btn-ghost ghost" onclick="openSwapMealModal(${d},'${sl.key}')">Swap</button><button class="btn sm btn-ghost ghost" onclick="openPlannedMealActions(${d},'${sl.key}')">More</button></div>`
    : `<div class="slot-actions"><button class="btn sm btn-ghost ghost" onclick="openSwapMealModal(${d},'${sl.key}')">Choose Meal</button>${slotReason ? `<button class="btn sm btn-ghost ghost" onclick="clearPlanSlotReason(${d},'${sl.key}')">Clear reason</button>` : ''}</div>`;
  const emptyContent = slotReason ? `<span class="plan-slot-reason">${slotReasonLabel}</span>` : '<span style="color:var(--text3)">Not set</span>';
  return `<div class="slot-row"${rowAttrs}><span class="slot-lbl" style="color:${window.SLOT_COLORS[sl.key]}">${lblLines[0]}<br>${lblLines[1]}</span>${isEx ? '<span class="slot-skipped">Not needed</span>' : `<span class="slot-name">${r ? r.name : emptyContent}${slotInfo?.variant === 'enhanced' ? ' <span class="tag green">Enhanced</span>' : ''}${isPinned ? ' <span class="tag pinned" title="Pre-selected recipe">Pinned</span>' : ''}</span>${slotActionsHtml}`}</div>`;
}
