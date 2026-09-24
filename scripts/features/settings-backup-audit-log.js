/**
 * PlatePlan Settings Backup Audit Log (UI & Badge Logic)
 */
(function() {
  window.PlatePlanSettingsBackup = window.PlatePlanSettingsBackup || {};
  window.PlatePlanSettingsBackup.State = window.PlatePlanSettingsBackup.State || { isAuditing: false };
  const PlatePlanSettingsBackup = window.PlatePlanSettingsBackup;
  const SettingsState = PlatePlanSettingsBackup.State;

  function renderDataQuality() {
    const missingTarget = document.getElementById('dq-missing-list');
    if (!missingTarget) return;

    if (!window.state?.isCloudHydrated && !window.isPlatePlanHydrated) {
      missingTarget.innerHTML = `<div class="ios-activity-skeleton p-4 text-center">Syncing data...</div>`;
      return;
    }

    if (SettingsState.isAuditing) return;
    SettingsState.isAuditing = true;
    
    missingTarget.innerHTML = `<div class="p-4 text-center text-zinc-500 italic">Running data audit...</div>`;
    
    setTimeout(() => {
      try {
        const issues = (PlatePlanSettingsBackup.collectDeterministicDataQualityIssues || (() => []))();
        const renderIssue = PlatePlanSettingsBackup.renderDataQualityIssue || ((i) => `<div>${i.title}</div>`);
        
        if (issues.length) {
          missingTarget.innerHTML = issues.map(renderIssue).join('');
        } else {
          missingTarget.innerHTML = `<div class="msg success p-4 bg-green-50 text-green-700 rounded text-center font-medium">Your data is healthy! No issues detected.</div>`;
        }
        
        const badgeCount = issues.length;
        PlatePlanSettingsBackup.updateDataQualityBadge(badgeCount);
      } finally {
        SettingsState.isAuditing = false;
      }
    }, 100);
  }

  function updateDataQualityBadge(count = 0) {
    document.querySelectorAll('[data-view="data"], #mobile-nav [data-view="data"]').forEach(el => {
      let badge = el.querySelector('.dq-nav-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'dq-nav-badge absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white';
          el.appendChild(badge);
        }
        badge.textContent = count > 9 ? '9+' : count;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function runDataQualityAudits() {
    renderDataQuality();
  }

  Object.assign(window.PlatePlanSettingsBackup, {
    renderDataQuality,
    updateDataQualityBadge,
    runDataQualityAudits
  });

  window.renderDataQuality = renderDataQuality;
  window.runDataQualityAudits = runDataQualityAudits;
  window.updateDataQualityBadge = updateDataQualityBadge;
})();
