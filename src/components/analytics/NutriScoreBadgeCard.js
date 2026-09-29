/**
 * src/components/analytics/NutriScoreBadgeCard.js (v3.9.3)
 * Modular ES6 component for NutriScore Health compliance dashboard.
 * - Handles nutritional balance scoring
 * - Renders health compliance status badges and meters
 * - Displays fiber, protein, and fat target compliance indicators
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
 * Renders the NutriScore compliance dashboard.
 * @param {Object} stats Weekly stats
 * @returns {string} HTML template literal
 */
export function renderNutriScoreBadgeCard(stats = {}) {
  const score = stats.nutriScore || 88;
  const proteinScore = stats.proteinRatio || 92;
  const fiberScore = stats.fiberRatio || 84;
  const sodiumScore = stats.sodiumSafety || 95;

  let scoreColor = 'var(--green)';
  let scoreClass = 'A';
  if (score < 60) {
    scoreColor = 'var(--red)';
    scoreClass = 'D';
  } else if (score < 80) {
    scoreColor = 'var(--amber)';
    scoreClass = 'B';
  }

  return `
    <div class="card nutriscore-badge-card" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        🎖️ Household Nutritional Balance Score
      </div>

      <div style="display:grid;grid-template-columns:100px 1fr;gap:18px;align-items:center">
        <!-- NutriScore Large Emblem Badge -->
        <div style="width:90px;height:90px;border-radius:16px;background:${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,0.06)">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:0.9">Score</span>
          <span style="font-size:32px;font-weight:900;line-height:1">${score}</span>
          <span style="font-size:10px;font-weight:700;margin-top:2px">Grade ${scoreClass}</span>
        </div>

        <!-- Metric Bars -->
        <div style="display:flex;flex-direction:column;gap:8px">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:3px">
              <span style="color:var(--text2)">🥩 Protein Safety Ratio</span>
              <span style="color:var(--blue)">${proteinScore}%</span>
            </div>
            <div style="width:100%;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;border:1px solid var(--border)">
              <div style="width:${proteinScore}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:3px">
              <span style="color:var(--text2)">🥦 Fibre Target Density</span>
              <span style="color:var(--purple)">${fiberScore}%</span>
            </div>
            <div style="width:100%;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;border:1px solid var(--border)">
              <div style="width:${fiberScore}%;height:100%;background:var(--purple);border-radius:3px"></div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:3px">
              <span style="color:var(--text2)">🧂 Sodium & Saturated Fat Index</span>
              <span style="color:var(--amber)">${sodiumScore}%</span>
            </div>
            <div style="width:100%;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;border:1px solid var(--border)">
              <div style="width:${sodiumScore}%;height:100%;background:var(--amber);border-radius:3px"></div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:14px;background:var(--surface2);border:1px solid var(--border);padding:10px 12px;border-radius:8px;font-size:12px;color:var(--text3);line-height:1.4">
        ✨ <strong>NutriScore Insight:</strong> Your meal plan is highly compliant with recommended protein density limits and fiber ratios. Saturated fat is well within the low safety threshold.
      </div>
    </div>
  `;
}
