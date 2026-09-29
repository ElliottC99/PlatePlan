/**
 * src/components/generator/GeneratorWizardModal.js (v3.8.4)
 * Modular UI component for Meal Plan Generator Wizard Lifecycle:
 * - 4-step wizard container & stepper tabs (Configure, Review, Shopping, Commit)
 * - Wizard state management & navigation
 * - Step progress indicators & transitions
 * - Plan commit, reset, and confirmation handlers
 */

import { renderConstraintsForm } from './GeneratorConstraintsForm.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Returns the current active wizard step (1 to 4).
 */
export function getPlannerWizardStep(stateObj = null) {
  const current = stateObj || (typeof window !== 'undefined' ? window.state : null);
  if (current?.plannerStep && [1, 2, 3, 4].includes(current.plannerStep)) {
    return current.plannerStep;
  }
  if (current?.plan?.slots && Object.keys(current.plan.slots).length > 0) {
    return 2; // Default to Review Plan if active plan exists
  }
  return 1; // Otherwise start with Configure Requests
}

/**
 * Updates wizard step and triggers re-render.
 */
export function setPlannerWizardStep(step) {
  const nextStep = Math.max(1, Math.min(4, step));
  if (typeof state !== 'undefined' && state) state.plannerStep = nextStep;
  if (typeof window !== 'undefined' && window.state) window.state.plannerStep = nextStep;
  if (typeof window !== 'undefined' && typeof window.renderPlannerWizard === 'function') {
    window.renderPlannerWizard();
  }
}

/**
 * Renders the top wizard stepper navigation header.
 */
export function renderWizardStepper(currentStep = 1, hasActivePlan = false) {
  return `
    <div class="planner-wizard-stepper">
      <button type="button" class="wizard-step-btn ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}" onclick="setPlannerWizardStep(1)">
        <span class="wizard-step-badge">1</span>
        <span>Configure Requests</span>
      </button>
      <span style="color:var(--border-strong);font-weight:bold">→</span>
      <button type="button" class="wizard-step-btn ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}" ${!hasActivePlan ? 'disabled' : ''} onclick="setPlannerWizardStep(2)">
        <span class="wizard-step-badge">2</span>
        <span>Review Plan</span>
      </button>
      <span style="color:var(--border-strong);font-weight:bold">→</span>
      <button type="button" class="wizard-step-btn ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}" ${!hasActivePlan ? 'disabled' : ''} onclick="setPlannerWizardStep(3)">
        <span class="wizard-step-badge">3</span>
        <span>Shopping & Substitutions</span>
      </button>
      <span style="color:var(--border-strong);font-weight:bold">→</span>
      <button type="button" class="wizard-step-btn ${currentStep === 4 ? 'active' : ''}" ${!hasActivePlan ? 'disabled' : ''} onclick="setPlannerWizardStep(4)">
        <span class="wizard-step-badge">4</span>
        <span>Commit Plan</span>
      </button>
    </div>
  `;
}

/**
 * Renders the full wizard view shell with header and content.
 */
export function renderPlannerWizardView({
  currentStep = 1,
  hasActivePlan = false,
  stepContentHtml = ''
}) {
  return `
    <div class="planner-wizard-container">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <div>
          <h1 style="margin:0;font-size:20px;font-weight:750;color:var(--text);letter-spacing:-0.02em">Meal Planner</h1>
          <div style="font-size:12.5px;color:var(--text2);margin-top:2px">Configure household requests, review daily macro scores, customize shopping, and commit.</div>
        </div>
        <button type="button" class="btn ghost sm" style="display:flex;align-items:center;gap:6px;color:var(--red,#dc2626);border-color:var(--red,#dc2626);font-weight:600" onclick="resetPlannerStartFresh()">
          <span>↺</span> Start Fresh
        </button>
      </div>

      ${renderWizardStepper(currentStep, hasActivePlan)}

      <div class="pp-wizard-step-content" style="margin-top:16px">
        ${stepContentHtml}
      </div>
    </div>
  `;
}

/**
 * Renders Step 4 (Atomic Commit Plan UI).
 */
export function renderWizardStep4Commit(version = 'v3.8.4') {
  return `
    <div class="card" style="padding:28px;text-align:center">
      <h2 style="margin-top:0">Committing Meal Plan ${escapeHtml(version)}...</h2>
      <p style="color:var(--text2);font-size:13px;margin-bottom:18px">Finalizing plan metadata, locking shopping quantities, and synchronizing with your live dashboard.</p>
      <button type="button" class="btn primary" onclick="commitPlannerWizardPlan()">Commit Plan Now</button>
    </div>
  `;
}

/**
 * Renders Empty Plan fallback placeholder for Steps 2 & 3.
 */
export function renderWizardEmptyPlanCard(stepNumber = 2) {
  const msg = stepNumber === 2 ? 'Configure your days and requests in Step 1 to generate your meal plan.' : 'Generate a meal plan first before viewing the shopping list.';
  return `
    <div class="card" style="padding:24px;text-align:center">
      <h3>No Meal Plan Active</h3>
      <p style="color:var(--text2);font-size:13px;margin-bottom:14px">${escapeHtml(msg)}</p>
      <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1: Configure Requests</button>
    </div>
  `;
}
