/**
 * src/components/planner/PlannerDayCard.js (v3.20.12)
 * UI component for day containers, date headers, daily macro target bars,
 * and day action controls in the PlatePlan weekly planner.
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

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function renderPersonSummaryBox(personKey, daySummary) {
  const name = personKey === 'e' ? 'Elliott' : 'Chloe';
  const total = daySummary?.totals?.[personKey] || { cal: 0, prot: 0 };
  const tgt = daySummary?.targets?.[personKey] || { cal: 2000, prot: 100 };
  
  const calDelta = Math.round(total.cal - tgt.cal);
  const protDelta = Math.round(total.prot - tgt.prot);
  
  const calColor = Math.abs(calDelta) <= 100 ? 'var(--green, #10b981)' : Math.abs(calDelta) <= 250 ? 'var(--amber, #f59e0b)' : 'var(--red, #ef4444)';
  const protColor = protDelta >= 0 ? 'var(--green, #10b981)' : protDelta >= -10 ? 'var(--amber, #f59e0b)' : 'var(--red, #ef4444)';
  
  const fmtCalDelta = `${calDelta >= 0 ? '+' : ''}${calDelta} kcal`;
  const fmtProtDelta = `${protDelta >= 0 ? '+' : ''}${protDelta}g`;

  const assumedText = daySummary?.assumed?.[personKey]?.labels?.length
    ? `<div style="color:var(--text3);font-size:11px;margin-top:3px">Assumes covered: ${escapeHtml([...new Set(daySummary.assumed[personKey].labels)].join(', '))}</div>`
    : '';

  return `<strong>${name}</strong>
    <div style="color:${calColor}">${Math.round(total.cal)} / ${tgt.cal} kcal · ${fmtCalDelta}</div>
    <div style="color:${protColor}">P ${Number(total.prot).toFixed(1)} / ${tgt.prot}g · ${fmtProtDelta}</div>
    ${assumedText}`;
}

export function renderDayPlanCard({
  day,
  dayLabel,
  dayDate = '',
  isAllExcluded = false,
  daySummary = null,
  dayRowsHtml = '',
  score = 0
}) {
  if (isAllExcluded) {
    return `
      <div class="day-plan-card skipped">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap">
          <label for="planner-date-day-${day}" style="font-weight:700">${escapeHtml(dayLabel)}</label>
          <input type="date" id="planner-date-day-${day}" name="planner-date-day-${day}" aria-label="Date for day ${day}" value="${escapeAttr(dayDate)}" data-action="set-plan-day-date" data-day="${day}" style="width:auto">
          <span style="color:var(--text3)">-- no meals planned</span>
        </div>
      </div>
    `;
  }

  const summaryHtml = ['e', 'c'].map(p => `
    <div class="summary-box">${renderPersonSummaryBox(p, daySummary)}</div>
  `).join('');

  return `
    <div class="day-plan-card">
      <div class="row-between" style="margin-bottom:10px;gap:8px;flex-wrap:wrap">
        <div class="plan-date-control">
          <label for="planner-date-day-${day}" style="font-size:13px;font-weight:600;display:block;margin-bottom:2px">${escapeHtml(dayLabel)}</label>
          <input type="date" id="planner-date-day-${day}" name="planner-date-day-${day}" aria-label="Date for day ${day}" value="${escapeAttr(dayDate)}" data-action="set-plan-day-date" data-day="${day}">
        </div>
        <span class="tag" title="Lower is better. Calories miss plus protein shortfall.">Score ${score}</span>
      </div>
      <div class="plan-summary">${summaryHtml}</div>
      ${dayRowsHtml}
    </div>
  `;
}

export function renderDenseDayCard({
  day,
  dateLabel,
  eCal = 0,
  eProt = 0,
  cCal = 0,
  cProt = 0,
  dayPreps = [],
  mealsHtml = ''
}) {
  return `
    <div class="dense-plan-day-card">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px">
        <div>
          <span style="font-weight:750;font-size:14px;color:var(--text)">Day ${day}</span>
          <span style="font-size:12px;color:var(--text2);margin-left:6px">${escapeHtml(dateLabel)}</span>
        </div>
        <div style="font-size:11px;font-weight:650;color:var(--text2)">
          E: ${Math.round(eCal)} kcal · ${Math.round(eProt)}g | C: ${Math.round(cCal)} kcal · ${Math.round(cProt)}g
        </div>
      </div>

      ${dayPreps.map(p => `
        <div class="batch-prep-badge">
          🍱 Batch Prep (${p.days.length} days: Day ${p.days.join(', ')})
        </div>
      `).join('')}

      <div style="display:flex;flex-direction:column;gap:8px">
        ${mealsHtml}
      </div>
    </div>
  `;
}
