/**
 * src/components/profile/ProfilePreferencesForm.js (v3.8.3)
 * UI component for household dietary preference toggles,
 * ingredient restrictions, and profile mapping strategies.
 */

import { HOUSEHOLD_ID } from '../../config/firebase.js';

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
 * Renders household header and active session badge card.
 */
export function renderHouseholdProfileHeader(householdId = HOUSEHOLD_ID, memberNames = ['Elliott', 'Chloe']) {
  return `
    <div class="pp-settings-card" id="pp-household-profile-card">
      <div class="pp-settings-title" style="font-size:16px;font-weight:700;color:var(--label);margin:0 0 12px 0;display:flex;align-items:center;gap:8px">
        🏠 Household & Account Profile
      </div>
      <div class="pp-settings-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        <div style="background:var(--tertiary-system-grouped-bg);border:1px solid var(--separator);padding:14px;border-radius:10px">
          <div style="font-size:11px;font-weight:700;color:var(--secondary-label);text-transform:uppercase">Household Scope</div>
          <div style="font-size:15px;font-weight:700;color:var(--label);margin-top:2px">${escapeHtml(householdId)}</div>
          <div style="margin-top:6px"><span class="pp-badge-status" style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;background:var(--badge-green-bg);color:var(--badge-green-text);display:inline-block">Active Session</span></div>
        </div>

        <div style="background:var(--tertiary-system-grouped-bg);border:1px solid var(--separator);padding:14px;border-radius:10px">
          <div style="font-size:11px;font-weight:700;color:var(--secondary-label);text-transform:uppercase">Household Members</div>
          <div style="font-size:14px;font-weight:600;color:var(--label);margin-top:2px">${escapeHtml(memberNames.join(' & '))}</div>
          <div style="font-size:12px;color:var(--secondary-label);margin-top:4px">Synchronized across all devices</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders dietary preferences, allergen exclusions, and product mapping strategy controls.
 */
export function renderDietaryPreferencesSection(userPrefs = {}, settings = {}) {
  const diet = userPrefs.diet || 'none';
  const mappingStrategy = settings.mappingStrategy || 'protein_per_kcal';

  return `
    <div class="pp-settings-card" id="pp-dietary-preferences-card">
      <div class="pp-settings-title" style="font-size:16px;font-weight:700;color:var(--label);margin:0 0 12px 0;display:flex;align-items:center;gap:8px">
        🥗 Dietary Preferences & Restrictions
      </div>
      <div class="pp-settings-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
        <div class="pp-input-group" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          <label for="pp-setting-diet" style="font-size:12px;font-weight:600;color:var(--secondary-label)">Dietary Pattern</label>
          <select id="pp-setting-diet" name="ppSettingDiet" aria-label="Dietary Pattern" style="padding:8px 12px;border:1px solid var(--separator);border-radius:8px;font-size:13px;outline:none;background:var(--secondary-system-grouped-bg);color:var(--label)">
            <option value="none" ${diet === 'none' ? 'selected' : ''}>No Restrictions</option>
            <option value="vegetarian" ${diet === 'vegetarian' ? 'selected' : ''}>Vegetarian</option>
            <option value="vegan" ${diet === 'vegan' ? 'selected' : ''}>Vegan</option>
            <option value="pescatarian" ${diet === 'pescatarian' ? 'selected' : ''}>Pescatarian</option>
          </select>
        </div>

        <div class="pp-input-group" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
          <label for="pp-setting-strategy" style="font-size:12px;font-weight:600;color:var(--secondary-label)">Default Product Auto-Mapping Strategy</label>
          <select id="pp-setting-strategy" name="ppSettingStrategy" aria-label="Default Product Auto-Mapping Strategy" style="padding:8px 12px;border:1px solid var(--separator);border-radius:8px;font-size:13px;outline:none;background:var(--secondary-system-grouped-bg);color:var(--label)">
            <option value="protein_per_kcal" ${mappingStrategy === 'protein_per_kcal' ? 'selected' : ''}>Protein per kcal (Recommended)</option>
            <option value="protein_per_pound" ${mappingStrategy === 'protein_per_pound' ? 'selected' : ''}>Protein per £</option>
            <option value="lowest_cost_per_g" ${mappingStrategy === 'lowest_cost_per_g' ? 'selected' : ''}>Lowest £ per Gram</option>
            <option value="lowest_cost_per_unit" ${mappingStrategy === 'lowest_cost_per_unit' ? 'selected' : ''}>Lowest £ per Unit</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:16px">
        <label for="pp-setting-gf" style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;cursor:pointer;color:var(--label)">
          <input type="checkbox" id="pp-setting-gf" name="ppSettingGf" aria-label="Gluten-Free Only" ${userPrefs.glutenFree ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--tint-color)"> Gluten-Free Only
        </label>
        <label for="pp-setting-df" style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;cursor:pointer;color:var(--label)">
          <input type="checkbox" id="pp-setting-df" name="ppSettingDf" aria-label="Dairy-Free Only" ${userPrefs.dairyFree ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--tint-color)"> Dairy-Free Only
        </label>
        <label for="pp-setting-nutfree" style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;cursor:pointer;color:var(--label)">
          <input type="checkbox" id="pp-setting-nutfree" name="ppSettingNutfree" aria-label="Nut-Free" ${userPrefs.nutFree ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--tint-color)"> Nut-Free
        </label>
      </div>
    </div>
  `;
}

/**
 * Extracts form values from preferences container.
 */
export function extractPreferencesFormData(container) {
  if (!container) return null;
  return {
    diet: container.querySelector('#pp-setting-diet')?.value || 'none',
    glutenFree: !!container.querySelector('#pp-setting-gf')?.checked,
    dairyFree: !!container.querySelector('#pp-setting-df')?.checked,
    nutFree: !!container.querySelector('#pp-setting-nutfree')?.checked,
    mappingStrategy: container.querySelector('#pp-setting-strategy')?.value || 'protein_per_kcal'
  };
}
