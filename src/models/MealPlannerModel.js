/**
 * src/models/MealPlannerModel.js (v3.19.78)
 * Domain Model & Payload Sanitiser for Household Meal Plans & Split Skeleton Grids.
 * Enforces lightweight Firestore payloads by stripping heavy recipe/product fields.
 */

const FORBIDDEN_PLAN_KEYS = new Set([
  'recipeName', 'image', 'ingredients', 'instructions', 'subtypes',
  'products', 'recipes', 'categories', 'userPrefs', 'preferences',
  'settings', 'shoppingList', 'overrides', 'active', 'recipe', 'nutrition'
]);

/**
 * Sanitises a single meal slot or split household node (Elliott / Chloe),
 * retaining only core identifiers: isSkipped, isSplit, recipeId, and locked/pinned.
 */
export function sanitizeSlotNode(node) {
  if (!node || typeof node !== 'object') return null;

  const clean = {
    isSkipped: Boolean(node.isSkipped || node.skipped || node.status === 'skipped'),
    isSplit: Boolean(node.isSplit || node.status === 'split')
  };

  const recipeId = node.recipeId || node.id || null;
  if (recipeId && !clean.isSkipped) {
    clean.recipeId = String(recipeId);
    clean.id = String(recipeId);
  }

  if (node.variant) clean.variant = String(node.variant);
  if (node.instanceId) clean.instanceId = String(node.instanceId);
  if (node.locked !== undefined) clean.locked = Boolean(node.locked);
  if (node.pinned !== undefined || node.isPinned !== undefined || node.status === 'pinned') {
    clean.pinned = Boolean(node.pinned || node.isPinned || node.status === 'pinned');
    clean.isPinned = clean.pinned;
  }
  if (node.status) clean.status = String(node.status);

  if (node.elliott && typeof node.elliott === 'object') {
    clean.elliott = sanitizeSlotNode(node.elliott);
  }
  if (node.chloe && typeof node.chloe === 'object') {
    clean.chloe = sanitizeSlotNode(node.chloe);
  }

  // Explicitly delete forbidden heavy properties
  FORBIDDEN_PLAN_KEYS.forEach(k => delete clean[k]);
  return clean;
}

/**
 * Returns a clean, empty meal plan schema with no recipe attachments.
 */
export function createCleanEmptyPlanSchema(daysOverride = null) {
  const days = Number(daysOverride || (typeof window !== 'undefined' ? window.state?.plannerDays : 7) || 7);
  return {
    days,
    startDate: '',
    dayDates: {},
    slots: {},
    skeletonGrid: {},
    mealPrepGroups: []
  };
}

/**
 * Sanitises a meal plan payload prior to Firestore persistence (setDoc / updateDoc).
 * Iterates through days and slots (Breakfast, Lunch, Dinner) including split elliott/chloe nodes,
 * retaining only core identifiers and stripping recipeName, image, ingredients, instructions, and subtypes.
 */
export function stripPlanPayload(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') {
    return createCleanEmptyPlanSchema();
  }

  const isFullStateWrapper = Boolean(
    rawInput.recipes || rawInput.ingredients || rawInput.products || rawInput.plannerStep !== undefined
  );
  const planData = (isFullStateWrapper && rawInput.plan && typeof rawInput.plan === 'object')
    ? rawInput.plan
    : rawInput;

  const rawSkeleton = rawInput.skeletonGrid
    || planData.skeletonGrid
    || (typeof window !== 'undefined' ? window.state?.skeletonGrid : {})
    || {};

  const cleanSlots = {};
  const rawSlots = (planData.slots && typeof planData.slots === 'object') ? planData.slots : {};

  Object.keys(rawSlots).forEach(dayKey => {
    const dayObj = rawSlots[dayKey];
    if (!dayObj || typeof dayObj !== 'object') return;
    cleanSlots[dayKey] = {};
    Object.keys(dayObj).forEach(mealKey => {
      const slotVal = dayObj[mealKey];
      if (!slotVal) return;
      if (typeof slotVal === 'string') {
        cleanSlots[dayKey][mealKey] = {
          recipeId: slotVal,
          id: slotVal,
          isSkipped: false,
          isSplit: false,
          pinned: false
        };
      } else if (typeof slotVal === 'object') {
        const sanitized = sanitizeSlotNode(slotVal);
        if (sanitized) cleanSlots[dayKey][mealKey] = sanitized;
      }
    });
  });

  const cleanSkeleton = {};
  if (rawSkeleton && typeof rawSkeleton === 'object') {
    Object.keys(rawSkeleton).forEach(key => {
      const val = rawSkeleton[key];
      if (!val || typeof val !== 'object') return;
      if (val.breakfast || val.lunch || val.dinner) {
        cleanSkeleton[key] = {};
        ['breakfast', 'lunch', 'dinner'].forEach(meal => {
          if (val[meal] && typeof val[meal] === 'object') {
            const sanitized = sanitizeSlotNode(val[meal]);
            if (sanitized) cleanSkeleton[key][meal] = sanitized;
          }
        });
      } else {
        const sanitized = sanitizeSlotNode(val);
        if (sanitized) cleanSkeleton[key] = sanitized;
      }
    });
  }

  const cleanPrepGroups = Array.isArray(planData.mealPrepGroups)
    ? planData.mealPrepGroups.map(g => ({
        id: String(g.id || ''),
        recipeId: String(g.recipeId || ''),
        mealType: String(g.mealType || ''),
        days: Array.isArray(g.days) ? g.days.map(Number) : [],
        servings: Number(g.servings || 0)
      }))
    : [];

  const sanitizedPlan = {
    days: Number(planData.days || rawInput.plannerDays || 7),
    startDate: String(planData.startDate || rawInput.plannerStartDate || ''),
    dayDates: (planData.dayDates && typeof planData.dayDates === 'object') ? { ...planData.dayDates } : {},
    slots: cleanSlots,
    skeletonGrid: cleanSkeleton,
    mealPrepGroups: cleanPrepGroups
  };

  FORBIDDEN_PLAN_KEYS.forEach(k => delete sanitizedPlan[k]);
  return sanitizedPlan;
}
