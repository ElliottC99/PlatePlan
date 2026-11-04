/**
 * src/components/recipe/RecipeWizardTaxonomyModal.js
 * Universal Guided Hierarchy Creation Wizard adapter for Recipe Wizard & Audit.
 * Delegates to AddToBankHubUI router so user can choose Category, Root Item, Sub-Type, or Product,
 * and fulfills the full pantry bank hierarchy chain.
 */

import { openAddToBankModal } from '../pantry/AddToBankHubUI.js';

export function openNewIngredientMappingWizardModal({ sIdx, iIdx, initialName = '', onComplete = null } = {}) {
  openAddToBankModal(null, {
    itemName: initialName,
    subtypeName: initialName,
    onComplete: (created) => {
      if (typeof onComplete === 'function') {
        onComplete(created);
      }
    }
  });
}

export const openTaxonomyCreationModal = openNewIngredientMappingWizardModal;
