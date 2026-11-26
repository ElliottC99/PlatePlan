/**
 * scripts/test_paste_parse_cookbook_and_notes.js
 * Regression test suite for Paste & Parse cookbook formatting and Recipe Notes (R1–R8, AE1–AE2).
 */

import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = {
  localStorage: globalThis.localStorage,
  Store: { getState: () => ({ recipes: [], ingredients: [], products: [], preferences: {} }) }
};

const { parseBulkRecipeText } = await import('../src/services/RecipeParserService.js');
const { parseIngredientString } = await import('../src/services/RecipeIngredientParser.js');
const { renderRecipeDetailModalContent } = await import('../src/components/recipe/RecipeDetailModalUI.js');
const { importRecipeFromHtml } = await import('../src/services/RecipeImporter.js');

const FRESH_MOB_RECIPE = `Recipe Title: Parmesan Cauliflower Steaks with Pistachio Pesto
Source Type: Book
Source Name: FRESH MOB (Weekend)
Page number: 153
Prep Time (hours and minutes): 0 Hours 0 Mins
Cook Time (Hours and minutes): 0 Hours 45 Mins
Ingredients:
Serves 2
2 large cauliflowers
4 tsp olive oil, plus 4 tbsp
75g (2¾oz) Parmesan (or vegetarian alternative)
a large bunch of basil
60g (2¼oz) pistachios
1 lemon
2 red chillies
salt and black pepper
side salad, to serve

Make it Vegetarian: By using a vegetarian alternative to Parmesan.

Cooking Hacks: Hold back half of your cauliflower trimmings and leaves to use on another occasion.
Try not to move your cauliflower steaks around too much once you've cut them - they are delicate and can break easily.
Method:
1. Preheat the oven to 200°C/180°C fan/gas mark 6.
2. Cut the leaves off the cauliflowers, then cut each one vertically down the middle of its stalk. Trim away the edges so that you end up with four steaks. Save the cauliflower leaves and the offcuts/scraps.
3. Place the cauliflower steaks onto a baking tray and rub each one with salt, pepper and 1 teaspoon of olive oil. Roast for 30 minutes, then remove from the oven and flip them over. Grate 45g (1½oz) of the Parmesan over the steaks, then return to the oven for 10 minutes.
4. Meanwhile, finely chop the cauliflower leaves.
5. Bring a saucepan of water to the boil. Add salt, then tip in the scraps of cauliflower and the leaves. Simmer for 5 minutes until tender, then drain and allow to cool.
6. Add the cooled cauliflower pieces and leaves to a food processor along with the basil, two-thirds of the pistachios and the remaining Parmesan, then blitz until you have a smooth paste. Add the 4 tablespoons of olive oil and the juice of the lemon then blitz again; stir in just enough water to make the sauce a drizzle-able consistency. Season to taste with salt and pepper.
7. Toast the remaining pistachios in a dry frying pan over a medium heat until smelling toasty, then finely chop them. Thinly slice the chillies.
8. Arrange the cauliflower steaks on two plates. Drizzle with the pesto, then sprinkle with the sliced chillies and chopped pistachios. Serve and enjoy.`;

// AE1: Full Fresh Mob cookbook recipe parses every field accurately
{
  const parsedList = parseBulkRecipeText(FRESH_MOB_RECIPE, []);
  assert.equal(parsedList.length, 1, 'Should parse as 1 recipe');
  const r = parsedList[0];

  assert.equal(r.title, 'Parmesan Cauliflower Steaks With Pistachio Pesto');
  assert.equal(r.sourceType, 'book');
  assert.equal(r.sourceBook, 'FRESH MOB (Weekend)');
  assert.equal(r.sourcePage, '153');
  assert.deepEqual(r.prepTime, { hours: 0, minutes: 0 });
  assert.deepEqual(r.cookTime, { hours: 0, minutes: 45 });
  assert.equal(r.servings, 2);
  assert.equal(r.methodSteps.length, 8);

  // Callout blocks captured into notes, NOT ingredients
  assert.ok(r.notes.includes('Make it Vegetarian: By using a vegetarian alternative to Parmesan.'));
  assert.ok(r.notes.includes('Cooking Hacks: Hold back half of your cauliflower trimmings'));
  assert.ok(r.notes.includes('they are delicate and can break easily.'), 'Continuation line containing "can" must stay in notes');

  const ingNames = r.ingredients.map(i => i.name.toLowerCase());
  assert.ok(!ingNames.some(n => n.includes('serves')), '"Serves 2" must not appear in ingredients');
  assert.ok(!ingNames.some(n => n.includes('vegetarian') || n.includes('cooking hacks') || n.includes('delicate')), 'Callout lines must not appear in ingredients');
  assert.ok(!ingNames.some(n => n === 'tbsp'), 'Compound split must not create a bogus "Tbsp" ingredient');

  // R4: Olive oil summed to 80 ml with split noted
  const oil = r.ingredients.find(i => i.name.toLowerCase() === 'olive oil');
  assert.ok(oil, 'Olive Oil ingredient should exist');
  assert.equal(oil.qty, 80);
  assert.equal(oil.unit, 'ml');
  assert.ok(oil.notes.includes('4 tsp + 4 tbsp'), `Expected split note, got "${oil.notes}"`);

  // R6: Parmesan strips both parentheticals into notes
  const parm = r.ingredients.find(i => i.name.toLowerCase() === 'parmesan');
  assert.ok(parm, 'Parmesan ingredient should exist with clean name');
  assert.equal(parm.qty, 75);
  assert.equal(parm.unit, 'g');
  assert.ok(parm.notes.includes('or vegetarian alternative'), `Expected alternative in notes, got "${parm.notes}"`);
}

// R5: Incompatible split-quantity units keep primary qty and preserve extra in notes
{
  const parsed = parseIngredientString('1 tin chickpeas, plus 2 tbsp');
  assert.ok(parsed);
  assert.equal(parsed.name, 'Chickpeas');
  assert.equal(parsed.unit, 'qty');
  assert.equal(parsed.qty, 1);
  assert.ok(parsed.notes.includes('plus 2 tbsp'), `Expected fallback note, got "${parsed.notes}"`);
}

// U1: RecipeImporter fallback forwards source fields and notes
{
  const imported = importRecipeFromHtml(FRESH_MOB_RECIPE);
  assert.ok(imported);
  assert.equal(imported.sourceBook, 'FRESH MOB (Weekend)');
  assert.equal(imported.sourcePage, '153');
  assert.ok(imported.notes.includes('Cooking Hacks:'));
}

// AE2: Recipe Detail modal renders Recipe Notes card when non-empty and omits when empty
{
  const withNotesHtml = renderRecipeDetailModalContent({
    r: {
      id: 'rec_notes_1',
      name: 'Test Dish',
      serves: 2,
      notes: 'Make it Vegetarian: Use veggie Parmesan.\nCooking Hacks: Save the leaves.'
    }
  });
  assert.ok(withNotesHtml.includes('recipe-modal-notes-card'), 'Notes card must render when notes present');
  assert.ok(withNotesHtml.includes('Make it Vegetarian: Use veggie Parmesan.'), 'Notes content must be rendered');

  const withoutNotesHtml = renderRecipeDetailModalContent({
    r: { id: 'rec_notes_2', name: 'Plain Dish', serves: 2, notes: '' }
  });
  assert.ok(!withoutNotesHtml.includes('recipe-modal-notes-card'), 'Notes card must not render when notes empty');
}

console.log('✅ test_paste_parse_cookbook_and_notes passed');
