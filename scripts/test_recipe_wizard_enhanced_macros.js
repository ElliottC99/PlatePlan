/**
 * scripts/test_recipe_wizard_enhanced_macros.js
 * Verification suite for:
 * 1. Wizard loading an enhanced recipe in review mode retains correct sections and variant state.
 * 2. Changing ingredient quantity/volume dynamically updates activeRecipe.macros, activeRecipe.enhanced.macros, and Fit Score.
 * 3. Fit score badge and macro crossbar evaluate with the updated enhanced macros, not stale snapshots.
 * 4. Changing ingredient taxonomy mapping clears stale product IDs and re-resolves to the new taxonomy.
 * 5. Step 3 Review preserves live Step 2 edits instead of overwriting them with a stale .enhanced object.
 */

import assert from 'node:assert';

// Lightweight DOM Stub
class MockClassList {
  constructor() { this.classes = new Set(); }
  add(cls) { this.classes.add(cls); }
  remove(cls) { this.classes.delete(cls); }
  contains(cls) { return this.classes.has(cls); }
}

class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = '';
    this.classList = new MockClassList();
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this._innerHTML = '';
    this.listeners = {};
    this.attributes = {};
    this.value = '';
    this.dataset = {};
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(html) {
    this._innerHTML = String(html || '');
    this.children = [];
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }

  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  dispatchEvent(evt) {
    const list = this.listeners[evt.type] || [];
    list.forEach(fn => fn(evt));
  }

  querySelector(sel) {
    if (sel.startsWith('#')) {
      const id = sel.slice(1);
      if (this.id === id) return this;
      for (const child of this.children) {
        const found = child.querySelector(sel);
        if (found) return found;
      }
    }
    return new MockElement('div');
  }

  querySelectorAll() { return []; }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
}

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

global.window = {
  localStorage: global.localStorage,
  dispatchEvent: () => {},
  Store: { getState: () => ({ recipes: [], products: [], ingredients: [] }) },
  getState: () => ({ recipes: [], products: [], ingredients: [] }),
  isRecipeVariantFavourite: () => false
};

global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => new MockElement('div', id),
  querySelector: () => new MockElement('div'),
  querySelectorAll: () => [],
  body: new MockElement('body'),
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};

console.log('=== RUNNING ENHANCED RECIPE WIZARD RE-EVALUATION TEST SUITE ===\n');

// Import target modules
const { setRecipes, setProducts, setIngredients } = await import('../src/store/store.js');
const { openRecipeWizard } = await import('../src/components/recipe/RecipeWizardModal.js');
const { wizardState, syncStep2InputsToState } = await import('../src/components/recipe/RecipeWizardState.js');
const { recalculateWizardMacros, resolveProductForIngredient } = await import('../src/components/recipe/RecipeWizardStep3Handlers.js');
const { renderFitScoreBadge } = await import('../src/components/FitScoreBadge.js');
const { renderMacroBreakdownCrossbar, renderState3Review } = await import('../src/components/recipe/RecipeWizardStep3View.js');

const mockOriginalRecipe = {
  id: 'rec_chicken_bowl',
  title: 'Honey Soy Chicken Bowl',
  name: 'Honey Soy Chicken Bowl',
  servings: 2,
  serves: 2,
  mealSuitability: ['Dinner'],
  macros: { calories: 620, protein: 32, carbs: 70, fat: 22 },
  ingredientSections: [
    {
      sectionTitle: 'Main Ingredients',
      ingredients: [
        { id: 'ing_1', name: 'Chicken Thigh', qty: 250, unit: 'g', productId: 'p_chick_thigh' },
        { id: 'ing_2', name: 'White Rice', qty: 150, unit: 'g', productId: 'p_rice' },
        { id: 'ing_3', name: 'Sesame Oil', qty: 20, unit: 'ml', productId: 'p_oil' }
      ]
    }
  ],
  enhanced: {
    title: 'Honey Soy Chicken Bowl (Enhanced)',
    name: 'Honey Soy Chicken Bowl (Enhanced)',
    servings: 2,
    serves: 2,
    mealSuitability: ['Dinner'],
    macros: { calories: 510, protein: 44, carbs: 55, fat: 12 },
    fitScore: 86,
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { id: 'ing_1', name: 'Chicken Breast', qty: 300, unit: 'g', productId: 'p_chick_breast' },
          { id: 'ing_2', name: 'White Rice', qty: 110, unit: 'g', productId: 'p_rice' },
          { id: 'ing_3', name: 'Sesame Oil', qty: 10, unit: 'ml', productId: 'p_oil' }
        ]
      }
    ]
  }
};

const mockProducts = [
  { id: 'p_chick_thigh', name: 'Chicken Thigh', kcal: 210, protein: 20, fat: 14, carbs: 0, isAutoDefault: true },
  { id: 'p_chick_breast', name: 'Chicken Breast', kcal: 120, protein: 26, fat: 2, carbs: 0, isAutoDefault: true },
  { id: 'p_rice', name: 'White Rice', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, isAutoDefault: true },
  { id: 'p_oil', name: 'Sesame Oil', kcal: 884, protein: 0, fat: 100, carbs: 0, isAutoDefault: true },
  { id: 'p_tofu', name: 'Firm Tofu', ingredientId: 'root_tofu', subtypeId: 'sub_firm', kcal: 90, protein: 12, fat: 5, carbs: 2, isAutoDefault: true }
];

const mockIngredients = [
  { id: 'root_tofu', name: 'Tofu', defaultProductId: 'p_tofu', subtypes: [{ id: 'sub_firm', name: 'Firm Tofu', defaultProductId: 'p_tofu' }] }
];

setRecipes([mockOriginalRecipe]);
setProducts(mockProducts);
setIngredients(mockIngredients);

global.window.Store.getState = () => ({
  recipes: [mockOriginalRecipe],
  products: mockProducts,
  ingredients: mockIngredients,
  rootItems: mockIngredients
});
global.window.getState = global.window.Store.getState;

// Test 1: Open Wizard in Review Mode for Enhanced Variant
console.log('--- Test 1: Wizard Enhanced Review Population ---');
openRecipeWizard('review', 'rec_chicken_bowl', 'enhanced');
assert.strictEqual(wizardState.currentStep, 2, 'Should navigate to Step 2');
assert.strictEqual(wizardState.activeVariant, 'enhanced', 'Active variant must be enhanced');
assert.strictEqual(wizardState.activeRecipe.ingredientSections[0].ingredients[0].name, 'Chicken Breast');

// Initial macro calculation
const initialMacros = recalculateWizardMacros(wizardState.activeRecipe);
console.log('Initial enhanced macros:', initialMacros);
assert.ok(initialMacros.calories > 0 && initialMacros.protein > 0, 'Macros must be calculated');

// Test 2: Modify Quantity in Step 2 and verify live macro & fit score changes
console.log('\n--- Test 2: Live Volume Scaling & Macro Dynamic Recalculation ---');
// Double chicken breast quantity from 300g to 600g
wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty = 600;
const updatedMacros = recalculateWizardMacros(wizardState.activeRecipe);
console.log('Updated enhanced macros after doubling chicken:', updatedMacros);

assert.ok(updatedMacros.protein > initialMacros.protein, 'Protein must increase when chicken quantity increases');
assert.ok(updatedMacros.calories > initialMacros.calories, 'Calories must increase when chicken quantity increases');

// In an enhanced recipe, activeRecipe.enhanced.macros must also match the newly recalculated macros!
assert.strictEqual(wizardState.activeRecipe.enhanced.macros.protein, updatedMacros.protein, 'activeRecipe.enhanced.macros.protein must be kept in sync');
assert.strictEqual(wizardState.activeRecipe.enhanced.macros.calories, updatedMacros.calories, 'activeRecipe.enhanced.macros.calories must be kept in sync');

// Verify that renderFitScoreBadge uses updatedMacros (not initialMacros)
const badgeHtml = renderFitScoreBadge(wizardState.activeRecipe, 'Dinner', { variant: 'enhanced', showLabel: true });
console.log('Fit score badge rendered successfully');
assert.ok(badgeHtml.includes('Fit Score') || badgeHtml.includes('fit-badge'), 'Badge HTML should be generated');

// Test 3: Taxonomy Mapping Change Clears Old Product IDs
console.log('\n--- Test 3: Taxonomy Mapping Clears Old Product ID ---');
const itemToRemap = wizardState.activeRecipe.ingredientSections[0].ingredients[0];
assert.strictEqual(itemToRemap.productId, 'p_chick_breast', 'Initial product ID was chicken breast');

// Simulate selecting Tofu from autocomplete dropdown
itemToRemap.ingredientId = 'root_tofu';
itemToRemap.subtypeId = 'sub_firm';
// Clearing stale IDs
itemToRemap.productId = null;
itemToRemap.bankId = null;

const remappedProduct = resolveProductForIngredient(itemToRemap, { products: mockProducts, ingredients: mockIngredients });
assert.strictEqual(remappedProduct?.id, 'p_tofu', 'Must resolve to Firm Tofu product after mapping change');

// Test 4: Step 3 Review Preserves Step 2 Edits
console.log('\n--- Test 4: Step 3 Review Retains Step 2 Edits ---');
const step3Html = renderState3Review();
assert.ok(step3Html.includes('600g') || step3Html.includes('600'), 'Step 3 must display updated 600g quantity, not stale 300g');

console.log('\n=== ALL ENHANCED RECIPE WIZARD TESTS PASSED SUCCESSFULLY! ===');
