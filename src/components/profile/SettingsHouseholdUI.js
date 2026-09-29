/**
 * src/components/profile/SettingsHouseholdUI.js (v3.9.9)
 * Modular Presentation Component for Household Sync Status & System Theme Settings
 */

import { renderHouseholdSyncCard } from '../settings/HouseholdSyncCard.js';
import { renderSystemDisplayCard, renderSettingsContainer } from './ProfileSettingsModal.js';

export function renderHouseholdSettingsCard(settings = {}) {
  return renderHouseholdSyncCard(settings);
}

export {
  renderHouseholdSyncCard,
  renderSystemDisplayCard,
  renderSettingsContainer
};
