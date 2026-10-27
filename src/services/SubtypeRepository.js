/**
 * src/services/SubtypeRepository.js (v3.38.53)
 * Dedicated Micro-Repository for Sub-type & Ingredient Hierarchy Mutations.
 * Handles sub-type lifecycle: deletion, orphan resolution, promotion, reparenting, and merging.
 * Strictly scopes all Firestore operations to 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { getState as getStoreState, setIngredients, setProducts, setRecipes } from '../store/store.js';
import { isDbAvailable, batchUpdateRecipesInDb } from './RecipeFirestoreRepository.js';
import { saveRootItem, deleteRootItem } from './PantryTaxonomyService.js';
import { saveProduct, deleteProduct } from './ProductRepository.js';

function remapRecipeIngredients(recipes = [], predicateRemap) {
  const modified = [];
  const clonedRecipes = recipes.map(recipe => {
    if (!recipe) return recipe;
    let recipeChanged = false;
    const rCopy = JSON.parse(JSON.stringify(recipe));
    const checkAndRemap = (item) => {
      if (item && predicateRemap(item)) recipeChanged = true;
    };
    if (Array.isArray(rCopy.ingredientSections)) {
      rCopy.ingredientSections.forEach(sec => {
        if (Array.isArray(sec.ingredients)) sec.ingredients.forEach(checkAndRemap);
      });
    }
    if (Array.isArray(rCopy.ingredients)) {
      rCopy.ingredients.forEach(checkAndRemap);
    }
    if (recipeChanged) {
      rCopy.updatedAt = new Date().toISOString();
      modified.push(rCopy);
      return rCopy;
    }
    return recipe;
  });
  return { allRecipes: clonedRecipes, modifiedRecipes: modified };
}

export async function deleteSubtypeInDb(parentIngredient, unlinkedProducts) {
  if (!isDbAvailable()) return false;
  try {
    await saveRootItem(parentIngredient);
    if (Array.isArray(unlinkedProducts)) {
      await Promise.all(unlinkedProducts.map(prod => saveProduct(prod)));
    }
    return true;
  } catch (err) {
    console.error('[SubtypeRepository] Error in deleteSubtypeInDb:', err);
    throw err;
  }
}

export async function batchResolveSubtypeOrphansInDb(productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    if (Array.isArray(productUpdates)) {
      await Promise.all(productUpdates.map(p => {
        if (p._delete === true) return deleteProduct(p.id);
        return saveProduct(p);
      }));
    }
    return true;
  } catch (err) {
    console.error('[SubtypeRepository] Error in batchResolveSubtypeOrphansInDb:', err);
    throw err;
  }
}

export async function batchResolveOrphansWithNewSubtypeInDb(parentIngredient, productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    if (parentIngredient) {
      await saveRootItem(parentIngredient);
    }
    if (Array.isArray(productUpdates)) {
      await Promise.all(productUpdates.map(p => {
        if (p._delete === true) return deleteProduct(p.id);
        return saveProduct(p);
      }));
    }
    return true;
  } catch (err) {
    console.error('[SubtypeRepository] Error in batchResolveOrphansWithNewSubtypeInDb:', err);
    throw err;
  }
}

export async function batchMergeIngredientsInDb(canonicalIngredient, duplicateIngredientId, updatedRecipes, updatedProducts, updatedPlan) {
  if (!isDbAvailable()) return false;
  try {
    await deleteRootItem(duplicateIngredientId);
    await saveRootItem(canonicalIngredient);

    if (Array.isArray(updatedRecipes) && updatedRecipes.length > 0) {
      await batchUpdateRecipesInDb(updatedRecipes);
    }

    if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
      await Promise.all(updatedProducts.map(p => saveProduct(p)));
    }

    if (updatedPlan) {
      const planDocRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current');
      const planData = { ...updatedPlan, updatedAt: new Date().toISOString() };
      delete planData.id;
      await planDocRef.set(planData);
    }

    return true;
  } catch (err) {
    console.error('[SubtypeRepository] Error in batchMergeIngredientsInDb:', err);
    throw err;
  }
}

export async function promoteSubtype(parentId, subtypeId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const parent = ings.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) {
    throw new Error(`Parent ingredient ${parentId} not found or has no subtypes`);
  }

  const subIdx = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIdx < 0) {
    throw new Error(`Subtype ${subtypeId} not found on parent ${parentId}`);
  }

  const [removedSub] = parent.subtypes.splice(subIdx, 1);
  const newRootId = removedSub.id || `ing_${Date.now()}`;
  const newSubId = `sub_${Date.now()}`;
  const newRoot = {
    id: newRootId,
    name: removedSub.name,
    category: parent.category || 'Store Cupboard',
    notes: removedSub.notes || '',
    aliases: Array.isArray(removedSub.aliases) ? removedSub.aliases : [],
    subtypes: [
      {
        id: newSubId,
        name: removedSub.name,
        aliases: Array.isArray(removedSub.aliases) ? removedSub.aliases : [],
        defaultProductId: removedSub.defaultProductId || null,
        createdAt: new Date().toISOString()
      }
    ],
    defaultProductId: removedSub.defaultProductId || null,
    updatedAt: new Date().toISOString()
  };
  parent.updatedAt = new Date().toISOString();
  ings.push(newRoot);

  const products = state.products || [];
  const updatedProds = products.map(p => {
    if (String(p.subtypeId) === String(subtypeId)) {
      return {
        ...p,
        ingredientId: String(newRootId),
        subtypeId: String(newSubId),
        category: newRoot.category,
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });
  setProducts(updatedProds);

  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(parentId) && String(item.subtypeId || '') === String(subtypeId))
      || String(item.targetId || '') === `${parentId}:${subtypeId}`;
    if (isMatch) {
      item.pantryItemId = String(newRootId);
      item.ingredientId = String(newRootId);
      item.subtypeId = null;
      item.subtypeName = null;
      item.name = newRoot.name;
      return true;
    }
    return false;
  });

  setIngredients(ings);
  setRecipes(allRecipes);

  if (isDbAvailable()) {
    await saveRootItem(parent);
    await saveRootItem(newRoot);
    if (modifiedRecipes.length > 0) {
      await batchUpdateRecipesInDb(modifiedRecipes);
    }
  }

  return { success: true, newRootId, modifiedRecipesCount: modifiedRecipes.length };
}

export async function moveSubtype(oldParentId, subtypeId, newParentId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const oldParent = ings.find(i => String(i.id) === String(oldParentId));
  const newParent = ings.find(i => String(i.id) === String(newParentId));
  if (!oldParent || !Array.isArray(oldParent.subtypes)) {
    throw new Error(`Old parent ${oldParentId} not found`);
  }
  if (!newParent) {
    throw new Error(`New parent ${newParentId} not found`);
  }

  const subIdx = oldParent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIdx < 0) {
    throw new Error(`Subtype ${subtypeId} not found on parent ${oldParentId}`);
  }

  const [movedSub] = oldParent.subtypes.splice(subIdx, 1);
  if (!Array.isArray(newParent.subtypes)) newParent.subtypes = [];
  newParent.subtypes.push(movedSub);
  oldParent.updatedAt = new Date().toISOString();
  newParent.updatedAt = new Date().toISOString();

  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(oldParentId) && String(item.subtypeId || '') === String(subtypeId))
      || String(item.targetId || '') === `${oldParentId}:${subtypeId}`;
    if (isMatch) {
      item.pantryItemId = String(newParentId);
      item.ingredientId = String(newParentId);
      item.subtypeId = String(subtypeId);
      item.name = `${newParent.name} (${movedSub.name})`;
      return true;
    }
    return false;
  });

  setIngredients(ings);
  setRecipes(allRecipes);

  if (isDbAvailable()) {
    await saveRootItem(oldParent);
    await saveRootItem(newParent);
    if (modifiedRecipes.length > 0) {
      await batchUpdateRecipesInDb(modifiedRecipes);
    }
  }

  return { success: true, modifiedRecipesCount: modifiedRecipes.length };
}

export async function mergeSubtype(parentId, oldSubtypeId, newSubtypeId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const parent = ings.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) {
    throw new Error(`Parent ingredient ${parentId} not found`);
  }

  const oldSubIdx = parent.subtypes.findIndex(s => String(s.id) === String(oldSubtypeId));
  const newSub = parent.subtypes.find(s => String(s.id) === String(newSubtypeId));
  if (oldSubIdx < 0 || !newSub) {
    throw new Error(`Subtypes for merge not found on parent ${parentId}`);
  }

  const [removedSub] = parent.subtypes.splice(oldSubIdx, 1);
  const targetAliases = new Set(Array.isArray(newSub.aliases) ? newSub.aliases : []);
  if (removedSub.name) targetAliases.add(removedSub.name);
  if (Array.isArray(removedSub.aliases)) removedSub.aliases.forEach(a => targetAliases.add(a));
  newSub.aliases = Array.from(targetAliases);
  parent.updatedAt = new Date().toISOString();

  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(parentId) && String(item.subtypeId || '') === String(oldSubtypeId))
      || String(item.targetId || '') === `${parentId}:${oldSubtypeId}`;
    if (isMatch) {
      item.subtypeId = String(newSubtypeId);
      item.subtypeName = newSub.name;
      item.name = `${parent.name} (${newSub.name})`;
      return true;
    }
    return false;
  });

  setIngredients(ings);
  setRecipes(allRecipes);

  if (isDbAvailable()) {
    await saveRootItem(parent);
    if (modifiedRecipes.length > 0) {
      await batchUpdateRecipesInDb(modifiedRecipes);
    }
  }

  return { success: true, modifiedRecipesCount: modifiedRecipes.length };
}
