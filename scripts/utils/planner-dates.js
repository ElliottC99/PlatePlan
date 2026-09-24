/**
 * scripts/utils/planner-dates.js
 * Pure date, cycle, and slot coordinate parsing functions for meal planning.
 */
(function() {
  'use strict';

  window.PlatePlanPlanner = window.PlatePlanPlanner || {};

  const PLAN_SLOT_REASON_LABELS = {
    pinned: 'Pinned meal',
    repeat: 'Batch / multi-portion rollover',
    'use-up': 'Uses up priority ingredient',
    macro: 'Target macro balance',
    variety: 'Recipe variety',
    speed: 'Quick preparation time',
    other: 'Planner selection'
  };

  const getState = () => (typeof window !== 'undefined' && window.state) || (typeof state !== 'undefined' ? state : {});

  function getPlatePlanLocalToday() {
    return formatPlanLocalDateValue(new Date());
  }

  function parsePlanLocalDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(+match[1], +match[2] - 1, +match[3], 12, 0, 0, 0);
    return date.getFullYear() === +match[1] && date.getMonth() === +match[2] - 1 && date.getDate() === +match[3] ? date : null;
  }

  function formatPlanLocalDateValue(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function buildPlanDayDates(startDate, days) {
    const first = parsePlanLocalDate(startDate);
    if (!first) return {};
    const result = {};
    for (let day = 1; day <= (+days || 0); day++) {
      const date = new Date(first);
      date.setDate(first.getDate() + day - 1);
      result[day] = formatPlanLocalDateValue(date);
    }
    return result;
  }

  function formatPlanDayLabel(planContext, day, { short = false } = {}) {
    const base = `Day ${day}`;
    const date = parsePlanLocalDate(planContext?.dayDates?.[day]);
    if (!date) return base;
    const formatted = new Intl.DateTimeFormat('en-GB', short ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    return `${base} · ${formatted}`;
  }

  function getPlanDateRangeLabel(planContext) {
    const rows = Object.entries(planContext?.dayDates || {}).filter(([, value]) => parsePlanLocalDate(value)).sort((a, b) => +a[0] - +b[0]);
    if (!rows.length) return '';
    const first = formatPlanDayLabel(planContext, rows[0][0], { short: true }).replace(/^Day \d+ · /, '');
    const last = formatPlanDayLabel(planContext, rows[rows.length - 1][0], { short: true }).replace(/^Day \d+ · /, '');
    return first === last ? first : `${first} – ${last}`;
  }

  function validatePlanDayDates(dayDates) {
    const rows = Object.entries(dayDates || {}).filter(([, value]) => value).sort((a, b) => +a[0] - +b[0]);
    let previous = '';
    const seen = new Set();
    for (const [day, value] of rows) {
      if (!parsePlanLocalDate(value)) return `Day ${day} has an invalid date.`;
      if (seen.has(value)) return 'Each meal-plan day needs a different calendar date.';
      if (previous && value <= previous) return 'Calendar dates must follow the same order as the meal-plan days.';
      seen.add(value);
      previous = value;
    }
    return '';
  }

  function getMealTypeFromSlotKey(slotKey) {
    if (!slotKey) return '';
    const s = String(slotKey).toLowerCase();
    if (s.includes('breakfast') || s.startsWith('b')) return 'breakfast';
    if (s.includes('lunch') || s.startsWith('l')) return 'lunch';
    if (s.includes('dinner') || s.startsWith('d')) return 'dinner';
    if (s.includes('snack') || s.startsWith('s')) return 'snack';
    return '';
  }

  function parsePlanRecipeValue(value) {
    const text = String(value || '');
    if (text.endsWith('::enhanced')) return { id: text.slice(0, -10), variant: 'enhanced' };
    return { id: text, variant: 'original' };
  }

  function makePlanSlot(recipeId, variant = 'original') {
    const clean = parsePlanRecipeValue(recipeId);
    return {
      id: clean.id,
      instanceId: 'pm-' + Date.now() + Math.random().toString(36).substring(2, 7),
      ...(variant === 'enhanced' || clean.variant === 'enhanced' ? { variant: 'enhanced' } : {})
    };
  }

  function getPlanSlotReasonKey(day, slotKey) {
    return `${day}|${slotKey}`;
  }

  function formatPlanSlotReason(reason) {
    if (!reason) return '';
    const base = PLAN_SLOT_REASON_LABELS[reason.code] || PLAN_SLOT_REASON_LABELS.other;
    return reason.note ? (reason.code === 'other' ? reason.note : `${base} · ${reason.note}`) : base;
  }

  function getPlanSlotCounterpartKey(slotKey) {
    if (String(slotKey).endsWith('E')) return String(slotKey).slice(0, -1) + 'C';
    if (String(slotKey).endsWith('C')) return String(slotKey).slice(0, -1) + 'E';
    return '';
  }

  function planSlotsCanMoveTogether(day, slotKey) {
    const counterpartKey = getPlanSlotCounterpartKey(slotKey);
    const stateObj = getState();
    const getPlanSlotInfoFn = window.PlatePlanPlanner?.getPlanSlotInfo || window.getPlanSlotInfo || (() => ({ active: false }));
    const getTodayResolvedFingerprintFn = window.PlatePlanPlanner?.getTodayResolvedFingerprint || window.getTodayResolvedFingerprint || (() => '');
    const first = getPlanSlotInfoFn(stateObj.plan?.slots?.[day]?.[slotKey]);
    const second = getPlanSlotInfoFn(stateObj.plan?.slots?.[day]?.[counterpartKey]);
    const mealType = getMealTypeFromSlotKey(slotKey);
    return !!(first.active && second.active && getTodayResolvedFingerprintFn(first, mealType) === getTodayResolvedFingerprintFn(second, mealType));
  }

  const exportsObj = {
    PLAN_SLOT_REASON_LABELS,
    getPlatePlanLocalToday,
    parsePlanLocalDate,
    formatPlanLocalDateValue,
    buildPlanDayDates,
    formatPlanDayLabel,
    getPlanDateRangeLabel,
    validatePlanDayDates,
    getMealTypeFromSlotKey,
    parsePlanRecipeValue,
    makePlanSlot,
    getPlanSlotReasonKey,
    formatPlanSlotReason,
    getPlanSlotCounterpartKey,
    planSlotsCanMoveTogether
  };

  Object.assign(window.PlatePlanPlanner, exportsObj);
  if (typeof window !== 'undefined') {
    Object.assign(window, exportsObj);
  }
})();
