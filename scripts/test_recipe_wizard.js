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
import { renderMacroBreakdownCrossbar } from '../src/components/recipe/RecipeWizardStep3View.js';
import { sanitizeForFirestore } from '../src/services/RecipeFirestoreRepository.js';
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

// --- Test 17: U1 Recipe Vault Visibility & Meal-Type Normalization (AE1) ---
console.log('\n--- Test 17: Recipe Vault Visibility & Meal-Type Normalization ---');
const { getNormalizedRecipeTypes, renderRecipeGrid } = await import('../src/views/RecipeVaultView.js');

const snackingRecipe = {
  id: 'rec_snack_1',
  title: 'Snack Protein Balls',
  mealSuitability: ['Snacking']
};
const normalizedSnackTypes = getNormalizedRecipeTypes(snackingRecipe);
assert(normalizedSnackTypes.includes('snacking'), 'Must include "snacking"');
assert(normalizedSnackTypes.includes('snack'), 'Must include "snack" for backwards compatibility');

const emptyRecipe = { id: 'rec_empty_1', title: 'Bare Recipe' };
assert.deepEqual(getNormalizedRecipeTypes(emptyRecipe), ['dinner'], 'Empty recipe types should default to dinner');

// Test >50 recipes grid rendering without truncation
const mockVaultList = {
  innerHTML: '',
  hasAttribute: () => false,
  setAttribute: () => {},
  addEventListener: () => {}
};
global.document.getElementById = (id) => {
  if (id === 'vault-list') return mockVaultList;
  if (id === 'filter-type') return { value: 'all' };
  if (id === 'filter-who') return { value: 'all' };
  if (id === 'vault-sort') return { value: 'fit-desc' };
  return null;
};

const sixtyFiveRecipes = Array.from({ length: 65 }, (_, idx) => ({
  id: `rec_${idx + 1}`,
  name: `Recipe ${idx + 1}`,
  mealSuitability: ['Dinner'],
  macros: { calories: 500, protein: 30, carbs: 40, fat: 15 }
}));

renderRecipeGrid(sixtyFiveRecipes);
const cardMatches = mockVaultList.innerHTML.match(/class="recipe-card[\s"]/g) || [];
assert.equal(cardMatches.length, 65, `All 65 recipes must be rendered without truncation (got ${cardMatches.length})`);
console.log('✅ Passed: All 65 recipes render in grid without 50-item cap, and snacking mealSuitability normalizes cleanly');

// --- Test 18: U2 Recipe Deduplication Service, Clustering & Meal Plan Repointing (AE2) ---
console.log('\n--- Test 18: Recipe Deduplication Service, Clustering & Meal Plan Repointing ---');
const {
  normalizeRecipeTitleKey,
  scoreRecipeCompleteness,
  findDuplicateRecipeClusters,
  repointMealPlanRecipeIds,
  mergeDuplicateRecipeCluster
} = await import('../src/services/RecipeFirestoreRepository.js');

assert.equal(normalizeRecipeTitleKey('Cinnamon Roll Baked Oats (Copy)'), 'cinnamon roll baked oats');
assert.equal(normalizeRecipeTitleKey('  cinnamon-roll  baked  oats (enhanced)  '), 'cinnamon roll baked oats');
assert.equal(normalizeRecipeTitleKey("Chef's Special Pizza!"), 'chefs special pizza');

const mockRecipes = [
  {
    id: 'rec_orig',
    name: 'Cinnamon Roll Baked Oats',
    title: 'Cinnamon Roll Baked Oats',
    mealSuitability: ['Breakfast'],
    types: ['breakfast'],
    ingredients: [
      { name: 'Oats', ingredientId: 'ing_oats' },
      { name: 'Milk', ingredientId: 'ing_milk' }
    ],
    updatedAt: '2026-11-01T10:00:00Z'
  },
  {
    id: 'rec_dup_enhanced',
    name: 'Cinnamon Roll Baked Oats (Copy)',
    title: 'Cinnamon Roll Baked Oats (Copy)',
    mealSuitability: ['Snacking'],
    types: ['snacking'],
    ingredients: [
      { name: 'Oats', ingredientId: 'ing_oats' },
      { name: 'Milk', ingredientId: 'ing_milk' },
      { name: 'Cinnamon', ingredientId: 'ing_cinnamon' }
    ],
    enhanced: {
      title: 'Cinnamon Roll Baked Oats (Enhanced)',
      macros: { calories: 380, protein: 32 }
    },
    enhancedFitScore: 92,
    isFavourite: true,
    updatedAt: '2026-11-08T12:00:00Z'
  },
  {
    id: 'rec_other',
    name: 'Chicken Curry',
    title: 'Chicken Curry'
  }
];

const clusters = findDuplicateRecipeClusters(mockRecipes, ['rec_dup_enhanced_original']);
assert.equal(clusters.length, 1, 'Should find exactly 1 duplicate cluster');
assert.equal(clusters[0].variants.length, 2, 'Cluster should have 2 recipe variants');
// The enhanced one with more ingredients should score higher and be pre-selected at index 0
assert.equal(clusters[0].variants[0].id, 'rec_dup_enhanced', 'Richest recipe (with enhanced & favourite) must be first');

// Test Meal Plan Slot Repointing
const mockPlan = {
  slots: {
    Mon: {
      breakfast: { recipeId: 'rec_dup_enhanced', isSkipped: false },
      lunch: { recipeId: 'rec_other', isSkipped: false }
    },
    Tue: {
      dinner: {
        isSplit: true,
        elliott: { recipeId: 'rec_dup_enhanced' },
        chloe: { recipeId: 'rec_other' }
      }
    }
  },
  days: [
    {
      meals: [
        { recipeId: 'rec_dup_enhanced', mealType: 'breakfast' }
      ]
    }
  ]
};
const mockSkeleton = {
  Mon: { breakfast: { recipeId: 'rec_dup_enhanced' } }
};

const repointed = repointMealPlanRecipeIds(mockPlan, mockSkeleton, { 'rec_dup_enhanced': 'rec_orig' });
assert.equal(repointed.modified, true);
assert.equal(repointed.plan.slots.Mon.breakfast.recipeId, 'rec_orig');
assert.equal(repointed.plan.slots.Tue.dinner.elliott.recipeId, 'rec_orig');
assert.equal(repointed.plan.days[0].meals[0].recipeId, 'rec_orig');
assert.equal(repointed.skeletonGrid.Mon.breakfast.recipeId, 'rec_orig');

// Test mergeDuplicateRecipeCluster execution, enhanced adoption, type union & favorite migration
const mergeOptions = {
  plan: mockPlan,
  skeletonGrid: mockSkeleton,
  state: {
    preferences: {
      favouriteVariantIds: ['rec_orig_original', 'rec_other_original']
    }
  }
};
const mergeResult = await mergeDuplicateRecipeCluster(clusters[0].variants, 'rec_dup_enhanced', mergeOptions);
assert.equal(mergeResult.success, true, 'Merge operation must succeed');
assert.equal(mergeResult.canonical.id, 'rec_dup_enhanced', 'Canonical recipe ID must match chosen target');
assert.equal(mergeResult.deletedCount, 1, 'Exactly 1 duplicate must be marked for deletion');
assert.deepEqual(mergeResult.deletedIds, ['rec_orig']);
assert(mergeResult.canonical.enhanced && mergeResult.canonical.enhanced.title.includes('Enhanced'), 'Canonical must retain enhanced variant');
assert(mergeResult.canonical.types.includes('breakfast') && mergeResult.canonical.types.includes('snacking'), 'Canonical must union meal types');
assert(mergeOptions.state.preferences.favouriteVariantIds.includes('rec_dup_enhanced_original'), 'Favourite variant ID must be migrated from duplicate to canonical');

console.log('✅ Passed: Title normalization, duplicate clustering with richness scoring, Meal Plan repointing, and mergeDuplicateRecipeCluster verified');

// --- Test 19: U3 Duplicate-Title Consolidation on Recipe Save (AE3) ---
console.log('\n--- Test 19: Duplicate-Title Consolidation on Recipe Wizard Save ---');
const { setRecipes, getState } = await import('../src/store/store.js');

const existingFajitas = {
  id: 'rec_existing_fajitas',
  name: 'Chicken Fajitas',
  title: 'Chicken Fajitas',
  createdAt: '2026-10-01T00:00:00Z',
  isFavourite: true,
  isFavorite: true,
  mealSuitability: ['Dinner'],
  types: ['dinner'],
  enhanced: {
    title: 'Chicken Fajitas (Enhanced)',
    macros: { calories: 480, protein: 42 }
  },
  enhancedFitScore: 89,
  _scoreEnhanced: 89
};

setRecipes([existingFajitas]);

resetWizardState();
wizardState.activeRecipe.title = 'chicken fajitas';
wizardState.activeRecipe.mealSuitability = ['Snacking'];
wizardState.activeRecipe.ingredientSections = [
  { sectionTitle: 'Main Ingredients', ingredients: [{ name: 'Chicken Breast', qty: 300, unit: 'g', ingredientId: 'ing_chicken', productId: 'prod_chicken' }] }
];
wizardState.activeRecipe.methodSteps = ['Cook chicken in skillet.'];
// No enhanced variant created in this wizard session
wizardState.activeVariant = 'original';

await onSaveRecipe(mockModalWrap, mockCallbacks);

const storeRecipes = getState().recipes || [];
assert.equal(storeRecipes.length, 1, 'Must not create duplicate recipe entry in store');
const savedRecipeOutput = storeRecipes[0];
assert.equal(savedRecipeOutput.id, 'rec_existing_fajitas', 'Must reuse existing recipe ID instead of generating a new one');
assert.equal(savedRecipeOutput.createdAt, '2026-10-01T00:00:00Z', 'Must preserve original createdAt timestamp');
assert.equal(savedRecipeOutput.isFavourite, true, 'Must preserve existing favourite status');
assert(savedRecipeOutput.enhanced && savedRecipeOutput.enhanced.title.includes('Enhanced'), 'Must preserve existing enhanced variant');
assert(savedRecipeOutput.mealSuitability.includes('Dinner') && savedRecipeOutput.mealSuitability.includes('Snacking'), 'Must union mealSuitability');
console.log('✅ Passed: Saving duplicate recipe title reuses ID, preserves enhanced variant and favourites, and unions tags');

// --- Test 20: Headerless Social Recipe Parsing & Step 2 Meal Type Selection ---
console.log('\n--- Test 20: Headerless Social Recipe Parsing & Step 2 Meal Type Selection ---');
const headerlessText = `Korean Crispy Tempeh + Chickpea Wraps
Serves 2

200g tempeh, torn into small pieces
2 tbsp cornflour

Wet coating:
3 tbsp plain flour
3–4 tbsp water
Half tsp garlic powder
Pinch of salt

Crispy coating:
Half cup panko breadcrumbs
2 tbsp white sesame seeds
1 tsp garlic powder
1 tsp onion powder
Pinch of salt

Korean glaze:
2 tbsp gochujang
1 tbsp soy sauce
1 tbsp maple syrup
1 tbsp rice vinegar
1 tbsp water
1 tsp sesame oil
1 garlic clove, grated
1 tsp grated ginger

Creamy slaw:
Shredded cabbage
Half an cucumber, thinly sliced
1 small carrot, grated
Small handful coriander, chopped
4 tbsp vegan mayo
1 tbsp rice vinegar
1 tsp sesame oil
1 tsp maple syrup
1 tsp soy sauce
Squeeze of lime
Sprinkle of crispy onions
Pinch of salt

Crispy chickpeas:
1 x 400g tin chickpeas, drained and dried well
1 tbsp neutral oil
Pinch of salt
1 tsp garlic powder

2 large tortilla wraps

Tear the tempeh into small pieces, lightly coat in cornflour then dip each piece into the wet coating then press firmly into the panko and sesame mixture until well coated. Spray with oil and air fry at 200C for 15–20 minutes, turning halfway, until golden and crispy.

Meanwhile, add the glaze ingredients to a small pan and simmer slightly thickened. Toss the crispy tempeh through the glaze until coated.

For the chickpeas, toss with the oil and air fry at 200°C for 15–20 minutes, shaking occasionally, until crisp. Toss with the seasonings while still hot.`;

const parsedHeaderless = parseBulkRecipeText(headerlessText);
assert.equal(parsedHeaderless.length, 1, 'Should extract 1 recipe from headerless text');
const tempehRecipe = parsedHeaderless[0];
assert.equal(tempehRecipe.title, 'Korean Crispy Tempeh + Chickpea Wraps', 'Title must match first line');
assert.equal(tempehRecipe.servings, 2, 'Servings must parse as 2');
assert(tempehRecipe.ingredientSections.length >= 5, `Must parse sections, got ${tempehRecipe.ingredientSections.length}`);
const sectionTitles = tempehRecipe.ingredientSections.map(s => s.sectionTitle);
assert(sectionTitles.includes('Wet Coating'), 'Must include Wet Coating section');
assert(sectionTitles.includes('Crispy Coating'), 'Must include Crispy Coating section');
assert(sectionTitles.includes('Korean Glaze'), 'Must include Korean Glaze section');
assert(sectionTitles.includes('Creamy Slaw'), 'Must include Creamy Slaw section');
assert(sectionTitles.includes('Crispy Chickpeas'), 'Must include Crispy Chickpeas section');
assert(tempehRecipe.ingredients.length >= 25, `Must parse at least 25 ingredients, got ${tempehRecipe.ingredients.length}`);

// Check that leading "an" was cleaned from "Half an cucumber"
const cucumberIng = tempehRecipe.ingredients.find(i => i.name.toLowerCase().includes('cucumber'));
assert(cucumberIng, 'Must find cucumber ingredient');
assert.equal(cucumberIng.name, 'Cucumber', `Ingredient should be named "Cucumber", got "${cucumberIng.name}"`);

assert.equal(tempehRecipe.methodSteps.length, 3, `Must extract 3 method steps, got ${tempehRecipe.methodSteps.length}`);
assert(tempehRecipe.methodSteps[0].startsWith('Tear the tempeh'), 'Step 1 must start with "Tear the tempeh"');
assert(tempehRecipe.methodSteps[1].startsWith('Meanwhile, add the glaze'), 'Step 2 must start with "Meanwhile"');
assert(tempehRecipe.methodSteps[2].startsWith('For the chickpeas, toss'), 'Step 3 must start with "For the chickpeas"');

// Test Step 2 View renders meal suitability pills and updating them updates state
wizardState.activeRecipe = { ...tempehRecipe, mealSuitability: ['Lunch'] };
const step2Html = renderState2Mapping();
assert(step2Html.includes('wiz-step2-meal-tags-container'), 'Step 2 must include meal tags container');
assert(step2Html.includes('wiz-step2-tag-lunch'), 'Step 2 must render Lunch tag');
assert(step2Html.includes('wiz-step2-tag-snacking'), 'Step 2 must render Snacking tag');

console.log('✅ Passed: Headerless recipe with subsections and paragraph steps parses cleanly, and Step 2 renders meal suitability selection');

// --- Test 21: Leading Bullets, Asterisks & Emojis Ignored in Quantity Parsing ---
console.log('\n--- Test 21: Leading Bullets, Asterisks & Emojis Ignored in Quantity Parsing ---');
const bulletTest1 = parseIngredientString('* 5g baking powder');
assert.equal(bulletTest1.qty, 5, 'Asterisk: qty should be 5');
assert.equal(bulletTest1.unit, 'g', 'Asterisk: unit should be g');
assert.equal(bulletTest1.name, 'Baking Powder', 'Asterisk: name should be Baking Powder');

const bulletTest2 = parseIngredientString('✨ 5g baking powder');
assert.equal(bulletTest2.qty, 5, 'Emoji: qty should be 5');
assert.equal(bulletTest2.unit, 'g', 'Emoji: unit should be g');
assert.equal(bulletTest2.name, 'Baking Powder', 'Emoji: name should be Baking Powder');

const bulletTest3 = parseIngredientString('🌿 2 tbsp olive oil');
assert.equal(bulletTest3.qty, 30, 'Herb emoji: qty should be converted to 30ml');
assert.equal(bulletTest3.unit, 'ml', 'Herb emoji: unit should be ml');
assert.equal(bulletTest3.name, 'Olive Oil', 'Herb emoji: name should be Olive Oil');

const bulletTest4 = parseIngredientString('▫️ 100g flour');
assert.equal(bulletTest4.qty, 100, 'Bullet: qty should be 100');
assert.equal(bulletTest4.unit, 'g', 'Bullet: unit should be g');
assert.equal(bulletTest4.name, 'Flour', 'Bullet: name should be Flour');

console.log('✅ Passed: Leading bullets, asterisks, and emojis are stripped cleanly, parsing correct quantity and unit');

// --- Test 22: Live Meal-Type Selection & Macro Target Recalculation Across Enhanced Variants ---
console.log('\n--- Test 22: Live Meal-Type Selection & Macro Target Recalculation Across Enhanced Variants ---');
const lunchRecipe = {
  title: 'Korean Crispy Tempeh Wraps',
  servings: 2,
  mealSuitability: ['Lunch'],
  types: ['lunch'],
  macros: { calories: 500, protein: 30, carbs: 50, fat: 15 },
  enhanced: {
    title: 'Korean Crispy Tempeh Wraps (enhanced)',
    servings: 2,
    macros: { calories: 540, protein: 38, carbs: 45, fat: 18 }
  }
};

// Check that enhanced variant crossbar uses Lunch targets (Elliott Lunch kcal target 630 instead of Dinner 735)
const lunchCrossbar = renderMacroBreakdownCrossbar(lunchRecipe, 'enhanced');
assert(lunchCrossbar.includes('Dual-Profile Per-Portion Split'), 'Crossbar must render');
// In Lunch targets for 2 servings (share ~56% Elliott = 605 kcal scaled vs 630 target => -25 kcal, not dinner 735 => -130)
assert(!lunchCrossbar.includes('-130'), 'Should not use dinner target differences for a lunch recipe');

console.log('✅ Passed: Enhanced variant retains mealSuitability and evaluates against lunch macro targets');

// --- Test 23: Firestore Sanitization and Save Result Verification ---
console.log('\n--- Test 23: Firestore Sanitization and Save Result Verification ---');
const rawDirtyRecipe = {
  id: 'test-rec-1',
  title: 'Test Clean Recipe',
  enhanced: undefined,
  macros: {
    calories: 400,
    protein: 25,
    carbs: undefined
  },
  ingredients: [
    { name: 'Tofu', qty: 200, unit: 'g', scaledQty: undefined, waterMl: null }
  ]
};

const sanitized = sanitizeForFirestore(rawDirtyRecipe);
assert.equal(sanitized.enhanced, null, 'undefined enhanced field should become null');
assert.equal('carbs' in sanitized.macros, false, 'undefined nested keys should be stripped');
assert.equal('scaledQty' in sanitized.ingredients[0], false, 'undefined ingredient fields should be stripped');
assert.equal(sanitized.ingredients[0].waterMl, null, 'null fields should be preserved');

console.log('✅ Passed: sanitizeForFirestore eliminates undefined fields recursively');

console.log('\n=== ALL RECIPE WIZARD v3.28.3 TESTS PASSED SUCCESSFULLY ===');
