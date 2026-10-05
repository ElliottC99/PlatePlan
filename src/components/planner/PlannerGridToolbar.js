/**
 * src/components/planner/PlannerGridToolbar.js (v3.20.00)
 * UI component for planner week controls, date range selectors,
 * banners, clear plan modal triggers, and target setters.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function renderDraftPlanBanner() {
  return `
    <div class="card draft-plan-step-banner" style="background:var(--surface2);border:1.5px solid var(--action);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <div style="font-weight:750;font-size:15px;color:var(--text);display:flex;align-items:center;gap:6px">
            <span class="tag" style="background:var(--action);color:#fff;font-weight:700">Step 1 of 2</span>
            Review Generated Meal Plan
          </div>
          <div style="font-size:13px;color:var(--text2);margin-top:4px;line-height:1.4">
            Review your scheduled meals. When ready, proceed to the shopping list to check ingredients and confirm your plan. (Not saved yet)
          </div>
        </div>
        <div class="btn-row" style="margin:0;gap:8px;flex-wrap:wrap">
          <button class="btn ghost sm" onclick="discardDraftPlan()">Discard</button>
          <button class="btn primary sm" onclick="proceedDraftToShopping()" style="font-weight:700">Proceed to Shopping List →</button>
        </div>
      </div>
    </div>
  `;
}

export function renderPlanExpiredBanner(endLabel, tomorrowLabel) {
  return `
    <div class="card plan-expired-banner" style="background:var(--surface2);border:1px solid var(--border-strong);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
        <div style="width:38px;height:38px;border-radius:10px;background:var(--amber-bg);color:var(--amber);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;">
          ⏳
        </div>
        <div style="flex:1;min-width:220px">
          <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:3px">Current Meal Plan Ended (${escapeHtml(endLabel)})</div>
          <div style="font-size:13px;color:var(--text2);line-height:1.4">Your previous plan has completed. Ready for next week? Generate a fresh plan starting tomorrow (${escapeHtml(tomorrowLabel)}).</div>
          <div class="btn-row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn primary sm" onclick="generateNewPlanStartingTomorrow()">✨ Generate Plan Starting Tomorrow</button>
            <button type="button" class="btn ghost sm" onclick="openPlanSetupAndFocus()">⚙️ Setup Settings</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderEarlierDaysHeading(range, count, isExpanded) {
  return `
    <div class="plan-earlier-days-heading" id="plan-earlier-days-heading">
      <button type="button" class="plan-earlier-days-toggle" aria-expanded="${isExpanded}" onclick="togglePlatePlanEarlierDays()">
        <span><strong>Earlier days</strong><small>${escapeHtml(range)} · ${count} day${count === 1 ? '' : 's'}</small></span>
        <span aria-hidden="true">${isExpanded ? 'Hide' : 'Show'}</span>
      </button>
    </div>
  `;
}

export function renderPlanOverallSummary(score) {
  if (!score) return '';
  const scoreColor = score.score <= 10 ? 'var(--green)' : score.score <= 20 ? 'var(--amber)' : 'var(--red)';
  return `
    <div class="card" style="border-color:var(--green);margin-bottom:12px">
      <div>
        <h3 style="margin-bottom:6px;color:var(--green)">Meal plan summary</h3>
        <div class="plan-summary">
          <div class="summary-box"><strong>Elliott average</strong><div>${score.eAvg?.cal || 0} kcal / day</div><div>P ${score.eAvg?.prot || 0}g / day</div></div>
          <div class="summary-box"><strong>Chloe average</strong><div>${score.cAvg?.cal || 0} kcal / day</div><div>P ${score.cAvg?.prot || 0}g / day</div></div>
          <div class="summary-box"><strong>Overall score</strong><div style="font-size:22px;font-weight:700;color:${scoreColor}">${score.score}</div><div style="color:var(--text2)">Lower is better</div></div>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:6px">Missing meals and snacks are assumed to be covered outside PlatePlan.</div>
      </div>
    </div>
  `;
}

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
