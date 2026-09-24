/**
 * scripts/features/ingredient-bank.js
 * PlatePlan Ingredient Bank & Mapping Engine
 * Classic global namespace feature module.
 */

(() => {
// Safe state accessor fallback
const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

// Safe local fallbacks for core helpers
var ensureIngredientGroups = (...args) => (window.ensureIngredientGroups || window.PlatePlanState?.ensureIngredientGroups || (() => []))(...args);
var ensureIngredientFamilies = (...args) => (window.ensureIngredientFamilies || window.PlatePlanState?.ensureIngredientFamilies || (() => []))(...args);
var canonicalGroupKey = (...args) => (window.canonicalGroupKey || window.PlatePlanIngredients?.canonicalGroupKey || (s => String(s || '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()))(...args);
var canonicalGroupNameFromProduct = (...args) => (window.canonicalGroupNameFromProduct || window.PlatePlanIngredients?.canonicalGroupNameFromProduct || (p => p?.name || ''))(...args);
var CAT = (typeof window !== 'undefined' && window.CAT) || (typeof CAT !== 'undefined' ? CAT : {});

function groupIsHiddenDefaultType(group) {
  if (!group) return false;
  if (group.hiddenDefault || group.isDefault) return true;
  const fam = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(group) : null;
  if (fam && canonicalGroupKey(fam.name) === canonicalGroupKey(group.name)) return true;
  return false;
}

function getKnownFamilies() {
  const s = getState();
  const names = new Set();
  (s.ingredientFamilies || []).forEach(f => {
    if (f?.name) names.add(f.name);
  });
  (s.ingredientGroups || []).forEach(g => {
    if (g?.family) names.add(g.family);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function getProductProteinPer100Kcal(product) {
  if (!product) return 0;
  const cal = parseFloat(product.cal) || 0;
  const prot = parseFloat(product.prot) || 0;
  if (cal <= 0) return 0;
  return (prot / cal) * 100;
}

function familyKey(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getProductFamily(product) {
  if (!product) return 'Other';
  if (product.groupId) {
    const group = typeof getIngredientGroup === 'function' ? getIngredientGroup(product.groupId) : null;
    if (group) {
      if (group.family) return group.family;
      const fam = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(group) : null;
      if (fam?.name) return fam.name;
    }
  }
  if (product.family) return product.family;
  if (product.familyId || product.ingredientId) {
    const fam = typeof getIngredientFamily === 'function' ? getIngredientFamily(product.familyId || product.ingredientId) : null;
    if (fam?.name) return fam.name;
  }
  const inferred = typeof inferIngredientFamilyFromText === 'function' ? inferIngredientFamilyFromText(product.name) : '';
  return inferred || product.name || 'Other';
}

// Module filter and state variables (hoisted to avoid TDZ)
var activeCat = 'all';
var activeFamily = 'all';
var productBankGroupFilterId = null;
var productBankFamilyFilterId = null;
var productBankFamilySearchText = '';
var ingredientSubTypesOpenIds = new Set();
var ingredientSubTypesKeepOpenId = null;
var herbConversionFamilyId = null;
var productDefaultPickerContext = null;
var ingredientToSubTypeSourceId = null;
var ingredientFamilyDetailsId = null;
var ingredientFamilyDetailsCreate = false;
var ingredientEditorOrigin = null;
var ingredientFamilyMergeSourceId = null;
var ingredientFamilyMergeTargetId = null;
var ingredientFamilyMergeTargetKind = 'family';
var ingredientGroupPickerContext = null;
var ingredientGroupPickerMode = 'type';
var activeReallocationProductId = null;
var familyPickerGroupId = null;
var familyRenameOriginal = '';
var ingredientGroupDetailsEditId = null;
var ingredientGroupDetailsMode = 'name';
var ingredientGroupDetailsFamilyId = null;
var ingredientGroupMergeSourceId = null;
var ingredientGroupMergeTargetId = null;
var ingredientGroupMergeTargetKind = 'group';
var deleteIngredientGroupId = null;
var pendingAliasSuggestion = null;
var currentTescoImportData = null;
var currentTescoImportPayloadCache = '';
var appConfirmAction = null;
var appConfirmCancelAction = null;
var appPromptAction = null;
var appPromptCancelAction = null;
var _replaceCtx = null;

// == HELPER FUNCTIONS FOR PRODUCT PACK FORMATTING ==
function formatProductPackSummary(product) {
  if (!product) return '';
  const size = product.packSize ?? '';
  const unit = product.packUnit || 'g';
  const itemWeight = product.itemWeight;
  const itemWeightUnit = product.itemWeightUnit || 'g';
  const drainedWeight = product.drainedWeight;
  const drainedWeightUnit = product.drainedWeightUnit || 'g';
  
  let base = size !== '' && size !== null && size !== undefined ? `${size}${unit}` : '';
  const parts = [];
  if (base) parts.push(base);
  if (drainedWeight && +drainedWeight > 0) {
    parts.push(`drained: ${drainedWeight}${drainedWeightUnit}`);
  }
  if (itemWeight && +itemWeight > 0) {
    parts.push(`1 item: ${itemWeight}${itemWeightUnit}`);
  }
  return parts.join(' · ') || `${size || ''}${unit || ''}`.trim();
}
if (typeof window !== 'undefined') window.formatProductPackSummary = formatProductPackSummary;

function formatPackDisplay(size, unit = 'g', itemWeight = null) {
  if (!size && size !== 0) return '';
  const u = unit || 'g';
  if (itemWeight && +itemWeight > 0 && u !== 'g' && u !== 'ml') {
    return `${size}${u} (${itemWeight}g/item)`;
  }
  return `${size}${u}`;
}
if (typeof window !== 'undefined') window.formatPackDisplay = formatPackDisplay;

// == TYPE-AHEAD SEARCH MAPPING ==


function handleMapFocus(idx) {
    renderMapDropdown(idx, document.getElementById(`map-search-${idx}`).value);
}

function handleMapSearch(e, idx) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    searchTimeout = setTimeout(() => {
        renderMapDropdown(idx, query);
        mappingContext.ings[idx].groupId = "";
        mappingContext.ings[idx].bankId = "";
        mappingContext.ings[idx].ingredientId = "";
        mappingContext.ings[idx].mappedViaIngredient = false;
        const editBtn = document.getElementById(`edit-btn-${idx}`);
        if(editBtn) editBtn.style.display = 'none';
        const mapRow = document.getElementById(`map-row-${idx}`);
        if(mapRow) mapRow.classList.add('error');
    }, 150);
}

function renderMapDropdown(idx, query) {
    const drop = document.getElementById(`map-dropdown-${idx}`);
    ensureIngredientGroups();
    const variants = getSearchVariants(query || '');
    let productRows = [];
    let familyRows = [];
    if(variants.length) {
      productRows = (state.ingredients || []).filter(p => {
        if(!isUsableProduct(p)) return false;
        const hay = [p.name, p.brand, CAT[p.cat] || p.cat].join(' ').toLowerCase();
        return variants.some(q => hay.includes(q));
      }).sort((a,b) => {
        const strat = getAutoMappingStrategy();
        return scoreProductByPriority(b, strat) - scoreProductByPriority(a, strat);
      }).slice(0, 6);

      familyRows = (state.ingredientFamilies || []).filter(f => {
        const hay = [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].join(' ').toLowerCase();
        return variants.some(q => hay.includes(q));
      }).slice(0, 6);
    }
    let list = state.ingredientGroups || [];
    
    if(query) {
        list = list.filter(g => variants.some(q => getIngredientGroupSearchText(g).includes(q)));
    }
    
    list.sort((a,b) => {
        const pa = resolveProductForIngredient({ groupId:a.id }).product || {};
        const pb = resolveProductForIngredient({ groupId:b.id }).product || {};
        const effA = (pa.cal > 0) ? (pa.prot / pa.cal) : 0;
        const effB = (pb.cal > 0) ? (pb.prot / pb.cal) : 0;
        if(Math.abs(effA - effB) > 0.001) return effB - effA;
        return getGroupDisplayName(a).localeCompare(getGroupDisplayName(b));
    });

    if(list.length === 0 && familyRows.length === 0 && productRows.length === 0) {
        drop.innerHTML = `<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No matching products, ingredients or sub-types found.</div>`;
    } else {
        const productHtml = productRows.map(p => {
          const packStr = p.packSize ? `${p.packSize}${p.packUnit || 'g'}` : '';
          const priceStr = p.price > 0 ? `£${(+p.price).toFixed(2)}` : '';
          return `
            <div class="map-drop-item" onclick="selectMapProductItem(${idx}, '${ppEscapeAttr(p.id)}')">
                <div style="font-weight:600;font-size:13px">${ppEscapeHtml(p.name)} ${p.brand && p.brand !== 'Generic' ? `(${ppEscapeHtml(p.brand)})` : ''}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px">Product · ${ppEscapeHtml(CAT[p.cat] || p.cat || 'Other')}</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px">${p.prot || 0}g P | ${p.cal || 0} kcal${packStr ? ` | ${packStr}` : ''}${priceStr ? ` | ${priceStr}` : ''}</div>
            </div>
          `;
        }).join('');
        const familyHtml = familyRows.map(f => {
          const bestProduct = selectBestProductForIngredientFamily(f.id, 'protein_per_kcal');
          const bestGroup = bestProduct?.groupId ? getIngredientGroup(bestProduct.groupId) : null;
          return `
            <div class="map-drop-item" onclick="selectMapIngredientDefault(${idx}, '${f.id}')">
                <div class="row-between" style="gap:8px;align-items:flex-start">
                  <div style="min-width:0">
                    <div style="font-weight:700;font-size:13px">${ppEscapeHtml(f.name)}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')} > Ingredient</div>
                    <div style="font-size:11px;color:var(--text2);margin-top:2px">Uses best protein-per-kcal product${bestProduct ? `: ${ppEscapeHtml(bestProduct.name)}${bestGroup ? ` (${ppEscapeHtml(getGroupTypeName(bestGroup))})` : ''}` : ' when available'}</div>
                  </div>
                  <button type="button" class="btn sm ghost" style="padding:3px 6px;font-size:10px;white-space:nowrap" onclick="event.stopPropagation(); selectMapIngredientFamily(${idx}, '${f.id}')">Choose sub-type</button>
                </div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'} available</div>
            </div>`;
        }).join('');
        const typeHtml = list.slice(0,15).map(g => {
          const p = resolveProductForIngredient({ groupId:g.id }).product || {};
          return `
            <div class="map-drop-item" onclick="selectMapItem(${idx}, '${g.id}')">
                <div style="font-weight:600;font-size:13px">${ppEscapeHtml(getGroupDisplayName(g))}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px">Default: ${p.name || 'No product'}${p.brand && p.brand !== 'Generic' ? ` (${p.brand})` : ''} | ${p.prot || 0}g P | ${p.cal || 0} kcal</div>
            </div>
          `;
        }).join('');
        drop.innerHTML = productHtml + familyHtml + typeHtml;
    }
    drop.style.display = 'block';
}

function selectMapProductItem(idx, productId) {
    const p = getProduct(productId);
    if (!p) return;
    const ing = mappingContext?.ings?.[idx];
    if (!ing) return;
    ing.bankId = p.id;
    ing.groupId = p.groupId || '';
    ing.ingredientId = '';
    ing.mappedViaIngredient = false;
    const inp = document.getElementById(`map-search-${idx}`);
    if (inp) inp.value = `${p.name}${p.brand && p.brand !== 'Generic' ? ` (${p.brand})` : ''}`;
    const drop = document.getElementById(`map-dropdown-${idx}`);
    if (drop) drop.style.display = 'none';
    const row = document.getElementById(`map-row-${idx}`);
    if (row) row.classList.remove('error');
    const editBtn = document.getElementById(`edit-btn-${idx}`);
    if (editBtn) editBtn.style.display = 'inline-block';
}
window.selectMapProductItem = selectMapProductItem;

function selectMapIngredientFamily(idx, familyId){
  const family = getIngredientFamily(familyId);
  const drop = document.getElementById(`map-dropdown-${idx}`);
  const groups = getFamilyGroups(familyId);
  if(!family || !groups.length) return;
  if(groups.length === 1) {
    selectMapIngredientDefault(idx, familyId);
    return;
  }
  const bestProduct = selectBestProductForIngredientFamily(familyId, 'protein_per_kcal');
  const defaultGroup = (bestProduct?.groupId ? getIngredientGroup(bestProduct.groupId) : null) || getIngredientGroup(family.defaultTypeId) || groups[0];
  const defaultProduct = bestProduct || resolveProductForIngredient({ groupId: defaultGroup.id }).product || {};
  const defaultHtml = `<div class="map-drop-item" onclick="selectMapIngredientDefault(${idx}, '${family.id}')">
      <div style="font-weight:700;font-size:13px">Use Ingredient: ${ppEscapeHtml(family.name)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(CAT[family.cat] || family.cat || 'Other')} > ${ppEscapeHtml(family.name)} > ${ppEscapeHtml(getGroupTypeName(defaultGroup))}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">Uses best protein-per-kcal product: ${ppEscapeHtml(defaultProduct.name || 'No product')} | ${round1(defaultProduct.prot || 0)}g P | ${Math.round(defaultProduct.cal || 0)} kcal</div>
    </div>
    <div style="padding:7px 12px 4px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text3);border-top:1px solid var(--border);">Choose Sub-type</div>`;
  drop.innerHTML = defaultHtml + groups.map(g => {
    const p = resolveProductForIngredient({ groupId:g.id }).product || {};
    return `<div class="map-drop-item" onclick="selectMapItem(${idx}, '${g.id}')">
      <div style="font-weight:600;font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')} > ${ppEscapeHtml(family.name)}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">Default: ${p.name || 'No product'} | ${p.prot || 0}g P | ${p.cal || 0} kcal</div>
    </div>`;
  }).join('');
  drop.style.display = 'block';
}

function selectMapIngredientDefault(idx, familyId){
    const family = getIngredientFamily(familyId);
    const groups = getFamilyGroups(familyId);
    if(!family || !groups.length) return;
    const bestProduct = selectBestProductForIngredientFamily(familyId, 'protein_per_kcal');
    const defaultGroup = (bestProduct?.groupId ? getIngredientGroup(bestProduct.groupId) : null) || getIngredientGroup(family.defaultTypeId) || groups[0];
    if(!defaultGroup) return;
    const product = bestProduct || resolveProductForIngredient({ groupId: defaultGroup.id }).product;
    const ing = mappingContext.ings[idx];
    ing.ingredientId = family.id;
    ing.mappedViaIngredient = true;
    ing.groupId = defaultGroup.id;
    ing.bankId = product?.id || "";
    const inp = document.getElementById(`map-search-${idx}`);
    if(inp) inp.value = family.name;
    const drop = document.getElementById(`map-dropdown-${idx}`);
    if(drop) drop.style.display = 'none';
    const row = document.getElementById(`map-row-${idx}`);
    if(row) row.classList.remove('error');
    const editBtn = document.getElementById(`edit-btn-${idx}`);
    if(editBtn) editBtn.style.display = product ? 'inline-block' : 'none';
    maybeSuggestIngredientAlias(idx, defaultGroup.id);
}



function recipeIngredientAliasCandidate(ing){
  const candidate = normaliseAliasText(ing?.name || '');
  if(candidate && canonicalGroupKey(candidate)) return candidate;
  return normaliseAliasText(String(ing?.raw || '').replace(/^\s*[-*•\d.)\[\]☐□]+\s*/, '').replace(/^\d+(?:\.\d+)?\s*\w+\s+/,''));
}

function maybeSuggestIngredientAlias(idx, groupId){
  const group = getIngredientGroup(groupId);
  const ing = mappingContext?.ings?.[idx];
  if(!group || !ing) return;
  const alias = recipeIngredientAliasCandidate(ing);
  if(!alias) return;
  const aliasKey = canonicalGroupKey(alias);
  if(ing.mappedViaIngredient && ing.ingredientId) {
    const family = getIngredientFamily(ing.ingredientId);
    if(!family || !aliasKey || aliasKey === canonicalGroupKey(family.name)) return;
    if((family.aliases || []).some(a => canonicalGroupKey(a) === aliasKey)) return;
    pendingAliasSuggestion = { idx, familyId: family.id, alias, target: 'ingredient' };
    openIngredientAliasSuggestionModal();
    return;
  }
  if(!aliasKey || aliasKey === canonicalGroupKey(group.name)) return;
  if((group.aliases || []).some(a => canonicalGroupKey(a) === aliasKey)) return;
  pendingAliasSuggestion = { idx, groupId, alias, target: 'subtype' };
  openIngredientAliasSuggestionModal();
}

function ensureIngredientAliasSuggestionModal(){
  let wrap = document.getElementById('ingredient-alias-suggestion-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'ingredient-alias-suggestion-wrap';
  wrap.className = 'modal-wrap sheet-mobile';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Add alias?</h3>
        <button class="btn sm ghost" onclick="closeIngredientAliasSuggestionModal()">Close</button>
      </div>
      <div id="ingredient-alias-suggestion-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
      <div class="btn-row">
        <button class="btn primary" onclick="confirmIngredientAliasSuggestion()">Add alias</button>
        <button class="btn ghost" onclick="closeIngredientAliasSuggestionModal()">Not now</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openIngredientAliasSuggestionModal(){
  const wrap = ensureIngredientAliasSuggestionModal();
  if(!pendingAliasSuggestion) return;
  const family = getIngredientFamily(pendingAliasSuggestion.familyId);
  const group = getIngredientGroup(pendingAliasSuggestion.groupId);
  if(!family && !group) return;
  const targetName = family ? family.name : getGroupTypeName(group);
  const targetLabel = family ? 'ingredient' : 'sub-type';
  document.getElementById('ingredient-alias-suggestion-copy').innerHTML =
    `Use <strong>${ppEscapeHtml(pendingAliasSuggestion.alias)}</strong> as another recognised name for the ${targetLabel} <strong>${ppEscapeHtml(targetName)}</strong>?`;
  wrap.classList.add('open');
}

function closeIngredientAliasSuggestionModal(){
  const wrap = document.getElementById('ingredient-alias-suggestion-wrap');
  if(wrap) wrap.classList.remove('open');
  pendingAliasSuggestion = null;
}

function confirmIngredientAliasSuggestion(){
  const family = getIngredientFamily(pendingAliasSuggestion?.familyId);
  const group = getIngredientGroup(pendingAliasSuggestion?.groupId);
  if(pendingAliasSuggestion?.alias){
    if(family) addIngredientFamilyAlias(family, pendingAliasSuggestion.alias);
    else if(group) addIngredientGroupAlias(group, pendingAliasSuggestion.alias);
    saveState();
    renderIngredientBank();
    renderBank();
  }
  closeIngredientAliasSuggestionModal();
}

function selectMapItem(idx, groupId) {
    const group = getIngredientGroup(groupId);
    if(!group) return;
    const product = resolveProductForIngredient({ groupId }).product;
    mappingContext.ings[idx].groupId = groupId;
    mappingContext.ings[idx].bankId = product?.id || "";
    mappingContext.ings[idx].ingredientId = "";
    mappingContext.ings[idx].mappedViaIngredient = false;
    const inp = document.getElementById(`map-search-${idx}`);
    if(inp) inp.value = getGroupTypeName(group);
    const drop = document.getElementById(`map-dropdown-${idx}`);
    if(drop) drop.style.display = 'none';
    const row = document.getElementById(`map-row-${idx}`);
    if(row) row.classList.remove('error');
    const editBtn = document.getElementById(`edit-btn-${idx}`);
    if(editBtn) editBtn.style.display = product ? 'inline-block' : 'none';
    maybeSuggestIngredientAlias(idx, groupId);
}

async function continueToMatch(parsedIngs, methodSteps) {
  const name=document.getElementById('r-name').value.trim();
  const serves=parseInt(document.getElementById('r-serves').value)||2;
  const types=getMealTypes();

  showOverlay('Analysing recipe...','Matching against bank');

  // Load previous mappings for persistence
  const savedMappings = window.currentEditMap || {};
  const savedGroupMappings = window.currentEditGroupMap || {};
  const savedIngredientMeta = window.currentEditIngredientMeta || {};

  for(const ing of parsedIngs){
    if (savedGroupMappings[ing.raw]) {
        ing.groupId = savedGroupMappings[ing.raw];
        const product = resolveProductForIngredient(ing).product;
        ing.bankId = product?.id || savedMappings[ing.raw] || "";
    } else if (savedMappings[ing.raw]) {
        ing.bankId = savedMappings[ing.raw];
        const product = getProduct(ing.bankId);
        if(product?.groupId) ing.groupId = product.groupId;
    } else {
        const groupMatch=fuzzyMatchIngredientGroup(ing.name);
        if(groupMatch){
          ing.groupId=groupMatch.id;
          ing.bankId=resolveProductForIngredient(ing).product?.id || "";
        } else {
          const bankMatch=fuzzyMatchBank(ing.name);
          if(bankMatch){
            ing.bankId=bankMatch.id;
            ing.groupId=bankMatch.groupId || "";
          } else {
            ing.bankId = "";
            ing.groupId = "";
          }
        }
    }
    if(savedIngredientMeta[ing.raw]?.excludeNutrition) {
        ing.excludeNutrition = true;
    }
    if(savedIngredientMeta[ing.raw]?.section && !ing.section) {
        ing.section = savedIngredientMeta[ing.raw].section;
    }
    if(savedIngredientMeta[ing.raw]?.ingredientId) {
        ing.ingredientId = savedIngredientMeta[ing.raw].ingredientId;
        ing.mappedViaIngredient = !!savedIngredientMeta[ing.raw].mappedViaIngredient;
    }
  }

  mappingContext = {
      name, serves, types, 
      ings: parsedIngs, 
      methodSteps, 
      ingsText: parsedIngs.map(i => i.raw).join('\n'),
      activeIndex: null
  };
  
    openMappingModal();
  hideOverlay();
}

function openMappingModal() {
    renderMappingList();
    document.getElementById('mapping-msg').innerHTML = '';
    document.getElementById('mapping-modal-wrap').classList.add('open');
    updateBatchUiBanners();
}

function renderMappingList() {
    const listEl = document.getElementById('mapping-list');
    
    let html = mappingContext.ings.map((ing, idx) => {
        let displayVal = "";
        let hasBankId = false;
        const groupId = ing.groupId || getRecipeIngredientGroupId(ing);
        if(groupId) {
            const g = getIngredientGroup(groupId);
            const p = resolveProductForIngredient({ ...ing, groupId }).product;
            if(g) {
                const family = ing.ingredientId ? getIngredientFamily(ing.ingredientId) : null;
                displayVal = ing.mappedViaIngredient && family ? family.name : getGroupTypeName(g);
                hasBankId = true;
                ing.groupId = groupId;
                ing.bankId = p?.id || ing.bankId || "";
            }
        }
        if(!hasBankId && ing.bankId) {
            const b = state.ingredients.find(x => x.id === ing.bankId);
            if(b) {
                displayVal = `${b.name} ${b.brand && b.brand !== 'Generic' ? `(${b.brand})` : ''}`;
                hasBankId = true;
            }
        }

        return `
        <div class="mapping-row ${hasBankId ? '' : 'error'}" id="map-row-${idx}">
           <div style="flex:1; font-size:13px;"><strong>${ing.raw}</strong>${ing.excludeNutrition ? ' <span class="tag">not counted</span>' : ''}</div>
           <div class="mapping-search-container" style="position:relative; flex:2;">
               <input type="text" class="map-search-input" id="map-search-${idx}" autocomplete="off" placeholder="Search to map ingredient..." value="${displayVal.replace(/"/g, '&quot;')}" oninput="handleMapSearch(event, ${idx})" onfocus="handleMapFocus(${idx})">
               <div class="map-dropdown" id="map-dropdown-${idx}" style="display:none;"></div>
           </div>
           <button class="btn sm ghost" onclick="editIng('${ing.bankId || ''}')" id="edit-btn-${idx}" style="display:${ing.bankId ? 'inline-block' : 'none'}">Edit default</button>
           <button class="btn sm ghost" onclick="openMiniAdd(${idx})">+ New</button>
           <button class="btn sm ghost" style="color:var(--purple); border-color:var(--purple);" onclick="openTescoImportFromMap(${idx}, '${ing.name.replace(/'/g,"\\'")}')">🛒 Import</button>
        </div>`;
    }).join('');
    
    listEl.innerHTML = html;
}

function openMiniAdd(index) {
    mappingContext.activeIndex = index;
    currentMiniEditId = null;
    const ing = mappingContext.ings[index];
    
    document.getElementById('mini-ing-title').innerText = 'Create New Ingredient';
    document.getElementById('mini-name').value = ing.name || '';
    document.getElementById('mini-brand').value = '';
    document.getElementById('mini-cat').value = 'other';
    enhanceCategorySearch('mini-cat');
    syncCategorySearchInput('mini-cat');
    document.getElementById('mini-storage').value = '';
    document.getElementById('mini-cal').value = '';
    document.getElementById('mini-fat').value = '';
    document.getElementById('mini-carb').value = '';
    document.getElementById('mini-fibre').value = '';
    document.getElementById('mini-prot').value = '';
    document.getElementById('mini-price').value = '';
    document.getElementById('mini-pack').value = 100;
    document.getElementById('mini-pack-unit').value = 'g';
    document.getElementById('mini-item-weight').value = '';
    
    document.getElementById('mini-msg').innerHTML = '<div class="msg info">Add bank data here so PlatePlan can calculate nutrition without estimates.</div>';
    document.getElementById('mini-ing-wrap').classList.add('open');
}

function openMiniEdit(index) {
    mappingContext.activeIndex = index;
    const bankId = mappingContext.ings[index].bankId;
    if(!bankId) return;
    
    const ing = state.ingredients.find(i=>i.id === bankId);
    if(!ing) return;

    currentMiniEditId = ing.id;
    document.getElementById('mini-ing-title').innerText = 'Edit Mapped Ingredient';
    document.getElementById('mini-name').value = ing.name || '';
    document.getElementById('mini-brand').value = ing.brand || '';
    document.getElementById('mini-cat').value = CAT[ing.cat] ? ing.cat : 'other';
    enhanceCategorySearch('mini-cat');
    syncCategorySearchInput('mini-cat');
    document.getElementById('mini-storage').value = ing.storage || '';
    document.getElementById('mini-cal').value = ing.cal || '';
    document.getElementById('mini-fat').value = ing.fat || '';
    document.getElementById('mini-carb').value = ing.carb || '';
    document.getElementById('mini-fibre').value = ing.fibre || '';
    document.getElementById('mini-prot').value = ing.prot || '';
    document.getElementById('mini-price').value = ing.price || '';
    document.getElementById('mini-pack').value = ing.packSize || '';
    document.getElementById('mini-pack-unit').value = ing.packUnit || 'g';
    document.getElementById('mini-item-weight').value = ing.itemWeight || '';
    
    document.getElementById('mini-msg').innerHTML = '';
    document.getElementById('mini-ing-wrap').classList.add('open');
}

function saveMiniIng() {
    const name = document.getElementById('mini-name').value.trim();
    if(!name) return showMsg('mini-msg', 'Please enter a name.', 'error');
    
    const nowIso = new Date().toISOString();
    const existingIng = currentMiniEditId ? state.ingredients.find(x=>x.id===currentMiniEditId) : null;
    const newIng = {
        id: currentMiniEditId || ('ing' + Date.now()),
        name,
        brand: document.getElementById('mini-brand').value.trim(),
        cat: document.getElementById('mini-cat').value,
        storage: document.getElementById('mini-storage').value,
        cal: +document.getElementById('mini-cal').value||0,
        fat: +document.getElementById('mini-fat').value||0,
        carb: +document.getElementById('mini-carb').value||0,
        fibre: +document.getElementById('mini-fibre').value||0,
        prot: +document.getElementById('mini-prot').value||0,
        price: +document.getElementById('mini-price').value||null,
        packSize: +document.getElementById('mini-pack').value||null,
        packUnit: document.getElementById('mini-pack-unit').value||'g',
        itemWeight: +document.getElementById('mini-item-weight').value||null,
        groupId: existingIng ? (existingIng.groupId || '') : '',
        packOptions: existingIng ? (existingIng.packOptions || []) : [],
        notes: '',
        updatedAt: nowIso
    };
    
    if(currentMiniEditId) {
        const idx = state.ingredients.findIndex(x => x.id === currentMiniEditId);
        if(idx > -1) state.ingredients[idx] = newIng;
        if (typeof persistProductToBank === 'function') persistProductToBank(newIng);
        else saveIngredient(newIng);
    } else {
        if (typeof persistProductToBank === 'function') {
            persistProductToBank(newIng);
        } else {
            state.ingredients.push(newIng);
            saveIngredient(newIng);
        }
    }
    const group = ensureProductAssignedToGroup(newIng, mappingContext?.ings?.[mappingContext?.activeIndex]?.name || name, '', true);
    if(group) group.updatedAt = nowIso;
    refreshProductGroupAndRecipes(newIng.id);
    
    saveIngredient(newIng);
    saveState(true);
    renderBank(); 
    if(document.getElementById('view-data')?.classList.contains('active')) renderDataQuality();
    
    if(mappingContext?.ings && mappingContext.activeIndex !== undefined && mappingContext.ings[mappingContext.activeIndex]){
      mappingContext.ings[mappingContext.activeIndex].bankId = newIng.id;
      mappingContext.ings[mappingContext.activeIndex].groupId = group?.id || newIng.groupId || "";
    }

    if(activeUnifiedMappingContext){
      applyUnifiedMappingResult(activeUnifiedMappingContext, {
        productId: newIng.id,
        groupId: group?.id || newIng.groupId || '',
        productName: newIng.name,
        brand: newIng.brand
      });
    }

    document.getElementById('mini-ing-wrap').classList.remove('open');
    if(mappingContext) renderMappingList();
}

function confirmMapping() {
    let hasError = false;
    document.querySelectorAll('.mapping-row').forEach((row, idx) => {
        if(!mappingContext.ings[idx].groupId && !mappingContext.ings[idx].bankId) {
            row.classList.add('error');
            hasError = true;
        } else {
            row.classList.remove('error');
        }
    });
    
    if(hasError) {
        showMsg('mapping-msg', 'Please map all ingredients before calculating.', 'error');
        return;
    }
    
    document.getElementById('mapping-modal-wrap').classList.remove('open');
    
    const methodText = mappingContext.methodSteps.join('\n');
    continueAfterResolve(
        mappingContext.name, 
        mappingContext.ings, 
        mappingContext.serves, 
        mappingContext.types, 
        methodText, 
        mappingContext.ingsText
    );
}

// == CONTINUE POST-MAPPING ==
async function continueAfterResolve(name,allIngs,serves,types,method,ingsText,skipNutritionGate=false){
  if(!skipNutritionGate){
    const blockers = findRecipeNutritionBlockers(allIngs);
    if(blockers.length){
      pendingRecipeNutritionFix = {
        args: { name, allIngs, serves, types, method, ingsText },
        blockers
      };
      showIngredientNutritionFixPrompt(blockers[0]);
      return;
    }
  }

  showOverlay('Calculating nutrition...','Using ingredient bank data');

  const nutrition = calcRecipeNutrition(allIngs, serves);
  const ps = nutrition.perServing; // always use perServing for portions and display
  const who = document.getElementById('r-who') ? document.getElementById('r-who').value : 'both';
  const portions = calcPortions(ps, state.prefs, serves, who, (types&&types[0])||'dinner');

  const result = buildBankCalculatedResult(name, allIngs, method, nutrition, portions, types);

  hideOverlay();
  openModal(name, result, true);
}

function buildBankCalculatedResult(name,allIngs,method,nutrition,portions,types=[]){
  const ps = nutrition.perServing;
  const existing = editId ? (state?.recipes || []).find(x => x.id === editId) : null;
  return{
    original:{
      types: Array.isArray(types) && types.length ? types : (Array.isArray(mappingContext?.types) ? mappingContext.types : getMealTypes()),
      ingredients:allIngs,
      method:method.split('\n').filter(Boolean),
      ...ps,
      nutrition:{total:nutrition.totalNutrition,perServing:ps},
      portionE:portions.e,portionC:portions.c,
      bankCalculated:true
    },
    enhanced: existing?.enhanced ? JSON.parse(JSON.stringify(existing.enhanced)) : null
  };
}


function openSubtypeResolutionModal(subTypeId, issueKey = ''){
    if (issueKey) {
      const section = document.querySelector(`[data-dq-key="${CSS.escape(issueKey)}"]`)?.closest('details');
      editorNavigationStack.push({ view: 'data', issueKey, scrollY: window.scrollY, sectionOpen: !!section?.open, openedAt: Date.now() });
    }
    const group = getIngredientGroup(subTypeId);
    const subTypeName = group ? (group.name || getGroupTypeName(group)) : (subTypeId || '');

    let modal = document.getElementById('subtype-resolution-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'subtype-resolution-modal';
      document.body.appendChild(modal);
    }
    modal.className = 'modal active';
    modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;padding:16px;';
    
    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:540px;padding:24px;border-radius:14px;background:var(--surface,#fff);box-shadow:0 12px 36px rgba(0,0,0,0.25);position:relative;max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px">
          <div>
            <h2 style="font-size:18px;font-weight:700;margin:0;color:var(--text)">Resolve Unlinked Sub-type</h2>
            <div style="font-size:13px;color:var(--text2);margin-top:4px">
              Sub-type: <strong style="color:var(--text)">${ppEscapeHtml(subTypeName)}</strong>
            </div>
          </div>
          <button type="button" class="btn sm ghost" style="padding:4px 8px;font-size:16px;line-height:1" onclick="closeSubtypeResolutionModal()" title="Close">✕</button>
        </div>

        <p style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:18px">
          This sub-type currently has no linked products in your catalog. Choose one of the 3 resolution paths:
        </p>

        <div style="display:flex;flex-direction:column;gap:12px">
          <!-- 1. Link Existing Product -->
          <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2)">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);display:flex;align-items:center;gap:6px">
              <span>🔗 1. Link Existing Product</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:10px">
              Search your Product Bank and assign an existing product to this sub-type.
            </div>
            <input type="search" id="subtype-link-search" class="input" placeholder="Search product by name or brand..." style="font-size:13px;padding:8px 12px;width:100%;border-radius:8px;box-sizing:border-box" oninput="filterSubtypeLinkProducts(this.value, '${ppEscapeAttr(subTypeId)}')">
            <div id="subtype-link-results" style="margin-top:8px;max-height:160px;overflow-y:auto;display:none;border:1px solid var(--border);border-radius:8px;background:var(--surface)"></div>
          </div>

          <!-- 2. Import from Tesco -->
          <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);cursor:pointer;transition:border-color 0.15s ease" onclick="resolveSubtypeViaTesco('${ppEscapeAttr(subTypeId)}')" onmouseover="this.style.borderColor='var(--action)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);display:flex;align-items:center;justify-content:space-between">
              <span>🛒 2. Import from Tesco</span>
              <span class="btn sm primary" style="pointer-events:none;font-size:12px">Paste Bookmarklet JSON →</span>
            </div>
            <div style="font-size:12px;color:var(--text2)">
              Paste output from the Tesco product bookmarklet to automatically extract title, brand, nutrition, price, and pack weight.
            </div>
          </div>

          <!-- 3. Create New Product -->
          <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);cursor:pointer;transition:border-color 0.15s ease" onclick="resolveSubtypeViaManual('${ppEscapeAttr(subTypeId)}')" onmouseover="this.style.borderColor='var(--action)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--text);display:flex;align-items:center;justify-content:space-between">
              <span>✨ 3. Create New Product</span>
              <span class="btn sm ghost" style="pointer-events:none;font-size:12px">Blank Form →</span>
            </div>
            <div style="font-size:12px;color:var(--text2)">
              Open the full blank product creation form with this sub-type pre-assigned.
            </div>
          </div>
        </div>
      </div>
    `;
}

function closeSubtypeResolutionModal(){
    const modal = document.getElementById('subtype-resolution-modal');
    if (modal) modal.style.display = 'none';
}



function openTescoJsonImportModal(subTypeId) {
    closeSubtypeResolutionModal();
    let modal = document.getElementById('tesco-json-import-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'tesco-json-import-modal';
      document.body.appendChild(modal);
    }
    modal.className = 'modal active';
    modal.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;padding:16px;';

    renderTescoJsonImportStep1(subTypeId);
}
window.openTescoJsonImportModal = openTescoJsonImportModal;

function renderTescoJsonImportStep1(subTypeId, initialPayload = '') {
    const modal = document.getElementById('tesco-json-import-modal');
    if (!modal) return;

    const group = getIngredientGroup(subTypeId);
    const subTypeName = group ? (group.name || getGroupTypeName(group)) : (subTypeId || '');
    const searchUrl = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(subTypeName)}`;

    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:580px;padding:24px;border-radius:14px;background:var(--surface,#fff);box-shadow:0 12px 36px rgba(0,0,0,0.25);position:relative;max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div>
            <h2 style="font-size:18px;font-weight:700;margin:0;color:var(--text)">Import from Tesco (Step 1 of 2)</h2>
            <div style="font-size:13px;color:var(--text2);margin-top:4px">
              Target Sub-type: <strong style="color:var(--text)">${ppEscapeHtml(subTypeName)}</strong>
            </div>
          </div>
          <button type="button" class="btn sm ghost" style="padding:4px 8px;font-size:16px;line-height:1" onclick="closeTescoJsonImportModal()" title="Close">✕</button>
        </div>

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="font-size:13px;color:var(--text)">
            Open Tesco.com, search for your item, copy the URL, and run your PlatePlan Bookmarklet:
          </div>
          <a href="${ppEscapeAttr(searchUrl)}" target="_blank" rel="noopener noreferrer" class="btn sm ghost" style="font-size:12px;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;text-decoration:none">
            🔍 Search "${ppEscapeHtml(subTypeName)}" on Tesco ↗
          </a>
        </div>

        <textarea id="tesco-json-payload" placeholder="Paste Tesco Bookmarklet JSON payload here..." style="width:100%;height:140px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);box-sizing:border-box;resize:vertical" autofocus>${ppEscapeHtml(initialPayload || currentTescoImportPayloadCache || '')}</textarea>
        
        <div id="tesco-json-error" style="display:none;color:var(--red,#dc2626);font-size:12px;margin-top:8px"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button type="button" class="btn ghost sm" onclick="closeTescoJsonImportModal()">Cancel</button>
          <button type="button" class="btn primary sm" style="font-weight:700" onclick="previewTescoJsonPayload('${ppEscapeAttr(subTypeId)}')">Parse JSON →</button>
        </div>
      </div>
    `;
}
window.renderTescoJsonImportStep1 = renderTescoJsonImportStep1;

function previewTescoJsonPayload(subTypeId) {
    const rawText = document.getElementById('tesco-json-payload')?.value?.trim();
    const errorEl = document.getElementById('tesco-json-error');
    if (!rawText) {
      if (errorEl) {
        errorEl.textContent = 'Please paste the Tesco JSON payload before proceeding.';
        errorEl.style.display = 'block';
      }
      return;
    }

    currentTescoImportPayloadCache = rawText;

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Invalid JSON syntax. Please verify the copied bookmarklet output.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const group = getIngredientGroup(subTypeId);
    const cat = group?.cat || 'other';

    let brand = toTitleCase((data.brand || '').trim());
    let name = data.title || data.name || data.productTitle || 'Tesco Product';
    if (brand && brand !== 'Generic') {
      let re = new RegExp('\\b' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig');
      name = name.replace(re, '').trim();
    }
    name = name.replace(/\s+(?:\d+\s*[x×]\s*)?\d+(?:\.\d+)?\s*(g|kg|ml|l|pack)$/i, '').trim();
    name = name.replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
    name = toTitleCase(name) || 'Tesco Product';

    currentTescoImportData = {
      id: data.id || ('ing' + Date.now()),
      name: name,
      brand: brand || 'Tesco',
      cat: cat,
      groupId: subTypeId,
      cal: parseFloat(data.cal || data.calories || data.kcal || data.energyKcal || 0) || 0,
      prot: parseFloat(data.prot || data.protein || data.proteinG || 0) || 0,
      fat: parseFloat(data.fat || data.fatG || 0) || 0,
      carb: parseFloat(data.carb || data.carbs || data.carbohydrate || data.carbG || 0) || 0,
      fibre: parseFloat(data.fibre || data.fiber || data.fibreG || 0) || 0,
      price: parseFloat(data.price || data.unitPrice || data.cost || 0) || 0,
      packSize: parseFloat(data.packSize || data.packageWeight || data.weight || data.size || 100) || 100,
      packUnit: String(data.packUnit || data.unit || 'g').toLowerCase(),
      photo: data.photo || data.img || data.image || data.imageUrl || '',
      tescoUrl: data.url || data.tescoUrl || ''
    };

    renderTescoJsonImportStep2(subTypeId);
}
window.previewTescoJsonPayload = previewTescoJsonPayload;

function renderTescoJsonImportStep2(subTypeId) {
    const modal = document.getElementById('tesco-json-import-modal');
    if (!modal || !currentTescoImportData) return;

    const group = getIngredientGroup(subTypeId);
    const subTypeName = group ? (group.name || getGroupTypeName(group)) : (subTypeId || '');
    const p = currentTescoImportData;

    modal.innerHTML = `
      <div class="card" style="width:100%;max-width:580px;padding:24px;border-radius:14px;background:var(--surface,#fff);box-shadow:0 12px 36px rgba(0,0,0,0.25);position:relative;max-height:90vh;overflow-y:auto">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px">
          <div>
            <h2 style="font-size:18px;font-weight:700;margin:0;color:var(--text)">Review Extracted Product (Step 2 of 2)</h2>
            <div style="font-size:13px;color:var(--text2);margin-top:4px">
              Target Sub-type: <strong style="color:var(--text)">${ppEscapeHtml(subTypeName)}</strong>
            </div>
          </div>
          <button type="button" class="btn sm ghost" style="padding:4px 8px;font-size:16px;line-height:1" onclick="closeTescoJsonImportModal()" title="Close">✕</button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text)">Product Name</label>
              <input type="text" id="tesco-edit-title" class="input" style="width:100%;box-sizing:border-box" value="${ppEscapeAttr(p.name)}" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text)">Brand</label>
              <input type="text" id="tesco-edit-brand" class="input" style="width:100%;box-sizing:border-box" value="${ppEscapeAttr(p.brand)}" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div>
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text)">Price (£)</label>
              <input type="number" step="0.01" id="tesco-edit-price" class="input" style="width:100%;box-sizing:border-box" value="${p.price}" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text)">Pack Size</label>
              <input type="number" step="1" id="tesco-edit-pack-size" class="input" style="width:100%;box-sizing:border-box" value="${p.packSize}" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:var(--text)">Unit</label>
              <select id="tesco-edit-pack-unit" class="input" style="width:100%;box-sizing:border-box">
                <option value="g" ${p.packUnit==='g'?'selected':''}>g</option>
                <option value="kg" ${p.packUnit==='kg'?'selected':''}>kg</option>
                <option value="ml" ${p.packUnit==='ml'?'selected':''}>ml</option>
                <option value="l" ${p.packUnit==='l'?'selected':''}>l</option>
                <option value="pack" ${p.packUnit==='pack'?'selected':''}>pack</option>
                <option value="item" ${p.packUnit==='item'?'selected':''}>item</option>
              </select>
            </div>
          </div>

          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text)">Nutrition per 100g / 100ml</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px">
              <div>
                <label style="display:block;font-size:11px;color:var(--text2);margin-bottom:2px">Calories (kcal)</label>
                <input type="number" step="0.1" id="tesco-edit-cal" class="input" style="width:100%;box-sizing:border-box;font-size:12px" value="${p.cal}" />
              </div>
              <div>
                <label style="display:block;font-size:11px;color:var(--text2);margin-bottom:2px">Protein (g)</label>
                <input type="number" step="0.1" id="tesco-edit-prot" class="input" style="width:100%;box-sizing:border-box;font-size:12px" value="${p.prot}" />
              </div>
              <div>
                <label style="display:block;font-size:11px;color:var(--text2);margin-bottom:2px">Carbs (g)</label>
                <input type="number" step="0.1" id="tesco-edit-carb" class="input" style="width:100%;box-sizing:border-box;font-size:12px" value="${p.carb}" />
              </div>
              <div>
                <label style="display:block;font-size:11px;color:var(--text2);margin-bottom:2px">Fat (g)</label>
                <input type="number" step="0.1" id="tesco-edit-fat" class="input" style="width:100%;box-sizing:border-box;font-size:12px" value="${p.fat}" />
              </div>
            </div>
          </div>
        </div>

        <div id="tesco-edit-error" style="display:none;color:var(--red,#dc2626);font-size:12px;margin-bottom:10px"></div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px">
          <button type="button" class="btn ghost sm" onclick="renderTescoJsonImportStep1('${ppEscapeAttr(subTypeId)}')">← Back</button>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn ghost sm" onclick="closeTescoJsonImportModal()">Cancel</button>
            <button type="button" class="btn primary sm" style="font-weight:700" onclick="confirmTescoProductImport('${ppEscapeAttr(subTypeId)}')">Confirm &amp; Link to Sub-type ✓</button>
          </div>
        </div>
      </div>
    `;
}
window.renderTescoJsonImportStep2 = renderTescoJsonImportStep2;

async function confirmTescoProductImport(subTypeId) {
    const title = document.getElementById('tesco-edit-title')?.value?.trim();
    const brand = document.getElementById('tesco-edit-brand')?.value?.trim();
    const price = parseFloat(document.getElementById('tesco-edit-price')?.value) || 0;
    const packSize = parseFloat(document.getElementById('tesco-edit-pack-size')?.value) || 100;
    const packUnit = document.getElementById('tesco-edit-pack-unit')?.value || 'g';
    const cal = parseFloat(document.getElementById('tesco-edit-cal')?.value) || 0;
    const prot = parseFloat(document.getElementById('tesco-edit-prot')?.value) || 0;
    const carb = parseFloat(document.getElementById('tesco-edit-carb')?.value) || 0;
    const fat = parseFloat(document.getElementById('tesco-edit-fat')?.value) || 0;
    const fibre = parseFloat(currentTescoImportData?.fibre || 0) || 0;
    const errorEl = document.getElementById('tesco-edit-error');

    if (!title) {
      if (errorEl) {
        errorEl.textContent = 'Product title is required.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const group = getIngredientGroup(subTypeId);
    const cat = group?.cat || 'other';

    const product = {
      ...(currentTescoImportData || {}),
      id: currentTescoImportData?.id || ('ing' + Date.now()),
      name: title,
      brand: brand || 'Tesco',
      cat: cat,
      groupId: subTypeId,
      cal: cal,
      prot: prot,
      carb: carb,
      fat: fat,
      fibre: fibre,
      price: price,
      packSize: packSize,
      packUnit: packUnit,
      updatedAt: new Date().toISOString()
    };

    try {
      await persistProductToBank(product);
      relinkSubtypeProductsInRecipes(subTypeId, product.id);
      closeTescoJsonImportModal();
      renderDataQuality();
      showPlatePlanToast(`Imported "${product.name}" and relinked across recipes! ✓`);
    } catch (err) {
      console.error('Failed to confirm Tesco product import:', err);
      if (errorEl) {
        errorEl.textContent = 'Failed to save product: ' + err.message;
        errorEl.style.display = 'block';
      }
    }
}
window.confirmTescoProductImport = confirmTescoProductImport;

function closeTescoJsonImportModal() {
    const modal = document.getElementById('tesco-json-import-modal');
    if (modal) modal.style.display = 'none';
}
window.closeTescoJsonImportModal = closeTescoJsonImportModal;

async function processTescoJsonPayload(subTypeId) {
    return previewTescoJsonPayload(subTypeId);
}
window.processTescoJsonPayload = processTescoJsonPayload;

function filterSubtypeLinkProducts(query, subTypeId){
    const container = document.getElementById('subtype-link-results');
    if (!container) return;
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    const matches = (state.ingredients || []).filter(p => {
      const name = String(p?.name || '').toLowerCase();
      const brand = String(p?.brand || '').toLowerCase();
      return name.includes(q) || brand.includes(q);
    }).slice(0, 10);

    if (!matches.length) {
      container.style.display = 'block';
      container.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text3);text-align:center">No matching products found in bank.</div>';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = matches.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${ppEscapeHtml(p.name || 'Unnamed')}</div>
          <div style="font-size:11px;color:var(--text2)">${ppEscapeHtml(p.brand || 'No brand')} · ${p.packSize || ''}${p.packUnit || ''}</div>
        </div>
        <button type="button" class="btn sm primary" style="font-size:11px;padding:3px 8px" onclick="resolveSubtypeViaExisting('${ppEscapeAttr(subTypeId)}', '${ppEscapeAttr(p.id)}')">Link Product</button>
      </div>
    `).join('');
}

function resolveSubtypeViaExisting(subTypeId, productId){
    const product = getProduct(productId);
    if (!product) {
      showPlatePlanToast('Product not found.');
      return;
    }
    relinkSubtypeProductsInRecipes(subTypeId, productId);
    closeSubtypeResolutionModal();
    renderDataQuality();
    showPlatePlanToast(`Linked "${product.name}" to sub-type successfully! ✓`);
}

function resolveSubtypeViaTesco(subTypeId){
    openTescoJsonImportModal(subTypeId);
}

function resolveSubtypeViaManual(subTypeId){
    const group = getIngredientGroup(subTypeId);
    const subTypeName = group ? (group.name || getGroupTypeName(group)) : (subTypeId || '');
    closeSubtypeResolutionModal();
    showView('bank');
    productBankGroupFilterId = subTypeId;
    renderBank();
    if (typeof openAddProductModal === 'function') {
      openAddProductModal({
        id: subTypeId,
        name: subTypeName,
        groupId: subTypeId
      });
    } else if (typeof showAddIng === 'function') {
      showAddIng();
      const nameInput = document.getElementById('mi-name');
      if (nameInput) nameInput.value = subTypeName;
    }
}

function fixSubtypeDataQuality(subTypeId, issueKey = ''){
    openSubtypeResolutionModal(subTypeId, issueKey);
}
window.openSubtypeResolutionModal = openSubtypeResolutionModal;
window.closeSubtypeResolutionModal = closeSubtypeResolutionModal;
window.filterSubtypeLinkProducts = filterSubtypeLinkProducts;
window.resolveSubtypeViaExisting = resolveSubtypeViaExisting;
window.resolveSubtypeViaTesco = resolveSubtypeViaTesco;
window.resolveSubtypeViaManual = resolveSubtypeViaManual;
window.fixSubtypeDataQuality = fixSubtypeDataQuality;

function beginDataQualityFix(entityType,entityId,issueKey){
    const section=document.querySelector(`[data-dq-key="${CSS.escape(issueKey||'')}"]`)?.closest('details');
    editorNavigationStack.push({view:'data',issueKey,scrollY:window.scrollY,sectionOpen:!!section?.open,openedAt:Date.now()});
    if((issueKey && issueKey.includes('unmapped-counted-ingredient')) || entityType === 'recipe-ingredient'){
      return openProductMappingModal(entityId, issueKey);
    }
    if(entityType === 'product') return editIng(entityId);
    if(entityType === 'ingredient') return openProductMappingModal(entityId, issueKey);
    if(entityType === 'subtype') return fixSubtypeDataQuality(entityId, issueKey);
    if(entityType === 'recipe'){
      const parts=String(entityId).split(':');
      return editRecipeModalView(parts[0],parts[1]==='enhanced'?'enhanced':'original');
    }
}

function openProductMappingModal(ingredientId, issueKey = ''){
  if (typeof ingredientId === 'string' && ingredientId.includes(':')) {
    const parts = ingredientId.split(':');
    const recipe = getRecipe(parts[0]);
    const variant = parts[1] === 'enhanced' ? recipe?.variants?.enhanced : (recipe?.variants?.original || recipe);
    const ing = variant?.ingredients?.[+parts[2]];
    openUnifiedMappingModal({
      type: 'recipeIngredient',
      recipeId: parts[0],
      variantKey: parts[1],
      ingredientIndex: +parts[2],
      ingredientName: ing?.name || ing?.raw || 'Ingredient',
      rawText: ing?.raw || ing?.name || '',
      qty: ing?.qty ?? ing?.grams ?? '',
      unit: ing?.unit || '',
      issueKey: issueKey || ''
    });
    return;
  }

  let ing = null;
  if (Array.isArray(state?.ingredients)) {
    ing = state.ingredients.find(i => i && i.id === ingredientId);
  }
  if (!ing && state?.ingredients && typeof state.ingredients === 'object') {
    ing = state.ingredients[ingredientId];
  }
  
  openUnifiedMappingModal({
    type: 'ingredient',
    ingredientId: ingredientId,
    ingredientName: ing?.name || ingredientId || 'Ingredient',
    rawText: ing?.raw || ing?.name || '',
    qty: ing?.qty ?? ing?.grams ?? '',
    unit: ing?.unit || '',
    initialQuery: ing?.name || '',
    issueKey: issueKey || ''
  });
}
window.openProductMappingModal = openProductMappingModal;
window.showProductSearchModal = openProductMappingModal;


// == INGREDIENT / PRODUCT BANKS ==
function renderIngredientBank(){
  ensureIngredientGroups();
  ensureIngredientFamilies();
  const el = document.getElementById('ingredient-groups-list');
  if(!el) return;
  const search = (document.getElementById('ingredient-group-search')?.value || '').trim().toLowerCase();
  const searchVariants = getSearchVariants(search);
  const suggestions = getSuggestedGroupMerges();
  const families = (state.ingredientFamilies || []).slice();
  const familyMatchesSearch = family => {
    if(!search) return true;
    const groups = (family.typeIds || []).map(id => getIngredientGroup(id)).filter(Boolean);
    const products = groups.flatMap(g => getGroupProducts(g.id));
    const haystack = [
      family.name,
      family.cat,
      CAT[family.cat],
      ...(family.aliases || []),
      ...groups.flatMap(g => [g.name, ...(g.aliases || []), getGroupHierarchyText(g)]),
      ...products.flatMap(p => [p.name, p.brand])
    ].filter(Boolean).join(' ').toLowerCase();
    return searchVariants.some(v => haystack.includes(v));
  };
  const matchingFamilies = families.filter(familyMatchesSearch).sort((a,b)=>
    (CAT[a.cat] || a.cat || 'Other').localeCompare(CAT[b.cat] || b.cat || 'Other') ||
    (a.name || '').localeCompare(b.name || '')
  );
  resetProgressiveList('ingredients',search);
  const totalFamilies=matchingFamilies.length;
  const visibleFamilies=matchingFamilies.slice(0,platePlanListLimits.ingredients);
  const suggestionHtml = !search && suggestions.length ? `<div class="card" style="margin-bottom:12px">
    <div style="font-weight:700;margin-bottom:6px">Suggested sub-type merges</div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:8px">These look like product variants that could sit under one sub-type.</div>
    ${suggestions.slice(0,8).map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
      <div><strong>${ppEscapeHtml(s.name)}</strong><div style="font-size:11px;color:var(--text2)">${s.products.map(p=>ppEscapeHtml(p.name)).join(' | ')}</div></div>
      <div class="row-center" style="justify-content:flex-end">
        <button class="btn sm ghost" onclick="mergeSuggestedIngredientGroup('${ppEscapeHtml(s.key)}')">Merge</button>
        <button class="btn sm ghost" onclick="ignoreGroupMergeSuggestion('${ppEscapeHtml(s.key)}')">Ignore</button>
      </div>
    </div>`).join('')}
  </div>` : '';

  const catMap = {};
  visibleFamilies.forEach(family => {
    const cat = CAT[family.cat] || family.cat || 'Other';
    if(!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(family);
  });
  const familyCard = family => {
    const groups = (family.typeIds || []).map(id => getIngredientGroup(id)).filter(Boolean).sort((a,b)=>getGroupTypeName(a).localeCompare(getGroupTypeName(b)));
    const herbPair=getFamilyHerbPair(family.id);
    const herbsAndSpices=family.cat==='herbs';
    const products = groups.flatMap(g => getGroupProducts(g.id));
    const defaultGroup = getIngredientGroup(family.defaultTypeId) || groups[0] || null;
    const defaultProduct = defaultGroup ? (getProduct(defaultGroup.defaultProductId) || getGroupProducts(defaultGroup.id)[0] || null) : null;
    const defaultLabel = defaultGroup?.manualDefaultProductId ? 'Default' : 'Auto default';
    const forceSubTypesOpen = ingredientSubTypesOpenIds.has(family.id) || ingredientSubTypesKeepOpenId === family.id;
    const showSubTypes = groups.length > 0 && (forceSubTypesOpen || groups.length > 1 || (groups[0] && !groupIsHiddenDefaultType(groups[0])));
    const defaultScore = defaultProduct ? getProductProteinPer100Kcal(defaultProduct).toFixed(1) : '';
    const keepSubTypesOpen = showSubTypes && forceSubTypesOpen;
    const typeRows = showSubTypes ? `<details${keepSubTypesOpen ? ' open' : ''} ontoggle="rememberIngredientSubTypesOpen('${ppEscapeAttr(family.id)}', this.open)" style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">
      <summary style="cursor:pointer;font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;list-style-position:inside">Sub-types (${groups.length})</summary>
      <div style="margin-top:6px">
      ${groups.map(g => {
        const gProducts = getGroupProducts(g.id);
        const gDefault = getProduct(g.defaultProductId) || gProducts[0] || null;
        const gDefaultLabel = g.manualDefaultProductId ? 'Default' : 'Auto default';
        return `<div class="subtype-row">
          <div style="min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
              <span class="tag">${gProducts.length} product${gProducts.length===1?'':'s'}</span>
              ${herbsAndSpices&&g.herbForm&&g.herbKey?`<span class="tag green">${g.herbForm==='fresh'?'Fresh':'Dried'} · 3:1 pair</span>`:''}
            </div>
            ${gDefault ? `<div style="font-size:11px;color:var(--text2);margin-top:2px">${gDefaultLabel}: ${ppEscapeHtml(gDefault.name)} · ${getProductProteinPer100Kcal(gDefault).toFixed(1)}g protein / 100kcal</div>` : `<div style="font-size:11px;color:var(--red);margin-top:2px">No default product</div>`}
          </div>
          <div class="subtype-actions">
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="renameIngredientGroupPrompt('${g.id}')">Sub-type</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="editGroupAliasesPrompt('${g.id}')">Aliases</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="mergeIngredientGroupPrompt('${g.id}')">Merge</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="convertSubTypeToIngredient('${g.id}')">Make Ingredient</button>
            <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openProductDefaultPicker('group','${g.id}')">Products</button>
            <button class="btn sm danger desktop-only-mobile-hide" style="justify-content:center" onclick="deleteIngredientGroupPrompt('${g.id}')">Delete</button>
            <button class="btn sm ghost mobile-only-action" onclick="renameIngredientGroupPrompt('${g.id}')">Edit sub-type</button>
            <button class="btn sm ghost mobile-only-action" onclick="openIngredientGroupActions('${g.id}')">More</button>
          </div>
        </div>`;
      }).join('')}
      </div>
    </details>` : '';
    return `<div class="bank-card" data-family-id="${ppEscapeAttr(family.id)}" data-category="${ppEscapeAttr(CAT[family.cat] || family.cat || 'Other')}" data-ingredient="${ppEscapeAttr(family.name)}">
      <div class="hierarchy-card-layout">
        <div style="min-width:0">
          <div style="font-size:11px;color:var(--text3);margin-bottom:3px">${ppEscapeHtml(CAT[family.cat] || family.cat || 'Other')} > ${ppEscapeHtml(family.name || 'Ingredient')}${showSubTypes ? ' > sub-types' : ''}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong style="font-size:14px">${ppEscapeHtml(family.name || 'Ingredient')}</strong>
            <span class="tag" title="Category">${ppEscapeHtml(CAT[family.cat] || family.cat || 'Other')}</span>
            <span class="tag">${groups.length} sub-type${groups.length===1?'':'s'}</span>
            <span class="tag">${products.length} product${products.length===1?'':'s'}</span>
          </div>
          ${defaultProduct ? `<div style="font-size:12px;color:var(--text2);margin-top:5px"><strong>${defaultLabel}:</strong> ${ppEscapeHtml(defaultProduct.name)}${defaultProduct.brand&&defaultProduct.brand!=='Generic'?' ('+ppEscapeHtml(defaultProduct.brand)+')':''}${defaultScore ? ` · ${defaultScore}g protein / 100kcal` : ''}</div>` : `<div style="font-size:12px;color:var(--red);margin-top:5px">No default product yet.</div>`}
          ${(family.aliases || []).length > 1 ? `<div style="font-size:11px;color:var(--text2);margin-top:5px"><strong>Aliases:</strong> ${ppEscapeHtml((family.aliases || []).slice(0,6).join(', '))}${family.aliases.length > 6 ? '...' : ''}</div>` : ''}
          ${family.notes ? `<div style="font-size:12px;color:var(--text2);margin-top:5px">${ppEscapeHtml(family.notes)}</div>` : ''}
          ${herbsAndSpices?`<div class="herb-status"><strong>Fresh/dried conversion:</strong> ${herbPair.fresh&&herbPair.dried?`${ppEscapeHtml(getGroupTypeName(herbPair.fresh))} ↔ ${ppEscapeHtml(getGroupTypeName(herbPair.dried))} · 3:1`:'Not configured'} <span class="tag">Edit ingredient to configure</span></div>`:''}
        </div>
        <div class="hierarchy-actions">
          <button class="btn sm ghost desktop-only-mobile-hide ingredient-edit-action" style="justify-content:center" onclick="openIngredientEditor('${family.id}',this)">Edit ingredient</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openIngredientFamilyAliasesModal('${family.id}')">Aliases</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="addSubTypeToFamilyPrompt('${family.id}')">+ Sub-type</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="mergeIngredientFamilyPrompt('${family.id}')">Merge</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openIngredientToSubTypeModal('${family.id}')">Make Sub-type</button>
          <button class="btn sm ghost desktop-only-mobile-hide" style="justify-content:center" onclick="openProductDefaultPicker('family','${family.id}')">Products</button>
          <button class="btn sm danger desktop-only-mobile-hide" style="justify-content:center;grid-column:span 2" onclick="deleteIngredientFamilyPrompt('${family.id}')">Delete</button>
          <button class="btn sm primary mobile-only-action ingredient-edit-action" onclick="openIngredientEditor('${family.id}',this)">Edit ingredient</button>
          <button class="btn sm ghost mobile-only-action" onclick="openIngredientFamilyActions('${family.id}')">More</button>
        </div>
      </div>
      ${typeRows}
    </div>`;
  };
  const rows = Object.entries(catMap).map(([cat, fams]) => `
    <section style="margin-bottom:16px">
      <h3 style="font-size:14px;margin:4px 0 8px;color:var(--text)">${ppEscapeHtml(cat)}</h3>
      ${fams.map(familyCard).join('')}
    </section>`).join('');
  el.innerHTML = suggestionHtml + (rows || '<div class="empty">No ingredients found.</div>') + progressiveListButton('ingredients',totalFamilies,visibleFamilies.length);
  ingredientSubTypesKeepOpenId = null;
}



function rememberIngredientSubTypesOpen(familyId, isOpen){
  if(!familyId) return;
  if(isOpen) ingredientSubTypesOpenIds.add(familyId);
  else ingredientSubTypesOpenIds.delete(familyId);
}



function getFamilyGroups(familyId){
  const family = getIngredientFamily(familyId);
  return (family?.typeIds || []).map(id => getIngredientGroup(id)).filter(Boolean);
}

function getFamilyProducts(familyId){
  return getFamilyGroups(familyId).flatMap(g => getGroupProducts(g.id));
}


function isHerbsAndSpicesFamily(family){ return family?.cat==='herbs'; }
function isHerbsAndSpicesGroup(group){
  const family=getGroupIngredientFamily(group);
  return group?.cat==='herbs'&&family?.cat==='herbs';
}
function getFamilyHerbPair(familyId,{includeInactive=false}={}){
  const family=getIngredientFamily(familyId);
  if(!includeInactive&&!isHerbsAndSpicesFamily(family)) return {fresh:null,dried:null,key:'',active:false};
  const groups=getFamilyGroups(familyId);
  const fresh=groups.find(group=>group.herbForm==='fresh'&&group.herbKey);
  const dried=groups.find(group=>group.herbForm==='dried'&&group.herbKey&&(!fresh||group.herbKey===fresh.herbKey));
  return {fresh,dried,key:fresh?.herbKey||dried?.herbKey||'',active:isHerbsAndSpicesFamily(family)};
}
function ensureHerbConversionPanel(){
  let wrap=document.getElementById('ingredient-herb-conversion-wrap');
  if(wrap)wrap.remove();
  wrap=document.createElement('div');
  wrap.id='ingredient-herb-conversion-wrap';
  wrap.className='modal-wrap';
  wrap.style.zIndex='445';
  wrap.innerHTML=`<div class="modal" style="max-width:560px">
    <div class="row-between" style="align-items:center;margin-bottom:12px">
      <div><h3 style="margin:0">Fresh/dried conversion</h3><div id="herb-conversion-context" style="font-size:14px;color:var(--text2);margin-top:3px"></div></div>
      <button class="btn sm ghost" onclick="closeHerbConversionPanel()">Close</button>
    </div>
    <div class="msg info" style="margin:0 0 14px">Within Herbs &amp; Spices, PlatePlan uses 3 parts fresh to 1 part dried for a deliberately paired ingredient. This only changes temporary planned-meal substitutions.</div>
    <div class="herb-pair-grid">
      <div class="field"><label for="herb-conversion-fresh">Fresh sub-type</label><select id="herb-conversion-fresh"></select></div>
      <div class="field"><label for="herb-conversion-dried">Dried sub-type</label><select id="herb-conversion-dried"></select></div>
    </div>
    <div id="herb-conversion-msg"></div>
    <details class="card-details"><summary>How this works</summary><div style="font-size:14px;color:var(--text2);padding-bottom:10px">Choose two sub-types of the same ingredient. If one is missing, select Create new. Products remain mapped to their existing sub-types; no Recipe Vault recipe is edited.</div></details>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn primary" onclick="saveHerbConversionPair()">Save pairing</button>
      <button class="btn ghost" onclick="clearHerbConversionPair()">Clear pairing</button>
      <button class="btn ghost" onclick="closeHerbConversionPanel()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function herbConversionOptions(groups,selected,form){
  return `<option value="">Choose ${form} sub-type</option>${groups.map(group=>`<option value="${ppEscapeAttr(group.id)}"${group.id===selected?' selected':''}>${ppEscapeHtml(getGroupTypeName(group))}</option>`).join('')}<option value="__create__">Create new ${form} sub-type…</option>`;
}
function openHerbConversionPanel(familyId){
  const family=getIngredientFamily(familyId);
  if(!family)return showPlatePlanToast('That ingredient could not be found.');
  if(!isHerbsAndSpicesFamily(family)) return openAppInfoModal('Fresh/dried conversion unavailable','Move this ingredient into Herbs &amp; Spices before configuring a fresh/dried pairing. Existing pairing metadata is preserved while it is outside that category.');
  if(typeof closeMobileActionSheet==='function')closeMobileActionSheet(true);
  herbConversionFamilyId=family.id;
  const groups=getFamilyGroups(family.id);
  const pair=getFamilyHerbPair(family.id);
  const wrap=ensureHerbConversionPanel();
  document.getElementById('herb-conversion-context').textContent=family.name;
  document.getElementById('herb-conversion-fresh').innerHTML=herbConversionOptions(groups,pair.fresh?.id||'','fresh');
  document.getElementById('herb-conversion-dried').innerHTML=herbConversionOptions(groups,pair.dried?.id||'','dried');
  wrap.classList.add('open');
  setTimeout(()=>document.getElementById('herb-conversion-fresh')?.focus(),0);
}
function closeHerbConversionPanel(){
  document.getElementById('ingredient-herb-conversion-wrap')?.classList.remove('open');
  herbConversionFamilyId=null;
}
function createHerbSubType(family,form){
  const name=`${form==='fresh'?'Fresh':'Dried'} ${family.name}`;
  const group={id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),name,cat:'herbs',family:family.name,ingredientId:family.id,aliases:[name],defaultProductId:null,productIds:[],notes:'',herbForm:form,herbKey:canonicalGroupKey(family.name)};
  state.ingredientGroups.push(group);
  if(!Array.isArray(family.typeIds))family.typeIds=[];
  family.typeIds.push(group.id);
  if(!family.defaultTypeId)family.defaultTypeId=group.id;
  return group;
}
function saveHerbConversionPair(){
  const family=getIngredientFamily(herbConversionFamilyId);
  const msg=document.getElementById('herb-conversion-msg');
  if(!family)return;
  if(!isHerbsAndSpicesFamily(family)){if(msg)msg.innerHTML='<div class="msg error">Fresh/dried pairings are available only inside Herbs &amp; Spices.</div>';return;}
  let freshId=document.getElementById('herb-conversion-fresh')?.value||'';
  let driedId=document.getElementById('herb-conversion-dried')?.value||'';
  let fresh=freshId==='__create__'?createHerbSubType(family,'fresh'):getIngredientGroup(freshId);
  let dried=driedId==='__create__'?createHerbSubType(family,'dried'):getIngredientGroup(driedId);
  if(!fresh||!dried){if(msg)msg.innerHTML='<div class="msg error">Choose both a fresh and dried sub-type.</div>';return;}
  if(fresh.id===dried.id){if(msg)msg.innerHTML='<div class="msg error">Fresh and dried must use different sub-types.</div>';return;}
  const key=canonicalGroupKey(family.name);
  getFamilyGroups(family.id).forEach(group=>{if(group.id!==fresh.id&&group.id!==dried.id&&group.herbKey===key){group.herbForm='';group.herbKey='';}});
  fresh.herbForm='fresh';fresh.herbKey=key;
  dried.herbForm='dried';dried.herbKey=key;
  saveState();
  closeHerbConversionPanel();
  refreshHierarchyViews();
  refreshIngredientFamilyHerbEditor();
  showPlatePlanToast(`${family.name} fresh/dried pairing saved.`);
}
function clearHerbConversionPair(){
  const family=getIngredientFamily(herbConversionFamilyId);
  if(!family)return;
  getFamilyGroups(family.id).forEach(group=>{group.herbForm='';group.herbKey='';});
  saveState();
  closeHerbConversionPanel();
  refreshHierarchyViews();
  refreshIngredientFamilyHerbEditor();
  showPlatePlanToast(`${family.name} conversion pairing cleared.`);
}



function ensureProductDefaultPickerModal(){
  let wrap = document.getElementById('product-default-picker-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'product-default-picker-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '445';
  wrap.innerHTML = `
    <div class="modal" style="max-width:780px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="product-default-picker-title" style="margin:0">Products</h3>
        <button class="btn sm ghost" onclick="closeProductDefaultPicker()">Close</button>
      </div>
      <div id="product-default-picker-copy" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div id="product-default-picker-list" style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div class="btn-row">
        <button class="btn ghost" id="product-default-picker-bank-btn" onclick="openProductDefaultPickerBank()">Open in Product Bank</button>
        <button class="btn ghost" onclick="closeProductDefaultPicker()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openProductDefaultPicker(scope, id){
  ensureIngredientFamilies();
  const wrap = ensureProductDefaultPickerModal();
  if(scope === 'family'){
    const family = getIngredientFamily(id);
    if(!family) return;
    productDefaultPickerContext = { scope, id:family.id };
    document.getElementById('product-default-picker-title').textContent = `Products for ${family.name}`;
    document.getElementById('product-default-picker-copy').innerHTML = 'Choose which linked product should be the default for this ingredient. If the product sits under a sub-type, that sub-type also becomes the ingredient default.';
  } else {
    const group = getIngredientGroup(id);
    if(!group) return;
    productDefaultPickerContext = { scope:'group', id:group.id };
    document.getElementById('product-default-picker-title').textContent = `Products for ${getGroupTypeName(group)}`;
    document.getElementById('product-default-picker-copy').innerHTML = 'Choose which linked product should be the default for this sub-type.';
  }
  renderProductDefaultPickerList();
  wrap.classList.add('open');
}

function closeProductDefaultPicker(){
  document.getElementById('product-default-picker-wrap')?.classList.remove('open');
  productDefaultPickerContext = null;
}

function getProductDefaultPickerRows(){
  if(!productDefaultPickerContext) return [];
  const groups = productDefaultPickerContext.scope === 'family'
    ? getFamilyGroups(productDefaultPickerContext.id)
    : [getIngredientGroup(productDefaultPickerContext.id)].filter(Boolean);
  return groups.flatMap(group => getGroupProducts(group.id).map(product => ({ group, product })))
    .sort((a,b) =>
      getGroupTypeName(a.group).localeCompare(getGroupTypeName(b.group)) ||
      getProductProteinPer100Kcal(b.product) - getProductProteinPer100Kcal(a.product) ||
      (a.product.name || '').localeCompare(b.product.name || '')
    );
}

function renderProductDefaultPickerList(){
  const list = document.getElementById('product-default-picker-list');
  if(!list) return;
  const rows = getProductDefaultPickerRows();
  if(!rows.length){
    list.innerHTML = '<div style="padding:14px;color:var(--text2);font-size:12px">No linked products yet. Open the Product Bank to add or assign products.</div>';
    return;
  }
  const family = productDefaultPickerContext?.scope === 'family' ? getIngredientFamily(productDefaultPickerContext.id) : null;
  list.innerHTML = rows.map(({ group, product }) => {
    const selected = group.defaultProductId === product.id && (!family || family.defaultTypeId === group.id);
    const density = getProductProteinPer100Kcal(product);
    const pack = product.packSize ? formatPackDisplay(product.packSize, product.packUnit || 'g', product.itemWeight) : '';
    return `<div class="row-between" style="gap:12px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--border);background:${selected ? 'rgba(54,179,126,0.08)' : 'var(--surface)'}">
      <div style="min-width:0;flex:1">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <strong style="font-size:13px">${ppEscapeHtml(product.name)}</strong>
          ${product.brand && product.brand !== 'Generic' ? `<span class="tag">${ppEscapeHtml(product.brand)}</span>` : ''}
          <span class="tag">${ppEscapeHtml(getGroupTypeName(group))}</span>
          ${selected ? '<span class="tag green">Current default</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">${(+product.cal || 0)} kcal · ${(+product.prot || 0)}g protein · ${density.toFixed(1)}g protein / 100kcal${pack ? ` · ${ppEscapeHtml(pack)}` : ''}</div>
      </div>
      <button class="btn sm ${selected ? 'ghost' : 'primary'}" onclick="setDefaultProductFromPicker('${ppEscapeAttr(group.id)}','${ppEscapeAttr(product.id)}')">${selected ? 'Selected' : 'Set default'}</button>
    </div>`;
  }).join('');
}

function setDefaultProductFromPicker(groupId, productId){
  const group = getIngredientGroup(groupId);
  const product = getProduct(productId);
  if(!group || !product) return;
  ensureProductAssignedToGroup(product, group.name, group.id);
  syncProductHierarchyCategory(product, group, product.cat);
  group.manualDefaultProductId = product.id;
  group.defaultProductId = product.id;
  const family = getGroupIngredientFamily(group);
  if(family) family.defaultTypeId = group.id;
  refreshProductGroupAndRecipes(product.id);
  saveState();
  renderProductDefaultPickerList();
  renderIngredientBank();
  renderBank();
  renderVault();
}

function openProductDefaultPickerBank(){
  const ctx = productDefaultPickerContext;
  closeProductDefaultPicker();
  if(ctx?.scope === 'family') showFamilyProducts(ctx.id);
  else if(ctx?.scope === 'group') showGroupProducts(ctx.id);
}

function refreshHierarchyViews(){
  refreshPlatePlanDerivedState({persist:true, render:true});
}



function ensureIngredientToSubTypeModal(){
  let wrap = document.getElementById('ingredient-to-subtype-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'ingredient-to-subtype-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '445';
  wrap.innerHTML = `
    <div class="modal" style="max-width:660px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Make ingredient a sub-type</h3>
        <button class="btn sm ghost" onclick="closeIngredientToSubTypeModal()">Close</button>
      </div>
      <div id="ingredient-to-subtype-copy" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field" id="ingredient-to-subtype-search-field">
        <label>Choose parent ingredient</label>
        <input type="search" id="ingredient-to-subtype-search" placeholder="Search ingredients by any part of their name, alias, or category" oninput="renderIngredientToSubTypeOptions(this.value)">
      </div>
      <div id="ingredient-to-subtype-options" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div id="ingredient-to-subtype-create" class="card-inner" style="margin-bottom:12px;display:none">
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Need a new parent ingredient?</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end">
          <div class="field" style="margin:0">
            <label>New ingredient name</label>
            <input type="text" id="ingredient-to-subtype-new-name" placeholder="e.g. Pasta">
          </div>
          <button class="btn primary" onclick="createIngredientForSubTypeConversion()">Create New Ingredient</button>
        </div>
      </div>
      <div id="ingredient-to-subtype-msg"></div>
      <div class="btn-row">
        <button class="btn ghost" onclick="closeIngredientToSubTypeModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openIngredientToSubTypeModal(familyId){
  ensureIngredientFamilies();
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const groups = getFamilyGroups(family.id);
  ingredientToSubTypeSourceId = family.id;
  const wrap = ensureIngredientToSubTypeModal();
  const copy = document.getElementById('ingredient-to-subtype-copy');
  const searchField = document.getElementById('ingredient-to-subtype-search-field');
  const options = document.getElementById('ingredient-to-subtype-options');
  const createBox = document.getElementById('ingredient-to-subtype-create');
  const msg = document.getElementById('ingredient-to-subtype-msg');
  msg.innerHTML = '';
  if(groups.length !== 1){
    copy.innerHTML = `<strong>${ppEscapeHtml(family.name)}</strong> has ${groups.length} sub-types. Move, merge, or delete the extra sub-types first, then it can safely become a sub-type under another ingredient.`;
    searchField.style.display = 'none';
    if(createBox) createBox.style.display = 'none';
    options.innerHTML = '';
  } else {
    copy.innerHTML = `<strong>${ppEscapeHtml(family.name)}</strong> will become a sub-type under the ingredient you choose. Recipe mappings, products, aliases, and nutrition links will be preserved.`;
    searchField.style.display = 'block';
    if(createBox) createBox.style.display = 'block';
    const search = document.getElementById('ingredient-to-subtype-search');
    const newName = document.getElementById('ingredient-to-subtype-new-name');
    search.value = '';
    if(newName) newName.value = '';
    renderIngredientToSubTypeOptions('');
    setTimeout(()=>search.focus(),0);
  }
  wrap.classList.add('open');
}

function closeIngredientToSubTypeModal(){
  document.getElementById('ingredient-to-subtype-wrap')?.classList.remove('open');
  ingredientToSubTypeSourceId = null;
}

function renderIngredientToSubTypeOptions(query = ''){
  const list = document.getElementById('ingredient-to-subtype-options');
  if(!list) return;
  const source = getIngredientFamily(ingredientToSubTypeSourceId);
  if(!source){ list.innerHTML = ''; return; }
  const variants = getSearchVariants(query || '');
  let rows = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  if(variants.length){
    rows = rows.filter(f => {
      const haystack = [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase();
      return variants.some(v => haystack.includes(v));
    });
  }
  rows = rows.sort((a,b)=>(CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0,50);
  const newName = document.getElementById('ingredient-to-subtype-new-name');
  if(newName && !newName.matches(':focus')) newName.value = normaliseAliasText(query || '');
  list.innerHTML = rows.length ? rows.map(f => `<button type="button" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="confirmIngredientToSubType('${ppEscapeAttr(f.id)}')">
    <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
  </button>`).join('') : '<div style="padding:12px;color:var(--text2);font-size:12px">No matching parent ingredients found.</div>';
}

function createIngredientForSubTypeConversion(){
  const source = getIngredientFamily(ingredientToSubTypeSourceId);
  const msg = document.getElementById('ingredient-to-subtype-msg');
  if(!source) return;
  const groups = getFamilyGroups(source.id);
  if(groups.length !== 1){
    if(msg) msg.innerHTML = '<div class="msg error">This ingredient has multiple sub-types. Move or merge them first.</div>';
    return;
  }
  const typed = normaliseAliasText(document.getElementById('ingredient-to-subtype-new-name')?.value || document.getElementById('ingredient-to-subtype-search')?.value || '');
  if(!typed){
    if(msg) msg.innerHTML = '<div class="msg error">Add the new ingredient name first.</div>';
    return;
  }
  const cat = source.cat || groups[0]?.cat || 'other';
  const existing = (state.ingredientFamilies || []).find(f => f.id !== source.id && canonicalGroupKey(f.name) === canonicalGroupKey(typed) && f.cat === cat);
  if(existing){
    confirmIngredientToSubType(existing.id);
    return;
  }
  let id = ingredientFamilyIdFromName(typed, cat);
  if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
  const family = { id, name:toTitleCase(typed), cat, aliases:[typed], notes:'', typeIds:[], defaultTypeId:'' };
  state.ingredientFamilies.push(family);
  confirmIngredientToSubType(family.id);
}

function confirmIngredientToSubType(targetFamilyId){
  const source = getIngredientFamily(ingredientToSubTypeSourceId);
  const target = getIngredientFamily(targetFamilyId);
  if(!source || !target || source.id === target.id) return;
  const groups = getFamilyGroups(source.id);
  const msg = document.getElementById('ingredient-to-subtype-msg');
  if(groups.length !== 1){
    if(msg) msg.innerHTML = '<div class="msg error">This ingredient has multiple sub-types. Move or merge them first.</div>';
    return;
  }
  const group = groups[0];
  if(!Array.isArray(target.aliases)) target.aliases = [];
  if(!Array.isArray(target.typeIds)) target.typeIds = [];
  [source.name, ...(source.aliases || [])].filter(Boolean).forEach(alias => {
    if(!target.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) target.aliases.push(alias);
    addIngredientGroupAlias(group, alias);
  });
  group.name = toTitleCase(source.name || group.name || 'Sub-type');
  group.ingredientId = target.id;
  group.family = target.name;
  group.cat = target.cat || source.cat || group.cat || 'other';
  getGroupProducts(group.id).forEach(product => {
    product.cat = group.cat;
    product.updatedAt = new Date().toISOString();
  });
  target.typeIds = target.typeIds.filter(id => id !== group.id);
  target.typeIds.push(group.id);
  if(!target.defaultTypeId) target.defaultTypeId = group.id;
  state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  closeIngredientToSubTypeModal();
  refreshHierarchyViews();
}

function convertSubTypeToIngredient(groupId){
  ensureIngredientFamilies();
  const group = getIngredientGroup(groupId);
  if(!group) return;
  const oldFamily = getGroupIngredientFamily(group);
  const cat = group.cat || oldFamily?.cat || 'other';
  const name = toTitleCase(getGroupTypeName(group));
  let familyId = ingredientFamilyIdFromName(name, cat);
  let family = getIngredientFamily(familyId);
  if(family && family.id !== oldFamily?.id && (family.typeIds || []).some(id => id !== group.id)){
    familyId = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
    family = null;
  }
  if(!family){
    family = { id:familyId, name, cat, aliases:[name], notes:'', typeIds:[], defaultTypeId:group.id };
    state.ingredientFamilies.push(family);
  }
  const keepOldFamilyOpen = oldFamily && oldFamily.typeIds && oldFamily.typeIds.filter(id => id !== group.id && getIngredientGroup(id)).length > 0;
  if(oldFamily){
    oldFamily.typeIds = (oldFamily.typeIds || []).filter(id => id !== group.id);
    if(oldFamily.defaultTypeId === group.id) oldFamily.defaultTypeId = oldFamily.typeIds[0] || '';
  }
  if(!Array.isArray(family.aliases)) family.aliases = [];
  [name, ...(group.aliases || [])].filter(Boolean).forEach(alias => {
    if(!family.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) family.aliases.push(alias);
  });
  group.ingredientId = family.id;
  group.family = family.name;
  group.cat = family.cat;
  group.name = family.name;
  if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
  family.defaultTypeId = group.id;
  getGroupProducts(group.id).forEach(product => {
    product.cat = family.cat;
    product.updatedAt = new Date().toISOString();
  });
  if(keepOldFamilyOpen) {
    ingredientSubTypesKeepOpenId = oldFamily.id;
    ingredientSubTypesOpenIds.add(oldFamily.id);
  }
  refreshHierarchyViews();
}

function showFamilyProducts(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  productBankFamilyFilterId = family.id;
  productBankGroupFilterId = null;
  activeFamily = 'all';
  activeCat = 'all';
  showView('bank');
  const search = document.getElementById('bank-search');
  if(search) search.value = '';
  renderBank();
  setTimeout(() => document.getElementById('bank-search')?.focus(), 0);
}

function clearProductFamilyFilter(){
  productBankFamilyFilterId = null;
  renderBank();
}

function createIngredientFamilyPrompt(){
  openIngredientFamilyDetailsModal('', true);
}



function preparePlatePlanWorkspace(wrap,trigger=null){
  if(typeof closeMobileActionSheet==='function') closeMobileActionSheet(true);
  if(typeof closeMobileMore==='function') closeMobileMore(true);
  if(!wrap) return null;
  wrap.setAttribute('role','dialog');
  wrap.setAttribute('aria-modal','true');
  if(trigger) ingredientEditorOrigin={element:trigger,scrollY:window.scrollY};
  document.body.appendChild(wrap);
  return wrap;
}

function restoreIngredientEditorOrigin(){
  const origin=ingredientEditorOrigin;
  ingredientEditorOrigin=null;
  if(!origin)return;
  requestAnimationFrame(()=>{
    window.scrollTo({top:origin.scrollY||0,behavior:'instant'});
    if(origin.element?.isConnected) origin.element.focus({preventScroll:true});
    else if(ingredientFamilyDetailsId) document.querySelector(`[data-family-id="${CSS.escape(ingredientFamilyDetailsId)}"] .ingredient-edit-action`)?.focus({preventScroll:true});
  });
}

function ensureIngredientFamilyDetailsModal(){
  const matches=Array.from(document.querySelectorAll('#ingredient-family-details-wrap'));
  let wrap=matches.shift()||null;
  matches.forEach(node=>node.remove());
  if(wrap&&(!wrap.querySelector('#ingredient-family-details-name')||!wrap.querySelector('#ingredient-family-herb-field'))){wrap.remove();wrap=null;}
  if(wrap) return preparePlatePlanWorkspace(wrap);
  wrap = document.createElement('div');
  wrap.id = 'ingredient-family-details-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '440';
  wrap.innerHTML = `
    <div class="modal" style="max-width:540px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="ingredient-family-details-title" style="margin:0">Edit ingredient</h3>
        <button class="btn sm ghost" onclick="closeIngredientFamilyDetailsModal()">Close</button>
      </div>
      <div class="field">
        <label>Category</label>
        <select id="ingredient-family-details-cat" onchange="refreshIngredientFamilyHerbEditor()"></select>
      </div>
      <div class="field">
        <label>Ingredient name</label>
        <input type="text" id="ingredient-family-details-name" placeholder="e.g. Pasta, Asparagus, Tofu">
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea id="ingredient-family-details-notes" style="min-height:70px"></textarea>
      </div>
      <section class="card-inner" id="ingredient-family-herb-field" style="display:none;margin:12px 0">
        <div style="font-weight:750">Fresh/dried conversion</div>
        <div id="ingredient-family-herb-summary" style="font-size:14px;color:var(--text2);margin:5px 0 10px"></div>
        <button type="button" class="btn" id="ingredient-family-herb-action" onclick="openIngredientEditorHerbConversion()">Configure pairing</button>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">A planned-meal substitution can use the fixed 3 fresh : 1 dried ratio. Recipe Vault quantities are never changed.</div>
      </section>
      <div id="ingredient-family-details-msg"></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" onclick="saveIngredientFamilyDetailsModal()">Save</button>
        <button class="btn ghost" onclick="closeIngredientFamilyDetailsModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return preparePlatePlanWorkspace(wrap);
}

function openIngredientEditor(familyId,trigger=null){
  const family=getIngredientFamily(familyId);
  if(!family){
    showPlatePlanToast('That ingredient could not be found. Refreshing the Ingredient Bank.');
    renderIngredientBank();
    return false;
  }
  try{
    ingredientEditorOrigin={element:trigger||document.activeElement,scrollY:window.scrollY};
    openIngredientFamilyDetailsModal(familyId,false);
    return true;
  }catch(error){
    console.warn('Rebuilding the ingredient editor after an opening error.',error);
    document.querySelectorAll('#ingredient-family-details-wrap').forEach(node=>node.remove());
    try{
      openIngredientFamilyDetailsModal(familyId,false);
      return true;
    }catch(retryError){
      console.error('Could not open ingredient editor after rebuilding it.',retryError);
      openAppInfoModal('Could not open ingredient',`PlatePlan rebuilt the editor but could not open this ingredient. No data was changed.<details class="card-details"><summary>Technical detail</summary><div class="breakable-id">${ppEscapeHtml(retryError?.message||String(retryError))}</div></details>`);
      return false;
    }
  }
}

function refreshIngredientFamilyHerbEditor(){
  const section=document.getElementById('ingredient-family-herb-field');
  if(!section) return;
  const cat=document.getElementById('ingredient-family-details-cat')?.value||'other';
  section.style.display=cat==='herbs'?'block':'none';
  if(cat!=='herbs') return;
  const family=getIngredientFamily(ingredientFamilyDetailsId);
  const summary=document.getElementById('ingredient-family-herb-summary');
  const action=document.getElementById('ingredient-family-herb-action');
  if(!family){
    if(summary) summary.textContent='Save this ingredient first, then reopen it to create or pair fresh and dried sub-types.';
    if(action){action.disabled=true;action.textContent='Save ingredient first';}
    return;
  }
  const pair=getFamilyHerbPair(family.id,{includeInactive:true});
  if(summary) summary.textContent=pair.fresh&&pair.dried
    ? `${getGroupTypeName(pair.fresh)} ↔ ${getGroupTypeName(pair.dried)} · 3:1`
    : 'Not configured';
  if(action){action.disabled=false;action.textContent=pair.fresh&&pair.dried?'Edit pairing':'Configure pairing';}
}

function openIngredientEditorHerbConversion(){
  if(!ingredientFamilyDetailsId) return;
  openHerbConversionPanel(ingredientFamilyDetailsId);
}

function openIngredientFamilyDetailsModal(familyId = '', create = false){
  if(familyId) capturePlatePlanEditBaseline('ingredientFamilies/'+familyId);
  ensureIngredientGroups();
  const family = familyId ? getIngredientFamily(familyId) : null;
  ingredientFamilyDetailsId = family?.id || '';
  ingredientFamilyDetailsCreate = create || !family;
  const wrap = preparePlatePlanWorkspace(ensureIngredientFamilyDetailsModal(),ingredientEditorOrigin?.element||document.activeElement);
  document.getElementById('ingredient-family-details-title').textContent = ingredientFamilyDetailsCreate ? 'Create ingredient' : 'Edit ingredient';
  document.getElementById('ingredient-family-details-cat').innerHTML = getGroupCategoryOptionsHtml(family?.cat || 'other');
  document.getElementById('ingredient-family-details-name').value = family?.name || '';
  document.getElementById('ingredient-family-details-notes').value = family?.notes || '';
  document.getElementById('ingredient-family-details-msg').innerHTML = '';
  refreshIngredientFamilyHerbEditor();
  wrap.classList.add('open');
  setTimeout(()=>document.getElementById('ingredient-family-details-name')?.focus(),0);
}

function closeIngredientFamilyDetailsModal(preserveEditorReturn=false){
  document.getElementById('ingredient-family-details-wrap')?.classList.remove('open');
  const savedId=ingredientFamilyDetailsId;
  ingredientFamilyDetailsId = null;
  ingredientFamilyDetailsCreate = false;
  if(!preserveEditorReturn) abandonEditorReturn();
  const origin=ingredientEditorOrigin;
  ingredientEditorOrigin=null;
  requestAnimationFrame(()=>{
    window.scrollTo({top:origin?.scrollY||window.scrollY,behavior:'instant'});
    if(origin?.element?.isConnected) origin.element.focus({preventScroll:true});
    else if(savedId) document.querySelector(`[data-family-id="${CSS.escape(savedId)}"] .ingredient-edit-action`)?.focus({preventScroll:true});
  });
}

async function saveIngredientFamilyDetailsModal(){
  const name = normaliseAliasText(document.getElementById('ingredient-family-details-name')?.value || '');
  const cat = document.getElementById('ingredient-family-details-cat')?.value || 'other';
  const notes = document.getElementById('ingredient-family-details-notes')?.value || '';
  const msg = document.getElementById('ingredient-family-details-msg');
  if(!name){
    msg.innerHTML = '<div class="msg error">Add an ingredient name first.</div>';
    return;
  }
  let family = ingredientFamilyDetailsId ? getIngredientFamily(ingredientFamilyDetailsId) : null;
  const dupe = (state.ingredientFamilies || []).find(f => f.id !== family?.id && canonicalGroupKey(f.name) === canonicalGroupKey(name) && f.cat === cat);
  if(dupe){
    msg.innerHTML = `<div class="msg error">That ingredient already exists in ${ppEscapeHtml(CAT[cat] || cat)}. Use Merge if you want to combine them.</div>`;
    return;
  }
  const nowIso = new Date().toISOString();
  let isNew = false;
  let newGroup = null;
  let affectedGroups = [];
  let affectedProducts = [];

  if(!family){
    isNew = true;
    const id = ingredientFamilyIdFromName(name, cat);
    family = { id, name: toTitleCase(name), cat, aliases:[name], notes, typeIds:[], defaultTypeId:'', updatedAt: nowIso };
    newGroup = {
      id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
      name:toTitleCase(name),
      cat,
      family:family.name,
      ingredientId:family.id,
      aliases:[name],
      defaultProductId:null,
      productIds:[],
      notes:'',
      updatedAt: nowIso
    };
    family.typeIds.push(newGroup.id);
    family.defaultTypeId = newGroup.id;
  } else {
    const oldName = family.name;
    family.name = toTitleCase(name);
    family.cat = cat;
    family.notes = notes;
    family.updatedAt = nowIso;
    if(!Array.isArray(family.aliases)) family.aliases = [];
    [oldName, family.name].filter(Boolean).forEach(alias => {
      if(!family.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) family.aliases.push(alias);
    });
    affectedGroups = getFamilyGroups(family.id);
    affectedGroups.forEach(g => {
      g.family = family.name;
      g.cat = family.cat;
      g.updatedAt = nowIso;
      getGroupProducts(g.id).forEach(p => { p.cat = family.cat; p.updatedAt = nowIso; affectedProducts.push(p); });
    });
  }

  try {
    await executeDataQualityTransaction('SAVE_INGREDIENT_FAMILY', {
      familyData: family,
      isNew,
      newGroup,
      affectedGroups,
      affectedProducts
    }, {
      modalWrapId: 'ingredient-family-details-wrap',
      submitButtonId: 'ingredient-family-save-btn',
      errorContainerId: 'ingredient-family-details-msg'
    });
    closeIngredientFamilyDetailsModal(true);
    refreshHierarchyViews();
    finishEditorReturn();
  } catch(e) {
    console.error('saveIngredientFamilyDetailsModal failed:', e);
  }
}

function openIngredientFamilyAliasesModal(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const wrap = ensureIngredientGroupDetailsModal();
  ingredientGroupDetailsEditId = null;
  ingredientFamilyDetailsId = family.id;
  ingredientGroupDetailsMode = 'familyAliases';
  document.getElementById('ingredient-group-details-title').textContent = 'Edit ingredient aliases';
  document.getElementById('ingredient-group-details-context').innerHTML = `<strong>${ppEscapeHtml(family.name)}</strong>`;
  const catField = document.getElementById('ingredient-group-category-field'); if(catField) catField.style.display = 'none';
  const nameField = document.getElementById('ingredient-group-name-field'); if(nameField) nameField.style.display = 'none';
  const famField = document.getElementById('ingredient-group-family-field'); if(famField) famField.style.display = 'none';
  const aliasField = document.getElementById('ingredient-group-aliases-field'); if(aliasField) aliasField.style.display = 'block';
  document.getElementById('ingredient-group-aliases-input').value = (family.aliases || []).join('\\n');
  document.getElementById('ingredient-group-details-msg').innerHTML = '';
  wrap.classList.add('open');
}

function addSubTypeToFamilyPrompt(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  openIngredientGroupDetailsModal('', 'create');
  document.getElementById('ingredient-group-category-input').value = family.cat || 'other';
  document.getElementById('ingredient-group-family-input').value = family.name || '';
  window.pendingSubTypeFamilyId = family.id;
}



function mergeIngredientFamilyPrompt(sourceFamilyId){
  const source = getIngredientFamily(sourceFamilyId);
  if(!source) return;
  ingredientFamilyMergeSourceId = source.id;
  ingredientFamilyMergeTargetId = null;
  ingredientFamilyMergeTargetKind = 'family';
  const wrap = ensureIngredientGroupMergeModal();
  document.querySelector('#ingredient-group-merge-wrap h3').textContent = 'Merge ingredients';
  document.getElementById('ingredient-group-merge-source').innerHTML = `<strong>Merging from:</strong> ${ppEscapeHtml(source.name)} <span class="tag">${(source.typeIds || []).length} sub-type${(source.typeIds || []).length===1?'':'s'}</span>`;
  const search = document.getElementById('ingredient-group-merge-search');
  search.placeholder = 'Search target ingredient';
  search.value = '';
  const mergeSel = document.getElementById('ingredient-group-merge-selection');
  if(mergeSel) mergeSel.style.display = 'none';
  document.getElementById('ingredient-group-merge-confirm').disabled = true;
  document.getElementById('ingredient-group-merge-confirm').onclick = confirmIngredientFamilyMerge;
  renderIngredientFamilyMergeOptions('');
  search.oninput = () => renderIngredientFamilyMergeOptions(search.value);
  wrap.classList.add('open');
  setTimeout(()=>search.focus(),0);
}

function renderIngredientFamilyMergeOptions(query = ''){
  const listEl = document.getElementById('ingredient-group-merge-options');
  const variants = getSearchVariants(query || '');
  let rows = (state.ingredientFamilies || []).filter(f => f.id !== ingredientFamilyMergeSourceId);
  if(variants.length) rows = rows.filter(f => variants.some(v => [f.name, ...(f.aliases || [])].join(' ').toLowerCase().includes(v)));
  rows = rows.slice(0,40);
  let typeRows = (state.ingredientGroups || []).filter(g => {
    const source = getIngredientFamily(ingredientFamilyMergeSourceId);
    if(source && g.ingredientId === source.id) return false;
    if(!variants.length) return true;
    return variants.some(v => [getGroupTypeName(g), getGroupIngredientName(g), ...(g.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(v));
  }).slice(0,40);
  const familyHtml = rows.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Ingredients</div>` + rows.map(f => `<button type="button" class="ingredient-group-merge-option" data-id="${ppEscapeHtml(f.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="selectIngredientFamilyMergeTarget('${ppEscapeHtml(f.id)}')">
    <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
  </button>`).join('') : '';
  const typeHtml = typeRows.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Sub-types</div>` + typeRows.map(g => `<button type="button" class="ingredient-group-merge-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="selectIngredientFamilyMergeGroupTarget('${ppEscapeHtml(g.id)}')">
    <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(getGroupIngredientName(g))}</span>
    <span class="tag">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')}</span>
    <div style="font-size:11px;color:var(--text2);margin-top:3px">Merge this ingredient's sub-types into this sub-type.</div>
  </button>`).join('') : '';
  listEl.innerHTML = familyHtml + typeHtml || '<div style="padding:12px;color:var(--text2);font-size:12px">No matching ingredients or sub-types found.</div>';
}

function selectIngredientFamilyMergeTarget(targetFamilyId){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  const target = getIngredientFamily(targetFamilyId);
  if(!source || !target) return;
  ingredientFamilyMergeTargetId = target.id;
  ingredientFamilyMergeTargetKind = 'family';
  const selection = document.getElementById('ingredient-group-merge-selection');
  selection.innerHTML = `<strong>${ppEscapeHtml(source.name)}</strong> will merge into <strong>${ppEscapeHtml(target.name)}</strong>. Sub-types, products, aliases, and recipe mappings will be preserved.`;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
}

function selectIngredientFamilyMergeGroupTarget(targetGroupId){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target) return;
  ingredientFamilyMergeTargetId = target.id;
  ingredientFamilyMergeTargetKind = 'group';
  const selection = document.getElementById('ingredient-group-merge-selection');
  selection.innerHTML = `<strong>${ppEscapeHtml(source.name)}</strong> will merge into sub-type <strong>${ppEscapeHtml(getGroupTypeName(target))}</strong>. All source sub-types, products, aliases, and recipe mappings will be moved into that sub-type.`;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
}

function confirmIngredientFamilyMerge(){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  if(!source) return;
  const targetName = ingredientFamilyMergeTargetKind === 'group'
    ? getGroupTypeName(getIngredientGroup(ingredientFamilyMergeTargetId) || {})
    : (getIngredientFamily(ingredientFamilyMergeTargetId)?.name || 'another ingredient');
  runWithRecoveryPoint(`Before merging ${source.name} into ${targetName}`, applyIngredientFamilyMerge);
}

function applyIngredientFamilyMerge(){
  const source = getIngredientFamily(ingredientFamilyMergeSourceId);
  if(!source) return;
  if(ingredientFamilyMergeTargetKind === 'group'){
    const merged = mergeIngredientFamilyIntoGroup(source.id, ingredientFamilyMergeTargetId);
    if(merged) closeIngredientGroupMergeModal();
    return;
  }
  const target = getIngredientFamily(ingredientFamilyMergeTargetId);
  if(!target) return;
  if(!Array.isArray(target.aliases)) target.aliases = [];
  if(!Array.isArray(target.typeIds)) target.typeIds = [];
  [source.name, ...(source.aliases || [])].filter(Boolean).forEach(alias => {
    if(!target.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) target.aliases.push(alias);
  });
  getFamilyGroups(source.id).forEach(group => {
    group.ingredientId = target.id;
    group.family = target.name;
    group.cat = target.cat || group.cat || 'other';
    if(!target.typeIds.includes(group.id)) target.typeIds.push(group.id);
  });
  state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  closeIngredientGroupMergeModal();
  refreshHierarchyViews();
}

function deleteIngredientFamilyPrompt(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const used = getFamilyGroups(family.id).flatMap(g => getIngredientGroupRecipeUsage(g.id));
  const wrap = ensureDeleteIngredientGroupModal();
  document.querySelector('#delete-ingredient-group-wrap h3').textContent = 'Delete ingredient?';
  document.getElementById('delete-ingredient-group-copy').innerHTML = used.length
    ? `<strong>${ppEscapeHtml(family.name)}</strong> is used by ${[...new Set(used)].length} recipe${[...new Set(used)].length===1?'':'s'}. Merge it into another ingredient before deleting.`
    : `Delete <strong>${ppEscapeHtml(family.name)}</strong>? Its sub-types will also be removed from the Ingredient Bank, but products will remain in Product Bank.`;
  document.getElementById('delete-ingredient-group-actions').innerHTML = used.length
    ? `<button class="btn primary" onclick="closeDeleteIngredientGroupModal(); mergeIngredientFamilyPrompt('${ppEscapeHtml(family.id)}')">Merge instead</button><button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`
    : `<button class="btn danger" onclick="confirmDeleteIngredientFamily('${ppEscapeHtml(family.id)}')">Delete ingredient</button><button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`;
  wrap.classList.add('open');
}

function confirmDeleteIngredientFamily(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const groups = getFamilyGroups(family.id);
  if(groups.some(g => getIngredientGroupRecipeUsage(g.id).length)) return;
  runWithRecoveryPoint(`Before deleting ingredient ${family.name}`, () => applyDeleteIngredientFamily(familyId));
}

function applyDeleteIngredientFamily(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  const groups = getFamilyGroups(family.id);
  groups.forEach(group => {
    const products = getGroupProducts(group.id);
    state.ingredientGroups = (state.ingredientGroups || []).filter(g => g.id !== group.id);
    products.forEach(product => {
      product.groupId = '';
    });
  });
  state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== family.id);
  ensureIngredientGroups();
  closeDeleteIngredientGroupModal();
  refreshHierarchyViews();
}

function openCategoryManagerModal(){
  ensureIngredientGroups();
  let wrap = document.getElementById('category-manager-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'category-manager-wrap';
    wrap.className = 'modal-wrap';
    wrap.style.zIndex = '440';
    wrap.innerHTML = `
      <div class="modal" style="max-width:760px">
        <div class="row-between" style="align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Manage categories</h3>
          <button class="btn sm ghost" onclick="closeCategoryManagerModal()">Close</button>
        </div>
        <div id="category-manager-list"></div>
        <div class="card-inner" style="margin-top:12px">
          <div style="font-weight:700;margin-bottom:8px">Create category</div>
          <div style="display:flex;gap:8px">
            <input id="category-manager-new-name" placeholder="e.g. Frozen foods">
            <button class="btn sm primary" onclick="createManagedCategory()">Create</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }
  renderCategoryManagerModal();
  wrap.classList.add('open');
}

function closeCategoryManagerModal(){
  document.getElementById('category-manager-wrap')?.classList.remove('open');
}

function renderCategoryManagerModal(){
  const list = document.getElementById('category-manager-list');
  if(!list) return;
  const cats = Object.entries(CAT).filter(([k,v]) => v).sort((a,b)=>a[1].localeCompare(b[1]));
  list.innerHTML = cats.map(([key,label]) => {
    const famCount = (state.ingredientFamilies || []).filter(f => f.cat === key).length;
    const productCount = (state.ingredients || []).filter(p => (getIngredientGroup(p.groupId)?.cat || p.cat || 'other') === key).length;
    const options = cats.filter(([k]) => k !== key).map(([k,v]) => `<option value="${ppEscapeHtml(k)}">${ppEscapeHtml(v)}</option>`).join('');
    return `<div class="card-inner" style="margin-bottom:8px">
      <div class="row-between" style="gap:10px;align-items:flex-start">
        <div style="flex:1">
          <div style="font-weight:700">${ppEscapeHtml(label)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px">${famCount} ingredient${famCount===1?'':'s'} · ${productCount} product${productCount===1?'':'s'}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <input id="cat-rename-${ppEscapeAttr(key)}" value="${ppEscapeAttr(label)}" style="max-width:220px">
            <button class="btn sm ghost" onclick="renameManagedCategory('${ppEscapeAttr(key)}')">Rename</button>
            <select id="cat-merge-${ppEscapeAttr(key)}" style="max-width:220px">${options}</select>
            <button class="btn sm ghost" onclick="mergeManagedCategory('${ppEscapeAttr(key)}')">Merge into</button>
            <button class="btn sm danger" onclick="deleteManagedCategory('${ppEscapeAttr(key)}')">Delete/reassign</button>
          </div>
          <div id="cat-msg-${ppEscapeAttr(key)}" style="font-size:11px;margin-top:6px"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function createManagedCategory(){
  const name = normaliseAliasText(document.getElementById('category-manager-new-name')?.value || '');
  if(!name) return;
  const slug = canonicalGroupKey(name).replace(/\s+/g, '-') || ('cat-' + Date.now());
  state.customCats[slug] = name;
  CAT[slug] = name;
  saveState();
  renderCategoryManagerModal();
  renderCatOptions('mi-cat','other'); renderCatOptions('pp-cat','other'); renderCatOptions('tp-cat','other'); renderCatOptions('mini-cat','other');
}

function renameManagedCategory(key){
  const name = normaliseAliasText(document.getElementById(`cat-rename-${key}`)?.value || '');
  if(!name) return;
  state.customCats[key] = name;
  CAT[key] = name;
  saveState();
  renderCategoryManagerModal();
  renderIngredientBank();
  renderBank();
}

function moveCategoryAssignments(oldKey, targetKey){
  const nowIso = new Date().toISOString();
  (state.ingredientFamilies || []).forEach(f => { if(f.cat === oldKey) { f.cat = targetKey; f.updatedAt = nowIso; } });
  (state.ingredientGroups || []).forEach(g => { if(g.cat === oldKey) { g.cat = targetKey; g.updatedAt = nowIso; } });
  (state.ingredients || []).forEach(p => {
    if(p.cat === oldKey || getIngredientGroup(p.groupId)?.cat === oldKey) {
      p.cat = targetKey;
      p.updatedAt = nowIso;
    }
  });
  ensureIngredientFamilies();
}

function mergeManagedCategory(oldKey){
  const targetKey = document.getElementById(`cat-merge-${oldKey}`)?.value || '';
  if(!targetKey || targetKey === oldKey) return;
  runWithRecoveryPoint(`Before merging category ${CAT[oldKey] || oldKey}`, () => applyManagedCategoryMerge(oldKey, targetKey));
}

function applyManagedCategoryMerge(oldKey, targetKey){
  moveCategoryAssignments(oldKey, targetKey);
  state.customCats[oldKey] = null;
  delete CAT[oldKey];
  refreshHierarchyViews();
  renderCategoryManagerModal();
}

function deleteManagedCategory(oldKey){
  const targetKey = document.getElementById(`cat-merge-${oldKey}`)?.value || '';
  const msg = document.getElementById(`cat-msg-${oldKey}`);
  if(!targetKey){
    if(msg) msg.innerHTML = '<span style="color:var(--red)">Choose a category to reassign into first.</span>';
    return;
  }
  mergeManagedCategory(oldKey);
}


function renderBank(){
  ensureIngredientGroups();
  const groupsPanel = document.getElementById('bank-groups-panel');
  if(groupsPanel) groupsPanel.innerHTML = '';
  const filterEl = document.getElementById('cat-filter');
  if(!filterEl) return;
  const categoryFilters=['all',...new Set((state.ingredients||[]).map(i=>getIngredientGroup(i.groupId)?.cat || i.cat || 'other'))].sort((a,b)=>(CAT[a]||a).localeCompare(CAT[b]||b));
  const categoryHtml = categoryFilters.map(c=>`<div class="cf${activeCat===c?' active':''}" onclick="setCat('${ppEscapeHtml(c)}')">${ppEscapeHtml(c==='all'?'all':(CAT[c]||c))}</div>`).join('');
  const activeFamilyLabel = getProductBankFamilyFilterLabel(activeFamily);
  const familyOptions = getProductBankFamilyFilterOptions();
  filterEl.innerHTML = `
    <div style="width:100%;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-top:2px">Category</div>
    ${categoryHtml}
    <div style="width:100%;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;margin-top:6px">Ingredient</div>
    <div style="width:100%;display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
      <input type="search" id="bank-family-search" list="bank-family-options" placeholder="Search ingredient..." value="${ppEscapeAttr(productBankFamilySearchText || (activeFamily !== 'all' ? activeFamilyLabel : ''))}" oninput="handleProductBankFamilySearch(this.value)" onchange="selectProductBankFamilyFromSearch(this.value)" style="font-size:12px;padding:5px 10px;max-width:260px;flex:1;min-width:180px">
      <datalist id="bank-family-options">${familyOptions.map(opt => `<option value="${ppEscapeAttr(opt.label)}"></option>`).join('')}</datalist>
      ${activeFamily !== 'all' ? `<span class="tag">Ingredient: ${ppEscapeHtml(activeFamilyLabel)}</span><button class="btn sm ghost" onclick="clearProductBankFamilyFilter()">Clear</button>` : ''}
    </div>
  `;
  const sort=(document.getElementById('bank-sort')?.value) || 'name';
  const search=(document.getElementById('bank-search')?.value||'').trim();
  const searchVariants = getSearchVariants(search);
  
  const stateRef = getState();
  let ings=(stateRef.ingredients || []).filter(i=>{
      const group = getIngredientGroup(i.groupId);
      const effectiveCat = group?.cat || i.cat || 'other';
      if(productBankGroupFilterId && i.groupId !== productBankGroupFilterId && !getGroupProducts(productBankGroupFilterId).some(p => p.id === i.id)) return false;
      if(activeCat!=='all' && effectiveCat!==activeCat) return false;
      if(activeFamily!=='all' && familyKey(getProductFamily(i))!==activeFamily) return false;
      if(!search) return true;
      const bName = i.name.toLowerCase();
      const bBrand = (i.brand||'').toLowerCase();
      const gName = (group?.name || '').toLowerCase();
      const gFamily = (getProductFamily(i) || group?.family || '').toLowerCase();
      const gCat = (CAT[group?.cat] || group?.cat || i.cat || '').toLowerCase();
      const gHierarchy = getGroupHierarchyText(group || { cat:i.cat, family:getProductFamily(i), name:i.name }).toLowerCase();
      const gAliases = (group?.aliases || []).join(' ').toLowerCase();
      return searchVariants.some(v => bName.includes(v) || bBrand.includes(v) || gName.includes(v) || gFamily.includes(v) || gCat.includes(v) || gHierarchy.includes(v) || gAliases.includes(v));
  });
  
  if(productBankFamilyFilterId){
      const productIds = new Set(getFamilyProducts(productBankFamilyFilterId).map(p => p.id));
      ings = ings.filter(i => productIds.has(i.id));
  }
  if(sort==='prot')ings.sort((a,b)=>b.prot-a.prot);
  else if(sort==='cal')ings.sort((a,b)=>a.cal-b.cal);
  else if(sort==='prot_kcal')ings.sort((a,b)=>{
      const effA = a.cal ? (a.prot/a.cal)*100 : 0;
      const effB = b.cal ? (b.prot/b.cal)*100 : 0;
      return effB - effA;
  });
  else if(sort==='value')ings.sort((a,b)=>scoreProductByPriority(b, 'protein_per_pound') - scoreProductByPriority(a, 'protein_per_pound'));
  else ings.sort((a,b)=>a.name.localeCompare(b.name));
  const bankSignature=[activeCat,activeFamily,productBankGroupFilterId||'',productBankFamilyFilterId||'',search,sort].join('|');
  if (typeof resetProgressiveList === 'function') {
    resetProgressiveList('bank',bankSignature);
  }
  const totalProducts=ings.length;
  const listLimit = (typeof window !== 'undefined' && window.platePlanListLimits?.bank) || (typeof platePlanListLimits !== 'undefined' && platePlanListLimits?.bank) || 30;
  const visibleProducts=ings.slice(0, listLimit);
  
  const el=document.getElementById('bank-list');
  if(!el) return;
  const groupFilter = productBankGroupFilterId ? getIngredientGroup(productBankGroupFilterId) : null;
  const familyFilter = productBankFamilyFilterId ? getIngredientFamily(productBankFamilyFilterId) : null;
  const groupFilterHtml = groupFilter ? `<div class="card" style="margin-bottom:12px;background:var(--surface2)">
    <div class="row-between" style="gap:10px;align-items:center">
      <div>
        <div style="font-weight:700;font-size:13px">Products for ${ppEscapeHtml(getGroupTypeName(groupFilter))}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(groupFilter))} · ${ings.length} product${ings.length===1?'':'s'} linked to this type</div>
      </div>
      <button class="btn sm ghost" onclick="clearProductGroupFilter()">Show all products</button>
    </div>
  </div>` : familyFilter ? `<div class="card" style="margin-bottom:12px;background:var(--surface2)">
    <div class="row-between" style="gap:10px;align-items:center">
      <div>
        <div style="font-weight:700;font-size:13px">Products for ${ppEscapeHtml(familyFilter.name)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:3px">${ppEscapeHtml(CAT[familyFilter.cat] || familyFilter.cat || 'Other')} > ${ppEscapeHtml(familyFilter.name)} · ${ings.length} product${ings.length===1?'':'s'} linked to this ingredient</div>
      </div>
      <button class="btn sm ghost" onclick="clearProductFamilyFilter()">Show all products</button>
    </div>
  </div>` : '';
  if(!ings.length){el.innerHTML=groupFilterHtml + '<div class="empty">No products found.</div>';return;}
  
  const progBtn = typeof progressiveListButton === 'function' ? progressiveListButton('bank',totalProducts,visibleProducts.length) : '';
  el.innerHTML=groupFilterHtml + visibleProducts.map(ing=>{
    const p=ing.prot||0;
    const protDensity = ing.cal ? (p / ing.cal) * 100 : 0; // g protein per 100 kcal
    const rank = protDensity >= 10 ? 'high' : protDensity >= 5 ? 'mid' : 'low';
    const packInGrams = typeof productPackGrams === 'function' ? productPackGrams(ing) : 100;
    const pricePer100=ing.price&&packInGrams?((ing.price/packInGrams)*100).toFixed(1):null;
    const ppenny=ing.price&&packInGrams?((p*packInGrams/100)/ing.price).toFixed(1):null;
    const pkcal=ing.cal?((p/ing.cal)*100).toFixed(1):null;
    const formattedPackSize = formatProductPackSummary(ing);
    const variantLabels = typeof getIngredientPackVariantLabels === 'function' ? getIngredientPackVariantLabels(ing) : [];
    const group = getIngredientGroup(ing.groupId);
    const isDefaultProduct = group && group.defaultProductId === ing.id;
    const hierarchy = group ? getGroupHierarchyText(group) : `${CAT[ing.cat] || ing.cat || 'Other'} > ${getProductFamily(ing)} > Unassigned type`;
    const basisWarning = typeof isPowderOrSupplementProduct === 'function' && isPowderOrSupplementProduct(ing) && (+ing.cal > 0 && +ing.cal < 200 && +ing.prot > 0 && +ing.prot < 40)
      ? `<div class="msg warn" style="font-size:11px;margin:6px 0 0;padding:6px 8px">Check nutrition basis: powders/supplements must be stored per 100g/ml, not per scoop.</div>`
      : '';
    
    return`<div class="bank-card"><div class="product-card-layout"><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600;overflow-wrap:break-word">${ing.name}</div>${ing.brand&&ing.brand!=='Generic'?`<div style="font-size:12px;color:var(--text2);margin-bottom:4px">${ing.brand}</div>`:''}<div style="font-size:11px;color:var(--text3);margin:3px 0;overflow-wrap:break-word">${ppEscapeHtml(hierarchy)}</div><div class="row-center" style="margin:4px 0;gap:5px"><span class="rank rank-${rank}" title="${protDensity.toFixed(1)}g protein per 100 kcal">${protDensity>=15?'Very high protein':protDensity>=10?'High protein':protDensity>=5?'Medium protein':'Lower protein'}</span><span class="tag" title="Category">${ppEscapeHtml(CAT[group?.cat || ing.cat]||group?.cat||ing.cat||'Other')}</span><span class="tag" title="Ingredient">${ppEscapeHtml(getProductFamily(ing))}</span>${group?`<span class="tag" title="Type">Type: ${ppEscapeHtml(getGroupTypeName(group))}</span>`:''}${isDefaultProduct?`<span class="tag green" title="Automatic default product: highest protein per 100 kcal in this type">Auto default</span>`:''}${ing.storage ? `<span class="tag" style="text-transform:capitalize;">${ing.storage}</span>` : ''}</div><div class="macro-bar"><span class="mpill p">P <span>${p}g</span></span><span class="mpill"><span>${ing.cal}</span> kcal</span><span class="mpill">C <span>${ing.carb}g</span></span><span class="mpill">F <span>${ing.fat}g</span></span></div>${basisWarning}<div class="row-center" style="margin-top:5px; gap:8px;">${pkcal?`<span style="font-size:11px;color:var(--blue)"><strong>${pkcal}g</strong> P / 100kcal</span>`:''}${ppenny?`<span style="font-size:11px;color:var(--blue)"><strong>${ppenny}g</strong> P / &pound;</span>`:''}</div>${ing.notes?`<div style="font-size:12px;color:var(--text2);margin-top:4px">${ing.notes}</div>`:''}${ing.price&&ing.packSize?`<div style="font-size:12px;color:var(--text2);margin-top:4px;">&pound;${ing.price.toFixed(2)} for ${formattedPackSize}</div>`:''}${variantLabels.length>1?`<div style="font-size:11px;color:var(--text2);margin-top:4px;"><strong>Pack variants:</strong> ${variantLabels.map(ppEscapeHtml).join(' · ')}</div>`:''}${ing.sourceUrl?`<div style="font-size:11px;margin-top:4px;"><a href="${ing.sourceUrl}" target="_blank" rel="noopener" style="color:var(--blue);text-decoration:underline">View on Tesco ↗</a></div>`:''}</div><div class="product-card-actions"><button class="btn sm ghost desktop-only-mobile-hide" onclick="editIng('${ing.id}')">Edit</button><button class="btn sm ghost desktop-only-mobile-hide" onclick="openProductReallocationModal('${ing.id}')">Reallocate</button><button class="btn sm danger desktop-only-mobile-hide" onclick="deleteIng('${ing.id}')">Delete</button><button class="btn sm ghost mobile-only-action" onclick="editIng('${ing.id}')">Edit product</button><button class="btn sm ghost mobile-only-action" onclick="openProductBankActions('${ing.id}')">More</button></div></div></div>`;
  }).join('')+progBtn;
}

function getProductBankFamilyFilterOptions(){
  return getKnownFamilies().map(label => ({ key: familyKey(label), label })).concat([{ key:'no-ingredient', label:'No ingredient' }]);
}

function getProductBankFamilyFilterLabel(key){
  if(!key || key === 'all') return 'all';
  const match = getProductBankFamilyFilterOptions().find(opt => opt.key === key || canonicalGroupKey(opt.label) === canonicalGroupKey(key));
  return match?.label || key;
}

function handleProductBankFamilySearch(value){
  productBankFamilySearchText = value || '';
}

function selectProductBankFamilyFromSearch(value){
  const raw = String(value || '').trim();
  if(!raw) return;
  const match = getProductBankFamilyFilterOptions().find(opt => canonicalGroupKey(opt.label) === canonicalGroupKey(raw) || opt.key === familyKey(raw));
  if(match) {
    productBankFamilySearchText = match.label;
    setFamilyFilter(match.key);
  }
}

function clearProductBankFamilyFilter(){
  productBankFamilySearchText = '';
  setFamilyFilter('all');
}

function renderIngredientGroupsPanel(){
  const el = document.getElementById('bank-groups-panel');
  if(!el) return;
  const groups = (state.ingredientGroups || []).slice().sort((a,b)=>
    (CAT[a.cat] || a.cat || 'Other').localeCompare(CAT[b.cat] || b.cat || 'Other') ||
    getGroupIngredientName(a).localeCompare(getGroupIngredientName(b)) ||
    getGroupTypeName(a).localeCompare(getGroupTypeName(b))
  );
  const suggestions = getSuggestedGroupMerges();
  const suggestionHtml = suggestions.length ? `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin:8px 0 12px">
    <div style="font-weight:700;margin-bottom:6px">Suggested group merges</div>
    ${suggestions.slice(0,8).map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:7px 0">
      <div><strong>${ppEscapeHtml(s.name)}</strong><div style="font-size:11px;color:var(--text2)">${s.products.map(p=>ppEscapeHtml(p.name)).join(' | ')}</div></div>
      <div class="row-center" style="justify-content:flex-end">
        <button class="btn sm ghost" onclick="mergeSuggestedIngredientGroup('${ppEscapeHtml(s.key)}')">Merge</button>
        <button class="btn sm ghost" onclick="ignoreGroupMergeSuggestion('${ppEscapeHtml(s.key)}')">Ignore</button>
      </div>
    </div>`).join('')}
  </div>` : '';
  const rows = groups.map(g => {
    const products = getGroupProducts(g.id);
    const defaultProduct = getProduct(g.defaultProductId);
    return `<div style="display:grid;grid-template-columns:minmax(160px,1fr) 110px minmax(180px,1.4fr) auto;gap:8px;align-items:center;border-top:1px solid var(--border);padding:8px 0;font-size:12px">
      <div><strong>${ppEscapeHtml(getGroupTypeName(g))}</strong><div style="color:var(--text2);font-size:11px">${ppEscapeHtml(getGroupHierarchyText(g))}</div></div>
      <div style="color:var(--text2)">${products.length} product${products.length===1?'':'s'}</div>
      <div style="color:var(--text2);font-size:11px">${defaultProduct ? `Auto: ${ppEscapeHtml(defaultProduct.name)} · ${getProductProteinPer100Kcal(defaultProduct).toFixed(1)}g P/100kcal` : 'No default product'}</div>
      <div class="row-center" style="justify-content:flex-end">
        <button class="btn sm ghost" onclick="renameIngredientGroupPrompt('${g.id}')">Type</button>
        <button class="btn sm ghost" onclick="editGroupAliasesPrompt('${g.id}')">Aliases</button>
        <button class="btn sm ghost" onclick="editGroupFamilyPrompt('${g.id}')">Ingredient</button>
        <button class="btn sm ghost" onclick="mergeIngredientGroupPrompt('${g.id}')">Merge</button>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<details class="card" style="margin-bottom:12px">
    <summary style="cursor:pointer;font-size:13px;font-weight:700">Ingredient types (${groups.length})</summary>
    <div style="font-size:12px;color:var(--text2);margin:8px 0 10px">Recipes map to these types. Meal plans and shopping lists resolve each type to a selected product.</div>
    ${suggestionHtml}
    ${rows || '<div class="empty">No groups yet.</div>'}
  </details>`;
}

function getSuggestedGroupMerges(){
  const buckets = {};
  const ignored = new Set(state.ignoredGroupMergeSuggestions || []);
  (state.ingredients || []).forEach(product => {
    const name = canonicalGroupNameFromProduct(product);
    const key = canonicalGroupKey(name);
    if(!key) return;
    if(!buckets[key]) buckets[key] = { key, name, products: [], groupIds: new Set() };
    buckets[key].products.push(product);
    if(product.groupId) buckets[key].groupIds.add(product.groupId);
  });
  return Object.values(buckets)
    .filter(b => b.products.length > 1 && b.groupIds.size > 1 && !ignored.has(b.key))
    .sort((a,b) => b.products.length - a.products.length || a.name.localeCompare(b.name));
}

function ignoreGroupMergeSuggestion(key){
  if(!key) return;
  if(!Array.isArray(state.ignoredGroupMergeSuggestions)) state.ignoredGroupMergeSuggestions = [];
  if(!state.ignoredGroupMergeSuggestions.includes(key)) state.ignoredGroupMergeSuggestions.push(key);
  saveState();
  renderIngredientBank();
  renderIngredientGroupsPanel();
  renderDataQuality();
}

function mergeSuggestedIngredientGroup(key){
  const suggestion = getSuggestedGroupMerges().find(s => s.key === key);
  if(!suggestion) return;
  openGroupPickerModal({ type:'suggestedMerge', suggestionKey:key, defaultName:suggestion.name });
}

function createIngredientGroupPrompt(){
  openIngredientGroupDetailsModal(null, 'create');
}

function assignProductToGroupPrompt(productId){
  const product = getProduct(productId);
  if(!product) return;
  openProductGroupPickerModal(product.id);
}



function ensureGroupPickerModal(){
  let wrap = document.getElementById('ingredient-group-picker-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-group-picker-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="ingredient-group-picker-title" style="margin:0">Choose type</h3>
        <button class="btn sm ghost" onclick="closeGroupPickerModal()">Close</button>
      </div>
      <div id="ingredient-group-picker-copy" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="btn-row" style="margin-bottom:10px">
        <button type="button" class="btn sm ghost" id="group-picker-mode-ingredient" onclick="setGroupPickerMode('ingredient')">Assign To Ingredient</button>
        <button type="button" class="btn sm ghost" id="group-picker-mode-type" onclick="setGroupPickerMode('type')">Assign To Sub-type</button>
      </div>
      <div class="field">
        <label id="ingredient-group-picker-search-label">Search ingredient bank</label>
        <input type="search" id="ingredient-group-picker-search" placeholder="Search category, ingredient, type, alias, product, or brand" oninput="renderGroupPickerOptions(this.value)">
      </div>
      <div class="field" id="ingredient-group-picker-parent-field" style="display:none">
        <label>Parent ingredient for new sub-type</label>
        <input type="search" id="ingredient-group-picker-parent" list="ingredient-group-picker-parent-options" placeholder="Search or type parent ingredient, e.g. Pasta" oninput="renderGroupPickerParentOptions(this.value); syncGroupPickerCreateButton()">
        <datalist id="ingredient-group-picker-parent-options"></datalist>
      </div>
      <div id="ingredient-group-picker-options" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div class="btn-row">
        <button class="btn primary" id="ingredient-group-picker-create-btn" onclick="createGroupFromPickerSearch()">Create new sub-type from typed name</button>
        <button class="btn ghost" onclick="closeGroupPickerModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openProductGroupPickerModal(productId, defaultName = ''){
  const product = getProduct(productId);
  if(!product) return;
  const current = getIngredientGroup(product.groupId);
  openGroupPickerModal({
    type:'product',
    productId,
    defaultName: defaultName || current?.name || canonicalGroupNameFromProduct(product),
    title:'Assign product',
    copy:`Choose whether <strong>${ppEscapeHtml(product.name)}</strong> belongs directly to an ingredient, or to a sub-type under an ingredient.`,
    mode:'ingredient'
  });
}

function openGroupPickerModal(context){
  ingredientGroupPickerContext = context || {};
  ingredientGroupPickerMode = context.mode || (context.type === 'product' ? 'ingredient' : 'type');
  const wrap = ensureGroupPickerModal();
  const title = context.title || (context.type === 'suggestedMerge' ? 'Merge suggested products' : 'Choose type');
  const copy = context.copy || (context.type === 'suggestedMerge'
    ? 'Choose the ingredient type these products should sit under, or create a new one.'
    : 'Choose an ingredient type, or create a new one.');
  document.getElementById('ingredient-group-picker-title').textContent = title;
  document.getElementById('ingredient-group-picker-copy').innerHTML = copy;
  const search = document.getElementById('ingredient-group-picker-search');
  search.value = context.defaultName || '';
  const parent = document.getElementById('ingredient-group-picker-parent');
  if(parent) parent.value = '';
  syncGroupPickerModeUi();
  renderGroupPickerParentOptions('');
  renderGroupPickerOptions(search.value);
  wrap.classList.add('open');
  setTimeout(() => {
    search.focus();
    search.select?.();
  }, 0);
}

function closeGroupPickerModal(){
  const wrap = document.getElementById('ingredient-group-picker-wrap');
  if(wrap) wrap.classList.remove('open');
  ingredientGroupPickerContext = null;
}

function setGroupPickerMode(mode){
  ingredientGroupPickerMode = mode === 'ingredient' ? 'ingredient' : 'type';
  syncGroupPickerModeUi();
  renderGroupPickerOptions(document.getElementById('ingredient-group-picker-search')?.value || '');
}

function syncGroupPickerModeUi(){
  const isIngredient = ingredientGroupPickerMode === 'ingredient';
  const ingredientBtn = document.getElementById('group-picker-mode-ingredient');
  const typeBtn = document.getElementById('group-picker-mode-type');
  if(ingredientBtn) ingredientBtn.classList.toggle('primary', isIngredient);
  if(typeBtn) typeBtn.classList.toggle('primary', !isIngredient);
  const label = document.getElementById('ingredient-group-picker-search-label');
  if(label) label.textContent = isIngredient ? 'Search or create ingredient' : 'Search or create sub-type';
  const search = document.getElementById('ingredient-group-picker-search');
  if(search) search.placeholder = isIngredient ? 'Search ingredient, category, alias, product, or brand' : 'Search sub-type, ingredient, alias, product, or brand';
  const parentField = document.getElementById('ingredient-group-picker-parent-field');
  if(parentField) parentField.style.display = isIngredient ? 'none' : 'block';
  const createBtn = document.getElementById('ingredient-group-picker-create-btn');
  if(createBtn) createBtn.textContent = isIngredient ? 'Create/assign ingredient from typed name' : 'Create new sub-type from typed name';
  syncGroupPickerCreateButton();
}

function renderGroupPickerParentOptions(query = ''){
  const list = document.getElementById('ingredient-group-picker-parent-options');
  if(!list) return;
  const q = normaliseAliasText(query || '');
  const variants = getSearchVariants(q);
  let rows = (state.ingredientFamilies || []).slice();
  if(variants.length){
    rows = rows.filter(f => variants.some(v => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].join(' ').toLowerCase().includes(v)));
  }
  rows = rows.sort((a,b)=>(CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0,30);
  list.innerHTML = rows.map(f => `<option value="${ppEscapeAttr(f.name)}"></option>`).join('');
}

function syncGroupPickerCreateButton(){
  const btn = document.getElementById('ingredient-group-picker-create-btn');
  if(!btn) return;
  const search = normaliseAliasText(document.getElementById('ingredient-group-picker-search')?.value || '');
  const parent = normaliseAliasText(document.getElementById('ingredient-group-picker-parent')?.value || '');
  const needsParent = ingredientGroupPickerMode !== 'ingredient';
  btn.disabled = !search || (needsParent && !parent);
  btn.style.opacity = btn.disabled ? '0.55' : '';
  btn.title = btn.disabled && needsParent ? 'Choose or type a parent ingredient before creating a new sub-type.' : '';
}

function renderGroupPickerOptions(query){
  const listEl = document.getElementById('ingredient-group-picker-options');
  if(!listEl) return;
  syncGroupPickerCreateButton();
  ensureIngredientGroups();
  const q = (query || '').trim();
  if(ingredientGroupPickerMode === 'ingredient'){
    const variants = getSearchVariants(q);
    let rows = (state.ingredientFamilies || []).slice();
    if(q) {
      rows = rows.filter(f => variants.some(v => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].join(' ').toLowerCase().includes(v)));
    }
    rows = rows.sort((a,b) => (CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0, 40);
    if(!rows.length){
      listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching ingredients found. Use Create/assign ingredient from typed name below.</div>';
      return;
    }
    listEl.innerHTML = rows.map(f => {
      const groups = getFamilyGroups(f.id);
      const defaultGroup = getIngredientGroup(f.defaultTypeId) || groups[0] || null;
      const defaultProduct = defaultGroup ? resolveProductForIngredient({ groupId: defaultGroup.id }).product : null;
      return `
        <button type="button" class="ingredient-group-picker-option" data-family-id="${ppEscapeHtml(f.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
            <span class="tag">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
            <span class="tag">${groups.length} sub-type${groups.length===1?'':'s'}</span>
          </div>
          ${defaultProduct ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Default product:</strong> ${ppEscapeHtml(defaultProduct.name)} · ${getProductProteinPer100Kcal(defaultProduct).toFixed(1)}g protein / 100kcal</div>` : ''}
        </button>`;
    }).join('');
    listEl.querySelectorAll('.ingredient-group-picker-option').forEach(btn => {
      btn.onclick = () => chooseFamilyPickerTarget(btn.dataset.familyId);
      btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
      btn.onmouseleave = () => btn.style.background = 'var(--surface)';
    });
    return;
  }
  let rows = q
    ? findIngredientGroupsByText(q)
    : (state.ingredientGroups || []).map(g => ({ group:g, text:getIngredientGroupSearchText(g), products:getGroupProducts(g.id) })).sort((a,b)=>a.group.name.localeCompare(b.group.name));
  rows = rows.slice(0, 40);
  if(!rows.length){
    listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching types found. Use Create new type from typed name below.</div>';
    return;
  }
  listEl.innerHTML = rows.map(row => {
    const g = row.group;
    const defaultProduct = getProduct(g.defaultProductId) || row.products[0] || null;
    return `
      <button type="button" class="ingredient-group-picker-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
          <span class="tag">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')}</span>
          <span class="tag">${ppEscapeHtml(getGroupIngredientName(g))}</span>
          <span class="tag">${row.products.length} product${row.products.length===1?'':'s'}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
        ${defaultProduct ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Auto default:</strong> ${ppEscapeHtml(defaultProduct.name)} · ${getProductProteinPer100Kcal(defaultProduct).toFixed(1)}g protein / 100kcal</div>` : ''}
      </button>`;
  }).join('');
  listEl.querySelectorAll('.ingredient-group-picker-option').forEach(btn => {
    btn.onclick = () => chooseGroupPickerTarget(btn.dataset.id);
    btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
    btn.onmouseleave = () => btn.style.background = 'var(--surface)';
  });
}

function createGroupFromPickerSearch(){
  const search = normaliseAliasText(document.getElementById('ingredient-group-picker-search')?.value || ingredientGroupPickerContext?.defaultName || '');
  if(!search) return;
  if(ingredientGroupPickerMode === 'ingredient'){
    const product = getProduct(ingredientGroupPickerContext?.productId);
    const cat = product?.cat || 'other';
    const family = ensureIngredientFamilyByName(search, cat);
    chooseFamilyPickerTarget(family.id);
    return;
  }
  const existing = (state.ingredientGroups || []).find(g => canonicalGroupKey(g.name) === canonicalGroupKey(search));
  if(existing) {
    chooseGroupPickerTarget(existing.id);
    return;
  }
  const product = getProduct(ingredientGroupPickerContext?.productId);
  const parentName = normaliseAliasText(document.getElementById('ingredient-group-picker-parent')?.value || '');
  const msg = document.getElementById('ingredient-group-picker-copy');
  if(!parentName){
    if(msg) msg.innerHTML = '<span style="color:var(--red);font-weight:600">Choose or type the parent ingredient before creating a new sub-type.</span>';
    return;
  }
  const family = ensureIngredientFamilyByName(parentName, product?.cat || 'other');
  const group = {
    id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
    name:toTitleCase(search),
    cat:(family.cat && family.cat !== 'other') ? family.cat : (product?.cat || family.cat || 'other'),
    family:family.name,
    ingredientId:family.id,
    aliases:[search],
    defaultProductId:null,
    productIds:[],
    notes:''
  };
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  family.typeIds.push(group.id);
  if(!family.defaultTypeId) family.defaultTypeId = group.id;
  syncIngredientGroupAliases(group, []);
  state.ingredientGroups.push(group);
  chooseGroupPickerTarget(group.id);
}

function ensureIngredientFamilyByName(name, cat = 'other'){
  ensureIngredientGroups();
  const clean = normaliseAliasText(name || 'Ingredient');
  const key = canonicalGroupKey(clean);
  let family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === key && (!cat || f.cat === cat));
  if(!family && cat && cat !== 'other'){
    family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === key && (!f.cat || f.cat === 'other'));
  }
  if(!family) {
    let id = ingredientFamilyIdFromName(clean, cat || 'other');
    if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
    family = { id, name: toTitleCase(clean), cat: cat || 'other', aliases: [clean], notes: '', typeIds: [], defaultTypeId: '' };
    state.ingredientFamilies.push(family);
  } else if(cat && cat !== 'other' && (!family.cat || family.cat === 'other')) {
    family.cat = cat;
  }
  if(!Array.isArray(family.aliases)) family.aliases = [];
  if(!family.aliases.some(a => canonicalGroupKey(a) === key)) family.aliases.push(family.name);
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  return family;
}

function ensureDefaultGroupForFamily(family, product = null){
  if(!family) return null;
  let group = getIngredientGroup(family.defaultTypeId) || (state.ingredientGroups || []).find(g => g.ingredientId === family.id && canonicalGroupKey(g.name) === canonicalGroupKey(family.name));
  if(!group){
    group = {
      id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
      name:toTitleCase(family.name),
      cat:family.cat || product?.cat || 'other',
      family:family.name,
      ingredientId:family.id,
      aliases:[family.name],
      defaultProductId:null,
      productIds:[],
      notes:'',
      defaultSubType:true
    };
    state.ingredientGroups.push(group);
  }
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
  family.defaultTypeId = group.id;
  group.family = family.name;
  group.ingredientId = family.id;
  group.cat = (family.cat && family.cat !== 'other') ? family.cat : (product?.cat && product.cat !== 'other') ? product.cat : (group.cat || family.cat || 'other');
  if(product) syncProductHierarchyCategory(product, group, product.cat);
  return group;
}

function chooseFamilyPickerTarget(familyId){
  const family = getIngredientFamily(familyId);
  if(!family || !ingredientGroupPickerContext) return;
  const product = getProduct(ingredientGroupPickerContext.productId);
  const group = ensureDefaultGroupForFamily(family, product);
  if(product && group){
    ensureProductAssignedToGroup(product, group.name, group.id);
    syncProductHierarchyCategory(product, group, product.cat);
    refreshProductGroupAndRecipes(product.id);
  }
  refreshAutoDefaultProductForGroup(group.id);
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
  closeGroupPickerModal();
}

function chooseGroupPickerTarget(groupId){
  const group = getIngredientGroup(groupId);
  if(!group || !ingredientGroupPickerContext) return;
  if(ingredientGroupPickerContext.type === 'product'){
    const product = getProduct(ingredientGroupPickerContext.productId);
    if(product){
      ensureProductAssignedToGroup(product, group.name, group.id);
      syncProductHierarchyCategory(product, group, product.cat);
      refreshProductGroupAndRecipes(product.id);
    }
  } else if(ingredientGroupPickerContext.type === 'suggestedMerge'){
    const suggestion = getSuggestedGroupMerges().find(s => s.key === ingredientGroupPickerContext.suggestionKey);
    (suggestion?.products || []).forEach(product => {
      ensureProductAssignedToGroup(product, group.name, group.id);
      syncProductHierarchyCategory(product, group, product.cat);
      refreshProductGroupAndRecipes(product.id);
    });
  }
  refreshAutoDefaultProductForGroup(group.id);
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
  closeGroupPickerModal();
}

function setGroupDefaultProduct(groupId, productId){
  const group = getIngredientGroup(groupId);
  const product = getProduct(productId);
  if(!group || !product) return;
  ensureProductAssignedToGroup(product, group.name, group.id);
  group.manualDefaultProductId = product.id;
  group.defaultProductId = product.id;
  refreshProductGroupAndRecipes(product.id);
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
}

function renderEditProductLinkage(ing){
  const el = document.getElementById('mi-linkage-container');
  if(!el || !ing) return;
  const group = getIngredientGroup(ing.groupId);
  const family = group ? getGroupIngredientFamily(group) : null;
  if(group){
    el.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div class="row-between" style="align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em">Linked Ingredient & Sub-type</div>
            <div style="font-size:13px;font-weight:600;margin-top:2px;color:var(--text)">
              ${ppEscapeHtml(family?.name || group.family || 'Ingredient')} &rarr; <span style="color:var(--green)">${ppEscapeHtml(getGroupTypeName(group))}</span>
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(getGroupHierarchyText(group))}</div>
          </div>
          <div class="btn-row" style="margin:0;gap:6px">
            <button type="button" class="btn sm ghost" onclick="openProductReallocationModal('${ppEscapeHtml(ing.id)}')">Reallocate</button>
            <button type="button" class="btn sm danger ghost" onclick="confirmDelinkProduct('${ppEscapeHtml(ing.id)}')">Delink</button>
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div class="row-between" style="align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.04em">Ingredient Linkage</div>
            <div style="font-size:13px;color:var(--text2);margin-top:2px">Standalone product (not linked to any ingredient)</div>
          </div>
          <div class="btn-row" style="margin:0">
            <button type="button" class="btn sm primary" onclick="openProductReallocationModal('${ppEscapeHtml(ing.id)}')">Link to Ingredient</button>
          </div>
        </div>
      </div>`;
  }
}



function ensureProductReallocationModal(){
  let wrap = document.getElementById('product-reallocation-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'product-reallocation-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '450';
  wrap.innerHTML = `
    <div class="modal" style="max-width:580px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;">
      <div class="row-between" style="align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
        <div>
          <h3 id="product-reallocation-title" style="margin:0;font-size:16px">Reallocate Product</h3>
          <div id="product-reallocation-subtitle" style="font-size:12px;color:var(--text2);margin-top:2px"></div>
        </div>
        <button class="btn sm ghost" onclick="closeProductReallocationModal()">&times;</button>
      </div>
      <div id="product-reallocation-body" style="overflow-y:auto;flex:1;padding-right:4px;">
        <div id="product-reallocation-current" style="margin-bottom:12px;"></div>
        
        <!-- Option 1: Existing ingredient -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">Option 1: Allocate to Existing Ingredient / Sub-type</div>
          <input type="search" id="product-reallocation-search" placeholder="Search ingredient or sub-type..." oninput="filterReallocationOptions(this.value)" style="width:100%;padding:7px 10px;font-size:12px;margin-bottom:8px">
          <div id="product-reallocation-options" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)"></div>
        </div>

        <!-- Option 2: Invent new ingredient -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px">Option 2: Invent New Ingredient & Sub-type</div>
          <div class="grid2" style="gap:8px">
            <div>
              <label style="font-size:11px;font-weight:600">Ingredient Name</label>
              <input type="text" id="product-reallocation-new-family" placeholder="e.g. Tempeh" style="font-size:12px">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600">Sub-type Name</label>
              <input type="text" id="product-reallocation-new-type" placeholder="e.g. Smoked Tempeh" style="font-size:12px">
            </div>
          </div>
          <div style="margin-top:8px">
            <label style="font-size:11px;font-weight:600">Category</label>
            <select id="product-reallocation-new-cat" style="font-size:12px;width:100%"></select>
          </div>
          <button type="button" class="btn sm secondary" style="margin-top:10px;width:100%" onclick="saveProductReallocationToNewIngredient()">Create Ingredient & Allocate Product</button>
        </div>

        <!-- Delink standalone option -->
        <div id="product-reallocation-delink-row" style="margin-top:8px;text-align:right"></div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openProductReallocationModal(productId){
  const product = getProduct(productId);
  if(!product) return;
  activeReallocationProductId = productId;
  const wrap = ensureProductReallocationModal();

  document.getElementById('product-reallocation-title').textContent = `Reallocate "${product.name}"`;
  document.getElementById('product-reallocation-subtitle').textContent = product.brand && product.brand !== 'Generic' ? product.brand : 'Product reallocation';

  const group = getIngredientGroup(product.groupId);
  const family = group ? getGroupIngredientFamily(group) : null;
  const currentEl = document.getElementById('product-reallocation-current');
  if(group){
    currentEl.innerHTML = `<div style="font-size:12px;color:var(--text2)">Currently linked to: <strong>${ppEscapeHtml(family?.name || group.family)}</strong> &rarr; <span style="color:var(--green);font-weight:600">${ppEscapeHtml(getGroupTypeName(group))}</span></div>`;
  } else {
    currentEl.innerHTML = `<div style="font-size:12px;color:var(--text2)">Currently <strong>Standalone</strong> (not linked to any ingredient).</div>`;
  }

  // Populate categories
  const catSelect = document.getElementById('product-reallocation-new-cat');
  if(catSelect){
    catSelect.innerHTML = Object.entries(CAT).map(([k, v]) => `<option value="${ppEscapeAttr(k)}" ${k === (product.cat || 'other') ? 'selected' : ''}>${ppEscapeHtml(v)}</option>`).join('');
  }

  // Clear new ingredient inputs
  const famInput = document.getElementById('product-reallocation-new-family');
  const typeInput = document.getElementById('product-reallocation-new-type');
  if(famInput) famInput.value = family?.name || getProductFamily(product) || '';
  if(typeInput) typeInput.value = group ? getGroupTypeName(group) : product.name;

  // Render options list
  const searchInput = document.getElementById('product-reallocation-search');
  if(searchInput) searchInput.value = '';
  filterReallocationOptions('');

  // Delink button
  const delinkRow = document.getElementById('product-reallocation-delink-row');
  if(delinkRow){
    if(group){
      delinkRow.innerHTML = `<button type="button" class="btn sm danger ghost" onclick="confirmDelinkProduct('${ppEscapeHtml(product.id)}')">Delink product from ingredient (make standalone)</button>`;
    } else {
      delinkRow.innerHTML = '';
    }
  }

  wrap.classList.add('open');
  setTimeout(() => searchInput?.focus(), 50);
}

function closeProductReallocationModal(){
  const wrap = document.getElementById('product-reallocation-wrap');
  if(wrap) wrap.classList.remove('open');
  activeReallocationProductId = null;
}

function filterReallocationOptions(query = ''){
  const listEl = document.getElementById('product-reallocation-options');
  if(!listEl) return;
  ensureIngredientGroups();
  const q = String(query || '').trim().toLowerCase();
  const groups = (state.ingredientGroups || []).slice();

  let filtered = groups;
  if(q){
    const variants = getSearchVariants(q);
    filtered = groups.filter(g => {
      const gName = (g.name || '').toLowerCase();
      const gFam = (g.family || '').toLowerCase();
      const gCat = (CAT[g.cat] || g.cat || '').toLowerCase();
      const gAliases = (g.aliases || []).join(' ').toLowerCase();
      return variants.some(v => gName.includes(v) || gFam.includes(v) || gCat.includes(v) || gAliases.includes(v));
    });
  }

  filtered.sort((a,b) => (a.family||'').localeCompare(b.family||'') || (a.name||'').localeCompare(b.name||''));

  if(!filtered.length){
    listEl.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text2)">No matching ingredient sub-types found. Use Option 2 below to invent a new one.</div>';
    return;
  }

  listEl.innerHTML = filtered.slice(0, 35).map(g => {
    const isCurrent = activeReallocationProductId && getProduct(activeReallocationProductId)?.groupId === g.id;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);${isCurrent ? 'background:var(--surface2);' : ''}">
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600">${ppEscapeHtml(g.family || 'Ingredient')} &rarr; <span style="color:var(--green)">${ppEscapeHtml(getGroupTypeName(g))}</span></div>
          <div style="font-size:10px;color:var(--text3)">${ppEscapeHtml(CAT[g.cat] || g.cat || 'Other')} · ${(g.productIds||[]).length} product${(g.productIds||[]).length===1?'':'s'}</div>
        </div>
        <div>
          ${isCurrent 
            ? '<span class="tag green" style="font-size:11px">Current</span>' 
            : `<button type="button" class="btn sm primary" style="padding:3px 8px;font-size:11px" onclick="reallocateProductToExistingGroup('${ppEscapeHtml(activeReallocationProductId)}', '${ppEscapeHtml(g.id)}')">Allocate</button>`}
        </div>
      </div>`;
  }).join('');
}

function reallocateProductToExistingGroup(productId, targetGroupId){
  const product = getProduct(productId);
  const targetGroup = getIngredientGroup(targetGroupId);
  if(!product || !targetGroup) return;

  const nowIso = new Date().toISOString();
  const oldGroupId = product.groupId;
  if(oldGroupId && oldGroupId !== targetGroup.id){
    const oldGroup = getIngredientGroup(oldGroupId);
    if(oldGroup && Array.isArray(oldGroup.productIds)){
      oldGroup.productIds = oldGroup.productIds.filter(id => id !== product.id);
      oldGroup.updatedAt = nowIso;
    }
    refreshAutoDefaultProductForGroup(oldGroupId);
  }

  product.updatedAt = nowIso;
  targetGroup.updatedAt = nowIso;

  ensureProductAssignedToGroup(product, targetGroup.name, targetGroup.id);
  product.groupId = targetGroup.id;
  product.subTypeId = targetGroup.id;
  product.subType = targetGroup.name;
  if(targetGroup.ingredientId) product.ingredientId = targetGroup.ingredientId;
  else {
    const fam = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(targetGroup) : null;
    if(fam) product.ingredientId = fam.id;
  }
  syncProductHierarchyCategory(product, targetGroup, product.cat);
  refreshProductGroupAndRecipes(product.id);
  refreshAutoDefaultProductForGroup(targetGroup.id);

  saveIngredient(product);
  saveState(true);
  renderIngredientBank();
  renderBank();
  renderVault();

  if(editIngId === product.id){
    renderEditProductLinkage(product);
  }

  closeProductReallocationModal();
  showPlatePlanToast(`"${product.name}" reallocated to ${getGroupTypeName(targetGroup)}.`);
}

function saveProductReallocationToNewIngredient(){
  if(!activeReallocationProductId) return;
  const product = getProduct(activeReallocationProductId);
  if(!product) return;

  const familyName = normaliseAliasText(document.getElementById('product-reallocation-new-family')?.value || '');
  const typeName = normaliseAliasText(document.getElementById('product-reallocation-new-type')?.value || '');
  const cat = document.getElementById('product-reallocation-new-cat')?.value || product.cat || 'other';

  if(!familyName || !typeName){
    return alert('Please enter both an ingredient name and sub-type name.');
  }

  const nowIso = new Date().toISOString();
  const family = ensureIngredientFamilyByName(familyName, cat);
  family.updatedAt = nowIso;
  const group = {
    id: 'grp' + Date.now() + Math.random().toString(36).slice(2,6),
    name: toTitleCase(typeName),
    cat: cat || family.cat || 'other',
    family: family.name,
    ingredientId: family.id,
    aliases: [typeName],
    defaultProductId: product.id,
    productIds: [product.id],
    notes: '',
    updatedAt: nowIso
  };

  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  family.typeIds.push(group.id);
  if(!family.defaultTypeId) family.defaultTypeId = group.id;

  syncIngredientGroupAliases(group, []);
  state.ingredientGroups.push(group);

  const oldGroupId = product.groupId;
  if(oldGroupId && oldGroupId !== group.id){
    const oldGroup = getIngredientGroup(oldGroupId);
    if(oldGroup && Array.isArray(oldGroup.productIds)){
      oldGroup.productIds = oldGroup.productIds.filter(id => id !== product.id);
      oldGroup.updatedAt = nowIso;
    }
    refreshAutoDefaultProductForGroup(oldGroupId);
  }

  product.updatedAt = nowIso;
  product.groupId = group.id;
  product.subTypeId = group.id;
  product.subType = group.name;
  product.ingredientId = family.id;
  ensureProductAssignedToGroup(product, group.name, group.id);
  syncProductHierarchyCategory(product, group, product.cat);
  refreshProductGroupAndRecipes(product.id);
  refreshAutoDefaultProductForGroup(group.id);

  saveIngredient(product);
  saveState(true);
  renderIngredientBank();
  renderBank();
  renderVault();

  if(editIngId === product.id){
    renderEditProductLinkage(product);
  }

  closeProductReallocationModal();
  showPlatePlanToast(`"${product.name}" allocated to new ingredient ${family.name} (${group.name}).`);
}

function confirmDelinkProduct(productId){
  const product = getProduct(productId);
  if(!product) return;
  const group = getIngredientGroup(product.groupId);
  const groupName = group ? getGroupTypeName(group) : 'ingredient';

  if(!confirm(`Are you sure you want to delink "${product.name}" from ${groupName}?\n\nIt will become a standalone product not attached to any recipe ingredient.`)){
    return;
  }

  const nowIso = new Date().toISOString();
  const oldGroupId = product.groupId;
  product.groupId = '';
  product.subTypeId = '';
  product.subType = '';
  product.ingredientId = '';
  product.updatedAt = nowIso;
  if(oldGroupId){
    const oldGroup = getIngredientGroup(oldGroupId);
    if(oldGroup && Array.isArray(oldGroup.productIds)){
      oldGroup.productIds = oldGroup.productIds.filter(id => id !== product.id);
      oldGroup.updatedAt = nowIso;
    }
    refreshAutoDefaultProductForGroup(oldGroupId);
  }

  saveState(true);
  renderIngredientBank();
  renderBank();
  renderVault();

  if(editIngId === product.id){
    renderEditProductLinkage(product);
  }

  closeProductReallocationModal();
  showPlatePlanToast(`"${product.name}" delinked from ingredient.`);
}



function showGroupProducts(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  productBankGroupFilterId = group.id;
  productBankFamilyFilterId = null;
  activeFamily = 'all';
  activeCat = 'all';
  showView('bank');
  const search = document.getElementById('bank-search');
  if(search) search.value = '';
  renderBank();
  setTimeout(() => document.getElementById('bank-search')?.focus(), 0);
}

function clearProductGroupFilter(){
  productBankGroupFilterId = null;
  productBankFamilyFilterId = null;
  renderBank();
}

function renameIngredientGroupPrompt(groupId){
  openIngredientGroupDetailsModal(groupId, 'name');
}

function editGroupAliasesPrompt(groupId){
  openIngredientGroupDetailsModal(groupId, 'aliases');
}

function editGroupFamilyPrompt(groupId){
  openIngredientFamilyPickerModal(groupId);
}



function ensureIngredientFamilyPickerModal(){
  let wrap = document.getElementById('ingredient-family-picker-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-family-picker-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Choose ingredient</h3>
        <button class="btn sm ghost" onclick="closeIngredientFamilyPickerModal()">Close</button>
      </div>
      <div id="ingredient-family-picker-context" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field">
        <label>Search or create ingredient</label>
        <input type="search" id="ingredient-family-picker-search" placeholder="e.g. Pasta, Asparagus, Tofu" oninput="renderIngredientFamilyPickerOptions(this.value)">
      </div>
      <div id="ingredient-family-picker-options" style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div class="field" style="border-top:1px solid var(--border);padding-top:12px">
        <label>Rename current ingredient everywhere</label>
        <div style="display:flex;gap:8px">
          <input type="text" id="ingredient-family-rename-input" placeholder="New ingredient name">
          <button class="btn sm ghost" type="button" onclick="renameCurrentIngredientFamily()">Rename</button>
        </div>
      </div>
      <div id="ingredient-family-picker-msg"></div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" onclick="createFamilyFromPickerSearch()">Create and assign</button>
        <button class="btn ghost" onclick="clearIngredientFamilyAssignment()">Clear ingredient</button>
        <button class="btn ghost" onclick="closeIngredientFamilyPickerModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openIngredientFamilyPickerModal(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  familyPickerGroupId = group.id;
  familyRenameOriginal = group.family || '';
  const wrap = ensureIngredientFamilyPickerModal();
  document.getElementById('ingredient-family-picker-context').innerHTML =
    `<strong>${ppEscapeHtml(getGroupTypeName(group))}</strong> is currently under <strong>${ppEscapeHtml(getGroupIngredientName(group))}</strong>.`;
  document.getElementById('ingredient-family-picker-search').value = group.family || '';
  document.getElementById('ingredient-family-rename-input').value = group.family || '';
  document.getElementById('ingredient-family-picker-msg').innerHTML = '';
  renderIngredientFamilyPickerOptions(group.family || '');
  wrap.classList.add('open');
  setTimeout(()=>document.getElementById('ingredient-family-picker-search')?.focus(),0);
}

function closeIngredientFamilyPickerModal(){
  const wrap = document.getElementById('ingredient-family-picker-wrap');
  if(wrap) wrap.classList.remove('open');
  familyPickerGroupId = null;
  familyRenameOriginal = '';
}

function renderIngredientFamilyPickerOptions(query = ''){
  const list = document.getElementById('ingredient-family-picker-options');
  if(!list) return;
  const q = canonicalGroupKey(query);
  const families = getKnownFamilies().filter(f => !q || canonicalGroupKey(f).includes(q));
  if(!families.length){
    list.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching ingredient yet. Use Create and assign.</div>';
    return;
  }
  list.innerHTML = families.map(f => {
    const count = (state.ingredientGroups || []).filter(g => canonicalGroupKey(g.family) === canonicalGroupKey(f)).length;
    return `<button type="button" class="family-picker-option" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)" onclick="assignIngredientFamily('${ppEscapeHtml(f)}')">
      <strong>${ppEscapeHtml(f)}</strong>
      <span class="tag" style="margin-left:6px">${count} type${count===1?'':'s'}</span>
    </button>`;
  }).join('');
}

function assignIngredientFamily(family){
  const group = getIngredientGroup(familyPickerGroupId);
  const clean = normaliseAliasText(family);
  if(!group || !clean) return;
  group.family = clean;
  saveState();
  renderIngredientBank();
  renderBank();
  renderDataQuality?.();
  closeIngredientFamilyPickerModal();
}

function createFamilyFromPickerSearch(){
  const family = normaliseAliasText(document.getElementById('ingredient-family-picker-search')?.value || '');
  if(!family){
    document.getElementById('ingredient-family-picker-msg').innerHTML = '<div class="msg error">Type an ingredient name first.</div>';
    return;
  }
  assignIngredientFamily(family);
}

function clearIngredientFamilyAssignment(){
  const group = getIngredientGroup(familyPickerGroupId);
  if(!group) return;
  group.family = '';
  saveState();
  renderIngredientBank();
  renderBank();
  renderDataQuality?.();
  closeIngredientFamilyPickerModal();
}

function renameCurrentIngredientFamily(){
  const oldName = normaliseAliasText(familyRenameOriginal);
  const nextName = normaliseAliasText(document.getElementById('ingredient-family-rename-input')?.value || '');
  const msg = document.getElementById('ingredient-family-picker-msg');
  if(!oldName){
    if(msg) msg.innerHTML = '<div class="msg error">This type has no current ingredient to rename.</div>';
    return;
  }
  if(!nextName){
    if(msg) msg.innerHTML = '<div class="msg error">Add the new ingredient name first.</div>';
    return;
  }
  (state.ingredientGroups || []).forEach(g => {
    if(canonicalGroupKey(g.family) === canonicalGroupKey(oldName)) g.family = nextName;
  });
  familyRenameOriginal = nextName;
  saveState();
  renderIngredientFamilyPickerOptions(nextName);
  renderIngredientBank();
  renderBank();
  renderDataQuality?.();
  if(msg) msg.innerHTML = `<div class="msg success">Renamed ${ppEscapeHtml(oldName)} to ${ppEscapeHtml(nextName)}.</div>`;
}



function inferHerbMetadata(...values){
  const text=normaliseAliasText(values.filter(Boolean).join(' ')).toLowerCase();
  const herbs=['basil','coriander','cilantro','parsley','thyme','rosemary','oregano','mint','sage','dill','chives','marjoram','tarragon'];
  const herbKey=herbs.find(herb=>new RegExp(`\\b${herb}\\b`).test(text))||'';
  if(!herbKey) return {herbForm:'',herbKey:''};
  return {herbForm:/\b(dried|dry)\b/.test(text)?'dried':'fresh',herbKey};
}

function ensureIngredientGroupDetailsModal(){
  let wrap = document.getElementById('ingredient-group-details-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-group-details-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '380';
  wrap.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="ingredient-group-details-title" style="margin:0">Edit type</h3>
        <button class="btn sm ghost" onclick="closeIngredientGroupDetailsModal()">Close</button>
      </div>
      <div id="ingredient-group-details-context" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field" id="ingredient-group-category-field">
        <label>Category</label>
        <select id="ingredient-group-category-input"></select>
      </div>
      <div class="field" id="ingredient-group-name-field">
        <label>Type</label>
        <input type="text" id="ingredient-group-name-input" placeholder="e.g. Spaghetti, Frozen asparagus, Super firm tofu">
      </div>
      <div class="field" id="ingredient-group-family-field">
        <label>Ingredient</label>
        <input type="search" id="ingredient-group-family-input" placeholder="Search or create ingredient, e.g. Pasta, Asparagus, Tofu" oninput="renderIngredientGroupFamilyOptions(this.value)">
        <div id="ingredient-group-family-options" style="display:none;max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-top:6px"></div>
        <button type="button" class="btn sm ghost" id="ingredient-group-family-create-btn" style="margin-top:6px;display:none" onclick="createIngredientForGroupDetails()">Create New Ingredient</button>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">This is the everyday ingredient. The type is the more specific subtype used by recipes.</div>
      </div>
      <div class="field" id="ingredient-group-aliases-field">
        <label>Aliases</label>
        <textarea id="ingredient-group-aliases-input" style="min-height:110px" placeholder="One alias per line, or comma-separated"></textarea>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">Aliases help recipe mapping and search recognise different names for the same type or ingredient.</div>
      </div>
      <div id="ingredient-group-details-msg"></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn primary" id="ingredient-group-save-btn" onclick="saveIngredientGroupDetailsModal()">Save</button>
        <button class="btn ghost" onclick="closeIngredientGroupDetailsModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openIngredientGroupDetailsModal(groupId, mode = 'name'){
  if(groupId) capturePlatePlanEditBaseline('ingredientGroups/'+groupId);
  const group = getIngredientGroup(groupId);
  if(!group && mode !== 'create') return;
  ingredientGroupDetailsEditId = group?.id || null;
  ingredientGroupDetailsMode = mode;
  const wrap = ensureIngredientGroupDetailsModal();
  const products = group ? getGroupProducts(group.id) : [];
  const titles = { aliases:'Edit aliases', family:'Edit ingredient', create:'Create type', name:'Edit type' };
  document.getElementById('ingredient-group-details-title').textContent = titles[mode] || titles.name;
  document.getElementById('ingredient-group-details-context').innerHTML = group
    ? `<strong>${ppEscapeHtml(getGroupHierarchyText(group))}</strong> <span class="tag">${products.length} product${products.length===1?'':'s'}</span>`
    : 'Create a recipe ingredient type. Products can be linked afterwards from Product Bank.';
  const catField = document.getElementById('ingredient-group-category-field');
  if(catField) catField.style.display = (mode === 'name' || mode === 'family' || mode === 'create') ? 'block' : 'none';
  const nameField = document.getElementById('ingredient-group-name-field');
  if(nameField) nameField.style.display = (mode === 'name' || mode === 'create') ? 'block' : 'none';
  const famField = document.getElementById('ingredient-group-family-field');
  if(famField) famField.style.display = (mode === 'name' || mode === 'family' || mode === 'create') ? 'block' : 'none';
  const aliasField = document.getElementById('ingredient-group-aliases-field');
  if(aliasField) aliasField.style.display = (mode === 'aliases' || mode === 'create') ? 'block' : 'none';
  document.getElementById('ingredient-group-category-input').innerHTML = getGroupCategoryOptionsHtml(group?.cat || 'other');
  document.getElementById('ingredient-group-name-input').value = group?.name || '';
  document.getElementById('ingredient-group-family-input').value = group?.family || '';
  ingredientGroupDetailsFamilyId = group?.ingredientId || getGroupIngredientFamily(group)?.id || null;
  renderIngredientGroupFamilyOptions(group?.family || '');
  document.getElementById('ingredient-group-aliases-input').value = (group?.aliases || []).join('\n');
  document.getElementById('ingredient-group-details-msg').innerHTML = '';
  wrap.classList.add('open');
  setTimeout(() => {
    const input = document.getElementById(mode === 'aliases' ? 'ingredient-group-aliases-input' : mode === 'family' ? 'ingredient-group-family-input' : 'ingredient-group-name-input');
    input?.focus();
    input?.select?.();
  }, 0);
}

function closeIngredientGroupDetailsModal(preserveEditorReturn=false){
  const wrap = document.getElementById('ingredient-group-details-wrap');
  if(wrap) wrap.classList.remove('open');
  ingredientGroupDetailsEditId = null;
  ingredientGroupDetailsFamilyId = null;
  if(!preserveEditorReturn) abandonEditorReturn();
}

function renderIngredientGroupFamilyOptions(query = ''){
  const list = document.getElementById('ingredient-group-family-options');
  const createBtn = document.getElementById('ingredient-group-family-create-btn');
  if(!list) return;
  const q = normaliseAliasText(query || '');
  const variants = getSearchVariants(q);
  let rows = (state.ingredientFamilies || []).slice();
  if(variants.length){
    rows = rows.filter(f => variants.some(v => [f.name, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(v)));
  }
  rows = rows.sort((a,b)=>(CAT[a.cat] || a.cat || '').localeCompare(CAT[b.cat] || b.cat || '') || (a.name || '').localeCompare(b.name || '')).slice(0,20);
  list.style.display = rows.length ? 'block' : 'none';
  list.innerHTML = rows.map(f => `<button type="button" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:${ingredientGroupDetailsFamilyId === f.id ? 'var(--green-bg)' : 'var(--surface)'};padding:8px 10px;cursor:pointer;color:var(--text)" onclick="selectIngredientForGroupDetails('${ppEscapeAttr(f.id)}')">
    <strong style="font-size:12px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:5px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
  </button>`).join('');
  const exact = rows.some(f => canonicalGroupKey(f.name) === canonicalGroupKey(q));
  if(createBtn) {
    createBtn.style.display = q && !exact ? 'inline-flex' : 'none';
    createBtn.textContent = q ? `Create New Ingredient: ${q}` : 'Create New Ingredient';
  }
}

function selectIngredientForGroupDetails(familyId){
  const family = getIngredientFamily(familyId);
  if(!family) return;
  ingredientGroupDetailsFamilyId = family.id;
  const input = document.getElementById('ingredient-group-family-input');
  if(input) input.value = family.name;
  const catInput = document.getElementById('ingredient-group-category-input');
  if(catInput && family.cat) catInput.value = family.cat;
  renderIngredientGroupFamilyOptions(family.name);
}

function createIngredientForGroupDetails(){
  const input = document.getElementById('ingredient-group-family-input');
  const msg = document.getElementById('ingredient-group-details-msg');
  const name = normaliseAliasText(input?.value || '');
  if(!name){
    if(msg) msg.innerHTML = '<div class="msg error">Add an ingredient name first.</div>';
    return;
  }
  const cat = document.getElementById('ingredient-group-category-input')?.value || 'other';
  let family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === canonicalGroupKey(name) && f.cat === cat);
  if(!family){
    let id = ingredientFamilyIdFromName(name, cat);
    if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
    family = { id, name:toTitleCase(name), cat, aliases:[name], notes:'', typeIds:[], defaultTypeId:'' };
    state.ingredientFamilies.push(family);
  }
  selectIngredientForGroupDetails(family.id);
}

function resolveIngredientFamilyForGroupDetails(name, cat, fallbackFamily = null){
  const clean = normaliseAliasText(name || '');
  const selected = ingredientGroupDetailsFamilyId ? getIngredientFamily(ingredientGroupDetailsFamilyId) : null;
  if(selected && (!clean || canonicalGroupKey(selected.name) === canonicalGroupKey(clean))) return selected;
  if(clean){
    let family = (state.ingredientFamilies || []).find(f => canonicalGroupKey(f.name) === canonicalGroupKey(clean) && f.cat === cat);
    if(!family){
      let id = ingredientFamilyIdFromName(clean, cat);
      if(getIngredientFamily(id)) id = 'fam_' + Date.now() + Math.random().toString(36).slice(2,6);
      family = { id, name:toTitleCase(clean), cat, aliases:[clean], notes:'', typeIds:[], defaultTypeId:'' };
      state.ingredientFamilies.push(family);
    }
    return family;
  }
  return fallbackFamily;
}

async function saveIngredientGroupDetailsModal(){
  let group = getIngredientGroup(ingredientGroupDetailsEditId);
  const msg = document.getElementById('ingredient-group-details-msg');
  const nowIso = new Date().toISOString();
  let isNew = false;
  let family = null;

  if(ingredientGroupDetailsMode === 'create'){
    const name = (document.getElementById('ingredient-group-name-input')?.value || '').trim();
    if(!name){
      msg.innerHTML = '<div class="msg error">Add a type name first.</div>';
      return;
    }
    const key = canonicalGroupKey(name);
    if((state.ingredientGroups || []).some(g => canonicalGroupKey(g.name) === key)){
      msg.innerHTML = '<div class="msg error">That type already exists. Use Merge if you want to combine types.</div>';
      return;
    }
    const aliasesText = document.getElementById('ingredient-group-aliases-input')?.value || '';
    const cat = document.getElementById('ingredient-group-category-input')?.value || 'other';
    const familyName = normaliseAliasText(document.getElementById('ingredient-group-family-input')?.value || '') || inferIngredientFamilyFromText(name) || name;
    family = window.pendingSubTypeFamilyId ? getIngredientFamily(window.pendingSubTypeFamilyId) : resolveIngredientFamilyForGroupDetails(familyName, cat);
    family.updatedAt = nowIso;
    group = {
      id:'grp'+Date.now()+Math.random().toString(36).slice(2,6),
      name:toTitleCase(name),
      cat:family.cat || cat,
      family:family.name,
      ingredientId:family.id,
      aliases:aliasesText.split(/[\n,]/).map(a=>a.trim()).filter(Boolean),
      defaultProductId:null,
      productIds:[],
      notes:'',
      updatedAt: nowIso
    };
    family.typeIds.push(group.id);
    if(!family.defaultTypeId) family.defaultTypeId = group.id;
    window.pendingSubTypeFamilyId = null;
    syncIngredientGroupAliases(group, []);
    isNew = true;
  } else if(!group) {
    return;
  } else if(ingredientGroupDetailsMode === 'name'){
    const name = (document.getElementById('ingredient-group-name-input')?.value || '').trim();
    if(!name){
      msg.innerHTML = '<div class="msg error">Add a type name first.</div>';
      return;
    }
    const key = canonicalGroupKey(name);
    const duplicate = (state.ingredientGroups || []).find(g => g.id !== group.id && canonicalGroupKey(g.name) === key);
    if(duplicate){
      msg.innerHTML = `<div class="msg error">That type already exists. Use Merge to combine it with ${ppEscapeHtml(duplicate.name)}.</div>`;
      return;
    }
    group.cat = document.getElementById('ingredient-group-category-input')?.value || group.cat || 'other';
    const familyName = normaliseAliasText(document.getElementById('ingredient-group-family-input')?.value || '') || group.family || inferIngredientFamilyFromText(name);
    family = resolveIngredientFamilyForGroupDetails(familyName, group.cat, getGroupIngredientFamily(group));
    if(family){
      const oldFamily = getGroupIngredientFamily(group);
      if(oldFamily && oldFamily.id !== family.id){
        oldFamily.typeIds = (oldFamily.typeIds || []).filter(id => id !== group.id);
        if(oldFamily.defaultTypeId === group.id) oldFamily.defaultTypeId = oldFamily.typeIds[0] || '';
        oldFamily.updatedAt = nowIso;
      }
      group.ingredientId = family.id;
      group.family = family.name;
      group.cat = family.cat || group.cat;
      if(!Array.isArray(family.typeIds)) family.typeIds = [];
      if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
      if(!family.defaultTypeId) family.defaultTypeId = group.id;
      family.updatedAt = nowIso;
      ingredientSubTypesOpenIds.add(family.id);
    } else {
      group.family = familyName;
    }
    group.name = toTitleCase(name);
    group.updatedAt = nowIso;
    addIngredientGroupAlias(group, group.name);
  } else if(ingredientGroupDetailsMode === 'family'){
    group.cat = document.getElementById('ingredient-group-category-input')?.value || group.cat || 'other';
    const familyName = normaliseAliasText(document.getElementById('ingredient-group-family-input')?.value || '');
    family = resolveIngredientFamilyForGroupDetails(familyName, group.cat, getGroupIngredientFamily(group));
    if(family){
      group.ingredientId = family.id;
      group.family = family.name;
      group.cat = family.cat || group.cat;
      if(!Array.isArray(family.typeIds)) family.typeIds = [];
      if(!family.typeIds.includes(group.id)) family.typeIds.push(group.id);
      family.updatedAt = nowIso;
      ingredientSubTypesOpenIds.add(family.id);
    } else {
      group.family = familyName;
    }
    group.updatedAt = nowIso;
  } else if(ingredientGroupDetailsMode === 'familyAliases'){
    const fam = getIngredientFamily(ingredientFamilyDetailsId);
    if(fam){
      const aliasesText = document.getElementById('ingredient-group-aliases-input')?.value || '';
      fam.aliases = aliasesText.split(/[\n,]/).map(a=>a.trim()).filter(Boolean);
      if(fam.name && !fam.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(fam.name))) fam.aliases.unshift(fam.name);
      fam.updatedAt = nowIso;
      family = fam;
    }
  } else {
    const aliasesText = document.getElementById('ingredient-group-aliases-input')?.value || '';
    group.aliases = aliasesText.split(/[\n,]/).map(a=>a.trim()).filter(Boolean);
    group.updatedAt = nowIso;
    syncIngredientGroupAliases(group, getGroupProducts(group.id));
  }
  let affectedProducts = [];
  if(group) {
    group.updatedAt = nowIso;
    ensureIngredientFamilyForGroup(group, state);
    affectedProducts = getGroupProducts(group.id);
    affectedProducts.forEach(product => { if(group.cat) product.cat = group.cat; product.updatedAt = nowIso; });
    syncIngredientGroupAliases(group, affectedProducts);
  }

  try {
    await executeDataQualityTransaction('SAVE_SUBTYPE_GROUP', {
      groupData: group,
      isNew,
      affectedProducts,
      affectedFamily: family
    }, {
      modalWrapId: 'ingredient-group-details-wrap',
      submitButtonId: 'ingredient-group-save-btn',
      errorContainerId: 'ingredient-group-details-msg'
    });
    closeIngredientGroupDetailsModal(true);
    refreshHierarchyViews();
    finishEditorReturn();
  } catch(e) {
    console.error('saveIngredientGroupDetailsModal failed:', e);
  }
}

function getIngredientGroupSearchText(group){
  if(!group) return '';
  const products = getGroupProducts(group.id);
  const family = getGroupIngredientFamily(group);
  return [
    group.name,
    group.cat,
    CAT[group.cat],
    group.family,
    family?.name,
    ...(family?.aliases || []),
    getGroupHierarchyText(group),
    ...(group.aliases || []),
    ...products.flatMap(p => [p.name, p.brand])
  ].filter(Boolean).join(' ').toLowerCase();
}

function findIngredientGroupsByText(query, excludeGroupId = ''){
  const variants = getSearchVariants(query || '');
  if(!variants.length) return [];
  return (state.ingredientGroups || [])
    .filter(g => g.id !== excludeGroupId)
    .map(g => ({ group:g, text:getIngredientGroupSearchText(g), products:getGroupProducts(g.id) }))
    .filter(row => variants.some(v => row.text.includes(v)))
    .sort((a,b) => {
      const qa = variants.some(v => canonicalGroupKey(a.group.name) === canonicalGroupKey(v)) ? 0 : 1;
      const qb = variants.some(v => canonicalGroupKey(b.group.name) === canonicalGroupKey(v)) ? 0 : 1;
      return qa - qb || a.group.name.localeCompare(b.group.name);
    });
}

function updateRecipeIngredientGroupIds(oldGroupId, newGroupId){
  (state.recipes || []).forEach(recipe => {
    [recipe.ingredients, recipe.enhanced?.ingredients].forEach(list => {
      (list || []).forEach(ing => {
        if(ing.groupId === oldGroupId) {
          ing.groupId = newGroupId;
          const product = resolveProductForIngredient(ing).product;
          if(product) ing.bankId = product.id;
        }
      });
    });
  });
}

function mergeIngredientGroups(sourceGroupId, targetGroupId){
  if(sourceGroupId === targetGroupId) return false;
  const source = getIngredientGroup(sourceGroupId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target) return false;

  if(!Array.isArray(target.aliases)) target.aliases = [];
  [source.name, ...(source.aliases || [])].filter(Boolean).forEach(alias => {
    if(!target.aliases.some(a => canonicalGroupKey(a) === canonicalGroupKey(alias))) target.aliases.push(alias);
  });

  const movedProducts = getGroupProducts(source.id);
  movedProducts.forEach(product => ensureProductAssignedToGroup(product, target.name, target.id));
  refreshAutoDefaultProductForGroup(target.id);
  if(!target.cat || target.cat === 'other') target.cat = source.cat || target.cat || 'other';
  if(!target.family) target.family = source.family || inferIngredientFamilyFromText(target.name);
  movedProducts.forEach(product => syncProductHierarchyCategory(product, target, target.cat || product.cat));

  updateRecipeIngredientGroupIds(source.id, target.id);
  state.ingredientGroups = (state.ingredientGroups || []).filter(g => g.id !== source.id);
  movedProducts.forEach(product => refreshProductGroupAndRecipes(product.id));
  saveState();
  renderIngredientBank();
  renderBank();
  renderVault();
  return true;
}

function mergeIngredientGroupIntoFamily(sourceGroupId, targetFamilyId){
  const source = getIngredientGroup(sourceGroupId);
  const family = getIngredientFamily(targetFamilyId);
  if(!source || !family) return false;
  let targetGroup = getIngredientGroup(family.defaultTypeId) || getFamilyGroups(family.id)[0] || null;
  if(targetGroup && targetGroup.id !== source.id){
    ingredientSubTypesOpenIds.add(family.id);
    return mergeIngredientGroups(source.id, targetGroup.id);
  }
  const oldFamily = getGroupIngredientFamily(source);
  if(oldFamily) {
    oldFamily.typeIds = (oldFamily.typeIds || []).filter(id => id !== source.id);
    if(oldFamily.defaultTypeId === source.id) oldFamily.defaultTypeId = oldFamily.typeIds[0] || '';
  }
  source.ingredientId = family.id;
  source.family = family.name;
  source.cat = family.cat || source.cat || 'other';
  if(!Array.isArray(family.typeIds)) family.typeIds = [];
  if(!family.typeIds.includes(source.id)) family.typeIds.push(source.id);
  if(!family.defaultTypeId) family.defaultTypeId = source.id;
  getGroupProducts(source.id).forEach(product => { product.cat = source.cat; });
  ingredientSubTypesOpenIds.add(family.id);
  saveState(true);
  refreshHierarchyViews();
  return true;
}

function mergeIngredientFamilyIntoGroup(sourceFamilyId, targetGroupId){
  const source = getIngredientFamily(sourceFamilyId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target) return false;
  const sourceGroups = getFamilyGroups(source.id).filter(group => group.id !== target.id);
  if(!sourceGroups.length) return false;
  sourceGroups.forEach(group => mergeIngredientGroups(group.id, target.id));
  const remaining = getFamilyGroups(source.id);
  if(!remaining.length) state.ingredientFamilies = (state.ingredientFamilies || []).filter(f => f.id !== source.id);
  const targetFamily = getGroupIngredientFamily(target);
  if(targetFamily) ingredientSubTypesOpenIds.add(targetFamily.id);
  saveState(true);
  refreshHierarchyViews();
  return true;
}



function ensureIngredientGroupMergeModal(){
  let wrap = document.getElementById('ingredient-group-merge-wrap');
  if(wrap) wrap.remove();
  wrap = document.createElement('div');
  wrap.id = 'ingredient-group-merge-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '380';
  wrap.innerHTML = `
    <div class="modal" style="max-width:620px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Merge sub-types</h3>
        <button class="btn sm ghost" onclick="closeIngredientGroupMergeModal()">Close</button>
      </div>
      <div id="ingredient-group-merge-source" style="font-size:12px;color:var(--text2);margin-bottom:12px"></div>
      <div class="field">
        <label>Search target ingredient or sub-type</label>
        <input type="search" id="ingredient-group-merge-search" placeholder="Search category, ingredient, type, alias, product, or brand" oninput="renderIngredientGroupMergeOptions(this.value)">
      </div>
      <div id="ingredient-group-merge-options" style="max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface);margin-bottom:12px"></div>
      <div id="ingredient-group-merge-selection" style="display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px"></div>
      <div class="btn-row">
        <button class="btn primary" id="ingredient-group-merge-confirm" onclick="confirmIngredientGroupMerge()" disabled>Merge</button>
        <button class="btn ghost" onclick="closeIngredientGroupMergeModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openIngredientGroupMergeModal(sourceGroupId){
  const source = getIngredientGroup(sourceGroupId);
  if(!source) return;
  ingredientGroupMergeSourceId = source.id;
  ingredientGroupMergeTargetId = null;
  const wrap = ensureIngredientGroupMergeModal();
  const sourceProducts = getGroupProducts(source.id);
  document.getElementById('ingredient-group-merge-source').innerHTML = `
    <strong>Merging from:</strong> ${ppEscapeHtml(getGroupTypeName(source))}
    <span class="tag" style="margin-left:6px">${sourceProducts.length} product${sourceProducts.length===1?'':'s'}</span>
    ${(source.aliases || []).length ? `<div style="margin-top:4px"><strong>Aliases:</strong> ${ppEscapeHtml((source.aliases || []).join(', '))}</div>` : ''}
  `;
  const search = document.getElementById('ingredient-group-merge-search');
  if(search) search.value = '';
  const mergeSel = document.getElementById('ingredient-group-merge-selection');
  if(mergeSel) mergeSel.style.display = 'none';
  const confirmBtn = document.getElementById('ingredient-group-merge-confirm');
  if(confirmBtn) confirmBtn.disabled = true;
  renderIngredientGroupMergeOptions('');
  wrap.classList.add('open');
  setTimeout(() => search.focus(), 0);
}

function closeIngredientGroupMergeModal(){
  const wrap = document.getElementById('ingredient-group-merge-wrap');
  if(wrap) wrap.classList.remove('open');
  ingredientGroupMergeSourceId = null;
  ingredientGroupMergeTargetId = null;
  ingredientGroupMergeTargetKind = 'group';
  ingredientFamilyMergeTargetKind = 'family';
}

function renderIngredientGroupMergeOptions(query){
  const listEl = document.getElementById('ingredient-group-merge-options');
  if(!listEl) return;
  ensureIngredientGroups();
  const q = (query || '').trim();
  let matches;
  if(q) {
    matches = findIngredientGroupsByText(q, ingredientGroupMergeSourceId);
  } else {
    matches = (state.ingredientGroups || [])
      .filter(g => g.id !== ingredientGroupMergeSourceId)
      .map(g => ({ group:g, text:getIngredientGroupSearchText(g), products:getGroupProducts(g.id) }))
      .sort((a,b) => a.group.name.localeCompare(b.group.name));
  }
  matches = matches.slice(0, 40);

  const familyRows = (state.ingredientFamilies || [])
    .filter(f => {
      const source = getIngredientGroup(ingredientGroupMergeSourceId);
      if(source && f.id === source.ingredientId) return false;
      if(!q) return true;
      return getSearchVariants(q).some(v => [f.name, CAT[f.cat], f.cat, ...(f.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(v));
    })
    .sort((a,b)=>(a.name || '').localeCompare(b.name || ''))
    .slice(0,20);

  if(!matches.length && !familyRows.length){
    listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching types or ingredients found.</div>';
    return;
  }

  const typeHtml = matches.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Sub-types</div>` + matches.map(row => {
    const g = row.group;
    const defaultProduct = getProduct(g.defaultProductId) || row.products[0] || null;
    const aliases = (g.aliases || []).slice(0, 4).join(', ');
    const products = row.products.slice(0, 4).map(p => p.name).join(', ');
    return `
      <button type="button" class="ingredient-group-merge-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <strong style="font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</strong>
          <span class="tag">${row.products.length} product${row.products.length===1?'':'s'}</span>
          <span class="tag">${CAT[g.cat] || g.cat || 'Other'}</span>
          <span class="tag">${ppEscapeHtml(getGroupIngredientName(g))}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
        ${defaultProduct ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Default:</strong> ${ppEscapeHtml(defaultProduct.name)}${defaultProduct.brand && defaultProduct.brand !== 'Generic' ? ` (${ppEscapeHtml(defaultProduct.brand)})` : ''}</div>` : ''}
        ${aliases ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Aliases:</strong> ${ppEscapeHtml(aliases)}</div>` : ''}
        ${products ? `<div style="font-size:11px;color:var(--text2);margin-top:3px"><strong>Products:</strong> ${ppEscapeHtml(products)}</div>` : ''}
      </button>`;
  }).join('') : '';
  const familyHtml = familyRows.length ? `<div style="padding:8px 10px;font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;background:var(--surface2)">Ingredients</div>` + familyRows.map(f => `<button type="button" class="ingredient-group-merge-option" data-kind="family" data-id="${ppEscapeAttr(f.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
    <strong style="font-size:13px">${ppEscapeHtml(f.name)}</strong>
    <span class="tag" style="margin-left:6px">${ppEscapeHtml(CAT[f.cat] || f.cat || 'Other')}</span>
    <span class="tag">${(f.typeIds || []).length} sub-type${(f.typeIds || []).length===1?'':'s'}</span>
    <div style="font-size:11px;color:var(--text2);margin-top:3px">Merge this sub-type into the ingredient's default sub-type, or move it there if no default exists.</div>
  </button>`).join('') : '';
  listEl.innerHTML = typeHtml + familyHtml;

  listEl.querySelectorAll('.ingredient-group-merge-option').forEach(btn => {
    btn.onclick = () => btn.dataset.kind === 'family' ? selectIngredientGroupMergeFamilyTarget(btn.dataset.id) : selectIngredientGroupMergeTarget(btn.dataset.id);
    btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
    btn.onmouseleave = () => {
      btn.style.background = btn.dataset.id === ingredientGroupMergeTargetId ? 'var(--green-bg)' : 'var(--surface)';
    };
  });
}

function selectIngredientGroupMergeTarget(targetGroupId){
  const source = getIngredientGroup(ingredientGroupMergeSourceId);
  const target = getIngredientGroup(targetGroupId);
  if(!source || !target || source.id === target.id) return;
  ingredientGroupMergeTargetId = target.id;
  ingredientGroupMergeTargetKind = 'group';
  const movedProducts = getGroupProducts(source.id);
  const targetProducts = getGroupProducts(target.id);
  const selection = document.getElementById('ingredient-group-merge-selection');
  selection.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Ready to merge</div>
    <div><strong>${ppEscapeHtml(getGroupTypeName(source))}</strong> will be merged into <strong>${ppEscapeHtml(getGroupTypeName(target))}</strong>.</div>
    <div style="color:var(--text2);margin-top:4px">${movedProducts.length} product${movedProducts.length===1?'':'s'} and ${(source.aliases || []).length + 1} alias/name value${((source.aliases || []).length + 1)===1?'':'s'} will move. The target currently has ${targetProducts.length} product${targetProducts.length===1?'':'s'}.</div>
    <div style="color:var(--text2);margin-top:4px">Recipe mappings using ${ppEscapeHtml(getGroupTypeName(source))} will be updated to ${ppEscapeHtml(getGroupTypeName(target))}.</div>
  `;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
  document.querySelectorAll('.ingredient-group-merge-option').forEach(btn => {
    btn.style.background = btn.dataset.id === target.id ? 'var(--green-bg)' : 'var(--surface)';
  });
}

function selectIngredientGroupMergeFamilyTarget(targetFamilyId){
  const source = getIngredientGroup(ingredientGroupMergeSourceId);
  const target = getIngredientFamily(targetFamilyId);
  if(!source || !target) return;
  ingredientGroupMergeTargetId = target.id;
  ingredientGroupMergeTargetKind = 'family';
  const selection = document.getElementById('ingredient-group-merge-selection');
  const targetGroups = getFamilyGroups(target.id);
  selection.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Ready to merge into ingredient</div>
    <div><strong>${ppEscapeHtml(getGroupTypeName(source))}</strong> will merge into <strong>${ppEscapeHtml(target.name)}</strong>.</div>
    <div style="color:var(--text2);margin-top:4px">${targetGroups.length ? "It will merge into that ingredient's default sub-type." : 'The sub-type will move under that ingredient because it has no sub-types yet.'}</div>
  `;
  selection.style.display = 'block';
  document.getElementById('ingredient-group-merge-confirm').disabled = false;
}

function confirmIngredientGroupMerge(){
  if(!ingredientGroupMergeSourceId || !ingredientGroupMergeTargetId) return;
  const source = getIngredientGroup(ingredientGroupMergeSourceId);
  const targetName = ingredientGroupMergeTargetKind === 'family'
    ? getIngredientFamily(ingredientGroupMergeTargetId)?.name
    : getGroupTypeName(getIngredientGroup(ingredientGroupMergeTargetId) || {});
  runWithRecoveryPoint(`Before merging sub-type ${getGroupTypeName(source || {})} into ${targetName || 'another sub-type'}`, applyIngredientGroupMerge);
}

function applyIngredientGroupMerge(){
  if(!ingredientGroupMergeSourceId || !ingredientGroupMergeTargetId) return;
  const merged = ingredientGroupMergeTargetKind === 'family'
    ? mergeIngredientGroupIntoFamily(ingredientGroupMergeSourceId, ingredientGroupMergeTargetId)
    : mergeIngredientGroups(ingredientGroupMergeSourceId, ingredientGroupMergeTargetId);
  if(merged) closeIngredientGroupMergeModal();
}

function mergeIngredientGroupPrompt(sourceGroupId){
  openIngredientGroupMergeModal(sourceGroupId);
}



function getIngredientGroupRecipeUsage(groupId){
  const rows = [];
  (state.recipes || []).forEach(recipe => {
    (recipe.ingredients || []).forEach(ing => {
      if(getRecipeIngredientGroupId(ing) === groupId) rows.push(recipe.name);
    });
    (recipe.enhanced?.ingredients || []).forEach(ing => {
      if(getRecipeIngredientGroupId(ing) === groupId) rows.push(recipe.name + ' (Enhanced)');
    });
  });
  return [...new Set(rows)];
}

function ensureDeleteIngredientGroupModal(){
  let wrap = document.getElementById('delete-ingredient-group-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'delete-ingredient-group-wrap';
  wrap.className = 'modal-wrap';
  wrap.style.zIndex = '430';
  wrap.innerHTML = `
    <div class="modal" style="max-width:560px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Delete type?</h3>
        <button class="btn sm ghost" onclick="closeDeleteIngredientGroupModal()">Close</button>
      </div>
      <div id="delete-ingredient-group-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
      <div class="btn-row" id="delete-ingredient-group-actions"></div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function deleteIngredientGroupPrompt(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  deleteIngredientGroupId = group.id;
  const wrap = ensureDeleteIngredientGroupModal();
  const products = getGroupProducts(group.id);
  const recipeUses = getIngredientGroupRecipeUsage(group.id);
  const copy = document.getElementById('delete-ingredient-group-copy');
  const actions = document.getElementById('delete-ingredient-group-actions');
  if(recipeUses.length){
    copy.innerHTML = `
      <strong>${ppEscapeHtml(getGroupTypeName(group))}</strong> is still used by ${recipeUses.length} recipe${recipeUses.length===1?'':'s'}.
      Merge it into another type before deleting it.
      <div style="margin-top:8px;color:var(--text3)">${recipeUses.slice(0,6).map(ppEscapeHtml).join(' | ')}${recipeUses.length>6?' | ...':''}</div>`;
    actions.innerHTML = `
      <button class="btn primary" onclick="closeDeleteIngredientGroupModal(); mergeIngredientGroupPrompt('${ppEscapeHtml(group.id)}')">Merge instead</button>
      <button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`;
  } else {
    copy.innerHTML = `
      Delete <strong>${ppEscapeHtml(group.name)}</strong> from the Ingredient Bank?
      ${products.length ? `<div style="margin-top:8px">Its ${products.length} linked product${products.length===1?'':'s'} will stay in Product Bank and be split into their own types.</div>` : ''}`;
    actions.innerHTML = `
      <button class="btn danger" onclick="confirmDeleteIngredientGroup()">Delete type</button>
      <button class="btn ghost" onclick="closeDeleteIngredientGroupModal()">Cancel</button>`;
  }
  wrap.classList.add('open');
}

function closeDeleteIngredientGroupModal(){
  const wrap = document.getElementById('delete-ingredient-group-wrap');
  if(wrap) wrap.classList.remove('open');
  deleteIngredientGroupId = null;
}

function confirmDeleteIngredientGroup(){
  const group = getIngredientGroup(deleteIngredientGroupId);
  if(!group) return;
  if(getIngredientGroupRecipeUsage(group.id).length) return;
  runWithRecoveryPoint(`Before deleting sub-type ${getGroupTypeName(group)}`, () => applyDeleteIngredientGroup(group.id));
}

function applyDeleteIngredientGroup(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  const products = getGroupProducts(group.id);
  state.ingredientGroups = (state.ingredientGroups || []).filter(g => g.id !== group.id);
  products.forEach(product => {
    product.groupId = '';
    refreshProductGroupAndRecipes(product.id);
  });
  closeDeleteIngredientGroupModal();
  refreshHierarchyViews();
}

function setFamilyFilter(f){
  activeFamily = f === 'no-family' ? 'no-ingredient' : (f || 'all');
  productBankFamilySearchText = activeFamily === 'all' ? '' : getProductBankFamilyFilterLabel(activeFamily);
  renderBank();
}

function setCat(c){
  activeCat = c || 'all';
  renderBank();
}

function showParseIng(){
  hideLegacyCategoryAndMeatFields();
  const parsePanel = document.getElementById('parse-panel');
  if(parsePanel) parsePanel.style.display='block';
  const manualIngPanel = document.getElementById('manual-ing-panel');
  if(manualIngPanel) manualIngPanel.style.display='none';
  const tescoWrap = document.getElementById('tesco-modal-wrap');
  if(tescoWrap) tescoWrap.classList.remove('open');
  
  ['pp-name','pp-brand','pp-text','pp-price','pp-pack'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
  });
  if(document.getElementById('pp-cat')) document.getElementById('pp-cat').value = 'other';
  syncCategorySearchInput('pp-cat');
  if(document.getElementById('pp-storage')) document.getElementById('pp-storage').value = '';
  if(document.getElementById('pp-pack-unit')) document.getElementById('pp-pack-unit').value = 'qty';
  if(document.getElementById('pp-item-weight')) document.getElementById('pp-item-weight').value = '';
}

// Global Tesco Import Hooks
function showTescoImportReviewModal(productData = {}, targetSubtype = null) {
  const context = {
    type: 'manualAdd',
    groupId: targetSubtype || productData.groupId || productData.subTypeId || null,
    name: productData.name || '',
    ...productData
  };
  showTescoImport(context);
  
  if (document.getElementById('tesco-preview')) document.getElementById('tesco-preview').style.display = 'block';
  if (document.getElementById('tesco-diagnostics-box')) document.getElementById('tesco-diagnostics-box').style.display = 'none';

  if (productData.name && document.getElementById('tp-name')) document.getElementById('tp-name').value = productData.name;
  if (productData.brand && document.getElementById('tp-brand')) document.getElementById('tp-brand').value = productData.brand;
  if (productData.cat && document.getElementById('import-category')) document.getElementById('import-category').value = productData.cat;
  if (productData.storage && document.getElementById('import-storage')) document.getElementById('import-storage').value = productData.storage;
  if (productData.drainedWeight !== undefined && document.getElementById('import-usable-weight')) document.getElementById('import-usable-weight').value = productData.drainedWeight;
  if (productData.fibre !== undefined && document.getElementById('import-fibre')) document.getElementById('import-fibre').value = productData.fibre;
  if (productData.notes && document.getElementById('import-notes')) document.getElementById('import-notes').value = productData.notes;
  if (productData.storage && document.getElementById('tp-storage')) document.getElementById('tp-storage').value = productData.storage;
  if (productData.price !== undefined && document.getElementById('tp-price')) document.getElementById('tp-price').value = productData.price;
  if (productData.packSize !== undefined && document.getElementById('tp-pack')) document.getElementById('tp-pack').value = productData.packSize;
  if (productData.packUnit && document.getElementById('tp-pack-unit')) setPackUnitEditorValue('tp-pack-unit', productData.packUnit);
  if (productData.cal !== undefined && document.getElementById('tp-cal')) document.getElementById('tp-cal').value = productData.cal;
  if (productData.prot !== undefined && document.getElementById('tp-prot')) document.getElementById('tp-prot').value = productData.prot;
  if (productData.carb !== undefined && document.getElementById('tp-carb')) document.getElementById('tp-carb').value = productData.carb;
  if (productData.fat !== undefined && document.getElementById('tp-fat')) document.getElementById('tp-fat').value = productData.fat;
  if (productData.fibre !== undefined && document.getElementById('tp-fibre')) document.getElementById('tp-fibre').value = productData.fibre;
  if (productData.drainedWeight !== undefined && document.getElementById('tp-drained-weight')) document.getElementById('tp-drained-weight').value = productData.drainedWeight;
  if (productData.drainedWeightUnit && document.getElementById('tp-drained-weight-unit')) document.getElementById('tp-drained-weight-unit').value = productData.drainedWeightUnit;
  if (productData.itemWeight !== undefined && document.getElementById('tp-item-weight')) document.getElementById('tp-item-weight').value = productData.itemWeight;
  if (productData.itemWeightUnit && document.getElementById('tp-item-weight-unit')) document.getElementById('tp-item-weight-unit').value = productData.itemWeightUnit;
  if (productData.notes && document.getElementById('tp-notes')) document.getElementById('tp-notes').value = productData.notes;
}
window.showTescoImportReviewModal = showTescoImportReviewModal;

function showTescoImport(context = null){
  hideLegacyCategoryAndMeatFields();
  window.pendingTescoMapping = context;
  const manualAddMode = context?.type === 'manualAdd';
  const pasteEl = document.getElementById('tesco-paste');
  if(pasteEl) pasteEl.value='';
  const msgEl = document.getElementById('tesco-msg');
  if(msgEl) msgEl.innerHTML='';
  const previewEl = document.getElementById('tesco-preview');
  if(previewEl) previewEl.style.display = manualAddMode ? 'block' : 'none';
  const diagnosticsBox = document.getElementById('tesco-diagnostics-box');
  if(diagnosticsBox) diagnosticsBox.style.display = 'none';
  const importTitle = document.getElementById('tesco-import-title');
  if(importTitle) importTitle.textContent = manualAddMode ? 'Add product' : 'Import Tesco product';
  const detailsHeading = document.getElementById('tesco-details-heading');
  if(detailsHeading) detailsHeading.textContent = manualAddMode ? 'Product details' : 'Review extracted details';
  const saveBtn = document.getElementById('tesco-save-btn');
  if(saveBtn) saveBtn.textContent = manualAddMode ? 'Add product' : 'Save to Product Bank';
  ['tesco-bookmarklet-panel','tesco-paste-panel','tesco-extract-actions'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = manualAddMode ? 'none' : '';
  });
  
  ['tp-name','tp-brand','tp-cal','tp-fat','tp-carb','tp-fibre','tp-prot','tp-price','tp-pack','tp-notes','tp-item-weight','tp-drained-weight'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
  });
  if(context?.name && document.getElementById('tp-name')) {
    document.getElementById('tp-name').value = context.name;
  }
  let initialCat = 'other';
  if(context?.groupId) {
    const linkedGrp = getIngredientGroup(context.groupId);
    if(linkedGrp?.cat) initialCat = linkedGrp.cat;
  }
  if(document.getElementById('tp-cat')) document.getElementById('tp-cat').value = initialCat;
  syncCategorySearchInput('tp-cat');
  if(document.getElementById('tp-storage')) document.getElementById('tp-storage').value = '';
  setPackUnitEditorValue('tp-pack-unit','g',{allowLegacyCount:false});
  if(document.getElementById('tp-item-weight-unit')) document.getElementById('tp-item-weight-unit').value = 'g';
  if(document.getElementById('tp-drained-weight-unit')) document.getElementById('tp-drained-weight-unit').value = 'g';
  
  const searchHint = document.getElementById('tesco-search-hint');
  if(!manualAddMode && context && context.name) {
      if(searchHint) searchHint.style.display = 'block';
      const termEl = document.getElementById('tesco-search-term');
      if(termEl) termEl.innerText = context.name;
      const linkEl = document.getElementById('tesco-search-link');
      if(linkEl) linkEl.href = `https://www.tesco.com/groceries/en-GB/search?query=${encodeURIComponent(context.name)}`;
  } else {
      if(searchHint) searchHint.style.display = 'none';
  }
  
  const modalWrap = document.getElementById('tesco-modal-wrap');
  if(modalWrap) modalWrap.classList.add('open');
}

function closeTescoModal() {
  document.getElementById('tesco-modal-wrap').classList.remove('open');
  window.pendingTescoMapping = null;
}

function applyTescoImportToExistingIngredient(target, data){
  if(!target || !data) return;
  target.name = data.name || target.name;
  target.brand = data.brand || target.brand || '';
  target.cat = data.cat || target.cat || 'other';
  target.storage = data.storage || target.storage || '';
  target.cal = data.cal;
  target.fat = data.fat;
  target.carb = data.carb;
  target.fibre = data.fibre;
  target.prot = data.prot;
  target.price = data.price;
  target.packSize = data.packSize;
  target.packUnit = data.packUnit || 'g';
  target.itemWeight = data.itemWeight || target.itemWeight || null;
  target.itemWeightUnit = data.itemWeightUnit || target.itemWeightUnit || 'g';
  target.drainedWeight = data.drainedWeight || target.drainedWeight || null;
  target.drainedWeightUnit = data.drainedWeightUnit || target.drainedWeightUnit || 'g';
  target.notes = data.notes || target.notes || '';
  target.sourceUrl = data.sourceUrl || target.sourceUrl || null;
  target.itemCount = data.itemCount || target.itemCount || null;

  if(data.packSize && data.price){
    if(!target.packOptions) target.packOptions = [];
    const exists = target.packOptions.some(po =>
      (+po.packSize || 0) === (+data.packSize || 0) &&
      (po.packUnit || 'g') === (data.packUnit || 'g') &&
      (+po.price || 0) === (+data.price || 0)
    );
    if(!exists){
      target.packOptions.push({
        packSize: data.packSize,
        packUnit: data.packUnit || 'g',
        price: data.price,
        itemWeight: data.itemWeight || null,
        itemWeightUnit: data.itemWeightUnit || 'g',
        drainedWeight: data.drainedWeight || null,
        drainedWeightUnit: data.drainedWeightUnit || 'g',
        sourceUrl: data.sourceUrl || null,
        itemCount: data.itemCount || null
      });
    }
  }
}

function openTescoImportFromMap(idx, name) {
    showTescoImport({ type: 'map', idx, name });
}

function openTescoImportFromSubst() {
    const name = document.getElementById('subst-search').value.trim();
    showTescoImport({ type: 'subst', name });
}

function getTescoItemWeightGuess(data, name){
    if(!data) return '';
    const count = +data.itemCount || 0;
    const packSize = +data.drainedWeight || +data.packSize || 0;
    const explicit = +data.itemWeight || 0;
    const countable = isLikelyCountableIngredientName(name || data.name || '');
    if(explicit > 0 && countable) return explicit;
    if(count > 1 && packSize > 0 && countable) return Math.round((packSize / count) * 10) / 10;
    if(count === 1 && explicit > 0 && countable) return explicit;
    return '';
}

function extractTescoProduct() {
    window.__lastTescoImport = null;
    const text = document.getElementById('tesco-paste').value.trim();
    if (!text) {
        showMsg('tesco-msg', 'Please paste data first.', 'error');
        return;
    }

    let data = null;
    try {
        data = JSON.parse(text);
        window.__lastTescoImport = data;
    } catch(e) {
        showMsg('tesco-msg', 'Invalid JSON format. Please use the bookmarklet to copy the correct data from Tesco.', 'error');
        return;
    }

    // --- PART P: TESCO IMPORT QUALITY IMPROVEMENTS ---
    // Issue 2: Title Case normalisation for brands
    let brand = toTitleCase((data.brand || '').trim());
    let name = data.name || '';
    
    // Issue 1: Remove duplicated brand text safely
    if (brand && brand !== 'Generic') {
        let re = new RegExp('\\b' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig');
        name = name.replace(re, '').trim();
    }
    
    // Issue 1: Remove trailing pack sizes (e.g., "226g", "2 x 113g", "1kg")
    name = name.replace(/\s+(?:\d+\s*[x×]\s*)?\d+(?:\.\d+)?\s*(g|kg|ml|l|pack)$/i, '').trim();
    name = name.replace(/^[-,\s]+|[-,\s]+$/g, '').trim();
    name = toTitleCase(name);
    
    // Issue 3: Storage Location from Taxonomy first, then keywords
    // Issue 3: Storage Location from Taxonomy first, then keywords
    let storage = '';
    let breadcrumbs = (data.diagnostics?.breadcrumbs || '').toLowerCase();
    let stText = (data.diagnostics?.storageText || '').toLowerCase();
    
    if (breadcrumbs) {
        if (breadcrumbs.includes('frozen food') || breadcrumbs.includes('frozen vegetables') || breadcrumbs.includes('frozen meat') || breadcrumbs.includes('frozen')) {
            storage = 'freezer';
        } else if (breadcrumbs.includes('fresh food') || breadcrumbs.includes('chilled food') || breadcrumbs.includes('fresh produce') || breadcrumbs.includes('dairy') || breadcrumbs.includes('fresh') || breadcrumbs.includes('chilled')) {
            storage = 'fridge';
        } else if (breadcrumbs.includes('cupboard') || breadcrumbs.includes('pasta rice') || breadcrumbs.includes('tinned food') || breadcrumbs.includes('baking')) {
            storage = 'cupboard';
        }
    }
    
    // Fallback to text matching if taxonomy yielded nothing
    if (!storage) {
        if(stText.includes('keep frozen') || stText.includes('freeze') || stText.includes('frozen')) {
            storage = 'freezer';
        } else if(stText.includes('keep refrigerated') || stText.includes('fridge') || stText.includes('chilled')) {
            storage = 'fridge';
        } else if(stText.includes('store in a cool') || stText.includes('dry place') || stText.includes('cupboard')) {
            storage = 'cupboard';
        }
    }
    
    // Data validation logic
    let warnings = [];
    let sv = data.diagnostics?.sourceValues || {};
    let pv = data.diagnostics?.parsedValues || { cal: data.cal, prot: data.prot, carb: data.carb, fat: data.fat, fibre: data.fibre };
    let nsrc = data.diagnostics?.nutritionSource || 'Fallback / Legacy Import';
    let nbasis = data.diagnostics?.nutritionBasis || 'unknown';

    // Apply strict field normalisation
    const sourceEnergy = sv.energy ?? sv.cal ?? sv.kcal ?? sv['energy'] ?? sv['Energy'] ?? null;
    const parsedEnergy = pv.energy ?? pv.kcal ?? pv.cal ?? data.energy ?? data.cal;
    const richSourceEnergy = typeof sourceEnergy === 'string' && /(kcal|kj|\/)/i.test(sourceEnergy);
    const energyValue = richSourceEnergy ? sourceEnergy : (parsedEnergy ?? sourceEnergy);
    const normalisedPv = normalizeNutritionPayload({ ...pv, cal: energyValue, energy: energyValue });

    if(nsrc.includes('Not found')) warnings.push("Nutrition table not found. Please expand the Nutrition section on Tesco and try again.");
    if (normalisedPv.cal < 0 || normalisedPv.prot < 0 || normalisedPv.carb < 0 || normalisedPv.fat < 0 || normalisedPv.fibre < 0) warnings.push("Negative nutrition values detected.");
    if (normalisedPv.prot > 100 || normalisedPv.carb > 100 || normalisedPv.fat > 100) warnings.push("Macronutrients exceed 100g (Check if basis is per 100g).");
    if (!normalisedPv.cal && !normalisedPv.prot && !normalisedPv.fat) warnings.push("Nutrition data appears to be completely empty.");

    let diagHtml = '';

    let dBox = document.getElementById('tesco-diagnostics-box');
    if (!dBox) {
        dBox = document.createElement('div');
        dBox.id = 'tesco-diagnostics-box';
        const tp = document.getElementById('tesco-preview');
        tp.insertBefore(dBox, tp.firstChild);
    }
    dBox.innerHTML = diagHtml;

    if(document.getElementById('tp-name')) document.getElementById('tp-name').value = name;
    if(document.getElementById('tp-brand')) document.getElementById('tp-brand').value = brand;
    if(document.getElementById('tp-price')) document.getElementById('tp-price').value = data.price || '';
    
    if(document.getElementById('tp-cal')) document.getElementById('tp-cal').value = normalisedPv.cal || '';
    if(document.getElementById('tp-fat')) document.getElementById('tp-fat').value = normalisedPv.fat || '';
    if(document.getElementById('tp-carb')) document.getElementById('tp-carb').value = normalisedPv.carb || '';
    if(document.getElementById('tp-fibre')) document.getElementById('tp-fibre').value = normalisedPv.fibre || '';
    if(document.getElementById('tp-prot')) document.getElementById('tp-prot').value = normalisedPv.prot || '';
    
    const itemWeightGuess = getTescoItemWeightGuess(data, name);
    const realItemCount = +data.itemCount || 0;
    const countablePack = realItemCount > 1 && itemWeightGuess;
    const importedPackUnit=String(data.packUnit||'g').toLowerCase();
    const importedItemUnit=String(data.itemWeightUnit||'g').toLowerCase()==='ml'?'ml':'g';
    const totalPackAmount=countablePack&&importedPackUnit==='qty'?realItemCount*itemWeightGuess:(data.packSize||'');
    if(document.getElementById('tp-pack')) document.getElementById('tp-pack').value = totalPackAmount;
    setPackUnitEditorValue('tp-pack-unit',countablePack?importedItemUnit:importedPackUnit,{allowLegacyCount:importedPackUnit==='qty'&&!itemWeightGuess});
    
    if(document.getElementById('tp-item-weight')) {
        document.getElementById('tp-item-weight').value = itemWeightGuess;
    }
    if(document.getElementById('tp-item-weight-unit')) document.getElementById('tp-item-weight-unit').value = data.itemWeightUnit || 'g';
    if(document.getElementById('tp-drained-weight')) {
        document.getElementById('tp-drained-weight').value = data.drainedWeight || '';
    }
    if(document.getElementById('tp-drained-weight-unit')) document.getElementById('tp-drained-weight-unit').value = data.drainedWeightUnit || 'g';
    updatePackModelSummary('tp');
    
    if(document.getElementById('tp-storage')) document.getElementById('tp-storage').value = storage;

    let cat = data.cat || 'other';
    if(!data.cat && name) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('pepper') || lowerName.includes('salad') || lowerName.includes('veg') || lowerName.includes('garlic')) {
            cat = 'vegetables';
        } else if (lowerName.includes('quorn') || lowerName.includes('beyond') || lowerName.includes('meat free') || lowerName.includes('vegan chicken') || lowerName.includes('plant based') || lowerName.includes('plant-based')) {
            cat = 'meat-substitute';
        } else if (lowerName.includes('tofu')) {
            cat = 'tofu-tempeh';
        } else if (lowerName.includes('bean') || lowerName.includes('lentil') || lowerName.includes('chickpea')) {
            cat = 'legume';
        }
    }

    if(document.getElementById('tp-cat')) document.getElementById('tp-cat').value = cat;
    syncCategorySearchInput('tp-cat');

    const previewEl = document.getElementById('tesco-preview');
    if (previewEl) previewEl.style.display = 'block';
    
    const msgEl = document.getElementById('tesco-msg');
    if (msgEl) msgEl.innerHTML = '<div class="msg success">Extracted details! Please review below before saving.</div>';
}

function finishTescoImportSelection(pendingTesco, ingredientId, ingredientName, message){
  const product = getProduct(ingredientId);
  if(product) syncProductHierarchyCategory(product, product.groupId ? getIngredientGroup(product.groupId) : null, product.cat);
  if(product && pendingTesco?.type === 'subst' && currentSubstContext.groupId) {
    ensureProductAssignedToGroup(product, getIngredientGroup(currentSubstContext.groupId)?.name || product.name, currentSubstContext.groupId);
    refreshProductGroupAndRecipes(product.id);
    saveState();
  }
  if (pendingTesco) {
      if (pendingTesco.type === 'map') {
          mappingContext.ings[pendingTesco.idx].bankId = ingredientId;
          mappingContext.ings[pendingTesco.idx].groupId = product?.groupId || "";
          renderMappingList();
      } else if (pendingTesco.type === 'subst') {
          currentSubstContext.newBankId = ingredientId;
          document.getElementById('subst-search').value = ingredientName;
          const dd = document.getElementById('subst-dropdown');
          if(dd) dd.style.display = 'none';
          document.getElementById('subst-selected').textContent = `Replacing with: ${ingredientName}`;
      } else if (pendingTesco.type === 'replace') {
          applyReplaceImportSelection(pendingTesco.widgetId, ingredientId, ingredientName);
      } else if (pendingTesco.type === 'editIng') {
          renderBank();
          editIng(ingredientId);
          showMsg('mi-msg', message || 'Updated from Tesco.', 'success');
      } else if (pendingTesco.type === 'unified') {
          const ctx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || window.pendingUnifiedAddContext;
          if (ctx) {
            applyUnifiedMappingResult(ctx, {
              productId: ingredientId,
              groupId: product?.groupId || '',
              productName: ingredientName,
              brand: product?.brand || ''
            });
          }
      } else if (pendingTesco.type === 'manualAdd') {
          const ctx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || window.pendingUnifiedAddContext;
          if (ctx) {
            applyUnifiedMappingResult(ctx, {
              productId: ingredientId,
              groupId: product?.groupId || '',
              productName: ingredientName,
              brand: product?.brand || ''
            });
            window.pendingUnifiedAddContext = null;
          }
          renderBank();
          renderIngredientBank();
          if(document.getElementById('view-data')?.classList.contains('active')) renderDataQuality();
          const el = document.createElement('div');
          el.className='msg success';
          el.style.marginBottom='12px';
          el.textContent=message || `"${ingredientName}" added to ingredient bank.`;
          const bankList = document.getElementById('bank-list');
          if(bankList?.parentNode) {
            bankList.parentNode.insertBefore(el,bankList);
            setTimeout(()=>el.remove(),4000);
          }
      }
      window.pendingTescoMapping = null;
  } else {
      renderBank();
      const el = document.createElement('div');
      el.className='msg success';
      el.style.marginBottom='12px';
      el.textContent=message || `"${ingredientName}" added to ingredient bank.`;
      const bankList = document.getElementById('bank-list');
      if(bankList?.parentNode) {
        bankList.parentNode.insertBefore(el,bankList);
        setTimeout(()=>el.remove(),4000);
      }
  }
}

function createTescoIngredientFromData(data){
  return normaliseLegacyCountedPackOnSave({
    id:'ing'+Date.now(),
    name: data.name,
    brand: data.brand || '',
    cat: data.cat || 'other',
    storage: data.storage || '',
    cal: +data.cal || 0,
    fat: +data.fat || 0,
    carb: +data.carb || 0,
    fibre: +data.fibre || 0,
    prot: +data.prot || 0,
    price: +data.price || null,
    packSize: +data.packSize || null,
    packUnit: data.packUnit || 'g',
    itemWeight: +data.itemWeight || null,
    itemWeightUnit: data.itemWeightUnit || 'g',
    drainedWeight: +data.drainedWeight || null,
    drainedWeightUnit: data.drainedWeightUnit || 'g',
    notes: data.notes || '',
    sourceUrl: data.sourceUrl || null,
    itemCount: data.itemCount || null,
    meatSubstituteFor: null,
    updatedAt: new Date().toISOString()
  });
}

function addTescoPackVariant(match, data){
  if(!match.packOptions) match.packOptions = [];
  if(match.packSize && match.price && match.packOptions.length === 0) {
      match.packOptions.push({
        packSize: match.packSize,
        packUnit: match.packUnit || 'g',
        price: match.price,
        itemWeight: match.itemWeight || null,
        itemWeightUnit: match.itemWeightUnit || 'g',
        drainedWeight: match.drainedWeight || null,
        drainedWeightUnit: match.drainedWeightUnit || 'g'
      });
  }
  match.packOptions.push(normaliseLegacyCountedPackOnSave({
    packSize: data.packSize,
    packUnit: data.packUnit || 'g',
    price: data.price,
    itemWeight: data.itemWeight || null,
    itemWeightUnit: data.itemWeightUnit || 'g',
    drainedWeight: data.drainedWeight || null,
    drainedWeightUnit: data.drainedWeightUnit || 'g',
    sourceUrl: data.sourceUrl || null,
    itemCount: data.itemCount || null
  }));
  if(data.drainedWeight) {
    match.drainedWeight = data.drainedWeight;
    match.drainedWeightUnit = data.drainedWeightUnit || 'g';
  }
  if(data.sourceUrl) match.sourceUrl = match.sourceUrl || data.sourceUrl;
  match.updatedAt = new Date().toISOString();
  refreshProductGroupAndRecipes(match.id);
  saveState(true);
}

function openTescoDuplicateChoice(match, data, pendingTesco){
  let wrap = document.getElementById('tesco-duplicate-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'tesco-duplicate-wrap';
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `
      <div class="modal" style="max-width:520px">
        <h2 style="margin-top:0">Possible duplicate</h2>
        <div id="tesco-duplicate-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
        <div class="btn-row">
          <button class="btn primary" id="tesco-dup-variant-btn">Add as pack variant</button>
          <button class="btn ghost" id="tesco-dup-separate-btn">No, not a duplicate</button>
          <button class="btn ghost" id="tesco-dup-cancel-btn">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }
  if(wrap.parentElement !== document.body) document.body.appendChild(wrap);
  wrap.style.zIndex = '500';
  document.getElementById('tesco-duplicate-copy').innerHTML =
    `<strong>${ppEscapeHtml(data.name)}</strong> looks similar to <strong>${ppEscapeHtml(match.name)}</strong>.<br>Choose whether this Tesco item is another pack size for the existing ingredient, or a separate ingredient.`;
  document.getElementById('tesco-dup-variant-btn').onclick = () => {
    addTescoPackVariant(match, data);
    wrap.classList.remove('open');
    closeTescoModal();
    renderBank();
    finishTescoImportSelection(pendingTesco, match.id, match.name, `Added pack option to ${match.name}.`);
  };
  document.getElementById('tesco-dup-separate-btn').onclick = () => {
    const ing = createTescoIngredientFromData(data);
    state.ingredients.push(ing);
    if(pendingTesco?.type === 'subst' && currentSubstContext.groupId) {
      ensureProductAssignedToGroup(ing, getIngredientGroup(currentSubstContext.groupId)?.name || ing.name, currentSubstContext.groupId);
    } else {
      promptGroupForImportedProduct(ing, pendingTesco?.name || data.name || ing.name);
    }
    refreshProductGroupAndRecipes(ing.id);
    saveState();
    wrap.classList.remove('open');
    closeTescoModal();
    finishTescoImportSelection(pendingTesco, ing.id, ing.name, `"${ing.name}" added to ingredient bank.`);
  };
  document.getElementById('tesco-dup-cancel-btn').onclick = () => wrap.classList.remove('open');
  wrap.classList.add('open');
}

function saveTescoIngredient(categoryReady=false){
  const name = document.getElementById('tp-name').value.trim();
  if(!name) return showMsg('tesco-save-msg','Please enter a product name.','error');
  if(!categoryReady)return resolveCategoryBeforeProductSave('tp-cat',()=>saveTescoIngredient(true));

  const pendingTesco = window.pendingTescoMapping;
  const manualAddMode = pendingTesco?.type === 'manualAdd';
  const newPrice = +document.getElementById('tp-price').value||null;
  const newSize = +document.getElementById('tp-pack').value||null;
  const newUnit = document.getElementById('tp-pack-unit').value||'g';
  const newWeight = +document.getElementById('tp-item-weight').value||null;
  const newWeightUnit = document.getElementById('tp-item-weight-unit')?.value||'g';
  const explicitUsableWeight = +document.getElementById('import-usable-weight')?.value || null;
  const newDrainedWeight = explicitUsableWeight || (+document.getElementById('tp-drained-weight')?.value||null);
  const newDrainedWeightUnit = document.getElementById('tp-drained-weight-unit')?.value||'g';
  const newSourceUrl = manualAddMode ? null : (window.__lastTescoImport ? window.__lastTescoImport.url : null);
  const newItemCount = newUnit === 'qty' ? newSize : (!manualAddMode && window.__lastTescoImport ? window.__lastTescoImport.itemCount : null);
  
  const selectedCat = document.getElementById('import-category')?.value || document.getElementById('tp-cat')?.value || 'other';
  const selectedStorage = document.getElementById('import-storage')?.value || document.getElementById('tp-storage')?.value || '';
  const selectedFibre = +document.getElementById('import-fibre')?.value || +document.getElementById('tp-fibre')?.value || 0;
  const selectedNotes = document.getElementById('import-notes')?.value?.trim() || document.getElementById('tp-notes')?.value?.trim() || '';

  const tescoData = normaliseLegacyCountedPackOnSave({
    name,
    brand: document.getElementById('tp-brand').value.trim(),
    cat: selectedCat,
    category: selectedCat,
    storage: selectedStorage,
    cal: +document.getElementById('tp-cal').value||0,
    fat: +document.getElementById('tp-fat').value||0,
    carb: +document.getElementById('tp-carb').value||0,
    fibre: selectedFibre,
    prot: +document.getElementById('tp-prot').value||0,
    price: newPrice,
    packSize: newSize,
    packUnit: newUnit,
    itemWeight: newWeight,
    itemWeightUnit: newWeightUnit,
    drainedWeight: newDrainedWeight,
    usableWeight: newDrainedWeight,
    drainedWeightUnit: newDrainedWeightUnit,
    notes: selectedNotes,
    sourceUrl: newSourceUrl,
    itemCount: newItemCount
  });

  if(pendingTesco && pendingTesco.type === 'editIng' && pendingTesco.ingredientId){
      const target = state.ingredients.find(i => i.id === pendingTesco.ingredientId);
      if(!target) return showMsg('tesco-save-msg','Could not find the ingredient to update.','error');
      applyTescoImportToExistingIngredient(target, tescoData);
      target.updatedAt = new Date().toISOString();
      if(target.groupId) ensureProductAssignedToGroup(target, target.name, target.groupId);
      syncProductHierarchyCategory(target, target.groupId ? getIngredientGroup(target.groupId) : null, target.cat);
      refreshProductGroupAndRecipes(target.id);
      saveState(true);
      closeTescoModal();
      window.pendingTescoMapping = null;
      renderBank();
      editIng(target.id);
      showMsg('mi-msg', 'Updated this ingredient from Tesco.', 'success');
      return;
  }

  // Search for an existing ingredient to merge pack options
  const existingMatches = (state.ingredients || []).filter(i => {
     const n1 = i.name.toLowerCase().replace(/[^a-z0-9]/g, '');
     const n2 = name.toLowerCase().replace(/[^a-z0-9]/g, '');
     return n1.length > 3 && n2.length > 3 && (n1 === n2 || n1.includes(n2) || n2.includes(n1));
  });

  if(existingMatches.length > 0 && newSize && newPrice) {
      const match = existingMatches[0];
      openTescoDuplicateChoice(match, tescoData, pendingTesco);
      return;
  }

  const ing = normaliseLegacyCountedPackOnSave({
    id:'ing'+Date.now(),
    name,
    brand: document.getElementById('tp-brand').value.trim(),
    cat: selectedCat,
    category: selectedCat,
    storage: selectedStorage,
    cal: +document.getElementById('tp-cal').value||0,
    fat: +document.getElementById('tp-fat').value||0,
    carb: +document.getElementById('tp-carb').value||0,
    fibre: selectedFibre,
    prot: +document.getElementById('tp-prot').value||0,
    price: newPrice,
    packSize: newSize,
    packUnit: newUnit,
    itemWeight: newWeight,
    itemWeightUnit: newWeightUnit,
    drainedWeight: newDrainedWeight,
    usableWeight: newDrainedWeight,
    drainedWeightUnit: newDrainedWeightUnit,
    notes: selectedNotes,
    sourceUrl: newSourceUrl,
    itemCount: newItemCount,
    meatSubstituteFor: null,
    updatedAt: new Date().toISOString()
  });

  if (typeof persistProductToBank === 'function') {
    persistProductToBank(ing);
  } else {
    state.ingredients.push(ing);
  }
  if(pendingTesco?.type === 'subst' && currentSubstContext.groupId) {
      ensureProductAssignedToGroup(ing, getIngredientGroup(currentSubstContext.groupId)?.name || ing.name, currentSubstContext.groupId);
  } else if (pendingTesco?.groupId) {
      ensureProductAssignedToGroup(ing, getIngredientGroup(pendingTesco.groupId)?.name || ing.name, pendingTesco.groupId);
  } else {
      promptGroupForImportedProduct(ing, pendingTesco?.name || ing.name);
  }
  syncProductHierarchyCategory(ing, ing.groupId ? getIngredientGroup(ing.groupId) : null, ing.cat);
  refreshPlatePlanDerivedState({changedProductIds:[ing.id],render:false});
  saveIngredient(ing);
  saveState(true);
  
  const newIngId = ing.id;
  closeTescoModal();
  
  if (pendingTesco) {
      if (pendingTesco.type === 'map') {
          const idx = pendingTesco.idx;
          mappingContext.ings[idx].bankId = newIngId;
          mappingContext.ings[idx].groupId = ing.groupId || "";
          renderMappingList();
      } else if (pendingTesco.type === 'subst') {
          currentSubstContext.newBankId = newIngId;
          const sSearch = document.getElementById('subst-search');
          if(sSearch) sSearch.value = ing.name;
          const sDrop = document.getElementById('subst-dropdown');
          if(sDrop) sDrop.style.display = 'none';
          const sSel = document.getElementById('subst-selected');
          if(sSel) sSel.textContent = `Replacing with: ${ing.name}`;
      } else if (pendingTesco.type === 'replace') {
          applyReplaceImportSelection(pendingTesco.widgetId, newIngId, ing.name);
      } else if (pendingTesco.type === 'editIng') {
          renderBank();
          editIng(newIngId);
          showMsg('mi-msg', 'Added this ingredient from Tesco.', 'success');
      } else if (pendingTesco.type === 'unified') {
          if (activeUnifiedMappingContext) {
            applyUnifiedMappingResult(activeUnifiedMappingContext, {
              productId: newIngId,
              groupId: ing.groupId || '',
              productName: ing.name,
              brand: ing.brand
            });
          }
      } else if (pendingTesco.type === 'manualAdd') {
          renderBank();
          renderIngredientBank();
          if(document.getElementById('view-data')?.classList.contains('active')) renderDataQuality();
          const el = document.createElement('div');
          el.className='msg success';
          el.style.marginBottom='12px';
          el.textContent=`"${name}" added to ingredient bank.`;
          const bankList = document.getElementById('bank-list');
          if(bankList?.parentNode) {
            bankList.parentNode.insertBefore(el,bankList);
            setTimeout(()=>el.remove(),4000);
          }
      }
      window.pendingTescoMapping = null;
  } else {
      renderBank();
      const el = document.createElement('div');
      el.className='msg success';
      el.style.marginBottom='12px';
      el.textContent=`"${name}" added to ingredient bank.`;
      const bankList = document.getElementById('bank-list');
      bankList.parentNode.insertBefore(el,bankList);
      setTimeout(()=>el.remove(),4000);
  }
}

function ensureIngredientModalDetached(){
  const panel = document.getElementById('manual-ing-panel');
  if(panel && panel.parentElement !== document.body) document.body.appendChild(panel);
  return panel;
}

function ensureIngredientTescoUpdateButton(){
  const title = document.getElementById('mi-title');
  if(!title || document.getElementById('mi-tesco-actions')) return;
  const row = document.createElement('div');
  row.id = 'mi-tesco-actions';
  row.style.cssText = 'display:flex;justify-content:flex-end;margin:-4px 0 12px;';
  row.innerHTML = '<button type="button" class="btn sm ghost" onclick="openTescoImportForIngredientEdit()">Paste/update from Tesco</button>';
  title.insertAdjacentElement('afterend', row);
}

function openTescoImportForIngredientEdit(){
  const name = document.getElementById('mi-name')?.value.trim() || '';
  showTescoImport({ type:'editIng', ingredientId: editIngId, name });
}

function isPowderOrSupplementProduct(ing){
  const text = [ing?.name, ing?.brand, ing?.cat, ing?.family, ing?.notes].filter(Boolean).join(' ').toLowerCase();
  return /protein|whey|powder|creatine|supplement|casein|isolate|mass gainer|pre workout/.test(text);
}

function updateServingConverterHint(ing){
  const hint = document.getElementById('mi-serving-hint');
  if(!hint) return;
  hint.innerHTML = '';
  hint.style.display = 'none';
}

function applyServingNutritionConverter(){
  const serving = +document.getElementById('mi-serving-size')?.value || 0;
  if(serving <= 0) return showMsg('mi-msg','Enter the serving size in grams/ml first.','error');
  const fields = [
    ['mi-serving-cal','mi-cal'],
    ['mi-serving-fat','mi-fat'],
    ['mi-serving-carb','mi-carb'],
    ['mi-serving-fibre','mi-fibre'],
    ['mi-serving-prot','mi-prot']
  ];
  fields.forEach(([fromId,toId]) => {
    const raw = document.getElementById(fromId);
    const target = document.getElementById(toId);
    if(!raw || !target || raw.value === '') return;
    const val = +raw.value;
    if(!Number.isFinite(val)) return;
    const per100 = val * 100 / serving;
    target.value = Math.round(per100 * 10) / 10;
  });
  showMsg('mi-msg','Converted serving label values to per-100g/ml values. Review, then save.','success');
  updateServingConverterHint({ name: document.getElementById('mi-name')?.value || '', cat: document.getElementById('mi-cat')?.value || '' });
}

function showAddIng(){
  editIngId = null;
  showTescoImport({ type:'manualAdd' });
}

function getIngredientPackVariantLabels(ing){
  const rows=[];
  const seen=new Set();
  const addVariant=po=>{
    if(!po)return;
    const size=po.packSize ?? po.size;
    const unit=po.packUnit || po.unit || 'g';
    const itemWeight=po.itemWeight || null;
    if(!size && !itemWeight)return;
    const key=[size,unit,itemWeight].join('|');
    if(seen.has(key))return;
    seen.add(key);
    rows.push(formatProductPackSummary({packSize:size,packUnit:unit,itemWeight,itemWeightUnit:po.itemWeightUnit||'g',drainedWeight:po.drainedWeight,drainedWeightUnit:po.drainedWeightUnit||'g'}));
  };
  addVariant(ing);
  (ing.packOptions||[]).forEach(addVariant);
  return rows;
}

function formatIngredientPackVariantLabel(po){
  if(!po) return '';
  const size = po.packSize ?? po.size;
  const unit = po.packUnit || po.unit || 'g';
  const itemWeight = po.itemWeight || null;
  let label = formatProductPackSummary({packSize:size,packUnit:unit,itemWeight,itemWeightUnit:po.itemWeightUnit||'g',drainedWeight:po.drainedWeight,drainedWeightUnit:po.drainedWeightUnit||'g'});
  if(!label && itemWeight) label = `${itemWeight}g item`;
  if(po.price) label += `${label ? ' · ' : ''}£${(+po.price).toFixed(2)}`;
  return label;
}

function renderIngredientPackVariantsEditor(ing){
  const variantsEl = document.getElementById('mi-pack-variants');
  if(!variantsEl) return;
  if(!ing){
    variantsEl.style.display = 'none';
    variantsEl.innerHTML = '';
    return;
  }

  const baseLabel = formatIngredientPackVariantLabel(ing);
  const optionRows = (ing.packOptions || []).map((po, idx) => {
    const label = formatIngredientPackVariantLabel(po) || 'Pack variant';
    return `<li style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 0;"><span>${ppEscapeHtml(label)}</span><button type="button" class="btn sm ghost" onclick="removeManualPackVariant(${idx})">Remove</button></li>`;
  }).join('');
  const rows = `${baseLabel ? `<li style="margin:3px 0;"><span>${ppEscapeHtml(baseLabel)}</span> <span class="tag">Current pack</span></li>` : ''}${optionRows}`;

  variantsEl.innerHTML = `
    <strong>Available Tesco Variants</strong>
    <ul style="margin:6px 0 10px 18px;padding:0;">${rows || '<li>No pack variants saved yet.</li>'}</ul>
    <div class="grid3" style="margin-top:8px;">
      <div><label>Variant size</label><input type="number" id="mi-var-pack" placeholder="400"></div>
      <div><label>Total unit</label><select id="mi-var-unit"><option value="g">g</option><option value="ml">ml</option></select></div>
      <div><label>Price (£)</label><input type="number" id="mi-var-price" placeholder="1.25" step="0.01"></div>
      <div><label>Weight / volume of 1 usable item</label><div style="display:flex;gap:5px"><input type="number" id="mi-var-item-weight" placeholder="75"><select id="mi-var-item-weight-unit" style="width:70px"><option value="g">g</option><option value="ml">ml</option></select></div></div>
      <div><label>Drained weight (usable content)</label><div style="display:flex;gap:5px"><input type="number" id="mi-var-drained-weight" placeholder="235"><select id="mi-var-drained-weight-unit" style="width:70px"><option value="g">g</option><option value="ml">ml</option></select></div></div>
      <div style="display:flex;align-items:flex-end;"><button type="button" class="btn sm secondary" onclick="addManualPackVariant()">Add variant</button></div>
    </div>
  `;
  variantsEl.style.display = 'block';
}

function addManualPackVariant(){
  if(!editIngId) return showMsg('mi-msg','Save the ingredient before adding pack variants.','error');
  const ing = state.ingredients.find(i => i.id === editIngId);
  if(!ing) return;
  const packSize = +document.getElementById('mi-var-pack')?.value || null;
  const packUnit = document.getElementById('mi-var-unit')?.value || 'g';
  const price = +document.getElementById('mi-var-price')?.value || null;
  const itemWeight = +document.getElementById('mi-var-item-weight')?.value || null;
  const itemWeightUnit = document.getElementById('mi-var-item-weight-unit')?.value || 'g';
  const drainedWeight = +document.getElementById('mi-var-drained-weight')?.value || null;
  const drainedWeightUnit = document.getElementById('mi-var-drained-weight-unit')?.value || 'g';
  if(!packSize) return showMsg('mi-msg','Enter a variant pack size first.','error');
  if(!ing.packOptions) ing.packOptions = [];
  ing.packOptions.push(normaliseLegacyCountedPackOnSave({ packSize, packUnit, price, itemWeight, itemWeightUnit, drainedWeight, drainedWeightUnit }));
  if(drainedWeight && !ing.drainedWeight) {
    ing.drainedWeight = drainedWeight;
    ing.drainedWeightUnit = drainedWeightUnit;
  }
  refreshProductGroupAndRecipes(ing.id);
  saveState();
  renderIngredientPackVariantsEditor(ing);
  refreshAfterIngredientEdit();
  showMsg('mi-msg','Pack variant added.','success');
}

function removeManualPackVariant(idx){
  if(!editIngId) return;
  const ing = state.ingredients.find(i => i.id === editIngId);
  if(!ing || !ing.packOptions) return;
  ing.packOptions.splice(idx, 1);
  refreshProductGroupAndRecipes(ing.id);
  saveState();
  renderIngredientPackVariantsEditor(ing);
  refreshAfterIngredientEdit();
}

function showIngredientNutritionFixPrompt(blocker){
  if(!blocker) return;
  hideOverlay();
  editIng(blocker.id);
  const msgEl = document.getElementById('mi-msg');
  if(msgEl){
    if(blocker.reason === 'itemWeight') {
      msgEl.innerHTML = `<div class="msg error">This recipe uses <strong>${ppEscapeHtml(blocker.name)}</strong> as a counted item, but PlatePlan needs the <strong>Weight of 1 item (g)</strong> to calculate nutrition safely. Add that value here, then save to continue reviewing the recipe.</div>`;
    } else {
      msgEl.innerHTML = `<div class="msg error">This recipe uses <strong>${ppEscapeHtml(blocker.name)}</strong>, but the ingredient has no usable per-100g nutrition data. Add the calories and nutrition values here, then save to continue reviewing the recipe.</div>`;
    }
  }
}

function handlePendingRecipeNutritionAfterSave(savedId){
  if(!pendingRecipeNutritionFix) return false;
  const args = pendingRecipeNutritionFix.args;
  const blockers = findRecipeNutritionBlockers(args.allIngs);
  pendingRecipeNutritionFix.blockers = blockers;
  const next = blockers[0];

  if(next){
    if(next.id === savedId){
      const msgEl = document.getElementById('mi-msg');
      if(msgEl){
        msgEl.innerHTML = next.reason === 'itemWeight'
          ? `<div class="msg error">Please add the <strong>Weight of 1 item (g)</strong> for <strong>${ppEscapeHtml(next.name)}</strong> before continuing.</div>`
          : `<div class="msg error">Please add at least one usable per-100g nutrition value for <strong>${ppEscapeHtml(next.name)}</strong> before continuing.</div>`;
      }
      return true;
    }
    closeIngModal();
    showIngredientNutritionFixPrompt(next);
    return true;
  }

  pendingRecipeNutritionFix = null;
  closeIngModal();
  refreshAfterIngredientEdit();
  continueAfterResolve(args.name, args.allIngs, args.serves, args.types, args.method, args.ingsText, true);
  return true;
}

function editIng(id){
  capturePlatePlanEditBaseline('products/'+id);
  hideLegacyCategoryAndMeatFields();
  const ing=state.ingredients.find(i=>i.id===id);
  if(!ing)return;
  const packDisplay=normaliseLegacyCountedPackOnSave({...ing});

  editIngId=id;
  ensureIngredientModalDetached();
  ensureIngredientTescoUpdateButton();
  document.getElementById('mi-title').textContent='Edit product';
  document.getElementById('mi-name').value=ing.name||'';
  document.getElementById('mi-brand').value=ing.brand||'';
  document.getElementById('mi-cat').value=CAT[ing.cat] ? ing.cat : 'other';
  syncCategorySearchInput('mi-cat');
  document.getElementById('mi-storage').value=ing.storage || '';
  document.getElementById('mi-cal').value=ing.cal||'';
  document.getElementById('mi-fat').value=ing.fat||'';
  document.getElementById('mi-carb').value=ing.carb||'';
  document.getElementById('mi-fibre').value=ing.fibre||'';
  document.getElementById('mi-prot').value=ing.prot||'';
  document.getElementById('mi-price').value=ing.price||'';
  document.getElementById('mi-pack').value=packDisplay.packSize||'';
  setPackUnitEditorValue('mi-pack-unit',packDisplay.packUnit||'g',{allowLegacyCount:packDisplay.packUnit==='qty'});
  document.getElementById('mi-item-weight').value=ing.itemWeight||'';
  if(document.getElementById('mi-item-weight-unit')) document.getElementById('mi-item-weight-unit').value=ing.itemWeightUnit||'g';
  if(document.getElementById('mi-drained-weight')) document.getElementById('mi-drained-weight').value=ing.drainedWeight||'';
  if(document.getElementById('mi-drained-weight-unit')) document.getElementById('mi-drained-weight-unit').value=ing.drainedWeightUnit||'g';
  updatePackModelSummary('mi');
  document.getElementById('mi-notes').value=ing.notes||'';
  if(document.getElementById('mi-meatsub')) document.getElementById('mi-meatsub').value=ing.meatSubstituteFor||'';
  ['mi-serving-size','mi-serving-cal','mi-serving-fat','mi-serving-carb','mi-serving-fibre','mi-serving-prot'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});

  const msgEl=document.getElementById('mi-msg');if(msgEl)msgEl.innerHTML='';
  updateServingConverterHint(ing);
  renderIngredientPackVariantsEditor(ing);
  renderEditProductLinkage(ing);

  // Show as a centred overlay modal instead of scrolling to top of page
  const panel = document.getElementById('manual-ing-panel');
  panel.style.cssText = 'display:block; position:fixed; inset:0; z-index:360; overflow-y:auto; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center;';
  // Wrap the card content in a white box if not already wrapped
  if (!panel.dataset.modalWrapped) {
    panel.dataset.modalWrapped = '1';
    const inner = document.createElement('div');
    inner.id = 'mi-inner-wrap';
    inner.style.cssText = 'background:var(--surface);border-radius:14px;padding:24px;max-width:560px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.3);';
    while(panel.firstChild) inner.appendChild(panel.firstChild);
    panel.appendChild(inner);
  }
  const parsePanel = document.getElementById('parse-panel');
  if(parsePanel) parsePanel.style.display='none';
  const tescoWrap = document.getElementById('tesco-modal-wrap');
  if(tescoWrap) tescoWrap.classList.remove('open');
}

function refreshAfterIngredientEdit(productId = ''){
  return refreshPlatePlanDerivedState({ changedProductIds:productId?[productId]:[], render:true });
}



function ensureAppConfirmModal(){
  let wrap = document.getElementById('app-confirm-wrap');
  if(wrap) return wrap;
  wrap = document.createElement('div');
  wrap.id = 'app-confirm-wrap';
  wrap.className = 'modal-wrap sheet-mobile';
  wrap.style.zIndex = '450';
  wrap.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 id="app-confirm-title" style="margin:0">Confirm</h3>
        <button class="btn sm ghost" onclick="closeAppConfirmModal()">Close</button>
      </div>
      <div id="app-confirm-copy" style="font-size:13px;color:var(--text2);line-height:1.45;margin-bottom:14px"></div>
      <div class="btn-row">
        <button class="btn danger" id="app-confirm-ok">Confirm</button>
        <button class="btn ghost" onclick="closeAppConfirmModal()">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openAppConfirmModal(title, copy, confirmLabel, onConfirm, onCancel=null){
  const wrap = ensureAppConfirmModal();
  appConfirmAction = onConfirm;
  appConfirmCancelAction = onCancel;
  document.getElementById('app-confirm-title').textContent = title || 'Confirm';
  document.getElementById('app-confirm-copy').innerHTML = copy || '';
  const cancel = wrap.querySelector('.btn-row .btn.ghost');
  if(cancel) cancel.style.display = '';
  const btn = document.getElementById('app-confirm-ok');
  btn.textContent = confirmLabel || 'Confirm';
  btn.onclick = () => {
    const action = appConfirmAction;
    closeAppConfirmModal(true);
    if(typeof action === 'function') action();
  };
  wrap.classList.add('open');
}

function openAppInfoModal(title, copy){
  const wrap = ensureAppConfirmModal();
  appConfirmAction = null;
  appConfirmCancelAction = null;
  document.getElementById('app-confirm-title').textContent = title || 'Information';
  document.getElementById('app-confirm-copy').innerHTML = copy || '';
  const btn = document.getElementById('app-confirm-ok');
  btn.textContent = 'Close';
  btn.onclick = closeAppConfirmModal;
  const cancel = wrap.querySelector('.btn-row .btn.ghost');
  if(cancel) cancel.style.display = 'none';
  wrap.classList.add('open');
}

function closeAppConfirmModal(confirmed=false){
  const wrap = document.getElementById('app-confirm-wrap');
  const cancel = wrap?.querySelector('.btn-row .btn.ghost');
  if(cancel) cancel.style.display = '';
  if(wrap) wrap.classList.remove('open');
  const cancelAction=appConfirmCancelAction;
  appConfirmAction = null;
  appConfirmCancelAction = null;
  if(!confirmed&&typeof cancelAction==='function')cancelAction();
}

function ensureAppPromptModal(){
  let wrap=document.getElementById('app-prompt-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.id='app-prompt-wrap';
  wrap.className='modal-wrap sheet-mobile';
  wrap.style.zIndex='455';
  wrap.innerHTML=`<div class="modal" style="max-width:500px">
    <div class="row-between" style="align-items:center;margin-bottom:10px"><h3 id="app-prompt-title" style="margin:0">Enter a value</h3><button class="btn sm ghost" onclick="closeAppPromptModal(false)">Close</button></div>
    <label id="app-prompt-label" for="app-prompt-input">Value</label>
    <input id="app-prompt-input" type="text" style="width:100%;margin:7px 0 14px">
    <div class="btn-row"><button class="btn primary" id="app-prompt-ok">Save</button><button class="btn ghost" onclick="closeAppPromptModal(false)">Cancel</button></div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function openAppPromptModal(title,label,initialValue,confirmLabel,onConfirm,onCancel){
  const wrap=ensureAppPromptModal();
  appPromptAction=onConfirm;
  appPromptCancelAction=onCancel;
  document.getElementById('app-prompt-title').textContent=title||'Enter a value';
  document.getElementById('app-prompt-label').textContent=label||'Value';
  const input=document.getElementById('app-prompt-input');
  input.value=initialValue||'';
  document.getElementById('app-prompt-ok').textContent=confirmLabel||'Save';
  document.getElementById('app-prompt-ok').onclick=()=>{
    const value=input.value.trim();
    if(!value){input.focus();return;}
    const action=appPromptAction;
    closeAppPromptModal(true);
    if(typeof action==='function')action(value);
  };
  wrap.classList.add('open');
  setTimeout(()=>{input.focus();input.select();},0);
}

function closeAppPromptModal(confirmed=false){
  document.getElementById('app-prompt-wrap')?.classList.remove('open');
  const cancel=appPromptCancelAction;
  appPromptAction=null;
  appPromptCancelAction=null;
  if(!confirmed&&typeof cancel==='function')cancel();
}

async function saveManualIng(categoryReady=false){
  const name=document.getElementById('mi-name').value.trim();
  if(!name)return showMsg('mi-msg','Please enter a name.','error');
  if(!categoryReady)return resolveCategoryBeforeProductSave('mi-cat',()=>saveManualIng(true));
  
  const nowIso = new Date().toISOString();
  const existingIng = editIngId ? state.ingredients.find(x=>x.id===editIngId) : null;
  const isNew = !editIngId;
  const ing=normaliseLegacyCountedPackOnSave({
    id:editIngId||('ing'+Date.now()),
    name,
    brand:document.getElementById('mi-brand').value.trim(),
    cat:document.getElementById('mi-cat').value,
    storage:document.getElementById('mi-storage').value,
    cal:+document.getElementById('mi-cal').value||0,
    fat:+document.getElementById('mi-fat').value||0,
    carb:+document.getElementById('mi-carb').value||0,
    fibre:+document.getElementById('mi-fibre').value||0,
    prot:+document.getElementById('mi-prot').value||0,
    price:+document.getElementById('mi-price').value||null,
    packSize:+document.getElementById('mi-pack').value||null,
    packUnit:document.getElementById('mi-pack-unit').value||'g',
    itemWeight:+document.getElementById('mi-item-weight').value||null,
    itemWeightUnit:document.getElementById('mi-item-weight-unit')?.value||'g',
    drainedWeight:+document.getElementById('mi-drained-weight')?.value||null,
    drainedWeightUnit:document.getElementById('mi-drained-weight-unit')?.value||'g',
    groupId: existingIng ? (existingIng.groupId || '') : '',
    subTypeId: existingIng ? (existingIng.subTypeId || existingIng.groupId || '') : '',
    subType: existingIng ? (existingIng.subType || '') : '',
    ingredientId: existingIng ? (existingIng.ingredientId || '') : '',
    itemCount: existingIng ? (existingIng.itemCount || null) : null,
    sourceUrl: existingIng ? (existingIng.sourceUrl || null) : null,
    packOptions: existingIng ? (existingIng.packOptions || []) : [],
    notes:document.getElementById('mi-notes').value.trim(),
    meatSubstituteFor: existingIng ? (existingIng.meatSubstituteFor || null) : null,
    updatedAt: nowIso
  });

  // CRITICAL SEQUENCE: Update in-memory hierarchy, group assignments, category sync and recipe recalculations BEFORE pushing
  let groupUpdate = null;
  if(ing.groupId && getIngredientGroup(ing.groupId)) {
    const grp = getIngredientGroup(ing.groupId);
    ensureProductAssignedToGroup(ing, name, ing.groupId);
    syncProductHierarchyCategory(ing, grp, ing.cat);
    grp.updatedAt = nowIso;
    groupUpdate = grp;
    ing.groupId = grp.id;
    ing.subTypeId = grp.id;
    ing.subType = grp.name;
    const fam = (typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(grp) : null) || (grp.ingredientId ? getIngredientFamily(grp.ingredientId) : null);
    if(fam) ing.ingredientId = fam.id;
    else if(grp.ingredientId) ing.ingredientId = grp.ingredientId;
  } else {
    const assignedGroup = ensureProductAssignedToGroup(ing, name, '', true);
    if(assignedGroup) {
      assignedGroup.updatedAt = nowIso;
      ing.groupId = assignedGroup.id;
      ing.subTypeId = assignedGroup.id;
      ing.subType = assignedGroup.name;
      syncProductHierarchyCategory(ing, assignedGroup, ing.cat);
      groupUpdate = assignedGroup;
      const fam = (typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily(assignedGroup) : null) || (assignedGroup.ingredientId ? getIngredientFamily(assignedGroup.ingredientId) : null);
      if(fam) ing.ingredientId = fam.id;
      else if(assignedGroup.ingredientId) ing.ingredientId = assignedGroup.ingredientId;
    }
  }

  // Pre-calculate recipe nutrition impacts in-memory
  recalcRecipesUsingIngredient(ing.id);

  try {
    await executeDataQualityTransaction('UPDATE_PRODUCT', {
      product: ing,
      isNew,
      groupUpdate
    }, {
      submitButtonId: 'mi-save-btn',
      errorContainerId: 'mi-msg'
    });
  } catch(error) {
    console.warn('saveManualIng transaction error, ensuring local persistence:', error);
    try {
      const idx = state.ingredients.findIndex(x => x.id === ing.id);
      if (idx > -1) state.ingredients[idx] = ing;
      else state.ingredients.push(ing);
      safeLocalStorageSet(SK, safeJsonStringify(state));
    } catch(_saveErr) {
      console.warn('Local storage fallback save error in saveManualIng:', _saveErr);
    }
  }

  try {
    if (typeof pushStateToCloud === 'function') {
      pushStateToCloud(false).catch(e => console.warn('Background cloud sync in saveManualIng:', e));
    }
  } catch(_pushErr) {}

  refreshProductGroupAndRecipes(ing.id);

  // Force immediate audit re-calculation whenever a product weight, price, or unit is saved
  try {
    if (typeof runDataQualityAudits === 'function') {
      runDataQualityAudits(true);
    }
  } catch(auditErr) {
    console.warn('Reactive audit error in saveManualIng:', auditErr);
  }

  if(handlePendingRecipeNutritionAfterSave(ing.id)){
    refreshAfterIngredientEdit(ing.id);
    return;
  }
  closeIngModal();
  editIngId=null;
  refreshAfterIngredientEdit(ing.id);
  if(productEditorReturnToReview){
    productEditorReturnToReview=false;
    if(document.getElementById('modal-wrap')?.classList.contains('open')){
      recalcModal(currentReviewVariant === 'enhanced' ? 'enh' : 'orig');
      document.getElementById('modal-title')?.focus?.({preventScroll:true});
      showPlatePlanToast('Product saved. Continue reviewing the recipe.');
      return;
    }
  }
  finishEditorReturn();
}

function closeIngModal() {
  const panel = document.getElementById('manual-ing-panel');
  panel.style.display = 'none';
  panel.style.cssText = 'display:none';
}

function cancelManualIng() {
    if(pendingRecipeNutritionFix){
      const msgEl = document.getElementById('mi-msg');
      if(msgEl) msgEl.innerHTML = '<div class="msg error">Add the missing nutrition values and save before continuing with this recipe.</div>';
      return;
    }
    closeIngModal();
    if(productEditorReturnToReview){
      productEditorReturnToReview=false;
      document.getElementById('modal-wrap')?.querySelector('button,input,select,textarea')?.focus?.({preventScroll:true});
      return;
    }
    abandonEditorReturn();
}

function deleteIng(id){
    const usage = getIngredientUsage(id);
    if (usage.recipes.length > 0 || usage.plans.length > 0) {
        // Force the user through a replacement flow before deletion.
        openReplaceIngredientModal(id);
        return;
    }
    const product = getProduct(id);
    openAppConfirmModal(
      'Delete product?',
      `Delete <strong>${ppEscapeHtml(product?.name || 'this product')}</strong> from Product Bank?`,
      'Delete product',
      () => runWithRecoveryPoint('Before deleting product', async () => {
        try {
          await executeDataQualityTransaction('DELETE_PRODUCT', { id });
          refreshPlatePlanDerivedState({ persist:false, render:true });
        } catch(e) {
          console.error('deleteIng failed:', e);
        }
      })
    );
}

// === Replace-before-delete flow ===


function openReplaceIngredientModal(targetId){
    const target = state.ingredients.find(i=>i.id===targetId);
    if(!target){
      openAppConfirmModal('Product not found', 'That product could not be found in Product Bank.', 'OK', () => {});
      return;
    }
    const rows = [];
    const usesTarget = ing => ing && (ing.bankId === targetId || resolveProductForIngredient(ing).product?.id === targetId);
    state.recipes.forEach(r => {
        (r.ingredients||[]).forEach((ing, idx) => {
            if(usesTarget(ing)) rows.push({recipeId:r.id, recipeName:r.name, key:'ingredients', idx, line:ing.raw||ing.name, replacementId:''});
        });
        if(r.enhanced && r.enhanced.ingredients){
            r.enhanced.ingredients.forEach((ing, idx) => {
                if(usesTarget(ing)) rows.push({recipeId:r.id, recipeName:r.name+' (Enhanced)', key:'enhanced', idx, line:ing.raw||ing.name, replacementId:''});
            });
        }
    });
    // Meal-plan product choices or legacy substitutions that point at this ingredient
    const planRefs = [];
    if(state.plan && state.plan.slots){
        Object.entries(state.plan.productSelections || {}).forEach(([groupId, productId]) => {
            if(productId === targetId) planRefs.push({ type:'planSelection', groupId, label:'Plan product selection' });
        });
        for(const d in state.plan.slots){
            for(const k in state.plan.slots[d]){
                const s = state.plan.slots[d][k];
                if(s && s.instanceId){
                    const overrideSet = state.overrides[s.instanceId] || {};
                    const subs = overrideSet.substitutions || {};
                    for(const fromId in subs){
                        if(subs[fromId] === targetId) planRefs.push({ type:'substitution', instanceId:s.instanceId, fromId, label:`${formatPlanDayLabel(state.plan,d,{short:true})} ${k}` });
                    }
                    const productOverrides = overrideSet.productOverrides || {};
                    for(const groupId in productOverrides){
                        if(productOverrides[groupId] === targetId) planRefs.push({ type:'productOverride', instanceId:s.instanceId, groupId, label:`${formatPlanDayLabel(state.plan,d,{short:true})} ${k}` });
                    }
                }
            }
        }
    }
    _replaceCtx = { targetId, target, rows, planRefs };
    renderReplaceModal();
    document.getElementById('replace-ing-wrap').classList.add('open');
}

function renderReplaceModal(){
    const c = _replaceCtx; if(!c) return;
    const others = state.ingredients
        .filter(i => i.id !== c.targetId)
        .sort((a,b)=>{
            const aEff = a.cal ? (a.prot/a.cal)*100 : 0;
            const bEff = b.cal ? (b.prot/b.cal)*100 : 0;
            if(bEff !== aEff) return bEff - aEff;
            return a.name.localeCompare(b.name,'en',{sensitivity:'base'});
        });

    // Shared search widget builder — returns HTML for a searchable ingredient picker
    function searchWidget(widgetId, onPickFn) {
        const listId = widgetId + '-list';
        return `
          <div style="position:relative">
            <div style="display:flex;gap:6px;">
            <input type="text" id="${widgetId}-input" placeholder="Search ingredients…"
              onfocus="replaceSearchFilter('${widgetId}', '${listId}')"
              oninput="replaceSearchFilter('${widgetId}', '${listId}')"
              style="flex:1;border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:13px;background:var(--surface);color:var(--text)"
            >
            <button class="btn sm ghost" style="white-space:nowrap" onclick="openTescoImportFromReplace('${widgetId}')">🛒 Import</button>
            </div>
            <div id="${listId}" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;max-height:200px;overflow-y:auto;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.15)">
              ${others.map(i=>{
                const eff = i.cal ? ((i.prot/i.cal)*100).toFixed(1) : '0.0';
                return `<div class="replace-search-opt" data-id="${i.id}" data-name="${(i.name+(i.brand?' ('+i.brand+')':'')).replace(/"/g,'&quot;')}" data-search="${(i.name+' '+(i.brand||'')+' '+(CAT[i.cat]||i.cat||'')).toLowerCase().replace(/"/g,'&quot;')}"
                onclick="${onPickFn}('${widgetId}','${listId}',this)"
                style="padding:7px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)"
              >${i.name}${i.brand?` <span style="color:var(--text3);font-size:11px">(${i.brand})</span>`:''}<span style="float:right;color:var(--text3);font-size:11px">${eff}g P/100kcal</span></div>`;
              }).join('')}
            </div>
            <div id="${widgetId}-selected" style="font-size:12px;color:var(--text2);margin-top:3px;min-height:16px"></div>
          </div>`;
    }

    let rowsHtml = '';
    if(!c.rows.length && !c.planRefs.length){
        rowsHtml = '<div class="msg success" style="margin:0">No live references found — safe to delete.</div>';
    } else {
        rowsHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
        c.rows.forEach((row, i) => {
            rowsHtml += `<div style="border-bottom:1px solid var(--border); padding:8px 0; gap:8px;">
                <div style="margin-bottom:5px">
                    <div style="font-weight:600; font-size:13px;">${row.recipeName}</div>
                    <div style="font-size:11px; color:var(--text3);">${row.line||''}</div>
                </div>
                ${searchWidget('rrow-'+i, 'replaceRowPick')}
            </div>`;
        });
        rowsHtml += '</div>';
        if(c.planRefs.length){
            rowsHtml += `<div style="margin-top:10px; font-size:12px; color:var(--text2);">Plus ${c.planRefs.length} meal-plan substitution override(s) — remapped automatically.</div>`;
        }
    }
    document.getElementById('replace-ing-body').innerHTML = `
        <p style="font-size:12px; color:var(--text2); margin-bottom:10px;">
            <strong>${c.target.name}</strong> is used in the recipes below. Search for a replacement for each, then confirm.
        </p>
        <div style="background:var(--surface2); padding:10px; border-radius:8px; margin-bottom:14px; font-size:12px;">
            <strong style="display:block;margin-bottom:6px">Replace ALL with:</strong>
            ${searchWidget('rrow-bulk', 'replaceBulkPickAndApply')}
        </div>
        ${rowsHtml}
    `;
}

function replaceSearchFilter(widgetId, listId) {
    const inp = document.getElementById(widgetId+'-input');
    if(!inp) return;
    const q = inp.value.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    const list = document.getElementById(listId);
    if(!list) return;
    list.style.display = 'block';
    Array.from(list.querySelectorAll('.replace-search-opt')).forEach(el => {
        const haystack = (el.dataset.search || el.dataset.name || '').toLowerCase();
        el.style.display = !terms.length || terms.every(t => haystack.includes(t)) ? '' : 'none';
    });
}

function openTescoImportFromReplace(widgetId) {
    const name = (document.getElementById(widgetId+'-input')?.value || _replaceCtx?.target?.name || '').trim();
    showTescoImport({ type: 'replace', widgetId, name });
}

function applyReplaceImportSelection(widgetId, id, name) {
    if(!_replaceCtx || !widgetId || !id) return;
    const input = document.getElementById(widgetId+'-input');
    const selected = document.getElementById(widgetId+'-selected');
    if(input) input.value = name;
    if(selected) selected.textContent = '✓ Selected: ' + name;

    if(widgetId === 'rrow-bulk') {
        _replaceCtx.rows.forEach(r => r.replacementId = id);
        _replaceCtx.rows.forEach((r, i) => {
            const rowInput = document.getElementById('rrow-'+i+'-input');
            const rowSelected = document.getElementById('rrow-'+i+'-selected');
            if(rowInput) rowInput.value = name;
            if(rowSelected) rowSelected.textContent = '✓ Selected: ' + name;
        });
    } else {
        const idx = parseInt(widgetId.replace('rrow-', ''));
        if(!isNaN(idx) && _replaceCtx.rows[idx]) _replaceCtx.rows[idx].replacementId = id;
    }
}

function replaceRowPick(widgetId, listId, el) {
    const id = el.dataset.id;
    const name = el.dataset.name;
    // Extract row index from widgetId e.g. 'rrow-2'
    const idx = parseInt(widgetId.replace('rrow-', ''));
    if(_replaceCtx?.rows?.[idx]) _replaceCtx.rows[idx].replacementId = id;
    const inp = document.getElementById(widgetId+'-input');
    if(inp) inp.value = name;
    const sel = document.getElementById(widgetId+'-selected');
    if(sel) sel.textContent = '✓ Selected: ' + name;
    const list = document.getElementById(listId);
    if(list) list.style.display = 'none';
}

function replaceBulkPickAndApply(widgetId, listId, el) {
    const id = el.dataset.id;
    const name = el.dataset.name;
    const bInp = document.getElementById(widgetId+'-input');
    if(bInp) bInp.value = name;
    const bSel = document.getElementById(widgetId+'-selected');
    if(bSel) bSel.textContent = '✓ Applying to all rows: ' + name;
    const list = document.getElementById(listId);
    if(list) list.style.display = 'none';
    if(_replaceCtx?.rows) _replaceCtx.rows.forEach(r => r.replacementId = id);
    // Update each row's search input to reflect the bulk selection
    if(_replaceCtx?.rows) _replaceCtx.rows.forEach((r, i) => {
        const inp = document.getElementById('rrow-'+i+'-input');
        const sel = document.getElementById('rrow-'+i+'-selected');
        if(inp) inp.value = name;
        if(sel) sel.textContent = '✓ Selected: ' + name;
    });
}

function replaceBulkApply(){
    // Legacy — no longer used but kept for safety
}

function closeReplaceModal(){
    document.getElementById('replace-ing-wrap').classList.remove('open');
    _replaceCtx = null;
}

function confirmReplaceAndDelete(){
    const c = _replaceCtx; if(!c) return;
    const missing = c.rows.filter(r => !r.replacementId);
    if(missing.length){
        const body = document.getElementById('replace-ing-body');
        if(body) body.insertAdjacentHTML('afterbegin', `<div class="msg error">Please pick a replacement for all ${c.rows.length} reference(s). ${missing.length} still need a selection.</div>`);
        return;
    }
    openAppConfirmModal(
      'Replace and delete?',
      `Replace ${c.rows.length} reference${c.rows.length===1?'':'s'} and delete <strong>${ppEscapeHtml(c.target.name)}</strong>?`,
      'Replace and delete',
      () => performReplaceAndDelete(c)
    );
}

function performReplaceAndDelete(c){
    if(!c) return;
    runWithRecoveryPoint('Before bulk replacing and deleting product', () => applyReplaceAndDelete(c));
}

async function applyReplaceAndDelete(c){
    if(!c) return;
    try {
      await executeDataQualityTransaction('REPLACE_AND_DELETE_PRODUCT', {
        targetId: c.targetId,
        replacements: c.rows
      });
      // Recalc nutrition for touched recipes
      const touched = new Set(c.rows.map(r => r.recipeId));
      touched.forEach(rid => {
        const r = state.recipes.find(x=>x.id===rid); if(!r) return;
        recalcRecipeObject(r);
      });
      closeReplaceModal();
      if(typeof renderBank==='function') renderBank();
      if(typeof renderVault==='function') renderVault();
      if(typeof renderDataQuality==='function') renderDataQuality();
    } catch(e) {
      console.error('applyReplaceAndDelete failed:', e);
    }
}

async function parsePlainNutritionLabel(text){
  const raw = String(text || '').replace(/\r/g, '\n');
  const lines = raw.split(/\n|;/).map(x => x.trim()).filter(Boolean);
  const joined = lines.join(' | ');
  const payload = {};
  payload.cal = normalizeEnergyKcal(joined);

  function valueFor(labels){
    const patterns = labels.flatMap(label => [
      new RegExp('(?:^|\\b)' + label + '\\b[^0-9]{0,30}(\\d+(?:\\.\\d+)?)', 'i'),
      new RegExp('(\\d+(?:\\.\\d+)?)\\s*g?\\s*(?:^|\\b)' + label + '\\b', 'i')
    ]);
    for(const line of lines){
      const clean = line.toLowerCase();
      for(const pat of patterns){
        const m = clean.match(pat);
        if(m) return +m[1] || 0;
      }
    }
    const all = joined.toLowerCase();
    for(const pat of patterns){
      const m = all.match(pat);
      if(m) return +m[1] || 0;
    }
    return 0;
  }

  payload.fat = valueFor(['fat', 'total fat']);
  payload.carb = valueFor(['carbohydrate', 'carbohydrates', 'carbs', 'total carbohydrate']);
  payload.fibre = valueFor(['fibre', 'fiber']);
  payload.prot = valueFor(['protein']);
  return normalizeNutritionPayload(payload);
}

function parseIng(){
  const name=document.getElementById('pp-name').value.trim(),text=document.getElementById('pp-text').value.trim();
  if(!name||!text)return showMsg('pp-msg','Please enter a name and paste the label.','error');
  showOverlay('Parsing nutritional info...','Using local label parser');
  try{
    const parsed = parsePlainNutritionLabel(text);
    hideOverlay();
    const hasCore = parsed.cal > 0 || parsed.prot > 0 || parsed.carb > 0 || parsed.fat > 0 || parsed.fibre > 0;
    const ing={
      id:'ing'+Date.now(),
      name,
      brand:document.getElementById('pp-brand').value.trim(),
      cat:document.getElementById('pp-cat').value,
      storage:document.getElementById('pp-storage').value,
      cal:+parsed.cal||0,
      prot:+parsed.prot||0,
      carb:+parsed.carb||0,
      fat:+parsed.fat||0,
      fibre:+parsed.fibre||0,
      price:+document.getElementById('pp-price').value||null,
      packSize:+document.getElementById('pp-pack').value||null,
      packUnit:document.getElementById('pp-pack-unit').value||'g',
      itemWeight:+document.getElementById('pp-item-weight').value||null,
      notes:'',
      meatSubstituteFor:null,
      updatedAt: new Date().toISOString()
    };
    state.ingredients.push(ing);
    refreshProductGroupAndRecipes(ing.id);
    saveState();
    
    const parsePanel = document.getElementById('parse-panel');
    if(parsePanel) parsePanel.style.display='none';
    ['pp-name','pp-brand','pp-text','pp-price','pp-pack','pp-meatsub'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
    const sEl = document.getElementById('pp-storage'); if(sEl) sEl.value = '';
    const puEl = document.getElementById('pp-pack-unit'); if(puEl) puEl.value = 'qty';
    const iwEl = document.getElementById('pp-item-weight'); if(iwEl) iwEl.value = '';
    renderBank();
    showMsg('bank-msg', hasCore ? 'Product added from pasted label. Please review the parsed nutrition values.' : 'Product added, but PlatePlan could not confidently read nutrition values. Please edit the product and fill the bank data.', hasCore ? 'success' : 'error');
  }catch(e){hideOverlay();showMsg('pp-msg','Could not parse this label locally. Please add the values manually.','error');}
}


  window.PlatePlanIngredientBank = {
    renderIngredientBank,
    renderBank,
    handleMapFocus,
    handleMapSearch,
    renderMapDropdown,
    selectMapProductItem,
    selectMapIngredientFamily,
    selectMapIngredientDefault,
    recipeIngredientAliasCandidate,
    maybeSuggestIngredientAlias,
    ensureIngredientAliasSuggestionModal,
    openIngredientAliasSuggestionModal,
    closeIngredientAliasSuggestionModal,
    confirmIngredientAliasSuggestion,
    selectMapItem,
    openMappingModal,
    renderMappingList,
    openMiniAdd,
    openMiniEdit,
    saveMiniIng,
    confirmMapping,
    continueAfterResolve,
    buildBankCalculatedResult,
    openSubtypeResolutionModal,
    closeSubtypeResolutionModal,
    openTescoJsonImportModal,
    renderTescoJsonImportStep1,
    previewTescoJsonPayload,
    renderTescoJsonImportStep2,
    closeTescoJsonImportModal,
    filterSubtypeLinkProducts,
    resolveSubtypeViaExisting,
    resolveSubtypeViaTesco,
    resolveSubtypeViaManual,
    fixSubtypeDataQuality,
    openProductMappingModal,
    rememberIngredientSubTypesOpen,
    getFamilyGroups,
    getFamilyProducts,
    isHerbsAndSpicesFamily,
    getFamilyHerbPair,
    ensureProductDefaultPickerModal,
    openProductDefaultPicker,
    closeProductDefaultPicker,
    getProductDefaultPickerRows,
    renderProductDefaultPickerList,
    setDefaultProductFromPicker,
    openProductDefaultPickerBank,
    ensureIngredientToSubTypeModal,
    openIngredientToSubTypeModal,
    closeIngredientToSubTypeModal,
    renderIngredientToSubTypeOptions,
    createIngredientForSubTypeConversion,
    confirmIngredientToSubType,
    convertSubTypeToIngredient,
    showFamilyProducts,
    clearProductFamilyFilter,
    createIngredientFamilyPrompt,
    restoreIngredientEditorOrigin,
    ensureIngredientFamilyDetailsModal,
    openIngredientEditor,
    refreshIngredientFamilyHerbEditor,
    openIngredientEditorHerbConversion,
    openIngredientFamilyDetailsModal,
    closeIngredientFamilyDetailsModal,
    openIngredientFamilyAliasesModal,
    addSubTypeToFamilyPrompt,
    mergeIngredientFamilyPrompt,
    renderIngredientFamilyMergeOptions,
    selectIngredientFamilyMergeTarget,
    selectIngredientFamilyMergeGroupTarget,
    confirmIngredientFamilyMerge,
    applyIngredientFamilyMerge,
    deleteIngredientFamilyPrompt,
    confirmDeleteIngredientFamily,
    applyDeleteIngredientFamily,
    getProductBankFamilyFilterOptions,
    getProductBankFamilyFilterLabel,
    handleProductBankFamilySearch,
    selectProductBankFamilyFromSearch,
    clearProductBankFamilyFilter,
    renderIngredientGroupsPanel,
    mergeSuggestedIngredientGroup,
    createIngredientGroupPrompt,
    assignProductToGroupPrompt,
    openProductGroupPickerModal,
    ensureIngredientFamilyByName,
    ensureDefaultGroupForFamily,
    chooseFamilyPickerTarget,
    setGroupDefaultProduct,
    renderEditProductLinkage,
    ensureProductReallocationModal,
    openProductReallocationModal,
    closeProductReallocationModal,
    reallocateProductToExistingGroup,
    saveProductReallocationToNewIngredient,
    confirmDelinkProduct,
    showGroupProducts,
    clearProductGroupFilter,
    renameIngredientGroupPrompt,
    editGroupFamilyPrompt,
    ensureIngredientFamilyPickerModal,
    openIngredientFamilyPickerModal,
    closeIngredientFamilyPickerModal,
    renderIngredientFamilyPickerOptions,
    assignIngredientFamily,
    createFamilyFromPickerSearch,
    clearIngredientFamilyAssignment,
    renameCurrentIngredientFamily,
    ensureIngredientGroupDetailsModal,
    openIngredientGroupDetailsModal,
    closeIngredientGroupDetailsModal,
    renderIngredientGroupFamilyOptions,
    selectIngredientForGroupDetails,
    createIngredientForGroupDetails,
    resolveIngredientFamilyForGroupDetails,
    getIngredientGroupSearchText,
    findIngredientGroupsByText,
    updateRecipeIngredientGroupIds,
    mergeIngredientGroups,
    mergeIngredientGroupIntoFamily,
    mergeIngredientFamilyIntoGroup,
    ensureIngredientGroupMergeModal,
    openIngredientGroupMergeModal,
    closeIngredientGroupMergeModal,
    renderIngredientGroupMergeOptions,
    selectIngredientGroupMergeTarget,
    selectIngredientGroupMergeFamilyTarget,
    confirmIngredientGroupMerge,
    applyIngredientGroupMerge,
    mergeIngredientGroupPrompt,
    getIngredientGroupRecipeUsage,
    ensureDeleteIngredientGroupModal,
    deleteIngredientGroupPrompt,
    closeDeleteIngredientGroupModal,
    confirmDeleteIngredientGroup,
    applyDeleteIngredientGroup,
    setFamilyFilter,
    applyTescoImportToExistingIngredient,
    extractTescoProduct,
    createTescoIngredientFromData,
    saveTescoIngredient,
    ensureIngredientModalDetached,
    ensureIngredientTescoUpdateButton,
    openTescoImportForIngredientEdit,
    isPowderOrSupplementProduct,
    getIngredientPackVariantLabels,
    formatIngredientPackVariantLabel,
    renderIngredientPackVariantsEditor,
    showIngredientNutritionFixPrompt,
    refreshAfterIngredientEdit,
    openReplaceIngredientModal,
    renderReplaceModal,
    replaceSearchFilter,
    openTescoImportFromReplace,
    applyReplaceImportSelection,
    replaceRowPick,
    replaceBulkPickAndApply,
    replaceBulkApply,
    closeReplaceModal,
    confirmReplaceAndDelete,
    performReplaceAndDelete,
    openAppInfoModal,
    closeAppConfirmModal,
    openAppConfirmModal,
    saveManualIng,
    deleteIng,
    parseIng,
    showTescoImport,
    closeTescoModal,
    openTescoImportFromSubst,
    extractTescoProduct,
    saveTescoIngredient,
    showTescoImportReviewModal,
    renderProductBank: renderBank,
    renderProducts: renderBank,
    renderIngredients: renderIngredientBank,
    renderIngredientBankView: renderIngredientBank,
    formatProductPackSummary,
    formatPackDisplay,
    groupIsHiddenDefaultType,
    getKnownFamilies,
    getProductProteinPer100Kcal,
    familyKey,
    getProductFamily
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, window.PlatePlanIngredientBank);
    window.renderProductBank = renderBank;
    window.renderProducts = renderBank;
    window.renderIngredients = renderIngredientBank;
    window.renderIngredientBankView = renderIngredientBank;
    window.formatProductPackSummary = formatProductPackSummary;
    window.formatPackDisplay = formatPackDisplay;
    window.groupIsHiddenDefaultType = groupIsHiddenDefaultType;
    window.getKnownFamilies = getKnownFamilies;
    window.getProductProteinPer100Kcal = getProductProteinPer100Kcal;
    window.familyKey = familyKey;
    window.getProductFamily = getProductFamily;
    window.PlatePlanIngredients = Object.assign(window.PlatePlanIngredients || {}, window.PlatePlanIngredientBank);
    window.PlatePlanProducts = window.PlatePlanIngredientBank;
    window.openAppInfoModal = openAppInfoModal;
    window.closeAppConfirmModal = closeAppConfirmModal;
    window.openAppConfirmModal = openAppConfirmModal;
    window.saveManualIng = saveManualIng;
    window.deleteIng = deleteIng;
    window.showTescoImport = showTescoImport;
    window.closeTescoModal = closeTescoModal;
    window.openTescoImportFromSubst = openTescoImportFromSubst;
    window.extractTescoProduct = extractTescoProduct;
    window.saveTescoIngredient = saveTescoIngredient;
    window.showTescoImportReviewModal = showTescoImportReviewModal;
  }
})();
