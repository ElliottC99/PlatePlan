/**
 * src/services/RecipeRepository.js (v3.38.11)
 * Dedicated Micro-Repository for Recipe Vault storage and CRUD operations.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { safeFirestoreGet } from './HouseholdRepository.js';
import {
  saveRecipe as saveCanonicalRecipe,
  deleteRecipe as deleteCanonicalRecipe,
  deleteRecipeVariant as deleteCanonicalRecipeVariant,
  cleanLegacyMacros
} from './RecipeFirestoreRepository.js';

function isDbAvailable() {
  return Boolean(db && HOUSEHOLD_ID);
}

export async function getRecipes(_uid) {
  try {
    if (!isDbAvailable()) return [];
    // Path remains shared but we accept uid for future-proofing and Auth compliance
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('recipes'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    return raw.map(r => cleanLegacyMacros(r));
  } catch (err) {
    console.warn('[RecipeRepository] Offline or unable to fetch recipes:', err.message || err);
    return [];
  }
}

export async function saveRecipe(recipe, uid) {
  return await saveCanonicalRecipe(recipe, uid);
}

export async function deleteRecipe(recipeId, uid) {
  return await deleteCanonicalRecipe(recipeId, uid);
}

export async function deleteRecipeVariant(recipeId, variantKey = 'enhanced', uid) {
  return await deleteCanonicalRecipeVariant(recipeId, variantKey, uid);
}
