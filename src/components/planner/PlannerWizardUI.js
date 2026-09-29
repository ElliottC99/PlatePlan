/**
 * src/components/planner/PlannerWizardUI.js (v3.9.8)
 * Modular Presentation Component for Meal Planner Generator Wizard & Setup Cards
 */

export function renderPlannerWizardView({ currentStep = 1, hasActivePlan = false, stepContentHtml = '' } = {}) {
  const steps = [
    { num: 1, label: 'Requests' },
    { num: 2, label: 'Review' },
    { num: 3, label: 'Shopping' },
    { num: 4, label: 'Commit' }
  ];

  const stepsHtml = steps.map(s => {
    const isActive = s.num === currentStep;
    const isCompleted = s.num < currentStep;
    const cls = isActive ? 'active' : (isCompleted ? 'completed' : '');
    return `
      <button type="button" class="wizard-step-item ${cls}" onclick="setPlannerWizardStep(${s.num})" ${s.num > 1 && !hasActivePlan && s.num !== currentStep ? 'disabled' : ''}>
        <span class="step-badge">${isCompleted ? '✓' : s.num}</span>
        <span class="step-label">${s.label}</span>
      </button>
    `;
  }).join('<div class="step-divider"></div>');

  return `
    <div class="planner-wizard-container" style="display:flex;flex-direction:column;gap:16px;margin-bottom:20px">
      <div class="wizard-step-banner" style="display:flex;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 16px;box-shadow:var(--shadow-sm)">
        <div style="display:flex;align-items:center;gap:8px;width:100%;justify-content:space-between">
          ${stepsHtml}
        </div>
      </div>
      <div class="wizard-step-body">
        ${stepContentHtml}
      </div>
    </div>
  `;
}

export function renderPlanSetupCard({ daysVal = 7, startVal = '', isExpanded = false } = {}) {
  return `
    <div id="plan-setup-card" class="card" style="padding:16px 20px;margin-bottom:16px;background:var(--surface)">
      <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="togglePlanSetupCollapse()">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:16px">⚙️</span>
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--text)">Meal Plan Configuration</div>
            <div style="font-size:12px;color:var(--text2)">${daysVal} days starting ${startVal || 'Today'}</div>
          </div>
        </div>
        <button type="button" class="btn ghost sm" aria-label="Toggle setup parameters">${isExpanded ? '▲ Hide' : '▼ Edit Setup'}</button>
      </div>
    </div>
  `;
}

export function renderBatchPrepPanel(prepGroups = []) {
  if (!prepGroups || !prepGroups.length) return '';
  const groupCards = prepGroups.map(g => `
    <div class="prep-group-card" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-top:8px">
      <div style="font-size:13px;font-weight:700;color:var(--text)">🍳 Batch Cook: ${g.recipeName || 'Planned Meal'}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:2px">Cook on Day ${g.cookDay || 1} for Days ${(g.days || []).join(', ')} (${g.portions || 2} portions)</div>
    </div>
  `).join('');

  return `
    <div id="plan-meal-prep-panel" class="card" style="padding:16px;margin-bottom:16px;background:var(--purple-bg, #f5f3ff);border:1px solid var(--purple-border, #ddd6fe)">
      <div style="font-size:14px;font-weight:700;color:var(--purple, #6d28d9);display:flex;align-items:center;gap:6px">
        <span>⚡ Smart Batch Cook Suggestions</span>
      </div>
      ${groupCards}
    </div>
  `;
}
