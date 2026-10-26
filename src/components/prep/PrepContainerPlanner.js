/**
 * src/components/prep/PrepContainerPlanner.js (v3.9.1)
 * Modular ES6 Component for Meal Prep Container Allocation:
 * - Tupperware & portion container breakdown
 * - Storage location tags (Fridge / Freezer / Pantry)
 * - Expiry date calculator & portion labels
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
  return escapeHtml(str).replace(/`/g, '&#96;');
}

/**
 * Renders the Container Allocation & Storage Planner card.
 * @param {Object} item Portion prep item { recipeName, totalServings, fridgePortions, freezerPortions, expiryDays }
 * @param {number} index Index of container item
 * @returns {string} HTML template literal
 */
export function renderPrepContainerPlanner(item = {}, index = 0) {
  const name = item.recipeName || item.name || 'Recipe Batch';
  const total = +item.totalServings || +item.servings || 2;
  const fridge = item.fridgePortions ?? total;
  const freezer = item.freezerPortions ?? 0;
  const expiryDays = item.expiryDays || 4;

  const today = new Date();
  const expiryDate = new Date(today.getTime() + expiryDays * 24 * 60 * 60 * 1000);
  const expiryLabel = expiryDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return `
    <div class="card prep-container-planner" data-container-index="${index}" style="margin-bottom:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <strong style="font-size:14px;color:var(--text)">📦 ${escapeHtml(name)} (${total} portions)</strong>
        <span class="tag" style="font-size:11px;background:var(--surface2);color:var(--text2)">Use by: ${escapeHtml(expiryLabel)}</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:8px;font-size:12px">
        <div style="padding:8px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase">❄️ Fridge Storage</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">${fridge} x Containers</div>
          <div style="font-size:10px;color:var(--text2);margin-top:2px">Eat within ${expiryDays} days</div>
        </div>

        <div style="padding:8px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase">🧊 Freezer Storage</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:2px">${freezer} x Containers</div>
          <div style="font-size:10px;color:var(--text2);margin-top:2px">Freeze up to 3 months</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:10px">
        <button type="button" class="btn sm ghost" onclick="openPrintPrepLabelModal(${index})" style="font-size:11px">
          🏷️ Print Portion Label
        </button>
        <button type="button" class="btn sm ghost" onclick="adjustPrepContainers(${index})" style="font-size:11px">
          ✏️ Edit Allocation
        </button>
      </div>
    </div>
  `;
}
