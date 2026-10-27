/**
 * src/components/generator/GeneratorCandidateDrawer.js (v3.8.4)
 * Modular UI component for Candidate Recipe Selection & Macro Suitability Drawer:
 * - Candidate recipe preview cards
 * - Manual replacement pickers & sorting
 * - Macro suitability scoring & protein density badges
 * - Enhanced variant indicators
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
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Returns color code corresponding to a Macro Fit score.
 */
export function getMacroSuitabilityColor(score = 0) {
  if (score >= 85) return '#10B981'; // Green
  if (score >= 65) return '#84CC16'; // Lime/Yellow-Green
  if (score >= 40) return '#F59E0B'; // Amber
  return '#EF4444'; // Red
}

/**
 * Renders a Macro Fit badge with dynamic styling.
 */
export function renderMacroSuitabilityBadge(score = 0, isEnhanced = false) {
  const color = getMacroSuitabilityColor(score);
  return `
    <span class="tag pp-fit-score-tag" style="background-color:${color};color:#FFFFFF;border-color:${color};font-weight:600;font-size:11px;padding:2px 7px;border-radius:12px;display:inline-flex;align-items:center;gap:4px">
      Fit score ${Math.round(score)}${isEnhanced ? ' · Enhanced' : ''}
    </span>
  `;
}

/**
 * Renders an individual Candidate Recipe Card for selection or swap.
 */
export function renderCandidateRecipeCard({
  item,
  isCurrent = false,
  isSelected = false,
  day = 1,
  slotKey = 'dinnerE',
  onSelect = null
}) {
  const isFav = item.isFavourite || item.isFavorite;
  const fitScoreVal = item._computedFitScore !== undefined ? item._computedFitScore : 0;
  const bestVar = item._bestVariant || (item.variant === 'enhanced' ? 'enhanced' : 'original');
  const isEnhancedFit = bestVar === 'enhanced';

  const valAttr = escapeAttr(item.value);
  const labelHtml = escapeHtml(item.label);
  const idAttr = escapeAttr(item.id);
  const varAttr = escapeAttr(item.variant || 'original');

  const selectAction = onSelect ? onSelect : `selectSwapModalRecipe('${valAttr}')`;
  const doubleClickAction = `executeSwapSlotAndClose(${day}, '${slotKey}', '${valAttr}')`;

  return `
    <div class="swap-modal-item pp-candidate-card ${isFav ? 'is-favorite' : ''} ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" data-value="${valAttr}" onclick="${selectAction}" ondblclick="${doubleClickAction}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>${labelHtml}</span>
          ${isFav ? '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-size:11px">❤️ Favourite</span>' : ''}
          ${item.enhanced ? '<span class="tag green" style="font-size:10px">Enhanced</span>' : ''}
          ${isCurrent ? '<span class="tag" style="font-size:10px">Currently Selected</span>' : ''}
          ${isSelected ? '<span class="tag green" style="font-size:10px">✓ Ready to swap</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <span>🔥 <strong>${item.cal}</strong> kcal</span>
          <span>💪 <strong>${item.prot}</strong>g protein</span>
          ${item.serves ? `<span>🍽️ Serves ${item.serves}</span>` : ''}
          ${renderMacroSuitabilityBadge(fitScoreVal, isEnhancedFit)}
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
        <button type="button" class="recipe-fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleRecipeFavourite('${idAttr}', event, '${varAttr}'); if(typeof currentSwapModalContext !== 'undefined' && currentSwapModalContext) { currentSwapModalContext.items.forEach(it => { if(it.id === '${idAttr}') { it.isFavourite = !it.isFavourite; it.isFavorite = it.isFavourite; } }); renderSwapModalOptionsList(); }" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <button class="btn sm ${isSelected ? 'primary' : 'ghost'}" type="button" onclick="event.stopPropagation(); ${selectAction};">
          ${isSelected ? 'Selected ✓' : 'Select'}
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders the Candidate Drawer / Modal shell.
 */
export function renderCandidateDrawerModal({
  dayLabel = '',
  who = '',
  typeTitle = '',
  curRecipeName = '',
  isEnhanced = false,
  itemsCount = 0,
  dayNum = 1,
  slotKey = ''
}) {
  return `
    <div class="modal swap-meal-modal pp-candidate-drawer" style="max-width:640px;width:94vw;max-height:90vh;display:flex;flex-direction:column">
      <div class="row-between" style="align-items:center;margin-bottom:12px;gap:10px;flex-shrink:0">
        <div>
          <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">Candidate Recipes — ${escapeHtml(dayLabel)}</h3>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">${escapeHtml(who === 'both' ? 'Shared (Elliott & Chloe)' : who + "'s")} ${escapeHtml(typeTitle)}</div>
        </div>
        <button class="btn sm ghost" onclick="closeSwapMealModal()" aria-label="Close modal" style="font-size:16px;padding:4px 10px">✕</button>
      </div>

      ${curRecipeName ? `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex-shrink:0">
          <div>
            <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Currently Planned</div>
            <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:1px">${escapeHtml(curRecipeName)} ${isEnhanced ? '<span class="tag green">Enhanced</span>' : ''}</div>
          </div>
          <button class="btn sm danger" onclick="executeSwapSlotAndClose(${dayNum}, '${escapeAttr(slotKey)}', '')">Clear Slot</button>
        </div>
      ` : `
        <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:10px;padding:10px 14px;margin-bottom:12px;color:var(--text3);font-size:13px;font-style:italic;flex-shrink:0">
          No meal currently planned for this slot.
        </div>
      `}

      <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0">
        <div style="position:relative">
          <label for="swap-modal-search-input" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search candidate recipes</label>
          <input type="text" id="swap-modal-search-input" name="candidateSearch" aria-label="Search candidate recipes" class="input" placeholder="Search candidate recipes (e.g. Chicken, Omelette, 500kcal)..." style="width:100%;font-size:13px;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)" oninput="renderSwapModalOptionsList()" autocomplete="off" spellcheck="false">
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span style="font-size:11px;color:var(--text3);font-weight:600;margin-right:2px">Filter:</span>
            <button type="button" class="btn sm active-filter-btn" id="swap-filter-all" onclick="setSwapModalFilter('all')">All (${itemsCount})</button>
            <button type="button" class="btn sm ghost" id="swap-filter-favourites" onclick="setSwapModalFilter('favourites')">❤️ Favourites</button>
            <button type="button" class="btn sm ghost" id="swap-filter-enhanced" onclick="setSwapModalFilter('enhanced')">Enhanced</button>
            <button type="button" class="btn sm ghost" id="swap-filter-original" onclick="setSwapModalFilter('original')">Original</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <label for="swap-modal-sort-select" style="font-size:11px;color:var(--text3);font-weight:600;cursor:pointer">Sort:</label>
            <select id="swap-modal-sort-select" name="candidateSort" aria-label="Sort options" class="input sm" style="font-size:12px;padding:3px 8px;border-radius:6px;background:var(--surface);color:var(--text);border:1px solid var(--border)" onchange="renderSwapModalOptionsList()">
              <option value="best-fit" selected>Best Fit</option>
              <option value="needs-work">Needs Work</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      <div id="swap-modal-list-container" class="swap-modal-list" style="flex:1;min-height:200px;max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
      </div>

      <div class="row-between" style="margin-top:14px;align-items:center;flex-shrink:0;gap:10px;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn ghost sm" onclick="quickRandomizeSwap(${dayNum}, '${escapeAttr(slotKey)}')">🎲 Random Swap</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn ghost sm" onclick="closeSwapMealModal()">Cancel</button>
          <button id="swap-modal-confirm-btn" class="btn primary sm" disabled onclick="confirmSwapMealModal()">Confirm Swap</button>
        </div>
      </div>
    </div>
  `;
}
