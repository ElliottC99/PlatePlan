// == Settings, Backup Engine & Data Quality Diagnostics Subsystem ==

(function() {
  // == Preferences and Settings ==
  function ensureExclusionPrefsUI(){
    const legacy = document.getElementById('pref-exclude');
    if(!legacy || document.getElementById('pref-exclude-ui')) return;
    const field = legacy.closest('.field') || legacy.parentElement;
    if(!field) return;
    if(field) field.style.display = 'none';
    field.insertAdjacentHTML('afterend', `<div class="field" id="pref-exclude-ui">
      <label>Foods to always exclude</label>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <select id="pref-exclude-scope" style="width:auto;font-size:12px">
          <option value="shared">Both</option>
          <option value="elliott">Elliott only</option>
          <option value="chloe">Chloe only</option>
        </select>
        <div class="mapping-search-container" style="position:relative;flex:1;min-width:220px">
          <input type="text" class="map-search-input" id="pref-exclude-search" autocomplete="off" placeholder="Search ingredients or products..." oninput="handleExcludeSearch()" onfocus="handleExcludeSearch()">
          <div class="map-dropdown" id="pref-exclude-dropdown" style="display:none"></div>
        </div>
        <button class="btn sm ghost" onclick="viewExclusions()">View list</button>
      </div>
      <div id="pref-exclude-preview" style="font-size:12px;color:var(--text2);margin-top:6px"></div>
    </div>`);
  }

  function handleExcludeSearch(){
    const q=(document.getElementById('pref-exclude-search')?.value||'').toLowerCase().trim();
    const drop=document.getElementById('pref-exclude-dropdown');
    if(!drop) return;
    const rows=[];
    (window.state.ingredientGroups||[]).forEach(g => rows.push({ type:'group', id:g.id, name:g.name, sub:'Ingredient', search:[g.name,...(g.aliases||[]),g.family||''].join(' ').toLowerCase() }));
    (window.state.ingredients||[]).forEach(p => rows.push({ type:'product', id:p.id, groupId:p.groupId, name:p.name, sub:p.brand||'Product', search:[p.name,p.brand||'',getIngredientGroup(p.groupId)?.name||''].join(' ').toLowerCase() }));
    const terms=q.split(/\s+/).filter(Boolean);
    const filtered=rows.filter(r=>!terms.length||terms.every(t=>r.search.includes(t))).slice(0,20);
    drop.innerHTML=filtered.length ? filtered.map(r=>`<div class="map-drop-item" onclick="addExclusion('${r.type}','${r.id}',decodeURIComponent('${encodeURIComponent(r.name)}'),'${r.groupId||''}')"><div style="font-weight:600;font-size:13px">${ppEscapeHtml(r.name)}</div><div style="font-size:11px;color:var(--text2)">${ppEscapeHtml(r.sub)}</div></div>`).join('') : '<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No matches found.</div>';
    drop.style.display='block';
  }

  function addExclusion(type, id, name, groupId=''){
    const scope=document.getElementById('pref-exclude-scope')?.value || 'shared';
    if(!window.state.prefs.exclusions) window.state.prefs.exclusions={shared:[],elliott:[],chloe:[]};
    const row={ type, id, name, ...(groupId?{groupId}:{}) };
    if(!window.state.prefs.exclusions[scope].some(x => x.id===id || normaliseAliasText(x.name)===normaliseAliasText(name))) window.state.prefs.exclusions[scope].push(row);
    const pSearch = document.getElementById('pref-exclude-search');
    if(pSearch) pSearch.value='';
    const pDrop = document.getElementById('pref-exclude-dropdown');
    if(pDrop) pDrop.style.display='none';
    saveState();
    renderExclusionPreview();
  }

  function removeExclusion(scope, index){
    if(window.state.prefs.exclusions?.[scope]) window.state.prefs.exclusions[scope].splice(index,1);
    saveState();
    renderExclusionPreview();
    viewExclusions();
  }

  function renderExclusionPreview(){
    const el=document.getElementById('pref-exclude-preview');
    if(!el) return;
    const ex=window.state.prefs.exclusions || {shared:[],elliott:[],chloe:[]};
    el.textContent=`Both: ${(ex.shared||[]).length} · Elliott: ${(ex.elliott||[]).length} · Chloe: ${(ex.chloe||[]).length}`;
  }

  function viewExclusions(){
    const ex=window.state.prefs.exclusions || {shared:[],elliott:[],chloe:[]};
    const label={shared:'Both',elliott:'Elliott only',chloe:'Chloe only'};
    const html=['shared','elliott','chloe'].map(scope=>`<div class="summary-box"><strong>${label[scope]}</strong>${(ex[scope]||[]).length ? (ex[scope]||[]).map((x,i)=>`<div class="row-between" style="gap:8px;border-top:1px solid var(--border);padding:6px 0"><span>${ppEscapeHtml(x.name||'Unnamed')}</span><button class="btn sm ghost" onclick="removeExclusion('${scope}',${i})">Remove</button></div>`).join('') : '<div style="color:var(--text3)">None</div>'}</div>`).join('');
    openAppInfoModal('Excluded foods', html);
  }

  function toggleSeparateProteinAllocUI() {
    // Retained for compatibility
  }

  function loadPrefs(){
    const p=window.state.prefs||{};
    ensureExclusionPrefsUI();
    if(document.getElementById('pref-exclude')) document.getElementById('pref-exclude').value=p.exclude||'';
    if(document.getElementById('pref-diet')) document.getElementById('pref-diet').value=p.diet||'vegetarian';
    if(document.getElementById('pref-auto-mapping-strategy')) document.getElementById('pref-auto-mapping-strategy').value=p.autoMappingStrategy||'protein_per_kcal';
    if(document.getElementById('pref-ecal')) document.getElementById('pref-ecal').value=p.ecal||2400;
    if(document.getElementById('pref-eprot')) document.getElementById('pref-eprot').value=p.eprot||130;
    if(document.getElementById('pref-ccal')) document.getElementById('pref-ccal').value=p.ccal||1700;
    if(document.getElementById('pref-cprot')) document.getElementById('pref-cprot').value=p.cprot||100;
    const ea = p.eAlloc || {b:15, l:25, d:45, s:15};
    if(document.getElementById('pref-eb')) document.getElementById('pref-eb').value = ea.b;
    if(document.getElementById('pref-el')) document.getElementById('pref-el').value = ea.l;
    if(document.getElementById('pref-ed')) document.getElementById('pref-ed').value = ea.d;
    if(document.getElementById('pref-es')) document.getElementById('pref-es').value = ea.s;

    const ca = p.cAlloc || {b:25, l:30, d:35, s:10};
    if(document.getElementById('pref-cb')) document.getElementById('pref-cb').value = ca.b;
    if(document.getElementById('pref-cl')) document.getElementById('pref-cl').value = ca.l;
    if(document.getElementById('pref-cd')) document.getElementById('pref-cd').value = ca.d;
    if(document.getElementById('pref-cs')) document.getElementById('pref-cs').value = ca.s;

    const epa = p.eProtAlloc || ea;
    if(document.getElementById('pref-epb')) document.getElementById('pref-epb').value = epa.b;
    if(document.getElementById('pref-epl')) document.getElementById('pref-epl').value = epa.l;
    if(document.getElementById('pref-epd')) document.getElementById('pref-epd').value = epa.d;
    if(document.getElementById('pref-eps')) document.getElementById('pref-eps').value = epa.s;

    const cpa = p.cProtAlloc || ca;
    if(document.getElementById('pref-cpb')) document.getElementById('pref-cpb').value = cpa.b;
    if(document.getElementById('pref-cpl')) document.getElementById('pref-cpl').value = cpa.l;
    if(document.getElementById('pref-cpd')) document.getElementById('pref-cpd').value = cpa.d;
    if(document.getElementById('pref-cps')) document.getElementById('pref-cps').value = cpa.s;

    ['pref-ecal','pref-eprot','pref-eb','pref-el','pref-ed','pref-es','pref-epb','pref-epl','pref-epd','pref-eps',
     'pref-ccal','pref-cprot','pref-cb','pref-cl','pref-cd','pref-cs','pref-cpb','pref-cpl','pref-cpd','pref-cps'].forEach(id => {
      const el = document.getElementById(id);
      if(el && !el.dataset.budgetBound) {
        el.dataset.budgetBound = '1';
        el.addEventListener('input', calcBudgets);
        el.addEventListener('change', calcBudgets);
      }
    });

    calcBudgets();
    renderExclusionPreview();
    renderRecoveryPanel();
    syncPlatePlanVersionDisplay();
  }

  function calcBudgets() {
    const ecal = +document.getElementById('pref-ecal')?.value||2400;
    const eprot = +document.getElementById('pref-eprot')?.value||130;
    const eb = +document.getElementById('pref-eb')?.value||0;
    const el = +document.getElementById('pref-el')?.value||0;
    const ed = +document.getElementById('pref-ed')?.value||0;
    const es = +document.getElementById('pref-es')?.value||0;

    const ccal = +document.getElementById('pref-ccal')?.value||1700;
    const cprot = +document.getElementById('pref-cprot')?.value||100;
    const cb = +document.getElementById('pref-cb')?.value||0;
    const cl = +document.getElementById('pref-cl')?.value||0;
    const cd = +document.getElementById('pref-cd')?.value||0;
    const cs = +document.getElementById('pref-cs')?.value||0;

    const epb = +document.getElementById('pref-epb')?.value||0;
    const epl = +document.getElementById('pref-epl')?.value||0;
    const epd = +document.getElementById('pref-epd')?.value||0;
    const eps = +document.getElementById('pref-eps')?.value||0;

    const cpb = +document.getElementById('pref-cpb')?.value||0;
    const cpl = +document.getElementById('pref-cpl')?.value||0;
    const cpd = +document.getElementById('pref-cpd')?.value||0;
    const cps = +document.getElementById('pref-cps')?.value||0;

    const eCalValid = (eb+el+ed+es) === 100;
    const cCalValid = (cb+cl+cd+cs) === 100;
    const eProtValid = (epb+epl+epd+eps) === 100;
    const cProtValid = (cpb+cpl+cpd+cps) === 100;

    const errors = [];
    if (!eCalValid) errors.push(`Elliott's calorie percentages total ${eb+el+ed+es}% (must equal 100%).`);
    if (!cCalValid) errors.push(`Chloe's calorie percentages total ${cb+cl+cd+cs}% (must equal 100%).`);
    if (!eProtValid) errors.push(`Elliott's protein percentages total ${epb+epl+epd+eps}% (must equal 100%).`);
    if (!cProtValid) errors.push(`Chloe's protein percentages total ${cpb+cpl+cpd+cps}% (must equal 100%).`);

    const warnEl = document.getElementById('alloc-warn');
    if (warnEl) {
      if (errors.length > 0) {
        warnEl.innerHTML = errors.join('<br>');
        warnEl.style.display = 'block';
      } else {
        warnEl.style.display = 'none';
      }
    }

    const allValid = eCalValid && cCalValid && eProtValid && cProtValid;
    const saveBtn = document.getElementById('btn-save-prefs');
    if (saveBtn) saveBtn.disabled = !allValid;

    const eBudgetEl = document.getElementById('ebudget-text');
    if (eBudgetEl) {
      eBudgetEl.innerHTML = `
          <strong>Breakfast Budget:</strong> ${Math.round(ecal*eb/100)}kcal / ${Math.round(eprot*epb/100)}g P<br>
          <strong>Lunch Budget:</strong> ${Math.round(ecal*el/100)}kcal / ${Math.round(eprot*epl/100)}g P<br>
          <strong>Dinner Budget:</strong> ${Math.round(ecal*ed/100)}kcal / ${Math.round(eprot*epd/100)}g P<br>
          <strong>Snacks Budget:</strong> ${Math.round(ecal*es/100)}kcal / ${Math.round(eprot*eps/100)}g P
      `;
    }

    const cBudgetEl = document.getElementById('cbudget-text');
    if (cBudgetEl) {
      cBudgetEl.innerHTML = `
          <strong>Breakfast Budget:</strong> ${Math.round(ccal*cb/100)}kcal / ${Math.round(cprot*cpb/100)}g P<br>
          <strong>Lunch Budget:</strong> ${Math.round(ccal*cl/100)}kcal / ${Math.round(cprot*cpl/100)}g P<br>
          <strong>Dinner Budget:</strong> ${Math.round(ccal*cd/100)}kcal / ${Math.round(cprot*cpd/100)}g P<br>
          <strong>Snacks Budget:</strong> ${Math.round(ccal*cs/100)}kcal / ${Math.round(cprot*cps/100)}g P
      `;
    }
  }

  function savePrefs(){
    const eb = +document.getElementById('pref-eb')?.value||0;
    const el = +document.getElementById('pref-el')?.value||0;
    const ed = +document.getElementById('pref-ed')?.value||0;
    const es = +document.getElementById('pref-es')?.value||0;

    const cb = +document.getElementById('pref-cb')?.value||0;
    const cl = +document.getElementById('pref-cl')?.value||0;
    const cd = +document.getElementById('pref-cd')?.value||0;
    const cs = +document.getElementById('pref-cs')?.value||0;

    const epb = +document.getElementById('pref-epb')?.value||0;
    const epl = +document.getElementById('pref-epl')?.value||0;
    const epd = +document.getElementById('pref-epd')?.value||0;
    const eps = +document.getElementById('pref-eps')?.value||0;

    const cpb = +document.getElementById('pref-cpb')?.value||0;
    const cpl = +document.getElementById('pref-cpl')?.value||0;
    const cpd = +document.getElementById('pref-cpd')?.value||0;
    const cps = +document.getElementById('pref-cps')?.value||0;

    if((eb+el+ed+es) !== 100 || (cb+cl+cd+cs) !== 100 || (epb+epl+epd+eps) !== 100 || (cpb+cpl+cpd+cps) !== 100) {
      showMsg('prefs-msg','Percentages must total 100% for both calories and protein.','error');
      return;
    }

    window.state.prefs={
      ...window.state.prefs,
      updatedAt: new Date().toISOString(),
      exclude: document.getElementById('pref-exclude')?.value||'',
      exclusions: window.state.prefs.exclusions || {shared:[],elliott:[],chloe:[]},
      diet: document.getElementById('pref-diet')?.value||'vegetarian',
      ecal: +document.getElementById('pref-ecal')?.value||2400,
      eprot: +document.getElementById('pref-eprot')?.value||130,
      ccal: +document.getElementById('pref-ccal')?.value||1700,
      cprot: +document.getElementById('pref-cprot')?.value||100,
      eAlloc: {b:eb, l:el, d:ed, s:es},
      cAlloc: {b:cb, l:cl, d:cd, s:cs},
      eProtAlloc: {b:epb, l:epl, d:epd, s:eps},
      cProtAlloc: {b:cpb, l:cpl, d:cpd, s:cps},
      shopGroupBy: window.state.prefs.shopGroupBy || 'family',
      autoMappingStrategy: document.getElementById('pref-auto-mapping-strategy')?.value || window.state.prefs.autoMappingStrategy || 'protein_per_kcal',
      productPriority: document.getElementById('plan-product-priority')?.value || window.state.prefs.productPriority || 'protein'
    };
    refreshAllAutoDefaultProducts();
    if (typeof platePlanNutritionCache !== 'undefined' && platePlanNutritionCache.clear) {
      platePlanNutritionCache.clear();
    }
    recalcAllRecipes();
    saveState(true);
    if (document.getElementById('modal-wrap')?.classList.contains('open')) {
      if (typeof recalcModal === 'function') {
        recalcModal('orig');
        recalcModal('enh');
      }
    }
    showMsg('prefs-msg','Preferences saved.','success');
    renderVault(); // refreshes any views dependent on macros
  }

  // == Data Export, Import & JSON Backup ==
  function getPlatePlanBackupPayload(){
    return {
      exportedAt: new Date().toISOString(),
      app: 'PlatePlan',
      version: PLATEPLAN_APP_VERSION,
      schemaVersion: PLATEPLAN_SCHEMA_VERSION,
      state: window.state
    };
  }

  function downloadPlatePlanDataBackup(){
    try{
      const stamp = new Date().toISOString().slice(0,10);
      const downloadBlob = window.downloadPlatePlanBlob || downloadPlatePlanBlob;
      downloadBlob('PlatePlan data backup ' + stamp + '.json', JSON.stringify(getPlatePlanBackupPayload(), null, 2), 'application/json');
      showMsg('prefs-data-msg','PlatePlan data exported.','success');
    }catch(e){
      showMsg('prefs-data-msg','Could not export PlatePlan data.','error');
    }
  }

  function getPlatePlanStateCounts(candidate){
    return {
      recipes:Array.isArray(candidate?.recipes) ? candidate.recipes.length : 0,
      products:Array.isArray(candidate?.ingredients) ? candidate.ingredients.length : 0,
      ingredients:Array.isArray(candidate?.ingredientFamilies) ? candidate.ingredientFamilies.length : 0,
      subTypes:Array.isArray(candidate?.ingredientGroups) ? candidate.ingredientGroups.length : 0,
      planDays:+candidate?.plan?.days || Object.keys(candidate?.plan?.slots || {}).length,
      planHistory:Array.isArray(candidate?.planHistory) ? candidate.planHistory.length : 0
    };
  }

  function validatePlatePlanImport(candidate, metadata = {}){
    const errors = [], warnings = [];
    if(!candidate || typeof candidate !== 'object') errors.push('The backup does not contain a PlatePlan state object.');
    if(!Array.isArray(candidate?.recipes)) errors.push('Recipes are missing or invalid.');
    if(!Array.isArray(candidate?.ingredients)) errors.push('Products are missing or invalid.');
    const schemaVersion = +(metadata.schemaVersion || candidate?.meta?.schemaVersion || 1);
    if(schemaVersion > PLATEPLAN_SCHEMA_VERSION) errors.push(`This backup uses newer data schema ${schemaVersion}; this PlatePlan supports schema ${PLATEPLAN_SCHEMA_VERSION}.`);
    const duplicateIds = (items, label) => {
      if(!Array.isArray(items)) return;
      const seen = new Set(), duplicates = new Set();
      items.forEach(item => { if(!item?.id) return; if(seen.has(item.id)) duplicates.add(item.id); else seen.add(item.id); });
      if(duplicates.size) errors.push(`${label} contain ${duplicates.size} duplicate ID${duplicates.size===1?'':'s'}.`);
    };
    duplicateIds(candidate?.recipes, 'Recipes');
    duplicateIds(candidate?.ingredients, 'Products');
    duplicateIds(candidate?.ingredientFamilies, 'Ingredients');
    duplicateIds(candidate?.ingredientGroups, 'Sub-types');
    if(candidate?.plan != null && typeof candidate.plan !== 'object') errors.push('The meal plan is invalid.');
    if(!Array.isArray(candidate?.ingredientFamilies)) warnings.push('Ingredient hierarchy will be rebuilt from compatible product data.');
    if(!Array.isArray(candidate?.ingredientGroups)) warnings.push('Sub-types will be rebuilt from compatible product data.');
    if(!candidate?.prefs || typeof candidate.prefs !== 'object') warnings.push('Default preferences will be applied where settings are missing.');
    return { valid:errors.length===0, errors, warnings, schemaVersion, counts:getPlatePlanStateCounts(candidate) };
  }

  let pendingPlatePlanImport = null;

  function ensurePlatePlanImportPreviewModal(){
    let wrap = document.getElementById('plateplan-import-preview-wrap');
    if(wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'plateplan-import-preview-wrap';
    wrap.className = 'modal-wrap';
    wrap.style.zIndex = '470';
    wrap.innerHTML = `<div class="modal" style="max-width:760px">
      <div class="row-between" style="align-items:center;margin-bottom:10px">
        <h3 style="margin:0">Review PlatePlan import</h3>
        <button class="btn sm ghost" onclick="closePlatePlanImportPreview()">Close</button>
      </div>
      <div id="plateplan-import-preview-content"></div>
      <div class="btn-row" style="margin-top:14px;justify-content:flex-end">
        <button class="btn ghost" onclick="closePlatePlanImportPreview()">Cancel</button>
        <button class="btn primary" id="plateplan-import-confirm" onclick="confirmPlatePlanDataImport()">Import data</button>
      </div>
    </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function openPlatePlanImportPreview(imported, metadata = {}){
    const validation = validatePlatePlanImport(imported, metadata);
    pendingPlatePlanImport = { imported, metadata, validation };
    const wrap = ensurePlatePlanImportPreviewModal();
    const c = validation.counts;
    const versionLabel = metadata.version || 'legacy/raw state';
    const differences = validation.valid ? renderBakedStateDifferenceSummary(window.state || {}, imported) : '';
    document.getElementById('plateplan-import-preview-content').innerHTML = `
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Backup version: <strong>${ppEscapeHtml(versionLabel)}</strong> · Schema ${validation.schemaVersion}</div>
      <div class="plan-summary" style="margin-bottom:10px">
        <div class="summary-box"><strong>Recipes</strong><div>${c.recipes}</div></div>
        <div class="summary-box"><strong>Products</strong><div>${c.products}</div></div>
        <div class="summary-box"><strong>Ingredients</strong><div>${c.ingredients}</div></div>
        <div class="summary-box"><strong>Sub-types</strong><div>${c.subTypes}</div></div>
        <div class="summary-box"><strong>Plan</strong><div>${c.planDays} days</div></div>
        <div class="summary-box"><strong>History</strong><div>${c.planHistory}</div></div>
      </div>
      ${validation.errors.length ? `<div class="msg error"><strong>Import blocked</strong><br>${validation.errors.map(ppEscapeHtml).join('<br>')}</div>` : ''}
      ${validation.warnings.length ? `<div class="msg info">${validation.warnings.map(ppEscapeHtml).join('<br>')}</div>` : ''}
      ${validation.valid ? `<div style="font-size:12px;font-weight:700;margin:10px 0 5px">Differences from browser data</div><div style="display:grid;gap:5px;max-height:220px;overflow:auto;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px">${differences}</div>` : ''}`;
    document.getElementById('plateplan-import-confirm').disabled = !validation.valid;
    wrap.classList.add('open');
  }

  function closePlatePlanImportPreview(){
    document.getElementById('plateplan-import-preview-wrap')?.classList.remove('open');
    pendingPlatePlanImport = null;
  }

  function confirmPlatePlanDataImport(){
    if(!pendingPlatePlanImport?.validation?.valid) return;
    const imported = pendingPlatePlanImport.imported;
    const schemaVersion = pendingPlatePlanImport.validation.schemaVersion || 1;
    runWithRecoveryPoint('Before importing PlatePlan data', () => {
      window.state = imported;
      if(!window.state.meta || typeof window.state.meta !== 'object') window.state.meta = {};
      window.state.meta.schemaVersion = +window.state.meta.schemaVersion || schemaVersion;
      if (typeof ensureIngredientGroups === 'function') {
        ensureIngredientGroups(window.state);
      } else if (typeof window.ensureIngredientGroups === 'function') {
        window.ensureIngredientGroups(window.state);
      }
      refreshPlatePlanDerivedState({ persist:true, render:true });
      localStorage.removeItem(BAKED_CANDIDATE_SK);
      closePlatePlanImportPreview();
      loadPrefs();
      showMsg('prefs-data-msg','PlatePlan data imported.','success');
    });
  }

  function importPlatePlanDataBackup(input){
    const file = input?.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(reader.result);
        const imported = parsed.state || parsed;
        openPlatePlanImportPreview(imported, { version:parsed.version || '', schemaVersion:parsed.schemaVersion || imported?.meta?.schemaVersion || 1, exportedAt:parsed.exportedAt || '' });
      }catch(e){
        showMsg('prefs-data-msg','That file does not look like a PlatePlan data backup.','error');
      }finally{
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  // Difference Summary helpers
  function stableStateComparisonValue(value, seen = new WeakSet(), depth = 0){
    if(depth > 20) return null;
    if(value && typeof value === 'object'){
      if (typeof value.nodeType === 'number' || (typeof Element !== 'undefined' && value instanceof Element)) return null;
      if (value === window || (typeof global !== 'undefined' && value === global)) return null;
      if (typeof value.preventDefault === 'function' || (typeof Event !== 'undefined' && value instanceof Event)) return null;
      if (seen.has(value)) return null;
      seen.add(value);
    }
    if(Array.isArray(value)) return value.map(v => stableStateComparisonValue(v, seen, depth + 1));
    if(value && typeof value === 'object'){
      return Object.keys(value).sort().reduce((out, key) => {
        try {
          out[key] = stableStateComparisonValue(value[key], seen, depth + 1);
        } catch (_) {}
        return out;
      }, {});
    }
    return value;
  }

  function stateValuesMatch(a, b){
    const stringify = typeof safeJsonStringify === 'function' ? safeJsonStringify : (typeof window !== 'undefined' && window.safeJsonStringify ? window.safeJsonStringify : (v => JSON.stringify(v)));
    try {
      return stringify(stableStateComparisonValue(a)) === stringify(stableStateComparisonValue(b));
    } catch(_e) {
      return false;
    }
  }

  function describeVersionCollection(browserItems, fileItems, label, nameForItem){
    const browserList = Array.isArray(browserItems) ? browserItems : [];
    const fileList = Array.isArray(fileItems) ? fileItems : [];
    const keyFor = (item, index) => String(item?.id || item?.key || item?.name || index);
    const browserMap = new Map(browserList.map((item, index) => [keyFor(item, index), item]));
    const fileMap = new Map(fileList.map((item, index) => [keyFor(item, index), item]));
    const onlyFile = [], onlyBrowser = [], changed = [];
    fileMap.forEach((item, key) => {
      if(!browserMap.has(key)) onlyFile.push(nameForItem(item));
      else if(!stateValuesMatch(browserMap.get(key), item)) changed.push(nameForItem(item) || nameForItem(browserMap.get(key)));
    });
    browserMap.forEach((item, key) => { if(!fileMap.has(key)) onlyBrowser.push(nameForItem(item)); });
    if(!onlyFile.length && !onlyBrowser.length && !changed.length) return '';
    const brief = (heading, names) => {
      if(!names.length) return '';
      const visible = names.slice(0, 4).map(ppEscapeHtml).join(', ');
      return `${heading} ${names.length}${visible ? ` (${visible}${names.length > 4 ? ` +${names.length - 4} more` : ''})` : ''}`;
    };
    const parts = [brief('only in file:', onlyFile), brief('only in browser:', onlyBrowser), brief('changed:', changed)].filter(Boolean);
    return `<div><strong>${label}:</strong> file ${fileList.length}, browser ${browserList.length}<div style="color:var(--text3);margin-top:2px">${parts.join(' &middot; ')}</div></div>`;
  }

  function countPlannedMeals(plan){
    return Object.values(plan?.slots || {}).reduce((total, day) => total + Object.values(day || {}).filter(Boolean).length, 0);
  }

  function renderBakedStateDifferenceSummary(browserState, fileState){
    const rows = [
      describeVersionCollection(browserState?.recipes, fileState?.recipes, 'Recipes', item => item?.name || 'Unnamed recipe'),
      describeVersionCollection(browserState?.ingredients, fileState?.ingredients, 'Products', item => item?.name || 'Unnamed product'),
      describeVersionCollection(browserState?.ingredientFamilies, fileState?.ingredientFamilies, 'Ingredients', item => item?.name || 'Unnamed ingredient'),
      describeVersionCollection(browserState?.ingredientGroups, fileState?.ingredientGroups, 'Sub-types', item => item?.name || item?.family || 'Unnamed sub-type')
    ].filter(Boolean);
    const browserCats = browserState?.customCats || {};
    const fileCats = fileState?.customCats || {};
    if(!stateValuesMatch(browserCats, fileCats)){
      rows.push(`<div><strong>Categories:</strong> file ${Object.keys(fileCats).length}, browser ${Object.keys(browserCats).length} <span style="color:var(--text3)">(category definitions differ)</span></div>`);
    }
    if(!stateValuesMatch(browserState?.plan || {}, fileState?.plan || {})){
      rows.push(`<div><strong>Current meal plan:</strong> file ${countPlannedMeals(fileState?.plan)} planned meals, browser ${countPlannedMeals(browserState?.plan)} planned meals</div>`);
    }
    if(!stateValuesMatch(browserState?.overrides || {}, fileState?.overrides || {})) rows.push('<div><strong>Shopping/meal overrides:</strong> differ</div>');
    if(!stateValuesMatch(browserState?.prefs || {}, fileState?.prefs || {})) rows.push('<div><strong>Preferences and targets:</strong> differ</div>');
    if(!stateValuesMatch(browserState?.planHistory || [], fileState?.planHistory || [])){
      rows.push(`<div><strong>Plan history:</strong> file ${(fileState?.planHistory || []).length}, browser ${(browserState?.planHistory || []).length}</div>`);
    }
    if(!rows.length) return '<div style="color:var(--text2)">No content differences were found; only JSON formatting or property order differs.</div>';
    return rows.join('');
  }


  // == Data Quality Centre ==
  function dataQualityFingerprint(value){
    const stringify = typeof safeJsonStringify === 'function' ? safeJsonStringify : (typeof window !== 'undefined' && window.safeJsonStringify ? window.safeJsonStringify : (v => JSON.stringify(v ?? null)));
    const text = stringify(value ?? null) || '';
    let hash = 2166136261;
    for(let i = 0; i < text.length; i++){
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function isDataQualityWarningIgnored(key, fingerprint = ''){
    if(!key) return false;
    if(new Set(window.state.ignoredDataQualityWarnings || []).has(key)) return true;
    if(window.state.dataQualityDismissals && typeof window.state.dataQualityDismissals === 'object'){
        if(window.state.dataQualityDismissals[key]){
            if(!fingerprint) return true;
            return window.state.dataQualityDismissals[key] === fingerprint;
        }
    }
    return false;
  }

  async function ignoreDataQualityWarning(key, fingerprint = ''){
    if(!key) return;
    const fp = fingerprint || dataQualityFingerprint(key);
    try {
      await executeDataQualityTransaction('DISMISS_WARNING', { key, fingerprint: fp });
      renderDataQuality();
    } catch(e) {
      console.error('ignoreDataQualityWarning failed:', e);
    }
  }

  function createDataQualityIssue({ entityType, entityId, code, severity = 'gap', title, message, fixButtonHtml = '', fixTarget = null, source = null, legacyKey = '' }){
    const key = `${entityType}:${entityId}:${code}`;
    return { entityType, entityId, code, severity, title, message, fixButtonHtml, fixTarget, key, legacyKey, fingerprint:dataQualityFingerprint(source) };
  }

  function abandonEditorReturn(){
    const context=editorNavigationStack[editorNavigationStack.length-1];
    if(context?.view==='data') editorNavigationStack.pop();
  }

  function finishEditorReturn(defaultView = ''){
    const context=editorNavigationStack.pop();
    if(!context){ if(defaultView) showView(defaultView); return false; }
    showView(context.view||'data');
    requestAnimationFrame(()=>{
      const row=document.querySelector(`[data-dq-key="${CSS.escape(context.issueKey||'')}"]`);
      const host=document.getElementById('dq-missing-list');
      if(row){
        row.closest('details')?.setAttribute('open','');
        row.classList.add('dq-return-highlight');
        row.scrollIntoView({block:'center'});
        if(host) host.insertAdjacentHTML('afterbegin','<div class="msg" style="margin:0 0 10px">Saved. This issue still needs attention.</div>');
      }
      else{
        window.scrollTo({top:Math.max(0,context.scrollY||0),behavior:'instant'});
        if(host) host.insertAdjacentHTML('afterbegin','<div class="msg success" style="margin:0 0 10px">Issue fixed and Data Quality has been refreshed.</div>');
      }
    });
    return true;
  }

  function dataQualityFixButton(issue){
    const supported=['product','ingredient','subtype','recipe','recipe-ingredient'];
    const target=issue.fixTarget||{entityType:issue.entityType,entityId:issue.entityId};
    if(!supported.includes(target.entityType)) return String(issue.fixButtonHtml||'').replace(/class="btn sm ghost"/,'class="btn sm dq-fix-btn"');
    const actionAttr = target.entityType === 'subtype' ? ` data-action="fix-subtype" data-subtype-id="${ppEscapeAttr(target.entityId)}"` : '';
    return `<button class="btn sm dq-fix-btn"${actionAttr} onclick="beginDataQualityFix('${ppEscapeAttr(target.entityType)}','${ppEscapeAttr(target.entityId)}','${ppEscapeAttr(issue.key)}')">Fix</button>`;
  }

  function renderDataQualityIssue(issue, dismissible = false){
    const ignoreButton = dismissible
      ? `<button class="btn sm ghost" onclick="ignoreDataQualityWarning('${ppEscapeAttr(issue.key)}','${ppEscapeAttr(issue.fingerprint)}')">Looks right</button>`
      : '';
    const severityLabel = issue.severity === 'blocker' ? '<span class="tag bad" style="margin-left:6px">Blocks calculation</span>' : '';
    return `<div class="dq-issue-row" data-dq-key="${ppEscapeAttr(issue.key)}">
      <div style="min-width:0"><div style="font-weight:600;font-size:13px">${ppEscapeHtml(issue.title)}${severityLabel}</div><div class="dq-warning">${ppEscapeHtml(issue.message)}</div></div>
      <div class="dq-issue-actions">${ignoreButton}${dataQualityFixButton(issue)}</div>
    </div>`;
  }

  function renderDataQualityWarningRow(title, message, fixButtonHtml = '', ignoreKey = ''){
    const ignoreButton = ignoreKey ? `<button class="btn sm ghost" onclick="ignoreDataQualityWarning('${ppEscapeAttr(ignoreKey)}')">Looks right</button>` : '';
    return `
    <div class="dq-issue-row">
        <div>
            <div style="font-weight:600; font-size:13px;">${ppEscapeHtml(title)}</div>
            <div class="dq-warning">${ppEscapeHtml(message)}</div>
        </div>
        <div class="dq-issue-actions">${ignoreButton}${String(fixButtonHtml||'').replace(/class="btn sm ghost"/,'class="btn sm dq-fix-btn"')}</div>
    </div>`;
  }

  function addPotentialDataQualityWarning(warnings, key, title, message, fixButtonHtml){
    if(!key || isDataQualityWarningIgnored(key)) return;
    warnings.push({ key, title, message, fixButtonHtml });
  }

  function dataQualityRecipeVariants(recipe){
    const rows = [{ label: 'Original', data: recipe, ingredients: recipe.ingredients || [], steps: recipe.steps || recipe.method || [] }];
    if(recipe.enhanced) {
        rows.push({
            label: 'Enhanced',
            data: recipe.enhanced,
            ingredients: recipe.enhanced.ingredients || [],
            steps: recipe.enhanced.method || recipe.enhanced.steps || []
        });
    }
    return rows;
  }

  function dataQualityVariantPerServing(recipe, variant){
    if(variant.data?.nutrition?.perServing) return variant.data.nutrition.perServing;
    if(variant.label === 'Original' && recipe.nutrition?.perServing) return recipe.nutrition.perServing;
    return variant.data || {};
  }

  function collectUnusualNumberWarnings(){
    const warnings = [];
    (window.state?.ingredients || []).forEach(product => {
        const title = product.name || 'Unnamed product';
        const fix = `<button class="btn sm dq-fix-btn" onclick="editIng('${ppEscapeAttr(product.id)}')">Fix</button>`;
        const addProductWarning = (field, value, message) => {
            const rounded = Math.round((+value || 0) * 10) / 10;
            addPotentialDataQualityWarning(warnings, `product-${product.id}-${field}-${rounded}`, title, message, fix);
        };
        if((+product.cal || 0) > 900) addProductWarning('cal', product.cal, `Calories look unusually high: ${product.cal} kcal per 100g/ml.`);
        ['prot','fat','carb','fibre'].forEach(field => {
            const value = +product[field] || 0;
            if(value > 100) addProductWarning(field, value, `${field === 'prot' ? 'Protein' : field.charAt(0).toUpperCase() + field.slice(1)} looks unusually high: ${value}g per 100g/ml.`);
        });
        if((+product.price || 0) > 25) addProductWarning('price', product.price, `Price looks unusually high: £${product.price}.`);
        if((+product.packSize || 0) > 5000) addProductWarning('packSize', product.packSize, `Pack size looks unusually large: ${product.packSize}${product.packUnit || ''}.`);
        if((+product.itemWeight || 0) > 1000) addProductWarning('itemWeight', product.itemWeight, `Weight of 1 item looks unusually large: ${product.itemWeight}${product.itemWeightUnit || 'g'}.`);
        if((+product.drainedWeight || 0) && (+product.packSize || 0) && product.drainedWeight > product.packSize && (product.packUnit || 'g') === (product.drainedWeightUnit || 'g')) {
            addProductWarning('drainedWeight', product.drainedWeight, `Drained weight (${product.drainedWeight}${product.drainedWeightUnit || 'g'}) is larger than pack size (${product.packSize}${product.packUnit || 'g'}).`);
        }
    });

    (window.state?.recipes || []).forEach(recipe => {
        const mealTypes = recipe.types || [];
        const isMainMeal = mealTypes.some(t => ['lunch','dinner'].includes(t));
        dataQualityRecipeVariants(recipe).forEach(variant => {
            const suffix = variant.label === 'Enhanced' ? ' enhanced' : ' original';
            const title = `${recipe.name || 'Untitled recipe'} (${variant.label})`;
            const fix = `<button class="btn sm dq-fix-btn" onclick="editRecipeModalView('${ppEscapeAttr(recipe.id)}')">Fix</button>`;
            const ps = dataQualityVariantPerServing(recipe, variant);
            const cal = +ps.cal || 0;
            const prot = +ps.prot || 0;
            if(isMainMeal && cal > 1400) addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-cal-${Math.round(cal)}`, title, `Calories look unusually high: ${Math.round(cal)} kcal per serving.`, fix);
            if(isMainMeal && cal > 0 && cal < 150) addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-cal-low-${Math.round(cal)}`, title, `Calories look unusually low: ${Math.round(cal)} kcal per serving.`, fix);
            if(prot > 120) addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-prot-${Math.round(prot)}`, title, `Protein looks unusually high: ${Math.round(prot)}g per serving.`, fix);
            (variant.ingredients || []).forEach((ing, idx) => {
                const unit = String(ing.unit || '').toLowerCase();
                const qty = +ing.qty || +ing.grams || 0;
                const label = ing.name || ing.raw || `Ingredient ${idx + 1}`;
                if(['g','ml'].includes(unit) && qty > 3000) {
                    addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-ing-${idx}-large-${Math.round(qty)}`, title, `${label} quantity looks unusually large: ${qty}${unit}.`, fix);
                }
                if(unit === 'qty' && qty > 20) {
                    addPotentialDataQualityWarning(warnings, `recipe-${recipe.id}-${variant.label}-ing-${idx}-qty-${Math.round(qty)}`, title, `${label} quantity looks unusually large: ${qty} items.`, fix);
                }
            });
        });
    });
    return warnings;
  }

  function recipeVariantHasOilIngredient(ingredients){
    const resolveFamily = typeof getGroupIngredientFamily === 'function'
      ? getGroupIngredientFamily
      : (typeof window !== 'undefined' && typeof window.getGroupIngredientFamily === 'function'
          ? window.getGroupIngredientFamily
          : (() => null));
    const resolveProduct = typeof resolveProductForIngredient === 'function'
      ? resolveProductForIngredient
      : (typeof window !== 'undefined' && typeof window.resolveProductForIngredient === 'function'
          ? window.resolveProductForIngredient
          : (() => ({ product: null, group: null })));
    return (ingredients || []).some(ing => {
        const resolved = resolveProduct(ing) || {};
        const family = resolved.group ? resolveFamily(resolved.group) : null;
        const text = [ing.raw, ing.name, resolved.group?.name, ...(resolved.group?.aliases || []), family?.name, ...(family?.aliases || []), resolved.product?.name].filter(Boolean).join(' ').toLowerCase();
        return /\b(olive|vegetable|sesame|rapeseed|sunflower|avocado|coconut)?\s*oil\b/.test(text);
    });
  }

  function recipeVariantMethodSuggestsOil(steps){
    const text = (steps || []).join(' ').toLowerCase();
    return /\b(oil|drizzle|fry|pan[-\s]?fry|sauté|saute|roast|bake|air[-\s]?fry)\b/.test(text);
  }

  function collectMissingOilWarnings(){
    const warnings = [];
    (window.state?.recipes || []).forEach(recipe => {
        const mealTypes = recipe.types || [];
        if(!mealTypes.some(t => ['lunch','dinner'].includes(t))) return;
        dataQualityRecipeVariants(recipe).forEach(variant => {
            if(recipeVariantHasOilIngredient(variant.ingredients)) return;
            if(!recipeVariantMethodSuggestsOil(variant.steps)) return;
            const title = `${recipe.name || 'Untitled recipe'} (${variant.label})`;
            const key = `recipe-${recipe.id}-${variant.label}-missing-oil`;
            const fix = `<button class="btn sm dq-fix-btn" onclick="editRecipeModalView('${ppEscapeAttr(recipe.id)}')">Fix</button>`;
            addPotentialDataQualityWarning(warnings, key, title, 'Method suggests oil or frying, but no oil is listed in the ingredients.', fix);
        });
    });
    return warnings;
  }

  function collectDeterministicDataQualityIssues(){
    if (typeof ensureIngredientGroups === 'function') {
      ensureIngredientGroups();
    } else if (typeof window.ensureIngredientGroups === 'function') {
      window.ensureIngredientGroups();
    }
    const issues = [];
    const add = input => issues.push(createDataQualityIssue(input));
    const extremeCostProducts = new Map();

    const resolveGroup = typeof getIngredientGroup === 'function' ? getIngredientGroup : (typeof window !== 'undefined' && window.getIngredientGroup ? window.getIngredientGroup : (() => null));
    const resolveFamily = typeof getGroupIngredientFamily === 'function' ? getGroupIngredientFamily : (typeof window !== 'undefined' && window.getGroupIngredientFamily ? window.getGroupIngredientFamily : (() => null));
    const resolveFamDirect = typeof getIngredientFamily === 'function' ? getIngredientFamily : (typeof window !== 'undefined' && window.getIngredientFamily ? window.getIngredientFamily : (() => null));
    const resolveFamilyGroups = typeof getFamilyGroups === 'function' ? getFamilyGroups : (typeof window !== 'undefined' && window.getFamilyGroups ? window.getFamilyGroups : (() => []));
    const resolveGroupProds = typeof getGroupProducts === 'function' ? getGroupProducts : (typeof window !== 'undefined' && window.getGroupProducts ? window.getGroupProducts : (() => []));
    const resolveHierarchyText = typeof getGroupHierarchyText === 'function' ? getGroupHierarchyText : (typeof window !== 'undefined' && window.getGroupHierarchyText ? window.getGroupHierarchyText : (g => g?.name || ''));
    const resolveProduct = typeof resolveProductForIngredient === 'function' ? resolveProductForIngredient : (typeof window !== 'undefined' && window.resolveProductForIngredient ? window.resolveProductForIngredient : (() => ({ product: null, group: null })));
    const checkItemWeight = typeof needsItemWeightForQtyIngredient === 'function' ? needsItemWeightForQtyIngredient : (typeof window !== 'undefined' && window.needsItemWeightForQtyIngredient ? window.needsItemWeightForQtyIngredient : (() => false));
    const checkMappingWarning = typeof getIngredientMappingWarning === 'function' ? getIngredientMappingWarning : (typeof window !== 'undefined' && window.getIngredientMappingWarning ? window.getIngredientMappingWarning : (() => null));
    const r1 = typeof round1 === 'function' ? round1 : (typeof window !== 'undefined' && window.round1 ? window.round1 : (v => Math.round((+v || 0) * 10) / 10));
    const normAlias = typeof normaliseAliasText === 'function' ? normaliseAliasText : (typeof window !== 'undefined' && window.normaliseAliasText ? window.normaliseAliasText : (t => String(t || '').trim()));
    const resolveProductById = typeof getProduct === 'function' ? getProduct : (typeof window !== 'undefined' && window.getProduct ? window.getProduct : (() => null));
    const resolveGrams = typeof getEffectiveIngredientGrams === 'function' ? getEffectiveIngredientGrams : (typeof window !== 'undefined' && window.getEffectiveIngredientGrams ? window.getEffectiveIngredientGrams : (() => 0));
    const resolveUsablePack = typeof getProductUsablePackAmount === 'function' ? getProductUsablePackAmount : (typeof window !== 'undefined' && window.getProductUsablePackAmount ? window.getProductUsablePackAmount : (p => +(p?.packSize || 100)));
    const resolveGrossPack = typeof getProductGrossPackAmount === 'function' ? getProductGrossPackAmount : (typeof window !== 'undefined' && window.getProductGrossPackAmount ? window.getProductGrossPackAmount : (p => +(p?.packSize || 100)));
    const resolveItemAmount = typeof getProductItemAmount === 'function' ? getProductItemAmount : (typeof window !== 'undefined' && window.getProductItemAmount ? window.getProductItemAmount : (p => +(p?.itemWeight || 0)));
    const resolveDerivedItemCount = typeof getProductDerivedItemCount === 'function' ? getProductDerivedItemCount : (typeof window !== 'undefined' && window.getProductDerivedItemCount ? window.getProductDerivedItemCount : (() => 0));

    (window.state?.ingredients || []).forEach(product => {
        const fix = `<button class="btn sm dq-fix-btn" onclick="editIng('${ppEscapeAttr(product.id)}')">Fix</button>`;
        const isNutritionUsable = typeof hasUsableIngredientNutrition === 'function'
          ? hasUsableIngredientNutrition(product)
          : (typeof window !== 'undefined' && typeof window.hasUsableIngredientNutrition === 'function'
              ? window.hasUsableIngredientNutrition(product)
              : true);
        if(!isNutritionUsable) add({entityType:'product',entityId:product.id,code:'unusable-nutrition',severity:'blocker',title:product.name || 'Unnamed product',message:'No usable mapped nutrition is available.',fixButtonHtml:fix,source:[product.cal,product.prot,product.carb,product.fat,product.fibre,product.name]});
        if(!(+(product.price) > 0)) add({entityType:'product',entityId:product.id,code:'missing-price',title:product.name || 'Unnamed product',message:'Price is missing.',fixButtonHtml:fix,source:product.price});
        if(!(+(product.packSize) > 0) || !product.packUnit) add({entityType:'product',entityId:product.id,code:'missing-pack',title:product.name || 'Unnamed product',message:'Pack size or unit is missing.',fixButtonHtml:fix,source:[product.packSize,product.packUnit]});
        if(!product.storage) add({entityType:'product',entityId:product.id,code:'missing-storage',title:product.name || 'Unnamed product',message:'Storage location is missing.',fixButtonHtml:fix,source:product.storage});
        const linkedGroup = product.groupId ? resolveGroup(product.groupId) : null;
        let parentFamily = linkedGroup ? resolveFamily(linkedGroup) : null;
        if(!parentFamily && product.ingredientId) parentFamily = resolveFamDirect(product.ingredientId);
        if(!parentFamily && product.cat) parentFamily = resolveFamDirect(product.cat);
        const familySubGroups = parentFamily ? resolveFamilyGroups(parentFamily.id) : [];
        const familyHasNoSubtypes = !!parentFamily && familySubGroups.length === 0;
        const isCompliantWithoutSubtype = familyHasNoSubtypes && (product.subTypeId === null || product.subTypeId === 'default' || product.groupId === 'default' || !product.groupId);

        if(!linkedGroup && !isCompliantWithoutSubtype) add({entityType:'product',entityId:product.id,code:'missing-hierarchy-link',title:product.name || 'Unnamed product',message:'Product is not linked to a valid ingredient sub-type.',fixButtonHtml:fix,source:[product.groupId,product.cat]});
        const packUnit=String(product.packUnit||'').toLowerCase();
        const itemWeightUnit=String(product.itemWeightUnit||'g').toLowerCase();
        const drainedUnit=String(product.drainedWeightUnit||packUnit||'g').toLowerCase();
        const gross=resolveGrossPack(product),usable=resolveUsablePack(product),itemAmount=resolveItemAmount(product),derived=resolveDerivedItemCount(product);
        if(+product.drainedWeight>0&&packUnit!=='qty'&&drainedUnit!==packUnit){
            add({entityType:'product',entityId:product.id,code:'incompatible-pack-units',title:product.name||'Unnamed product',message:`Pack size uses ${packUnit}, but drained weight uses ${drainedUnit}. Use matching weight or volume units.`,fixButtonHtml:fix,source:[product.packSize,packUnit,product.drainedWeight,drainedUnit]});
        }
        if(+product.itemWeight>0&&packUnit!=='qty'&&itemWeightUnit!==packUnit){
            add({entityType:'product',entityId:product.id,code:'incompatible-item-unit',title:product.name||'Unnamed product',message:`Pack size uses ${packUnit}, but one item uses ${itemWeightUnit}. Use matching weight or volume units.`,fixButtonHtml:fix,source:[product.packSize,packUnit,product.itemWeight,itemWeightUnit]});
        }
        if(+product.drainedWeight>0&&gross>0&&usable>gross){
            add({entityType:'product',entityId:product.id,code:'drained-over-gross',title:product.name||'Unnamed product',message:'Drained usable content is larger than the gross pack size.',fixButtonHtml:fix,source:[gross,usable,packUnit,drainedUnit]});
        }
        if(itemAmount>0&&usable>0&&itemAmount>usable){
            add({entityType:'product',entityId:product.id,code:'item-over-usable-pack',title:product.name||'Unnamed product',message:'One item is heavier than the usable contents of the entire pack.',fixButtonHtml:fix,source:[itemAmount,usable,itemWeightUnit]});
        }
        if(derived>1.05&&Math.abs(derived-Math.round(derived))>0.12){
            add({entityType:'product',entityId:product.id,code:'implausible-derived-count',title:product.name||'Unnamed product',message:`The usable pack amount implies ${r1(derived)} items. Check total, drained and item weights.`,fixButtonHtml:fix,source:[gross,usable,itemAmount,derived]});
        }
        if(['g','ml'].includes(packUnit) && packUnit===itemWeightUnit && +product.itemWeight>0 && +product.packSize>0 && +product.itemWeight>+product.packSize){
            add({entityType:'product',entityId:product.id,code:'item-heavier-than-pack',title:product.name || 'Unnamed product',message:`Pack size (${product.packSize}${packUnit}) is smaller than the recorded weight of one item (${product.itemWeight}${itemWeightUnit}). This can produce extreme recipe costs.`,fixButtonHtml:fix,source:[product.packSize,packUnit,product.itemWeight,itemWeightUnit,product.price]});
        }
        if(packUnit==='qty' && !(+product.itemWeight>0)){
            add({entityType:'product',entityId:product.id,code:'count-pack-missing-item-weight',title:product.name || 'Unnamed product',message:'This is a counted pack but the weight of one item is missing, so nutrition and consumed cost cannot be calculated reliably.',fixButtonHtml:fix,source:[product.packSize,product.packUnit,product.itemWeight,product.itemWeightUnit]});
        }
        if(packUnit==='qty' && +product.itemCount>0 && +product.packSize>0 && +product.itemCount!==+product.packSize){
            add({entityType:'product',entityId:product.id,code:'count-pack-mismatch',title:product.name || 'Unnamed product',message:`Pack size says ${product.packSize} items but item count says ${product.itemCount}. Confirm the correct count.`,fixButtonHtml:fix,source:[product.packSize,product.packUnit,product.itemCount,product.itemWeight]});
        }
    });

    (window.state?.recipes || []).forEach(recipe => {
        const fix = `<button class="btn sm dq-fix-btn" onclick="editRecipeModalView('${ppEscapeAttr(recipe.id)}')">Fix</button>`;
        dataQualityRecipeVariants(recipe).forEach(variant => {
            const variantId = variant.label.toLowerCase();
            const title = `${recipe.name || 'Untitled recipe'} · ${variant.label}`;
            if(!variant.ingredients.length) add({entityType:'recipe',entityId:`${recipe.id}:${variantId}`,code:'no-ingredients',severity:'blocker',title,message:'Recipe has no ingredients, so nutrition is zero.',fixButtonHtml:fix,source:variant.ingredients});
            if(!(variant.steps || []).filter(Boolean).length) add({entityType:'recipe',entityId:`${recipe.id}:${variantId}`,code:'missing-method',title,message:'Method is missing.',fixButtonHtml:fix,source:variant.steps});
            (variant.ingredients || []).forEach((ingredient, index) => {
                if(!ingredient || typeof ingredient !== 'object' || ingredient.excludeNutrition) return;
                const qty = +(ingredient.qty ?? ingredient.grams ?? 0);
                if(!(qty > 0)) return;
                const resolved = resolveProduct(ingredient, {}) || {};
                const entityId = `${recipe.id}:${variantId}:${index}`;
                const ingredientName = ingredient.name || ingredient.raw || `Ingredient ${index + 1}`;
                if(!resolved.product){
                    const unitStr = String(ingredient.unit || '').toLowerCase().trim();
                    const isCountedPantry = ['qty','count','item','whole','piece','pieces','small','medium','large','pack','pouch','unit'].includes(unitStr) || (!unitStr && +(ingredient.qty || 0) > 0);
                    const boundIngId = ingredient.ingredientId || ingredient.familyId || resolved.group?.ingredientId || (ingredient.bankId && resolveFamDirect(ingredient.bankId)) || (ingredientName && (window.state.ingredientFamilies || []).some(f => normAlias(f.name) === normAlias(ingredientName) || normAlias(f.name).includes(normAlias(ingredientName))));
                    if(boundIngId || (isCountedPantry && (ingredient.ingredientId || ingredient.bankId || resolved.groupId))){
                        // Counted pantry item bound directly to ingredientId when productId is null satisfies audit completeness
                        return;
                    }
                    const unmappedFix = `<button class="btn sm dq-fix-btn" onclick="openProductMappingModal('${ppEscapeAttr(entityId)}', 'recipe-ingredient:${ppEscapeAttr(entityId)}:unmapped-counted-ingredient')">Fix</button>`;
                    add({entityType:'recipe-ingredient',entityId,code:'unmapped-counted-ingredient',severity:'blocker',title,message:`${ingredientName} has a counted quantity but no mapped product.`,fixButtonHtml:unmappedFix,fixTarget:{entityType:'recipe-ingredient',entityId},source:[ingredient.name,ingredient.raw,ingredient.qty,ingredient.unit,ingredient.groupId,ingredient.bankId]});
                    return;
                }
                if(checkItemWeight(ingredient, resolved.product)) add({entityType:'recipe-ingredient',entityId,code:'missing-item-weight',severity:'blocker',title,message:`${ingredientName} is counted as items, but its product has no item weight.`,fixButtonHtml:fix,fixTarget:{entityType:'product',entityId:resolved.product.id},source:[ingredient.qty,ingredient.unit,resolved.product.id,resolved.product.itemWeight,resolved.product.itemWeightUnit]});
                const mappingWarning = checkMappingWarning(ingredient, resolved);
                if(mappingWarning) add({entityType:'recipe-ingredient',entityId,code:'mapping-mismatch',title,message:mappingWarning,fixButtonHtml:fix,source:[ingredient.name,ingredient.groupId,ingredient.bankId,resolved.group?.id,resolved.product?.id]});
            });

            const serves=+(variant.data?.serves||recipe.serves)||1;
            const productCosts=new Map();
            (variant.ingredients||[]).forEach(ingredient=>{
                if(!ingredient||typeof ingredient!=='object')return;
                const resolved=resolveProduct(ingredient,{}) || {};
                const product=resolved.product;
                if(!product?.price||!product.packSize)return;
                const grams=resolveGrams(ingredient,product);
                const packGrams=resolveUsablePack(product);
                if(!(grams>0&&packGrams>0))return;
                productCosts.set(product.id,(productCosts.get(product.id)||0)+((+product.price/packGrams)*grams/serves));
            });
            const perServing=[...productCosts.values()].reduce((sum,value)=>sum+value,0);
            if(perServing>15){
                productCosts.forEach((contribution,productId)=>{
                    if(contribution<=10)return;
                    const product=resolveProductById(productId);if(!product)return;
                    const current=extremeCostProducts.get(productId)||{product,recipes:new Map(),maxContribution:0};
                    current.recipes.set(`${recipe.id}:${variantId}`,`${recipe.name || 'Untitled recipe'} · ${variant.label}`);
                    current.maxContribution=Math.max(current.maxContribution,contribution);
                    extremeCostProducts.set(productId,current);
                });
            }
        });
    });

    extremeCostProducts.forEach(({product,recipes,maxContribution})=>{
        const recipeNames=[...recipes.values()];
        add({entityType:'product',entityId:product.id,code:'extreme-recipe-cost',title:product.name || 'Unnamed product',message:`This product contributes up to £${maxContribution.toFixed(2)} per serving in ${recipeNames.join(', ')}. Check its price, pack unit, pack size and item weight.`,fixTarget:{entityType:'product',entityId:product.id},source:[product.price,product.packSize,product.packUnit,product.itemWeight,product.itemWeightUnit,recipeNames,maxContribution.toFixed(2)]});
    });

    (window.state?.ingredientFamilies || []).forEach(family => {
        const groups = resolveFamilyGroups(family.id);
        const fix = `<button class="btn sm dq-fix-btn" onclick="openIngredientFamilyDetailsModal('${ppEscapeAttr(family.id)}')">Fix</button>`;
        if(!groups.length) add({entityType:'ingredient',entityId:family.id,code:'no-subtypes',title:family.name || 'Unnamed ingredient',message:'Ingredient has no sub-types.',fixButtonHtml:fix,source:family.typeIds});
        if(!family.cat || family.cat === 'other') add({entityType:'ingredient',entityId:family.id,code:'missing-category',title:family.name || 'Unnamed ingredient',message:'Ingredient has no sorted category.',fixButtonHtml:fix,source:family.cat});
    });
    (window.state?.ingredientGroups || []).forEach(group => {
        const products = resolveGroupProds(group.id);
        const fix = `<button class="btn sm dq-fix-btn" data-action="fix-subtype" data-subtype-id="${ppEscapeAttr(group.id)}" onclick="fixSubtypeDataQuality('${ppEscapeAttr(group.id)}')">Fix</button>`;
        const title = resolveHierarchyText(group);
        if(!group.ingredientId || !resolveFamDirect(group.ingredientId)) add({entityType:'subtype',entityId:group.id,code:'missing-ingredient-link',title,message:'Sub-type is not linked to a valid ingredient.',fixButtonHtml:fix,source:group.ingredientId});
        if(!products.length) add({entityType:'subtype',entityId:group.id,code:'no-products',title,message:'Sub-type has no linked products.',fixButtonHtml:fix,source:products.map(p => p.id)});
        if(products.length && !resolveProduct({groupId:group.id}).product) add({entityType:'subtype',entityId:group.id,code:'no-valid-default',title,message:'Sub-type has products but no usable default.',fixButtonHtml:fix,source:[group.defaultProductId,group.manualDefaultProductId,products.map(p => [p.id,p.cal,p.prot])]});
        if(!group.cat || group.cat === 'other') add({entityType:'subtype',entityId:group.id,code:'missing-category',title,message:'Sub-type has no sorted category.',fixButtonHtml:fix,source:group.cat});
    });
    return issues;
  }

  function dataQualityAdvisoryFromLegacy(warning){
    let entityType = 'advisory';
    let entityId = warning.key;
    const product = (window.state?.ingredients || []).find(item => warning.key.startsWith(`product-${item.id}-`));
    const recipe = (window.state?.recipes || []).find(item => warning.key.startsWith(`recipe-${item.id}-`));
    if(product){ entityType = 'product'; entityId = product.id; }
    if(recipe){ entityType = 'recipe'; entityId = recipe.id; }
    const code = warning.key.replace(entityType === 'product' ? `product-${entityId}-` : entityType === 'recipe' ? `recipe-${entityId}-` : '', '').replace(/-[-\d.]+$/, '') || 'advisory';
    return createDataQualityIssue({entityType,entityId,code:`advisory-${code}`,severity:'advisory',title:warning.title,message:warning.message,fixButtonHtml:warning.fixButtonHtml,source:warning.message,legacyKey:warning.key});
  }

  function collectDuplicateDataQualityAdvisories(){
    const groups = {};
    (window.state?.ingredients || []).forEach(product => {
        const norm = String(product.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if(!norm) return;
        (groups[norm] ||= []).push(product);
    });
    const ignoredLegacy = new Set(window.state?.ignoredGroupMergeSuggestions || []);
    return Object.entries(groups).filter(([,products]) => products.length > 1).map(([norm,products]) => {
        const legacyKey = `product-dupe-${norm}`;
        if(ignoredLegacy.has(legacyKey)) return null;
        const actions = products.map(product => `<div class="row-between" style="gap:8px;margin-top:5px"><span style="font-size:12px">${ppEscapeHtml(product.name)} <span style="color:var(--text3)">(${ppEscapeHtml(product.brand || 'No brand')})</span></span><button class="btn sm" onclick="openMergeModal('${ppEscapeAttr(product.id)}','${ppEscapeAttr(norm)}')">Keep & merge others</button></div>`).join('');
        return createDataQualityIssue({entityType:'product-set',entityId:norm,code:'possible-duplicate',severity:'advisory',title:'Possible duplicate products',message:products.map(p => p.name).join(', '),fixButtonHtml:`<details style="min-width:190px"><summary class="btn sm ghost">Review</summary>${actions}</details>`,source:products.map(p => [p.id,p.name,p.brand]).sort(),legacyKey});
    }).filter(Boolean);
  }

  let isAuditing = false;
  function renderDataQuality() {
    const missingTarget = document.getElementById('dq-missing-list');
    const advisoryTarget = document.getElementById('dq-duplicate-list');
    if (!window.state?.isCloudHydrated) {
        const skeletonHtml = `<div class="ios-activity-skeleton">
          <div class="spinner"></div>
          <span class="ios-activity-skeleton-text">Syncing live cloud data before audit...</span>
        </div>`;
        if (missingTarget) missingTarget.innerHTML = skeletonHtml;
        if (advisoryTarget) advisoryTarget.innerHTML = '';
        return;
    }
    if (isAuditing) return;
    isAuditing = true;
    const spinnerHtml = `<div class="dq-audit-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 16px;gap:12px;color:var(--text2)">
      <div style="width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--action-fill,#0969da);border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <span style="font-size:13px;font-weight:600">Running data audit...</span>
    </div>`;
    if (missingTarget) missingTarget.innerHTML = spinnerHtml;
    if (advisoryTarget) advisoryTarget.innerHTML = '';

    requestAnimationFrame(() => {
        setTimeout(() => {
            try {
                const issues = collectDeterministicDataQualityIssues();
                const blockers = issues.filter(issue => issue.severity === 'blocker');
                const gaps = issues.filter(issue => issue.severity === 'gap');
                const section = (title, rows, emptyText, open = true) => `<details ${open ? 'open' : ''} style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700;font-size:13px;margin-bottom:4px">${ppEscapeHtml(title)} (${rows.length})</summary>${rows.length ? rows.map(issue => renderDataQualityIssue(issue)).join('') : `<div class="msg success" style="margin:6px 0 0">${ppEscapeHtml(emptyText)}</div>`}</details>`;
                if(missingTarget) missingTarget.innerHTML = section('Calculation blockers', blockers, 'No calculation blockers detected.') + section('Other data gaps', gaps, 'No other data gaps detected.', false);

                const advisories = [...collectUnusualNumberWarnings(), ...collectMissingOilWarnings()].map(dataQualityAdvisoryFromLegacy).concat(collectDuplicateDataQualityAdvisories()).filter(issue => !isDataQualityWarningIgnored(issue.key, issue.fingerprint) && !(issue.legacyKey && isDataQualityWarningIgnored(issue.legacyKey)));
                if(advisoryTarget) advisoryTarget.innerHTML = `<details><summary style="cursor:pointer;font-weight:700;font-size:13px">Heuristic advisories (${advisories.length})</summary><div style="margin-top:6px">${advisories.length ? advisories.map(issue => renderDataQualityIssue(issue, true)).join('') : '<div class="msg success" style="margin:0">No active advisories.</div>'}</div></details>`;

                updateDataQualityBadge(blockers.length + gaps.length + advisories.length, blockers.length, gaps.length);

                const catBox = document.getElementById('dq-cat-list')?.closest('.card');
                if(catBox) catBox.style.display = 'none';
            } finally {
                isAuditing = false;
            }
        }, 40);
    });
  }

  function updateDataQualityBadge(count = 0, blockers = 0, gaps = 0){
    document.querySelectorAll('[data-view="data"]').forEach(el => {
      let badge = el.querySelector('.dq-nav-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'dq-nav-badge';
          badge.style.cssText = 'margin-left:6px;font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
          el.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.title = `${blockers} blockers, ${gaps} gaps, ${count} total issues`;
        if (blockers > 0) {
          badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
          badge.style.color = 'var(--red, #dc2626)';
        } else {
          badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
          badge.style.color = 'var(--amber, #d97706)';
        }
      } else if (badge) {
        badge.remove();
      }
    });

    document.querySelectorAll('[data-pp-click*="mobileMoreView(\'data\')"], [onclick*="mobileMoreView(\'data\')"]').forEach(el => {
      let badge = el.querySelector('.dq-nav-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'dq-nav-badge';
          badge.style.cssText = 'margin-left:auto;margin-right:6px;background:var(--amber-bg, rgba(245,158,11,0.15));color:var(--amber,#d97706);font-size:11px;font-weight:700;padding:2px 6px;border-radius:10px;line-height:1;display:inline-block;';
          const arrow = el.querySelector('[aria-hidden="true"]');
          if (arrow) el.insertBefore(badge, arrow);
          else el.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        if (blockers > 0) {
          badge.style.background = 'var(--red-bg, rgba(239,68,68,0.15))';
          badge.style.color = 'var(--red, #dc2626)';
        } else {
          badge.style.background = 'var(--amber-bg, rgba(245,158,11,0.15))';
          badge.style.color = 'var(--amber, #d97706)';
        }
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function runDataQualityAudits(shouldRender = false){
    try {
      const issues = collectDeterministicDataQualityIssues();
      const advisories = [...collectUnusualNumberWarnings(), ...collectMissingOilWarnings()]
        .map(dataQualityAdvisoryFromLegacy)
        .concat(collectDuplicateDataQualityAdvisories())
        .filter(issue => !isDataQualityWarningIgnored(issue.key, issue.fingerprint) && !(issue.legacyKey && isDataQualityWarningIgnored(issue.legacyKey)));

      const blockers = issues.filter(issue => issue.severity === 'blocker');
      const gaps = issues.filter(issue => issue.severity === 'gap');
      const totalCount = issues.length + advisories.length;

      updateDataQualityBadge(totalCount, blockers.length, gaps.length);

      if (shouldRender || document.getElementById('view-data')?.classList.contains('active')) {
        renderDataQuality();
      }

      window.dispatchEvent(new CustomEvent('plateplan:data-quality-updated', {
        detail: { count: totalCount, blockers: blockers.length, gaps: gaps.length, issues, advisories }
      }));

      return { issues, advisories, totalCount, blockerCount: blockers.length, gapCount: gaps.length };
    } catch(e) {
      console.warn('runDataQualityAudits error:', e);
      return { issues: [], advisories: [], totalCount: 0, blockerCount: 0, gapCount: 0 };
    }
  }

  // == Global Reset & App Info Modals ==
  function resetAllData() {
    openAppConfirmModal('Reset all PlatePlan data?', 'This will permanently delete all local recipes, ingredients, products, meal plans, history, and preferences. This action cannot be undone.', 'Reset everything', async () => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        if (typeof window.logout === 'function') {
          window.logout();
        } else {
          window.location.reload();
        }
      } catch(e) {
        console.error('Reset all data failed:', e);
      }
    });
  }

  // == Global Bindings ==
  window.PlatePlanSettings = {
    loadPrefs,
    savePrefs,
    ensureExclusionPrefsUI,
    handleExcludeSearch,
    addExclusion,
    removeExclusion,
    renderExclusionPreview,
    viewExclusions,
    calcBudgets,
    downloadPlatePlanDataBackup,
    validatePlatePlanImport,
    openPlatePlanImportPreview,
    closePlatePlanImportPreview,
    confirmPlatePlanDataImport,
    importPlatePlanDataBackup,
    getPlatePlanBackupPayload,
    runDataQualityAudits,
    renderDataQuality,
    updateDataQualityBadge,
    resetAllData,
    openAppInfoModal: (...args) => (window.openAppInfoModal || (typeof openAppInfoModal !== 'undefined' ? openAppInfoModal : () => {}))(...args)
  };

  // Legacy bindings for backward compatibility with inline HTML and other handlers
  window.loadPrefs = loadPrefs;
  window.savePrefs = savePrefs;
  window.calcBudgets = calcBudgets;
  window.handleExcludeSearch = handleExcludeSearch;
  window.addExclusion = addExclusion;
  window.removeExclusion = removeExclusion;
  window.renderExclusionPreview = renderExclusionPreview;
  window.viewExclusions = viewExclusions;
  window.exportDataJSON = downloadPlatePlanDataBackup; // mapped as legacy backup
  window.importDataJSON = importPlatePlanDataBackup; // mapped as legacy import
  window.downloadPlatePlanDataBackup = downloadPlatePlanDataBackup;
  window.importPlatePlanDataBackup = importPlatePlanDataBackup;
  window.confirmPlatePlanDataImport = confirmPlatePlanDataImport;
  window.openPlatePlanImportPreview = openPlatePlanImportPreview;
  window.closePlatePlanImportPreview = closePlatePlanImportPreview;
  window.renderDataQuality = renderDataQuality;
  window.runDataQualityAudits = runDataQualityAudits;
  window.updateDataQualityBadge = updateDataQualityBadge;
  window.resetAllData = resetAllData;
})();
