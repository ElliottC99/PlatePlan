/**
 * scripts/services/cloud-ui.js
 * Sync status toasts, online/offline indicators, and manual sync triggers.
 */
  window.updateSyncStatusUi = function(status) {
    const pill = document.getElementById('sync-status');
    const userLabel = document.getElementById('sync-user');
    const state = window.PlatePlanCloud.State;

    if (pill) {
      pill.dataset.status = status;
      let text = 'Local only';
      switch (status) {
        case 'synced': text = 'Cloud synced'; break;
        case 'pending': text = 'Syncing...'; break;
        case 'offline': text = 'Offline'; break;
        case 'error': text = 'Sync error'; break;
      }
      pill.textContent = text;
    }

    if (userLabel && state.user) {
      userLabel.textContent = state.user.email || 'Logged in';
    } else if (userLabel) {
      userLabel.textContent = '';
    }
  };

  window.openPlatePlanSyncPanel = function() {
    const state = window.PlatePlanCloud.State;
    if (!state.user) {
      // Show login modal or similar
      if (typeof window.openAppInfoModal === 'function') {
        window.openAppInfoModal('Cloud Sync', 'Please log in to sync your data to the cloud.');
      }
      return;
    }

    const lastSync = state.lastSyncedAt ? new Date(state.lastSyncedAt).toLocaleTimeString() : 'Never';
    const msg = `Status: ${state.syncStatus}\nLast Synced: ${lastSync}${state.lastSyncError ? `\nError: ${state.lastSyncError}` : ''}`;
    
    if (typeof window.openAppInfoModal === 'function') {
        window.openAppInfoModal('Cloud Sync Status', msg);
    } else {
        alert(msg);
    }
  };
