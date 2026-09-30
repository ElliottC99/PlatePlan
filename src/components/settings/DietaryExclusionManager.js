/**
 * src/components/settings/DietaryExclusionManager.js (v3.9.2)
 * Modular ES6 component for dietary patterns and interactive exclusion manager.
 * - Supports vegetarian / vegan / none patterns
 * - Allergen restriction checkboxes
 * - Custom blacklist search tags and interactive exclusion chips
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
 * Renders the Dietary Exclusion and Allergen settings cards.
 * @param {Object} prefs Preferences object
 * @param {Object} settings Settings object
 * @returns {string} HTML template literal
 */
export function renderDietaryExclusionManager(prefs = {}, settings = {}) {
  const diet = prefs.diet || 'none';
  const customExclusions = Array.isArray(prefs.exclusions?.shared) ? prefs.exclusions.shared : [];

  return `
    <div class="card dietary-exclusion-manager" style="margin-bottom:16px;padding:16px 18px;border:1px solid var(--border);border-radius:12px;background:var(--surface)">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        🥗 Dietary Patterns & Exclusions
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:14px">
        <div style="display:flex;flex-direction:column;gap:5px">
          <label for="pp-setting-diet" style="font-size:12px;font-weight:600;color:var(--text2);cursor:pointer">Dietary Patterns</label>
          <select id="pp-setting-diet" name="diet" aria-label="Dietary Patterns" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);outline:none">
            <option value="none" ${diet === 'none' ? 'selected' : ''}>No Restrictions</option>
            <option value="vegetarian" ${diet === 'vegetarian' ? 'selected' : ''}>Vegetarian Only</option>
            <option value="vegan" ${diet === 'vegan' ? 'selected' : ''}>Vegan Only</option>
            <option value="pescatarian" ${diet === 'pescatarian' ? 'selected' : ''}>Pescatarian</option>
          </select>
        </div>

        <div style="display:flex;flex-direction:column;gap:5px">
          <label style="font-size:12px;font-weight:600;color:var(--text2)">Allergen Safety Switches</label>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:2px">
            <label for="pp-setting-gf" style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" id="pp-setting-gf" name="glutenFree" ${prefs.glutenFree ? 'checked' : ''} style="width:15px;height:16px;accent-color:var(--purple)"> Gluten-Free Only
            </label>
            <label for="pp-setting-df" style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" id="pp-setting-df" name="dairyFree" ${prefs.dairyFree ? 'checked' : ''} style="width:15px;height:16px;accent-color:var(--purple)"> Dairy-Free Only
            </label>
            <label for="pp-setting-nutfree" style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" id="pp-setting-nutfree" name="nutFree" ${prefs.nutFree ? 'checked' : ''} style="width:15px;height:16px;accent-color:var(--purple)"> Nut-Free Safety
            </label>
          </div>
        </div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:12px">
        <label for="pref-exclude-search-input" style="font-size:12px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px">Active Custom Exclusions (Blacklist)</label>
        
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <input type="text" id="pref-exclude-search-input" name="prefExcludeSearch" aria-label="Exclude search" placeholder="Type ingredient name (e.g., Mushrooms, Cilantro)..." style="flex:1;padding:8px 10px;font-size:13px;border:1px solid var(--border);border-radius:8px;background:var(--surface)">
          <button class="btn primary sm" type="button" data-action="add-exclusion" onclick="handleAddExclusionFromInput()" style="font-size:12px;font-weight:700">Add</button>
        </div>

        <div id="exclusion-chips-wrap" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
          ${customExclusions.length ? customExclusions.map((ex, idx) => `
            <div style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);padding:4px 10px;border-radius:16px;font-size:12px;color:var(--text)">
              <span>${escapeHtml(ex.name || ex)}</span>
              <button type="button" data-action="remove-exclusion" data-index="${idx}" onclick="handleRemoveExclusion(${idx})" style="border:none;background:none;color:var(--text3);cursor:pointer;font-weight:700;padding:0;font-size:11px">✕</button>
            </div>
          `).join('') : '<span style="font-size:12px;color:var(--text3)">No custom blacklist items active.</span>'}
        </div>
      </div>
    </div>
  `;
}
