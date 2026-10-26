/**
 * src/components/analytics/RecipeNutritionCard.js (v3.8.5)
 * Modular UI component for Recipe Nutrition Analytics:
 * - Macro distribution visualizers (Protein, Carbs, Fat, Fibre percentages)
 * - Protein density badges & quality rating
 * - Calorie & macro target comparison cards vs household goals
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
 * Renders a macro distribution progress bar (Protein, Carbs, Fat breakdown).
 */
export function renderMacroDistributionBar(macros = {}) {
  const p = Math.max(0, +macros.protein || 0) * 4; // 4 kcal/g
  const c = Math.max(0, +macros.carbs || 0) * 4;   // 4 kcal/g
  const f = Math.max(0, +macros.fat || 0) * 9;     // 9 kcal/g
  const total = p + c + f || 1;

  const pPct = Math.round((p / total) * 100);
  const cPct = Math.round((c / total) * 100);
  const fPct = Math.max(0, 100 - pPct - cPct);

  return `
    <div style="margin:12px 0">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--text2);margin-bottom:4px">
        <span>MACRO ENERGY SPLIT</span>
        <span>P: ${pPct}% | C: ${cPct}% | F: ${fPct}%</span>
      </div>
      <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--surface2);gap:2px">
        <div style="width:${pPct}%;background:var(--blue,#3b82f6);transition:width 0.3s" title="Protein: ${pPct}%"></div>
        <div style="width:${cPct}%;background:var(--amber,#f59e0b);transition:width 0.3s" title="Carbs: ${cPct}%"></div>
        <div style="width:${fPct}%;background:var(--purple,#8b5cf6);transition:width 0.3s" title="Fat: ${fPct}%"></div>
      </div>
    </div>
  `;
}

/**
 * Renders a protein density badge based on protein per 100kcal.
 */
export function renderProteinDensityBadge(protein = 0, calories = 0) {
  if (!calories || calories <= 0) return '';
  const density = (protein / (calories / 100)).toFixed(1);
  let badgeColor = 'var(--text2)';
  let bg = 'var(--surface2)';
  let label = 'Standard Protein';

  if (density >= 10) {
    badgeColor = 'var(--green)';
    bg = 'var(--green-bg, rgba(16, 185, 129, 0.15))';
    label = '🔥 High Protein Density (' + density + 'g / 100kcal)';
  } else if (density >= 6) {
    badgeColor = 'var(--blue)';
    bg = 'var(--blue-bg, rgba(59, 130, 246, 0.15))';
    label = '💪 Moderate Protein (' + density + 'g / 100kcal)';
  } else {
    label = 'Energy Dense (' + density + 'g / 100kcal)';
  }

  return `
    <span class="tag" style="background:${bg};color:${badgeColor};font-weight:600;font-size:11.5px;padding:3px 8px;border-radius:6px;display:inline-flex;align-items:center;gap:4px">
      ${escapeHtml(label)}
    </span>
  `;
}

/**
 * Renders the full Recipe Nutrition Card with macros, energy split, and density.
 */
export function renderRecipeNutritionCard(nutrition = {}, options = {}) {
  const totals = nutrition.totalNutrition || nutrition || {};
  const perServ = nutrition.perServing || {};
  const cals = Math.round(totals.cal || totals.calories || 0);
  const prot = Math.round((totals.prot || totals.protein || 0) * 10) / 10;
  const carb = Math.round((totals.carb || totals.carbs || 0) * 10) / 10;
  const fat = Math.round((totals.fat || 0) * 10) / 10;
  const fibre = Math.round((totals.fibre || totals.fiber || 0) * 10) / 10;

  return `
    <div class="card pp-recipe-nutrition-card" style="padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div>
          <h3 style="margin:0;font-size:15px;font-weight:700">Recipe Nutrition Summary</h3>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">Calculated from mapped ingredient database items</div>
        </div>
        ${renderProteinDensityBadge(prot, cals)}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(90px, 1fr));gap:8px;margin-bottom:12px">
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">CALORIES</div>
          <div style="font-size:16px;font-weight:750;color:var(--text);margin-top:2px">${cals}<span style="font-size:11px;font-weight:normal;color:var(--text2)"> kcal</span></div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">PROTEIN</div>
          <div style="font-size:16px;font-weight:750;color:var(--blue);margin-top:2px">${prot}<span style="font-size:11px;font-weight:normal;color:var(--text2)">g</span></div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">CARBS</div>
          <div style="font-size:16px;font-weight:750;color:var(--amber);margin-top:2px">${carb}<span style="font-size:11px;font-weight:normal;color:var(--text2)">g</span></div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">FAT</div>
          <div style="font-size:16px;font-weight:750;color:var(--purple);margin-top:2px">${fat}<span style="font-size:11px;font-weight:normal;color:var(--text2)">g</span></div>
        </div>
        <div style="background:var(--surface2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:11px;color:var(--text2);font-weight:600">FIBRE</div>
          <div style="font-size:16px;font-weight:750;color:var(--green);margin-top:2px">${fibre}<span style="font-size:11px;font-weight:normal;color:var(--text2)">g</span></div>
        </div>
      </div>

      ${renderMacroDistributionBar({ protein: prot, carbs: carb, fat })}
    </div>
  `;
}
