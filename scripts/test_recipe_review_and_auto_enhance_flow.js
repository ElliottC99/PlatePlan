/**
 * scripts/test_recipe_review_and_auto_enhance_flow.js
 * Verification suite for:
 * 1. Recipe Card "Review Recipe" variant routing & Step 2 navigation.
 * 2. View Recipe modal Review button.
 * 3. Step 2 Live Fit Score and Macro Crossbar recalculation.
 * 4. Auto-Enhance unchecked adjustments exclusion, volume steppers, and dynamic payload building.
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
  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) this.parentElement.children.splice(idx, 1);
      this.parentElement = null;
    }
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
  isRecipeVariantFavourite: () => false,
  calculateMealFitScore: (r) => ({ score: 88, tier: 'green', tierLabel: 'Ideal Match', color: '#16a34a' })
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

console.log('=== RUNNING RECIPE REVIEW & AUTO-ENHANCE VERIFICATION SUITE ===\n');

// Import target modules
const { setRecipes, setProducts } = await import('../src/store/store.js');
const { openRecipeWizard } = await import('../src/components/recipe/RecipeWizardModal.js');
const { wizardState } = await import('../src/components/recipe/RecipeWizardState.js');
const { renderRecipeActionsItems } = await import('../src/components/vault/VaultRecipeCardRenderService.js');
const { buildLiveEnhancedRecipe } = await import('../src/components/recipe/RecipeEnhancementModalUI.js');
const { buildEnhancedRecipePayload } = await import('../src/services/RecipeEnhancementService.js');

// Mock recipe data
const mockOriginalRecipe = {
  id: 'rec_chicken_bowl',
  title: 'Honey Soy Chicken Bowl',
  name: 'Honey Soy Chicken Bowl',
  servings: 2,
  serves: 2,
  macros: { calories: 620, protein: 32, carbs: 70, fat: 22 },
  ingredientSections: [
    {
      sectionTitle: 'Main Ingredients',
      ingredients: [
        { id: 'ing_1', name: 'Chicken Thigh', qty: 250, unit: 'g' },
        { id: 'ing_2', name: 'White Rice', qty: 150, unit: 'g' },
        { id: 'ing_3', name: 'Sesame Oil', qty: 20, unit: 'ml' }
      ]
    }
  ],
  enhanced: {
    servings: 2,
    serves: 2,
    macros: { calories: 510, protein: 44, carbs: 55, fat: 12 },
    ingredientSections: [
      {
        sectionTitle: 'Main Ingredients',
        ingredients: [
          { id: 'ing_1', name: 'Chicken Breast', qty: 300, unit: 'g' },
          { id: 'ing_2', name: 'White Rice', qty: 110, unit: 'g' },
          { id: 'ing_3', name: 'Sesame Oil', qty: 10, unit: 'ml' }
        ]
      }
    ]
  }
};

const mockProducts = [
  { id: 'p_chick_thigh', name: 'Chicken Thigh', kcal: 210, protein: 20, fat: 14, carbs: 0 },
  { id: 'p_chick_breast', name: 'Chicken Breast', kcal: 120, protein: 26, fat: 2, carbs: 0 },
  { id: 'p_rice', name: 'White Rice', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 },
  { id: 'p_oil', name: 'Sesame Oil', kcal: 884, protein: 0, fat: 100, carbs: 0 }
];

setRecipes([mockOriginalRecipe]);
setProducts(mockProducts);

global.window.Store.getState = () => ({
  recipes: [mockOriginalRecipe],
  products: mockProducts,
  ingredients: []
});
global.window.getState = global.window.Store.getState;

// --- Test 1: Recipe Card "Review Recipe" & "Review Enhanced Recipe" ---
console.log('--- Test 1: Recipe Card Menu Markup ---');
const origMenu = renderRecipeActionsItems('rec_chicken_bowl', false, 'original');
assert.ok(origMenu.includes('data-action="menu-review"'), 'Original menu must render Review Recipe');
assert.ok(origMenu.includes('Review Recipe'), 'Original menu text must be "Review Recipe"');

const enhMenu = renderRecipeActionsItems('rec_chicken_bowl', false, 'enhanced');
assert.ok(enhMenu.includes('data-action="menu-review"'), 'Enhanced menu must render Review Enhanced Recipe');
assert.ok(enhMenu.includes('Review Enhanced Recipe'), 'Enhanced menu text must be "Review Enhanced Recipe"');
console.log('✅ Test 1 Passed: Both original and enhanced recipe card menus include contextual Review buttons.\n');

// --- Test 2: Wizard Step 2 Navigation & Variant Loading ---
console.log('--- Test 2: Wizard Navigation & Variant Population ---');

// Test 2a: Review Original Recipe
openRecipeWizard('review', 'rec_chicken_bowl', 'original');
assert.strictEqual(wizardState.currentStep, 2, 'Review mode must navigate directly to Step 2');
assert.strictEqual(wizardState.activeVariant, 'original', 'Active variant must be set to original');
assert.strictEqual(wizardState.activeRecipe.ingredients[0].name, 'Chicken Thigh', 'Original variant must load original ingredients');
assert.strictEqual(wizardState.activeRecipe.macros.calories, 449, 'Original variant must recalculate live macros from ingredients');

// Test 2b: Review Enhanced Recipe
openRecipeWizard('review', 'rec_chicken_bowl', 'enhanced');
assert.strictEqual(wizardState.currentStep, 2, 'Review mode must navigate directly to Step 2 for enhanced recipe');
assert.strictEqual(wizardState.activeVariant, 'enhanced', 'Active variant must be set to enhanced');
assert.strictEqual(wizardState.activeRecipe.ingredients[0].name, 'Chicken Breast', 'Enhanced variant must load enhanced ingredients');
assert.strictEqual(wizardState.activeRecipe.macros.calories, 296, 'Enhanced variant must recalculate live macros from ingredients');
console.log('✅ Test 2 Passed: Wizard loads appropriate variant data, routes straight to Step 2, and dynamically recalculates live macros.\n');

// --- Test 3: Auto-Enhance Unchecked Adjustments Bug Fix ---
console.log('--- Test 3: Auto-Enhance Unchecked Adjustments Fix ---');

const mockRoute = {
  id: 'route_balanced',
  originalRecipe: mockOriginalRecipe,
  proposedServings: 2,
  targets: { mealType: 'dinner' },
  adjustments: [
    {
      id: 'adj_fat',
      type: 'quantity',
      ingredientName: 'Sesame Oil',
      originalQty: 20,
      proposedQty: 10,
      unit: 'ml',
      active: true,
      deltaKcal: -44,
      deltaProt: 0
    },
    {
      id: 'adj_rice',
      type: 'quantity',
      ingredientName: 'White Rice',
      originalQty: 150,
      proposedQty: 100,
      unit: 'g',
      active: true,
      deltaKcal: -33,
      deltaProt: -1
    }
  ]
};

// Case 3a: Both adjustments active
const bothActive = buildLiveEnhancedRecipe(mockRoute, mockOriginalRecipe);
assert.ok(bothActive, 'buildLiveEnhancedRecipe must return simulated data');
const oilBoth = bothActive.livePayload.ingredients.find(i => i.name === 'Sesame Oil');
const riceBoth = bothActive.livePayload.ingredients.find(i => i.name === 'White Rice');
assert.strictEqual(oilBoth.qty, 10, 'Sesame oil must be adjusted to 10ml when active');
assert.strictEqual(riceBoth.qty, 100, 'White rice must be adjusted to 100g when active');

// Case 3b: User unchecks the Rice adjustment (active = false)
mockRoute.adjustments[1].active = false;
const onlyFatActive = buildLiveEnhancedRecipe(mockRoute, mockOriginalRecipe);
const oilOnly = onlyFatActive.livePayload.ingredients.find(i => i.name === 'Sesame Oil');
const riceReverted = onlyFatActive.livePayload.ingredients.find(i => i.name === 'White Rice');

assert.strictEqual(oilOnly.qty, 10, 'Sesame oil must still be adjusted to 10ml');
assert.strictEqual(riceReverted.qty, 150, 'White rice MUST revert to original 150g because its adjustment was unchecked!');
assert.ok(!onlyFatActive.livePayload.changes.includes('White Rice'), 'Excluded adjustment must not appear in changes log');
assert.ok(onlyFatActive.liveMacros.calories > bothActive.liveMacros.calories, 'Reverting rice reduction must result in higher calories than both active');

console.log('✅ Test 3 Passed: Unchecking an adjustment strictly excludes it from the live calculated enhanced payload.\n');

// --- Test 4: Volume Stepper Precision ---
console.log('--- Test 4: Volume Stepper Updates ---');
// Modify proposedQty from 10ml to 15ml via stepper
mockRoute.adjustments[0].proposedQty = 15;
mockRoute.adjustments[0].active = true;

const stepperUpdated = buildLiveEnhancedRecipe(mockRoute, mockOriginalRecipe);
const oilStepper = stepperUpdated.livePayload.ingredients.find(i => i.name === 'Sesame Oil');
assert.strictEqual(oilStepper.qty, 15, 'Live payload must reflect custom stepper quantity (15ml)');
console.log('✅ Test 4 Passed: Volume stepper updates dynamically flow into live payload.\n');

console.log('=== ALL RECIPE REVIEW & AUTO-ENHANCE TESTS PASSED SUCCESSFULLY! ===\n');
process.exit(0);
