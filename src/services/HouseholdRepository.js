/**
 * src/services/HouseholdRepository.js (v3.28.1)
 * Dedicated data access repository for household-scoped Firestore operations.
 * Completely isolated from DOM manipulation and UI rendering.
 * All operations target the shared household path 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID, FIREBASE_CONFIG } from '../config/firebase.js';
import { stripPlanPayload } from '../models/MealPlannerModel.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { getState as getStoreState, setIngredients, setRecipes, setCategories, setProducts } from '../store/store.js';

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
    } else {
      // Defensive Hydration Auto-Repair: if recipe has no macros or is falling back to 0/18 kcal with ingredients, recalculate
      const hasIngredients = Array.isArray(r.ingredientSections) && r.ingredientSections.length > 0 && r.ingredientSections.some(s => (s.ingredients || []).length > 0);
      const currentCal = Number(r.macros?.calories || r.macros?.cal || r.calories || r.cal || 0);
      if (hasIngredients && (currentCal === 0 || currentCal === 18)) {
        try {
          const globalProducts = Array.isArray(window.state?.products) ? window.state.products : [];
          const globalIngredients = Array.isArray(window.state?.ingredients) ? window.state.ingredients : [];
          const productMap = new Map();
          globalProducts.forEach(p => { if (p?.id) productMap.set(String(p.id), p); });
          const ingredientMap = new Map();
          globalIngredients.forEach(i => { if (i?.id) ingredientMap.set(String(i.id), i); });

          let totalCal = 0;
          let totalProt = 0;
          let totalCarb = 0;
          let totalFat = 0;
          const allIngs = r.ingredientSections.flatMap(s => s.ingredients || []);
          const calcFn = window.NutritionService?.calculateItemNutrition || ((prod, qty, unit) => ({ kcal: prod.kcal || 100, protein: prod.protein || 5, carbs: 10, fat: 5 }));

          allIngs.forEach(item => {
            if (!item || item.excludeNutrition) return;
            let matchedSource = null;
            if (item.productId && productMap.has(String(item.productId))) {
              matchedSource = productMap.get(String(item.productId));
            } else if (item.ingredientId && ingredientMap.has(String(item.ingredientId))) {
              const ing = ingredientMap.get(String(item.ingredientId));
              if (ing?.defaultProduct && productMap.has(String(ing.defaultProduct))) {
                matchedSource = productMap.get(String(ing.defaultProduct));
              }
            }
            if (matchedSource) {
              const qty = Number(item.scaledQty ?? item.qty ?? item.amount ?? 1) || 1;
              const unit = item.unit || 'g';
              const nut = calcFn(matchedSource, qty, unit);
              totalCal += (nut.kcal ?? nut.cal ?? 0);
              totalProt += (nut.protein ?? nut.prot ?? 0);
              totalCarb += (nut.carbs ?? nut.carb ?? 0);
              totalFat += (nut.fat ?? 0);
            }
          });

          const serves = Number(r.serves || r.targetServings || r.servings || 2) || 2;
          if (totalCal > 0) {
            const perServing = {
              calories: Math.round(totalCal / serves),
              protein: Math.round((totalProt / serves) * 10) / 10,
              carbs: Math.round((totalCarb / serves) * 10) / 10,
              fat: Math.round((totalFat / serves) * 10) / 10
            };
            r.macros = perServing;
            r.nutrition = { perServing, ...perServing };
          }
        } catch (repairErr) {
          console.warn('[Hydration Auto-Repair] Failed to recalculate macros for recipe:', r.id, repairErr);
        }
      }
    }
    return r;
  }
  return target;
}

export function whitelistPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return {};

  const whitelisted = {};
  
  // Whitelist of allowed top-level keys for preferences
  const allowedKeys = [
    'nutritionTargets', 'profiles', 'settings', 'theme', 'mealPlanSettings', 'activeView', 'userPrefs', 'dismissedQualityAdvisories', 'dismissedAdvisories', 'dismissed_advisories', 'updatedAt'
  ];

  Object.keys(preferences).forEach(key => {
    // Only allow explicitly allowed configuration keys
    if (!allowedKeys.includes(key)) {
      console.warn(`[HouseholdRepository] Omitted non-whitelisted key from preferences: ${key}`);
      return;
    }

    const val = preferences[key];
    const valSizeBytes = new Blob([JSON.stringify(val)]).size;
    if (valSizeBytes > 10240) {
      console.warn(`[HouseholdRepository] Omitted key ${key} because its size exceeds the 10 KB safety limit (${(valSizeBytes / 1024).toFixed(2)} KB)`);
      return;
    }

    whitelisted[key] = val;
  });

  return whitelisted;
}

export function enforcePayloadSafetyValve(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  let byteSize = new Blob([JSON.stringify(payload)]).size;

  if (byteSize > 819200) {
    console.warn(`[HouseholdRepository] 0.8 MiB Safety Valve Triggered! Payload: ${byteSize} bytes. Performing emergency truncation.`);
    
    const aggressivePurge = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      delete obj.cachedSnapshots;
      delete obj.historyCache;
      delete obj.mealHistorySnapshots;

      Object.keys(obj).forEach(key => {
        if (/cache|snapshot|log/i.test(key)) {
          delete obj[key];
        } else if (key === 'dismissedQualityAdvisories' && Array.isArray(obj[key])) {
          obj[key] = obj[key].slice(-10);
        } else if (obj[key] && typeof obj[key] === 'object') {
          aggressivePurge(obj[key]);
        }
      });
    };

    aggressivePurge(payload);

    byteSize = new Blob([JSON.stringify(payload)]).size;

    if (byteSize > 819200) {
      const hardFallbackPurge = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        
        delete obj.dismissedQualityAdvisories;
        delete obj.dismissedAdvisories;
        delete obj.dismissed_advisories;
        delete obj.advisoryHistory;
        delete obj.mealHistorySnapshots;
        delete obj.historyCache;
        delete obj.history;
        delete obj.logs;
        
        Object.keys(obj).forEach(key => {
          if (['dismissedQualityAdvisories', 'dismissedAdvisories', 'dismissed_advisories', 'advisoryHistory', 'history', 'logs'].includes(key)) {
            delete obj[key];
          } else if (obj[key] && typeof obj[key] === 'object') {
            hardFallbackPurge(obj[key]);
          }
        });
      };

      hardFallbackPurge(payload);
      byteSize = new Blob([JSON.stringify(payload)]).size;
      console.warn(`[HouseholdRepository] Hard fallback applied. Final payload size: ${byteSize} bytes.`);
    }

    if (byteSize > 819200) {
      throw new Error(`[HouseholdRepository] Emergency Truncation Failed! Payload remains larger than 819,200 bytes (${byteSize} bytes). Refusing write to prevent Firestore quota failure.`);
    }
  }

  return payload;
}

export async function runPayloadAudit() {
  if (!db) {
    console.error('[PayloadAudit] db is not initialized.');
    return;
  }
  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const snap = await householdRef.get({ source: 'server' });
    if (!snap || !snap.exists) {
      console.warn('[PayloadAudit] Document households/elliott-chloe does not exist on server.');
      return;
    }
    const data = snap.data();
    const totalBytes = new Blob([JSON.stringify(data)]).size;
    console.log(`[PayloadAudit] Document households/${HOUSEHOLD_ID} total size: ${(totalBytes / 1024).toFixed(2)} KB (${totalBytes} bytes)`);

    const breakdown = [];
    Object.keys(data).forEach(key => {
      const valBytes = new Blob([JSON.stringify(data[key])]).size;
      const sizeKb = (valBytes / 1024).toFixed(2);
      const percentage = totalBytes > 0 ? ((valBytes / totalBytes) * 100).toFixed(2) : '0.00';
      breakdown.push({
        'Key Name': key,
        'Size (KB)': `${sizeKb} KB`,
        'Size (Bytes)': valBytes,
        'Percentage': `${percentage}%`
      });
    });

    breakdown.sort((a, b) => b['Size (Bytes)'] - a['Size (Bytes)']);
    
    console.table(breakdown);
    return data;
  } catch (err) {
    console.error('[PayloadAudit] Error executing audit:', err);
  }
}

if (typeof window !== 'undefined') {
  window.runPayloadAudit = runPayloadAudit;
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

export async function getHouseholdData() {
  if (!isDbAvailable()) return null;
  try {
    const [rootSnap, taxonomySnap, prefSnap] = await Promise.all([
      safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID)),
      safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('metadata').doc('taxonomy')),
      safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences'))
    ]);

    const rootData = rootSnap && rootSnap.exists ? rootSnap.data() : {};
    const taxonomyData = taxonomySnap && taxonomySnap.exists ? taxonomySnap.data() : {};
    const prefData = prefSnap && prefSnap.exists ? prefSnap.data() : {};

    return {
      id: HOUSEHOLD_ID,
      ...rootData,
      ...prefData,
      ingredientGroups: taxonomyData.ingredientGroups || [],
      ingredientFamilies: taxonomyData.ingredientFamilies || [],
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
    console.warn('[HouseholdRepository] Error fetching household data:', err);
    return null;
  }
}

export async function getPreferences() {
  return getHouseholdData();
}

export async function getPlanHistory() {
  if (!isDbAvailable()) return [];
  try {
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('plan_history'));
    if (snap && snap.docs) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return [];
  } catch (err) {
    console.error('[HouseholdRepository] Error fetching plan history on-demand:', err);
    return [];
  }
}

export async function savePlanHistory(planId, plan) {
  if (!isDbAvailable()) return false;
  if (!planId || !plan) return false;
  try {
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plan_history').doc(planId);
    await docRef.set({ ...plan, id: planId, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error saving plan history:', err);
    return false;
  }
}

export function prunePreferences(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const storeState = (typeof getStoreState === 'function') ? getStoreState() : {};
  const currentPreferences = storeState.preferences || storeState || {};

  // Safe helper to deep clone so we do not mutate other logic's in-memory references unless desired
  let cloned;
  try {
    cloned = JSON.parse(JSON.stringify(obj));
  } catch (e) {
    cloned = obj; // Fallback
  }

  const clean = (target) => {
    if (!target || typeof target !== 'object') return;

    for (const key of Object.keys(target)) {
      const val = target[key];

      // 1. Truncate dismissed Quality Advisories or any dismissed advisory / history arrays to 50 most recent entries
      if (
        (key === 'dismissedQualityAdvisories' || 
         key === 'dismissedAdvisories' || 
         key === 'dismissed_advisories' || 
         key === 'advisoryHistory' || 
         key === 'advisory_history') && 
        Array.isArray(val)
      ) {
        // 2. Removes obsolete advisory keys (advisory:recipe-macro-sync:*, advisory:recipe-low-cal:*) that are no longer active
        let filtered = val.filter(item => {
          const itemStr = typeof item === 'string' ? item : (item?.key || item?.id || '');
          return !itemStr.startsWith('advisory:recipe-macro-sync:') && !itemStr.startsWith('advisory:recipe-low-cal:');
        });
        
        // Truncate to the 50 most recent entries
        if (filtered.length > 50) {
          filtered = filtered.slice(-50);
        }
        target[key] = filtered;
      }
      // 3. Strips out any embedded object logs or heavy state snapshots from the payload before saving
      else if (
        key === 'logs' || 
        key === 'diagnostics' || 
        key === 'snapshots' || 
        key === 'stateSnapshots' || 
        key === 'history' || 
        key === 'telemetry' ||
        key === 'cachedState'
      ) {
        delete target[key];
      }
      else if (val && typeof val === 'object') {
        clean(val);
      }
    }
  };

  clean(cloned);

  // Ensure core preferences (user macros, settings, active views) are preserved from Store state if missing in cloned
  if (cloned.userPrefs) {
    if (!cloned.userPrefs.nutritionTargets && currentPreferences.userPrefs?.nutritionTargets) {
      cloned.userPrefs.nutritionTargets = currentPreferences.userPrefs.nutritionTargets;
    }
    if (!cloned.userPrefs.profiles && currentPreferences.userPrefs?.profiles) {
      cloned.userPrefs.profiles = currentPreferences.userPrefs.profiles;
    }
    if (!cloned.userPrefs.activeView && currentPreferences.userPrefs?.activeView) {
      cloned.userPrefs.activeView = currentPreferences.userPrefs.activeView;
    }
  }
  if (!cloned.profiles && currentPreferences.profiles) {
    cloned.profiles = currentPreferences.profiles;
  }
  if (!cloned.nutritionTargets && currentPreferences.nutritionTargets) {
    cloned.nutritionTargets = currentPreferences.nutritionTargets;
  }
  if (!cloned.settings && currentPreferences.settings) {
    cloned.settings = currentPreferences.settings;
  }

  // Check the size of payload, and if it's still too large, let's aggressively delete large arrays/objects
  let size = 0;
  try {
    size = new TextEncoder().encode(JSON.stringify(cloned)).length;
  } catch (e) {
    console.warn('[prunePreferences] Size check error:', e);
  }

  if (size > 400 * 1024) {
    console.warn('[prunePreferences] Payload size is over 400KB limit:', size, 'bytes. Applying aggressive pruning...');
    const aggressiveClean = (target) => {
      if (!target || typeof target !== 'object') return;
      for (const key of Object.keys(target)) {
        if (key === 'dismissedQualityAdvisories' || key === 'dismissedAdvisories' || key === 'dismissed_advisories') {
          target[key] = (target[key] || []).slice(-20);
        } else if (key.toLowerCase().includes('cache') || key.toLowerCase().includes('snapshot') || key.toLowerCase().includes('log')) {
          delete target[key];
        } else if (target[key] && typeof target[key] === 'object') {
          aggressiveClean(target[key]);
        }
      }
    };
    aggressiveClean(cloned);
  }

  return cloned;
}

export async function savePreferences(userPrefs, settings = {}) {
  try {
    if (!isDbAvailable()) return false;
    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    // Strictly declared preference keys to extract
    const allowedKeys = [
      'nutritionTargets',
      'activeView',
      'dismissedQualityAdvisories',
      'dismissedAdvisories',
      'dismissed_advisories',
      'settings',
      'profiles',
      'userPrefs',
      'theme',
      'advisoryHistory',
      'mealPlanSettings'
    ];

    // Helper to sanitize an object to only allow explicit preference keys
    const sanitizePreferences = (obj) => {
      if (!obj || typeof obj !== 'object') return {};
      const res = {};
      for (const key of allowedKeys) {
        if (obj[key] !== undefined) {
          res[key] = JSON.parse(JSON.stringify(obj[key]));
        }
      }
      return res;
    };

    // Get store's preference state, NOT the whole state object
    const storeState = (typeof getStoreState === 'function') ? getStoreState() : {};
    const storePrefs = storeState.preferences || storeState.userPrefs || {};

    const sanitizedStorePrefs = sanitizePreferences(storePrefs);
    const sanitizedInputPrefs = sanitizePreferences(userPrefs);

    // Also handle nested userPrefs if it exists as a key
    if (sanitizedInputPrefs.userPrefs) {
      sanitizedInputPrefs.userPrefs = sanitizePreferences(sanitizedInputPrefs.userPrefs);
    }
    if (sanitizedStorePrefs.userPrefs) {
      sanitizedStorePrefs.userPrefs = sanitizePreferences(sanitizedStorePrefs.userPrefs);
    }

    const mergedUserPrefs = {
      ...(sanitizedStorePrefs.userPrefs || sanitizedStorePrefs || {}),
      ...(sanitizedInputPrefs.userPrefs || sanitizedInputPrefs || {})
    };

    // Remove forbidden properties if they exist
    const forbiddenKeys = ['recipes', 'ingredients', 'products'];
    for (const key of forbiddenKeys) {
      delete mergedUserPrefs[key];
    }

    const profiles = mergedUserPrefs?.profiles || settings?.profiles || sanitizedStorePrefs?.profiles || {};
    const finalSettings = settings?.settings || settings || mergedUserPrefs?.settings || sanitizedStorePrefs?.settings || {};

    let payload = {
      userPrefs: mergedUserPrefs,
      nutritionTargets: mergedUserPrefs?.nutritionTargets || sanitizedStorePrefs?.nutritionTargets || {},
      profiles,
      settings: finalSettings,
      updatedAt: new Date().toISOString()
    };
    
    // Run pruning prior to Firestore write operations
    payload = prunePreferences(payload);

    // Apply strict whitelist
    payload = whitelistPreferences(payload);

    // Hard Error Guard: throw a hard error if the resulting payload object contains 'recipes', 'ingredients', or 'products'
    for (const forbidden of forbiddenKeys) {
      if (payload[forbidden] !== undefined || payload.userPrefs?.[forbidden] !== undefined) {
        throw new Error(`[HouseholdRepository] State contamination detected! Payload contains forbidden key: ${forbidden}`);
      }
    }

    // Guard: Enforce 0.8 MiB Safety Valve
    payload = enforcePayloadSafetyValve(payload);

    await Promise.all([
      prefRef.set(payload, { merge: true }),
      rootRef.set(payload, { merge: true })
    ]);
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Unable to save preferences to cloud:', err);
    throw err; // Re-throw so callers can see the hard error if contaminated
  }
}

export async function dismissAdvisoryInDb(issueKey) {
  if (!isDbAvailable()) return false;
  try {
    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    let unionVal;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
      unionVal = window.firebase.firestore.FieldValue.arrayUnion(issueKey);
    } else {
      unionVal = [issueKey];
    }

    await Promise.all([
      prefRef.update({ dismissedQualityAdvisories: unionVal }),
      rootRef.update({ dismissedQualityAdvisories: unionVal })
    ]);
    return true;
  } catch (err) {
    console.warn('[HouseholdRepository] Error in dismissAdvisoryInDb update, trying set with merge:', err);
    try {
      const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
      const rootRef = db.collection('households').doc(HOUSEHOLD_ID);
      let unionVal = window.firebase.firestore.FieldValue.arrayUnion(issueKey);
      await Promise.all([
        prefRef.set({ dismissedQualityAdvisories: unionVal }, { merge: true }),
        rootRef.set({ dismissedQualityAdvisories: unionVal }, { merge: true })
      ]);
      return true;
    } catch (e) {
      console.error('[HouseholdRepository] Failed fallback set for dismissAdvisoryInDb:', e);
      return false;
    }
  }
}

export async function recalibrateRecipeMacrosAndDismissAdvisoriesInDb(recipe, advisoryKeysToDismiss) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();

    // 1. Update the recipe document
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    const recipeId = recipe.id;
    const recipeData = { ...recipe, updatedAt: new Date().toISOString() };
    delete recipeData.id;
    const recipeDocRef = recipeColRef.doc(recipeId);
    batch.set(recipeDocRef, recipeData, { merge: true });

    // 2. Add advisory keys to the dismissedQualityAdvisories array of the preferences documents
    let unionVal;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
      unionVal = window.firebase.firestore.FieldValue.arrayUnion(...advisoryKeysToDismiss);
    } else {
      unionVal = advisoryKeysToDismiss;
    }

    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    // Using set with merge: true is robust against document non-existence
    batch.set(prefRef, { dismissedQualityAdvisories: unionVal }, { merge: true });
    batch.set(rootRef, { dismissedQualityAdvisories: unionVal }, { merge: true });

    // 3. Commit Atomic Write Batch
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error in recalibrateRecipeMacrosAndDismissAdvisoriesInDb:', err);
    throw err;
  }
}

export async function deleteSubtypeInDb(parentIngredient, unlinkedProducts) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();

    // 1. Prepare Parent Ingredient Document Update
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const ingId = parentIngredient.id;
    const ingData = { ...parentIngredient };
    delete ingData.id;
    ingData.updatedAt = new Date().toISOString();

    const ingDocRef = colRef.doc(ingId);
    batch.set(ingDocRef, ingData, { merge: true });

    // 2. Prepare Unlinked Products Document Updates
    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    for (const prod of unlinkedProducts) {
      const prodId = prod.id;
      const prodData = { ...prod };
      delete prodData.id;
      prodData.updatedAt = new Date().toISOString();

      const prodDocRef = prodColRef.doc(prodId);
      batch.set(prodDocRef, prodData, { merge: true });
    }

    // 3. Commit Atomic Write Batch
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error in deleteSubtypeInDb writeBatch:', err);
    throw err;
  }
}

export async function batchRecalibrateRecipesInDb(recipeUpdates, advisoryKeysToDismiss) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    // 1. Queue all recipe updates
    recipeUpdates.forEach(r => {
      const rId = r.id;
      const rData = { ...r, updatedAt: new Date().toISOString() };
      delete rData.id;
      const rDocRef = recipeColRef.doc(rId);
      batch.set(rDocRef, rData, { merge: true });
    });

    // 2. Queue preferences update with arrayUnion if there are advisories to dismiss
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

    // 3. Commit batch
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error in batchRecalibrateRecipesInDb:', err);
    throw err;
  }
}
export async function batchUpdateRecipesInDb(recipeUpdates) {
  if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
  if (!Array.isArray(recipeUpdates) || recipeUpdates.length === 0) return { success: true, count: 0 };
  try {
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    // Chunk in batches of 400 to respect Firestore 500 operations per batch limit
    const chunkSize = 400;
    for (let i = 0; i < recipeUpdates.length; i += chunkSize) {
      const chunk = recipeUpdates.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach(r => {
        const rId = r.id;
        const rData = { ...r, updatedAt: new Date().toISOString() };
        delete rData.id;
        const rDocRef = recipeColRef.doc(rId);
        batch.set(rDocRef, rData, { merge: true });
      });
      await batch.commit();
    }
    return { success: true, count: recipeUpdates.length };
  } catch (err) {
    console.error('[HouseholdRepository] Error in batchUpdateRecipesInDb:', err);
    throw err;
  }
}

export async function batchResolveSubtypeOrphansInDb(productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');

    productUpdates.forEach(p => {
      const pId = p.id;
      const pData = { ...p, updatedAt: new Date().toISOString() };
      delete pData.id;
      const pDocRef = prodColRef.doc(pId);
      if (p._delete === true) {
        batch.delete(pDocRef);
      } else {
        batch.set(pDocRef, pData, { merge: true });
      }
    });

    await batch.commit();
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error in batchResolveSubtypeOrphansInDb:', err);
    throw err;
  }
}

export async function batchMergeIngredientsInDb(canonicalIngredient, duplicateIngredientId, updatedRecipes, updatedProducts, updatedPlan) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();

    // 1. Delete duplicate ingredient
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const dupDocRef = ingColRef.doc(duplicateIngredientId);
    batch.delete(dupDocRef);

    // 2. Set/Update canonical ingredient
    const canId = canonicalIngredient.id;
    const canData = { ...canonicalIngredient, updatedAt: new Date().toISOString() };
    delete canData.id;
    const canDocRef = ingColRef.doc(canId);
    batch.set(canDocRef, canData, { merge: true });

    // 3. Update associated recipes
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');
    updatedRecipes.forEach(r => {
      const rId = r.id;
      const rData = { ...r, updatedAt: new Date().toISOString() };
      delete rData.id;
      batch.set(recipeColRef.doc(rId), rData, { merge: true });
    });

    // 4. Update associated products
    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    updatedProducts.forEach(p => {
      const pId = p.id;
      const pData = { ...p, updatedAt: new Date().toISOString() };
      delete pData.id;
      batch.set(prodColRef.doc(pId), pData, { merge: true });
    });

    // 5. Update plan if provided
    if (updatedPlan) {
      const planDocRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc('current');
      const planData = { ...updatedPlan, updatedAt: new Date().toISOString() };
      delete planData.id;
      batch.set(planDocRef, planData);
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error in batchMergeIngredientsInDb:', err);
    throw err;
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

export function subscribePreferences(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences').onSnapshot(
      (docSnap) => {
        if (docSnap && docSnap.exists) {
          callback(docSnap.data());
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

export function getUnifiedCategories(state = {}) {
  const catSet = new Set();
  const addCategoryStr = (raw) => {
    if (!raw) return;
    const name = typeof raw === 'string' ? raw : (raw.name || raw.categoryName || raw.id || '');
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length > 0) catSet.add(trimmed);
    }
  };

  (Array.isArray(state.categories) ? state.categories : []).forEach(addCategoryStr);
  (Array.isArray(state.ingredients) ? state.ingredients : []).forEach(i => {
    addCategoryStr(i?.category || i?.cat);
    if (Array.isArray(i?.subtypes)) {
      i.subtypes.forEach(st => addCategoryStr(st?.category || st?.cat));
    }
  });
  (Array.isArray(state.products) ? state.products : []).forEach(p => {
    addCategoryStr(p?.category || p?.cat);
  });

  return Array.from(catSet).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

export async function getCategories() {
  const defaultCategories = [
    'Bakery', 'Baking', 'Beverages', 'Carbs', 'Dairy & Eggs', 'Drinks', 'Frozen',
    'Fruit & Vegetables', 'General', 'Grains, Legumes & Pulses', 'Herbs & Spices',
    'Meat & Seafood', 'Meat Substitutes', 'Nuts & Seeds', 'Other', 'Pantry',
    'Produce', 'Proteins', 'Store Cupboard'
  ];
  try {
    if (!isDbAvailable()) return defaultCategories;
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    const snap = await safeFirestoreGet(docRef);
    if (snap && snap.exists) {
      const data = snap.data();
      if (Array.isArray(data?.categories) && data.categories.length > 0) return data.categories;
    }
    docRef.set({ categories: defaultCategories, updatedAt: new Date().toISOString() }).catch(() => {});
    return defaultCategories;
  } catch (err) {
    console.warn('[HouseholdRepository] Error fetching categories, using defaults:', err.message || err);
    return defaultCategories;
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
  const results = await Promise.all(promises);
  const failure = results.find(r => r && r.success === false && r.error);
  if (failure) {
    throw typeof failure.error === 'string' ? new Error(failure.error) : failure.error;
  }
  return results;
}

export const saveHouseholdState = save;

export async function savePreferencesWithAutoPrune(preferences) {
  if (!preferences) return { byteSize: 0, preferences: {} };

  // 1. Hard purge bloated historical cache keys
  if (preferences.cachedSnapshots) delete preferences.cachedSnapshots;
  if (preferences.historyCache) preferences.historyCache = [];
  if (preferences.mealHistorySnapshots) preferences.mealHistorySnapshots = [];
  
  // 2. Truncate advisories
  if (Array.isArray(preferences.dismissedQualityAdvisories)) {
    preferences.dismissedQualityAdvisories = preferences.dismissedQualityAdvisories.slice(-20);
  }

  // Apply strict whitelist
  const whitelistedPrefs = whitelistPreferences(preferences);

  // 3. Enforce 0.8 MiB Safety Valve
  const safePrefs = enforcePayloadSafetyValve(whitelistedPrefs);

  // 4. Persist lightweight preferences to Local Store and Firestore
  if (typeof window !== 'undefined' && window.Store && typeof window.Store.setState === 'function') {
    window.Store.setState({ preferences: safePrefs, userPrefs: safePrefs });
  }
  const storeState = (typeof getStoreState === 'function') ? getStoreState() : {};
  if (storeState) {
    storeState.preferences = safePrefs;
    storeState.userPrefs = safePrefs;
  }

  let finalSize = 0;
  if (isDbAvailable()) {
    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    const rootPayload = enforcePayloadSafetyValve({ preferences: safePrefs, updatedAt: new Date().toISOString() });
    finalSize = new Blob([JSON.stringify(rootPayload)]).size;

    await Promise.all([
      prefRef.set(safePrefs, { merge: true }),
      rootRef.set(rootPayload, { merge: true })
    ]);
  }

  return { byteSize: finalSize, preferences: safePrefs };
}

export async function batchResolveOrphansWithNewSubtypeInDb(parentIngredient, productUpdates) {
  if (!isDbAvailable()) return false;
  try {
    const batch = db.batch();
    
    if (parentIngredient) {
      const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
      const ingId = parentIngredient.id;
      const ingData = { ...parentIngredient };
      delete ingData.id;
      ingData.updatedAt = new Date().toISOString();
      batch.set(ingColRef.doc(ingId), ingData, { merge: true });
    }

    const prodColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    productUpdates.forEach(p => {
      const pId = p.id;
      const pData = { ...p, updatedAt: new Date().toISOString() };
      delete pData.id;
      const pDocRef = prodColRef.doc(pId);
      if (p._delete === true) {
        batch.delete(pDocRef);
      } else {
        batch.set(pDocRef, pData, { merge: true });
      }
    });

    await batch.commit();
    return true;
  } catch (err) {
    console.error('[HouseholdRepository] Error in batchResolveOrphansWithNewSubtypeInDb:', err);
    throw err;
  }
}

export async function executeSubcollectionMigration() {
  if (!db) {
    console.error('[Migration] db is not initialized.');
    return { success: false, error: 'Database unavailable' };
  }
  try {
    console.log('[Migration] Starting subcollection restructuring & migration...');
    const rootDocRef = db.collection('households').doc(HOUSEHOLD_ID);
    const rootSnap = await rootDocRef.get();
    if (!rootSnap.exists) {
      console.warn('[Migration] Root document households/elliott-chloe does not exist.');
      return { success: false, error: 'Root document not found' };
    }
    const rootData = rootSnap.data() || {};
    console.log('[Migration] Successfully fetched root document. Size: ' + new Blob([JSON.stringify(rootData)]).size + ' bytes');

    const batch = db.batch();

    // b. Extract planHistory array elements. Write each plan as an individual document under households/elliott-chloe/plan_history/{planId} using batched writes.
    const planHistory = Array.isArray(rootData.planHistory) ? rootData.planHistory : [];
    console.log(`[Migration] Extracted ${planHistory.length} historical plans from root.`);
    const historyColRef = rootDocRef.collection('plan_history');
    planHistory.forEach((plan, idx) => {
      const planId = plan.id || plan.planId || `plan_${idx}_${Date.now()}`;
      const planDocRef = historyColRef.doc(planId);
      batch.set(planDocRef, { ...plan, id: planId, updatedAt: plan.updatedAt || new Date().toISOString() });
    });

    // c. Extract ingredientGroups and ingredientFamilies. Write them to households/elliott-chloe/metadata/taxonomy
    const ingredientGroups = Array.isArray(rootData.ingredientGroups) ? rootData.ingredientGroups : [];
    const ingredientFamilies = Array.isArray(rootData.ingredientFamilies) ? rootData.ingredientFamilies : [];
    console.log(`[Migration] Extracted taxonomy data: ${ingredientGroups.length} groups, ${ingredientFamilies.length} families.`);
    const taxonomyDocRef = rootDocRef.collection('metadata').doc('taxonomy');
    batch.set(taxonomyDocRef, {
      ingredientGroups,
      ingredientFamilies,
      updatedAt: new Date().toISOString()
    });

    // d. Deep-clean preferences: delete all legacy cached snapshots, logs, and history buffers
    let preferences = rootData.preferences || {};
    const deepClean = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      delete obj.cachedSnapshots;
      delete obj.historyCache;
      delete obj.mealHistorySnapshots;
      delete obj.planHistory;
      delete obj.ingredientGroups;
      delete obj.ingredientFamilies;
      Object.keys(obj).forEach(key => {
        if (/cache|snapshot|log/i.test(key)) {
          delete obj[key];
        } else if (obj[key] && typeof obj[key] === 'object') {
          deepClean(obj[key]);
        }
      });
    };
    deepClean(preferences);

    if (preferences.userPrefs) {
      deepClean(preferences.userPrefs);
    }

    // e. Remove planHistory, ingredientGroups, and ingredientFamilies from the root document.
    const updatedRootData = { ...rootData };
    delete updatedRootData.planHistory;
    delete updatedRootData.ingredientGroups;
    delete updatedRootData.ingredientFamilies;

    let deleteVal;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
      deleteVal = window.firebase.firestore.FieldValue.delete();
    }
    
    if (deleteVal) {
      updatedRootData.planHistory = deleteVal;
      updatedRootData.ingredientGroups = deleteVal;
      updatedRootData.ingredientFamilies = deleteVal;
    }

    updatedRootData.preferences = preferences;
    if (updatedRootData.userPrefs) {
      updatedRootData.userPrefs = preferences.userPrefs || preferences;
    }
    updatedRootData.updatedAt = new Date().toISOString();

    // f. Commit the cleaned, lightweight root document back to Firestore
    batch.set(rootDocRef, updatedRootData, { merge: true });

    await batch.commit();
    console.log('[Migration] Subcollection restructuring & migration completed successfully.');

    if (typeof window !== 'undefined' && window.Store && typeof window.Store.setState === 'function') {
      window.Store.setState({ preferences, userPrefs: preferences });
    }

    return { success: true };
  } catch (err) {
    console.error('[Migration] Failed to execute subcollection migration:', err);
    return { success: false, error: err.message || err };
  }
}

export async function inspectPreferences() {
  if (!db) {
    console.error('[InspectPreferences] db is not initialized.');
    return;
  }
  try {
    const docRef = db.collection('households').doc(HOUSEHOLD_ID);
    const snap = await docRef.get();
    if (!snap.exists) {
      console.warn('[InspectPreferences] households/elliott-chloe does not exist.');
      return;
    }
    const data = snap.data() || {};
    const preferences = data.preferences || {};
    const totalPrefBytes = new Blob([JSON.stringify(preferences)]).size;
    console.log(`[InspectPreferences] households/elliott-chloe preferences total size: ${(totalPrefBytes / 1024).toFixed(2)} KB (${totalPrefBytes} bytes)`);

    const breakdown = [];
    Object.keys(preferences).forEach(key => {
      const valBytes = new Blob([JSON.stringify(preferences[key])]).size;
      const sizeKb = (valBytes / 1024).toFixed(2);
      const percentage = totalPrefBytes > 0 ? ((valBytes / totalPrefBytes) * 100).toFixed(2) : '0.00';
      breakdown.push({
        'Key Name': key,
        'Size (KB)': `${sizeKb} KB`,
        'Size (Bytes)': valBytes,
        'Percentage': `${percentage}%`
      });
    });

    breakdown.sort((a, b) => b['Size (Bytes)'] - a['Size (Bytes)']);
    console.table(breakdown);
    return preferences;
  } catch (err) {
    console.error('[InspectPreferences] Error executing inspect:', err);
  }
}

export async function cleanPreferencesBloat() {
  if (!db) {
    console.error('[CleanPreferencesBloat] db is not initialized.');
    return { success: false, error: 'db not initialized' };
  }
  try {
    console.log('[CleanPreferencesBloat] Starting targeted deep-clean of preferences...');
    const rootDocRef = db.collection('households').doc(HOUSEHOLD_ID);
    const prefDocRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    
    const rootSnap = await rootDocRef.get({ source: 'server' });
    if (!rootSnap || !rootSnap.exists) {
      console.warn('[CleanPreferencesBloat] households/elliott-chloe does not exist.');
      return { success: false, error: 'Document not found' };
    }
    
    const rootData = rootSnap.data() || {};
    let preferences = rootData.preferences || {};
    
    console.log('[CleanPreferencesBloat] Current preferences size: ' + new Blob([JSON.stringify(preferences)]).size + ' bytes');
    
    // Explicitly delete heavy unmigrated or duplicated sub-arrays from top level preferences
    delete preferences.planHistory;
    delete preferences.ingredientGroups;
    delete preferences.ingredientFamilies;
    
    const keysToPurge = ['snapshots', 'history', 'cache', 'recipeSnapshots', 'ingredientCache', 'productCache', 'advisoryLogs'];
    const deepClean = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      keysToPurge.forEach(k => delete obj[k]);
      Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (keysToPurge.includes(key) || lowerKey.includes('cache') || lowerKey.includes('snapshot') || lowerKey.includes('log')) {
          delete obj[key];
        } else if (obj[key] && typeof obj[key] === 'object') {
          deepClean(obj[key]);
        }
      });
    };

    deepClean(preferences);

    // Clean or reset preferences.userPrefs down to essential scalar settings only
    if (preferences.userPrefs && typeof preferences.userPrefs === 'object') {
      const allowedUserPrefsKeys = [
        'theme', 'activeView', 'autoDefaultStrategy', 'autoDefaultCriterion', 'nutritionTargets'
      ];
      Object.keys(preferences.userPrefs).forEach(k => {
        if (!allowedUserPrefsKeys.includes(k)) {
          delete preferences.userPrefs[k];
        }
      });
    }

    const allowedConfigKeys = [
      'nutritionTargets', 'profiles', 'settings', 'theme', 'mealPlanSettings', 'activeView', 'userPrefs', 'dismissedQualityAdvisories', 'dismissedAdvisories', 'dismissed_advisories'
    ];
    Object.keys(preferences).forEach(key => {
      if (!allowedConfigKeys.includes(key)) {
        delete preferences[key];
      }
    });

    const cleanedSize = new Blob([JSON.stringify(preferences)]).size;
    console.log(`[CleanPreferencesBloat] Cleaned preferences size: ${cleanedSize} bytes (${(cleanedSize / 1024).toFixed(2)} KB)`);

    // 1. Write to settings/preferences subcollection doc
    await prefDocRef.set(preferences, { merge: true });

    // 2. Explicit deleteField() atomic update on root doc
    const FieldValue = (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) ? window.firebase.firestore.FieldValue : null;
    
    const updatePayload = {
      'preferences': preferences
    };
    if (FieldValue) {
      updatePayload['preferences.planHistory'] = FieldValue.delete();
      updatePayload['preferences.ingredientGroups'] = FieldValue.delete();
      updatePayload['preferences.ingredientFamilies'] = FieldValue.delete();
      updatePayload['preferences.userPrefs'] = FieldValue.delete();
      updatePayload['preferences.snapshots'] = FieldValue.delete();
      updatePayload['preferences.history'] = FieldValue.delete();
      updatePayload['preferences.cache'] = FieldValue.delete();
    }

    await rootDocRef.update(updatePayload);

    console.log('[CleanPreferencesBloat] Successfully persisted cleaned preferences to Firestore.');

    if (typeof window !== 'undefined' && window.Store && typeof window.Store.setState === 'function') {
      window.Store.setState({ preferences, userPrefs: preferences });
    }

    return { success: true, sizeBytes: cleanedSize };
  } catch (err) {
    console.error('[CleanPreferencesBloat] Error in cleanPreferencesBloat:', err);
    return { success: false, error: err.message || err };
  }
}

if (typeof window !== 'undefined') {
  window.executeSubcollectionMigration = executeSubcollectionMigration;
  window.inspectPreferences = inspectPreferences;
  window.cleanPreferencesBloat = cleanPreferencesBloat;
}

const HouseholdRepository = {
  cleanLegacyMacros,
  saveCurrentPlan,
  getIngredients,
  saveIngredient,
  deleteIngredient,
  getProducts,
  saveProduct,
  deleteProduct,
  getCategories,
  saveCategories,
  getPreferences,
  savePreferences,
  dismissAdvisoryInDb,
  savePreferencesWithAutoPrune,
  batchResolveOrphansWithNewSubtypeInDb,
  stripPlanPayload,
  getHouseholdData,
  getPlanHistory,
  savePlanHistory,
  executeSubcollectionMigration,
  inspectPreferences,
  cleanPreferencesBloat,
  deleteCategory,
  reassignAndDeleteCategory,
  renameCategory,
  mergeCategory,
  mergeAllDuplicates,
  batchUpdateRecipesInDb
};

export async function deleteCategory(categoryName, fallbackCatName = 'Uncategorised') {
  if (!categoryName) return { success: false, error: 'Missing category name' };

  const strictNorm = (str) => String(str || '').toLowerCase().trim();
  const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');

  const sourceNorm = strictNorm(categoryName);
  const targetCat = (fallbackCatName || 'Uncategorised').trim();
  const targetKebab = slugifyToKebab(targetCat);

  // Apply Cascading Reassignment Logic to State / Memory Data
  const cascadeCategoryReassignment = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];

    const changedIngIds = new Set();
    const changedSubtypeIds = new Set();
    const changedProdIds = new Set();

    // Step A (Root Level Cascade):
    updatedIngs.forEach(ing => {
      if (strictNorm(ing.category) === sourceNorm) {
        ing.category = targetCat;
        ing.cat = targetKebab;
        ing.updatedAt = new Date().toISOString();
        changedIngIds.add(String(ing.id));

        // Cascade to all child subtypes of this root ingredient
        if (Array.isArray(ing.subtypes)) {
          ing.subtypes.forEach(st => {
            st.category = targetCat;
            st.cat = targetKebab;
            if (st.id) changedSubtypeIds.add(String(st.id));
          });
        }

        // Cascade to all products linked directly or via groupId to this root ingredient
        updatedProds.forEach(prod => {
          const ingRefId = String(prod.ingredientId || prod.groupId || '');
          if (ingRefId && ingRefId === String(ing.id)) {
            prod.category = targetCat;
            prod.cat = targetKebab;
            prod.updatedAt = new Date().toISOString();
            changedProdIds.add(String(prod.id));
          }
        });
      }
    });

    // Step B (Sub-type Level Cascade):
    updatedIngs.forEach(ing => {
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(st => {
          if (strictNorm(st.category) === sourceNorm) {
            st.category = targetCat;
            st.cat = targetKebab;
            if (st.id) changedSubtypeIds.add(String(st.id));
            changedIngIds.add(String(ing.id));
            ing.updatedAt = new Date().toISOString();

            // Cascade to all products linked to this specific sub-type
            updatedProds.forEach(prod => {
              const subRefId = String(prod.subtypeId || prod.subTypeId || '');
              if (subRefId && st.id && subRefId === String(st.id)) {
                prod.category = targetCat;
                prod.cat = targetKebab;
                prod.updatedAt = new Date().toISOString();
                changedProdIds.add(String(prod.id));
              }
            });
          }
        });
      }
    });

    // Step C (Product Level Cascade for remaining orphaned products):
    updatedProds.forEach(prod => {
      if (strictNorm(prod.category) === sourceNorm) {
        prod.category = targetCat;
        prod.cat = targetKebab;
        prod.updatedAt = new Date().toISOString();
        changedProdIds.add(String(prod.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedSubtypeIds, changedProdIds };
  };

  // 1. Update in-memory Store state
  const state = getStoreState() || {};
  const categories = (state.categories || []).filter(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) !== sourceNorm;
  });

  const { updatedIngs, updatedProds } = cascadeCategoryReassignment(state.ingredients, state.products);

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  // 2. Persist to Firestore
  if (!isDbAvailable()) return { success: true };

  try {
    const batch = db.batch();
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    // Fetch and update ingredients with cascading logic
    const ingSnap = await householdRef.collection('ingredients').get();
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    // Fetch products
    const prodSnap = await householdRef.collection('products').get();
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { 
      updatedIngs: dbCascadeIngs, 
      updatedProds: dbCascadeProds, 
      changedIngIds, 
      changedProdIds 
    } = cascadeCategoryReassignment(dbIngs, dbProds);

    // Helper for chunked batch commits (max 400 operations per batch)
    const commitChunkedOps = async (ops) => {
      if (ops.length === 0) return;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunkBatch = db.batch();
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        chunk.forEach(op => op(chunkBatch));
        await chunkBatch.commit();
      }
    };

    const deleteOps = [];

    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        deleteOps.push((b) => b.update(ing.ref, {
          category: ing.category,
          cat: ing.cat,
          subtypes: ing.subtypes || [],
          updatedAt: new Date().toISOString()
        }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        deleteOps.push((b) => b.update(prod.ref, {
          category: prod.category,
          cat: prod.cat,
          updatedAt: new Date().toISOString()
        }));
      }
    });

    // Update categories array in Settings doc
    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const strictNorm = (str) => String(str || '').toLowerCase().trim();
      const sourceNorm = strictNorm(categoryName);
      const updatedCats = (data.categories || []).filter(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) !== sourceNorm && slugCategory(cName) !== sourceNorm;
      });
      deleteOps.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(deleteOps);
    return { success: true };
  } catch (err) {
    console.error('[HouseholdRepository] deleteCategory error:', err);
    throw err;
  }
}

export async function reassignAndDeleteCategory(deletedCat, reassignMode = 'mass', massTargetCat = 'Uncategorised', individualCatMap = {}) {
  if (!deletedCat) return { success: false, error: 'Missing category to delete' };

  const slugCategory = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');

  const deletedSlug = slugCategory(deletedCat);
  const massTarget = (massTargetCat || '').trim() || 'Uncategorised';

  const reassignHierarchy = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];

    const changedIngIds = new Set();
    const changedProdIds = new Set();

    updatedIngs.forEach(i => {
      let changed = false;
      if (slugCategory(i.category) === deletedSlug || i.cat === deletedCat) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
        i.category = dest;
        i.cat = slugifyToKebab(dest);
        i.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (slugCategory(st.category) === deletedSlug || st.cat === deletedCat) {
            const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[st.id] || massTarget);
            st.category = dest;
            st.cat = slugifyToKebab(dest);
            changed = true;
          }
        });
      }
      if (changed) {
        changedIngIds.add(String(i.id));
      }
    });

    updatedProds.forEach(p => {
      if (slugCategory(p.category) === deletedSlug || p.cat === deletedCat) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[p.id] || massTarget);
        p.category = dest;
        p.cat = slugifyToKebab(dest);
        p.updatedAt = new Date().toISOString();
        changedProdIds.add(String(p.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedProdIds };
  };

  // 1. In-memory Store update
  const state = getStoreState() || {};
  const { updatedIngs, updatedProds } = reassignHierarchy(state.ingredients, state.products);
  const strictNorm = (str) => String(str || '').toLowerCase().trim();
  const deletedNorm = strictNorm(deletedCat);
  const categories = (state.categories || []).filter(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) !== deletedNorm && slugCategory(cName) !== deletedSlug;
  });

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    const ingSnap = await householdRef.collection('ingredients').get();
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const prodSnap = await householdRef.collection('products').get();
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = reassignHierarchy(dbIngs, dbProds);

    const commitChunkedOps = async (ops) => {
      if (ops.length === 0) return;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunkBatch = db.batch();
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        chunk.forEach(op => op(chunkBatch));
        await chunkBatch.commit();
      }
    };

    const deleteOps = [];

    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        deleteOps.push((b) => b.update(ing.ref, {
          category: ing.category,
          cat: ing.cat,
          subtypes: ing.subtypes || [],
          updatedAt: new Date().toISOString()
        }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        deleteOps.push((b) => b.update(prod.ref, {
          category: prod.category,
          cat: prod.cat,
          updatedAt: new Date().toISOString()
        }));
      }
    });

    // Update settings/categories
    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const updatedCats = (data.categories || []).filter(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) !== deletedNorm && slugCategory(cName) !== deletedSlug;
      });
      deleteOps.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(deleteOps);
    return { success: true };
  } catch (err) {
    console.error('[HouseholdRepository] reassignAndDeleteCategory error:', err);
    throw err;
  }
}

export async function renameCategory(oldCat, newName) {
  if (!oldCat || !newName) return { success: false, error: 'Missing source or new category name' };

  const strictNorm = (str) => String(str || '').toLowerCase().trim();
  const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');

  const sourceNorm = strictNorm(oldCat);
  const cleanNewName = String(newName).trim();
  const targetKebab = slugifyToKebab(cleanNewName);

  // Apply Cascading Rename Logic
  const cascadeCategoryReassignment = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];

    const changedIngIds = new Set();
    const changedSubtypeIds = new Set();
    const changedProdIds = new Set();

    // Step A (Root Level Cascade):
    updatedIngs.forEach(ing => {
      if (strictNorm(ing.category) === sourceNorm) {
        ing.category = cleanNewName;
        ing.cat = targetKebab;
        ing.updatedAt = new Date().toISOString();
        changedIngIds.add(String(ing.id));

        if (Array.isArray(ing.subtypes)) {
          ing.subtypes.forEach(st => {
            st.category = cleanNewName;
            st.cat = targetKebab;
            if (st.id) changedSubtypeIds.add(String(st.id));
          });
        }

        updatedProds.forEach(prod => {
          const ingRefId = String(prod.ingredientId || prod.groupId || '');
          if (ingRefId && ingRefId === String(ing.id)) {
            prod.category = cleanNewName;
            prod.cat = targetKebab;
            prod.updatedAt = new Date().toISOString();
            changedProdIds.add(String(prod.id));
          }
        });
      }
    });

    // Step B (Sub-type Level Cascade):
    updatedIngs.forEach(ing => {
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(st => {
          if (strictNorm(st.category) === sourceNorm) {
            st.category = cleanNewName;
            st.cat = targetKebab;
            if (st.id) changedSubtypeIds.add(String(st.id));
            changedIngIds.add(String(ing.id));
            ing.updatedAt = new Date().toISOString();

            updatedProds.forEach(prod => {
              const subRefId = String(prod.subtypeId || prod.subTypeId || '');
              if (subRefId && st.id && subRefId === String(st.id)) {
                prod.category = cleanNewName;
                prod.cat = targetKebab;
                prod.updatedAt = new Date().toISOString();
                changedProdIds.add(String(prod.id));
              }
            });
          }
        });
      }
    });

    // Step C (Product Level Cascade for remaining orphaned products):
    updatedProds.forEach(prod => {
      if (strictNorm(prod.category) === sourceNorm) {
        prod.category = cleanNewName;
        prod.cat = targetKebab;
        prod.updatedAt = new Date().toISOString();
        changedProdIds.add(String(prod.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedSubtypeIds, changedProdIds };
  };

  // 1. Update in-memory Store state
  const state = getStoreState() || {};
  const categories = (state.categories || []).map(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) === sourceNorm ? cleanNewName : c;
  });

  const { updatedIngs, updatedProds } = cascadeCategoryReassignment(state.ingredients, state.products);

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    const ingSnap = await householdRef.collection('ingredients').get();
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const prodSnap = await householdRef.collection('products').get();
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = cascadeCategoryReassignment(dbIngs, dbProds);

    const commitChunkedOps = async (ops) => {
      if (ops.length === 0) return;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunkBatch = db.batch();
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        chunk.forEach(op => op(chunkBatch));
        await chunkBatch.commit();
      }
    };

    const renameOps = [];

    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        renameOps.push((b) => b.update(ing.ref, {
          category: ing.category,
          cat: ing.cat,
          subtypes: ing.subtypes || [],
          updatedAt: new Date().toISOString()
        }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        renameOps.push((b) => b.update(prod.ref, {
          category: prod.category,
          cat: prod.cat,
          updatedAt: new Date().toISOString()
        }));
      }
    });

    // Update the categories array in Settings doc
    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const updatedCats = (data.categories || []).map(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) === sourceNorm ? cleanNewName : c;
      });
      renameOps.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(renameOps);
    return { success: true };
  } catch (err) {
    console.error('[HouseholdRepository] renameCategory error:', err);
    throw err;
  }
}

export async function mergeCategory(sourceCat, targetCat) {
  if (!sourceCat || !targetCat) return { success: false, error: 'Missing source or target' };

  const strictNorm = (str) => String(str || '').toLowerCase().trim();
  const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');

  const sourceNorm = strictNorm(sourceCat);
  const targetNorm = strictNorm(targetCat);
  const cleanTargetCat = String(targetCat).trim();
  const targetKebab = slugifyToKebab(cleanTargetCat);

  // Apply Cascading Merge Logic
  const cascadeCategoryReassignment = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];

    const changedIngIds = new Set();
    const changedSubtypeIds = new Set();
    const changedProdIds = new Set();

    // Step A (Root Level Cascade):
    updatedIngs.forEach(ing => {
      if (strictNorm(ing.category) === sourceNorm) {
        ing.category = cleanTargetCat;
        ing.cat = targetKebab;
        ing.updatedAt = new Date().toISOString();
        changedIngIds.add(String(ing.id));

        // Cascade to all child subtypes of this root ingredient
        if (Array.isArray(ing.subtypes)) {
          ing.subtypes.forEach(st => {
            st.category = cleanTargetCat;
            st.cat = targetKebab;
            if (st.id) changedSubtypeIds.add(String(st.id));
          });
        }

        // Cascade to all products linked directly or via groupId to this root ingredient
        updatedProds.forEach(prod => {
          const ingRefId = String(prod.ingredientId || prod.groupId || '');
          if (ingRefId && ingRefId === String(ing.id)) {
            prod.category = cleanTargetCat;
            prod.cat = targetKebab;
            prod.updatedAt = new Date().toISOString();
            changedProdIds.add(String(prod.id));
          }
        });
      }
    });

    // Step B (Sub-type Level Cascade):
    updatedIngs.forEach(ing => {
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(st => {
          if (strictNorm(st.category) === sourceNorm) {
            st.category = cleanTargetCat;
            st.cat = targetKebab;
            if (st.id) changedSubtypeIds.add(String(st.id));
            changedIngIds.add(String(ing.id));
            ing.updatedAt = new Date().toISOString();

            // Cascade to all products linked to this specific sub-type
            updatedProds.forEach(prod => {
              const subRefId = String(prod.subtypeId || prod.subTypeId || '');
              if (subRefId && st.id && subRefId === String(st.id)) {
                prod.category = cleanTargetCat;
                prod.cat = targetKebab;
                prod.updatedAt = new Date().toISOString();
                changedProdIds.add(String(prod.id));
              }
            });
          }
        });
      }
    });

    // Step C (Product Level Cascade for remaining orphaned products):
    updatedProds.forEach(prod => {
      if (strictNorm(prod.category) === sourceNorm) {
        prod.category = cleanTargetCat;
        prod.cat = targetKebab;
        prod.updatedAt = new Date().toISOString();
        changedProdIds.add(String(prod.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedSubtypeIds, changedProdIds };
  };

  // Update in-memory Store state first
  const state = getStoreState() || {};
  const categories = (state.categories || []).filter(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) !== sourceNorm;
  });
  if (!categories.some(c => strictNorm(typeof c === 'string' ? c : c?.name) === targetNorm)) {
    categories.push(cleanTargetCat);
  }

  const { updatedIngs, updatedProds } = cascadeCategoryReassignment(state.ingredients, state.products);

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    const ingSnap = await householdRef.collection('ingredients').get();
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const prodSnap = await householdRef.collection('products').get();
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = cascadeCategoryReassignment(dbIngs, dbProds);

    const commitChunkedOps = async (ops) => {
      if (ops.length === 0) return;
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const chunkBatch = db.batch();
        const chunk = ops.slice(i, i + CHUNK_SIZE);
        chunk.forEach(op => op(chunkBatch));
        await chunkBatch.commit();
      }
    };

    const mergeOps = [];

    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        mergeOps.push((b) => b.update(ing.ref, {
          category: ing.category,
          cat: ing.cat,
          subtypes: ing.subtypes || [],
          updatedAt: new Date().toISOString()
        }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        mergeOps.push((b) => b.update(prod.ref, {
          category: prod.category,
          cat: prod.cat,
          updatedAt: new Date().toISOString()
        }));
      }
    });

    // Update the categories array in Settings doc
    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const updatedCats = (data.categories || []).filter(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) !== sourceNorm;
      });
      if (!updatedCats.some(c => strictNorm(typeof c === 'string' ? c : c?.name) === targetNorm)) {
        updatedCats.push(cleanTargetCat);
      }
      mergeOps.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(mergeOps);
    return { success: true };
  } catch (err) {
    console.error('[HouseholdRepository] mergeCategory error:', err);
    throw err;
  }
}

export async function mergeAllDuplicates() {
  if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
  
  const slugCategory = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');

  try {
    const batch = db.batch();
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

    // Fetch existing data
    const categoriesDocRef = householdRef.collection('settings').doc('categories');
    const categoriesSnap = await categoriesDocRef.get();
    let categoriesList = [];
    if (categoriesSnap.exists) {
      categoriesList = categoriesSnap.data().categories || [];
    }

    const ingSnap = await householdRef.collection('ingredients').get();
    const prodSnap = await householdRef.collection('products').get();

    const ingredients = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const products = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    // Let's gather all unique raw category strings present in the system
    const rawCategoriesSet = new Set();
    categoriesList.forEach(c => {
      const name = typeof c === 'string' ? c : c?.name;
      if (name) rawCategoriesSet.add(name);
    });
    ingredients.forEach(i => {
      if (i.category) rawCategoriesSet.add(i.category);
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (st.category) rawCategoriesSet.add(st.category);
        });
      }
    });
    products.forEach(p => {
      if (p.category) rawCategoriesSet.add(p.category);
    });

    const rawList = Array.from(rawCategoriesSet);

    // Group categories using strict string normalisation (lowercase, .trim(), stripping trailing punctuation)
    const strictNormalize = (str) => {
      return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]+$/, '');
    };

    const groups = new Map(); // strictNormalized -> Array of raw names
    rawList.forEach(raw => {
      const norm = strictNormalize(raw);
      if (norm) {
        if (!groups.has(norm)) {
          groups.set(norm, []);
        }
        groups.get(norm).push(raw);
      }
    });

    const canonicalMap = new Map(); // originalName -> masterName
    const updatedCategoriesList = [];

    // Identify master category for each group
    for (const [norm, names] of groups.entries()) {
      if (names.length === 1) {
        canonicalMap.set(names[0], names[0]);
        updatedCategoriesList.push(names[0]);
        continue;
      }

      // Count child items (ingredients + products) for each name
      let masterName = names[0];
      let maxCount = -1;

      names.forEach(name => {
        const ingCount = ingredients.filter(i => {
          const matchDirect = i.category === name || slugCategory(i.category) === slugCategory(name);
          const matchSub = Array.isArray(i.subtypes) && i.subtypes.some(st => st.category === name || slugCategory(st.category) === slugCategory(name));
          return matchDirect || matchSub;
        }).length;

        const prodCount = products.filter(p => p.category === name || slugCategory(p.category) === slugCategory(name)).length;
        const total = ingCount + prodCount;

        if (total > maxCount) {
          maxCount = total;
          masterName = name;
        }
      });

      // Map all names in this group to the masterName
      names.forEach(name => {
        canonicalMap.set(name, masterName);
      });

      updatedCategoriesList.push(masterName);
    }

    // Now execute a batch transaction to re-point all duplicates to master
    let ingredientsChanged = 0;
    ingredients.forEach(i => {
      let changed = false;
      let newCat = i.category;
      if (i.category && canonicalMap.has(i.category)) {
        const mapped = canonicalMap.get(i.category);
        if (i.category !== mapped) {
          newCat = mapped;
          changed = true;
        }
      }
      const subtypes = Array.isArray(i.subtypes) ? [...i.subtypes] : [];
      subtypes.forEach(st => {
        if (st.category && canonicalMap.has(st.category)) {
          const mapped = canonicalMap.get(st.category);
          if (st.category !== mapped) {
            st.category = mapped;
            st.cat = slugifyToKebab(mapped);
            changed = true;
          }
        }
      });

      if (changed) {
        batch.update(i.ref, {
          category: newCat,
          cat: slugifyToKebab(newCat),
          subtypes,
          updatedAt: new Date().toISOString()
        });
        ingredientsChanged++;
      }
    });

    let productsChanged = 0;
    products.forEach(p => {
      if (p.category && canonicalMap.has(p.category)) {
        const mapped = canonicalMap.get(p.category);
        if (p.category !== mapped) {
          batch.update(p.ref, {
            category: mapped,
            cat: slugifyToKebab(mapped),
            updatedAt: new Date().toISOString()
          });
          productsChanged++;
        }
      }
    });

    // Save the deduplicated categories list in Settings categories doc
    const finalUniqueCats = Array.from(new Set(updatedCategoriesList)).sort((a, b) => a.localeCompare(b));
    batch.set(categoriesDocRef, { categories: finalUniqueCats, updatedAt: new Date().toISOString() }, { merge: true });

    await batch.commit();
    return { success: true, ingredientsChanged, productsChanged, categories: finalUniqueCats };
  } catch (err) {
    console.error('[HouseholdRepository] mergeAllDuplicates error:', err);
    throw err;
  }
}

/**
 * Helper to scan and remap recipe ingredients across recipes array.
 */
function remapRecipeIngredients(recipes = [], predicateRemap) {
  const modified = [];
  const clonedRecipes = recipes.map(recipe => {
    if (!recipe) return recipe;
    let recipeChanged = false;
    const rCopy = JSON.parse(JSON.stringify(recipe));

    const checkAndRemap = (item) => {
      if (!item) return;
      const changed = predicateRemap(item);
      if (changed) recipeChanged = true;
    };

    if (Array.isArray(rCopy.ingredientSections)) {
      rCopy.ingredientSections.forEach(sec => {
        if (Array.isArray(sec.ingredients)) {
          sec.ingredients.forEach(checkAndRemap);
        }
      });
    }
    if (Array.isArray(rCopy.ingredients)) {
      rCopy.ingredients.forEach(checkAndRemap);
    }

    if (recipeChanged) {
      rCopy.updatedAt = new Date().toISOString();
      modified.push(rCopy);
      return rCopy;
    }
    return recipe;
  });

  return { allRecipes: clonedRecipes, modifiedRecipes: modified };
}

/**
 * Promotes a sub-type to a standalone root ingredient and updates all referencing recipes.
 * @param {string} parentId
 * @param {string} subtypeId
 */
export async function promoteSubtype(parentId, subtypeId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const parent = ings.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) {
    throw new Error(`Parent ingredient ${parentId} not found or has no subtypes`);
  }

  const subIdx = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIdx < 0) {
    throw new Error(`Subtype ${subtypeId} not found on parent ${parentId}`);
  }

  const [removedSub] = parent.subtypes.splice(subIdx, 1);
  const newRootId = removedSub.id || `ing_${Date.now()}`;
  const newRoot = {
    id: newRootId,
    name: removedSub.name,
    category: parent.category || 'Store Cupboard',
    notes: removedSub.notes || '',
    aliases: Array.isArray(removedSub.aliases) ? removedSub.aliases : [],
    subtypes: [],
    defaultProductId: removedSub.defaultProductId || null,
    updatedAt: new Date().toISOString()
  };
  parent.updatedAt = new Date().toISOString();
  ings.push(newRoot);

  // Remap recipe ingredients matching oldParentId:subTypeId or (pantryItemId === parentId && subtypeId === subtypeId)
  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(parentId) && String(item.subtypeId || '') === String(subtypeId))
      || String(item.targetId || '') === `${parentId}:${subtypeId}`;
    if (isMatch) {
      item.pantryItemId = String(newRootId);
      item.ingredientId = String(newRootId);
      item.subtypeId = null;
      item.subtypeName = null;
      item.name = newRoot.name;
      return true;
    }
    return false;
  });

  // Optimistic store updates
  setIngredients(ings);
  setRecipes(allRecipes);

  // Firestore batch write
  if (isDbAvailable()) {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    // 1. Update parent & write new root
    const parentDoc = { ...parent }; delete parentDoc.id;
    const newRootDoc = { ...newRoot }; delete newRootDoc.id;
    batch.set(ingColRef.doc(String(parentId)), parentDoc, { merge: true });
    batch.set(ingColRef.doc(String(newRootId)), newRootDoc);

    // 2. Write updated recipes
    modifiedRecipes.forEach(r => {
      const rData = { ...r }; delete rData.id;
      batch.set(recipeColRef.doc(String(r.id)), rData, { merge: true });
    });

    await batch.commit();
  }

  return { success: true, newRootId, modifiedRecipesCount: modifiedRecipes.length };
}

/**
 * Moves a sub-type to a new parent ingredient and updates all referencing recipes.
 * @param {string} oldParentId
 * @param {string} subtypeId
 * @param {string} newParentId
 */
export async function moveSubtype(oldParentId, subtypeId, newParentId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const oldParent = ings.find(i => String(i.id) === String(oldParentId));
  const newParent = ings.find(i => String(i.id) === String(newParentId));
  if (!oldParent || !Array.isArray(oldParent.subtypes)) {
    throw new Error(`Old parent ${oldParentId} not found`);
  }
  if (!newParent) {
    throw new Error(`New parent ${newParentId} not found`);
  }

  const subIdx = oldParent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIdx < 0) {
    throw new Error(`Subtype ${subtypeId} not found on parent ${oldParentId}`);
  }

  const [movedSub] = oldParent.subtypes.splice(subIdx, 1);
  if (!Array.isArray(newParent.subtypes)) newParent.subtypes = [];
  newParent.subtypes.push(movedSub);
  oldParent.updatedAt = new Date().toISOString();
  newParent.updatedAt = new Date().toISOString();

  // Remap recipe ingredients: oldParentId:subTypeId -> newParentId:subTypeId
  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(oldParentId) && String(item.subtypeId || '') === String(subtypeId))
      || String(item.targetId || '') === `${oldParentId}:${subtypeId}`;
    if (isMatch) {
      item.pantryItemId = String(newParentId);
      item.ingredientId = String(newParentId);
      item.subtypeId = String(subtypeId);
      item.name = `${newParent.name} (${movedSub.name})`;
      return true;
    }
    return false;
  });

  setIngredients(ings);
  setRecipes(allRecipes);

  if (isDbAvailable()) {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    const oldParentDoc = { ...oldParent }; delete oldParentDoc.id;
    const newParentDoc = { ...newParent }; delete newParentDoc.id;
    batch.set(ingColRef.doc(String(oldParentId)), oldParentDoc, { merge: true });
    batch.set(ingColRef.doc(String(newParentId)), newParentDoc, { merge: true });

    modifiedRecipes.forEach(r => {
      const rData = { ...r }; delete rData.id;
      batch.set(recipeColRef.doc(String(r.id)), rData, { merge: true });
    });

    await batch.commit();
  }

  return { success: true, modifiedRecipesCount: modifiedRecipes.length };
}

/**
 * Merges a sub-type into a sibling sub-type and updates all referencing recipes.
 * @param {string} parentId
 * @param {string} oldSubtypeId
 * @param {string} newSubtypeId
 */
export async function mergeSubtype(parentId, oldSubtypeId, newSubtypeId) {
  const state = getStoreState() || {};
  const ings = JSON.parse(JSON.stringify(state.ingredients || []));
  const recipes = state.recipes || [];

  const parent = ings.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) {
    throw new Error(`Parent ingredient ${parentId} not found`);
  }

  const oldSubIdx = parent.subtypes.findIndex(s => String(s.id) === String(oldSubtypeId));
  const newSub = parent.subtypes.find(s => String(s.id) === String(newSubtypeId));
  if (oldSubIdx < 0 || !newSub) {
    throw new Error(`Subtypes for merge not found on parent ${parentId}`);
  }

  const [removedSub] = parent.subtypes.splice(oldSubIdx, 1);
  const targetAliases = new Set(Array.isArray(newSub.aliases) ? newSub.aliases : []);
  if (removedSub.name) targetAliases.add(removedSub.name);
  if (Array.isArray(removedSub.aliases)) removedSub.aliases.forEach(a => targetAliases.add(a));
  newSub.aliases = Array.from(targetAliases);
  parent.updatedAt = new Date().toISOString();

  // Remap recipe ingredients: parentId:oldSubtypeId -> parentId:newSubtypeId
  const { allRecipes, modifiedRecipes } = remapRecipeIngredients(recipes, (item) => {
    const isMatch = (String(item.pantryItemId || item.ingredientId || '') === String(parentId) && String(item.subtypeId || '') === String(oldSubtypeId))
      || String(item.targetId || '') === `${parentId}:${oldSubtypeId}`;
    if (isMatch) {
      item.subtypeId = String(newSubtypeId);
      item.subtypeName = newSub.name;
      item.name = `${parent.name} (${newSub.name})`;
      return true;
    }
    return false;
  });

  setIngredients(ings);
  setRecipes(allRecipes);

  if (isDbAvailable()) {
    const batch = db.batch();
    const ingColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const recipeColRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes');

    const parentDoc = { ...parent }; delete parentDoc.id;
    batch.set(ingColRef.doc(String(parentId)), parentDoc, { merge: true });

    modifiedRecipes.forEach(r => {
      const rData = { ...r }; delete rData.id;
      batch.set(recipeColRef.doc(String(r.id)), rData, { merge: true });
    });

    await batch.commit();
  }

  return { success: true, modifiedRecipesCount: modifiedRecipes.length };
}

if (typeof window !== 'undefined') {
  window.HouseholdRepository = HouseholdRepository;
  window.getPlanHistory = getPlanHistory;
  window.savePlanHistory = savePlanHistory;
  window.promoteSubtype = promoteSubtype;
  window.moveSubtype = moveSubtype;
  window.mergeSubtype = mergeSubtype;
}

