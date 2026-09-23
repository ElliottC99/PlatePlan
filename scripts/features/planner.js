/**
 * scripts/features/planner.js
 * PlatePlan Meal Planner & Calendar History Engine
 * Classic global namespace script.
 */

(() => {
function enhancePlanTrafficControls(){
  const symbols={green:'✓',amber:'–',red:'!'};
  const names={green:'Green recipes',amber:'Amber recipes',red:'Red recipes'};
  document.querySelectorAll('.traffic-pill').forEach(label=>{
    const input=label.querySelector('input');
    if(!input)return;
    const value=['green','amber','red'].find(status=>label.classList.contains(status))
      || (['green','amber','red'].includes(input.value)?input.value:'green');
    input.value=value;
    input.setAttribute('aria-label',names[value]||value);
    input.setAttribute('title',names[value]||value);
    input.tabIndex=-1;
    input.disabled=true;
    input.setAttribute('aria-hidden','true');
    const personPrefix=input.name==='plan-traffic-c'?'c':'e';
    label.setAttribute('role','button');
    label.setAttribute('tabindex','0');
    label.setAttribute('aria-label',`${names[value]||value} for ${personPrefix==='c'?'Chloe':'Elliott'}`);
    label.setAttribute('aria-pressed',input.checked?'true':'false');
    label.onclick=event=>{event.preventDefault();togglePlanTrafficStatus(personPrefix,value);};
    label.onkeydown=event=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      event.preventDefault();
      togglePlanTrafficStatus(personPrefix,value);
    };
    [...label.childNodes].forEach(node=>{
      const isSymbol=node.nodeType===1&&node.classList.contains('traffic-symbol');
      if(node!==input&&!isSymbol)node.remove();
    });
    let symbol=label.querySelector('.traffic-symbol');
    if(!symbol){
      symbol=document.createElement('span');
      symbol.className='traffic-symbol';
      label.appendChild(symbol);
    }
    symbol.setAttribute('aria-hidden','true');
    symbol.textContent=symbols[value];
  });
}

function updatePlannerCompactHeader(){
  const shell=document.getElementById('planner-compact-shell');
  if(!shell||!state)return;
  const hasPlan=!!(state.plan?.slots&&Object.values(state.plan.slots).some(day=>Object.values(day||{}).some(Boolean)));
  const empty=document.getElementById('planner-quick-setup');
  const active=document.getElementById('planner-active-setup');
  if(empty)empty.style.display=hasPlan?'none':'grid';
  if(active)active.style.display=hasPlan?'grid':'none';
  const originalDays=document.getElementById('plan-days');
  const originalStart=document.getElementById('plan-start-date');
  const quickDays=document.getElementById('plan-quick-days');
  const quickStart=document.getElementById('plan-quick-start');
  if(quickDays)quickDays.value=String(hasPlan?(state.plan.days||originalDays?.value||7):(originalDays?.value||7));
  if(quickStart)quickStart.value=hasPlan?(state.plan.dayDates?.[1]||''):(originalStart?.value||'');
  const copy=document.getElementById('planner-active-copy');
  if(copy&&hasPlan){
    const days=state.plan.days||Object.keys(state.plan.slots||{}).length;
    const dateRange=getPlanDateRangeLabel(state.plan);
    copy.textContent=[`${days} day${days===1?'':'s'}`,dateRange].filter(Boolean).join(' · ');
  }
}

function ensurePlannerOptionsUI(){
  if(document.getElementById('planner-wizard-host')) return;
  const planner=document.getElementById('view-planner');
  if(!planner||document.getElementById('planner-compact-shell'))return;
  const legacy=[...planner.children].find(child=>child.querySelector?.('#plan-days'));
  const setup=document.getElementById('plan-setup-card');
  if(!legacy||!setup)return;
  const days=document.getElementById('plan-days');
  const date=document.querySelector('#view-planner .plan-date-control');
  const priority=document.getElementById('plan-product-priority');
  const repeats=['breakfast','lunch','dinner'].map(meal=>document.getElementById(`plan-repeat-${meal}`)?.closest('label')).filter(Boolean);
  const traffic=[...legacy.querySelectorAll('.traffic-picker')];
  const dayOptions=days?[...days.options].map(option=>`<option value="${ppEscapeAttr(option.value)}">${ppEscapeHtml(option.textContent)}</option>`).join(''):'';

  const compact=document.createElement('section');
  compact.id='planner-compact-shell';
  compact.className='planner-compact-shell';
  compact.innerHTML=`<div class="planner-compact-card" id="planner-quick-setup">
      <div class="planner-compact-head"><div><div class="planner-compact-title">Meal planner</div><div class="planner-compact-copy">Choose the essentials, then generate. Detailed choices are in Plan options.</div></div><button class="btn ghost" onclick="openPlanOptionsWorkspace()">Plan options</button></div>
      <div class="planner-quick-fields"><div><label for="plan-quick-days">Length</label><select id="plan-quick-days">${dayOptions}</select></div><div><label for="plan-quick-start">Starts (optional)</label><input id="plan-quick-start" type="date"></div></div>
      <div class="planner-quick-actions"><button class="btn primary" onclick="generatePlanFromQuickSetup()">Generate plan</button></div>
    </div>
    <div class="planner-compact-card" id="planner-active-setup" style="display:none">
      <div class="planner-compact-head"><div><div class="planner-compact-title">Meal planner</div><div class="planner-compact-copy" id="planner-active-copy"></div></div><div class="planner-compact-actions"><button class="btn primary" onclick="openPlanStudio()">Rearrange plan</button><button class="btn ghost" onclick="prioritiseAllPlannedEnhancedRecipes()" title="Upgrade all eligible meals to Enhanced for better fit scores">✨ Prioritise Enhanced</button><button class="btn ghost" onclick="openPlanDatesWorkspace()">Assign dates</button><button class="btn ghost" onclick="openPlanOptionsWorkspace()">Edit plan settings</button></div></div>
    </div>`;
  planner.insertBefore(compact,legacy);

  const wrap=document.createElement('div');
  wrap.id='plan-options-wrap';
  wrap.className='modal-wrap plan-options-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-options-title">
    <div class="plan-options-appbar row-between" style="align-items:center"><div><h2 id="plan-options-title" style="margin:0">Plan options</h2><div style="font-size:12px;color:var(--text2)">Meal-plan generation settings</div></div><button class="btn ghost" onclick="closePlanOptionsWorkspace()">Close</button></div>
    <div class="plan-options-body">
      <section class="plan-options-section"><h3>Plan details</h3><div class="plan-options-grid" id="plan-options-details"></div></section>
      <section class="plan-options-section"><h3>Recipe selection</h3><div class="plan-options-grid" id="plan-options-selection"></div></section>
      <section class="plan-options-section"><div class="row-between"><div><h3 style="margin:0">Pre-selected recipes</h3><p style="font-size:12px;color:var(--text2);margin:4px 0 0">Pin specific recipes to include before solver fills other meals.</p></div><button class="btn sm ghost" type="button" onclick="clearPinnedRecipes()">Clear</button></div><div id="pinned-recipes-editor"></div></section>
      <section class="plan-options-section"><div class="row-between"><div><h3 style="margin:0">Use up products</h3><p style="font-size:12px;color:var(--text2);margin:4px 0 0">Shared stock guidance for generation and Shopping.</p></div><button class="btn sm ghost" type="button" onclick="clearUseUpProducts()">Clear</button></div><div id="use-up-products-editor"></div></section>
      <section class="plan-options-section"><h3>Traffic-light filters</h3><p style="font-size:12px;color:var(--text2);margin-bottom:10px">Choose the fit statuses PlatePlan may use for each person. Symbols keep the controls readable without relying on colour alone.</p><div style="display:grid;gap:10px" id="plan-options-traffic"></div></section>
      <section class="plan-options-section"><h3>Meal slots</h3><div id="plan-options-slots"></div></section>
    </div>
    <div class="plan-options-workspace-actions"><button class="btn primary" onclick="generatePlanFromOptions()">Generate plan</button><button class="btn danger" onclick="confirmClearPlanFromOptions()">Clear plan</button></div>
  </div>`;
  document.body.appendChild(wrap);

  const details=wrap.querySelector('#plan-options-details');
  const daysField=document.createElement('div');
  daysField.innerHTML='<label for="plan-days">Length</label>';
  if(days) daysField.appendChild(days);
  const dateField=document.createElement('div');
  dateField.innerHTML='<label>Calendar dates</label>';
  if(date) date.style.margin='0';
  if(date) dateField.appendChild(date);
  details.append(daysField,dateField);

  const selection=wrap.querySelector('#plan-options-selection');
  const priorityField=document.createElement('div');
  priorityField.innerHTML='<label for="plan-product-priority">Product priority</label>';
  if(priority) priority.style.width='100%';
  if(priority) priorityField.appendChild(priority);
  selection.appendChild(priorityField);
  repeats.forEach(label=>{label.style.display='block';const s=label.querySelector('select');if(s)s.style.width='100%';selection.appendChild(label);});
  const preferEnhancedToggle=document.createElement('label');
  preferEnhancedToggle.className='prefer-enhanced-toggle';
  preferEnhancedToggle.innerHTML='<input type="checkbox" id="plan-prefer-enhanced" onchange="setPreferEnhancedRecipes(this.checked)"> <span><strong>✨ Prioritise Enhanced Recipes</strong><small>Prioritise enhanced variants for higher protein density and better (lower) macro fit scores.</small></span>';
  selection.appendChild(preferEnhancedToggle);

  const useUpToggle=document.createElement('label');
  useUpToggle.className='use-up-priority-toggle';
  useUpToggle.innerHTML='<input type="checkbox" id="plan-prioritise-use-up" onchange="setPrioritiseUseUpProducts(this.checked)"> <span><strong>Prioritise Use up products</strong><small>Keep nutrition, traffic filters, exclusions and variety authoritative.</small></span>';
  selection.appendChild(useUpToggle);

  const trafficHost=wrap.querySelector('#plan-options-traffic');
  traffic.forEach(picker=>trafficHost.appendChild(picker));
  if(!document.getElementById('plan-traffic-availability')){
    const summary=document.createElement('div');
    summary.id='plan-traffic-availability';
    summary.className='traffic-availability';
    trafficHost.insertAdjacentElement('afterend',summary);
  }
  enhancePlanTrafficControls();
  setPlanTrafficSelectValues();
  renderPlanTrafficAvailabilitySummary();
  renderUseUpProductsEditor();
  renderPinnedRecipesEditor();

  if(setup){
    setup.style.display='';
    setup.classList.remove('card');
    setup.style.margin='0';
    const setupTitle=setup.querySelector('h3');if(setupTitle)setupTitle.style.display='none';
    wrap.querySelector('#plan-options-slots')?.appendChild(setup);
  }
  legacy.remove();
  updatePlannerCompactHeader();
}

function syncPlannerQuickControls(){
  const days=document.getElementById('plan-days');
  const start=document.getElementById('plan-start-date');
  const quickDays=document.getElementById('plan-quick-days');
  const quickStart=document.getElementById('plan-quick-start');
  if(days&&quickDays)days.value=quickDays.value;
  if(start&&quickStart)start.value=quickStart.value;
}

function generatePlanFromQuickSetup(){
  syncPlannerQuickControls();
  initExcluded(false);
  renderExclGrid();
  renderUseUpProductsEditor();
  renderPinnedRecipesEditor();
  generatePlan();
}

function openPlanOptionsWorkspace(){
  ensurePlannerOptionsUI();
  const wrap=document.getElementById('plan-options-wrap');if(!wrap)return;
  const days=document.getElementById('plan-days');
  if(state.plan?.days&&days)days.value=String(state.plan.days);
  const start=document.getElementById('plan-start-date');
  if(start)start.value=state.plan?.dayDates?.[1]||document.getElementById('plan-quick-start')?.value||'';
  const preferToggle=document.getElementById('plan-prefer-enhanced');
  if(preferToggle) preferToggle.checked = state.prefs?.preferEnhancedRecipes !== false;
  setMealRepeatControlValues();
  setPlanTrafficSelectValues();
  renderPlanTrafficAvailabilitySummary();
  renderExclGrid();
  renderUseUpProductsEditor();
  renderPinnedRecipesEditor();
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'plan-options');
  setTimeout(()=>wrap.querySelector('button')?.focus(),0);
}

function closePlanOptionsWorkspace(fromHistory=false){
  const wrap=document.getElementById('plan-options-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open');delete wrap.dataset.historyEntry;
  updatePlannerCompactHeader();
  restoreMobileLayerFocus();
  if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}

function generatePlanFromOptions(){generatePlan();}
function confirmClearPlanFromOptions(){
  openAppConfirmModal('Clear active meal plan?','This removes the current working plan and its shopping checklist. Saved plans remain in the Meal Plan Library.','Clear plan',()=>{clearPlan();closePlanOptionsWorkspace();});
}

let platePlanDraftDayDates={};
function ensurePlanDatesWorkspace(){
  let wrap=document.getElementById('plan-dates-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.id='plan-dates-wrap';
  wrap.className='modal-wrap plan-dates-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-dates-title">
    <div class="plan-dates-appbar row-between" style="align-items:center;gap:12px">
      <div><h2 id="plan-dates-title" style="margin:0">Assign dates</h2><div style="font-size:13px;color:var(--text2)">Match plan days to your calendar</div></div>
      <button class="btn ghost" type="button" onclick="closePlanDatesWorkspace()">Close</button>
    </div>
    <div class="plan-dates-body">
      <p class="plan-dates-intro">Choose a start date to fill every day, or set individual dates. Gaps are allowed; assigned dates must stay unique and in order.</p>
      <div class="plan-dates-start">
        <div><label for="plan-dates-start">Start date</label><input id="plan-dates-start" type="date"></div>
        <button class="btn ghost" type="button" onclick="fillPlanDatesDraft()">Fill consecutive dates</button>
      </div>
      <div class="plan-dates-list" id="plan-dates-list"></div>
      <div class="plan-dates-msg" id="plan-dates-msg" role="status" aria-live="polite"></div>
    </div>
    <div class="plan-dates-actions">
      <button class="btn ghost" type="button" onclick="clearPlanDatesDraft()">Clear all</button>
      <button class="btn primary" type="button" onclick="savePlanDatesDraft()">Save dates</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function renderPlanDatesDraft(){
  const list=document.getElementById('plan-dates-list');
  if(!list)return;
  const days=+(state.plan?.days||Object.keys(state.plan?.slots||{}).length||0);
  list.innerHTML=Array.from({length:days},(_,index)=>{
    const day=index+1;
    return `<div class="plan-date-row"><label for="plan-date-draft-${day}">Day ${day}</label><input id="plan-date-draft-${day}" type="date" value="${ppEscapeAttr(platePlanDraftDayDates[day]||'')}" onchange="updatePlanDatesDraft(${day},this.value)" aria-label="Calendar date for day ${day}"></div>`;
  }).join('');
  updatePlanDatesDraftMessage();
}
function updatePlanDatesDraftMessage(){
  const message=document.getElementById('plan-dates-msg');
  const save=document.querySelector('#plan-dates-wrap .plan-dates-actions .btn.primary');
  const error=validatePlanDayDates(platePlanDraftDayDates);
  if(message)message.textContent=error;
  if(save)save.disabled=!!error;
  return error;
}
function updatePlanDatesDraft(day,value){
  if(value)platePlanDraftDayDates[day]=value;
  else delete platePlanDraftDayDates[day];
  updatePlanDatesDraftMessage();
}
function fillPlanDatesDraft(){
  const start=document.getElementById('plan-dates-start')?.value||'';
  if(!parsePlanLocalDate(start)){
    const message=document.getElementById('plan-dates-msg');
    if(message)message.textContent='Choose a valid start date first.';
    document.getElementById('plan-dates-start')?.focus();
    return;
  }
  const days=+(state.plan?.days||Object.keys(state.plan?.slots||{}).length||0);
  platePlanDraftDayDates=buildPlanDayDates(start,days);
  renderPlanDatesDraft();
}
function clearPlanDatesDraft(){
  platePlanDraftDayDates={};
  const start=document.getElementById('plan-dates-start');if(start)start.value='';
  renderPlanDatesDraft();
}
function openPlanDatesWorkspace(){
  if(!state.plan?.slots||!Object.keys(state.plan.slots).length){
    showPlatePlanToast('Generate a meal plan before assigning dates.');
    return;
  }
  closePlanOptionsWorkspace();
  const wrap=ensurePlanDatesWorkspace();
  platePlanDraftDayDates={...(state.plan.dayDates||{})};
  const start=wrap.querySelector('#plan-dates-start');if(start)start.value=platePlanDraftDayDates[1]||'';
  renderPlanDatesDraft();
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'plan-dates');
  setTimeout(()=>wrap.querySelector('#plan-dates-start')?.focus(),0);
}
function closePlanDatesWorkspace(fromHistory=false){
  const wrap=document.getElementById('plan-dates-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open');delete wrap.dataset.historyEntry;
  platePlanDraftDayDates={};
  restoreMobileLayerFocus();
  if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function savePlanDatesDraft(){
  const error=updatePlanDatesDraftMessage();if(error)return;
  state.plan.dayDates={...platePlanDraftDayDates};
  const first=state.plan.dayDates[1]||'';
  const start=document.getElementById('plan-start-date');if(start)start.value=first;
  const quick=document.getElementById('plan-quick-start');if(quick)quick.value=first;
  saveState();
  markPlatePlanViewsDirty('today','shopping','planlib');
  closePlanDatesWorkspace();
  renderPlan();
  renderPlanHistoryPanel();
  showPlatePlanToast(Object.keys(state.plan.dayDates).length?'Plan dates saved.':'Plan dates cleared.');
}

function ensurePlannerShell(){
  const planner = document.getElementById('view-planner');
  if(planner && !document.getElementById('plan-setup-card')){
    const firstCard = planner.querySelector('.card');
    if(firstCard){
      firstCard.id = 'plan-setup-card';
    }
  }
  const library = document.getElementById('view-planlib');
  if(library){
    let history = document.getElementById('plan-history-panel');
    if(!history){
      library.insertAdjacentHTML('beforeend', '<div id="plan-history-panel"></div>');
      history = document.getElementById('plan-history-panel');
    } else if(!history.closest('#view-planlib')) {
      library.appendChild(history);
    }
  }
  if(planner && !document.getElementById('plan-overall-summary')){
    const content = document.getElementById('plan-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="plan-overall-summary"></div>');
  }
  if(planner && !document.getElementById('plan-meal-prep-panel')){
    const content = document.getElementById('plan-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="plan-meal-prep-panel"></div>');
  }
  const shopping = document.getElementById('view-shopping');
  if(shopping && !document.getElementById('shop-summary')){
    const content = document.getElementById('shop-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="shop-summary"></div>');
  }
  if(shopping && !document.getElementById('shop-meal-prep-panel')){
    const content = document.getElementById('shop-content');
    if(content) content.insertAdjacentHTML('beforebegin', '<div id="shop-meal-prep-panel"></div>');
  }
  ensurePlannerOptionsUI();
}


function normaliseExclusionList(list){
  return (list || []).map(x => typeof x === 'string' ? { name:x } : x).filter(x => (x.name || x.id));
}

function getExclusionsForPerson(who){
  const ex = state.prefs?.exclusions || { shared: [], elliott: [], chloe: [] };
  const person = String(who || '').toLowerCase().startsWith('chloe') ? 'chloe' : 'elliott';
  return [...normaliseExclusionList(ex.shared), ...normaliseExclusionList(ex[person])];
}

function recipeMatchesExclusion(recipe, exclusion){
  const needle = normaliseAliasText(exclusion.name || '');
  const ids = [exclusion.id, exclusion.groupId, exclusion.productId].filter(Boolean);
  const checkIng = ing => {
    const resolved = resolveProductForIngredient(ing);
    const hay = normaliseAliasText([ing.raw, ing.name, resolved.group?.name, resolved.product?.name, resolved.product?.brand].filter(Boolean).join(' '));
    if(needle && hay.includes(needle)) return true;
    return ids.includes(ing.groupId) || ids.includes(ing.bankId) || ids.includes(resolved.groupId) || ids.includes(resolved.productId);
  };
  return (recipe.ingredients || []).some(checkIng) || (recipe.enhanced?.ingredients || []).some(checkIng);
}

function recipeAllowedForPerson(recipe, who){
  return !getExclusionsForPerson(who).some(ex => recipeMatchesExclusion(recipe, ex));
}

function getUsedRecipeIdsFromHistory(){
  const used = new Map();
  (state.planHistory || []).slice(0, 4).forEach((plan, histIndex) => {
    Object.values(plan.slots || {}).forEach(day => Object.values(day || {}).forEach(slot => {
      const info = getPlanSlotInfo(slot);
      if(info.id && !used.has(info.id)) used.set(info.id, histIndex);
    }));
  });
  return used;
}

function getPlanRecipeIds(plan = state.plan){
  const ids = new Set();
  Object.values(plan?.slots || {}).forEach(day => Object.values(day || {}).forEach(slot => {
    const info = getPlanSlotInfo(slot);
    if(info.id) ids.add(info.id);
  }));
  return [...ids];
}

function snapshotCurrentPlan(savedStatus = 'PlatePlan generated', name = ''){
  if(!state.plan?.slots) return null;
  const hasAny = Object.values(state.plan.slots || {}).some(day => Object.values(day || {}).some(Boolean));
  if(!hasAny) return null;
  const snap = {
    id: 'hist-' + Date.now(),
    date: new Date().toISOString(),
    name: name || '',
    savedBy: 'PlatePlan',
    savedStatus,
    confirmedShopping: !!state.plan.confirmedShopping,
    confirmedAt: state.plan.confirmedAt || null,
    days: state.plan.days || 0,
    slots: clonePlatePlanValue(state.plan.slots || {}),
    dayDates: clonePlatePlanValue(state.plan.dayDates || {}),
    slotReasons: clonePlatePlanValue(state.plan.slotReasons || {}),
    productPriority: state.plan.productPriority || state.prefs.productPriority || 'protein',
    productSelections: clonePlatePlanValue(state.plan.productSelections || {}),
    useUpProductIds: clonePlatePlanValue(state.plan.useUpProductIds || []),
    shoppingAtHome: clonePlatePlanValue(state.plan.shoppingAtHome || {}),
    overrides: clonePlatePlanValue(state.overrides || {}),
    score: calculatePlanScore(state.plan),
    mealPrepGroups: clonePlatePlanValue(state.plan.mealPrepGroups || []),
    declinedMealPrepGroups: clonePlatePlanValue(state.plan.declinedMealPrepGroups || []),
    warnings: state.plan.warnings || []
  };
  snap.cardPackSnapshot=buildRecipeCardPackSnapshot(state.plan,state.overrides,{planName:snap.name||defaultPlanSaveName(state.plan),createdAt:snap.date});
  state.planHistory = [snap, ...(state.planHistory || [])].slice(0, 12);
  return snap;
}

function getSlotMealMode(day, meal){
  const d = state.excluded?.[day] || {};
  const eKey = meal + 'E';
  const cKey = meal + 'C';
  const eOn = !d[eKey];
  const cOn = !d[cKey];
  if(eOn && cOn) return 'both';
  if(eOn) return 'elliott';
  if(cOn) return 'chloe';
  return 'none';
}

function setSlotMealMode(day, meal, mode){
  if(!state.excluded[day]) state.excluded[day] = {};
  state.excluded[day][meal+'E'] = !(mode === 'elliott' || mode === 'both');
  state.excluded[day][meal+'C'] = !(mode === 'chloe' || mode === 'both');
  saveState();
  renderExclGrid();
}

function getPlannerSlotNutritionInfo(plan = state.plan, day, slotKey){
  const person = getSlotPersonPrefix(slotKey);
  const mealType = getMealTypeFromSlotKey(slotKey);
  const label = (SLOT_LABELS[slotKey] || slotKey || '').replace('\n',' ');
  const base = { plan, day, slotKey, person, mealType, label, slotInfo:null, active:null, instanceId:null, cal:0, prot:0, assumed:false, visible:false };
  if(!person) return base;

  if(state.excluded?.[day]?.[slotKey]) {
    return { ...base, assumed:true };
  }

  const slots = plan?.slots?.[day] || plan?.slots?.[String(day)] || {};
  const slotInfo = getPlanSlotInfo(slots[slotKey]);
  if(!slotInfo.active) {
    return { ...base, slotInfo, assumed:true };
  }

  const n = getPlannedSlotNutrition(slotInfo.active, slotKey, slotInfo.instanceId, plan) || { cal:0, prot:0 };
  return { ...base, slotInfo, active:slotInfo.active, instanceId:slotInfo.instanceId, cal:+n.cal || 0, prot:+n.prot || 0, portions:n.portions || null, visible:true };
}

function buildPlanDaySlotInfos(plan = state.plan, day){
  return SLOTS.map(sl => getPlannerSlotNutritionInfo(plan, day, sl.key));
}

function summarizePlanDaySlotInfos(daySlotInfos){
  const totals = { e:{cal:0, prot:0}, c:{cal:0, prot:0} };
  const assumed = { e:{cal:0, prot:0, labels:[]}, c:{cal:0, prot:0, labels:[]} };
  const addSnackBudget = personPrefix => {
    const b = getBudgets(personPrefix, 'snack');
    totals[personPrefix].cal += +b.cal || 0;
    totals[personPrefix].prot += +b.prot || 0;
    assumed[personPrefix].cal += +b.cal || 0;
    assumed[personPrefix].prot += +b.prot || 0;
    assumed[personPrefix].labels.push('snacks');
  };
  addSnackBudget('e');
  addSnackBudget('c');

  (daySlotInfos || []).forEach(info => {
    if(!info?.person || !info.visible) return;
    totals[info.person].cal += +info.cal || 0;
    totals[info.person].prot += +info.prot || 0;
  });

  const eTgt = { cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 };
  const cTgt = { cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 };
  const miss = (actual, target, protein=false) => {
    if(!target) return 0;
    const pct = ((actual - target) / target) * 100;
    return protein ? Math.max(0, -pct) : Math.abs(pct);
  };
  const score = miss(totals.e.cal, eTgt.cal) + miss(totals.c.cal, cTgt.cal) + miss(totals.e.prot, eTgt.prot, true) + miss(totals.c.prot, cTgt.prot, true);
  return { totals, targets:{ e:eTgt, c:cTgt }, assumed, score: Math.round(score) };
}

function getPlanDaySummary(day, plan = state.plan){
  return summarizePlanDaySlotInfos(buildPlanDaySlotInfos(plan, day));
}

function calculatePlanScore(plan = state.plan){
  const days = plan?.days || 0;
  const dayScores = [];
  const totals = { e:{cal:0, prot:0, days:0}, c:{cal:0, prot:0, days:0} };
  for(let d=1; d<=days; d++){
    const s = getPlanDaySummary(d, plan);
    dayScores.push(s.score);
    ['e','c'].forEach(p => {
      if(s.totals[p].cal || s.totals[p].prot){
        totals[p].cal += s.totals[p].cal;
        totals[p].prot += s.totals[p].prot;
        totals[p].days++;
      }
    });
  }
  return {
    score: dayScores.length ? Math.round(dayScores.reduce((a,b)=>a+b,0) / dayScores.length) : 0,
    eAvg:{ cal: totals.e.days ? Math.round(totals.e.cal / totals.e.days) : 0, prot: totals.e.days ? Math.round(totals.e.prot * 10 / totals.e.days) / 10 : 0 },
    cAvg:{ cal: totals.c.days ? Math.round(totals.c.cal / totals.c.days) : 0, prot: totals.c.days ? Math.round(totals.c.prot * 10 / totals.c.days) / 10 : 0 }
  };
}

function fmtPlanDelta(actual, target, protein=false){
  if(!target) return 'no target';
  const pct = Math.round(((actual - target) / target) * 100);
  if(protein && pct >= 0) return `${Math.abs(pct)}% above target`;
  if(pct === 0) return 'on target';
  return `${Math.abs(pct)}% ${pct > 0 ? 'above' : 'below'} target`;
}

function planDeltaColor(actual, target, protein=false){
  if(!target) return 'var(--text2)';
  const pct = ((actual - target) / target) * 100;
  if(protein && pct >= 0) return 'var(--green)';
  const abs = Math.abs(pct);
  if(abs <= 10) return 'var(--green)';
  if(abs <= 15) return 'var(--amber)';
  return 'var(--red)';
}

function calculatePlanDayScoreFromTotals(totals){
  const eTgt = { cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 };
  const cTgt = { cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 };
  const miss = (actual, target, protein=false) => {
    if(!target) return 0;
    const pct = ((actual - target) / target) * 100;
    return protein ? Math.max(0, -pct) : Math.abs(pct);
  };
  return Math.round(miss(totals.e.cal, eTgt.cal) + miss(totals.c.cal, cTgt.cal) + miss(totals.e.prot, eTgt.prot, true) + miss(totals.c.prot, cTgt.prot, true));
}

function parsePlannerVisibleMacro(text){
  const m = String(text || '').match(/([0-9]+(?:\.[0-9]+)?)\s*kcal\s*\/\s*P\s*([0-9]+(?:\.[0-9]+)?)\s*g/i);
  return m ? { cal:+m[1] || 0, prot:+m[2] || 0 } : null;
}

function summarizeVisiblePlanDayCard(card){
  const totals = { e:{cal:0, prot:0}, c:{cal:0, prot:0} };
  const assumed = { e:{cal:0, prot:0, labels:['snacks']}, c:{cal:0, prot:0, labels:['snacks']} };
  ['e','c'].forEach(person => {
    const b = getBudgets(person, 'snack');
    totals[person].cal += +b.cal || 0;
    totals[person].prot += +b.prot || 0;
    assumed[person].cal += +b.cal || 0;
    assumed[person].prot += +b.prot || 0;
  });
  card.querySelectorAll('.slot-row').forEach(row => {
    const label = (row.querySelector('.slot-lbl')?.textContent || '').toLowerCase();
    const person = row.dataset.planPerson || (label.includes('elliott') ? 'e' : label.includes('chloe') ? 'c' : '');
    if(!person) return;
    if(row.dataset.planCal !== undefined && row.dataset.planProt !== undefined && row.querySelector('.slot-macro')) {
      totals[person].cal += +row.dataset.planCal || 0;
      totals[person].prot += +row.dataset.planProt || 0;
      return;
    }
    const macro = parsePlannerVisibleMacro(row.querySelector('.slot-macro')?.textContent || '');
    if(macro) {
      totals[person].cal += macro.cal;
      totals[person].prot += macro.prot;
    }
    // Missing or not-needed visible rows do not contribute to the day's intake total.
  });
  const targets = { e:{ cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 }, c:{ cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 } };
  return { totals, targets, assumed, score: calculatePlanDayScoreFromTotals(totals) };
}

function renderPlannerPersonSummaryBox(personKey, daySummary){
  const name = personKey === 'e' ? 'Elliott' : 'Chloe';
  const total = daySummary.totals[personKey];
  const tgt = daySummary.targets[personKey];
  const assumedText = daySummary.assumed?.[personKey]?.labels?.length ? `<div style="color:var(--text3);font-size:11px;margin-top:3px">Assumes covered: ${ppEscapeHtml([...new Set(daySummary.assumed[personKey].labels)].join(', '))}</div>` : '';
  return `<strong>${name}</strong>
        <div style="color:${planDeltaColor(total.cal,tgt.cal)}">${Math.round(total.cal)} / ${tgt.cal} kcal · ${fmtPlanDelta(total.cal,tgt.cal)}</div>
        <div style="color:${planDeltaColor(total.prot,tgt.prot,true)}">P ${round1(total.prot)} / ${tgt.prot}g · ${fmtPlanDelta(total.prot,tgt.prot,true)}</div>
        ${assumedText}`;
}

function renderPlanOverallSummaryHtml(score){
  const el=document.getElementById('plan-overall-summary');
  if(!el) return;
  if(!state.plan?.slots){ el.innerHTML=''; return; }
  el.innerHTML = `<div class="card" style="border-color:var(--green);margin-bottom:12px">
      <div>
        <h3 style="margin-bottom:6px;color:var(--green)">Meal plan summary</h3>
        <div class="plan-summary">
          <div class="summary-box"><strong>Elliott average</strong><div>${score.eAvg.cal} kcal / day</div><div>P ${score.eAvg.prot}g / day</div></div>
          <div class="summary-box"><strong>Chloe average</strong><div>${score.cAvg.cal} kcal / day</div><div>P ${score.cAvg.prot}g / day</div></div>
          <div class="summary-box"><strong>Overall score</strong><div style="font-size:22px;font-weight:700;color:${score.score<=10?'var(--green)':score.score<=20?'var(--amber)':'var(--red)'}">${score.score}</div><div style="color:var(--text2)">Lower is better</div></div>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:6px">Missing meals and snacks are assumed to be covered outside PlatePlan.</div>
      </div>
  </div>`;
}

let reconcilingPlanSummaries = false;
let plannerSummaryObserver = null;

function reconcileVisiblePlanSummaries(){
  if(reconcilingPlanSummaries) return;
  reconcilingPlanSummaries = true;
  try{
    const cards = [...document.querySelectorAll('#plan-content .day-plan-card:not(.skipped)')];
    if(!cards.length) { renderPlanOverallSummary(); return; }
    const aggregate = { e:{cal:0, prot:0, days:0}, c:{cal:0, prot:0, days:0}, scores:[] };
    cards.forEach(card => {
      const summary = summarizeVisiblePlanDayCard(card);
      const boxes = card.querySelectorAll('.plan-summary .summary-box');
      const boxE = renderPlannerPersonSummaryBox('e', summary);
      const boxC = renderPlannerPersonSummaryBox('c', summary);
      if(boxes[0] && boxes[0].innerHTML !== boxE) boxes[0].innerHTML = boxE;
      if(boxes[1] && boxes[1].innerHTML !== boxC) boxes[1].innerHTML = boxC;
      const scoreTag = card.querySelector('.row-between .tag');
      const scoreText = 'Score ' + summary.score;
      if(scoreTag && scoreTag.textContent !== scoreText) scoreTag.textContent = scoreText;
      aggregate.scores.push(summary.score);
      ['e','c'].forEach(person => {
        aggregate[person].cal += summary.totals[person].cal;
        aggregate[person].prot += summary.totals[person].prot;
        aggregate[person].days += 1;
      });
    });
    const visibleScore = {
      score: aggregate.scores.length ? Math.round(aggregate.scores.reduce((a,b)=>a+b,0) / aggregate.scores.length) : 0,
      eAvg:{ cal: aggregate.e.days ? Math.round(aggregate.e.cal / aggregate.e.days) : 0, prot: aggregate.e.days ? Math.round(aggregate.e.prot * 10 / aggregate.e.days) / 10 : 0 },
      cAvg:{ cal: aggregate.c.days ? Math.round(aggregate.c.cal / aggregate.c.days) : 0, prot: aggregate.c.days ? Math.round(aggregate.c.prot * 10 / aggregate.c.days) / 10 : 0 }
    };
    if(state.plan) state.plan.score = visibleScore;
    renderPlanOverallSummaryHtml(visibleScore);
  } finally {
    reconcilingPlanSummaries = false;
  }
}

function installPlannerSummaryObserver(){
  // Intentionally no-op to eliminate DOM mutation feedback loops that can crash the browser tab
}

function parsePlanRecipeValue(value){
  const text = String(value || '');
  if(text.endsWith('::enhanced')) return { id: text.slice(0, -10), variant: 'enhanced' };
  return { id: text, variant: 'original' };
}

function makePlanSlot(recipeId, variant = 'original'){
  const clean = parsePlanRecipeValue(recipeId);
  return {
    id: clean.id,
    instanceId: 'pm-' + Date.now() + Math.random().toString(36).substring(2,7),
    ...(variant === 'enhanced' || clean.variant === 'enhanced' ? { variant: 'enhanced' } : {})
  };
}

function getPlanSlotInfo(slotData, planContext = state.plan, overrideStore = state.overrides){
  if(!slotData) return { id:'', variant:'original', instanceId:null, recipe:null, active:null };
  const parsed = typeof slotData === 'string'
    ? parsePlanRecipeValue(slotData)
    : { id: slotData.id || '', variant: slotData.variant || 'original' };
  const recipe = getRecipe(parsed.id);
  const variant = parsed.variant === 'enhanced' && recipe?.enhanced ? 'enhanced' : 'original';
  const active = recipe ? getRecipeVariantForDisplay(recipe, variant, typeof slotData === 'string' ? null : slotData.instanceId, planContext, overrideStore) : null;
  return {
    id: parsed.id,
    variant,
    instanceId: typeof slotData === 'string' ? null : slotData.instanceId,
    recipe,
    active
  };
}


const MEAL_PREP_MEALS = [
  { key:'breakfast', label:'Breakfast', e:'breakfastE', c:'breakfastC' },
  { key:'lunch', label:'Lunch', e:'lunchE', c:'lunchC' },
  { key:'dinner', label:'Dinner', e:'dinnerE', c:'dinnerC' }
];

function getMealPrepSlotEntry(daySlots, dayNum, slotKey, planContext = state.plan, overrideStore = state.overrides){
  if(planContext === state.plan && state.excluded?.[dayNum]?.[slotKey]) return null;
  const slotData = daySlots?.[slotKey];
  if(!slotData) return null;
  const slotInfo = getPlanSlotInfo(slotData, planContext, overrideStore);
  if(!slotInfo.active) return null;
  return { slotKey, slotInfo, person: String(slotKey).endsWith('C') ? 'Chloe' : 'Elliott' };
}

function sameMealPrepRecipe(a, b){
  return !!(a && b && a.slotInfo.id === b.slotInfo.id && (a.slotInfo.variant || 'original') === (b.slotInfo.variant || 'original'));
}

function buildMealPrepDayGroups(dayNum, meal, daySlots, planContext = state.plan, overrideStore = state.overrides){
  const e = getMealPrepSlotEntry(daySlots, dayNum, meal.e, planContext, overrideStore);
  const c = getMealPrepSlotEntry(daySlots, dayNum, meal.c, planContext, overrideStore);
  if(e && c && sameMealPrepRecipe(e, c)) return [{ dayNum, meal, entries:[e, c] }];
  return [e ? { dayNum, meal, entries:[e] } : null, c ? { dayNum, meal, entries:[c] } : null].filter(Boolean);
}

function mealPrepPeopleKey(entries){
  return (entries || []).map(entry => entry.person).sort().join('+') || 'none';
}

function recipePackGroupOccurrenceKey(group){
  const primary = group?.entries?.[0];
  if(!primary) return '';
  return [
    group.dayNum,
    group.meal?.key || '',
    primary.slotInfo.id || '',
    primary.slotInfo.variant || 'original',
    mealPrepPeopleKey(group.entries)
  ].join('|');
}

function mealPrepIdentityKey(group){
  const primary = group?.entries?.[0];
  if(!primary) return '';
  return [
    group.meal?.key || '',
    primary.slotInfo.id || '',
    primary.slotInfo.variant || 'original',
    mealPrepPeopleKey(group.entries)
  ].join('|');
}

function mealPrepSuggestionKey(group){
  return [
    'mp',
    group.mealKey,
    group.recipeId,
    group.variant || 'original',
    group.peopleKey,
    (group.days || []).join('-')
  ].join('|');
}

function findMealPrepSuggestions(plan = state.plan, overrideStore = state.overrides){
  if(!plan?.slots) return [];
  const days = plan.days || Object.keys(plan.slots || {}).length || 0;
  const byIdentity = {};
  for(let d=1; d<=days; d++){
    const daySlots = plan.slots[d] || {};
    MEAL_PREP_MEALS.flatMap(meal => buildMealPrepDayGroups(d, meal, daySlots, plan, overrideStore)).forEach(group => {
      const primary = group.entries[0];
      const idKey = mealPrepIdentityKey(group);
      if(!idKey) return;
      if(!byIdentity[idKey]) byIdentity[idKey] = [];
      byIdentity[idKey].push({
        ...group,
        recipeId: primary.slotInfo.id,
        variant: primary.slotInfo.variant || 'original',
        recipeName: primary.slotInfo.active?.name || primary.slotInfo.recipe?.name || 'Recipe',
        mealKey: group.meal.key,
        peopleKey: mealPrepPeopleKey(group.entries)
      });
    });
  }
  const suggestions = [];
  Object.values(byIdentity).forEach(rows => {
    rows.sort((a,b) => a.dayNum - b.dayNum);
    let run = [];
    const flush = () => {
      if(run.length >= 2){
        const first = run[0];
        const suggestion = {
          key:'',
          recipeId:first.recipeId,
          variant:first.variant,
          recipeName:first.recipeName,
          mealKey:first.mealKey,
          mealLabel:first.meal.label,
          peopleKey:first.peopleKey,
          days:run.map(row => row.dayNum),
          occurrences:run
        };
        suggestion.key = mealPrepSuggestionKey(suggestion);
        suggestions.push(suggestion);
      }
      run = [];
    };
    rows.forEach(row => {
      if(!run.length || row.dayNum === run[run.length - 1].dayNum + 1) run.push(row);
      else { flush(); run.push(row); }
    });
    flush();
  });
  return suggestions.sort((a,b) => a.days[0] - b.days[0] || a.mealKey.localeCompare(b.mealKey));
}

function cleanMealPrepState(){
  if(!state.plan || typeof state.plan !== 'object') return [];
  if(!Array.isArray(state.plan.mealPrepGroups)) state.plan.mealPrepGroups = [];
  if(!Array.isArray(state.plan.declinedMealPrepGroups)) state.plan.declinedMealPrepGroups = [];
  const suggestions = findMealPrepSuggestions(state.plan);
  const valid = new Set(suggestions.map(s => s.key));
  state.plan.mealPrepGroups = state.plan.mealPrepGroups.filter(g => valid.has(g.key));
  state.plan.declinedMealPrepGroups = state.plan.declinedMealPrepGroups.filter(key => valid.has(key));
  return suggestions;
}

function formatMealPrepDays(group, planContext = state.plan){
  return (group.days || []).map(day => `${formatPlanDayLabel(planContext, day)} ${group.mealLabel || ''}`.trim()).join(', ');
}

function refreshAfterMealPrepChange(){
  const suggestions = cleanMealPrepState();
  const accepted = new Set((state.plan?.mealPrepGroups || []).map(g => g.key));
  const declined = new Set(state.plan?.declinedMealPrepGroups || []);
  const hasPending = suggestions.some(s => !accepted.has(s.key) && !declined.has(s.key));
  if(document.getElementById('view-shopping')?.classList.contains('active') && !hasPending) renderShopping();
  else renderMealPrepSuggestions();
}

function acceptMealPrepSuggestion(key){
  const suggestion = findMealPrepSuggestions(state.plan).find(s => s.key === key);
  if(!suggestion) return;
  if(!Array.isArray(state.plan.mealPrepGroups)) state.plan.mealPrepGroups = [];
  if(!Array.isArray(state.plan.declinedMealPrepGroups)) state.plan.declinedMealPrepGroups = [];
  state.plan.declinedMealPrepGroups = state.plan.declinedMealPrepGroups.filter(k => k !== key);
  if(!state.plan.mealPrepGroups.some(g => g.key === key)) {
    state.plan.mealPrepGroups.push({
      key,
      recipeId:suggestion.recipeId,
      variant:suggestion.variant,
      mealKey:suggestion.mealKey,
      peopleKey:suggestion.peopleKey,
      days:suggestion.days
    });
  }
  saveState();
  refreshAfterMealPrepChange();
}

function ignoreMealPrepSuggestion(key){
  if(!state.plan) return;
  if(!Array.isArray(state.plan.mealPrepGroups)) state.plan.mealPrepGroups = [];
  if(!Array.isArray(state.plan.declinedMealPrepGroups)) state.plan.declinedMealPrepGroups = [];
  state.plan.mealPrepGroups = state.plan.mealPrepGroups.filter(g => g.key !== key);
  if(!state.plan.declinedMealPrepGroups.includes(key)) state.plan.declinedMealPrepGroups.push(key);
  saveState();
  refreshAfterMealPrepChange();
}

function removeMealPrepGroup(key){
  if(!state.plan) return;
  state.plan.mealPrepGroups = (state.plan.mealPrepGroups || []).filter(g => g.key !== key);
  saveState();
  refreshAfterMealPrepChange();
}

function getRecipePackMealPrepGroups(planContext = state.plan, overrideStore = state.overrides){
  const suggestions = planContext === state.plan ? cleanMealPrepState() : findMealPrepSuggestions(planContext, overrideStore);
  const accepted = new Set((planContext?.mealPrepGroups || []).map(g => g.key));
  return suggestions.filter(s => accepted.has(s.key));
}

function renderMealPrepSuggestions(){
  const panels = [
    { el: document.getElementById('plan-meal-prep-panel'), context: 'planner' },
    { el: document.getElementById('shop-meal-prep-panel'), context: 'shopping' }
  ].filter(panel => panel.el);
  if(!panels.length) return;
  if(!state.plan?.slots){
    panels.forEach(panel => panel.el.innerHTML = '');
    return;
  }
  const suggestions = cleanMealPrepState();
  const accepted = new Set((state.plan.mealPrepGroups || []).map(g => g.key));
  const declined = new Set(state.plan.declinedMealPrepGroups || []);
  const activeRows = suggestions.filter(s => accepted.has(s.key));
  const pendingRows = suggestions.filter(s => !accepted.has(s.key) && !declined.has(s.key));
  if(!activeRows.length && !pendingRows.length){
    panels.forEach(panel => panel.el.innerHTML = '');
    return;
  }
  const activeHtml = activeRows.map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
    <div><strong class="${/https?:\/\/|[^\s]{36,}/i.test(s.recipeName||'')?'breakable-url':''}">Meal Prep: ${ppEscapeHtml(s.recipeName)}</strong><div style="font-size:12px;color:var(--text2)">Recipe pack will combine ${ppEscapeHtml(formatMealPrepDays(s))}.</div></div>
    <button class="btn sm ghost" onclick="removeMealPrepGroup('${ppEscapeAttr(s.key)}')">Undo</button>
  </div>`).join('');
  const pendingHtml = pendingRows.map(s => `<div class="row-between" style="gap:10px;border-top:1px solid var(--border);padding:8px 0">
    <div><strong class="${/https?:\/\/|[^\s]{36,}/i.test(s.recipeName||'')?'breakable-url':''}">${ppEscapeHtml(s.recipeName)}</strong><div style="font-size:12px;color:var(--text2)">Same ${ppEscapeHtml((s.mealLabel || '').toLowerCase())} on consecutive days: ${ppEscapeHtml(formatMealPrepDays(s))}.</div></div>
    <div class="row-center" style="justify-content:flex-end">
      <button class="btn sm primary" onclick="acceptMealPrepSuggestion('${ppEscapeAttr(s.key)}')">Use meal prep</button>
      <button class="btn sm ghost" onclick="ignoreMealPrepSuggestion('${ppEscapeAttr(s.key)}')">Ignore</button>
    </div>
  </div>`).join('');
  panels.forEach(panel => {
    const shoppingCopy = panel.context === 'shopping'
      ? '<div style="font-size:12px;color:var(--text2);margin-bottom:4px">This affects the downloaded recipe pack only. Shopping quantities are already based on the full plan.</div>'
      : '<div style="font-size:12px;color:var(--text2);margin-bottom:4px">When the same meal appears on consecutive days, PlatePlan can combine it into one batch card in the recipe pack.</div>';
    panel.el.innerHTML = `<div class="card" style="margin-bottom:12px;border-color:var(--purple)">
      <div style="font-weight:700;margin-bottom:4px">Meal prep suggestions</div>
      ${shoppingCopy}
      ${activeHtml}${pendingHtml}
    </div>`;
  });
}

function getPlannerRecipeOptions(type, who, opts = {}){
  const used = opts.avoidHistory ? getUsedRecipeIdsFromHistory() : new Map();
  const targetType = String(type || '').toLowerCase();
  const targetWho = String(who || '').toLowerCase();

  let rows = state.recipes
    .filter(r => {
      const recipeTypes = (r.types || [r.type || 'dinner']).map(t => String(t).toLowerCase());
      const typeMatches = recipeTypes.includes(targetType);
      const recipeWho = String(r.who || 'both').toLowerCase();
      const whoMatches = targetWho === 'any' || recipeWho === 'any' || recipeWho === 'both' || recipeWho === targetWho;
      return typeMatches && whoMatches;
    })
    .filter(r => !opts.applyExclusions || targetWho === 'any' || recipeAllowedForPerson(r, who))
    .flatMap(r => {
      const origFav = (typeof isRecipeVariantFavourite === 'function') ? isRecipeVariantFavourite(r.id, 'original') : !!(r.isFavourite || r.isFavorite);
      const enhFav = (typeof isRecipeVariantFavourite === 'function') ? isRecipeVariantFavourite(r.id, 'enhanced') : !!(r.isFavourite || r.isFavorite);
      const rows = [{ id:r.id, variant:'original', recipe:r, label:r.name, isFavourite:origFav, isFavorite:origFav }];
      if(r.enhanced) rows.push({ id:r.id, variant:'enhanced', recipe:r, label:(r.enhanced.name || r.name + ' (Enhanced)'), enhanced:true, isFavourite:enhFav, isFavorite:enhFav });
      return rows;
    });
  if(opts.applyTrafficFilter !== false) {
    rows = rows.filter(row => plannerRecipePassesTrafficFilter(row, type, who, opts.trafficRules || null));
  }
  if(opts.avoidHistory){
    rows.forEach(row => row.historyRank = used.has(row.id) ? used.get(row.id) + 1 : 0);
    const fresh = rows.filter(row => !row.historyRank);
    if(fresh.length) rows = fresh;
    else rows = rows.sort((a,b) => (b.historyRank || 0) - (a.historyRank || 0));
  }
  return rows;
}

let platePlanUseUpCoverageCache=new Map();
function getUseUpEntries(){
  return Object.entries(state.useUpProducts||{}).map(([productId,entry])=>({
    productId,
    product:getProduct(productId),
    quantity:+entry?.quantity||0,
    unit:['g','ml','item','pack','unknown'].includes(entry?.unit)?entry.unit:'unknown'
  })).filter(entry=>entry.product);
}
function getUseUpAvailableAmount(entry){
  if(!entry||!(entry.quantity>0)||entry.unit==='unknown')return null;
  if(entry.unit==='pack')return entry.quantity*getProductUsablePackAmount(entry.product);
  if(entry.unit==='item')return entry.quantity*getProductItemAmount(entry.product);
  return entry.quantity;
}
function getRecipeUseUpCoverage(option,productIds=null){
  const active=option?.variant==='enhanced'&&option.recipe?.enhanced?{...option.recipe,...option.recipe.enhanced,ingredients:option.recipe.enhanced.ingredients||[]} : option?.recipe;
  if(!active)return {matches:[],matchedCount:0,otherIngredients:0,score:0};
  const allowed=productIds?new Set(productIds):null;
  const entries=getUseUpEntries().filter(entry=>!allowed||allowed.has(entry.productId));
  const signature=JSON.stringify([active.id||option.id,option.variant||'original',active.ingredients,entries.map(e=>[e.productId,e.quantity,e.unit])]);
  if(platePlanUseUpCoverageCache.has(signature))return platePlanUseUpCoverageCache.get(signature);
  const matches=[];
  const matchedIngredientKeys=new Set();
  entries.forEach(entry=>{
    let used=0;
    (active.ingredients||[]).forEach((ing,index)=>{
      const groupId=getRecipeIngredientGroupId(ing);
      if(entry.product.groupId&&groupId===entry.product.groupId){
        used+=getEffectiveIngredientGrams(ing,entry.product);
        matchedIngredientKeys.add(index);
      }
    });
    if(used>0){
      const available=getUseUpAvailableAmount(entry);
      matches.push({productId:entry.productId,product:entry.product,used,available,remainder:available==null?null:Math.max(0,available-used)});
    }
  });
  const knownUtilisation=matches.reduce((sum,row)=>sum+(row.available>0?Math.min(row.used,row.available)/row.available:0),0);
  const result={matches,matchedCount:matches.length,otherIngredients:Math.max(0,(active.ingredients||[]).length-matchedIngredientKeys.size),score:matches.length*100+knownUtilisation*35-Math.max(0,(active.ingredients||[]).length-matchedIngredientKeys.size)};
  platePlanUseUpCoverageCache.set(signature,result);
  return result;
}
function rankPlannerOptionsForUseUp(options,mealType,who,productIds=null){
  return (options||[]).map(option=>{
    const baseCoverage=getRecipeUseUpCoverage(option,productIds);
    const active=option.variant==='enhanced'&&option.recipe?.enhanced?{...option.recipe,...option.recipe.enhanced,ingredients:option.recipe.enhanced.ingredients||[]} : option.recipe;
    const bundle=calculateRecipeDisplayNutrition({recipe:option.recipe,variant:option.variant,mealType});
    const portions=bundle?.portions||{};
    const person=String(who||'').toLowerCase().startsWith('c')?'c':'e';
    const serves=+active?.serves||+option.recipe?.serves||1;
    const portionServings=String(who||'').toLowerCase()==='both'?(+portions.eSingleServ||0)+(+portions.cSingleServ||0):(person==='c'?(+portions.cSingleServ||0):(+portions.eSingleServ||0));
    const portionScale=portionServings>0?portionServings/serves:1;
    const scaledMatches=baseCoverage.matches.map(match=>{const used=match.used*portionScale;return {...match,used,remainder:match.available==null?null:Math.max(0,match.available-used)};});
    const knownUtilisation=scaledMatches.reduce((sum,row)=>sum+(row.available>0?Math.min(row.used,row.available)/row.available:0),0);
    const coverage={...baseCoverage,matches:scaledMatches,score:scaledMatches.length*100+knownUtilisation*35-baseCoverage.otherIngredients};
    const cal=person==='c'?portions.cCal:portions.eCal;
    const prot=person==='c'?portions.cProt:portions.eProt;
    const target=getBudgets(person,mealType);
    const nutritionFit=calculateFit(cal||0,prot||0,target.cal||1,target.prot||1);
    return {...option,useUpCoverage:coverage,useUpRank:coverage.score-(nutritionFit.score||0)*12-(option.historyRank||0)*8,active};
  }).sort((a,b)=>b.useUpRank-a.useUpRank||(a.label||'').localeCompare(b.label||''));
}
function applyUseUpSelectionsToPlan(slots,selections){
  const selected=getUseUpEntries().filter(entry=>isUsableProduct(entry.product));
  Object.values(slots||{}).forEach(day=>Object.values(day||{}).forEach(slot=>{
    const info=getPlanSlotInfo(slot);
    const recipe=info.active;
    if(!recipe)return;
    (recipe.ingredients||[]).forEach(ing=>{
      const groupId=getRecipeIngredientGroupId(ing);
      const entry=selected.find(item=>item.product.groupId&&item.product.groupId===groupId);
      if(entry)selections[groupId]=entry.productId;
    });
  }));
  return selections;
}

function setPrioritiseUseUpProducts(checked){
  state.prefs.prioritiseUseUpProducts=!!checked&&getUseUpEntries().length>0;
  saveState();
  renderUseUpProductsEditor();
}
function useUpQuantityLabel(entry){
  if(!entry||entry.unit==='unknown'||!(+entry.quantity>0))return 'Quantity unknown';
  const labels={g:'g',ml:'ml',item:' items',pack:' packs'};
  return `${round1(entry.quantity)}${labels[entry.unit]||''}`;
}
function renderUseUpProductsEditor(){
  const host=document.getElementById('use-up-products-editor');
  const toggle=document.getElementById('plan-prioritise-use-up');
  const entries=getUseUpEntries();
  if(toggle){toggle.checked=!!state.prefs.prioritiseUseUpProducts;toggle.disabled=!entries.length;}
  if(!host)return;
  host.innerHTML=`<div class="use-up-add"><div class="mapping-search-container"><input id="use-up-product-search" type="search" placeholder="Search Product Bank…" autocomplete="off" oninput="renderUseUpProductSuggestions(this.value)" onfocus="renderUseUpProductSuggestions(this.value)"><div class="map-dropdown" id="use-up-product-suggestions" style="display:none"></div></div></div>
    <div class="use-up-list">${entries.length?entries.map(entry=>`<div class="use-up-row"><div class="use-up-product"><strong>${ppEscapeHtml(entry.product.name)}</strong><small>${ppEscapeHtml(getGroupHierarchyText(getIngredientGroup(entry.product.groupId)||{cat:entry.product.cat,name:entry.product.name}))}</small></div><input type="number" min="0" step="0.1" value="${entry.quantity||''}" aria-label="Available quantity for ${ppEscapeAttr(entry.product.name)}" oninput="updateUseUpProduct('${ppEscapeAttr(entry.productId)}','quantity',this.value,false)"><select aria-label="Available unit for ${ppEscapeAttr(entry.product.name)}" onchange="updateUseUpProduct('${ppEscapeAttr(entry.productId)}','unit',this.value,false)">${[['unknown','Unknown'],['g','grams'],['ml','millilitres'],['item','items'],['pack','packs']].map(([value,label])=>`<option value="${value}"${entry.unit===value?' selected':''}>${label}</option>`).join('')}</select><button class="btn sm ghost" type="button" onclick="removeUseUpProduct('${ppEscapeAttr(entry.productId)}')">Remove</button></div>`).join(''):'<div class="empty compact">No products added yet.</div>'}</div>`;
}
function renderUseUpProductSuggestions(query=''){
  const host=document.getElementById('use-up-product-suggestions');if(!host)return;
  const q=canonicalGroupKey(query);
  const selected=new Set(Object.keys(state.useUpProducts||{}));
  const rows=(state.ingredients||[]).filter(product=>!selected.has(product.id)&&(!q||canonicalGroupKey([product.name,product.brand,getProductFamily(product)].join(' ')).includes(q))).slice(0,30);
  host.innerHTML=rows.map(product=>`<button type="button" class="map-drop-item" onclick="addUseUpProduct('${ppEscapeAttr(product.id)}')"><strong>${ppEscapeHtml(product.name)}</strong><small>${ppEscapeHtml(getGroupHierarchyText(getIngredientGroup(product.groupId)||{cat:product.cat,name:product.name}))}</small></button>`).join('')||'<div class="empty compact">No matching products.</div>';
  host.style.display='block';
}
function addUseUpProduct(productId){
  if(!getProduct(productId))return;
  if(!state.useUpProducts)state.useUpProducts={};
  state.useUpProducts[productId]={quantity:null,unit:'unknown'};
  saveState();platePlanUseUpCoverageCache.clear();renderUseUpProductsEditor();
}
let platePlanUseUpSaveTimer=null;
function updateUseUpProduct(productId,field,value,rerender=true){
  const entry=state.useUpProducts?.[productId];if(!entry)return;
  if(field==='quantity')entry.quantity=+value||null;
  if(field==='unit')entry.unit=['g','ml','item','pack','unknown'].includes(value)?value:'unknown';
  platePlanUseUpCoverageCache.clear();
  clearTimeout(platePlanUseUpSaveTimer);platePlanUseUpSaveTimer=setTimeout(()=>saveState(),180);
  if(rerender)renderUseUpProductsEditor();
}
function removeUseUpProduct(productId){
  delete state.useUpProducts?.[productId];
  if(!getUseUpEntries().length)state.prefs.prioritiseUseUpProducts=false;
  saveState();platePlanUseUpCoverageCache.clear();renderUseUpProductsEditor();
}
function clearUseUpProducts(){
  if(!getUseUpEntries().length)return;
  openAppConfirmModal('Clear Use up products?','This removes the shared stock guidance. It does not change your Product Bank or active plan.','Clear list',()=>{state.useUpProducts={};state.prefs.prioritiseUseUpProducts=false;saveState();platePlanUseUpCoverageCache.clear();renderUseUpProductsEditor();});
}

function getPinnedRecipesList(){
  return Array.isArray(state.prefs?.pinnedRecipes) ? state.prefs.pinnedRecipes : [];
}

let currentPinnedPickerFilter = 'all';
let currentPinnedPickerSearch = '';

function setPreferEnhancedRecipes(checked){
  if(!state.prefs) state.prefs = {};
  state.prefs.preferEnhancedRecipes = !!checked;
  saveState();
}

function renderPinnedRecipesEditor(){
  const host = document.getElementById('pinned-recipes-editor');
  if(!host) return;
  const list = getPinnedRecipesList();
  const maxDays = parseInt(state.plan?.days || document.getElementById('plan-days')?.value) || 7;
  
  host.innerHTML = `<div class="pinned-recipes-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn primary sm" onclick="openPinnedRecipePicker()" style="display:inline-flex;align-items:center;gap:6px">
        <span>+</span> Add pre-selected recipe
      </button>
      ${list.length ? `<button type="button" class="btn ghost sm" onclick="clearPinnedRecipes()" style="color:var(--red)">Clear all (${list.length})</button>` : ''}
    </div>
    <div class="pinned-recipes-list">
      ${list.length ? list.map(item => {
        const rec = getRecipe(item.recipeId);
        const name = rec ? rec.name : 'Unknown Recipe';
        const isEnhanced = item.variant === 'enhanced';
        const daysCount = parseInt(item.daysCount) || 1;
        const targetDay = item.targetDay ? parseInt(item.targetDay) : 0;
        let dayOptions = '<option value="0"' + (targetDay === 0 ? ' selected' : '') + '>Any day</option>';
        for(let d = 1; d <= maxDays; d++){
          dayOptions += '<option value="' + d + '"' + (targetDay === d ? ' selected' : '') + '>Day ' + d + '</option>';
        }
        const recipeType = (rec?.types && rec?.types[0]) || rec?.type || 'dinner';
        return `<div class="pinned-recipe-row">
          <div class="pinned-recipe-info">
            <strong>${ppEscapeHtml(name)}${isEnhanced ? ' <span class="tag enhanced-pill">✨ Enhanced</span>' : ''}</strong>
            <small>${ppEscapeHtml(toTitleCase(recipeType))} · ${ppEscapeHtml(rec?.who === 'both' ? 'Shared' : rec?.who || 'Any')}</small>
          </div>
          <div>
            <select aria-label="Repeat count for ${ppEscapeAttr(name)}" onchange="updatePinnedRecipe('${ppEscapeAttr(item.recipeId)}','${ppEscapeAttr(item.variant || 'original')}','daysCount',this.value)">
              ${[1,2,3,4,5,6,7].map(num => `<option value="${num}"${daysCount === num ? ' selected' : ''}>${num} day${num > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <select aria-label="Target day for ${ppEscapeAttr(name)}" onchange="updatePinnedRecipe('${ppEscapeAttr(item.recipeId)}','${ppEscapeAttr(item.variant || 'original')}','targetDay',this.value)">
              ${dayOptions}
            </select>
          </div>
          <button class="btn sm ghost" type="button" onclick="removePinnedRecipe('${ppEscapeAttr(item.recipeId)}','${ppEscapeAttr(item.variant || 'original')}');" aria-label="Remove ${ppEscapeAttr(name)}" style="color:var(--text2)">✕</button>
        </div>`;
      }).join('') : '<div class="empty compact" style="text-align:center;padding:16px 8px;color:var(--text2)">No pre-selected recipes added. Tap "+ Add pre-selected recipe" to pin specific meals before generating.</div>'}
    </div>
  </div>`;
}

function openPinnedRecipePicker(){
  let wrap = document.getElementById('pinned-recipe-picker-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.id = 'pinned-recipe-picker-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }
  
  currentPinnedPickerFilter = 'all';
  currentPinnedPickerSearch = '';
  
  wrap.innerHTML = `<div class="modal recipe-picker-modal" role="dialog" aria-modal="true" aria-labelledby="pinned-picker-title">
    <div class="recipe-picker-head">
      <div>
        <h3 id="pinned-picker-title" style="margin:0;font-size:18px;font-weight:750">Pre-select Recipes</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Pin recipes to guarantee placement in your plan</div>
      </div>
      <button class="btn sm ghost" type="button" onclick="closePinnedRecipePicker()" aria-label="Close">✕</button>
    </div>

    <div class="recipe-picker-search-bar">
      <span class="recipe-picker-search-icon">🔍</span>
      <input type="search" id="pinned-picker-search-input" placeholder="Search recipe name, ingredients, tags…" autocomplete="off" oninput="handlePinnedPickerSearch(this.value)">
      <button type="button" class="recipe-picker-clear-btn" id="pinned-picker-clear-btn" style="display:none" onclick="clearPinnedPickerSearch()">✕</button>
    </div>

    <div style="margin-bottom:12px;overflow-x:auto;padding-bottom:2px">
      <div class="segmented-control" role="tablist">
        <button type="button" role="tab" class="active" id="pinned-tab-all" onclick="setPinnedRecipePickerFilter('all')">All</button>
        <button type="button" role="tab" id="pinned-tab-enhanced" onclick="setPinnedRecipePickerFilter('enhanced')">✨ Enhanced</button>
        <button type="button" role="tab" id="pinned-tab-original" onclick="setPinnedRecipePickerFilter('original')">Original</button>
        <button type="button" role="tab" id="pinned-tab-breakfast" onclick="setPinnedRecipePickerFilter('breakfast')">Breakfast</button>
        <button type="button" role="tab" id="pinned-tab-lunch" onclick="setPinnedRecipePickerFilter('lunch')">Lunch</button>
        <button type="button" role="tab" id="pinned-tab-dinner" onclick="setPinnedRecipePickerFilter('dinner')">Dinner</button>
      </div>
    </div>

    <div class="recipe-picker-list" id="pinned-picker-list-container"></div>

    <div class="row-between" style="margin-top:14px;align-items:center;flex-shrink:0">
      <div style="font-size:12px;color:var(--text2)" id="pinned-picker-count"></div>
      <button class="btn ghost sm" type="button" onclick="closePinnedRecipePicker()">Done</button>
    </div>
  </div>`;

  wrap.classList.add('open');
  renderPinnedRecipePickerList();
  setTimeout(() => document.getElementById('pinned-picker-search-input')?.focus(), 50);
}

function closePinnedRecipePicker(){
  const wrap = document.getElementById('pinned-recipe-picker-wrap');
  if(wrap) wrap.classList.remove('open');
  renderPinnedRecipesEditor();
}

function setPinnedRecipePickerFilter(filter){
  currentPinnedPickerFilter = filter;
  ['all','enhanced','original','breakfast','lunch','dinner'].forEach(f => {
    const tab = document.getElementById(`pinned-tab-${f}`);
    if(tab) tab.classList.toggle('active', f === filter);
  });
  renderPinnedRecipePickerList();
}

function handlePinnedPickerSearch(value){
  currentPinnedPickerSearch = String(value || '').trim();
  const clearBtn = document.getElementById('pinned-picker-clear-btn');
  if(clearBtn) clearBtn.style.display = currentPinnedPickerSearch ? 'block' : 'none';
  renderPinnedRecipePickerList();
}

function clearPinnedPickerSearch(){
  const input = document.getElementById('pinned-picker-search-input');
  if(input) { input.value = ''; input.focus(); }
  handlePinnedPickerSearch('');
}

function renderPinnedRecipePickerList(){
  const host = document.getElementById('pinned-picker-list-container');
  if(!host) return;
  const countHost = document.getElementById('pinned-picker-count');
  const q = currentPinnedPickerSearch.toLowerCase();
  const filter = currentPinnedPickerFilter;
  const pinned = getPinnedRecipesList();
  const pinnedKeys = new Set(pinned.map(p => `${p.recipeId}::${p.variant || 'original'}`));

  const rows = [];
  (state.recipes || []).forEach(r => {
    if(!r || !r.id) return;
    const rTypes = (r.types || [r.type || 'dinner']).map(t => String(t).toLowerCase());
    const rType = rTypes[0] || 'dinner';
    const matchType = !['breakfast','lunch','dinner'].includes(filter) || rTypes.includes(filter);
    if(!matchType) return;

    const ingText = (r.ingredients || []).map(i => i.name || i.ingredient || '').join(' ').toLowerCase();
    const searchMatch = !q || r.name.toLowerCase().includes(q) || rType.includes(q) || ingText.includes(q);
    if(!searchMatch) return;

    // Original version candidate
    if(filter !== 'enhanced') {
      const isPinned = pinnedKeys.has(`${r.id}::original`);
      rows.push({
        id: r.id,
        variant: 'original',
        recipe: r,
        name: r.name,
        type: rType,
        who: r.who || 'both',
        isPinned,
        isEnhanced: false
      });
    }

    // Enhanced version candidate
    if(filter !== 'original' && r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes)) {
      const isPinned = pinnedKeys.has(`${r.id}::enhanced`);
      rows.push({
        id: r.id,
        variant: 'enhanced',
        recipe: r,
        name: r.enhanced.name || (r.name + ' (Enhanced)'),
        type: rType,
        who: r.who || 'both',
        isPinned,
        isEnhanced: true
      });
    }
  });

  if(countHost) countHost.textContent = `${rows.length} recipe option${rows.length === 1 ? '' : 's'}`;

  if(!rows.length){
    host.innerHTML = `<div class="empty compact" style="text-align:center;padding:32px 16px;color:var(--text2)">
      <div>No matching recipes found for "${ppEscapeHtml(currentPinnedPickerSearch || currentPinnedPickerFilter)}".</div>
    </div>`;
    return;
  }

  host.innerHTML = rows.map(item => {
    let macroSummary = '';
    try {
      const bundle = calculateRecipeDisplayNutrition({ recipe: item.recipe, variant: item.variant, mealType: item.type });
      const portions = bundle?.portions;
      if(portions) {
        const cal = Math.round(portions.eCal || portions.cCal || item.recipe.cal || 0);
        const prot = round1(portions.eProt || portions.cProt || item.recipe.prot || 0);
        macroSummary = `<span class="slot-macro" style="font-size:11px">${cal} kcal · P${prot}g</span>`;
      }
    } catch(e){}

    return `<div class="recipe-picker-item" onclick="togglePinnedPickerSelection('${ppEscapeAttr(item.id)}','${ppEscapeAttr(item.variant)}')">
      <div class="recipe-picker-item-main">
        <div class="recipe-picker-item-title">
          <span>${ppEscapeHtml(item.name)}</span>
          ${item.isEnhanced ? '<span class="tag enhanced-pill">✨ Enhanced</span>' : ''}
          ${item.isPinned ? '<span class="tag pinned">Pre-selected</span>' : ''}
        </div>
        <div class="recipe-picker-item-sub">
          <span>${ppEscapeHtml(toTitleCase(item.type))}</span>
          <span>·</span>
          <span>${ppEscapeHtml(item.who === 'both' ? 'Shared' : item.who || 'Any')}</span>
        </div>
      </div>
      <div class="recipe-picker-item-macros">
        ${macroSummary}
        <button type="button" class="btn sm ${item.isPinned ? 'ghost' : 'primary'}" style="min-width:64px;pointer-events:none">
          ${item.isPinned ? 'Remove' : '+ Select'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function togglePinnedPickerSelection(recipeId, variant){
  const pinned = getPinnedRecipesList();
  const exists = pinned.find(p => p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original'));
  if(exists){
    removePinnedRecipe(recipeId, variant);
  } else {
    addPinnedRecipe(recipeId, variant);
  }
  renderPinnedRecipePickerList();
}

function addPinnedRecipe(recipeId, variant = 'original'){
  if(!state.prefs) state.prefs = {};
  if(!Array.isArray(state.prefs.pinnedRecipes)) state.prefs.pinnedRecipes = [];
  const exists = state.prefs.pinnedRecipes.find(p => p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original'));
  if(!exists){
    state.prefs.pinnedRecipes.push({ recipeId, variant: variant || 'original', daysCount: 1, targetDay: 0 });
    saveState();
    renderPinnedRecipesEditor();
  }
}
function updatePinnedRecipe(recipeId, variant, field, value){
  const list = getPinnedRecipesList();
  const entry = list.find(p => p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original'));
  if(!entry) return;
  if(field === 'daysCount') entry.daysCount = Math.max(1, parseInt(value) || 1);
  if(field === 'targetDay') entry.targetDay = Math.max(0, parseInt(value) || 0);
  saveState();
  renderPinnedRecipesEditor();
}
function removePinnedRecipe(recipeId, variant = 'original'){
  if(!Array.isArray(state.prefs?.pinnedRecipes)) return;
  state.prefs.pinnedRecipes = state.prefs.pinnedRecipes.filter(p => !(p.recipeId === recipeId && (p.variant || 'original') === (variant || 'original')));
  saveState();
  renderPinnedRecipesEditor();
}
function clearPinnedRecipes(){
  if(!getPinnedRecipesList().length) return;
  openAppConfirmModal('Clear Pre-selected Recipes?','This removes all pre-selected recipes from the planner options.','Clear all',()=>{
    state.prefs.pinnedRecipes = [];
    saveState();
    renderPinnedRecipesEditor();
  });
}

function lockProductSelectionsForSlots(slots, priority){
  const selections = {};
  Object.values(slots || {}).forEach(day => {
    Object.values(day || {}).forEach(slot => {
      const r = getPlanSlotInfo(slot).active;
      if(!r) return;
      (r.ingredients || []).forEach(ing => {
        const groupId = getRecipeIngredientGroupId(ing);
        if(!groupId || selections[groupId]) return;
        const best = selectBestProductForGroup(groupId, priority) || resolveProductForIngredient(ing).product;
        if(best) selections[groupId] = best.id;
      });
    });
  });
  return selections;
}

function findProductResolutionBlockersForSlots(slots, selections = {}){
  const blockers = [];
  const seen = new Set();
  Object.values(slots || {}).forEach(day => {
    Object.values(day || {}).forEach(slot => {
      const r = getPlanSlotInfo(slot).active;
      if(!r) return;
      (r.ingredients || []).forEach(ing => {
        if(ing.excludeNutrition) return;
        const groupId = getRecipeIngredientGroupId(ing);
        if(!groupId || seen.has(groupId)) return;
        const resolved = resolveProductForIngredient(ing, { productSelections: selections });
        if(!resolved.product || !isUsableProduct(resolved.product)){
          seen.add(groupId);
          blockers.push(resolved.group?.name || ing.name || ing.raw || 'Ingredient');
        }
      });
    });
  });
  return blockers;
}

function getPlatePlanLocalToday(){
  return formatPlanLocalDateValue(new Date());
}

function formatTodayDateLabel(value){
  const date=parsePlanLocalDate(value);
  return date ? new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(date) : '';
}

function resetTodayDate({render=true}={}){
  platePlanTodayDate=getPlatePlanLocalToday();
  platePlanLastActualDate=platePlanTodayDate;
  if(render) renderToday();
}

function moveTodayDate(amount){
  const date=parsePlanLocalDate(platePlanTodayDate)||parsePlanLocalDate(getPlatePlanLocalToday());
  date.setDate(date.getDate()+(+amount||0));
  platePlanTodayDate=formatPlanLocalDateValue(date);
  renderToday();
}

function getTodayPlanDay(dateValue,planContext=state?.plan){
  return Object.entries(planContext?.dayDates||{}).find(([,value])=>value===dateValue)?.[0]||'';
}

function getNextDatedPlanDay(dateValue,planContext=state?.plan){
  return Object.entries(planContext?.dayDates||{})
    .filter(([,value])=>parsePlanLocalDate(value)&&value>dateValue)
    .sort((a,b)=>a[1].localeCompare(b[1]))[0]||null;
}

function stablePlatePlanValue(value){
  if(Array.isArray(value)) return value.map(stablePlatePlanValue);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stablePlatePlanValue(value[key])]));
  return value;
}

function getTodayResolvedFingerprint(info,mealType){
  if(!info?.active) return '';
  const context=getPlanContextForInstance(info.instanceId);
  const ingredients=(info.active.ingredients||[]).map(ingredient=>{
    const key=getRecipeIngredientKey(ingredient);
    if(isIngredientRemovedInContext(ingredient,context)) return {key,removed:true};
    const adjusted=getAdjustedIngredientForContext(ingredient,context);
    const resolved=resolveProductForIngredientWithContext(adjusted,context);
    return {
      key,
      qty:+adjusted.qty||0,
      unit:adjusted.unit||'',
      productId:resolved.productId||resolved.product?.id||'',
      mergeInto:context.mergeInto?.[key]||''
    };
  });
  return JSON.stringify(stablePlatePlanValue({
    recipeId:info.id,
    variant:info.variant||'original',
    mealType,
    ingredients
  }));
}

function getTodaySlotEntry(day,slotKey,person,mealType){
  if(state.excluded?.[day]?.[slotKey]) return null;
  const info=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.active) return null;
  const calculated=getPlannedSlotNutrition(info.active,slotKey,info.instanceId,state.plan);
  return {day,slotKey,person,mealType,info,calculated,fingerprint:getTodayResolvedFingerprint(info,mealType)};
}

function renderTodayPersonPanel(person,label,entries){
  const rows=['breakfast','lunch','dinner'].map(mealType=>{
    const entry=entries.find(item=>item.person===person&&item.mealType===mealType);
    const actualCal=Math.round(entry?.calculated?.cal||0);
    const actualProt=Math.round((entry?.calculated?.prot||0)*10)/10;
    const target=getBudgets(person,mealType);
    const calPct=target.cal?Math.min(100,Math.round(actualCal/target.cal*100)):0;
    const protPct=target.prot?Math.min(100,Math.round(actualProt/target.prot*100)):0;
    return `<div class="today-target-row">
      <div class="today-target-meal">${ppEscapeHtml(toTitleCase(mealType))}</div>
      <div class="today-target-values">
        <div class="today-target-line"><span>${actualCal} / ${Math.round(target.cal)} kcal</span><span>${actualProt} / ${Math.round(target.prot)}g protein</span></div>
        <div class="today-progress" role="progressbar" aria-label="${ppEscapeAttr(toTitleCase(mealType))} calories" aria-valuemin="0" aria-valuemax="${Math.round(target.cal)}" aria-valuenow="${actualCal}"><span style="--progress:${calPct}%"></span></div>
        <div class="today-progress protein" role="progressbar" aria-label="${ppEscapeAttr(toTitleCase(mealType))} protein" aria-valuemin="0" aria-valuemax="${Math.round(target.prot)}" aria-valuenow="${actualProt}" style="margin-top:4px"><span style="--progress:${protPct}%"></span></div>
      </div>
    </div>`;
  }).join('');
  return `<section class="today-person" aria-label="${ppEscapeAttr(label)} meal nutrition">
    <div class="today-person-head"><div class="today-person-name">${ppEscapeHtml(label)}</div><div class="today-person-copy">Meal allocation</div></div>
    ${rows}
  </section>`;
}

function isMealEatenOnDate(dateStr, mealType, person = 'both'){
  if(!state.plan) return false;
  state.plan.eatenMeals = state.plan.eatenMeals || {};
  if(person === 'e') {
    return !!(state.plan.eatenMeals[`${dateStr}:${mealType}:e`] || state.plan.eatenMeals[`${dateStr}:${mealType}`]);
  }
  if(person === 'c') {
    return !!(state.plan.eatenMeals[`${dateStr}:${mealType}:c`] || state.plan.eatenMeals[`${dateStr}:${mealType}`]);
  }
  return !!(state.plan.eatenMeals[`${dateStr}:${mealType}`] || (state.plan.eatenMeals[`${dateStr}:${mealType}:e`] && state.plan.eatenMeals[`${dateStr}:${mealType}:c`]));
}

function toggleMealEatenOnDate(dateStr, mealType, person = 'both'){
  if(!state.plan) return;
  state.plan.eatenMeals = state.plan.eatenMeals || {};
  
  if(person === 'e'){
    const nextState = !isMealEatenOnDate(dateStr, mealType, 'e');
    state.plan.eatenMeals[`${dateStr}:${mealType}:e`] = nextState;
    if(!nextState) delete state.plan.eatenMeals[`${dateStr}:${mealType}`];
    showPlatePlanToast(nextState ? `Marked Elliott's ${toTitleCase(mealType)} as eaten ✓` : `Unmarked Elliott's ${toTitleCase(mealType)}`);
  } else if(person === 'c'){
    const nextState = !isMealEatenOnDate(dateStr, mealType, 'c');
    state.plan.eatenMeals[`${dateStr}:${mealType}:c`] = nextState;
    if(!nextState) delete state.plan.eatenMeals[`${dateStr}:${mealType}`];
    showPlatePlanToast(nextState ? `Marked Chloe's ${toTitleCase(mealType)} as eaten ✓` : `Unmarked Chloe's ${toTitleCase(mealType)}`);
  } else {
    const nextState = !isMealEatenOnDate(dateStr, mealType, 'both');
    state.plan.eatenMeals[`${dateStr}:${mealType}`] = nextState;
    state.plan.eatenMeals[`${dateStr}:${mealType}:e`] = nextState;
    state.plan.eatenMeals[`${dateStr}:${mealType}:c`] = nextState;
    showPlatePlanToast(nextState ? `Marked ${toTitleCase(mealType)} as eaten ✓` : `Unmarked ${toTitleCase(mealType)}`);
  }

  saveState(true);
  if(platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();

  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
}

function renderTodayMealCard(group, mealType = 'dinner'){
  const isShared = group.length === 2;
  const entry = group[0];
  const info = entry.info;
  const personKey = isShared ? 'both' : entry.person;
  const isEaten = isMealEatenOnDate(platePlanTodayDate, mealType, personKey);
  const people = group.map(item=>item.person==='e'?'Elliott':'Chloe');

  const macroText = isShared
    ? `${Math.round(entry.calculated?.cal||0)} kcal · ${Math.round((entry.calculated?.prot||0)*10)/10}g protein`
    : `${Math.round(entry.calculated?.cal||0)} kcal · ${Math.round((entry.calculated?.prot||0)*10)/10}g protein`;

  const portions = group.map(item=>{
    const nutrition = item.calculated||{};
    const portionValue = item.person==='e'
      ? item.calculated?.portions?.eSingleServ
      : item.calculated?.portions?.cSingleServ;
    const personName = item.person==='e'?'Elliott':'Chloe';
    return `<div class="today-portion"><strong>${personName} · ${Math.round(nutrition.cal||0)} kcal · ${Math.round((nutrition.prot||0)*10)/10}g protein</strong>${Math.round((portionValue||0)*10)/10} serving${Math.abs((portionValue||0)-1)<.001?'':'s'}</div>`;
  }).join('');

  const toggleCall = `toggleMealEatenOnDate('${platePlanTodayDate}','${ppEscapeAttr(mealType)}','${ppEscapeAttr(personKey)}')`;

  return `<article class="today-meal-card ${isEaten ? 'eaten-card' : ''}" id="today-card-${ppEscapeAttr(mealType)}-${ppEscapeAttr(personKey)}">
    <div class="today-meal-card-top">
      <div class="today-meal-card-left">
        <button class="today-eaten-circle ${isEaten ? 'is-checked' : ''}" type="button" aria-label="${isEaten ? 'Mark as not eaten' : 'Mark as eaten'}" onclick="${toggleCall}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <div class="today-meal-info">
          <div class="today-meal-name" style="${isEaten ? 'text-decoration:line-through;opacity:0.75' : ''}">
            ${ppEscapeHtml(info.active.name||info.recipe?.name||'Recipe')}
          </div>
          <div class="today-meal-meta">
            <span class="tag">${ppEscapeHtml(people.join(' & '))}</span>
            <span class="tag">${ppEscapeHtml(info.variant==='enhanced'?'Enhanced':'Original')}</span>
            ${isEaten ? `<span class="tag success" style="background:#10b9811f;color:#10b981;border:1px solid #10b98144;font-weight:600">Eaten</span>` : ''}
          </div>
        </div>
      </div>
      <div class="today-meal-macro-pill">${ppEscapeHtml(macroText)}</div>
    </div>
    <div class="today-card-disclosure-row">
      <details class="today-card-disclosure">
        <summary>
          <span>Portions & details</span>
          <span class="today-card-disclosure-arrow">▾</span>
        </summary>
        <div class="today-portions">${portions}</div>
        <div class="today-card-actions">
          <button class="btn ghost sm" type="button" onclick="openPlanReschedule(${+entry.day},'${ppEscapeAttr(entry.slotKey)}')">Reschedule meal</button>
        </div>
      </details>
      <button class="btn primary sm today-view-recipe-btn" type="button" onclick="viewRecipe('${ppEscapeAttr(info.id)}','${ppEscapeAttr(info.instanceId||'')}','${ppEscapeAttr(info.variant||'original')}')">View recipe</button>
    </div>
  </article>`;
}

function renderTodayReasonCard(group){
  const entry=group[0];
  const people=group.map(item=>item.person==='e'?'Elliott':'Chloe').join(' & ');
  return `<article class="today-reason-card">
    <strong>${ppEscapeHtml(formatPlanSlotReason(entry.reason))}</strong>
    <div style="color:var(--text2)">${ppEscapeHtml(people)} · no recipe scheduled</div>
  </article>`;
}

function renderTodayEmpty(title,copy,actions=''){
  return `<div class="today-empty"><h3>${ppEscapeHtml(title)}</h3><p>${ppEscapeHtml(copy)}</p>${actions?`<div class="btn-row">${actions}</div>`:''}</div>`;
}

function renderToday(){
  const host=document.getElementById('today-content');
  if(!host||!state) return;
  try {
    if(!platePlanTodayDate) platePlanTodayDate=getPlatePlanLocalToday();
    const label=document.getElementById('today-date-label');
    const subtitle=document.getElementById('today-subtitle');
    if(label) label.textContent=formatTodayDateLabel(platePlanTodayDate);
    if(!state.plan?.slots||!Object.keys(state.plan.slots).length){
      if(subtitle) subtitle.textContent='Your planned meals';
      host.innerHTML=renderTodayEmpty('No active meal plan','Apply a meal plan from your library, or generate a new one in the Meal Planner.',`<button class="btn primary" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner')">Open Meal Planner</button>`);
      return;
    }
    let dated=Object.values(state.plan.dayDates||{}).some(value=>parsePlanLocalDate(value));
    if(!dated && state.plan.slots && Object.keys(state.plan.slots).length){
      const days=state.plan.days||Object.keys(state.plan.slots).length||7;
      state.plan.dayDates=buildPlanDayDates(platePlanTodayDate||getPlatePlanLocalToday(),days);
      state.plan.updatedAt=new Date().toISOString();
      safeLocalStorageSet(SK, safeJsonStringify(state));
      dated=true;
    }
    if(!dated){
      if(subtitle) subtitle.textContent='This plan has no calendar dates';
      host.innerHTML=renderTodayEmpty('Assign dates to this plan','Today only shows meals that are explicitly assigned to a calendar date.',`<button class="btn primary" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan from today</button><button class="btn ghost" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner');setTimeout(()=>openPlanDatesWorkspace(),0)">Assign dates</button>`);
      return;
    }
    const day=getTodayPlanDay(platePlanTodayDate);
    if(!day){
      const next=getNextDatedPlanDay(platePlanTodayDate);
      const nextCopy=next?` The next dated plan day is ${formatPlanDayLabel(state.plan,next[0],{short:true})}.`:'';
      if(subtitle) subtitle.textContent='No plan day is assigned';
      host.innerHTML=renderTodayEmpty('No meals planned for this date',`This date (${formatTodayDateLabel(platePlanTodayDate)}) is not assigned to the active meal plan.${nextCopy}`,`<button class="btn primary" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan cycle from today</button><button class="btn ghost" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner')">Open Meal Planner</button>`);
      return;
    }
    if(subtitle) subtitle.textContent=formatPlanDayLabel(state.plan,day,{short:false});
    const entries=[];
    const reasonEntries=[];
    const mealDefinitions=[
      {mealType:'breakfast',e:'breakfastE',c:'breakfastC'},
      {mealType:'lunch',e:'lunchE',c:'lunchC'},
      {mealType:'dinner',e:'dinnerE',c:'dinnerC'}
    ];
    mealDefinitions.forEach(meal=>{
      const e=getTodaySlotEntry(day,meal.e,'e',meal.mealType);
      const c=getTodaySlotEntry(day,meal.c,'c',meal.mealType);
      if(e) entries.push(e);
      if(c) entries.push(c);
      if(!e){
        const reason=getPlanSlotReason(state.plan,day,meal.e);
        if(reason)reasonEntries.push({day:+day,slotKey:meal.e,person:'e',mealType:meal.mealType,reason});
      }
      if(!c){
        const reason=getPlanSlotReason(state.plan,day,meal.c);
        if(reason)reasonEntries.push({day:+day,slotKey:meal.c,person:'c',mealType:meal.mealType,reason});
      }
    });
    if(!entries.length&&!reasonEntries.length){
      host.innerHTML=renderTodayEmpty('No meals planned for this date','This plan day has no included breakfast, lunch or dinner meals.',`<button class="btn primary" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner')">Open Meal Planner</button>`);
      return;
    }

    // Calculate daily totals for Option A summary
    let eCal=0, eProt=0, cCal=0, cProt=0;
    entries.forEach(item => {
      if(item.person === 'e'){
        eCal += (item.calculated?.cal || 0);
        eProt += (item.calculated?.prot || 0);
      } else if(item.person === 'c'){
        cCal += (item.calculated?.cal || 0);
        cProt += (item.calculated?.prot || 0);
      }
    });
    const eBudgets = ['breakfast','lunch','dinner'].reduce((acc,m)=>{ const b=getBudgets('e',m); return {cal:acc.cal+b.cal, prot:acc.prot+b.prot}; }, {cal:0,prot:0});
    const cBudgets = ['breakfast','lunch','dinner'].reduce((acc,m)=>{ const b=getBudgets('c',m); return {cal:acc.cal+b.cal, prot:acc.prot+b.prot}; }, {cal:0,prot:0});

    const summaryHtml = entries.length ? `<details class="today-summary-accordion" id="today-daily-summary-accordion">
      <summary class="today-summary-summary">
        <div class="today-summary-chips">
          <span class="tag" style="background:var(--action);color:#fff;font-weight:700">Daily Targets</span>
          <span class="today-summary-chip"><strong>Elliott:</strong> ${Math.round(eCal)} / ${Math.round(eBudgets.cal)} kcal · ${Math.round(eProt*10)/10} / ${Math.round(eBudgets.prot)}g protein</span>
          <span class="today-summary-chip"><strong>Chloe:</strong> ${Math.round(cCal)} / ${Math.round(cBudgets.cal)} kcal · ${Math.round(cProt*10)/10} / ${Math.round(cBudgets.prot)}g protein</span>
        </div>
        <span class="today-summary-arrow">▾</span>
      </summary>
      <div class="today-summary-body">
        <div class="today-people">${renderTodayPersonPanel('e','Elliott',entries)}${renderTodayPersonPanel('c','Chloe',entries)}</div>
      </div>
    </details>` : '';

    const mealSections=mealDefinitions.map(meal=>{
      const mealEntries=entries.filter(entry=>entry.mealType===meal.mealType);
      const mealReasons=reasonEntries.filter(entry=>entry.mealType===meal.mealType);
      if(!mealEntries.length&&!mealReasons.length) return null;
      const isEaten=isMealEatenOnDate(platePlanTodayDate,meal.mealType,'both');
      const groups=mealEntries.length===2&&mealEntries[0].fingerprint===mealEntries[1].fingerprint?[mealEntries]:mealEntries.map(entry=>[entry]);
      const reasonGroups=mealReasons.length===2&&formatPlanSlotReason(mealReasons[0].reason)===formatPlanSlotReason(mealReasons[1].reason)?[mealReasons]:mealReasons.map(entry=>[entry]);

      return {
        mealType: meal.mealType,
        isEaten,
        html: `<section class="today-meal-section ${isEaten ? 'is-eaten-section' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h2 class="today-meal-heading" style="margin:0">${ppEscapeHtml(toTitleCase(meal.mealType))}</h2>
            ${isEaten ? `<span class="tag" style="background:#10b98122;color:#10b981;border:1px solid #10b98144;font-weight:600;padding:2px 8px;border-radius:12px;font-size:11px">✓ Eaten</span>` : ''}
          </div>
          ${groups.map(g => renderTodayMealCard(g, meal.mealType)).join('')}
          ${reasonGroups.map(renderTodayReasonCard).join('')}
        </section>`
      };
    }).filter(Boolean);

    mealSections.sort((a,b)=>{
      if(a.isEaten!==b.isEaten) return a.isEaten ? 1 : -1;
      return 0;
    });

    const meals=mealSections.map(s=>s.html).join('');
    host.innerHTML=summaryHtml+meals;
  } catch(err) {
    console.error('Error rendering Today view:', err);
    host.innerHTML = `<div class="card" style="padding:20px;text-align:center;margin:16px 0;">
      <h3 style="margin-top:0">Unable to load today's plan</h3>
      <p style="color:var(--text2);font-size:13px">There was a temporary display issue loading the planned meals for this date.</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn primary sm" onclick="renderToday()">Retry</button>
        <button class="btn ghost sm" onclick="showView('planner')">Open Meal Planner</button>
      </div>
    </div>`;
  }
}

function openApplyPlanFromLibraryModal(){
  let wrap=document.getElementById('apply-plan-library-modal-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='apply-plan-library-modal-wrap';
    wrap.className='modal-wrap';
    document.body.appendChild(wrap);
  }

  const hist=state.planHistory||[];
  const todayStr=getPlatePlanLocalToday();

  let bodyHtml='';
  if(!hist.length){
    bodyHtml=`<div style="text-align:center;padding:28px 16px;color:var(--text2)">
      <div style="font-size:36px;margin-bottom:12px">📚</div>
      <h4 style="margin:0 0 6px 0;font-size:16px;font-weight:700;color:var(--text)">No Saved Meal Plans Yet</h4>
      <p style="font-size:13px;color:var(--text2);margin:0 0 18px 0;line-height:1.4">You don't have any saved meal plans in your library. Generate a meal plan in the planner and save it to reuse anytime.</p>
      <button class="btn primary sm" onclick="closeApplyPlanLibraryModal();showView('planner')">Open Meal Planner</button>
    </div>`;
  } else {
    const cardsHtml=hist.map((p,i)=>{
      const dt=p.date?new Date(p.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Saved plan';
      const dateRange=getPlanDateRangeLabel(p);
      const allIds=getPlanRecipeIds(p);
      const ids=allIds.slice(0,4).map(id=>getProductIndexRecipe(id)?.name||id);
      const remaining=Math.max(0,allIds.length-ids.length);
      const title=p.name||`Saved plan ${i+1}`;
      const score=p.score?.score??p.score??'—';

      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text)">${ppEscapeHtml(title)}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              <span class="tag">${p.days||0} days</span>
              ${dateRange?`<span class="tag">${ppEscapeHtml(dateRange)}</span>`:''}
              <span class="tag">Score ${ppEscapeHtml(score)}</span>
            </div>
          </div>
          <button class="btn primary sm" style="flex-shrink:0" onclick="applyPlanFromLibraryModalConfirm(${i})">Apply Plan</button>
        </div>
        <div style="font-size:11px;color:var(--text3)">
          Saved ${ppEscapeHtml(dt)} · <strong>Recipes:</strong> ${ppEscapeHtml(ids.length?ids.join(', '):'No recipes')}${remaining?` (+${remaining} more)`:''}
        </div>
      </div>`;
    }).join('');

    bodyHtml=`<div style="margin-bottom:14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
      <label style="display:block;font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">Start date for applied plan:</label>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="date" id="apply-plan-library-start-date" class="input" value="${ppEscapeAttr(todayStr)}" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px">
        <span style="font-size:11px;color:var(--text2)">Day 1 will be set to this date</span>
      </div>
    </div>
    <div style="max-height:380px;overflow-y:auto;padding-right:2px">
      ${cardsHtml}
    </div>`;
  }

  wrap.innerHTML=`<div class="modal" style="max-width:580px;width:92vw;max-height:90vh;display:flex;flex-direction:column">
    <div class="row-between" style="align-items:center;margin-bottom:14px;flex-shrink:0">
      <div>
        <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">Apply Meal Plan from Library</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">Select a saved plan to activate on your calendar</div>
      </div>
      <button class="btn sm ghost" onclick="closeApplyPlanLibraryModal()" aria-label="Close modal" style="font-size:16px;padding:4px 10px">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto">
      ${bodyHtml}
    </div>
    <div class="row-between" style="margin-top:14px;align-items:center;flex-shrink:0">
      <button class="btn ghost sm" onclick="closeApplyPlanLibraryModal();showView('planner')">Create New in Planner</button>
      <button class="btn ghost sm" onclick="closeApplyPlanLibraryModal()">Close</button>
    </div>
  </div>`;

  wrap.classList.add('open');
}

function closeApplyPlanLibraryModal(){
  const wrap=document.getElementById('apply-plan-library-modal-wrap');
  if(wrap) wrap.classList.remove('open');
}

function applyPlanFromLibraryModalConfirm(index){
  const startDateInput=document.getElementById('apply-plan-library-start-date');
  const startDate=startDateInput?.value||getPlatePlanLocalToday();
  applyPlanFromLibraryDirect(index,startDate);
  closeApplyPlanLibraryModal();
}

function applyPlanFromLibraryDirect(index,startDate){
  const p=(state.planHistory||[])[index];
  if(!p) return;

  if(state.plan?.slots&&Object.keys(state.plan.slots).length){
    snapshotCurrentPlan('Auto-saved before applying plan from library',defaultPlanSaveName(state.plan));
  }

  const days=p.days||Object.keys(p.slots||{}).length||7;
  const start=startDate||getPlatePlanLocalToday();
  const dayDates=buildPlanDayDates(start,days);

  state.plan={
    days: days,
    slots: clonePlatePlanValue(p.slots||{}),
    dayDates: dayDates,
    slotReasons: clonePlatePlanValue(p.slotReasons||{}),
    productPriority: p.productPriority||state.prefs?.productPriority||'protein',
    productSelections: clonePlatePlanValue(p.productSelections||{}),
    useUpProductIds: clonePlatePlanValue(p.useUpProductIds||[]),
    shoppingAtHome: clonePlatePlanValue(p.shoppingAtHome||{}),
    warnings: [],
    score: calculatePlanScore({days:days,slots:p.slots,productSelections:p.productSelections}),
    confirmedShopping: !!p.confirmedShopping,
    mealPrepGroups: clonePlatePlanValue(p.mealPrepGroups||[]),
    declinedMealPrepGroups: clonePlatePlanValue(p.declinedMealPrepGroups||[]),
    updatedAt: new Date().toISOString(),
    appliedAt: new Date().toISOString()
  };
  state.overrides=clonePlatePlanValue(p.overrides||{});

  platePlanNutritionCache.clear();
  markPlatePlanViewsDirty('today','planner','shopping','planlib');
  saveState(true);
  if(platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
  renderPlan();
  showView('today');
  showPlatePlanToast(`Applied "${p.name||'Saved Plan'}" starting ${start}`);
}

function rollActivePlanToDate(startDate){
  if(!state?.plan?.slots||!Object.keys(state.plan.slots).length) return;
  const start=startDate||getPlatePlanLocalToday();
  const days=state.plan.days||Object.keys(state.plan.slots).length||7;
  state.plan.dayDates=buildPlanDayDates(start,days);
  state.plan.updatedAt=new Date().toISOString();
  platePlanNutritionCache.clear();
  markPlatePlanViewsDirty('today','planner','shopping','planlib');
  saveState(true);
  renderPlan();
  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
  showPlatePlanToast(`Plan dates rolled forward starting ${formatTodayDateLabel(start)}`);
}

window.openApplyPlanFromLibraryModal=openApplyPlanFromLibraryModal;
window.closeApplyPlanLibraryModal=closeApplyPlanLibraryModal;
window.applyPlanFromLibraryModalConfirm=applyPlanFromLibraryModalConfirm;
window.applyPlanFromLibraryDirect=applyPlanFromLibraryDirect;
window.rollActivePlanToDate=rollActivePlanToDate;
window.toggleMealEatenOnDate=toggleMealEatenOnDate;
window.isMealEatenOnDate=isMealEatenOnDate;

function scheduleTodayMidnightRefresh(){
  clearTimeout(platePlanTodayTimer);
  const now=new Date();
  const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
  platePlanTodayTimer=setTimeout(()=>{
    const previousActual=platePlanLastActualDate||formatPlanLocalDateValue(now);
    const wasActualDate=platePlanTodayDate===previousActual;
    platePlanLastActualDate=getPlatePlanLocalToday();
    if(wasActualDate) platePlanTodayDate=getPlatePlanLocalToday();
    if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
    scheduleTodayMidnightRefresh();
  },Math.max(1000,next.getTime()-now.getTime()));
}


// == PLANNER ==
function parsePlanLocalDate(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return null;
  const date=new Date(+match[1],+match[2]-1,+match[3],12,0,0,0);
  return date.getFullYear()===+match[1]&&date.getMonth()===+match[2]-1&&date.getDate()===+match[3]?date:null;
}
function formatPlanLocalDateValue(date){
  if(!(date instanceof Date)||Number.isNaN(date.getTime()))return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function buildPlanDayDates(startDate,days){
  const first=parsePlanLocalDate(startDate);if(!first)return {};
  const result={};for(let day=1;day<=(+days||0);day++){const date=new Date(first);date.setDate(first.getDate()+day-1);result[day]=formatPlanLocalDateValue(date);}return result;
}
function formatPlanDayLabel(planContext,day,{short=false}={}){
  const base=`Day ${day}`;const date=parsePlanLocalDate(planContext?.dayDates?.[day]);if(!date)return base;
  const formatted=new Intl.DateTimeFormat('en-GB',short?{weekday:'short',day:'numeric',month:'short'}:{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(date);
  return `${base} · ${formatted}`;
}
function getPlanDateRangeLabel(planContext){
  const rows=Object.entries(planContext?.dayDates||{}).filter(([,value])=>parsePlanLocalDate(value)).sort((a,b)=>+a[0]-+b[0]);
  if(!rows.length)return '';
  const first=formatPlanDayLabel(planContext,rows[0][0],{short:true}).replace(/^Day \d+ · /,'');
  const last=formatPlanDayLabel(planContext,rows[rows.length-1][0],{short:true}).replace(/^Day \d+ · /,'');
  return first===last?first:`${first} – ${last}`;
}
function validatePlanDayDates(dayDates){
  const rows=Object.entries(dayDates||{}).filter(([,value])=>value).sort((a,b)=>+a[0]-+b[0]);let previous='';const seen=new Set();
  for(const [day,value] of rows){if(!parsePlanLocalDate(value))return `Day ${day} has an invalid date.`;if(seen.has(value))return 'Each meal-plan day needs a different calendar date.';if(previous&&value<=previous)return 'Calendar dates must follow the same order as the meal-plan days.';seen.add(value);previous=value;}
  return '';
}
function setPlanDayDate(day,value){
  if(!state.plan?.slots)return;
  const next={...(state.plan.dayDates||{})};if(value)next[day]=value;else delete next[day];
  const error=validatePlanDayDates(next);if(error){showMsg('plan-warnings',error,'error');renderPlan();return;}
  state.plan.dayDates=next;saveState();markPlatePlanViewsDirty('today','shopping','planlib');renderPlan();renderPlanHistoryPanel();
}
function applyPlanCalendarStart(){
  if(!state.plan?.slots)return showMsg('plan-warnings','Generate a meal plan before applying calendar dates.','warn');
  const start=document.getElementById('plan-start-date')?.value||'';
  if(!start)return clearPlanCalendarDates();
  state.plan.dayDates=buildPlanDayDates(start,state.plan.days||Object.keys(state.plan.slots||{}).length);saveState();markPlatePlanViewsDirty('today','shopping','planlib');renderPlan();
}
function clearPlanCalendarDates(){
  const input=document.getElementById('plan-start-date');if(input)input.value='';
  if(state.plan?.slots){state.plan.dayDates={};saveState();markPlatePlanViewsDirty('today','shopping','planlib');renderPlan();}
}

const PLAN_SLOT_REASON_LABELS={
  eating_out:'Eating out',
  away:'Away',
  leftovers:'Leftovers',
  skipped:'Skipped',
  plans_changed:'Plans changed',
  forgot_to_update:'Forgot to update',
  other:'Other'
};
function getPlanSlotReasonKey(day,slotKey){return `${day}|${slotKey}`;}
function getPlanSlotReason(planContext,day,slotKey){
  const value=planContext?.slotReasons?.[getPlanSlotReasonKey(day,slotKey)];
  if(!value)return null;
  if(typeof value==='string')return {code:value,note:''};
  return {code:value.code||'other',note:value.note||''};
}
function formatPlanSlotReason(reason){
  if(!reason)return '';
  const base=PLAN_SLOT_REASON_LABELS[reason.code]||PLAN_SLOT_REASON_LABELS.other;
  return reason.note ? (reason.code==='other'?reason.note:`${base} · ${reason.note}`) : base;
}
function setPlanSlotReason(day,slotKey,code,note=''){
  if(!state.plan.slotReasons||typeof state.plan.slotReasons!=='object')state.plan.slotReasons={};
  const key=getPlanSlotReasonKey(day,slotKey);
  if(!code)delete state.plan.slotReasons[key];
  else state.plan.slotReasons[key]={code:PLAN_SLOT_REASON_LABELS[code]?code:'other',note:String(note||'').trim()};
}
function clearPlanSlotReason(day,slotKey,{persist=true}={}){
  if(!state.plan?.slotReasons)return;
  delete state.plan.slotReasons[getPlanSlotReasonKey(day,slotKey)];
  if(!persist)return;
  saveState();
  markPlatePlanViewsDirty('today','shopping','planlib');
  renderPlan();
  if(document.getElementById('view-today')?.classList.contains('active'))renderToday();
  showPlatePlanToast('Plan note cleared.');
}
function findPlanSlotLocation(instanceId){
  if(!instanceId||!state.plan?.slots)return null;
  for(const [day,daySlots] of Object.entries(state.plan.slots)){
    for(const [slotKey,slot] of Object.entries(daySlots||{})){
      if(slot&&typeof slot==='object'&&slot.instanceId===instanceId)return {day:+day,slotKey,slot};
    }
  }
  return null;
}
function getPlanSlotCounterpartKey(slotKey){
  if(String(slotKey).endsWith('E'))return String(slotKey).slice(0,-1)+'C';
  if(String(slotKey).endsWith('C'))return String(slotKey).slice(0,-1)+'E';
  return '';
}
function planSlotsCanMoveTogether(day,slotKey){
  const counterpartKey=getPlanSlotCounterpartKey(slotKey);
  const first=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  const second=getPlanSlotInfo(state.plan?.slots?.[day]?.[counterpartKey]);
  const mealType=getMealTypeFromSlotKey(slotKey);
  return !!(first.active&&second.active&&getTodayResolvedFingerprint(first,mealType)===getTodayResolvedFingerprint(second,mealType));
}
function emptyPlanDaySlots(){
  return Object.fromEntries(SLOTS.map(slot=>[slot.key,null]));
}
function insertPlanDayAt(index,dateValue){
  const plan=state.plan;
  const oldDays=Math.max(+plan.days||0,...Object.keys(plan.slots||{}).map(Number).filter(Number.isFinite),0);
  const slots={};
  const dayDates={};
  const excluded={};
  for(let day=1;day<=oldDays;day++){
    const nextDay=day>=index?day+1:day;
    slots[nextDay]=plan.slots?.[day]||emptyPlanDaySlots();
    if(plan.dayDates?.[day])dayDates[nextDay]=plan.dayDates[day];
    if(state.excluded?.[day])excluded[nextDay]=state.excluded[day];
  }
  slots[index]=emptyPlanDaySlots();
  dayDates[index]=dateValue;
  excluded[index]=Object.fromEntries(SLOTS.map(slot=>[slot.key,false]));
  const slotReasons={};
  Object.entries(plan.slotReasons||{}).forEach(([key,value])=>{
    const match=key.match(/^(\d+)\|(.+)$/);
    if(!match)return;
    const oldDay=+match[1];
    slotReasons[getPlanSlotReasonKey(oldDay>=index?oldDay+1:oldDay,match[2])]=value;
  });
  plan.days=oldDays+1;
  plan.slots=slots;
  plan.dayDates=dayDates;
  plan.slotReasons=slotReasons;
  state.excluded={...(state.excluded||{}),...excluded};
  Object.keys(state.excluded).forEach(key=>{if(+key>=1&&+key<=oldDays+1&&!excluded[key])delete state.excluded[key];});
  return index;
}
function ensurePlanDayForReschedule(dateValue){
  const existing=getTodayPlanDay(dateValue,state.plan);
  if(existing)return +existing;
  const days=Math.max(+state.plan.days||0,...Object.keys(state.plan.slots||{}).map(Number).filter(Number.isFinite),0);
  const dated=Object.entries(state.plan.dayDates||{}).filter(([,value])=>parsePlanLocalDate(value)).sort((a,b)=>+a[0]-+b[0]);
  const next=dated.find(([,value])=>value>dateValue);
  return insertPlanDayAt(next?+next[0]:days+1,dateValue);
}

// PlatePlan 21.1 guided rescheduling. These definitions intentionally replace
// the transitional 20.3 form above while preserving its state and undo format.
function ensurePlanRescheduleModal(){
  let wrap=document.getElementById('plan-reschedule-wrap');
  if(wrap){
    wrap.remove();
  }
  wrap=document.createElement('div');
  wrap.id='plan-reschedule-wrap';
  wrap.className='modal-wrap sheet-mobile plan-reschedule-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-reschedule-title">
    <div class="plan-reschedule-appbar">
      <div><h3 id="plan-reschedule-title">Reschedule meal</h3><div>Choose where this planned meal should go</div></div>
      <button class="btn sm ghost" type="button" onclick="closePlanRescheduleModal()">Close</button>
    </div>
    <div class="plan-reschedule-body" id="plan-reschedule-body"></div>
    <div class="plan-reschedule-actions" id="plan-reschedule-actions"></div>
  </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function getPlanRescheduleSourceKeys(){
  if(!platePlanRescheduleSource)return [];
  const scope=platePlanRescheduleDraft?.scope||'single';
  const keys=[platePlanRescheduleSource.slotKey];
  const counterpart=getPlanSlotCounterpartKey(platePlanRescheduleSource.slotKey);
  if(scope==='both'&&counterpart&&planSlotsCanMoveTogether(platePlanRescheduleSource.day,platePlanRescheduleSource.slotKey))keys.push(counterpart);
  return keys;
}
function planHasCalendarDates(){
  return Object.values(state.plan?.dayDates||{}).some(value=>!!parsePlanLocalDate(value));
}
function getPlanRescheduleDestinationDay(){
  if(!platePlanRescheduleDraft)return 0;
  if(platePlanRescheduleDraft.destinationType==='day')return +platePlanRescheduleDraft.destinationValue||0;
  return +(getTodayPlanDay(platePlanRescheduleDraft.destinationValue,state.plan)||0);
}
function getPlanRescheduleSuggestions(){
  const suggestions=[];
  const add=(type,value,label)=>{
    const key=`${type}:${value}`;
    if(!value||suggestions.some(item=>item.key===key))return;
    suggestions.push({key,type,value:String(value),label});
  };
  if(!planHasCalendarDates()){
    const days=Math.max(+state.plan?.days||0,...Object.keys(state.plan?.slots||{}).map(Number).filter(Number.isFinite),0);
    for(let day=1;day<=days;day++)add('day',day,`Day ${day}`);
    return suggestions;
  }
  const today=getPlatePlanLocalToday();
  const tomorrow=parsePlanLocalDate(today);
  tomorrow.setDate(tomorrow.getDate()+1);
  add('date',today,'Today');
  add('date',formatPlanLocalDateValue(tomorrow),'Tomorrow');
  const sourceDate=state.plan.dayDates?.[platePlanRescheduleSource?.day]||today;
  Object.entries(state.plan.dayDates||{})
    .filter(([,value])=>parsePlanLocalDate(value))
    .sort((a,b)=>{
      const distanceA=Math.abs(parsePlanLocalDate(a[1])-parsePlanLocalDate(sourceDate));
      const distanceB=Math.abs(parsePlanLocalDate(b[1])-parsePlanLocalDate(sourceDate));
      return distanceA-distanceB||a[1].localeCompare(b[1]);
    })
    .slice(0,5)
    .forEach(([day,value])=>add('date',value,formatPlanDayLabel(state.plan,day,{short:true})));
  return suggestions;
}
function getPlanRescheduleDestinationLabel(){
  if(!platePlanRescheduleDraft)return '';
  const day=getPlanRescheduleDestinationDay();
  if(day)return formatPlanDayLabel(state.plan,day,{short:true});
  if(platePlanRescheduleDraft.destinationType==='date')return formatTodayDateLabel(platePlanRescheduleDraft.destinationValue);
  return `Day ${platePlanRescheduleDraft.destinationValue}`;
}
function setPlanRescheduleScope(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.scope=value==='both'?'both':'single';
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function selectPlanRescheduleDestination(type,value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.destinationType=type==='day'?'day':'date';
  platePlanRescheduleDraft.destinationValue=String(value||'');
  platePlanRescheduleDraft.showOtherDate=false;
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function showPlanRescheduleOtherDate(){
  if(!platePlanRescheduleDraft)return;
  if(!planHasCalendarDates()){
    closePlanRescheduleModal();
    openPlanDatesWorkspace();
    return;
  }
  platePlanRescheduleDraft.showOtherDate=true;
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
  setTimeout(()=>document.getElementById('plan-reschedule-other-date')?.focus(),0);
}
function setPlanRescheduleOtherDate(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.destinationType='date';
  platePlanRescheduleDraft.destinationValue=value||'';
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function setPlanRescheduleMeal(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.meal=['breakfast','lunch','dinner'].includes(value)?value:'dinner';
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function setPlanRescheduleReason(value){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.reason=PLAN_SLOT_REASON_LABELS[value]?value:'';
  if(value==='other')platePlanRescheduleDraft.showNote=true;
  platePlanRescheduleDraft.collisionReview=false;
  renderPlanRescheduleSheet();
}
function togglePlanRescheduleNote(){
  if(!platePlanRescheduleDraft)return;
  platePlanRescheduleDraft.showNote=!platePlanRescheduleDraft.showNote;
  renderPlanRescheduleSheet();
  if(platePlanRescheduleDraft.showNote)setTimeout(()=>document.getElementById('plan-reschedule-note')?.focus(),0);
}
function setPlanRescheduleNote(value){
  if(platePlanRescheduleDraft)platePlanRescheduleDraft.note=String(value||'').slice(0,80);
}
function getPlanRescheduleCollisionCount(){
  const targetDay=getPlanRescheduleDestinationDay();
  if(!targetDay||!platePlanRescheduleDraft)return 0;
  const movingInstances=new Set(getPlanRescheduleSourceKeys().map(key=>getPlanSlotInfo(state.plan?.slots?.[platePlanRescheduleSource.day]?.[key]).instanceId).filter(Boolean));
  return getPlanRescheduleSourceKeys().filter(key=>{
    const suffix=key.endsWith('C')?'C':'E';
    const destination=getPlanSlotInfo(state.plan?.slots?.[targetDay]?.[`${platePlanRescheduleDraft.meal}${suffix}`]);
    return !!(destination.active&&!movingInstances.has(destination.instanceId));
  }).length;
}
function updatePlanReschedulePreview(){
  if(!platePlanRescheduleSource||!platePlanRescheduleDraft)return '';
  const destinationValue=platePlanRescheduleDraft.destinationValue;
  if(platePlanRescheduleDraft.destinationType==='date'&&!parsePlanLocalDate(destinationValue))return 'Choose a valid destination date.';
  if(platePlanRescheduleDraft.destinationType==='day'&&!(+destinationValue>0))return 'Choose a destination day.';
  const existingDay=getPlanRescheduleDestinationDay();
  const people=getPlanRescheduleSourceKeys().map(key=>key.endsWith('C')?'Chloe':'Elliott');
  const occupied=getPlanRescheduleCollisionCount();
  const destination=getPlanRescheduleDestinationLabel();
  const collision=occupied?` ${occupied===people.length?'The destination is occupied; choose Swap or Replace after review.':'One destination is occupied; choose how to handle it after review.'}`:'';
  const extension=existingDay||platePlanRescheduleDraft.destinationType==='day'?'':' This date will be added to the active plan.';
  const reason=platePlanRescheduleDraft.reason?` Reason: ${formatPlanSlotReason({code:platePlanRescheduleDraft.reason,note:platePlanRescheduleDraft.note})}.`:' Choose a reason to continue.';
  return `Move ${people.join(' and ')} to ${destination} · ${toTitleCase(platePlanRescheduleDraft.meal)}.${collision}${extension}${reason}`;
}
function renderPlanRescheduleSheet(){
  const body=document.getElementById('plan-reschedule-body');
  const actions=document.getElementById('plan-reschedule-actions');
  if(!body||!actions||!platePlanRescheduleSource||!platePlanRescheduleDraft)return;
  const info=getPlanSlotInfo(state.plan?.slots?.[platePlanRescheduleSource.day]?.[platePlanRescheduleSource.slotKey]);
  const together=planSlotsCanMoveTogether(platePlanRescheduleSource.day,platePlanRescheduleSource.slotKey);
  const person=platePlanRescheduleSource.slotKey.endsWith('C')?'Chloe':'Elliott';
  const sourceLabel=`${formatPlanDayLabel(state.plan,platePlanRescheduleSource.day,{short:true})} · ${toTitleCase(getMealTypeFromSlotKey(platePlanRescheduleSource.slotKey))}`;
  if(platePlanRescheduleDraft.collisionReview){
    const count=getPlanRescheduleCollisionCount();
    body.innerHTML=`<div class="plan-reschedule-summary"><strong>${ppEscapeHtml(info.active?.name||info.recipe?.name||'Planned meal')}</strong><div>${ppEscapeHtml(sourceLabel)}</div></div>
      <section class="plan-reschedule-collision" role="alert">
        <h4>${count>1?'Destination meals already exist':'A destination meal already exists'}</h4>
        <p><strong>Swap</strong> moves the existing ${count>1?'meals':'meal'} back to the original slot. <strong>Replace</strong> removes ${count>1?'them':'it'} and can be immediately undone.</p>
      </section>`;
    actions.innerHTML=`<button class="btn ghost" type="button" onclick="platePlanRescheduleDraft.collisionReview=false;renderPlanRescheduleSheet()">Back</button>
      <button class="btn ghost" type="button" onclick="applyPlanReschedule('swap')">Swap</button>
      <button class="btn danger" type="button" onclick="applyPlanReschedule('replace')">Replace</button>`;
    return;
  }
  const suggestions=getPlanRescheduleSuggestions();
  const selectedKey=`${platePlanRescheduleDraft.destinationType}:${platePlanRescheduleDraft.destinationValue}`;
  const scopeHtml=together?`<section class="plan-reschedule-step"><h4>Move for</h4><div class="plan-choice-grid">
      <button class="plan-choice ${platePlanRescheduleDraft.scope==='both'?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.scope==='both'}" onclick="setPlanRescheduleScope('both')">Elliott and Chloe</button>
      <button class="plan-choice ${platePlanRescheduleDraft.scope==='single'?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.scope==='single'}" onclick="setPlanRescheduleScope('single')">${ppEscapeHtml(person)} only</button>
    </div></section>`:'';
  const destinationHtml=suggestions.map(item=>`<button class="plan-choice ${selectedKey===item.key?'selected':''}" type="button" aria-pressed="${selectedKey===item.key}" onclick="selectPlanRescheduleDestination('${item.type}','${ppEscapeAttr(item.value)}')">${ppEscapeHtml(item.label)}</button>`).join('');
  const reasonHtml=Object.entries(PLAN_SLOT_REASON_LABELS).map(([value,label])=>`<button class="plan-choice ${platePlanRescheduleDraft.reason===value?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.reason===value}" onclick="setPlanRescheduleReason('${value}')">${ppEscapeHtml(label)}</button>`).join('');
  const otherDate=platePlanRescheduleDraft.showOtherDate?`<div class="plan-reschedule-other"><label for="plan-reschedule-other-date">Other date</label><input id="plan-reschedule-other-date" type="date" value="${ppEscapeAttr(platePlanRescheduleDraft.destinationType==='date'?platePlanRescheduleDraft.destinationValue:'')}" onchange="setPlanRescheduleOtherDate(this.value)"></div>`:'';
  const note=platePlanRescheduleDraft.showNote?`<div class="plan-reschedule-note"><label for="plan-reschedule-note">${platePlanRescheduleDraft.reason==='other'?'Description':'Optional note'}</label><input id="plan-reschedule-note" maxlength="80" value="${ppEscapeAttr(platePlanRescheduleDraft.note||'')}" placeholder="Add a short note" oninput="setPlanRescheduleNote(this.value)"></div>`:'';
  body.innerHTML=`<div class="plan-reschedule-summary"><strong>${ppEscapeHtml(info.active?.name||info.recipe?.name||'Planned meal')}</strong><div>${ppEscapeHtml(sourceLabel)}</div></div>
    ${scopeHtml}
    <section class="plan-reschedule-step"><h4>New day</h4><div class="plan-choice-grid">${destinationHtml}<button class="plan-choice ${platePlanRescheduleDraft.showOtherDate?'selected':''}" type="button" onclick="showPlanRescheduleOtherDate()">${planHasCalendarDates()?'Other date':'Assign dates'}</button></div>${otherDate}</section>
    <section class="plan-reschedule-step"><h4>Meal</h4><div class="plan-choice-grid three">${['breakfast','lunch','dinner'].map(value=>`<button class="plan-choice ${platePlanRescheduleDraft.meal===value?'selected':''}" type="button" aria-pressed="${platePlanRescheduleDraft.meal===value}" onclick="setPlanRescheduleMeal('${value}')">${toTitleCase(value)}</button>`).join('')}</div></section>
    <section class="plan-reschedule-step"><h4>Why is the original slot changing?</h4><div class="plan-choice-grid">${reasonHtml}</div><button class="btn sm ghost plan-note-toggle" type="button" onclick="togglePlanRescheduleNote()">${platePlanRescheduleDraft.showNote?'Hide note':'Add note'}</button>${note}</section>
    <div class="plan-reschedule-preview" role="status" aria-live="polite">${ppEscapeHtml(updatePlanReschedulePreview())}</div>`;
  actions.innerHTML=`<button class="btn ghost" type="button" onclick="closePlanRescheduleModal()">Cancel</button><button class="btn primary" type="button" onclick="confirmPlanReschedule()">Review move</button>`;
}
function openPlanReschedule(day,slotKey){
  const info=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.active)return showPlatePlanToast('That planned meal is no longer available.');
  closeMobileActionSheet(true);
  const wrap=ensurePlanRescheduleModal();
  platePlanRescheduleSource={day:+day,slotKey,instanceId:info.instanceId};
  const together=planSlotsCanMoveTogether(+day,slotKey);
  const hasDates=planHasCalendarDates();
  let destinationType=hasDates?'date':'day';
  let destinationValue='';
  if(hasDates){
    const sourceDate=state.plan.dayDates?.[day]||getPlatePlanLocalToday();
    const parsed=parsePlanLocalDate(sourceDate)||parsePlanLocalDate(getPlatePlanLocalToday());
    parsed.setDate(parsed.getDate()+1);
    destinationValue=formatPlanLocalDateValue(parsed);
  }else{
    const days=Math.max(+state.plan.days||0,...Object.keys(state.plan.slots||{}).map(Number).filter(Number.isFinite),0);
    destinationValue=String(Math.min(days,+day+1)||day);
  }
  platePlanRescheduleDraft={scope:together?'both':'single',destinationType,destinationValue,meal:getMealTypeFromSlotKey(slotKey)||'dinner',reason:'',note:'',showOtherDate:false,showNote:false,collisionReview:false};
  platePlanLastMobileFocus=document.activeElement;
  wrap.classList.add('open');
  markMobileLayerForBack(wrap,'plan-reschedule');
  renderPlanRescheduleSheet();
  setTimeout(()=>wrap.querySelector('.plan-choice')?.focus(),0);
}
function closePlanRescheduleModal(fromHistory=false){
  const wrap=document.getElementById('plan-reschedule-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';
  wrap.classList.remove('open');delete wrap.dataset.historyEntry;
  platePlanRescheduleSource=null;
  platePlanRescheduleDraft=null;
  restoreMobileLayerFocus();
  if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function confirmPlanReschedule(){
  if(!platePlanRescheduleSource||!platePlanRescheduleDraft||!state.plan?.slots)return;
  if(platePlanRescheduleDraft.destinationType==='date'&&!parsePlanLocalDate(platePlanRescheduleDraft.destinationValue))return showPlatePlanToast('Choose a valid destination date.');
  if(platePlanRescheduleDraft.destinationType==='day'&&!(+platePlanRescheduleDraft.destinationValue>0))return showPlatePlanToast('Choose a destination day.');
  if(!platePlanRescheduleDraft.reason)return showPlatePlanToast('Choose why the original slot is changing.');
  if(platePlanRescheduleDraft.reason==='other'&&!platePlanRescheduleDraft.note.trim())return showPlatePlanToast('Add a short description for Other.');
  if(getPlanRescheduleCollisionCount()){
    platePlanRescheduleDraft.collisionReview=true;
    renderPlanRescheduleSheet();
    return;
  }
  applyPlanReschedule('move');
}
function applyPlanReschedule(mode='move'){
  if(!platePlanRescheduleSource||!platePlanRescheduleDraft||!state.plan?.slots)return;
  const targetMeal=platePlanRescheduleDraft.meal;
  const reason=platePlanRescheduleDraft.reason;
  const note=platePlanRescheduleDraft.note.trim();
  const destinationType=platePlanRescheduleDraft.destinationType;
  const destinationValue=platePlanRescheduleDraft.destinationValue;
  const sourceItems=getPlanRescheduleSourceKeys().map(slotKey=>{
    const info=getPlanSlotInfo(state.plan.slots?.[platePlanRescheduleSource.day]?.[slotKey]);
    return info.instanceId?{slotKey,instanceId:info.instanceId,personSuffix:slotKey.endsWith('C')?'C':'E'}:null;
  }).filter(Boolean);
  if(!sourceItems.length)return showPlatePlanToast('The planned meal has changed. Reopen Reschedule.');
  platePlanRescheduleUndo={
    plan:JSON.parse(JSON.stringify(state.plan)),
    excluded:JSON.parse(JSON.stringify(state.excluded||{}))
  };
  const targetDay=destinationType==='day'?+destinationValue:ensurePlanDayForReschedule(destinationValue);
  const moves=sourceItems.map(item=>{
    const source=findPlanSlotLocation(item.instanceId);
    const targetSlotKey=targetMeal+item.personSuffix;
    return source?{...item,source,targetSlotKey,destination:state.plan.slots?.[targetDay]?.[targetSlotKey]||null}:null;
  }).filter(Boolean);
  if(moves.every(move=>move.source.day===targetDay&&move.source.slotKey===move.targetSlotKey)){
    platePlanRescheduleUndo=null;
    return showPlatePlanToast('That meal is already in the selected slot.');
  }
  moves.forEach(move=>{
    if(!state.plan.slots[targetDay])state.plan.slots[targetDay]=emptyPlanDaySlots();
    state.plan.slots[targetDay][move.targetSlotKey]=move.source.slot;
    setPlanSlotReason(targetDay,move.targetSlotKey,'');
    if(!state.excluded[targetDay])state.excluded[targetDay]={};
    state.excluded[targetDay][move.targetSlotKey]=false;
  });
  moves.forEach(move=>{
    if(move.source.day===targetDay&&moves.some(other=>other.targetSlotKey===move.source.slotKey))return;
    if(move.destination&&mode==='swap'){
      state.plan.slots[move.source.day][move.source.slotKey]=move.destination;
      setPlanSlotReason(move.source.day,move.source.slotKey,'');
    }else{
      state.plan.slots[move.source.day][move.source.slotKey]=null;
      setPlanSlotReason(move.source.day,move.source.slotKey,reason,note);
    }
    if(!state.excluded[move.source.day])state.excluded[move.source.day]={};
    state.excluded[move.source.day][move.source.slotKey]=false;
  });
  const destinationLabel=destinationType==='day'?formatPlanDayLabel(state.plan,targetDay,{short:true}):formatTodayDateLabel(destinationValue);
  closePlanRescheduleModal();
  refreshAfterPlanReschedule(`Meal ${mode==='swap'?'swapped':'rescheduled'} to ${destinationLabel}.`);
}

let platePlanStudioSession=null;
let platePlanStudioApplyUndo=null;
function planStudioFingerprint(plan){return JSON.stringify(plan||{});}
function ensurePlanStudio(){
  let wrap=document.getElementById('plan-studio-wrap');if(wrap)return wrap;
  wrap=document.createElement('div');wrap.id='plan-studio-wrap';wrap.className='modal-wrap long-workspace plan-studio-wrap';
  wrap.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plan-studio-title"><div class="workspace-appbar"><div><h2 id="plan-studio-title">Rearrange plan</h2><p>Stage changes across the full plan, then review their impact before applying.</p></div><button class="btn ghost" onclick="closePlanStudio()">Close</button></div><div class="plan-studio-toolbar" id="plan-studio-toolbar"></div><div class="workspace-scroll"><div id="plan-studio-links"></div><div id="plan-studio-grid"></div><div id="plan-studio-impact"></div></div><div class="workspace-actionbar"><button class="btn ghost" onclick="undoPlanStudioChange()">Undo last</button><button class="btn ghost" onclick="resetPlanStudioDraft()">Reset draft</button><button class="btn primary" onclick="applyPlanStudio()">Apply changes</button></div></div>`;
  document.body.appendChild(wrap);return wrap;
}
function openPlanStudio(){
  if(!state.plan?.slots)return showPlatePlanToast('Generate a meal plan first.');
  const wrap=ensurePlanStudio();
  platePlanStudioSession={basePlan:clonePlatePlanValue(state.plan),baseExcluded:clonePlatePlanValue(state.excluded||{}),draftPlan:clonePlatePlanValue(state.plan),draftExcluded:clonePlatePlanValue(state.excluded||{}),baseFingerprint:planStudioFingerprint(state.plan),baseRevision:+platePlanCloudRevisions['plans/current']||0,selected:null,moveTogether:true,reason:'plans_changed',note:'',changes:[],undo:[],collision:null};
  platePlanLastMobileFocus=document.activeElement;wrap.classList.add('open');markMobileLayerForBack(wrap,'plan-studio');renderPlanStudio();
}
function closePlanStudio(fromHistory=false){
  const wrap=document.getElementById('plan-studio-wrap');if(!wrap)return;
  const marked=wrap.dataset.historyEntry==='1';wrap.classList.remove('open');delete wrap.dataset.historyEntry;platePlanStudioSession=null;restoreMobileLayerFocus();if(marked&&!fromHistory)returnFromPlatePlanUiHistory();
}
function planStudioDays(){
  const plan=platePlanStudioSession?.draftPlan;return Object.keys(plan?.slots||{}).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
}
function setPlanStudioReason(value){if(platePlanStudioSession)platePlanStudioSession.reason=PLAN_SLOT_REASON_LABELS[value]?value:'plans_changed';}
function setPlanStudioNote(value){if(platePlanStudioSession)platePlanStudioSession.note=String(value||'').slice(0,80);}
function setPlanStudioMoveTogether(value){if(platePlanStudioSession){platePlanStudioSession.moveTogether=!!value;renderPlanStudio();}}
function selectPlanStudioSlot(day,key){
  const session=platePlanStudioSession;if(!session)return;
  const slot=session.draftPlan.slots?.[day]?.[key];
  if(!session.selected){
    if(!slot)return showPlatePlanToast('Choose a meal first, then choose its destination.');
    session.selected={day:+day,key};
    renderPlanStudio();return;
  }
  if(session.selected.day===+day&&session.selected.key===key){session.selected=null;renderPlanStudio();return;}
  const destination=session.draftPlan.slots?.[day]?.[key]||null;
  if(destination){
    session.collision={day:+day,key};
    renderPlanStudioCollision();return;
  }
  stagePlanStudioMove(+day,key,'move');
}
function renderPlanStudioCollision(){
  const session=platePlanStudioSession;if(!session?.collision)return;
  openAppChoiceModal('Destination occupied','Swap the two meals, or replace the destination meal. The draft remains reversible until Apply changes.',[{label:'Swap meals',value:'swap'},{label:'Replace destination',value:'replace'}],mode=>stagePlanStudioMove(session.collision.day,session.collision.key,mode));
}
function planStudioMoveKeys(source){
  const session=platePlanStudioSession;
  const keys=[source.key];
  const counterpart=getPlanSlotCounterpartKey(source.key);
  if(session.moveTogether&&counterpart&&planSlotsEquivalentInPlan(session.draftPlan,source.day,source.key,counterpart))keys.push(counterpart);
  return keys;
}
function planSlotsEquivalentInPlan(plan,day,key,counterpart){
  const a=getPlanSlotInfo(plan?.slots?.[day]?.[key],plan),b=getPlanSlotInfo(plan?.slots?.[day]?.[counterpart],plan);
  if(!a.active||!b.active)return false;
  const contextA=getPlanContextForInstance(a.instanceId,plan,state.overrides),contextB=getPlanContextForInstance(b.instanceId,plan,state.overrides);
  return a.id===b.id&&a.variant===b.variant&&JSON.stringify({...contextA,instanceId:null})===JSON.stringify({...contextB,instanceId:null});
}
function stagePlanStudioMove(targetDay,targetKey,mode){
  const session=platePlanStudioSession,source=session?.selected;if(!session||!source)return;
  if(!session.reason)return showPlatePlanToast('Choose a reason before moving a meal.');
  session.undo.push({draftPlan:clonePlatePlanValue(session.draftPlan),draftExcluded:clonePlatePlanValue(session.draftExcluded),changes:clonePlatePlanValue(session.changes)});
  const sourceKeys=planStudioMoveKeys(source);
  sourceKeys.forEach(sourceKey=>{
    const suffix=sourceKey.endsWith('C')?'C':'E';
    const destinationKey=getMealTypeFromSlotKey(targetKey)+suffix;
    const sourceSlot=session.draftPlan.slots[source.day]?.[sourceKey]||null;
    const destinationSlot=session.draftPlan.slots[targetDay]?.[destinationKey]||null;
    if(!sourceSlot)return;
    if(!session.draftPlan.slots[targetDay])session.draftPlan.slots[targetDay]=emptyPlanDaySlots();
    session.draftPlan.slots[targetDay][destinationKey]=sourceSlot;
    if(mode==='swap'&&destinationSlot)session.draftPlan.slots[source.day][sourceKey]=destinationSlot;
    else session.draftPlan.slots[source.day][sourceKey]=null;
    const reasonKey=getPlanSlotReasonKey(source.day,sourceKey);
    if(!session.draftPlan.slotReasons)session.draftPlan.slotReasons={};
    if(mode==='swap')delete session.draftPlan.slotReasons[reasonKey];
    else session.draftPlan.slotReasons[reasonKey]={code:session.reason,note:session.note||'',updatedAt:new Date().toISOString()};
    session.changes.push({mode,sourceDay:source.day,sourceKey,targetDay,destinationKey,replaced:!!destinationSlot,recipe:getPlanSlotInfo(sourceSlot,session.draftPlan).active?.name||'Meal'});
  });
  session.selected=null;session.collision=null;renderPlanStudio();
}
function undoPlanStudioChange(){
  const session=platePlanStudioSession,last=session?.undo.pop();if(!last)return showPlatePlanToast('There is no staged change to undo.');
  session.draftPlan=last.draftPlan;session.draftExcluded=last.draftExcluded;session.changes=last.changes;session.selected=null;renderPlanStudio();
}
function resetPlanStudioDraft(){
  const session=platePlanStudioSession;if(!session)return;
  session.draftPlan=clonePlatePlanValue(session.basePlan);session.draftExcluded=clonePlatePlanValue(session.baseExcluded);session.changes=[];session.undo=[];session.selected=null;renderPlanStudio();
}
function addPlanStudioDate(){
  const session=platePlanStudioSession,value=document.getElementById('plan-studio-new-date')?.value||'';if(!session||!parsePlanLocalDate(value))return showPlatePlanToast('Choose a valid date.');
  if(Object.values(session.draftPlan.dayDates||{}).includes(value))return showPlatePlanToast('That date is already in the active plan.');
  session.undo.push({draftPlan:clonePlatePlanValue(session.draftPlan),draftExcluded:clonePlatePlanValue(session.draftExcluded),changes:clonePlatePlanValue(session.changes)});
  const oldDays=planStudioDays();const before=oldDays.find(day=>(session.draftPlan.dayDates?.[day]||'')>value);const index=before||((session.draftPlan.days||oldDays.length)+1);
  const slots={},dates={},excluded={};
  oldDays.forEach(day=>{const next=day>=index?day+1:day;slots[next]=session.draftPlan.slots[day];if(session.draftPlan.dayDates?.[day])dates[next]=session.draftPlan.dayDates[day];excluded[next]=session.draftExcluded[day]||Object.fromEntries(SLOTS.map(slot=>[slot.key,false]));});
  const shiftedReasons={};Object.entries(session.draftPlan.slotReasons||{}).forEach(([key,reason])=>{const match=key.match(/^(\d+)\|(.+)$/);if(!match){shiftedReasons[key]=reason;return;}const day=+match[1];shiftedReasons[getPlanSlotReasonKey(day>=index?day+1:day,match[2])]=reason;});
  slots[index]=emptyPlanDaySlots();dates[index]=value;excluded[index]=Object.fromEntries(SLOTS.map(slot=>[slot.key,false]));
  session.draftPlan.slots=slots;session.draftPlan.dayDates=dates;session.draftPlan.slotReasons=shiftedReasons;session.draftPlan.days=oldDays.length+1;session.draftExcluded=excluded;
  session.changes.forEach(change=>{if(change.sourceDay>=index)change.sourceDay++;if(change.targetDay>=index)change.targetDay++;});if(session.selected?.day>=index)session.selected.day++;
  session.changes.push({mode:'new-date',targetDay:index,recipe:`Added ${formatTodayDateLabel(value)}`});renderPlanStudio();
}
function getPlanStudioImpact(){
  const session=platePlanStudioSession;if(!session)return null;
  const affected=[...new Set(session.changes.flatMap(change=>[change.sourceDay,change.targetDay]).filter(Boolean))];
  const nutrition=affected.map(day=>{
    const totals={E:{cal:0,prot:0},C:{cal:0,prot:0}};
    Object.entries(session.draftPlan.slots?.[day]||{}).forEach(([key,slot])=>{const info=getPlanSlotInfo(slot,session.draftPlan);if(!info.active)return;const n=getPlannedSlotNutrition(info.active,key,info.instanceId,session.draftPlan);const person=key.endsWith('C')?'C':'E';totals[person].cal+=+n?.cal||0;totals[person].prot+=+n?.prot||0;});
    return {day,totals};
  });
  const empty=affected.reduce((sum,day)=>sum+Object.values(session.draftPlan.slots?.[day]||{}).filter(value=>!value).length,0);
  return {affected,nutrition,empty,prepBefore:findMealPrepSuggestions(session.basePlan).length,prepAfter:findMealPrepSuggestions(session.draftPlan).length};
}
function renderPlanStudio(){
  const session=platePlanStudioSession;if(!session)return;
  const toolbar=document.getElementById('plan-studio-toolbar'),links=document.getElementById('plan-studio-links'),grid=document.getElementById('plan-studio-grid'),impact=document.getElementById('plan-studio-impact');if(!toolbar||!grid)return;
  const counterpart=session.selected?getPlanSlotCounterpartKey(session.selected.key):'',canTogether=!!(session.selected&&counterpart&&planSlotsEquivalentInPlan(session.draftPlan,session.selected.day,session.selected.key,counterpart));
  toolbar.innerHTML=`<label>Reason for emptied slots<select onchange="setPlanStudioReason(this.value)">${Object.entries(PLAN_SLOT_REASON_LABELS).map(([value,label])=>`<option value="${value}"${session.reason===value?' selected':''}>${ppEscapeHtml(label)}</option>`).join('')}</select></label><label>Optional note<input maxlength="80" value="${ppEscapeAttr(session.note||'')}" oninput="setPlanStudioNote(this.value)"></label><div class="plan-studio-add-date"><input id="plan-studio-new-date" type="date" aria-label="Add date outside current plan"><button class="btn ghost" onclick="addPlanStudioDate()">Add date</button></div>${canTogether?`<label class="plan-studio-together"><input type="checkbox" ${session.moveTogether?'checked':''} onchange="setPlanStudioMoveTogether(this.checked)"> Move equivalent Elliott and Chloe meals together</label>`:''}`;
  const days=planStudioDays();const today=getPlatePlanLocalToday();
  links.innerHTML=`<nav class="plan-studio-links" aria-label="Plan dates">${days.map(day=>`<a href="#plan-studio-day-${day}" class="${session.draftPlan.dayDates?.[day]===today?'today':''}">${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,day,{short:true}))}</a>`).join('')}</nav>`;
  grid.innerHTML=`<div class="plan-studio-grid">${days.map(day=>`<section class="plan-studio-day" id="plan-studio-day-${day}"><h3>${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,day,{short:true}))}</h3>${['breakfast','lunch','dinner'].map(meal=>`<div class="plan-studio-meal"><strong>${toTitleCase(meal)}</strong>${['E','C'].map(person=>{const key=meal+person,info=getPlanSlotInfo(session.draftPlan.slots?.[day]?.[key],session.draftPlan),selected=session.selected?.day===day&&session.selected?.key===key;return `<button class="plan-studio-slot ${selected?'selected':''} ${info.active?'filled':'empty'}" aria-pressed="${selected}" onclick="selectPlanStudioSlot(${day},'${key}')"><span>${person==='E'?'Elliott':'Chloe'}</span><strong>${ppEscapeHtml(info.active?.name||'Empty')}</strong>${info.variant==='enhanced'?'<small>Enhanced</small>':''}</button>`;}).join('')}</div>`).join('')}</section>`).join('')}</div>`;
  const summary=getPlanStudioImpact();
  impact.innerHTML=`<section class="plan-studio-impact"><h3>Impact review</h3>${session.changes.length?`<ul>${session.changes.map(change=>`<li><strong>${ppEscapeHtml(toTitleCase(change.mode.replace('-',' ')))}</strong> · ${ppEscapeHtml(change.recipe)}${change.sourceDay?` · ${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,change.sourceDay,{short:true}))} → ${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,change.targetDay,{short:true}))}`:''}</li>`).join('')}</ul><div class="plan-studio-nutrition">${summary.nutrition.map(row=>`<div><strong>${ppEscapeHtml(formatPlanDayLabel(session.draftPlan,row.day,{short:true}))}</strong><span>Elliott ${Math.round(row.totals.E.cal)} kcal / P${round1(row.totals.E.prot)}g</span><span>Chloe ${Math.round(row.totals.C.cal)} kcal / P${round1(row.totals.C.prot)}g</span></div>`).join('')}</div><p>${summary.empty} empty selected-person slots across affected days. Meal-prep groupings: ${summary.prepBefore} → ${summary.prepAfter}.</p><div class="msg warn">Shopping will recalculate after moved, swapped or replaced meals are applied.</div>`:'<div class="empty compact">Tap a meal, then tap its destination. No active-plan data changes until Apply changes.</div>'}</section>`;
}
function applyPlanStudio(){
  const session=platePlanStudioSession;if(!session||!session.changes.length)return showPlatePlanToast('Stage at least one change first.');
  const revision=+platePlanCloudRevisions['plans/current']||0;
  if(revision!==session.baseRevision||planStudioFingerprint(state.plan)!==session.baseFingerprint)return openAppInfoModal('Plan changed on another device','Your draft has been preserved, but the active plan changed after Plan Studio opened. Close and reopen Plan Studio to review against the latest plan before applying.');
  runWithRecoveryPoint('Before applying Plan Studio changes',()=>{
    platePlanStudioApplyUndo={plan:clonePlatePlanValue(state.plan),excluded:clonePlatePlanValue(state.excluded||{})};
    state.plan=clonePlatePlanValue(session.draftPlan);state.excluded=clonePlatePlanValue(session.draftExcluded);state.plan.confirmedShopping=false;state.plan.mealPrepGroups=[];state.plan.declinedMealPrepGroups=[];state.plan.score=calculatePlanScore(state.plan);
    platePlanNutritionCache.clear();markPlatePlanViewsDirty();saveState();closePlanStudio();renderPlan();if(document.getElementById('view-today')?.classList.contains('active'))renderToday();showPlatePlanToast('Plan changes applied. Undo is available from the planner.');renderPlanStudioUndoBanner();
  });
}
function renderPlanStudioUndoBanner(){
  const host=document.getElementById('plan-warnings');if(!host||!platePlanStudioApplyUndo)return;
  host.innerHTML=`<div class="msg success">Plan Studio changes applied. <button class="btn sm ghost" onclick="undoAppliedPlanStudio()">Undo</button></div>`;
}
function undoAppliedPlanStudio(){
  if(!platePlanStudioApplyUndo)return;
  state.plan=platePlanStudioApplyUndo.plan;state.excluded=platePlanStudioApplyUndo.excluded;platePlanStudioApplyUndo=null;platePlanNutritionCache.clear();markPlatePlanViewsDirty();saveState();renderPlan();if(document.getElementById('view-today')?.classList.contains('active'))renderToday();showPlatePlanToast('Plan Studio changes undone.');
}

function initExcluded(persist=true){
  ensurePlannerShell();
  const days=parseInt(document.getElementById('plan-days').value)||9;
  const old=state.excluded||{};
  state.excluded={};
  for(let d=1;d<=days;d++){state.excluded[d]={};SLOTS.forEach(s=>state.excluded[d][s.key]=(old[d]&&old[d][s.key])||false);}
  if(persist)saveState();
}
function buildExclGrid(){initExcluded();renderExclGrid();}
function renderExclGrid(){
  ensurePlannerShell();
  const days=parseInt(document.getElementById('plan-days').value)||9;
  const el=document.getElementById('excl-grid');
  const daySelect=document.getElementById('plan-days');
  if(daySelect && daySelect.options.length < 10){
    daySelect.innerHTML = Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1} day${i?'s':''}</option>`).join('');
    daySelect.value = String(days);
  }
  let html='';
  for(let d=1;d<=days;d++){
    const draftStart=document.getElementById('plan-start-date')?.value||'';
    const draftDates=buildPlanDayDates(draftStart,days);
    html+=`<div class="meal-slot-card"><h4>${ppEscapeHtml(formatPlanDayLabel({dayDates:draftDates},d,{short:true}))}</h4>
      <div class="meal-slot-grid">
        ${['breakfast','lunch','dinner'].map(meal=>{
          const mode = getSlotMealMode(d, meal);
          const label = meal.charAt(0).toUpperCase()+meal.slice(1);
          return `<div><div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:5px">${label}</div><div class="seg-row">
            ${[['none','None'],['elliott','Elliott'],['chloe','Chloe'],['both','Both']].map(([val,txt])=>`<div class="seg-btn ${val==='both'?'both':''} ${mode===val?'active':''}" onclick="setSlotMealMode(${d},'${meal}','${val}')" title="${val==='both'?'Use the same recipe for Elliott and Chloe':''}">${txt}</div>`).join('')}
          </div></div>`;
        }).join('')}
      </div>
    </div>`;
  }
  el.innerHTML=html;
  renderPlanHistoryPanel();
}
function toggleSlot(day,key){
  if(!state.excluded[day])state.excluded[day]={};
  state.excluded[day][key]=!state.excluded[day][key];
  saveState();renderExclGrid();
}
function inclAll(){const days=parseInt(document.getElementById('plan-days').value)||9;for(let d=1;d<=days;d++)['breakfast','lunch','dinner'].forEach(m=>setSlotMealMode(d,m,'both'));}
function exclAllDinners(){const days=parseInt(document.getElementById('plan-days').value)||9;for(let d=1;d<=days;d++)setSlotMealMode(d,'dinner','none');}
function exclAllDays(){const days=parseInt(document.getElementById('plan-days').value)||9;for(let d=1;d<=days;d++)['breakfast','lunch','dinner'].forEach(m=>setSlotMealMode(d,m,'none'));}

function plannerOptionHasUsableMappings(option,priority){
  const recipe=option?.variant==='enhanced'&&option.recipe?.enhanced?{...option.recipe,...option.recipe.enhanced,ingredients:option.recipe.enhanced.ingredients||[]} : option?.recipe;
  if(!recipe)return false;
  return (recipe.ingredients||[]).every(ing=>{
    if(ing?.excludeNutrition)return true;
    const groupId=getRecipeIngredientGroupId(ing);
    const preferred=groupId?selectBestProductForGroup(groupId,priority):null;
    const resolved=resolveProductForIngredient(ing,{productSelections:preferred&&groupId?{[groupId]:preferred.id}:{}});
    return !!resolved.product&&isUsableProduct(resolved.product);
  });
}

function explainUnavailablePlanSlot(type,who,priority,trafficRules=null){
  const typed=getPlannerRecipeOptions(type,who,{applyExclusions:false,applyTrafficFilter:false});
  if(!typed.length)return `No ${type} recipes are available for ${who}.`;
  const allowed=getPlannerRecipeOptions(type,who,{applyExclusions:true,applyTrafficFilter:false});
  if(!allowed.length)return `${who}'s exclusions remove every available ${type} recipe.`;
  const traffic=getPlannerRecipeOptions(type,who,{applyExclusions:true,trafficRules});
  if(!traffic.length)return `The selected traffic-light filters remove every ${type} recipe for ${who}.`;
  if(!traffic.some(option=>plannerOptionHasUsableMappings(option,priority)))return `${type} recipes for ${who} need usable Product Bank mappings.`;
  return `No eligible ${type} recipe could be selected for ${who}.`;
}

function showPlanGenerationProblem(title,copy){
  const host=document.getElementById('plan-warnings');
  if(host)host.innerHTML=`<div class="msg error"><strong>${ppEscapeHtml(title)}</strong><div style="margin-top:5px">${ppEscapeHtml(copy)}</div><div class="btn-row" style="margin-top:10px"><button class="btn primary" onclick="includeAllMealsAndGenerate()">Include all meals</button><button class="btn ghost" onclick="openPlanOptionsWorkspace()">Edit plan options</button></div></div>`;
}

function includeAllMealsAndGenerate(){
  const days=parseInt(document.getElementById('plan-days')?.value)||9;
  for(let day=1;day<=days;day++){
    if(!state.excluded[day])state.excluded[day]={};
    ['breakfast','lunch','dinner'].forEach(meal=>{
      state.excluded[day][meal+'E']=false;
      state.excluded[day][meal+'C']=false;
    });
  }
  renderExclGrid();
  generatePlan();
}

function proceedDraftToShopping(){
  showView('shopping');
}

function confirmAndSaveDraftPlan(){
  if(!state.draftPlan && !state.isDraftPlan){
    showPlatePlanToast('No draft plan to confirm.');
    return;
  }
  const finalized = state.draftPlan || state.plan;
  if(state.draftBackupPlan && state.draftBackupPlan.slots && Object.keys(state.draftBackupPlan.slots).length){
    snapshotCurrentPlan('Previous plan before new generation', defaultPlanSaveName(state.draftBackupPlan));
  }
  state.plan = finalized;
  state.plan.confirmedShopping = true;
  state.plan.updatedAt = new Date().toISOString();
  delete state.draftPlan;
  delete state.draftBackupPlan;
  state.isDraftPlan = false;
  saveState(true);
  if(platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
  markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
  renderPlan();
  renderShopping();
  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
  showPlatePlanToast('Meal plan confirmed & saved to cloud! ✓');
}

function discardDraftPlan(){
  if(!state.draftPlan && !state.isDraftPlan){
    showPlatePlanToast('No draft plan to discard.');
    return;
  }
  state.plan = state.draftBackupPlan || state.plan || {};
  delete state.draftPlan;
  delete state.draftBackupPlan;
  state.isDraftPlan = false;
  markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
  renderPlan();
  renderShopping();
  if(document.getElementById('view-today')?.classList.contains('active')) renderToday();
  showPlatePlanToast('Draft meal plan discarded.');
}

window.proceedDraftToShopping = proceedDraftToShopping;
window.confirmAndSaveDraftPlan = confirmAndSaveDraftPlan;
window.discardDraftPlan = discardDraftPlan;

function generatePlan(){
  ensurePlannerShell();
  const days = parseInt(document.getElementById('wizard-plan-days')?.value || document.getElementById('plan-days')?.value || state.plannerDays || 10, 10) || 10;
  initExcluded(false);
  const selectedSlots=[];
  for(let day=1;day<=days;day++)['breakfast','lunch','dinner'].forEach(meal=>{
    const mode=getSlotMealMode(day,meal);
    if(mode==='elliott'||mode==='both')selectedSlots.push({day,meal,who:'Elliott',key:meal+'E'});
    if(mode==='chloe'||mode==='both')selectedSlots.push({day,meal,who:'Chloe',key:meal+'C'});
  });
  if(!selectedSlots.length){
    showPlanGenerationProblem('No meals selected','Every meal is set to None. Your current meal plan has been kept.');
    return;
  }
  const priority = document.getElementById('plan-product-priority')?.value || state.prefs.productPriority || 'protein';
  const trafficRules=getPlanTrafficFilterRules();
  const prioritiseUseUp=!!state.prefs.prioritiseUseUpProducts&&getUseUpEntries().length>0;
  const usedInNewPlan = new Set();
  const pinnedRecipes = getPinnedRecipesList();

  const slots={};
  const pinnedSlots=new Set();
  for(let d=1;d<=days;d++){
    slots[d]={breakfastE:null,breakfastC:null,lunchE:null,lunchC:null,dinnerE:null,dinnerC:null};
  }

  // Pre-seed pinned/pre-selected recipes
  if(pinnedRecipes.length > 0){
    pinnedRecipes.forEach(pin => {
      const rec = getRecipe(pin.recipeId);
      if(!rec) return;
      const mealType = rec.type || 'dinner';
      const variant = pin.variant || 'original';
      const repeatDays = Math.min(days, Math.max(1, parseInt(pin.daysCount) || 1));
      const targetDay = parseInt(pin.targetDay) || 0;
      
      let candidateDays = [];
      if(targetDay > 0 && targetDay <= days){
        candidateDays = [targetDay];
        for(let d = 1; d <= days; d++){
          if(d !== targetDay && candidateDays.length < repeatDays) candidateDays.push(d);
        }
      } else {
        for(let d = 1; d <= days; d++) candidateDays.push(d);
      }

      let assignedCount = 0;
      for(const d of candidateDays){
        if(assignedCount >= repeatDays) break;
        const mode = getSlotMealMode(d, mealType);
        if(mode === 'none') continue;
        
        let placed = false;
        if(mode === 'both'){
          // In dual-user view ("both" / household context), pre-selecting or assigning a meal allocates for both household members simultaneously
          slots[d][mealType+'E'] = makePlanSlot(rec.id, variant);
          slots[d][mealType+'C'] = makePlanSlot(rec.id, variant);
          pinnedSlots.add(`${d}:${mealType}E`);
          pinnedSlots.add(`${d}:${mealType}C`);
          placed = true;
        } else if(mode === 'chloe' && (rec.who === 'both' || rec.who === 'any' || rec.who === 'Chloe' || rec.who === 'chloe' || !rec.who)){
          if(!slots[d][mealType+'C']){
            slots[d][mealType+'C'] = makePlanSlot(rec.id, variant);
            pinnedSlots.add(`${d}:${mealType}C`);
            placed = true;
          }
        } else if(mode === 'elliott' && (rec.who === 'both' || rec.who === 'any' || rec.who === 'Elliott' || rec.who === 'elliott' || !rec.who)){
          if(!slots[d][mealType+'E']){
            slots[d][mealType+'E'] = makePlanSlot(rec.id, variant);
            pinnedSlots.add(`${d}:${mealType}E`);
            placed = true;
          }
        }

        if(placed){
          usedInNewPlan.add(rec.id);
          assignedCount++;
        }
      }
    });
  }

  const scoreCandidateOption = (opt, type, who) => {
    let baseScore = 0;
    try {
      const bundle = calculateRecipeDisplayNutrition({ recipe: opt.recipe, variant: opt.variant, mealType: type });
      const portions = bundle?.portions;
      if(portions) {
        let cal = 0, prot = 0;
        if(who === 'Elliott' || who === 'elliott') {
          const fit = calculateFit(portions.eCal, portions.eProt, getTarget('e', 'cal') / 3, getTarget('e', 'prot') / 3);
          baseScore = fit?.score || 0;
          cal = portions.eCal || 0;
          prot = portions.eProt || 0;
        } else if(who === 'Chloe' || who === 'chloe') {
          const fit = calculateFit(portions.cCal, portions.cProt, getTarget('c', 'cal') / 3, getTarget('c', 'prot') / 3);
          baseScore = fit?.score || 0;
          cal = portions.cCal || 0;
          prot = portions.cProt || 0;
        } else {
          const fitE = calculateFit(portions.eCal, portions.eProt, getTarget('e', 'cal') / 3, getTarget('e', 'prot') / 3);
          const fitC = calculateFit(portions.cCal, portions.cProt, getTarget('c', 'cal') / 3, getTarget('c', 'prot') / 3);
          baseScore = ((fitE?.score || 0) + (fitC?.score || 0)) / 2;
          cal = ((portions.eCal || 0) + (portions.cCal || 0)) / 2;
          prot = ((portions.eProt || 0) + (portions.cProt || 0)) / 2;
        }
        // Automatic protein density bonus (higher protein per 100 kcal improves the score)
        const proteinDensity = cal > 0 ? (prot / cal) * 100 : 0;
        baseScore -= Math.min(2.0, proteinDensity * 0.1);
      }
    } catch(e){}

    if(opt.variant === 'enhanced') {
      baseScore -= 0.5; // Natural bonus for enhanced variants
    }
    return baseScore;
  };

  const choose = (type, who, shared=false) => {
    let p = getPlannerRecipeOptions(type, shared ? 'any' : who, { applyExclusions:true, avoidHistory:true, trafficRules });
    if(shared) p = p.filter(opt => opt.recipe?.who === 'both');
    p=p.filter(option=>plannerOptionHasUsableMappings(option,priority));
    let fresh = p.filter(opt => !usedInNewPlan.has(opt.id));
    if(!fresh.length) fresh = p;
    if(!fresh.length && !shared) fresh = getPlannerRecipeOptions(type, who, { applyExclusions:true, trafficRules }).filter(option=>plannerOptionHasUsableMappings(option,priority));
    
    if(prioritiseUseUp) {
      fresh = rankPlannerOptionsForUseUp(fresh, type, shared ? 'both' : who);
    } else if(fresh.length > 1) {
      fresh = fresh.map(opt => ({
        opt,
        score: scoreCandidateOption(opt, type, shared ? 'both' : who) + (Math.random() * 0.12)
      })).sort((a, b) => a.score - b.score).map(item => item.opt);
    }
    
    let picked = null;
    if(prioritiseUseUp) {
      picked = fresh[0] || null;
    } else if(fresh.length > 0) {
      const topPoolSize = Math.min(fresh.length, 3);
      picked = fresh[Math.floor(Math.random() * topPoolSize)] || fresh[0] || null;
    } else {
      picked = fresh[0] || null;
    }
    
    if(picked) usedInNewPlan.add(picked.id);
    return picked;
  };
  const unresolved=[];
  for(let d=1;d<=days;d++){
      ['breakfast','lunch','dinner'].forEach(meal => {
        const mode = getSlotMealMode(d, meal);
        if(mode === 'none') return;
        if(mode === 'both'){
          const hasE = !!slots[d][meal+'E'];
          const hasC = !!slots[d][meal+'C'];
          if(hasE && hasC) return;
          if(!hasE && !hasC){
            const rec = choose(meal, 'any', true);
            if(rec){
              slots[d][meal+'E'] = makePlanSlot(rec.id, rec.variant);
              slots[d][meal+'C'] = makePlanSlot(rec.id, rec.variant);
            } else {
              const recE = choose(meal, 'Elliott', false);
              const recC = choose(meal, 'Chloe', false);
              if(recE) slots[d][meal+'E'] = makePlanSlot(recE.id, recE.variant);
              else unresolved.push({day:d,meal,who:'Elliott',key:meal+'E'});
              if(recC) slots[d][meal+'C'] = makePlanSlot(recC.id, recC.variant);
              else unresolved.push({day:d,meal,who:'Chloe',key:meal+'C'});
            }
          } else if(!hasE){
            const recE = choose(meal, 'Elliott', false);
            if(recE) slots[d][meal+'E'] = makePlanSlot(recE.id, recE.variant);
            else unresolved.push({day:d,meal,who:'Elliott',key:meal+'E'});
          } else if(!hasC){
            const recC = choose(meal, 'Chloe', false);
            if(recC) slots[d][meal+'C'] = makePlanSlot(recC.id, recC.variant);
            else unresolved.push({day:d,meal,who:'Chloe',key:meal+'C'});
          }
          return;
        }
        const who = mode === 'chloe' ? 'Chloe' : 'Elliott';
        const key = meal + (mode === 'chloe' ? 'C' : 'E');
        if(slots[d][key]) return;
        const rec = choose(meal, who, false);
        if(rec) slots[d][key] = makePlanSlot(rec.id, rec.variant);
        else unresolved.push({day:d,meal,who,key});
      });
  }

  const cadence = getMealRepeatCadence();
  const applyCadence = (meal, blockSize) => {
    if(blockSize <= 1) return;
    for(let start = 1; start <= days; start += blockSize){
      const blockDays = [];
      for(let d = start; d <= Math.min(days, start + blockSize - 1); d++) blockDays.push(d);
      ['E','C'].forEach(personSuffix => {
        const key = meal + personSuffix;
        const sourceDay = blockDays.find(d => !state.excluded?.[d]?.[key] && slots[d]?.[key]);
        if(!sourceDay) return;
        const sourceSlot = slots[sourceDay][key];
        blockDays.forEach(d => {
          if(d === sourceDay || state.excluded?.[d]?.[key]) return;
          if(pinnedSlots.has(`${d}:${key}`)) return;
          if(!slots[d]) slots[d] = {};
          slots[d][key] = makePlanSlot(sourceSlot.id, sourceSlot.variant || 'original');
        });
      });
    }
  };
  applyCadence('breakfast', cadence.breakfast);
  applyCadence('lunch', cadence.lunch);
  applyCadence('dinner', cadence.dinner);

  Object.entries(slots).forEach(([day,daySlots])=>Object.entries(daySlots).forEach(([key,slot])=>{
    if(!slot)return;
    const info=getPlanSlotInfo(slot);
    const who=key.endsWith('C')?'Chloe':'Elliott';
    const meal=getMealTypeFromSlotKey(key);
    const row={recipe:info.recipe,variant:info.variant||'original'};
    if(!plannerRecipePassesTrafficFilter(row,meal,who,trafficRules)){
      daySlots[key]=null;
      unresolved.push({day:+day,meal,who,key,reason:'traffic-audit'});
    }
  }));

  let productSelections = lockProductSelectionsForSlots(slots, priority);
  if(prioritiseUseUp)productSelections=applyUseUpSelectionsToPlan(slots,productSelections);
  const blockers = findProductResolutionBlockersForSlots(slots, productSelections);
  if(blockers.length){
    Object.entries(slots).forEach(([day,daySlots])=>Object.entries(daySlots).forEach(([key,slot])=>{
      if(!slot)return;
      const single={1:{[key]:slot}};
      if(findProductResolutionBlockersForSlots(single,lockProductSelectionsForSlots(single,priority)).length){
        const meal=getMealTypeFromSlotKey(key);
        const who=key.endsWith('C')?'Chloe':'Elliott';
        daySlots[key]=null;
        unresolved.push({day:+day,meal,who,key});
      }
    }));
    productSelections=lockProductSelectionsForSlots(slots,priority);
    if(prioritiseUseUp)productSelections=applyUseUpSelectionsToPlan(slots,productSelections);
  }
  const remainingUnresolved=unresolved.filter(item=>!slots[item.day]?.[item.key]);
  const filled=selectedSlots.filter(item=>slots[item.day]?.[item.key]).length;
  if(!filled){
    const reason=remainingUnresolved.length?explainUnavailablePlanSlot(remainingUnresolved[0].meal,remainingUnresolved[0].who,priority,trafficRules):'No eligible recipes were found.';
    showPlanGenerationProblem('No meals could be generated',`${reason} Your current meal plan has been kept.`);
    return;
  }
  const planStartInput = document.getElementById('wizard-plan-start')?.value || document.getElementById('plan-start-date')?.value || state.plannerStartDate || getPlatePlanLocalToday();
  const warningMessages=[...new Set(remainingUnresolved.map(item=>`${formatPlanDayLabel({dayDates:buildPlanDayDates(planStartInput,days)},item.day,{short:true})} ${item.meal} for ${item.who}: ${explainUnavailablePlanSlot(item.meal,item.who,priority,trafficRules)}`))];
  state.overrides = {};
  const dayDates=buildPlanDayDates(planStartInput,days);
  state.prefs.productPriority = priority;
  state.prefs.mealRepeatCadence = cadence;
  state.prefs.planTrafficE = trafficRules.e;
  state.prefs.planTrafficC = trafficRules.c;
  const nextPlan = {days,slots,dayDates,slotReasons:{},productPriority:priority,trafficFilter:{ e: state.prefs.planTrafficE, c: state.prefs.planTrafficC },mealRepeatCadence:cadence,productSelections,useUpProductIds:prioritiseUseUp?getUseUpEntries().map(entry=>entry.productId):[],shoppingAtHome:{},warnings:warningMessages,score:null,confirmedShopping:false,mealPrepGroups:[],declinedMealPrepGroups:[],updatedAt:new Date().toISOString()};
  nextPlan.score = calculatePlanScore(nextPlan);
  platePlanEarlierDaysExpanded = false;

  const autoPrepSuggestions = findMealPrepSuggestions(nextPlan).filter(s => {
    const repeat = cadence[s.mealKey] || 1;
    return repeat > 1 && (s.days || []).length >= repeat;
  });
  nextPlan.mealPrepGroups = autoPrepSuggestions.map(s => ({ key:s.key, recipeId:s.recipeId, variant:s.variant, mealKey:s.mealKey, peopleKey:s.peopleKey, days:s.days }));

  // Stage into draft without immediately persisting to the database
  state.draftBackupPlan = clonePlatePlanValue(state.plan || {});
  state.draftPlan = nextPlan;
  state.isDraftPlan = true;
  state.plan = nextPlan;
  state.plannerStep = 2;

  markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
  renderPlan();
  closePlanOptionsWorkspace();
  const message=`Generated ${filled} of ${selectedSlots.length} selected meals (Step 1: Review Plan).`;
  showPlatePlanToast(message);
  if(remainingUnresolved.length){
    const host=document.getElementById('plan-warnings');
    if(host)host.innerHTML=`<div class="msg warn"><strong>${ppEscapeHtml(message)}</strong><div style="margin-top:5px">${warningMessages.slice(0,6).map(ppEscapeHtml).join('<br>')}${warningMessages.length>6?`<br>And ${warningMessages.length-6} more unresolved meals.`:''}</div><button class="btn sm ghost" style="margin-top:9px" onclick="openPlanOptionsWorkspace()">Edit plan options</button></div>`;
  }
}

function getSlotPersonPrefix(slotKey){
  return String(slotKey || '').endsWith('E') ? 'e' : String(slotKey || '').endsWith('C') ? 'c' : '';
}

function getPlannedSlotNutrition(recipe, slotKey, instanceId, planContext = state.plan){
  if(!recipe) return null;
  const mealType = getMealTypeFromSlotKey(slotKey) || (recipe.types && recipe.types[0]) || recipe.type || 'dinner';
  const bundle = calculateRecipeDisplayNutrition({ recipe, ingredients:recipe.ingredients || [], serves:recipe.serves || 1, who:recipe.who || 'both', mealType, instanceId, planContext });
  const recalc = bundle?.nutrition || { cal:0, prot:0 };
  const portions = bundle?.portions || calcPortions(recalc.perServing || recalc, state.prefs, recipe.serves || 1, recipe.who || 'both', mealType);
  const prefix = getSlotPersonPrefix(slotKey);
  if(prefix === 'e') return portions.ePct > 0 ? { cal: portions.eCal, prot: portions.eProt, portions } : { cal: 0, prot: 0, portions };
  if(prefix === 'c') return portions.cPct > 0 ? { cal: portions.cCal, prot: portions.cProt, portions } : { cal: 0, prot: 0, portions };
  return { cal: recalc.cal, prot: recalc.prot, portions };
}


function getSlotShoppingScale(recipe, slotKey, instanceId = null, planContext = state.plan, overrideStore = state.overrides) {
  if(!recipe) return 1;
  const serves = +recipe.serves || 1;
  const mealType = getMealTypeFromSlotKey(slotKey) || (recipe.types && recipe.types[0]) || recipe.type || 'dinner';
  const bundle = calculateRecipeDisplayNutrition({
    recipe:null,
    ingredients:recipe.ingredients || [],
    serves,
    who:recipe.who || 'both',
    mealType,
    instanceId,
    planContext,
    overrideStore
  });
  const portions = bundle?.portions || calcPortions({}, state.prefs, serves, recipe.who || 'both', mealType);
  const servingShare = String(slotKey || '').endsWith('C') ? portions.cSingleServ : portions.eSingleServ;
  return serves > 0 ? Math.max(servingShare, 0) / serves : 1;
}

function getShoppingAmount(ing, bankIng, scale = 1) {
  if(typeof ing !== 'object') return { qty: 0, unit: 'g', grams: 0, label: '' };
  const unit = (ing.unit || '').toLowerCase().replace(/s$/,'');
  const qty = (+ing.qty || 0) * scale;
  const grams = getEffectiveIngredientGrams(ing, bankIng) * scale;
  if(unit === 'kg') return { qty: qty * 1000, unit: 'g', grams, label: `${Math.round(qty * 1000)}g` };
  if(unit === 'g') return { qty, unit: 'g', grams, label: `${Math.round(qty)}g` };
  if(unit === 'l') return { qty: qty * 1000, unit: 'ml', grams, label: `${Math.round(qty * 1000)}ml` };
  if(unit === 'ml') return { qty, unit: 'ml', grams, label: `${Math.round(qty)}ml` };
  if(unit === 'qty') return { qty, unit: 'item', grams, label: `${Math.round(qty * 10) / 10} item${qty === 1 ? '' : 's'}` };
  return { qty: grams, unit: 'g', grams, label: `${Math.round(grams)}g` };
}

function formatGarlicBulbCloveAmount(grams){
  const g = +grams || 0;
  if(g <= 0) return '';
  const cloves = Math.max(1, Math.round(g / 6));
  const bulbs = Math.floor(cloves / 11);
  const remainder = cloves % 11;
  const parts = [];
  if(bulbs > 0) parts.push(`${bulbs} bulb${bulbs === 1 ? '' : 's'}`);
  if(remainder > 0) parts.push(`${remainder} clove${remainder === 1 ? '' : 's'}`);
  return parts.join(' and ');
}

function formatRecipePackIngredientAmount(ing, bankIng, amount){
  if(ing?.stockWaterMl) {
    const stockText = formatStockIngredientText(ing, amount?.qty && ing.qty ? amount.qty / ing.qty : 1);
    if(stockText) return stockText;
  }
  if(isFreshGarlicIngredient(ing, bankIng) && amount?.grams > 0) {
    const garlic = formatGarlicBulbCloveAmount(amount.grams);
    if(garlic) return `${garlic} garlic`;
  }
  const name = (ing?.name || bankIng?.name || '').trim();
  const unit = amount?.unit || 'g';
  const qty = +amount?.qty || 0;
  if(unit === 'ml') return `${Math.round(qty)}ml ${name}`.trim();
  if(unit === 'item') return `${Math.round(qty * 10) / 10} ${name}`.trim();
  return `${Math.round(qty)}g ${name}`.trim();
}

function togglePlatePlanEarlierDays(){
  platePlanEarlierDaysExpanded=!platePlanEarlierDaysExpanded;
  renderPlan();
  if(platePlanEarlierDaysExpanded){
    setTimeout(()=>document.getElementById('plan-earlier-days-heading')?.scrollIntoView({block:'start',behavior:'smooth'}),0);
  }
}

function checkIsPlanExpired(plan, localToday){
  if(!plan || !plan.slots) return false;
  const days = plan.days || Object.keys(plan.slots).length || 0;
  if(!days) return false;
  const datedEntries = Object.entries(plan.dayDates || {}).filter(([, v]) => !!parsePlanLocalDate(v));
  if(!datedEntries.length) return false;
  const dates = datedEntries.map(([, v]) => v).sort();
  const maxDate = dates[dates.length - 1];
  return maxDate < localToday;
}

function getTomorrowLocalDate(){
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateNewPlanStartingTomorrow(){
  const tomorrow = getTomorrowLocalDate();
  const startInput = document.getElementById('plan-start-date');
  if(startInput) startInput.value = tomorrow;
  const quickStartInput = document.getElementById('plan-quick-start');
  if(quickStartInput) quickStartInput.value = tomorrow;
  
  const days = state.plan?.days || parseInt(document.getElementById('plan-days')?.value, 10) || 7;
  if(state.plan) {
    state.plan.dayDates = buildPlanDayDates(tomorrow, days);
  }
  
  const setupCard = document.getElementById('plan-setup-card');
  if(setupCard) setupCard.style.display = '';

  generatePlan();
  showPlatePlanToast('Generated new meal plan starting tomorrow!');
}

function openPlanSetupAndFocus(){
  const setupCard = document.getElementById('plan-setup-card');
  if(setupCard){
    setupCard.style.display = '';
    setupCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const tomorrow = getTomorrowLocalDate();
  const startInput = document.getElementById('plan-start-date');
  if(startInput && !startInput.value) startInput.value = tomorrow;
}

function formatPlanDateShort(dateString){
  if(!dateString) return '';
  const date = parsePlanLocalDate(dateString);
  if(!date) return String(dateString);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}
window.formatPlanDateShort = formatPlanDateShort;

// ==========================================
// PLATEPLAN v3.0.4 MEAL PLANNER 4-STEP WIZARD
// ==========================================

function getPlannerWizardStep() {
  if (state.plannerStep && [1, 2, 3, 4].includes(state.plannerStep)) {
    return state.plannerStep;
  }
  if (state.plan && state.plan.slots && Object.keys(state.plan.slots).length > 0) {
    return 2; // Default to Review Plan if active plan exists
  }
  return 1; // Otherwise start with Configure Requests
}

function setPlannerWizardStep(step) {
  state.plannerStep = Math.max(1, Math.min(4, step));
  renderPlannerWizard();
}
window.setPlannerWizardStep = setPlannerWizardStep;
window.goToPlannerStep = setPlannerWizardStep;

// Exclusions helpers
function getActiveWizardExclusions() {
  const list = [];
  const excluded = state.excluded || {};
  Object.entries(excluded).forEach(([day, slots]) => {
    if (!slots) return;
    const d = parseInt(day, 10);
    ['breakfast', 'lunch', 'dinner'].forEach(meal => {
      const eExcl = !!slots[meal + 'E'];
      const cExcl = !!slots[meal + 'C'];
      if (eExcl && cExcl) {
        list.push({ day: d, meal, who: 'Both', keys: [meal + 'E', meal + 'C'], label: `Day ${d} ${meal.charAt(0).toUpperCase() + meal.slice(1)} (Both)` });
      } else if (eExcl) {
        list.push({ day: d, meal, who: 'Elliott', keys: [meal + 'E'], label: `Day ${d} ${meal.charAt(0).toUpperCase() + meal.slice(1)} (Elliott)` });
      } else if (cExcl) {
        list.push({ day: d, meal, who: 'Chloe', keys: [meal + 'C'], label: `Day ${d} ${meal.charAt(0).toUpperCase() + meal.slice(1)} (Chloe)` });
      }
    });
  });
  return list;
}

function removeWizardExclusion(day, keys) {
  if (!state.excluded || !state.excluded[day]) return;
  (Array.isArray(keys) ? keys : [keys]).forEach(k => {
    state.excluded[day][k] = false;
  });
  saveState();
  renderPlannerWizard();
}
window.removeWizardExclusion = removeWizardExclusion;

function addWizardExclusionFromUI() {
  const day = parseInt(document.getElementById('wizard-excl-day')?.value, 10) || 1;
  const meal = document.getElementById('wizard-excl-meal')?.value || 'all';
  const person = document.getElementById('wizard-excl-person')?.value || 'both';

  state.excluded = state.excluded || {};
  state.excluded[day] = state.excluded[day] || {};

  const meals = meal === 'all' ? ['breakfast', 'lunch', 'dinner'] : [meal];
  meals.forEach(m => {
    if (person === 'both' || person === 'elliott') state.excluded[day][m + 'E'] = true;
    if (person === 'both' || person === 'chloe') state.excluded[day][m + 'C'] = true;
  });
  saveState();
  renderPlannerWizard();
}
window.addWizardExclusionFromUI = addWizardExclusionFromUI;

function skipAllWizardDinners() {
  const days = state.plannerDays || parseInt(document.getElementById('wizard-plan-days')?.value, 10) || 10;
  state.excluded = state.excluded || {};
  for (let d = 1; d <= days; d++) {
    state.excluded[d] = state.excluded[d] || {};
    state.excluded[d]['dinnerE'] = true;
    state.excluded[d]['dinnerC'] = true;
  }
  saveState();
  renderPlannerWizard();
}
window.skipAllWizardDinners = skipAllWizardDinners;

function clearAllWizardExclusions() {
  initExcluded(true);
  renderPlannerWizard();
}
window.clearAllWizardExclusions = clearAllWizardExclusions;

// Pinned recipes inline helpers
function filterWizardPinRecipes(query) {
  const container = document.getElementById('wizard-pin-search-results');
  if (!container) return;
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  const matches = (state.recipes || []).filter(r => String(r?.name || '').toLowerCase().includes(q)).slice(0, 6);
  if (!matches.length) {
    container.style.display = 'block';
    container.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text3)">No recipes found.</div>';
    return;
  }
  const targetDay = parseInt(document.getElementById('wizard-pin-day')?.value, 10) || 1;
  container.style.display = 'block';
  container.innerHTML = matches.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600">${ppEscapeHtml(r.name)}</span>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:2px 8px" onclick="pinWizardRecipe('${ppEscapeAttr(r.id)}', ${targetDay})">+ Pin Day ${targetDay}</button>
    </div>
  `).join('');
}
window.filterWizardPinRecipes = filterWizardPinRecipes;

function pinWizardRecipe(recipeId, day) {
  state.pinnedRecipes = state.pinnedRecipes || [];
  state.pinnedRecipes = state.pinnedRecipes.filter(p => p.recipeId !== recipeId);
  state.pinnedRecipes.push({ recipeId, targetDay: day, daysCount: 1, variant: 'original' });
  saveState();
  renderPlannerWizard();
}
window.pinWizardRecipe = pinWizardRecipe;

function unpinWizardRecipe(recipeId) {
  state.pinnedRecipes = (state.pinnedRecipes || []).filter(p => p.recipeId !== recipeId);
  saveState();
  renderPlannerWizard();
}
window.unpinWizardRecipe = unpinWizardRecipe;

// Pantry Use-Up inline helpers
function filterWizardUseUpProducts(query) {
  const container = document.getElementById('wizard-useup-search-results');
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
  }).slice(0, 6);

  if (!matches.length) {
    container.style.display = 'block';
    container.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text3)">No products found.</div>';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = matches.map(p => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600">${ppEscapeHtml(p.name)} <span style="color:var(--text3);font-size:11px">(${ppEscapeHtml(p.brand || 'No brand')})</span></span>
      <button type="button" class="btn sm primary" style="font-size:11px;padding:2px 8px" onclick="addWizardUseUpProduct('${ppEscapeAttr(p.id)}')">+ Use Up</button>
    </div>
  `).join('');
}
window.filterWizardUseUpProducts = filterWizardUseUpProducts;

function addWizardUseUpProduct(productId) {
  state.useUpProducts = state.useUpProducts || [];
  if (!state.useUpProducts.includes(productId)) {
    state.useUpProducts.push(productId);
  }
  state.prefs = state.prefs || {};
  state.prefs.prioritiseUseUpProducts = true;
  saveState();
  renderPlannerWizard();
}
window.addWizardUseUpProduct = addWizardUseUpProduct;

function removeWizardUseUpProduct(productId) {
  state.useUpProducts = (state.useUpProducts || []).filter(id => id !== productId);
  saveState();
  renderPlannerWizard();
}
window.removeWizardUseUpProduct = removeWizardUseUpProduct;

// DEDICATED PLAN DELETION PIPELINE (v3.0.9)
if (!window.state) window.state = {};
window.state.deletedPlanIds = window.state.deletedPlanIds || [];
window.deletedPlanIds = window.deletedPlanIds || window.state.deletedPlanIds;

async function deletePlan(planId) {
  if (!window.state) window.state = {};
  const previousPlan = window.state.plan ? JSON.parse(JSON.stringify(window.state.plan)) : {};

  // 1. Clear plan from state: state.plan = {}
  window.state.plan = {};
  if (typeof state !== 'undefined' && state) {
    state.plan = {};
  }

  // 2. Erase from localStorage
  localStorage.removeItem('plateplan_plan_backup');

  // 3. Synchronously call renderAll()
  if (typeof renderPlanHistory === 'function') renderPlanHistory();
  if (typeof renderPlan === 'function') renderPlan();
  renderAll();

  // 4. Run Firestore update within a try/catch
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      const householdDocRef = db.collection('households').doc(householdId);
      await householdDocRef.collection('plans').doc('current').delete();
      const fb = window.firebase || (window.PLATEPLAN_FIREBASE && window.PLATEPLAN_FIREBASE.firebase) || (window.firebaseObj);
      if (fb) {
        await householdDocRef.update({ plan: fb.firestore.FieldValue.delete() });
      }
      showPlatePlanToast('Plan deleted successfully. ✓');
    }
  } catch (err) {
    console.error('[PLAN DELETE ERROR - ROLLING BACK]', err);
    // 5. Rollback to restore the local state.plan from its in-memory clone and re-render
    window.state.plan = previousPlan;
    if (typeof state !== 'undefined' && state) {
      state.plan = previousPlan;
    }
    if (typeof renderPlanHistory === 'function') renderPlanHistory();
    if (typeof renderPlan === 'function') renderPlan();
    renderAll();
    showPlatePlanToast('Failed to delete plan from cloud. Plan restored.', 'error');
  }
}
window.deletePlan = deletePlan;

// ATOMIC PRODUCT PERSISTENCE (v3.0.4)
async function persistProductToBank(newProduct) {
  if (!newProduct) throw new Error('Cannot persist empty product');
  if (!newProduct.id) newProduct.id = 'ing' + Date.now();
  if (!newProduct.updatedAt) newProduct.updatedAt = new Date().toISOString();

  // 1. Ensure window.state.products and window.state.ingredients exist and append
  if (!Array.isArray(window.state.products)) {
    window.state.products = Array.isArray(window.state.ingredients) ? [...window.state.ingredients] : (Array.isArray(state?.ingredients) ? [...state.ingredients] : []);
  }
  if (!Array.isArray(state.products)) {
    state.products = window.state.products;
  }
  if (!Array.isArray(state.ingredients)) {
    state.ingredients = [];
  }
  if (!Array.isArray(window.state.ingredients)) {
    window.state.ingredients = state.ingredients;
  }

  const pIdx = window.state.products.findIndex(p => p && p.id === newProduct.id);
  if (pIdx > -1) {
    window.state.products[pIdx] = newProduct;
  } else {
    window.state.products.push(newProduct);
  }

  const iIdx = state.ingredients.findIndex(p => p && p.id === newProduct.id);
  if (iIdx > -1) {
    state.ingredients[iIdx] = newProduct;
  } else {
    state.ingredients.push(newProduct);
  }

  rebuildPlatePlanIndexes();

  // 2. Immediately dispatch a Firestore write to the households/elliott-chloe/products collection
  const householdId = window.CURRENT_HOUSEHOLD_ID || window.activeHouseholdId || state?.meta?.householdId || 'elliott-chloe';
  const cleaned = sanitizePayloadForFirestore(unwrapAndCleanItem(newProduct));
  
  let firestorePromise = null;
  const db = platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if (db) {
    const writeProducts = db.collection('households').doc(householdId).collection('products').doc(newProduct.id).set(cleaned, { merge: true });
    const writeIngredients = db.collection('households').doc(householdId).collection('ingredients').doc(newProduct.id).set(cleaned, { merge: true });
    firestorePromise = Promise.all([writeProducts, writeIngredients]).catch(err => {
      console.warn('[v3.3.7-mod STATE PERSISTENCE] persistProductToBank Firestore write warning:', err);
    });
  } else {
    firestorePromise = Promise.resolve();
  }

  try {
    safeLocalStorageSet(SK, safeJsonStringify(state));
  } catch(e) {}

  await Promise.race([firestorePromise, new Promise(r => setTimeout(r, 200))]);
  return newProduct;
}
window.persistProductToBank = persistProductToBank;

// SEARCHABLE RECIPE SWAP MODAL (v3.0.4 Step 2)
let currentSearchableSwapContext = null;

function ensureSearchableRecipeSwapModalDom() {
  let modal = document.getElementById('searchable-recipe-swap-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'searchable-recipe-swap-modal';
  modal.className = 'modal-backdrop';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-card" style="max-width: 680px; width: 92%; max-height: 85vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 16px; background: var(--surface); box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid var(--border);">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--surface2);">
        <div>
          <h3 id="swap-modal-title" style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text);">Swap Recipe</h3>
          <div id="swap-modal-subtitle" style="font-size: 12px; color: var(--text2); margin-top: 2px;">Search across all recipes by title, ingredient, or tag.</div>
        </div>
        <button type="button" class="btn ghost sm" onclick="closeSearchableRecipeSwapModal()" style="font-size: 18px; line-height: 1; padding: 4px 8px;">✕</button>
      </div>
      <div style="padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--surface);">
        <input type="search" id="swap-modal-search" class="input" placeholder="Type recipe name, ingredient (e.g. chicken, tofu), or tag..." style="width: 100%; font-size: 14px; padding: 8px 12px;" oninput="filterSearchableRecipeSwapModal(this.value)" autofocus>
      </div>
      <div id="swap-modal-results" style="flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 8px; max-height: 55vh;">
        <!-- Candidate recipes render here -->
      </div>
      <div style="padding: 12px 20px; border-top: 1px solid var(--border); background: var(--surface2); display: flex; justify-content: flex-end;">
        <button type="button" class="btn ghost sm" onclick="closeSearchableRecipeSwapModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function openSearchableRecipeSwapModal(day, slotKey, isShared = false) {
  currentSearchableSwapContext = { day, slotKey, isShared };
  const modal = ensureSearchableRecipeSwapModalDom();
  const mealType = getMealTypeFromSlotKey(slotKey) || 'dinner';
  const person = isShared ? 'Both (Elliott & Chloe)' : (slotKey.endsWith('C') ? 'Chloe' : 'Elliott');
  
  const titleEl = document.getElementById('swap-modal-title');
  if (titleEl) titleEl.textContent = `Swap ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} for ${person} (Day ${day})`;
  
  const searchInput = document.getElementById('swap-modal-search');
  if (searchInput) searchInput.value = '';
  
  filterSearchableRecipeSwapModal('');
  modal.style.display = 'flex';
  if (searchInput) setTimeout(() => searchInput.focus(), 50);
}
window.openSearchableRecipeSwapModal = openSearchableRecipeSwapModal;

function closeSearchableRecipeSwapModal() {
  const modal = document.getElementById('searchable-recipe-swap-modal');
  if (modal) modal.style.display = 'none';
  currentSearchableSwapContext = null;
}
window.closeSearchableRecipeSwapModal = closeSearchableRecipeSwapModal;

function filterSearchableRecipeSwapModal(query = '') {
  const resultsContainer = document.getElementById('swap-modal-results');
  if (!resultsContainer) return;
  if (!currentSearchableSwapContext) return;

  const { day, slotKey, isShared } = currentSearchableSwapContext;
  const currentSlot = state.plan?.slots?.[day]?.[slotKey];
  const currentId = currentSlot?.id;
  const cleanQ = (query || '').toLowerCase().trim();

  // All recipes from window.state.recipes
  const allRecipes = Array.isArray(window.state?.recipes) ? window.state.recipes : (Array.isArray(state?.recipes) ? state.recipes : []);
  
  const candidates = allRecipes.filter(r => {
    if (!r || !r.id) return false;
    if (r.id === currentId) return false;
    if (!cleanQ) return true;
    
    const nameMatch = (r.name || r.title || '').toLowerCase().includes(cleanQ);
    if (nameMatch) return true;
    
    const ingMatch = Array.isArray(r.ingredients) && r.ingredients.some(i => (i?.name || i?.raw || '').toLowerCase().includes(cleanQ));
    if (ingMatch) return true;
    
    const tagMatch = Array.isArray(r.tags) && r.tags.some(t => String(t).toLowerCase().includes(cleanQ));
    if (tagMatch) return true;

    const catMatch = (r.category || r.cuisine || '').toLowerCase().includes(cleanQ);
    return catMatch;
  });

  resultsContainer.innerHTML = '';

  if (candidates.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.style.cssText = 'text-align: center; padding: 24px; color: var(--text3); font-size: 13px;';
    emptyDiv.textContent = `No recipes match "${query}". Try another search term.`;
    resultsContainer.appendChild(emptyDiv);
    return;
  }

  const placeholderImg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><rect width="44" height="44" rx="6" fill="%23e5e7eb"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="20">🍲</text></svg>`;

  candidates.forEach(r => {
    const cal = Math.round(r.cal || 0);
    const prot = Math.round(r.prot || 0);
    
    // Simulate placing r in slot and get daily fit score
    let fitScorePercent = 85;
    try {
      if (state.plan?.slots?.[day]) {
        const simPlan = {
          ...state.plan,
          slots: {
            ...state.plan.slots,
            [day]: {
              ...state.plan.slots[day],
              [slotKey]: makePlanSlot(r.id, 'original')
            }
          }
        };
        const summary = getPlanDaySummary(day, simPlan);
        fitScorePercent = Math.max(0, Math.min(100, Math.round(100 - (summary?.score || 0))));
      }
    } catch(e) {}

    const row = document.createElement('div');
    row.className = 'swap-candidate-row';
    row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; transition: border-color 0.15s ease;';

    const img = document.createElement('img');
    img.style.cssText = 'width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex-shrink: 0;';
    img.alt = r.name || 'Recipe';
    img.src = r.photo || r.img || r.image || placeholderImg;
    img.onerror = () => { img.src = placeholderImg; };
    row.appendChild(img);

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex: 1; min-width: 0;';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-weight: 650; font-size: 13.5px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    titleEl.textContent = r.name || r.title || 'Untitled Recipe';
    infoDiv.appendChild(titleEl);

    const metaDiv = document.createElement('div');
    metaDiv.style.cssText = 'font-size: 11.5px; color: var(--text2); margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;';

    const calSpan = document.createElement('span');
    const calStrong = document.createElement('strong');
    calStrong.textContent = String(cal);
    calSpan.appendChild(calStrong);
    calSpan.appendChild(document.createTextNode(' kcal'));
    metaDiv.appendChild(calSpan);

    const dot1 = document.createElement('span');
    dot1.textContent = '·';
    metaDiv.appendChild(dot1);

    const protSpan = document.createElement('span');
    const protStrong = document.createElement('strong');
    protStrong.textContent = `${prot}g`;
    protSpan.appendChild(protStrong);
    protSpan.appendChild(document.createTextNode(' protein'));
    metaDiv.appendChild(protSpan);

    const dot2 = document.createElement('span');
    dot2.textContent = '·';
    metaDiv.appendChild(dot2);

    const tagSpan = document.createElement('span');
    tagSpan.className = 'tag';
    const isGood = fitScorePercent >= 75;
    tagSpan.style.cssText = `font-size: 10.5px; padding: 1px 6px; font-weight: 700; background: ${isGood ? 'var(--green-bg, #dcfce7)' : 'var(--amber-bg, #fef3c7)'}; color: ${isGood ? 'var(--green, #16a34a)' : 'var(--amber, #d97706)'}; border: 1px solid currentColor; border-radius: 4px;`;
    tagSpan.textContent = `Fit Score ${fitScorePercent}%`;
    metaDiv.appendChild(tagSpan);

    infoDiv.appendChild(metaDiv);
    row.appendChild(infoDiv);

    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = 'btn sm primary';
    swapBtn.style.cssText = 'font-size: 12px; font-weight: 700; padding: 6px 12px; white-space: nowrap; flex-shrink: 0;';
    swapBtn.textContent = 'Select & Swap';
    swapBtn.onclick = () => selectAndSwapRecipe(r.id, 'original');
    row.appendChild(swapBtn);

    resultsContainer.appendChild(row);
  });
}
window.filterSearchableRecipeSwapModal = filterSearchableRecipeSwapModal;

function selectAndSwapRecipe(recipeId, variant = 'original') {
  if (!currentSearchableSwapContext || !state.plan?.slots) return;
  const { day, slotKey, isShared } = currentSearchableSwapContext;
  if (!state.plan.slots[day]) state.plan.slots[day] = {};

  if (isShared) {
    const meal = getMealTypeFromSlotKey(slotKey) || 'dinner';
    state.plan.slots[day][meal + 'E'] = makePlanSlot(recipeId, variant);
    state.plan.slots[day][meal + 'C'] = makePlanSlot(recipeId, variant);
  } else {
    state.plan.slots[day][slotKey] = makePlanSlot(recipeId, variant);
  }

  state.plan.score = calculatePlanScore(state.plan);
  const autoPrepSuggestions = findMealPrepSuggestions(state.plan);
  state.plan.mealPrepGroups = autoPrepSuggestions.map(s => ({ key:s.key, recipeId:s.recipeId, variant:s.variant, mealKey:s.mealKey, peopleKey:s.peopleKey, days:s.days }));
  saveState();
  closeSearchableRecipeSwapModal();
  renderPlannerWizard();
  showPlatePlanToast('Recipe swapped & Fit Score updated! ✓');
}
window.selectAndSwapRecipe = selectAndSwapRecipe;

// Backward-compatibility wrapper for any inline caller
function toggleInlineSwapPanel(day, slotKey) {
  openSearchableRecipeSwapModal(day, slotKey);
}
window.toggleInlineSwapPanel = toggleInlineSwapPanel;

function executeInlineMealSwap(day, slotKey, recipeId, variant = 'original') {
  selectAndSwapRecipe(recipeId, variant);
}
window.executeInlineMealSwap = executeInlineMealSwap;

// Shopping & substitution helpers for Step 3
function toggleShoppingAtHome(itemKey) {
  state.plan = state.plan || {};
  state.plan.shoppingAtHome = state.plan.shoppingAtHome || {};
  state.plan.shoppingAtHome[itemKey] = !state.plan.shoppingAtHome[itemKey];
  saveState();
  renderPlannerWizard();
}
window.toggleShoppingAtHome = toggleShoppingAtHome;

function toggleInlineShoppingSubst(itemKey, groupId) {
  const panel = document.getElementById(`subst-drawer-${itemKey}`);
  if (!panel) return;
  if (panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }
  const products = getGroupProducts(groupId);
  if (!products.length) {
    panel.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px">No alternate products found in this sub-type.</div>';
    panel.style.display = 'block';
    return;
  }
  panel.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">Select brand replacement:</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${products.map(p => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${ppEscapeHtml(p.name)}</div>
            <div style="font-size:11px;color:var(--text2)">${ppEscapeHtml(p.brand || 'No brand')} · £${(+p.price || 0).toFixed(2)} (${p.packSize || ''}${p.packUnit || ''})</div>
          </div>
          <button type="button" class="btn sm ghost" style="font-size:11px;padding:3px 8px" onclick="selectShoppingProductOverride('${ppEscapeAttr(groupId)}', '${ppEscapeAttr(p.id)}')">Use This</button>
        </div>
      `).join('')}
    </div>
  `;
  panel.style.display = 'block';
}
window.toggleInlineShoppingSubst = toggleInlineShoppingSubst;

function selectShoppingProductOverride(groupId, productId) {
  state.plan = state.plan || {};
  state.plan.productSelections = state.plan.productSelections || {};
  state.plan.productSelections[groupId] = productId;
  saveState();
  renderPlannerWizard();
  showPlatePlanToast('Product preference updated! ✓');
}
window.selectShoppingProductOverride = selectShoppingProductOverride;

// Reset Planner to Step 1 & Clear Draft Plan
function resetPlannerStartFresh() {
  if (state) {
    state.draftPlan = null;
    state.draftBackupPlan = null;
    state.isDraftPlan = false;
    state.plannerStep = 1;
    state.pinnedRecipes = [];
    state.useUpProducts = [];
    if (state.planOptions) {
      state.planOptions.pinnedMeals = [];
      state.planOptions.useUp = [];
    }
  }
  if (window.state) {
    window.state.draftPlan = null;
    window.state.draftBackupPlan = null;
    window.state.isDraftPlan = false;
    window.state.plannerStep = 1;
  }
  const today = new Date().toISOString().split('T')[0];
  const startInp = document.getElementById('wizard-plan-start');
  if (startInp) startInp.value = today;
  state.plannerStartDate = today;
  const daysInp = document.getElementById('wizard-plan-days');
  if (daysInp) daysInp.value = '10';
  state.plannerDays = 10;

  saveState();
  renderPlannerWizard();
  showPlatePlanToast('Meal planner reset to Step 1. ✓');
}
window.resetPlannerStartFresh = resetPlannerStartFresh;

// Step 4: Atomic Commit & Auto-Redirect (v3.0.4)
function commitPlannerWizardPlan() {
  if (!state.plan || !state.plan.slots) {
    showPlatePlanToast('No active plan found to commit.');
    return;
  }
  const currentPlan = state.plan;
  const committedPlan = {
    ...currentPlan,
    score: calculatePlanScore(currentPlan),
    mealPrepGroups: currentPlan.mealPrepGroups || [],
    appliedAt: new Date().toISOString(),
    savedStatus: 'Saved',
    shoppingAtHome: currentPlan.shoppingAtHome || {},
    version: '3.0.6',
    confirmedShopping: true,
    updatedAt: new Date().toISOString()
  };

  state.plan = committedPlan;
  window.state = state;
  delete state.draftPlan;
  delete state.draftBackupPlan;
  state.isDraftPlan = false;
  state.plannerStep = 2; // Next time, show current review
  
  const commitPromise = (typeof savePlanTransactional === 'function')
    ? savePlanTransactional(committedPlan)
    : (typeof saveState === 'function' ? Promise.resolve(saveState(true)) : Promise.resolve());

  commitPromise.then(() => {
    saveState(true);
    if (platePlanCloudReady && !platePlanSyncSuppress) queuePlatePlanCloudDiff();
    markPlatePlanViewsDirty('today', 'planner', 'shopping', 'planlib');
    showPlatePlanToast('Meal plan v3.0.6 committed! Displaying Today\'s meals. ✓');
    if (typeof showView === 'function') {
      showView('today');
    }
    window.location.hash = '#/today';
    if (typeof renderToday === 'function') {
      renderToday();
    }
  }).catch(err => {
    console.error('Failed to commit meal plan:', err);
    showPlatePlanToast('Failed to commit meal plan. Check network connection.');
  });
}
window.commitPlannerWizardPlan = commitPlannerWizardPlan;

function computeWizardShoppingAgg(plan = state.plan) {
  if (!plan?.slots) return { items: [], totalCost: 0 };
  const agg = {};
  const days = plan.days || Object.keys(plan.slots).length;

  for (let d = 1; d <= days; d++) {
    const s = plan.slots[d] || {};
    SLOTS.forEach(sl => {
      if (state.excluded?.[d]?.[sl.key]) return;
      const slotData = s[sl.key];
      if (!slotData) return;
      const slotInfo = getPlanSlotInfo(slotData);
      const r = slotInfo.active;
      if (!r || !r.ingredients) return;
      const instanceId = slotInfo.instanceId;
      const context = getPlanContextForInstance(instanceId);
      const slotScale = getSlotShoppingScale(r, sl.key, instanceId);

      (r.ingredients || []).forEach(ing => {
        if (isIngredientRemovedInContext(ing, context)) return;
        const adjustedIng = getAdjustedIngredientForContext(ing, context);
        const resolved = resolveProductForIngredientWithContext(adjustedIng, context);
        const bankIng = resolved.product || (adjustedIng.bankId ? state.ingredients.find(i => i.id === adjustedIng.bankId) : null);
        const actualBankId = bankIng?.id || '';
        const groupId = resolved.groupId || bankIng?.groupId || '';
        const actualName = resolved.group?.name || bankIng?.name || adjustedIng.name || adjustedIng.raw || 'Ingredient';
        const raw = ingRaw(adjustedIng);
        const amt = getShoppingAmount(adjustedIng, bankIng, slotScale);
        const k = getShoppingLineStateKey(groupId, actualBankId, raw);

        if (!agg[k]) {
          agg[k] = {
            key: k,
            name: actualName,
            bankIng,
            groupId,
            grams: 0,
            needQty: 0,
            needUnit: amt.needUnit,
            cat: CAT[resolved.group?.cat || bankIng?.cat] || 'General'
          };
        }
        agg[k].grams += (amt.grams || 0);
        agg[k].needQty += (amt.needQty || 0);
      });
    });
  }

  let totalCost = 0;
  const items = Object.values(agg).map(item => {
    let cost = 0;
    let packsNeeded = 1;
    if (item.bankIng && item.bankIng.price) {
      const price = +item.bankIng.price || 0;
      const packSize = +item.bankIng.packSize || 100;
      const qty = item.needUnit === 'item' ? item.needQty : item.grams;
      packsNeeded = Math.ceil(qty / Math.max(1, packSize));
      cost = price * packsNeeded;
    }
    const isAtHome = !!(plan.shoppingAtHome && plan.shoppingAtHome[item.key]);
    if (!isAtHome) {
      totalCost += cost;
    }
    return {
      ...item,
      cost,
      packsNeeded,
      isAtHome
    };
  });

  return { items, totalCost };
}

function renderPlannerWizard() {
  const host = document.getElementById('planner-wizard-host');
  if (!host) return;

  const currentStep = getPlannerWizardStep();
  const hasActivePlan = !!(state.plan?.slots && Object.keys(state.plan.slots).length > 0);

  let html = `<div class="planner-wizard-container">`;

  // Top Planner Header with "Start Fresh" Action
  html += `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--border)">
      <div>
        <h1 style="margin:0;font-size:20px;font-weight:750;color:var(--text);letter-spacing:-0.02em">Meal Planner</h1>
        <div style="font-size:12.5px;color:var(--text2);margin-top:2px">Configure household requests, review daily macro scores, customize shopping, and commit.</div>
      </div>
      <button type="button" class="btn ghost sm" style="display:flex;align-items:center;gap:6px;color:var(--red,#dc2626);border-color:var(--red,#dc2626);font-weight:600" onclick="resetPlannerStartFresh()">
        <span>↺</span> Start Fresh
      </button>
    </div>
  `;

  // Stepper Header
  html += `
    <div class="planner-wizard-stepper">
      <button type="button" class="wizard-step-btn ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}" onclick="setPlannerWizardStep(1)">
        <span class="wizard-step-badge">1</span>
        <span>Configure Requests</span>
      </button>
      <span style="color:var(--border-strong);font-weight:bold">→</span>
      <button type="button" class="wizard-step-btn ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}" ${!hasActivePlan ? 'disabled' : ''} onclick="setPlannerWizardStep(2)">
        <span class="wizard-step-badge">2</span>
        <span>Review Plan</span>
      </button>
      <span style="color:var(--border-strong);font-weight:bold">→</span>
      <button type="button" class="wizard-step-btn ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}" ${!hasActivePlan ? 'disabled' : ''} onclick="setPlannerWizardStep(3)">
        <span class="wizard-step-badge">3</span>
        <span>Shopping & Substitutions</span>
      </button>
      <span style="color:var(--border-strong);font-weight:bold">→</span>
      <button type="button" class="wizard-step-btn ${currentStep === 4 ? 'active' : ''}" ${!hasActivePlan ? 'disabled' : ''} onclick="setPlannerWizardStep(4)">
        <span class="wizard-step-badge">4</span>
        <span>Commit Plan</span>
      </button>
    </div>
  `;

  // STEP 1: CONFIGURE REQUESTS
  if (currentStep === 1) {
    const daysVal = state.plannerDays || state.plan?.days || 10;
    const today = new Date().toISOString().split('T')[0];
    const startVal = state.plannerStartDate || state.plan?.dayDates?.[1] || today;
    const cadence = state.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
    const trafficE = state.prefs?.planTrafficE || ['green', 'amber'];
    const trafficC = state.prefs?.planTrafficC || ['green', 'amber'];
    const activeExclusions = getActiveWizardExclusions();
    const rawPinned = window.state?.planOptions?.pinnedMeals || (typeof planOptions !== 'undefined' ? planOptions?.pinnedMeals : null) || state?.pinnedRecipes;
    const pinned = Array.isArray(rawPinned) ? rawPinned : [];
    const rawUseUp = window.state?.planOptions?.useUp || (typeof planOptions !== 'undefined' ? planOptions?.useUp : null) || state?.useUpProducts;
    const useUp = Array.isArray(rawUseUp) ? rawUseUp : (rawUseUp && typeof rawUseUp === 'object' ? Object.keys(rawUseUp) : []);

    html += `
      <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <h2 style="margin:0;font-size:18px;font-weight:700">Step 1: Configure Plan Requests</h2>
            <div style="font-size:13px;color:var(--text2);margin-top:4px">Define days, meal repeat cadence, skips, and pinned recipes before generating.</div>
          </div>
          <button type="button" class="btn primary" style="font-weight:700;padding:8px 18px" onclick="generatePlan()">✨ Generate Plan</button>
        </div>

        <!-- Parameters Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">PLAN LENGTH</label>
            <select id="wizard-plan-days" class="select" style="width:100%" onchange="state.plannerDays=parseInt(this.value)||10;saveState();">
              ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => `<option value="${n}" ${n === daysVal ? 'selected' : ''}>${n} day${n>1?'s':''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">START DATE</label>
            <input type="date" id="wizard-plan-start" class="input" style="width:100%" value="${startVal}" onchange="state.plannerStartDate=this.value;saveState();">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">BREAKFAST REPEAT</label>
            <select class="select" style="width:100%" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.breakfast=parseInt(this.value)||1;saveState();">
              ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cadence.breakfast ? 'selected' : ''}>${n} day${n>1?'s':''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">LUNCH REPEAT</label>
            <select class="select" style="width:100%" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.lunch=parseInt(this.value)||2;saveState();">
              ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cadence.lunch ? 'selected' : ''}>${n} day${n>1?'s':''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">DINNER REPEAT</label>
            <select class="select" style="width:100%" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.dinner=parseInt(this.value)||2;saveState();">
              ${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === cadence.dinner ? 'selected' : ''}>${n} day${n>1?'s':''}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Minimum Fit Score Filter -->
        <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
          <div class="field" style="margin:0">
            <label for="wizard-fit-score-filter" style="font-size:11px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px">MINIMUM RECIPE FIT SCORE</label>
            <select id="wizard-fit-score-filter" class="select" style="width:100%" onchange="state.prefs.minFitScore = parseInt(this.value, 10) || 0; saveState();">
              <option value="0" ${(!state.prefs?.minFitScore || state.prefs.minFitScore === 0) ? 'selected' : ''}>All Recipes (0–100)</option>
              <option value="85" ${state.prefs?.minFitScore === 85 ? 'selected' : ''}>Ideal Fit Only (85–100)</option>
              <option value="65" ${state.prefs?.minFitScore === 65 ? 'selected' : ''}>Acceptable Fit+ (65–100)</option>
              <option value="40" ${state.prefs?.minFitScore === 40 ? 'selected' : ''}>Suboptimal Fit+ (40–100)</option>
            </select>
          </div>
        </div>

        <!-- Slot Exclusions -->
        <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">Slot Exclusions (${activeExclusions.length})</div>
              <div style="font-size:12px;color:var(--text2)">Skip specific meal slots (eating out, travel, etc.).</div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn sm ghost" onclick="skipAllWizardDinners()">+ Skip All Dinners</button>
              <button type="button" class="btn sm ghost" onclick="clearAllWizardExclusions()">Clear Skips</button>
            </div>
          </div>

          <!-- Active Exclusion Chips -->
          <div id="wizard-exclusions-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
            ${activeExclusions.length === 0 ? '<span style="font-size:12px;color:var(--text3)">No meal slots excluded. All slots will be planned.</span>' : ''}
            ${activeExclusions.map(ex => `
              <span class="exclusion-chip">
                ${ppEscapeHtml(ex.label)}
                <button type="button" onclick="removeWizardExclusion(${ex.day}, ${JSON.stringify(ex.keys)})" title="Remove exclusion">✕</button>
              </span>
            `).join('')}
          </div>

          <!-- Inline Add Exclusion Control -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="wizard-excl-day" class="select sm" style="width:auto">
              ${Array.from({length: daysVal}, (_, i) => i + 1).map(d => `<option value="${d}">Day ${d}</option>`).join('')}
            </select>
            <select id="wizard-excl-meal" class="select sm" style="width:auto">
              <option value="all">All meals</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
            <select id="wizard-excl-person" class="select sm" style="width:auto">
              <option value="both">Both (Elliott & Chloe)</option>
              <option value="elliott">Elliott only</option>
              <option value="chloe">Chloe only</option>
            </select>
            <button type="button" class="btn sm primary" onclick="addWizardExclusionFromUI()">+ Skip Slot</button>
          </div>
        </div>

        <!-- Pinned Recipes & Pantry Use-Up -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px">
          <!-- Pinned Recipes -->
          <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Pinned Recipes (${pinned.length})</div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Lock specific recipes to calendar days.</div>
            
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
              ${pinned.length === 0 ? '<span style="font-size:12px;color:var(--text3)">No pinned recipes.</span>' : ''}
              ${pinned.map(p => {
                const r = getRecipe(p.recipeId);
                return `
                  <span class="inline-search-chip">
                    📌 ${ppEscapeHtml(r?.name || 'Recipe')} (Day ${p.targetDay || 1})
                    <button type="button" onclick="unpinWizardRecipe('${ppEscapeAttr(p.recipeId)}')">✕</button>
                  </span>
                `;
              }).join('')}
            </div>

            <div style="display:flex;gap:6px">
              <select id="wizard-pin-day" class="select sm" style="width:auto">
                ${Array.from({length: daysVal}, (_, i) => i + 1).map(d => `<option value="${d}">Day ${d}</option>`).join('')}
              </select>
              <input type="search" class="input sm" placeholder="Search recipe to pin..." style="flex:1" oninput="filterWizardPinRecipes(this.value)">
            </div>
            <div id="wizard-pin-search-results" style="margin-top:6px;max-height:140px;overflow-y:auto;display:none;background:var(--surface);border:1px solid var(--border);border-radius:8px"></div>
          </div>

          <!-- Pantry Use-Up -->
          <div style="background:var(--surface2);padding:14px;border-radius:12px;border:1px solid var(--border)">
            <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">Pantry Use-Up (${useUp.length})</div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Prioritise recipes that use ingredients expiring in your pantry.</div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
              ${useUp.length === 0 ? '<span style="font-size:12px;color:var(--text3)">No items designated for pantry use-up.</span>' : ''}
              ${useUp.map(id => {
                const prod = getProduct(id);
                return `
                  <span class="inline-search-chip">
                    🥫 ${ppEscapeHtml(prod?.name || 'Product')}
                    <button type="button" onclick="removeWizardUseUpProduct('${ppEscapeAttr(id)}')">✕</button>
                  </span>
                `;
              }).join('')}
            </div>

            <input type="search" class="input sm" placeholder="Search product to use up..." style="width:100%" oninput="filterWizardUseUpProducts(this.value)">
            <div id="wizard-useup-search-results" style="margin-top:6px;max-height:140px;overflow-y:auto;display:none;background:var(--surface);border:1px solid var(--border);border-radius:8px"></div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:6px">
          <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px;font-size:14px" onclick="generatePlan()">✨ Generate Meal Plan →</button>
        </div>
      </div>
    `;
  }

  // STEP 2: REVIEW PLAN
  else if (currentStep === 2) {
    if (!hasActivePlan) {
      html += `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Generated Yet</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Configure your days and requests in Step 1 to generate your meal plan.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1: Configure Requests</button>
        </div>
      `;
    } else {
      const plan = state.plan || {};
      const rawSlots = plan.slots;
      const safeSlots = Array.isArray(rawSlots) ? rawSlots : (rawSlots && typeof rawSlots === 'object' ? Object.values(rawSlots) : []);
      const days = plan.days || safeSlots.length || 0;
      const prepGroups = Array.isArray(plan.mealPrepGroups) ? plan.mealPrepGroups : [];

      html += `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:700">Step 2: Review Generated Meal Plan</h2>
              <div style="font-size:13px;color:var(--text2);margin-top:4px">Review daily macro fits and swap any meal directly inline.</div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn ghost sm" onclick="setPlannerWizardStep(1)">← Edit Requests</button>
              <button type="button" class="btn primary sm" style="font-weight:700" onclick="setPlannerWizardStep(3)">Proceed to Shopping List →</button>
            </div>
          </div>

          <!-- Dense Daily Plan Grid -->
          <div class="dense-plan-grid">
      `;

      for (let d = 1; d <= days; d++) {
        const dateLabel = formatPlanDayLabel(plan, d, { short: true });
        const daySlots = plan.slots?.[d] || {};

        // Calculate Day Macros
        let eCal = 0, eProt = 0, cCal = 0, cProt = 0;
        ['breakfast', 'lunch', 'dinner'].forEach(m => {
          const sE = daySlots[m + 'E'];
          const sC = daySlots[m + 'C'];
          if (sE) {
            const info = getPlanSlotInfo(sE);
            const nut = getPlannedSlotNutrition(info?.active, m + 'E', info?.instanceId, plan);
            if (nut) { eCal += nut.cal || 0; eProt += nut.prot || 0; }
          }
          if (sC) {
            const info = getPlanSlotInfo(sC);
            const nut = getPlannedSlotNutrition(info?.active, m + 'C', info?.instanceId, plan);
            if (nut) { cCal += nut.cal || 0; cProt += nut.prot || 0; }
          }
        });

        // Check Batch Prep
        const dayPreps = prepGroups.filter(g => (Array.isArray(g?.days) ? g.days : []).includes(d));

        html += `
          <div class="dense-plan-day-card">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px">
              <div>
                <span style="font-weight:750;font-size:14px;color:var(--text)">Day ${d}</span>
                <span style="font-size:12px;color:var(--text2);margin-left:6px">${ppEscapeHtml(dateLabel)}</span>
              </div>
              <div style="font-size:11px;font-weight:650;color:var(--text2)">
                E: ${Math.round(eCal)} kcal · ${Math.round(eProt)}g | C: ${Math.round(cCal)} kcal · ${Math.round(cProt)}g
              </div>
            </div>

            ${dayPreps.map(p => `
              <div class="batch-prep-badge">
                🍱 Batch Prep (${p.days.length} days: Day ${p.days.join(', ')})
              </div>
            `).join('')}

            <!-- Meals List -->
            <div style="display:flex;flex-direction:column;gap:8px">
              ${['breakfast', 'lunch', 'dinner'].map(meal => {
                const slotKeyE = meal + 'E';
                const slotKeyC = meal + 'C';
                const sE = daySlots[slotKeyE];
                const sC = daySlots[slotKeyC];
                const infoE = sE ? getPlanSlotInfo(sE) : null;
                const infoC = sC ? getPlanSlotInfo(sC) : null;
                const rE = infoE?.active;
                const rC = infoC?.active;
                const isShared = rE && rC && infoE.id === infoC.id && infoE.variant === infoC.variant;

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
                        <button type="button" class="dense-plan-swap-btn" onclick="openSearchableRecipeSwapModal(${d}, '${slotKeyE}', true)">Swap ▾</button>
                      </div>
                      <div class="dense-plan-slot">
                        <span style="font-weight:600;color:var(--text)">${ppEscapeHtml(rE.name)} ${infoE.variant === 'enhanced' ? '<span style="font-size:10px;color:var(--action);font-weight:700">ENHANCED</span>' : ''}</span>
                      </div>
                    </div>
                  `;
                }

                return `
                  <div class="dense-plan-person-row">
                    <div style="font-size:11px;font-weight:750;color:var(--text2);text-transform:uppercase">${meal}</div>
                    
                    ${rE ? `
                      <div class="dense-plan-slot">
                        <span><strong style="color:var(--text2)">E:</strong> ${ppEscapeHtml(rE.name)} ${infoE.variant === 'enhanced' ? '<span style="font-size:10px;color:var(--action)">[Enh]</span>' : ''}</span>
                        <button type="button" class="dense-plan-swap-btn" onclick="openSearchableRecipeSwapModal(${d}, '${slotKeyE}', false)">Swap ▾</button>
                      </div>
                    ` : ''}

                    ${rC ? `
                      <div class="dense-plan-slot" style="margin-top:4px">
                        <span><strong style="color:var(--text2)">C:</strong> ${ppEscapeHtml(rC.name)} ${infoC.variant === 'enhanced' ? '<span style="font-size:10px;color:var(--action)">[Enh]</span>' : ''}</span>
                        <button type="button" class="dense-plan-swap-btn" onclick="openSearchableRecipeSwapModal(${d}, '${slotKeyC}', false)">Swap ▾</button>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      html += `
          </div>
          
          <!-- Bottom Step 2 Actions -->
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(1)">← Back to Configure</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="setPlannerWizardStep(3)">Proceed to Shopping List & Substitutions →</button>
          </div>
        </div>
      `;
    }
  }

  // STEP 3: SHOPPING LIST & SUBSTITUTIONS (Apple HIG Compliant)
  else if (currentStep === 3) {
    if (!hasActivePlan) {
      html += `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Active</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Generate a meal plan first before viewing the shopping list.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1</button>
        </div>
      `;
    } else {
      const { items, totalCost } = computeWizardShoppingAgg(state.plan);
      const categories = {};
      items.forEach(item => {
        (categories[item.cat] = categories[item.cat] || []).push(item);
      });

      html += `
        <div style="display:flex;flex-direction:column;gap:16px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro',sans-serif">
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:700">Step 3: Shopping List &amp; Substitutions</h2>
              <div style="font-size:13px;color:var(--text2);margin-top:4px">
                Total Estimated Cost: <strong style="color:var(--action)">£${totalCost.toFixed(2)}</strong> (${items.filter(x => !x.isAtHome).length} items to buy)
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn ghost sm" onclick="setPlannerWizardStep(2)">← Back to Plan</button>
              <button type="button" class="btn primary sm" style="font-weight:700" onclick="commitPlannerWizardPlan()">✓ Save Shopping List &amp; Commit Plan →</button>
            </div>
          </div>

          <!-- Categorized Shopping Items -->
          <div style="display:flex;flex-direction:column;gap:14px">
            ${Object.entries(categories).map(([cat, catItems]) => `
              <div class="card" style="padding:16px;background:var(--surface,#fff)">
                <div style="font-weight:750;font-size:14px;color:var(--text);margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
                  <span>${ppEscapeHtml(cat)}</span>
                  <span style="font-size:12px;color:var(--text2)">${catItems.length} item${catItems.length>1?'s':''}</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:1px;border-radius:10px;overflow:hidden;border:1px solid #E5E5EA">
                  ${catItems.map(item => {
                    const brandTitle = item.bankIng ? ((item.bankIng.brand ? item.bankIng.brand + ' - ' : '') + (item.bankIng.name || item.name)) : (item.name || 'Store product');
                    return `
                      <div class="shopping-list-row" style="display: flex; align-items: center; background: #FFFFFF; border-bottom: 1px solid #E5E5EA; padding: 12px 16px;">
                        <input type="checkbox" class="acquired-checkbox" style="width: 24px; height: 24px; accent-color: #007AFF; margin-right: 12px; cursor: pointer; flex-shrink: 0;" ${item.isAtHome ? 'checked' : ''} onchange="toggleShoppingAtHome('${ppEscapeAttr(item.key)}')" />
                        ${item.bankIng?.photo ? `<img src="${item.bankIng.photo}" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; margin-right: 12px; flex-shrink: 0;" alt="${ppEscapeAttr(item.name)}" onerror="this.style.display='none'" />` : ''}
                        <div class="title-block" style="flex: 1; display: flex; flex-direction: column; min-width: 0; padding-right: 12px;">
                          <span class="primary-subtype" style="${item.isAtHome ? 'text-decoration: line-through; opacity: 0.6;' : 'font-weight: 600; color: #1C1C1E;'}; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ppEscapeHtml(item.name)}</span>
                          <span class="secondary-brand-title" style="font-size: 13px; color: #8E8E93; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${ppEscapeHtml(brandTitle)}</span>
                        </div>
                        <div class="qty-cost" style="text-align: right; font-size: 13px; color: var(--text2); flex-shrink: 0; margin-right: 14px;">
                          <div style="font-weight: 500">${item.needUnit === 'item' ? `${item.needQty} item${item.needQty>1?'s':''}` : `${Math.round(item.grams)}g`}</div>
                          ${item.bankIng && item.cost > 0 ? `<div style="font-weight: 600; color: var(--action); margin-top: 2px;">£${item.cost.toFixed(2)}</div>` : ''}
                        </div>
                        <div class="swap-dropdown" style="flex-shrink: 0;">
                          <button type="button" class="btn sm ghost" style="font-size: 11px; padding: 4px 8px;" onclick="toggleInlineShoppingSubst('${ppEscapeAttr(item.key)}', '${ppEscapeAttr(item.groupId)}')">Swap Brand ▾</button>
                        </div>
                      </div>
                      <div id="subst-drawer-${item.key}" class="subst-row-drawer" style="display:none"></div>
                    `;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Bottom Step 3 Actions -->
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(2)">← Back to Review Plan</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="commitPlannerWizardPlan()">✓ Save Shopping List &amp; Plan (Commit to Today) →</button>
          </div>
        </div>
      `;
    }
  }

  // STEP 4: ATOMIC COMMIT
  else if (currentStep === 4) {
    html += `
      <div class="card" style="padding:28px;text-align:center">
        <h2 style="margin-top:0">Committing Meal Plan v3.0.6...</h2>
        <p style="color:var(--text2);font-size:13px;margin-bottom:18px">Finalizing plan metadata, locking shopping quantities, and synchronizing with your live dashboard.</p>
        <button type="button" class="btn primary" onclick="commitPlannerWizardPlan()">Commit Plan Now</button>
      </div>
    `;
  }

  html += `</div>`;
  host.innerHTML = html;
}
window.renderPlannerWizard = renderPlannerWizard;

function renderPlan(){
  ensurePlannerShell();
  installPlannerSummaryObserver();
  renderPlannerWizard();
  const el=document.getElementById('plan-content');
  if(!el) return;
  try {
    if(!state.plan||!state.plan.slots){
      el.innerHTML='';
      const actions=document.getElementById('plan-actions'); if(actions) actions.style.display = 'none';
      const overall=document.getElementById('plan-overall-summary'); if(overall) overall.innerHTML='';
      const prep=document.getElementById('plan-meal-prep-panel'); if(prep) prep.innerHTML='';
      return;
    }
    
    const{days,slots}=state.plan;
    const startInput=document.getElementById('plan-start-date');if(startInput)startInput.value=state.plan.dayDates?.[1]||'';
    let hasValidSlots = false;
    
    const makeRenderedDaySummary = () => {
      const totals = { e:{cal:0, prot:0}, c:{cal:0, prot:0} };
      const assumed = { e:{cal:0, prot:0, labels:['snacks']}, c:{cal:0, prot:0, labels:['snacks']} };
      ['e','c'].forEach(person => {
        const b = getBudgets(person, 'snack');
        totals[person].cal += +b.cal || 0;
        totals[person].prot += +b.prot || 0;
        assumed[person].cal += +b.cal || 0;
        assumed[person].prot += +b.prot || 0;
      });
      return {
        totals,
        targets:{ e:{ cal:+state.prefs.ecal || 0, prot:+state.prefs.eprot || 0 }, c:{ cal:+state.prefs.ccal || 0, prot:+state.prefs.cprot || 0 } },
        assumed,
        score:0
      };
    };
    let html='';
    if(state.isDraftPlan || state.draftPlan){
      html += `<div class="card draft-plan-step-banner" style="background:var(--surface2);border:1.5px solid var(--action);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-weight:750;font-size:15px;color:var(--text);display:flex;align-items:center;gap:6px">
              <span class="tag" style="background:var(--action);color:#fff;font-weight:700">Step 1 of 2</span>
              Review Generated Meal Plan
            </div>
            <div style="font-size:13px;color:var(--text2);margin-top:4px;line-height:1.4">
              Review your scheduled meals. When ready, proceed to the shopping list to check ingredients and confirm your plan. (Not saved yet)
            </div>
          </div>
          <div class="btn-row" style="margin:0;gap:8px;flex-wrap:wrap">
            <button class="btn ghost sm" onclick="discardDraftPlan()">Discard</button>
            <button class="btn primary sm" onclick="proceedDraftToShopping()" style="font-weight:700">Proceed to Shopping List →</button>
          </div>
        </div>
      </div>`;
    }
    const localToday=getPlatePlanLocalToday();
    const isPlanExpired = checkIsPlanExpired(state.plan, localToday);
    if(isPlanExpired){
      const tomorrow = getTomorrowLocalDate();
      const datedEntries = Object.entries(state.plan.dayDates || {}).filter(([, v]) => !!parsePlanLocalDate(v));
      const dates = datedEntries.map(([, v]) => v).sort();
      const maxDate = dates[dates.length - 1] || localToday;
      const endLabel = parsePlanLocalDate(maxDate) ? formatPlanDateShort(maxDate) : maxDate;
      const tomorrowLabel = formatPlanDateShort(tomorrow);
      html += `<div class="card plan-expired-banner" style="background:var(--surface2);border:1px solid var(--border-strong);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div style="width:38px;height:38px;border-radius:10px;background:var(--amber-bg);color:var(--amber);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;">
            ⏳
          </div>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:3px">Current Meal Plan Ended (${ppEscapeHtml(endLabel)})</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.4">Your previous plan has completed. Ready for next week? Generate a fresh plan starting tomorrow (${ppEscapeHtml(tomorrowLabel)}).</div>
            <div class="btn-row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn primary sm" onclick="generateNewPlanStartingTomorrow()">✨ Generate Plan Starting Tomorrow</button>
              <button type="button" class="btn ghost sm" onclick="openPlanSetupAndFocus()">⚙️ Setup Settings</button>
            </div>
          </div>
        </div>
      </div>`;
    }
    const earlierDays=Array.from({length:days},(_,index)=>index+1).filter(day=>{
      const value=state.plan.dayDates?.[day]||'';
      return !!parsePlanLocalDate(value)&&value<localToday;
    });
    if(earlierDays.length){
      const firstLabel=formatPlanDayLabel(state.plan,earlierDays[0],{short:true});
      const lastLabel=formatPlanDayLabel(state.plan,earlierDays[earlierDays.length-1],{short:true});
      const range=earlierDays.length>1?`${firstLabel} – ${lastLabel}`:firstLabel;
      html+=`<div class="plan-earlier-days-heading" id="plan-earlier-days-heading">
        <button type="button" class="plan-earlier-days-toggle" aria-expanded="${platePlanEarlierDaysExpanded}" onclick="togglePlatePlanEarlierDays()">
          <span><strong>Earlier days</strong><small>${ppEscapeHtml(range)} · ${earlierDays.length} day${earlierDays.length===1?'':'s'}</small></span>
          <span aria-hidden="true">${platePlanEarlierDaysExpanded?'Hide':'Show'}</span>
        </button>
      </div>`;
    }
    for(let d=1;d<=days;d++){
      if(earlierDays.includes(d)&&!platePlanEarlierDaysExpanded)continue;
      const s=slots[d]||{};
      const allEx=SLOTS.every(sl=>state.excluded[d]?.[sl.key]);
      if(allEx){html+='<div class="day-plan-card skipped"><div style="display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap"><strong>'+ppEscapeHtml(formatPlanDayLabel(state.plan,d,{short:true}))+'</strong><input type="date" aria-label="Date for day '+d+'" value="'+ppEscapeAttr(state.plan.dayDates?.[d]||'')+'" onchange="setPlanDayDate('+d+',this.value)" style="width:auto"><span style="color:var(--text3)">-- no meals planned</span></div></div>';continue;}
      const daySlotInfos = buildPlanDaySlotInfos(state.plan, d);
      const daySummary = makeRenderedDaySummary();
      let dayRowsHtml = '';
      SLOTS.forEach(sl=>{
        const isEx=state.excluded[d]?.[sl.key];
        const slotData = s[sl.key];
        const slotInfo = getPlanSlotInfo(slotData);
        const r = slotInfo.active;
        const rId = slotInfo.id;
        const instanceId = slotInfo.instanceId;
        const lblLines=SLOT_LABELS[sl.key].split('\n');
        const showRecipe = !!r && !isEx;
        
        if(showRecipe) hasValidSlots = true;
        
        const slotNutrition = daySlotInfos.find(info => info.slotKey === sl.key) || getPlannerSlotNutritionInfo(state.plan, d, sl.key);
        let calStr = '';
        let rowCal = 0;
        let rowProt = 0;
        let rowPerson = sl.key.endsWith('E') ? 'e' : sl.key.endsWith('C') ? 'c' : '';
        if(showRecipe) {
            rowCal = +slotNutrition.cal || 0;
            rowProt = +slotNutrition.prot || 0;
            calStr = `${Math.round(rowCal)}kcal / P${round1(rowProt)}g`;
            if(rowPerson) {
              daySummary.totals[rowPerson].cal += rowCal;
              daySummary.totals[rowPerson].prot += rowProt;
            }
        }
        const rowAttrs = showRecipe ? ` data-plan-person="${rowPerson}" data-plan-cal="${rowCal}" data-plan-prot="${rowProt}"` : '';

        const slotReason=getPlanSlotReason(state.plan,d,sl.key);
        const slotReasonLabel=formatPlanSlotReason(slotReason);
        const slotActionsHtml = showRecipe
          ? '<div class="slot-actions"><span class="slot-macro">'+calStr+'</span><button class="btn sm primary" onclick="viewRecipe(\''+rId+'\', \''+(instanceId||'')+'\', \''+slotInfo.variant+'\')">View</button><button class="btn sm ghost" onclick="openSwapMealModal('+d+',\''+sl.key+'\')">Swap</button><button class="btn sm ghost" onclick="openPlannedMealActions('+d+',\''+sl.key+'\')">More</button></div>'
          : slotReason
            ? '<div class="slot-actions"><button class="btn sm ghost" onclick="openSwapMealModal('+d+',\''+sl.key+'\')">Choose Meal</button><button class="btn sm ghost" onclick="clearPlanSlotReason('+d+',\''+sl.key+'\')">Clear reason</button></div>'
            : '<div class="slot-actions"><button class="btn sm ghost" onclick="openSwapMealModal('+d+',\''+sl.key+'\')">Choose Meal</button></div>';
        const emptyContent=slotReason?'<span class="plan-slot-reason">'+ppEscapeHtml(slotReasonLabel)+'</span>':'<span style="color:var(--text3)">Not set</span>';
        const isPinned = !!(r && getPinnedRecipesList().some(p => p.recipeId === rId && (p.variant || 'original') === (slotInfo.variant || 'original')));
        dayRowsHtml+='<div class="slot-row"'+rowAttrs+'><span class="slot-lbl" style="color:'+SLOT_COLORS[sl.key]+'">'+lblLines[0]+'<br>'+lblLines[1]+'</span>'+(isEx?'<span class="slot-skipped">Not needed</span>':'<span class="slot-name'+(r&&/(?:https?:\/\/|www\.)/i.test(r.name||'')?' breakable-url':'')+'">'+(r?ppEscapeHtml(r.name):emptyContent)+(slotInfo.variant==='enhanced'?' <span class="tag green">Enhanced</span>':'')+(isPinned?' <span class="tag pinned" title="Pre-selected recipe">Pinned</span>':'')+'</span>'+slotActionsHtml)+'</div>';
      });
      daySummary.score = calculatePlanDayScoreFromTotals(daySummary.totals);
      const summaryHtml = ['e','c'].map(p=>`<div class="summary-box">${renderPlannerPersonSummaryBox(p, daySummary)}</div>`).join('');
      html+='<div class="day-plan-card"><div class="row-between" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><div class="plan-date-control"><div style="font-size:13px;font-weight:600">'+ppEscapeHtml(formatPlanDayLabel(state.plan,d,{short:true}))+'</div><input type="date" aria-label="Date for day '+d+'" value="'+ppEscapeAttr(state.plan.dayDates?.[d]||'')+'" onchange="setPlanDayDate('+d+',this.value)"></div><span class="tag" title="Lower is better. Calories miss plus protein shortfall.">Score '+daySummary.score+'</span></div><div class="plan-summary">'+summaryHtml+'</div>'+dayRowsHtml+'</div>';
    }
    el.innerHTML=html;
    reconcileVisiblePlanSummaries();
    renderMealPrepSuggestions();
    renderPlanHistoryPanel();
    const setup=document.getElementById('plan-setup-card');
    if(setup) setup.style.display = '';
    const actions=document.getElementById('plan-actions');
    if(actions) actions.style.display = hasValidSlots ? 'block' : 'none';
    updatePlannerCompactHeader();
  } catch(err) {
    console.error('Error rendering Meal Planner:', err);
    el.innerHTML = `<div class="card" style="padding:24px;text-align:center;margin:16px 0;">
      <h3 style="margin-top:0">Unable to display meal plan</h3>
      <p style="color:var(--text2);font-size:13px">There was an unexpected error rendering the meal planner schedule.</p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        <button class="btn primary sm" onclick="renderPlan()">Reload Plan</button>
        <button class="btn ghost sm" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button>
      </div>
    </div>`;
  }
}
function toggleSlotVariant(day, slotKey){
  const info = getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.recipe) return;
  const currentVariant = info.variant || 'original';
  const newVariant = currentVariant === 'enhanced' ? 'original' : 'enhanced';
  
  state.plan.slots[day][slotKey] = makePlanSlot(info.id, newVariant);
  const priority = state.plan.productPriority || state.prefs?.productPriority || 'protein';
  state.plan.productSelections = lockProductSelectionsForSlots(state.plan.slots, priority);
  state.plan.score = calculatePlanScore(state.plan);
  saveState();
  renderPlan();
  showPlatePlanToast(`Switched to ${newVariant === 'enhanced' ? '✨ Enhanced' : 'Original'} variant for ${info.recipe.name}`);
}

function prioritiseAllPlannedEnhancedRecipes(){
  if(!state.plan?.slots) return showPlatePlanToast('No active meal plan to prioritise.');
  let upgradedCount = 0;
  
  Object.entries(state.plan.slots).forEach(([day, daySlots]) => {
    Object.entries(daySlots || {}).forEach(([slotKey, slotVal]) => {
      if(!slotVal) return;
      const info = getPlanSlotInfo(slotVal);
      if(!info.recipe || info.variant === 'enhanced') return;
      const r = info.recipe;
      const hasEnhanced = r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
      if(hasEnhanced){
        state.plan.slots[day][slotKey] = makePlanSlot(info.id, 'enhanced');
        upgradedCount++;
      }
    });
  });
  
  if(upgradedCount > 0){
    const priority = state.plan.productPriority || state.prefs?.productPriority || 'protein';
    state.plan.productSelections = lockProductSelectionsForSlots(state.plan.slots, priority);
    state.plan.score = calculatePlanScore(state.plan);
    saveState();
    renderPlan();
    showPlatePlanToast(`✨ Prioritised ${upgradedCount} meal(s) to Enhanced variants for better fit scores!`);
  } else {
    showPlatePlanToast('All eligible meals in your plan are already using Enhanced variants.');
  }
}

function openPlannedMealActions(day,slotKey){
  const info=getPlanSlotInfo(state.plan?.slots?.[day]?.[slotKey]);
  if(!info.active && !info.recipe) return showPlatePlanToast('That planned meal is no longer available.');
  const r = info.recipe;
  const hasEnhanced = r && r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
  const isEnhanced = info.variant === 'enhanced';

  const actions = [];
  if(hasEnhanced){
    if(isEnhanced){
      actions.push({
        label: '🔄 Switch to Original variant',
        onclick: `toggleSlotVariant(${+day},'${ppEscapeAttr(slotKey)}')`
      });
    } else {
      actions.push({
        label: '✨ Switch to Enhanced variant (Higher Protein)',
        onclick: `toggleSlotVariant(${+day},'${ppEscapeAttr(slotKey)}')`
      });
    }
  }
  actions.push({
    label: 'Review recipe & portions',
    onclick: `reviewRecipeModalView('${ppEscapeAttr(info.id)}','${ppEscapeAttr(info.instanceId||'')}','${ppEscapeAttr(info.variant||'original')}')`
  });
  actions.push({
    label: 'Swap / Choose different meal',
    onclick: `openSwapMealModal(${+day},'${ppEscapeAttr(slotKey)}')`
  });
  actions.push({
    label: 'Reschedule meal',
    onclick: `openPlanReschedule(${+day},'${ppEscapeAttr(slotKey)}')`
  });
  actions.push({
    label: 'Clear slot',
    onclick: `swapSlot(${+day},'${ppEscapeAttr(slotKey)}',null)`
  });

  openMobileActionSheet(info.active?.name || info.recipe?.name || 'Planned meal', actions);
}
function swapSlot(day,slot,id){
    if(!state.plan.slots[day]) state.plan.slots[day]={};
    let swappedName = '';
    const mealType = slot.includes('breakfast') ? 'breakfast' : slot.includes('lunch') ? 'lunch' : 'dinner';
    const slotMealMode = getSlotMealMode(day, mealType);
    const counterpartKey = getPlanSlotCounterpartKey(slot);
    const isDualView = slotMealMode === 'both' || (document.getElementById('filter-who')?.value === 'both') || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');

    if(id) {
        const parsed = parsePlanRecipeValue(id);
        state.plan.slots[day][slot] = makePlanSlot(parsed.id, parsed.variant);
        setPlanSlotReason(day,slot,'');
        if(isDualView && counterpartKey) {
            state.plan.slots[day][counterpartKey] = makePlanSlot(parsed.id, parsed.variant);
            setPlanSlotReason(day,counterpartKey,'');
        }
        const info = getPlanSlotInfo(state.plan.slots[day][slot]);
        swappedName = info?.active?.name || info?.recipe?.name || '';
    } else {
        state.plan.slots[day][slot] = null;
        setPlanSlotReason(day,slot,'');
        if(isDualView && counterpartKey) {
            state.plan.slots[day][counterpartKey] = null;
            setPlanSlotReason(day,counterpartKey,'');
        }
    }
    const priority = state.plan.productPriority || state.prefs.productPriority || 'protein';
    state.plan.productSelections = lockProductSelectionsForSlots(state.plan.slots, priority);
    state.plan.productPriority = priority;
    state.plan.confirmedShopping = false;
    state.plan.mealPrepGroups = [];
    state.plan.declinedMealPrepGroups = [];
    state.plan.score = calculatePlanScore(state.plan);
    saveState();
    renderPlan();
    const toastMsg = swappedName 
      ? (isDualView ? `Assigned ${swappedName} for Elliott & Chloe` : `Swapped meal to ${swappedName}`)
      : (isDualView ? 'Meal slots cleared for Elliott & Chloe' : 'Meal slot cleared');
    showPlatePlanToast(toastMsg);
}

let currentSwapModalContext = null;
let currentSwapModalFilter = 'all';

function openSwapMealModal(day, slotKey) {
  const dayNum = +day;
  const slotInfo = getPlanSlotInfo(state.plan?.slots?.[dayNum]?.[slotKey]);
  const mealType = slotKey.includes('breakfast') ? 'breakfast' : slotKey.includes('lunch') ? 'lunch' : 'dinner';
  const slotMealMode = getSlotMealMode(dayNum, mealType);
  const filterWhoVal = document.getElementById('filter-who')?.value;
  const isDualView = slotMealMode === 'both' || filterWhoVal === 'both' || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');
  const who = isDualView ? 'both' : (slotKey.endsWith('E') ? 'Elliott' : slotKey.endsWith('C') ? 'Chloe' : 'any');
  const dayLabel = formatPlanDayLabel(state.plan, dayNum, { short: true });
  const typeTitle = toTitleCase(mealType);

  const options = getPlannerRecipeOptions(mealType, who === 'both' ? 'any' : who);
  const curValue = slotInfo.id ? slotInfo.id + (slotInfo.variant === 'enhanced' ? '::enhanced' : '') : '';

  const isBoth = who === 'both';
  const personKey = isBoth ? 'both' : (String(who || '').toLowerCase().startsWith('c') ? 'c' : 'e');
  const items = options.map(opt => {
    const value = opt.id + (opt.variant === 'enhanced' ? '::enhanced' : '');
    let cal = 0, prot = 0, serves = 0, ingredientsText = '', fitRes = null;
    try {
      const info = getPlanSlotInfo({ id: opt.id, variant: opt.variant });
      if (info.recipe) {
        serves = info.recipe.serves || 0;
        ingredientsText = (info.recipe.ingredients || []).map(i => i.name || i.ingredient || '').join(' ');
        const bundle = calculateRecipeDisplayNutrition({ recipe: info.recipe, variant: info.variant, mealType });
        const portions = bundle?.portions || null;
        fitRes = calculateMacroFitTierAndScore({ recipe: info.recipe, variant: info.variant, portions }, mealType);
        if(isBoth) {
          cal = Math.round(((portions?.eCal || 0) + (portions?.cCal || 0)) / 2);
          prot = round1(((portions?.eProt || 0) + (portions?.cProt || 0)) / 2);
        } else {
          cal = personKey === 'c' ? (portions?.cCal || 0) : (portions?.eCal || 0);
          prot = personKey === 'c' ? (portions?.cProt || 0) : (portions?.eProt || 0);
        }
      }
    } catch(e) {
      console.warn('Error calculating recipe nutrition for option:', e);
    }
    const rec = (state.recipes || []).find(r => r.id === opt.id);
    const isFav = (typeof isRecipeVariantFavourite === 'function' ? isRecipeVariantFavourite(opt.id, opt.variant || 'original') : false) || !!(rec?.isFavourite || rec?.isFavorite);
    return {
      id: opt.id,
      variant: opt.variant || 'original',
      value,
      label: opt.label || 'Untitled Recipe',
      enhanced: !!opt.enhanced,
      isFavourite: isFav,
      isFavorite: isFav,
      cal: Math.round(cal || 0),
      prot: round1(prot || 0),
      serves,
      ingredientsText,
      fitScore: fitRes?.score ?? 0,
      fitColor: fitRes?.color ?? '#10B981',
      fitLabel: fitRes?.label ?? 'Fit',
      searchHaystack: `${opt.label} ${opt.variant || ''} ${Math.round(cal || 0)}kcal ${round1(prot || 0)}g ${ingredientsText}`.toLowerCase()
    };
  });

  currentSwapModalContext = {
    day: dayNum,
    slotKey,
    mealType,
    who,
    dayLabel,
    curValue,
    curInfo: slotInfo,
    selectedRecipeValue: null,
    items
  };

  let wrap = document.getElementById('swap-meal-modal-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'swap-meal-modal-wrap';
    wrap.className = 'modal-wrap';
    document.body.appendChild(wrap);
  }

  const curRecipeName = slotInfo.active ? (slotInfo.active.name || slotInfo.recipe?.name || 'Current Meal') : null;

  wrap.innerHTML = `<div class="modal swap-meal-modal" style="max-width:640px;width:94vw;max-height:90vh;display:flex;flex-direction:column">
    <div class="row-between" style="align-items:center;margin-bottom:12px;gap:10px;flex-shrink:0">
      <div>
        <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">Swap Meal — ${ppEscapeHtml(dayLabel)}</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${ppEscapeHtml(who === 'both' ? 'Shared (Elliott & Chloe)' : who + "'s")} ${ppEscapeHtml(typeTitle)}</div>
      </div>
      <button class="btn sm ghost" onclick="closeSwapMealModal()" aria-label="Close modal" style="font-size:16px;padding:4px 10px">✕</button>
    </div>

    ${curRecipeName ? `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex-shrink:0">
        <div>
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Currently Planned</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:1px">${ppEscapeHtml(curRecipeName)} ${slotInfo.variant==='enhanced'?'<span class="tag green">Enhanced</span>':''}</div>
        </div>
        <button class="btn sm danger" onclick="executeSwapSlotAndClose(${dayNum}, '${slotKey}', '')">Clear Slot</button>
      </div>
    ` : `
      <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:10px;padding:10px 14px;margin-bottom:12px;color:var(--text3);font-size:13px;font-style:italic;flex-shrink:0">
        No meal currently planned for this slot.
      </div>
    `}

    <div style="margin-bottom:12px;display:flex;flex-direction:column;gap:8px;flex-shrink:0">
      <div style="position:relative">
        <input type="text" id="swap-modal-search-input" class="input" placeholder="Type to filter recipes (e.g. Chicken, Omelette, 500kcal)..." style="width:100%;font-size:13px;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text)" oninput="renderSwapModalOptionsList()" autocomplete="off" spellcheck="false">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:11px;color:var(--text3);font-weight:600;margin-right:2px">Filter:</span>
          <button type="button" class="btn sm active-filter-btn" id="swap-filter-all" onclick="setSwapModalFilter('all')">All (${items.length})</button>
          <button type="button" class="btn sm ghost" id="swap-filter-favourites" onclick="setSwapModalFilter('favourites')">❤️ Favourites</button>
          <button type="button" class="btn sm ghost" id="swap-filter-enhanced" onclick="setSwapModalFilter('enhanced')">Enhanced</button>
          <button type="button" class="btn sm ghost" id="swap-filter-original" onclick="setSwapModalFilter('original')">Original</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:11px;color:var(--text3);font-weight:600">Sort:</span>
          <select id="swap-modal-sort-select" class="input sm" style="font-size:12px;padding:3px 8px;border-radius:6px;background:var(--surface);color:var(--text);border:1px solid var(--border)" onchange="renderSwapModalOptionsList()">
            <option value="best-fit" selected>Best Fit</option>
            <option value="needs-work">Needs Work</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>
    </div>

    <div id="swap-modal-list-container" class="swap-modal-list" style="flex:1;min-height:200px;max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
    </div>

    <div class="row-between" style="margin-top:14px;align-items:center;flex-shrink:0;gap:10px;flex-wrap:wrap">
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn ghost sm" onclick="quickRandomizeSwap(${dayNum}, '${slotKey}')">🎲 Random Swap</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn ghost sm" onclick="closeSwapMealModal()">Cancel</button>
        <button id="swap-modal-confirm-btn" class="btn primary sm" disabled onclick="confirmSwapMealModal()">Confirm Swap</button>
      </div>
    </div>
  </div>`;

  wrap.classList.add('open');
  currentSwapModalFilter = 'all';
  renderSwapModalOptionsList();

  setTimeout(() => {
    document.getElementById('swap-modal-search-input')?.focus?.();
  }, 100);
}

function setSwapModalFilter(filterType) {
  currentSwapModalFilter = filterType;
  ['all', 'favourites', 'favorites', 'enhanced', 'original'].forEach(f => {
    const btn = document.getElementById(`swap-filter-${f}`);
    if (btn) {
      if (f === filterType || (f === 'favourites' && filterType === 'favorites') || (f === 'favorites' && filterType === 'favourites')) {
        btn.className = 'btn sm active-filter-btn';
      } else {
        btn.className = 'btn sm ghost';
      }
    }
  });
  renderSwapModalOptionsList();
}

function selectSwapModalRecipe(value) {
  if (!currentSwapModalContext) return;
  currentSwapModalContext.selectedRecipeValue = value;

  const confirmBtn = document.getElementById('swap-modal-confirm-btn');
  if (confirmBtn) {
    const selectedItem = currentSwapModalContext.items.find(i => i.value === value);
    confirmBtn.disabled = !value;
    confirmBtn.textContent = selectedItem ? `Confirm Swap to "${selectedItem.label}"` : 'Confirm Swap';
  }

  const container = document.getElementById('swap-modal-list-container');
  if (container) {
    container.querySelectorAll('.swap-modal-item').forEach(el => {
      if (el.dataset.value === value) {
        el.classList.add('is-selected');
      } else {
        el.classList.remove('is-selected');
      }
    });
  }
}

function confirmSwapMealModal() {
  if (!currentSwapModalContext || !currentSwapModalContext.selectedRecipeValue) return;
  const { day, slotKey, selectedRecipeValue } = currentSwapModalContext;
  executeSwapSlotAndClose(day, slotKey, selectedRecipeValue);
}

function renderSwapModalOptionsList() {
  const container = document.getElementById('swap-modal-list-container');
  if (!container || !currentSwapModalContext) return;

  const { curValue, items, selectedRecipeValue } = currentSwapModalContext;
  const input = document.getElementById('swap-modal-search-input');
  const rawQuery = (input?.value || '').trim().toLowerCase();
  const normalize = str => (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const terms = normalize(rawQuery).split(' ').filter(Boolean);

  let filtered = items.filter(item => {
    const isFav = item.isFavourite || item.isFavorite;
    if ((currentSwapModalFilter === 'favourites' || currentSwapModalFilter === 'favorites') && !isFav) return false;
    if (currentSwapModalFilter === 'enhanced' && item.variant !== 'enhanced') return false;
    if (currentSwapModalFilter === 'original' && item.variant === 'enhanced') return false;
    if (!terms.length) return true;
    return terms.every(t => item.searchHaystack.includes(t));
  });

  const sortOption = document.getElementById('swap-modal-sort-select')?.value || 'best-fit';
  const targetSlot = currentSwapModalContext.mealType || 'dinner';
  filtered = getSortedRecipes(filtered, sortOption, targetSlot);

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">
      No matching recipes found for "${ppEscapeHtml(rawQuery)}".
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isCurrent = curValue === item.value;
    const isSelected = selectedRecipeValue === item.value;

    const isFav = item.isFavourite || item.isFavorite;

    const fitScoreVal = item._computedFitScore !== undefined ? item._computedFitScore : (item.fitScore ?? 0);
    const bestVar = item._bestVariant || (item.variant === 'enhanced' ? 'enhanced' : 'original');
    const isEnhancedFit = bestVar === 'enhanced';

    let fitColor = item.fitColor || '#10B981';
    if (item._computedFitScore !== undefined) {
      if (fitScoreVal >= 85) fitColor = '#10B981';
      else if (fitScoreVal >= 65) fitColor = '#84CC16';
      else if (fitScoreVal >= 40) fitColor = '#F59E0B';
      else fitColor = '#EF4444';
    }

    return `<div class="swap-modal-item ${isFav ? 'is-favorite' : ''} ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" data-value="${ppEscapeAttr(item.value)}" onclick="selectSwapModalRecipe('${ppEscapeAttr(item.value)}')" ondblclick="executeSwapSlotAndClose(${currentSwapModalContext.day}, '${currentSwapModalContext.slotKey}', '${ppEscapeAttr(item.value)}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>${ppEscapeHtml(item.label)}</span>
          ${isFav ? '<span class="tag fav-tag" style="background:#fee2e2;color:#ef4444;border-color:#fca5a5;font-size:11px">❤️ Favourite</span>' : ''}
          ${item.enhanced ? '<span class="tag green">Enhanced</span>' : ''}
          ${isCurrent ? '<span class="tag">Currently Selected</span>' : ''}
          ${isSelected ? '<span class="tag green">✓ Ready to swap</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <span>🔥 <strong>${item.cal}</strong> kcal</span>
          <span>💪 <strong>${item.prot}</strong>g protein</span>
          ${item.serves ? `<span>🍽️ Serves ${item.serves}</span>` : ''}
          <span class="tag" style="background-color:${fitColor};color:#FFFFFF;border-color:${fitColor};font-weight:600">Fit score ${fitScoreVal}${isEnhancedFit ? ' · Enhanced' : ''}</span>
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
        <button type="button" class="recipe-fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleRecipeFavourite('${ppEscapeAttr(item.id)}', event, '${ppEscapeAttr(item.variant || 'original')}'); if(currentSwapModalContext) { currentSwapModalContext.items.forEach(it => { if(it.id === '${ppEscapeAttr(item.id)}') { it.isFavourite = !it.isFavourite; it.isFavorite = it.isFavourite; } }); renderSwapModalOptionsList(); }" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <button class="btn sm ${isSelected ? 'primary' : 'ghost'}" type="button" onclick="event.stopPropagation(); selectSwapModalRecipe('${ppEscapeAttr(item.value)}');">
          ${isSelected ? 'Selected ✓' : 'Select'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function executeSwapSlotAndClose(day, slotKey, value) {
  swapSlot(day, slotKey, value);
  closeSwapMealModal();
}

function closeSwapMealModal() {
  const wrap = document.getElementById('swap-meal-modal-wrap');
  if (wrap) wrap.classList.remove('open');
  currentSwapModalContext = null;
}

function quickRandomizeSwap(day, slotKey) {
  if (!currentSwapModalContext || !currentSwapModalContext.items.length) return;
  const items = currentSwapModalContext.items;
  const randomIndex = Math.floor(Math.random() * items.length);
  const picked = items[randomIndex];
  executeSwapSlotAndClose(day, slotKey, picked.value);
}

window.openSwapMealModal = openSwapMealModal;
window.closeSwapMealModal = closeSwapMealModal;
window.setSwapModalFilter = setSwapModalFilter;
window.selectSwapModalRecipe = selectSwapModalRecipe;
window.confirmSwapMealModal = confirmSwapMealModal;
window.executeSwapSlotAndClose = executeSwapSlotAndClose;
window.quickRandomizeSwap = quickRandomizeSwap;
window.renderSwapModalOptionsList = renderSwapModalOptionsList;

function clearPlan(){
    state.plan={}; 
    state.overrides={}; // Purge orphaned execution data
    state.plannerStep = 1;
    platePlanEarlierDaysExpanded = false;
    saveState();
    const content = document.getElementById('plan-content'); if(content) content.innerHTML='';
    const warnings = document.getElementById('plan-warnings'); if(warnings) warnings.innerHTML='';
    const overall=document.getElementById('plan-overall-summary'); if(overall) overall.innerHTML='';
    const prep=document.getElementById('plan-meal-prep-panel'); if(prep) prep.innerHTML='';
    const setup=document.getElementById('plan-setup-card'); if(setup) setup.style.display = '';
    const actions = document.getElementById('plan-actions'); if(actions) actions.style.display = 'none';
    renderPlanHistoryPanel();
    updatePlannerCompactHeader();
    renderPlannerWizard();
}

function showPlanSetup(){
  ensurePlannerShell();
  openPlanOptionsWorkspace();
}

function renderPlanOverallSummary(){
  const el=document.getElementById('plan-overall-summary');
  if(!el || !state.plan?.slots){ if(el) el.innerHTML=''; return; }
  if(document.querySelector('#plan-content .day-plan-card:not(.skipped)')) {
    reconcileVisiblePlanSummaries();
    return;
  }
  const score = calculatePlanScore(state.plan);
  state.plan.score = score;
  renderPlanOverallSummaryHtml(score);
}

function defaultPlanSaveName(plan = state.plan){
  const days = plan?.days || Object.keys(plan?.slots || {}).length || 0;
  const dt = getPlanDateRangeLabel(plan) || new Date().toLocaleDateString();
  return `Meal plan ${dt}${days ? ' · ' + days + ' days' : ''}`;
}

function openSaveMealPlanModal(){
  if(!state.plan?.slots) {
    openAppInfoModal('Save meal plan', '<div class="empty">Generate a meal plan first.</div>');
    return;
  }
  const hasAny = Object.values(state.plan.slots || {}).some(day => Object.values(day || {}).some(Boolean));
  if(!hasAny) {
    openAppInfoModal('Save meal plan', '<div class="empty">There are no meals in the current plan to save.</div>');
    return;
  }
  const defaultName = defaultPlanSaveName();
  openAppConfirmModal(
    'Save meal plan',
    `<div style="margin-bottom:10px">Save the current meal plan to the Meal Plan Library.</div>
     <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Plan name</label>
     <input id="save-plan-name" type="text" value="${ppEscapeHtml(defaultName)}" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text)">`,
    'Save plan',
    async () => {
      const name = document.getElementById('save-plan-name')?.value?.trim() || defaultName;
      state.plan.name = name;
      state.plan.savedStatus = 'Manually saved';
      const snap = snapshotCurrentPlan('Manually saved', name);

      const saveBtn = document.querySelector('#app-confirm-modal .btn.primary, .modal-actions .btn.primary');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }
      try {
        const success = await savePlanTransactional(state.plan);
        renderPlanHistoryPanel();
        if (success) {
          openAppInfoModal('Meal plan saved', `<div class="msg success" style="margin:0">Saved <strong>${ppEscapeHtml(name)}</strong> to the Meal Plan Library.</div>`);
        }
      } catch (err) {
        console.error('[Save Meal Plan Error]', err);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save plan';
        }
      }
    }
  );
}

function renderPlanHistoryPanel(){
  const el=document.getElementById('plan-history-panel');
  if(!el) return;
  const hist = state.planHistory || [];
  const body = !hist.length
    ? '<div style="font-size:12px;color:var(--text3)">No saved meal plans yet. Generate a plan, then use Save current plan.</div>'
    : `<div style="display:grid;gap:10px">${hist.map((p,i)=>{
      const dt = p.date ? new Date(p.date).toLocaleString() : 'Previous plan';
      const dateRange=getPlanDateRangeLabel(p);
      const allIds = getPlanRecipeIds(p);
      const ids = allIds.slice(0,3).map(id => getProductIndexRecipe(id)?.name || id);
      const remaining = Math.max(0, allIds.length - ids.length);
      const status = p.savedStatus || (p.confirmedShopping ? 'Shopping confirmed' : 'PlatePlan generated');
      const title = p.name || `Saved plan ${i+1}`;
      const score = p.score?.score ?? p.score ?? '—';
      return `<article class="plan-library-card">
        <div class="plan-library-layout">
          <div class="plan-library-main">
            ${renderExpandableText(title,`plan-${p.id||i}`,'plan-library-title')}
            <div class="plan-library-meta">
              <span class="tag">${p.days||0} days</span>
              ${dateRange?`<span class="tag">${ppEscapeHtml(dateRange)}</span>`:''}
              <span class="tag">Score ${ppEscapeHtml(score)}</span>
              <span class="tag">${ppEscapeHtml(status)}</span>
            </div>
            <div style="color:var(--text3);margin-top:7px">Saved ${ppEscapeHtml(dt)} · ${ppEscapeHtml(p.savedBy || 'PlatePlan')}</div>
            <div class="plan-library-recipe-preview"><strong>Recipes:</strong> ${renderExpandableText(ids.length ? ids.join(', ') : 'No recipes',`plan-recipes-${p.id||i}`,'')}${remaining ? ` <span class="tag">+${remaining} more</span>` : ''}</div>
          </div>
          <div class="plan-library-actions">
            <button class="btn sm primary" onclick="openSavedPlanRecipeCards(${i})">Recipe cards</button>
            <button class="btn sm ghost" onclick="openPlanHistoryActions(${i})">More</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>`;
  el.innerHTML = `<div class="card" style="font-size:12px;margin:0">${body}</div>`;
}

function openPlanHistoryActions(index){
  const p=(state.planHistory||[])[index];
  if(!p) return;
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  const sheet = document.getElementById('mobile-action-sheet');
  if (!sheet) return;
  const titleId = 'mobile-action-sheet-title';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', titleId);
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="row-between" style="align-items:center;margin-bottom:10px">
      <h3 id="${titleId}" style="margin:0">${ppEscapeHtml(p.name || `Saved plan ${index+1}`)}</h3>
      <button type="button" class="btn sm ghost" onclick="closeMobileActionSheet()">Close</button>
    </div>
    <div style="display:grid;gap:6px">
      <button type="button" class="btn" onclick="executeSheetAction('applyPlanFromLibraryDirect', ${index})">Apply plan starting today</button>
      <button type="button" class="btn" onclick="executeSheetAction('viewPlanHistory', ${index})">View schedule</button>
      <button type="button" class="btn" onclick="executeSheetAction('downloadSavedPlanPack', ${index})">Download recipe pack</button>
      <button type="button" class="btn" onclick="executeSheetAction('loadPlanHistoryForEdit', ${index})">Edit plan</button>
      <button type="button" class="btn" onclick="executeSheetAction('renamePlanHistory', ${index})">Rename</button>
      <button type="button" class="btn danger" onclick="executeSheetAction('deletePlanHistory', ${index})">Delete saved plan</button>
    </div>
  `;
  if (wrap) {
    wrap.classList.add('open');
    markMobileLayerForBack(wrap, 'actions');
  }
  setTimeout(() => sheet.querySelector('button')?.focus(), 0);
}


function viewPlanHistory(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  const rows = [];
  for(let d=1; d<=(p.days||0); d++){
    const day = p.slots?.[d] || {};
    const meals = SLOTS.map(sl => {
      const info = getPlanSlotInfo(day[sl.key]);
      const reason=getPlanSlotReason(p,d,sl.key);
      return info.active
        ? `${SLOT_LABELS[sl.key].replace('\n',' ')}: ${info.active.name}${info.variant==='enhanced'?' (Enhanced)':''}`
        : reason
          ? `${SLOT_LABELS[sl.key].replace('\n',' ')}: ${formatPlanSlotReason(reason)}`
          : '';
    }).filter(Boolean);
    if(meals.length) rows.push(`<div class="summary-box"><strong>${ppEscapeHtml(formatPlanDayLabel(p,d,{short:true}))}</strong><div>${meals.map(ppEscapeHtml).join('<br>')}</div></div>`);
  }
  openAppInfoModal('Previous meal plan', rows.join('') || '<div class="empty">No meals in this plan.</div>');
}

function loadPlanHistoryForEdit(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  openAppConfirmModal(
    'Load saved meal plan?',
    `Load <strong>${ppEscapeHtml(p.name || 'this saved plan')}</strong> into the Meal Planner so you can edit it? Your current active plan will be replaced, but saved plans stay in the library.`,
    'Load plan',
    () => {
      if(state.plan?.slots) snapshotCurrentPlan('Auto-saved before loading saved plan', defaultPlanSaveName(state.plan));
      state.plan = {
        days: p.days || Object.keys(p.slots || {}).length || 0,
        slots: clonePlatePlanValue(p.slots || {}),
        dayDates: clonePlatePlanValue(p.dayDates || {}),
        slotReasons: clonePlatePlanValue(p.slotReasons || {}),
        productPriority: p.productPriority || state.prefs.productPriority || 'protein',
        productSelections: clonePlatePlanValue(p.productSelections || {}),
        useUpProductIds: clonePlatePlanValue(p.useUpProductIds || []),
        shoppingAtHome: clonePlatePlanValue(p.shoppingAtHome || {}),
        warnings: [],
        score: calculatePlanScore({ days:p.days, slots:p.slots, productSelections:p.productSelections }),
        confirmedShopping: !!p.confirmedShopping,
        mealPrepGroups: clonePlatePlanValue(p.mealPrepGroups || []),
        declinedMealPrepGroups: clonePlatePlanValue(p.declinedMealPrepGroups || [])
      };
      state.overrides = clonePlatePlanValue(p.overrides || {});
      saveState();
      renderPlan();
      showView('planner');
    }
  );
}

function renamePlanHistory(index){
  const p = (state.planHistory || [])[index];
  if(!p) return;
  const currentName = p.name || `Saved plan ${index+1}`;
  openAppConfirmModal(
    'Rename saved plan',
    `<label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">Plan name</label>
     <input id="rename-plan-name" type="text" value="${ppEscapeHtml(currentName)}" style="width:100%;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:var(--surface);color:var(--text)">`,
    'Rename',
    () => {
      const name = document.getElementById('rename-plan-name')?.value?.trim();
      if(name){p.name = name;if(p.cardPackSnapshot)p.cardPackSnapshot.planName=name;}
      saveState();
      renderPlanHistoryPanel();
    }
  );
}

function deletePlanHistory(index){
  const historyList = window.state?.planHistory || (typeof state !== 'undefined' ? state?.planHistory : []) || [];
  const p = historyList[index];
  if (!p) return;

  openAppConfirmModal(
    'Delete saved meal plan?',
    `Delete <strong>${ppEscapeHtml(p.name || 'this saved plan')}</strong> from your library?`,
    'Delete plan',
    async () => {
      // 1. Mutate local state array
      if (window.state?.planHistory) {
        window.state.planHistory.splice(index, 1);
      }
      if (typeof state !== 'undefined' && state?.planHistory && state.planHistory !== window.state?.planHistory) {
        state.planHistory.splice(index, 1);
      }

      // 2. Save locally
      try {
        localStorage.setItem('plateplan_v2', JSON.stringify(window.state || state));
        safeLocalStorageSet(SK, safeJsonStringify(window.state || state));
        if (typeof safeSaveHistoryBackup === 'function') {
          safeSaveHistoryBackup(window.state?.planHistory || state?.planHistory);
        }
      } catch(e) {}

      // 3. Direct Firestore root document write
      const db = window.platePlanDb || window.db || (window.PlatePlanCloud && window.PlatePlanCloud.platePlanDb) || (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore());
      if (db) {
        try {
          const householdId = typeof getPlatePlanHouseholdId === 'function'
            ? getPlatePlanHouseholdId()
            : ((window.state && window.state.householdId) || window.ACTIVE_HOUSEHOLD_ID || 'elliott-chloe');
          if (db.collection) {
            const serverTs = (typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp)
              ? firebase.firestore.FieldValue.serverTimestamp()
              : new Date().toISOString();
            await db.collection('households').doc(householdId).set({
              planHistory: window.state?.planHistory || state?.planHistory || [],
              updatedAt: serverTs
            }, { merge: true });
            console.log('[v3.3.7-mod] Successfully written planHistory directly to root household document.');
          }
        } catch (err) {
          console.error('[v3.3.7-mod] Direct Firestore planHistory write failed:', err);
        }
      }

      if (window.PlatePlanModules?.store) {
        window.PlatePlanModules.store.publish({ reason: 'plan-history-deletion', index });
      }

      // 4. Re-render UI
      if (typeof window.renderAll === 'function') {
        window.renderAll();
      } else if (typeof window.renderMealPlanLibrary === 'function') {
        window.renderMealPlanLibrary();
      } else if (typeof renderPlanHistoryPanel === 'function') {
        renderPlanHistoryPanel();
      }

      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Saved meal plan deleted', 'success');
      }
    }
  );
}
window.deletePlanHistory = deletePlanHistory;

function filterRecipeSwap(inputRef, listRef){
  const input = typeof inputRef === 'string' ? document.getElementById(inputRef) : (inputRef?.target ? inputRef.target : inputRef);
  const list = typeof listRef === 'string' ? document.getElementById(listRef) : listRef;
  if(!input || !list) return;
  
  const currentWrap = input.closest('.recipe-search-wrap');
  const currentSlotRow = input.closest('.slot-row');

  document.querySelectorAll('.recipe-search-drop').forEach(d => {
    if(d !== list) {
      d.style.display = 'none';
      d.closest('.recipe-search-wrap')?.classList.remove('is-open');
      d.closest('.slot-row')?.classList.remove('has-open-drop');
    }
  });

  if (currentWrap) currentWrap.classList.add('is-open');
  if (currentSlotRow) currentSlotRow.classList.add('has-open-drop');
  list.style.display = 'block';

  const normalize = str => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/&#039;|&#39;|&apos;|'/g, "'")
      .replace(/&amp;|&/g, ' and ')
      .replace(/[^a-z0-9\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const rawVal = input.value || '';
  const query = normalize(rawVal);
  const terms = query.split(/\s+/).filter(Boolean);
  
  let visibleCount = 0;
  const opts = list.querySelectorAll('.recipe-search-opt');
  opts.forEach(el => {
    const hay = normalize(el.dataset.search || el.textContent || '');
    const match = !terms.length || terms.every(t => hay.includes(t));
    el.style.display = match ? '' : 'none';
    if(match) visibleCount++;
  });
  
  let noMatchEl = list.querySelector('.recipe-search-no-match');
  if(opts.length > 0) {
    if(!visibleCount){
      if(!noMatchEl){
        noMatchEl = document.createElement('div');
        noMatchEl.className = 'recipe-search-no-match';
        noMatchEl.style.cssText = 'padding:12px;font-size:12px;color:var(--text3);text-align:center;';
        noMatchEl.textContent = 'No matching recipes found';
        list.appendChild(noMatchEl);
      }
      noMatchEl.style.display = 'block';
    } else if(noMatchEl) {
      noMatchEl.style.display = 'none';
    }
  }
}



  function renderPlanner(...args) {
    if (typeof renderPlan === 'function') {
      return renderPlan(...args);
    }
    if (typeof renderPlannerWizard === 'function') {
      return renderPlannerWizard(...args);
    }
  }

  function addMealToPlan(day, slotKey, recipeId, variant = 'original') {
    const currentPlan = window.state?.plan || (typeof state !== 'undefined' ? state?.plan : null);
    if (!currentPlan) return;
    if (!currentPlan.slots) currentPlan.slots = {};
    if (!currentPlan.slots[day]) currentPlan.slots[day] = {};
    
    if (typeof makePlanSlot === 'function') {
      currentPlan.slots[day][slotKey] = makePlanSlot(recipeId, variant);
    } else {
      currentPlan.slots[day][slotKey] = { recipeId, variant };
    }
    
    if (typeof window.refreshPlatePlanDerivedState === 'function') {
      window.refreshPlatePlanDerivedState({ persist: true, render: true });
    } else if (typeof renderPlan === 'function') {
      renderPlan();
    }
  }

  function removeMealFromPlan(day, slotKey) {
    const currentPlan = window.state?.plan || (typeof state !== 'undefined' ? state?.plan : null);
    if (!currentPlan?.slots?.[day]) return;
    delete currentPlan.slots[day][slotKey];
    
    if (typeof window.refreshPlatePlanDerivedState === 'function') {
      window.refreshPlatePlanDerivedState({ persist: true, render: true });
    } else if (typeof renderPlan === 'function') {
      renderPlan();
    }
  }

  function clearPlanDay(day) {
    const currentPlan = window.state?.plan || (typeof state !== 'undefined' ? state?.plan : null);
    if (!currentPlan?.slots?.[day]) return;
    currentPlan.slots[day] = {};
    
    if (typeof window.refreshPlatePlanDerivedState === 'function') {
      window.refreshPlatePlanDerivedState({ persist: true, render: true });
    } else if (typeof renderPlan === 'function') {
      renderPlan();
    }
  }

  function saveCurrentPlanToHistory(customName) {
    if (typeof openSaveMealPlanModal === 'function') {
      openSaveMealPlanModal(customName);
    }
  }

  function loadPlanFromHistory(index) {
    if (typeof loadPlanHistoryForEdit === 'function') {
      loadPlanHistoryForEdit(index);
    } else if (typeof viewPlanHistory === 'function') {
      viewPlanHistory(index);
    }
  }

  function deletePlanHistoryItem(index) {
    if (typeof deletePlanHistory === 'function') {
      deletePlanHistory(index);
    }
  }

  function exportPlanToCalendar(planContext = window.state?.plan) {
    const plan = planContext || (typeof state !== 'undefined' ? state?.plan : null);
    if (!plan || !plan.slots) {
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('No active meal plan to export', 'error');
      }
      return;
    }

    const recipeMap = window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : {}) || {};
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PlatePlan//Meal Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:PlatePlan Meal Schedule'
    ];

    const today = new Date();

    Object.keys(plan.slots).forEach(dayKey => {
      const dayNum = parseInt(dayKey, 10) || 1;
      const slots = plan.slots[dayKey];
      if (!slots) return;

      let eventDate = new Date(today);
      if (plan.dates && plan.dates[dayKey]) {
        const parsed = new Date(plan.dates[dayKey]);
        if (!isNaN(parsed.getTime())) {
          eventDate = parsed;
        }
      } else {
        eventDate.setDate(today.getDate() + (dayNum - 1));
      }

      const dateStr = eventDate.toISOString().replace(/[-:]/g, '').split('T')[0];

      Object.keys(slots).forEach(slotKey => {
        const slotVal = slots[slotKey];
        if (!slotVal) return;

        let recipeId = typeof slotVal === 'string' ? slotVal : (slotVal.recipeId || slotVal.id);
        let recipe = recipeMap[recipeId] || { name: recipeId || 'Scheduled Meal' };
        
        let startTime = '180000';
        let endTime = '190000';
        if (slotKey.includes('breakfast')) {
          startTime = '080000';
          endTime = '083000';
        } else if (slotKey.includes('lunch')) {
          startTime = '123000';
          endTime = '130000';
        }

        icsContent.push('BEGIN:VEVENT');
        icsContent.push(`SUMMARY:PlatePlan: ${recipe.name || 'Meal'}`);
        icsContent.push(`DTSTART:${dateStr}T${startTime}`);
        icsContent.push(`DTEND:${dateStr}T${endTime}`);
        icsContent.push(`DESCRIPTION:Scheduled meal (${slotKey}) in PlatePlan`);
        icsContent.push('STATUS:CONFIRMED');
        icsContent.push('END:VEVENT');
      });
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PlatePlan_Schedule_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Exported calendar file (.ics)', 'success');
    }
  }

  window.PlatePlanPlanner = {
    renderPlanner,
    addMealToPlan,
    removeMealFromPlan,
    clearPlanDay,
    saveCurrentPlanToHistory,
    loadPlanFromHistory,
    deletePlanHistoryItem,
    exportPlanToCalendar,
    renderPlan,
    renderPlannerWizard,
    getPlannerWizardStep,
    setPlannerWizardStep,
    commitPlannerWizardPlan,
    resetPlannerStartFresh,
    generatePlan,
    clearPlan,
    openPlanReschedule,
    closePlanRescheduleModal,
    confirmPlanReschedule,
    openPlanStudio,
    closePlanStudio,
    renderPlanStudio,
    applyPlanStudio,
    openSwapMealModal,
    closeSwapMealModal,
    confirmSwapMealModal,
    swapSlot,
    executeInlineMealSwap,
    openPlannedMealActions,
    toggleSlot,
    toggleSlotVariant,
    prioritiseAllPlannedEnhancedRecipes,
    openSaveMealPlanModal,
    renderPlanHistoryPanel,
    openPlanHistoryActions,
    viewPlanHistory,
    loadPlanHistoryForEdit,
    renamePlanHistory,
    deletePlanHistory,
    openPlanOptionsWorkspace,
    closePlanOptionsWorkspace,
    openPlanDatesWorkspace,
    closePlanDatesWorkspace,
    applyPlanCalendarStart,
    clearPlanCalendarDates,
    filterRecipeSwap,
    getPlanDaySummary,
    calculatePlanScore,
    renderPlannerPersonSummaryBox,
    getPlatePlanLocalToday,
    getTodayPlanDay,
    renderToday,
    openApplyPlanFromLibraryModal,
    applyPlanFromLibraryDirect,
    ensurePlannerShell,
    installPlannerSummaryObserver,
    resetTodayDate,
    scheduleTodayMidnightRefresh,
    platePlanUseUpCoverageCache
  };

  if (typeof window !== 'undefined') {
    Object.assign(window, window.PlatePlanPlanner);
    window.ensurePlannerShell = ensurePlannerShell;
    window.installPlannerSummaryObserver = installPlannerSummaryObserver;
    window.resetTodayDate = resetTodayDate;
    window.scheduleTodayMidnightRefresh = scheduleTodayMidnightRefresh;
    window.platePlanUseUpCoverageCache = platePlanUseUpCoverageCache;
  }
})();
