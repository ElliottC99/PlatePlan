import { getState } from '../store/coreState.js';
import store from "../store/store.js";
import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { isDbAvailable } from './FirestoreUtils.js';
import { safeFirestoreGet } from './HouseholdRepository.js'; // This will be needed until I move safeFirestoreGet

export async function getIngredients() {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const prods = (typeof window !== 'undefined' && getState()?.products) || [];
    const enforced = enforceCategorySSOT({ ingredients: raw, products: prods });
    return enforced.ingredients;
  } catch (err) {
    return [];
  }
}

export async function saveIngredient(ingredient) {
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
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteIngredient(ingredientId) {
  try {
    if (!isDbAvailable() || !ingredientId) return { success: false, error: 'Unavailable or missing ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc(ingredientId).delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}
