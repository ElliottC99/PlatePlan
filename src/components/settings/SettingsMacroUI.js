/**
 * src/components/settings/SettingsMacroUI.js (v3.9.9)
 * Modular Presentation Component for Household Macro Targets & Allocation Cards
 */

import { renderProfileAllocationCard } from './ProfileAllocationCard.js';

export function renderMacroAllocationCard(prefs = {}) {
  return renderProfileAllocationCard(prefs);
}

export {
  renderProfileAllocationCard
};
