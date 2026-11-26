/**
 * scripts/test_recipe_wizard_and_parser_polish.js
 * Regression test suite for Area A (R1–R5, AE1–AE4):
 * - Fixed Step 3/4 modal footer
 * - Blank omitted Prep & Cook times
 * - Liquid stock volume -> 1 qty cube + waterMl
 * - Weight/volume-free alias learning
 * - Preserving parsed ingredient name & mapping to Root Item on new Root Item creation
 */

import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {}
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  Store: { getState: () => ({ recipes: [], ingredients: [], rootItems: [], products: [], preferences: {} }) }
};

const { parseBulkRecipeText } = await import('../src/services/RecipeParserService.js');
const { parseIngredientString, cleanIngredientPhraseForAlias } = await import('../src/services/RecipeIngredientParser.js');
const { wizardState, resetWizardState } = await import('../src/components/recipe/RecipeWizardState.js');
const { renderState3Review, renderStep3Footer } = await import('../src/components/recipe/RecipeWizardStep3View.js');
const { renderWizardFooter } = await import('../src/components/recipe/RecipeWizardModal.js');
const { applyCreatedTaxonomySelection } = await import('../src/components/recipe/RecipeWizardTaxonomySearch.js');
const { state: coreState } = await import('../src/store/coreState.js');
const { learnIngredientAlias } = await import('../src/store/actions/pantryActions.js');

// AE1: Step 3/4 footer is pinned via renderWizardFooter() and omitted Prep/Cook times stay blank
{
  const rawNoTimes = `Recipe Title: Simple Tomato Pasta
Serves 2
Ingredients:
200g pasta
400g chopped tomatoes
Method:
1. Boil pasta and heat sauce.`;

  const [parsed] = parseBulkRecipeText(rawNoTimes, []);
  assert.deepEqual(parsed.prepTime, { hours: '', minutes: '' }, 'Omitted Prep Time must stay blank');
  assert.deepEqual(parsed.cookTime, { hours: '', minutes: '' }, 'Omitted Cook Time must stay blank');

  resetWizardState();
  wizardState.currentStep = 3;
  wizardState.activeRecipe = {
    ...wizardState.activeRecipe,
    title: parsed.title,
    servings: parsed.servings,
    prepTime: parsed.prepTime,
    cookTime: parsed.cookTime,
    ingredientSections: parsed.ingredientSections,
    methodSteps: parsed.methodSteps
  };

  const reviewHtml = renderState3Review();
  const footerHtml = renderWizardFooter();
  const step3FooterDirect = renderStep3Footer();

  assert.ok(!reviewHtml.includes('id="btn-save-wizard-recipe"'), 'Save button must not sit inside scrolling review body');
  assert.ok(footerHtml.includes('id="wizard-step3-footer"'), 'Step 3 footer must render via renderWizardFooter');
  assert.ok(footerHtml.includes('class="ios-fullscreen-footer"'), 'Step 3 footer must use fixed .ios-fullscreen-footer');
  assert.ok(footerHtml.includes('id="btn-save-wizard-recipe"'), 'Step 3 footer must contain Save button');
  assert.ok(footerHtml.includes('data-action="go-to-wizard-step"'), 'Step 3 footer must contain Back button');
  assert.equal(footerHtml, step3FooterDirect);

  assert.ok(reviewHtml.includes('id="wiz-rev-prepm"') && reviewHtml.includes('value=""'), 'Blank prep time must render empty input');
  assert.ok(reviewHtml.includes('id="wiz-rev-cookm"'), 'Cook time input must exist');
  assert.ok(!reviewHtml.includes('id="wiz-rev-prepm" name="rev_prepm" value="15"'), 'Prep time must not auto-default to 15');
  assert.ok(!reviewHtml.includes('id="wiz-rev-cookm" name="rev_cookm" value="30"'), 'Cook time must not auto-default to 30');
}

// AE2: Liquid stock parses to 1 qty stock cube + parsed waterMl
{
  const veg1000 = parseIngredientString('1000ml vegetable stock');
  assert.equal(veg1000.qty, 1);
  assert.equal(veg1000.unit, 'qty');
  assert.equal(veg1000.name, 'Vegetable Stock Cube');
  assert.equal(veg1000.waterMl, 1000);

  const chick1L = parseIngredientString('1L chicken stock');
  assert.equal(chick1L.qty, 1);
  assert.equal(chick1L.unit, 'qty');
  assert.equal(chick1L.name, 'Chicken Stock Cube');
  assert.equal(chick1L.waterMl, 1000);

  const beef15L = parseIngredientString('1.5L beef broth');
  assert.equal(beef15L.qty, 1);
  assert.equal(beef15L.unit, 'qty');
  assert.equal(beef15L.name, 'Beef Stock Cube');
  assert.equal(beef15L.waterMl, 1500);

  const plain500 = parseIngredientString('500ml stock');
  assert.equal(plain500.qty, 1);
  assert.equal(plain500.unit, 'qty');
  assert.equal(plain500.name, 'Vegetable Stock Cube');
  assert.equal(plain500.waterMl, 500);

  const paren500 = parseIngredientString('500ml (17fl oz) chicken stock');
  assert.equal(paren500.qty, 1);
  assert.equal(paren500.unit, 'qty');
  assert.equal(paren500.name, 'Chicken Stock Cube');
  assert.equal(paren500.waterMl, 500);

  const comma1000 = parseIngredientString('1,000ml (35fl oz) hot chicken or veg stock');
  assert.equal(comma1000.qty, 1);
  assert.equal(comma1000.unit, 'qty');
  assert.equal(comma1000.name, 'Chicken Stock Cube');
  assert.equal(comma1000.waterMl, 1000);

  const slash1L = parseIngredientString('1L / 35fl oz beef bone broth');
  assert.equal(slash1L.qty, 1);
  assert.equal(slash1L.unit, 'qty');
  assert.equal(slash1L.name, 'Beef Stock Cube');
  assert.equal(slash1L.waterMl, 1000);
}

// AE3: Alias cleaner and learnIngredientAlias strip weights, volumes, ranges, and reject unit-only strings
{
  assert.equal(cleanIngredientPhraseForAlias('400g red kidney beans'), 'red kidney beans');
  assert.equal(cleanIngredientPhraseForAlias('2 x 400ml coconut milk'), 'coconut milk');
  assert.equal(cleanIngredientPhraseForAlias('1.5L vegetable stock'), 'vegetable stock');
  assert.equal(cleanIngredientPhraseForAlias('100-150g baby spinach'), 'baby spinach');
  assert.equal(cleanIngredientPhraseForAlias('400g'), '');

  coreState.ingredients = [{ id: 'ing_beans', name: 'Kidney Beans', aliases: [], subtypes: [] }];
  await learnIngredientAlias('ing_beans', '400g red kidney beans');
  await learnIngredientAlias('ing_beans', '400g');
  assert.deepEqual(coreState.ingredients[0].aliases, ['red kidney beans']);
}

// AE4: Creating a new Root Item in Wizard preserves parsed ingredient name and maps to Root Item
{
  const rowNameInput = { value: 'Cavolo Nero' };
  const attrs = {};
  const inputEl = {
    dataset: {},
    value: '',
    style: {},
    setAttribute(k, v) { attrs[k] = v; },
    dispatchEvent() {}
  };
  let callbackVal = null;

  const result = applyCreatedTaxonomySelection({
    created: {
      startAt: 'item',
      ingredientId: 'ing_kale',
      subtypeId: 'sub_std',
      parentName: 'Kale',
      subtypeName: 'Standard'
    },
    inputEl,
    currentIngName: rowNameInput.value,
    sIdx: 0,
    iIdx: 0,
    onSelectCallback: (_s, _i, val) => { callbackVal = val; }
  });

  assert.equal(rowNameInput.value, 'Cavolo Nero', 'Parsed ingredient name must remain untouched');
  assert.equal(inputEl.dataset.taxVal, 'ing_kale', 'Must map to Root Item ID, not sub-type');
  assert.equal(inputEl.value, '📦 Kale', 'Display label must show Root Item, not sub-type');
  assert.equal(callbackVal, 'ing_kale');
  assert.equal(result.combinedKey, 'ing_kale');

  // Conversely, when starting explicitly at Sub-Type, map to the Sub-Type
  const subResult = applyCreatedTaxonomySelection({
    created: {
      startAt: 'subtype',
      ingredientId: 'ing_kale',
      subtypeId: 'sub_cavolo',
      parentName: 'Kale',
      subtypeName: 'Cavolo Nero'
    },
    inputEl,
    currentIngName: 'Cavolo Nero',
    sIdx: 0,
    iIdx: 0
  });
  assert.equal(subResult.combinedKey, 'ing_kale:sub_cavolo');
  assert.equal(inputEl.value, '🏷️ Cavolo Nero (Kale)');
}

console.log('✅ test_recipe_wizard_and_parser_polish passed');
