/**
 * src/components/settings/ProfileAllocationCard.js (v3.9.2)
 * Modular ES6 component for profile macro allocation splits.
 * - Manages Elliott vs Chloe macro and calorie targets
 * - Multi-meal division sliders and interactive feedback
 * - Portion multiplier ratio configurations
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
 * Renders the Profile Allocation & Dual Macro split card.
 * @param {Object} prefs Target user preferences
 * @returns {string} HTML template literal
 */
export function renderProfileAllocationCard(prefs = {}) {
  const eCal = prefs.elliottCal || 2200;
  const eProt = prefs.elliottProt || 140;
  const cCal = prefs.chloeCal || 1800;
  const cProt = prefs.chloeProt || 110;

  const targets = prefs.nutritionTargets || {};
  const eMeals = targets.elliott?.meals || {
    breakfast: { kcal: 550, protein: 35 },
    lunch: { kcal: 650, protein: 40 },
    dinner: { kcal: 750, protein: 45 },
    snacking: { kcal: 250, protein: 20 }
  };
  const cMeals = targets.chloe?.meals || {
    breakfast: { kcal: 450, protein: 25 },
    lunch: { kcal: 500, protein: 30 },
    dinner: { kcal: 650, protein: 40 },
    snacking: { kcal: 200, protein: 15 }
  };

  return `
    <div class="card profile-allocation-card" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        👤 Dual Profile Macro Splits & Allocation
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        <!-- Elliott Profile -->
        <div style="background:var(--surface2);border:1px solid var(--border);padding:12px 14px;border-radius:10px">
          <strong style="font-size:13.5px;color:var(--text);display:block;margin-bottom:8px">Elliott's Target Split</strong>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2)">Daily Calories (kcal)</label>
              <input type="number" id="pp-macro-e-cal" value="${eCal}" style="width:100%;margin-top:4px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2)">Daily Protein (g)</label>
              <input type="number" id="pp-macro-e-prot" value="${eProt}" style="width:100%;margin-top:4px" oninput="calcBudgets()">
            </div>
          </div>

          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Calorie & Protein Meal Targets (%)</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:4px">
            <div>
              <label style="font-size:10px;color:var(--text2)">Breakfast</label>
              <input type="number" id="pp-macro-e-bf-cal" value="${Math.round((eMeals.breakfast?.kcal / eCal) * 100) || 25}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text2)">Lunch</label>
              <input type="number" id="pp-macro-e-lu-cal" value="${Math.round((eMeals.lunch?.kcal / eCal) * 100) || 30}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text2)">Dinner</label>
              <input type="number" id="pp-macro-e-di-cal" value="${Math.round((eMeals.dinner?.kcal / eCal) * 100) || 35}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text2)">Snacks</label>
              <input type="number" id="pp-macro-e-sn-cal" value="${Math.round((eMeals.snacking?.kcal / eCal) * 100) || 10}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
          </div>
        </div>

        <!-- Chloe Profile -->
        <div style="background:var(--surface2);border:1px solid var(--border);padding:12px 14px;border-radius:10px">
          <strong style="font-size:13.5px;color:var(--text);display:block;margin-bottom:8px">Chloe's Target Split</strong>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2)">Daily Calories (kcal)</label>
              <input type="number" id="pp-macro-c-cal" value="${cCal}" style="width:100%;margin-top:4px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2)">Daily Protein (g)</label>
              <input type="number" id="pp-macro-c-prot" value="${cProt}" style="width:100%;margin-top:4px" oninput="calcBudgets()">
            </div>
          </div>

          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Calorie & Protein Meal Targets (%)</div>
          <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:4px">
            <div>
              <label style="font-size:10px;color:var(--text2)">Breakfast</label>
              <input type="number" id="pp-macro-c-bf-cal" value="${Math.round((cMeals.breakfast?.kcal / cCal) * 100) || 25}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text2)">Lunch</label>
              <input type="number" id="pp-macro-c-lu-cal" value="${Math.round((cMeals.lunch?.kcal / cCal) * 100) || 30}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text2)">Dinner</label>
              <input type="number" id="pp-macro-c-di-cal" value="${Math.round((cMeals.dinner?.kcal / cCal) * 100) || 35}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
            <div>
              <label style="font-size:10px;color:var(--text2)">Snacks</label>
              <input type="number" id="pp-macro-c-sn-cal" value="${Math.round((cMeals.snacking?.kcal / cCal) * 100) || 10}" style="width:100%;font-size:11px" oninput="calcBudgets()">
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:14px;background:rgba(22,163,74,0.04);border:1px solid rgba(22,163,74,0.15);padding:10px 12px;border-radius:8px;font-size:12px;color:var(--text2)">
        <span style="font-weight:700;color:var(--green)">⚡ Live Feedback:</span>
        These settings are dynamically resolved against active meal plans to optimize macro match precision and portion multiplier outputs.
      </div>
    </div>
  `;
}
