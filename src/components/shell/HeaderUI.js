/**
 * src/components/shell/HeaderUI.js (v3.29.1)
 * Modular Presentation Component for Application Header & Sync Controls
 */

export function renderHeaderUI({ version = 'v3.29.1', syncStatus = 'Local only', userEmail = '' } = {}) {
  return `
    <header class="app-header">
      <div class="logo" style="display:flex;align-items:center;gap:6px">
        Plate<span>Plan</span>
        <span id="app-header-version" class="version-badge" style="font-size:10px;font-weight:600;letter-spacing:0.04em;background:var(--surface2, #E8E6DF);color:var(--text2, #555);padding:2px 6px;border-radius:999px;line-height:1;margin-left:4px;border:1px solid var(--border,#ddd)">${version}</span>
      </div>
      <div class="app-header-actions">
        <button class="btn primary app-create-button" type="button" onclick="openCreateActionSheet()" aria-label="Add to PlatePlan">
          <svg aria-hidden="true" viewbox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
          <span class="app-create-label">Add</span>
        </button>
        <button class="btn ghost app-menu-button" type="button" onclick="openMobileMore()" aria-label="Open PlatePlan menu">
          <svg aria-hidden="true" viewbox="0 0 24 24"><circle cx="5" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="19" cy="12" r="1.3"></circle></svg>
          <span>Menu</span>
        </button>
        <button id="sync-status" class="sync-pill" data-status="local" onclick="openPlatePlanSyncPanel()" title="PlatePlan sync status">${syncStatus}</button>
        <button id="syncNowTopBtn" class="btn ghost sync-now-btn" type="button" data-action="sync-now" title="Sync now with cloud" style="padding:4px 8px;font-size:12px">Sync Now</button>
        <button id="logoutBtn" class="btn ghost" type="button" data-action="logout" title="Log out of PlatePlan" style="padding:4px 8px;font-size:12px">Log Out</button>
        <span id="sync-user" class="sync-user-label" style="font-size:11px;color:var(--text3)">${userEmail}</span>
      </div>
    </header>
  `;
}
