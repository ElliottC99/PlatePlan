/**
 * src/services/HouseholdRepository.js (v3.20.14)
 * Dedicated data access repository for household-scoped Firestore operations.
 * Completely isolated from DOM manipulation and UI rendering.
 * All operations target the shared household path 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { stripPlanPayload } from '../models/MealPlannerModel.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';

export { stripPlanPayload };

/**
 * Migration & schema normalisation utility to purge legacy root macro shorthands (.cal, .prot)
 * in favour of the structured recipe.macros object.
 */
export function cleanLegacyMacros(target) {
  if (!target) return target;
  if (Array.isArray(target)) {
    return target.map(cleanLegacyMacros);
  }
  if (typeof target === 'object') {
    const r = { ...target };
    if (r.macros || r.calories !== undefined || r.cal !== undefined || r.protein !== undefined || r.prot !== undefined) {
      const cal = r.macros?.calories ?? r.macros?.cal ?? r.calories ?? r.cal ?? 0;
      const prot = r.macros?.protein ?? r.macros?.prot ?? r.protein ?? r.prot ?? 0;
      const carb = r.macros?.carbs ?? r.macros?.carb ?? r.carbs ?? r.carb ?? 0;
      const fat = r.macros?.fat ?? r.fat ?? 0;
      const price = r.macros?.price ?? r.price ?? r.cost ?? 0;

      r.macros = {
        calories: Number(cal) || 0,
        protein: Number(prot) || 0,
        carbs: Number(carb) || 0,
        fat: Number(fat) || 0,
        price: Number(price) || 0
      };

      delete r.cal;
      delete r.calories;
      delete r.prot;
      delete r.protein;
      delete r.carb;
      delete r.carbs;
      delete r.fat;
    }
    return r;
  }
  return target;
}

function isDbAvailable() {
  if (!db) {
    console.warn('[HouseholdRepository v3.20.09] Firestore db instance not initialised.');
    return false;
  }
  return true;
}

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

export async function getRecipes() {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('recipes'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    return raw.map(r => cleanLegacyMacros(r));
  } catch (err) {
    console.warn('[HouseholdRepository v3.20.09] Offline or unable to fetch recipes:', err.message || err);
    return [];
  }
}

export async function saveRecipe(recipe) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!recipe || typeof recipe !== 'object') return { success: false, error: 'Invalid recipe data' };
    const cleanedRecipe = cleanLegacyMacros(recipe);
    const recipeData = { ...cleanedRecipe, updatedAt: new Date().toISOString() };
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const recipeId = recipe.id || colRef.doc().id;
    delete recipeData.id;
    await colRef.doc(recipeId).set(recipeData, { merge: true });
    return { success: true, id: recipeId };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function deleteRecipe(recipeId) {
  try {
    if (!isDbAvailable() || !recipeId) return { success: false, error: 'Unavailable or missing ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(recipeId).delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function getIngredients() {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const prods = (typeof window !== 'undefined' && window.state?.products) || [];
    const enforced = enforceCategorySSOT({ ingredients: raw, products: prods });
    return enforced.ingredients;
  } catch (err) {
    return [];
  }
}

export async function saveIngredient(ingredient) {
  try {
    if (!isDbAvailable() || !ingredient || typeof ingredient !== 'object') return { success: false, error: 'Invalid' };
    const enforced = enforceCategorySSOT({ ingredients: [ingredient], products: (typeof window !== 'undefined' && window.state?.products) || [] });
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
    console.warn('[HouseholdRepository v3.19.78] Offline or unable to fetch preferences:', err.message || err);
    return null;
  }
}

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
      settings: settings || userPrefs?.settings || {},
      updatedAt: new Date().toISOString()
    };
    await Promise.all([
      prefRef.set(payload, { merge: true }),
      rootRef.set(payload, { merge: true })
    ]);
    return true;
  } catch (err) {
    console.warn('[HouseholdRepository v3.19.78] Unable to save preferences to cloud (offline):', err.message || err);
    return false;
  }
}

export async function getCurrentPlan() {
  try {
    if (!isDbAvailable()) return null;
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current');
    const docSnap = await safeFirestoreGet(docRef);
    return (docSnap && docSnap.exists) ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.warn('[HouseholdRepository v3.19.78] Offline or unable to fetch current plan:', err.message || err);
    return null;
  }
}

let pendingPlanPayload = null;
let planDebounceTimer = null;
let planResolveQueue = [];

export async function saveCurrentPlan(plan) {
  if (!plan || typeof plan !== 'object') return false;
  const sanitisedPlan = stripPlanPayload(plan);
  pendingPlanPayload = {
    ...sanitisedPlan,
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
        await db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current').set(payload);
        resolvers.forEach(res => res(true));
      } catch (err) {
        console.warn('[HouseholdRepository v3.19.78] Unable to save sanitised plan to cloud (offline):', err.message || err);
        resolvers.forEach(res => res(false));
      }
    }, 600);
  });
}

export const savePlan = saveCurrentPlan;

export async function getProducts() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    const snap = await safeFirestoreGet(colRef);
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const ings = (typeof window !== 'undefined' && window.state?.ingredients) || [];
    const enforced = enforceCategorySSOT({ ingredients: ings, products: raw });
    return enforced.products;
  } catch (err) {
    console.warn('[HouseholdRepository] Offline or unable to fetch products:', err.message || err);
    return [];
  }
}

export async function saveProduct(product) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!product || typeof product !== 'object') return { success: false, error: 'Invalid product data' };
    const enforced = enforceCategorySSOT({ ingredients: (typeof window !== 'undefined' && window.state?.ingredients) || [], products: [product] });
    const finalProd = enforced.products[0] || product;
    const prodData = { ...finalProd, updatedAt: new Date().toISOString() };
    const prodId = product.id || db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc().id;
    delete prodData.id;
    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(prodId).set(prodData, { merge: true });
    return { success: true, id: prodId };
  } catch (err) {
    console.warn('[HouseholdRepository] Unable to save product to cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

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

export function subscribeIngredients(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').onSnapshot(
      (snap) => { if (snap?.docs) callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

export function subscribeProducts(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('products').onSnapshot(
      (snap) => { if (snap?.docs) callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

export async function getCategories() {
  try {
    if (!isDbAvailable()) return [];
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    const snap = await safeFirestoreGet(docRef);
    if (snap && snap.exists) {
      const data = snap.data();
      if (Array.isArray(data?.categories) && data.categories.length > 0) return data.categories;
    }
    const defaultCategories = [
      'Bakery', 'Baking', 'Beverages', 'Carbs', 'Dairy & Eggs', 'Drinks', 'Frozen',
      'Fruit & Vegetables', 'General', 'Grains, Legumes & Pulses', 'Herbs & Spices',
      'Meat & Seafood', 'Meat Substitutes', 'Nuts & Seeds', 'Other', 'Pantry',
      'Produce', 'Proteins', 'Store Cupboard'
    ];
    await docRef.set({ categories: defaultCategories, updatedAt: new Date().toISOString() });
    return defaultCategories;
  } catch (err) {
    return ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'General'];
  }
}

export async function saveCategories(categories) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    await docRef.set({ categories: categories || [], updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function save(state = {}) {
  const promises = [];
  if (Array.isArray(state.ingredients)) {
    state.ingredients.forEach(i => promises.push(saveIngredient(i)));
  }
  if (Array.isArray(state.products)) {
    state.products.forEach(p => promises.push(saveProduct(p)));
  }
  if (Array.isArray(state.categories)) {
    promises.push(saveCategories(state.categories));
  }
  return Promise.all(promises);
}

export const saveHouseholdState = save;
