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

/**
 * Recursively removes undefined fields from an object or array to ensure safe
 * compatibility with Firestore document writes without throwing 'Unsupported field value: undefined'.
 * Top-level undefined properties become null; nested undefined properties are deleted.
 * @param {*} val 
 * @param {boolean} [isRoot=true]
 * @returns {*}
 */
export function sanitizeForFirestore(val, isRoot = true) {
  if (val === undefined) return isRoot ? null : undefined;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(item => {
      const cleaned = sanitizeForFirestore(item, false);
      return cleaned === undefined ? null : cleaned;
    });
  }
  const clean = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      const sanitizedChild = sanitizeForFirestore(v, false);
      if (sanitizedChild !== undefined) {
        clean[k] = sanitizedChild;
      }
    } else if (k === 'enhanced' || k === 'sourceUrl' || k === 'sourceBook' || k === 'sourcePage') {
      clean[k] = null;
    }
  }
  return clean;
}

export async function saveRecipe(recipe, _uid) {
  try {
    if (!isDbAvailable()) return { success: false, offline: true, error: 'Database unavailable' };
    if (!recipe || typeof recipe !== 'object') return { success: false, error: 'Invalid recipe data' };
    const cleanedRecipe = cleanLegacyMacros(recipe);
    const recipeData = { ...cleanedRecipe, schemaVersion: 2, updatedAt: new Date().toISOString() };
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const recipeId = recipe.id || colRef.doc().id;
    delete recipeData.id;
    const sanitizedData = sanitizeForFirestore(recipeData);
    await colRef.doc(String(recipeId)).set(sanitizedData, { merge: true });
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

export async function deleteRecipeVariant(recipeId, variantKey = 'enhanced') {
  try {
    if (!isDbAvailable() || !recipeId) return { success: false, error: 'Unavailable or missing ID' };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(String(recipeId));

    let deleteField = null;
    if (typeof window !== 'undefined' && window.firebase?.firestore?.FieldValue?.delete) {
      deleteField = window.firebase.firestore.FieldValue.delete();
    } else if (db && db.app && typeof db.app.firestore?.FieldValue?.delete === 'function') {
      deleteField = db.app.firestore.FieldValue.delete();
    }

    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (variantKey === 'enhanced') {
      if (deleteField) {
        updates.enhanced = deleteField;
        updates.enhancedFitScore = deleteField;
      } else {
        updates.enhanced = null;
        updates.enhancedFitScore = null;
      }
      updates._bestVariant = 'original';
    }

    await docRef.update(updates);
    return { success: true };
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Delete Variant Error:', err);
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

// Adds a recipe write to a batch the caller commits, stamped and merged as batchUpdateRecipesInDb does.
export function addRecipeToBatch(batch, recipe) {
  const rData = { ...recipe, schemaVersion: 2, updatedAt: new Date().toISOString() };
  delete rData.id;
  batch.set(db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(String(recipe.id)), rData, { merge: true });
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

/**
 * Normalizes a recipe title into a canonical matching key:
 * - NFC-normalized, lowercased, trimmed
 * - Strips trailing (Copy) and (Enhanced) parentheticals
 * - Replaces non-alphanumeric chars with spaces and collapses whitespace
 */
export function normalizeRecipeTitleKey(title) {
  let s = String(title || '').normalize('NFC').toLowerCase().trim();
  while (/\s*\((?:copy(?:\s*\d+)?|enhanced)\)\s*$/i.test(s)) {
    s = s.replace(/\s*\((?:copy(?:\s*\d+)?|enhanced)\)\s*$/i, '').trim();
  }
  return s
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates completeness and quality score for a recipe candidate:
 * Prefers recipes with enhanced variants, more linked ingredientIds, favourites, and newer updatedAt.
 */
export function scoreRecipeCompleteness(recipe, favVariantIds = []) {
  if (!recipe || typeof recipe !== 'object') return { score: 0 };
  const r = recipe.recipe || recipe;
  const hasEnhanced = Boolean(r.enhanced && (typeof r.enhanced === 'object'));
  
  const ings = Array.isArray(r.ingredients) ? r.ingredients : [];
  const linkedIngCount = ings.filter(i => i && (i.ingredientId || i.pantryItemId || i.productId || i.bankId)).length;
  const totalIngCount = ings.length;
  
  const hasMethod = Boolean((r.methodSteps && r.methodSteps.length) || (r.instructions && r.instructions.length) || r.method);
  
  const rId = String(r.id || '');
  const isFav = Boolean(
    r.isFavourite || r.isFavorite ||
    (Array.isArray(favVariantIds) && (favVariantIds.includes(`${rId}_original`) || favVariantIds.includes(`${rId}_enhanced`)))
  );

  const rawUpdatedMs = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
  const updatedMs = Number.isFinite(rawUpdatedMs) ? rawUpdatedMs : 0;
  const score = (hasEnhanced ? 1000 : 0) +
                (linkedIngCount * 10) +
                (totalIngCount * 1) +
                (hasMethod ? 10 : 0) +
                (isFav ? 50 : 0) +
                (updatedMs > 0 ? (updatedMs / 1e12) : 0);

  return {
    score,
    hasEnhanced,
    linkedIngCount,
    totalIngCount,
    isFav,
    updatedAt: r.updatedAt || null
  };
}

/**
 * Groups a collection of recipes into duplicate clusters matching normalized title key.
 * Returns only clusters with >1 member, sorted by completeness score descending.
 */
export function findDuplicateRecipeClusters(recipes = [], favVariantIds = []) {
  if (!Array.isArray(recipes)) return [];
  const clusterMap = new Map();

  recipes.forEach(rec => {
    if (!rec) return;
    const key = normalizeRecipeTitleKey(rec.name || rec.title);
    if (!key) return;
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key).push(rec);
  });

  const result = [];
  clusterMap.forEach((members, key) => {
    if (members.length > 1) {
      const variants = members.map(m => {
        const stats = scoreRecipeCompleteness(m, favVariantIds);
        return {
          ...m,
          _completenessScore: stats.score,
          _stats: stats
        };
      });
      variants.sort((a, b) => (b._completenessScore - a._completenessScore) || String(a.id).localeCompare(String(b.id)));
      result.push({
        key,
        title: variants[0].name || variants[0].title || key,
        variants
      });
    }
  });

  return result;
}

/**
 * Searches for an existing recipe matching the normalized title.
 */
export function findExistingRecipeByTitle(recipes = [], title, excludeId = null) {
  if (!Array.isArray(recipes) || !title) return null;
  const targetKey = normalizeRecipeTitleKey(title);
  if (!targetKey) return null;
  return recipes.find(r => {
    if (!r) return false;
    if (excludeId && String(r.id) === String(excludeId)) return false;
    return normalizeRecipeTitleKey(r.name || r.title) === targetKey;
  }) || null;
}

/**
 * Re-points all references to duplicate recipe IDs in Meal Plan slots & skeletonGrid to canonicalId.
 */
export function repointMealPlanRecipeIds(plan, skeletonGrid, duplicateIdMap = {}) {
  let modified = false;
  const cleanPlan = plan ? JSON.parse(JSON.stringify(plan)) : null;
  const cleanSkeleton = skeletonGrid ? JSON.parse(JSON.stringify(skeletonGrid)) : null;

  const replaceId = (id) => {
    if (!id) return id;
    const strId = String(id);
    if (duplicateIdMap[strId]) {
      modified = true;
      return duplicateIdMap[strId];
    }
    return id;
  };

  const processSlot = (slot) => {
    if (!slot || typeof slot !== 'object') return;
    if (slot.recipeId) slot.recipeId = replaceId(slot.recipeId);
    if (slot.id) slot.id = replaceId(slot.id);
    if (slot.elliott && typeof slot.elliott === 'object') {
      if (slot.elliott.recipeId) slot.elliott.recipeId = replaceId(slot.elliott.recipeId);
      if (slot.elliott.id) slot.elliott.id = replaceId(slot.elliott.id);
    }
    if (slot.chloe && typeof slot.chloe === 'object') {
      if (slot.chloe.recipeId) slot.chloe.recipeId = replaceId(slot.chloe.recipeId);
      if (slot.chloe.id) slot.chloe.id = replaceId(slot.chloe.id);
    }
  };

  if (cleanPlan && cleanPlan.slots && typeof cleanPlan.slots === 'object') {
    Object.values(cleanPlan.slots).forEach(dayObj => {
      if (dayObj && typeof dayObj === 'object') {
        Object.values(dayObj).forEach(processSlot);
      }
    });
  }

  if (cleanPlan && Array.isArray(cleanPlan.days)) {
    cleanPlan.days.forEach(day => {
      if (day && Array.isArray(day.meals)) {
        day.meals.forEach(m => {
          if (m && m.recipeId) m.recipeId = replaceId(m.recipeId);
        });
      }
    });
  }

  if (cleanSkeleton && typeof cleanSkeleton === 'object') {
    Object.values(cleanSkeleton).forEach(dayVal => {
      if (!dayVal || typeof dayVal !== 'object') return;
      if (dayVal.breakfast || dayVal.lunch || dayVal.dinner) {
        ['breakfast', 'lunch', 'dinner'].forEach(m => processSlot(dayVal[m]));
      } else {
        processSlot(dayVal);
      }
    });
  }

  return { modified, plan: cleanPlan, skeletonGrid: cleanSkeleton };
}

/**
 * Consolidates a duplicate cluster into a canonical recipe:
 * - Adopts any enhanced variant from duplicates if canonical lacks one
 * - Unions mealSuitability and types
 * - Adopts source metadata if missing
 * - Preserves favourite status & migrates favouriteVariantIds
 * - Re-points active Meal Plan slots in currentPlan & skeletonGrid
 * - Persists merged canonical recipe & deletes duplicate recipe documents from Firestore
 */
export async function mergeDuplicateRecipeCluster(clusterMembers, chosenCanonicalId = null, options = {}) {
  const members = Array.isArray(clusterMembers) ? clusterMembers : (clusterMembers?.variants || []);
  if (members.length < 2) return { success: true, count: 0 };

  const targetId = chosenCanonicalId ? String(chosenCanonicalId) : String(members[0].id);
  const canonical = members.find(r => String(r.id) === targetId) || members[0];
  const duplicatesToDelete = members.filter(r => String(r.id) !== String(canonical.id));
  if (duplicatesToDelete.length === 0) return { success: true, count: 0 };

  // 1. Merge enhanced variant if missing
  const merged = { ...canonical };
  if (!merged.enhanced) {
    const donor = duplicatesToDelete.find(d => d.enhanced && typeof d.enhanced === 'object');
    if (donor) {
      merged.enhanced = JSON.parse(JSON.stringify(donor.enhanced));
      merged.enhancedFitScore = donor.enhancedFitScore || donor.enhanced?.fitScore || null;
      merged._scoreEnhanced = donor._scoreEnhanced || merged.enhancedFitScore;
    }
  }

  // 2. Union mealSuitability and types
  const suitabilitySet = new Set(Array.isArray(merged.mealSuitability) ? merged.mealSuitability : []);
  const typesSet = new Set(Array.isArray(merged.types) ? merged.types.map(t => String(t).toLowerCase()) : []);
  duplicatesToDelete.forEach(d => {
    if (Array.isArray(d.mealSuitability)) d.mealSuitability.forEach(s => suitabilitySet.add(s));
    if (Array.isArray(d.types)) d.types.forEach(t => typesSet.add(String(t).toLowerCase()));
    if (d.type) typesSet.add(String(d.type).toLowerCase());
    if (d.mealType) typesSet.add(String(d.mealType).toLowerCase());
  });
  merged.mealSuitability = Array.from(suitabilitySet);
  merged.types = Array.from(typesSet);
  if (!merged.mealType && merged.types.length > 0) merged.mealType = merged.types[0];

  // 3. Adopt source fields if missing
  if (!merged.sourceType) {
    const srcDonor = duplicatesToDelete.find(d => d.sourceType || d.sourceUrl || d.sourceBook);
    if (srcDonor) {
      merged.sourceType = srcDonor.sourceType || '';
      merged.sourceUrl = srcDonor.sourceUrl || '';
      merged.sourceBook = srcDonor.sourceBook || '';
      merged.sourcePage = srcDonor.sourcePage || '';
      merged.source = srcDonor.source || '';
    }
  }

  // 4. Merge favourite flags
  const isAnyFav = Boolean(merged.isFavourite || merged.isFavorite || duplicatesToDelete.some(d => d.isFavourite || d.isFavorite));
  if (isAnyFav) {
    merged.isFavourite = true;
    merged.isFavorite = true;
  }
  merged.updatedAt = new Date().toISOString();

  // 5. Persist canonical recipe & delete duplicates atomically if DB available
  if (isDbAvailable()) {
    try {
      const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
      const batch = db.batch();

      const cleaned = cleanLegacyMacros(merged);
      const recipeData = { ...cleaned, schemaVersion: 2, updatedAt: new Date().toISOString() };
      delete recipeData.id;
      batch.set(colRef.doc(String(canonical.id)), recipeData, { merge: true });

      for (const dup of duplicatesToDelete) {
        batch.delete(colRef.doc(String(dup.id)));
      }

      await batch.commit();
    } catch (batchErr) {
      console.error('[RecipeFirestoreRepository] Batch merge failed, falling back to sequential:', batchErr);
      const saveRes = await saveRecipe(merged);
      if (saveRes && saveRes.success === false) {
        throw new Error(saveRes.error?.message || saveRes.error || 'Failed to persist canonical recipe; merge aborted');
      }
      for (const dup of duplicatesToDelete) {
        await deleteRecipe(dup.id);
      }
    }
  } else {
    // Database unavailable (offline or mock testing environment)
    const saveRes = await saveRecipe(merged);
    if (saveRes && saveRes.success === false && saveRes.error !== 'Database unavailable') {
      throw new Error(saveRes.error?.message || saveRes.error || 'Failed to persist canonical recipe; merge aborted');
    }
  }

  // 6. Update active plan / skeletonGrid if referenced
  const dupMap = {};
  duplicatesToDelete.forEach(d => { dupMap[String(d.id)] = String(canonical.id); });

  const currentPlan = options.plan || (typeof window !== 'undefined' && window.Store?.getState()?.currentPlan);
  const skeletonGrid = options.skeletonGrid || (typeof window !== 'undefined' && window.Store?.getState()?.skeletonGrid);

  if (currentPlan) {
    const { modified, plan: updatedPlan, skeletonGrid: updatedSkeleton } = repointMealPlanRecipeIds(currentPlan, skeletonGrid, dupMap);
    if (modified && isDbAvailable()) {
      await saveCurrentPlan(updatedPlan);
      if (typeof window !== 'undefined' && window.Store?.setState) {
        window.Store.setState({ currentPlan: updatedPlan, skeletonGrid: updatedSkeleton });
      }
    }
  }

  // 7. Migrate favouriteVariantIds in user preferences if present
  const storeState = (typeof window !== 'undefined' && window.Store?.getState ? window.Store.getState() : (options.state || {})) || {};
  const userPrefs = storeState.preferences || storeState.userPrefs;
  if (userPrefs && Array.isArray(userPrefs.favouriteVariantIds)) {
    let prefsModified = false;
    const migratedFavs = userPrefs.favouriteVariantIds.map(favKey => {
      for (const [dupId, canonId] of Object.entries(dupMap)) {
        if (favKey.startsWith(`${dupId}_`)) {
          prefsModified = true;
          return favKey.replace(`${dupId}_`, `${canonId}_`);
        }
      }
      return favKey;
    });
    if (prefsModified) {
      const uniqueFavs = Array.from(new Set(migratedFavs));
      userPrefs.favouriteVariantIds = uniqueFavs;
      if (userPrefs.favoriteVariantIds) userPrefs.favoriteVariantIds = uniqueFavs;
      if (typeof window !== 'undefined' && window.Store?.setState) {
        window.Store.setState({ preferences: userPrefs, userPrefs });
      }
      try {
        const prefRepo = await import('./PreferenceRepository.js');
        if (typeof prefRepo.savePreferences === 'function') {
          await prefRepo.savePreferences(userPrefs, storeState.settings || {});
        }
      } catch (prefErr) {
        console.warn('[RecipeFirestoreRepository] Failed to persist migrated preferences:', prefErr);
      }
    }
  }

  // 8. Update in-memory recipes list in Store if available
  if (typeof window !== 'undefined' && window.Store?.getState) {
    const allRecipes = window.Store.getState().recipes || [];
    const deletedIdSet = new Set(duplicatesToDelete.map(d => String(d.id)));
    const updatedRecipes = allRecipes
      .filter(r => !deletedIdSet.has(String(r.id)))
      .map(r => String(r.id) === String(canonical.id) ? merged : r);
    if (typeof window.Store.setState === 'function') {
      window.Store.setState({ recipes: updatedRecipes });
    }
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('plateplan:state:recipes', { detail: updatedRecipes }));
      document.dispatchEvent(new CustomEvent('plateplan:recipes-updated', { detail: updatedRecipes }));
    }
  }

  return {
    success: true,
    canonical: merged,
    deletedCount: duplicatesToDelete.length,
    deletedIds: duplicatesToDelete.map(d => d.id)
  };
}
