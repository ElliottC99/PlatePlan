/**
 * src/components/planner/PlannerMealSlot.js (v3.20.14)
 * UI component for meal slot cards, dual-profile portion badges,
 * meal type labels, and recipe swap/clear triggers.
 */

import { calculateMealFitScore, extractRecipeMacros } from '../../utils/fitScoreCalculator.js';
import { renderFitScoreBadge } from '../FitScoreBadge.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function renderSlotRow(options) {
  const {
    day,
    slotKey,
    slotColor = '#4B5563',
    lblLines = ['Meal', 'Person'],
    isExcluded = false,
    showRecipe = false,
    recipe = null,
    instanceId = '',
    variant = 'original',
    rowPerson = '',
    rowCal = 0,
    rowProt = 0,
    isPinned = false,
    slotReasonLabel = '',
    hasSlotReason = false
  } = options;

  if (isExcluded) {
    return `<div class="slot-row"><span class="slot-lbl" style="color:${slotColor}">${lblLines[0]}<br>${lblLines[1]}</span><span class="slot-skipped">Not needed</span></div>`;
  }

  const rowAttrs = showRecipe
    ? ` data-plan-person="${rowPerson}" data-plan-cal="${rowCal}" data-plan-prot="${rowProt}"`
    : '';

  const calStr = showRecipe ? `${Math.round(rowCal)}kcal / P${rowProt.toFixed(1)}g` : '';

  let slotActionsHtml = '';
  if (showRecipe) {
    const rId = recipe?.id || '';
    slotActionsHtml = `<div class="slot-actions">
      <span class="slot-macro">${calStr}</span>
      <button class="btn sm primary" data-action="view-meal-detail" data-recipe-id="${escapeAttr(rId)}" data-instance-id="${escapeAttr(instanceId)}" data-variant="${escapeAttr(variant)}" onclick="viewRecipe('${escapeAttr(rId)}', '${escapeAttr(instanceId)}', '${escapeAttr(variant)}')">View</button>
      <button class="btn sm ghost" data-action="swap-slot" data-day="${day}" data-slot="${escapeAttr(slotKey)}" onclick="openSwapMealModal(${day}, '${escapeAttr(slotKey)}')">Swap</button>
      <button class="btn sm ghost" data-action="planned-meal-actions" data-day="${day}" data-slot="${escapeAttr(slotKey)}" onclick="openPlannedMealActions(${day}, '${escapeAttr(slotKey)}')">More</button>
    </div>`;
  } else if (hasSlotReason) {
    slotActionsHtml = `<div class="slot-actions">
      <button class="btn sm ghost" data-action="swap-slot" data-day="${day}" data-slot="${escapeAttr(slotKey)}" onclick="openSwapMealModal(${day}, '${escapeAttr(slotKey)}')">Choose Meal</button>
      <button class="btn sm ghost" data-action="clear-slot-reason" data-day="${day}" data-slot="${escapeAttr(slotKey)}" onclick="clearPlanSlotReason(${day}, '${escapeAttr(slotKey)}')">Clear reason</button>
    </div>`;
  } else {
    slotActionsHtml = `<div class="slot-actions">
      <button class="btn sm ghost" data-action="swap-slot" data-day="${day}" data-slot="${escapeAttr(slotKey)}" onclick="openSwapMealModal(${day}, '${escapeAttr(slotKey)}')">Choose Meal</button>
    </div>`;
  }

  const emptyContent = hasSlotReason
    ? `<span class="plan-slot-reason">${escapeHtml(slotReasonLabel)}</span>`
    : `<span style="color:var(--text3)">Not set</span>`;

  const isBreakableUrl = recipe?.name && /(?:https?:\/\/|www\.)/i.test(recipe.name);
  const nameHtml = showRecipe
    ? `<span class="slot-name${isBreakableUrl ? ' breakable-url' : ''}">${escapeHtml(recipe.name)}${variant === 'enhanced' ? ' <span class="tag green">Enhanced</span>' : ''}${isPinned ? ' <span class="tag pinned" title="Pre-selected recipe">Pinned</span>' : ''}</span>`
    : `<span class="slot-name">${emptyContent}</span>`;

  return `<div class="slot-row"${rowAttrs}><span class="slot-lbl" style="color:${slotColor}">${lblLines[0]}<br>${lblLines[1]}</span>${nameHtml}${slotActionsHtml}</div>`;
}

export function renderDensePlanMealRow({ meal, isShared, rE, rC, infoE, infoC, day, slotKeyE, slotKeyC }) {
  if (!rE && !rC) {
    return `
      <div class="dense-plan-person-row" style="opacity:0.6">
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase">${meal}</div>
        <div style="font-size:12px;color:var(--text3);font-style:italic">Excluded / Not planned</div>
      </div>
    `;
  }

  if (isShared) {
    return `
      <div class="dense-plan-person-row">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;font-weight:750;color:var(--text2);text-transform:uppercase">${meal} (Both)</span>
          <button type="button" class="dense-plan-swap-btn" data-action="searchable-swap-slot" data-day="${day}" data-slot="${escapeAttr(slotKeyE)}" data-shared="true" onclick="openSearchableRecipeSwapModal(${day}, '${escapeAttr(slotKeyE)}', true)">Swap ▾</button>
        </div>
        <div class="dense-plan-slot">
          <span style="font-weight:600;color:var(--text)">${escapeHtml(rE.name)} ${infoE?.variant === 'enhanced' ? '<span style="font-size:10px;color:var(--action);font-weight:700">ENHANCED</span>' : ''}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="dense-plan-person-row">
      <div style="font-size:11px;font-weight:750;color:var(--text2);text-transform:uppercase">${meal}</div>
      ${rE ? `
        <div class="dense-plan-slot">
          <span><strong style="color:var(--text2)">E:</strong> ${escapeHtml(rE.name)} ${infoE?.variant === 'enhanced' ? '<span style="font-size:10px;color:var(--action)">[Enh]</span>' : ''}</span>
          <button type="button" class="dense-plan-swap-btn" data-action="searchable-swap-slot" data-day="${day}" data-slot="${escapeAttr(slotKeyE)}" data-shared="false" onclick="openSearchableRecipeSwapModal(${day}, '${escapeAttr(slotKeyE)}', false)">Swap ▾</button>
        </div>
      ` : ''}
      ${rC ? `
        <div class="dense-plan-slot" style="margin-top:4px">
          <span><strong style="color:var(--text2)">C:</strong> ${escapeHtml(rC.name)} ${infoC?.variant === 'enhanced' ? '<span style="font-size:10px;color:var(--action)">[Enh]</span>' : ''}</span>
          <button type="button" class="dense-plan-swap-btn" data-action="searchable-swap-slot" data-day="${day}" data-slot="${escapeAttr(slotKeyC)}" data-shared="false" onclick="openSearchableRecipeSwapModal(${day}, '${escapeAttr(slotKeyC)}', false)">Swap ▾</button>
        </div>
      ` : ''}
    </div>
  `;
}

let currentSearchableSwapContext = null;

export function ensureSearchableRecipeSwapModalDom() {
  let modal = document.getElementById('searchable-recipe-swap-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'searchable-recipe-swap-modal';
  modal.className = 'modal-backdrop';
  modal.style.display = 'none';
  if (typeof window !== 'undefined' && window.PlannerModalsUI?.renderSearchableRecipeSwapModalDom) {
    modal.innerHTML = window.PlannerModalsUI.renderSearchableRecipeSwapModalDom();
  } else {
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 680px; width: 92%; max-height: 85vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 16px; background: var(--surface); box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid var(--border);">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface2);">
          <div>
            <h3 id="swap-modal-title" style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Swap Recipe</h3>
            <div id="swap-modal-subtitle" style="font-size: 12px; color: var(--text2); margin-top: 2px;">Search across all recipes by title, ingredient, or tag.</div>
          </div>
          <button type="button" class="btn ghost sm" onclick="window.PlannerMealSlot?.closeSearchableRecipeSwapModal?.() || (window.closeSearchableRecipeSwapModal && window.closeSearchableRecipeSwapModal())" style="font-size: 18px; line-height: 1; padding: 4px 8px;">✕</button>
        </div>
        <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--surface);">
          <input type="search" id="swap-modal-search" class="input" placeholder="Type recipe name, ingredient (e.g. chicken, tofu), or tag..." style="width: 100%; font-size: 14px; padding: 8px 12px;" oninput="window.PlannerMealSlot?.filterSearchableRecipeSwapModal?.(this.value) || (window.filterSearchableRecipeSwapModal && window.filterSearchableRecipeSwapModal(this.value))" autofocus>
        </div>
        <div id="swap-modal-results" style="flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; max-height: 55vh;"></div>
        <div style="padding: 12px 20px; border-top: 1px solid var(--border); background: var(--surface2); display: flex; justify-content: flex-end;">
          <button type="button" class="btn ghost sm" onclick="window.PlannerMealSlot?.closeSearchableRecipeSwapModal?.() || (window.closeSearchableRecipeSwapModal && window.closeSearchableRecipeSwapModal())">Cancel</button>
        </div>
      </div>
    `;
  }
  document.body.appendChild(modal);
  return modal;
}

export function openSearchableRecipeSwapModal(day, slotKey, isShared = false) {
  currentSearchableSwapContext = { day, slotKey, isShared };
  const modal = ensureSearchableRecipeSwapModalDom();
  const getMealType = window.getMealTypeFromSlotKey || (k => k.includes('breakfast') ? 'breakfast' : k.includes('lunch') ? 'lunch' : 'dinner');
  const mealType = getMealType(slotKey) || 'dinner';
  const person = isShared ? 'Both (Elliott & Chloe)' : (slotKey.endsWith('C') ? 'Chloe' : 'Elliott');

  const titleEl = document.getElementById('swap-modal-title');
  if (titleEl) titleEl.textContent = `Swap ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} for ${person} (Day ${day})`;

  const searchInput = document.getElementById('swap-modal-search');
  if (searchInput) searchInput.value = '';

  filterSearchableRecipeSwapModal('');
  modal.style.display = 'flex';
  if (searchInput) setTimeout(() => searchInput.focus(), 50);
}

export function closeSearchableRecipeSwapModal() {
  const modal = document.getElementById('searchable-recipe-swap-modal');
  if (modal) modal.style.display = 'none';
  currentSearchableSwapContext = null;
}

export function filterSearchableRecipeSwapModal(query = '') {
  const resultsContainer = document.getElementById('swap-modal-results');
  if (!resultsContainer || !currentSearchableSwapContext) return;

  const { day, slotKey, isShared } = currentSearchableSwapContext;
  const stateObj = window.state || {};
  const currentSlot = stateObj.plan?.slots?.[day]?.[slotKey];
  const currentId = currentSlot?.id;
  const cleanQ = (query || '').toLowerCase().trim();
  const mealType = window.getMealTypeFromSlotKey?.(slotKey) || (slotKey.includes('breakfast') ? 'breakfast' : slotKey.includes('lunch') ? 'lunch' : 'dinner');
  const activeProfile = isShared ? 'everyone' : (slotKey.endsWith('C') ? 'chloe' : 'elliott');

  const allRecipes = Array.isArray(stateObj.recipes) ? stateObj.recipes : [];
  const candidates = allRecipes.filter(r => {
    if (!r || !r.id || r.id === currentId) return false;
    if (!cleanQ) return true;
    const nameMatch = (r.name || r.title || '').toLowerCase().includes(cleanQ);
    if (nameMatch) return true;
    const ingMatch = Array.isArray(r.ingredients) && r.ingredients.some(i => (i?.name || i?.raw || '').toLowerCase().includes(cleanQ));
    if (ingMatch) return true;
    const tagMatch = Array.isArray(r.tags) && r.tags.some(t => String(t).toLowerCase().includes(cleanQ));
    if (tagMatch) return true;
    return (r.category || r.cuisine || '').toLowerCase().includes(cleanQ);
  });

  resultsContainer.innerHTML = '';
  if (candidates.length === 0) {
    resultsContainer.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">No recipes match "${escapeHtml(query)}". Try another search term.</div>`;
    return;
  }

  const placeholderImg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="6" fill="%23e5e7eb"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="20">🍲</text></svg>`;

  candidates.forEach(r => {
    const macros = extractRecipeMacros(r, 'original');
    const cal = Math.round(macros.cal || 0);
    const prot = Math.round((macros.prot || 0) * 10) / 10;
    const mealType = window.getMealTypeFromSlotKey?.(slotKey) || (slotKey.includes('breakfast') ? 'breakfast' : slotKey.includes('lunch') ? 'lunch' : 'dinner');
    const person = currentSearchableSwapContext.isShared ? 'everyone' : (slotKey.endsWith('C') ? 'chloe' : 'elliott');
    const fitRes = calculateMealFitScore(r, mealType, { activeProfile: person, portionScaled: true });
    const fitBadgeHtml = renderFitScoreBadge(fitRes, mealType, { activeProfile: person });

    const row = document.createElement('div');
    row.className = 'swap-candidate-row';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;';
    row.innerHTML = `
      <img src="${escapeAttr(r.photo || r.img || r.image || placeholderImg)}" alt="${escapeAttr(r.name || 'Recipe')}" style="width:44px;height:44px;border-radius:6px;object-fit:cover;flex-shrink:0" onerror="this.src='${placeholderImg}'">
      <div style="flex:1;min-width:0">
        <div style="font-weight:650;font-size:13.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.name || r.title || 'Untitled Recipe')}</div>
        <div style="font-size:11.5px;color:var(--text2);margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span><strong>${cal}</strong> kcal</span><span>·</span><span><strong>${prot}g</strong> protein</span><span>·</span>${fitBadgeHtml}
        </div>
      </div>
      <button type="button" class="btn sm primary" style="font-size:12px;font-weight:700;padding:6px 12px;white-space:nowrap;flex-shrink:0" onclick="window.PlannerMealSlot?.selectAndSwapRecipe?.('${escapeAttr(r.id)}', 'original') || (window.selectAndSwapRecipe && window.selectAndSwapRecipe('${escapeAttr(r.id)}', 'original'))">Select &amp; Swap</button>
    `;
    resultsContainer.appendChild(row);
  });
}

export function selectAndSwapRecipe(recipeId, variant = 'original') {
  const stateObj = window.state;
  if (!currentSearchableSwapContext || !stateObj?.plan?.slots) return;
  const { day, slotKey, isShared } = currentSearchableSwapContext;
  if (!stateObj.plan.slots[day]) stateObj.plan.slots[day] = {};

  const makeSlot = window.makePlanSlot || ((id, v) => ({ id, variant: v }));
  if (isShared) {
    const getMealType = window.getMealTypeFromSlotKey || (k => k.includes('breakfast') ? 'breakfast' : k.includes('lunch') ? 'lunch' : 'dinner');
    const meal = getMealType(slotKey) || 'dinner';
    stateObj.plan.slots[day][meal + 'E'] = makeSlot(recipeId, variant);
    stateObj.plan.slots[day][meal + 'C'] = makeSlot(recipeId, variant);
  } else {
    stateObj.plan.slots[day][slotKey] = makeSlot(recipeId, variant);
  }

  if (window.calculatePlanScore) stateObj.plan.score = window.calculatePlanScore(stateObj.plan);
  if (window.findMealPrepSuggestions) {
    const autoPrepSuggestions = window.findMealPrepSuggestions(stateObj.plan);
    stateObj.plan.mealPrepGroups = autoPrepSuggestions.map(s => ({ key: s.key, recipeId: s.recipeId, variant: s.variant, mealKey: s.mealKey, peopleKey: s.peopleKey, days: s.days }));
  }
  if (window.saveState) window.saveState();
  closeSearchableRecipeSwapModal();
  if (window.renderPlannerWizard) window.renderPlannerWizard();
  if (window.showPlatePlanToast) window.showPlatePlanToast('Recipe swapped & Fit Score updated! ✓');
}

