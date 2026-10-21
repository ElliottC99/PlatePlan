
/**
 * src/services/SubtypeActionService.js (v3.38.7)
 * Handles subtype promotion, merging, reassignment, and database write operations.
 */

import { getState, setIngredients, setProducts } from '../store/store.js';
import { deleteSubtypeInDb } from './IngredientRepository.js';
import { invalidateHierarchyCache } from '../models/PantryHierarchyModel.js';

export async function deleteSubtype(parentId, subtypeId) {
  try {
    const state = getState();
    let ingredients = (state.ingredients && state.ingredients.length) ? state.ingredients : (getState()?.ingredients || []);
    
    // Try finding the parent by parentId first
    let parent = ingredients.find(i => String(i.id) === String(parentId));
    // Fallback: search all parent ingredients to find the true parent array containing the subtypeId
    if (!parent || !Array.isArray(parent.subtypes) || !parent.subtypes.some(s => String(s.id) === String(subtypeId))) {
      parent = ingredients.find(i => Array.isArray(i.subtypes) && i.subtypes.some(s => String(s.id) === String(subtypeId)));
    }

    if (!parent || !Array.isArray(parent.subtypes)) {
      console.warn('[deleteSubtype] Subtype parent not found for subtypeId:', subtypeId, 'parentId:', parentId);
      return false;
    }

    // Remove the subtype by strict ID matching
    parent.subtypes = parent.subtypes.filter(s => String(s.id) !== String(subtypeId));
    parent.updatedAt = new Date().toISOString();

    // Find and unlink any products linked to subtypeId
    const prods = [...(state.products ?.products || [])];
    const unlinkedProds = [];
    prods.forEach(p => {
      if (String(p.subtypeId) === String(subtypeId)) {
        p.subtypeId = null;
        p.isAutoDefault = false;
        p.updatedAt = new Date().toISOString();
        unlinkedProds.push(p);
      }
    });

    // Update central store and trigger reactive events
    setIngredients([...ingredients]);
    setProducts(prods);

    // Invalidate hierarchy cache
    invalidateHierarchyCache();
    if (typeof window.invalidateHierarchyCache === 'function') window.invalidateHierarchyCache();
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    if (typeof window.renderProductBank === 'function') window.renderProductBank();

    // Save changes atomically to persistence layer
    await deleteSubtypeInDb(parent, unlinkedProds);
    return true;
  } catch (err) {
    console.error('[deleteSubtype] Exception caught during sub-type deletion:', err);
    throw err;
  }
}
