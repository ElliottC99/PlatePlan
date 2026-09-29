/**
 * src/components/settings/HouseholdSyncCard.js (v3.9.2)
 * Modular ES6 component for household account sync.
 * - Handles active member badges and sync telemetry status
 * - Multi-device invitations and secure link copy triggers
 * - Offline localStorage & index cache capacity gauge meter
 */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders the Household Connection & Cloud Sync telemetry card.
 * @param {Object} settings Global settings state
 * @returns {string} HTML template literal
 */
export function renderHouseholdSyncCard(settings = {}) {
  const currentHousehold = window.activeHouseholdId || 'elliott-chloe';
  const lastSynced = window.state?.lastSyncedTime || 'Just now';
  const connectionState = navigator.onLine ? 'Cloud Sync Connected' : 'Offline Cache Mode';

  // Calculate local capacity utilization
  const totalSlotsUsed = Object.keys(localStorage).length || 10;
  const localStoragePct = Math.min(Math.round((totalSlotsUsed / 150) * 100), 100);

  return `
    <div class="card household-sync-card" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        🏠 Household Connection & Offline Storage
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        <!-- Telemetry Details -->
        <div style="background:var(--surface2);border:1px solid var(--border);padding:12px 14px;border-radius:10px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Active Session telemetry</div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${escapeHtml(currentHousehold)}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:4px;display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${navigator.onLine ? 'var(--green)' : 'var(--amber)'}"></span>
            <span>${escapeHtml(connectionState)}</span>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:6px">Last synced: ${escapeHtml(lastSynced)}</div>
        </div>

        <!-- Invitation Link & Offline Gauges -->
        <div style="background:var(--surface2);border:1px solid var(--border);padding:12px 14px;border-radius:10px;display:flex;flex-direction:column;justify-content:space-between;gap:8px">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px">Device Storage Utilisation</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:2px">
              <div style="flex:1;height:6px;background:var(--surface);border-radius:3px;overflow:hidden;border:1px solid var(--border)">
                <div style="width:${localStoragePct}%;height:100%;background:var(--purple);border-radius:3px"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:var(--text2)">${localStoragePct}%</span>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">Indexed offline caches: plateplan-shell-v3.13.0</div>
          </div>

          <div style="display:flex;gap:6px;margin-top:4px">
            <button class="btn sm ghost" type="button" data-action="generate-invite-link" onclick="generateHouseholdInviteLink()" style="font-size:11px;flex:1">🔗 Generate Invite Link</button>
            <button class="btn sm ghost" type="button" id="pp-refresh-data-btn" data-action="refresh-data" style="font-size:11px;flex:1">🔄 Refresh Data</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
