/**
 * scripts/features/shopping-list-subst.js
 * PlatePlan Shopping List Product Substitutions & Modal Pipeline Sub-Module
 * Classic global namespace script.
 */

window.PlatePlanShoppingList = window.PlatePlanShoppingList || {};
window.PlatePlanShopping = window.PlatePlanShopping || window.PlatePlanShoppingList;

function getShoppingState() {
  return window.PlatePlanShoppingList.State;
}

function getSubstitutionSuggestionProducts(targets, mode, query = '') {
  const activeState = window.state || state;
  const q = String(query || '').trim().toLowerCase();
  let rows = [];
  const collectProdsFn = window.collectCurrentShoppingProducts || window.PlatePlanShoppingList?.collectCurrentShoppingProducts;

  if (mode === 'merge') {
    const selectedProductIds = new Set((targets || []).map(t => t.bankId).filter(Boolean));
    const currentProds = typeof collectProdsFn === 'function' ? collectProdsFn() : [];
    rows = currentProds
      .filter(p => !selectedProductIds.has(p.id))
      .map(p => ({ ...p, substSection: 'Already in shopping list' }));
  } else {
    const groupIds = [...new Set((targets || []).map(t => t.groupId).filter(Boolean))];
    const firstGroup = typeof getIngredientGroup === 'function' ? getIngredientGroup(groupIds[0]) : null;
    const seen = new Set();
    const add = (products, label) => (products || []).forEach(p => {
      if (!p || seen.has(p.id)) return;
      seen.add(p.id);
      rows.push({ ...p, substSection: label });
    });
    if (groupIds.length === 1 && firstGroup) {
      if (typeof getGroupProducts === 'function') add(getGroupProducts(firstGroup.id), 'Same sub-type');
      const family = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(firstGroup) : null;
      if (family && typeof getFamilyGroups === 'function' && typeof getGroupProducts === 'function') {
        add(getFamilyGroups(family.id).filter(g => g.id !== firstGroup.id).flatMap(g => getGroupProducts(g.id)), 'Same ingredient');
      }
      add((activeState.ingredients || []).filter(p => {
        const g = typeof getIngredientGroup === 'function' ? getIngredientGroup(p.groupId) : null;
        return g && g.cat === firstGroup.cat && g.ingredientId !== firstGroup.ingredientId;
      }), 'Same category');
    }
    add(activeState.ingredients || [], 'All products');
  }
  if (q) rows = rows.filter(i => {
    const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(i.groupId) : null;
    const hay = [i.name, i.brand, typeof getProductFamily === 'function' ? getProductFamily(i) : '', typeof getGroupTypeName === 'function' ? getGroupTypeName(group) : '', typeof getGroupHierarchyText === 'function' ? getGroupHierarchyText(group || { cat: i.cat, family: typeof getProductFamily === 'function' ? getProductFamily(i) : '', name: i.name }) : ''].join(' ').toLowerCase();
    return hay.includes(q);
  });
  return rows.sort((a, b) => {
    const order = { 'Same sub-type': 0, 'Same ingredient': 1, 'Same category': 2, 'Already in shopping list': 0, 'All products': 3 };
    const oa = order[a.substSection] ?? 9;
    const ob = order[b.substSection] ?? 9;
    if (oa !== ob) return oa - ob;
    const priorityFn = typeof scoreProductByPriority === 'function' ? scoreProductByPriority : (() => 0);
    return priorityFn(b, activeState.prefs?.productPriority || 'protein_per_kcal') - priorityFn(a, activeState.prefs?.productPriority || 'protein_per_kcal') || (a.name || '').localeCompare(b.name || '');
  });
}

function renderSubstitutionDropdown(list) {
  const drop = document.getElementById('subst-dropdown');
  if (!drop) return;
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  const escapeAttrFn = typeof ppEscapeAttr === 'function' ? ppEscapeAttr : (s => s);
  if (!list.length) {
    drop.innerHTML = `<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No matches found.</div>`;
  } else {
    drop.innerHTML = list.slice(0, 32).map(i => {
      const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(i.groupId) : null;
      const pkcal = typeof getProductProteinPer100Kcal === 'function' && typeof round1 === 'function' ? round1(getProductProteinPer100Kcal(i)) : 0;
      const ppound = typeof getProductProteinPerPound === 'function' && typeof round1 === 'function' ? round1(getProductProteinPerPound(i)) : 0;
      const pack = typeof formatPackDisplay === 'function' ? formatPackDisplay(i.packSize, i.packUnit || 'g', i.itemWeight) : '';
      const groupText = typeof getGroupHierarchyText === 'function' ? getGroupHierarchyText(group || { cat: i.cat, family: typeof getProductFamily === 'function' ? getProductFamily(i) : '', name: i.name }) : '';
      return `<div class="map-drop-item" onclick="selectSubstItem('${escapeAttrFn(i.id)}')">
        <div style="font-weight:600;font-size:13px">${escapeHtmlFn(i.name)} ${i.brand && i.brand !== 'Generic' ? `(${escapeHtmlFn(i.brand)})` : ''}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${typeof round1 === 'function' ? round1(i.prot || 0) : i.prot || 0}g P | ${Math.round(i.cal || 0)} kcal | ${pkcal}g P/100kcal | ${ppound}g P/£${i.price ? ` | £${(+i.price).toFixed(2)}` : ''}${pack ? ` | ${escapeHtmlFn(pack)}` : ''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${escapeHtmlFn(i.substSection || 'Product')} · ${escapeHtmlFn(groupText)}</div>
      </div>`;
    }).join('');
  }
  drop.style.display = 'block';
}

function renderHerbConversionPreview() {
  const host = document.getElementById('subst-herb-conversion'); if (!host) return;
  const state = getShoppingState();
  const ctx = state?.currentSubstContext || {};
  const replacement = typeof getProduct === 'function' ? getProduct(ctx.newBankId) : null;
  const buildHerbFn = typeof buildHerbConversion === 'function' ? buildHerbConversion : window.PlatePlanShoppingList?.buildHerbConversion;
  const conversions = (ctx.targets || []).map(target => typeof buildHerbFn === 'function' ? buildHerbFn(target, replacement) : null);
  ctx.herbConversions = conversions;
  if (!conversions.some(Boolean)) { host.style.display = 'none'; host.innerHTML = ''; return; }
  host.style.display = 'block';
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  host.innerHTML = `<div class="card-inner" style="margin:0"><strong style="font-size:12px">Fresh/dried herb conversion</strong><div style="font-size:11px;color:var(--text2);margin:3px 0 8px">PlatePlan uses 3 parts fresh to 1 part dried. Review each plan-specific amount before applying.</div>${conversions.map((conversion, index) => conversion ? `<div style="display:grid;grid-template-columns:minmax(0,1fr) 85px 76px;gap:7px;align-items:end;margin-top:7px"><div style="font-size:12px"><strong>${escapeHtmlFn(conversion.herbKey)}</strong><br>${conversion.originalQty} ${escapeHtmlFn(conversion.originalUnit)} ${conversion.sourceForm} → ${conversion.targetForm}${conversion.manual ? '<br><span style="color:var(--amber)">Unknown/count unit: confirm manually</span>' : ''}</div><div><label>Amount</label><input type="number" min="0" step="0.1" data-herb-qty="${index}" value="${conversion.qty}"></div><div><label>Unit</label><select data-herb-unit="${index}"><option value="g"${conversion.unit === 'g' ? ' selected' : ''}>g</option><option value="ml"${conversion.unit === 'ml' ? ' selected' : ''}>ml</option><option value="tsp"${conversion.unit === 'tsp' ? ' selected' : ''}>tsp</option><option value="tbsp"${conversion.unit === 'tbsp' ? ' selected' : ''}>tbsp</option><option value="qty"${conversion.unit === 'qty' ? ' selected' : ''}>items</option></select></div></div>` : '').join('')}</div>`;
}

function openSubstituteModalForTargets(targets, mode = 'replace') {
  const activeState = window.state || state;
  const state = getShoppingState();
  state.currentSubstContext = { planMealId: targets[0]?.planMealId || null, originalKey: targets[0]?.originalKey || null, groupId: targets[0]?.groupId || null, newBankId: null, mode: mode === 'merge' ? 'merge' : 'replace', targets: targets || [], herbConversions: [] };
  const ctx = state.currentSubstContext;
  const search = document.getElementById('subst-search');
  const selected = document.getElementById('subst-selected');
  const dropdown = document.getElementById('subst-dropdown');
  if (search) search.value = '';
  if (selected) selected.textContent = '';
  if (dropdown) dropdown.style.display = 'none';
  const herb = document.getElementById('subst-herb-conversion'); if (herb) { herb.style.display = 'none'; herb.innerHTML = ''; }
  const title = document.querySelector('#subst-modal-wrap h3');
  const copy = document.querySelector('#subst-modal-wrap p');
  const summary = document.getElementById('subst-target-summary');
  if (title) title.textContent = ctx.mode === 'merge' ? 'Merge selected ingredients' : 'Replace selected ingredients';
  if (copy) copy.textContent = ctx.mode === 'merge'
    ? 'Choose an existing product already on this shopping list to merge these ingredient needs into.'
    : 'Choose a replacement product. Suggestions start close to the original ingredient, then broaden out.';
  const dayLabelFn = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel : ((p, d) => `Day ${d}`);
  const titleCaseFn = typeof titleCase === 'function' ? titleCase : (s => s);
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  if (summary) summary.innerHTML = `Applying to <strong>${targets.length}</strong> planned portion${targets.length === 1 ? '' : 's'}${targets.length ? ` · ${escapeHtmlFn([...new Set(targets.map(t => `${dayLabelFn(activeState.plan, t.day, { short: true })} ${titleCaseFn(t.mealKey || 'meal')}`))].slice(0, 4).join(', '))}` : ''}`;
  document.getElementById('subst-modal-wrap')?.classList.add('open');
  renderSubstitutionDropdown(getSubstitutionSuggestionProducts(targets, ctx.mode, ''));
  setTimeout(() => search?.focus(), 0);
}

function openSubstituteModal(planMealId, originalKey, mode = 'replace') {
  const getProdFn = typeof getProduct === 'function' ? getProduct : (() => null);
  const getGroupFn = typeof getIngredientGroup === 'function' ? getIngredientGroup : (() => null);
  const asProduct = getProdFn(originalKey);
  const groupId = getGroupFn(originalKey) ? originalKey : (asProduct?.groupId || '');
  openSubstituteModalForTargets([{ planMealId, originalKey, groupId, bankId: asProduct?.id || '', day: '', mealKey: '', person: '' }], mode === 'merge' ? 'merge' : 'replace');
}

function closeSubstituteModal() {
  const wrap = document.getElementById('subst-modal-wrap');
  if (wrap) wrap.classList.remove('open');
}

function handleSubstSearch(e) {
  const state = getShoppingState();
  if (state.substSearchTimeout) clearTimeout(state.substSearchTimeout);
  const query = (e.target.value || '').toLowerCase();
  state.substSearchTimeout = setTimeout(() => {
    const ctx = state.currentSubstContext || {};
    renderSubstitutionDropdown(getSubstitutionSuggestionProducts(ctx.targets || [], ctx.mode, query));
  }, 120);
}

function selectSubstItem(bankId) {
  const state = getShoppingState();
  if (state.currentSubstContext) {
    state.currentSubstContext.newBankId = bankId;
  }
  const activeState = window.state || state;
  const b = activeState.ingredients?.find(i => i.id === bankId);
  const sSearch = document.getElementById('subst-search'); if (sSearch) sSearch.value = b?.name || '';
  const sDrop = document.getElementById('subst-dropdown'); if (sDrop) sDrop.style.display = 'none';
  const sSel = document.getElementById('subst-selected'); if (sSel) sSel.textContent = b ? `Using product: ${b.name}` : '';
  renderHerbConversionPreview();
}

function confirmSubstitute() {
  const state = getShoppingState();
  const ctx = state.currentSubstContext || {};
  const { targets, newBankId, mode } = ctx;
  if (!newBankId) return typeof openAppInfoModal === 'function' ? openAppInfoModal('Choose a product', 'Select a Product Bank item from the list before applying the replacement.') : alert('Select a Product Bank item.');
  const quantityOverrides = (ctx.herbConversions || []).map((conversion, index) => {
    if (!conversion) return null;
    const qty = +document.querySelector(`[data-herb-qty="${index}"]`)?.value;
    const unit = document.querySelector(`[data-herb-unit="${index}"]`)?.value || conversion.unit;
    if (!(qty > 0)) return null;
    return { ...conversion, qty, unit, manual: conversion.manual || qty !== conversion.qty || unit !== conversion.unit };
  });
  const applyFn = window.applyShoppingBatchTargets || window.PlatePlanShoppingList?.applyShoppingBatchTargets;
  if (typeof applyFn === 'function') {
    applyFn(targets || [], mode === 'merge' ? 'merge' : 'replace', newBankId, quantityOverrides);
  }
  closeSubstituteModal();
}

function removeSubstitute() {
  const activeState = window.state || state;
  const state = getShoppingState();
  const ctx = state.currentSubstContext || {};
  const { targets } = ctx;
  (targets || []).forEach(target => {
    const ov = activeState.overrides?.[target.planMealId];
    if (!ov) return;
    if (ov.substitutions && target.originalKey) delete ov.substitutions[target.originalKey];
    if (ov.productOverrides && target.groupId) delete ov.productOverrides[target.groupId];
    if (ov.ingredientReplacements && target.originalKey) delete ov.ingredientReplacements[target.originalKey];
    if (ov.mergeInto && target.originalKey) delete ov.mergeInto[target.originalKey];
    if (ov.ingredientQuantityOverrides && target.originalKey) delete ov.ingredientQuantityOverrides[target.originalKey];
    if (ov.removeIngredientKeys && target.originalKey) delete ov.removeIngredientKeys[target.originalKey];
  });
  const refreshFn = window.refreshShoppingAfterBatch || window.PlatePlanShoppingList?.refreshShoppingAfterBatch;
  if (typeof refreshFn === 'function') refreshFn();
  closeSubstituteModal();
}

function removeShoppingIngredient(planMealId, originalKey) {
  const applyFn = window.applyShoppingBatchTargets || window.PlatePlanShoppingList?.applyShoppingBatchTargets;
  if (typeof applyFn === 'function') {
    applyFn([{ planMealId, originalKey, groupId: '', bankId: '', day: '', mealKey: '', person: '' }], 'remove');
  }
}

// Attach to window global namespace
if (typeof window !== 'undefined') {
  window.PlatePlanShoppingList = Object.assign(window.PlatePlanShoppingList || {}, {
    getSubstitutionSuggestionProducts,
    renderSubstitutionDropdown,
    renderHerbConversionPreview,
    openSubstituteModalForTargets,
    openSubstituteModal,
    closeSubstituteModal,
    handleSubstSearch,
    selectSubstItem,
    confirmSubstitute,
    removeSubstitute,
    removeShoppingIngredient
  });

  window.PlatePlanShopping = Object.assign(window.PlatePlanShopping || {}, window.PlatePlanShoppingList);

  window.getSubstitutionSuggestionProducts = getSubstitutionSuggestionProducts;
  window.renderSubstitutionDropdown = renderSubstitutionDropdown;
  window.renderHerbConversionPreview = renderHerbConversionPreview;
  window.openSubstituteModalForTargets = openSubstituteModalForTargets;
  window.openSubstituteModal = openSubstituteModal;
  window.closeSubstituteModal = closeSubstituteModal;
  window.handleSubstSearch = handleSubstSearch;
  window.selectSubstItem = selectSubstItem;
  window.confirmSubstitute = confirmSubstitute;
  window.removeSubstitute = removeSubstitute;
  window.removeShoppingIngredient = removeShoppingIngredient;
}
