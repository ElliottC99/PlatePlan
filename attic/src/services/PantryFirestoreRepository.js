import { getState } from '../store/coreState.js';
import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { isDbAvailable } from './FirestoreUtils.js';
import { safeFirestoreGet } from './HouseholdRepository.js';
import {
  saveRootItem as saveCanonicalIngredient,
  deleteRootItem as deleteCanonicalIngredient
} from './PantryTaxonomyService.js';

export async function getIngredients() {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const prods = (typeof window !== 'undefined' && getState()?.products) || [];
    const enforced = enforceCategorySSOT({ ingredients: raw, products: prods });
    return enforced.ingredients;
  } catch (err) {
    console.warn('[PantryFirestoreRepository] getIngredients error:', err);
    return [];
  }
}

export async function saveIngredient(ingredient) {
  return await saveCanonicalIngredient(ingredient);
}

export async function deleteIngredient(ingredientId) {
  return await deleteCanonicalIngredient(ingredientId);
}
