/**
 * src/components/generator/GeneratorConstraintsForm.js (v3.19.77)
 * Modular UI component for Meal Plan Generator Constraint Controls:
 * - Target plan duration & start date selectors
 * - Meal repeat cadence & batch prep frequency toggles
 * - Macro target fit score tolerance & filter options
 * - Slot exclusions, pinned recipes, and pantry use-up ingredient tags
 */

import { renderFitScoreScopeUI, renderSkeletonGridUI } from '../planner/PlannerSkeletonGridUI.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders the full constraints configuration panel for Step 1 of the generator wizard.
 */
export function renderConstraintsForm({
  daysVal = 7,
  startVal = '',
  cadence = { breakfast: 1, lunch: 2, dinner: 2 },
  minFitScore = 0,
  maxFitScore = 100,
  skeletonGrid = {}
} = {}) {
  const currentMin = typeof window !== 'undefined' && window.state?.prefs?.minFitScore !== undefined ? window.state.prefs.minFitScore : minFitScore;
  const currentMax = typeof window !== 'undefined' && window.state?.prefs?.maxFitScore !== undefined ? window.state.prefs.maxFitScore : maxFitScore;
  const currentGrid = typeof window !== 'undefined' && window.state?.skeletonGrid ? window.state.skeletonGrid : skeletonGrid;

  return `
    <div class="card pp-generator-constraints-card" style="padding:20px;display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Step 1: Configure Plan Requests</h2>
          <div style="font-size:13px;color:var(--text2);margin-top:4px">Define days, cadence, fit score scope, and anchor slots before generating.</div>
        </div>
        <button type="button" class="btn primary" style="font-weight:700;padding:8px 18px" onclick="generatePlan()">✨ Generate Plan</button>
      </div>

      <!-- Parameters Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
        <div>
          <label for="wizard-plan-days" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">PLAN LENGTH</label>
          <select id="wizard-plan-days" name="plannerDays" aria-label="Plan duration in days" class="select" style="width:100%" onchange="state.plannerDays=parseInt(this.value)||7;if(window.state)window.state.plannerDays=state.plannerDays;saveState();if(typeof renderPlannerWizard==='function')renderPlannerWizard();">
            ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => `<option value="${n}" ${n === daysVal ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="wizard-plan-start" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">START DATE</label>
          <input type="date" id="wizard-plan-start" name="plannerStartDate" aria-label="Plan start date" class="input" style="width:100%" value="${escapeAttr(startVal)}" onchange="state.plannerStartDate=this.value;if(window.state)window.state.plannerStartDate=this.value;saveState();if(typeof renderPlannerWizard==='function')renderPlannerWizard();">
        </div>
        <div>
          <label for="wizard-cadence-breakfast" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">BREAKFAST REPEAT</label>
          <select id="wizard-cadence-breakfast" name="cadenceBreakfast" aria-label="Breakfast repeat cadence" class="select" style="width:100%" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.breakfast=parseInt(this.value)||1;saveState();">
            ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cadence.breakfast ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="wizard-cadence-lunch" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">LUNCH REPEAT</label>
          <select id="wizard-cadence-lunch" name="cadenceLunch" aria-label="Lunch repeat cadence" class="select" style="width:100%" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.lunch=parseInt(this.value)||2;saveState();">
            ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cadence.lunch ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="wizard-cadence-dinner" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">DINNER REPEAT</label>
          <select id="wizard-cadence-dinner" name="cadenceDinner" aria-label="Dinner repeat cadence" class="select" style="width:100%" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.dinner=parseInt(this.value)||2;saveState();">
            ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cadence.dinner ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Dual-Dot Fit Score Scope Timeline -->
      ${renderFitScoreScopeUI({ minVal: currentMin, maxVal: currentMax })}

      <!-- Interactive Pre-Generation Skeleton Grid -->
      ${renderSkeletonGridUI({ days: daysVal, startDate: startVal, skeletonGrid: currentGrid })}

      <div style="display:flex;justify-content:flex-end;margin-top:6px">
        <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px;font-size:14px" onclick="generatePlan()">✨ Generate Meal Plan →</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Pantry Use-Up sub-panel.
 */
export function renderUseUpPanel(useUp) {
  return `
    <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Pantry Use-Up (${useUp.length})</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Prioritise recipes that use ingredients expiring in your pantry.</div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${useUp.length === 0 ? '<span style="font-size:12px;color:var(--text3)">No items designated for pantry use-up.</span>' : ''}
        ${useUp.map(id => {
          const prod = typeof getProduct === 'function' ? getProduct(id) : null;
          return `
            <span class="inline-search-chip">
              🥫 ${escapeHtml(prod?.name || 'Product')}
              <button type="button" onclick="removeWizardUseUpProduct('${escapeAttr(id)}')">✕</button>
            </span>
          `;
        }).join('')}
      </div>

      <label for="wizard-useup-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search product to use up</label>
      <input type="search" id="wizard-useup-search" name="useUpProductSearch" aria-label="Search product to use up" class="input sm" placeholder="Search product to use up..." style="width:100%" oninput="filterWizardUseUpProducts(this.value)">
      <div id="wizard-useup-search-results" style="margin-top:6px;max-height:140px;overflow-y:auto;display:none;background:var(--surface);border:1px solid var(--border);border-radius:8px"></div>
    </div>
  `;
}
