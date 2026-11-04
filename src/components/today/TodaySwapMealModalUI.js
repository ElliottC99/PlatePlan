/**
 * src/components/today/TodaySwapMealModalUI.js
 * Presentation Component for the Today View Meal Rearrangement / Swap Modal.
 * Renders candidate destination days with previews and ActionBridge data-action wiring.
 */

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

function formatDayDateHeader(dateStr, dayNum) {
  if (!dateStr) return `Day ${dayNum}`;
  try {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const dayNumFmt = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${dayName} ${dayNumFmt}`;
  } catch (_) {
    return `Day ${dayNum} (${dateStr})`;
  }
}

function getMealPreviewTitle(daySlot, mealType, recipes = []) {
  if (!daySlot || typeof daySlot !== 'object') return 'Empty slot';
  const cleanMeal = String(mealType).toLowerCase().trim();
  const slotE = daySlot[`${cleanMeal}E`];
  const slotC = daySlot[`${cleanMeal}C`];
  const slotMain = daySlot[cleanMeal];

  const resolveTitle = (s) => {
    if (!s || s.isSkipped || s.skipped) return 'Skipped meal';
    const rId = s.recipeId || s.id;
    if (!rId) return 'No recipe';
    const match = recipes.find(r => String(r.id) === String(rId));
    return match?.name || match?.title || s.name || rId;
  };

  if (slotE && slotC) {
    const titleE = resolveTitle(slotE);
    const titleC = resolveTitle(slotC);
    if (titleE === titleC) return titleE;
    return `E: ${titleE} / C: ${titleC}`;
  }
  if (slotE) return resolveTitle(slotE);
  if (slotC) return resolveTitle(slotC);
  if (slotMain) return resolveTitle(slotMain);
  return 'Empty slot';
}

/**
 * Builds the HTML string for the Rearrange / Swap Meal Modal.
 *
 * @param {Object} params
 * @param {Object} params.plan - Active current plan.
 * @param {string|number} params.sourceDayKey - Day key currently viewing.
 * @param {string} params.mealType - Meal type being swapped ('breakfast', 'lunch', 'dinner', 'snack').
 * @param {Array} params.recipes - List of known recipes from store.
 * @returns {string} Modal HTML markup.
 */
export function renderTodaySwapModalHtml({ plan, sourceDayKey, mealType = 'dinner', recipes = [] }) {
  if (!plan || !plan.slots) return '';

  const srcKey = String(sourceDayKey);
  const dayDates = plan.dayDates || {};
  const slots = plan.slots || {};

  const srcDateStr = dayDates[srcKey] || '';
  const srcDateLabel = formatDayDateHeader(srcDateStr, srcKey);
  const srcMealTitle = getMealPreviewTitle(slots[srcKey], mealType, recipes);
  const capitalizedMeal = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  // Candidate destination days (all other days in the plan)
  const candidateDays = Object.keys(slots)
    .filter(dKey => String(dKey) !== srcKey)
    .sort((a, b) => Number(a) - Number(b));

  return `
    <div class="modal-wrap open" id="today-swap-modal-wrap" style="z-index: 100020; display:flex; align-items:center; justify-content:center; position:fixed; inset:0; background:rgba(0,0,0,0.55); backdrop-filter:blur(2px);">
      <div class="modal card" style="max-width: 480px; width:92%; max-height:85vh; display:flex; flex-direction:column; background:var(--surface,#fff); border-radius:14px; padding:20px; box-shadow:0 16px 40px rgba(0,0,0,0.3); border:1px solid var(--border,#e7e5e4);">
        
        <!-- Modal Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; border-bottom:1px solid var(--border,#eee); padding-bottom:12px;">
          <div>
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.04em; font-weight:700; color:var(--primary,#059669);">
              Rearrange Schedule
            </div>
            <h2 style="margin:2px 0 0 0; font-size:16px; font-weight:750; color:var(--text,#1c1917);">
              Swap ${escapeHtml(capitalizedMeal)}
            </h2>
          </div>
          <button type="button" class="btn sm ghost" data-action="close-today-swap-modal" aria-label="Close modal">✕</button>
        </div>

        <!-- Currently Selected Source Meal -->
        <div style="background:var(--surface2,#fafaf9); border:1px solid var(--border,#e7e5e4); border-radius:10px; padding:12px; margin-bottom:16px;">
          <div style="font-size:11px; font-weight:600; color:var(--text3,#78716c); text-transform:uppercase;">
            Current Day
          </div>
          <div style="font-size:14px; font-weight:700; color:var(--text,#1c1917); margin-top:2px;">
            ${escapeHtml(srcDateLabel)}
          </div>
          <div style="font-size:13px; color:var(--primary,#059669); font-weight:600; margin-top:4px; display:flex; align-items:center; gap:6px;">
            <span>🍽️</span>
            <span>${escapeHtml(srcMealTitle)}</span>
          </div>
        </div>

        <!-- Destination Day Picker -->
        <div style="font-size:12px; font-weight:700; color:var(--text2,#78716c); text-transform:uppercase; letter-spacing:0.03em; margin-bottom:8px;">
          Choose day to swap with:
        </div>

        <div style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:8px; padding-right:2px;">
          ${candidateDays.length === 0 ? `
            <div style="text-align:center; padding:20px; color:var(--text3,#78716c); font-size:13px;">
              No other days found in active meal plan to swap with.
            </div>
          ` : ''}

          ${candidateDays.map(dKey => {
            const dateStr = dayDates[dKey] || '';
            const dayLabel = formatDayDateHeader(dateStr, dKey);
            const plannedTitle = getMealPreviewTitle(slots[dKey], mealType, recipes);

            return `
              <div class="card" style="margin:0; padding:10px 12px; border:1px solid var(--border,#e7e5e4); border-radius:10px; display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--surface,#fff); transition:border-color 0.15s ease;">
                <div style="flex:1; min-width:0;">
                  <div style="font-size:12px; font-weight:700; color:var(--text,#1c1917);">
                    ${escapeHtml(dayLabel)}
                  </div>
                  <div style="font-size:12px; color:var(--text2,#78716c); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
                    ${escapeHtml(plannedTitle)}
                  </div>
                </div>
                <button type="button" 
                  class="btn sm primary" 
                  data-action="execute-today-slot-swap" 
                  data-source-day="${escapeAttr(srcKey)}" 
                  data-target-day="${escapeAttr(dKey)}" 
                  data-meal-type="${escapeAttr(mealType)}"
                  style="white-space:nowrap; padding:5px 10px; font-size:11.5px;">
                  ⇄ Swap
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Modal Footer -->
        <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border,#eee); display:flex; justify-content:flex-end;">
          <button type="button" class="btn sm" data-action="close-today-swap-modal">Done</button>
        </div>

      </div>
    </div>
  `;
}

export default {
  renderTodaySwapModalHtml
};
