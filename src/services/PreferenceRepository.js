/**
 * src/services/PreferenceRepository.js
 * Repository for preference and advisory management.
 */
import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { getState as getStoreState } from '../store/store.js';
import { isDbAvailable } from './RecipeFirestoreRepository.js';

export function whitelistPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return {};
  const whitelisted = {};
  const allowedKeys = [
    'nutritionTargets', 'profiles', 'settings', 'theme', 'mealPlanSettings', 'activeView', 'userPrefs', 'dismissedQualityAdvisories', 'dismissedAdvisories', 'dismissed_advisories', 'updatedAt'
  ];
  Object.keys(preferences).forEach(key => {
    if (!allowedKeys.includes(key)) return;
    const val = preferences[key];
    const valSizeBytes = new Blob([JSON.stringify(val)]).size;
    if (valSizeBytes > 10240) return;
    whitelisted[key] = val;
  });
  return whitelisted;
}

export function enforcePayloadSafetyValve(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  let byteSize = new Blob([JSON.stringify(payload)]).size;
  if (byteSize > 819200) {
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
    }
    if (byteSize > 819200) {
      throw new Error(`[PreferenceRepository] Emergency Truncation Failed! Payload remains larger than 819,200 bytes (${byteSize} bytes).`);
    }
  }
  return payload;
}

export function prunePreferences(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const storeState = (typeof getStoreState === 'function') ? getStoreState() : {};
  const currentPreferences = storeState.preferences || storeState || {};
  let cloned;
  try {
    cloned = JSON.parse(JSON.stringify(obj));
  } catch (e) { cloned = obj; }
  const clean = (target) => {
    if (!target || typeof target !== 'object') return;
    for (const key of Object.keys(target)) {
      const val = target[key];
      if (
        (key === 'dismissedQualityAdvisories' || 
         key === 'dismissedAdvisories' || 
         key === 'dismissed_advisories' || 
         key === 'advisoryHistory' || 
         key === 'advisory_history') && 
        Array.isArray(val)
      ) {
        let filtered = val.filter(item => {
          const itemStr = typeof item === 'string' ? item : (item?.key || item?.id || '');
          return !itemStr.startsWith('advisory:recipe-macro-sync:') && !itemStr.startsWith('advisory:recipe-low-cal:');
        });
        if (filtered.length > 50) filtered = filtered.slice(-50);
        target[key] = filtered;
      }
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
  let size = 0;
  try {
    size = new TextEncoder().encode(JSON.stringify(cloned)).length;
  } catch (e) {}
  if (size > 400 * 1024) {
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

export async function savePreferencesWithAutoPrune(preferences) {
  if (!preferences) return { byteSize: 0, preferences: {} };
  if (preferences.cachedSnapshots) delete preferences.cachedSnapshots;
  if (preferences.historyCache) preferences.historyCache = [];
  if (preferences.mealHistorySnapshots) preferences.mealHistorySnapshots = [];
  if (Array.isArray(preferences.dismissedQualityAdvisories)) {
    preferences.dismissedQualityAdvisories = preferences.dismissedQualityAdvisories.slice(-20);
  }
  const whitelistedPrefs = whitelistPreferences(preferences);
  const safePrefs = enforcePayloadSafetyValve(whitelistedPrefs);
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

export async function getHouseholdData() {
  if (!isDbAvailable()) return null;
  try {
    const safeGet = async (ref) => {
      if (!ref || typeof ref.get !== 'function') return null;
      try {
        const netPromise = ref.get();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 2500)
        );
        return await Promise.race([netPromise, timeoutPromise]);
      } catch (_e) {
        try { return await ref.get({ source: 'cache' }); } catch (_ce) { return null; }
      }
    };

    const [rootSnap, taxonomySnap, prefSnap] = await Promise.all([
      safeGet(db.collection('households').doc(HOUSEHOLD_ID)),
      safeGet(db.collection('households').doc(HOUSEHOLD_ID).collection('metadata').doc('taxonomy')),
      safeGet(db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences'))
    ]);
    const rootData = rootSnap && rootSnap.exists ? rootSnap.data() : {};
    const taxonomyData = taxonomySnap && taxonomySnap.exists ? taxonomySnap.data() : {};
    const prefData = prefSnap && prefSnap.exists ? prefSnap.data() : {};
    return {
      ...(rootData || {}),
      ...(taxonomyData || {}),
      ...(prefData || {}),
      userPrefs: {
        ...(rootData.userPrefs || {}),
        ...(prefData.userPrefs || {})
      },
      settings: {
        ...(rootData.settings || {}),
        ...(prefData.settings || {})
      }
    };
  } catch (err) {
    console.warn('[PreferenceRepository] Error fetching household data:', err);
    return null;
  }
}

export async function getPreferences() {
  return getHouseholdData();
}

export async function savePreferences(preferences) {
  return savePreferencesWithAutoPrune(preferences);
}
