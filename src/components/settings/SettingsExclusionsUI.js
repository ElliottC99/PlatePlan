/**
 * src/components/settings/SettingsExclusionsUI.js (v3.9.9)
 * Modular Presentation Component for Dietary Exclusion Manager & Allergy Chips
 */

import { renderDietaryExclusionManager } from './DietaryExclusionManager.js';

export function renderExclusionManagerCard(prefs = {}, settings = {}) {
  return renderDietaryExclusionManager(prefs, settings);
}

export {
  renderDietaryExclusionManager
};
