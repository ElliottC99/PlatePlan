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

  function syncAppearanceControlState() {
    const activeTheme = window.PlatePlanCloud?.State?.settings?.appearance ||
                        window.state?.prefs?.appearance ||
                        localStorage.getItem('plateplan_appearance') ||
                        'system';

    const buttons = document.querySelectorAll('.appearance-control button, [data-appearance], [data-pp-click*="setPlatePlanAppearance"]');
    buttons.forEach(btn => {
      const targetVal = btn.getAttribute('data-appearance') || 
                        btn.getAttribute('data-pp-click') || '';
      
      const isMatch = targetVal.includes(`'${activeTheme}'`) || 
                      targetVal === activeTheme || 
                      (activeTheme === 'system' && targetVal.includes('system'));

      if (isMatch) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-selected', 'false');
      }
    });
  }

  function loadPrefs() {
    const p = window.state?.prefs || window.PlatePlanCloud?.State?.settings || {};
    const ecal = document.getElementById('pref-ecal');
    if (ecal) ecal.value = p.ecal || 2400;
    
    syncAppearanceControlState();

    if (typeof window.syncPlatePlanVersionDisplay === 'function') {
      window.syncPlatePlanVersionDisplay();
    }
  }

  function renderPreferences() {
    loadPrefs();
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
    renderPreferences,
    syncAppearanceControlState,
    savePrefs,
    createRecoveryPoint,
    resetAllData
  });

  window.loadPrefs = loadPrefs;
  window.renderPreferences = renderPreferences;
  window.syncAppearanceControlState = syncAppearanceControlState;
  window.savePrefs = savePrefs;
  window.createRecoveryPoint = createRecoveryPoint;
  window.resetAllData = resetAllData;
})();
