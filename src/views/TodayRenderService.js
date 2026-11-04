/**
 * src/views/TodayRenderService.js
 * Apple HIG Compliant Render Service for Today Dashboard.
 * Renders Apple Health-style horizontal progress bars and elevated meal cards.
 */

import { escapeAttr, escapeHtml } from '../utils/stringUtils.js';
import { renderFitScoreBadge } from '../components/FitScoreBadge.js';
import { isMealEatenOnDate } from '../services/TodayViewService.js';

/**
 * Renders Apple Health-style horizontal macro progress bars.
 *
 * @param {Object} totals - Calculated daily totals { calories, protein, carbs, fat }
 * @param {Object} targets - Target daily values { calories, protein, carbs, fat }
 * @returns {string} HTML markup
 */
export function renderTodayMacrosCard(totals = {}, targets = {}) {
  const cal = Math.round(totals.calories || 0);
  const prot = Math.round(totals.protein || 0);
  const carbs = Math.round(totals.carbs || 0);
  const fat = Math.round(totals.fat || 0);

  const targetCal = Math.round(targets.calories || 2000);
  const targetProt = Math.round(targets.protein || 130);
  const targetCarbs = Math.round(targets.carbs || 220);
  const targetFat = Math.round(targets.fat || 65);

  const calPct = Math.min(100, Math.round((cal / (targetCal || 1)) * 100));
  const protPct = Math.min(100, Math.round((prot / (targetProt || 1)) * 100));
  const carbsPct = Math.min(100, Math.round((carbs / (targetCarbs || 1)) * 100));
  const fatPct = Math.min(100, Math.round((fat / (targetFat || 1)) * 100));

  return `
    <div class="ios-grouped-card" style="padding: 16px; margin-bottom: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
        <span class="ios-headline" style="color:var(--label); font-weight:700;">Daily Nutrition</span>
        <span style="font-size:13px; font-weight:600; color:var(--secondary-label);">${cal} / ${targetCal} kcal</span>
      </div>

      <!-- Macro Progress Bars Grid -->
      <div style="display:flex; flex-direction:column; gap:12px;">
        <!-- Calories -->
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
            <span style="color:var(--label);">Calories</span>
            <span style="color:var(--secondary-label);">${calPct}%</span>
          </div>
          <div style="height:8px; border-radius:4px; background:var(--system-gray5); overflow:hidden;">
            <div style="height:100%; width:${calPct}%; background:var(--tint-color); border-radius:4px; transition:width 0.4s ease;"></div>
          </div>
        </div>

        <!-- Protein -->
        <div>
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
            <span style="color:var(--label);">Protein</span>
            <span style="color:var(--secondary-label);">${prot} / ${targetProt}g</span>
          </div>
          <div style="height:8px; border-radius:4px; background:var(--system-gray5); overflow:hidden;">
            <div style="height:100%; width:${protPct}%; background:var(--system-blue); border-radius:4px; transition:width 0.4s ease;"></div>
          </div>
        </div>

        <!-- Carbs & Fat Row -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
              <span style="color:var(--label);">Carbs</span>
              <span style="color:var(--secondary-label);">${carbs}g</span>
            </div>
            <div style="height:8px; border-radius:4px; background:var(--system-gray5); overflow:hidden;">
              <div style="height:100%; width:${carbsPct}%; background:var(--system-orange); border-radius:4px; transition:width 0.4s ease;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; font-weight:600;">
              <span style="color:var(--label);">Fat</span>
              <span style="color:var(--secondary-label);">${fat}g</span>
            </div>
            <div style="height:8px; border-radius:4px; background:var(--system-gray5); overflow:hidden;">
              <div style="height:100%; width:${fatPct}%; background:var(--system-yellow); border-radius:4px; transition:width 0.4s ease;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders an elevated Apple Health summary card for a planned meal slot.
 */
export function renderTodayMealCard(slot, { info: slotInfo, person }, eatenMeals, dayKey, currentDateStr) {
  const recipe = slotInfo.active;
  const isEatenE = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'e');
  const isEatenC = isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'c');
  const isEaten = person === 'e' ? isEatenE
    : person === 'c' ? isEatenC
    : isMealEatenOnDate(eatenMeals, currentDateStr, slot.type, 'both');
  const personLabel = person === 'e' ? ' · Elliott' : person === 'c' ? ' · Chloe' : '';
  const activeProfile = person === 'e' ? 'elliott' : person === 'c' ? 'chloe' : 'everyone';
  const fitBadge = renderFitScoreBadge(slotInfo.recipe || recipe, slot.type, {
    activeProfile,
    variant: slotInfo.variant || 'original',
    showLabel: true
  });

  const eatenLabel = isEaten ? '✓ Eaten' : 'Mark Eaten';

  const mainTick = `
    <button class="ios-nav-btn ${isEaten ? 'bold' : ''}" type="button" data-action="toggle-meal-eaten" data-meal-type="${slot.type}" data-person="${person}" style="color:${isEaten ? 'var(--tint-color)' : 'var(--secondary-label)'}; font-size:14px;">
      ${eatenLabel}
    </button>`;

  const personTicks = person !== 'both' ? '' : `
    <div style="display:flex; gap:4px;">
      <button class="btn xs ${isEatenE ? 'primary' : 'ghost'}" type="button" data-action="toggle-meal-eaten" data-meal-type="${slot.type}" data-person="e" style="padding:2px 7px; font-size:11px;" title="Toggle Elliott">
        ${isEatenE ? '✓ E' : 'E'}
      </button>
      <button class="btn xs ${isEatenC ? 'primary' : 'ghost'}" type="button" data-action="toggle-meal-eaten" data-meal-type="${slot.type}" data-person="c" style="padding:2px 7px; font-size:11px;" title="Toggle Chloe">
        ${isEatenC ? '✓ C' : 'C'}
      </button>
    </div>`;

  const swapBtn = dayKey ? `
    <button class="ios-nav-btn" type="button" data-action="open-today-rearrange-modal" data-day-key="${escapeAttr(dayKey)}" data-meal-type="${escapeAttr(slot.type)}" title="Swap with another day" style="font-size:14px; color:var(--tint-color);">
      ⇄ Swap
    </button>` : '';

  const cal = Math.round(recipe.nutrition?.perServing?.cal ?? recipe.macros?.calories ?? 0);
  const prot = Math.round(recipe.nutrition?.perServing?.prot ?? recipe.macros?.protein ?? 0);

  return `
    <div class="ios-grouped-card" style="padding: 16px; margin-bottom: 14px; opacity:${isEaten ? '0.78' : '1'}; transition:opacity 0.2s ease;">
      <!-- Slot Header Row -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
        <span style="font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:var(--secondary-label);">
          ${slot.icon} ${slot.label}${personLabel}
        </span>
        <div>${fitBadge}</div>
      </div>

      <!-- Meal Title and Details -->
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <div style="flex:1;">
          <h4 style="margin:0 0 6px 0; font-size:17px; font-weight:600; color:var(--label); letter-spacing:-0.024em;">
            ${escapeHtml(recipe.name || 'Untitled Recipe')}
          </h4>
          <div style="font-size:13px; color:var(--secondary-label); display:flex; gap:12px; align-items:center;">
            <span>🔥 ${cal} kcal</span>
            <span>💪 ${prot}g P</span>
            ${(recipe.prepTime || recipe.time) ? `<span>⏱️ ${escapeHtml(recipe.prepTime || recipe.time)}</span>` : ''}
          </div>
        </div>
        <button class="btn sm" type="button" data-action="view-recipe" data-recipe-id="${escapeAttr(recipe.id)}" data-instance-id="${escapeAttr(slotInfo.instanceId || '')}" data-variant="${escapeAttr(slotInfo.variant || 'original')}" style="font-size:13px; font-weight:600; border-radius:var(--radius-control); padding:6px 12px; white-space:nowrap;">
          View
        </button>
      </div>

      <!-- Actions Divider & Buttons -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:0.5px solid var(--separator); padding-top:10px; margin-top:4px;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${mainTick}
          ${personTicks}
        </div>
        <div>
          ${swapBtn}
        </div>
      </div>
    </div>
  `;
}
