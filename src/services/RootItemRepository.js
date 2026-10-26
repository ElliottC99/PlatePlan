/**
 * src/services/RootItemRepository.js (v3.43.0)
 * Dedicated Micro-Repository for RootItem & Sub-type Mutations and Data Access.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { getState as getStoreState, setIngredients, setRecipes } from '../store/store.js';
import { getState } from '../store/coreState.js';

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

export async function saveRootItem(rootItem, uid) {
  try {
    if (!isDbAvailable() || !rootItem || typeof rootItem !== 'object') return { success: false, error: 'Invalid' };
    const safeState = (window.Store && typeof window.Store.getState === 'function') 
      ? window.Store.getState() 
      : (typeof getStoreState === 'function' ? getStoreState() : {});
    const enforced = enforceCategorySSOT({ ingredients: [rootItem], products: (typeof window !== 'undefined' && safeState?.products) || [] });
    const finalItem = enforced.ingredients[0] || rootItem;
    const itemData = { ...finalItem, updatedAt: new Date().toISOString() };
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const itemId = rootItem.id || colRef.doc().id;
    delete itemData.id;
    await colRef.doc(itemId).set(itemData, { merge: true });
    return { success: true, id: itemId };
  } catch (err) { console.error('[RootItemRepository] Save Error:', err); return { success: false, error: err }; }
}

export async function deleteRootItem(rootItemId, uid) {
  try {
    if (!isDbAvailable() || !rootItemId) return { success: false, error: 'Unavailable or missing ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc(rootItemId).delete();
    return { success: true };
  } catch (err) { console.error('[RootItemRepository] Delete Error:', err); return { success: false, error: err }; }
}

// Aliases for backwards compatibility during migration
export const getIngredients = getRootItems;
export const saveIngredient = saveRootItem;
export const deleteIngredient = deleteRootItem;

export async function deleteSubtypeInDb(parentRootItem, unlinkedProducts) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const itemId = parentRootItem.id;
    const itemData = { ...parentRootItem, updatedAt: new Date().toISOString() };
    delete itemData.id;
    batch.set(colRef.doc(itemId), itemData, { merge: true });

    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    for (const prod of unlinkedProducts) {
      const prodId = prod.id;
      const prodData = { ...prod, updatedAt: new Date().toISOString() };
      delete prodData.id;
      batch.set(prodColRef.doc(prodId), prodData, { merge: true });
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in deleteSubtypeInDb:', err);
    throw err;
  }
}

export async function batchResolveSubtypeOrphansInDb(productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    productUpdates.forEach(p => {
      const pId = p.id;
      const pData = { ...p, updatedAt: new Date().toISOString() };
      delete pData.id;
      if (p._delete === true) batch.delete(prodColRef.doc(pId));
      else batch.set(prodColRef.doc(pId), pData, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in batchResolveSubtypeOrphansInDb:', err);
    throw err;
  }
}

export async function batchResolveOrphansWithNewSubtypeInDb(parentRootItem, productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    if (parentRootItem) {
      const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
      const itemId = parentRootItem.id;
      const itemData = { ...parentRootItem, updatedAt: new Date().toISOString() };
      delete itemData.id;
      batch.set(ingColRef.doc(itemId), itemData, { merge: true });
    }
    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    productUpdates.forEach(p => {
      const pId = p.id;
      const pData = { ...p, updatedAt: new Date().toISOString() };
      delete pData.id;
      if (p._delete === true) batch.delete(prodColRef.doc(pId));
      else batch.set(prodColRef.doc(pId), pData, { merge: true });
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in batchResolveOrphansWithNewSubtypeInDb:', err);
    throw err;
  }
}

export async function batchMergeIngredientsInDb(canonicalRootItem, duplicateRootItemId, updatedRecipes, updatedProducts, updatedPlan) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');

    const canonicalData = { ...canonicalRootItem, updatedAt: new Date().toISOString() };
    delete canonicalData.id;
    batch.set(ingColRef.doc(canonicalRootItem.id), canonicalData, { merge: true });
    batch.delete(ingColRef.doc(duplicateRootItemId));

    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    if (Array.isArray(updatedProducts)) {
      updatedProducts.forEach(p => {
        const pId = p.id;
        const pData = { ...p, updatedAt: new Date().toISOString() };
        delete pData.id;
        batch.set(prodColRef.doc(pId), pData, { merge: true });
      });
    }

    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    if (Array.isArray(updatedRecipes)) {
      updatedRecipes.forEach(r => {
        const rId = r.id;
        const rData = { ...r, updatedAt: new Date().toISOString() };
        delete rData.id;
        batch.set(recipeColRef.doc(rId), rData, { merge: true });
      });
    }

    if (updatedPlan && typeof updatedPlan === 'object' && updatedPlan.id) {
      const planColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans');
      const planData = { ...updatedPlan, updatedAt: new Date().toISOString() };
      delete planData.id;
      batch.set(planColRef.doc(updatedPlan.id), planData, { merge: true });
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.error('[RootItemRepository] Error in batchMergeIngredientsInDb:', err);
    throw err;
  }
}
