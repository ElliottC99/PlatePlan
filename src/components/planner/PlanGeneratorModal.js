/**
 * src/components/planner/PlanGeneratorModal.js (v3.24.0)
 * UI Generator Modal & Macro Progress Visualizer for PlatePlan.
 * Generates automated multi-day plans matching daily protein and calorie targets.
 */

import { generateWeeklyPlan } from '../../services/PlanGeneratorService.js';
import { setActivePlan, getState } from '../../store/store.js';

export function openPlanGeneratorModal() {
  const existingModal = document.getElementById('plan-generator-modal');
  if (existingModal) existingModal.remove();

  const storeState = (typeof getState === 'function') ? getState() : {};
  const currentTargets = storeState.currentPlan?.macroTargets || { calories: 2000, protein: 140, carbs: 200, fat: 65 };

  const modal = document.createElement('div');
  modal.className = 'modal-wrap open';
  modal.id = 'plan-generator-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="document.getElementById('plan-generator-modal').remove()"></div>
    <div class="modal-content" style="max-width:760px; padding:24px; background:var(--surface); border-radius:16px; box-shadow:0 12px 40px rgba(0,0,0,0.3); max-height:90vh; display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="margin:0; font-size:18px; font-weight:700;">⚡ Auto-Generate Weekly Meal Schedule</h3>
        <button class="btn ghost sm" onclick="document.getElementById('plan-generator-modal').remove()" aria-label="Close">✕</button>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; background:var(--surface2, #f8f8f5); padding:16px; border-radius:12px; border:1px solid var(--border,#e0e0e0);">
        <div>
          <label style="font-size:11px; font-weight:700; color:var(--text2); display:block; margin-bottom:4px;">TARGET DAILY PROTEIN (g)</label>
          <input type="number" id="gen-target-protein" value="${currentTargets.protein}" class="input" style="width:100%; font-weight:700;" min="50" max="250">
        </div>
        <div>
          <label style="font-size:11px; font-weight:700; color:var(--text2); display:block; margin-bottom:4px;">TARGET DAILY CALORIES (kcal)</label>
          <input type="number" id="gen-target-calories" value="${currentTargets.calories}" class="input" style="width:100%; font-weight:700;" min="1000" max="4000">
        </div>
        <div>
          <label style="font-size:11px; font-weight:700; color:var(--text2); display:block; margin-bottom:4px;">DURATION (DAYS)</label>
          <select id="gen-days" class="select" style="width:100%; font-weight:700;">
            <option value="7" selected>7 Days (Weekly)</option>
            <option value="5">5 Days (Weekdays)</option>
            <option value="3">3 Days (Short Rotation)</option>
          </select>
        </div>
      </div>

      <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; font-size:13px; font-weight:600;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="gen-prioritize-pantry" checked style="width:16px; height:16px;">
          <span>🔥 Prioritize Expiring Pantry Items</span>
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="checkbox" id="gen-protein-rotation" checked style="width:16px; height:16px;">
          <span>🔄 High-Protein Vegetarian Rotation</span>
        </label>
      </div>

      <div style="display:flex; justify-content:flex-end;">
        <button id="btn-generate-plan" class="btn secondary" style="font-weight:700;">⚡ Generate Plan Preview</button>
      </div>

      <div id="gen-preview-container" style="display:none; max-height:300px; overflow-y:auto; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); flex-direction:column; gap:12px;"></div>

      <div style="display:flex; gap:12px; justify-content:flex-end; align-items:center; margin-top:4px;">
        <button class="btn ghost" onclick="document.getElementById('plan-generator-modal').remove()">Cancel</button>
        <button id="btn-commit-plan" class="btn primary" style="display:none; font-weight:700;">Commit & Activate Plan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let currentGeneratedPlan = null;

  const btnGenerate = modal.querySelector('#btn-generate-plan');
  const btnCommit = modal.querySelector('#btn-commit-plan');
  const previewContainer = modal.querySelector('#gen-preview-container');

  const renderPreview = (plan) => {
    if (!plan || !Array.isArray(plan.days)) return;
    previewContainer.style.display = 'flex';
    btnCommit.style.display = 'inline-block';

    let html = `
      <div style="font-size:12px; font-weight:700; color:var(--text2); display:flex; justify-content:space-between; margin-bottom:8px; background:var(--surface2); padding:8px 12px; border-radius:8px;">
        <span>Summary: ${plan.days.length} Days Generated</span>
        <span>🔥 ${plan.pantrySummary?.useUpItemsConsumed || 0} Use-Up Items Consumed</span>
        <span>📦 ${plan.pantrySummary?.avgPantryMatchPct || 0}% Pantry Match</span>
      </div>
    `;

    plan.days.forEach(day => {
      const targetProt = plan.macroTargets?.protein || 140;
      const actualProt = day.dailyTotals?.protein || 0;
      const actualCal = day.dailyTotals?.calories || 0;
      const pct = Math.min(Math.round((actualProt / targetProt) * 100), 120);

      const statusColor = Math.abs(day.proteinDeltaPct) <= 10 ? '#22c55e' : (day.proteinDeltaPct > 10 ? '#3b82f6' : '#eab308');

      html += `
        <div style="border:1px solid var(--border,#ddd); border-radius:10px; padding:10px 12px; background:var(--surface2, #fafafa);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <strong style="font-size:13px;">${day.dayName} (${day.date})</strong>
            <span style="font-size:11px; font-weight:700; color:${statusColor}; background:rgba(0,0,0,0.04); padding:2px 8px; border-radius:999px;">
              🎯 ${actualProt}g / ${targetProt}g Protein (${actualCal} kcal)
            </span>
          </div>

          <div style="width:100%; height:6px; background:#e0e0e0; border-radius:999px; overflow:hidden; margin-bottom:8px;">
            <div style="width:${pct}%; height:100%; background:${statusColor}; transition:width 0.3s;"></div>
          </div>

          <div style="display:flex; flex-direction:column; gap:4px; font-size:12px;">
            ${(day.meals || []).map(m => `
              <div style="display:flex; justify-content:space-between; color:var(--text); background:var(--surface); padding:4px 8px; border-radius:6px; border:1px solid var(--border,#eee);">
                <span><strong style="text-transform:capitalize;">${m.mealType}:</strong> ${m.recipeTitle}</span>
                <span style="color:var(--text2); font-weight:600;">${m.macros?.protein || 0}g P | ${m.macros?.calories || 0} kcal</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    previewContainer.innerHTML = html;
  };

  btnGenerate.addEventListener('click', () => {
    const protein = parseInt(modal.querySelector('#gen-target-protein').value, 10) || 140;
    const calories = parseInt(modal.querySelector('#gen-target-calories').value, 10) || 2000;
    const days = parseInt(modal.querySelector('#gen-days').value, 10) || 7;
    const prioritizePantry = modal.querySelector('#gen-prioritize-pantry').checked;
    const proteinRotation = modal.querySelector('#gen-protein-rotation').checked;

    try {
      currentGeneratedPlan = generateWeeklyPlan({
        days,
        dailyTargets: { calories, protein, carbs: 200, fat: 65 },
        pantryPriorityWeight: prioritizePantry ? 1.5 : 0,
        proteinRotation
      });

      renderPreview(currentGeneratedPlan);
    } catch (err) {
      alert(`Error generating plan: ${err.message || err}`);
    }
  });

  btnCommit.addEventListener('click', () => {
    if (!currentGeneratedPlan) return;
    setActivePlan(currentGeneratedPlan);
    modal.remove();

    if (typeof window.renderPlanner === 'function') {
      window.renderPlanner();
    }
  });
}

if (typeof window !== 'undefined') {
  window.openPlanGeneratorModal = openPlanGeneratorModal;
}
