/**
 * src/services/SyncRepository.js
 * Repository for database migrations and bloat cleanup.
 */
import { db, HOUSEHOLD_ID } from '../config/firebase.js';

export async function executeSubcollectionMigration() {
  if (!db) return { success: false, error: 'Database unavailable' };
  try {
    const rootDocRef = db.collection('households').doc(HOUSEHOLD_ID);
    const rootSnap = await rootDocRef.get();
    if (!rootSnap.exists) return { success: false, error: 'Root document not found' };
    const rootData = rootSnap.data() || {};
    const batch = db.batch();
    const planHistory = Array.isArray(rootData.planHistory) ? rootData.planHistory : [];
    const historyColRef = rootDocRef.collection('plan_history');
    planHistory.forEach((plan, idx) => {
      const planId = plan.id || plan.planId || `plan_${idx}_${Date.now()}`;
      batch.set(historyColRef.doc(planId), { ...plan, id: planId, updatedAt: plan.updatedAt || new Date().toISOString() });
    });
    const ingredientGroups = Array.isArray(rootData.ingredientGroups) ? rootData.ingredientGroups : [];
    const ingredientFamilies = Array.isArray(rootData.ingredientFamilies) ? rootData.ingredientFamilies : [];
    batch.set(rootDocRef.collection('metadata').doc('taxonomy'), { ingredientGroups, ingredientFamilies, updatedAt: new Date().toISOString() });
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
        if (/cache|snapshot|log/i.test(key)) delete obj[key];
        else if (obj[key] && typeof obj[key] === 'object') deepClean(obj[key]);
      });
    };
    deepClean(preferences);
    const updatedRootData = { ...rootData };
    delete updatedRootData.planHistory;
    delete updatedRootData.ingredientGroups;
    delete updatedRootData.ingredientFamilies;
    updatedRootData.preferences = preferences;
    updatedRootData.updatedAt = new Date().toISOString();
    batch.set(rootDocRef, updatedRootData, { merge: true });
    await batch.commit();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
export async function cleanPreferencesBloat() {
  const rootDocRef = db.collection('households').doc(HOUSEHOLD_ID);
  const snap = await rootDocRef.get();
  if (!snap.exists) return { success: false, error: 'Root document not found' };
  const rootData = snap.data() || {};
  const preferences = rootData.preferences || {};

  const deepClean = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    delete obj.cachedSnapshots;
    delete obj.historyCache;
    delete obj.mealHistorySnapshots;
    delete obj.planHistory;
    delete obj.ingredientGroups;
    delete obj.ingredientFamilies;
    Object.keys(obj).forEach(key => {
      if (/cache|snapshot|log/i.test(key)) delete obj[key];
      else if (obj[key] && typeof obj[key] === 'object') deepClean(obj[key]);
    });
  };

  deepClean(preferences);
  
  await rootDocRef.update({ preferences, updatedAt: new Date().toISOString() });
  return { success: true };
}
