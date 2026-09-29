/**
 * src/services/HouseholdRepository.js (v3.8.3)
 * Dedicated data access repository for household-scoped Firestore operations.
 * Completely isolated from DOM manipulation and UI rendering.
 * All operations target the shared household path 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';

function isDbAvailable() {
  if (!db) {
    console.warn('[HouseholdRepository v3.8.3] Firestore db instance not initialized.');
    return false;
  }
  return true;
}

/**
 * Safely execute a get() request against Firestore with fast timeout & local offline cache fallback.
 * Prevents throwing unhandled offline rejection errors when offline.
 */
async function safeFirestoreGet(ref, timeoutMs = 2500) {
  if (!ref || typeof ref.get !== 'function') return null;
  try {
    const netPromise = ref.get();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore get timeout (offline mode)')), timeoutMs)
    );
    return await Promise.race([netPromise, timeoutPromise]);
  } catch (_netErr) {
    try {
      return await ref.get({ source: 'cache' });
    } catch (_cacheErr) {
      return null;
    }
  }
}

/**
 * Fetch all recipes for the shared household.
 */
export async function getRecipes() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const snap = await safeFirestoreGet(colRef);
    if (!snap || !snap.docs) return [];
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Offline or unable to fetch recipes:', err.message || err);
    return [];
  }
}

/**
 * Persist or update a single recipe document.
 */
export async function saveRecipe(recipe) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!recipe || typeof recipe !== 'object') return { success: false, error: 'Invalid recipe data' };

    const recipeData = { ...recipe, updatedAt: new Date().toISOString() };
    const recipeId = recipe.id || db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc().id;
    delete recipeData.id;

    await db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(recipeId).set(recipeData, { merge: true });
    return { success: true, id: recipeId };
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Unable to save recipe to cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Delete a recipe document by ID.
 */
export async function deleteRecipe(recipeId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!recipeId) return { success: false, error: 'Missing recipe ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(recipeId).delete();
    return { success: true };
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Unable to delete recipe from cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Fetch all ingredients for the shared household.
 */
export async function getIngredients() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const snap = await safeFirestoreGet(colRef);
    if (!snap || !snap.docs) return [];
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Offline or unable to fetch ingredients:', err.message || err);
    return [];
  }
}

/**
 * Persist or update an ingredient document.
 */
export async function saveIngredient(ingredient) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!ingredient || typeof ingredient !== 'object') return { success: false, error: 'Invalid ingredient data' };

    const ingData = { ...ingredient, updatedAt: new Date().toISOString() };
    const ingId = ingredient.id || db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc().id;
    delete ingData.id;

    await db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc(ingId).set(ingData, { merge: true });
    return { success: true, id: ingId };
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Unable to save ingredient to cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Delete an ingredient document by ID.
 */
export async function deleteIngredient(ingredientId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!ingredientId) return { success: false, error: 'Missing ingredient ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc(ingredientId).delete();
    return { success: true };
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Unable to delete ingredient from cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Fetch household preference settings. Reads from both settings/preferences and root household document.
 */
export async function getPreferences() {
  try {
    if (!isDbAvailable()) return null;
    const [prefSnap, rootSnap] = await Promise.all([
      safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences')),
      safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID))
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
    console.warn('[HouseholdRepository v3.8.3] Offline or unable to fetch preferences:', err.message || err);
    return null;
  }
}

/**
 * Save household preferences and 4-meal nutritional targets back to Firestore.
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
    console.warn('[HouseholdRepository v3.8.3] Unable to save preferences to cloud (offline):', err.message || err);
    return false;
  }
}

/**
 * Fetch current meal plan document for the shared household.
 */
export async function getCurrentPlan() {
  try {
    if (!isDbAvailable()) return null;
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current');
    const docSnap = await safeFirestoreGet(docRef);
    return (docSnap && docSnap.exists) ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Offline or unable to fetch current plan:', err.message || err);
    return null;
  }
}

/**
 * Persist current meal plan document to Firestore.
 */
export async function saveCurrentPlan(plan) {
  try {
    if (!isDbAvailable()) return false;
    if (!plan || typeof plan !== 'object') return false;

    const payload = {
      ...plan,
      updatedAt: new Date().toISOString()
    };

    await db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current').set(payload, { merge: true });
    return true;
  } catch (err) {
    console.warn('[HouseholdRepository v3.8.3] Unable to save current plan to cloud (offline):', err.message || err);
    return false;
  }
}

