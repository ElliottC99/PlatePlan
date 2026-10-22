/**
 * src/components/planner/PlannerSwapModalRenderService.js (v3.38.67)
 * Pure template generation service for the Planner Swap Modal.
 * Isolates HTML string building from interaction logic.
 */

import { renderFitScoreBadge } from '../FitScoreBadge.js';

/**
 * Renders the base shell of the swap meal modal.
 */
export function renderSwapModalBase({ dayLabel, who, typeTitle, curRecipeName, slotInfo, itemsCount, dayNum, slotKey }) {
  const escHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => String(s ?? ''));

  const headerHtml = `
    <div class="row-between" style="align-items:center;margin-bottom:12px;gap:10px;flex-shrink:0">
      <div>
        <h3 style="margin:0;font-size:17px;font-weight:750;color:var(--text)">Swap Meal — ${escHtml(dayLabel)}</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${escHtml(who === 'both' ? 'Shared (Elliott & Chloe)' : who + "'s")} ${escHtml(typeTitle)}</div>
      </div>
      <button class="modal-close-btn btn sm btn-ghost ghost" onclick="closeSwapMealModal()" aria-label="Close modal">✕</button>
    </div>
  `;

  const currentMealHtml = curRecipeName ? `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-md,10px);padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex-shrink:0">
      <div>
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Currently Planned</div>
        <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:1px">${escHtml(curRecipeName)} ${slotInfo.variant === 'enhanced' ? '<span class="tag green">Enhanced</span>' : ''}</div>
      </div>
      <button class="btn sm btn-outline outline danger" onclick="executeSwapSlotAndClose(${dayNum}, '${slotKey}', '')">Clear Slot</button>
    </div>
  ` : `
    <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:var(--radius-md,10px);padding:10px 14px;margin-bottom:12px;color:var(--text3);font-size:13px;font-style:italic;flex-shrink:0">
      No meal currently planned for this slot.
    </div>
  `;

  return `
    <div class="modal swap-meal-modal" style="max-width:640px;width:94vw;max-height:90vh;display:flex;flex-direction:column;border-radius:var(--radius-lg,14px);padding:20px">
      ${headerHtml}
      ${currentMealHtml}

      <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0">
        <div style="position:relative">
          <label for="swap-modal-search-input" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search recipes</label>
          <input type="text" id="swap-modal-search-input" name="swapModalSearch" aria-label="Search recipes" class="input" placeholder="Type to filter recipes (e.g. Chicken, Omelette, 500kcal)..." style="width:100%;font-size:13px;padding:9px 12px;border-radius:var(--radius-sm,6px);border:1px solid var(--border);background:var(--surface);color:var(--text)" oninput="renderSwapModalOptionsList()" autocomplete="off" spellcheck="false">
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span style="font-size:11px;color:var(--text3);font-weight:600;margin-right:2px">Filter:</span>
            <button type="button" class="btn sm btn-secondary active-filter-btn" id="swap-filter-all" onclick="setSwapModalFilter('all')">All (${itemsCount})</button>
            <button type="button" class="btn sm btn-ghost ghost" id="swap-filter-favourites" onclick="setSwapModalFilter('favourites')">❤️ Favourites</button>
            <button type="button" class="btn sm btn-ghost ghost" id="swap-filter-enhanced" onclick="setSwapModalFilter('enhanced')">Enhanced</button>
            <button type="button" class="btn sm btn-ghost ghost" id="swap-filter-original" onclick="setSwapModalFilter('original')">Original</button>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <label for="swap-modal-sort-select" style="font-size:11px;color:var(--text3);font-weight:600;cursor:pointer">Sort:</label>
            <select id="swap-modal-sort-select" name="swapModalSort" aria-label="Sort options" class="input sm" style="font-size:12px;padding:3px 8px;border-radius:var(--radius-sm,6px);background:var(--surface);color:var(--text);border:1px solid var(--border)" onchange="renderSwapModalOptionsList()">
              <option value="best-fit" selected>Best Fit</option>
              <option value="needs-work">Needs Work</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
      </div>

      <div id="swap-modal-list-container" class="swap-modal-list" style="flex:1;min-height:200px;max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md,10px);background:var(--surface)"></div>

      <div class="row-between" style="margin-top:14px;align-items:center;flex-shrink:0;gap:10px;flex-wrap:wrap">
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary secondary sm" onclick="quickRandomizeSwap(${dayNum}, '${slotKey}')">🎲 Random Swap</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost ghost sm" onclick="closeSwapMealModal()">Cancel</button>
          <button id="swap-modal-confirm-btn" class="btn btn-primary primary sm" disabled onclick="confirmSwapMealModal()">Confirm Swap</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders an individual recipe item for the swap modal list.
 */
export function renderSwapModalItem(item, { isCurrent, isSelected, day, slotKey, targetSlot }) {
  const escAttr = typeof window.ppEscapeAttr === 'function' ? window.ppEscapeAttr : (s => String(s ?? ''));
  const escHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => String(s ?? ''));
  const isFav = item.isFavourite || item.isFavorite;
  const valAttr = escAttr(item.value);
  const labelHtml = escHtml(item.label);

  return `
    <div class="swap-modal-item ${isFav ? 'is-favorite' : ''} ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" 
         data-value="${valAttr}" 
         onclick="selectSwapModalRecipe('${valAttr}')" 
         ondblclick="executeSwapSlotAndClose(${day}, '${slotKey}', '${valAttr}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>${labelHtml}</span>
          ${isFav ? '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-size:11px">❤️ Favourite</span>' : ''}
          ${item.enhanced ? '<span class="tag green">Enhanced</span>' : ''}
          ${isCurrent ? '<span class="tag">Currently Selected</span>' : ''}
          ${isSelected ? '<span class="tag green">✓ Ready to swap</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <span>🔥 <strong>${item.cal}</strong> kcal</span>
          <span>💪 <strong>${item.prot}</strong>g protein</span>
          ${item.serves ? `<span>🍽️ Serves ${item.serves}</span>` : ''}
          ${typeof window.renderFitScoreBadge === 'function' ? window.renderFitScoreBadge(item.recipe, targetSlot, { showLabel: true, variant: item.variant, precomputedFit: item.fitRes }) : ''}
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
        <button class="btn sm ${isSelected ? 'btn-primary primary' : 'btn-outline outline'}" type="button" onclick="event.stopPropagation(); selectSwapModalRecipe('${valAttr}');">
          ${isSelected ? 'Selected ✓' : 'Select'}
        </button>
      </div>
    </div>
  `;
}
