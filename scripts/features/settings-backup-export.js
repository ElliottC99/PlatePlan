/**
 * PlatePlan Settings Backup Export Sub-module
 */
(function() {
  window.PlatePlanSettingsBackup = window.PlatePlanSettingsBackup || {};

  /**
   * Download the current application state as a JSON backup file.
   */
  function downloadPlatePlanDataBackup() {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const getPayload = window.PlatePlanSettingsBackup?.getPlatePlanBackupPayload || window.getPlatePlanBackupPayload || (() => ({}));
      
      const payload = getPayload();
      const content = JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `PlatePlan backup ${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('PlatePlan backup exported successfully.');
      } else if (typeof showMsg === 'function') {
        showMsg('prefs-data-msg', 'PlatePlan data exported.', 'success');
      }
    } catch (e) {
      console.error('[Backup Export] Failed:', e);
      if (typeof showMsg === 'function') {
        showMsg('prefs-data-msg', 'Could not export PlatePlan data.', 'error');
      }
    }
  }

  window.PlatePlanSettingsBackup.downloadPlatePlanDataBackup = downloadPlatePlanDataBackup;
  window.exportDataJSON = downloadPlatePlanDataBackup;
  window.downloadPlatePlanDataBackup = downloadPlatePlanDataBackup;
})();
