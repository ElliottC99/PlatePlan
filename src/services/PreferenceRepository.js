/**
 * src/services/PreferenceRepository.js (v3.38.11)
 * Dedicated Micro-Repository for User Preferences, Settings & Plan History.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { safeFirestoreGet } from './HouseholdRepository.js';

function isDbAvailable() {
  return Boolean(db && HOUSEHOLD_ID);
}

export async function getPlanHistory(uid) {
  if (!isDbAvailable()) return [];
  try {
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('plan_history'));
    if (snap && snap.docs) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return [];
  } catch (err) {
    console.error('[PreferenceRepository] Error fetching plan history on-demand:', err);
    return [];
  }
}

export async function savePlanHistory(planId, plan, uid) {
  if (!isDbAvailable()) return false;
  if (!planId || !plan) return false;
  try {
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('plan_history').doc(planId);
    await docRef.set({ ...plan, id: planId, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.error('[PreferenceRepository] Error saving plan history:', err);
    return false;
  }
}
