/**
 * src/components/recipe/BulkRecipeImporterModal.js (v3.22.0)
 * Re-exports openBulkRecipeImporterModal as a wrapper for openRecipeWizard('bulk').
 */

import { openRecipeWizard } from './RecipeWizardModal.js';

export function openBulkRecipeImporterModal() {
  openRecipeWizard('bulk');
}

if (typeof window !== 'undefined') {
  window.openBulkRecipeImporterModal = openBulkRecipeImporterModal;
}
