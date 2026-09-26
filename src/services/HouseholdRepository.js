/**
 * src/services/HouseholdRepository.js
 * Dedicated data access repository for household-scoped Firestore queries.
 * Quarantines database interactions away from UI components and standard state logic.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';

/**
 * Fetch all recipes for the shared household.
 * @returns {Promise<Array<Object>>} List of recipe objects with document IDs attached.
 */
export async function getRecipes() {
  try {
    if (!db) {
      console.warn('[HouseholdRepository] Firestore db instance not initialized.');
      return [];
    }
    const snap = await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('recipes')
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error('[HouseholdRepository] Error fetching recipes:', err);
    return [];
  }
}

/**
 * Fetch all ingredients for the shared household.
 * @returns {Promise<Array<Object>>} List of ingredient objects with document IDs attached.
 */
export async function getIngredients() {
  try {
    if (!db) {
      console.warn('[HouseholdRepository] Firestore db instance not initialized.');
      return [];
    }
    const snap = await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('ingredients')
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error('[HouseholdRepository] Error fetching ingredients:', err);
    return [];
  }
}

/**
 * Fetch household preference settings.
 * @returns {Promise<Object|null>} Preference settings object with document ID or null.
 */
export async function getPreferences() {
  try {
    if (!db) {
      console.warn('[HouseholdRepository] Firestore db instance not initialized.');
      return null;
    }
    const docSnap = await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('settings')
      .doc('preferences')
      .get();

    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.error('[HouseholdRepository] Error fetching preferences:', err);
    return null;
  }
}

/**
 * Fetch current meal plan document for the shared household.
 * @returns {Promise<Object|null>} Current meal plan object with document ID or null.
 */
export async function getCurrentPlan() {
  try {
    if (!db) {
      console.warn('[HouseholdRepository] Firestore db instance not initialized.');
      return null;
    }
    const docSnap = await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('plans')
      .doc('current')
      .get();

    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.error('[HouseholdRepository] Error fetching current plan:', err);
    return null;
  }
}
