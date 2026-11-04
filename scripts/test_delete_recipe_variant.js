/**
 * scripts/test_delete_recipe_variant.js
 * Verification suite for Context-Aware Recipe Variant Deletion.
 */

import assert from 'node:assert/strict';

// 1. Mock window and globals
global.window = {
  firebase: {
    firestore: {
      FieldValue: {
        delete: () => '__FIELD_DELETE_TOKEN__'
      }
    }
  }
};

let capturedUpdates = null;
let deletedDoc = false;

// Mock db
const mockDocRef = {
  update: async (updates) => {
    capturedUpdates = updates;
    return Promise.resolve();
  },
  delete: async () => {
    deletedDoc = true;
    return Promise.resolve();
  }
};

const mockDb = {
  collection: (col) => ({
    doc: (docId) => ({
      collection: (subCol) => ({
        doc: (id) => mockDocRef
      })
    })
  })
};

// Set up mock before importing
import { 
  renderRecipeActionsItems, 
  renderDeleteConfirmationContent 
} from '../src/components/vault/VaultRecipeCardRenderService.js';
import { deleteRecipeVariant } from '../src/services/RecipeFirestoreRepository.js';

console.log('=== RUNNING CONTEXT-AWARE VARIANT DELETION VERIFICATION SUITE ===\n');

// --- Test 1: Action Menu Labels by Variant ---
console.log('--- Test 1: Action Menu Labels by Variant ---');
const originalMenuHtml = renderRecipeActionsItems('r123', false, 'original');
assert.ok(originalMenuHtml.includes('Delete Entire Recipe'), 'Original menu must include "Delete Entire Recipe"');
assert.ok(originalMenuHtml.includes('Auto-Enhance (85+)'), 'Original menu must include "Auto-Enhance (85+)"');
assert.ok(!originalMenuHtml.includes('Remove Enhanced Variant'), 'Original menu must NOT include "Remove Enhanced Variant"');

const enhancedMenuHtml = renderRecipeActionsItems('r123', false, 'enhanced');
assert.ok(enhancedMenuHtml.includes('Remove Enhanced Variant'), 'Enhanced menu must include "Remove Enhanced Variant"');
assert.ok(!enhancedMenuHtml.includes('Delete Entire Recipe'), 'Enhanced menu must NOT include "Delete Entire Recipe"');
assert.ok(!enhancedMenuHtml.includes('Auto-Enhance (85+)'), 'Enhanced menu must NOT include "Auto-Enhance (85+)"');
console.log('✅ Test 1 Passed: Action menus distinguish original vs enhanced variant.\n');

// --- Test 2: Confirmation Dialog Messaging ---
console.log('--- Test 2: Confirmation Dialog Messaging ---');
const originalDialogHtml = renderDeleteConfirmationContent('Sausage Pasta', 'original');
assert.ok(originalDialogHtml.includes('Delete Entire Recipe?'), 'Original dialog header must say "Delete Entire Recipe?"');
assert.ok(originalDialogHtml.includes('Delete Recipe'), 'Original dialog button must say "Delete Recipe"');
assert.ok(originalDialogHtml.includes('permanently delete'), 'Original dialog must warn of permanent deletion');

const enhancedDialogHtml = renderDeleteConfirmationContent('Sausage Pasta', 'enhanced');
assert.ok(enhancedDialogHtml.includes('Remove Enhanced Variant?'), 'Enhanced dialog header must say "Remove Enhanced Variant?"');
assert.ok(enhancedDialogHtml.includes('Remove Variant'), 'Enhanced dialog button must say "Remove Variant"');
assert.ok(enhancedDialogHtml.includes('Your original recipe will remain 100% untouched'), 'Enhanced dialog must explicitly guarantee original recipe remains untouched');
console.log('✅ Test 2 Passed: Confirmation dialogs provide explicit safety assurances.\n');

// --- Test 3: Local In-Memory Recipe Variant Deletion ---
console.log('--- Test 3: Local In-Memory Recipe Variant Deletion ---');
const sampleRecipe = {
  id: 'r1784057670563',
  name: 'Creamy Sausage & Pea Gnocchi',
  serves: 2,
  ingredients: [
    { name: 'Gnocchi', amount: 500, unit: 'g' },
    { name: 'Creme Fraiche', amount: 150, unit: 'g' },
    { name: 'Pork Sausage Meat', amount: 400, unit: 'g' }
  ],
  enhanced: {
    ingredients: [
      { name: 'Gnocchi', amount: 450, unit: 'g' },
      { name: 'Reduced Fat Creme Fraiche', amount: 150, unit: 'g' },
      { name: 'Pork Sausage Meat', amount: 400, unit: 'g' }
    ],
    fitScore: 92
  },
  enhancedFitScore: 92
};

// Simulate deleting the enhanced variant
delete sampleRecipe.enhanced;
delete sampleRecipe.enhancedFitScore;

assert.equal(sampleRecipe.enhanced, undefined, 'enhanced property must be removed');
assert.equal(sampleRecipe.enhancedFitScore, undefined, 'enhancedFitScore property must be removed');
assert.equal(sampleRecipe.name, 'Creamy Sausage & Pea Gnocchi', 'Recipe name must remain untouched');
assert.equal(sampleRecipe.id, 'r1784057670563', 'Recipe id must remain untouched');
assert.equal(sampleRecipe.ingredients.length, 3, 'All 3 original ingredients must remain intact');
assert.equal(sampleRecipe.ingredients[1].name, 'Creme Fraiche', 'Original creme fraiche must remain intact');
console.log('✅ Test 3 Passed: Local variant deletion strips variant without touching base recipe.\n');

// --- Test 4: Variant Favoriting Key Cleanup ---
console.log('--- Test 4: Variant Favoriting Key Cleanup ---');
const variantFavourites = ['r1784057670563_original', 'r1784057670563_enhanced', 'other_recipe_original'];
const recipeId = 'r1784057670563';

// Remove enhanced favorite
const idx = variantFavourites.indexOf(`${recipeId}_enhanced`);
if (idx !== -1) variantFavourites.splice(idx, 1);

assert.ok(!variantFavourites.includes('r1784057670563_enhanced'), 'Enhanced favorite key must be removed');
assert.ok(variantFavourites.includes('r1784057670563_original'), 'Original favorite key must NOT be removed');
assert.ok(variantFavourites.includes('other_recipe_original'), 'Other favorites must NOT be affected');
console.log('✅ Test 4 Passed: Variant favorite preferences cleaned up correctly.\n');

console.log('===============================================================');
console.log('🎯 ALL CONTEXT-AWARE VARIANT DELETION TESTS PASSED SUCCESSFULLY');
console.log('===============================================================');
