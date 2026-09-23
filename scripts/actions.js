/**
 * PlatePlan v3.3.7-mod - Action Sheet and Plan History Deletion Engine
 */

window.executeSheetAction = function(actionFnName, ...args) {
  const sheet = document.getElementById('mobile-action-sheet');
  const overlay = document.getElementById('mobile-action-sheet-overlay');
  const wrap = document.getElementById('mobile-action-sheet-wrap');
  if (sheet) sheet.classList.remove('open', 'active');
  if (overlay) overlay.classList.remove('open', 'active');
  if (wrap) wrap.classList.remove('open', 'active');

  setTimeout(() => {
    if (typeof window[actionFnName] === 'function') {
      window[actionFnName](...args);
    } else if (typeof actionFnName === 'function') {
      actionFnName(...args);
    } else {
      console.error(`[executeSheetAction] Function '${actionFnName}' not found on window.`);
    }
  }, 50);
};

window.deletePlanHistory = function(index) {
  const historyList = window.state?.planHistory || (typeof state !== 'undefined' ? state?.planHistory : []) || [];
  const item = historyList[index];
  if (!item) return;

  const escapeHtml = typeof window.ppEscapeHtml === 'function' ? window.ppEscapeHtml : (s => s);
  const confirmModalFn = typeof window.openAppConfirmModal === 'function' ? window.openAppConfirmModal : (typeof openAppConfirmModal === 'function' ? openAppConfirmModal : null);

  const performDelete = async () => {
    // 1. Mutate local array
    if (window.state?.planHistory) {
      window.state.planHistory.splice(index, 1);
    }
    if (typeof state !== 'undefined' && state?.planHistory && state.planHistory !== window.state?.planHistory) {
      state.planHistory.splice(index, 1);
    }

    // 2. Persist to localStorage & backup
    try {
      localStorage.setItem('plateplan_v2', JSON.stringify(window.state || state));
      if (typeof safeSaveHistoryBackup === 'function') {
        safeSaveHistoryBackup(window.state?.planHistory || state?.planHistory);
      } else if (typeof window.safeSaveHistoryBackup === 'function') {
        window.safeSaveHistoryBackup(window.state?.planHistory || state?.planHistory);
      }
    } catch(e) {}

    // 3. Direct Firestore root document write
    if (typeof platePlanDb !== 'undefined' || typeof window.platePlanDb !== 'undefined') {
      const db = (typeof platePlanDb !== 'undefined' ? platePlanDb : window.platePlanDb);
      try {
        const getHidFn = typeof getPlatePlanHouseholdId === 'function'
          ? getPlatePlanHouseholdId
          : (typeof window.getPlatePlanHouseholdId === 'function' ? window.getPlatePlanHouseholdId : null);
        const householdId = getHidFn ? getHidFn() : ((window.state && window.state.householdId) || window.ACTIVE_HOUSEHOLD_ID || 'elliott-chloe');

        if (db && typeof db.collection === 'function') {
          const serverTs = (typeof firebase !== 'undefined' && firebase.firestore?.FieldValue?.serverTimestamp)
            ? firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString();
          await db.collection('households').doc(householdId).set({
            planHistory: window.state?.planHistory || state?.planHistory || [],
            updatedAt: serverTs
          }, { merge: true });
          console.log('[v3.3.7-mod] Successfully written planHistory directly to root household document.');
        }
      } catch (err) {
        console.error('[v3.3.7-mod] Direct Firestore planHistory write failed:', err);
      }
    }

    // 4. Update UI
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    } else if (typeof renderAll === 'function') {
      renderAll();
    } else if (typeof window.renderMealPlanLibrary === 'function') {
      window.renderMealPlanLibrary();
    } else if (typeof renderPlanHistoryPanel === 'function') {
      renderPlanHistoryPanel();
    }

    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Saved meal plan deleted', 'success');
    }
  };

  if (confirmModalFn) {
    confirmModalFn(
      'Delete saved meal plan?',
      `Delete <strong>${escapeHtml(item.name || 'this saved plan')}</strong> from your library?`,
      'Delete plan',
      performDelete
    );
  } else {
    performDelete();
  }
};
