/**
 * src/components/today/TodaySwapMealModalUI.js
 * Apple HIG Compliant Presentation Component for Today Meal Rearrangement / Swap Sheet.
 * Renders as an iOS bottom sheet with grabber handle and smooth dismissal.
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
 * Builds the HTML string for the Rearrange / Swap Meal Bottom Sheet.
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

  // Candidate destination days
  const candidateDays = Object.keys(slots)
    .filter(dKey => String(dKey) !== srcKey)
    .sort((a, b) => Number(a) - Number(b));

  return `
    <div class="ios-sheet-backdrop open" id="today-swap-modal-wrap" data-action="if(event.target===this)closeTodaySwapModal()">
      <div class="ios-sheet-panel">
        <div class="ios-sheet-grabber"></div>

        <!-- Sheet Header Bar -->
        <div class="ios-sheet-header">
          <button type="button" class="ios-nav-btn" data-action="closeTodaySwapModal()">Cancel</button>
          <h3>Swap ${escapeHtml(capitalizedMeal)}</h3>
          <button type="button" class="ios-nav-btn bold" data-action="closeTodaySwapModal()">Done</button>
        </div>

        <!-- Sheet Body -->
        <div class="ios-sheet-content">
          <!-- Current Meal Group -->
          <div class="ios-grouped-section" style="margin: 0 0 16px 0;">
            <div class="ios-section-header">Current Day</div>
            <div class="ios-grouped-card" style="padding: 12px 16px;">
              <div style="font-size:15px; font-weight:600; color:var(--label);">
                ${escapeHtml(srcDateLabel)}
              </div>
              <div style="font-size:13px; color:var(--tint-color); font-weight:500; margin-top:3px; display:flex; align-items:center; gap:6px;">
                <span>🍽️</span>
                <span>${escapeHtml(srcMealTitle)}</span>
              </div>
            </div>
          </div>

          <!-- Destination Days Group -->
          <div class="ios-grouped-section" style="margin: 0;">
            <div class="ios-section-header">Choose Day to Swap With</div>
            <div class="ios-grouped-card">
              ${candidateDays.length === 0 ? `
                <div style="text-align:center; padding:20px; color:var(--secondary-label); font-size:13px;">
                  No other days found in active meal plan to swap with.
                </div>
              ` : ''}

              ${candidateDays.map(dKey => {
                const dateStr = dayDates[dKey] || '';
                const dayLabel = formatDayDateHeader(dateStr, dKey);
                const plannedTitle = getMealPreviewTitle(slots[dKey], mealType, recipes);

                return `
                  <div class="ios-list-row" style="justify-content:space-between; gap:12px;">
                    <div style="flex:1; min-width:0;">
                      <div style="font-size:14px; font-weight:600; color:var(--label);">
                        ${escapeHtml(dayLabel)}
                      </div>
                      <div style="font-size:12px; color:var(--secondary-label); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
                        ${escapeHtml(plannedTitle)}
                      </div>
                    </div>
                    <button type="button" 
                      class="btn sm primary" 
                      data-action="execute-today-slot-swap" 
                      data-source-day="${escapeAttr(srcKey)}" 
                      data-target-day="${escapeAttr(dKey)}" 
                      data-meal-type="${escapeAttr(mealType)}"
                      style="white-space:nowrap; border-radius:var(--radius-control); padding:5px 12px; font-size:12px; font-weight:600;">
                      ⇄ Swap
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

export default {
  renderTodaySwapModalHtml
};
