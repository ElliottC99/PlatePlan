/**
 * src/repositories/PlanRepository.js (v3.24.0)
 * Subcollection Plan Persistence Repository targeting 'households/elliott-chloe/plans/{planId}'.
 * Completely isolated from root preferences payload.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';

function isDbAvailable() {
  if (!db) {
    console.warn('[PlanRepository] Firestore db instance not initialized.');
    return false;
  }
  return true;
}

export async function savePlan(plan) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!plan || typeof plan !== 'object') return { success: false, error: 'Invalid plan data' };

    const planId = plan.id || db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc().id;
    const planData = {
      ...plan,
      id: planId,
      updatedAt: new Date().toISOString(),
      createdAt: plan.createdAt || new Date().toISOString()
    };

    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans');
    
    // Save to specific planId doc and current active plan doc
    await Promise.all([
      colRef.doc(planId).set(planData, { merge: true }),
      colRef.doc('current').set(planData, { merge: true })
    ]);

    return { success: true, plan: planData };
  } catch (err) {
    console.error('[PlanRepository] Error saving plan:', err);
    return { success: false, error: err.message || err };
  }
}

export async function getPlan(planId) {
  try {
    if (!isDbAvailable() || !planId) return null;
    const docSnap = await db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc(planId).get();
    return (docSnap && docSnap.exists) ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (err) {
    console.warn('[PlanRepository] Error fetching plan:', err.message || err);
    return null;
  }
}

export async function getCurrentActivePlan() {
  return getPlan('current');
}

export async function deletePlan(planId) {
  try {
    if (!isDbAvailable() || !planId) return { success: false, error: 'Invalid parameters' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('plans').doc(planId).delete();
    return { success: true };
  } catch (err) {
    console.error('[PlanRepository] Error deleting plan:', err);
    return { success: false, error: err.message || err };
  }
}

export async function getPlanHistory() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plans');
    const snap = await colRef.get();
    if (!snap || !snap.docs) return [];
    return snap.docs
      .filter(doc => doc.id !== 'current')
      .map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[PlanRepository] Error fetching plan history:', err.message || err);
    return [];
  }
}

const PlanRepository = {
  savePlan,
  getPlan,
  getCurrentActivePlan,
  deletePlan,
  getPlanHistory
};

if (typeof window !== 'undefined') {
  window.PlanRepository = PlanRepository;
}

export default PlanRepository;
