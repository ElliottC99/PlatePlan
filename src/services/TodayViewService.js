/**
 * src/services/TodayViewService.js (v3.8.1)
 * Pure Today dashboard calculations, daily meal assignment resolvers,
 * and usage tracking engine.
 * Quarantined from page DOM queries and direct database operations.
 */

export function formatPlanLocalDateValue(date) {
  if (!date || isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parsePlanLocalDate(value) {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

export function getPlatePlanLocalToday() {
  return formatPlanLocalDateValue(new Date());
}

export function formatTodayDateLabel(value) {
  const date = parsePlanLocalDate(value);
  return date ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(date) : '';
}

export function getTodayPlanDay(dateValue, planContext = {}) {
  return Object.entries(planContext?.dayDates || {}).find(([, val]) => val === dateValue)?.[0] || '';
}

export function getNextDatedPlanDay(dateValue, planContext = {}) {
  return Object.entries(planContext?.dayDates || {})
    .filter(([, val]) => parsePlanLocalDate(val) && val > dateValue)
    .sort((a, b) => a[1].localeCompare(b[1]))[0] || null;
}

export function stablePlatePlanValue(value) {
  if (Array.isArray(value)) return value.map(stablePlatePlanValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stablePlatePlanValue(value[key])]));
  }
  return value;
}

export function getTodayResolvedFingerprint(info, mealType, context = {}) {
  if (!info?.active) return '';
  const ingredients = (info.active.ingredients || []).map(ingredient => {
    const key = ingredient.key || ingredient.id || ingredient.name || '';
    const isRemoved = !!(context.removed && context.removed[key]);
    if (isRemoved) return { key, removed: true };
    return {
      key,
      qty: Number(ingredient.qty) || 0,
      unit: ingredient.unit || '',
      productId: ingredient.productId || ingredient.bankId || '',
      mergeInto: context.mergeInto?.[key] || ''
    };
  });
  return JSON.stringify(stablePlatePlanValue({
    recipeId: info.id || info.active?.id,
    variant: info.variant || 'original',
    mealType,
    ingredients
  }));
}

export function isMealEatenOnDate(eatenMeals = {}, dateStr, mealType, person = 'both') {
  if (!eatenMeals || typeof eatenMeals !== 'object') return false;
  if (person === 'e') {
    return !!(eatenMeals[`${dateStr}:${mealType}:e`] || eatenMeals[`${dateStr}:${mealType}`]);
  }
  if (person === 'c') {
    return !!(eatenMeals[`${dateStr}:${mealType}:c`] || eatenMeals[`${dateStr}:${mealType}`]);
  }
  return !!(eatenMeals[`${dateStr}:${mealType}`] || (eatenMeals[`${dateStr}:${mealType}:e`] && eatenMeals[`${dateStr}:${mealType}:c`]));
}

export function calculateMealEatenUpdates(eatenMeals = {}, dateStr, mealType, person = 'both') {
  const nextEaten = { ...(eatenMeals || {}) };
  let toastMessage = '';
  const titleMeal = mealType.charAt(0).toUpperCase() + mealType.slice(1);

  if (person === 'e') {
    const nextState = !isMealEatenOnDate(nextEaten, dateStr, mealType, 'e');
    nextEaten[`${dateStr}:${mealType}:e`] = nextState;
    if (!nextState) delete nextEaten[`${dateStr}:${mealType}`];
    toastMessage = nextState ? `Marked Elliott's ${titleMeal} as eaten ✓` : `Unmarked Elliott's ${titleMeal}`;
  } else if (person === 'c') {
    const nextState = !isMealEatenOnDate(nextEaten, dateStr, mealType, 'c');
    nextEaten[`${dateStr}:${mealType}:c`] = nextState;
    if (!nextState) delete nextEaten[`${dateStr}:${mealType}`];
    toastMessage = nextState ? `Marked Chloe's ${titleMeal} as eaten ✓` : `Unmarked Chloe's ${titleMeal}`;
  } else {
    const nextState = !isMealEatenOnDate(nextEaten, dateStr, mealType, 'both');
    nextEaten[`${dateStr}:${mealType}`] = nextState;
    nextEaten[`${dateStr}:${mealType}:e`] = nextState;
    nextEaten[`${dateStr}:${mealType}:c`] = nextState;
    toastMessage = nextState ? `Marked ${titleMeal} as eaten ✓` : `Unmarked ${titleMeal}`;
  }

  return { nextEaten, toastMessage };
}

export function getIngredientUsage(bankId, stateData = {}, formatPlanDayLabelFn = null) {
  const { recipes = [], plan = null, productsMap = new Map() } = stateData;
  const matchedRecipes = [];

  recipes.forEach(r => {
    const usesProduct = ing => {
      if (!ing) return false;
      const ingProdId = ing.productId || ing.bankId;
      if (ingProdId === bankId) return true;
      if (ing.groupId && productsMap) {
        const prod = productsMap.get ? productsMap.get(bankId) : productsMap[bankId];
        if (prod && prod.groupId === ing.groupId) return true;
      }
      return false;
    };
    if ((r.ingredients || []).some(usesProduct)) {
      matchedRecipes.push(r.name);
    } else if (r.enhanced && r.enhanced.ingredients && r.enhanced.ingredients.some(usesProduct)) {
      matchedRecipes.push(r.name + ' (Enhanced)');
    }
  });

  const matchedPlans = [];
  if (plan && plan.slots) {
    for (let d in plan.slots) {
      for (let k in plan.slots[d]) {
        let s = plan.slots[d][k];
        if (s && typeof s === 'object' && s.instanceId) {
          const r = recipes.find(x => x.id === s.id);
          if (r) {
            const used = (r.ingredients || []).some(ing => (ing.productId || ing.bankId) === bankId);
            if (used) {
              const dayLabel = formatPlanDayLabelFn ? formatPlanDayLabelFn(plan, d, { short: true }) : `Day ${d}`;
              matchedPlans.push(`${dayLabel} ${k}`);
            }
          }
        }
      }
    }
  }

  return {
    recipes: [...new Set(matchedRecipes)],
    plans: [...new Set(matchedPlans)]
  };
}
