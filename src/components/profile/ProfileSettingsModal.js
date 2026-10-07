/**
 * src/components/profile/ProfileSettingsModal.js (v3.8.3)
 * UI component for the settings view container, theme controls,
 * account sync status, offline cache indicators, and save triggers.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Renders system and display parameters card.
 */
export function renderSystemDisplayCard(theme = 'system', version = 'v3.27.2 (ES6 Modern)') {
  return `
    <div class="pp-settings-card" id="pp-system-display-card">
      <div class="pp-settings-title" style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px 0;display:flex;align-items:center;gap:8px">
        ⚙️ System & Display
      </div>
      <div class="pp-settings-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        <div class="pp-input-group" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          <label for="pp-setting-theme" style="font-size:12px;font-weight:600;color:#475569;cursor:pointer">Appearance Theme</label>
          <select id="pp-setting-theme" name="theme" aria-label="Appearance Theme" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;outline:none;background:#fff">
            <option value="system" ${theme === 'system' ? 'selected' : ''}>System Default</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light Theme</option>
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
          </select>
        </div>

        <div class="pp-input-group" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          <label for="pp-setting-version" style="font-size:12px;font-weight:600;color:#475569;cursor:pointer">Active Architecture Version</label>
          <input type="text" id="pp-setting-version" name="activeArchitectureVersion" value="${escapeHtml(version)}" readonly style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;background:#f8fafc;color:#475569;font-weight:600">
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="pp-save-settings-btn" style="background:#2563eb;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">
          Save Preferences
        </button>
        <button id="pp-refresh-data-btn" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">
          Refresh Household Data
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders complete settings page layout wrapper.
 */
export function renderSettingsContainer(headerHtml, preferencesHtml, macroHtml, systemHtml) {
  return `
    <style>
      .pp-settings-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
      .pp-settings-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
      .pp-settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .pp-input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .pp-input-group label { font-size: 12px; font-weight: 600; color: #475569; }
      .pp-input-group input, .pp-input-group select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; outline: none; background: #fff; }
      .pp-input-group input:focus, .pp-input-group select:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
      .pp-badge-status { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; background: #dcfce7; color: #15803d; display: inline-block; }
    </style>

    <div style="margin-bottom:20px">
      <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 4px 0">Preferences & Settings</h2>
      <p style="font-size:13px;color:#64748b;margin:0">Configure household targets, dietary restrictions, product mapping, and system parameters.</p>
    </div>

    ${headerHtml}
    ${preferencesHtml}
    ${macroHtml}
    ${systemHtml}
  `;
}
