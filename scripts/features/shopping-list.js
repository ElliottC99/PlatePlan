/**
 * scripts/features/shopping-list.js
 * PlatePlan Shopping List Engine & Substitution Module
 * Classic global namespace script.
 */

function updateShopGroupPref(val) {
    const activeState = window.state || state;
    if (activeState?.prefs) {
        activeState.prefs.shopGroupBy = val;
    }
    if (typeof saveState === 'function') saveState();
    renderShopping();
}

// == SHOPPING OPTIMISATION ENGINE ==
function getPackVariants(baseIng) {
    let options = [];
    if (baseIng.packSize && baseIng.price) options.push({ size: baseIng.packSize, unit: baseIng.packUnit, price: baseIng.price, itemWeight: baseIng.itemWeight, itemCount: baseIng.itemCount, drainedWeight: baseIng.drainedWeight, drainedWeightUnit: baseIng.drainedWeightUnit });
    if (baseIng.packOptions && baseIng.packOptions.length > 0) {
        baseIng.packOptions.forEach(po => options.push({ size: po.packSize, unit: po.packUnit, price: po.price, itemWeight: po.itemWeight, itemCount: po.itemCount, drainedWeight: po.drainedWeight || baseIng.drainedWeight, drainedWeightUnit: po.drainedWeightUnit || baseIng.drainedWeightUnit }));
    }
    let uniq = [];
    options.forEach(opt => {
        const model={packSize:opt.size,packUnit:opt.unit,itemWeight:opt.itemWeight,itemWeightUnit:opt.itemWeightUnit||'g',drainedWeight:opt.drainedWeight,drainedWeightUnit:opt.drainedWeightUnit||'g'};
        const grossG = typeof getProductGrossPackAmount === 'function' ? getProductGrossPackAmount(model) : (opt.size || 100);
        const drainedG = +opt.drainedWeight > 0 && typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount(model) : 0;
        const g = typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount(model) : grossG;
        if (g > 0 && opt.price > 0 && !uniq.some(uo => uo.g === g && uo.price === opt.price)) {
            uniq.push({ ...opt, g, grossG, drainedG, key: `${g}|${opt.price}` });
        }
    });
    return uniq;
}

function setPackPick(bankId, key) {
    const activeState = window.state || state;
    if (!activeState.packPicks) activeState.packPicks = {};
    if (!key || key === 'auto') delete activeState.packPicks[bankId];
    else activeState.packPicks[bankId] = key;
    if (typeof saveState === 'function') saveState();
    renderShopping();
}

function getOptimalPurchase(neededGrams, baseIng) {
    let uniqueOptions = getPackVariants(baseIng);
    if (uniqueOptions.length === 0) return null;

    const activeState = window.state || state;
    const pick = activeState.packPicks?.[baseIng.id];
    if (pick) {
        const chosen = uniqueOptions.find(o => o.key === pick);
        if (chosen) {
            const qty = Math.max(1, Math.ceil(neededGrams / chosen.g));
            const formatDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(chosen.size, chosen.unit, chosen.itemWeight) : `${chosen.size}${chosen.unit || 'g'}`;
            return { desc: `${qty} × ${formatDisplay}`, cost: Math.round(qty * chosen.price * 100) / 100, manual: true };
        }
    }

    if (uniqueOptions.length <= 1) {
        const o = uniqueOptions[0];
        const qty = Math.max(1, Math.ceil(neededGrams / o.g));
        const formatDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(o.size, o.unit, o.itemWeight) : `${o.size}${o.unit || 'g'}`;
        return { desc: `${qty} × ${formatDisplay}`, cost: Math.round(qty * o.price * 100) / 100 };
    }

    const reqGrams = Math.ceil(neededGrams);
    const maxOptGrams = Math.max(...uniqueOptions.map(o => o.g));
    const limit = reqGrams + maxOptGrams; 
    
    let dp = new Array(limit + 1).fill(Infinity);
    let choice = new Array(limit + 1).fill(null);
    let itemsCount = new Array(limit + 1).fill(0);
    
    dp[0] = 0;
    
    for (let i = 0; i <= limit; i++) {
        if (dp[i] === Infinity) continue;
        for (let opt of uniqueOptions) {
            let next = i + opt.g;
            if (next <= limit) {
                let newCost = Math.round((dp[i] + opt.price) * 100) / 100;
                let newCount = itemsCount[i] + 1;
                
                if (newCost < dp[next] || (newCost === dp[next] && newCount < itemsCount[next])) {
                    dp[next] = newCost;
                    choice[next] = { opt, prev: i };
                    itemsCount[next] = newCount;
                }
            }
        }
    }
    
    let bestIdx = -1;
    let bestCost = Infinity;
    let bestCount = Infinity;
    
    for(let i = reqGrams; i <= limit; i++) {
        if (dp[i] < bestCost || (dp[i] === bestCost && itemsCount[i] < bestCount)) {
            bestCost = dp[i];
            bestCount = itemsCount[i];
            bestIdx = i;
        }
    }
    
    if (bestIdx === -1 || bestCost === Infinity) return null;
    
    let combo = [];
    let curr = bestIdx;
    while(curr > 0 && choice[curr]) {
        combo.push(choice[curr].opt);
        curr = choice[curr].prev;
    }
    
    const counts = {};
    combo.forEach(o => {
        const formatDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(o.size, o.unit, o.itemWeight) : `${o.size}${o.unit || 'g'}`;
        const k = formatDisplay || `${o.size}${o.unit}`;
        counts[k] = (counts[k] || 0) + 1;
    });
    
    return {
        desc: Object.keys(counts).map(k => `${counts[k]} × ${k}`).join(' and '),
        cost: bestCost
    };
}

function calculateShoppingPriceFromAggregates(agg){
  const byProduct = {};
  Object.values(agg || {}).forEach(item => {
    if(!item.bankId || !item.grams) return;
    if(!byProduct[item.bankId]) byProduct[item.bankId] = { bankId:item.bankId, grams:0, names:new Set() };
    byProduct[item.bankId].grams += +item.grams || 0;
    byProduct[item.bankId].names.add(item.name || item.productName || item.bankId);
  });
  const lines = Object.values(byProduct).map(line => {
    const product = typeof getProduct === 'function' ? getProduct(line.bankId) : null;
    if(!product) return null;
    const purchase = getOptimalPurchase(line.grams, product);
    const variants = getPackVariants(product);
    const cheapestBasis = variants.length ? variants.slice().sort((a,b)=>(a.price/a.g)-(b.price/b.g))[0] : null;
    const consumedCost = cheapestBasis && cheapestBasis.g > 0 ? (cheapestBasis.price / cheapestBasis.g) * line.grams : 0;
    const pricePer100 = cheapestBasis && cheapestBasis.g > 0 ? cheapestBasis.price / cheapestBasis.g * 100 : 0;
    const flags = [];
    if(!variants.length) flags.push('missing pack data');
    if(pricePer100 > 8) flags.push(`high £/100g (£${pricePer100.toFixed(2)})`);
    if((purchase?.cost || 0) > 20) flags.push('high checkout contribution');
    return { ...line, product, purchase, consumedCost, pricePer100, flags, name:[...line.names][0] || product.name };
  }).filter(Boolean);
  const estimatedTotal = lines.reduce((sum,line) => sum + (+line.purchase?.cost || 0), 0);
  const consumedTotal = lines.reduce((sum,line) => sum + (+line.consumedCost || 0), 0);
  const lineByBankId = Object.fromEntries(lines.map(line => [line.bankId, line]));
  return { estimatedTotal, consumedTotal, lines: lines.sort((a,b)=>(b.purchase?.cost || 0) - (a.purchase?.cost || 0)), lineByBankId };
}

function encodeShopTarget(target){
  return encodeURIComponent(JSON.stringify(target));
}

function decodeShopTarget(value){
  try { return JSON.parse(decodeURIComponent(value || '')); } catch(e) { return null; }
}

function formatShoppingBatchAmount(grams){
  return `${Math.round((+grams || 0) * 10) / 10}g`;
}

function getShoppingLineStateKey(groupId,bankId,fallback=''){
  return [String(groupId||(typeof normaliseAliasText === 'function' ? normaliseAliasText(fallback) : fallback)||'unresolved'),String(bankId||'unresolved')].join('|');
}

function setShoppingAtHome(key,checked,{quiet=false}={}){
  const activeState = window.state || state;
  if(!activeState.plan?.slots||!key)return;
  if(!activeState.plan.shoppingAtHome||typeof activeState.plan.shoppingAtHome!=='object')activeState.plan.shoppingAtHome={};
  if(checked)activeState.plan.shoppingAtHome[key]=true;else delete activeState.plan.shoppingAtHome[key];
  activeState.plan.confirmedShopping=false;
  if (typeof saveState === 'function') saveState();
  if (typeof markPlatePlanViewsDirty === 'function') markPlatePlanViewsDirty('shopping','planlib');
  renderShopping();
  if(!quiet && typeof showPlatePlanToast === 'function'){
    showPlatePlanToast(checked?'Moved to Already have.':'Moved back to your shopping list.',{
      label:'Undo',
      onclick:()=>setShoppingAtHome(key,!checked,{quiet:true})
    });
  }
}

function organiseShoppingAtHomeRows(host){
  if(!host)return;
  const rows=[...host.querySelectorAll('.shop-item-details[data-at-home="true"]')];
  if(!rows.length)return;
  const section=document.createElement('details');
  section.className='shop-home-section grouped-section';
  section.innerHTML=`<summary class="grouped-row"><span>Already have</span><span>${rows.length} item${rows.length===1?'':'s'} <span aria-hidden="true">⌄</span></span></summary><div class="grouped-row" data-shop-home-rows></div>`;
  const target=section.querySelector('[data-shop-home-rows]');
  rows.forEach(row=>target.appendChild(row));
  host.querySelectorAll('.shop-section').forEach(group=>{if(!group.querySelector('.shop-item-details'))group.remove();});
  host.appendChild(section);
}

function groupShoppingAllocationsByMeal(allocations){
  const map = new Map();
  (allocations || []).forEach(al => {
    const key = [al.day, al.mealKey, al.recipeId, al.variant || 'original'].join('|');
    if(!map.has(key)) {
      map.set(key, {
        key,
        day: al.day,
        mealKey: al.mealKey,
        mealLabel: al.mealLabel,
        recipeId: al.recipeId,
        recipeTitle: al.recipeTitle || al.recipeName,
        variant: al.variant || 'original',
        people: new Set(),
        grams: 0,
        substituted: false,
        replacedNames: new Set(),
        targets: []
      });
    }
    const row = map.get(key);
    row.people.add(al.person || '');
    row.grams += +al.qtyGrams || 0;
    row.substituted = row.substituted || !!al.isSubstituted;
    if(al.replacedIngredientName) row.replacedNames.add(al.replacedIngredientName);
    if(al.planMealId && al.originalKey) {
      row.targets.push({
        planMealId: al.planMealId,
        originalKey: al.originalKey,
        groupId: al.groupId || '',
        bankId: al.bankId || '',
        recipeId: al.recipeId || '',
        recipeName: al.recipeTitle || al.recipeName || '',
        day: al.day,
        mealKey: al.mealKey || '',
        person: al.person || ''
      });
    }
  });
  return [...map.values()].sort((a,b) => (+a.day || 0) - (+b.day || 0) || String(a.mealKey).localeCompare(String(b.mealKey)) || String(a.recipeTitle).localeCompare(String(b.recipeTitle)));
}

function renderShoppingMealAllocationRows(item, scopeId){
  const activeState = window.state || state;
  const groups = groupShoppingAllocationsByMeal(item.allocations || []);
  if(!groups.length) return '';
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  const escapeAttrFn = typeof ppEscapeAttr === 'function' ? ppEscapeAttr : (s => s);
  const titleCaseFn = typeof toTitleCase === 'function' ? toTitleCase : (s => s);
  const dayLabelFn = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel : ((p, d) => `Day ${d}`);

  const rows = groups.map((row, idx) => {
    const people = [...row.people].filter(Boolean).sort((a,b)=>a.localeCompare(b)).join(' + ') || 'Meal';
    const targetPayload = encodeShopTarget(row.targets);
    const title = `${dayLabelFn(activeState.plan,row.day,{short:true})} ${row.mealLabel || titleCaseFn(row.mealKey || 'Meal')} · ${people}`;
    const status = row.substituted ? `<span style="color:var(--purple);font-size:11px;margin-left:6px">changed from ${escapeHtmlFn([...row.replacedNames][0] || 'original')}</span>` : '';
    return `<label class="shop-meal-row" style="display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 0;border-top:${idx ? '1px solid var(--border)' : '0'};cursor:pointer">
      <input type="checkbox" class="shop-batch-check" data-scope="${escapeAttrFn(scopeId)}" data-targets="${targetPayload}" onchange="updateShoppingBatchToolbar('${escapeAttrFn(scopeId)}')">
      <span style="min-width:0"><strong>${escapeHtmlFn(title)}</strong><br><span class="${/https?:\/\/|[^\s]{36,}/i.test(row.recipeTitle||'')?'breakable-url':''}" style="color:var(--text2);font-size:11px">${escapeHtmlFn(row.recipeTitle || '')}${row.variant === 'enhanced' ? ' · Enhanced' : ''}${status}</span></span>
      <span style="font-size:12px;color:var(--text2);white-space:nowrap">${formatShoppingBatchAmount(row.grams)}</span>
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

function getSelectedShoppingTargets(scopeId){
  const targets = [];
  document.querySelectorAll(`.shop-batch-check[data-scope="${String(scopeId).replace(/"/g, '\\"')}"]:checked`).forEach(input => {
    const decoded = decodeShopTarget(input.dataset.targets);
    if(Array.isArray(decoded)) decoded.forEach(t => targets.push(t));
  });
  const seen = new Set();
  return targets.filter(t => {
    const key = `${t.planMealId}|${t.originalKey}`;
    if(!t.planMealId || !t.originalKey || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateShoppingBatchToolbar(scopeId){
  const targets = getSelectedShoppingTargets(scopeId);
  const toolbar = document.getElementById(scopeId + '-toolbar');
  const count = document.getElementById(scopeId + '-count');
  if(toolbar) toolbar.style.display = targets.length ? 'flex' : 'none';
  if(count) count.textContent = `${targets.length} portion${targets.length === 1 ? '' : 's'} selected`;
}

function selectAllShoppingRows(scopeId, checked){
  document.querySelectorAll(`.shop-batch-check[data-scope="${String(scopeId).replace(/"/g, '\\"')}"]`).forEach(input => { input.checked = !!checked; });
  updateShoppingBatchToolbar(scopeId);
}

function refreshShoppingAfterBatch(){
  const activeState = window.state || state;
  if(activeState.plan) activeState.plan.confirmedShopping = false;
  if (typeof saveState === 'function') saveState();
  if(document.getElementById('view-shopping')?.classList.contains('active')) renderShopping();
  if(document.getElementById('view-planner')?.classList.contains('active') && typeof renderPlan === 'function') renderPlan();
}

function applyShoppingBatchTargets(targets, mode, productId = '', quantityOverrides = []){
  (targets || []).forEach((target,targetIndex) => {
    const ov = typeof getPlanOverride === 'function' ? getPlanOverride(target.planMealId) : null;
    if(!ov) return;
    if(mode === 'remove') {
      ov.removeIngredientKeys[target.originalKey] = true;
      delete ov.productOverrides[target.originalKey];
      if(target.groupId) delete ov.productOverrides[target.groupId];
      delete ov.substitutions[target.originalKey];
      delete ov.ingredientReplacements[target.originalKey];
      delete ov.mergeInto[target.originalKey];
      delete ov.ingredientQuantityOverrides[target.originalKey];
      return;
    }
    delete ov.removeIngredientKeys[target.originalKey];
    if(mode === 'merge') {
      ov.ingredientReplacements[target.originalKey] = productId;
      ov.mergeInto[target.originalKey] = productId;
      if(quantityOverrides[targetIndex]) ov.ingredientQuantityOverrides[target.originalKey]=quantityOverrides[targetIndex];
      else delete ov.ingredientQuantityOverrides[target.originalKey];
      return;
    }
    if(mode === 'replace') {
      ov.ingredientReplacements[target.originalKey] = productId;
      delete ov.mergeInto[target.originalKey];
      if(quantityOverrides[targetIndex]) ov.ingredientQuantityOverrides[target.originalKey]=quantityOverrides[targetIndex];
      else delete ov.ingredientQuantityOverrides[target.originalKey];
    }
  });
  refreshShoppingAfterBatch();
}

function openBatchSubstituteFromSelection(scopeId, mode){
  const targets = getSelectedShoppingTargets(scopeId);
  if(!targets.length) return typeof openAppInfoModal === 'function' ? openAppInfoModal('Select meals','Select at least one meal row first.') : alert('Select at least one meal row first.');
  openSubstituteModalForTargets(targets, mode);
}

function confirmRemoveShoppingBatch(scopeId){
  const targets = getSelectedShoppingTargets(scopeId);
  if(!targets.length) return typeof openAppInfoModal === 'function' ? openAppInfoModal('Select meals','Select at least one meal row first.') : alert('Select at least one meal row first.');
  if (typeof openAppConfirmModal === 'function') {
    openAppConfirmModal('Remove selected ingredients?', `Remove this ingredient from ${targets.length} planned portion${targets.length === 1 ? '' : 's'}?`, 'Remove', () => applyShoppingBatchTargets(targets, 'remove'));
  }
}

function getSubstitutionSuggestionProducts(targets, mode, query = ''){
  const activeState = window.state || state;
  const q = String(query || '').trim().toLowerCase();
  let rows = [];
  if(mode === 'merge') {
    const selectedProductIds = new Set((targets || []).map(t => t.bankId).filter(Boolean));
    rows = collectCurrentShoppingProducts()
      .filter(p => !selectedProductIds.has(p.id))
      .map(p => ({...p, substSection:'Already in shopping list'}));
  } else {
    const groupIds = [...new Set((targets || []).map(t => t.groupId).filter(Boolean))];
    const firstGroup = typeof getIngredientGroup === 'function' ? getIngredientGroup(groupIds[0]) : null;
    const seen = new Set();
    const add = (products, label) => (products || []).forEach(p => {
      if(!p || seen.has(p.id)) return;
      seen.add(p.id);
      rows.push({...p, substSection:label});
    });
    if(groupIds.length === 1 && firstGroup) {
      if (typeof getGroupProducts === 'function') add(getGroupProducts(firstGroup.id), 'Same sub-type');
      const family = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(firstGroup) : null;
      if(family && typeof getFamilyGroups === 'function' && typeof getGroupProducts === 'function') {
        add(getFamilyGroups(family.id).filter(g => g.id !== firstGroup.id).flatMap(g => getGroupProducts(g.id)), 'Same ingredient');
      }
      add((activeState.ingredients || []).filter(p => {
        const g = typeof getIngredientGroup === 'function' ? getIngredientGroup(p.groupId) : null;
        return g && g.cat === firstGroup.cat && g.ingredientId !== firstGroup.ingredientId;
      }), 'Same category');
    }
    add(activeState.ingredients || [], 'All products');
  }
  if(q) rows = rows.filter(i => {
    const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(i.groupId) : null;
    const hay = [i.name, i.brand, typeof getProductFamily === 'function' ? getProductFamily(i) : '', typeof getGroupTypeName === 'function' ? getGroupTypeName(group) : '', typeof getGroupHierarchyText === 'function' ? getGroupHierarchyText(group || {cat:i.cat, family:typeof getProductFamily==='function'?getProductFamily(i):'', name:i.name}) : ''].join(' ').toLowerCase();
    return hay.includes(q);
  });
  return rows.sort((a,b) => {
    const order = {'Same sub-type':0,'Same ingredient':1,'Same category':2,'Already in shopping list':0,'All products':3};
    const oa = order[a.substSection] ?? 9;
    const ob = order[b.substSection] ?? 9;
    if(oa !== ob) return oa - ob;
    const priorityFn = typeof scoreProductByPriority === 'function' ? scoreProductByPriority : (() => 0);
    return priorityFn(b, activeState.prefs?.productPriority || 'protein_per_kcal') - priorityFn(a, activeState.prefs?.productPriority || 'protein_per_kcal') || (a.name || '').localeCompare(b.name || '');
  });
}

function renderSubstitutionDropdown(list){
  const drop = document.getElementById('subst-dropdown');
  if(!drop) return;
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  const escapeAttrFn = typeof ppEscapeAttr === 'function' ? ppEscapeAttr : (s => s);
  if(!list.length) {
    drop.innerHTML = `<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No matches found.</div>`;
  } else {
    drop.innerHTML = list.slice(0,32).map(i => {
      const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(i.groupId) : null;
      const pkcal = typeof getProductProteinPer100Kcal === 'function' && typeof round1 === 'function' ? round1(getProductProteinPer100Kcal(i)) : 0;
      const ppound = typeof getProductProteinPerPound === 'function' && typeof round1 === 'function' ? round1(getProductProteinPerPound(i)) : 0;
      const pack = typeof formatPackDisplay === 'function' ? formatPackDisplay(i.packSize, i.packUnit || 'g', i.itemWeight) : '';
      const groupText = typeof getGroupHierarchyText === 'function' ? getGroupHierarchyText(group || {cat:i.cat, family:typeof getProductFamily==='function'?getProductFamily(i):'', name:i.name}) : '';
      return `<div class="map-drop-item" onclick="selectSubstItem('${escapeAttrFn(i.id)}')">
        <div style="font-weight:600;font-size:13px">${escapeHtmlFn(i.name)} ${i.brand && i.brand !== 'Generic' ? `(${escapeHtmlFn(i.brand)})` : ''}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">${typeof round1==='function'?round1(i.prot || 0):i.prot||0}g P | ${Math.round(i.cal || 0)} kcal | ${pkcal}g P/100kcal | ${ppound}g P/£${i.price ? ` | £${(+i.price).toFixed(2)}` : ''}${pack ? ` | ${escapeHtmlFn(pack)}` : ''}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${escapeHtmlFn(i.substSection || 'Product')} · ${escapeHtmlFn(groupText)}</div>
      </div>`;
    }).join('');
  }
  drop.style.display = 'block';
}

function renderShopping(){
  if (typeof ensurePlannerShell === 'function') ensurePlannerShell();
  const el=document.getElementById('shop-content');
  if(!el) return;
  const activeState = window.state || state;
  if(!activeState.plan?.slots){
    el.innerHTML='<div class="empty">Generate a meal plan first.</div>';
    const prep=document.getElementById('shop-meal-prep-panel'); if(prep) prep.innerHTML='';
    return;
  }
  const{days,slots}=activeState.plan;
  const agg={};
  let estimatedTotal = 0;
  let consumedTotal = 0;
  
  const groupMode = activeState.prefs?.shopGroupBy || 'family';
  
  function getGroupingKey(n,bankId,groupId=''){
    if(bankId){
        const bi=activeState.ingredients.find(i=>i.id===bankId);
        if(bi) {
          if(groupMode === 'family') return typeof getProductFamily === 'function' ? getProductFamily(bi) : 'Other';
          if(groupMode === 'category') {
            const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(groupId || bi.groupId) : null;
            return (typeof CAT !== 'undefined' ? CAT[group?.cat || bi.cat] : null) || group?.cat || bi.cat || 'Other';
          }
          return bi.storage || 'cupboard';
        }
    }
    n=(n||'').toLowerCase();
    if(groupMode === 'family') {
        return (typeof normaliseAliasText === 'function' && typeof inferIngredientFamilyFromText === 'function') ? normaliseAliasText(inferIngredientFamilyFromText(n)) : 'No ingredient';
    } else if(groupMode === 'category') {
        return 'Other';
    } else {
        if(/frozen|ice/.test(n)) return 'freezer';
        if(/milk|yoghurt|cheese|cream|butter|egg|fresh|spinach|lettuce|cucumber|tomato|pepper/.test(n)) return 'fridge';
        return 'cupboard';
    }
  }

  function formatShoppingNeed(item) {
    if(item.mixedUnits) return `${Math.round(item.grams)}g`;
    if(item.needUnit === 'ml') return `${Math.round(item.needQty)}ml`;
    if(item.needUnit === 'item') return `${Math.round(item.needQty * 10) / 10} item${item.needQty === 1 ? '' : 's'}`;
    return `${Math.round(item.needQty)}g`;
  }
  
  for(let d=1;d<=days;d++){
    const s=slots[d]||{};
    (typeof SLOTS !== 'undefined' ? SLOTS : []).forEach(sl=>{
      if((activeState.excluded||{})[d]?.[sl.key])return;
      const slotData = s[sl.key];
      if(!slotData)return;
      
      const slotInfo = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(slotData) : { active: null, instanceId: null };
      const rId = slotInfo.id;
      const instanceId = slotInfo.instanceId;
      const r = slotInfo.active;
      
      if(!r||!r.ingredients)return;
      const context = typeof getPlanContextForInstance === 'function' ? getPlanContextForInstance(instanceId) : {};
      const slotScale = typeof getSlotShoppingScale === 'function' ? getSlotShoppingScale(r, sl.key, instanceId) : 1;

      r.ingredients.forEach(ing=>{
        if(typeof isIngredientRemovedInContext === 'function' && isIngredientRemovedInContext(ing, context)) return;
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
        const k = getShoppingLineStateKey(groupId,actualBankId,raw);

        if(k){
          if(!agg[k]) agg[k] = { key:k, name: actualName || raw, productName: bankIng?.name || '', brand: bankIng?.brand || '', bankId: actualBankId, groupId, group: getGroupingKey(bankIng?.name || actualName || raw, actualBankId, groupId), grams: 0, needQty: 0, needUnit: amt.unit, mixedUnits: false, allocations: [] };
          agg[k].grams += grams;
          if(agg[k].needUnit === amt.unit && !agg[k].mixedUnits) {
            agg[k].needQty += amt.qty;
          } else {
            agg[k].mixedUnits = true;
          }
          const dayLabelFn = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel : ((p, d) => `Day ${d}`);
          const mealTypeFn = typeof getMealTypeFromSlotKey === 'function' ? getMealTypeFromSlotKey(sl.key) : 'dinner';
          agg[k].allocations.push({
             planMealId: instanceId,
             recipeId: rId,
             recipeName: `${dayLabelFn(activeState.plan,d,{short:true})} ${sl.short} - ${r.name}${slotInfo.variant === 'enhanced' ? ' (Enhanced)' : ''}`,
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

  const requiredAgg={};
  Object.entries(agg).forEach(([key,item])=>{requiredAgg[key]={...item,allocations:[...(item.allocations||[])]};});
  const useUpEntriesFn = typeof getUseUpEntries === 'function' ? getUseUpEntries() : [];
  const useUpByProduct=new Map(useUpEntriesFn.map(entry=>[entry.productId,entry]));
  Object.values(agg).forEach(item=>{
    item.requiredGrams=item.grams;
    item.toBuyGrams=item.grams;
    item.useUpAvailable=null;
    item.useUpUsed=0;
    item.useUpRemainder=null;
    const entry=useUpByProduct.get(item.bankId);
    const available=typeof getUseUpAvailableAmount === 'function' ? getUseUpAvailableAmount(entry) : null;
    if(available==null)return;
    item.useUpAvailable=available;
    item.useUpUsed=Math.min(item.requiredGrams,available);
    item.useUpRemainder=Math.max(0,available-item.requiredGrams);
    item.toBuyGrams=Math.max(0,item.requiredGrams-available);
    item.grams=item.toBuyGrams;
    if(!item.mixedUnits&&item.needQty>0&&item.requiredGrams>0)item.needQty*=item.toBuyGrams/item.requiredGrams;
  });
  
  const groupedData = {};
  if(groupMode === 'family') {
      const knownFam = typeof getKnownFamilies === 'function' ? getKnownFamilies() : [];
      knownFam.concat(['No ingredient']).forEach(f => groupedData[f] = []);
  } else if(groupMode === 'category') {
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
  if(!activeState.plan.shoppingAtHome||typeof activeState.plan.shoppingAtHome!=='object')activeState.plan.shoppingAtHome={};
  const validShoppingKeys=new Set(Object.keys(agg));
  const staleShoppingKeys=Object.keys(activeState.plan.shoppingAtHome).filter(key=>!validShoppingKeys.has(key));
  if(staleShoppingKeys.length){staleShoppingKeys.forEach(key=>delete activeState.plan.shoppingAtHome[key]);if(typeof saveState==='function')saveState();}
  const buyableAgg=Object.fromEntries(Object.entries(agg).filter(([key])=>!activeState.plan.shoppingAtHome[key]));
  const allPriceSummary = calculateShoppingPriceFromAggregates(requiredAgg);
  const priceSummary = calculateShoppingPriceFromAggregates(buyableAgg);
  estimatedTotal = priceSummary.estimatedTotal;
  consumedTotal = allPriceSummary.consumedTotal;
  
  let html='';
  if(activeState.isDraftPlan || activeState.draftPlan){
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

  Object.entries(groupedData).forEach(([gKey, items])=>{
      if(!items.length)return;
      let title = (groupMode === 'family' || groupMode === 'category') ? gKey : (gKey ? gKey.charAt(0).toUpperCase() + gKey.slice(1) : 'Other');
      
      html+='<div class="shop-section"><h3>'+title+'</h3><div class="card" style="padding:0 14px">'+items.sort((a,b)=>a.name.localeCompare(b.name)).map(it=>{
          const isAtHome=!!activeState.plan.shoppingAtHome?.[it.key];
          let ingredientName = it.name || 'Ingredient';
          const isFreshGarlicFn = typeof isFreshGarlicIngredient === 'function' ? isFreshGarlicIngredient : (() => false);
          if(isFreshGarlicFn({ name: it.name }, { name: it.productName }) && it.grams) {
              const totalCloves = Math.round(it.grams / 6);
              const heads = Math.floor(totalCloves / 11);
              const remainder = totalCloves % 11;
              let garlicText = [];
              if(heads > 0) garlicText.push(heads + (heads === 1 ? ' head' : ' heads'));
              if(remainder > 0) garlicText.push(remainder + (remainder === 1 ? ' clove' : ' cloves'));
              if(garlicText.length) ingredientName = `${it.name} (${garlicText.join(' and ')})`;
          }

          let productFullName = '';
          if(it.productName) {
            const brand = (it.brand && it.brand !== 'Generic' && !it.productName.toLowerCase().startsWith(it.brand.toLowerCase())) ? `${it.brand} ` : '';
            productFullName = `${brand}${it.productName}`.trim();
          }

          let displayName = ingredientName;
          if(productFullName && productFullName.toLowerCase() !== ingredientName.toLowerCase()) {
            displayName = `${ingredientName} - ${productFullName}`;
          }
          const needLabel = formatShoppingNeed(it);
          const stockLabel=it.useUpAvailable==null?'':`<span class="shop-use-up"><strong>Use-up stock:</strong> required ${formatShoppingBatchAmount(it.requiredGrams)} · available ${formatShoppingBatchAmount(it.useUpAvailable)} · planned use ${formatShoppingBatchAmount(it.useUpUsed)} · remaining ${formatShoppingBatchAmount(it.useUpRemainder)} · to buy ${formatShoppingBatchAmount(it.toBuyGrams)}</span>`;
          
          const itemScope = 'shop-scope-' + Math.random().toString(36).slice(2,9);
          const allocationHtml = renderShoppingMealAllocationRows(it, itemScope);

          let optimiserHtml = '';
          if (!isAtHome && it.bankId && it.grams > 0) {
              const bi = activeState.ingredients.find(x => x.id === it.bankId);
              if (bi) {
                  const variants = getPackVariants(bi);
                  if (variants.length > 0) {
                      const currentPick = activeState.packPicks?.[bi.id] || 'auto';
                      const pickerOpts = [`<option value="auto"${currentPick==='auto'?' selected':''}>Auto (cheapest combo)</option>`]
                          .concat(variants.map(v => {
                              const packDisplay = typeof formatPackDisplay === 'function' ? formatPackDisplay(v.size, v.unit, v.itemWeight) : `${v.size}${v.unit || 'g'}`;
                              const label = packDisplay || `${v.size}${v.unit || 'g'}`;
                              return `<option value="${v.key}"${currentPick===v.key?' selected':''}>${label} @ £${(+v.price).toFixed(2)}</option>`;
                          })).join('');
                      const opt = priceSummary.lineByBankId?.[bi.id]?.purchase || getOptimalPurchase(it.grams, bi);
                      const recLine = opt ? `<div><strong>${opt.manual?'Chosen packs':'Pack suggestion'}:</strong> ${opt.desc} (£${opt.cost.toFixed(2)})</div>` : '';
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
          <details class="shop-item-details" data-shopping-key="${escapeAttrFn(it.key)}" data-at-home="${isAtHome?'true':'false'}" style="padding:6px 0; border-bottom:1px solid var(--border);">
              <summary class="shop-item-summary" style="font-size:13px; cursor:pointer; outline:none; font-weight:500;">
                  <input class="shop-home-check" type="checkbox" ${isAtHome?'checked':''} aria-label="${escapeAttrFn(isAtHome?'Remove '+displayName+' from Already have':'Mark '+displayName+' as already at home')}" onclick="event.stopPropagation()" onchange="event.stopPropagation();setShoppingAtHome('${escapeAttrFn(it.key)}',this.checked)">
                  <span class="shop-item-copy" data-copy="${escapeAttrFn(`${displayName} — ${it.useUpAvailable!=null?'To buy':'Need'} ${needLabel}`)}">${escapeHtmlFn(displayName)}<span class="shop-need">${it.useUpAvailable!=null?'To buy':'Need'} ${needLabel}</span>${stockLabel}</span>
                  <span style="font-size:12px;color:var(--text3);" aria-hidden="true">⌄</span>
              </summary>
              <div style="padding-left:15px; margin-top:5px; font-size:12px; color:var(--text2);">
                  ${allocationHtml}
                  ${optimiserHtml}
              </div>
          </details>`;
      }).join('')+'</div></div>';
  });
  el.innerHTML=html||'<div class="empty">No ingredients to list.</div>';
  organiseShoppingAtHomeRows(el);
  const summary=document.getElementById('shop-summary');
  if(typeof renderMealPrepSuggestions === 'function') renderMealPrepSuggestions();
  if(summary){
    const planScoreFn = typeof calculatePlanScore === 'function' ? calculatePlanScore : (() => ({ score: 0 }));
    const score=planScoreFn(activeState.plan);
    const contributorHtml = priceSummary.lines.slice(0,8).map(line => `<div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--border);padding:5px 0;font-size:11px"><span>${escapeHtmlFn(line.product?.name || line.name)}${line.flags.length ? ` <em style="color:var(--amber)">(${escapeHtmlFn(line.flags.join(', '))})</em>` : ''}<br><span style="color:var(--text3)">${Math.round(line.grams)}g needed · ${escapeHtmlFn(line.purchase?.desc || 'no pack suggestion')}</span></span><strong>£${(+line.purchase?.cost || 0).toFixed(2)}</strong></div>`).join('');
    summary.innerHTML=`<div class="card" style="border-color:var(--green);margin-bottom:12px">
      <div class="row-between" style="gap:10px;align-items:flex-start">
        <div style="flex:1">
          <h3 style="margin-bottom:6px;color:var(--green)">Shopping summary</h3>
          <div class="plan-summary">
            <div class="summary-box"><strong>Estimated checkout price</strong><div style="font-size:20px;font-weight:700">£${estimatedTotal.toFixed(2)}</div><div style="color:var(--text2)">Whole packs to buy</div></div>
            <div class="summary-box"><strong>Estimated consumed cost</strong><div style="font-size:20px;font-weight:700">£${consumedTotal.toFixed(2)}</div><div style="color:var(--text2)">Food used in recipes</div></div>
            <div class="summary-box"><strong>Updated plan score</strong><div style="font-size:20px;font-weight:700;color:${score.score<=10?'var(--green)':score.score<=20?'var(--amber)':'var(--red)'}">${score.score}</div><div style="color:var(--text2)">Includes shopping changes</div></div>
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

function readableHerbQuantity(qty,unit,factor){
  const clean=String(unit||'').toLowerCase().replace(/s$/,'');
  if(clean==='tbsp'||clean==='tsp'){
    const teaspoons=qty*(clean==='tbsp'?3:1)*factor;
    if(teaspoons>=3&&Math.abs(teaspoons/3-Math.round(teaspoons/3))<0.01) return {qty:Math.round(teaspoons/3*10)/10,unit:'tbsp'};
    return {qty:Math.round(teaspoons*10)/10,unit:'tsp'};
  }
  return {qty:Math.round(qty*factor*10)/10,unit:clean||unit||''};
}

function buildHerbConversion(target,replacement){
  const ing=typeof getPlannedIngredientForSubstitutionTarget === 'function' ? getPlannedIngredientForSubstitutionTarget(target) : null;
  if(!ing||!replacement) return null;
  const sourceGroup=typeof getIngredientGroup === 'function' ? getIngredientGroup(ing.groupId||(typeof getProduct==='function'?getProduct(ing.bankId)?.groupId:'')) : null;
  const targetGroup=typeof getIngredientGroup === 'function' ? getIngredientGroup(replacement.groupId) : null;
  const isHerbsFn = typeof isHerbsAndSpicesGroup === 'function' ? isHerbsAndSpicesGroup : (() => false);
  if(!isHerbsFn(sourceGroup)||!isHerbsFn(targetGroup)||!sourceGroup?.herbForm||!targetGroup?.herbForm||sourceGroup.herbForm===targetGroup.herbForm||!sourceGroup.herbKey||sourceGroup.herbKey!==targetGroup.herbKey) return null;
  const factor=sourceGroup.herbForm==='fresh'&&targetGroup.herbForm==='dried'?1/3:3;
  const compatible=['g','ml','tsp','tbsp'].includes(String(ing.unit||'').toLowerCase().replace(/s$/,''));
  const converted=readableHerbQuantity(+ing.qty||0,ing.unit,factor);
  return {sourceForm:sourceGroup.herbForm,targetForm:targetGroup.herbForm,herbKey:sourceGroup.herbKey,originalQty:+ing.qty||0,originalUnit:ing.unit||'',qty:compatible?converted.qty:(+ing.qty||0),unit:compatible?converted.unit:(ing.unit||''),manual:!compatible,ratio:factor};
}

function renderHerbConversionPreview(){
  const host=document.getElementById('subst-herb-conversion'); if(!host) return;
  const replacement = typeof getProduct === 'function' ? getProduct(currentSubstContext.newBankId) : null;
  const conversions=(currentSubstContext.targets||[]).map(target=>buildHerbConversion(target,replacement));
  currentSubstContext.herbConversions=conversions;
  if(!conversions.some(Boolean)){host.style.display='none';host.innerHTML='';return;}
  host.style.display='block';
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  host.innerHTML=`<div class="card-inner" style="margin:0"><strong style="font-size:12px">Fresh/dried herb conversion</strong><div style="font-size:11px;color:var(--text2);margin:3px 0 8px">PlatePlan uses 3 parts fresh to 1 part dried. Review each plan-specific amount before applying.</div>${conversions.map((conversion,index)=>conversion?`<div style="display:grid;grid-template-columns:minmax(0,1fr) 85px 76px;gap:7px;align-items:end;margin-top:7px"><div style="font-size:12px"><strong>${escapeHtmlFn(conversion.herbKey)}</strong><br>${conversion.originalQty} ${escapeHtmlFn(conversion.originalUnit)} ${conversion.sourceForm} → ${conversion.targetForm}${conversion.manual?'<br><span style="color:var(--amber)">Unknown/count unit: confirm manually</span>':''}</div><div><label>Amount</label><input type="number" min="0" step="0.1" data-herb-qty="${index}" value="${conversion.qty}"></div><div><label>Unit</label><select data-herb-unit="${index}"><option value="g"${conversion.unit==='g'?' selected':''}>g</option><option value="ml"${conversion.unit==='ml'?' selected':''}>ml</option><option value="tsp"${conversion.unit==='tsp'?' selected':''}>tsp</option><option value="tbsp"${conversion.unit==='tbsp'?' selected':''}>tbsp</option><option value="qty"${conversion.unit==='qty'?' selected':''}>items</option></select></div></div>`:'').join('')}</div>`;
}

function collectCurrentShoppingProducts(){
  const activeState = window.state || state;
  const ids = new Set();
  if(!activeState.plan?.slots) return [];
  const days = activeState.plan.days || Object.keys(activeState.plan.slots || {}).length || 0;
  for(let d=1; d<=days; d++){
    const day = activeState.plan.slots[d] || {};
    (typeof SLOTS !== 'undefined' ? SLOTS : []).forEach(sl => {
      if(activeState.excluded[d]?.[sl.key]) return;
      const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(day[sl.key]) : { active: null };
      if(!info.active) return;
      const context = typeof getPlanContextForInstance === 'function' ? getPlanContextForInstance(info.instanceId) : {};
      (info.active.ingredients || []).forEach(ing => {
        if(typeof isIngredientRemovedInContext === 'function' && isIngredientRemovedInContext(ing, context)) return;
        const adjusted = typeof getAdjustedIngredientForContext === 'function' ? getAdjustedIngredientForContext(ing, context) : ing;
        const resolved = typeof resolveProductForIngredientWithContext === 'function' ? resolveProductForIngredientWithContext(adjusted, context) : { productId: null };
        if(resolved.productId) ids.add(resolved.productId);
      });
    });
  }
  const getProdFn = typeof getProduct === 'function' ? getProduct : (() => null);
  return [...ids].map(id => getProdFn(id)).filter(Boolean);
}

function openSubstituteModalForTargets(targets, mode = 'replace'){
  const activeState = window.state || state;
  currentSubstContext = { planMealId: targets[0]?.planMealId || null, originalKey: targets[0]?.originalKey || null, groupId: targets[0]?.groupId || null, newBankId: null, mode: mode === 'merge' ? 'merge' : 'replace', targets: targets || [], herbConversions:[] };
  const search = document.getElementById('subst-search');
  const selected = document.getElementById('subst-selected');
  const dropdown = document.getElementById('subst-dropdown');
  if(search) search.value = '';
  if(selected) selected.textContent = '';
  if(dropdown) dropdown.style.display = 'none';
  const herb=document.getElementById('subst-herb-conversion'); if(herb){herb.style.display='none';herb.innerHTML='';}
  const title = document.querySelector('#subst-modal-wrap h3');
  const copy = document.querySelector('#subst-modal-wrap p');
  const summary = document.getElementById('subst-target-summary');
  if(title) title.textContent = currentSubstContext.mode === 'merge' ? 'Merge selected ingredients' : 'Replace selected ingredients';
  if(copy) copy.textContent = currentSubstContext.mode === 'merge'
    ? 'Choose an existing product already on this shopping list to merge these ingredient needs into.'
    : 'Choose a replacement product. Suggestions start close to the original ingredient, then broaden out.';
  const dayLabelFn = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel : ((p, d) => `Day ${d}`);
  const titleCaseFn = typeof titleCase === 'function' ? titleCase : (s => s);
  const escapeHtmlFn = typeof ppEscapeHtml === 'function' ? ppEscapeHtml : (s => s);
  if(summary) summary.innerHTML = `Applying to <strong>${targets.length}</strong> planned portion${targets.length === 1 ? '' : 's'}${targets.length ? ` · ${escapeHtmlFn([...new Set(targets.map(t => `${dayLabelFn(activeState.plan,t.day,{short:true})} ${titleCaseFn(t.mealKey || 'meal')}`))].slice(0,4).join(', '))}` : ''}`;
  document.getElementById('subst-modal-wrap').classList.add('open');
  renderSubstitutionDropdown(getSubstitutionSuggestionProducts(targets, currentSubstContext.mode, ''));
  setTimeout(() => search?.focus(), 0);
}

function openSubstituteModal(planMealId, originalKey, mode = 'replace') {
  const getProdFn = typeof getProduct === 'function' ? getProduct : (() => null);
  const getGroupFn = typeof getIngredientGroup === 'function' ? getIngredientGroup : (() => null);
  const asProduct = getProdFn(originalKey);
  const groupId = getGroupFn(originalKey) ? originalKey : (asProduct?.groupId || '');
  openSubstituteModalForTargets([{ planMealId, originalKey, groupId, bankId: asProduct?.id || '', day:'', mealKey:'', person:'' }], mode === 'merge' ? 'merge' : 'replace');
}

function closeSubstituteModal() {
  const wrap = document.getElementById('subst-modal-wrap');
  if(wrap) wrap.classList.remove('open');
}

let substSearchTimeout = null;
function handleSubstSearch(e) {
  clearTimeout(substSearchTimeout);
  const query = (e.target.value || '').toLowerCase();
  substSearchTimeout = setTimeout(() => {
    renderSubstitutionDropdown(getSubstitutionSuggestionProducts(currentSubstContext.targets || [], currentSubstContext.mode, query));
  }, 120);
}

function selectSubstItem(bankId) {
  currentSubstContext.newBankId = bankId;
  const activeState = window.state || state;
  const b = activeState.ingredients.find(i=>i.id===bankId);
  const sSearch = document.getElementById('subst-search'); if(sSearch) sSearch.value = b?.name || '';
  const sDrop = document.getElementById('subst-dropdown'); if(sDrop) sDrop.style.display = 'none';
  const sSel = document.getElementById('subst-selected'); if(sSel) sSel.textContent = b ? `Using product: ${b.name}` : '';
  renderHerbConversionPreview();
}

function confirmSubstitute() {
  const { targets, newBankId, mode } = currentSubstContext;
  if(!newBankId) return typeof openAppInfoModal === 'function' ? openAppInfoModal('Choose a product','Select a Product Bank item from the list before applying the replacement.') : alert('Select a Product Bank item.');
  const quantityOverrides=(currentSubstContext.herbConversions||[]).map((conversion,index)=>{
    if(!conversion) return null;
    const qty=+document.querySelector(`[data-herb-qty="${index}"]`)?.value;
    const unit=document.querySelector(`[data-herb-unit="${index}"]`)?.value||conversion.unit;
    if(!(qty>0)) return null;
    return {...conversion,qty,unit,manual:conversion.manual||qty!==conversion.qty||unit!==conversion.unit};
  });
  applyShoppingBatchTargets(targets || [], mode === 'merge' ? 'merge' : 'replace', newBankId, quantityOverrides);
  closeSubstituteModal();
}

function removeSubstitute() {
  const activeState = window.state || state;
  const { targets } = currentSubstContext;
  (targets || []).forEach(target => {
    const ov = activeState.overrides?.[target.planMealId];
    if(!ov) return;
    if(ov.substitutions && target.originalKey) delete ov.substitutions[target.originalKey];
    if(ov.productOverrides && target.groupId) delete ov.productOverrides[target.groupId];
    if(ov.ingredientReplacements && target.originalKey) delete ov.ingredientReplacements[target.originalKey];
    if(ov.mergeInto && target.originalKey) delete ov.mergeInto[target.originalKey];
    if(ov.ingredientQuantityOverrides && target.originalKey) delete ov.ingredientQuantityOverrides[target.originalKey];
    if(ov.removeIngredientKeys && target.originalKey) delete ov.removeIngredientKeys[target.originalKey];
  });
  refreshShoppingAfterBatch();
  closeSubstituteModal();
}

function removeShoppingIngredient(planMealId, originalKey){
  applyShoppingBatchTargets([{ planMealId, originalKey, groupId:'', bankId:'', day:'', mealKey:'', person:'' }], 'remove');
}

function confirmShoppingList(){
  const activeState = window.state || state;
  if(!activeState.plan?.slots) return;
  if(activeState.isDraftPlan || activeState.draftPlan){
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

// Attach to window global namespace
if (typeof window !== 'undefined') {
  window.PlatePlanShopping = {
    updateShopGroupPref,
    getPackVariants,
    setPackPick,
    getOptimalPurchase,
    calculateShoppingPriceFromAggregates,
    encodeShopTarget,
    decodeShopTarget,
    formatShoppingBatchAmount,
    getShoppingLineStateKey,
    setShoppingAtHome,
    organiseShoppingAtHomeRows,
    groupShoppingAllocationsByMeal,
    renderShoppingMealAllocationRows,
    getSelectedShoppingTargets,
    updateShoppingBatchToolbar,
    selectAllShoppingRows,
    refreshShoppingAfterBatch,
    applyShoppingBatchTargets,
    openBatchSubstituteFromSelection,
    confirmRemoveShoppingBatch,
    getSubstitutionSuggestionProducts,
    renderSubstitutionDropdown,
    renderShopping,
    readableHerbQuantity,
    buildHerbConversion,
    renderHerbConversionPreview,
    collectCurrentShoppingProducts,
    openSubstituteModalForTargets,
    openSubstituteModal,
    closeSubstituteModal,
    handleSubstSearch,
    selectSubstItem,
    confirmSubstitute,
    removeSubstitute,
    removeShoppingIngredient,
    confirmShoppingList
  };

  // Expose legacy global aliases
  window.updateShopGroupPref = updateShopGroupPref;
  window.getPackVariants = getPackVariants;
  window.setPackPick = setPackPick;
  window.getOptimalPurchase = getOptimalPurchase;
  window.calculateShoppingPriceFromAggregates = calculateShoppingPriceFromAggregates;
  window.encodeShopTarget = encodeShopTarget;
  window.decodeShopTarget = decodeShopTarget;
  window.formatShoppingBatchAmount = formatShoppingBatchAmount;
  window.getShoppingLineStateKey = getShoppingLineStateKey;
  window.setShoppingAtHome = setShoppingAtHome;
  window.organiseShoppingAtHomeRows = organiseShoppingAtHomeRows;
  window.groupShoppingAllocationsByMeal = groupShoppingAllocationsByMeal;
  window.renderShoppingMealAllocationRows = renderShoppingMealAllocationRows;
  window.getSelectedShoppingTargets = getSelectedShoppingTargets;
  window.updateShoppingBatchToolbar = updateShoppingBatchToolbar;
  window.selectAllShoppingRows = selectAllShoppingRows;
  window.refreshShoppingAfterBatch = refreshShoppingAfterBatch;
  window.applyShoppingBatchTargets = applyShoppingBatchTargets;
  window.openBatchSubstituteFromSelection = openBatchSubstituteFromSelection;
  window.confirmRemoveShoppingBatch = confirmRemoveShoppingBatch;
  window.getSubstitutionSuggestionProducts = getSubstitutionSuggestionProducts;
  window.renderSubstitutionDropdown = renderSubstitutionDropdown;
  window.renderShopping = renderShopping;
  window.readableHerbQuantity = readableHerbQuantity;
  window.buildHerbConversion = buildHerbConversion;
  window.renderHerbConversionPreview = renderHerbConversionPreview;
  window.collectCurrentShoppingProducts = collectCurrentShoppingProducts;
  window.openSubstituteModalForTargets = openSubstituteModalForTargets;
  window.openSubstituteModal = openSubstituteModal;
  window.closeSubstituteModal = closeSubstituteModal;
  window.handleSubstSearch = handleSubstSearch;
  window.selectSubstItem = selectSubstItem;
  window.confirmSubstitute = confirmSubstitute;
  window.removeSubstitute = removeSubstitute;
  window.removeShoppingIngredient = removeShoppingIngredient;
  window.confirmShoppingList = confirmShoppingList;
}
