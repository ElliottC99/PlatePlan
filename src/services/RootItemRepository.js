/**
 * src/services/RootItemRepository.js (v3.43.0)
 * Dedicated Micro-Repository for RootItem & Sub-type Mutations and Data Access.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { getState as getStoreState } from '../store/store.js';
import {
  saveRootItem as saveCanonicalRootItem,
  deleteRootItem as deleteCanonicalRootItem
} from './PantryTaxonomyService.js';
import { saveProduct, deleteProduct } from './ProductRepository.js';
import { batchUpdateRecipesInDb } from './RecipeFirestoreRepository.js';

function isDbAvailable() {
  if (!db) { console.warn('[RootItemRepository] Firestore db instance not initialised.'); return false; }
  return true;
}

async function safeFirestoreGet(ref, timeoutMs = 2500) {
  if (!ref || typeof ref.get !== 'function') return null;
  try {
    const netPromise = ref.get();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore get timeout')), timeoutMs));
    return await Promise.race([netPromise, timeoutPromise]);
  } catch (_netErr) {
    try { return await ref.get({ source: 'cache' }); } catch (_cacheErr) { return null; }
  }
}

function remapRecipeIngredients(recipes = [], predicateRemap) {
  const modified = [];
  const clonedRecipes = recipes.map(recipe => {
    if (!recipe) return recipe;
    let recipeChanged = false;
    const rCopy = JSON.parse(JSON.stringify(recipe));
    const checkAndRemap = (item) => { if (item && predicateRemap(item)) recipeChanged = true; };
    if (Array.isArray(rCopy.ingredientSections)) {
      rCopy.ingredientSections.forEach(sec => { if (Array.isArray(sec.ingredients)) sec.ingredients.forEach(checkAndRemap); });
    }
    if (Array.isArray(rCopy.ingredients)) rCopy.ingredients.forEach(checkAndRemap);
    if (recipeChanged) {
      rCopy.updatedAt = new Date().toISOString();
      modified.push(rCopy);
      return rCopy;
    }
    return recipe;
  });
  return { allRecipes: clonedRecipes, modifiedRecipes: modified };
}

export async function getRootItems(uid) {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const safeState = (window.Store && typeof window.Store.getState === 'function') 
      ? window.Store.getState() 
      : (typeof getStoreState === 'function' ? getStoreState() : {});
    const prods = (typeof window !== 'undefined' && safeState?.products) || [];
    return enforceCategorySSOT({ ingredients: raw, products: prods }).ingredients;
  } catch (err) { return []; }
}

export async function saveRootItem(rootItem, _uid) {
  return await saveCanonicalRootItem(rootItem);
}

export async function deleteRootItem(rootItemId, _uid) {
  return await deleteCanonicalRootItem(rootItemId);
}

// Aliases for backwards compatibility during migration
export const getIngredients = getRootItems;
export const saveIngredient = saveRootItem;
export const deleteIngredient = deleteRootItem;

export async function deleteSubtypeInDb(parentRootItem, unlinkedProducts) {
  if (!isDbAvailable()) return false;
  try {
    await saveCanonicalRootItem(parentRootItem);
    if (Array.isArray(unlinkedProducts)) {
      await Promise.all(unlinkedProducts.map(prod => saveProduct(prod)));
    }
    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in deleteSubtypeInDb:', err);
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
    console.error('[RootItemRepository] Error in batchResolveSubtypeOrphansInDb:', err);
    throw err;
  }
}

export async function batchResolveOrphansWithNewSubtypeInDb(parentRootItem, productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    if (parentRootItem) {
      await saveCanonicalRootItem(parentRootItem);
    }
    if (Array.isArray(productUpdates)) {
      await Promise.all(productUpdates.map(p => {
        if (p._delete === true) return deleteProduct(p.id);
        return saveProduct(p);
      }));
    }
    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in batchResolveOrphansWithNewSubtypeInDb:', err);
    throw err;
  }
}

export async function batchMergeIngredientsInDb(canonicalRootItem, duplicateRootItemId, updatedRecipes, updatedProducts, updatedPlan) {
  if (!isDbAvailable()) return false;
  try {
    await saveCanonicalRootItem(canonicalRootItem);
    await deleteCanonicalRootItem(duplicateRootItemId);

    if (Array.isArray(updatedProducts) && updatedProducts.length > 0) {
      await Promise.all(updatedProducts.map(p => saveProduct(p)));
    }

    if (Array.isArray(updatedRecipes) && updatedRecipes.length > 0) {
      await batchUpdateRecipesInDb(updatedRecipes);
    }

    if (updatedPlan && typeof updatedPlan === 'object' && updatedPlan.id) {
      const planColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans');
      const planData = { ...updatedPlan, updatedAt: new Date().toISOString() };
      delete planData.id;
      await planColRef.doc(updatedPlan.id).set(planData, { merge: true });
    }

    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in batchMergeIngredientsInDb:', err);
    throw err;
  }
}
