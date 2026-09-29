/**
 * src/components/prep/PrepSummaryToolbar.js (v3.9.1)
 * Modular ES6 Component for Meal Prep Summary & Toolbar:
 * - Batch cook progress indicator
 * - "Mark All Complete" and "Reset Progress" triggers
 * - Export & Print Prep Guide actions
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
 * Renders the Meal Prep Toolbar & Batch Cook Progress Bar shell.
 * @param {Object} props { totalSteps, completedSteps, activeBatchCount }
 * @returns {string} HTML template literal
 */
export function renderPrepSummaryToolbar(props = {}) {
  const total = +props.totalSteps || 0;
  const completed = +props.completedSteps || 0;
  const batches = +props.activeBatchCount || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return `
    <div class="card prep-summary-toolbar" style="margin-bottom:14px;padding:12px 14px;border:1px solid var(--purple);border-radius:10px;background:var(--purple-bg, rgba(79,70,229,0.05))">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px">
        <div>
          <strong style="font-size:14px;color:var(--text)">🍳 Batch Meal Prep Guide</strong>
          <span style="font-size:12px;color:var(--text2);margin-left:6px">(${batches} active ${batches === 1 ? 'batch' : 'batches'})</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" class="btn sm primary" onclick="markAllPrepStepsComplete()" style="font-size:11px;font-weight:700">
            ✓ Mark All Complete
          </button>
          <button type="button" class="btn sm ghost" onclick="printMealPrepGuide()" style="font-size:11px">
            🖨️ Print Guide
          </button>
        </div>
      </div>

      <div class="prep-progress-bar-wrap" style="display:flex;align-items:center;gap:10px">
        <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;border:1px solid var(--border)">
          <div class="prep-progress-fill" style="width:${percent}%;height:100%;background:var(--purple);transition:width 0.3s ease"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:var(--text2);min-width:45px;text-align:right">${completed}/${total} (${percent}%)</span>
      </div>
    </div>
  `;
}
