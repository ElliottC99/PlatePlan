/**
 * src/components/planner/PlannerSwapModalUI.js (v3.38.67)
 * Interactive Swap Meal Modal UI for the Weekly Meal Planner.
 * Strictly modular (<350 lines).
 */

import { calculateMealFitScore, extractRecipeMacros } from '../../utils/fitScoreCalculator.js';
import { getSortedRecipes } from '../../services/FitScoreService.js';
import { buildPlannedMealActionItems } from './PlannerModalsUI.js';
import { renderSwapModalBase, renderSwapModalItem } from './PlannerSwapModalRenderService.js';

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

  const baseOptions = typeof window.getPlannerRecipeOptions === 'function' ? window.getPlannerRecipeOptions(mealType, who === 'both' ? 'any' : who) : [];
  const options = [];
  baseOptions.forEach(opt => {
    options.push(opt);
    if (opt.enhanced && typeof opt.enhanced === 'object') {
      const enhancedObj = { ...opt, ...opt.enhanced };
      enhancedObj.mealSuitability = opt.mealSuitability || ['dinner'];
      options.push({ ...enhancedObj, variant: 'enhanced', label: (opt.enhanced.name || opt.label + ' (Enhanced)') });
    }
  });
  const curValue = slotInfo.id + (slotInfo.variant === 'enhanced' ? '::enhanced' : '');

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

  wrap.innerHTML = renderSwapModalBase({
    dayLabel, who, typeTitle, curRecipeName, slotInfo,
    itemsCount: items.length, dayNum, slotKey
  });

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

  container.innerHTML = filtered.map(item => renderSwapModalItem(item, {
    isCurrent: curValue === item.value,
    isSelected: selectedRecipeValue === item.value,
    day: currentSwapModalContext.day,
    slotKey: currentSwapModalContext.slotKey,
    targetSlot
  })).join('');
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
