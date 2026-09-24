/**
 * scripts/features/shopping-list-ui.js
 * PlatePlan Shopping List Main View Renderer & Summary Module
 * Classic global namespace script.
 */

window.PlatePlanShoppingList = window.PlatePlanShoppingList || {};
window.PlatePlanShopping = window.PlatePlanShopping || window.PlatePlanShoppingList;

window.PlatePlanShoppingList.State = window.PlatePlanShoppingList.State || {
  currentSubstContext: null,
  substSearchTimeout: null
};

function getShoppingState() {
  return window.PlatePlanShoppingList.State;
}

if (typeof window !== 'undefined') {
  try {
    Object.defineProperty(window, 'currentSubstContext', {
      get: () => window.PlatePlanShoppingList.State.currentSubstContext,
      set: (v) => { window.PlatePlanShoppingList.State.currentSubstContext = v; },
      configurable: true,
      enumerable: true
    });
    Object.defineProperty(window, 'substSearchTimeout', {
      get: () => window.PlatePlanShoppingList.State.substSearchTimeout,
      set: (v) => { window.PlatePlanShoppingList.State.substSearchTimeout = v; },
      configurable: true,
      enumerable: true
    });
  } catch (e) {}
}

function resetShoppingState() {
  const state = window.PlatePlanShoppingList.State;
  state.currentSubstContext = null;
  if (state.substSearchTimeout) {
    clearTimeout(state.substSearchTimeout);
    state.substSearchTimeout = null;
  }
}

function confirmShoppingList() {
  const activeState = window.state || state;
  if (!activeState.plan?.slots) return;
  if (activeState.isDraftPlan || activeState.draftPlan) {
    if (typeof confirmAndSaveDraftPlan === 'function') confirmAndSaveDraftPlan();
    return;
  }
  activeState.plan.confirmedShopping = true;
  activeState.plan.confirmedAt = new Date().toISOString();
  const planScoreFn = typeof calculatePlanScore === 'function' ? calculatePlanScore : (() => ({ score: 0 }));
  activeState.plan.score = planScoreFn(activeState.plan);
  if (typeof snapshotCurrentPlan === 'function') snapshotCurrentPlan('Shopping confirmed');
  if (typeof saveState === 'function') saveState(true);
  renderShopping();
  if (typeof renderPlanOverallSummary === 'function') renderPlanOverallSummary();
  if (typeof renderPlanHistoryPanel === 'function') renderPlanHistoryPanel();
  if (typeof showPlatePlanToast === 'function') showPlatePlanToast('Shopping list confirmed! ✓');
}

function renderShopping() {
  if (typeof ensurePlannerShell === 'function') ensurePlannerShell();
  const el = document.getElementById('shop-content');
  if (!el) return;
  const activeState = window.state || state;
  if (!activeState.plan?.slots) {
    el.innerHTML = '<div class="empty">Generate a meal plan first.</div>';
    const prep = document.getElementById('shop-meal-prep-panel'); if (prep) prep.innerHTML = '';
    return;
  }
  const { days, slots } = activeState.plan;
  const agg = {};
  let estimatedTotal = 0;
  let consumedTotal = 0;
  const groupMode = activeState.prefs?.shopGroupBy || 'family';

  function getGroupingKey(n, bankId, groupId = '') {
    if (bankId) {
      const bi = activeState.ingredients.find(i => i.id === bankId);
      if (bi) {
        if (groupMode === 'family') return typeof getProductFamily === 'function' ? getProductFamily(bi) : 'Other';
        if (groupMode === 'category') {
          const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(groupId || bi.groupId) : null;
          return (typeof CAT !== 'undefined' ? CAT[group?.cat || bi.cat] : null) || group?.cat || bi.cat || 'Other';
        }
        return bi.storage || 'cupboard';
      }
    }
    n = (n || '').toLowerCase();
    if (groupMode === 'family') {
      return (typeof normaliseAliasText === 'function' && typeof inferIngredientFamilyFromText === 'function') ? normaliseAliasText(inferIngredientFamilyFromText(n)) : 'No ingredient';
    } else if (groupMode === 'category') {
      return 'Other';
    } else {
      if (/frozen|ice/.test(n)) return 'freezer';
      if (/milk|yoghurt|cheese|cream|butter|egg|fresh|spinach|lettuce|cucumber|tomato|pepper/.test(n)) return 'fridge';
      return 'cupboard';
    }
  }

  function formatShoppingNeed(item) {
    if (item.mixedUnits) return `${Math.round(item.grams)}g`;
    if (item.needUnit === 'ml') return `${Math.round(item.needQty)}ml`;
    if (item.needUnit === 'item') return `${Math.round(item.needQty * 10) / 10} item${item.needQty === 1 ? '' : 's'}`;
    return `${Math.round(item.needQty)}g`;
  }

  const getKeyFn = typeof getShoppingLineStateKey === 'function' ? getShoppingLineStateKey : ((g, b, r) => g || b || r);

  for (let d = 1; d <= days; d++) {
    const s = slots[d] || {};
    (typeof SLOTS !== 'undefined' ? SLOTS : []).forEach(sl => {
      if ((activeState.excluded || {})[d]?.[sl.key]) return;
      const slotData = s[sl.key];
      if (!slotData) return;
      const slotInfo = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(slotData) : { active: null, instanceId: null };
      const rId = slotInfo.id;
      const instanceId = slotInfo.instanceId;
      const r = slotInfo.active;
      if (!r || !r.ingredients) return;
      const context = typeof getPlanContextForInstance === 'function' ? getPlanContextForInstance(instanceId) : {};
      const slotScale = typeof getSlotShoppingScale === 'function' ? getSlotShoppingScale(r, sl.key, instanceId) : 1;

      r.ingredients.forEach(ing => {
        if (typeof isIngredientRemovedInContext === 'function' && isIngredientRemovedInContext(ing, context)) return;
        const adjustedIng = typeof getAdjustedIngredientForContext === 'function' ? getAdjustedIngredientForContext(ing, context) : ing;
        const resolved = typeof resolveProductForIngredientWithContext === 'function' ? resolveProductForIngredientWithContext(adjustedIng, context) : { product: null, groupId: '' };
        const bankIng = resolved.product || (adjustedIng.bankId ? activeState.ingredients.find(i => i.id === adjustedIng.bankId) : null);
        const actualBankId = bankIng?.id || '';
        const groupId = resolved.groupId || bankIng?.groupId || '';
        const actualName = resolved.group?.name || adjustedIng.name || adjustedIng.raw;
        const defaultProduct = typeof resolveProductForIngredient === 'function' ? resolveProductForIngredient(ing, {}).product : null;
        const isSub = !!(instanceId && defaultProduct && bankIng && defaultProduct.id !== bankIng.id);
        const repName = ing.name || ing.raw || actualName;
        const raw = typeof ingRaw === 'function' ? ingRaw(adjustedIng) : (adjustedIng.raw || '');
        const amt = typeof getShoppingAmount === 'function' ? getShoppingAmount(adjustedIng, bankIng, slotScale) : { grams: adjustedIng.grams || 100, unit: 'g', qty: 1, label: '100g' };
        const grams = amt.grams;
        const k = getKeyFn(groupId, actualBankId, raw);

        if (k) {
          if (!agg[k]) agg[k] = { key: k, name: actualName || raw, productName: bankIng?.name || '', brand: bankIng?.brand || '', bankId: actualBankId, groupId, group: getGroupingKey(bankIng?.name || actualName || raw, actualBankId, groupId), grams: 0, needQty: 0, needUnit: amt.unit, mixedUnits: false, allocations: [] };
          agg[k].grams += grams;
          if (agg[k].needUnit === amt.unit && !agg[k].mixedUnits) {
            agg[k].needQty += amt.qty;
          } else {
            agg[k].mixedUnits = true;
          }
          const dayLabelFn = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel : ((p, d) => `Day ${d}`);
          const mealTypeFn = typeof getMealTypeFromSlotKey === 'function' ? getMealTypeFromSlotKey(sl.key) : 'dinner';
          agg[k].allocations.push({
            planMealId: instanceId,
            recipeId: rId,
            recipeName: `${dayLabelFn(activeState.plan, d, { short: true })} ${sl.short} - ${r.name}${slotInfo.variant === 'enhanced' ? ' (Enhanced)' : ''}`,
            recipeTitle: r.name,
            day: d,
            slotKey: sl.key,
            mealKey: mealTypeFn,
            mealLabel: sl.short,
            person: String(sl.key).endsWith('C') ? 'Chloe' : 'Elliott',
            variant: slotInfo.variant || 'original',
            qtyGrams: grams,
            amountLabel: amt.label,
            isSubstituted: isSub,
            replacedIngredientName: repName,
            originalKey: typeof getRecipeIngredientKey === 'function' ? getRecipeIngredientKey(ing) : '',
            groupId,
            bankId: actualBankId
          });
        }
      });
    });
  }

  const requiredAgg = {};
  Object.entries(agg).forEach(([key, item]) => { requiredAgg[key] = { ...item, allocations: [...(item.allocations || [])] }; });
  const useUpEntriesFn = typeof getUseUpEntries === 'function' ? getUseUpEntries() : [];
  const useUpByProduct = new Map(useUpEntriesFn.map(entry => [entry.productId, entry]));
  Object.values(agg).forEach(item => {
    item.requiredGrams = item.grams;
    item.toBuyGrams = item.grams;
    item.useUpAvailable = null;
    item.useUpUsed = 0;
    item.useUpRemainder = null;
    const entry = useUpByProduct.get(item.bankId);
    const available = typeof getUseUpAvailableAmount === 'function' ? getUseUpAvailableAmount(entry) : null;
    if (available == null) return;
    item.useUpAvailable = available;
    item.useUpUsed = Math.min(item.requiredGrams, available);
    item.useUpRemainder = Math.max(0, available - item.requiredGrams);
    item.toBuyGrams = Math.max(0, item.requiredGrams - available);
    item.grams = item.toBuyGrams;
    if (!item.mixedUnits && item.needQty > 0 && item.requiredGrams > 0) item.needQty *= item.toBuyGrams / item.requiredGrams;
  });

  const groupedData = {};
  if (groupMode === 'family') {
    const knownFam = typeof getKnownFamilies === 'function' ? getKnownFamilies() : [];
    knownFam.concat(['No ingredient']).forEach(f => groupedData[f] = []);
  } else if (groupMode === 'category') {
    const catObj = typeof CAT !== 'undefined' ? Object.values(CAT) : [];
    catObj.concat(['Other']).forEach(c => groupedData[c] = []);
  } else {
    ['fridge', 'freezer', 'cupboard', 'none'].forEach(s => groupedData[s] = []);
  }

  Object.values(agg).forEach(item => {
    let g = item.group;
    if (!groupedData[g]) groupedData[g] = [];
    groupedData[g].push(item);
  });
  if (!activeState.plan.shoppingAtHome || typeof activeState.plan.shoppingAtHome !== 'object') activeState.plan.shoppingAtHome = {};
  const validShoppingKeys = new Set(Object.keys(agg));
  const staleShoppingKeys = Object.keys(activeState.plan.shoppingAtHome).filter(key => !validShoppingKeys.has(key));
  if (staleShoppingKeys.length) { staleShoppingKeys.forEach(key => delete activeState.plan.shoppingAtHome[key]); if (typeof saveState === 'function') saveState(); }
  const buyableAgg = Object.fromEntries(Object.entries(agg).filter(([key]) => !activeState.plan.shoppingAtHome[key]));
  const calcPriceFn = typeof calculateShoppingPriceFromAggregates === 'function' ? calculateShoppingPriceFromAggregates : (() => ({ estimatedTotal: 0, consumedTotal: 0, lines: [], lineByBankId: {} }));
  const allPriceSummary = calcPriceFn(requiredAgg);
  const priceSummary = calcPriceFn(buyableAgg);
  estimatedTotal = priceSummary.estimatedTotal;
  consumedTotal = allPriceSummary.consumedTotal;

  let html = '';
  if (activeState.isDraftPlan || activeState.draftPlan) {
    html += `<div class="card draft-plan-step-banner" style="background:var(--surface2);border:1.5px solid var(--action);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div>
          <div style="font-weight:750;font-size:15px;color:var(--text);display:flex;align-items:center;gap:6px">
            <span class="tag" style="background:var(--action);color:#fff;font-weight:700">Step 2 of 2</span>
            Review Shopping List & Substitutes
          </div>
          <div style="font-size:13px;color:var(--text2);margin-top:4px;line-height:1.4">
            Make any substitutions, pack selections, or check off items at home. Confirming here will save your new meal plan and shopping list to the cloud.
          </div>
        </div>
        <div class="btn-row" style="margin:0;gap:8px;flex-wrap:wrap">
          <button class="btn ghost sm" onclick="showView('planner')">← Back to Planner</button>
          <button class="btn ghost sm" onclick="discardDraftPlan()">Discard</button>
          <button class="btn primary sm" onclick="confirmAndSaveDraftPlan()" style="font-weight:700">✓ Confirm & Save Meal Plan</button>
        </div>
      </div>
    </div>`;
  }
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  const escapeAttrFn = typeof ppEscapeAttr === 'function' ? ppEscapeAttr : (s => s);
  const getPackVariantsFn = typeof getPackVariants === 'function' ? getPackVariants : (() => []);
  const getOptimalPurchaseFn = typeof getOptimalPurchase === 'function' ? getOptimalPurchase : (() => null);
  const formatBatchFn = typeof formatShoppingBatchAmount === 'function' ? formatShoppingBatchAmount : (g => `${g}g`);
  const renderAllocFn = window.renderShoppingMealAllocationRows || window.PlatePlanShoppingList?.renderShoppingMealAllocationRows;

  Object.entries(groupedData).forEach(([gKey, items]) => {
    if (!items.length) return;
    let title = (groupMode === 'family' || groupMode === 'category') ? gKey : (gKey ? gKey.charAt(0).toUpperCase() + gKey.slice(1) : 'Other');

    html += '<div class="shop-section"><h3>' + title + '</h3><div class="card" style="padding:0 14px">' + items.sort((a, b) => a.name.localeCompare(b.name)).map(it => {
      const isAtHome = !!activeState.plan.shoppingAtHome?.[it.key];
      let ingredientName = it.name || 'Ingredient';
      const isFreshGarlicFn = typeof isFreshGarlicIngredient === 'function' ? isFreshGarlicIngredient : (() => false);
      if (isFreshGarlicFn({ name: it.name }, { name: it.productName }) && it.grams) {
        const totalCloves = Math.round(it.grams / 6);
        const heads = Math.floor(totalCloves / 11);
        const remainder = totalCloves % 11;
        let garlicText = [];
        if (heads > 0) garlicText.push(heads + (heads === 1 ? ' head' : ' heads'));
        if (remainder > 0) garlicText.push(remainder + (remainder === 1 ? ' clove' : ' cloves'));
        if (garlicText.length) ingredientName = `${it.name} (${garlicText.join(' and ')})`;
      }

      let productFullName = '';
      if (it.productName) {
        const brand = (it.brand && it.brand !== 'Generic' && !it.productName.toLowerCase().startsWith(it.brand.toLowerCase())) ? `${it.brand} ` : '';
        productFullName = `${brand}${it.productName}`.trim();
      }

      let displayName = ingredientName;
      if (productFullName && productFullName.toLowerCase() !== ingredientName.toLowerCase()) {
        displayName = `${ingredientName} - ${productFullName}`;
      }
      const needLabel = formatShoppingNeed(it);
      const stockLabel = it.useUpAvailable == null ? '' : `<span class="shop-use-up"><strong>Use-up stock:</strong> required ${formatBatchFn(it.requiredGrams)} · available ${formatBatchFn(it.useUpAvailable)} · planned use ${formatBatchFn(it.useUpUsed)} · remaining ${formatBatchFn(it.useUpRemainder)} · to buy ${formatBatchFn(it.toBuyGrams)}</span>`;

      const itemScope = 'shop-scope-' + Math.random().toString(36).slice(2, 9);
      const allocationHtml = typeof renderAllocFn === 'function' ? renderAllocFn(it, itemScope) : '';

      let optimiserHtml = '';
      if (!isAtHome && it.bankId && it.grams > 0) {
        const bi = activeState.ingredients.find(x => x.id === it.bankId);
        if (bi) {
          const variants = getPackVariantsFn(bi);
          if (variants.length > 0) {
            const currentPick = activeState.packPicks?.[bi.id] || 'auto';
            const pickerOpts = [`<option value="auto"${currentPick === 'auto' ? ' selected' : ''}>Auto (cheapest combo)</option>`]
              .concat(variants.map(v => {
                const packDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(v.size, v.unit, v.itemWeight) : `${v.size}${v.unit || 'g'}`;
                const label = packDisplay || `${v.size}${v.unit || 'g'}`;
                return `<option value="${v.key}"${currentPick === v.key ? ' selected' : ''}>${label} @ £${(+v.price).toFixed(2)}</option>`;
              })).join('');
            const opt = priceSummary.lineByBankId?.[bi.id]?.purchase || getOptimalPurchaseFn(it.grams, bi);
            const recLine = opt ? `<div><strong>${opt.manual ? 'Chosen packs' : 'Pack suggestion'}:</strong> ${opt.desc} (£${opt.cost.toFixed(2)})</div>` : '';
            optimiserHtml = `<div style="margin-top:8px; background:var(--surface2); border:1px solid var(--border); color:var(--text2); padding:6px 10px; border-radius:6px; font-size:11px;">
                ${recLine}
                <div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <label style="font-size:11px;color:var(--text2);">Pack variant:</label>
                  <select onchange="setPackPick('${bi.id}', this.value)" style="font-size:11px;padding:2px 4px;">${pickerOpts}</select>
                </div>
            </div>`;
          }
        }
      }

      return `
      <details class="shop-item-details" data-shopping-key="${escapeAttrFn(it.key)}" data-at-home="${isAtHome ? 'true' : 'false'}" style="padding:6px 0; border-bottom:1px solid var(--border);">
          <summary class="shop-item-summary" style="font-size:13px; cursor:pointer; outline:none; font-weight:500;">
              <input class="shop-home-check" type="checkbox" ${isAtHome ? 'checked' : ''} aria-label="${escapeAttrFn(isAtHome ? 'Remove ' + displayName + ' from Already have' : 'Mark ' + displayName + ' as already at home')}" onclick="event.stopPropagation()" onchange="event.stopPropagation();setShoppingAtHome('${escapeAttrFn(it.key)}',this.checked)">
              <span class="shop-item-copy" data-copy="${escapeAttrFn(`${displayName} — ${it.useUpAvailable != null ? 'To buy' : 'Need'} ${needLabel}`)}">${escapeHtmlFn(displayName)}<span class="shop-need">${it.useUpAvailable != null ? 'To buy' : 'Need'} ${needLabel}</span>${stockLabel}</span>
              <span style="font-size:12px;color:var(--text3);" aria-hidden="true">⌄</span>
          </summary>
          <div style="padding-left:15px; margin-top:5px; font-size:12px; color:var(--text2);">
              ${allocationHtml}
              ${optimiserHtml}
          </div>
      </details>`;
    }).join('') + '</div></div>';
  });
  el.innerHTML = html || '<div class="empty">No ingredients to list.</div>';
  const orgFn = window.organiseShoppingAtHomeRows || window.PlatePlanShoppingList?.organiseShoppingAtHomeRows;
  if (typeof orgFn === 'function') orgFn(el);
  const summary = document.getElementById('shop-summary');
  if (typeof renderMealPrepSuggestions === 'function') renderMealPrepSuggestions();
  if (summary) {
    const planScoreFn = typeof calculatePlanScore === 'function' ? calculatePlanScore : (() => ({ score: 0 }));
    const score = planScoreFn(activeState.plan);
    const contributorHtml = priceSummary.lines.slice(0, 8).map(line => `<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);padding:5px 0;font-size:11px"><span>${escapeHtmlFn(line.product?.name || line.name)}${line.flags.length ? ` <em style="color:var(--amber)">(${escapeHtmlFn(line.flags.join(', '))})</em>` : ''}<br><span style="color:var(--text3)">${Math.round(line.grams)}g needed · ${escapeHtmlFn(line.purchase?.desc || 'no pack suggestion')}</span></span><strong>£${(+line.purchase?.cost || 0).toFixed(2)}</strong></div>`).join('');
    summary.innerHTML = `<div class="card" style="border-color:var(--green);margin-bottom:12px">
      <div class="row-between" style="gap:10px;align-items:flex-start">
        <div style="flex:1">
          <h3 style="margin-bottom:6px;color:var(--green)">Shopping summary</h3>
          <div class="plan-summary">
            <div class="summary-box"><strong>Estimated checkout price</strong><div style="font-size:20px;font-weight:700">£${estimatedTotal.toFixed(2)}</div><div style="color:var(--text2)">Whole packs to buy</div></div>
            <div class="summary-box"><strong>Estimated consumed cost</strong><div style="font-size:20px;font-weight:700">£${consumedTotal.toFixed(2)}</div><div style="color:var(--text2)">Food used in recipes</div></div>
            <div class="summary-box"><strong>Updated plan score</strong><div style="font-size:20px;font-weight:700;color:${score.score <= 10 ? 'var(--green)' : score.score <= 20 ? 'var(--amber)' : 'var(--red)'}">${score.score}</div><div style="color:var(--text2)">Includes shopping changes</div></div>
            <div class="summary-box"><strong>Status</strong><div>${activeState.plan.confirmedShopping ? 'Shopping list confirmed' : 'Still editable'}</div></div>
          </div>
          ${contributorHtml ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text2)">Top checkout price contributors</summary><div style="margin-top:6px">${contributorHtml}</div></details>` : ''}
        </div>
        <div class="btn-row" style="justify-content:flex-end">
          <button class="btn sm primary" onclick="confirmShoppingList()">Confirm shopping list</button>
          <button class="btn sm" onclick="generateRecipePack()">Download updated recipe pack</button>
        </div>
      </div>
    </div>`;
  }
}

// Attach to window global namespace
if (typeof window !== 'undefined') {
  window.PlatePlanShoppingList = Object.assign(window.PlatePlanShoppingList || {}, {
    resetState: resetShoppingState,
    getShoppingState,
    confirmShoppingList,
    renderShopping
  });

  window.PlatePlanShopping = Object.assign(window.PlatePlanShopping || {}, window.PlatePlanShoppingList);

  window.resetShoppingState = resetShoppingState;
  window.getShoppingState = getShoppingState;
  window.confirmShoppingList = confirmShoppingList;
  window.renderShopping = renderShopping;
}
