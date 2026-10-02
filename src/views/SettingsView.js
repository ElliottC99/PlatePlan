/**
 * src/views/SettingsView.js (v3.19.35)
 * Componentized Settings & Preferences View Function.
 * Composes modular profile components and handles persistence through HouseholdRepository.
 */

import { savePreferences } from '../services/HouseholdRepository.js';
import { hydrateHouseholdData } from '../services/HydrationService.js';
import { renderProfileAllocationCard } from '../components/settings/ProfileAllocationCard.js';
import { renderDietaryExclusionManager } from '../components/settings/DietaryExclusionManager.js';
import { renderHouseholdSyncCard } from '../components/settings/HouseholdSyncCard.js';
import { renderSystemDisplayCard, renderSettingsContainer } from '../components/profile/ProfileSettingsModal.js';
import { calculateMealSplit } from '../utils/nutritionCalculator.js';
import { getProfileMealTargets } from '../models/StateModel.js';

// Setup global helpers for Settings interactive elements
if (typeof window !== 'undefined') {
  window.calcBudgets = function() {
    ['elliott', 'chloe'].forEach(pId => {
      const legacyPrefix = pId === 'elliott' ? 'e' : 'c';

      // Dynamic Calorie splits & remainder
      const calBf = Number(document.getElementById(`pp-profile-${pId}-cal-bf`)?.value ?? document.getElementById(`pp-macro-${legacyPrefix}-bf-cal`)?.value ?? 0);
      const calLu = Number(document.getElementById(`pp-profile-${pId}-cal-lu`)?.value ?? document.getElementById(`pp-macro-${legacyPrefix}-lu-cal`)?.value ?? 0);
      const calSn = Number(document.getElementById(`pp-profile-${pId}-cal-sn`)?.value ?? document.getElementById(`pp-macro-${legacyPrefix}-sn-cal`)?.value ?? 0);
      const calDi = Math.max(0, 100 - (calBf + calLu + calSn));
      
      const calDiEl = document.getElementById(`pp-profile-${pId}-cal-di`) || document.getElementById(`pp-macro-${legacyPrefix}-di-cal`);
      if (calDiEl) calDiEl.value = calDi;
      const calSumEl = document.getElementById(`pp-profile-${pId}-cal-sum`);
      if (calSumEl) calSumEl.textContent = `Sum: ${calBf + calLu + calSn + calDi}%`;

      // Dynamic Protein splits & remainder
      const protBf = Number(document.getElementById(`pp-profile-${pId}-prot-bf`)?.value ?? 0);
      const protLu = Number(document.getElementById(`pp-profile-${pId}-prot-lu`)?.value ?? 0);
      const protSn = Number(document.getElementById(`pp-profile-${pId}-prot-sn`)?.value ?? 0);
      const protDi = Math.max(0, 100 - (protBf + protLu + protSn));

      const protDiEl = document.getElementById(`pp-profile-${pId}-prot-di`);
      if (protDiEl) protDiEl.value = protDi;
      const protSumEl = document.getElementById(`pp-profile-${pId}-prot-sum`);
      if (protSumEl) protSumEl.textContent = `Sum: ${protBf + protLu + protSn + protDi}%`;
    });
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
  const systemHtml = renderSystemDisplayCard(settings.theme || 'system', 'v3.19.35 (ES6 Modern)');

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

      const profiles = {};
      ['elliott', 'chloe'].forEach(pId => {
        const legacyPrefix = pId === 'elliott' ? 'e' : 'c';
        const calInput = container.querySelector(`#pp-profile-${pId}-cal`) || container.querySelector(`#pp-macro-${legacyPrefix}-cal`);
        const protInput = container.querySelector(`#pp-profile-${pId}-prot`) || container.querySelector(`#pp-macro-${legacyPrefix}-prot`);
        
        const dailyKcal = Number(calInput?.value || 0);
        const dailyProtein = Number(protInput?.value || 0);

        const calBf = Number(container.querySelector(`#pp-profile-${pId}-cal-bf`)?.value ?? container.querySelector(`#pp-macro-${legacyPrefix}-bf-cal`)?.value ?? 0);
        const calLu = Number(container.querySelector(`#pp-profile-${pId}-cal-lu`)?.value ?? container.querySelector(`#pp-macro-${legacyPrefix}-lu-cal`)?.value ?? 0);
        const calSn = Number(container.querySelector(`#pp-profile-${pId}-cal-sn`)?.value ?? container.querySelector(`#pp-macro-${legacyPrefix}-sn-cal`)?.value ?? 0);
        const calDi = Math.max(0, 100 - (calBf + calLu + calSn));

        const protBf = Number(container.querySelector(`#pp-profile-${pId}-prot-bf`)?.value ?? 0);
        const protLu = Number(container.querySelector(`#pp-profile-${pId}-prot-lu`)?.value ?? 0);
        const protSn = Number(container.querySelector(`#pp-profile-${pId}-prot-sn`)?.value ?? 0);
        const protDi = Math.max(0, 100 - (protBf + protLu + protSn));

        profiles[pId] = {
          enabled: true,
          name: pId.charAt(0).toUpperCase() + pId.slice(1),
          dailyKcal,
          dailyProtein,
          calorieSplits: { breakfast: calBf, lunch: calLu, snack: calSn, dinner: calDi },
          proteinSplits: { breakfast: protBf, lunch: protLu, snack: protSn, dinner: protDi }
        };
      });

      window.state.preferences = window.state.preferences || {};
      window.state.preferences.profiles = profiles;
      window.state.userPrefs = window.state.userPrefs || {};
      window.state.userPrefs.profiles = profiles;

      // Legacy backwards-compatibility
      window.state.userPrefs.elliottCal = profiles.elliott.dailyKcal;
      window.state.userPrefs.elliottProt = profiles.elliott.dailyProtein;
      window.state.userPrefs.chloeCal = profiles.chloe.dailyKcal;
      window.state.userPrefs.chloeProt = profiles.chloe.dailyProtein;

      const nutritionTargets = {};
      for (const [pId, pData] of Object.entries(profiles)) {
        const bfK = Math.round((pData.calorieSplits.breakfast / 100) * pData.dailyKcal);
        const luK = Math.round((pData.calorieSplits.lunch / 100) * pData.dailyKcal);
        const snK = Math.round((pData.calorieSplits.snack / 100) * pData.dailyKcal);
        const diK = Math.max(0, pData.dailyKcal - (bfK + luK + snK));

        const bfP = Math.round((pData.proteinSplits.breakfast / 100) * pData.dailyProtein);
        const luP = Math.round((pData.proteinSplits.lunch / 100) * pData.dailyProtein);
        const snP = Math.round((pData.proteinSplits.snack / 100) * pData.dailyProtein);
        const diP = Math.max(0, pData.dailyProtein - (bfP + luP + snP));

        nutritionTargets[pId] = {
          dailyKcal: pData.dailyKcal,
          dailyProtein: pData.dailyProtein,
          meals: {
            breakfast: { kcal: bfK, protein: bfP },
            lunch: { kcal: luK, protein: luP },
            dinner: { kcal: diK, protein: diP },
            snacking: { kcal: snK, protein: snP }
          }
        };
      }

      window.state.userPrefs.nutritionTargets = nutritionTargets;
      window.state.preferences.nutritionTargets = nutritionTargets;

      window.state.settings = window.state.settings || {};
      const newTheme = container.querySelector('#pp-setting-theme')?.value || 'system';
      window.state.settings.theme = newTheme;
      applyTheme(newTheme);

      console.log('[Settings v3.16.0] Saved user profiles & decoupled splits to state:', window.state.userPrefs.profiles);
      
      // Persist to Firestore
      await savePreferences(window.state.userPrefs, window.state.settings);

      // Dispatch CustomEvent to notify PlannerView and all reactive listeners
      document.dispatchEvent(new CustomEvent('plateplan:state:preferences', { detail: window.state.userPrefs }));
      document.dispatchEvent(new CustomEvent('plateplan:state-changed', { detail: { type: 'preferences', data: window.state.userPrefs } }));
      window.dispatchEvent(new CustomEvent('plateplan:preferences-updated', { detail: window.state.userPrefs }));

      if (typeof window.renderPlanner === 'function') {
        try { window.renderPlanner(); } catch(_e) {}
      } else if (typeof window.renderPlan === 'function') {
        try { window.renderPlan(); } catch(_e) {}
      }

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
