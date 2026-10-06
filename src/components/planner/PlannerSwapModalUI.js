/**
 * src/components/planner/PlannerSwapModalUI.js (v3.20.10)
 * Interactive Swap Meal Modal UI for the Weekly Meal Planner.
 * Extracted from PlannerView.js to maintain strict <400 line modularity.
 */

import { calculateMealFitScore, extractRecipeMacros } from '../../utils/fitScoreCalculator.js';
import { getSortedRecipes } from '../../services/FitScoreService.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';
import { buildPlannedMealActionItems } from './PlannerModalsUI.js';

let currentSwapModalContext = null;
let currentSwapModalFilter = 'all';

export function openSwapMealModal(day, slotKey) {
  const dayNum = +day;
  const slotInfo = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan?.slots?.[dayNum]?.[slotKey]) : { active: null, id: null, variant: 'original' };
  const mealType = slotKey.includes('breakfast') ? 'breakfast' : slotKey.includes('lunch') ? 'lunch' : 'dinner';
  const slotMealMode = typeof window.getSlotMealMode === 'function' ? window.getSlotMealMode(dayNum, mealType) : 'both';
  const filterWhoVal = document.getElementById('filter-who')?.value;
  const isDualView = slotMealMode === 'both' || filterWhoVal === 'both' || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');
  const who = isDualView ? 'both' : (slotKey.endsWith('E') ? 'Elliott' : slotKey.endsWith('C') ? 'Chloe' : 'any');
  const dayLabel = typeof window.formatPlanDayLabel === 'function' ? window.formatPlanDayLabel(window.state.plan, dayNum, { short: true }) : `Day ${dayNum}`;
  const typeTitle = typeof window.toTitleCase === 'function' ? window.toTitleCase(mealType) : mealType;

  const options = typeof window.getPlannerRecipeOptions === 'function' ? window.getPlannerRecipeOptions(mealType, who === 'both' ? 'any' : who) : [];
  const curValue = slotInfo.id ? slotInfo.id + (slotInfo.variant === 'enhanced' ? '::enhanced' : '') : '';

  const isBoth = who === 'both';
  const personKey = isBoth ? 'both' : (String(who || '').toLowerCase().startsWith('c') ? 'c' : 'e');
  const items = options.map(opt => {
    const value = opt.id + (opt.variant === 'enhanced' ? '::enhanced' : '');
    let cal = 0, prot = 0, serves = 0, ingredientsText = '', fitRes = null;
    try {
      const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo({ id: opt.id, variant: opt.variant }) : { recipe: null };
      if (info.recipe) {
        serves = info.recipe.serves || 0;
        ingredientsText = (info.recipe.ingredients || []).map(i => i.name || i.ingredient || '').join(' ');
        const bundle = typeof window.calculateRecipeDisplayNutrition === 'function' ? window.calculateRecipeDisplayNutrition({ recipe: info.recipe, variant: info.variant, mealType }) : null;
        const portions = bundle?.portions || null;
        const activeProf = isBoth ? 'everyone' : (personKey === 'c' ? 'chloe' : 'elliott');
        fitRes = calculateMealFitScore(info.recipe, mealType, {
          activeProfile: activeProf,
          variant: info.variant,
          portions,
          portionScaled: true
        });
        if (isBoth) {
          cal = Math.round(((portions?.eCal || 0) + (portions?.cCal || 0)) / 2);
          prot = typeof window.round1 === 'function' ? window.round1(((portions?.eProt || 0) + (portions?.cProt || 0)) / 2) : 0;
        } else {
          cal = personKey === 'c' ? (portions?.cCal || 0) : (portions?.eCal || 0);
          prot = personKey === 'c' ? (portions?.cProt || 0) : (portions?.eProt || 0);
        }
        if (!cal || !prot) {
          const fallbackMacros = extractRecipeMacros(info.recipe, info.variant);
          if (!cal && fallbackMacros.cal) cal = Math.round(fallbackMacros.cal);
          if (!prot && fallbackMacros.prot) prot = Math.round(fallbackMacros.prot * 10) / 10;
        }
      }
    } catch (e) {
      console.warn('Error calculating recipe nutrition for option:', e);
    }
    const rec = (window.state.recipes || []).find(r => r.id === opt.id);
    const isFav = (typeof window.isRecipeVariantFavourite === 'function' ? window.isRecipeVariantFavourite(opt.id, opt.variant || 'original') : false) || !!(rec?.isFavourite || rec?.isFavorite);
    return {
      id: opt.id,
      recipe: rec,
      variant: opt.variant || 'original',
      value,
      label: opt.label || 'Untitled Recipe',
      enhanced: !!opt.enhanced,
      isFavourite: isFav,
      isFavorite: isFav,
      cal: Math.round(cal || 0),
      prot: typeof window.round1 === 'function' ? window.round1(prot || 0) : prot,
      serves,
      ingredientsText,
      fitRes,
      fitScore: fitRes?.score ?? 0,
      fitTier: fitRes?.tier ?? 'amber',
      fitColor: fitRes?.tier === 'green' ? '#10B981' : (fitRes?.tier === 'red' ? '#EF4444' : '#F59E0B'),
      fitLabel: fitRes?.tierLabel ?? 'Fit',
      searchHaystack: `${opt.label} ${opt.variant || ''} ${Math.round(cal || 0)}kcal ${typeof window.round1 === 'function' ? window.round1(prot || 0) : prot}g ${ingredientsText}`.toLowerCase()
    };
  });

  currentSwapModalContext = {
    day: dayNum, slotKey, mealType, who, dayLabel, curValue, curInfo: slotInfo, selectedRecipeValue: null, items
  };

  let wrap = document.getElementById('swap-meal-modal-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'swap-meal-modal-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }

  const curRecipeName = slotInfo.active ? (slotInfo.active.name || slotInfo.recipe?.name || 'Current Meal') : null;
  const escHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => String(s ?? ''));

  wrap.innerHTML = `<div class="modal swap-meal-modal" style="max-width:640px;width:94vw;max-height:90vh;display:flex;flex-direction:column;border-radius:var(--radius-lg,14px);padding:20px">
    <div class="row-between" style="align-items:center;margin-bottom:12px;gap:10px;flex-shrink:0">
      <div>
        <h3 style="margin:0;font-size:17px;font-weight:750;color:var(--text)">Swap Meal — ${escHtml(dayLabel)}</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${escHtml(who === 'both' ? 'Shared (Elliott & Chloe)' : who + "'s")} ${escHtml(typeTitle)}</div>
      </div>
      <button class="modal-close-btn btn sm btn-ghost ghost" onclick="closeSwapMealModal()" aria-label="Close modal">✕</button>
    </div>

    ${curRecipeName ? `
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
    `}

    <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0">
      <div style="position:relative">
        <label for="swap-modal-search-input" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search recipes</label>
        <input type="text" id="swap-modal-search-input" name="swapModalSearch" aria-label="Search recipes" class="input" placeholder="Type to filter recipes (e.g. Chicken, Omelette, 500kcal)..." style="width:100%;font-size:13px;padding:9px 12px;border-radius:var(--radius-sm,6px);border:1px solid var(--border);background:var(--surface);color:var(--text)" oninput="renderSwapModalOptionsList()" autocomplete="off" spellcheck="false">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:11px;color:var(--text3);font-weight:600;margin-right:2px">Filter:</span>
          <button type="button" class="btn sm btn-secondary active-filter-btn" id="swap-filter-all" onclick="setSwapModalFilter('all')">All (${items.length})</button>
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
  </div>`;

  wrap.classList.add('open');
  currentSwapModalFilter = 'all';
  renderSwapModalOptionsList();
  setTimeout(() => document.getElementById('swap-modal-search-input')?.focus?.(), 100);
}

export function setSwapModalFilter(filterType) {
  currentSwapModalFilter = filterType;
  ['all', 'favourites', 'favorites', 'enhanced', 'original'].forEach(f => {
    const btn = document.getElementById(`swap-filter-${f}`);
    if (btn) {
      btn.className = (f === filterType || (f === 'favourites' && filterType === 'favorites') || (f === 'favorites' && filterType === 'favourites'))
        ? 'btn sm btn-secondary active-filter-btn' : 'btn sm btn-ghost ghost';
    }
  });
  renderSwapModalOptionsList();
}

export function selectSwapModalRecipe(value) {
  if (!currentSwapModalContext) return;
  currentSwapModalContext.selectedRecipeValue = value;
  const confirmBtn = document.getElementById('swap-modal-confirm-btn');
  if (confirmBtn) {
    const selectedItem = currentSwapModalContext.items.find(i => i.value === value);
    confirmBtn.disabled = !value;
    confirmBtn.textContent = selectedItem ? `Confirm Swap to "${selectedItem.label}"` : 'Confirm Swap';
  }
  const container = document.getElementById('swap-modal-list-container');
  if (container) {
    container.querySelectorAll('.swap-modal-item').forEach(el => {
      el.classList.toggle('is-selected', el.dataset.value === value);
    });
  }
}

export function confirmSwapMealModal() {
  if (!currentSwapModalContext || !currentSwapModalContext.selectedRecipeValue) return;
  const { day, slotKey, selectedRecipeValue } = currentSwapModalContext;
  executeSwapSlotAndClose(day, slotKey, selectedRecipeValue);
}

export function renderSwapModalOptionsList() {
  const container = document.getElementById('swap-modal-list-container');
  if (!container || !currentSwapModalContext) return;

  const { curValue, items, selectedRecipeValue } = currentSwapModalContext;
  const rawQuery = (document.getElementById('swap-modal-search-input')?.value || '').trim().toLowerCase();
  const terms = rawQuery.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

  let filtered = items.filter(item => {
    const isFav = item.isFavourite || item.isFavorite;
    if ((currentSwapModalFilter === 'favourites' || currentSwapModalFilter === 'favorites') && !isFav) return false;
    if (currentSwapModalFilter === 'enhanced' && item.variant !== 'enhanced') return false;
    if (currentSwapModalFilter === 'original' && item.variant === 'enhanced') return false;
    return !terms.length || terms.every(t => item.searchHaystack.includes(t));
  });

  const sortOption = document.getElementById('swap-modal-sort-select')?.value || 'best-fit';
  const targetSlot = currentSwapModalContext.mealType || 'dinner';
  const activeProfile = currentSwapModalContext.who === 'both'
    ? 'everyone'
    : (String(currentSwapModalContext.who || '').toLowerCase().startsWith('c') ? 'chloe' : 'elliott');
  filtered = getSortedRecipes(filtered, sortOption, targetSlot, { activeProfile });

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">No matching recipes found.</div>`;
    return;
  }

  const escAttr = typeof window.ppEscapeAttr === 'function' ? window.ppEscapeAttr : (s => String(s ?? ''));
  const escHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => String(s ?? ''));

  container.innerHTML = filtered.map(item => {
    const isCurrent = curValue === item.value;
    const isSelected = selectedRecipeValue === item.value;
    const isFav = item.isFavourite || item.isFavorite;
    const valAttr = escAttr(item.value);
    const labelHtml = escHtml(item.label);
    const idAttr = escAttr(item.id);
    const varAttr = escAttr(item.variant || 'original');

    return `<div class="swap-modal-item ${isFav ? 'is-favorite' : ''} ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" data-value="${valAttr}" onclick="selectSwapModalRecipe('${valAttr}')" ondblclick="executeSwapSlotAndClose(${currentSwapModalContext.day}, '${currentSwapModalContext.slotKey}', '${valAttr}')">
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
          ${renderFitScoreBadge(item.fitRes || item.recipe || item, targetSlot, { showLabel: true })}
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
        <button class="btn sm ${isSelected ? 'btn-primary primary' : 'btn-outline outline'}" type="button" onclick="event.stopPropagation(); selectSwapModalRecipe('${valAttr}');">
          ${isSelected ? 'Selected ✓' : 'Select'}
        </button>
      </div>
    </div>`;
  }).join('');
}

export function executeSwapSlotAndClose(day, slotKey, value) {
  if (typeof window.swapSlot === 'function') window.swapSlot(day, slotKey, value);
  closeSwapMealModal();
}

export function closeSwapMealModal() {
  const wrap = document.getElementById('swap-meal-modal-wrap');
  if (wrap) wrap.classList.remove('open');
  currentSwapModalContext = null;
}

export function quickRandomizeSwap(day, slotKey) {
  if (!currentSwapModalContext || !currentSwapModalContext.items.length) return;
  const items = currentSwapModalContext.items;
  const picked = items[Math.floor(Math.random() * items.length)];
  executeSwapSlotAndClose(day, slotKey, picked.value);
}

export function toggleSlotVariant(day, slotKey) {
  const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan?.slots?.[day]?.[slotKey]) : { recipe: null };
  if (!info?.recipe) return;
  const newVariant = (info.variant || 'original') === 'enhanced' ? 'original' : 'enhanced';
  window.state.plan.slots[day][slotKey] = typeof window.makePlanSlot === 'function' ? window.makePlanSlot(info.id, newVariant) : { id: info.id, recipeId: info.id, variant: newVariant };
  const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
  window.state.plan.productSelections = typeof window.lockProductSelectionsForSlots === 'function' ? window.lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
  window.state.plan.score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
  if (typeof window.saveState === 'function') window.saveState(window.state.plan);
  if (typeof window.renderPlan === 'function') window.renderPlan();
  if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`Switched to ${newVariant === 'enhanced' ? '✨ Enhanced' : 'Original'} variant for ${info.recipe.name}`);
}

export function prioritiseAllPlannedEnhancedRecipes() {
  if (!window.state.plan?.slots) return typeof window.showPlatePlanToast === 'function' ? window.showPlatePlanToast('No active meal plan to prioritise.') : null;
  let upgradedCount = 0;
  Object.entries(window.state.plan.slots).forEach(([day, daySlots]) => {
    Object.entries(daySlots || {}).forEach(([slotKey, slotVal]) => {
      if (!slotVal) return;
      const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(slotVal) : { recipe: null };
      if (!info?.recipe || info.variant === 'enhanced') return;
      const r = info.recipe;
      const hasEnhanced = r.enhanced && ((r.enhanced.ingredients?.length) || (r.enhanced.method?.length) || (r.enhanced.steps?.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
      if (hasEnhanced) {
        window.state.plan.slots[day][slotKey] = typeof window.makePlanSlot === 'function' ? window.makePlanSlot(info.id, 'enhanced') : { id: info.id, recipeId: info.id, variant: 'enhanced' };
        upgradedCount++;
      }
    });
  });

  if (upgradedCount > 0) {
    const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
    window.state.plan.productSelections = typeof window.lockProductSelectionsForSlots === 'function' ? window.lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
    window.state.plan.score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
    if (typeof window.saveState === 'function') window.saveState(window.state.plan);
    if (typeof window.renderPlan === 'function') window.renderPlan();
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(`✨ Prioritised ${upgradedCount} meal(s) to Enhanced variants!`);
  } else if (typeof window.showPlatePlanToast === 'function') {
    window.showPlatePlanToast('All eligible meals in your plan are already using Enhanced variants.');
  }
}

export function openPlannedMealActions(day, slotKey) {
  const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan?.slots?.[day]?.[slotKey]) : { recipe: null };
  if (!info?.active && !info?.recipe) return typeof window.showPlatePlanToast === 'function' ? window.showPlatePlanToast('That planned meal is no longer available.') : null;
  const actions = buildPlannedMealActionItems(info, day, slotKey);
  if (typeof window.openMobileActionSheet === 'function') {
    window.openMobileActionSheet(info.active?.name || info.recipe?.name || 'Planned meal', actions);
  }
}

export function swapSlot(day, slot, id) {
  if (!window.state.plan.slots[day]) window.state.plan.slots[day] = {};
  let swappedName = '';
  const mealType = slot.includes('breakfast') ? 'breakfast' : slot.includes('lunch') ? 'lunch' : 'dinner';
  const slotMealMode = typeof window.getSlotMealMode === 'function' ? window.getSlotMealMode(day, mealType) : 'both';
  const counterpartKey = typeof window.getPlanSlotCounterpartKey === 'function' ? window.getPlanSlotCounterpartKey(slot) : null;
  const isDualView = slotMealMode === 'both' || (document.getElementById('filter-who')?.value === 'both') || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');

  if (id) {
    const parsed = typeof window.parsePlanRecipeValue === 'function' ? window.parsePlanRecipeValue(id) : { id, variant: 'original' };
    const slotObj = typeof window.makePlanSlot === 'function' ? window.makePlanSlot(parsed.id, parsed.variant) : { id: parsed.id, recipeId: parsed.id, variant: parsed.variant };
    window.state.plan.slots[day][slot] = slotObj;
    if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, slot, '');
    if (isDualView && counterpartKey) {
      window.state.plan.slots[day][counterpartKey] = { ...slotObj };
      if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, counterpartKey, '');
    }
    const info = typeof window.getPlanSlotInfo === 'function' ? window.getPlanSlotInfo(window.state.plan.slots[day][slot]) : { active: null };
    swappedName = info?.active?.name || info?.recipe?.name || '';
  } else {
    window.state.plan.slots[day][slot] = null;
    if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, slot, '');
    if (isDualView && counterpartKey) {
      window.state.plan.slots[day][counterpartKey] = null;
      if (typeof window.setPlanSlotReason === 'function') window.setPlanSlotReason(day, counterpartKey, '');
    }
  }
  const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
  window.state.plan.productSelections = typeof window.lockProductSelectionsForSlots === 'function' ? window.lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
  window.state.plan.productPriority = priority;
  window.state.plan.confirmedShopping = false;
  window.state.plan.mealPrepGroups = [];
  window.state.plan.declinedMealPrepGroups = [];
  window.state.plan.score = typeof window.calculatePlanScore === 'function' ? window.calculatePlanScore(window.state.plan) : 0;
  if (typeof window.saveState === 'function') window.saveState(window.state.plan);
  if (typeof window.renderPlan === 'function') window.renderPlan();
  const toastMsg = swappedName
    ? (isDualView ? `Assigned ${swappedName} for Elliott & Chloe` : `Swapped meal to ${swappedName}`)
    : (isDualView ? 'Meal slots cleared for Elliott & Chloe' : 'Meal slot cleared');
  if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast(toastMsg);
}
