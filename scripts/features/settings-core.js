/**
 * PlatePlan Settings Core & Preferences Module
 */
(function() {
  window.PlatePlanSettings = window.PlatePlanSettings || {};
  window.PlatePlanSettingsBackup = window.PlatePlanSettingsBackup || {};
  
  window.PlatePlanSettingsBackup.State = window.PlatePlanSettingsBackup.State || {
    pendingPlatePlanImport: null,
    isAuditing: false
  };

  const SettingsState = window.PlatePlanSettingsBackup.State;

  function loadPrefs() {
    const p = window.state?.prefs || {};
    const ecal = document.getElementById('pref-ecal');
    if (ecal) ecal.value = p.ecal || 2400;
    
    if (typeof window.syncPlatePlanVersionDisplay === 'function') {
      window.syncPlatePlanVersionDisplay();
    }
  }

  function savePrefs() {
    if (!window.state.prefs) window.state.prefs = {};
    const ecal = document.getElementById('pref-ecal')?.value;
    if (ecal) window.state.prefs.ecal = +ecal;
    
    if (typeof saveState === 'function') saveState(true);
    if (typeof showPlatePlanToast === 'function') showPlatePlanToast('Preferences saved');
  }

  function createRecoveryPoint(reason = 'Manual backup') {
    try {
      const raw = localStorage.getItem('plateplan_v2_recovery');
      const points = raw ? JSON.parse(raw) : [];
      const newPoint = {
        id: 'rec_' + Date.now(),
        time: new Date().toISOString(),
        reason,
        state: JSON.parse(JSON.stringify(window.state || {}))
      };
      points.unshift(newPoint);
      if (points.length > 10) points.length = 10;
      localStorage.setItem('plateplan_v2_recovery', JSON.stringify(points));
    } catch (e) {
      console.warn('[Recovery] Failed to create recovery point', e);
    }
  }

  function resetAllData() {
    const openConfirm = window.openAppConfirmModal || (() => {});
    openConfirm('Reset all data?', 'This will permanently delete everything.', 'Reset', async () => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    });
  }

  Object.assign(window.PlatePlanSettings, {
    loadPrefs,
    savePrefs,
    createRecoveryPoint,
    resetAllData
  });

  window.loadPrefs = loadPrefs;
  window.savePrefs = savePrefs;
  window.createRecoveryPoint = createRecoveryPoint;
  window.resetAllData = resetAllData;
})();
