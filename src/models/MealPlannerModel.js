import { getState } from '../store/coreState.js';
import store from "../store/store.js";
/**
 * src/models/MealPlannerModel.js (v3.20.14)
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
 * Sanitises the Today view's eaten-meal ticks, keyed "YYYY-MM-DD:mealType" with an
 * optional ":e" (Elliott) or ":c" (Chloe) suffix. Only ticked entries are kept.
 */
export function sanitizeEatenMeals(eatenMeals) {
  const clean = {};
  if (!eatenMeals || typeof eatenMeals !== 'object') return clean;
  Object.keys(eatenMeals).forEach(key => {
    if (/^\d{4}-\d{2}-\d{2}:[a-z]+(:[ec])?$/.test(key) && eatenMeals[key] === true) {
      clean[key] = true;
    }
  });
  return clean;
}

/**
 * Sanitises the Step 3 shopping list's at-home ticks, keyed by each line's ingredient (atHomeKey).
 * Only ticked entries are kept.
 */
export function sanitizeShoppingAtHome(shoppingAtHome) {
  const clean = {};
  if (!shoppingAtHome || typeof shoppingAtHome !== 'object') return clean;
  Object.keys(shoppingAtHome).forEach(key => {
    if (key && shoppingAtHome[key] === true) clean[key] = true;
  });
  return clean;
}

/**
 * Sanitises Step 3 Swap Product choices. Swaps are merge-written to plans/current by
 * setActivePlan, so the whole-document saveCurrentPlan must carry them or a tick would
 * erase them. Values are a product id string or { productId, productName, brand, price, timestamp }.
 */
export function sanitizeSubstitutions(substitutions) {
  const clean = {};
  if (!substitutions || typeof substitutions !== 'object') return clean;
  Object.keys(substitutions).forEach(key => {
    const sub = substitutions[key];
    if (typeof sub === 'string' && sub) {
      clean[key] = sub;
    } else if (sub && typeof sub === 'object' && sub.productId) {
      clean[key] = {
        productId: String(sub.productId),
        productName: String(sub.productName || ''),
        brand: String(sub.brand || ''),
        price: Number(sub.price || 0),
        timestamp: Number(sub.timestamp || 0)
      };
    }
  });
  return clean;
}

/**
 * Sanitises Swap Product selections: ingredient key to product id.
 */
export function sanitizeProductSelections(productSelections) {
  const clean = {};
  if (!productSelections || typeof productSelections !== 'object') return clean;
  Object.keys(productSelections).forEach(key => {
    const productId = productSelections[key];
    if ((typeof productId === 'string' && productId) || typeof productId === 'number') clean[key] = String(productId);
  });
  return clean;
}

/**
 * Returns a clean, empty meal plan schema with no recipe attachments.
 */
export function createCleanEmptyPlanSchema(daysOverride = null) {
  const days = Number(daysOverride || (typeof window !== 'undefined' ? getState()?.plannerDays : 7) || 7);
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
    || (typeof window !== 'undefined' ? getState()?.skeletonGrid : {})
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
    mealPrepGroups: cleanPrepGroups,
    eatenMeals: sanitizeEatenMeals(planData.eatenMeals),
    shoppingAtHome: sanitizeShoppingAtHome(planData.shoppingAtHome),
    substitutions: sanitizeSubstitutions(planData.substitutions),
    productSelections: sanitizeProductSelections(planData.productSelections)
  };

  FORBIDDEN_PLAN_KEYS.forEach(k => delete sanitizedPlan[k]);
  return sanitizedPlan;
}
