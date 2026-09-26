/**
 * src/views/SettingsView.js (v3.6.0)
 * Componentized Settings & Preferences View Function.
 * Quarantined from direct Firebase SDK, using dedicated HouseholdRepository.
 */

import { savePreferences } from '../services/HouseholdRepository.js';
import { hydrateHouseholdData } from '../services/HydrationService.js';

export function renderSettingsView() {
  const container = document.getElementById('view-prefs') || document.getElementById('view-settings');
  if (!container) return;

  const prefs = window.state?.userPrefs || {};
  const settings = window.state?.settings || {};
  const targets = prefs.nutritionTargets || {};
  const eTargets = targets.elliott || {};
  const eMeals = eTargets.meals || {};
  const cTargets = targets.chloe || {};
  const cMeals = cTargets.meals || {};

  const elliottDailyCal = prefs.elliottCal || eTargets.dailyKcal || 2200;
  const elliottDailyProt = prefs.elliottProt || eTargets.dailyProtein || 140;
  const elliottBfCal = eMeals.breakfast?.kcal ?? 550;
  const elliottBfProt = eMeals.breakfast?.protein ?? 35;
  const elliottLuCal = eMeals.lunch?.kcal ?? 650;
  const elliottLuProt = eMeals.lunch?.protein ?? 40;
  const elliottDiCal = eMeals.dinner?.kcal ?? 750;
  const elliottDiProt = eMeals.dinner?.protein ?? 45;
  const elliottSnCal = eMeals.snacking?.kcal ?? 250;
  const elliottSnProt = eMeals.snacking?.protein ?? 20;

  const chloeDailyCal = prefs.chloeCal || cTargets.dailyKcal || 1800;
  const chloeDailyProt = prefs.chloeProt || cTargets.dailyProtein || 110;
  const chloeBfCal = cMeals.breakfast?.kcal ?? 450;
  const chloeBfProt = cMeals.breakfast?.protein ?? 25;
  const chloeLuCal = cMeals.lunch?.kcal ?? 500;
  const chloeLuProt = cMeals.lunch?.protein ?? 30;
  const chloeDiCal = cMeals.dinner?.kcal ?? 650;
  const chloeDiProt = cMeals.dinner?.protein ?? 40;
  const chloeSnCal = cMeals.snacking?.kcal ?? 200;
  const chloeSnProt = cMeals.snacking?.protein ?? 15;

  container.innerHTML = `
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

    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">Preferences & Settings</h2>
      <p style="font-size: 13px; color: #64748b; margin: 0;">Configure household targets, dietary restrictions, product mapping, and system parameters.</p>
    </div>

    <!-- 1. Household & Profile Info -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">🏠 Household & Account Profile</div>
      <div class="pp-settings-grid">
        <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 14px; border-radius: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Household Scope</div>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 2px;">elliott-chloe</div>
          <div style="margin-top: 6px;"><span class="pp-badge-status">Active Session</span></div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 14px; border-radius: 10px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Household Members</div>
          <div style="font-size: 14px; font-weight: 600; color: #1e293b; margin-top: 2px;">Elliott & Chloe</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Synchronized across all devices</div>
        </div>
      </div>
    </div>

    <!-- 2. Dietary Preferences & Restrictions -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">🥗 Dietary Preferences & Restrictions</div>
      <div class="pp-settings-grid">
        <div class="pp-input-group">
          <label for="pp-setting-diet">Dietary Pattern</label>
          <select id="pp-setting-diet">
            <option value="none" ${prefs.diet === 'none' ? 'selected' : ''}>No Restrictions</option>
            <option value="vegetarian" ${prefs.diet === 'vegetarian' ? 'selected' : ''}>Vegetarian</option>
            <option value="vegan" ${prefs.diet === 'vegan' ? 'selected' : ''}>Vegan</option>
            <option value="pescatarian" ${prefs.diet === 'pescatarian' ? 'selected' : ''}>Pescatarian</option>
          </select>
        </div>

        <div class="pp-input-group">
          <label for="pp-setting-strategy">Default Product Auto-Mapping Strategy</label>
          <select id="pp-setting-strategy">
            <option value="protein_per_kcal" ${settings.mappingStrategy === 'protein_per_kcal' ? 'selected' : ''}>Protein per kcal (Recommended)</option>
            <option value="protein_per_pound" ${settings.mappingStrategy === 'protein_per_pound' ? 'selected' : ''}>Protein per £</option>
            <option value="lowest_cost_per_g" ${settings.mappingStrategy === 'lowest_cost_per_g' ? 'selected' : ''}>Lowest £ per Gram</option>
            <option value="lowest_cost_per_unit" ${settings.mappingStrategy === 'lowest_cost_per_unit' ? 'selected' : ''}>Lowest £ per Unit</option>
          </select>
        </div>
      </div>

      <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 16px;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" id="pp-setting-gf" ${prefs.glutenFree ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2563eb;"> Gluten-Free Only
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" id="pp-setting-df" ${prefs.dairyFree ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2563eb;"> Dairy-Free Only
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
          <input type="checkbox" id="pp-setting-nutfree" ${prefs.nutFree ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #2563eb;"> Nut-Free
        </label>
      </div>
    </div>

    <!-- 3. Macro Targets & Allocation -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">⚡ Daily Nutritional Targets & 4-Meal Breakdown</div>
      <p style="font-size: 12px; color: #64748b; margin: -4px 0 16px 0;">Individual calorie and protein targets across Breakfast, Lunch, Dinner, and Snacking/Drinking for Elliott & Chloe.</p>

      <div class="pp-settings-grid">
        <!-- Elliott Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px;">
          <div style="font-weight: 700; font-size: 15px; color: #2563eb; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>Elliott's Targets</span>
            <span style="font-size: 11px; background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 10px; font-weight: 600;">Member 1</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Calories (kcal)</label>
              <input type="number" id="pp-macro-e-cal" value="${elliottDailyCal}">
            </div>
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Protein (g)</label>
              <input type="number" id="pp-macro-e-prot" value="${elliottDailyProt}">
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase;">4-Meal Slot Breakdown</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍳 Breakfast</span>
              <input type="number" id="pp-macro-e-bf-cal" value="${elliottBfCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-bf-prot" value="${elliottBfProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥗 Lunch</span>
              <input type="number" id="pp-macro-e-lu-cal" value="${elliottLuCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-lu-prot" value="${elliottLuProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍲 Dinner</span>
              <input type="number" id="pp-macro-e-di-cal" value="${elliottDiCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-di-prot" value="${elliottDiProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥤 Snacking</span>
              <input type="number" id="pp-macro-e-sn-cal" value="${elliottSnCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-e-sn-prot" value="${elliottSnProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
          </div>
        </div>

        <!-- Chloe Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px;">
          <div style="font-weight: 700; font-size: 15px; color: #ec4899; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>Chloe's Targets</span>
            <span style="font-size: 11px; background: #fce7f3; color: #be185d; padding: 2px 8px; border-radius: 10px; font-weight: 600;">Member 2</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Calories (kcal)</label>
              <input type="number" id="pp-macro-c-cal" value="${chloeDailyCal}">
            </div>
            <div class="pp-input-group" style="margin-bottom:0;">
              <label>Daily Protein (g)</label>
              <input type="number" id="pp-macro-c-prot" value="${chloeDailyProt}">
            </div>
          </div>

          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase;">4-Meal Slot Breakdown</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍳 Breakfast</span>
              <input type="number" id="pp-macro-c-bf-cal" value="${chloeBfCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-bf-prot" value="${chloeBfProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥗 Lunch</span>
              <input type="number" id="pp-macro-c-lu-cal" value="${chloeLuCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-lu-prot" value="${chloeLuProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🍲 Dinner</span>
              <input type="number" id="pp-macro-c-di-cal" value="${chloeDiCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-di-prot" value="${chloeDiProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>

            <div style="display: grid; grid-template-columns: 90px 1fr 1fr; gap: 8px; align-items: center; background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
              <span style="font-size: 12px; font-weight: 600; color: #334155;">🥤 Snacking</span>
              <input type="number" id="pp-macro-c-sn-cal" value="${chloeSnCal}" placeholder="kcal" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
              <input type="number" id="pp-macro-c-sn-prot" value="${chloeSnProt}" placeholder="protein (g)" style="padding:4px 8px; font-size:12px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. System & Display Settings -->
    <div class="pp-settings-card">
      <div class="pp-settings-title">⚙️ System & Display</div>
      <div class="pp-settings-grid">
        <div class="pp-input-group">
          <label>Appearance Theme</label>
          <select id="pp-setting-theme">
            <option value="system" ${settings.theme === 'system' ? 'selected' : ''}>System Default</option>
            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Theme</option>
            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Theme</option>
          </select>
        </div>

        <div class="pp-input-group">
          <label>Active Architecture Version</label>
          <input type="text" value="v3.4.2 (ES6 Modern)" readonly style="background: #f8fafc; color: #475569; font-weight: 600;">
        </div>
      </div>

      <div style="margin-top: 16px; display: flex; gap: 10px;">
        <button id="pp-save-settings-btn" style="background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
          Save Preferences
        </button>
        <button id="pp-refresh-data-btn" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
          Refresh Household Data
        </button>
      </div>
    </div>
  `;

  // Attach Save listener
  const saveBtn = container.querySelector('#pp-save-settings-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      window.state.userPrefs = window.state.userPrefs || {};
      window.state.userPrefs.diet = container.querySelector('#pp-setting-diet')?.value || 'none';
      window.state.userPrefs.glutenFree = container.querySelector('#pp-setting-gf')?.checked || false;
      window.state.userPrefs.dairyFree = container.querySelector('#pp-setting-df')?.checked || false;
      window.state.userPrefs.nutFree = container.querySelector('#pp-setting-nutfree')?.checked || false;

      const eDailyCal = Number(container.querySelector('#pp-macro-e-cal')?.value || 2200);
      const eDailyProt = Number(container.querySelector('#pp-macro-e-prot')?.value || 140);
      const cDailyCal = Number(container.querySelector('#pp-macro-c-cal')?.value || 1800);
      const cDailyProt = Number(container.querySelector('#pp-macro-c-prot')?.value || 110);

      window.state.userPrefs.elliottCal = eDailyCal;
      window.state.userPrefs.elliottProt = eDailyProt;
      window.state.userPrefs.chloeCal = cDailyCal;
      window.state.userPrefs.chloeProt = cDailyProt;

      window.state.userPrefs.nutritionTargets = {
        elliott: {
          dailyKcal: eDailyCal,
          dailyProtein: eDailyProt,
          meals: {
            breakfast: {
              kcal: Number(container.querySelector('#pp-macro-e-bf-cal')?.value || 550),
              protein: Number(container.querySelector('#pp-macro-e-bf-prot')?.value || 35)
            },
            lunch: {
              kcal: Number(container.querySelector('#pp-macro-e-lu-cal')?.value || 650),
              protein: Number(container.querySelector('#pp-macro-e-lu-prot')?.value || 40)
            },
            dinner: {
              kcal: Number(container.querySelector('#pp-macro-e-di-cal')?.value || 750),
              protein: Number(container.querySelector('#pp-macro-e-di-prot')?.value || 45)
            },
            snacking: {
              kcal: Number(container.querySelector('#pp-macro-e-sn-cal')?.value || 250),
              protein: Number(container.querySelector('#pp-macro-e-sn-prot')?.value || 20)
            }
          }
        },
        chloe: {
          dailyKcal: cDailyCal,
          dailyProtein: cDailyProt,
          meals: {
            breakfast: {
              kcal: Number(container.querySelector('#pp-macro-c-bf-cal')?.value || 450),
              protein: Number(container.querySelector('#pp-macro-c-bf-prot')?.value || 25)
            },
            lunch: {
              kcal: Number(container.querySelector('#pp-macro-c-lu-cal')?.value || 500),
              protein: Number(container.querySelector('#pp-macro-c-lu-prot')?.value || 30)
            },
            dinner: {
              kcal: Number(container.querySelector('#pp-macro-c-di-cal')?.value || 650),
              protein: Number(container.querySelector('#pp-macro-c-di-prot')?.value || 40)
            },
            snacking: {
              kcal: Number(container.querySelector('#pp-macro-c-sn-cal')?.value || 200),
              protein: Number(container.querySelector('#pp-macro-c-sn-prot')?.value || 15)
            }
          }
        }
      };

      window.state.settings = window.state.settings || {};
      window.state.settings.mappingStrategy = container.querySelector('#pp-setting-strategy')?.value || 'protein_per_kcal';
      window.state.settings.theme = container.querySelector('#pp-setting-theme')?.value || 'system';

      console.log('[Settings v3.6.0] Saved user preferences to state:', window.state.userPrefs);
      
      // Persist to Firestore
      await savePreferences(window.state.userPrefs, window.state.settings);

      // Dispatch CustomEvent
      document.dispatchEvent(new CustomEvent('plateplan:state:preferences', { detail: window.state.userPrefs }));

      saveBtn.disabled = false;
      saveBtn.textContent = '✓ Preferences Saved';
      saveBtn.style.background = '#16a34a';
      setTimeout(() => {
        saveBtn.textContent = 'Save Preferences';
        saveBtn.style.background = '#2563eb';
      }, 1800);
    };
  }

  // Attach Refresh Data listener
  const refreshBtn = container.querySelector('#pp-refresh-data-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      console.log('[Settings v3.6.0] Triggering household data refresh...');
      hydrateHouseholdData();
    };
  }
}
