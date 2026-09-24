/**
 * scripts/utils/planner-calc.js
 * Pure mathematical, scoring, meal prep, and exclusion evaluation functions for meal planning.
 */
(function() {
  'use strict';

  window.PlatePlanPlanner = window.PlatePlanPlanner || {};

  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function calculatePlanScore(plan = getState().plan) {
    const days = plan?.days || 0;
    const dayScores = [];
    const totals = { e: { cal: 0, prot: 0, days: 0 }, c: { cal: 0, prot: 0, days: 0 } };
    const getPlanDaySummaryFn = window.PlatePlanPlanner?.getPlanDaySummary || window.getPlanDaySummary || (() => ({ score: 0, totals: { e: { cal: 0, prot: 0 }, c: { cal: 0, prot: 0 } } }));
    for (let d = 1; d <= days; d++) {
      const s = getPlanDaySummaryFn(d, plan);
      dayScores.push(s.score);
      ['e', 'c'].forEach(p => {
        if (s.totals[p].cal || s.totals[p].prot) {
          totals[p].cal += s.totals[p].cal;
          totals[p].prot += s.totals[p].prot;
          totals[p].days++;
        }
      });
    }
    return {
      score: dayScores.length ? Math.round(dayScores.reduce((a, b) => a + b, 0) / dayScores.length) : 0,
      eAvg: { cal: totals.e.days ? Math.round(totals.e.cal / totals.e.days) : 0, prot: totals.e.days ? Math.round(totals.e.prot * 10 / totals.e.days) / 10 : 0 },
      cAvg: { cal: totals.c.days ? Math.round(totals.c.cal / totals.c.days) : 0, prot: totals.c.days ? Math.round(totals.c.prot * 10 / totals.c.days) / 10 : 0 }
    };
  }

  function calculatePlanDayScoreFromTotals(totals) {
    const stateObj = getState();
    const eTgt = { cal: +(stateObj.prefs?.ecal) || 0, prot: +(stateObj.prefs?.eprot) || 0 };
    const cTgt = { cal: +(stateObj.prefs?.ccal) || 0, prot: +(stateObj.prefs?.cprot) || 0 };
    const miss = (actual, target, protein = false) => {
      if (!target) return 0;
      const pct = ((actual - target) / target) * 100;
      return protein ? Math.max(0, -pct) : Math.abs(pct);
    };
    return Math.round(
      miss(totals.e.cal, eTgt.cal) +
      miss(totals.c.cal, cTgt.cal) +
      miss(totals.e.prot, eTgt.prot, true) +
      miss(totals.c.prot, cTgt.prot, true)
    );
  }

  function fmtPlanDelta(delta, unit = '') {
    const d = Math.round(delta);
    const sign = d > 0 ? '+' : '';
    return `${sign}${d}${unit}`;
  }

  function planDeltaColor(pct) {
    const abs = Math.abs(pct);
    if (abs <= 10) return 'var(--green)';
    if (abs <= 15) return 'var(--amber)';
    return 'var(--red)';
  }

  function parsePlannerVisibleMacro(text) {
    const m = String(text || '').match(/([0-9]+(?:\.[0-9]+)?)\s*kcal\s*\/\s*P\s*([0-9]+(?:\.[0-9]+)?)\s*g/i);
    return m ? { cal: +m[1] || 0, prot: +m[2] || 0 } : null;
  }

  function mealPrepPeopleKey(entries) {
    return (entries || []).map(entry => entry.person).sort().join('+') || 'none';
  }

  function mealPrepIdentityKey(group) {
    const primary = group?.entries?.[0];
    if (!primary) return '';
    return [
      group.meal?.key || '',
      primary.slotInfo.id || '',
      primary.slotInfo.variant || 'original',
      mealPrepPeopleKey(group.entries)
    ].join('|');
  }

  function mealPrepSuggestionKey(group) {
    return [
      'mp',
      group.mealKey,
      group.recipeId,
      group.variant || 'original',
      group.peopleKey,
      (group.days || []).join('-')
    ].join('|');
  }

  function formatMealPrepDays(group, planContext = getState().plan) {
    const formatPlanDayLabelFn = window.PlatePlanPlanner?.formatPlanDayLabel || window.formatPlanDayLabel || ((ctx, d) => `Day ${d}`);
    return (group.days || []).map(day => `${formatPlanDayLabelFn(planContext, day)} ${group.mealLabel || ''}`.trim()).join(', ');
  }

  function getUseUpAvailableAmount(entry) {
    if (!entry || !(entry.quantity > 0) || entry.unit === 'unknown') return null;
    const getProductUsablePackAmountFn = window.PlatePlanIngredients?.getProductUsablePackAmount || window.getProductUsablePackAmount || (() => 0);
    const getProductItemAmountFn = window.PlatePlanIngredients?.getProductItemAmount || window.getProductItemAmount || (() => 0);
    if (entry.unit === 'pack') return entry.quantity * getProductUsablePackAmountFn(entry.product);
    if (entry.unit === 'item') return entry.quantity * getProductItemAmountFn(entry.product);
    return entry.quantity;
  }

  function getRecipeUseUpCoverage(option, productIds = null) {
    const active = option?.variant === 'enhanced' && option.recipe?.enhanced ? { ...option.recipe, ...option.recipe.enhanced, ingredients: option.recipe.enhanced.ingredients || [] } : option?.recipe;
    if (!active) return { matches: [], matchedCount: 0, otherIngredients: 0, score: 0 };
    const allowed = productIds ? new Set(productIds) : null;
    const getUseUpEntriesFn = window.PlatePlanPlanner?.getUseUpEntries || window.getUseUpEntries || (() => []);
    const entries = getUseUpEntriesFn().filter(entry => !allowed || allowed.has(entry.productId));
    const signature = JSON.stringify([active.id || option.id, option.variant || 'original', active.ingredients, entries.map(e => [e.productId, e.quantity, e.unit])]);
    const cache = window.PlatePlanPlanner?.State?.useUpCoverageCache || (window.platePlanUseUpCoverageCache = window.platePlanUseUpCoverageCache || new Map());
    if (cache.has(signature)) return cache.get(signature);

    const matches = [];
    const matchedIngredientKeys = new Set();
    const getRecipeIngredientGroupIdFn = window.PlatePlanIngredients?.getRecipeIngredientGroupId || window.getRecipeIngredientGroupId || (() => null);
    const getEffectiveIngredientGramsFn = window.PlatePlanIngredients?.getEffectiveIngredientGrams || window.getEffectiveIngredientGrams || (() => 0);

    (active.ingredients || []).forEach((ing, index) => {
      const groupId = getRecipeIngredientGroupIdFn(ing);
      if (entryGroupMatch(entryMatches => entryMatches, entry => entry.product?.groupId && groupId === entry.product.groupId)) {
        // inline search
      }
    });

    entries.forEach(entry => {
      let used = 0;
      (active.ingredients || []).forEach((ing, index) => {
        const groupId = getRecipeIngredientGroupIdFn(ing);
        if (entry.product?.groupId && groupId === entry.product.groupId) {
          used += getEffectiveIngredientGramsFn(ing, entry.product);
          matchedIngredientKeys.add(index);
        }
      });
      if (used > 0) {
        const available = getUseUpAvailableAmount(entry);
        matches.push({ productId: entry.productId, product: entry.product, used, available, remainder: available == null ? null : Math.max(0, available - used) });
      }
    });

    const knownUtilisation = matches.reduce((sum, row) => sum + (row.available > 0 ? Math.min(row.used, row.available) / row.available : 0), 0);
    const result = {
      matches,
      matchedCount: matches.length,
      otherIngredients: Math.max(0, (active.ingredients || []).length - matchedIngredientKeys.size),
      score: matches.length * 100 + knownUtilisation * 35 - Math.max(0, (active.ingredients || []).length - matchedIngredientKeys.size)
    };
    cache.set(signature, result);
    return result;
  }

  function entryGroupMatch(fn, pred) {
    return false;
  }

  function normaliseExclusionList(list) {
    return (list || []).map(x => typeof x === 'string' ? { name: x } : x).filter(x => (x.name || x.id));
  }

  function recipeMatchesExclusion(recipe, exclusion) {
    const normaliseAliasTextFn = window.PlatePlanIngredients?.normaliseAliasText || window.normaliseAliasText || (t => String(t || '').trim().toLowerCase());
    const resolveProductForIngredientFn = window.PlatePlanIngredients?.resolveProductForIngredient || window.resolveProductForIngredient || (() => ({ group: null, product: null }));
    const needle = normaliseAliasTextFn(exclusion.name || '');
    const ids = [exclusion.id, exclusion.groupId, exclusion.productId].filter(Boolean);
    const checkIng = ing => {
      const resolved = resolveProductForIngredientFn(ing);
      const hay = normaliseAliasTextFn([ing.raw, ing.name, resolved.group?.name, resolved.product?.name, resolved.product?.brand].filter(Boolean).join(' '));
      if (needle && hay.includes(needle)) return true;
      return ids.includes(ing.groupId) || ids.includes(ing.bankId) || ids.includes(resolved.groupId) || ids.includes(resolved.productId);
    };
    return (recipe.ingredients || []).some(checkIng) || (recipe.enhanced?.ingredients || []).some(checkIng);
  }

  function recipeAllowedForPerson(recipe, who) {
    const getExclusionsForPersonFn = window.PlatePlanPlanner?.getExclusionsForPerson || window.getExclusionsForPerson || (() => []);
    return !getExclusionsForPersonFn(who).some(ex => recipeMatchesExclusion(recipe, ex));
  }

  function getUsedRecipeIdsFromHistory(history = getState().planHistory, limit = 4) {
    const used = new Map();
    const getPlanSlotInfoFn = window.PlatePlanPlanner?.getPlanSlotInfo || window.getPlanSlotInfo || (() => ({ id: null }));
    (history || []).slice(0, limit).forEach((plan, histIndex) => {
      Object.values(plan.slots || {}).forEach(day => Object.values(day || {}).forEach(slot => {
        const info = getPlanSlotInfoFn(slot);
        if (info.id && !used.has(info.id)) used.set(info.id, histIndex);
      }));
    });
    return used;
  }

  function getPlanRecipeIds(plan = getState().plan) {
    const ids = new Set();
    const getPlanSlotInfoFn = window.PlatePlanPlanner?.getPlanSlotInfo || window.getPlanSlotInfo || (() => ({ id: null }));
    Object.values(plan?.slots || {}).forEach(day => Object.values(day || {}).forEach(slot => {
      const info = getPlanSlotInfoFn(slot);
      if (info.id) ids.add(info.id);
    }));
    return [...ids];
  }

  const exportsObj = {
    calculatePlanScore,
    calculatePlanDayScoreFromTotals,
    fmtPlanDelta,
    planDeltaColor,
    parsePlannerVisibleMacro,
    mealPrepPeopleKey,
    mealPrepIdentityKey,
    mealPrepSuggestionKey,
    formatMealPrepDays,
    getUseUpAvailableAmount,
    getRecipeUseUpCoverage,
    normaliseExclusionList,
    recipeMatchesExclusion,
    recipeAllowedForPerson,
    getUsedRecipeIdsFromHistory,
    getPlanRecipeIds
  };

  Object.assign(window.PlatePlanPlanner, exportsObj);
  if (typeof window !== 'undefined') {
    Object.assign(window, exportsObj);
  }
})();
