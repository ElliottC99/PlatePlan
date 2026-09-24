/**
 * scripts/features/views-today-vault.js
 * PlatePlan Today Dashboard & Recipe Vault Views
 * Classic global namespace script.
 */

(() => {
  // Safe global declaration/bindings
  window.platePlanTodayDate = window.platePlanTodayDate || '';
  window.platePlanTodayTimer = window.platePlanTodayTimer || null;
  window.platePlanLastActualDate = window.platePlanLastActualDate || '';
  var platePlanTodayDate = window.platePlanTodayDate || '';

  var parsePlanLocalDate = (v) => (window.parsePlanLocalDate || window.PlatePlanPlanner?.parsePlanLocalDate || ((val) => {
    if(!val||typeof val!=='string') return null;
    const parts=val.split('-').map(Number);
    if(parts.length!==3||parts.some(n=>!Number.isFinite(n))) return null;
    const [y,m,d]=parts;
    const date=new Date(y,m-1,d);
    return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null;
  }))(v);

  var getPlatePlanLocalToday = () => (window.getPlatePlanLocalToday || window.PlatePlanPlanner?.getPlatePlanLocalToday || (() => new Date().toISOString().slice(0,10)))();
  var buildPlanDayDates = (...args) => (window.buildPlanDayDates || window.PlatePlanPlanner?.buildPlanDayDates || (() => ({})))(...args);
  var getTodayPlanDay = (...args) => (window.getTodayPlanDay || window.PlatePlanPlanner?.getTodayPlanDay || (() => null))(...args);
  var getNextDatedPlanDay = (...args) => (window.getNextDatedPlanDay || window.PlatePlanPlanner?.getNextDatedPlanDay || (() => null))(...args);
  var formatPlanDayLabel = (...args) => (window.formatPlanDayLabel || window.PlatePlanPlanner?.formatPlanDayLabel || ((p, d) => `Day ${d}`))(...args);
  var getTodaySlotEntry = (...args) => (window.getTodaySlotEntry || window.PlatePlanPlanner?.getTodaySlotEntry || (() => null))(...args);
  var getPlanSlotReason = (...args) => (window.getPlanSlotReason || window.PlatePlanPlanner?.getPlanSlotReason || (() => null))(...args);
  var formatPlanSlotReason = (...args) => (window.formatPlanSlotReason || window.PlatePlanPlanner?.formatPlanSlotReason || (r => String(r || '')))(...args);
  var getBudgets = (...args) => (window.getBudgets || window.PlatePlanPlanner?.getBudgets || (() => ({ cal: 0, prot: 0 })))(...args);
  var toTitleCase = (...args) => (window.toTitleCase || (s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)))(...args);
  var isMealEatenOnDate = (...args) => (window.isMealEatenOnDate || window.PlatePlanPlanner?.isMealEatenOnDate || (() => false))(...args);
  var SK = window.PLATEPLAN_STORAGE_KEY || 'plateplan_state_backup';
  var safeLocalStorageSet = (...args) => (window.safeLocalStorageSet || window.PlatePlanState?.safeLocalStorageSet || ((k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch(e){} }))(...args);
  var safeJsonStringify = (...args) => (window.safeJsonStringify || (v => JSON.stringify(v)))(...args);
  var ppEscapeHtml = (str) => (typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml(str) : (String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));
  var ppEscapeAttr = (str) => (typeof window.ppEscapeAttr === 'function' ? window.ppEscapeAttr(str) : (String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));

  // == TODAY HELPERS & VIEWS ==

  function formatTodayDateLabel(value){
    const date=parsePlanLocalDate(value);
    return date ? new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(date) : '';
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

  function renderTodayLoadingSkeleton(){
    return `<div class="today-skeleton" aria-busy="true" aria-label="Loading planned meals" style="display:flex;flex-direction:column;gap:14px;padding:8px 0;opacity:0.75">
      <div style="height:24px;width:180px;background:var(--card,rgba(128,128,128,0.1));border-radius:6px"></div>
      <div style="height:100px;background:var(--card,rgba(128,128,128,0.08));border-radius:12px;border:1px solid var(--border)"></div>
      <div style="height:100px;background:var(--card,rgba(128,128,128,0.08));border-radius:12px;border:1px solid var(--border)"></div>
    </div>`;
  }

  function isPlatePlanStateReady(){
    if (typeof window === 'undefined') return true;
    if (window.isHydrating) return false;
    if (window.PlatePlanState?.isReady || window.isPlatePlanHydrated || window.PlatePlanState?.isHydrated) return true;
    if (window.platePlanApplicationInitialized && window.platePlanIndexes?.products) return true;
    const s = window.state || (typeof state !== 'undefined' ? state : null);
    if (s && ((s.recipes && s.recipes.length > 0) || (s.plan?.slots && Object.keys(s.plan.slots).length > 0))) {
      return true;
    }
    return false;
  }

  function renderToday(){
    const host=document.getElementById('today-content');
    if(!host) return;

    if(!isPlatePlanStateReady()){
      const subtitle=document.getElementById('today-subtitle');
      if(subtitle) subtitle.textContent='Loading your planned meals…';
      host.innerHTML=renderTodayLoadingSkeleton();
      if(typeof window !== 'undefined'){
        window.addEventListener('plateplan:state-ready', () => {
          if(document.getElementById('view-today')?.classList.contains('active')){
            renderToday();
          }
        }, { once: true });
      }
      return;
    }

    const currentState = (typeof state !== 'undefined' ? state : window.state);
    if(!currentState) return;
    try {
      platePlanTodayDate = window.platePlanTodayDate || (typeof getPlatePlanLocalToday === 'function' ? getPlatePlanLocalToday() : '');
      window.platePlanTodayDate = platePlanTodayDate;
      const label=document.getElementById('today-date-label');
      const subtitle=document.getElementById('today-subtitle');
      if(label) label.textContent=formatTodayDateLabel(platePlanTodayDate);
      if(!currentState.plan?.slots||!Object.keys(currentState.plan.slots).length){
        if(subtitle) subtitle.textContent='Your planned meals';
        host.innerHTML=renderTodayEmpty('No active meal plan','Apply a meal plan from your library, or generate a new one in the Meal Planner.',`<button class="btn primary" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner')">Open Meal Planner</button>`);
        return;
      }
      let dated=Object.values(currentState.plan.dayDates||{}).some(value=>parsePlanLocalDate(value));
      if(!dated && currentState.plan.slots && Object.keys(currentState.plan.slots).length){
        const days=currentState.plan.days||Object.keys(currentState.plan.slots).length||7;
        currentState.plan.dayDates=buildPlanDayDates(platePlanTodayDate||getPlatePlanLocalToday(),days);
        currentState.plan.updatedAt=new Date().toISOString();
        safeLocalStorageSet(SK, safeJsonStringify(currentState));
        dated=true;
      }
      if(!dated){
        if(subtitle) subtitle.textContent='This plan has no calendar dates';
        host.innerHTML=renderTodayEmpty('Assign dates to this plan','Today only shows meals that are explicitly assigned to a calendar date.',`<button class="btn primary" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan from today</button><button class="btn ghost" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner');setTimeout(()=>openPlanDatesWorkspace(),0)">Assign dates</button>`);
        return;
      }
      const day=getTodayPlanDay(platePlanTodayDate, currentState.plan);
      if(!day){
        const next=getNextDatedPlanDay(platePlanTodayDate, currentState.plan);
        const nextCopy=next?` The next dated plan day is ${formatPlanDayLabel(currentState.plan,next[0],{short:true})}.`:'';
        if(subtitle) subtitle.textContent='No plan day is assigned';
        host.innerHTML=renderTodayEmpty('No meals planned for this date',`This date (${formatTodayDateLabel(platePlanTodayDate)}) is not assigned to the active meal plan.${nextCopy}`,`<button class="btn primary" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan cycle from today</button><button class="btn ghost" onclick="openApplyPlanFromLibraryModal()">Apply Plan from Library</button><button class="btn ghost" onclick="showView('planner')">Open Meal Planner</button>`);
        return;
      }
      if(subtitle) subtitle.textContent=formatPlanDayLabel(currentState.plan,day,{short:false});
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
          const reason=getPlanSlotReason(currentState.plan,day,meal.e);
          if(reason)reasonEntries.push({day:+day,slotKey:meal.e,person:'e',mealType:meal.mealType,reason});
        }
        if(!c){
          const reason=getPlanSlotReason(currentState.plan,day,meal.c);
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


  // == VAULT HELPERS & VIEWS ==

  function formatStockIngredientText(ing, scale = 1){
    if(!ing || !ing.stockWaterMl) return '';
    const qty = Math.round(((+ing.qty || 1) * scale) * 10) / 10;
    const water = Math.round((+ing.stockWaterMl || 0) * scale);
    const name = ing.name || 'Stock Cube';
    return `${qty} ${name}${qty === 1 ? '' : 's'} mixed with ${water}ml water`;
  }

  function ingRaw(ing){
    if(typeof ing==='string') return ing;
    const stockText = formatStockIngredientText(ing);
    if(stockText) return stockText;
    return ing.raw||[ing.qty||'',ing.unit||'',ing.name||''].filter(Boolean).join(' ');
  }

  function renderExpandableText(text,key,className=''){
    const value=String(text||'');
    const safeKey=String(key||('copy-'+dataQualityFingerprint(value))).replace(/[^a-zA-Z0-9_-]/g,'-');
    const needsToggle=value.length>46;
    return `<span id="expand-${ppEscapeAttr(safeKey)}" class="${ppEscapeAttr(className)}${needsToggle?' clamp-copy':''}">${ppEscapeHtml(value)}</span>${needsToggle?`<button type="button" class="btn text-expand-btn" aria-expanded="false" aria-controls="expand-${ppEscapeAttr(safeKey)}" onclick="toggleExpandableText(this,'expand-${ppEscapeAttr(safeKey)}')">Show more</button>`:''}`;
  }

  function toggleExpandableText(button,targetId){
    const target=document.getElementById(targetId);
    if(!target)return;
    const expanded=target.classList.toggle('expanded');
    button.setAttribute('aria-expanded',String(expanded));
    button.textContent=expanded?'Show less':'Show more';
  }

  function openVaultFitDetails(trigger,recipeId,variant='original',personKey='e'){
    const recipe=getProductIndexRecipe(recipeId);
    if(!recipe)return openAppInfoModal('Recipe unavailable','That recipe could not be found.');
    const mealType=getContextMealType(recipe,null,(recipe.types||[recipe.type||'dinner'])[0]);
    const bundle=calculateRecipeDisplayNutrition({recipe,variant,mealType});
    const portions=bundle?.portions||{};
    const person=personKey==='c'?'Chloe':'Elliott';
    const targets=getBudgets(personKey,mealType);
    const calories=personKey==='c'?portions.cCal:portions.eCal;
    const protein=personKey==='c'?portions.cProt:portions.eProt;
    const recipePct=personKey==='c'?portions.c:portions.e;
    const fit=calculateFit(calories,protein,targets.cal,targets.prot);
    const profileScore=Math.round(computeProfileFitScore(calories,targets.cal,protein,targets.prot));
    const html=`<div style="font-weight:750;font-size:16px;margin-bottom:8px">${ppEscapeHtml(person)} · ${ppEscapeHtml(recipe.name)}</div>
      <div class="nutrition-detail-row"><span>Allocated recipe portion</span><strong>${ppEscapeHtml(recipePct||'Not allocated')}</strong></div>
      <div class="nutrition-detail-row"><span>Calories</span><strong>${Math.round(calories||0)} / ${Math.round(targets.cal||0)} kcal</strong></div>
      <div class="nutrition-detail-row"><span>Protein</span><strong>${round1(protein||0)} / ${round1(targets.prot||0)}g</strong></div>
      <div class="nutrition-detail-row"><span>Slot Fit Score (${person})</span><strong>${profileScore}%</strong></div>
      <div class="msg ${fit.warn.length?'info':'success'}" style="margin:10px 0 0">${ppEscapeHtml(fit.warn.join(', ')||'This portion is on target.')}</div>
      <details class="card-details"><summary>Calculation details</summary><div>Fit score is calculated 50% from calorie error relative to target and 50% from protein target achievement for ${person} for ${mealType}.</div></details>`;
    showReviewTooltip(trigger,html,`${person} nutrition and fit details`);
  }

  window.vaultFilterFavouritesOnly = window.vaultFilterFavouritesOnly || false;
  window.vaultFilterFavoritesOnly = window.vaultFilterFavoritesOnly || false;

  function toggleVaultFavouritesFilter(){
    window.vaultFilterFavouritesOnly = !window.vaultFilterFavouritesOnly;
    window.vaultFilterFavoritesOnly = window.vaultFilterFavouritesOnly;
    const btn = document.getElementById('vault-filter-fav');
    if(btn){
      btn.classList.toggle('active', window.vaultFilterFavouritesOnly);
      btn.setAttribute('aria-pressed', window.vaultFilterFavouritesOnly ? 'true' : 'false');
    }
    renderVault();
  }

  function toggleVaultFavoritesFilter(){
    toggleVaultFavouritesFilter();
  }

  function hasVariantFavoritingInitialized(){
    const list = state?.userPrefs?.favouriteVariantIds || state?.prefs?.favouriteVariantIds || state?.userPrefs?.favoriteVariantIds || state?.prefs?.favoriteVariantIds;
    return Array.isArray(list);
  }

  function ensureVariantFavoritingPrefs(){
    if(!state) state = {};
    if(!state.prefs) state.prefs = {};
    if(!state.userPrefs) state.userPrefs = state.prefs;
    const existing = state.userPrefs.favouriteVariantIds || state.prefs.favouriteVariantIds || state.userPrefs.favoriteVariantIds || state.prefs.favoriteVariantIds;
    if(!Array.isArray(existing)){
      state.userPrefs.favouriteVariantIds = [];
      (state.recipes || []).forEach(r => {
        if(r && r.id && (r.isFavourite || r.isFavorite)){
          const key = `${r.id}_original`;
          if(!state.userPrefs.favouriteVariantIds.includes(key)){
            state.userPrefs.favouriteVariantIds.push(key);
          }
        }
      });
    } else {
      state.userPrefs.favouriteVariantIds = existing;
    }
    state.prefs.favouriteVariantIds = state.userPrefs.favouriteVariantIds;
    state.userPrefs.favoriteVariantIds = state.userPrefs.favouriteVariantIds;
    state.prefs.favoriteVariantIds = state.userPrefs.favouriteVariantIds;
    return state.userPrefs.favouriteVariantIds;
  }

  function isRecipeVariantFavourite(recipeId, variantKey = 'original'){
    if(!recipeId) return false;
    const list = typeof ensureVariantFavoritingPrefs === 'function'
      ? ensureVariantFavoritingPrefs()
      : (typeof window !== 'undefined' && typeof window.ensureVariantFavoritingPrefs === 'function'
        ? window.ensureVariantFavoritingPrefs()
        : []);
    const key = `${recipeId}_${variantKey}`;
    if(Array.isArray(list) && list.includes(key)){
      return true;
    }
    const hasInit = typeof hasVariantFavoritingInitialized === 'function'
      ? hasVariantFavoritingInitialized()
      : (typeof window !== 'undefined' && typeof window.hasVariantFavoritingInitialized === 'function'
        ? window.hasVariantFavoritingInitialized()
        : false);
    if(!hasInit && variantKey === 'original'){
      const rec = (state?.recipes || window.state?.recipes || []).find(r => r && r.id === recipeId);
      if(rec && (rec.isFavourite || rec.isFavorite)) return true;
    }
    return false;
  }

  const isRecipeVariantFavorite = isRecipeVariantFavourite;

  function renderVault(...args) {
    if (typeof window !== 'undefined' && typeof window.renderVault === 'function' && window.renderVault !== renderVault) {
      return window.renderVault(...args);
    }
    const list = document.getElementById('vault-list');
    if (!list) return;

    const currentRecipes = (window.state?.recipes || (typeof state !== 'undefined' ? state?.recipes : null) || []);
    if (!currentRecipes.length && !window.isPlatePlanHydrated && !window.state?.isCloudHydrated) {
      list.innerHTML = `<div class="ios-activity-skeleton">
        <div class="spinner"></div>
        <span class="ios-activity-skeleton-text">Syncing live recipes from cloud...</span>
      </div>`;
      return;
    }

    const ftEl = document.getElementById('filter-type');
    const fwEl = document.getElementById('filter-who');
    const ft = ftEl?.value || 'all', fw = fwEl?.value || 'all';
    const q = (document.getElementById('vault-search')?.value || '').trim().toLowerCase();
    const sort = (document.getElementById('vault-sort')?.value) || 'name';

    const favFilterBtn = document.getElementById('vault-filter-fav');
    const isFavOnly = !!(favFilterBtn?.classList.contains('active') || window.state?.vaultFavOnly || window.vaultFilterFavouritesOnly);
    if (favFilterBtn) {
      favFilterBtn.classList.toggle('active', isFavOnly);
      favFilterBtn.setAttribute('aria-pressed', isFavOnly ? 'true' : 'false');
      if (!favFilterBtn.dataset.boundFavFilter) {
        favFilterBtn.dataset.boundFavFilter = 'true';
        favFilterBtn.addEventListener('click', (e) => {
          e.preventDefault();
          favFilterBtn.classList.toggle('active');
          const active = favFilterBtn.classList.contains('active');
          favFilterBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
          if (window.state) window.state.vaultFavOnly = active;
          window.vaultFilterFavouritesOnly = active;
          renderVault();
        });
      }
    }

    ensureVariantFavoritingPrefs();
    const recipes = currentRecipes.filter(r => {
      if (!r) return false;
      if (isFavOnly) {
        const isFav = !!(r.isFavorite || r.isFavourite || isRecipeVariantFavourite(r.id, 'original') || isRecipeVariantFavourite(r.id, 'enhanced'));
        if (!isFav) return false;
      }
      const types = r.types || [r.type];
      const searchable = [
        r.name,
        r.source,
        r.who,
        ...(types || []),
        ...(r.ingredients || []).map(ing => (typeof ingRaw === 'function' ? ingRaw(ing) : (ing?.name || '')))
      ].join(' ').toLowerCase();
      return (ft === 'all' || types.includes(ft)) && (fw === 'all' || r.who === fw) && (!q || searchable.includes(q));
    });

    const selectedMealType = ft !== 'all' ? ft : 'dinner';
    const sortedRecipes = (typeof getSortedRecipes === 'function')
      ? getSortedRecipes(recipes, sort, selectedMealType)
      : recipes;

    if (!sortedRecipes.length) { list.innerHTML = '<div class="empty">No matching recipes found.</div>'; return; }
    const listSignature = [ft, fw, q, sort, isFavOnly ? 'fav' : 'all'].join('|');
    if (typeof resetProgressiveList === 'function') {
      resetProgressiveList('vault', listSignature);
    }
    const totalRecipes = sortedRecipes.length;
    const visibleRecipes = sortedRecipes.slice(0, platePlanListLimits?.vault || 24);
    const cardRenderer = typeof renderRecipeCard === 'function'
      ? renderRecipeCard
      : (typeof window.renderRecipeCard === 'function' ? window.renderRecipeCard : null);
    const progBtn = typeof progressiveListButton === 'function'
      ? progressiveListButton('vault', totalRecipes, visibleRecipes.length)
      : '';

    const prefs = (window.state && window.state.prefs) || state?.prefs || {};
    const ecal = Number(prefs.ecal) || 2400;
    const eprot = Number(prefs.eprot) || 130;
    const ccal = Number(prefs.ccal) || 1700;
    const cprot = Number(prefs.cprot) || 100;

    const eAlloc = prefs.eAlloc || { b: 15, l: 25, d: 45, s: 15 };
    const cAlloc = prefs.cAlloc || { b: 25, l: 30, d: 35, s: 10 };
    const eProtAlloc = prefs.eProtAlloc || eAlloc;
    const cProtAlloc = prefs.cProtAlloc || cAlloc;

    let mKey = 'd';
    if (selectedMealType.includes('breakfast')) mKey = 'b';
    else if (selectedMealType.includes('lunch')) mKey = 'l';
    else if (selectedMealType.includes('snack')) mKey = 's';
    else if (selectedMealType.includes('dinner')) mKey = 'd';

    const eTgt = {
      cal: ecal * ((eAlloc[mKey] ?? 45) / 100),
      prot: eprot * ((eProtAlloc[mKey] ?? eAlloc[mKey] ?? 45) / 100)
    };
    const cTgt = {
      cal: ccal * ((cAlloc[mKey] ?? 35) / 100),
      prot: cprot * ((cProtAlloc[mKey] ?? cAlloc[mKey] ?? 35) / 100)
    };
    const targetMacros = {
      mealType: selectedMealType,
      targetCal_E: eTgt.cal,
      targetProt_E: eTgt.prot,
      targetCal_C: cTgt.cal,
      targetProt_C: cTgt.prot,
      e: eTgt,
      c: cTgt,
      prefs: { ecal, eprot, ccal, cprot }
    };

    if (cardRenderer) {
      list.innerHTML = visibleRecipes.map(r => cardRenderer(r, { mealType: selectedMealType, eTgt, cTgt, targetMacros })).join('') + progBtn;
    }
  }


  // == EXPOSE TO GLOBAL NAMESPACE ==

  window.PlatePlanViews = {
    renderToday,
    renderTodayView: renderToday,
    renderVault,
    renderRecipes: renderVault,
    renderRecipesView: renderVault,
    formatTodayDateLabel,
    renderTodayPersonPanel,
    renderTodayMealCard,
    renderTodayReasonCard,
    renderTodayEmpty,
    renderTodayLoadingSkeleton,
    isPlatePlanStateReady,
    formatStockIngredientText,
    ingRaw,
    renderExpandableText,
    toggleExpandableText,
    openVaultFitDetails,
    toggleVaultFavouritesFilter,
    toggleVaultFavoritesFilter,
    hasVariantFavoritingInitialized,
    ensureVariantFavoritingPrefs,
    isRecipeVariantFavourite,
    isRecipeVariantFavorite
  };

  window.renderToday = renderToday;
  window.renderTodayView = renderToday;
  window.renderTodayLoadingSkeleton = renderTodayLoadingSkeleton;
  window.isPlatePlanStateReady = isPlatePlanStateReady;
  window.renderVault = renderVault;
  window.renderRecipes = renderVault;
  window.renderRecipesView = renderVault;
  window.formatTodayDateLabel = formatTodayDateLabel;
  window.ingRaw = ingRaw;
  window.renderExpandableText = renderExpandableText;
  window.openVaultFitDetails = openVaultFitDetails;
  window.toggleVaultFavouritesFilter = toggleVaultFavouritesFilter;
  window.toggleVaultFavoritesFilter = toggleVaultFavoritesFilter;
  window.isRecipeVariantFavourite = isRecipeVariantFavourite;
  window.isRecipeVariantFavorite = isRecipeVariantFavorite;
  window.ensureVariantFavoritingPrefs = ensureVariantFavoritingPrefs;
  window.hasVariantFavoritingInitialized = hasVariantFavoritingInitialized;

})();
