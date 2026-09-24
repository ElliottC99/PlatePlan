/**
 * PlatePlan Today Dashboard UI Sub-module
 */
(function() {
  window.PlatePlanToday = window.PlatePlanToday || {};
  window.PlatePlanToday.State = window.PlatePlanToday.State || {
    todaySelectedDateIso: '',
    todayTimer: null,
    lastActualDate: ''
  };

  const TodayState = window.PlatePlanToday.State;
  const ppEscapeHtml = window.ppEscapeHtml || (s => s);
  const ppEscapeAttr = window.ppEscapeAttr || (s => s);

  function renderTodayPersonPanel(person, label, entries) {
    const getBudgets = window.getBudgets || (() => ({ cal: 0, prot: 0 }));
    const toTitleCase = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
    
    const rows = ['breakfast','lunch','dinner'].map(mealType => {
      const entry = entries.find(item => item.person === person && item.mealType === mealType);
      const actualCal = Math.round(entry?.calculated?.cal || 0);
      const actualProt = Math.round((entry?.calculated?.prot || 0) * 10) / 10;
      const target = getBudgets(person, mealType);
      const calPct = target.cal ? Math.min(100, Math.round(actualCal / target.cal * 100)) : 0;
      const protPct = target.prot ? Math.min(100, Math.round(actualProt / target.prot * 100)) : 0;
      
      return `
        <div class="today-target-row flex items-center justify-between gap-4 mb-2">
          <div class="today-target-meal text-xs font-bold w-16 uppercase text-zinc-500">${ppEscapeHtml(toTitleCase(mealType))}</div>
          <div class="today-target-values flex-1">
            <div class="today-target-line flex justify-between text-[11px] mb-1">
              <span>${actualCal} / ${Math.round(target.cal)} kcal</span>
              <span>${actualProt} / ${Math.round(target.prot)}g P</span>
            </div>
            <div class="today-progress h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-1" role="progressbar" aria-valuenow="${actualCal}" aria-valuemax="${Math.round(target.cal)}">
              <div class="h-full bg-emerald-500" style="width:${calPct}%"></div>
            </div>
            <div class="today-progress protein h-1.5 bg-zinc-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow="${actualProt}" aria-valuemax="${Math.round(target.prot)}">
              <div class="h-full bg-blue-500" style="width:${protPct}%"></div>
            </div>
          </div>
        </div>`;
    }).join('');
    
    return `
      <section class="today-person p-4 bg-white rounded-xl border border-zinc-100 shadow-sm" aria-label="${ppEscapeAttr(label)} meal nutrition">
        <div class="today-person-head mb-4 flex justify-between items-start">
          <div>
            <div class="today-person-name font-bold text-zinc-900">${ppEscapeHtml(label)}</div>
            <div class="today-person-copy text-[11px] text-zinc-500">Daily allocation</div>
          </div>
        </div>
        ${rows}
      </section>`;
  }

  function renderTodayMealCard(group, mealType = 'dinner') {
    const isShared = group.length === 2;
    const entry = group[0];
    const info = entry.info;
    const personKey = isShared ? 'both' : entry.person;
    const isEaten = (window.isMealEatenOnDate || (() => false))(window.platePlanTodayDate, mealType, personKey);
    const people = group.map(item => item.person === 'e' ? 'Elliott' : 'Chloe');
    const macroText = `${Math.round(entry.calculated?.cal || 0)} kcal · ${Math.round((entry.calculated?.prot || 0) * 10) / 10}g protein`;
    
    const toggleCall = `toggleMealEatenOnDate('${window.platePlanTodayDate}','${ppEscapeAttr(mealType)}','${ppEscapeAttr(personKey)}')`;

    return `
      <article class="today-meal-card p-4 mb-4 bg-white rounded-2xl border border-zinc-200 shadow-sm transition-all ${isEaten ? 'opacity-50 grayscale-[0.5]' : 'hover:shadow-md'}">
        <div class="today-meal-card-top flex justify-between items-start mb-4">
          <div class="flex gap-4 items-start">
            <button class="today-eaten-circle w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isEaten ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 hover:border-emerald-400'}" 
                    aria-label="${isEaten ? 'Mark as not eaten' : 'Mark as eaten'}" 
                    onclick="${toggleCall}">
              ${isEaten ? '✓' : ''}
            </button>
            <div class="today-meal-info">
              <div class="today-meal-name font-bold text-lg leading-tight text-zinc-900 ${isEaten ? 'line-through text-zinc-500' : ''}">${ppEscapeHtml(info.active?.name || info.recipe?.name || 'Recipe')}</div>
              <div class="flex flex-wrap gap-2 mt-2">
                <span class="text-[10px] px-2 py-0.5 bg-zinc-100 rounded-md text-zinc-600 font-bold uppercase tracking-wider">${ppEscapeHtml(people.join(' & '))}</span>
                <span class="text-[10px] px-2 py-0.5 bg-emerald-50 rounded-md text-emerald-700 font-bold uppercase tracking-wider">${ppEscapeHtml(info.variant === 'enhanced' ? 'Enhanced' : 'Original')}</span>
                ${isEaten ? '<span class="text-[10px] px-2 py-0.5 bg-emerald-100 rounded-md text-emerald-800 font-bold uppercase tracking-wider">Eaten</span>' : ''}
              </div>
            </div>
          </div>
          <div class="today-meal-macro-pill text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 whitespace-nowrap shadow-sm">${ppEscapeHtml(macroText)}</div>
        </div>
        <div class="flex justify-between items-center pt-4 border-t border-zinc-50">
          <button class="btn ghost sm !text-xs !px-3" onclick="viewRecipe('${ppEscapeAttr(info.id)}','','${ppEscapeAttr(info.variant || 'original')}')">View Recipe</button>
          <button class="btn text sm !text-xs text-zinc-400 hover:text-emerald-600 font-bold" onclick="openPlanReschedule(${+entry.day},'${ppEscapeAttr(entry.slotKey)}')">Reschedule</button>
        </div>
      </article>`;
  }

  function renderTodayReasonCard(group) {
    const entry = group[0];
    const people = group.map(item => item.person === 'e' ? 'Elliott' : 'Chloe').join(' & ');
    const formatPlanSlotReason = window.formatPlanSlotReason || (r => String(r || ''));
    return `
      <article class="today-reason-card p-4 mb-4 bg-zinc-50 rounded-xl border border-zinc-100 border-dashed">
        <div class="font-bold text-zinc-700">${ppEscapeHtml(formatPlanSlotReason(entry.reason))}</div>
        <div class="text-xs text-zinc-500 mt-1">${ppEscapeHtml(people)} · no recipe scheduled</div>
      </article>`;
  }

  function renderTodayEmpty(title, copy, actions = '') {
    return `
      <div class="today-empty p-12 text-center bg-zinc-50 rounded-3xl border border-zinc-100 border-dashed">
        <div class="text-4xl mb-4">🍽️</div>
        <h3 class="font-bold text-zinc-900 mb-2 text-lg">${ppEscapeHtml(title)}</h3>
        <p class="text-sm text-zinc-500 max-w-xs mx-auto mb-6">${ppEscapeHtml(copy)}</p>
        ${actions ? `<div class="flex justify-center gap-2">${actions}</div>` : ''}
      </div>`;
  }

  function renderToday() {
    const host = document.getElementById('today-content');
    if (!host) return;

    const isReady = window.PlatePlanRouter?.isPlatePlanStateReady || window.isPlatePlanStateReady || (() => true);
    if (!isReady()) {
      host.innerHTML = `<div class="p-12 text-center animate-pulse text-zinc-400"><div class="spinner mx-auto mb-4"></div>Loading your plan...</div>`;
      return;
    }

    const currentState = window.state || {};
    const platePlanTodayDate = window.platePlanTodayDate || (typeof getPlatePlanLocalToday === 'function' ? getPlatePlanLocalToday() : '');
    window.platePlanTodayDate = platePlanTodayDate;

    try {
      const label = document.getElementById('today-date-label');
      if (label) {
        const formatLabel = window.formatTodayDateLabel || window.PlatePlanViews?.formatTodayDateLabel || (d => d);
        label.textContent = formatLabel(platePlanTodayDate);
      }

      if (!currentState.plan?.slots || !Object.keys(currentState.plan.slots).length) {
        host.innerHTML = renderTodayEmpty('No active meal plan', 'Generate or apply a meal plan to see your schedule.', 
          `<button class="btn primary sm" onclick="showView('planner')">Open Planner</button>`);
        return;
      }

      const day = (window.getTodayPlanDay || (() => null))(platePlanTodayDate, currentState.plan);
      if (!day) {
        host.innerHTML = renderTodayEmpty('No plan for today', 'This date is not included in your active meal plan cycle.',
          `<button class="btn primary sm" onclick="rollActivePlanToDate('${platePlanTodayDate}')">Start plan today</button>`);
        return;
      }

      const subtitle = document.getElementById('today-subtitle');
      const formatPlanDayLabel = window.formatPlanDayLabel || ((p, d) => `Day ${d}`);
      if (subtitle) subtitle.textContent = formatPlanDayLabel(currentState.plan, day, { short: false });

      const entries = [], reasonEntries = [];
      const mealDefinitions = [
        { mealType: 'breakfast', e: 'breakfastE', c: 'breakfastC' },
        { mealType: 'lunch', e: 'lunchE', c: 'lunchC' },
        { mealType: 'dinner', e: 'dinnerE', c: 'dinnerC' }
      ];

      mealDefinitions.forEach(meal => {
        const getEntry = window.getTodaySlotEntry || (() => null);
        const getReason = window.getPlanSlotReason || (() => null);
        
        const e = getEntry(day, meal.e, 'e', meal.mealType);
        const c = getEntry(day, meal.c, 'c', meal.mealType);
        if (e) entries.push(e);
        if (c) entries.push(c);
        
        if (!e) {
          const reason = getReason(currentState.plan, day, meal.e);
          if (reason) reasonEntries.push({ day: +day, slotKey: meal.e, person: 'e', mealType: meal.mealType, reason });
        }
        if (!c) {
          const reason = getReason(currentState.plan, day, meal.c);
          if (reason) reasonEntries.push({ day: +day, slotKey: meal.c, person: 'c', mealType: meal.mealType, reason });
        }
      });

      if (!entries.length && !reasonEntries.length) {
        host.innerHTML = renderTodayEmpty('Empty day', 'No meals or reasons scheduled for this plan day.');
        return;
      }

      const getBudgets = window.getBudgets || (() => ({ cal: 0, prot: 0 }));
      let eCal = 0, eProt = 0, cCal = 0, cProt = 0;
      entries.forEach(item => {
        if (item.person === 'e') { eCal += (item.calculated?.cal || 0); eProt += (item.calculated?.prot || 0); }
        else if (item.person === 'c') { cCal += (item.calculated?.cal || 0); cProt += (item.calculated?.prot || 0); }
      });

      const summaryHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          ${renderTodayPersonPanel('e', 'Elliott', entries)}
          ${renderTodayPersonPanel('c', 'Chloe', entries)}
        </div>
      `;

      const toTitleCase = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
      const mealsHtml = mealDefinitions.map(meal => {
        const mealEntries = entries.filter(entry => entry.mealType === meal.mealType);
        const mealReasons = reasonEntries.filter(entry => entry.mealType === meal.mealType);
        if (!mealEntries.length && !mealReasons.length) return '';
        
        const isEaten = (window.isMealEatenOnDate || (() => false))(platePlanTodayDate, meal.mealType, 'both');
        
        return `
          <div class="mb-8">
            <div class="flex items-center gap-3 mb-4">
              <h2 class="text-xl font-bold text-zinc-900">${ppEscapeHtml(toTitleCase(meal.mealType))}</h2>
              ${isEaten ? '<span class="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">COMPLETED</span>' : ''}
            </div>
            ${mealEntries.map(e => renderTodayMealCard([e], meal.mealType)).join('')}
            ${mealReasons.map(r => renderTodayReasonCard([r])).join('')}
          </div>
        `;
      }).join('');

      host.innerHTML = summaryHtml + mealsHtml;

    } catch (err) {
      console.error('Error rendering Today view:', err);
      host.innerHTML = renderTodayEmpty('Rendering Error', 'Unable to display your plan for today.');
    }
  }

  Object.assign(window.PlatePlanToday, {
    renderToday,
    renderTodayPersonPanel,
    renderTodayMealCard,
    renderTodayReasonCard,
    renderTodayEmpty
  });

  window.renderToday = renderToday;
  window.renderTodayView = renderToday;
})();
