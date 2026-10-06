/**
 * src/components/analytics/RecipePortionScaler.js (v3.8.5)
 * Modular UI component for Recipe Portion Scaling & Allocation:
 * - Portion multiplier inputs & batch serves adjustment
 * - Dual-profile portion allocation controls for Elliott vs Chloe
 * - Ingredient weight scaling & dynamic recalculation trigger
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

/**
 * Renders dual-profile portion allocation controls (Elliott vs Chloe percentage split).
 */
export function renderDualProfilePortionAllocation(portions = {}, prefix = 'enh') {
  const ePct = portions.ePct ?? 50;
  const cPct = portions.cPct ?? 50;

  return `
    <div style="background:var(--surface2);padding:12px;border-radius:10px;border:1px solid var(--border);margin-bottom:12px">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <span>Dual-Profile Portion Allocation</span>
        <span style="font-size:11px;color:var(--text2)">Elliott (${ePct}%) / Chloe (${cPct}%)</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <span style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:3px">Elliott Share (%)</span>
          <input type="number" min="0" max="100" class="input" aria-label="Elliott Share (%)" style="width:100%" value="${ePct}" onchange="updatePortionAllocationShare('${prefix}', 'e', this.value)">
        </div>
        <div>
          <span style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:3px">Chloe Share (%)</span>
          <input type="number" min="0" max="100" class="input" aria-label="Chloe Share (%)" style="width:100%" value="${cPct}" onchange="updatePortionAllocationShare('${prefix}', 'c', this.value)">
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders the full Recipe Portion Scaler component.
 */
export function renderRecipePortionScaler(portions = {}, currentServes = 2, prefix = 'enh') {
  return `
    <div class="card pp-recipe-portion-scaler" style="padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:700">Portion Scaling & Yield</h3>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">Adjust total batch servings and member allocation split</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <label for="${prefix}-serves-input" style="font-size:12px;font-weight:600;color:var(--text2)">Serves:</label>
          <input type="number" min="1" max="20" class="input" style="width:70px;text-align:center;font-weight:700" value="${currentServes}" id="${prefix}-serves-input" onchange="updateRecipeServings('${prefix}', this.value)">
        </div>
      </div>

      ${renderDualProfilePortionAllocation(portions, prefix)}
    </div>
  `;
}
