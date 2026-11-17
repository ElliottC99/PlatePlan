/**
 * scripts/test_recipe_wizard_qty_gate.js
 * Verification suite for Recipe Wizard Step 2 Invalid-qty Gate & Inline Quick-Fix Banner (U4).
 */

import assert from 'node:assert/strict';

if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}
if (typeof global.window === 'undefined') {
  global.window = {
    localStorage: global.localStorage,
    dispatchEvent: () => {}
  };
}
if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: () => {},
    dispatchEvent: () => {}
  };
}

const { setIngredients, setProducts, getState } = await import('../src/store/store.js');
const { wizardState } = await import('../src/components/recipe/RecipeWizardState.js');
const { getIngredientQtyValidationIssue } = await import('../src/components/recipe/RecipeWizardTaxonomySearch.js');
const { renderStep2Footer, renderState2Mapping, renderQtyIssueBannerHTML } = await import('../src/components/recipe/RecipeWizardStep2View.js');
const { bindStep2Events } = await import('../src/components/recipe/RecipeWizardStep2Handlers.js');
const { parseIngredientString } = await import('../src/services/RecipeIngredientParser.js');
const { calculateItemNutrition } = await import('../src/services/NutritionService.js');

console.log('=== RUNNING RECIPE WIZARD STEP 2 QTY VALIDATION GATE SUITE ===\n');

const mockIngredients = [
  { id: 'ing_yog', name: 'Natural Yoghurt', category: 'Dairy & Eggs', defaultProductId: 'prod_yog', subtypes: [] },
  { id: 'ing_courgette', name: 'Courgette', category: 'Fruit & Vegetables', defaultProductId: 'prod_courgette', subtypes: [] },
  { id: 'ing_bay', name: 'Bay Leaves', category: 'Herbs & Spices', defaultProductId: 'prod_bay', subtypes: [] },
  { id: 'ing_garlic', name: 'Garlic', category: 'Fruit & Vegetables', defaultProductId: 'prod_garlic', subtypes: [] }
];

const mockProducts = [
  { id: 'prod_yog', name: 'Tesco Natural Yoghurt 500G', ingredientId: 'ing_yog', packSize: 500, packUnit: 'g', itemWeight: null, cal: 65, prot: 5.2, isAutoDefault: true },
  { id: 'prod_courgette', name: 'Tesco Courgettes 500G', ingredientId: 'ing_courgette', packSize: 500, packUnit: 'g', itemWeight: null, cal: 20, prot: 1.2, isAutoDefault: true },
  { id: 'prod_bay', name: 'Tesco Bay Leaves 5G', ingredientId: 'ing_bay', packSize: 5, packUnit: 'g', itemWeight: null, cal: 313, prot: 7.6, isAutoDefault: true },
  { id: 'prod_garlic', name: 'Tesco Garlic 4 Pack', ingredientId: 'ing_garlic', packSize: 200, packUnit: 'g', itemWeight: null, cal: 149, prot: 6.4, isAutoDefault: true }
];

setIngredients(mockIngredients);
setProducts(mockProducts);

// Test 1: getIngredientQtyValidationIssue detects bulk item in qty
console.log('--- Test 1: Non-Discrete Bulk Item in qty ---');
assert.strictEqual(typeof getIngredientQtyValidationIssue, 'function', 'getIngredientQtyValidationIssue must be exported');
const yogIssue = getIngredientQtyValidationIssue(
  { name: 'Natural Yoghurt', qty: 1, unit: 'qty', ingredientId: 'ing_yog' },
  mockProducts,
  mockIngredients
);
assert.strictEqual(yogIssue.invalid, true, '1 qty Natural Yoghurt must be flagged as invalid');
assert.strictEqual(yogIssue.reason, 'bulk_item_in_qty');
console.log('✅ Test 1 Passed: Bulk item in qty flagged with bulk_item_in_qty.\n');

// Test 2: Discrete item in qty mapped to product without itemWeight
console.log('--- Test 2: Discrete Item in qty Mapped to Product Missing itemWeight ---');
const courgetteIssue = getIngredientQtyValidationIssue(
  { name: 'Courgette', qty: 2, unit: 'qty', ingredientId: 'ing_courgette' },
  mockProducts,
  mockIngredients
);
assert.strictEqual(courgetteIssue.invalid, true, '2 qty Courgette mapped to 500g pack without itemWeight must be flagged');
assert.strictEqual(courgetteIssue.reason, 'missing_product_item_weight');
assert.strictEqual(courgetteIssue.resolvedProd?.id, 'prod_courgette');
console.log('✅ Test 2 Passed: Missing product itemWeight flagged accurately.\n');

// Test 3: Self-weighed culinary counts (Bay Leaves, Garlic) are allowed in qty
console.log('--- Test 3: Self-Weighed Culinary Staples Allowed in qty ---');
const bayIssue = getIngredientQtyValidationIssue(
  { name: 'Bay Leaves', qty: 2, unit: 'qty', ingredientId: 'ing_bay' },
  mockProducts,
  mockIngredients
);
assert.strictEqual(bayIssue.invalid, false, '2 qty Bay Leaves is valid without product itemWeight');

const garlicIssue = getIngredientQtyValidationIssue(
  { name: 'Garlic Cloves', qty: 3, unit: 'qty', ingredientId: 'ing_garlic' },
  mockProducts,
  mockIngredients
);
assert.strictEqual(garlicIssue.invalid, false, '3 qty Garlic Cloves is valid without product itemWeight');
console.log('✅ Test 3 Passed: Self-weighed culinary staples allowed in qty.\n');

// Test 4: Step 2 Footer Gate Blocks & Row Renders Inline Quick-Fix Banner
console.log('--- Test 4: Step 2 Footer Gate & Inline Resolution Banner ---');
wizardState.currentStep = 2;
wizardState.activeRecipe = {
  title: 'Courgette & Yoghurt Flatbreads',
  servings: 2,
  mealSuitability: ['Dinner'],
  ingredientSections: [
    {
      sectionTitle: 'Main Ingredients',
      ingredients: [
        { name: 'Natural Yoghurt', raw: '1 natural yoghurt', qty: 1, unit: 'qty', ingredientId: 'ing_yog' },
        { name: 'Courgette', raw: '2 courgettes', qty: 2, unit: 'qty', ingredientId: 'ing_courgette' }
      ]
    }
  ],
  methodSteps: ['Mix and cook.']
};

const footerBlockedHtml = renderStep2Footer();
assert(footerBlockedHtml.includes('disabled'), 'Footer Next button must be disabled when qty issues exist');
assert(footerBlockedHtml.includes('wiz-gate-pill blocked'), 'Gate pill must have blocked class');

const step2Html = renderState2Mapping();
assert(step2Html.includes('wiz-row-invalid-qty'), 'Step 2 table must mark invalid qty rows with wiz-row-invalid-qty');
assert(step2Html.includes('wiz-qty-issue-banner'), 'Step 2 row must render inline .wiz-qty-issue-banner');
assert(step2Html.includes('wiz-quick-switch-unit-btn'), 'Banner must include quick unit switch buttons');
assert(step2Html.includes('wiz-save-inline-item-weight-btn'), 'Banner for missing_product_item_weight must include inline product itemWeight save button');

// Simulate resolving both issues: switch yoghurt to 'g' and set courgette product itemWeight to 180g
wizardState.activeRecipe.ingredientSections[0].ingredients[0].unit = 'g';
wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty = 150;
mockProducts[1].itemWeight = 180;
setProducts([...mockProducts]);

const footerReadyHtml = renderStep2Footer();
assert(!footerReadyHtml.includes('disabled'), 'Footer Next button must be enabled once qty issues are resolved');
assert(footerReadyHtml.includes('wiz-gate-pill ready'), 'Gate pill must transition to ready');
console.log('✅ Test 4 Passed: Step 2 gate blocks on invalid qty and clears when resolved.\n');

// Test 5: bindStep2Events Aborts Prior Listeners & Updates Unit Changes In-Place Without Full Modal Rebuild
console.log('--- Test 5: AbortController Listener Cleanup & In-Place Unit Update ---');
assert.strictEqual(typeof renderQtyIssueBannerHTML, 'function', 'renderQtyIssueBannerHTML must be exported');

const activeListeners = [];
const mockModalWrap = {
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: (type, fn, opts) => {
    const entry = { type, fn, aborted: false };
    if (opts?.signal) {
      opts.signal.addEventListener('abort', () => { entry.aborted = true; });
    }
    activeListeners.push(entry);
  }
};

let modalRebuildCount = 0;
const mockRenderWizardModal = () => { modalRebuildCount++; };

// Bind Step 2 events 3 times consecutively (simulating 3 re-renders)
bindStep2Events(mockModalWrap, { renderWizardModal: mockRenderWizardModal, showWizardNotice: () => {} });
bindStep2Events(mockModalWrap, { renderWizardModal: mockRenderWizardModal, showWizardNotice: () => {} });
bindStep2Events(mockModalWrap, { renderWizardModal: mockRenderWizardModal, showWizardNotice: () => {} });

const liveChangeListeners = activeListeners.filter(l => l.type === 'change' && !l.aborted);
const liveInputListeners = activeListeners.filter(l => l.type === 'input' && !l.aborted);
assert.strictEqual(liveChangeListeners.length, 1, 'Only 1 change listener should remain active after multiple bindStep2Events calls');
assert.strictEqual(liveInputListeners.length, 2, 'Only 2 input listeners (table inputs + step textarea auto-fit) should remain active');

// Trigger a unit change on row 0,0 via the active change listener and verify renderWizardModal is NOT called
liveChangeListeners[0].fn({
  target: {
    matches: (sel) => sel === '.wiz-ing-unit',
    dataset: { sidx: '0', iidx: '0' },
    value: 'ml'
  }
});
assert.strictEqual(modalRebuildCount, 0, 'Changing a unit must update in-place without calling renderWizardModal()');
assert.strictEqual(wizardState.activeRecipe.ingredientSections[0].ingredients[0].unit, 'ml', 'Row unit must update to ml in state');
console.log('✅ Test 5 Passed: Listeners are cleaned up via AbortController and unit changes update in-place.\n');

// Test 6: Garlic cloves stay qty=3 in Step 2 without missing-itemWeight warning, and weigh 6g/clove in nutrition
const parsedCloves = parseIngredientString('3 cloves garlic');
assert.strictEqual(parsedCloves.qty, 3);
assert.strictEqual(parsedCloves.unit, 'qty');
assert.strictEqual(parsedCloves.isCloveCount, true);
assert.strictEqual(parsedCloves.name, 'Garlic');

const garlicRoot = { id: 'ing_garlic', name: 'Garlic', subtypes: [] };
const garlicBulb = { id: 'prod_garlic_bulb', name: 'Garlic Bulb 65g', ingredientId: 'ing_garlic', itemWeight: 65, kcal: 150, protein: 6.4, carbs: 33, fat: 0.5 };
const garlicNoWeight = { id: 'prod_garlic_noweight', name: 'Garlic Loose', ingredientId: 'ing_garlic', itemWeight: null, kcal: 150, protein: 6.4, carbs: 33, fat: 0.5 };

const cloveIssue = getIngredientQtyValidationIssue(
  { ...parsedCloves, ingredientId: 'ing_garlic' },
  [garlicNoWeight],
  [garlicRoot]
);
assert.strictEqual(cloveIssue.invalid, false, 'Garlic cloves in qty must not trigger missing itemWeight gate');

const cloveNutrition = calculateItemNutrition(garlicBulb, 3, 'qty', { isCloveCount: true });
assert.strictEqual(cloveNutrition.kcal, Math.round(150 * 0.18), '3 cloves must weigh 18g (6g/clove), ignoring 65g whole-bulb itemWeight');
console.log('✅ Test 6 Passed: Garlic cloves stay qty without warning and weigh 6g/clove in nutrition.\n');

console.log('🎉 ALL RECIPE WIZARD STEP 2 QTY VALIDATION GATE TESTS PASSED!');
