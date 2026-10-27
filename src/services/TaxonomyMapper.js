/**
 * src/services/TaxonomyMapper.js (v3.38.56)
 * Pure domain service for Recipe Wizard taxonomy hierarchy mapping.
 * Handles Tier synchronization (Category -> Item -> Sub-Type) and wizard state initialization.
 */

import { toTitleCase } from './RecipeImporter.js';

/**
 * Initializes the default data structure for the ingredient mapping wizard.
 *
 * @param {string} cleanInitialName 
 * @param {string} defaultCat 
 * @returns {object} Initial wizard state object
 */
export function createInitialWizardData(cleanInitialName, defaultCat = 'Store Cupboard') {
  return {
    entityType: 'subtype',
    name: cleanInitialName,
    category: defaultCat,
    item: cleanInitialName,
    subType: cleanInitialName,
    selectedItemId: '',
    isExistingParentItem: false,
    selectedSubtypeId: '',
    isExistingChildSubtype: false,
    newItemName: cleanInitialName,
    selectedCategory: defaultCat,
    subTypeName: cleanInitialName,
    createdIngredientId: null,
    createdSubtypeId: null,
    linkedProduct: null
  };
}

/**
 * Synchronizes the taxonomy tier and related hierarchy properties when Step 1 selection changes.
 * Pure business logic isolated from DOM manipulation.
 *
 * @param {object} wizardData - Mutable wizard state container
 * @param {string} rawName - Raw name typed or selected
 * @param {string} type - 'subtype' | 'item' | 'category'
 * @param {Array} ingredients - Known catalog of ingredients from store
 * @param {string} defaultCat - Fallback category name
 */
export function syncTierStateFromStep1(wizardData, rawName, type, ingredients = [], defaultCat = 'Store Cupboard') {
  if (!wizardData) return;

  const cleanName = toTitleCase(rawName || wizardData.name || 'New Item');
  wizardData.name = cleanName;
  wizardData.entityType = type;

  if (type === 'subtype') {
    wizardData.subType = cleanName;
    wizardData.subTypeName = cleanName;
    wizardData.selectedSubtypeId = '';
    wizardData.isExistingChildSubtype = false;
    
    const matchedItem = ingredients.find(i => (i.name || '').toLowerCase() === cleanName.toLowerCase());
    if (matchedItem) {
      wizardData.selectedItemId = matchedItem.id;
      wizardData.isExistingParentItem = true;
      wizardData.item = matchedItem.name;
      wizardData.newItemName = matchedItem.name;
      wizardData.category = matchedItem.category || defaultCat;
      wizardData.selectedCategory = wizardData.category;
    } else {
      wizardData.selectedItemId = '';
      wizardData.isExistingParentItem = false;
      wizardData.item = cleanName;
      wizardData.newItemName = cleanName;
      wizardData.category = wizardData.selectedCategory || defaultCat;
      wizardData.selectedCategory = wizardData.category;
    }
  } else if (type === 'item') {
    wizardData.item = cleanName;
    wizardData.newItemName = cleanName;
    wizardData.subType = cleanName;
    wizardData.subTypeName = cleanName;
    wizardData.selectedSubtypeId = '';
    wizardData.isExistingChildSubtype = false;
    
    const matchedItem = ingredients.find(i => (i.name || '').toLowerCase() === cleanName.toLowerCase());
    wizardData.selectedItemId = matchedItem ? matchedItem.id : '';
    wizardData.isExistingParentItem = Boolean(matchedItem);
    wizardData.category = matchedItem?.category || wizardData.selectedCategory || defaultCat;
    wizardData.selectedCategory = wizardData.category;
  } else if (type === 'category') {
    wizardData.category = cleanName;
    wizardData.selectedCategory = cleanName;
    wizardData.item = cleanName;
    wizardData.newItemName = cleanName;
    wizardData.subType = cleanName;
    wizardData.subTypeName = cleanName;
    wizardData.selectedItemId = '';
    wizardData.isExistingParentItem = false;
    wizardData.selectedSubtypeId = '';
    wizardData.isExistingChildSubtype = false;
  }
}
