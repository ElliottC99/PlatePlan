/**
 * src/services/SyncService.js (v3.19.23)
 * Cloud Sync Diagnostics & Operational Telemetry Service.
 * Aggregates collection items, embedded sub-types, products, and meal plan slots.
 */

import { getState } from '../store/store.js';
import { buildPantryHierarchy } from '../models/PantryHierarchyModel.js';

export function getCounts(stateInput) {
  const state = stateInput || getState() || {};
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];
  const recipes = Array.isArray(state.recipes) ? state.recipes : [];
  const planSlots = state.plan ? Object.keys(state.plan).length : 0;

  const hierarchy = buildPantryHierarchy(ingredients, products);
  const totalSubtypes = hierarchy.reduce((acc, cat) => {
    return acc + (cat.ingredients || []).reduce((iAcc, ing) => iAcc + (ing.subtypes?.length || 0), 0);
  }, 0);

  return {
    ingredientsCount: ingredients.length,
    subtypesCount: totalSubtypes,
    productsCount: products.length,
    recipesCount: recipes.length,
    planSlotsCount: planSlots
  };
}
