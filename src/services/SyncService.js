/**
 * src/services/SyncService.js (v3.19.19)
 * Cloud Sync Diagnostics & Operational Telemetry Service.
 * Aggregates collection items, embedded sub-types, products, and meal plan slots.
 */

import { getState } from '../store/store.js';

export function getCounts(stateInput) {
  const state = stateInput || getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const planSlots = state.plan ? Object.keys(state.plan).length : 0;

  const totalSubtypes = ingredients.reduce((count, ing) => {
    const embeddedCount = Array.isArray(ing.subtypes) ? ing.subtypes.length : (Array.isArray(ing.sub_types) ? ing.sub_types.length : 0);
    const isSub = Boolean(ing.isSubtype || ing.is_subtype || ing.parentId || ing.parent_id || ing.parentIngredientId || ing.parent_ingredient_id);
    return count + embeddedCount + (isSub ? 1 : 0);
  }, 0);

  return {
    ingredientsCount: ingredients.length,
    subtypesCount: totalSubtypes,
    productsCount: products.length,
    recipesCount: recipes.length,
    planSlotsCount: planSlots
  };
}
