/**
 * src/services/RecipeWizardValidationService.js (v3.38.59)
 * Handles data consolidation and validation for Recipe Wizard step transitions.
 */

import { toTitleCase } from './RecipeImporter.js';

export function consolidateStep2Data({
  modalEl,
  wizardData,
  ingredients,
  existingSubtypes,
  defaultCat
}) {
  const itemInput = modalEl.querySelector('#map-item-search-input');
  const catInput = modalEl.querySelector('#map-cat-search-input');
  const subInput = modalEl.querySelector('#map-sub-name-input');

  let finalCatName = wizardData.selectedCategory || wizardData.category || defaultCat;
  let finalItemName = wizardData.newItemName || wizardData.item || wizardData.name;
  let finalSubName = wizardData.subTypeName || wizardData.subType || wizardData.name;

  if (wizardData.entityType === 'subtype') {
    finalSubName = toTitleCase(wizardData.subTypeName || wizardData.name);
    finalItemName = toTitleCase(itemInput?.value?.trim() || wizardData.newItemName || wizardData.name);
    if (wizardData.isExistingParentItem && wizardData.selectedItemId) {
      const parentIng = ingredients.find(i => String(i.id) === String(wizardData.selectedItemId));
      finalCatName = toTitleCase(parentIng?.category || wizardData.selectedCategory || defaultCat);
    } else {
      finalCatName = toTitleCase(catInput?.value?.trim() || wizardData.selectedCategory || defaultCat);
    }
  } else if (wizardData.entityType === 'item') {
    finalItemName = toTitleCase(wizardData.newItemName || wizardData.name);
    finalSubName = toTitleCase(subInput?.value?.trim() || wizardData.subTypeName || finalItemName);
    if (wizardData.isExistingChildSubtype && wizardData.selectedSubtypeId) {
      const matchedSub = existingSubtypes.find(s => String(s.id) === String(wizardData.selectedSubtypeId));
      finalCatName = toTitleCase(matchedSub?.category || wizardData.selectedCategory || defaultCat);
    } else {
      finalCatName = toTitleCase(catInput?.value?.trim() || wizardData.selectedCategory || defaultCat);
    }
  } else if (wizardData.entityType === 'category') {
    finalCatName = toTitleCase(wizardData.selectedCategory || wizardData.category || wizardData.name);
    finalItemName = toTitleCase(itemInput?.value?.trim() || wizardData.newItemName || finalCatName);
    finalSubName = toTitleCase(subInput?.value?.trim() || wizardData.subTypeName || finalCatName);
  }

  wizardData.category = finalCatName;
  wizardData.selectedCategory = finalCatName;
  wizardData.item = finalItemName;
  wizardData.newItemName = finalItemName;
  wizardData.subType = finalSubName;
  wizardData.subTypeName = finalSubName;
}
