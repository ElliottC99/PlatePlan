/**
 * src/services/HouseholdRepository.js (v3.3.32)
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
      console.warn('[HouseholdRepository v3.3.32] Firestore db instance not initialized.');
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
    console.error('[HouseholdRepository v3.3.32] Error fetching recipes:', err);
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
      console.warn('[HouseholdRepository v3.3.32] Firestore db instance not initialized.');
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
    console.error('[HouseholdRepository v3.3.32] Error fetching ingredients:', err);
    return [];
  }
}

/**
 * Fetch household preference settings. Reads from both settings/preferences and root household document.
 * @returns {Promise<Object|null>} Preference settings object.
 */
export async function getPreferences() {
  try {
    if (!db) {
      console.warn('[HouseholdRepository v3.3.32] Firestore db instance not initialized.');
      return null;
    }

    const [prefSnap, rootSnap] = await Promise.all([
      db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences').get().catch(() => null),
      db.collection('households').doc(HOUSEHOLD_ID).get().catch(() => null)
    ]);

    const prefData = prefSnap && prefSnap.exists ? prefSnap.data() : {};
    const rootData = rootSnap && rootSnap.exists ? rootSnap.data() : {};

    return {
      id: HOUSEHOLD_ID,
      ...rootData,
      ...prefData,
      userPrefs: {
        ...(rootData.userPrefs || {}),
        ...(prefData.userPrefs || {}),
        nutritionTargets: prefData.nutritionTargets || rootData.nutritionTargets || prefData.userPrefs?.nutritionTargets || rootData.userPrefs?.nutritionTargets || null
      },
      settings: {
        ...(rootData.settings || {}),
        ...(prefData.settings || {})
      }
    };
  } catch (err) {
    console.error('[HouseholdRepository v3.3.32] Error fetching preferences:', err);
    return null;
  }
}

/**
 * Save household preferences and 4-meal nutritional targets back to Firestore.
 * @param {Object} userPrefs User preferences object
 * @param {Object} settings System & application settings object
 * @returns {Promise<boolean>} Success status
 */
export async function savePreferences(userPrefs, settings = {}) {
  try {
    if (!db) {
      console.warn('[HouseholdRepository v3.3.32] Firestore db instance not initialized.');
      return false;
    }

    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    const payload = {
      userPrefs: userPrefs || {},
      nutritionTargets: userPrefs?.nutritionTargets || {},
      settings: settings || {},
      updatedAt: new Date().toISOString()
    };

    await Promise.all([
      prefRef.set(payload, { merge: true }),
      rootRef.set(payload, { merge: true })
    ]);

    console.log('[HouseholdRepository v3.3.32] Successfully persisted preferences to Firestore.');
    return true;
  } catch (err) {
    console.error('[HouseholdRepository v3.3.32] Error saving preferences to Firestore:', err);
    return false;
  }
}

/**
 * Fetch current meal plan document for the shared household.
 * @returns {Promise<Object|null>} Current meal plan object with document ID or null.
 */
export async function getCurrentPlan() {
  try {
    if (!db) {
      console.warn('[HouseholdRepository v3.3.32] Firestore db instance not initialized.');
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
    console.error('[HouseholdRepository v3.3.32] Error fetching current plan:', err);
    return null;
  }
}
