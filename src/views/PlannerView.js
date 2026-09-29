/**
 * src/views/PlannerView.js (v3.8.4)
 * Componentized Weekly Planner, Wizard & Swap Modal View.
 */

export function renderPlanner() {
  if (typeof renderPlannerWizard === 'function') {
    renderPlannerWizard();
  }
  if (typeof renderPlan === 'function') {
    renderPlan();
  }
}

export function renderPlannerWizard() {
  const host = document.getElementById('planner-wizard-host');
  if (!host) return;

  const currentStep = typeof getPlannerWizardStep === 'function' ? getPlannerWizardStep() : 1;
  const hasActivePlan = !!(window.state?.plan?.slots && Object.keys(window.state.plan.slots).length > 0);

  let stepContentHtml = '';

  if (currentStep === 1) {
    const daysVal = window.state.plannerDays || window.state.plan?.days || 10;
    const today = new Date().toISOString().split('T')[0];
    const startVal = window.state.plannerStartDate || window.state.plan?.dayDates?.[1] || today;
    const cadence = window.state.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
    const minFitScore = window.state.prefs?.minFitScore || 0;
    const activeExclusions = typeof getActiveWizardExclusions === 'function' ? getActiveWizardExclusions() : [];
    const rawPinned = window.state?.planOptions?.pinnedMeals || window.state?.pinnedRecipes || [];
    const pinned = Array.isArray(rawPinned) ? rawPinned : [];
    const rawUseUp = window.state?.planOptions?.useUp || window.state?.useUpProducts || [];
    const useUp = Array.isArray(rawUseUp) ? rawUseUp : (rawUseUp && typeof rawUseUp === 'object' ? Object.keys(rawUseUp) : []);

    stepContentHtml = window.GeneratorConstraintsForm?.renderConstraintsForm?.({
      daysVal,
      startVal,
      cadence,
      minFitScore,
      activeExclusions,
      pinned,
      useUp
    }) || '';
  } else if (currentStep === 2) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(2) || `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Generated Yet</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Configure your days and requests in Step 1 to generate your meal plan.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1: Configure Requests</button>
        </div>
      `;
    } else {
      const plan = window.state.plan || {};
      const rawSlots = plan.slots;
      const safeSlots = Array.isArray(rawSlots) ? rawSlots : (rawSlots && typeof rawSlots === 'object' ? Object.values(rawSlots) : []);
      const days = plan.days || safeSlots.length || 0;
      const prepGroups = Array.isArray(plan.mealPrepGroups) ? plan.mealPrepGroups : [];

      let cardsHtml = '';
      for (let d = 1; d <= days; d++) {
        const dateLabel = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel(plan, d, { short: true }) : `Day ${d}`;
        const daySlots = plan.slots?.[d] || {};

        let eCal = 0, eProt = 0, cCal = 0, cProt = 0;
        ['breakfast', 'lunch', 'dinner'].forEach(m => {
          const sE = daySlots[m + 'E'];
          const sC = daySlots[m + 'C'];
          if (sE && typeof getPlanSlotInfo === 'function' && typeof getPlannedSlotNutrition === 'function') {
            const info = getPlanSlotInfo(sE);
            const nut = getPlannedSlotNutrition(info?.active, m + 'E', info?.instanceId, plan);
            if (nut) { eCal += nut.cal || 0; eProt += nut.prot || 0; }
          }
          if (sC && typeof getPlanSlotInfo === 'function' && typeof getPlannedSlotNutrition === 'function') {
            const info = getPlanSlotInfo(sC);
            const nut = getPlannedSlotNutrition(info?.active, m + 'C', info?.instanceId, plan);
            if (nut) { cCal += nut.cal || 0; cProt += nut.prot || 0; }
          }
        });

        const dayPreps = prepGroups.filter(g => (Array.isArray(g?.days) ? g.days : []).includes(d));

        const mealsHtml = ['breakfast', 'lunch', 'dinner'].map(meal => {
          const slotKeyE = meal + 'E';
          const slotKeyC = meal + 'C';
          const sE = daySlots[slotKeyE];
          const sC = daySlots[slotKeyC];
          const infoE = sE && typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(sE) : null;
          const infoC = sC && typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(sC) : null;
          const rE = infoE?.active;
          const rC = infoC?.active;
          const isShared = rE && rC && infoE.id === infoC.id && infoE.variant === infoC.variant;
          return window.PlannerMealSlot?.renderDensePlanMealRow({ meal, isShared, rE, rC, infoE, infoC, day: d, slotKeyE, slotKeyC }) || '';
        }).join('');

        cardsHtml += window.PlannerDayCard?.renderDenseDayCard({
          day: d,
          dateLabel,
          eCal,
          eProt,
          cCal,
          cProt,
          dayPreps,
          mealsHtml
        }) || '';
      }

      stepContentHtml = `
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
          <div class="dense-plan-grid">${cardsHtml}</div>
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(1)">← Back to Configure</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="setPlannerWizardStep(3)">Proceed to Shopping List & Substitutions →</button>
          </div>
        </div>
      `;
    }
  } else if (currentStep === 3) {
    if (!hasActivePlan) {
      stepContentHtml = window.GeneratorWizardModal?.renderWizardEmptyPlanCard?.(3) || `
        <div class="card" style="padding:24px;text-align:center">
          <h3>No Meal Plan Active</h3>
          <p style="color:var(--text2);font-size:13px;margin-bottom:14px">Generate a meal plan first before viewing the shopping list.</p>
          <button type="button" class="btn primary" onclick="setPlannerWizardStep(1)">← Go to Step 1</button>
        </div>
      `;
    } else {
      const agg = typeof computeWizardShoppingAgg === 'function' ? computeWizardShoppingAgg(window.state.plan) : { items: [], totalCost: 0 };
      const items = agg.items || [];
      const totalCost = agg.totalCost || 0;
      const topToolbarHtml = window.ShoppingBatchToolbar?.renderShoppingBatchToolbar?.({ totalCost, items }) || '';
      const listHtml = window.ShoppingCategoryGroup?.renderShoppingCategoriesList?.(items) || '';

      stepContentHtml = `
        <div style="display:flex;flex-direction:column;gap:16px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro',sans-serif">
          ${topToolbarHtml}
          ${listHtml}
          <div class="card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <button type="button" class="btn ghost" onclick="setPlannerWizardStep(2)">← Back to Review Plan</button>
            <button type="button" class="btn primary" style="font-weight:700;padding:10px 24px" onclick="commitPlannerWizardPlan()">✓ Save Shopping List &amp; Plan (Commit to Today) →</button>
          </div>
        </div>
      `;
    }
  } else if (currentStep === 4) {
    stepContentHtml = window.GeneratorWizardModal?.renderWizardStep4Commit?.('v3.8.4') || `
      <div class="card" style="padding:28px;text-align:center">
        <h2 style="margin-top:0">Committing Meal Plan v3.8.4...</h2>
        <p style="color:var(--text2);font-size:13px;margin-bottom:18px">Finalizing plan metadata, locking shopping quantities, and synchronizing with your live dashboard.</p>
        <button type="button" class="btn primary" onclick="commitPlannerWizardPlan()">Commit Plan Now</button>
      </div>
    `;
  }

  host.innerHTML = window.GeneratorWizardModal?.renderPlannerWizardView?.({
    currentStep,
    hasActivePlan,
    stepContentHtml
  }) || `<div class="planner-wizard-container">${stepContentHtml}</div>`;
}

export function renderPlan() {
  if (typeof ensurePlannerShell === 'function') ensurePlannerShell();
  if (typeof installPlannerSummaryObserver === 'function') installPlannerSummaryObserver();
  renderPlannerWizard();
  const el = document.getElementById('plan-content');
  if (!el) return;
  try {
    if (!window.state.plan || !window.state.plan.slots) {
      el.innerHTML = '';
      const actions = document.getElementById('plan-actions'); if (actions) actions.style.display = 'none';
      const overall = document.getElementById('plan-overall-summary'); if (overall) overall.innerHTML = '';
      const prep = document.getElementById('plan-meal-prep-panel'); if (prep) prep.innerHTML = '';
      return;
    }
    
    const { days, slots } = window.state.plan;
    const startInput = document.getElementById('plan-start-date'); if (startInput) startInput.value = window.state.plan.dayDates?.[1] || '';
    let hasValidSlots = false;
    
    const makeRenderedDaySummary = () => {
      const totals = { e: { cal: 0, prot: 0 }, c: { cal: 0, prot: 0 } };
      const assumed = { e: { cal: 0, prot: 0, labels: ['snacks'] }, c: { cal: 0, prot: 0, labels: ['snacks'] } };
      ['e', 'c'].forEach(person => {
        const b = typeof getBudgets === 'function' ? getBudgets(person, 'snack') : { cal: 0, prot: 0 };
        totals[person].cal += +b.cal || 0;
        totals[person].prot += +b.prot || 0;
        assumed[person].cal += +b.cal || 0;
        assumed[person].prot += +b.prot || 0;
      });
      return {
        totals,
        targets: { e: { cal: +window.state.prefs.ecal || 0, prot: +window.state.prefs.eprot || 0 }, c: { cal: +window.state.prefs.ccal || 0, prot: +window.state.prefs.cprot || 0 } },
        assumed,
        score: 0
      };
    };

    let html = '';
    if (window.state.isDraftPlan || window.state.draftPlan) {
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

    const localToday = typeof getPlatePlanLocalToday === 'function' ? getPlatePlanLocalToday() : new Date().toISOString().split('T')[0];
    const isPlanExpired = typeof checkIsPlanExpired === 'function' ? checkIsPlanExpired(window.state.plan, localToday) : false;
    if (isPlanExpired) {
      const tomorrow = typeof getTomorrowLocalDate === 'function' ? getTomorrowLocalDate() : localToday;
      const datedEntries = Object.entries(window.state.plan.dayDates || {}).filter(([, v]) => typeof parsePlanLocalDate === 'function' ? !!parsePlanLocalDate(v) : !!v);
      const dates = datedEntries.map(([, v]) => v).sort();
      const maxDate = dates[dates.length - 1] || localToday;
      const endLabel = typeof parsePlanLocalDate === 'function' && parsePlanLocalDate(maxDate) ? formatPlanDateShort(maxDate) : maxDate;
      const tomorrowLabel = typeof formatPlanDateShort === 'function' ? formatPlanDateShort(tomorrow) : tomorrow;
      html += `<div class="card plan-expired-banner" style="background:var(--surface2);border:1px solid var(--border-strong);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 4px 14px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div style="width:38px;height:38px;border-radius:10px;background:var(--amber-bg);color:var(--amber);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0;">
            ⏳
          </div>
          <div style="flex:1;min-width:220px">
            <div style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:3px">Current Meal Plan Ended (${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(endLabel) : endLabel})</div>
            <div style="font-size:13px;color:var(--text2);line-height:1.4">Your previous plan has completed. Ready for next week? Generate a fresh plan starting tomorrow (${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(tomorrowLabel) : tomorrowLabel}).</div>
            <div class="btn-row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn primary sm" onclick="generateNewPlanStartingTomorrow()">✨ Generate Plan Starting Tomorrow</button>
              <button type="button" class="btn ghost sm" onclick="openPlanSetupAndFocus()">⚙️ Setup Settings</button>
            </div>
          </div>
        </div>
      </div>`;
    }

    const earlierDays = Array.from({ length: days }, (_, index) => index + 1).filter(day => {
      const value = window.state.plan.dayDates?.[day] || '';
      return typeof parsePlanLocalDate === 'function' ? !!parsePlanLocalDate(value) && value < localToday : false;
    });

    if (earlierDays.length) {
      const firstLabel = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel(window.state.plan, earlierDays[0], { short: true }) : `Day ${earlierDays[0]}`;
      const lastLabel = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel(window.state.plan, earlierDays[earlierDays.length - 1], { short: true }) : `Day ${earlierDays[earlierDays.length - 1]}`;
      const range = earlierDays.length > 1 ? `${firstLabel} – ${lastLabel}` : firstLabel;
      const isExpanded = typeof platePlanEarlierDaysExpanded !== 'undefined' ? platePlanEarlierDaysExpanded : false;
      html += `<div class="plan-earlier-days-heading" id="plan-earlier-days-heading">
        <button type="button" class="plan-earlier-days-toggle" aria-expanded="${isExpanded}" onclick="togglePlatePlanEarlierDays()">
          <span><strong>Earlier days</strong><small>${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(range) : range} · ${earlierDays.length} day${earlierDays.length === 1 ? '' : 's'}</small></span>
          <span aria-hidden="true">${isExpanded ? 'Hide' : 'Show'}</span>
        </button>
      </div>`;
    }

    for (let d = 1; d <= days; d++) {
      const isExpanded = typeof platePlanEarlierDaysExpanded !== 'undefined' ? platePlanEarlierDaysExpanded : false;
      if (earlierDays.includes(d) && !isExpanded) continue;
      const s = slots[d] || {};
      const allEx = typeof SLOTS !== 'undefined' ? SLOTS.every(sl => window.state.excluded[d]?.[sl.key]) : false;
      if (allEx) {
        html += '<div class="day-plan-card skipped"><div style="display:flex;align-items:center;gap:8px;font-size:13px;flex-wrap:wrap"><strong>' + (typeof ppEscapeHtml === 'function' ? ppEscapeHtml(formatPlanDayLabel(window.state.plan, d, { short: true })) : `Day ${d}`) + '</strong><input type="date" aria-label="Date for day ' + d + '" value="' + (typeof ppEscapeAttr === 'function' ? ppEscapeAttr(window.state.plan.dayDates?.[d] || '') : '') + '" onchange="setPlanDayDate(' + d + ',this.value)" style="width:auto"><span style="color:var(--text3)">-- no meals planned</span></div></div>';
        continue;
      }

      const daySlotInfos = typeof buildPlanDaySlotInfos === 'function' ? buildPlanDaySlotInfos(window.state.plan, d) : [];
      const daySummary = makeRenderedDaySummary();
      let dayRowsHtml = '';

      if (typeof SLOTS !== 'undefined' && typeof SLOT_LABELS !== 'undefined' && typeof SLOT_COLORS !== 'undefined') {
        SLOTS.forEach(sl => {
          const isEx = window.state.excluded[d]?.[sl.key];
          const slotData = s[sl.key];
          const slotInfo = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(slotData) : { active: null, id: null, variant: 'original', instanceId: null };
          const r = slotInfo.active;
          const rId = slotInfo.id;
          const instanceId = slotInfo.instanceId;
          const lblLines = SLOT_LABELS[sl.key].split('\n');
          const showRecipe = !!r && !isEx;

          if (showRecipe) hasValidSlots = true;

          const slotNutrition = daySlotInfos.find(info => info.slotKey === sl.key) || (typeof getPlannerSlotNutritionInfo === 'function' ? getPlannerSlotNutritionInfo(window.state.plan, d, sl.key) : { cal: 0, prot: 0 });
          let calStr = '';
          let rowCal = 0;
          let rowProt = 0;
          let rowPerson = sl.key.endsWith('E') ? 'e' : sl.key.endsWith('C') ? 'c' : '';
          if (showRecipe) {
            rowCal = +slotNutrition.cal || 0;
            rowProt = +slotNutrition.prot || 0;
            calStr = `${Math.round(rowCal)}kcal / P${typeof round1 === 'function' ? round1(rowProt) : rowProt}g`;
            if (rowPerson) {
              daySummary.totals[rowPerson].cal += rowCal;
              daySummary.totals[rowPerson].prot += rowProt;
            }
          }
          const rowAttrs = showRecipe ? ` data-plan-person="${rowPerson}" data-plan-cal="${rowCal}" data-plan-prot="${rowProt}"` : '';

          const slotReason = typeof getPlanSlotReason === 'function' ? getPlanSlotReason(window.state.plan, d, sl.key) : '';
          const slotReasonLabel = typeof formatPlanSlotReason === 'function' ? formatPlanSlotReason(slotReason) : slotReason;
          const slotActionsHtml = showRecipe
            ? '<div class="slot-actions"><span class="slot-macro">' + calStr + '</span><button class="btn sm primary" onclick="viewRecipe(\'' + rId + '\', \'' + (instanceId || '') + '\', \'' + slotInfo.variant + '\')">View</button><button class="btn sm ghost" onclick="openSwapMealModal(' + d + ',\'' + sl.key + '\')">Swap</button><button class="btn sm ghost" onclick="openPlannedMealActions(' + d + ',\'' + sl.key + '\')">More</button></div>'
            : slotReason
              ? '<div class="slot-actions"><button class="btn sm ghost" onclick="openSwapMealModal(' + d + ',\'' + sl.key + '\')">Choose Meal</button><button class="btn sm ghost" onclick="clearPlanSlotReason(' + d + ',\'' + sl.key + '\')">Clear reason</button></div>'
              : '<div class="slot-actions"><button class="btn sm ghost" onclick="openSwapMealModal(' + d + ',\'' + sl.key + '\')">Choose Meal</button></div>';
          const emptyContent = slotReason ? '<span class="plan-slot-reason">' + (typeof ppEscapeHtml === 'function' ? ppEscapeHtml(slotReasonLabel) : slotReasonLabel) + '</span>' : '<span style="color:var(--text3)">Not set</span>';
          const isPinned = !!(r && typeof getPinnedRecipesList === 'function' && getPinnedRecipesList().some(p => p.recipeId === rId && (p.variant || 'original') === (slotInfo.variant || 'original')));
          dayRowsHtml += '<div class="slot-row"' + rowAttrs + '><span class="slot-lbl" style="color:' + SLOT_COLORS[sl.key] + '">' + lblLines[0] + '<br>' + lblLines[1] + '</span>' + (isEx ? '<span class="slot-skipped">Not needed</span>' : '<span class="slot-name' + (r && /(?:https?:\/\/|www\.)/i.test(r.name || '') ? ' breakable-url' : '') + '">' + (r ? (typeof ppEscapeHtml === 'function' ? ppEscapeHtml(r.name) : r.name) : emptyContent) + (slotInfo.variant === 'enhanced' ? ' <span class="tag green">Enhanced</span>' : '') + (isPinned ? ' <span class="tag pinned" title="Pre-selected recipe">Pinned</span>' : '') + '</span>' + slotActionsHtml) + '</div>';
        });
      }

      daySummary.score = typeof calculatePlanDayScoreFromTotals === 'function' ? calculatePlanDayScoreFromTotals(daySummary.totals) : 0;
      const summaryHtml = ['e', 'c'].map(p => `<div class="summary-box">${typeof renderPlannerPersonSummaryBox === 'function' ? renderPlannerPersonSummaryBox(p, daySummary) : ''}</div>`).join('');
      const dayLabelFormatted = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel(window.state.plan, d, { short: true }) : `Day ${d}`;
      const dayDateVal = window.state.plan.dayDates?.[d] || '';
      html += '<div class="day-plan-card"><div class="row-between" style="margin-bottom:10px;gap:8px;flex-wrap:wrap"><div class="plan-date-control"><div style="font-size:13px;font-weight:600">' + (typeof ppEscapeHtml === 'function' ? ppEscapeHtml(dayLabelFormatted) : dayLabelFormatted) + '</div><input type="date" aria-label="Date for day ' + d + '" value="' + (typeof ppEscapeAttr === 'function' ? ppEscapeAttr(dayDateVal) : dayDateVal) + '" onchange="setPlanDayDate(' + d + ',this.value)"></div><span class="tag" title="Lower is better. Calories miss plus protein shortfall.">Score ' + daySummary.score + '</span></div><div class="plan-summary">' + summaryHtml + '</div>' + dayRowsHtml + '</div>';
    }

    el.innerHTML = html;
    if (typeof reconcileVisiblePlanSummaries === 'function') reconcileVisiblePlanSummaries();
    if (typeof renderMealPrepSuggestions === 'function') renderMealPrepSuggestions();
    if (typeof renderPlanHistoryPanel === 'function') renderPlanHistoryPanel();
    const setup = document.getElementById('plan-setup-card');
    if (setup) setup.style.display = '';
    const actions = document.getElementById('plan-actions');
    if (actions) actions.style.display = hasValidSlots ? 'block' : 'none';
    if (typeof updatePlannerCompactHeader === 'function') updatePlannerCompactHeader();
  } catch (err) {
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

export function toggleSlotVariant(day, slotKey) {
  const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(window.state.plan?.slots?.[day]?.[slotKey]) : { recipe: null };
  if (!info.recipe) return;
  const currentVariant = info.variant || 'original';
  const newVariant = currentVariant === 'enhanced' ? 'original' : 'enhanced';
  
  window.state.plan.slots[day][slotKey] = typeof makePlanSlot === 'function' ? makePlanSlot(info.id, newVariant) : { id: info.id, variant: newVariant };
  const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
  window.state.plan.productSelections = typeof lockProductSelectionsForSlots === 'function' ? lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
  window.state.plan.score = typeof calculatePlanScore === 'function' ? calculatePlanScore(window.state.plan) : 0;
  if (typeof saveState === 'function') saveState();
  renderPlan();
  if (typeof showPlatePlanToast === 'function') showPlatePlanToast(`Switched to ${newVariant === 'enhanced' ? '✨ Enhanced' : 'Original'} variant for ${info.recipe.name}`);
}

export function prioritiseAllPlannedEnhancedRecipes() {
  if (!window.state.plan?.slots) return typeof showPlatePlanToast === 'function' ? showPlatePlanToast('No active meal plan to prioritise.') : null;
  let upgradedCount = 0;
  
  Object.entries(window.state.plan.slots).forEach(([day, daySlots]) => {
    Object.entries(daySlots || {}).forEach(([slotKey, slotVal]) => {
      if (!slotVal) return;
      const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(slotVal) : { recipe: null };
      if (!info.recipe || info.variant === 'enhanced') return;
      const r = info.recipe;
      const hasEnhanced = r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
      if (hasEnhanced) {
        window.state.plan.slots[day][slotKey] = typeof makePlanSlot === 'function' ? makePlanSlot(info.id, 'enhanced') : { id: info.id, variant: 'enhanced' };
        upgradedCount++;
      }
    });
  });
  
  if (upgradedCount > 0) {
    const priority = window.state.plan.productPriority || window.state.prefs?.productPriority || 'protein';
    window.state.plan.productSelections = typeof lockProductSelectionsForSlots === 'function' ? lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
    window.state.plan.score = typeof calculatePlanScore === 'function' ? calculatePlanScore(window.state.plan) : 0;
    if (typeof saveState === 'function') saveState();
    renderPlan();
    if (typeof showPlatePlanToast === 'function') showPlatePlanToast(`✨ Prioritised ${upgradedCount} meal(s) to Enhanced variants for better fit scores!`);
  } else {
    if (typeof showPlatePlanToast === 'function') showPlatePlanToast('All eligible meals in your plan are already using Enhanced variants.');
  }
}

export function openPlannedMealActions(day, slotKey) {
  const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(window.state.plan?.slots?.[day]?.[slotKey]) : { recipe: null };
  if (!info.active && !info.recipe) return typeof showPlatePlanToast === 'function' ? showPlatePlanToast('That planned meal is no longer available.') : null;
  const r = info.recipe;
  const hasEnhanced = r && r.enhanced && ((r.enhanced.ingredients && r.enhanced.ingredients.length) || (r.enhanced.method && r.enhanced.method.length) || (r.enhanced.steps && r.enhanced.steps.length) || r.enhanced.name || r.enhanced.changes || r.enhancedPortions);
  const isEnhanced = info.variant === 'enhanced';

  const actions = [];
  if (hasEnhanced) {
    if (isEnhanced) {
      actions.push({
        label: '🔄 Switch to Original variant',
        onclick: `toggleSlotVariant(${+day},'${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(slotKey) : slotKey}')`
      });
    } else {
      actions.push({
        label: '✨ Switch to Enhanced variant (Higher Protein)',
        onclick: `toggleSlotVariant(${+day},'${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(slotKey) : slotKey}')`
      });
    }
  }
  actions.push({
    label: 'Review recipe & portions',
    onclick: `reviewRecipeModalView('${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(info.id) : info.id}','${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(info.instanceId || '') : (info.instanceId || '')}','${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(info.variant || 'original') : (info.variant || 'original')}')`
  });
  actions.push({
    label: 'Swap / Choose different meal',
    onclick: `openSwapMealModal(${+day},'${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(slotKey) : slotKey}')`
  });
  actions.push({
    label: 'Reschedule meal',
    onclick: `openPlanReschedule(${+day},'${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(slotKey) : slotKey}')`
  });
  actions.push({
    label: 'Clear slot',
    onclick: `swapSlot(${+day},'${typeof ppEscapeAttr === 'function' ? ppEscapeAttr(slotKey) : slotKey}',null)`
  });

  if (typeof openMobileActionSheet === 'function') {
    openMobileActionSheet(info.active?.name || info.recipe?.name || 'Planned meal', actions);
  }
}

export function swapSlot(day, slot, id) {
  if (!window.state.plan.slots[day]) window.state.plan.slots[day] = {};
  let swappedName = '';
  const mealType = slot.includes('breakfast') ? 'breakfast' : slot.includes('lunch') ? 'lunch' : 'dinner';
  const slotMealMode = typeof getSlotMealMode === 'function' ? getSlotMealMode(day, mealType) : 'both';
  const counterpartKey = typeof getPlanSlotCounterpartKey === 'function' ? getPlanSlotCounterpartKey(slot) : null;
  const isDualView = slotMealMode === 'both' || (document.getElementById('filter-who')?.value === 'both') || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');

  if (id) {
    const parsed = typeof parsePlanRecipeValue === 'function' ? parsePlanRecipeValue(id) : { id, variant: 'original' };
    window.state.plan.slots[day][slot] = typeof makePlanSlot === 'function' ? makePlanSlot(parsed.id, parsed.variant) : { id: parsed.id, variant: parsed.variant };
    if (typeof setPlanSlotReason === 'function') setPlanSlotReason(day, slot, '');
    if (isDualView && counterpartKey) {
      window.state.plan.slots[day][counterpartKey] = typeof makePlanSlot === 'function' ? makePlanSlot(parsed.id, parsed.variant) : { id: parsed.id, variant: parsed.variant };
      if (typeof setPlanSlotReason === 'function') setPlanSlotReason(day, counterpartKey, '');
    }
    const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(window.state.plan.slots[day][slot]) : { active: null };
    swappedName = info?.active?.name || info?.recipe?.name || '';
  } else {
    window.state.plan.slots[day][slot] = null;
    if (typeof setPlanSlotReason === 'function') setPlanSlotReason(day, slot, '');
    if (isDualView && counterpartKey) {
      window.state.plan.slots[day][counterpartKey] = null;
      if (typeof setPlanSlotReason === 'function') setPlanSlotReason(day, counterpartKey, '');
    }
  }
  const priority = window.state.plan.productPriority || window.state.prefs.productPriority || 'protein';
  window.state.plan.productSelections = typeof lockProductSelectionsForSlots === 'function' ? lockProductSelectionsForSlots(window.state.plan.slots, priority) : {};
  window.state.plan.productPriority = priority;
  window.state.plan.confirmedShopping = false;
  window.state.plan.mealPrepGroups = [];
  window.state.plan.declinedMealPrepGroups = [];
  window.state.plan.score = typeof calculatePlanScore === 'function' ? calculatePlanScore(window.state.plan) : 0;
  if (typeof saveState === 'function') saveState();
  renderPlan();
  const toastMsg = swappedName 
    ? (isDualView ? `Assigned ${swappedName} for Elliott & Chloe` : `Swapped meal to ${swappedName}`)
    : (isDualView ? 'Meal slots cleared for Elliott & Chloe' : 'Meal slot cleared');
  if (typeof showPlatePlanToast === 'function') showPlatePlanToast(toastMsg);
}

let currentSwapModalContext = null;
let currentSwapModalFilter = 'all';

export function openSwapMealModal(day, slotKey) {
  const dayNum = +day;
  const slotInfo = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo(window.state.plan?.slots?.[dayNum]?.[slotKey]) : { active: null, id: null, variant: 'original' };
  const mealType = slotKey.includes('breakfast') ? 'breakfast' : slotKey.includes('lunch') ? 'lunch' : 'dinner';
  const slotMealMode = typeof getSlotMealMode === 'function' ? getSlotMealMode(dayNum, mealType) : 'both';
  const filterWhoVal = document.getElementById('filter-who')?.value;
  const isDualView = slotMealMode === 'both' || filterWhoVal === 'both' || (window.activeHouseholdId && slotMealMode !== 'elliott' && slotMealMode !== 'chloe');
  const who = isDualView ? 'both' : (slotKey.endsWith('E') ? 'Elliott' : slotKey.endsWith('C') ? 'Chloe' : 'any');
  const dayLabel = typeof formatPlanDayLabel === 'function' ? formatPlanDayLabel(window.state.plan, dayNum, { short: true }) : `Day ${dayNum}`;
  const typeTitle = typeof toTitleCase === 'function' ? toTitleCase(mealType) : mealType;

  const options = typeof getPlannerRecipeOptions === 'function' ? getPlannerRecipeOptions(mealType, who === 'both' ? 'any' : who) : [];
  const curValue = slotInfo.id ? slotInfo.id + (slotInfo.variant === 'enhanced' ? '::enhanced' : '') : '';

  const isBoth = who === 'both';
  const personKey = isBoth ? 'both' : (String(who || '').toLowerCase().startsWith('c') ? 'c' : 'e');
  const items = options.map(opt => {
    const value = opt.id + (opt.variant === 'enhanced' ? '::enhanced' : '');
    let cal = 0, prot = 0, serves = 0, ingredientsText = '', fitRes = null;
    try {
      const info = typeof getPlanSlotInfo === 'function' ? getPlanSlotInfo({ id: opt.id, variant: opt.variant }) : { recipe: null };
      if (info.recipe) {
        serves = info.recipe.serves || 0;
        ingredientsText = (info.recipe.ingredients || []).map(i => i.name || i.ingredient || '').join(' ');
        const bundle = typeof calculateRecipeDisplayNutrition === 'function' ? calculateRecipeDisplayNutrition({ recipe: info.recipe, variant: info.variant, mealType }) : null;
        const portions = bundle?.portions || null;
        fitRes = typeof calculateMacroFitTierAndScore === 'function' ? calculateMacroFitTierAndScore({ recipe: info.recipe, variant: info.variant, portions }, mealType) : null;
        if (isBoth) {
          cal = Math.round(((portions?.eCal || 0) + (portions?.cCal || 0)) / 2);
          prot = typeof round1 === 'function' ? round1(((portions?.eProt || 0) + (portions?.cProt || 0)) / 2) : 0;
        } else {
          cal = personKey === 'c' ? (portions?.cCal || 0) : (portions?.eCal || 0);
          prot = personKey === 'c' ? (portions?.cProt || 0) : (portions?.eProt || 0);
        }
      }
    } catch (e) {
      console.warn('Error calculating recipe nutrition for option:', e);
    }
    const rec = (window.state.recipes || []).find(r => r.id === opt.id);
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
      prot: typeof round1 === 'function' ? round1(prot || 0) : prot,
      serves,
      ingredientsText,
      fitScore: fitRes?.score ?? 0,
      fitColor: fitRes?.color ?? '#10B981',
      fitLabel: fitRes?.label ?? 'Fit',
      searchHaystack: `${opt.label} ${opt.variant || ''} ${Math.round(cal || 0)}kcal ${typeof round1 === 'function' ? round1(prot || 0) : prot}g ${ingredientsText}`.toLowerCase()
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
        <h3 style="margin:0;font-size:17px;font-weight:700;color:var(--text)">Swap Meal — ${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(dayLabel) : dayLabel}</h3>
        <div style="font-size:12px;color:var(--text2);margin-top:2px">${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(who === 'both' ? 'Shared (Elliott & Chloe)' : who + "'s") : who} ${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(typeTitle) : typeTitle}</div>
      </div>
      <button class="btn sm ghost" onclick="closeSwapMealModal()" aria-label="Close modal" style="font-size:16px;padding:4px 10px">✕</button>
    </div>

    ${curRecipeName ? `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex-shrink:0">
        <div>
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Currently Planned</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-top:1px">${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(curRecipeName) : curRecipeName} ${slotInfo.variant === 'enhanced' ? '<span class="tag green">Enhanced</span>' : ''}</div>
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

export function setSwapModalFilter(filterType) {
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

export function selectSwapModalRecipe(value) {
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

export function confirmSwapMealModal() {
  if (!currentSwapModalContext || !currentSwapModalContext.selectedRecipeValue) return;
  const { day, slotKey, selectedRecipeValue } = currentSwapModalContext;
  executeSwapSlotAndClose(day, slotKey, selectedRecipeValue);
}

export function renderSwapModalOptionsList() {
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
  filtered = typeof getSortedRecipes === 'function' ? getSortedRecipes(filtered, sortOption, targetSlot) : filtered;

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">
      No matching recipes found for "${typeof ppEscapeHtml === 'function' ? ppEscapeHtml(rawQuery) : rawQuery}".
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

    const valAttr = typeof ppEscapeAttr === 'function' ? ppEscapeAttr(item.value) : item.value;
    const labelHtml = typeof ppEscapeHtml === 'function' ? ppEscapeHtml(item.label) : item.label;
    const idAttr = typeof ppEscapeAttr === 'function' ? ppEscapeAttr(item.id) : item.id;
    const varAttr = typeof ppEscapeAttr === 'function' ? ppEscapeAttr(item.variant || 'original') : (item.variant || 'original');

    return `<div class="swap-modal-item ${isFav ? 'is-favorite' : ''} ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}" data-value="${valAttr}" onclick="selectSwapModalRecipe('${valAttr}')" ondblclick="executeSwapSlotAndClose(${currentSwapModalContext.day}, '${currentSwapModalContext.slotKey}', '${valAttr}')">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>${labelHtml}</span>
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
        <button type="button" class="recipe-fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleRecipeFavourite('${idAttr}', event, '${varAttr}'); if(currentSwapModalContext) { currentSwapModalContext.items.forEach(it => { if(it.id === '${idAttr}') { it.isFavourite = !it.isFavourite; it.isFavorite = it.isFavourite; } }); renderSwapModalOptionsList(); }" aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}" title="${isFav ? 'Favourited' : 'Add to favourites'}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </button>
        <button class="btn sm ${isSelected ? 'primary' : 'ghost'}" type="button" onclick="event.stopPropagation(); selectSwapModalRecipe('${valAttr}');">
          ${isSelected ? 'Selected ✓' : 'Select'}
        </button>
      </div>
    </div>`;
  }).join('');
}

export function executeSwapSlotAndClose(day, slotKey, value) {
  swapSlot(day, slotKey, value);
  closeSwapMealModal();
}

export function closeSwapMealModal() {
  const wrap = document.getElementById('swap-meal-modal-wrap');
  if (wrap) wrap.classList.remove('open');
  currentSwapModalContext = null;
}

export function quickRandomizeSwap(day, slotKey) {
  if (!currentSwapModalContext || !currentSwapModalContext.items.length) return;
  const items = currentSwapModalContext.items;
  const randomIndex = Math.floor(Math.random() * items.length);
  const picked = items[randomIndex];
  executeSwapSlotAndClose(day, slotKey, picked.value);
}

export function clearPlan() {
  window.state.plan = {};
  window.state.overrides = {};
  window.state.plannerStep = 1;
  if (typeof platePlanEarlierDaysExpanded !== 'undefined') platePlanEarlierDaysExpanded = false;
  if (typeof saveState === 'function') saveState();
  const content = document.getElementById('plan-content'); if (content) content.innerHTML = '';
  const warnings = document.getElementById('plan-warnings'); if (warnings) warnings.innerHTML = '';
  const overall = document.getElementById('plan-overall-summary'); if (overall) overall.innerHTML = '';
  const prep = document.getElementById('plan-meal-prep-panel'); if (prep) prep.innerHTML = '';
  const setup = document.getElementById('plan-setup-card'); if (setup) setup.style.display = '';
  const actions = document.getElementById('plan-actions'); if (actions) actions.style.display = 'none';
  if (typeof renderPlanHistoryPanel === 'function') renderPlanHistoryPanel();
  if (typeof updatePlannerCompactHeader === 'function') updatePlannerCompactHeader();
  renderPlannerWizard();
}

export function showPlanSetup() {
  if (typeof ensurePlannerShell === 'function') ensurePlannerShell();
  if (typeof openPlanOptionsWorkspace === 'function') openPlanOptionsWorkspace();
}

export function renderPlanOverallSummary() {
  const el = document.getElementById('plan-overall-summary');
  if (!el || !window.state.plan?.slots) { if (el) el.innerHTML = ''; return; }
  if (document.querySelector('#plan-content .day-plan-card:not(.skipped)')) {
    if (typeof reconcileVisiblePlanSummaries === 'function') reconcileVisiblePlanSummaries();
    return;
  }
  const score = typeof calculatePlanScore === 'function' ? calculatePlanScore(window.state.plan) : 0;
  window.state.plan.score = score;
  if (typeof renderPlanOverallSummaryHtml === 'function') renderPlanOverallSummaryHtml(score);
}

// Bind Global Aliases for Action Bridge and Legacy Compatibility
if (typeof window !== 'undefined') {
  console.log('[PlannerView v3.8.1] Initializing PlannerView & recipe modal aliases...');
  window.renderPlanner = renderPlanner;
  window.renderPlannerWizard = renderPlannerWizard;
  window.renderPlan = renderPlan;
  window.toggleSlotVariant = toggleSlotVariant;
  window.prioritiseAllPlannedEnhancedRecipes = prioritiseAllPlannedEnhancedRecipes;
  window.openPlannedMealActions = openPlannedMealActions;
  window.swapSlot = swapSlot;
  window.openSwapMealModal = openSwapMealModal;
  window.setSwapModalFilter = setSwapModalFilter;
  window.selectSwapModalRecipe = selectSwapModalRecipe;
  window.confirmSwapMealModal = confirmSwapMealModal;
  window.renderSwapModalOptionsList = renderSwapModalOptionsList;
  window.executeSwapSlotAndClose = executeSwapSlotAndClose;
  window.closeSwapMealModal = closeSwapMealModal;
  window.quickRandomizeSwap = quickRandomizeSwap;
  window.clearPlan = clearPlan;
  window.showPlanSetup = showPlanSetup;
  window.renderPlanOverallSummary = renderPlanOverallSummary;

  window.openRecipeModal = function(id, instanceId, variant) {
    if (typeof window.viewRecipe === 'function') return window.viewRecipe(id, instanceId, variant);
    console.warn('[PlannerView v3.8.1] viewRecipe not found on window');
  };
  window.showRecipeModal = window.openRecipeModal;
  window.openRecipeDetailModal = window.openRecipeModal;
}

import { subscribe, getState } from '../store/store.js';

let plannerUnsub = null;

export function mount(container) {
  if (typeof renderPlanner === 'function') {
    renderPlanner();
  }
  plannerUnsub = subscribe('plan', (plan) => {
    if (typeof renderPlanner === 'function') {
      renderPlanner();
    }
  });
}

export function unmount() {
  if (typeof plannerUnsub === 'function') {
    plannerUnsub();
    plannerUnsub = null;
  }
}
