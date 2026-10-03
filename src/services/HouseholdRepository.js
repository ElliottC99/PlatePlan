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

    const profiles = userPrefs?.profiles || (typeof window !== 'undefined' && window.state?.preferences?.profiles) || {};
    const payload = {
      userPrefs: userPrefs || {},
      nutritionTargets: userPrefs?.nutritionTargets || {},
      profiles,
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

let pendingPlanPayload = null;
let planDebounceTimer = null;
let planResolveQueue = [];

/**
 * Persist current meal plan document to Firestore with 600ms debounce queue.
 */
export async function saveCurrentPlan(plan) {
  if (!plan || typeof plan !== 'object') return false;
  pendingPlanPayload = {
    ...plan,
    updatedAt: new Date().toISOString()
  };

  return new Promise((resolve) => {
    planResolveQueue.push(resolve);
    if (planDebounceTimer) clearTimeout(planDebounceTimer);

    planDebounceTimer = setTimeout(async () => {
      planDebounceTimer = null;
      const payload = pendingPlanPayload;
      const resolvers = [...planResolveQueue];
      planResolveQueue = [];

      try {
        if (!isDbAvailable()) {
          resolvers.forEach(res => res(false));
          return;
        }
        await db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current').set(payload, { merge: true });
        resolvers.forEach(res => res(true));
      } catch (err) {
        console.warn('[HouseholdRepository v3.14.3] Unable to save current plan to cloud (offline):', err.message || err);
        resolvers.forEach(res => res(false));
      }
    }, 600);
  });
}

export const savePlan = saveCurrentPlan;

/**
 * Fetch all products for the shared household.
 */
export async function getProducts() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    const snap = await safeFirestoreGet(colRef);
    if (!snap || !snap.docs) return [];
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[HouseholdRepository] Offline or unable to fetch products:', err.message || err);
    return [];
  }
}

/**
 * Persist or update a product document.
 */
export async function saveProduct(product) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!product || typeof product !== 'object') return { success: false, error: 'Invalid product data' };

    const prodData = { ...product, updatedAt: new Date().toISOString() };
    const prodId = product.id || db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc().id;
    delete prodData.id;

    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(prodId).set(prodData, { merge: true });
    return { success: true, id: prodId };
  } catch (err) {
    console.warn('[HouseholdRepository] Unable to save product to cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Delete a product document by ID.
 */
export async function deleteProduct(productId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!productId) return { success: false, error: 'Missing product ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(productId).delete();
    return { success: true };
  } catch (err) {
    console.warn('[HouseholdRepository] Unable to delete product from cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

/**
 * Real-time listener for ingredients collection.
 */
export function subscribeIngredients(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients')
      .onSnapshot(
        (snap) => {
          if (!snap || !snap.docs) return;
          const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(items);
        },
        (err) => {
          console.warn('[Firestore] Connection stream interrupted, auto-reconnecting...', err?.message || err);
          if (typeof errorCallback === 'function') errorCallback(err);
        }
      );
  } catch (e) {
    return () => {};
  }
}

/**
 * Real-time listener for products collection.
 */
export function subscribeProducts(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('products')
      .onSnapshot(
        (snap) => {
          if (!snap || !snap.docs) return;
          const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(items);
        },
        (err) => {
          console.warn('[Firestore] Connection stream interrupted, auto-reconnecting...', err?.message || err);
          if (typeof errorCallback === 'function') errorCallback(err);
        }
      );
  } catch (e) {
    return () => {};
  }
}

/**
 * Fetch categories with database seeding on initial app setup.
 */
export async function getCategories() {
  try {
    if (!isDbAvailable()) return [];
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    const snap = await safeFirestoreGet(docRef);
    if (snap && snap.exists) {
      const data = snap.data();
      if (Array.isArray(data?.categories) && data.categories.length > 0) {
        return data.categories;
      }
    }
    // Database seeding on initial app setup if 0 existing categories
    const defaultCategories = [
      'Bakery', 'Baking', 'Beverages', 'Carbs', 'Dairy & Eggs', 'Drinks', 'Frozen',
      'Fruit & Vegetables', 'General', 'Grains, Legumes & Pulses', 'Herbs & Spices',
      'Meat & Seafood', 'Meat Substitutes', 'Nuts & Seeds', 'Other', 'Pantry',
      'Produce', 'Proteins', 'Store Cupboard'
    ];
    await docRef.set({ categories: defaultCategories, updatedAt: new Date().toISOString() });
    return defaultCategories;
  } catch (err) {
    console.warn('[HouseholdRepository] Error fetching categories, using minimal fallback:', err);
    return ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'General'];
  }
}

/**
 * Save categories back to Firestore.
 */
export async function saveCategories(categories) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    await docRef.set({ categories: categories || [], updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch (err) {
    console.warn('[HouseholdRepository] Error saving categories:', err);
    return { success: false, error: err };
  }
}

