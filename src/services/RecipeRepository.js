/**
 * src/services/RecipeRepository.js (v3.38.11)
 * Dedicated Micro-Repository for Recipe Vault storage and CRUD operations.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { safeFirestoreGet } from './HouseholdRepository.js';
import {
  saveRecipe as saveCanonicalRecipe,
  deleteRecipe as deleteCanonicalRecipe
} from './RecipeFirestoreRepository.js';

function isDbAvailable() {
  return Boolean(db && HOUSEHOLD_ID);
}

function cleanLegacyMacros(recipe) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  const cloned = { ...recipe };
  if (cloned.macros && typeof cloned.macros === 'object') {
    cloned.calories = cloned.calories ?? cloned.macros.calories ?? cloned.macros.kcal ?? 0;
    cloned.protein = cloned.protein ?? cloned.macros.protein ?? cloned.macros.prot ?? 0;
    cloned.carbs = cloned.carbs ?? cloned.macros.carbs ?? cloned.macros.carb ?? 0;
    cloned.fat = cloned.fat ?? cloned.macros.fat ?? 0;
  }
  return cloned;
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
