/**
 * src/services/RecipeFirestoreRepository.js
 * Repository for recipe and meal plan Firestore operations.
 */
import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { stripPlanPayload } from '../models/MealPlannerModel.js';
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

export function isDbAvailable() {
  if (!db) {
    console.warn('[RecipeFirestoreRepository] Firestore db instance not initialised.');
    return false;
  }
  return true;
}

export async function safeFirestoreGet(ref, timeoutMs = 2500) {
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


export async function getCurrentPlan() {
  try {
    if (!isDbAvailable()) return null;
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current');
    const docSnap = await safeFirestoreGet(docRef);
    return (docSnap && docSnap.exists) ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.warn('[RecipeFirestoreRepository] Offline or unable to fetch current plan:', err.message || err);
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
        console.warn('[RecipeFirestoreRepository] Unable to save sanitised plan to cloud (offline):', err.message || err);
        resolvers.forEach(res => res(false));
      }
    }, 600);
  });
}

export const savePlan = saveCurrentPlan;

export function subscribeRecipes(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').onSnapshot(
      (snap) => {
        if (snap?.docs) {
          const raw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          callback(raw.map(cleanLegacyMacros));
        }
      },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

export function subscribeCurrentPlan(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current').onSnapshot(
      (docSnap) => {
        if (docSnap && docSnap.exists) {
          callback({ id: docSnap.id, ...docSnap.data() });
        }
      },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

export async function saveRecipe(recipe, _uid) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!recipe || typeof recipe !== 'object') return { success: false, error: 'Invalid recipe data' };
    const cleanedRecipe = cleanLegacyMacros(recipe);
    const recipeData = { ...cleanedRecipe, schemaVersion: 2, updatedAt: new Date().toISOString() };
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const recipeId = recipe.id || colRef.doc().id;
    delete recipeData.id;
    await colRef.doc(String(recipeId)).set(recipeData, { merge: true });
    return { success: true, id: recipeId };
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Save Error:', err);
    return { success: false, error: err };
  }
}

export async function deleteRecipe(recipeId, _uid) {
  try {
    if (!isDbAvailable() || !recipeId) return { success: false, error: 'Unavailable or missing ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(String(recipeId)).delete();
    return { success: true };
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Delete Error:', err);
    return { success: false, error: err };
  }
}

export async function recalibrateRecipeMacrosAndDismissAdvisoriesInDb(recipe, advisoryKeysToDismiss) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const recipeId = recipe.id;
    const recipeData = { ...recipe, schemaVersion: 2, updatedAt: new Date().toISOString() };
    delete recipeData.id;
    const recipeDocRef = recipeColRef.doc(recipeId);
    batch.set(recipeDocRef, recipeData, { merge: true });

    let unionVal;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
      unionVal = window.firebase.firestore.FieldValue.arrayUnion(...advisoryKeysToDismiss);
    } else {
      unionVal = advisoryKeysToDismiss;
    }

    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    batch.set(prefRef, { dismissedQualityAdvisories: unionVal }, { merge: true });
    batch.set(rootRef, { dismissedQualityAdvisories: unionVal }, { merge: true });

    await batch.commit();
    return true;
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Error in recalibrateRecipeMacrosAndDismissAdvisoriesInDb:', err);
    throw err;
  }
}

export async function batchRecalibrateRecipesInDb(recipeUpdates, advisoryKeysToDismiss) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    recipeUpdates.forEach(r => {
      const rId = r.id;
      const rData = { ...r, schemaVersion: 2, updatedAt: new Date().toISOString() };
      delete rData.id;
      const rDocRef = recipeColRef.doc(rId);
      batch.set(rDocRef, rData, { merge: true });
    });

    if (advisoryKeysToDismiss && advisoryKeysToDismiss.length > 0) {
      let unionVal;
      if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
        unionVal = window.firebase.firestore.FieldValue.arrayUnion(...advisoryKeysToDismiss);
      } else {
        unionVal = advisoryKeysToDismiss;
      }

      const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
      const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

      batch.set(prefRef, { dismissedQualityAdvisories: unionVal }, { merge: true });
      batch.set(rootRef, { dismissedQualityAdvisories: unionVal }, { merge: true });
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Error in batchRecalibrateRecipesInDb:', err);
    throw err;
  }
}

export async function batchUpdateRecipesInDb(recipeUpdates) {
  if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
  if (!Array.isArray(recipeUpdates) || recipeUpdates.length === 0) return { success: true, count: 0 };
  try {
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const chunkSize = 400;
    for (let i = 0; i < recipeUpdates.length; i += chunkSize) {
      const chunk = recipeUpdates.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach(r => {
        const rId = r.id;
        const rData = { ...r, schemaVersion: 2, updatedAt: new Date().toISOString() };
        delete rData.id;
        const rDocRef = recipeColRef.doc(rId);
        batch.set(rDocRef, rData, { merge: true });
      });
      await batch.commit();
    }
    return { success: true, count: recipeUpdates.length };
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Error in batchUpdateRecipesInDb:', err);
    throw err;
  }
}
