/**
 * src/services/HouseholdRepository.js (v3.7.4)
 * Dedicated data access repository for household-scoped Firestore operations.
 * Completely isolated from DOM manipulation and UI rendering.
 * All operations target the shared household path 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';

/**
 * Helper to ensure Firestore db instance is available.
 * @returns {boolean}
 */
function isDbAvailable() {
  if (!db) {
    console.warn('[HouseholdRepository v3.7.4] Firestore db instance not initialized.');
    return false;
  }
  return true;
}

/**
 * Fetch all recipes for the shared household.
 * @returns {Promise<Array<Object>>} List of recipe objects with document IDs attached.
 */
export async function getRecipes() {
  try {
    if (!isDbAvailable()) return [];
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
    console.error('[HouseholdRepository v3.7.4] Error fetching recipes:', err);
    return [];
  }
}

/**
 * Persist or update a single recipe document.
 * @param {Object} recipe Recipe data object. Must contain either id or a valid name.
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
export async function saveRecipe(recipe) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!recipe || typeof recipe !== 'object') {
      return { success: false, error: 'Invalid recipe data' };
    }

    const recipeData = { ...recipe, updatedAt: new Date().toISOString() };
    const recipeId = recipe.id || db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc().id;
    delete recipeData.id;

    await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('recipes')
      .doc(recipeId)
      .set(recipeData, { merge: true });

    return { success: true, id: recipeId };
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error saving recipe:', err);
    return { success: false, error: err };
  }
}

/**
 * Delete a recipe document by ID.
 * @param {string} recipeId
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function deleteRecipe(recipeId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!recipeId) return { success: false, error: 'Missing recipe ID' };

    await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('recipes')
      .doc(recipeId)
      .delete();

    return { success: true };
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error deleting recipe:', err);
    return { success: false, error: err };
  }
}

/**
 * Fetch all ingredients for the shared household.
 * @returns {Promise<Array<Object>>} List of ingredient objects with document IDs attached.
 */
export async function getIngredients() {
  try {
    if (!isDbAvailable()) return [];
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
    console.error('[HouseholdRepository v3.7.4] Error fetching ingredients:', err);
    return [];
  }
}

/**
 * Persist or update an ingredient document.
 * @param {Object} ingredient Ingredient data object.
 * @returns {Promise<{success: boolean, id?: string, error?: any}>}
 */
export async function saveIngredient(ingredient) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!ingredient || typeof ingredient !== 'object') {
      return { success: false, error: 'Invalid ingredient data' };
    }

    const ingData = { ...ingredient, updatedAt: new Date().toISOString() };
    const ingId = ingredient.id || db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc().id;
    delete ingData.id;

    await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('ingredients')
      .doc(ingId)
      .set(ingData, { merge: true });

    return { success: true, id: ingId };
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error saving ingredient:', err);
    return { success: false, error: err };
  }
}

/**
 * Delete an ingredient document by ID.
 * @param {string} ingredientId
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function deleteIngredient(ingredientId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!ingredientId) return { success: false, error: 'Missing ingredient ID' };

    await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('ingredients')
      .doc(ingredientId)
      .delete();

    return { success: true };
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error deleting ingredient:', err);
    return { success: false, error: err };
  }
}

/**
 * Fetch household preference settings. Reads from both settings/preferences and root household document.
 * @returns {Promise<Object|null>} Preference settings object.
 */
export async function getPreferences() {
  try {
    if (!isDbAvailable()) return null;

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
    console.error('[HouseholdRepository v3.7.4] Error fetching preferences:', err);
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
    if (!isDbAvailable()) return false;

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

    return true;
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error saving preferences to Firestore:', err);
    return false;
  }
}

/**
 * Fetch current meal plan document for the shared household.
 * @returns {Promise<Object|null>} Current meal plan object with document ID or null.
 */
export async function getCurrentPlan() {
  try {
    if (!isDbAvailable()) return null;
    const docSnap = await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('plans')
      .doc('current')
      .get();

    return docSnap.exists ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error fetching current plan:', err);
    return null;
  }
}

/**
 * Persist current meal plan document to Firestore.
 * @param {Object} plan Meal plan data object
 * @returns {Promise<boolean>} Success status
 */
export async function saveCurrentPlan(plan) {
  try {
    if (!isDbAvailable()) return false;
    if (!plan || typeof plan !== 'object') return false;

    const payload = {
      ...plan,
      updatedAt: new Date().toISOString()
    };

    await db
      .collection('households')
      .doc(HOUSEHOLD_ID)
      .collection('plans')
      .doc('current')
      .set(payload, { merge: true });

    return true;
  } catch (err) {
    console.error('[HouseholdRepository v3.7.4] Error saving current plan:', err);
    return false;
  }
}
