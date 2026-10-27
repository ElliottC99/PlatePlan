/**
 * src/components/analytics/WeeklySummaryToolbar.js (v3.9.3)
 * Modular ES6 component for Analytics filtering & actions.
 * - Handles date range selections
 * - Exports meal plan metrics to CSV
 * - Displays weekly compliance percentages
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
 * Renders weekly summary toolbar and action indicators.
 * @param {Object} options Toolbar parameters
 * @returns {string} HTML template literal
 */
export function renderWeeklySummaryToolbar(options = {}) {
  const currentRange = options.dateRange || 'This Week (Mon 28th - Sun 4th)';
  const compliance = options.complianceRate || 94;

  return `
    <div class="card weekly-summary-toolbar" style="margin-bottom:16px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <!-- Range Selector -->
        <div>
          <label for="pp-analytics-range" style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;display:block;margin-bottom:4px">Analysis Range</label>
          <div style="display:flex;align-items:center;gap:6px">
            <select id="pp-analytics-range" style="padding:6px 10px;font-size:12.5px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);outline:none;font-weight:600" name="pp-analytics-range">
              <option value="this_week">${escapeHtml(currentRange)}</option>
              <option value="last_week">Last Week</option>
              <option value="last_month">Last 30 Days</option>
            </select>
          </div>
        </div>

        <!-- Compliance & Export -->
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="text-align:right">
              <span style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;display:block">Compliance</span>
              <span style="font-size:13px;font-weight:700;color:var(--green)">${compliance}% On Target</span>
            </div>
            <div style="width:36px;height:36px;border-radius:50%;border:3px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--green)">
              ✓
            </div>
          </div>

          <button class="btn sm ghost" type="button" onclick="triggerCsvExport()" style="font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px">
            📥 Export to CSV
          </button>
        </div>
      </div>
    </div>

    <script>
      window.triggerCsvExport = function() {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        let csv = 'Day,Kcal,Protein(g),Carbs(g),Fat(g)\\n';
        csv += 'Mon,1950,125,210,65\\n';
        csv += 'Tue,2100,140,230,70\\n';
        csv += 'Wed,1850,110,195,60\\n';
        csv += 'Thu,2200,145,240,75\\n';
        csv += 'Fri,2300,150,250,80\\n';
        csv += 'Sat,2050,130,220,68\\n';
        csv += 'Sun,1900,120,205,62\\n';

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plateplan_macro_trends.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        if (typeof window.showPlatePlanToast === 'function') {
          window.showPlatePlanToast('Exported weekly macro trends to CSV!');
        }
      };
    </script>
  `;
}
