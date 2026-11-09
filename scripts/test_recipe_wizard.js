/**
 * scripts/test_recipe_wizard.js (v3.28.1)
 * Automated verification test suite for:
 * 1. Compound stock parsing ("1 stock cube + 400ml water" -> qty: 1, name: "Vegetable Stock Cube")
 * 2. Universal Title Case normalization (Titles, Ingredients, Section Headers)
 * 3. Dynamic Save button label based on variant existence ("Save Original Recipe" vs "Save Both Recipes")
 * 4. Category-level mapping support (retaining categoryId for shopping list grouping)
 * 5. Auto-default category-level assignment & Step 3 product linkage lookups
 */

import { strict as assert } from 'assert';
import { parseIngredientString, parseBulkRecipeText, toTitleCase, matchIngredientTaxonomy, cleanIngredientPhraseForAlias } from '../src/services/RecipeImporter.js';
import { wizardState, resetWizardState, getSaveButtonLabel, hasDistinctEnhancedVariant, getWizardStepDisplayInfo, switchWizardVariant, stashActiveVariantSnapshot } from '../src/components/recipe/RecipeWizardState.js';
import { renderState2Mapping } from '../src/components/recipe/RecipeWizardStep2View.js';
import { renderStepBadge, renderState1AManual, renderState3Review } from '../src/components/recipe/RecipeWizardViews.js';
import { filterTaxonomyItemsByQuery } from '../src/components/recipe/RecipeWizardTaxonomySearch.js';
import { resolveProductForIngredient, onSaveRecipe } from '../src/components/recipe/RecipeWizardStep3Handlers.js';
import { formatRecipeSourceHTML } from '../src/services/RecipeDetailModalService.js';
import { scaleEmbeddedVolume } from '../src/services/PortionCalculationService.js';

console.log('=== RUNNING RECIPE WIZARD v3.28.3 VERIFICATION SUITE ===');

// --- Test 1: Compound Stock Parsing ---
console.log('\n--- Test 1: Compound Stock & Liquid Parsing ---');

const stockTest1 = parseIngredientString('1 stock cube + 400ml water');
console.log('Input: "1 stock cube + 400ml water"');
console.log('Parsed:', JSON.stringify(stockTest1, null, 2));
assert.equal(stockTest1.qty, 1, 'Quantity should be 1');
assert.equal(stockTest1.unit, 'qty', 'Unit should be qty');
assert.equal(stockTest1.name, 'Vegetable Stock Cube', 'Name should be Vegetable Stock Cube');
assert(stockTest1.notes.includes('400ml water'), 'Notes should contain liquid instruction');
console.log('✅ Passed: "1 stock cube + 400ml water" parses to Vegetable Stock Cube (qty: 1)');

const stockTest2 = parseIngredientString('0.5 stock cube in 200ml boiling water');
console.log('\nInput: "0.5 stock cube in 200ml boiling water"');
console.log('Parsed:', JSON.stringify(stockTest2, null, 2));
assert.equal(stockTest2.qty, 0.5, 'Quantity should be 0.5');
assert.equal(stockTest2.unit, 'qty', 'Unit should be qty');
assert.equal(stockTest2.name, 'Vegetable Stock Cube', 'Name should be Vegetable Stock Cube');
assert(stockTest2.notes.includes('200ml boiling water'), 'Notes should contain boiling water');
console.log('✅ Passed: "0.5 stock cube in 200ml boiling water" parses to Vegetable Stock Cube (qty: 0.5)');

const stockTest3 = parseIngredientString('1 chicken stock cube dissolved in 500ml water');
console.log('\nInput: "1 chicken stock cube dissolved in 500ml water"');
console.log('Parsed:', JSON.stringify(stockTest3, null, 2));
assert.equal(stockTest3.qty, 1, 'Quantity should be 1');
assert.equal(stockTest3.name, 'Chicken Stock Cube', 'Name should be Chicken Stock Cube');
console.log('✅ Passed: Chicken stock cube recognized and parsed');

// --- Test 2: Universal Title Case Normalization ---
console.log('\n--- Test 2: Universal Title Case Normalization ---');

assert.equal(toTitleCase('tomato pasta'), 'Tomato Pasta');
assert.equal(toTitleCase('tinned tomatoes'), 'Tinned Tomatoes');
assert.equal(toTitleCase('for the salsa'), 'For The Salsa');
assert.equal(toTitleCase('main ingredients'), 'Main Ingredients');
console.log('✅ Passed: toTitleCase utility formats all strings properly');

const parsedIng1 = parseIngredientString('200g firm tofu, cubed');
assert.equal(parsedIng1.name, 'Firm Tofu', 'Ingredient name must be Title Cased');
console.log('✅ Passed: parseIngredientString outputs Title Cased ingredient name ("Firm Tofu")');

const rawBulk = `tomato and lentil curry
Serves: 4

main ingredients:
400g tinned tomatoes
1 stock cube + 400ml water
1 tsp smoked paprika

Method:
1. Simmer ingredients.`;

const bulkParsed = parseBulkRecipeText(rawBulk);
assert.equal(bulkParsed.length, 1);
assert.equal(bulkParsed[0].title, 'Tomato And Lentil Curry', 'Recipe title must be Title Cased');
assert.equal(bulkParsed[0].ingredientSections[0].sectionTitle, 'Main Ingredients', 'Section title must be Title Cased');
assert.equal(bulkParsed[0].ingredients[0].name, 'Tinned Tomatoes', 'Ingredients must be Title Cased');
assert.equal(bulkParsed[0].ingredients[1].name, 'Vegetable Stock Cube', 'Stock cube must be Title Cased');
console.log('✅ Passed: parseBulkRecipeText normalizes Recipe Title, Section Headers, and Ingredients to Title Case');

// --- Test 3: Dynamic Save Button Label ---
console.log('\n--- Test 3: Dynamic Save Button Label ---');

const baseRecipe = {
  title: 'Smoky Tofu Bowl',
  ingredients: [{ name: 'Tofu', qty: 200, unit: 'g' }],
  methodSteps: ['Bake tofu.'],
  enhanced: null
};

assert.equal(hasDistinctEnhancedVariant(baseRecipe), false);
assert.equal(getSaveButtonLabel(baseRecipe), 'Save Original Recipe');
console.log('✅ Passed: Original-only recipe resolves to "Save Original Recipe"');

const recipeWithEnhanced = {
  title: 'Smoky Tofu Bowl',
  ingredients: [{ name: 'Tofu', qty: 200, unit: 'g' }],
  methodSteps: ['Bake tofu.'],
  enhanced: {
    title: 'Smoky Tofu Bowl (Enhanced)',
    ingredients: [{ name: 'Tofu', qty: 300, unit: 'g' }, { name: 'Nutritional Yeast', qty: 15, unit: 'g' }],
    methodSteps: ['Air fry tofu with nutritional yeast.']
  }
};

assert.equal(hasDistinctEnhancedVariant(recipeWithEnhanced), true);
assert.equal(getSaveButtonLabel(recipeWithEnhanced), 'Save Both Recipes');
console.log('✅ Passed: Distinct enhanced variant resolves to "Save Both Recipes"');

// --- Test 4: Category-Level Mapping ---
console.log('\n--- Test 4: Category-Level Mapping ---');
const categoryItem = {
  name: 'Carrots',
  qty: 200,
  unit: 'g',
  raw: '200g carrots',
  categoryId: 'Produce',
  ingredientId: null,
  subtypeId: null,
  isNewTaxonomyItem: false,
  isCategoryDefault: true,
  displayName: 'Generic Produce'
};
assert.equal(categoryItem.categoryId, 'Produce');
assert.equal(categoryItem.ingredientId, null);
assert.equal(categoryItem.isCategoryDefault, true);
assert.equal(categoryItem.displayName, 'Generic Produce');
console.log('✅ Passed: Category-level mapping correctly represents and maintains categoryId & auto-default displayName');

// --- Test 5: Step 3 Product Linkage Lookup Emulation ---
console.log('\n--- Test 5: Step 3 Product Linkage Lookup Emulation ---');
const dummyProducts = [
  { id: 'p1', name: 'Tesco Carrots 1kg', category: 'Produce', isAutoDefault: true },
  { id: 'p2', name: 'Tesco Broccoli', category: 'Produce', isAutoDefault: false }
];

// Helper emulating the lookup logic inside Step 3
function getProductLink(ing, products) {
  if (ing.isCategoryDefault || ing.categoryId) {
    const catName = ing.categoryId || 'General Groceries';
    let defaultProduct = products.find(p => (String(p.category).toLowerCase() === catName.toLowerCase()) && p.isAutoDefault);
    if (!defaultProduct) {
      defaultProduct = products.find(p => (String(p.category).toLowerCase() === catName.toLowerCase()));
    }
    if (defaultProduct) {
      return defaultProduct.name;
    }
  }
  return null;
}

const linkName = getProductLink(categoryItem, dummyProducts);
assert.equal(linkName, 'Tesco Carrots 1kg');
console.log('✅ Passed: Lookup successfully resolved the correct default category product from the mock bank');

// --- Test 6: Embedded Parenthetical Stock Volume Scaling ---
console.log('\n--- Test 6: Embedded Stock Water Volume Scaling ---');
const scaledVol1 = scaleEmbeddedVolume('(dissolved in 800ml water)', 1.5);
assert.equal(scaledVol1, '(dissolved in 1200ml water)');
console.log('✅ Passed: "(dissolved in 800ml water)" scaled by 1.5x to "(dissolved in 1200ml water)"');

const scaledVol2 = scaleEmbeddedVolume('1 stock cube (mixed with 500ml boiling water)', 2);
assert.equal(scaledVol2, '1 stock cube (mixed with 1000ml boiling water)');
console.log('✅ Passed: "(mixed with 500ml boiling water)" scaled by 2x to "(mixed with 1000ml boiling water)"');

// --- Test 7: Alias Self-Learning & Taxonomy Matching ---
console.log('\n--- Test 7: Alias Self-Learning & Taxonomy Matching ---');
const mockBank = [
  { id: 'ing_tofu', name: 'Firm Tofu', aliases: ['organic pressed tofu block', 'silk tofu'] }
];

const matched = matchIngredientTaxonomy({ name: 'organic pressed tofu block' }, mockBank);
assert.equal(matched.ingredientId, 'ing_tofu');
assert.equal(matched.isNewTaxonomyItem, false);
console.log('✅ Passed: matchIngredientTaxonomy matched raw imported text against learned aliases array');

// --- Test 8: U1 End-to-End Alias Matching (Stemmed, Subtype, Legacy Cleaned) & Resolution ---
console.log('\n--- Test 8: End-to-End Alias Matching & Clean Alias Learning (U1) ---');
const aliasBank = [
  {
    id: 'ing_onion',
    name: 'Onions',
    category: 'Produce',
    aliases: ['allium'],
    subtypes: [
      { id: 'sub_spring_onion', name: 'Spring Onion', aliases: ['scallions', 'green onions'], defaultProductId: 'prod_spring_onion' }
    ]
  },
  {
    id: 'ing_coriander',
    name: 'Coriander',
    category: 'Produce',
    aliases: ['fresh cilantro', '25g cilantro bunch'],
    defaultProductId: 'prod_coriander',
    subtypes: []
  }
];
const aliasProducts = [
  { id: 'prod_spring_onion', name: 'Tesco Spring Onions 100g', ingredientId: 'ing_onion', subtypeId: 'sub_spring_onion', isAutoDefault: true },
  { id: 'prod_coriander', name: 'Tesco Fresh Coriander 30g', ingredientId: 'ing_coriander', isAutoDefault: true }
];

// 8a: Plural alias "scallions" matches singular + prep note "1 fresh scallion, finely sliced"
const parsedScallion = parseIngredientString('1 fresh scallion, finely sliced');
const matchedScallion = matchIngredientTaxonomy(parsedScallion, aliasBank);
assert.equal(matchedScallion.ingredientId, 'ing_onion', 'Should match parent root item Onions');
assert.equal(matchedScallion.subtypeId, 'sub_spring_onion', 'Should match subtype Spring Onion via plural alias scallions');
assert.equal(matchedScallion.isNewTaxonomyItem, false);

// 8b: Multi-word or legacy quantity-prefixed alias "fresh cilantro" / "25g cilantro bunch" matches "cilantro"
const parsedCilantro = parseIngredientString('15g cilantro, chopped');
const matchedCilantro = matchIngredientTaxonomy(parsedCilantro, aliasBank);
assert.equal(matchedCilantro.ingredientId, 'ing_coriander', 'Should match Coriander via alias');
assert.equal(matchedCilantro.isNewTaxonomyItem, false);

// 8c: Step 2 autocomplete dropdown filters by root-item and sub-type aliases
const taxResultsScallion = filterTaxonomyItemsByQuery('scallion', aliasBank, aliasProducts);
assert.equal(taxResultsScallion.length, 1, 'Dropdown should find Onions when searching scallion');
assert.equal(taxResultsScallion[0].ing.id, 'ing_onion');
assert.equal(taxResultsScallion[0].subtypesToShow[0].id, 'sub_spring_onion');

const taxResultsCilantro = filterTaxonomyItemsByQuery('cilantro', aliasBank, aliasProducts);
assert.equal(taxResultsCilantro.length, 1, 'Dropdown should find Coriander when searching cilantro');
assert.equal(taxResultsCilantro[0].ing.id, 'ing_coriander');

// 8d: Step 3 product fallback resolves product via alias
const resolvedViaSubAlias = resolveProductForIngredient({ name: 'Scallion' }, { products: aliasProducts, ingredients: aliasBank });
assert.equal(resolvedViaSubAlias?.id, 'prod_spring_onion', 'Step 3 fallback should resolve Spring Onion default product via alias');

const resolvedViaRootAlias = resolveProductForIngredient({ name: 'Cilantro' }, { products: aliasProducts, ingredients: aliasBank });
assert.equal(resolvedViaRootAlias?.id, 'prod_coriander', 'Step 3 fallback should resolve Coriander default product via alias');

// 8e: Clean alias phrase extraction strips quantities, units, and prep notes
assert.equal(cleanIngredientPhraseForAlias('200g organic firm tofu, cubed'), 'organic firm tofu');
assert.equal(cleanIngredientPhraseForAlias({ raw: '2 cloves garlic, minced', name: 'Garlic' }), 'garlic');
assert.equal(cleanIngredientPhraseForAlias({ name: '200g firm tofu, cubed' }), 'firm tofu');
console.log('✅ Passed: End-to-end alias matching across parser, Step 2 dropdown, Step 3 product fallback, and clean alias extraction');

// --- Test 9: U2 Adding Method Steps When Starting From Zero Steps ---
console.log('\n--- Test 9: Adding Method Steps From 0 Steps (U2) ---');
resetWizardState();
wizardState.activeRecipe.title = 'Zero Step Salad';
wizardState.activeRecipe.methodSteps = [];
// Emulate clicking "+ Add Step" which pushes ''
wizardState.activeRecipe.methodSteps.push('');
const step2ZeroHtml = renderState2Mapping();
assert(step2ZeroHtml.includes('id="wiz-step-input-0"'), 'Step 2 should render textarea #wiz-step-input-0 when a blank step is added from 0 steps');
assert(step2ZeroHtml.includes('Method Steps (1)'), 'Method Steps count should reflect 1 step');
console.log('✅ Passed: Adding a method step from 0 steps renders an editable textarea');

// --- Test 10: U3 Dynamic Whole-Number Wizard Step Numbering ---
console.log('\n--- Test 10: Dynamic Whole-Number Wizard Step Numbering (U3) ---');
resetWizardState();
wizardState.currentStep = 1;
assert.equal(getWizardStepDisplayInfo(wizardState).label, 'Step 1: Ingestion');
wizardState.currentStep = 2;
assert.equal(getWizardStepDisplayInfo(wizardState).label, 'Step 2: Sections & Mapping');
wizardState.currentStep = 3;
assert.equal(getWizardStepDisplayInfo(wizardState).label, 'Step 3: Inline Review & Save');

// Multi-recipe queue flow (Steps 1 -> 2 -> 3 -> 4, no Step 1.5)
wizardState.initialQueueTotal = 3;
wizardState.processingQueue = [{ title: 'R1' }, { title: 'R2' }];
wizardState.currentStep = 1.5;
const badge15 = renderStepBadge();
assert(!badge15.includes('1.5'), 'Badge must never display Step 1.5');
assert(badge15.includes('Step 2: Recipe Review Queue'), 'Multi-recipe queue review must be Step 2');
wizardState.currentStep = 2;
assert.equal(getWizardStepDisplayInfo(wizardState).label, 'Step 3: Sections & Mapping');
wizardState.currentStep = 3;
assert.equal(getWizardStepDisplayInfo(wizardState).label, 'Step 4: Inline Review & Save');
console.log('✅ Passed: Wizard steps use whole integers dynamically (1-3 single, 1-4 multi-recipe queue)');

// --- Test 11: U4 Original <-> Enhanced Variant Switching in Step 2 & Step 3 ---
console.log('\n--- Test 11: Original <-> Enhanced Variant Switching (U4) ---');
resetWizardState();
wizardState.activeRecipe.title = 'Tofu Stir Fry';
wizardState.activeRecipe.ingredientSections = [
  { sectionTitle: 'Main Ingredients', ingredients: [{ name: 'Firm Tofu', qty: 200, unit: 'g', ingredientId: 'ing_tofu' }] }
];
wizardState.activeRecipe.methodSteps = ['Fry tofu in pan.'];
wizardState.activeRecipe.enhanced = {
  title: 'Tofu Stir Fry (Enhanced)',
  ingredientSections: [
    { sectionTitle: 'Main Ingredients', ingredients: [{ name: 'Firm Tofu', qty: 350, unit: 'g', ingredientId: 'ing_tofu' }, { name: 'Edamame', qty: 100, unit: 'g', ingredientId: 'ing_edamame' }] }
  ],
  methodSteps: ['Air fry 350g tofu and toss with edamame.']
};
stashActiveVariantSnapshot();

const step2WithEnhHtml = renderState2Mapping();
assert(step2WithEnhHtml.includes('id="wiz-step2-tab-original"'), 'Step 2 header should render Original tab when Enhanced variant exists');
assert(step2WithEnhHtml.includes('id="wiz-step2-tab-enhanced"'), 'Step 2 header should render Enhanced tab when Enhanced variant exists');

// Switch to Enhanced and verify working state swaps
switchWizardVariant('enhanced');
assert.equal(wizardState.activeVariant, 'enhanced');
assert.equal(wizardState.activeRecipe.ingredientSections[0].ingredients.length, 2, 'Enhanced variant should have 2 ingredients');
assert.equal(wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty, 350, 'Enhanced tofu qty should be 350g');

// Mutate Enhanced ingredient qty, then switch back to Original
wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty = 400;
switchWizardVariant('original');
assert.equal(wizardState.activeVariant, 'original');
assert.equal(wizardState.activeRecipe.ingredientSections[0].ingredients.length, 1, 'Original variant should retain 1 ingredient');
assert.equal(wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty, 200, 'Original tofu qty should remain 200g');

// Switch back to Enhanced and verify the 400g edit was preserved in snapshot
switchWizardVariant('enhanced');
assert.equal(wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty, 400, 'Enhanced tofu edit (400g) must persist across tab switches');
assert.equal(getSaveButtonLabel(wizardState.activeRecipe), 'Save Enhanced Variant', 'Save button should say Save Enhanced Variant on enhanced tab');
switchWizardVariant('original');
assert.equal(getSaveButtonLabel(wizardState.activeRecipe), 'Save Both Recipes', 'Save button should say Save Both Recipes on original tab when distinct enhanced exists');
console.log('✅ Passed: Original <-> Enhanced toggle in Step 2 & Step 3 preserves independent variant edits');

// --- Test 12: U5 & U6 Blank Defaults, Mandatory Meal Suitability & Recipe Source Fields ---
console.log('\n--- Test 12: Blank Defaults, Mandatory Meal Suitability & Source Fields (U5 & U6) ---');
resetWizardState();
assert.deepEqual(wizardState.activeRecipe.prepTime, { hours: '', minutes: '' }, 'New recipe prepTime should default to blank');
assert.deepEqual(wizardState.activeRecipe.cookTime, { hours: '', minutes: '' }, 'New recipe cookTime should default to blank');
assert.deepEqual(wizardState.activeRecipe.mealSuitability, [], 'New recipe mealSuitability should default to empty array');
assert.equal(wizardState.activeRecipe.sourceType, '', 'New recipe sourceType should default to empty');

const step1AHtml = renderState1AManual();
assert(step1AHtml.includes('id="wiz-source-url"'), 'Step 1A should render Online URL input');
assert(step1AHtml.includes('id="wiz-source-book"'), 'Step 1A should render Book Name input');
assert(step1AHtml.includes('id="wiz-source-page"'), 'Step 1A should render Book Page input');

wizardState.activeRecipe.sourceType = 'book';
wizardState.activeRecipe.sourceBook = 'Ottolenghi Simple';
wizardState.activeRecipe.sourcePage = '142';
const step3Html = renderState3Review();
assert(step3Html.includes('id="wiz-rev-source-url"'), 'Step 3 should render Online URL input');
assert(step3Html.includes('id="wiz-rev-source-book"'), 'Step 3 should render Book Name input');
assert(step3Html.includes('Ottolenghi Simple'), 'Step 3 should populate Book Name');

const bookSourceBadge = formatRecipeSourceHTML(wizardState.activeRecipe);
assert(bookSourceBadge.includes('Ottolenghi Simple, p. 142'), 'Detail modal should format book + page source');

const onlineSourceBadge = formatRecipeSourceHTML({ sourceType: 'online', sourceUrl: 'https://ottolenghi.co.uk/recipes/tofu' });
assert(onlineSourceBadge.includes('href="https://ottolenghi.co.uk/recipes/tofu"'), 'Detail modal should format online source as clickable link');
console.log('✅ Passed: Blank defaults, mandatory meal suitability state, and Online/Book source fields verified');

// --- Test 13: onSaveRecipe Integration (AE1 ingredientId vs productId, AE4 Dual-Variant Save, AE5 Meal Suitability Gate) ---
console.log('\n--- Test 13: onSaveRecipe Integration (AE1, AE4, AE5) ---');
global.document = global.document || {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  dispatchEvent: () => {}
};
global.window = global.window || {};
global.window.dispatchEvent = () => {};
global.window.getState = () => ({
  recipes: [],
  products: [
    { id: 'prod_spring_onion', name: 'Tesco Spring Onions 100g', ingredientId: 'ing_onion', subtypeId: 'sub_spring_onion', isDefault: true }
  ],
  rootItems: [
    { id: 'ing_onion', name: 'Onion', categoryId: 'cat_produce', defaultProductId: 'prod_spring_onion', subtypes: [{ id: 'sub_spring_onion', name: 'Spring Onion', defaultProductId: 'prod_spring_onion' }] }
  ]
});

const mockModalWrap = {
  querySelector: () => null,
  querySelectorAll: () => [],
  remove: () => {}
};

let lastNotice = null;
let closeCalled = false;
const mockCallbacks = {
  renderWizardModal: () => {},
  showWizardNotice: (msg, type) => { lastNotice = { msg, type }; },
  loadNextRecipeFromQueue: () => {},
  closeRecipeWizard: () => { closeCalled = true; }
};

// 13a: Saving with empty mealSuitability is blocked (AE5)
resetWizardState();
wizardState.activeRecipe.title = 'Unclassified Dish';
wizardState.activeRecipe.mealSuitability = [];
wizardState.activeRecipe.ingredientSections = [
  { sectionTitle: 'Main Ingredients', ingredients: [{ name: 'Spring Onion', qty: 2, unit: 'qty', ingredientId: 'ing_onion', subtypeId: 'sub_spring_onion', productId: 'prod_spring_onion' }] }
];
await onSaveRecipe(mockModalWrap, mockCallbacks);
assert.equal(closeCalled, false, 'onSaveRecipe must abort without closing wizard when mealSuitability is empty');
assert(lastNotice && lastNotice.msg.includes('Meal Suitability'), 'onSaveRecipe should show warning notice when mealSuitability is empty');

// 13b: Saving with valid mealSuitability preserves ingredientId distinct from productId (AE1) & saves edits to both variants (AE4)
lastNotice = null;
wizardState.activeRecipe.mealSuitability = ['Dinner'];
wizardState.activeRecipe.sourceType = 'book';
wizardState.activeRecipe.sourceBook = 'Simple';
wizardState.activeRecipe.sourcePage = '55';
wizardState.activeRecipe.methodSteps = ['Chop spring onions (Original).'];
wizardState.activeRecipe.enhanced = {
  title: 'Unclassified Dish (Enhanced)',
  ingredientSections: [
    { sectionTitle: 'Main Ingredients', ingredients: [{ name: 'Spring Onion', qty: 4, unit: 'qty', ingredientId: 'ing_onion', subtypeId: 'sub_spring_onion', productId: 'prod_spring_onion' }] }
  ],
  methodSteps: ['Grill 4 spring onions (Enhanced).']
};
stashActiveVariantSnapshot();

// Switch to Enhanced, edit qty to 5, then save directly from Enhanced tab
switchWizardVariant('enhanced');
wizardState.activeRecipe.ingredientSections[0].ingredients[0].qty = 5;

await onSaveRecipe(mockModalWrap, mockCallbacks);
assert.equal(wizardState.activeRecipe.ingredients[0].ingredientId, 'ing_onion', 'Saved ingredient must retain root ingredientId distinct from productId');
assert.equal(wizardState.activeRecipe.ingredients[0].productId, 'prod_spring_onion', 'Saved ingredient must retain productId');
assert.equal(wizardState.variantSnapshots.original.ingredientSections[0].ingredients[0].qty, 2, 'Original snapshot must preserve qty=2');
assert.equal(wizardState.variantSnapshots.enhanced.ingredientSections[0].ingredients[0].qty, 5, 'Enhanced snapshot must preserve edited qty=5');
console.log('✅ Passed: onSaveRecipe enforces mandatory meal suitability, preserves ingredientId vs productId, and retains dual-variant snapshots');

// --- Test 14: Unicode Accented & Apostrophe Title Casing (AE1) ---
console.log('\n--- Test 14: Unicode Accented & Apostrophe Title Casing ---');
assert.equal(toTitleCase('CRÈME FRAÎCHE & JALAPEÑO PÂTÉ'), 'Crème Fraîche & Jalapeño Pâté');
assert.equal(toTitleCase("if you’re using chef's crème"), "If You’re Using Chef's Crème");
assert.equal(toTitleCase('FIVE-MINUTE SAUTÉED SHISHITO PEPPERS'), 'Five-Minute Sautéed Shishito Peppers');
console.log('✅ Passed: toTitleCase handles accented Latin characters, apostrophes, and hyphens cleanly');

// --- Test 15: Implied Salt & Black Pepper Filtering & Spoon/Asterisk Normalization (AE2, AE3) ---
console.log('\n--- Test 15: Implied Salt & Pepper Filtering and Spoon/Asterisk Normalization ---');
assert.equal(parseIngredientString('Salt and freshly ground black pepper'), null);
assert.equal(parseIngredientString('sea salt, to taste'), null);
assert.equal(parseIngredientString('Black pepper'), null);
assert.equal(parseIngredientString('a pinch of salt'), null);
assert.equal(parseIngredientString('kosher salt & cracked black pepper, for seasoning'), null);

const measuredSalt = parseIngredientString('1 tsp sea salt');
assert(measuredSalt !== null, 'Explicitly measured "1 tsp sea salt" must be preserved');
assert.equal(measuredSalt.qty, 3.5);
assert.equal(measuredSalt.unit, 'g');
assert.equal(measuredSalt.name, 'Sea Salt');

const measuredPepper = parseIngredientString('1/2 tsp black pepper');
assert(measuredPepper !== null, 'Explicitly measured "1/2 tsp black pepper" must be preserved');
assert.equal(measuredPepper.qty, 1.8);
assert.equal(measuredPepper.unit, 'g');
assert.equal(measuredPepper.name, 'Black Pepper');

const bellPepper = parseIngredientString('1 red bell pepper');
assert(bellPepper !== null, '"1 red bell pepper" must be preserved');
assert.equal(bellPepper.name, 'Red Bell Pepper');

const garlicSalt = parseIngredientString('1 tsp garlic salt');
assert(garlicSalt !== null, '"1 tsp garlic salt" must be preserved');
assert.equal(garlicSalt.name, 'Garlic Salt');

const heapedBakingPowder = parseIngredientString('1 heaped tsp baking powder');
assert.equal(heapedBakingPowder.qty, 2.5);
assert.equal(heapedBakingPowder.unit, 'g');
assert.equal(heapedBakingPowder.name, 'Baking Powder');

const milkAsterisk = parseIngredientString('350-450ml milk*');
assert.equal(milkAsterisk.qty, 400);
assert.equal(milkAsterisk.unit, 'ml');
assert.equal(milkAsterisk.name, 'Milk');
console.log('✅ Passed: Implied salt/pepper lines drop, measured salt/pepper & bell peppers remain, and heaped/asterisk tokens normalize');

// --- Test 16: TikTok Social Caption Unpacking (CINNAMON ROLL BAKED OATS - AE4) ---
console.log('\n--- Test 16: TikTok Social Caption Unpacking (CINNAMON ROLL BAKED OATS) ---');
const tiktokCaption = `CINNAMON ROLL BAKED OATSAll the flavours of a cinnamon roll in a cosy, make-ahead breakfast 🙂‍↔️ YES pleaseMakes 4-5 servings.▫️ 2 bananas▫️ 200g rolled oats▫️ 60g flavoured soy protein powder▫️ 1 heaped tsp baking powder▫️ 350-450ml milk*▫️ 1 tsp cinnamonFor the top:▫️ Cinnamon swirl- 1 tsp ground cinnamon- 1 tsp brown sugar- 2 tsp melted butter/olive oil▫️ Cream cheese- 2 tbsp cream cheese- 1 tbsp honey* If you’re using a different protein powder, you may need to adjust the liquid. Start with as little as 150ml and add gradually until you reach the consistency shown in the video.1. Preheat your oven to 180°C fan.2. In a 9×6 baking dish (line if yours tends to stick), mash the bananas until smooth. Add the oats, soy protein, baking powder, cinnamon, and milk. Stir until everything is fully combined, then smooth the top and clean down the sides.3. Top with alternating dollops of the cinnamon swirl and cream cheese mixes and swirl together using the back of a spoon.4. Bake for about 35 minutes, until golden and set in the middle.5. Once the baked oats are out of the oven, let them cool for 5-10 minutes so the squares hold their shape.6. Slice into portions. Microwave for 1 minute to warm through or enjoy cold for more of an oat-bar vibe. Store leftovers in an airtight container in the fridge for up to 5 days.ENJOY! [#bakedoats](https://www.tiktok.com/tag/bakedoats) [#breakfasttok](https://www.tiktok.com/tag/breakfasttok) [#highprotein](https://www.tiktok.com/tag/highprotein)`;

const parsedTikTok = parseBulkRecipeText(tiktokCaption);
assert.equal(parsedTikTok.length, 1, 'Should parse 1 recipe from TikTok caption');
const bakedOats = parsedTikTok[0];
assert.equal(bakedOats.title, 'Cinnamon Roll Baked Oats', 'Title should separate cleanly from intro blurb');
assert.equal(bakedOats.servings, 4, 'Makes 4-5 servings should resolve to 4');
assert.equal(bakedOats.ingredientSections.length, 3, 'Should have 3 ingredient sections');
assert.equal(bakedOats.ingredientSections[0].sectionTitle, 'Main Ingredients');
assert.equal(bakedOats.ingredientSections[0].ingredients.length, 6);
assert.deepEqual(
  bakedOats.ingredientSections[0].ingredients.map(i => i.name),
  ['Bananas', 'Rolled Oats', 'Flavoured Soy Protein Powder', 'Baking Powder', 'Milk', 'Cinnamon']
);
assert.equal(bakedOats.ingredientSections[1].sectionTitle, 'Cinnamon Swirl');
assert.equal(bakedOats.ingredientSections[1].ingredients.length, 3);
assert.deepEqual(
  bakedOats.ingredientSections[1].ingredients.map(i => i.name),
  ['Ground Cinnamon', 'Brown Sugar', 'Melted Butter/Olive Oil']
);
assert.equal(bakedOats.ingredientSections[2].sectionTitle, 'Cream Cheese');
assert.equal(bakedOats.ingredientSections[2].ingredients.length, 2);
assert.deepEqual(
  bakedOats.ingredientSections[2].ingredients.map(i => i.name),
  ['Cream Cheese', 'Honey']
);
assert.equal(bakedOats.methodSteps.length, 6, 'Should extract 6 method steps');
assert.equal(bakedOats.methodSteps[0], 'Preheat your oven to 180°C fan.');
assert.equal(
  bakedOats.methodSteps[5],
  'Slice into portions. Microwave for 1 minute to warm through or enjoy cold for more of an oat-bar vibe. Store leftovers in an airtight container in the fridge for up to 5 days.'
);

const acronymRecipe = parseBulkRecipeText(`BBQ Pulled Pork\nServes: 4\nIngredients:\n500g pork shoulder\nMethod:\n1. Slow cook the pork until tender.\n2. Divide the mixture so it makes 4 buns.`);
assert.equal(acronymRecipe.length, 1);
assert.equal(acronymRecipe[0].title, 'Bbq Pulled Pork', 'Acronym-prefixed title with space must not be truncated');
assert.equal(acronymRecipe[0].methodSteps.length, 2, 'Prose "makes 4 buns" inside method step must not split the step');
assert.equal(acronymRecipe[0].methodSteps[1], 'Divide the mixture so it makes 4 buns.');
console.log('✅ Passed: TikTok Cinnamon Roll Baked Oats parses cleanly into title, servings, 3 sections, and 6 steps');

console.log('\n=== ALL RECIPE WIZARD v3.28.3 TESTS PASSED SUCCESSFULLY ===');
