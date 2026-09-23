/**
 * scripts/features/recipe-editor.js
 * PlatePlan Recipe Editor & Variant Management Subsystem
 * Classic global namespace script.
 */

(() => {
// == FINAL RECIPE MODAL UI ==
function renderReviewUnitSelect(unit, prefix, name = ''){
    const current = inferParsedUnitForIngredient({ unit, name });
    const units = ['g','ml','qty'];
    const options = units.map(u => `<option value="${u}" ${current===u?'selected':''}>${u}</option>`).join('');
    return `<select class="r-unit" style="width:100%;min-width:0;border:1px solid var(--border);border-radius:8px;padding:0 5px;background:var(--surface);color:var(--text)" onchange="recalcModal('${prefix}')">${options}</select>`;
}

function uniqueSectionNames(values){
    const seen = new Set();
    return (values || []).map(v => normaliseRecipeIngredientSection(v)).filter(v => {
      const key = canonicalGroupKey(v);
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getParseSectionOptions(){
    return uniqueSectionNames(Array.from(document.querySelectorAll('#parse-ing-list .p-section')).map(el => el.value));
}

function getReviewSectionOptions(prefix){
    return uniqueSectionNames(Array.from(document.querySelectorAll(`#${prefix}-ings-list .r-section`)).map(el => el.value));
}

function updateSectionDatalist(id, values){
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = uniqueSectionNames(values).map(v => `<option value="${ppEscapeAttr(v)}"></option>`).join('');
}

function refreshParseSectionOptions(){
    updateSectionDatalist('parse-section-options', getParseSectionOptions());
}

function refreshReviewSectionOptions(prefix){
    updateSectionDatalist(`${prefix}-section-options`, getReviewSectionOptions(prefix));
}

function renderSectionInput(className, value, listId, onChange, width = '120px'){
    return `<input type="search" class="${className}" value="${ppEscapeAttr(value || '')}" list="${ppEscapeAttr(listId)}" placeholder="Section" title="Optional mini-section, e.g. For the Burger" style="width:${width};" oninput="${onChange}">`;
}

function getReviewResolutionContext(){
    return currentReviewInstanceId ? getPlanContextForInstance(currentReviewInstanceId) : {};
}

function applyReviewContextToIngredients(ings, context = {}){
    return (ings || []).filter(ing => !isIngredientRemovedInContext(ing, context)).map(ing => {
      const adjusted = typeof ing === 'object' ? getAdjustedIngredientForContext(ing, context) : ing;
      if(typeof adjusted === 'object' && adjusted !== ing) return { ...adjusted, isSubstituted: true, originalName: ing.name, originalBankId: ing.bankId, originalGroupId: ing.groupId, originalKey: getRecipeIngredientKey(ing) };
      return adjusted;
    });
}

function applyTemporaryReviewOverrides(prefix){
    if(!currentReviewInstanceId) return;
    const ov = getPlanOverride(currentReviewInstanceId);
    const rows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
    rows.forEach(row => {
      const originalKey = row.dataset.originalKey || row.dataset.groupid || row.dataset.bankid;
      const bankId = row.dataset.bankid || '';
      const groupId = row.dataset.groupid || '';
      if(!originalKey) return;
      if(row.dataset.tempRemoved === '1') {
        ov.removeIngredientKeys[originalKey] = true;
        delete ov.ingredientReplacements[originalKey];
        delete ov.mergeInto[originalKey];
        if(groupId) delete ov.productOverrides[groupId];
        return;
      }
      delete ov.removeIngredientKeys[originalKey];
      if(bankId && bankId !== (row.dataset.originalBankid || '')) {
        ov.ingredientReplacements[originalKey] = bankId;
        if(groupId) ov.productOverrides[groupId] = bankId;
      }
    });
    saveState();
    if(document.getElementById('view-planner')?.classList.contains('active')) renderPlan();
    if(document.getElementById('view-shopping')?.classList.contains('active')) renderShopping();
}

function getReviewIngredientSearchOptions(query){
    const q = (query || '').trim().toLowerCase();
    if(!q) return [];
    ensureIngredientGroups();
    ensureIngredientFamilies();
    const variants = getSearchVariants(q);
    const rows = [];
    const seen = new Set();
    (state.ingredientFamilies || []).forEach(family => {
      const hay = [family.name, ...(family.aliases || [])].join(' ').toLowerCase();
      if(!variants.some(v => hay.includes(v))) return;
      const group = getDefaultGroupForIngredientFamily(family) || getFamilyGroups(family.id)[0];
      if(!group || seen.has('family:' + family.id)) return;
      const product = resolveProductForIngredient({ groupId: group.id }).product;
      rows.push({ kind:'ingredient', id:family.id, groupId:group.id, bankId:product?.id || '', label:family.name, meta:`Ingredient default · ${getGroupTypeName(group)}${product?.name ? ' · ' + product.name : ''}` });
      seen.add('family:' + family.id);
    });
    (state.ingredientGroups || []).forEach(group => {
      const hay = getIngredientGroupSearchText(group);
      if(!variants.some(v => hay.includes(v))) return;
      if(seen.has('group:' + group.id)) return;
      const product = resolveProductForIngredient({ groupId: group.id }).product;
      rows.push({ kind:'subtype', id:group.id, groupId:group.id, bankId:product?.id || '', label:getGroupTypeName(group), meta:`Sub-type · ${getGroupHierarchyText(group)}${product?.name ? ' · ' + product.name : ''}` });
      seen.add('group:' + group.id);
    });
    return rows.slice(0, 12);
}

function closeReviewIngredientSearchDropdown(row){
    row?.querySelector('.review-ing-search-dropdown')?.remove();
}

function renderReviewIngredientSearch(input, prefix){
    const row = input.closest('.rev-ing-row');
    if(!row) return;
    closeReviewIngredientSearchDropdown(row);
    const options = getReviewIngredientSearchOptions(input.value);
    if(!options.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'review-ing-search-dropdown';
    wrap.style.cssText = 'position:absolute;z-index:9999;left:0;right:0;top:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.12);max-height:220px;overflow:auto;margin-top:3px;';
    wrap.innerHTML = options.map(opt => `<button type="button" data-kind="${ppEscapeAttr(opt.kind)}" data-id="${ppEscapeAttr(opt.id)}" data-groupid="${ppEscapeAttr(opt.groupId)}" data-bankid="${ppEscapeAttr(opt.bankId)}" style="display:block;width:100%;border:0;border-bottom:1px solid var(--border);background:var(--surface);text-align:left;padding:8px 10px;cursor:pointer;color:var(--text)"><strong>${ppEscapeHtml(opt.label)}</strong><div style="font-size:11px;color:var(--text2);margin-top:2px">${ppEscapeHtml(opt.meta)}</div></button>`).join('');
    const host = input.parentElement;
    if(host) host.appendChild(wrap);
    wrap.querySelectorAll('button').forEach(btn => {
      btn.onmousedown = e => e.preventDefault();
      btn.onclick = () => {
        row.dataset.groupid = btn.dataset.groupid || '';
        row.dataset.bankid = btn.dataset.bankid || '';
        if(btn.dataset.kind === 'ingredient') {
          row.dataset.ingredientid = btn.dataset.id || '';
          row.dataset.mappedViaIngredient = '1';
        } else {
          row.dataset.ingredientid = '';
          row.dataset.mappedViaIngredient = '';
        }
        input.value = btn.querySelector('strong')?.textContent || input.value;
        closeReviewIngredientSearchDropdown(row);
        const editBtn = row.querySelector('.r-edit-ing');
        if(editBtn) editBtn.style.display = row.dataset.bankid ? 'inline-block' : 'none';
        recalcModal(prefix);
      };
      btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
      btn.onmouseleave = () => btn.style.background = 'var(--surface)';
    });
}

function handleReviewIngredientNameInput(input, prefix){
    const row = input.closest('.rev-ing-row');
    if(row){
      row.dataset.ingredientid = '';
      row.dataset.mappedViaIngredient = '';
      row.dataset.groupid = '';
      row.dataset.bankid = '';
    }
    renderReviewIngredientSearch(input, prefix);
    recalcModal(prefix);
}

let reviewDragRow = null;
function startReviewIngredientDrag(event){
    reviewDragRow = (event?.currentTarget instanceof Element ? event.currentTarget.closest('.rev-ing-row') : (this instanceof Element ? this.closest('.rev-ing-row') : event?.target?.closest?.('.rev-ing-row'))) || null;
    if(!reviewDragRow) return;
    if(event?.dataTransfer){
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', 'ingredient-row');
    }
    reviewDragRow.style.opacity = '.45';
}
function overReviewIngredientDrag(event){
    if(event?.preventDefault) event.preventDefault();
    const target = (event?.currentTarget instanceof Element ? event.currentTarget.closest('.rev-ing-row') : (this instanceof Element ? this.closest('.rev-ing-row') : event?.target?.closest?.('.rev-ing-row'))) || null;
    if(!reviewDragRow || !target || target === reviewDragRow || !target.parentNode) return;
    const rect = target.getBoundingClientRect();
    const before = (event?.clientY ?? 0) < rect.top + rect.height / 2;
    target.parentNode.insertBefore(reviewDragRow, before ? target : target.nextSibling);
}
function endReviewIngredientDrag(event, prefix){
    if(reviewDragRow) reviewDragRow.style.opacity = '';
    reviewDragRow = null;
    if(prefix) recalcModal(prefix);
}

function renderModalIngs(prefix, ings) {
    const context = getReviewResolutionContext();
    ings = orderRecipeIngredientsBySection(applyReviewContextToIngredients(ings || [], context));
    const list = document.getElementById(prefix + '-ings-list');
    const header = `<div class="rev-ing-header review-ingredient-row" style="margin-bottom:4px;font-size:11px;color:var(--text2);font-weight:600;">
       <span></span>
       <span>Qty</span>
       <span>Unit</span>
       <span>Section</span>
       <span>Ingredient</span>
       <span style="text-align:center;" title="Keep in the recipe and shopping list, but exclude from nutrition totals.">Not eaten</span>
       <span style="text-align:center;">Actions</span>
    </div>`;
    const rows = ings.map((ing) => {
        const p = typeof ing === 'string' ? parseIngredientLine(ing) : ing;
        if (!p) return '';
        const amount = normaliseRecipeAmountForUi(p);
        const family = p.ingredientId ? getIngredientFamily(p.ingredientId) : null;
        const displayName = p.mappedViaIngredient && family ? family.name : (p.name || '');
        const groupId = p.groupId || getRecipeIngredientGroupId(p) || '';
        const group = groupId ? getIngredientGroup(groupId) : null;
        const product = resolveProductForIngredient({ ...p, groupId }).product;
        const mappingText = group ? `${getGroupHierarchyText(group)}${product?.name ? ` · ${product.name}` : ''}` : (product?.name || 'Not mapped yet');
        return `<div class="rev-ing-row review-ingredient-row mobile-editor-card" draggable="true" ondragstart="startReviewIngredientDrag(event)" ondragover="overReviewIngredientDrag(event)" ondragend="endReviewIngredientDrag(event, '${prefix}')" data-bankid="${p.bankId||''}" data-original-bankid="${p.originalBankId || p.bankId || ''}" data-original-key="${p.originalKey || p.originalGroupId || p.originalBankId || getRecipeIngredientKey(p)}" data-groupid="${groupId}" data-ingredientid="${p.ingredientId || ''}" data-mapped-via-ingredient="${p.mappedViaIngredient ? '1' : ''}" data-prefix="${prefix}" data-stock-water="${p.stockWaterMl || ''}">
           <span class="review-drag-handle" title="Drag to reorder" style="cursor:grab;color:var(--text3);font-size:16px;text-align:center;line-height:1;user-select:none;">⋮</span>
           <div class="review-ingredient-qty"><span class="mobile-field-label">Quantity</span><input type="number" class="r-qty" value="${amount.qty||1}" style="width:100%;min-width:0" step="0.1" min="0" oninput="recalcModal('${prefix}')"></div>
           <div class="review-ingredient-unit"><span class="mobile-field-label">Unit</span>${renderReviewUnitSelect(amount.unit || 'qty', prefix, p.name || '')}</div>
           <div class="review-ingredient-section"><span class="mobile-field-label">Section</span>${renderSectionInput('r-section', p.section || '', `${prefix}-section-options`, `refreshReviewSectionOptions('${prefix}'); recalcModal('${prefix}')`, '100%')}</div>
           <div class="review-ingredient-name" style="position:relative;min-width:0"><span class="mobile-field-label">Ingredient</span><input type="text" class="r-name" value="${ppEscapeAttr(displayName||'')}" style="width:100%;min-width:0" oninput="handleReviewIngredientNameInput(this, '${prefix}')" onfocus="renderReviewIngredientSearch(this, '${prefix}')" onblur="setTimeout(()=>closeReviewIngredientSearchDropdown(this.closest('.rev-ing-row')),160)"><div class="review-mapping-status${group || product ? '' : ' unmapped'}" onclick="openReviewMappingModalFromStatus(this)" style="cursor:pointer" title="Click to map or change product">${ppEscapeHtml(mappingText)}</div><div class="r-row-error" style="display:none;color:var(--red);font-size:10px;line-height:1.25;margin-top:3px;"></div></div>
           <label class="review-exclude-control" title="Keep this in the recipe and shopping list, but exclude it from nutrition totals."><input type="checkbox" class="r-exclude-nutrition" ${p.excludeNutrition?'checked':''} onchange="recalcModal('${prefix}')"><span class="review-exclude-label">Not eaten / exclude from nutrition</span></label>
           <div class="review-desktop-actions" style="display:flex;gap:4px;justify-content:flex-end;align-items:center;">
             <button type="button" class="btn sm ghost r-edit-ing" onclick="editModalRowIngredient(this)" style="padding:4px 6px;font-size:10px;display:${p.bankId?'inline-block':'none'}">Edit</button>
             <button type="button" class="btn sm ghost r-replace-ing" onclick="openModalIngredientReplace(this)" style="padding:4px 6px;font-size:10px">Replace</button>
             <button class="btn sm danger ghost" onclick="removeReviewIngredientRow(this, '${prefix}')">&times;</button>
           </div>
           <div class="review-mobile-actions"><button type="button" class="btn ghost r-replace-ing" onclick="openModalIngredientReplace(this)">Replace</button><button type="button" class="btn ghost" onclick="openReviewIngredientActions(this, '${prefix}')">More</button></div>
        </div>`;
    }).join('');
    list.innerHTML = header + rows + `<datalist id="${prefix}-section-options"></datalist>`;
    refreshReviewSectionOptions(prefix);
    updateModalIngredientContributionTitles(prefix);
}

function removeReviewIngredientRow(btn, prefix){
    const row = btn.closest('.rev-ing-row');
    if(!row) return;
    if(currentReviewInstanceId && row.dataset.originalKey) {
      row.dataset.tempRemoved = '1';
      row.style.display = 'none';
    } else {
      row.remove();
    }
    recalcModal(prefix);
}

function editModalRowIngredient(btn){
    const row = btn.closest('.rev-ing-row');
    let bankId = row ? row.dataset.bankid : '';
    if(!bankId && row?.dataset.groupid) bankId = resolveProductForIngredient({ groupId: row.dataset.groupid }).product?.id || '';
    hideReviewTooltip();
    if(bankId){
      productEditorReturnToReview=!!document.getElementById('modal-wrap')?.classList.contains('open');
      editIng(bankId);
    }else{
      openAppInfoModal('Product unavailable','The mapped Product Bank item could not be found. Refresh the recipe mapping and try again.');
    }
}

let mobileReviewIngredientRow = null;
function openReviewIngredientActions(btn, prefix){
    mobileReviewIngredientRow = btn.closest('.rev-ing-row');
    if(!mobileReviewIngredientRow) return;
    const canEdit = !!(mobileReviewIngredientRow.dataset.bankid || mobileReviewIngredientRow.dataset.groupid);
    const actions = [];
    if(canEdit) actions.push({ label:'Edit mapped product', onclick:`runReviewIngredientMobileAction('edit', '${prefix}')` });
    actions.push(
      { label:'Move up', onclick:`runReviewIngredientMobileAction('up', '${prefix}')` },
      { label:'Move down', onclick:`runReviewIngredientMobileAction('down', '${prefix}')` },
      { label:'Delete ingredient', danger:true, onclick:`runReviewIngredientMobileAction('delete', '${prefix}')` }
    );
    openMobileActionSheet('Ingredient actions', actions);
}

function runReviewIngredientMobileAction(action, prefix){
    const row = mobileReviewIngredientRow;
    mobileReviewIngredientRow = null;
    closeMobileActionSheet();
    if(!row) return;
    if(action === 'edit') return editModalRowIngredient(row.querySelector('.r-edit-ing') || row);
    if(action === 'delete') return removeReviewIngredientRow(row, prefix);
    if(action === 'up') {
      const previous = row.previousElementSibling;
      if(previous?.classList.contains('rev-ing-row')) row.parentNode.insertBefore(row, previous);
    }
    if(action === 'down') {
      const next = row.nextElementSibling;
      if(next?.classList.contains('rev-ing-row')) row.parentNode.insertBefore(next, row);
    }
    recalcModal(prefix);
}

let reviewReplaceTargetRow = null;

function ensureReviewReplaceModal(){
    let wrap = document.getElementById('review-replace-wrap');
    if(wrap) wrap.remove();

    wrap = document.createElement('div');
    wrap.id = 'review-replace-wrap';
    wrap.className = 'modal-wrap';
    wrap.style.zIndex = '380';
    wrap.innerHTML = `
      <div class="modal" style="max-width:540px">
        <div class="row-between" style="align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Replace recipe ingredient</h3>
          <button class="btn sm ghost" onclick="closeModalIngredientReplace()">Close</button>
        </div>
        <div class="field">
          <label>Search type</label>
          <input type="search" id="review-replace-search" placeholder="Search category, ingredient, type, alias or product" oninput="renderReviewReplaceOptions(this.value)">
        </div>
        <div id="review-replace-options" style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)"></div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
}

let activeUnifiedMappingContext = null;
window.activeUnifiedMappingContext = null;

function openUnifiedMappingModal(context){
  activeUnifiedMappingContext = context;
  window.activeUnifiedMappingContext = context;
  const wrap = document.getElementById('unified-mapping-modal-wrap');
  if(!wrap) return;
  const nameEl = document.getElementById('unified-map-ing-name');
  const rawEl = document.getElementById('unified-map-ing-raw');
  const qtyTagEl = document.getElementById('unified-map-ing-qty-tag');
  const searchInput = document.getElementById('unified-map-search');
  
  const ingName = context.ingredientName || 'Ingredient';
  if(nameEl) nameEl.textContent = ingName;
  if(rawEl) rawEl.textContent = context.rawText && context.rawText !== ingName ? `Original: "${context.rawText}"` : '';
  if(qtyTagEl) {
    const qtyStr = [context.qty, context.unit].filter(Boolean).join(' ');
    qtyTagEl.textContent = qtyStr || 'No quantity';
    qtyTagEl.style.display = qtyStr ? 'inline-block' : 'none';
  }
  
  wrap.classList.add('open');
  const query = context.initialQuery || ingName;
  if(searchInput) {
    searchInput.value = query;
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 50);
  }
  handleUnifiedMapSearch(query);
}

function closeUnifiedMappingModal(){
  const wrap = document.getElementById('unified-mapping-modal-wrap');
  if(wrap) wrap.classList.remove('open');
  activeUnifiedMappingContext = null;
  window.activeUnifiedMappingContext = null;
}

function switchUnifiedMapTab(tabName) {
  window.unifiedMapActiveTab = tabName;
  const searchInput = document.getElementById('unified-map-search');
  handleUnifiedMapSearch(searchInput ? searchInput.value : '');
}
window.switchUnifiedMapTab = switchUnifiedMapTab;

function handleUnifiedMapSearch(query){
  const resultsEl = document.getElementById('unified-map-results');
  if(!resultsEl) return;
  if(!window.unifiedMapActiveTab) window.unifiedMapActiveTab = 'product';
  const q = (query || '').trim();
  const variants = getSearchVariants(q);
  const strat = getAutoMappingStrategy();

  let products = (state.ingredients || []).filter(p => {
    if(!isUsableProduct(p)) return false;
    if(!q) return true;
    const hay = [p.name, p.brand, CAT[p.cat] || p.cat, p.notes].join(' ').toLowerCase();
    return variants.some(v => hay.includes(v));
  });

  products.sort((a, b) => {
    return scoreProductByPriority(b, strat) - scoreProductByPriority(a, strat) ||
           getProductProteinPer100Kcal(b) - getProductProteinPer100Kcal(a) ||
           (a.name || '').localeCompare(b.name || '');
  });
  const topProducts = products.slice(0, 20);

  ensureIngredientGroups();
  let groups = (state.ingredientGroups || []).filter(g => {
    if(!q) return true;
    const hay = getIngredientGroupSearchText(g);
    return variants.some(v => hay.includes(v));
  }).slice(0, 15);

  let html = `
    <div style="display:flex;gap:8px;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:8px">
      <button type="button" class="btn sm ${window.unifiedMapActiveTab !== 'subtype' ? 'primary' : 'ghost'}" onclick="switchUnifiedMapTab('product')">Tab 1: Change Product (Same Sub-type)</button>
      <button type="button" class="btn sm ${window.unifiedMapActiveTab === 'subtype' ? 'primary' : 'ghost'}" onclick="switchUnifiedMapTab('subtype')">Tab 2: Change Sub-type / Ingredient</button>
    </div>
  `;

  if(window.unifiedMapActiveTab !== 'subtype') {
    if(!topProducts.length) {
      html += `
        <div style="padding:20px;text-align:center;color:var(--text2)">
          <p style="margin:0 0 10px;font-size:13px">No matching products found for "<strong>${ppEscapeHtml(q)}</strong>".</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
            <button type="button" class="btn sm ghost" style="color:var(--purple);border-color:var(--purple)" onclick="triggerTescoImportFromUnifiedMap()">Search &amp; Import from Tesco</button>
            <button type="button" class="btn sm ghost" onclick="triggerNewProductFromUnifiedMap()">Create New Product</button>
          </div>
        </div>
      `;
    } else {
      html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);padding:6px 8px 4px;display:flex;justify-content:space-between">
        <span>Products (${products.length})</span>
        <span style="font-weight:500;text-transform:none">Strategy: ${ppEscapeHtml(strat.replace(/_/g, ' '))}</span>
      </div>`;

      html += topProducts.map(p => {
        const packGrams = productPackGrams(p);
        const price = +p.price || 0;
        const costPerG = (price > 0 && packGrams > 0) ? (price / packGrams) * 100 : null;
        const costPerUnit = getProductCostPerUnit(p);
        const protPer100Kcal = getProductProteinPer100Kcal(p);
        const group = p.groupId ? getIngredientGroup(p.groupId) : null;
        
        const badgeParts = [];
        if(round1(p.prot) > 0) badgeParts.push(`${round1(p.prot)}g P`);
        if(p.cal > 0) badgeParts.push(`${Math.round(p.cal)} kcal`);
        if(protPer100Kcal > 0) badgeParts.push(`${round1(protPer100Kcal)}g/100kcal`);
        if(p.packSize) badgeParts.push(`${p.packSize}${p.packUnit || 'g'}`);
        if(price > 0) badgeParts.push(`£${price.toFixed(2)}`);
        if(costPerG) badgeParts.push(`(£${(costPerG / 100).toFixed(2)}/100g)`);
        else if(costPerUnit && isFinite(costPerUnit)) badgeParts.push(`(£${costPerUnit.toFixed(2)}/portion)`);

        return `
          <div class="unified-map-item" onclick="selectUnifiedMapProduct('${ppEscapeAttr(p.id)}', '${ppEscapeAttr(p.groupId || '')}')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:6px;transition:background 0.15s">
            <div style="min-width:0;flex:1;padding-right:10px">
              <div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px">
                <span>${ppEscapeHtml(p.name)}</span>
                ${p.brand && p.brand !== 'Generic' ? `<span style="font-weight:500;font-size:11px;color:var(--text2)">(${ppEscapeHtml(p.brand)})</span>` : ''}
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">
                ${group ? `Sub-type: ${ppEscapeHtml(group.name)} · ` : ''}${ppEscapeHtml(CAT[p.cat] || p.cat || 'Other')}
              </div>
              <div style="font-size:11px;color:var(--text2);margin-top:3px;display:flex;flex-wrap:wrap;gap:4px">
                <span class="tag" style="font-size:10px;padding:1px 6px">${badgeParts.join(' · ')}</span>
              </div>
            </div>
            <button type="button" class="btn sm primary" style="flex-shrink:0;padding:4px 10px;font-size:11px">Select Product</button>
          </div>
        `;
      }).join('');
    }
  } else {
    if(!groups.length) {
      html += `
        <div style="padding:20px;text-align:center;color:var(--text2)">
          <p style="margin:0 0 10px;font-size:13px">No matching sub-types found for "<strong>${ppEscapeHtml(q)}</strong>".</p>
        </div>
      `;
    } else {
      html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3);padding:6px 8px 4px">Sub-types / Ingredient Groups (${groups.length})</div>`;
      html += groups.map(g => {
        const defProd = resolveProductForIngredient({ groupId: g.id }).product;
        return `
          <div class="unified-map-item" onclick="selectUnifiedMapGroup('${ppEscapeAttr(g.id)}')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:6px;transition:background 0.15s">
            <div style="min-width:0;flex:1;padding-right:10px">
              <div style="font-weight:700;font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:2px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
              <div style="font-size:11px;color:var(--text2);margin-top:2px">
                Default Product: ${ppEscapeHtml(defProd ? `${defProd.name}${defProd.brand && defProd.brand !== 'Generic' ? ` (${defProd.brand})` : ''}` : 'None assigned')}
              </div>
            </div>
            <button type="button" class="btn sm ghost" style="flex-shrink:0;padding:4px 10px;font-size:11px">Use Sub-type</button>
          </div>
        `;
      }).join('');
    }
  }

  resultsEl.innerHTML = html;
  resultsEl.querySelectorAll('.unified-map-item').forEach(item => {
    item.addEventListener('mouseenter', () => item.style.background = 'var(--surface2)');
    item.addEventListener('mouseleave', () => item.style.background = 'transparent');
  });
}

function selectUnifiedMapProduct(productId, groupId){
  const product = getProduct(productId);
  if(!product) return;
  const targetGroupId = groupId || product.groupId || '';
  if(activeUnifiedMappingContext){
    applyUnifiedMappingResult(activeUnifiedMappingContext, {
      productId: product.id,
      groupId: targetGroupId,
      productName: product.name,
      brand: product.brand
    });
  }
}

function selectUnifiedMapGroup(groupId){
  const group = getIngredientGroup(groupId);
  if(!group) return;
  const defProd = resolveProductForIngredient({ groupId: group.id }).product;
  if(activeUnifiedMappingContext){
    applyUnifiedMappingResult(activeUnifiedMappingContext, {
      productId: defProd?.id || '',
      groupId: group.id,
      productName: getGroupTypeName(group),
      brand: defProd?.brand || ''
    });
  }
}

function applyUnifiedMappingResult(context, result){
  if(!context) return;
  const householdId = window.activeHouseholdId || state?.meta?.householdId || window.PLATEPLAN_FIREBASE?.householdId || 'elliott-chloe';
  const targetIngId = context.ingredientId || (context.type === 'ingredient' ? (context.entityId || context.id) : null);

  if (targetIngId) {
    updateIngredientMappingGlobal(targetIngId, result).catch(err => console.error('[UPDATE INGREDIENT MAPPING GLOBAL ERROR]', err));
  }

  if(context.type === 'reviewRow' && context.rowEl){
    const row = context.rowEl;
    row.dataset.groupid = result.groupId || '';
    row.dataset.bankid = result.productId || '';
    row.dataset.ingredientid = '';
    row.dataset.mappedViaIngredient = '';
    
    const nameInput = row.querySelector('.r-name');
    if(nameInput && (!nameInput.value || nameInput.value === 'New item' || nameInput.value === 'Ingredient')){
      nameInput.value = result.productName || '';
    }

    const editBtn = row.querySelector('.r-edit-ing');
    if(editBtn) editBtn.style.display = result.productId ? 'inline-block' : 'none';

    const prefix = context.prefix || 'orig';
    closeUnifiedMappingModal();
    recalcModal(prefix);
  } else if(context.type === 'recipeIngredient' && context.recipeId){
    const recipe = getRecipe(context.recipeId);
    if(recipe){
      const variant = context.variantKey === 'enhanced' ? recipe.variants?.enhanced : (recipe.variants?.original || recipe);
      if(variant && Array.isArray(variant.ingredients) && variant.ingredients[context.ingredientIndex]){
        const target = variant.ingredients[context.ingredientIndex];
        const previousProductId = target.productId || target.bankId || '';

        // 1. Capture current ISO timestamp
        const nowIso = new Date().toISOString();

        // 2. Synchronously update specific ingredient's productId in window.state.recipes
        target.bankId = result.productId || '';
        target.groupId = result.groupId || '';
        if (result.productId) target.productId = result.productId;
        if (result.tescoProductId || result.tpnb) target.tescoProductId = result.tescoProductId || result.tpnb;
        if (result.packOptions) target.packOptions = result.packOptions;
        if (result.sourceUrl || result.url) target.sourceUrl = result.sourceUrl || result.url;

        // 3. Synchronously apply new timestamp to recipe's updatedAt field
        recipe.updatedAt = nowIso;

        if (Array.isArray(window.state?.recipes)) {
          const idx = window.state.recipes.findIndex(r => r && r.id === recipe.id);
          if (idx !== -1) window.state.recipes[idx] = recipe;
        }

        // 4. Trigger an immediate UI re-render
        rehydrateActiveRecipeAndStateCache({ changedProductIds: [result.productId], recipeId: recipe.id });
        renderAll();

        // 5. Execute Firestore write wrapped in a try/catch
        (async () => {
          try {
            const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
            if (db) {
              const cleanRecipe = sanitizePayloadForFirestore(unwrapAndCleanItem(recipe));
              await db.collection('households').doc(householdId).collection('recipes').doc(recipe.id).set(cleanRecipe, { merge: true });
            }
          } catch(err) {
            console.error('[INGREDIENT LINK REVERT - ROLLING BACK]', err);
            // 6. In catch block: revert local ingredient productId, re-render UI, show error toast
            target.productId = previousProductId;
            target.bankId = previousProductId;
            rehydrateActiveRecipeAndStateCache({ changedProductIds: [previousProductId], recipeId: recipe.id });
            renderAll();
            showPlatePlanToast('Failed to link ingredient in cloud. Reverted change.', 'error');
          }
        })();
      }
    }
    closeUnifiedMappingModal();
    if(context.issueKey){
      finishEditorReturn('data');
    }
  } else {
    closeUnifiedMappingModal();
  }
}

function openTescoModal(context = null){
  const ctx = context || window.pendingTescoMapping || activeUnifiedMappingContext || window.activeUnifiedMappingContext || null;
  if(typeof showTescoImport === 'function'){
    return showTescoImport(ctx);
  }
  const modal = document.getElementById('tesco-modal');
  if(modal) modal.style.display = 'flex';
}
window.openTescoModal = openTescoModal;

function showTescoSearchModal(ingredientId){
  try {
    let ingName = '';
    const activeCtx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || null;
    let cleanId = typeof ingredientId === 'string' ? ingredientId : (ingredientId?.id || '');
    if(!cleanId && activeCtx?.ingredientId){
      cleanId = activeCtx.ingredientId;
    }
    if(cleanId){
      if(Array.isArray(state?.ingredients)){
        const found = state.ingredients.find(i => i && i.id === cleanId);
        if(found) ingName = found.name || '';
      }
      if(!ingName && state?.ingredients && typeof state.ingredients === 'object'){
        const found = state.ingredients[cleanId];
        if(found) ingName = found.name || '';
      }
    }
    const searchVal = document.getElementById('unified-map-search')?.value?.trim();
    const query = ingName || searchVal || activeCtx?.ingredientName || '';
    const ctx = {
      type: 'unified',
      ingredientId: cleanId || activeCtx?.ingredientId || '',
      name: query
    };
    window.pendingTescoMapping = ctx;
    closeUnifiedMappingModal();
    openTescoModal(ctx);
    const inp = document.getElementById('tesco-url');
    if(inp){
      inp.value = query;
      if(typeof fetchTescoData === 'function') fetchTescoData(query);
    }
  } catch(err) {
    console.error('[TESCO SEARCH MODAL ERROR]', err);
  }
}
window.showTescoSearchModal = showTescoSearchModal;

function openAddProductModal(ingredientIdOrQuery = ''){
  try {
    let ingName = '';
    const activeCtx = activeUnifiedMappingContext || window.activeUnifiedMappingContext || null;
    let cleanId = typeof ingredientIdOrQuery === 'string' ? ingredientIdOrQuery : (ingredientIdOrQuery?.id || '');
    if(cleanId && cleanId.startsWith('ing')){
      if(Array.isArray(state?.ingredients)){
        const found = state.ingredients.find(i => i && i.id === cleanId);
        if(found) ingName = found.name || '';
      }
    } else if (cleanId) {
      ingName = cleanId;
    }
    if(!ingName && activeCtx?.ingredientName){
      ingName = activeCtx.ingredientName;
    }
    const searchVal = document.getElementById('unified-map-search')?.value?.trim();
    const query = ingName || searchVal || activeCtx?.ingredientName || '';
    if(activeCtx){
      window.pendingUnifiedAddContext = { ...activeCtx };
    }
    closeUnifiedMappingModal();
    if(typeof showTescoImport === 'function'){
      showTescoImport({
        type: 'manualAdd',
        name: query,
        ingredientId: cleanId || activeCtx?.ingredientId || ''
      });
    } else if(typeof openMiniIng === 'function'){
      openMiniIng(query);
    }
    const nameInp = document.getElementById('tp-name') || document.getElementById('mi-name');
    if(nameInp && query) {
      nameInp.value = query;
      nameInp.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch(err) {
    console.error('[OPEN ADD PRODUCT MODAL ERROR]', err);
  }
}
window.openAddProductModal = openAddProductModal;

function openProductPicker(ingredientId){
  return openAddProductModal(ingredientId);
}
window.openProductPicker = openProductPicker;

function triggerTescoImportFromUnifiedMap(){
  showTescoSearchModal(activeUnifiedMappingContext?.ingredientId || '');
}

function triggerNewProductFromUnifiedMap(){
  openProductPicker(activeUnifiedMappingContext?.ingredientId || '');
}

function openUnifiedMappingModalFromRow(row, prefix = 'orig'){
  if(!row) return;
  const currentName = row.querySelector('.r-name')?.value || '';
  const rawText = row.dataset.raw || currentName;
  const qty = row.querySelector('.r-qty')?.value || '';
  const unit = row.querySelector('.r-unit')?.value || '';
  openUnifiedMappingModal({
    type: 'reviewRow',
    rowEl: row,
    prefix,
    ingredientName: currentName,
    rawText,
    qty,
    unit,
    initialQuery: currentName
  });
}

function openReviewMappingModalFromStatus(el){
  const row = el?.closest('.rev-ing-row');
  if(!row) return;
  const prefix = row.dataset.prefix || row.closest('[id$="-ings-list"]')?.id?.replace('-ings-list','') || 'orig';
  openUnifiedMappingModalFromRow(row, prefix);
}

window.openUnifiedMappingModal = openUnifiedMappingModal;
window.closeUnifiedMappingModal = closeUnifiedMappingModal;
window.handleUnifiedMapSearch = handleUnifiedMapSearch;
window.selectUnifiedMapProduct = selectUnifiedMapProduct;
window.selectUnifiedMapGroup = selectUnifiedMapGroup;
window.triggerTescoImportFromUnifiedMap = triggerTescoImportFromUnifiedMap;
window.triggerNewProductFromUnifiedMap = triggerNewProductFromUnifiedMap;
window.openUnifiedMappingModalFromRow = openUnifiedMappingModalFromRow;
window.openReviewMappingModalFromStatus = openReviewMappingModalFromStatus;

function openModalIngredientReplace(btn){
    hideReviewTooltip();
    reviewReplaceTargetRow = btn.closest('.rev-ing-row');
    const prefix = reviewReplaceTargetRow?.dataset?.prefix || reviewReplaceTargetRow?.closest('[id$="-ings-list"]')?.id?.replace('-ings-list','') || 'orig';
    openUnifiedMappingModalFromRow(reviewReplaceTargetRow, prefix);
}

function closeModalIngredientReplace(){
    closeUnifiedMappingModal();
    const wrap = document.getElementById('review-replace-wrap');
    if(wrap) wrap.classList.remove('open');
    reviewReplaceTargetRow = null;
}

function renderReviewReplaceOptions(query){
    const listEl = document.getElementById('review-replace-options');
    if(!listEl) return;
    const q = (query || '').trim().toLowerCase();
    ensureIngredientGroups();
    let list = state.ingredientGroups || [];
    if(q){
      const variants = getSearchVariants(q);
      list = list.filter(g => variants.some(v => getIngredientGroupSearchText(g).includes(v)));
    }
    list = list.slice().sort((a,b) => {
      const pa = resolveProductForIngredient({ groupId: a.id }).product || {};
      const pb = resolveProductForIngredient({ groupId: b.id }).product || {};
      const effA = pa.cal > 0 ? (pa.prot || 0) / pa.cal : 0;
      const effB = pb.cal > 0 ? (pb.prot || 0) / pb.cal : 0;
      if(Math.abs(effA - effB) > 0.001) return effB - effA;
      return (a.name || '').localeCompare(b.name || '');
    }).slice(0, 40);

    if(!list.length){
      listEl.innerHTML = '<div style="padding:12px;color:var(--text2);font-size:12px">No matching types found.</div>';
      return;
    }

    listEl.innerHTML = list.map(g => {
      const p = resolveProductForIngredient({ groupId: g.id }).product || {};
      return `
      <button type="button" class="review-replace-option" data-id="${ppEscapeHtml(g.id)}" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--border);background:var(--surface);padding:10px 12px;cursor:pointer;color:var(--text)">
        <div style="font-weight:700;font-size:13px">${ppEscapeHtml(getGroupTypeName(g))}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${ppEscapeHtml(getGroupHierarchyText(g))}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:3px">Default: ${ppEscapeHtml(p.name || 'No product')} ${p.brand && p.brand !== 'Generic' ? `(${ppEscapeHtml(p.brand)})` : ''} | ${Math.round(p.cal || 0)} kcal | ${round1(p.prot || 0)}g protein</div>
      </button>
    `}).join('');

    listEl.querySelectorAll('.review-replace-option').forEach(btn => {
      btn.onclick = () => selectReviewReplacement(btn.dataset.id);
      btn.onmouseenter = () => btn.style.background = 'var(--surface2)';
      btn.onmouseleave = () => btn.style.background = 'var(--surface)';
    });
}

function selectReviewReplacement(groupId){
    if(!reviewReplaceTargetRow) return;
    const group = getIngredientGroup(groupId);
    if(!group) return;
    const product = resolveProductForIngredient({ groupId }).product;
    reviewReplaceTargetRow.dataset.groupid = group.id;
    reviewReplaceTargetRow.dataset.bankid = product?.id || '';
    reviewReplaceTargetRow.dataset.ingredientid = '';
    reviewReplaceTargetRow.dataset.mappedViaIngredient = '';
    const nameInput = reviewReplaceTargetRow.querySelector('.r-name');
    if(nameInput) nameInput.value = getGroupTypeName(group);
    const editBtn = reviewReplaceTargetRow.querySelector('.r-edit-ing');
    if(editBtn) editBtn.style.display = product ? 'inline-block' : 'none';
    const prefix = reviewReplaceTargetRow.dataset.prefix || reviewReplaceTargetRow.closest('[id$="-ings-list"]')?.id?.replace('-ings-list','') || 'orig';
    closeModalIngredientReplace();
    recalcModal(prefix);
}

function updateModalIngredientContributionTitles(prefix){
    const mealTypes = getReviewMealTypesFallback();
    const recipe = {
      serves: getReviewServesFallback(),
      who: document.getElementById('r-who')?.value || 'both',
      types: mealTypes,
      ingredients: extractModalList(prefix).ings,
      resolutionContext: getReviewResolutionContext(),
      instanceId: currentReviewInstanceId
    };
    Array.from(document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`)).filter(row => row.dataset.tempRemoved !== '1').forEach((row, idx) => {
      const ing = recipe.ingredients[idx];
      const html = ingredientContributionHtml(ing, recipe, recipe.serves);
      const editBtn = row.querySelector('.r-edit-ing');
      const input = row.querySelector('.r-name');
      const resolved = resolveProductForIngredient(ing || {}, recipe.resolutionContext || {});
      const resolvedProduct = resolved.product;
      const hasName = !!(input?.value || '').trim();
      const errorText = hasName ? getReviewIngredientDataError(ing, resolved) : '';
      const errorEl = row.querySelector('.r-row-error');
      const mappingEl = row.querySelector('.review-mapping-status');
      if(editBtn) editBtn.style.display = resolvedProduct ? 'inline-block' : 'none';
      if(mappingEl) {
        const group = ing?.groupId ? getIngredientGroup(ing.groupId) : null;
        mappingEl.textContent = group ? `${getGroupHierarchyText(group)}${resolvedProduct?.name ? ` · ${resolvedProduct.name}` : ''}` : (resolvedProduct?.name || 'Not mapped yet');
        mappingEl.classList.toggle('unmapped', !group && !resolvedProduct);
        if(html){
          const info=document.createElement('button');
          info.type='button';
          info.className='btn sm ghost nutrition-info-button';
          info.textContent='Nutrition details';
          mappingEl.append(' · ',info);
          bindReviewTooltip(info,html,`Open nutrition contribution for ${resolvedProduct?.name||ing?.name||'ingredient'}`);
        }
      }
      if(input) {
        if(errorText) {
          input.style.borderColor = 'var(--red)';
          input.style.boxShadow = '0 0 0 2px rgba(166,27,27,.10)';
          input.title = errorText;
        } else {
          input.style.borderColor = '';
          input.style.boxShadow = '';
          input.title = '';
        }
      }
      if(errorEl) {
        errorEl.textContent = errorText;
        errorEl.style.display = errorText ? 'block' : 'none';
      }
      row.style.cursor = '';
    });
}

function renderModalMethod(prefix, steps) {
    const list = document.getElementById(prefix + '-method-list');
    list.innerHTML = steps.map((s, i) => `
        <div class="rev-method-row" style="display:flex;gap:5px;margin-bottom:5px;align-items:flex-start;">
           <span class="step-num" style="font-size:12px;font-weight:600;margin-top:8px;width:20px;">${i+1}.</span>
           <textarea class="r-step" style="flex:1;min-height:40px;" oninput="updateSaveBothVisibility()">${s}</textarea>
           <button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexModalMethod('${prefix}'); updateSaveBothVisibility();">&times;</button>
        </div>
    `).join('');
}

function copyOriginalMethodToEnhanced(){
    const steps = Array.from(document.querySelectorAll('#orig-method-list .r-step'))
      .map(el => (el.value || '').trim())
      .filter(Boolean);
    renderModalMethod('enh', steps);
    reindexModalMethod('enh');
    updateSaveBothVisibility();
}

function addModalIng(prefix) {
    const container = document.getElementById(prefix + '-ings-list');
    const div = document.createElement('div');
    div.className = 'rev-ing-row review-ingredient-row mobile-editor-card';
    div.dataset.bankid = '';
    div.dataset.originalBankid = '';
    div.dataset.originalKey = '';
    div.dataset.groupid = '';
    div.dataset.ingredientid = '';
    div.dataset.mappedViaIngredient = '';
    div.dataset.prefix = prefix;
    div.draggable = true;
    div.setAttribute('ondragstart', 'startReviewIngredientDrag(event)');
    div.setAttribute('ondragover', 'overReviewIngredientDrag(event)');
    div.setAttribute('ondragend', `endReviewIngredientDrag(event, '${prefix}')`);
    div.innerHTML = `<span class="review-drag-handle" title="Drag to reorder" style="cursor:grab;color:var(--text3);font-size:16px;text-align:center;line-height:1;user-select:none;">⋮</span>
       <div class="review-ingredient-qty"><span class="mobile-field-label">Quantity</span><input type="number" class="r-qty" value="1" style="width:100%;min-width:0" step="0.1" min="0" oninput="recalcModal('${prefix}')"></div>
       <div class="review-ingredient-unit"><span class="mobile-field-label">Unit</span>${renderReviewUnitSelect('qty', prefix)}</div>
       <div class="review-ingredient-section"><span class="mobile-field-label">Section</span>${renderSectionInput('r-section', '', `${prefix}-section-options`, `refreshReviewSectionOptions('${prefix}'); recalcModal('${prefix}')`, '100%')}</div>
       <div class="review-ingredient-name" style="position:relative;min-width:0"><span class="mobile-field-label">Ingredient</span><input type="text" class="r-name" value="" style="width:100%;min-width:0" oninput="handleReviewIngredientNameInput(this, '${prefix}')" onfocus="renderReviewIngredientSearch(this, '${prefix}')" onblur="setTimeout(()=>closeReviewIngredientSearchDropdown(this.closest('.rev-ing-row')),160)"><div class="review-mapping-status unmapped" onclick="openReviewMappingModalFromStatus(this)" style="cursor:pointer" title="Click to map product">Not mapped yet</div><div class="r-row-error" style="display:none;color:var(--red);font-size:10px;line-height:1.25;margin-top:3px;"></div></div>
       <label class="review-exclude-control" title="Keep this in the recipe and shopping list, but exclude it from nutrition totals."><input type="checkbox" class="r-exclude-nutrition" onchange="recalcModal('${prefix}')"><span class="review-exclude-label">Not eaten / exclude from nutrition</span></label>
       <div class="review-desktop-actions" style="display:flex;gap:4px;justify-content:flex-end;align-items:center;">
         <button type="button" class="btn sm ghost r-edit-ing" onclick="editModalRowIngredient(this)" style="padding:4px 6px;font-size:10px;display:none">Edit</button>
         <button type="button" class="btn sm ghost r-replace-ing" onclick="openModalIngredientReplace(this)" style="padding:4px 6px;font-size:10px">Replace</button>
         <button class="btn sm danger ghost" onclick="removeReviewIngredientRow(this, '${prefix}')">&times;</button>
       </div>
       <div class="review-mobile-actions"><button type="button" class="btn ghost r-replace-ing" onclick="openModalIngredientReplace(this)">Replace</button><button type="button" class="btn ghost" onclick="openReviewIngredientActions(this, '${prefix}')">More</button></div>`;
    const sectionOptions = document.getElementById(prefix + '-section-options');
    if(sectionOptions) container.insertBefore(div, sectionOptions);
    else container.appendChild(div);
    refreshReviewSectionOptions(prefix);
}

function addModalMethod(prefix) {
    const container = document.getElementById(prefix + '-method-list');
    const div = document.createElement('div');
    div.className = 'rev-method-row';
    div.style = 'display:flex;gap:5px;margin-bottom:5px;align-items:flex-start;';
    div.innerHTML = `<span class="step-num" style="font-size:12px;font-weight:600;margin-top:8px;width:20px;"></span>
       <textarea class="r-step" style="flex:1;min-height:40px;" oninput="updateSaveBothVisibility()"></textarea>
       <button class="btn sm danger ghost" onclick="this.parentElement.remove(); reindexModalMethod('${prefix}'); updateSaveBothVisibility();">&times;</button>`;
    container.appendChild(div);
    reindexModalMethod(prefix);
    updateSaveBothVisibility();
}

function reindexModalMethod(prefix) {
    const rows = document.querySelectorAll(`#${prefix}-method-list .rev-method-row`);
    rows.forEach((r, i) => {
        const span = r.querySelector('.step-num');
        if(span) span.textContent = (i + 1) + '.';
    });
}

function renderReviewCostSummary(nutrition, portions){
    const totalCost = +nutrition?.totalNutrition?.cost || 0;
    const perServingCost = +nutrition?.perServing?.cost || 0;
    const eCost = perServingCost * (+portions?.eSingleServ || 0);
    const cCost = perServingCost * (+portions?.cSingleServ || 0);
    if(!totalCost && !perServingCost) return '';
    return `<div class="card-inner" style="margin:10px 0 12px;padding:10px;background:var(--surface2)">
      <div style="font-weight:700;font-size:12px;margin-bottom:6px">Estimated recipe cost</div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;font-size:12px">
        <div><span style="color:var(--text2)">Total</span><br><strong>£${totalCost.toFixed(2)}</strong></div>
        <div><span style="color:var(--text2)">Per serving</span><br><strong>£${perServingCost.toFixed(2)}</strong></div>
        <div><span style="color:var(--text2)">Elliott portion</span><br><strong>£${eCost ? eCost.toFixed(2) : '0.00'}</strong></div>
        <div><span style="color:var(--text2)">Chloe portion</span><br><strong>£${cCost ? cCost.toFixed(2) : '0.00'}</strong></div>
      </div>
    </div>`;
}

function renderProteinEfficiencyAnalysisSection(modalIngs, recipe, prefix = 'enh') {
  if(!modalIngs || !modalIngs.length) return '';
  const items = [];
  modalIngs.forEach((ing, idx) => {
    if(ing.excludeNutrition) return;
    const c = getIngredientContribution(ing, recipe, recipe.serves);
    if(!c) return;
    const cal = c.total?.cal || 0;
    const prot = c.total?.prot || 0;
    if(cal <= 0) return;
    const pPer100 = (prot / cal) * 100;
    items.push({
      ing,
      idx,
      name: c.bankIng?.name || ing.name || 'Ingredient',
      raw: ing.raw || ing.name || '',
      cal,
      prot,
      pPer100
    });
  });

  if(!items.length) return '';

  const sortedWorst = [...items].sort((a, b) => a.pPer100 - b.pPer100);
  const sortedBest = [...items].sort((a, b) => b.pPer100 - a.pPer100);

  const topBest = sortedBest.slice(0, 5);
  const topWorst = sortedWorst.slice(0, 5);

  const renderItemRow = (item, rank, isBest) => {
    const tagClass = isBest 
      ? (item.pPer100 >= 10 ? 'badge-purple' : (item.pPer100 >= 5 ? 'good' : 'warn'))
      : (item.pPer100 < 2 ? 'badge-coral' : (item.pPer100 < 5 ? 'warn' : 'good'));
    const displayPPer100 = Math.round(item.pPer100 * 10) / 10;
    
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            <span style="color:var(--text2);margin-right:4px">#${rank+1}</span> ${ppEscapeHtml(item.name)}
          </div>
          <div style="font-size:11px;color:var(--text2)">${Math.round(item.cal)} kcal · ${round1(item.prot)}g protein</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="badge ${tagClass}" style="font-size:11px">${displayPPer100}g P / 100 kcal</span>
          ${!isBest ? `<button type="button" class="btn sm ghost" onclick="searchSubstituteForIngredient('${ppEscapeAttr(prefix)}', '${ppEscapeAttr(item.name)}')">Replace</button>` : ''}
          <button type="button" class="btn sm ghost" onclick="highlightReviewIngredientRow('${ppEscapeAttr(prefix)}', ${item.idx})">Locate</button>
        </div>
      </div>
    `;
  };

  const bestRows = topBest.map((item, idx) => renderItemRow(item, idx, true)).join('');
  const worstRows = topWorst.map((item, idx) => renderItemRow(item, idx, false)).join('');

  return `
    <details class="review-secondary-section protein-efficiency-tool" open style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface2)">
      <summary style="font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between">
        <span>Protein per kcal Efficiency Analysis</span>
        <span class="tag purple" style="font-size:10px">Best &amp; Worst Ingredients</span>
      </summary>
      <div style="font-size:12px;color:var(--text2);margin:6px 0 10px;line-height:1.4">
        Identifies ingredients driving protein density versus those adding calories with low protein yield. Use this breakdown to optimize recipe macros.
      </div>
      
      <div class="grid2" style="gap:12px;align-items:start">
        <div style="background:var(--surface);padding:10px;border-radius:6px;border:1px solid var(--border)">
          <div style="font-size:12px;font-weight:700;color:var(--green);margin-bottom:6px;display:flex;align-items:center;gap:4px">
            <span>★ Most Protein-Efficient (Best)</span>
          </div>
          <div class="best-protein-rows">
            ${bestRows}
          </div>
        </div>

        <div style="background:var(--surface);padding:10px;border-radius:6px;border:1px solid var(--border)">
          <div style="font-size:12px;font-weight:700;color:var(--coral, #e11d48);margin-bottom:6px;display:flex;align-items:center;gap:4px">
            <span>⚠️ Least Protein-Efficient (Worst)</span>
          </div>
          <div class="worst-protein-rows">
            ${worstRows}
          </div>
        </div>
      </div>
    </details>
  `;
}

const renderLeastProteinEfficientSection = renderProteinEfficiencyAnalysisSection;

function searchSubstituteForIngredient(prefix, name) {
  const searchInput = document.getElementById(`enhance-search-${prefix}`);
  const sortSelect = document.getElementById(`enhance-sort-${prefix}`);
  if(sortSelect) sortSelect.value = 'protein_per_kcal';
  if(searchInput) {
    searchInput.value = name;
    renderEnhancementFinder(prefix);
    const toolDetails = searchInput.closest('details');
    if(toolDetails) toolDetails.open = true;
    searchInput.focus();
    searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function highlightReviewIngredientRow(prefix, idx) {
  const rows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
  const targetRow = rows[idx];
  if(targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRow.style.transition = 'background-color 0.3s ease, outline 0.3s ease';
    targetRow.style.outline = '2px solid var(--purple, #8b5cf6)';
    targetRow.style.backgroundColor = 'var(--purple-bg, rgba(139, 92, 246, 0.15))';
    setTimeout(() => {
      targetRow.style.outline = '';
      targetRow.style.backgroundColor = '';
    }, 2500);
  }
}

function recalcModal(prefix) {
    const rows = document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`);
    const serves = getReviewServesFallback();
    let unmappedWarning = false;
    let validIngs = [];
    let modalIngs = [];
    
    rows.forEach(r => {
        if(r.dataset.tempRemoved === '1') return;
        const qty = parseFloat(r.querySelector('.r-qty').value) || 0;
        const unit = r.querySelector('.r-unit').value;
        const section = r.querySelector('.r-section')?.value.trim() || '';
        const name = r.querySelector('.r-name').value.trim();
        const excludeNutrition = !!r.querySelector('.r-exclude-nutrition')?.checked;
        let bankId = r.dataset.bankid;
        let groupId = r.dataset.groupid;
        let ingredientId = r.dataset.ingredientid || '';
        const mappedViaIngredient = r.dataset.mappedViaIngredient === '1';
        
        if(!groupId && name) {
            const groupMatch = fuzzyMatchIngredientGroup(name);
            if(groupMatch) {
                groupId = groupMatch.id;
                r.dataset.groupid = groupId;
                const product = resolveProductForIngredient({ groupId }).product;
                bankId = product?.id || bankId || "";
                r.dataset.bankid = bankId;
            } else {
                const match = fuzzyMatchBank(name);
                if(match) {
                    bankId = match.id;
                    groupId = match.groupId || "";
                    r.dataset.bankid = bankId;
                    r.dataset.groupid = groupId;
                }
            }
        }
        if(groupId && !bankId) {
            const product = resolveProductForIngredient({ groupId }).product;
            bankId = product?.id || "";
            r.dataset.bankid = bankId;
        }
        const editBtn = r.querySelector('.r-edit-ing');
        if(editBtn) editBtn.style.display = bankId ? 'inline-block' : 'none';
        
        if(name) {
            const modalIng = {
                raw: `${qty} ${unit !== 'qty' ? unit : ''} ${name}`.trim(),
                qty,
                unit,
                name,
                ...(section ? { section } : {}),
                groupId,
                bankId,
                ...(ingredientId ? { ingredientId, mappedViaIngredient } : {}),
                excludeNutrition,
                ...(r.dataset.stockWater ? { isStock: true, stockWaterMl: +r.dataset.stockWater || null } : {})
            };
            modalIngs.push(modalIng);

            if(groupId || bankId) {
                validIngs.push({ groupId, bankId });
            } else {
                unmappedWarning = true;
            }
        }
    });

    const who = getReviewWhoFallback();
    const mealTypes = getReviewMealTypesFallback();
    const mealType = getContextMealType('review', currentReviewInstanceId, mealTypes[0] || 'dinner');
    const bundle = calculateRecipeDisplayNutrition({ recipe:null, ingredients:modalIngs, serves, who, mealType, instanceId:currentReviewInstanceId });
    const nutrition = bundle.nutrition;
    const total = bundle.totalNutrition;
    const ps = bundle.perServing;
    const portions = bundle.portions;
    
    document.getElementById(prefix + '-cal').value   = ps.cal;
    document.getElementById(prefix + '-prot').value  = ps.prot;
    document.getElementById(prefix + '-carb').value  = ps.carb;
    document.getElementById(prefix + '-fat').value   = ps.fat;
    document.getElementById(prefix + '-fibre').value = ps.fibre;

    document.getElementById(prefix + '-pe').value = portions.e;
    document.getElementById(prefix + '-pc').value = portions.c;

    let warns = [];
    if(unmappedWarning) warns.push(`<strong>Note:</strong> Some ingredients added manually are unmapped. They will count as 0 calories.`);
    
    const warnEl = document.getElementById(prefix + '-warn');
    if(warns.length) {
        warnEl.innerHTML = warns.join('<br>');
        warnEl.style.display = 'block';
    } else {
        warnEl.style.display = 'none';
    }

    const portionSummary = document.getElementById(prefix + '-portion-summary');
    if(portionSummary) {
      portionSummary.innerHTML = `
        <div style="margin-bottom:14px;background:var(--surface2);padding:10px;border-radius:8px">
            <div style="font-weight:600;font-size:12px;margin-bottom:6px">Portion Allocation (${mealType})</div>
            <div style="font-size:12px;display:flex;gap:15px;flex-wrap:wrap">
                ${portions.ePct > 0 ? `<div><strong>Elliott:</strong> ${portions.e}</div>` : ''}
                ${portions.cPct > 0 ? `<div><strong>Chloe:</strong> ${portions.c}</div>` : ''}
            </div>
        </div>
        <div class="grid2" style="margin-bottom:14px;">
          ${renderPortionTargetBox('Elliott', portions, 'e')}
          ${renderPortionTargetBox('Chloe', portions, 'c')}
        </div>
      `;
    }

    const tooltipRecipe = { ingredients: modalIngs, serves, who, types: mealTypes, resolutionContext: getReviewResolutionContext(), instanceId: currentReviewInstanceId };
    const nutritionSummary = document.getElementById(prefix + '-nutrition-summary');
    if(nutritionSummary) {
      nutritionSummary.innerHTML = renderReviewCostSummary(nutrition, portions) + renderLeastProteinEfficientSection(modalIngs, tooltipRecipe, prefix);
      if(prefix === 'enh') nutritionSummary.innerHTML += getImprovementSuggestions(validIngs, 'enh');
    }

    if(prefix === 'orig') {
        document.getElementById('orig-improvements').innerHTML = getImprovementSuggestions(validIngs, 'orig');
        setTimeout(() => renderEnhancementFinder('orig'), 0);
    }
    if(prefix === 'enh') setTimeout(() => renderEnhancementFinder('enh'), 0);
    bindPortionNutritionTooltips(portionSummary, tooltipRecipe, serves);
    updateModalIngredientContributionTitles(prefix);
    updateModalNutritionBreakdownTooltips(prefix, tooltipRecipe);
    if(prefix === 'enh') updateSaveBothVisibility();
}

function openModal(name,result,isFallback, options = {}){
  currentReviewInstanceId = options.instanceId || null;
  currentReviewVariant = options.tab || 'original';
  const isTemporaryReview = !!currentReviewInstanceId;
  const existing = editId ? (state?.recipes || []).find(x => x.id === editId) : null;
  const o = (result && result.original) ? result.original : (result && (result.ingredients || result.method || result.steps || result.name) ? result : {});
  const e = (result && result.enhanced) ? result.enhanced : (existing?.enhanced ? JSON.parse(JSON.stringify(existing.enhanced)) : (o.enhanced ? o.enhanced : { ...o, name: (name || 'Recipe') + ' (enhanced)', changes: '', bankIngredients: [] }));
  const hasCreatedEnhanced = !!(e && ((e.ingredients || []).length || (e.method || e.steps || []).length || String(e.changes || '').trim()));
  currentReviewMealTypes = (o.types && o.types.length) ? o.types.slice() : (result.types && result.types.length ? result.types.slice() : getMealTypes());
  if(!currentReviewMealTypes.length) currentReviewMealTypes = ['dinner'];
  currentReviewWho = o.who || result.who || (document.getElementById('r-who') ? document.getElementById('r-who').value : 'both');
  currentReviewServes = +o.serves || +result.serves || parseFloat(document.getElementById('r-serves')?.value) || 2;
  const infoEl=document.getElementById('review-info');
  if(infoEl){
    infoEl.innerHTML = isTemporaryReview
      ? '<span class="tag" style="background:var(--purple-bg);color:var(--purple);margin-right:6px">Temporary meal-plan version</span>Shopping-list changes are shown for this planned meal only. The Recipe Vault recipe will not be overwritten.'
      : 'Nutrition calculated from mapped ingredient bank items. Edit mapped ingredients if anything looks wrong.';
  }
  
  const origNote = document.getElementById('orig-note');
  if(origNote){
    origNote.textContent='Nutrition calculated from verified bank data';
    origNote.style.background='var(--green-bg)';
    origNote.style.color='var(--green)';
  }
  const enhNote = document.getElementById('enh-note');
  if(enhNote){
    enhNote.textContent='Manual editing mode -- edit to create your enhanced version. Nutrition will recalculate from the ingredient bank.';
    enhNote.style.background='var(--amber-bg)';
    enhNote.style.color='var(--amber)';
  }
  
  const origNameEl = document.getElementById('orig-name');
  if(origNameEl) origNameEl.value = name || o.name || 'Untitled recipe';
  renderModalIngs('orig', o.ingredients || []);
  renderModalMethod('orig', o.steps || o.method || []);
  recalcModal('orig');
  
  const enhNameEl = document.getElementById('enh-name');
  if(enhNameEl) enhNameEl.value = e.name || (name ? name + ' (enhanced)' : 'Enhanced recipe');
  const enhChangesEl = document.getElementById('enh-changes');
  if(enhChangesEl) enhChangesEl.value = e.changes || '';
  renderModalIngs('enh', e.ingredients || o.ingredients || []);
  renderModalMethod('enh', e.method || e.steps || o.steps || o.method || []);
  recalcModal('enh');
  
  const bank=e.bankIngredients||[];
  const bankFlagsEl = document.getElementById('bank-flags');
  if(bankFlagsEl) bankFlagsEl.innerHTML=bank.length?'<div class="bank-flag">Uses ingredients from your bank: <strong>'+bank.join(', ')+'</strong></div>':'';
  const pDiff=Math.round((e.prot||0)-(o.prot||0));
  
  const cmpOrig = document.getElementById('cmp-orig');
  if(cmpOrig) cmpOrig.innerHTML='<div class="macro-bar" style="flex-direction:column;gap:5px"><span class="mpill"><span>'+(o.cal||0)+'</span> kcal</span><span class="mpill p">Protein <span>'+(o.prot||0)+'g</span></span><span class="mpill">Carbs <span>'+(o.carb||0)+'g</span></span><span class="mpill">Fat <span>'+(o.fat||0)+'g</span></span></div><div style="font-size:12px;color:var(--text2);margin-top:8px"><div>Elliott: '+(o.portionE||'')+'</div><div>Chloe: '+(o.portionC||'')+'</div></div>';
  const cmpEnh = document.getElementById('cmp-enh');
  if(cmpEnh) cmpEnh.innerHTML='<div class="macro-bar" style="flex-direction:column;gap:5px"><span class="mpill" style="background:var(--green-bg)"><span style="color:var(--green)">'+(e.cal||0)+' kcal</span></span><span class="mpill p">Protein <span>'+(e.prot||0)+'g'+(pDiff>0?' (+'+pDiff+'g)':'')+'</span></span><span class="mpill">Carbs <span>'+(e.carb||0)+'g</span></span><span class="mpill">Fat <span>'+(e.fat||0)+'g</span></span></div><div style="font-size:12px;color:var(--text2);margin-top:8px">'+(e.changes||'')+'</div>';
  
  const tabBtnEnh = document.getElementById('tab-btn-enhanced');
  if(tabBtnEnh) tabBtnEnh.style.display = 'block';
  const tabBtnCmp = document.getElementById('tab-btn-compare');
  if(tabBtnCmp) tabBtnCmp.style.display = 'block';
  const saveBothBtn = document.getElementById('save-both-btn');
  if(saveBothBtn) saveBothBtn.style.display = isTemporaryReview ? 'none' : (hasCreatedEnhanced ? '' : 'none');
  const saveTempBtn = document.getElementById('save-temp-plan-btn');
  const saveOrigOnlyBtn = document.getElementById('save-orig-only-btn');
  if(saveTempBtn) saveTempBtn.style.display = isTemporaryReview ? '' : 'none';
  if(saveOrigOnlyBtn) saveOrigOnlyBtn.style.display = isTemporaryReview ? 'none' : '';
  updateSaveBothVisibility();
  const modalWrap = document.getElementById('modal-wrap');
  if (modalWrap) {
    modalWrap.classList.add('open', 'active');
    modalWrap.style.setProperty('display', 'flex', 'important');
    modalWrap.style.setProperty('visibility', 'visible', 'important');
    modalWrap.style.setProperty('opacity', '1', 'important');
    modalWrap.style.setProperty('z-index', '99999', 'important');
  }
  document.body.classList.add('modal-open');
  updateBatchUiBanners();
  switchModalTab(currentReviewVariant === 'enhanced' && (result.enhanced || existing?.enhanced) ? 'enhanced' : 'original');
}

function switchModalTab(tab){
  document.querySelectorAll('.mt2').forEach((t,i)=>t.classList.toggle('active',['original','enhanced','compare'][i]===tab));
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  document.getElementById('mtab-'+tab)?.classList.add('active');
}
function closeModal(preserveEditorReturn=false){
  const modalWrap = document.getElementById('modal-wrap');
  if (modalWrap) {
    modalWrap.classList.remove('open', 'active');
    modalWrap.style.removeProperty('display');
    modalWrap.style.removeProperty('visibility');
    modalWrap.style.removeProperty('opacity');
    modalWrap.style.removeProperty('z-index');
    modalWrap.style.display = 'none';
    modalWrap.style.visibility = 'hidden';
  }
  document.body.classList.remove('modal-open');
  currentReviewMealTypes=null;
  currentReviewWho=null;
  currentReviewServes=null;
  currentReviewInstanceId=null;
  currentReviewVariant='original';
  hideReviewTooltip();
  closeModalIngredientReplace();
  if(!preserveEditorReturn) abandonEditorReturn();
}

function normaliseReviewCompareText(value){
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function comparableReviewIngredients(prefix){
    return extractModalList(prefix).ings.map(ing => ({
        qty: Math.round((+ing.qty || 0) * 1000) / 1000,
        unit: ing.unit || '',
        name: normaliseReviewCompareText(ing.name),
        section: normaliseReviewCompareText(ing.section),
        groupId: ing.groupId || '',
        bankId: ing.bankId || '',
        ingredientId: ing.ingredientId || '',
        mappedViaIngredient: !!ing.mappedViaIngredient,
        excludeNutrition: !!ing.excludeNutrition,
        stockWaterMl: +ing.stockWaterMl || 0
    }));
}

function comparableReviewSteps(prefix){
    return Array.from(document.querySelectorAll(`#${prefix}-method-list .r-step`))
      .map(el => normaliseReviewCompareText(el.value))
      .filter(Boolean);
}

function hasMeaningfulEnhancedModalChanges(){
    const origName = document.getElementById('orig-name')?.value || '';
    const enhName = document.getElementById('enh-name')?.value || '';
    const defaultEnhName = origName ? `${origName} (enhanced)` : '';
    const cleanOrigName = normaliseReviewCompareText(origName);
    const cleanEnhName = normaliseReviewCompareText(enhName);
    const cleanDefaultEnhName = normaliseReviewCompareText(defaultEnhName);
    const nameChanged = !!cleanEnhName && cleanEnhName !== cleanOrigName && cleanEnhName !== cleanDefaultEnhName;
    const changesText = normaliseReviewCompareText(document.getElementById('enh-changes')?.value || '');
    const ingredientsChanged = JSON.stringify(comparableReviewIngredients('orig')) !== JSON.stringify(comparableReviewIngredients('enh'));
    const methodChanged = JSON.stringify(comparableReviewSteps('orig')) !== JSON.stringify(comparableReviewSteps('enh'));
    return nameChanged || !!changesText || ingredientsChanged || methodChanged;
}

function updateSaveBothVisibility(){
    const btn = document.getElementById('save-both-btn');
    if(!btn) return;
    if(currentReviewInstanceId) { btn.style.display = 'none'; return; }
    btn.style.display = hasMeaningfulEnhancedModalChanges() ? '' : 'none';
}

function extractModalList(prefix) {
    const ings = [];
    document.querySelectorAll(`#${prefix}-ings-list .rev-ing-row`).forEach(r => {
        if(r.dataset.tempRemoved === '1') return;
        const qty = parseFloat(r.querySelector('.r-qty')?.value) || 1;
        const unit = r.querySelector('.r-unit')?.value || 'qty';
        const section = r.querySelector('.r-section')?.value?.trim() || '';
        const name = r.querySelector('.r-name')?.value?.trim() || '';
        const excludeNutrition = !!r.querySelector('.r-exclude-nutrition')?.checked;
        const bankId = r.dataset.bankid || '';
        const groupId = r.dataset.groupid || '';
        const ingredientId = r.dataset.ingredientid || '';
        const mappedViaIngredient = r.dataset.mappedViaIngredient === '1';
        const stockWaterMl = +r.dataset.stockWater || null;
        if(name) {
            ings.push({
                raw: `${qty} ${unit !== 'qty' ? unit : ''} ${name}`.trim(),
                qty, unit, name, groupId, bankId,
                ...(section ? { section } : {}),
                ...(ingredientId ? { ingredientId, mappedViaIngredient } : {}),
                ...(stockWaterMl ? { isStock: true, stockWaterMl } : {}),
                ...(excludeNutrition ? { excludeNutrition: true } : {})
            });
        }
    });
    
    const steps = [];
    document.querySelectorAll(`#${prefix}-method-list .rev-method-row`).forEach(r => {
        const text = r.querySelector('.r-step')?.value?.trim() || '';
        if(text) steps.push(text);
    });
    return { ings:orderRecipeIngredientsBySection(ings), steps };
}

function buildRecipeFromModal(useEnh){
  const types=getReviewMealTypesFallback();
  const serves=getReviewServesFallback();
  const existing = editId ? state.recipes.find(x => x.id === editId) : null;
  const eData = extractModalList('enh');
  const oData = extractModalList('orig');
  const originalSteps = oData.steps.length ? oData.steps : ((existing?.steps || existing?.method || []).filter(Boolean));
  const existingEnhSteps = (existing?.enhanced?.method || existing?.enhanced?.steps || []).filter(Boolean);
  const enhancedSteps = eData.steps.length ? eData.steps : existingEnhSteps;

  // Per-serving values from the modal fields
  const origPS = {
    cal:   +document.getElementById('orig-cal')?.value   || 0,
    prot:  +document.getElementById('orig-prot')?.value  || 0,
    carb:  +document.getElementById('orig-carb')?.value  || 0,
    fat:   +document.getElementById('orig-fat')?.value   || 0,
    fibre: +document.getElementById('orig-fibre')?.value || 0
  };
  // Derive totals by multiplying back up
  const origTotal = {
    cal:   Math.round(origPS.cal   * serves),
    prot:  Math.round(origPS.prot  * serves * 10) / 10,
    carb:  Math.round(origPS.carb  * serves * 10) / 10,
    fat:   Math.round(origPS.fat   * serves * 10) / 10,
    fibre: Math.round(origPS.fibre * serves * 10) / 10
  };

  const enh = (useEnh && eData.ings.length > 0) ? (() => {
    const enhPS = {
      cal:   +document.getElementById('enh-cal')?.value   || 0,
      prot:  +document.getElementById('enh-prot')?.value  || 0,
      carb:  +document.getElementById('enh-carb')?.value  || 0,
      fat:   +document.getElementById('enh-fat')?.value   || 0,
      fibre: +document.getElementById('enh-fibre')?.value || 0
    };
    const enhTotal = {
      cal:   Math.round(enhPS.cal   * serves),
      prot:  Math.round(enhPS.prot  * serves * 10) / 10,
      carb:  Math.round(enhPS.carb  * serves * 10) / 10,
      fat:   Math.round(enhPS.fat   * serves * 10) / 10,
      fibre: Math.round(enhPS.fibre * serves * 10) / 10
    };
    const enhName = document.getElementById('enh-name')?.value?.trim() || (document.getElementById('orig-name')?.value ? `${document.getElementById('orig-name').value} (enhanced)` : (existing?.enhanced?.name || 'Enhanced Recipe'));
    return {
      name:    enhName,
      ...enhPS,                                   // flat per-serving fields for backwards compat
      nutrition: { total: enhTotal, perServing: enhPS },
      portionE: document.getElementById('enh-pe')?.value || existing?.enhanced?.portionE || '',
      portionC: document.getElementById('enh-pc')?.value || existing?.enhanced?.portionC || '',
      changes:  document.getElementById('enh-changes')?.value || existing?.enhanced?.changes || '',
      ingredients: eData.ings,
      method:   enhancedSteps,
      updatedAt: new Date().toISOString()
    };
  })() : null;
  
  const origName = document.getElementById('orig-name')?.value?.trim() || existing?.name || 'Untitled Recipe';
  return {
    id:    editId || ('r' + Date.now()),
    name:  origName,
    types, serves,
    who:   getReviewWhoFallback(),
    time:  +document.getElementById('r-time')?.value || existing?.time || null,
    source: getSource(),
    ...origPS,                                     // flat per-serving fields for backwards compat
    nutrition: { total: origTotal, perServing: origPS },
    portions: { e: document.getElementById('orig-pe')?.value || existing?.portions?.e || '', c: document.getElementById('orig-pc')?.value || existing?.portions?.c || '' },
    ingredients: oData.ings,
    steps:  originalSteps,
    estimated: false,
    enhanced: enh,
    updatedAt: new Date().toISOString()
  };
}

function saveBoth(){
  if(currentReviewInstanceId) return saveTemporaryPlanReview();
  saveToVault(buildRecipeFromModal(true));
}
function saveOrigOnly(){
  if(currentReviewInstanceId) return saveTemporaryPlanReview();
  const r = buildRecipeFromModal(false);
  r.enhancedOptOut = true;
  saveToVault(r);
}
function saveTemporaryPlanReview(){
  if(!currentReviewInstanceId) return;
  const activePrefix = document.getElementById('mtab-enhanced')?.classList.contains('active') ? 'enh' : 'orig';
  applyTemporaryReviewOverrides(activePrefix);
  closeModal();
  showMsg('form-msg','Temporary meal-plan recipe updated. The Recipe Vault version was not changed.','success');
}

// Legacy alias — defaults to Save Both behaviour.
function confirmSave(){ saveBoth(); }
function deleteEnhancedVersion() {
    if(!editId) return;
    openAppConfirmModal('Remove enhanced version?','The original recipe will remain unchanged.','Remove enhanced version',()=>{
      const r = state.recipes.find(x=>x.id === editId);
      if(r) {
          delete r.enhanced;
          saveState();
          closeModal();
          renderVault();
          showPlatePlanToast('Enhanced version removed.');
      }
    });
}
function saveToVault(r){
  if(!r || typeof r !== 'object') return;
  runWithRecoveryPoint('Before saving recipe ' + (r.name || 'recipe'), () => {
    ensureIngredientGroups();
    const attachGroups = list => (list || []).forEach(ing => {
      if(!ing || typeof ing !== 'object') return;
      if(!ing.groupId && ing.bankId) {
        const product = getProduct(ing.bankId);
        if(product?.groupId) ing.groupId = product.groupId;
      }
      if(ing.groupId && !ing.bankId) ing.bankId = resolveProductForIngredient(ing).product?.id || "";
    });
    attachGroups(r.ingredients);
    if(r.enhanced?.ingredients) attachGroups(r.enhanced.ingredients);
    recalcRecipeObject(r);
    const nowIso = new Date().toISOString();
    r.updatedAt = nowIso;
    if(r.enhanced && typeof r.enhanced === 'object') {
      r.enhanced.updatedAt = nowIso;
    }
    if(!r.id) r.id = 'r' + Date.now();
    if(editId){
      const i=state.recipes.findIndex(x=>x.id===editId);
      if(i>-1) state.recipes[i]=r;
      else state.recipes.push(r);
    } else {
      const existingIndex = state.recipes.findIndex(x=>x.id===r.id);
      if(existingIndex>-1) state.recipes[existingIndex]=r;
      else state.recipes.push(r);
    }
    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    rebuildPlatePlanIndexes();
    saveState(true);

    try {
      if(typeof saveRecipe === 'function'){
        saveRecipe(r).catch(err => console.warn('saveRecipe error in saveToVault:', err));
      }
    } catch(err) {
      console.warn('saveRecipe error in saveToVault:', err);
    }

    closeModal(true);
    clearForm();

    const isBatch = Boolean(state && Array.isArray(state.importQueue) && state.importQueue.length > 0 && typeof state.importQueueIndex === 'number' && state.importQueueIndex < state.importQueue.length);
    if(isBatch){
      const completedIdx = state.importQueueIndex;
      const totalCount = state.importQueue.length;
      if(completedIdx + 1 < totalCount){
        state.importQueueIndex = completedIdx + 1;
        showPlatePlanToast(`Saved "${r.name}" (${completedIdx + 1} of ${totalCount})`);
        loadBatchRecipeIntoStepA(state.importQueue[state.importQueueIndex]);
      } else {
        state.importQueue = [];
        state.importQueueIndex = 0;
        updateBatchUiBanners();
        finishEditorReturn('vault');
        renderVault();
        showPlatePlanToast(`All ${totalCount} recipes imported successfully!`);
      }
    } else {
      finishEditorReturn('vault');
      showPlatePlanToast(`Saved "${r.name}" to Recipe Vault`);
    }
  });
}


function safeFileName(name){
  return String(name || 'recipe').replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,' ').trim() || 'recipe';
}

function normaliseRecipeIngredientSection(section){
  return normaliseAliasText(section || '');
}

function orderRecipeIngredientsBySection(ingredients){
  const rows=Array.isArray(ingredients)?ingredients.slice():[];
  const named=new Map();
  const blank=[];
  rows.forEach(item=>{
    const section=normaliseRecipeIngredientSection(item?.section);
    if(!section){blank.push(item);return;}
    if(!named.has(section))named.set(section,[]);
    named.get(section).push(item);
  });
  return [...named.values()].flat().concat(blank);
}

function renderGroupedIngredientItems(ingredients, renderItem, options = {}){
  const rows = orderRecipeIngredientsBySection(ingredients);
  const hasSections = rows.some(item => normaliseRecipeIngredientSection(item?.section));
  if(!hasSections) return rows.map(renderItem).join('');
  let current = null;
  const headingStyle = options.headingStyle || 'list-style:none;margin:10px 0 5px -18px;font-weight:700;color:var(--text);';
  return rows.map((item, idx) => {
    const section = normaliseRecipeIngredientSection(item?.section);
    const heading = section && section !== current
      ? (() => { current = section; return `<li class="ingredient-section-heading" style="${headingStyle}">${ppEscapeHtml(section)}</li>`; })()
      : '';
    return heading + renderItem(item, idx);
  }).join('');
}

function downloadRecipeCard(id, tab = 'original', instanceId = null){
  const r = state.recipes.find(x => x.id === id);
  if(!r) return;
  const bundle = calculateRecipeDisplayNutrition({ recipe:r, variant:tab, instanceId });
  if(!bundle) return;
  const { active, types, portions, resolutionContext } = bundle;
  const formatMacro = (value, unit) => `${ppEscapeHtml(unit === 'kcal' ? Math.round(value || 0) : round1(value || 0))}${unit ? ' ' + unit : ''}`;
  const portionBox = (label, prefix) => {
    const isE = prefix === 'e';
    const pct = isE ? portions.ePct : portions.cPct;
    const recipePct = isE ? portions.eRecipePct : portions.cRecipePct;
    if(pct <= 0) return '';
    const cal = isE ? portions.eCal : portions.cCal;
    const prot = isE ? portions.eProt : portions.cProt;
    const carb = isE ? portions.eCarb : portions.cCarb;
    const fat = isE ? portions.eFat : portions.cFat;
    const fibre = isE ? portions.eFibre : portions.cFibre;
    return `<div class="person-card">
      <h3>${label} Portion (${recipePct}%)</h3>
      <div class="macro-grid">
        <div><span>Calories</span><strong>${formatMacro(cal, 'kcal')}</strong></div>
        <div><span>Fat</span><strong>${formatMacro(fat, 'g')}</strong></div>
        <div><span>Carbs</span><strong>${formatMacro(carb, 'g')}</strong></div>
        <div><span>Fibre</span><strong>${formatMacro(fibre, 'g')}</strong></div>
        <div><span>Protein</span><strong>${formatMacro(prot, 'g')}</strong></div>
      </div>
    </div>`;
  };
  const portionNutrition = `
    <section class="nutrition">
      <h2>Portion nutrition</h2>
      <p class="muted">Split this recipe ${portions.ePct > 0 ? `Elliott ${ppEscapeHtml(portions.e)}` : ''}${portions.ePct > 0 && portions.cPct > 0 ? ' / ' : ''}${portions.cPct > 0 ? `Chloe ${ppEscapeHtml(portions.c)}` : ''}.</p>
      <div class="portion-grid">
        ${portionBox('Elliott', 'e')}
        ${portionBox('Chloe', 'c')}
      </div>
    </section>`;
  const ingredients = renderGroupedIngredientItems(active.ingredients || [], ing => {
    const adjusted = typeof ing === 'object' ? getAdjustedIngredientForContext(ing, resolutionContext) : ing;
    const resolved = typeof adjusted === 'object' ? resolveProductForIngredient(adjusted, resolutionContext) : {};
    const generic = typeof ing === 'object' ? ingredientDisplayNameForRecipe(ing) : ingRaw(ing);
    const note = renderIngredientMappingNote(ing, resolved, { fontSize:'12px' });
    return `<li>${ppEscapeHtml(generic)}${ing.excludeNutrition ? ' <span class="muted">not counted</span>' : ''}${note}</li>`;
  }, { headingStyle: 'list-style:none;margin:12px 0 5px -18px;font-weight:700;color:#222;' });
  const steps = (active.steps || active.method || []).map(step => `<li>${ppEscapeHtml(step)}</li>`).join('');
  const source = renderRecipeSourceForPrint(active.source || r.source);
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${ppEscapeHtml(active.name || r.name)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#222;margin:32px;line-height:1.45}
  h1{font-size:28px;margin:0 0 8px}
  h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px}
  .meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}
  .pill{border:1px solid #ddd;border-radius:999px;padding:4px 9px;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1.4fr;gap:28px}
  .nutrition{margin:18px 0 22px}
  .portion-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px}
  .person-card{border:1px solid #ddd;border-radius:8px;padding:12px;background:#fbfaf7}
  .person-card h3{font-size:15px;margin:0 0 10px}
  .macro-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .macro-grid div{background:#f4f1ec;border:1px solid #ddd;border-radius:8px;padding:8px 10px}
  .macro-grid span{display:block;color:#666;font-size:12px;margin-bottom:3px}
  .macro-grid strong{font-size:18px;font-weight:650}
  li{margin:6px 0}
  .muted,.source{color:#666;font-size:12px}
  @media print{body{margin:18mm}.no-print{display:none}.grid{grid-template-columns:1fr 1.4fr}}
  @media(max-width:700px){.grid,.portion-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<button class="no-print" onclick="window.print()" style="float:right;padding:8px 12px;border:1px solid #bbb;border-radius:8px;background:white">Print</button>
<h1>${ppEscapeHtml(active.name || r.name)}</h1>
<div class="meta">
  ${types.map(t => `<span class="pill">${ppEscapeHtml(t)}</span>`).join('')}
  <span class="pill">${ppEscapeHtml(active.who === 'both' ? 'Shared' : active.who || '')}</span>
  ${active.serves ? `<span class="pill">Serves ${ppEscapeHtml(active.serves)}</span>` : ''}
  ${active.time ? `<span class="pill">${ppEscapeHtml(active.time)}m</span>` : ''}
</div>
${portionNutrition}
${source}
<div class="grid">
  <section><h2>Ingredients</h2><ul>${ingredients}</ul></section>
  <section><h2>Method</h2><ol>${steps}</ol></section>
</div>
</body>
</html>`;
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(active.name || r.name)} recipe card.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function editEnhancedRecipe(id) {
    capturePlatePlanEditBaseline('recipes/'+id);
    editRecipeModalView(id);
    switchModalTab('enhanced');
}

function reviewEnhancedRecipe(id){
    editRecipeModalView(id,'enhanced');
}

function deleteEnhancedRecipe(id) {
    const r = state.recipes.find(x => x.id === id);
    if(!r?.enhanced) return;
    openAppConfirmModal('Delete enhanced recipe?', 'Delete the enhanced version? The original recipe will be kept.', 'Delete enhanced version', () =>
      runWithRecoveryPoint('Before deleting enhanced recipe', () => {
        delete r.enhanced;
        refreshPlatePlanDerivedState({ persist:true, render:true });
      })
    );
}

function reviewRecipeModalView(id, instanceId = null, tab = 'original') {
    const r = (typeof window.findRecipeByIdOrInstance === 'function')
      ? window.findRecipeByIdOrInstance(id || instanceId)
      : (state?.recipes || []).find(x => x && (x.id === id || x.id === instanceId));
    if(!r) {
      console.error('[reviewRecipeModalView] Failed to resolve recipe for ID:', id, instanceId);
      return;
    }
    editId = instanceId ? null : (r.id || id);
    const hasEnh = !!r.enhanced;
    const tabEnh = document.getElementById('tab-btn-enhanced');
    const tabComp = document.getElementById('tab-btn-compare');
    if(tabEnh) tabEnh.style.display = hasEnh ? 'block' : 'none';
    if(tabComp) tabComp.style.display = hasEnh ? 'block' : 'none';
    const payload = { original: r, enhanced: r.enhanced || {} };
    openModal(r.name, payload, true, { instanceId: instanceId || id, tab });
}

function editRecipeModalView(id, initialTab = 'ingredients') {
    const r = (typeof window.findRecipeByIdOrInstance === 'function')
      ? window.findRecipeByIdOrInstance(id)
      : (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && x.id === id);
    if (!r) {
      console.error('[editRecipeModalView] Failed to resolve recipe data for ID:', id);
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Recipe data could not be loaded', 'error');
      }
      return;
    }
    editId = r.id || id;
    capturePlatePlanEditBaseline('recipes/'+editId);
    currentReviewInstanceId = null;
    currentReviewVariant = initialTab === 'enhanced' ? 'enhanced' : 'original';
    
    // Set view config based on whether enhanced exists
    const hasEnh = !!r.enhanced;
    const tabEnh = document.getElementById('tab-btn-enhanced');
    const tabComp = document.getElementById('tab-btn-compare');
    if(tabEnh) tabEnh.style.display = hasEnh ? 'block' : 'none';
    if(tabComp) tabComp.style.display = hasEnh ? 'block' : 'none';

    const payload = { original: r, enhanced: r.enhanced || {} };
    openModal(r.name, payload, false, { instanceId: null, tab: initialTab });
}
window.editRecipeModalView = editRecipeModalView;


// == ISOLATED DYNAMIC RECIPE PREVIEW & SUBSTITUTION ==
// == ISOLATED DYNAMIC RECIPE PREVIEW & SUBSTITUTION ==
let previewBaseRecipe = null;
let currentPreviewInstanceId = null;
let currentViewTab = 'original';
let currentPreviewServingMode = 'both'; // 'both' | 'elliott' | 'chloe'
let currentPreviewSingleServes = 1;

function closeRecipePreview() {
  const wrap = document.getElementById('view-modal-wrap');
  if (wrap) {
    wrap.classList.remove('open', 'active');
    wrap.style.removeProperty('display');
    wrap.style.removeProperty('visibility');
    wrap.style.removeProperty('opacity');
    wrap.style.removeProperty('z-index');
    wrap.style.display = 'none';
    wrap.style.visibility = 'hidden';
  }
  document.body.classList.remove('modal-open');
}
window.closeRecipePreview = closeRecipePreview;

function switchPreviewServingMode(mode) {
  currentPreviewServingMode = mode;
  const baseServes = previewBaseRecipe ? (+previewBaseRecipe.serves || 2) : 2;
  renderRecipePreview(baseServes);
}

function updateSinglePersonServes(val) {
  const v = Math.max(1, parseInt(val) || 1);
  currentPreviewSingleServes = v;
  const baseServes = previewBaseRecipe ? (+previewBaseRecipe.serves || 2) : 2;
  renderRecipePreview(baseServes);
}

function switchViewTab(tab) {
  if(tab === 'enhanced' && !previewBaseRecipe.enhanced) return;
  currentViewTab = tab;
  const targetServes = parseFloat(document.getElementById('preview-serves')?.value) || previewBaseRecipe.serves || 2;
  renderRecipePreview(targetServes);
}

function updateRecipePreviewScale(val) {
  const target = parseFloat(val);
  if(isNaN(target) || target <= 0) return;
  renderRecipePreview(target);
}

// viewRecipe implementation with window.previewBaseRecipe and window.renderRecipePreview
function viewRecipe(id, instanceId = null, tab = 'ingredients', servingMode = null) {
  if (typeof window.viewRecipe === 'function' && window.viewRecipe !== viewRecipe) {
    return window.viewRecipe(id, instanceId, tab, servingMode);
  }
  const r = (typeof window.findRecipeByIdOrInstance === 'function')
    ? window.findRecipeByIdOrInstance(id || instanceId)
    : (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : []) || []).find(x => x && (x.id === id || x.id === instanceId));
  if (!r) {
    console.error('[viewRecipe] Recipe not found:', id, instanceId);
    return;
  }

  // Ensure modal wrap is attached to body
  const wrap = document.getElementById('view-modal-wrap');
  const content = document.getElementById('view-modal-content');
  if (wrap && wrap.parentElement && wrap.parentElement !== document.body && wrap.parentElement.id !== 'app-container') {
    document.body.appendChild(wrap);
  }

  const cloneFn = typeof clonePlatePlanValue === 'function'
    ? clonePlatePlanValue
    : (typeof window.clonePlatePlanValue === 'function' ? window.clonePlatePlanValue : (val => JSON.parse(JSON.stringify(val))));
  previewBaseRecipe = cloneFn(r);
  window.previewBaseRecipe = previewBaseRecipe;
  currentPreviewInstanceId = instanceId;
  window.currentPreviewInstanceId = instanceId;
  currentViewTab = (tab === 'enhanced' && r.enhanced) ? 'enhanced' : (tab === 'original' ? 'original' : tab);
  window.currentViewTab = currentViewTab;
  currentPreviewServingMode = servingMode || 'both';
  window.currentPreviewServingMode = currentPreviewServingMode;
  currentPreviewSingleServes = 1;
  window.currentPreviewSingleServes = 1;

  // 1. Invoke window.renderRecipePreview before applying visibility styles
  if (typeof window.renderRecipePreview === 'function') {
    window.renderRecipePreview(window.previewBaseRecipe.serves || 2);
  } else {
    renderRecipePreview(r.serves || 2);
  }

  // 2. Explicitly set modal display properties on #view-modal-wrap
  if (wrap) {
    wrap.classList.add('open', 'active');
    wrap.style.setProperty('display', 'flex', 'important');
    wrap.style.setProperty('visibility', 'visible', 'important');
    wrap.style.setProperty('opacity', '1', 'important');
    wrap.style.setProperty('z-index', '99999', 'important');
    wrap.style.setProperty('overflow-y', 'auto', 'important');
  }
  if (content) {
    content.style.setProperty('display', 'block', 'important');
    content.style.setProperty('visibility', 'visible', 'important');
    content.style.setProperty('opacity', '1', 'important');
  }
  document.body.classList.add('modal-open');
}
window.viewRecipe = viewRecipe;

function renderRecipePreview(targetServes = 2) {
    const r = window.previewBaseRecipe || previewBaseRecipe;
    if(!r) return;
    previewBaseRecipe = r;
    window.previewBaseRecipe = r;
    const hasEnh = !!r.enhanced;
    const isEnh = (window.currentViewTab || currentViewTab) === 'enhanced' && hasEnh;
    const activePreviewInstanceId = window.currentPreviewInstanceId !== undefined ? window.currentPreviewInstanceId : currentPreviewInstanceId;
    const activePreviewServingMode = window.currentPreviewServingMode || currentPreviewServingMode;
    const activePreviewSingleServes = window.currentPreviewSingleServes || currentPreviewSingleServes;

    const bundle = calculateRecipeDisplayNutrition({ recipe:r, variant:isEnh ? 'enhanced' : 'original', instanceId:activePreviewInstanceId, targetServes });
    if(!bundle) return;

    const activeR = bundle.active;
    const mealType = bundle.mealType;
    const baseServes = activeR.serves || 1;
    const resolutionContext = bundle.resolutionContext;
    const portions = bundle.portions;

    let scale = 1.0;
    let servingModeBannerHtml = '';
    let allocationAndTargetHtml = '';

    if (currentPreviewServingMode === 'elliott') {
      const elliottProportion = (portions.eRecipePct > 0)
        ? (portions.eRecipePct / 100)
        : (portions.eSingleServ > 0 ? (portions.eSingleServ / baseServes) : (1 / baseServes));
      scale = elliottProportion * currentPreviewSingleServes;

      const scaledCal = Math.round(portions.eCal * currentPreviewSingleServes);
      const scaledProt = Math.round(portions.eProt * currentPreviewSingleServes * 10) / 10;
      const scaledCarb = Math.round(portions.eCarb * currentPreviewSingleServes * 10) / 10;
      const scaledFat = Math.round(portions.eFat * currentPreviewSingleServes * 10) / 10;

      servingModeBannerHtml = `
        <div class="recipe-view-serving-banner">
          <div class="recipe-view-serving-info">
            <span>👤 Elliott Only (${currentPreviewSingleServes} serving${currentPreviewSingleServes > 1 ? 's' : ''})</span>
            <span style="font-size:12px;font-weight:normal;color:var(--text2);">Scaled to Elliott's portion (${portions.e})</span>
          </div>
          <div class="recipe-view-macros-pill-group">
            <span class="slot-macro" style="font-size:12px;font-weight:700;">${scaledCal} kcal</span>
            <span class="slot-macro" style="font-size:12px;font-weight:700;">P ${scaledProt}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">C ${scaledCarb}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">F ${scaledFat}g</span>
          </div>
        </div>
      `;

      allocationAndTargetHtml = `
        <div style="margin-bottom:16px;">
          ${renderPortionTargetBox('Elliott', portions, 'e')}
        </div>
      `;
    } else if (currentPreviewServingMode === 'chloe') {
      const chloeProportion = (portions.cRecipePct > 0)
        ? (portions.cRecipePct / 100)
        : (portions.cSingleServ > 0 ? (portions.cSingleServ / baseServes) : (1 / baseServes));
      scale = chloeProportion * currentPreviewSingleServes;

      const scaledCal = Math.round(portions.cCal * currentPreviewSingleServes);
      const scaledProt = Math.round(portions.cProt * currentPreviewSingleServes * 10) / 10;
      const scaledCarb = Math.round(portions.cCarb * currentPreviewSingleServes * 10) / 10;
      const scaledFat = Math.round(portions.cFat * currentPreviewSingleServes * 10) / 10;

      servingModeBannerHtml = `
        <div class="recipe-view-serving-banner">
          <div class="recipe-view-serving-info">
            <span>👤 Chloe Only (${currentPreviewSingleServes} serving${currentPreviewSingleServes > 1 ? 's' : ''})</span>
            <span style="font-size:12px;font-weight:normal;color:var(--text2);">Scaled to Chloe's portion (${portions.c})</span>
          </div>
          <div class="recipe-view-macros-pill-group">
            <span class="slot-macro" style="font-size:12px;font-weight:700;">${scaledCal} kcal</span>
            <span class="slot-macro" style="font-size:12px;font-weight:700;">P ${scaledProt}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">C ${scaledCarb}g</span>
            <span class="slot-macro" style="font-size:12px;color:var(--text2);">F ${scaledFat}g</span>
          </div>
        </div>
      `;

      allocationAndTargetHtml = `
        <div style="margin-bottom:16px;">
          ${renderPortionTargetBox('Chloe', portions, 'c')}
        </div>
      `;
    } else {
      scale = targetServes / baseServes;

      const allocationHtml = `
        <div style="margin-bottom:12px;background:var(--surface2);padding:10px 14px;border-radius:var(--radius-control, 12px);border:1px solid var(--border)">
          <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:var(--text)">Portion Allocation (${toTitleCase(mealType)})</div>
          <div style="font-size:12px;display:flex;gap:18px;flex-wrap:wrap">
            ${portions.ePct > 0 ? `<div><strong>Elliott:</strong> ${portions.e} <span style="color:var(--text2)">(${portions.eCal} kcal · P${portions.eProt}g)</span></div>` : ''}
            ${portions.cPct > 0 ? `<div><strong>Chloe:</strong> ${portions.c} <span style="color:var(--text2)">(${portions.cCal} kcal · P${portions.cProt}g)</span></div>` : ''}
          </div>
        </div>
      `;

      const targetBoxHtml = `
        <div class="grid2" style="margin-bottom:16px;gap:12px;">
          ${renderPortionTargetBox('Elliott', portions, 'e')}
          ${renderPortionTargetBox('Chloe', portions, 'c')}
        </div>
      `;

      allocationAndTargetHtml = allocationHtml + targetBoxHtml;
    }

    const recipeSource = activeR.source || r.source;
    const sourceHtml = recipeSource ? `
      <div style="margin-bottom:14px;background:var(--surface2);padding:10px 14px;border-radius:10px;font-size:12px;color:var(--text2);border:1px solid var(--border)">
        <strong style="color:var(--text)">Source:</strong> ${renderSourceTag(recipeSource)}
      </div>
    ` : '';

    const content = document.getElementById('view-modal-content');
    if (!content) return;
    const wrap = document.getElementById('view-modal-wrap');
    if (wrap) {
      wrap.classList.add('open');
      wrap.style.display = 'flex';
      wrap.style.visibility = 'visible';
    }
    document.body.classList.add('modal-open');

    const variantKey = isEnh ? 'enhanced' : 'original';
    const isFav = (typeof isRecipeVariantFavourite === 'function' ? isRecipeVariantFavourite(r.id, variantKey) : false) || (!hasVariantFavoritingInitialized() && (r.isFavourite || r.isFavorite) && !isEnh);
    content.innerHTML = `
      <div class="recipe-view-sheet">
        <div class="recipe-view-nav">
          <div class="recipe-view-nav-title">
            <h2>${ppEscapeHtml(activeR.name)}</h2>
            <div class="recipe-view-nav-subtitle">
              ${isFav ? '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-weight:600">❤️ Favourite</span>' : ''}
              ${isEnh ? '<span class="tag enhanced-pill">✨ Enhanced</span>' : ''}
              ${activeR.time ? `<span>⏱ ${activeR.time}m prep</span> · ` : ''}
              <span>${toTitleCase(mealType || 'Dinner')}</span>
              <span>·</span>
              <span>Serves ${activeR.serves || 1} baseline</span>
              ${currentPreviewInstanceId ? '<span class="tag" style="background:var(--purple-bg);color:var(--purple);font-size:11px">Planned Meal</span>' : ''}
            </div>
          </div>
          <div class="recipe-view-nav-actions" style="display:flex;align-items:center;gap:8px">
            <button type="button" id="modal-recipe-fav-btn" class="recipe-fav-btn ${isFav ? 'active' : ''}" onclick="toggleRecipeFavourite('${ppEscapeAttr(r.id)}', event, '${variantKey}')" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button type="button" class="recipe-view-close-btn" onclick="closeRecipePreview()" aria-label="Close recipe">✕</button>
          </div>
        </div>

        <div class="recipe-view-body">
          <div class="recipe-view-controls-bar">
            ${hasEnh ? `
              <div class="segmented-control" role="tablist" style="width:fit-content;margin-bottom:4px;">
                <button type="button" role="tab" class="${!isEnh ? 'active' : ''}" onclick="switchViewTab('original')">Original</button>
                <button type="button" role="tab" class="${isEnh ? 'active' : ''}" onclick="switchViewTab('enhanced')">✨ Enhanced</button>
              </div>
            ` : ''}

            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
              <div class="segmented-control" role="tablist">
                <button type="button" role="tab" class="${currentPreviewServingMode==='both'?'active':''}" onclick="switchPreviewServingMode('both')">Shared (${activeR.serves || 2})</button>
                <button type="button" role="tab" class="${currentPreviewServingMode==='elliott'?'active':''}" onclick="switchPreviewServingMode('elliott')">👤 Elliott only</button>
                <button type="button" role="tab" class="${currentPreviewServingMode==='chloe'?'active':''}" onclick="switchPreviewServingMode('chloe')">👤 Chloe only</button>
              </div>

              ${currentPreviewServingMode === 'both' ? `
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                  <label for="preview-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                  <input type="number" id="preview-serves" value="${targetServes}" oninput="updateRecipePreviewScale(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
                </div>
              ` : `
                <div style="display:flex;align-items:center;gap:8px;font-size:13px;">
                  <label for="preview-single-serves" style="font-weight:650;color:var(--text)">Servings:</label>
                  <input type="number" id="preview-single-serves" value="${currentPreviewSingleServes}" oninput="updateSinglePersonServes(this.value)" style="width:70px;min-height:36px;padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);font-weight:700;text-align:center" min="1" step="1">
                </div>
              `}
            </div>
          </div>

          ${servingModeBannerHtml}
          ${allocationAndTargetHtml}
          ${sourceHtml}

          <div class="recipe-view-content-grid">
            <div class="recipe-view-card">
              <div class="recipe-view-section-header">
                <h3>Ingredients</h3>
                <span class="recipe-view-count-badge">${(activeR.ingredients || []).length} items</span>
              </div>
              <ul class="recipe-ingredients-list">
                ${renderGroupedIngredientItems(activeR.ingredients || [], i => {
                  const adjusted = typeof i === 'object' ? getAdjustedIngredientForContext(i, resolutionContext) : i;
                  const resolved = typeof adjusted === 'object' ? resolveProductForIngredient(adjusted, resolutionContext) : {};
                  let text = typeof i === 'string' ? i : (ingRaw(i) || ingredientDisplayNameForRecipe(i));
                  if (scale !== 1.0 && i.qty) {
                    text = i.stockWaterMl ? formatStockIngredientText(i, scale) : `${Math.round((i.qty * scale)*100)/100} ${i.unit !== 'qty' ? i.unit : ''} ${i.name || ''}`.trim();
                  }
                  const defaultProduct = typeof i === 'object' ? resolveProductForIngredient(i, {}).product : null;
                  const selectedProduct = resolved.product;
                  const productNote = renderIngredientMappingNote(i, resolved);
                  const subBadge = (i.isSubstituted || (currentPreviewInstanceId && defaultProduct && selectedProduct && defaultProduct.id !== selectedProduct.id)) ? ` <span style="color:var(--purple);font-style:italic;font-size:11px;">(product changed)</span>` : '';
                  const notCountedBadge = i.excludeNutrition ? ` <span class="tag">not counted</span>` : '';
                  const originalKey = typeof i === 'object' ? (getRecipeIngredientGroupId(i) || i.originalBankId || i.bankId) : '';
                  const subAction = (currentPreviewInstanceId && originalKey) ? ` <button class="btn sm ghost" style="padding:0px 4px;font-size:10px;margin-left:6px;" onclick="openSubstituteModal('${currentPreviewInstanceId}', '${originalKey}')">Product</button>` : '';
                  const title = typeof i === 'object' ? ingredientContributionTitle(i, activeR, targetServes) : '';
                  return `<li style="${title?'cursor:help;':''}" title="${ppEscapeHtml(title)}">${ppEscapeHtml(text)}${notCountedBadge}${productNote}${subBadge}${subAction}</li>`;
                })}
              </ul>
            </div>

            <div class="recipe-view-card">
              <div class="recipe-view-section-header">
                <h3>Method</h3>
                <span class="recipe-view-count-badge">${(activeR.steps || activeR.method || []).length} steps</span>
              </div>
              <ol class="recipe-method-list">
                ${(activeR.steps || activeR.method || []).map(s => `<li>${ppEscapeHtml(s)}</li>`).join('')}
              </ol>
            </div>
          </div>
        </div>
      </div>
    `;
    bindPortionNutritionTooltips(content, activeR, targetServes);
}

function applyScaleToRecipeDefinition(targetServes) {
    const scale = targetServes / previewBaseRecipe.serves;
    const r = clonePlatePlanValue(previewBaseRecipe);
    r.serves = targetServes;
    r.ingredients.forEach(i => {
        if(i.qty) {
            i.qty = Math.round((i.qty * scale)*100)/100;
            i.grams = toGrams(i.qty, i.unit);
            i.raw = `${i.qty} ${i.unit !== 'qty' ? i.unit : ''} ${i.name}`.trim();
        }
    });
    const n = calcRecipeNutrition(r.ingredients, r.serves);
    r.cal = n.cal; r.prot = n.prot; r.carb = n.carb; r.fat = n.fat; r.fibre = n.fibre;
    const mtRoot = (r.types && r.types[0]) || 'dinner';
    r.portions = calcPortions(n, state.prefs, r.serves, r.who, mtRoot);
    
    if(r.enhanced) {
        r.enhanced.ingredients.forEach(i => {
            if(i.qty) {
                i.qty = Math.round((i.qty * scale)*100)/100;
                i.grams = toGrams(i.qty, i.unit);
                i.raw = `${i.qty} ${i.unit !== 'qty' ? i.unit : ''} ${i.name}`.trim();
            }
        });
        const ne = calcRecipeNutrition(r.enhanced.ingredients, r.serves);
        r.enhanced.cal = ne.cal; r.enhanced.prot = ne.prot; r.enhanced.carb = ne.carb; r.enhanced.fat = ne.fat; r.enhanced.fibre = ne.fibre;
        const ePortions = calcPortions(ne, state.prefs, r.serves, r.who, mtRoot);
        r.enhanced.portionE = ePortions.e;
        r.enhanced.portionC = ePortions.c;
    }
    return r;
}

function savePreviewScaleToCurrent(targetServes) {
    const scaledR = applyScaleToRecipeDefinition(targetServes);
    const idx = state.recipes.findIndex(x => x.id === scaledR.id);
    if(idx > -1) {
        scaledR.updatedAt = new Date().toISOString();
        state.recipes[idx] = scaledR;
        platePlanNutritionCache.clear();
        markPlatePlanViewsDirty();
        saveState(true);
        document.getElementById('view-modal-wrap').classList.remove('open');
        renderVault();
        if(state.plan?.slots) renderPlan(); 
        showMsg('form-msg','Recipe updated to new serving baseline.','success');
    }
}

function savePreviewScaleAsNew(targetServes) {
    const scaledR = applyScaleToRecipeDefinition(targetServes);
    scaledR.id = 'r' + Date.now();
    scaledR.name = scaledR.name + " (Scaled)";
    scaledR.updatedAt = new Date().toISOString();
    state.recipes.push(scaledR);
    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    saveState(true);
    document.getElementById('view-modal-wrap').classList.remove('open');
    renderVault();
    showMsg('form-msg','Saved as new recipe.','success');
}

function editRecipe(id){
  capturePlatePlanEditBaseline('recipes/'+id);
  const r=state.recipes.find(x=>x.id===id);if(!r)return;
  editId=id;
  
  // Cache assignments so they are auto-restored
  window.currentEditMap = {};
  window.currentEditGroupMap = {};
  window.currentEditIngredientMeta = {};
  if(r.ingredients) {
      r.ingredients.forEach(i => {
        if(typeof i === 'object' && i.raw && i.bankId) window.currentEditMap[i.raw] = i.bankId;
        if(typeof i === 'object' && i.raw && (i.groupId || getRecipeIngredientGroupId(i))) window.currentEditGroupMap[i.raw] = i.groupId || getRecipeIngredientGroupId(i);
        if(typeof i === 'object' && i.raw && (i.excludeNutrition || i.section || i.ingredientId)) {
          window.currentEditIngredientMeta[i.raw] = {
            ...(i.excludeNutrition ? { excludeNutrition: true } : {}),
            ...(i.section ? { section: i.section } : {}),
            ...(i.ingredientId ? { ingredientId: i.ingredientId, mappedViaIngredient: !!i.mappedViaIngredient } : {})
          };
        }
      });
  }

  document.getElementById('form-title').textContent='Edit recipe';
  document.getElementById('r-name').value=r.name;document.getElementById('r-who').value=r.who;
  document.getElementById('r-serves').value=r.serves||2;
  document.getElementById('r-serves-orig').value=r.serves||2;
  document.getElementById('r-time').value=r.time||'';
  setMealTypes(r.types||[r.type||'dinner']);
  document.getElementById('r-ingredients').value=(r.ingredients||[]).map(i=>ingRaw(i)).join('\n');
  document.getElementById('r-method').value=(r.steps||[]).join('\n');
  setSourceFields(r.source||null);
  showView('add');
}
function deleteRecipe(id){
  const recipe = state.recipes.find(r => r.id === id);
  if(!recipe) return;
  openAppConfirmModal('Delete recipe?', `Delete <strong>${ppEscapeHtml(recipe.name || 'this recipe')}</strong>?`, 'Delete recipe', () =>
    runWithRecoveryPoint('Before deleting recipe', () => {
      state.recipes=state.recipes.filter(r=>r.id!==id);
      deleteRecipeFromCloud(id);
      refreshPlatePlanDerivedState({ persist:true, render:true });
    })
  );
}

function duplicateRecipe(id){
    const r=state.recipes.find(x=>x.id===id);
    if(!r)return;
    const clone=JSON.parse(JSON.stringify(r));
    clone.id='r'+Date.now();
    clone.name=clone.name+' (Copy)';
    clone.updatedAt=new Date().toISOString();
    if(clone.enhanced) clone.enhanced.name=clone.enhanced.name+' (Copy)';
    state.recipes.push(clone);
    platePlanNutritionCache.clear();
    markPlatePlanViewsDirty();
    saveState(true);
    renderVault();
    editRecipe(clone.id);
}

  window.PlatePlanRecipeEditor = {
    renderReviewUnitSelect,
    uniqueSectionNames,
    getParseSectionOptions,
    getReviewSectionOptions,
    updateSectionDatalist,
    refreshParseSectionOptions,
    refreshReviewSectionOptions,
    renderSectionInput,
    getReviewResolutionContext,
    applyReviewContextToIngredients,
    applyTemporaryReviewOverrides,
    getReviewIngredientSearchOptions,
    closeReviewIngredientSearchDropdown,
    renderReviewIngredientSearch,
    handleReviewIngredientNameInput,
    startReviewIngredientDrag,
    overReviewIngredientDrag,
    endReviewIngredientDrag,
    renderModalIngs,
    removeReviewIngredientRow,
    editModalRowIngredient,
    openReviewIngredientActions,
    runReviewIngredientMobileAction,
    ensureReviewReplaceModal,
    openUnifiedMappingModal,
    closeUnifiedMappingModal,
    switchUnifiedMapTab,
    handleUnifiedMapSearch,
    selectUnifiedMapProduct,
    selectUnifiedMapGroup,
    applyUnifiedMappingResult,
    openTescoModal,
    showTescoSearchModal,
    openAddProductModal,
    openProductPicker,
    triggerTescoImportFromUnifiedMap,
    triggerNewProductFromUnifiedMap,
    openUnifiedMappingModalFromRow,
    openReviewMappingModalFromStatus,
    openModalIngredientReplace,
    closeModalIngredientReplace,
    renderReviewReplaceOptions,
    selectReviewReplacement,
    updateModalIngredientContributionTitles,
    renderModalMethod,
    copyOriginalMethodToEnhanced,
    addModalIng,
    addModalMethod,
    reindexModalMethod,
    renderReviewCostSummary,
    renderProteinEfficiencyAnalysisSection,
    searchSubstituteForIngredient,
    highlightReviewIngredientRow,
    recalcModal,
    openModal,
    switchModalTab,
    closeModal,
    normaliseReviewCompareText,
    comparableReviewIngredients,
    comparableReviewSteps,
    hasMeaningfulEnhancedModalChanges,
    updateSaveBothVisibility,
    extractModalList,
    buildRecipeFromModal,
    saveBoth,
    saveOrigOnly,
    saveTemporaryPlanReview,
    confirmSave,
    deleteEnhancedVersion,
    saveToVault,
    safeFileName,
    normaliseRecipeIngredientSection,
    orderRecipeIngredientsBySection,
    renderGroupedIngredientItems,
    downloadRecipeCard,
    editEnhancedRecipe,
    reviewEnhancedRecipe,
    deleteEnhancedRecipe,
    reviewRecipeModalView,
    editRecipeModalView,
    closeRecipePreview,
    switchPreviewServingMode,
    updateSinglePersonServes,
    switchViewTab,
    updateRecipePreviewScale,
    viewRecipe,
    renderRecipePreview,
    applyScaleToRecipeDefinition,
    savePreviewScaleToCurrent,
    savePreviewScaleAsNew,
    editRecipe,
    deleteRecipe,
    duplicateRecipe
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, window.PlatePlanRecipeEditor);
  }
})();
