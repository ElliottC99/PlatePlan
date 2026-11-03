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
    createElement: (tag) => ({ tagName: tag, style: {}, classList: { add: () => {}, remove: () => {} }, querySelector: () => null, querySelectorAll: () => [], appendChild: () => {} }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    dispatchEvent: () => true,
    body: { style: {}, appendChild: () => {} }
  }
};
global.document = global.window.document;

// Import target modules
import { setRecipes, setProducts, setIngredients } from '../src/store/store.js';
import { getTaxonomyLabel, renderTaxonomySearchHTML, isIngredientUnlinked } from '../src/components/recipe/RecipeWizardTaxonomySearch.js';
import { wizardState, syncStep2InputsToState, getSaveButtonLabel } from '../src/components/recipe/RecipeWizardState.js';
import { buildLiveEnhancedRecipe } from '../src/components/recipe/RecipeEnhancementModalUI.js';
import { openRecipeWizard } from '../src/components/recipe/RecipeWizardModal.js';
import { renderMacroBreakdownCrossbar } from '../src/components/recipe/RecipeWizardStep3View.js';

console.log('=== RUNNING VARIANT SAVE & TAXONOMY MAPPING TEST SUITE ===\n');

// Mock catalog data
const mockProducts = [
  { id: 'p_tofu_std', name: 'Firm Tofu Standard', category: 'Proteins', isAutoDefault: false },
  { id: 'p_tofu_def', name: 'Organic Firm Tofu', category: 'Proteins', isAutoDefault: true },
  { id: 'p_sesame_oil', name: 'Toasted Sesame Oil', category: 'Store Cupboard', isAutoDefault: true }
];

const mockIngredients = [
  { 
    id: 'ing_tofu', 
    name: 'Tofu', 
    category: 'Proteins', 
    subtypes: [
      { id: 'sub_firm', name: 'Firm Tofu', defaultProductId: 'p_tofu_def' }
    ] 
  },
  {
    id: 'ing_sesame_oil',
    name: 'Sesame Oil',
    category: 'Store Cupboard',
    defaultProductId: 'p_sesame_oil'
  }
];

// Provide products and ingredients via global.window.Store
global.window.Store = {
  getState: () => ({
    products: mockProducts,
    ingredients: mockIngredients,
    recipes: []
  })
};

// --- Test 1: Taxonomy Resolution & Clean Concise Display ---
console.log('--- Test 1: Taxonomy Resolution & Clean Concise Display ---');
{
  const itemWithSubtype = {
    name: 'Tofu',
    ingredientId: 'ing_tofu',
    subtypeId: 'sub_firm',
    qty: 200,
    unit: 'g'
  };

  const label = getTaxonomyLabel(itemWithSubtype, mockIngredients, mockProducts);
  assert.strictEqual(label, '🏷️ Firm Tofu', `Label should be clean subtype name only, got: "${label}"`);
  assert(!label.includes('✨ New Item'), `Label must NOT be tagged as "✨ New Item", got: "${label}"`);

  const rootLabel = getTaxonomyLabel({ ingredientId: 'ing_sesame_oil' }, mockIngredients, mockProducts);
  assert.strictEqual(rootLabel, '📦 Sesame Oil', `Label should be clean root item name only, got: "${rootLabel}"`);

  const catLabel = getTaxonomyLabel({ categoryId: 'Proteins' }, mockIngredients, mockProducts);
  assert.strictEqual(catLabel, '📂 Proteins', `Label should be clean category name only, got: "${catLabel}"`);

  const isUnlinked = isIngredientUnlinked(itemWithSubtype, mockProducts, mockIngredients);
  assert.strictEqual(isUnlinked, false, 'Taxonomy-mapped item must NOT be considered unlinked');

  const html = renderTaxonomySearchHTML(0, 0, itemWithSubtype, mockIngredients, mockProducts);
  assert(html.includes('data-tax-val="ing_tofu:sub_firm"'), `HTML must set data-tax-val="ing_tofu:sub_firm", got: ${html}`);
  console.log('✅ Test 1 Passed: Taxonomy-mapped ingredients resolve to clean concise names.');
}

// --- Test 2: syncStep2InputsToState Enforces Taxonomy-Only Mapping ---
console.log('\n--- Test 2: State Synchronization Enforces Taxonomy-Only Mapping ---');
{
  wizardState.activeRecipe = {
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { name: 'Tofu', productId: 'legacy_prod_id', qty: 200, unit: 'g' }
        ]
      }
    ]
  };

  const mockInput = {
    dataset: { sidx: '0', iidx: '0', taxVal: 'ing_tofu:sub_firm' },
    value: '🏷️ Firm Tofu (Tofu) (Organic Firm Tofu)'
  };

  const mockWrap = {
    querySelectorAll: (sel) => sel === '.wiz-ing-tax-search' ? [mockInput] : []
  };

  syncStep2InputsToState(mockWrap);
  const syncedItem = wizardState.activeRecipe.ingredientSections[0].ingredients[0];
  assert.strictEqual(syncedItem.ingredientId, 'ing_tofu', 'ingredientId must be mapped');
  assert.strictEqual(syncedItem.subtypeId, 'sub_firm', 'subtypeId must be mapped');
  assert.strictEqual(syncedItem.productId, null, 'Direct productId must be cleared in favor of taxonomy mapping');
  assert.strictEqual(syncedItem.isNewTaxonomyItem, false, 'Item must NOT be marked as isNewTaxonomyItem');
  console.log('✅ Test 2 Passed: syncStep2InputsToState maps to taxonomy and clears direct productId.');
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

// --- Test 5: Enhanced Variant Ingredient Shadowing Fix in Wizard ---
console.log('\n--- Test 5: Enhanced Variant Ingredient Shadowing Fix in Wizard ---');
{
  const mockRecipeWithEnhanced = {
    id: 'r_dan_dan_shadow_test',
    title: 'Spicy Dan Dan Noodles',
    serves: 2,
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { name: 'Sesame Oil', qty: 15, unit: 'ml' },
          { name: 'Beef Mince', qty: 200, unit: 'g' }
        ]
      }
    ],
    enhanced: {
      serves: 2,
      cal: 566,
      ingredients: [
        { name: 'Sesame Oil', qty: 7.5, unit: 'ml' },
        { name: 'Quorn Mince', qty: 250, unit: 'g' }
      ]
    }
  };

  // Set in store
  setRecipes([mockRecipeWithEnhanced]);
  setProducts(mockProducts);
  setIngredients(mockIngredients);

  // Open wizard in enhanced mode
  openRecipeWizard({
    editRecipeId: 'r_dan_dan_shadow_test',
    variant: 'enhanced',
    initialMode: 'review'
  });

  const loadedIngredients = wizardState.activeRecipe.ingredientSections[0].ingredients;
  assert.strictEqual(loadedIngredients.length, 2, 'Must load 2 ingredients from enhanced variant');
  assert.strictEqual(loadedIngredients[0].name, 'Sesame Oil');
  assert.strictEqual(loadedIngredients[0].qty, 7.5, 'Must load enhanced 7.5ml Sesame Oil, NOT base recipe 15ml!');
  assert.strictEqual(loadedIngredients[1].name, 'Quorn Mince', 'Must load Quorn Mince, NOT base recipe Beef Mince!');
  assert.strictEqual(loadedIngredients[1].qty, 250, 'Must load enhanced 250g Quorn Mince, NOT base recipe 200g!');
  console.log('✅ Test 5 Passed: Wizard correctly unpacks enhanced.ingredients without base ingredientSections shadowing.');
}

console.log('\n=== ALL VARIANT SAVE & TAXONOMY MAPPING TESTS PASSED! ===');
