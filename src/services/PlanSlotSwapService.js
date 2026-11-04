/**
 * src/services/PlanSlotSwapService.js
 * Domain logic for swapping meal slots between plan days (e.g. swap Monday Dinner with Friday Dinner).
 * Strictly preserves serving multipliers, variant selections, and split person slots while resetting eaten ticks.
 */

/**
 * Deep clones a plan or JSON object.
 */
function cloneJson(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

/**
 * Swaps a specific meal slot (e.g. 'dinner', 'lunch', 'breakfast') between two days in an active meal plan.
 * Handles single-recipe slots, per-person slots (e.g. 'dinnerE' and 'dinnerC'), and split slot objects.
 * Resets marked-eaten status for both days on that mealType so the moved meals can be eaten on their new dates.
 *
 * @param {Object} plan - The active meal plan object.
 * @param {string|number} sourceDayKey - Key of the source day (e.g. '1' or 1).
 * @param {string|number} targetDayKey - Key of the destination day (e.g. '3' or 3).
 * @param {string} mealType - Type of meal to swap ('breakfast', 'lunch', 'dinner', 'snack').
 * @returns {{ success: boolean, plan?: Object, error?: string }}
 */
export function swapPlanMealSlots(plan, sourceDayKey, targetDayKey, mealType = 'dinner') {
  if (!plan || !plan.slots || typeof plan.slots !== 'object') {
    return { success: false, error: 'Invalid plan or missing slots' };
  }

  const srcKey = String(sourceDayKey);
  const tgtKey = String(targetDayKey);

  if (srcKey === tgtKey) {
    return { success: false, error: 'Source and target days must be different' };
  }

  const nextPlan = cloneJson(plan);
  nextPlan.slots = nextPlan.slots || {};
  const slots = nextPlan.slots;

  const srcDay = slots[srcKey] || {};
  const tgtDay = slots[tgtKey] || {};

  const cleanMealType = String(mealType).toLowerCase().trim();
  const keyE = `${cleanMealType}E`;
  const keyC = `${cleanMealType}C`;
  const keyMain = cleanMealType;

  // 1. Identify which keys exist for this meal on both days
  const srcHasPersonSlots = Boolean(srcDay[keyE] || srcDay[keyC]);
  const tgtHasPersonSlots = Boolean(tgtDay[keyE] || tgtDay[keyC]);

  // Extract source meal payload
  const srcPayload = {};
  if (srcHasPersonSlots) {
    if (srcDay[keyE]) srcPayload[keyE] = srcDay[keyE];
    if (srcDay[keyC]) srcPayload[keyC] = srcDay[keyC];
  } else if (srcDay[keyMain]) {
    srcPayload[keyMain] = srcDay[keyMain];
  }

  // Extract target meal payload
  const tgtPayload = {};
  if (tgtHasPersonSlots) {
    if (tgtDay[keyE]) tgtPayload[keyE] = tgtDay[keyE];
    if (tgtDay[keyC]) tgtPayload[keyC] = tgtDay[keyC];
  } else if (tgtDay[keyMain]) {
    tgtPayload[keyMain] = tgtDay[keyMain];
  }

  // Clean old keys from source day
  delete srcDay[keyMain];
  delete srcDay[keyE];
  delete srcDay[keyC];

  // Clean old keys from target day
  delete tgtDay[keyMain];
  delete tgtDay[keyE];
  delete tgtDay[keyC];

  // Place target payload into source day
  Object.assign(srcDay, tgtPayload);

  // Place source payload into target day
  Object.assign(tgtDay, srcPayload);

  slots[srcKey] = srcDay;
  slots[tgtKey] = tgtDay;

  // 2. Clear eaten ticks for both dates for this mealType
  if (nextPlan.eatenMeals && typeof nextPlan.eatenMeals === 'object') {
    const dayDates = nextPlan.dayDates || {};
    const srcDate = dayDates[srcKey];
    const tgtDate = dayDates[tgtKey];

    const datesToPurge = [srcDate, tgtDate].filter(Boolean);
    datesToPurge.forEach(dStr => {
      delete nextPlan.eatenMeals[`${dStr}:${cleanMealType}`];
      delete nextPlan.eatenMeals[`${dStr}:${cleanMealType}:e`];
      delete nextPlan.eatenMeals[`${dStr}:${cleanMealType}:c`];
    });
  }

  nextPlan.updatedAt = new Date().toISOString();

  return {
    success: true,
    plan: nextPlan
  };
}

export default {
  swapPlanMealSlots
};
