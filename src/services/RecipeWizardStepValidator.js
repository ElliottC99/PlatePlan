/**
 * src/services/RecipeWizardStepValidator.js (v3.38.64)
 * Handles step-specific validation rules for the Recipe Wizard.
 */

/**
 * Validates Step 1: Entity Name.
 * @param {string} name 
 * @returns {boolean}
 */
export function validateStep1Name(name) {
  if (!name || !name.trim()) {
    if (typeof window !== 'undefined' && typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Please enter an Entity Name', 'warning');
    }
    return false;
  }
  return true;
}
