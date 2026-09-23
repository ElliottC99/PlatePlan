/**
 * scripts/core/state.js
 * PlatePlan State Persistence, Cloud Sync & Recovery Engine
 * Classic global namespace script.
 */

(() => {
  const sanitizePayloadForFirestore = (data) => {

  if (data === undefined) return null;
  try {
    const cleaned = stripUndefinedValues(data);
    const jsonStr = (typeof window !== 'undefined' && typeof window.safeJsonStringify === 'function')
      ? window.safeJsonStringify(cleaned, null, 'null')
      : JSON.stringify(cleaned);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error('[PAYLOAD SANITIZATION ERROR]', err);
    return data;
  }
};

const stripUndefinedValues = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefinedValues);
  const copy = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      copy[k] = stripUndefinedValues(v);
    }
  }
  return copy;
};

const unwrapAndCleanItem = (item) => {
  if (!item || typeof item !== 'object') return item;
  let target = item;
  if (target.value && typeof target.value === 'object') {
    target = { ...target.value, ...target };
    delete target.value;
  }
  const clean = { ...target };
  delete clean.deviceId;
  delete clean.operationId;
  delete clean.revision;
  delete clean.updatedBy;
  delete clean._syncStatus;
  delete clean._dirty;
  delete clean.totalKcal;
  delete clean.totalProtein;
  delete clean.totalCarb;
  delete clean.totalFat;
  delete clean.totalNutrition;
  if (clean.ingredients && Array.isArray(clean.ingredients)) {
    clean.isFavorite = (clean.isFavorite !== undefined) ? !!clean.isFavorite : false;
    clean.isFavourite = clean.isFavorite;
  }
  return clean;
};

const sanitizePlanForFirestore = (planData) => {
  if (!planData || typeof planData !== 'object') return null;
  try {
    const cleaned = unwrapAndCleanItem(planData);
    return sanitizePayloadForFirestore(cleaned);
  } catch (err) {
    console.error('[PLAN SANITIZATION ERROR]', err);
    return sanitizePayloadForFirestore(planData);
  }
};

const sanitizeRecipeForFirestore = (recipeData) => {
  if (!recipeData || typeof recipeData !== 'object') return null;
  try {
    const cleaned = unwrapAndCleanItem(recipeData);
    return sanitizePayloadForFirestore(cleaned);
  } catch (err) {
    console.error('[RECIPE SANITIZATION ERROR]', err);
    return sanitizePayloadForFirestore(recipeData);
  }
};

const sanitizeIngredientForFirestore = (ingData) => {
  if (!ingData || typeof ingData !== 'object') return null;
  try {
    const cleaned = unwrapAndCleanItem(ingData);
    return sanitizePayloadForFirestore(cleaned);
  } catch (err) {
    console.error('[INGREDIENT SANITIZATION ERROR]', err);
    return sanitizePayloadForFirestore(ingData);
  }
};

const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  return sanitizePayloadForFirestore(unwrapAndCleanItem(obj));
};

const safeLocalStorageSet = (key, val) => {
  try {
    const payload = typeof val === 'string' ? val : JSON.stringify(val);
    localStorage.setItem(key, payload);
    return true;
  } catch (e) {
    console.warn('[LocalStorage Write Warning]', e);
    return false;
  }
};

const safeSaveHistoryBackup = (historyList) => {
  try {
    const payload = JSON.stringify(historyList || []);
    localStorage.setItem('plateplan_history_backup', payload);
    return true;
  } catch (e) {
    return false;
  }
};

const savePlan = async (planData = window.state?.plan, immediate = true, options = {}) => {
  if (typeof window.queuePlanSave === 'function') {
    return await window.queuePlanSave(planData, immediate, options);
  }
  return await savePlanTransactional(planData, options);
};

const savePlanTransactional = async (planData, options = {}) => {
  if (typeof window.updateUIState === 'function') {
    window.updateUIState({ saveStatus: 'saving' });
  }

  let firestoreSuccess = false;
  let localStorageSuccess = false;

  let sanitizedPlan;
  try {
    sanitizedPlan = (typeof window.sanitizePlanForFirestore === 'function')
      ? window.sanitizePlanForFirestore(planData)
      : planData;
  } catch (cleanErr) {
    console.error("[Firestore Sync Error]", cleanErr);
    if (typeof window.updateUIState === 'function') window.updateUIState({ saveStatus: 'error' });
    if (options?.showToast === true && typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast("Could not save plan. Payload size exceeds limits.", "error");
    }
    if (window.state) window.state.uncommittedDraft = planData;
    return false;
  }

  const targetHouseholdId = window.state?.householdId 
    || window.CURRENT_HOUSEHOLD_ID 
    || window.activeHouseholdId 
    || window.state?.meta?.householdId 
    || 'elliott-chloe';
  if (window.state) window.state.householdId = targetHouseholdId;

  const db = window.platePlanDb || (window.firebase && firebase.firestore && firebase.firestore());
  if (db && navigator.onLine) {
    try {
      const planId = planData?.id || 'active_plan';
      const planRef = db.collection(`households/${targetHouseholdId}/plans`).doc(planId);
      const serverTs = (window.firebase && firebase.firestore?.FieldValue?.serverTimestamp)
        ? firebase.firestore.FieldValue.serverTimestamp()
        : new Date().toISOString();
      await planRef.set({ ...sanitizedPlan, updatedAt: serverTs }, { merge: true });

      if (planId === 'active_plan' || !planData?.id) {
        const plannerRef = db.collection(`households/${targetHouseholdId}/data`).doc('planner');
        await plannerRef.set({ plan: sanitizedPlan, updatedAt: serverTs }, { merge: true });
      }
      firestoreSuccess = true;
    } catch (err) {
      console.error("[Firestore Sync Error]", err);
    }
  }

  localStorageSuccess = safeLocalStorageSet('plateplan_plan_backup', sanitizedPlan);

  if (firestoreSuccess || localStorageSuccess) {
    if (window.state?.plan) {
      window.state.plan.savedStatus = 'Manually saved';
      window.state.plan.updatedAt = new Date().toISOString();
      if (typeof window.updatePlanHistory === 'function') window.updatePlanHistory(window.state.plan);
    }
    if (window.state) window.state.uncommittedDraft = null;
    if (typeof window.updateUIState === 'function') window.updateUIState({ saveStatus: 'saved' });
    if (options?.showToast === true && typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast("Plan saved successfully!", "success");
    }
    return true;
  } else {
    if (typeof window.updateUIState === 'function') window.updateUIState({ saveStatus: 'error' });
    if (options?.showToast === true && typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast("Could not save plan. Stashed in temporary session memory.", "error");
    }
    if (window.state) window.state.uncommittedDraft = sanitizedPlan;
    return false;
  }
};

const pushStateToCloud = async (force = false) => {
  if (window.isHydrating) {
    console.log('[v3.3.7-mod STATE PERSISTENCE] PushStateToCloud blocked during hydration.');
    return Promise.resolve(false);
  }
  if (typeof window.pushStateToCloud === 'function' && window.pushStateToCloud !== pushStateToCloud) {
    return await window.pushStateToCloud(force);
  }
  return Promise.resolve(true);
};

const pullStateFromCloud = async () => {
  if (typeof window.readPlatePlanCloudProjection === 'function') {
    return await window.readPlatePlanCloudProjection();
  }
  return null;
};

const checkStartupPlanRecovery = (remotePlan = null) => {
  try {
    let localDraft = window.state?.uncommittedDraft;
    if (!localDraft) {
      const raw = localStorage.getItem('plateplan_plan_backup');
      if (raw) localDraft = JSON.parse(raw);
    }
    if (!localDraft || typeof localDraft !== 'object') return false;

    const hasSlots = localDraft.slots && Object.values(localDraft.slots).some(d => Object.values(d || {}).some(Boolean));
    if (!hasSlots) return false;

    const localTime = localDraft.updatedAt ? new Date(localDraft.updatedAt).getTime() : 0;
    const remoteTime = (remotePlan && remotePlan.updatedAt)
      ? new Date(remotePlan.updatedAt).getTime()
      : (window.state?.plan?.updatedAt ? new Date(window.state.plan.updatedAt).getTime() : 0);

    const remoteHasSlots = remotePlan?.slots && Object.values(remotePlan.slots).some(d => Object.values(d || {}).some(Boolean));
    if ((localTime > 0 && localTime > remoteTime + 2000) || (!remoteHasSlots && hasSlots)) {
      if (typeof window.renderPlanRecoveryBanner === 'function') {
        window.renderPlanRecoveryBanner(localDraft);
      }
      return true;
    }
  } catch (err) {
    console.warn('[Startup Recovery Sweep Warning]', err);
  }
  return false;
};

const restoreRecoveredPlan = () => {
  let draft = window.state?.uncommittedDraft;
  if (!draft) {
    try {
      const raw = localStorage.getItem('plateplan_plan_backup');
      if (raw) draft = JSON.parse(raw);
    } catch (e) {}
  }
  if (draft && window.state) {
    window.state.plan = draft;
    window.state.uncommittedDraft = null;
    safeLocalStorageSet('plateplan_plan_backup', sanitizePayloadForFirestore(draft));
    if (typeof window.saveState === 'function') window.saveState(true);
    if (typeof window.rebuildPlatePlanIndexes === 'function') window.rebuildPlatePlanIndexes();
    if (typeof window.renderPlan === 'function') window.renderPlan();
    if (typeof window.dismissPlanRecoveryBanner === 'function') window.dismissPlanRecoveryBanner();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Restored local plan draft successfully.', 'success');
    }
  }
};

if (typeof window !== 'undefined') {
  window.sanitizePayloadForFirestore = sanitizePayloadForFirestore;
  window.sanitizePlanForFirestore = sanitizePlanForFirestore;
  window.sanitizeRecipeForFirestore = sanitizeRecipeForFirestore;
  window.sanitizeIngredientForFirestore = sanitizeIngredientForFirestore;
  window.unwrapAndCleanItem = unwrapAndCleanItem;
  window.cleanObject = cleanObject;
  window.stripUndefinedValues = stripUndefinedValues;

  window.PlatePlanState = {
    sanitizePayloadForFirestore,
    sanitizePlanForFirestore,
    sanitizeRecipeForFirestore,
    sanitizeIngredientForFirestore,
    unwrapAndCleanItem,
    cleanObject,
    stripUndefinedValues,
    safeLocalStorageSet,
    safeSaveHistoryBackup,
    savePlan,
    savePlanTransactional,
    pushStateToCloud,
    pullStateFromCloud,
    checkStartupPlanRecovery,
    restoreRecoveredPlan
  };
}
})();
