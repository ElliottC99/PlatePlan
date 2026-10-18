/**
 * src/components/analytics/MacroTrendChart.js (v3.9.3)
 * Modular ES6 component for Weekly Macro Trend visualization.
 * - Renders dynamic weekly protein/carb/fat SVG bar charts
 * - Overlays calorie budget targets
 * - Interactive daily breakdown tooltips
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
 * Renders weekly macro trends chart with SVG data.
 * @param {Array} daysData Weekly historical data
 * @param {Object} targets Macro targets
 * @returns {string} HTML template literal
 */
export function renderMacroTrendChart(daysData = [], targets = {}) {
  const days = Array.isArray(daysData) && daysData.length ? daysData : [
    { label: 'Mon', cal: 1950, prot: 125, carb: 210, fat: 65 },
    { label: 'Tue', cal: 2100, prot: 140, carb: 230, fat: 70 },
    { label: 'Wed', cal: 1850, prot: 110, carb: 195, fat: 60 },
    { label: 'Thu', cal: 2200, prot: 145, carb: 240, fat: 75 },
    { label: 'Fri', cal: 2300, prot: 150, carb: 250, fat: 80 },
    { label: 'Sat', cal: 2050, prot: 130, carb: 220, fat: 68 },
    { label: 'Sun', cal: 1900, prot: 120, carb: 205, fat: 62 },
  ];

  const targetCal = targets.dailyKcal || 2000;
  const maxCal = Math.max(...days.map(d => d.cal), targetCal, 2400);

  // Render SVG chart elements
  const chartWidth = 500;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const barWidth = 35;
  const barSpacing = (graphWidth - (days.length * barWidth)) / (days.length - 1 || 1);

  // Target Calorie Line Y coordinate
  const targetY = paddingTop + graphHeight - ((targetCal / maxCal) * graphHeight);

  // Generate SVG bars and markers
  const barsHtml = days.map((d, idx) => {
    const x = paddingLeft + (idx * (barWidth + barSpacing));
    const h = (d.cal / maxCal) * graphHeight;
    const y = paddingTop + graphHeight - h;

    // Split macros height proportionately
    const totalMacros = d.prot + d.carb + d.fat || 1;
    const hProt = (d.prot / totalMacros) * h;
    const hCarb = (d.carb / totalMacros) * h;
    const hFat = (d.fat / totalMacros) * h;

    return `
      <g class="chart-bar-group" data-day="${escapeHtml(d.label)}" data-cal="${d.cal}" data-prot="${d.prot}" data-carb="${d.carb}" data-fat="${d.fat}">
        <!-- Fat section (bottom) -->
        <rect x="${x}" y="${y + hProt + hCarb}" width="${barWidth}" height="${hFat}" fill="var(--amber)" opacity="0.85" rx="3"></rect>
        <!-- Carb section (middle) -->
        <rect x="${x}" y="${y + hProt}" width="${barWidth}" height="${hCarb}" fill="var(--purple)" opacity="0.85"></rect>
        <!-- Protein section (top) -->
        <rect x="${x}" y="${y}" width="${barWidth}" height="${hProt}" fill="var(--blue)" opacity="0.85" rx="3"></rect>

        <!-- Hover trigger overlay -->
        <rect x="${x - 4}" y="${paddingTop}" width="${barWidth + 8}" height="${graphHeight}" fill="transparent" style="cursor:pointer"
          onmouseover="showChartTooltip(event, '${escapeHtml(d.label)}', ${d.cal}, ${d.prot}, ${d.carb}, ${d.fat})"
          onmouseout="hideChartTooltip()">
        </rect>
        <!-- X Axis Label -->
        <text x="${x + barWidth / 2}" y="${chartHeight - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text2)">${escapeHtml(d.label)}</text>
      </g>
    `;
  }).join('');

  return `
    <div class="card macro-trend-card" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-between;width:100%">
        <span>📊 Weekly Energy & Macro Balance</span>
        <span style="font-size:12px;font-weight:600;color:var(--text3)">Target: ${targetCal} kcal/day</span>
      </div>

      <div style="position:relative;width:100%;overflow-x:auto">
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" width="100%" height="auto" style="overflow:visible">
          <!-- Horizontal grid lines -->
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${chartWidth - paddingRight}" y2="${paddingTop}" stroke="var(--border)" stroke-dasharray="3,3"></line>
          <line x1="${paddingLeft}" y1="${paddingTop + graphHeight / 2}" x2="${chartWidth - paddingRight}" y2="${paddingTop + graphHeight / 2}" stroke="var(--border)" stroke-dasharray="3,3"></line>
          <line x1="${paddingLeft}" y1="${paddingTop + graphHeight}" x2="${chartWidth - paddingRight}" y2="${paddingTop + graphHeight}" stroke="var(--border)"></line>

          <!-- Y Axis ticks -->
          <text x="${paddingLeft - 8}" y="${paddingTop + 4}" text-anchor="end" font-size="10" fill="var(--text3)">${Math.round(maxCal)}</text>
          <text x="${paddingLeft - 8}" y="${paddingTop + graphHeight / 2 + 4}" text-anchor="end" font-size="10" fill="var(--text3)">${Math.round(maxCal / 2)}</text>
          <text x="${paddingLeft - 8}" y="${paddingTop + graphHeight + 4}" text-anchor="end" font-size="10" fill="var(--text3)">0</text>

          <!-- Target Calorie Line Overlay -->
          <line x1="${paddingLeft}" y1="${targetY}" x2="${chartWidth - paddingRight}" y2="${targetY}" stroke="var(--red)" stroke-width="2" stroke-dasharray="4,4"></line>
          <text x="${chartWidth - paddingRight - 4}" y="${targetY - 6}" text-anchor="end" font-size="10" font-weight="700" fill="var(--red)">Target Line</text>

          <!-- Bars rendering -->
          ${barsHtml}
        </svg>

        <!-- Tooltip display -->
        <div id="chart-tooltip" style="position:absolute;display:none;background:var(--surface);border:1px solid var(--border);padding:8px 12px;border-radius:8px;font-size:11px;box-shadow:0 4px 12px rgba(0,0,0,0.08);pointer-events:none;z-index:100;color:var(--text)"></div>
      </div>

      <!-- Legend Indicator -->
      <div style="display:flex;gap:16px;justify-content:center;margin-top:10px;font-size:11px;font-weight:600">
        <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:var(--blue);border-radius:2px"></span> Protein</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:var(--purple);border-radius:2px"></span> Carbs</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:var(--amber);border-radius:2px"></span> Fat</span>
      </div>
    </div>

    <script>
      window.showChartTooltip = function(e, label, cal, prot, carb, fat) {
        const tooltip = document.getElementById('chart-tooltip');
        if (!tooltip) return;
        tooltip.innerHTML = \`
          <strong style="display:block;margin-bottom:4px">\${label}</strong>
          <div>🔥 \${cal} kcal</div>
          <div style="color:var(--blue)">🍗 \${prot}g Protein</div>
          <div style="color:var(--purple)">🍞 \${carb}g Carbs</div>
          <div style="color:var(--amber)">🥑 \${fat}g Fat</div>
        \`;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.offsetX + 15) + 'px';
        tooltip.style.top = (e.offsetY - 70) + 'px';
      };

      window.hideChartTooltip = function() {
        const tooltip = document.getElementById('chart-tooltip');
        if (tooltip) tooltip.style.display = 'none';
      };
    </script>
  `;
}
