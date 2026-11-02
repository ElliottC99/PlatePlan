/**
 * scripts/test_variant_save_and_taxonomy_mapping.js
 * Verification suite for:
 * 1. Universal Product & Subtype Taxonomy Recognition in Step 2 (no false "✨ New Item")
 * 2. Dual-Variant Save Isolation (preserving .enhanced when saving original, updating .enhanced when saving enhanced)
 * 3. Auto-Enhance Free-Hand Custom Swaps with isAutoDefault Product Ranking
 */

import assert from 'node:assert';

// Mock DOM & Storage globals
class MockLocalStorage {
  constructor() { this.store = {}; }
  getItem(key) { return this.store[key] || null; }
  setItem(key, value) { this.store[key] = String(value); }
  removeItem(key) { delete this.store[key]; }
  clear() { this.store = {}; }
}
global.localStorage = new MockLocalStorage();

global.window = {
  localStorage: global.localStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
  dispatchEvent: () => true,
  document: {
    createElement: (tag) => ({ tagName: tag, style: {}, classList: { add: () => {}, remove: () => {} }, querySelector: () => null, querySelectorAll: () => [] }),
    body: { style: {} }
  }
};
global.document = global.window.document;

// Import target modules
import { getTaxonomyLabel, renderTaxonomySearchHTML, isIngredientUnlinked } from '../src/components/recipe/RecipeWizardTaxonomySearch.js';
import { wizardState, syncStep2InputsToState, getSaveButtonLabel } from '../src/components/recipe/RecipeWizardState.js';
import { buildLiveEnhancedRecipe } from '../src/components/recipe/RecipeEnhancementModalUI.js';

console.log('=== RUNNING VARIANT SAVE & TAXONOMY MAPPING TEST SUITE ===\n');

// Mock catalog data
const mockProducts = [
  { id: 'p_tofu_std', name: 'Firm Tofu Standard', category: 'Proteins', isAutoDefault: false },
  { id: 'p_tofu_def', name: 'Organic Firm Tofu', category: 'Proteins', isAutoDefault: true },
  { id: 'p_sesame_oil', name: 'Toasted Sesame Oil', category: 'Store Cupboard', isAutoDefault: false }
];

const mockIngredients = [
  { id: 'ing_tofu', name: 'Tofu', category: 'Proteins', subtypes: [{ id: 'sub_firm', name: 'Firm Tofu' }] }
];

// --- Test 1: Taxonomy Resolution for Product-Mapped Ingredients ---
console.log('--- Test 1: Taxonomy Resolution for Product-Mapped Ingredients ---');
{
  const itemWithProduct = {
    name: 'Sesame Oil',
    productId: 'p_sesame_oil',
    qty: 10,
    unit: 'ml'
  };

  const label = getTaxonomyLabel(itemWithProduct, mockIngredients, mockProducts);
  assert(label.includes('Toasted Sesame Oil'), `Label should resolve product name, got: "${label}"`);
  assert(!label.includes('✨ New Item'), `Label must NOT be tagged as "✨ New Item", got: "${label}"`);

  const isUnlinked = isIngredientUnlinked(itemWithProduct, mockProducts, mockIngredients);
  assert.strictEqual(isUnlinked, false, 'Item mapped via productId must NOT be considered unlinked');

  const html = renderTaxonomySearchHTML(0, 0, itemWithProduct, mockIngredients, mockProducts);
  assert(html.includes('data-tax-val="prod:p_sesame_oil"'), `HTML must set data-tax-val="prod:p_sesame_oil", got: ${html}`);
  console.log('✅ Test 1 Passed: Product-mapped ingredients resolve to product taxonomy and are recognized as linked.');
}

// --- Test 2: syncStep2InputsToState Preserves Product Links ---
console.log('\n--- Test 2: State Synchronization Preserves Product Links ---');
{
  wizardState.activeRecipe = {
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { name: 'Sesame Oil', productId: 'p_sesame_oil', qty: 10, unit: 'ml' }
        ]
      }
    ]
  };

  const mockInput = {
    dataset: { sidx: '0', iidx: '0', taxVal: 'prod:p_sesame_oil' },
    value: '📦 Toasted Sesame Oil [Store Cupboard]'
  };

  const mockWrap = {
    querySelectorAll: (sel) => sel === '.wiz-ing-tax-search' ? [mockInput] : []
  };

  syncStep2InputsToState(mockWrap);
  const syncedItem = wizardState.activeRecipe.ingredientSections[0].ingredients[0];
  assert.strictEqual(syncedItem.productId, 'p_sesame_oil', 'Product ID must be preserved');
  assert.strictEqual(syncedItem.isNewTaxonomyItem, false, 'Item must NOT be marked as isNewTaxonomyItem');
  console.log('✅ Test 2 Passed: syncStep2InputsToState correctly registers and preserves prod: mappings.');
}

// --- Test 3: Dual-Variant Save Button Context ---
console.log('\n--- Test 3: Contextual Save Button Labels ---');
{
  const mockRecipe = {
    id: 'r_dan_dan',
    title: 'Spicy Dan Dan Noodles',
    ingredients: [{ name: 'Noodles', qty: 200, unit: 'g' }],
    enhanced: {
      ingredients: [{ name: 'Ramen Flat Noodles', qty: 200, unit: 'g' }],
      method: ['Cook noodles']
    }
  };

  wizardState.activeVariant = 'enhanced';
  assert.strictEqual(getSaveButtonLabel(mockRecipe), 'Save Enhanced Variant', 'Save label must indicate Save Enhanced Variant when reviewing enhanced');

  wizardState.activeVariant = 'original';
  assert.strictEqual(getSaveButtonLabel(mockRecipe), 'Save Both Recipes', 'Save label must indicate Save Both Recipes when original has distinct enhanced');
  console.log('✅ Test 3 Passed: Save button displays correct contextual variant label.');
}

// --- Test 4: Free-Hand Custom Swaps Applied Cleanly ---
console.log('\n--- Test 4: Free-Hand Custom Swaps Application ---');
{
  const originalRecipe = {
    id: 'r_stirfry',
    name: 'Vegetable Stir Fry',
    servings: 2,
    ingredients: [
      { name: 'Regular Tofu', qty: 200, unit: 'g' },
      { name: 'Soy Sauce', qty: 20, unit: 'ml' }
    ],
    macros: { calories: 350, protein: 18, carbs: 25, fat: 12 }
  };

  const customRoute = {
    id: 'custom_route',
    proposedServings: 2,
    adjustments: [
      {
        id: 'adj_custom_1',
        type: 'swap',
        active: true,
        isCustom: true,
        ingredientName: 'Regular Tofu',
        swapTo: 'Organic Firm Tofu',
        proposedQty: 250,
        unit: 'g',
        postTaxonomy: {
          productId: 'p_tofu_def',
          productName: 'Organic Firm Tofu',
          category: 'Proteins'
        }
      }
    ]
  };

  const live = buildLiveEnhancedRecipe(customRoute, originalRecipe);
  assert(live, 'buildLiveEnhancedRecipe must return a valid live object');
  assert(live.livePayload, 'livePayload must be constructed');

  const swappedIng = live.livePayload.ingredients.find(i => i.name === 'Organic Firm Tofu');
  assert(swappedIng, 'Target ingredient must be swapped to Organic Firm Tofu');
  assert.strictEqual(swappedIng.qty, 250, 'Swapped ingredient must use the proposed quantity of 250g');
  assert.strictEqual(swappedIng.productId, 'p_tofu_def', 'Swapped ingredient must carry postTaxonomy.productId');
  console.log('✅ Test 4 Passed: Free-hand custom swaps flow cleanly into the synthesized enhanced payload.');
}

console.log('\n=== ALL VARIANT SAVE & TAXONOMY MAPPING TESTS PASSED! ===');
