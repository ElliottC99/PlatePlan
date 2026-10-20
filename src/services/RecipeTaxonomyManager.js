/**
 * src/services/RecipeTaxonomyManager.js (v3.38.6)
 * Handles category/tag validation, formatting, and taxonomy creation payloads for the Recipe Wizard.
 */

import { toTitleCase } from './RecipeImporter.js';

export const STANDARD_CATEGORIES = [
  'Store Cupboard',
  'Produce',
  'Refrigerated & Dairy',
  'Frozen',
  'Bakery',
  'Spices & Oils'
];

export function formatTaxonomyName(rawName) {
  return toTitleCase((rawName || '').trim());
}

export function buildExistingSubtypesCatalog(ingredients = [], defaultCat = 'Store Cupboard') {
  const existingSubtypes = [];
  ingredients.forEach(ing => {
    const cat = ing.category || defaultCat;
    (Array.isArray(ing.subtypes) ? ing.subtypes : []).forEach(sub => {
      if (sub && sub.name) {
        existingSubtypes.push({
          id: sub.id || sub.name,
          name: sub.name,
          parentItemId: ing.id,
          parentItemName: ing.name || '',
          category: cat,
          defaultProductId: sub.defaultProductId || null
        });
      }
    });
  });
  return existingSubtypes;
}

export function computeAvailableCategories(storeCategories = [], ingredients = []) {
  return Array.from(
    new Set([...STANDARD_CATEGORIES, ...storeCategories, ...ingredients.map(i => i.category).filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}
