/**
 * src/components/recipe/RecipeWizardTaxonomyModal.js
 * Universal Guided Hierarchy Creation Wizard adapter for Recipe Wizard.
 * Forwards taxonomy mapping to openAddItemWizard, enforcing Category -> Root Item -> Sub-Type -> Product.
 */

import { openAddItemWizard } from '../pantry/AddItemWizardUI.js';

export function openNewIngredientMappingWizardModal({ sIdx, iIdx, initialName = '', onComplete = null } = {}) {
  openAddItemWizard({
    startAt: 'category',
    itemName: initialName,
    onComplete: (created) => {
      if (typeof onComplete === 'function') {
        onComplete(created);
      }
    }
  });
}

export const openTaxonomyCreationModal = openNewIngredientMappingWizardModal;
