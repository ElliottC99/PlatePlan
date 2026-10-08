/**
 * src/services/InventoryService.js (v3.23.0)
 * Pantry Match & "Use-Up" Calculation Engine for PlatePlan.
 * Cross-references recipe ingredients against inventory items.
 */

import { getState } from '../store/store.js';

function cleanString(str) {
  return String(str || '').toLowerCase().trim();
}

/**
 * Calculates Pantry Match Score, missing ingredients, and Use-Up priority boosts for a recipe.
 * @param {Object} recipe Recipe object containing ingredients list
 * @param {Array<Object>} [inventory] Inventory items list (defaults to store.getState().inventory)
 * @returns {Object} Pantry match analysis result
 */
export function calculateRecipePantryMatch(recipe, inventory = null) {
  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return {
      matchPercentage: 0,
      matchedCount: 0,
      totalCount: 0,
      missingIngredients: [],
      useUpMatches: [],
      useUpScore: 0
    };
  }

  const storeState = (typeof getState === 'function') ? getState() : {};
  const activeInventory = inventory || storeState.inventory || [];

  // Filter in_stock or low_stock items
  const stockedItems = activeInventory.filter(item => {
    if (!item) return false;
    const status = item.status || 'in_stock';
    return status === 'in_stock' || status === 'low_stock';
  });

  // Build lookups by ingredientId and by name
  const byIngredientId = new Map();
  const byName = new Map();

  stockedItems.forEach(item => {
    if (item.ingredientId) {
      byIngredientId.set(String(item.ingredientId), item);
    }
    const nameKey = cleanString(item.customName || item.name);
    if (nameKey) {
      byName.set(nameKey, item);
    }
  });

  const recipeIngredients = recipe.ingredients;
  const totalCount = recipeIngredients.length;
  let matchedCount = 0;
  const missingIngredients = [];
  const useUpMatches = [];

  recipeIngredients.forEach(ing => {
    if (!ing) return;
    const ingId = ing.ingredientId ? String(ing.ingredientId) : null;
    const ingName = cleanString(ing.name || ing.rawName || ing.raw || '');

    let matchedItem = null;

    if (ingId && byIngredientId.has(ingId)) {
      matchedItem = byIngredientId.get(ingId);
    } else if (ingName) {
      if (byName.has(ingName)) {
        matchedItem = byName.get(ingName);
      } else {
        // Fallback partial matching
        for (const [key, item] of byName.entries()) {
          if (key.includes(ingName) || ingName.includes(key)) {
            matchedItem = item;
            break;
          }
        }
      }
    }

    if (matchedItem) {
      matchedCount++;
      if (matchedItem.isUseUp) {
        useUpMatches.push({
          recipeIngredient: ing,
          pantryItem: matchedItem
        });
      }
    } else {
      missingIngredients.push(ing);
    }
  });

  const matchPercentage = Math.round((matchedCount / Math.max(totalCount, 1)) * 100);
  const useUpScore = matchPercentage + (useUpMatches.length * 25);

  return {
    matchPercentage,
    matchedCount,
    totalCount,
    missingIngredients,
    useUpMatches,
    useUpScore
  };
}

/**
 * Enriches array of recipes with pantryMatch score metadata.
 */
export function calculatePantryScoresForRecipes(recipes = [], inventory = null) {
  if (!Array.isArray(recipes)) return [];
  return recipes.map(r => ({
    ...r,
    pantryMatch: calculateRecipePantryMatch(r, inventory)
  }));
}

/**
 * Sorts recipes by Use-Up Score descending, then Match Percentage descending.
 */
export function sortRecipesByPantryMatch(recipes = [], inventory = null) {
  if (!Array.isArray(recipes)) return [];
  const enriched = calculatePantryScoresForRecipes(recipes, inventory);
  return enriched.sort((a, b) => {
    const scoreA = a.pantryMatch?.useUpScore || 0;
    const scoreB = b.pantryMatch?.useUpScore || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.pantryMatch?.matchPercentage || 0) - (a.pantryMatch?.matchPercentage || 0);
  });
}

const InventoryService = {
  calculateRecipePantryMatch,
  calculatePantryScoresForRecipes,
  sortRecipesByPantryMatch
};

if (typeof window !== 'undefined') {
  window.InventoryService = InventoryService;
  window.calculateRecipePantryMatch = calculateRecipePantryMatch;
  window.sortRecipesByPantryMatch = sortRecipesByPantryMatch;
}

export default InventoryService;
