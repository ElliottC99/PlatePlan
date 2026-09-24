/**
 * PlatePlan Settings Backup Import Sub-module
 */
(function() {
  window.PlatePlanSettingsBackup = window.PlatePlanSettingsBackup || {};
  window.PlatePlanSettingsBackup.State = window.PlatePlanSettingsBackup.State || { pendingPlatePlanImport: null };
  const SettingsState = window.PlatePlanSettingsBackup.State;

  function ensurePlatePlanImportPreviewModal() {
    let wrap = document.getElementById('plateplan-import-preview-wrap');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'plateplan-import-preview-wrap';
    wrap.className = 'modal-wrap';
    wrap.style.zIndex = '470';
    wrap.innerHTML = `
      <div class="modal" style="max-width:760px">
        <div class="row-between" style="align-items:center;margin-bottom:10px">
          <h3 style="margin:0">Review PlatePlan import</h3>
          <button class="btn sm ghost" onclick="PlatePlanSettingsBackup.closePlatePlanImportPreview()">Close</button>
        </div>
        <div id="plateplan-import-preview-content"></div>
        <div class="btn-row" style="margin-top:14px;justify-content:flex-end;gap:8px">
          <button class="btn ghost" onclick="PlatePlanSettingsBackup.closePlatePlanImportPreview()">Cancel</button>
          <button class="btn primary" id="plateplan-import-confirm" onclick="PlatePlanSettingsBackup.confirmPlatePlanDataImport()">Import data</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    return wrap;
  }

  function openPlatePlanImportPreview(imported, metadata = {}) {
    const validate = window.PlatePlanSettingsBackup?.validatePlatePlanImport || window.validatePlatePlanImport || (() => ({ valid: false, errors: [] }));
    const renderDiff = window.PlatePlanSettingsBackup?.renderBakedStateDifferenceSummary || window.renderBakedStateDifferenceSummary || (() => '');
    const ppEscapeHtml = window.ppEscapeHtml || (s => s);
    
    const validation = validate(imported, metadata);
    SettingsState.pendingPlatePlanImport = { imported, metadata, validation };
    
    const wrap = ensurePlatePlanImportPreviewModal();
    const c = validation.counts || {};
    const versionLabel = metadata.version || 'legacy/raw state';
    const differences = validation.valid ? renderDiff(window.state || {}, imported) : '';
    
    const content = document.getElementById('plateplan-import-preview-content');
    if (content) {
      content.innerHTML = `
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Backup version: <strong>${ppEscapeHtml(versionLabel)}</strong> · Schema ${validation.schemaVersion}</div>
        <div class="plan-summary grid gap-2" style="margin-bottom:10px;grid-template-columns:repeat(auto-fit,minmax(100px,1fr))">
          <div class="summary-box bg-zinc-50 p-2 rounded border"><strong>Recipes</strong><div>${c.recipes || 0}</div></div>
          <div class="summary-box bg-zinc-50 p-2 rounded border"><strong>Products</strong><div>${c.products || 0}</div></div>
          <div class="summary-box bg-zinc-50 p-2 rounded border"><strong>Ingredients</strong><div>${c.ingredients || 0}</div></div>
        </div>
        ${validation.errors?.length ? `<div class="msg error p-3 bg-red-50 text-red-600 rounded mb-2"><strong>Import blocked</strong><br>${validation.errors.map(ppEscapeHtml).join('<br>')}</div>` : ''}
        ${validation.warnings?.length ? `<div class="msg info p-3 bg-blue-50 text-blue-600 rounded mb-2">${validation.warnings.map(ppEscapeHtml).join('<br>')}</div>` : ''}
        ${validation.valid ? `<div class="font-bold text-sm mb-2">Differences from browser data</div><div class="max-h-60 overflow-auto bg-zinc-50 border rounded p-3 text-xs">${differences}</div>` : ''}`;
    }
    
    const confirmBtn = document.getElementById('plateplan-import-confirm');
    if (confirmBtn) confirmBtn.disabled = !validation.valid;
    wrap.classList.add('open');
  }

  function closePlatePlanImportPreview() {
    document.getElementById('plateplan-import-preview-wrap')?.classList.remove('open');
    SettingsState.pendingPlatePlanImport = null;
  }

  function confirmPlatePlanDataImport() {
    if (!SettingsState.pendingPlatePlanImport?.validation?.valid) return;
    const imported = SettingsState.pendingPlatePlanImport.imported;
    
    const runRecovery = window.createRecoveryPoint || (() => {});
    runRecovery('Before importing backup');
    
    window.state = JSON.parse(JSON.stringify(imported));
    
    if (typeof window.saveState === 'function') window.saveState(true);
    if (typeof window.loadPrefs === 'function') window.loadPrefs();
    if (typeof window.renderAll === 'function') window.renderAll();
    
    closePlatePlanImportPreview();
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Data imported successfully');
  }

  function importPlatePlanDataBackup(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed.state || parsed;
        openPlatePlanImportPreview(imported, { 
          version: parsed.version || '', 
          schemaVersion: parsed.schemaVersion || imported?.meta?.schemaVersion || 1, 
          exportedAt: parsed.exportedAt || '' 
        });
      } catch (e) {
        if (typeof showMsg === 'function') showMsg('prefs-data-msg', 'Invalid backup file format.', 'error');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  Object.assign(window.PlatePlanSettingsBackup, {
    openPlatePlanImportPreview,
    closePlatePlanImportPreview,
    confirmPlatePlanDataImport,
    importPlatePlanDataBackup
  });

  window.importPlatePlanDataBackup = importPlatePlanDataBackup;
  window.confirmPlatePlanDataImport = confirmPlatePlanDataImport;
  window.openPlatePlanImportPreview = openPlatePlanImportPreview;
  window.closePlatePlanImportPreview = closePlatePlanImportPreview;
})();
