/**
 * src/views/SettingsView.js (v3.9.2)
 * Componentized Settings & Preferences View Function.
 * Composes modular profile components and handles persistence through HouseholdRepository.
 */

import { savePreferences } from '../services/HouseholdRepository.js';
import { hydrateHouseholdData } from '../services/HydrationService.js';
import { renderProfileAllocationCard } from '../components/settings/ProfileAllocationCard.js';
import { renderDietaryExclusionManager } from '../components/settings/DietaryExclusionManager.js';
import { renderHouseholdSyncCard } from '../components/settings/HouseholdSyncCard.js';
import { renderSystemDisplayCard, renderSettingsContainer } from '../components/profile/ProfileSettingsModal.js';

// Setup global helpers for Settings interactive elements
if (typeof window !== 'undefined') {
  window.calcBudgets = function() {
    console.info('[Settings] Calculating macro splits dynamically...');
  };

  window.handleAddExclusionFromInput = function() {
    const input = document.getElementById('pref-exclude-search-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    
    window.state.userPrefs = window.state.userPrefs || {};
    window.state.userPrefs.exclusions = window.state.userPrefs.exclusions || {};
    window.state.userPrefs.exclusions.shared = window.state.userPrefs.exclusions.shared || [];
    
    const exists = window.state.userPrefs.exclusions.shared.some(x => {
      const name = typeof x === 'string' ? x : (x.name || '');
      return name.toLowerCase() === val.toLowerCase();
    });

    if (!exists) {
      window.state.userPrefs.exclusions.shared.push({ name: val });
      input.value = '';
      renderSettingsView();
    }
  };

  window.handleRemoveExclusion = function(idx) {
    if (!window.state?.userPrefs?.exclusions?.shared) return;
    window.state.userPrefs.exclusions.shared.splice(idx, 1);
    renderSettingsView();
  };

  window.generateHouseholdInviteLink = function() {
    const householdId = window.activeHouseholdId || 'elliott-chloe';
    const url = `${window.location.origin}${window.location.pathname}?household=${encodeURIComponent(householdId)}`;
    navigator.clipboard.writeText(url).then(() => {
      if (typeof window.showPlatePlanToast === 'function') {
        window.showPlatePlanToast('Household invite link copied to clipboard!');
      } else {
        alert('Household invite link copied to clipboard!');
      }
    }).catch(() => {
      alert(`Household Invite Link:\n${url}`);
    });
  };
}

export function renderSettingsView() {
  const container = document.getElementById('view-prefs') || document.getElementById('view-settings');
  if (!container) return;

  const prefs = window.state?.userPrefs || {};
  const settings = window.state?.settings || {};

  // Delegate directly to ES6 modular components
  const householdHtml = renderHouseholdSyncCard(settings);
  const dietaryHtml = renderDietaryExclusionManager(prefs, settings);
  const profileHtml = renderProfileAllocationCard(prefs);
  const systemHtml = renderSystemDisplayCard(settings.theme || 'system', 'v3.14.4 (ES6 Modern)');

  container.innerHTML = renderSettingsContainer(householdHtml, dietaryHtml, profileHtml, systemHtml);

  // Attach Save listener
  const saveBtn = container.querySelector('#pp-save-settings-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      window.state.userPrefs = window.state.userPrefs || {};
      window.state.userPrefs.diet = container.querySelector('#pp-setting-diet')?.value || 'none';
      window.state.userPrefs.glutenFree = !!container.querySelector('#pp-setting-gf')?.checked;
      window.state.userPrefs.dairyFree = !!container.querySelector('#pp-setting-df')?.checked;
      window.state.userPrefs.nutFree = !!container.querySelector('#pp-setting-nutfree')?.checked;

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
              kcal: Math.round(eDailyCal * (Number(container.querySelector('#pp-macro-e-bf-cal')?.value || 25) / 100)),
              protein: Math.round(eDailyProt * (Number(container.querySelector('#pp-macro-e-bf-cal')?.value || 25) / 100))
            },
            lunch: {
              kcal: Math.round(eDailyCal * (Number(container.querySelector('#pp-macro-e-lu-cal')?.value || 30) / 100)),
              protein: Math.round(eDailyProt * (Number(container.querySelector('#pp-macro-e-lu-cal')?.value || 30) / 100))
            },
            dinner: {
              kcal: Math.round(eDailyCal * (Number(container.querySelector('#pp-macro-e-di-cal')?.value || 35) / 100)),
              protein: Math.round(eDailyProt * (Number(container.querySelector('#pp-macro-e-di-cal')?.value || 35) / 100))
            },
            snacking: {
              kcal: Math.round(eDailyCal * (Number(container.querySelector('#pp-macro-e-sn-cal')?.value || 10) / 100)),
              protein: Math.round(eDailyProt * (Number(container.querySelector('#pp-macro-e-sn-cal')?.value || 10) / 100))
            }
          }
        },
        chloe: {
          dailyKcal: cDailyCal,
          dailyProtein: cDailyProt,
          meals: {
            breakfast: {
              kcal: Math.round(cDailyCal * (Number(container.querySelector('#pp-macro-c-bf-cal')?.value || 25) / 100)),
              protein: Math.round(cDailyProt * (Number(container.querySelector('#pp-macro-c-bf-cal')?.value || 25) / 100))
            },
            lunch: {
              kcal: Math.round(cDailyCal * (Number(container.querySelector('#pp-macro-c-lu-cal')?.value || 30) / 100)),
              protein: Math.round(cDailyProt * (Number(container.querySelector('#pp-macro-c-lu-cal')?.value || 30) / 100))
            },
            dinner: {
              kcal: Math.round(cDailyCal * (Number(container.querySelector('#pp-macro-c-di-cal')?.value || 35) / 100)),
              protein: Math.round(cDailyProt * (Number(container.querySelector('#pp-macro-c-di-cal')?.value || 35) / 100))
            },
            snacking: {
              kcal: Math.round(cDailyCal * (Number(container.querySelector('#pp-macro-c-sn-cal')?.value || 10) / 100)),
              protein: Math.round(cDailyProt * (Number(container.querySelector('#pp-macro-c-sn-cal')?.value || 10) / 100))
            }
          }
        }
      };

      window.state.settings = window.state.settings || {};
      const newTheme = container.querySelector('#pp-setting-theme')?.value || 'system';
      window.state.settings.theme = newTheme;
      applyTheme(newTheme);

      console.log('[Settings v3.14.3] Saved user preferences to state:', window.state.userPrefs);
      
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

  // Attach immediate theme change listener
  const themeSelect = container.querySelector('#pp-setting-theme');
  if (themeSelect) {
    themeSelect.onchange = (e) => {
      const selectedTheme = e.target.value || 'system';
      applyTheme(selectedTheme);
      window.state.settings = window.state.settings || {};
      window.state.settings.theme = selectedTheme;
    };
  }

  // Attach Refresh Data listener
  const refreshBtn = container.querySelector('#pp-refresh-data-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      console.log('[Settings v3.14.3] Triggering household data refresh...');
      hydrateHouseholdData();
    };
  }
}

export function applyTheme(theme = 'system') {
  if (typeof document === 'undefined') return;
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
  } else {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
  }
  try {
    localStorage.setItem('plateplan-appearance', theme);
    localStorage.setItem('plateplan-theme', theme);
  } catch (_e) {}
}

import { subscribe } from '../store/store.js';

let settingsUnsub = null;
let settingsTimer = null;

export function mount(container) {
  if (typeof renderSettingsView === 'function') {
    renderSettingsView();
  }
  settingsUnsub = subscribe('preferences', (prefs) => {
    if (typeof renderSettingsView === 'function') {
      renderSettingsView();
    }
  });
}

export function unmount() {
  if (typeof settingsUnsub === 'function') {
    settingsUnsub();
    settingsUnsub = null;
  }
  if (settingsTimer) {
    clearTimeout(settingsTimer);
    settingsTimer = null;
  }
}
