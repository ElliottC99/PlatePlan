/**
 * scripts/features/shopping-list-alloc.js
 * PlatePlan Shopping List Meal Allocation Rows & Batch Actions Sub-Module
 * Classic global namespace script.
 */

window.PlatePlanShoppingList = window.PlatePlanShoppingList || {};
window.PlatePlanShopping = window.PlatePlanShopping || window.PlatePlanShoppingList;

function updateShopGroupPref(val) {
  const activeState = window.state || state;
  if (activeState?.prefs) {
    activeState.prefs.shopGroupBy = val;
  }
  if (typeof saveState === 'function') saveState();
  const renderFn = window.renderShopping || window.PlatePlanShoppingList?.renderShopping;
  if (typeof renderFn === 'function') renderFn();
}

function setPackPick(bankId, key) {
  const activeState = window.state || state;
  if (!activeState.packPicks) activeState.packPicks = {};
  if (!key || key === 'auto') delete activeState.packPicks[bankId];
  else activeState.packPicks[bankId] = key;
  if (typeof saveState === 'function') saveState();
  const renderFn = window.renderShopping || window.PlatePlanShoppingList?.renderShopping;
  if (typeof renderFn === 'function') renderFn();
}

function setShoppingAtHome(key, checked, { quiet = false } = {}) {
  const activeState = window.state || state;
  if (!activeState.plan?.slots || !key) return;
  if (!activeState.plan.shoppingAtHome || typeof activeState.plan.shoppingAtHome !== 'object') activeState.plan.shoppingAtHome = {};
  if (checked) activeState.plan.shoppingAtHome[key] = true;
  else delete activeState.plan.shoppingAtHome[key];
  activeState.plan.confirmedShopping = false;
  if (typeof saveState === 'function') saveState();
  if (typeof markPlatePlanViewsDirty === 'function') markPlatePlanViewsDirty('shopping', 'planlib');
  const renderFn = window.renderShopping || window.PlatePlanShoppingList?.renderShopping;
  if (typeof renderFn === 'function') renderFn();
  if (!quiet && typeof showPlatePlanToast === 'function') {
    showPlatePlanToast(checked ? 'Moved to Already have.' : 'Moved back to your shopping list.', {
      label: 'Undo',
      onclick: () => setShoppingAtHome(key, !checked, { quiet: true })
    });
  }
}

function organiseShoppingAtHomeRows(host) {
  if (!host) return;
  const rows = [...host.querySelectorAll('.shop-item-details[data-at-home="true"]')];
  if (!rows.length) return;
  const section = document.createElement('details');
  section.className = 'shop-home-section grouped-section';
  section.innerHTML = `<summary class="grouped-row"><span>Already have</span><span>${rows.length} item${rows.length === 1 ? '' : 's'} <span aria-hidden="true">⌄</span></span></summary><div class="grouped-row" data-shop-home-rows></div>`;
  const target = section.querySelector('[data-shop-home-rows]');
  rows.forEach(row => target.appendChild(row));
  host.querySelectorAll('.shop-section').forEach(group => { if (!group.querySelector('.shop-item-details')) group.remove(); });
  host.appendChild(section);
}

function renderShoppingMealAllocationRows(item, scopeId) {
  const activeState = window.state || state;
  const groupFn = typeof groupShoppingAllocationsByMeal === 'function' ? groupShoppingAllocationsByMeal : (() => []);
  const groups = groupFn(item.allocations || []);
  if (!groups.length) return '';
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  const escapeAttrFn = typeof ppEscapeAttr === 'function' ? ppEscapeAttr : (s => s);
  const titleCaseFn = typeof toTitleCase === 'function' ? toTitleCase : (s => s);
  const dayLabelFn = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel : ((p, d) => `Day ${d}`);
  const encodeFn = typeof encodeShopTarget === 'function' ? encodeShopTarget : (t => JSON.stringify(t));
  const formatBatchFn = typeof formatShoppingBatchAmount === 'function' ? formatShoppingBatchAmount : (g => `${g}g`);

  const rows = groups.map((row, idx) => {
    const people = [...row.people].filter(Boolean).sort((a, b) => a.localeCompare(b)).join(' + ') || 'Meal';
    const targetPayload = encodeFn(row.targets);
    const title = `${dayLabelFn(activeState.plan, row.day, { short: true })} ${row.mealLabel || titleCaseFn(row.mealKey || 'Meal')} · ${people}`;
    const status = row.substituted ? `<span style="color:var(--purple);font-size:11px;margin-left:6px">changed from ${escapeHtmlFn([...row.replacedNames][0] || 'original')}</span>` : '';
    return `<label class="shop-meal-row" style="display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 0;border-top:${idx ? '1px solid var(--border)' : '0'};cursor:pointer">
      <input type="checkbox" class="shop-batch-check" data-scope="${escapeAttrFn(scopeId)}" data-targets="${targetPayload}" onchange="updateShoppingBatchToolbar('${escapeAttrFn(scopeId)}')">
      <span style="min-width:0"><strong>${escapeHtmlFn(title)}</strong><br><span class="${/https?:\/\/|[^\s]{36,}/i.test(row.recipeTitle || '') ? 'breakable-url' : ''}" style="color:var(--text2);font-size:11px">${escapeHtmlFn(row.recipeTitle || '')}${row.variant === 'enhanced' ? ' · Enhanced' : ''}${status}</span></span>
      <span style="font-size:12px;color:var(--text2);white-space:nowrap">${formatBatchFn(row.grams)}</span>
    </label>`;
  }).join('');
  return `<div class="shop-batch-block" data-scope="${escapeAttrFn(scopeId)}">
    <div class="row-between" style="gap:8px;margin-bottom:5px;align-items:center">
      <strong style="font-size:12px;color:var(--text2)">Meals using this item</strong>
      <button type="button" class="btn sm ghost" style="padding:2px 6px;font-size:10px" onclick="selectAllShoppingRows('${escapeAttrFn(scopeId)}', true)">Select all</button>
    </div>
    <div class="shop-batch-toolbar" id="${escapeAttrFn(scopeId)}-toolbar" style="display:none;gap:6px;align-items:center;flex-wrap:wrap;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 8px;margin-bottom:7px">
      <span id="${escapeAttrFn(scopeId)}-count" style="font-size:12px;color:var(--text2);font-weight:700"></span>
      <button type="button" class="btn sm ghost" onclick="openBatchSubstituteFromSelection('${escapeAttrFn(scopeId)}','replace')">Replace</button>
      <button type="button" class="btn sm ghost" onclick="openBatchSubstituteFromSelection('${escapeAttrFn(scopeId)}','merge')">Merge</button>
      <button type="button" class="btn sm danger" onclick="confirmRemoveShoppingBatch('${escapeAttrFn(scopeId)}')">Remove</button>
    </div>
    ${rows}
  </div>`;
}

function getSelectedShoppingTargets(scopeId) {
  const targets = [];
  const decodeFn = typeof decodeShopTarget === 'function' ? decodeShopTarget : (s => JSON.parse(s));
  document.querySelectorAll(`.shop-batch-check[data-scope="${String(scopeId).replace(/"/g, '\\"')}"]:checked`).forEach(input => {
    const decoded = decodeFn(input.dataset.targets);
    if (Array.isArray(decoded)) decoded.forEach(t => targets.push(t));
  });
  const seen = new Set();
  return targets.filter(t => {
    const key = `${t.planMealId}|${t.originalKey}`;
    if (!t.planMealId || !t.originalKey || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateShoppingBatchToolbar(scopeId) {
  const targets = getSelectedShoppingTargets(scopeId);
  const toolbar = document.getElementById(scopeId + '-toolbar');
  const count = document.getElementById(scopeId + '-count');
  if (toolbar) toolbar.style.display = targets.length ? 'flex' : 'none';
  if (count) count.textContent = `${targets.length} portion${targets.length === 1 ? '' : 's'} selected`;
}

function selectAllShoppingRows(scopeId, checked) {
  document.querySelectorAll(`.shop-batch-check[data-scope="${String(scopeId).replace(/"/g, '\\"')}"]`).forEach(input => { input.checked = !!checked; });
  updateShoppingBatchToolbar(scopeId);
}

function refreshShoppingAfterBatch() {
  const activeState = window.state || state;
  if (activeState.plan) activeState.plan.confirmedShopping = false;
  if (typeof saveState === 'function') saveState();
  const renderShoppingFn = window.renderShopping || window.PlatePlanShoppingList?.renderShopping;
  if (document.getElementById('view-shopping')?.classList.contains('active') && typeof renderShoppingFn === 'function') renderShoppingFn();
  if (document.getElementById('view-planner')?.classList.contains('active') && typeof renderPlan === 'function') renderPlan();
}

function applyShoppingBatchTargets(targets, mode, productId = '', quantityOverrides = []) {
  (targets || []).forEach((target, targetIndex) => {
    const ov = typeof getPlanOverride === 'function' ? getPlanOverride(target.planMealId) : null;
    if (!ov) return;
    if (mode === 'remove') {
      ov.removeIngredientKeys[target.originalKey] = true;
      delete ov.productOverrides[target.originalKey];
      if (target.groupId) delete ov.productOverrides[target.groupId];
      delete ov.substitutions[target.originalKey];
      delete ov.ingredientReplacements[target.originalKey];
      delete ov.mergeInto[target.originalKey];
      delete ov.ingredientQuantityOverrides[target.originalKey];
      return;
    }
    delete ov.removeIngredientKeys[target.originalKey];
    if (mode === 'merge') {
      ov.ingredientReplacements[target.originalKey] = productId;
      ov.mergeInto[target.originalKey] = productId;
      if (quantityOverrides[targetIndex]) ov.ingredientQuantityOverrides[target.originalKey] = quantityOverrides[targetIndex];
      else delete ov.ingredientQuantityOverrides[target.originalKey];
      return;
    }
    if (mode === 'replace') {
      ov.ingredientReplacements[target.originalKey] = productId;
      delete ov.mergeInto[target.originalKey];
      if (quantityOverrides[targetIndex]) ov.ingredientQuantityOverrides[target.originalKey] = quantityOverrides[targetIndex];
      else delete ov.ingredientQuantityOverrides[target.originalKey];
    }
  });
  refreshShoppingAfterBatch();
}

function openBatchSubstituteFromSelection(scopeId, mode) {
  const targets = getSelectedShoppingTargets(scopeId);
  if (!targets.length) return typeof openAppInfoModal === 'function' ? openAppInfoModal('Select meals', 'Select at least one meal row first.') : alert('Select at least one meal row first.');
  const openSubstFn = window.openSubstituteModalForTargets || window.PlatePlanShoppingList?.openSubstituteModalForTargets;
  if (typeof openSubstFn === 'function') openSubstFn(targets, mode);
}

function confirmRemoveShoppingBatch(scopeId) {
  const targets = getSelectedShoppingTargets(scopeId);
  if (!targets.length) return typeof openAppInfoModal === 'function' ? openAppInfoModal('Select meals', 'Select at least one meal row first.') : alert('Select at least one meal row first.');
  if (typeof openAppConfirmModal === 'function') {
    openAppConfirmModal('Remove selected ingredients?', `Remove this ingredient from ${targets.length} planned portion${targets.length === 1 ? '' : 's'}?`, 'Remove', () => applyShoppingBatchTargets(targets, 'remove'));
  }
}

function collectCurrentShoppingProducts() {
  const activeState = window.state || state;
  const ids = new Set();
  if (!activeState.plan?.slots) return [];
  const days = activeState.plan.days || Object.keys(activeState.plan.slots || {}).length || 0;
  for (let d = 1; d <= days; d++) {
    const day = activeState.plan.slots[d] || {};
    (typeof SLOTS !== 'undefined' ? SLOTS : []).forEach(sl => {
      if (activeState.excluded?.[d]?.[sl.key]) return;
      const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(day[sl.key]) : { active: null };
      if (!info.active) return;
      const context = typeof getPlanContextForInstance === 'function' ? getPlanContextForInstance(info.instanceId) : {};
      (info.active.ingredients || []).forEach(ing => {
        if (typeof isIngredientRemovedInContext === 'function' && isIngredientRemovedInContext(ing, context)) return;
        const adjusted = typeof getAdjustedIngredientForContext === 'function' ? getAdjustedIngredientForContext(ing, context) : ing;
        const resolved = typeof resolveProductForIngredientWithContext === 'function' ? resolveProductForIngredientWithContext(adjusted, context) : { productId: null };
        if (resolved.productId) ids.add(resolved.productId);
      });
    });
  }
  const getProdFn = typeof getProduct === 'function' ? getProduct : (() => null);
  return [...ids].map(id => getProdFn(id)).filter(Boolean);
}

// Attach to window global namespace
if (typeof window !== 'undefined') {
  window.PlatePlanShoppingList = Object.assign(window.PlatePlanShoppingList || {}, {
    updateShopGroupPref,
    setPackPick,
    setShoppingAtHome,
    organiseShoppingAtHomeRows,
    renderShoppingMealAllocationRows,
    getSelectedShoppingTargets,
    updateShoppingBatchToolbar,
    selectAllShoppingRows,
    refreshShoppingAfterBatch,
    applyShoppingBatchTargets,
    openBatchSubstituteFromSelection,
    confirmRemoveShoppingBatch,
    collectCurrentShoppingProducts
  });

  window.PlatePlanShopping = Object.assign(window.PlatePlanShopping || {}, window.PlatePlanShoppingList);

  window.updateShopGroupPref = updateShopGroupPref;
  window.setPackPick = setPackPick;
  window.setShoppingAtHome = setShoppingAtHome;
  window.organiseShoppingAtHomeRows = organiseShoppingAtHomeRows;
  window.renderShoppingMealAllocationRows = renderShoppingMealAllocationRows;
  window.getSelectedShoppingTargets = getSelectedShoppingTargets;
  window.updateShoppingBatchToolbar = updateShoppingBatchToolbar;
  window.selectAllShoppingRows = selectAllShoppingRows;
  window.refreshShoppingAfterBatch = refreshShoppingAfterBatch;
  window.applyShoppingBatchTargets = applyShoppingBatchTargets;
  window.openBatchSubstituteFromSelection = openBatchSubstituteFromSelection;
  window.confirmRemoveShoppingBatch = confirmRemoveShoppingBatch;
  window.collectCurrentShoppingProducts = collectCurrentShoppingProducts;
}
