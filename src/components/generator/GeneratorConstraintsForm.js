/**
 * src/components/generator/GeneratorConstraintsForm.js (v3.8.4)
 * Modular UI component for Meal Plan Generator Constraint Controls:
 * - Target plan duration & start date selectors
 * - Meal repeat cadence & batch prep frequency toggles
 * - Macro target fit score tolerance & filter options
 * - Slot exclusions, pinned recipes, and pantry use-up ingredient tags
 */

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
  daysVal = 10,
  startVal = '',
  cadence = { breakfast: 1, lunch: 2, dinner: 2 },
  minFitScore = 0,
  activeExclusions = [],
  pinned = [],
  useUp = []
}) {
  return `
    <div class="card pp-generator-constraints-card" style="padding:20px;display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:700">Step 1: Configure Plan Requests</h2>
          <div style="font-size:13px;color:var(--text2);margin-top:4px">Define days, meal repeat cadence, skips, and pinned recipes before generating.</div>
        </div>
        <button type="button" class="btn primary" style="font-weight:700;padding:8px 18px" onclick="generatePlan()">✨ Generate Plan</button>
      </div>

      <!-- Parameters Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
        <div>
          <label for="wizard-plan-days" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">PLAN LENGTH</label>
          <select id="wizard-plan-days" name="plannerDays" aria-label="Plan duration in days" class="select" style="width:100%" onchange="state.plannerDays=parseInt(this.value)||10;if(window.state)window.state.plannerDays=state.plannerDays;saveState();">
            ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => `<option value="${n}" ${n === daysVal ? 'selected' : ''}>${n} day${n > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="wizard-plan-start" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">START DATE</label>
          <input type="date" id="wizard-plan-start" name="plannerStartDate" aria-label="Plan start date" class="input" style="width:100%" value="${escapeAttr(startVal)}" onchange="state.plannerStartDate=this.value;if(window.state)window.state.plannerStartDate=this.value;saveState();">
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

      <!-- Minimum Fit Score Filter -->
      <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
        <div class="field" style="margin:0">
          <label for="wizard-fit-score-filter" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;cursor:pointer">MINIMUM RECIPE FIT SCORE</label>
          <select id="wizard-fit-score-filter" name="minFitScore" aria-label="Minimum recipe fit score" class="select" style="width:100%" onchange="state.prefs.minFitScore = parseInt(this.value, 10) || 0; saveState();">
            <option value="0" ${(!minFitScore || minFitScore === 0) ? 'selected' : ''}>All Recipes (0–100)</option>
            <option value="85" ${minFitScore === 85 ? 'selected' : ''}>Ideal Fit Only (85–100)</option>
            <option value="65" ${minFitScore === 65 ? 'selected' : ''}>Acceptable Fit+ (65–100)</option>
            <option value="40" ${minFitScore === 40 ? 'selected' : ''}>Suboptimal Fit+ (40–100)</option>
          </select>
        </div>
      </div>

      <!-- Slot Exclusions -->
      ${renderExclusionsPanel(activeExclusions, daysVal)}

      <!-- Pinned Recipes & Pantry Use-Up -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px">
        ${renderPinnedPanel(pinned, daysVal)}
        ${renderUseUpPanel(useUp)}
      </div>

      <div style="display:flex;justify-content:flex-end;margin-top:6px">
        <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px;font-size:14px" onclick="generatePlan()">✨ Generate Meal Plan →</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Slot Exclusions sub-panel.
 */
export function renderExclusionsPanel(activeExclusions, daysVal) {
  return `
    <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">Slot Exclusions (${activeExclusions.length})</div>
          <div style="font-size:12px;color:var(--text2)">Skip specific meal slots (eating out, travel, etc.).</div>
        </div>
        <div style="display:flex;gap:8px">
          <button type="button" class="btn sm ghost" onclick="skipAllWizardDinners()">+ Skip All Dinners</button>
          <button type="button" class="btn sm ghost" onclick="clearAllWizardExclusions()">Clear Skips</button>
        </div>
      </div>

      <!-- Active Exclusion Chips -->
      <div id="wizard-exclusions-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        ${activeExclusions.length === 0 ? '<span style="font-size:12px;color:var(--text3)">No meal slots excluded. All slots will be planned.</span>' : ''}
        ${activeExclusions.map(ex => `
          <span class="exclusion-chip">
            ${escapeHtml(ex.label)}
            <button type="button" onclick="removeWizardExclusion(${ex.day}, ${JSON.stringify(ex.keys)})" title="Remove exclusion">✕</button>
          </span>
        `).join('')}
      </div>

      <!-- Inline Add Exclusion Control -->
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="wizard-excl-day" name="exclusionDay" aria-label="Exclusion target day" class="select sm" style="width:auto">
          ${Array.from({ length: daysVal }, (_, i) => i + 1).map(d => `<option value="${d}">Day ${d}</option>`).join('')}
        </select>
        <select id="wizard-excl-meal" name="exclusionMeal" aria-label="Exclusion target meal" class="select sm" style="width:auto">
          <option value="all">All meals</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
        </select>
        <select id="wizard-excl-person" name="exclusionPerson" aria-label="Exclusion target person" class="select sm" style="width:auto">
          <option value="both">Both (Elliott & Chloe)</option>
          <option value="elliott">Elliott only</option>
          <option value="chloe">Chloe only</option>
        </select>
        <button type="button" class="btn sm primary" onclick="addWizardExclusionFromUI()">+ Skip Slot</button>
      </div>
    </div>
  `;
}

/**
 * Renders the Pinned Recipes sub-panel.
 */
export function renderPinnedPanel(pinned, daysVal) {
  return `
    <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Pinned Recipes (${pinned.length})</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Lock specific recipes to calendar days.</div>
      
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${pinned.length === 0 ? '<span style="font-size:12px;color:var(--text3)">No pinned recipes.</span>' : ''}
        ${pinned.map(p => {
          const r = typeof getRecipe === 'function' ? getRecipe(p.recipeId) : null;
          return `
            <span class="inline-search-chip">
              📌 ${escapeHtml(r?.name || 'Recipe')} (Day ${p.targetDay || 1})
              <button type="button" onclick="unpinWizardRecipe('${escapeAttr(p.recipeId)}')">✕</button>
            </span>
          `;
        }).join('')}
      </div>

      <div style="display:flex;gap:6px">
        <select id="wizard-pin-day" name="pinDay" aria-label="Day to pin recipe to" class="select sm" style="width:auto">
          ${Array.from({ length: daysVal }, (_, i) => i + 1).map(d => `<option value="${d}">Day ${d}</option>`).join('')}
        </select>
        <label for="wizard-pin-search" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search recipe to pin</label>
        <input type="search" id="wizard-pin-search" name="pinRecipeSearch" aria-label="Search recipe to pin" class="input sm" placeholder="Search recipe to pin..." style="flex:1" oninput="filterWizardPinRecipes(this.value)">
      </div>
      <div id="wizard-pin-search-results" style="margin-top:6px;max-height:140px;overflow-y:auto;display:none;background:var(--surface);border:1px solid var(--border);border-radius:8px"></div>
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
