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
export function renderSystemDisplayCard(theme = 'system', version = 'v3.30.0 (ES6 Modern)') {
  return `
    <div class="pp-settings-card" id="pp-system-display-card">
      <div class="pp-settings-title" style="font-size:16px;font-weight:700;color:var(--label);margin:0 0 12px 0;display:flex;align-items:center;gap:8px">
        ⚙️ System & Display
      </div>
      <div class="pp-settings-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        <div class="pp-input-group" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          <label for="pp-setting-theme" style="font-size:12px;font-weight:600;color:var(--secondary-label);cursor:pointer">Appearance Theme</label>
          <select id="pp-setting-theme" name="theme" aria-label="Appearance Theme" style="padding:8px 12px;border:1px solid var(--separator);border-radius:8px;font-size:13px;outline:none;background:var(--secondary-system-grouped-bg);color:var(--label)">
            <option value="system" ${theme === 'system' ? 'selected' : ''}>System Default</option>
            <option value="light" ${theme === 'light' ? 'selected' : ''}>Light Theme</option>
            <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
          </select>
        </div>

        <div class="pp-input-group" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          <label for="pp-setting-version" style="font-size:12px;font-weight:600;color:var(--secondary-label);cursor:pointer">Active Architecture Version</label>
          <input type="text" id="pp-setting-version" name="activeArchitectureVersion" value="${escapeHtml(version)}" readonly style="padding:8px 12px;border:1px solid var(--separator);border-radius:8px;font-size:13px;background:var(--tertiary-system-grouped-bg);color:var(--secondary-label);font-weight:600">
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
        <button id="pp-save-settings-btn" style="background:var(--tint-color);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">
          Save Preferences
        </button>
        <button id="pp-refresh-data-btn" style="background:var(--tertiary-system-grouped-bg);color:var(--label);border:1px solid var(--separator);padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">
          Refresh Household Data
        </button>
        <button type="button" id="pp-recipe-audit-btn" style="background:var(--system-indigo);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">
          📖 Recipe Mapping Audit
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
      .pp-settings-card { background: var(--secondary-system-grouped-bg); border: 1px solid var(--separator); border-radius: 12px; padding: 20px; margin-bottom: 18px; box-shadow: var(--shadow-sm); }
      .pp-settings-title { font-size: 16px; font-weight: 700; color: var(--label); margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px; }
      .pp-settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
      .pp-input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
      .pp-input-group label { font-size: 12px; font-weight: 600; color: var(--secondary-label); }
      .pp-input-group input, .pp-input-group select { padding: 8px 12px; border: 1px solid var(--separator); border-radius: 8px; font-size: 13px; outline: none; background: var(--secondary-system-grouped-bg); color: var(--label); }
      .pp-input-group input:focus, .pp-input-group select:focus { border-color: var(--tint-color); box-shadow: var(--focus-ring); }
      .pp-badge-status { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; background: var(--badge-green-bg); color: var(--badge-green-text); display: inline-block; }
    </style>

    <div style="margin-bottom:20px">
      <h2 style="font-size:22px;font-weight:800;color:var(--label);margin:0 0 4px 0">Preferences & Settings</h2>
      <p style="font-size:13px;color:var(--secondary-label);margin:0">Configure household targets, dietary restrictions, product mapping, and system parameters.</p>
    </div>

    ${headerHtml}
    ${preferencesHtml}
    ${macroHtml}
    ${systemHtml}
  `;
}
