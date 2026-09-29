/**
 * src/components/planner/PlannerModalsUI.js (v3.9.5)
 * Modular Presentation Component for Recipe Swap Modals & Action Sheets
 */

function escapeHtml(str) {
  if (typeof window !== 'undefined' && window.ppEscapeHtml) {
    return window.ppEscapeHtml(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (typeof window !== 'undefined' && window.ppEscapeAttr) {
    return window.ppEscapeAttr(str);
  }
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Generates action items array for openPlannedMealActions action sheet
 */
export function buildPlannedMealActionItems(info, day, slotKey) {
  const r = info?.recipe;
  const hasEnhanced = r && r.enhanced && (
    (r.enhanced.ingredients && r.enhanced.ingredients.length) ||
    (r.enhanced.method && r.enhanced.method.length) ||
    (r.enhanced.steps && r.enhanced.steps.length) ||
    r.enhanced.name || r.enhanced.changes || r.enhancedPortions
  );
  const isEnhanced = info?.variant === 'enhanced';
  const actions = [];

  if (hasEnhanced) {
    if (isEnhanced) {
      actions.push({
        label: '🔄 Switch to Original variant',
        onclick: `toggleSlotVariant(${+day},'${escapeAttr(slotKey)}')`
      });
    } else {
      actions.push({
        label: '✨ Switch to Enhanced variant (Higher Protein)',
        onclick: `toggleSlotVariant(${+day},'${escapeAttr(slotKey)}')`
      });
    }
  }

  actions.push({
    label: 'Review recipe & portions',
    onclick: `reviewRecipeModalView('${escapeAttr(info.id)}','${escapeAttr(info.instanceId || '')}','${escapeAttr(info.variant || 'original')}')`
  });
  actions.push({
    label: 'Swap / Choose different meal',
    onclick: `openSwapMealModal(${+day},'${escapeAttr(slotKey)}')`
  });
  actions.push({
    label: 'Reschedule meal',
    onclick: `openPlanReschedule(${+day},'${escapeAttr(slotKey)}')`
  });
  actions.push({
    label: 'Clear slot',
    onclick: `swapSlot(${+day},'${escapeAttr(slotKey)}',null)`
  });

  return actions;
}

/**
 * Returns HTML for save plan confirmation modal
 */
export function renderSavePlanModalContent(defaultName = '') {
  return `<div style="margin-bottom:10px">Save the current meal plan to the Meal Plan Library.</div>
   <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Plan name</label>
   <input id="save-plan-name" type="text" value="${escapeHtml(defaultName)}" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text)">`;
}

/**
 * Returns HTML template string for #searchable-recipe-swap-modal
 */
export function renderSearchableRecipeSwapModalDom() {
  return `<div class="modal-card" style="max-width: 680px; width: 92%; max-height: 85vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 16px; background: var(--surface); box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid var(--border);">
    <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface2);">
      <div>
        <h3 id="swap-modal-title" style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Swap Recipe</h3>
        <div id="swap-modal-subtitle" style="font-size: 12px; color: var(--text2); margin-top: 2px;">Search across all recipes by title, ingredient, or tag.</div>
      </div>
      <button type="button" class="modal-close-btn" onclick="window.PlannerMealSlot?.closeSearchableRecipeSwapModal?.() || (window.closeSearchableRecipeSwapModal && window.closeSearchableRecipeSwapModal())" aria-label="Close" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;line-height:1;padding:4px 8px;border-radius:6px;">&times;</button>
    </div>
    <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--surface);">
      <input type="search" id="swap-modal-search" class="input" placeholder="Type recipe name, ingredient (e.g. chicken, tofu), or tag..." style="width: 100%; font-size: 14px; padding: 8px 12px;" oninput="window.PlannerMealSlot?.filterSearchableRecipeSwapModal?.(this.value) || (window.filterSearchableRecipeSwapModal && window.filterSearchableRecipeSwapModal(this.value))" autofocus>
    </div>
    <div id="swap-modal-results" style="flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; max-height: 55vh;"></div>
  </div>`;
}
