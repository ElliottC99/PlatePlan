/**
 * src/services/ShoppingListService.js (v3.31.16)
 * Smart Shopping List Consolidation Engine:
 * - Aggregates required ingredients across all meals in active meal plan with deduplication for split slots.
 * - Subtracts active in_stock pantry quantities matching by ingredientId and units (g, ml, qty).
 * - Groups purchase items under supermarket aisles/categories and computes recipe usage summaries.
 */

export const AISLE_CATEGORIES = [
  'Produce',
  'Refrigerated & Dairy',
  'Pantry & Beans',
  'Spices & Oils',
  'Bakery',
  'Frozen',
  'Uncategorized'
];

export function mapCategoryToAisle(categoryName) {
  const cat = String(categoryName || '').toLowerCase();
  if (cat.includes('produce') || cat.includes('vegetable') || cat.includes('fruit') || cat.includes('herb')) return 'Produce';
  if (cat.includes('dairy') || cat.includes('milk')  || cat.includes('cheese') || cat.includes('refrigerated') || cat.includes('tofu') || cat.includes('yogurt')) return 'Refrigerated & Dairy';
  if (cat.includes('pantry') || cat.includes('bean') || cat.includes('grain') || cat.includes('pasta') || cat.includes('canned') || cat.includes('tinned') || cat.includes('tomato')) return 'Pantry & Beans';
  if (cat.includes('spice') || cat.includes('oil') || cat.includes('seasoning') || cat.includes('condiment') || cat.includes('sauce')) return 'Spices & Oils';
  if (cat.includes('bakery') || cat.includes('bread')) return 'Bakery';
  if (cat.includes('frozen')) return 'Frozen';
  return 'Uncategorized';
}

/**
 * Generates a consolidated shopping list from active meal plan and inventory.
 * @param {Object} plan Active meal plan document
 * @param {Array} inventory Active household inventory items
 * @param {Array} recipes All available recipes in store
 * @param {Array} ingredientsBank All available ingredients/items in bank
 */
export function generateShoppingListFromPlan(plan, inventory = [], recipes = [], ingredientsBank = []) {
  if (!plan || !Array.isArray(plan.days)) {
    return {
      id: `list_${Date.now()}`,
      planId: plan?.id || '',
      status: 'active',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const recipeMap = new Map();
  recipes.forEach(r => recipeMap.set(r.id, r));

  const ingredientMap = new Map();
  ingredientsBank.forEach(i => ingredientMap.set(i.id, i));

  // Map inventory by ingredientId & unit
  const inventoryMap = new Map();
  inventory.forEach(item => {
    if (item.status === 'in_stock' && item.ingredientId) {
      const key = `${item.ingredientId}_${item.unit || 'qty'}`;
      const existingQty = inventoryMap.get(key) || 0;
      inventoryMap.set(key, existingQty + (Number(item.quantity) || 0));
    }
  });

  // Aggregate required ingredients across plan days & meals with recipe breakdown & split deduplication
  const aggregatedRequirements = new Map(); // key: `${ingredientId}_${unit}`

  plan.days.forEach((day, dayIndex) => {
    const mealsList = Array.isArray(day.meals) ? day.meals : (day.meals && typeof day.meals === 'object' ? Object.values(day.meals) : []);
    
    mealsList.forEach(meal => {
      if (!meal) return;

      const hasSplit = meal.isSplit || (meal.elliott && (meal.elliott.recipeId || meal.elliott.id)) || (meal.chloe && (meal.chloe.recipeId || meal.chloe.id));

      const processRecipeForMeal = (recId, servingsOverride, personLabel = '') => {
        const recipe = recipeMap.get(recId);
        if (!recipe || !Array.isArray(recipe.ingredients)) return;

        const baseServings = Number(recipe.serves || recipe.servings || 4) || 4;
        const targetServings = Number(servingsOverride || meal.servings || meal.targetServes || baseServings) || 4;
        const scaleMultiplier = targetServings / baseServings;

        recipe.ingredients.forEach(ing => {
          const ingId = ing.ingredientId || ing.name || 'unknown';
          const unit = ing.unit || 'qty';
          const key = `${ingId}_${unit}`;

          const reqQty = (Number(ing.qty) || Number(ing.quantity) || 1) * scaleMultiplier;
          let currentTotal = aggregatedRequirements.get(key);
          if (!currentTotal) {
            currentTotal = {
              ingredientId: ing.ingredientId || '',
              name: ing.name || 'Ingredient',
              category: ingredientMap.get(ing.ingredientId)?.category || ing.categoryId || ing.category || 'Pantry',
              unit,
              requiredQty: 0,
              recipeBreakdown: []
            };
          }

          currentTotal.requiredQty += reqQty;
          currentTotal.recipeBreakdown.push({
            recipeId: recipe.id,
            recipeName: personLabel ? `${recipe.name || recipe.title || 'Recipe'} (${personLabel})` : (recipe.name || recipe.title || 'Recipe'),
            day: day.day || dayIndex + 1,
            mealType: meal.mealType || meal.slot || 'meal',
            servings: targetServings,
            qty: Math.round(reqQty * 10) / 10
          });

          aggregatedRequirements.set(key, currentTotal);
        });
      };

      if (hasSplit) {
        if (meal.elliott && !meal.elliott.isSkipped) {
          const eRecipeId = meal.elliott.recipeId || meal.elliott.id;
          if (eRecipeId) {
            processRecipeForMeal(eRecipeId, meal.elliott.servings, 'Elliott');
          }
        }
        if (meal.chloe && !meal.chloe.isSkipped) {
          const cRecipeId = meal.chloe.recipeId || meal.chloe.id;
          if (cRecipeId) {
            processRecipeForMeal(cRecipeId, meal.chloe.servings, 'Chloe');
          }
        }
      } else {
        const recipeId = meal.recipeId || meal.id;
        if (recipeId && !meal.isSkipped) {
          processRecipeForMeal(recipeId, meal.servings);
        }
      }
    });
  });

  // Subtract pantry stock and construct shopping list items
  const items = [];
  aggregatedRequirements.forEach((req, key) => {
    const stockQty = inventoryMap.get(key) || 0;
    const netBuyQty = Math.max(0, req.requiredQty - stockQty);

    const aisleCategory = mapCategoryToAisle(req.category);

    // Aggregate recipeBreakdown into recipeSummary for expandable product cards
    const recipeSummaryMap = new Map();
    (req.recipeBreakdown || []).forEach(b => {
      const rKey = b.recipeName || 'Recipe';
      if (!recipeSummaryMap.has(rKey)) {
        recipeSummaryMap.set(rKey, { recipeName: b.recipeName, totalQty: 0, usages: [] });
      }
      const entry = recipeSummaryMap.get(rKey);
      entry.totalQty += b.qty;
      entry.usages.push({ day: b.day, mealType: b.mealType, servings: b.servings, qty: b.qty });
    });
    const recipeSummary = Array.from(recipeSummaryMap.values());

    items.push({
      id: `item_${Math.random().toString(36).substr(2, 9)}`,
      key: `shop_${req.ingredientId || req.name}_${req.unit}`,
      ingredientId: req.ingredientId,
      name: req.name,
      category: aisleCategory,
      requiredQty: Math.round(req.requiredQty * 10) / 10,
      inStockQty: Math.round(stockQty * 10) / 10,
      buyQty: Math.round(netBuyQty * 10) / 10,
      unit: req.unit,
      isChecked: netBuyQty <= 0,
      isManualAdd: false,
      recipeBreakdown: req.recipeBreakdown || [],
      recipeSummary
    });
  });

  return {
    id: `list_${Date.now()}`,
    planId: plan.id || '',
    status: 'active',
    items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

if (typeof window !== 'undefined') {
  window.ShoppingListService = {
    generateShoppingListFromPlan,
    mapCategoryToAisle,
    AISLE_CATEGORIES
  };
}
