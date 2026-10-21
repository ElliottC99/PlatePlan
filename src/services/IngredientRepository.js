/**
 * src/services/IngredientRepository.js (v3.37.0)
 * Dedicated Micro-Repository for Ingredient & Sub-type Mutations and Data Access.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { getState as getStoreState, setIngredients, setRecipes } from '../store/store.js';

function isDbAvailable() {
  if (!db) { console.warn('[IngredientRepository] Firestore db instance not initialised.'); return false; }
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

export async function getIngredients(uid) {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const prods = (typeof window !== 'undefined' && getState()?.products) || [];
    return enforceCategorySSOT({ ingredients: raw, products: prods }).ingredients;
  } catch (err) { return []; }
}

export async function saveIngredient(ingredient, uid) {
  try {
    if (!isDbAvailable() || !ingredient || typeof ingredient !== 'object') return { success: false, error: 'Invalid' };
    const enforced = enforceCategorySSOT({ ingredients: [ingredient], products: (typeof window !== 'undefined' && getState()?.products) || [] });
    const finalIng = enforced.ingredients[0] || ingredient;
    const ingData = { ...finalIng, updatedAt: new Date().toISOString() };
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const ingId = ingredient.id || colRef.doc().id;
    delete ingData.id;
    await colRef.doc(ingId).set(ingData, { merge: true });
    return { success: true, id: ingId };
  } catch (err) { console.error('[IngredientRepository] Save Error:', err); return { success: false, error: err }; }
}

export async function deleteIngredient(ingredientId, uid) {
  try {
    if (!isDbAvailable() || !ingredientId) return { success: false, error: 'Unavailable or missing ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc(ingredientId).delete();
    return { success: true };
  } catch (err) { console.error('[IngredientRepository] Delete Error:', err); return { success: false, error: err }; }
}

export async function deleteSubtypeInDb(parentIngredient, unlinkedProducts) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const ingId = parentIngredient.id;
    const ingData = { ...parentIngredient, updatedAt: new Date().toISOString() };
    delete ingData.id;
    batch.set(colRef.doc(ingId), ingData, { merge: true });

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
    console.error('[IngredientRepository] Error in deleteSubtypeInDb:', err);
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
    console.error('[IngredientRepository] Error in batchResolveSubtypeOrphansInDb:', err);
    throw err;
  }
}

export async function batchResolveOrphansWithNewSubtypeInDb(parentIngredient, productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    if (parentIngredient) {
      const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
      const ingId = parentIngredient.id;
      const ingData = { ...parentIngredient, updatedAt: new Date().toISOString() };
      delete ingData.id;
      batch.set(ingColRef.doc(ingId), ingData, { merge: true });
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
    console.error('[IngredientRepository] Error in batchResolveOrphansWithNewSubtypeInDb:', err);
    throw err;
  }
}

export async function batchMergeIngredientsInDb(canonicalIngredient, duplicateIngredientId, updatedRecipes, updatedProducts, updatedPlan) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    batch.delete(ingColRef.doc(duplicateIngredientId));

    const canId = canonicalIngredient.id;
    const canData = { ...canonicalIngredient, updatedAt: new Date().toISOString() };
    delete canData.id;
    batch.set(ingColRef.doc(canId), canData, { merge: true });

    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    updatedRecipes.forEach(r => {
      const rData = { ...r, updatedAt: new Date().toISOString() };
      delete rData.id;
      batch.set(recipeColRef.doc(r.id), rData, { merge: true });
    });

    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    updatedProducts.forEach(p => {
      const pData = { ...p, updatedAt: new Date().toISOString() };
      delete pData.id;
      batch.set(prodColRef.doc(p.id), pData, { merge: true });
    });

    if (updatedPlan) {
      const planDocRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current');
      const planData = { ...updatedPlan, updatedAt: new Date().toISOString() };
      delete planData.id;
      batch.set(planDocRef, planData);
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[IngredientRepository] Error in batchMergeIngredientsInDb:', err);
    throw err;
  }
}

export function subscribeIngredients(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').onSnapshot(
      (snap) => { if (snap?.docs) callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

export async function promoteSubtype(parentId, subtypeId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const parent = ings.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) throw new Error(`Parent ingredient ${parentId} not found or has no subtypes`);

  const subIdx = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIdx < 0) throw new Error(`Subtype ${subtypeId} not found on parent ${parentId}`);

  const [removedSub] = parent.subtypes.splice(subIdx, 1);
  const newRootId = removedSub.id || `ing_${Date.now()}`;
  const newRoot = {
    id: newRootId, name: removedSub.name, category: parent.category || 'Store Cupboard',
    notes: removedSub.notes || '', aliases: Array.isArray(removedSub.aliases) ? removedSub.aliases : [],
    subtypes: [], defaultProductId: removedSub.defaultProductId || null, updatedAt: new Date().toISOString()
  };
  parent.updatedAt = new Date().toISOString();
  ings.push(newRoot);

  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(parentId) && String(item.subtypeId || '') === String(subtypeId)) || String(item.targetId || '') === `${parentId}:${subtypeId}`;
    if (isMatch) {
      item.pantryItemId = String(newRootId); item.ingredientId = String(newRootId);
      item.subtypeId = null; item.subtypeName = null; item.name = newRoot.name;
      return true;
    }
    return false;
  });

  setIngredients(ings); setRecipes(allRecipes);

  if (isDbAvailable()) {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    const parentDoc = { ...parent }; delete parentDoc.id;
    const newRootDoc = { ...newRoot }; delete newRootDoc.id;
    batch.set(ingColRef.doc(String(parentId)), parentDoc, { merge: true });
    batch.set(ingColRef.doc(String(newRootId)), newRootDoc);

    modifiedRecipes.forEach(r => {
      const rData = { ...r }; delete rData.id;
      batch.set(recipeColRef.doc(String(r.id)), rData, { merge: true });
    });
    await batch.commit();
  }
  return { success: true, newRootId, modifiedRecipesCount: modifiedRecipes.length };
}

export async function moveSubtype(oldParentId, subtypeId, newParentId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const oldParent = ings.find(i => String(i.id) === String(oldParentId));
  const newParent = ings.find(i => String(i.id) === String(newParentId));
  if (!oldParent || !Array.isArray(oldParent.subtypes)) throw new Error(`Old parent ${oldParentId} not found`);
  if (!newParent) throw new Error(`New parent ${newParentId} not found`);

  const subIdx = oldParent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIdx < 0) throw new Error(`Subtype ${subtypeId} not found on parent ${oldParentId}`);

  const [movedSub] = oldParent.subtypes.splice(subIdx, 1);
  if (!Array.isArray(newParent.subtypes)) newParent.subtypes = [];
  newParent.subtypes.push(movedSub);
  oldParent.updatedAt = new Date().toISOString(); newParent.updatedAt = new Date().toISOString();

  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(oldParentId) && String(item.subtypeId || '') === String(subtypeId)) || String(item.targetId || '') === `${oldParentId}:${subtypeId}`;
    if (isMatch) {
      item.pantryItemId = String(newParentId); item.ingredientId = String(newParentId);
      item.subtypeId = String(subtypeId); item.name = `${newParent.name} (${movedSub.name})`;
      return true;
    }
    return false;
  });

  setIngredients(ings); setRecipes(allRecipes);

  if (isDbAvailable()) {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    const oldParentDoc = { ...oldParent }; delete oldParentDoc.id;
    const newParentDoc = { ...newParent }; delete newParentDoc.id;
    batch.set(ingColRef.doc(String(oldParentId)), oldParentDoc, { merge: true });
    batch.set(ingColRef.doc(String(newParentId)), newParentDoc, { merge: true });

    modifiedRecipes.forEach(r => {
      const rData = { ...r }; delete rData.id;
      batch.set(recipeColRef.doc(String(r.id)), rData, { merge: true });
    });
    await batch.commit();
  }
  return { success: true, modifiedRecipesCount: modifiedRecipes.length };
}

export async function mergeSubtype(parentId, oldSubtypeId, newSubtypeId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const parent = ings.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) throw new Error(`Parent ingredient ${parentId} not found`);

  const oldSubIdx = parent.subtypes.findIndex(s => String(s.id) === String(oldSubtypeId));
  const newSub = parent.subtypes.find(s => String(s.id) === String(newSubtypeId));
  if (oldSubIdx < 0 || !newSub) throw new Error(`Subtypes for merge not found on parent ${parentId}`);

  const [removedSub] = parent.subtypes.splice(oldSubIdx, 1);
  const targetAliases = new Set(Array.isArray(newSub.aliases) ? newSub.aliases : []);
  if (removedSub.name) targetAliases.add(removedSub.name);
  if (Array.isArray(removedSub.aliases)) removedSub.aliases.forEach(a => targetAliases.add(a));
  newSub.aliases = Array.from(targetAliases);
  parent.updatedAt = new Date().toISOString();

  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(parentId) && String(item.subtypeId || '') === String(oldSubtypeId)) || String(item.targetId || '') === `${parentId}:${oldSubtypeId}`;
    if (isMatch) {
      item.subtypeId = String(newSubtypeId); item.subtypeName = newSub.name;
      item.name = `${parent.name} (${newSub.name})`;
      return true;
    }
    return false;
  });

  setIngredients(ings); setRecipes(allRecipes);

  if (isDbAvailable()) {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    const parentDoc = { ...parent }; delete parentDoc.id;
    batch.set(ingColRef.doc(String(parentId)), parentDoc, { merge: true });

    modifiedRecipes.forEach(r => {
      const rData = { ...r }; delete rData.id;
      batch.set(recipeColRef.doc(String(r.id)), rData, { merge: true });
    });
    await batch.commit();
  }
  return { success: true, modifiedRecipesCount: modifiedRecipes.length };
}
