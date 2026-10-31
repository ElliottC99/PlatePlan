/**
 * scripts/test_multi_recipe_parser.js
 * Verification test suite for multi-recipe paste & parse instruction allocation.
 */

import assert from 'node:assert';
import { unpackAndSplitRecipeBlocks, parseSingleRecipeText, parseBulkRecipeText } from '../src/services/RecipeParserService.js';

console.log('=== RUNNING MULTI-RECIPE PARSER VERIFICATION SUITE ===\n');

let failures = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    failures++;
    console.error(`❌ Failed: ${name}\n  Error: ${err.message}`);
  }
}

// Test 1: Standard unnumbered recipes separated by whitespace
runTest('Unnumbered recipes split cleanly and assign instructions to each individual recipe', () => {
  const text = `Tofu Stir Fry
Ingredients:
200g firm tofu
1 tbsp soy sauce
Method:
1. Cube and fry tofu until golden.
2. Toss with soy sauce.

Smoky Lentil Soup
Ingredients:
150g red lentils
1 can chopped tomatoes
Instructions:
1. Simmer lentils in vegetable stock.
2. Blend until smooth and creamy.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2, `Expected 2 blocks, got ${blocks.length}`);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2, `Expected 2 parsed recipes, got ${parsed.length}`);

  assert.strictEqual(parsed[0].title, 'Tofu Stir Fry');
  assert.strictEqual(parsed[0].instructions.length, 2);
  assert.ok(parsed[0].instructions[0].includes('Cube and fry tofu'));
  assert.ok(parsed[0].instructions[1].includes('Toss with soy sauce'));

  assert.strictEqual(parsed[1].title, 'Smoky Lentil Soup');
  assert.strictEqual(parsed[1].instructions.length, 2);
  assert.ok(parsed[1].instructions[0].includes('Simmer lentils'));
  assert.ok(parsed[1].instructions[1].includes('Blend until smooth'));
});

// Test 2: Double newlines between numbered method steps inside a single recipe (must NOT drop step 2)
runTest('Numbered steps with double newlines do not drop steps or false-split', () => {
  const text = `Recipe 1: Crispy Baked Tofu
Ingredients:
400g extra firm tofu
2 tbsp cornflour

Method:
1. Preheat oven to 200C and cube tofu.

2. Toss tofu in cornflour and spread on baking sheet.

3. Bake for 25 minutes until crispy.

Recipe 2: Garlic Greens
Ingredients:
200g kale
2 cloves garlic

Method:
1. Heat oil in a skillet.

2. Sauté garlic and kale until wilted.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2, `Expected 2 blocks, got ${blocks.length}`);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].instructions.length, 3, `Expected 3 steps in Recipe 1, got ${parsed[0].instructions.length}`);
  assert.strictEqual(parsed[1].instructions.length, 2, `Expected 2 steps in Recipe 2, got ${parsed[1].instructions.length}`);
});

// Test 3: Recipes separated by horizontal dividers (---, ===)
runTest('Recipes separated by horizontal dividers split into distinct recipes', () => {
  const text = `Creamy Tomato Pasta
Ingredients:
200g penne
400g passata
Method:
1. Boil pasta.
2. Mix with passata.
---
Berry Oatmeal
Ingredients:
50g rolled oats
100ml almond milk
Method:
1. Microwave oats for 2 minutes.
2. Stir in berries.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].title, 'Creamy Tomato Pasta');
  assert.strictEqual(parsed[1].title, 'Berry Oatmeal');
  assert.strictEqual(parsed[0].instructions.length, 2);
  assert.strictEqual(parsed[1].instructions.length, 2);
});

// Test 4: Recipes with Markdown Headings (# Title, ## Method)
runTest('Markdown formatted recipes split and isolate methods correctly', () => {
  const text = `# Vegan Chili
Ingredients:
1 can black beans
1 can kidney beans
## Method
1. Combine all beans and spices in a large pot.
2. Simmer on low heat for 30 minutes.

# Golden Turmeric Rice
Ingredients:
200g basmati rice
1 tsp ground turmeric
## Instructions
1. Rinse rice until water runs clear.
2. Cook with turmeric until tender.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].title, 'Vegan Chili');
  assert.strictEqual(parsed[1].title, 'Golden Turmeric Rice');
  assert.strictEqual(parsed[0].instructions.length, 2);
  assert.strictEqual(parsed[1].instructions.length, 2);
});

// Test 5: Single newline separation between recipes
runTest('Recipes separated by only a single newline still detect boundaries', () => {
  const text = `Recipe 1: Chickpea Salad
Ingredients:
1 can chickpeas
1 cucumber
Method:
1. Dice cucumber and mix with chickpeas.
Recipe 2: Green Smoothie
Ingredients:
1 banana
1 cup spinach
Method:
1. Blend all ingredients until smooth.`;

  const blocks = unpackAndSplitRecipeBlocks(text);
  assert.strictEqual(blocks.length, 2, `Expected 2 blocks with single newline separator, got ${blocks.length}`);

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2);
  assert.strictEqual(parsed[0].instructions.length, 1);
  assert.strictEqual(parsed[1].instructions.length, 1);
});

// Test 6: Grouped layouts (Ingredients listed top, methods listed bottom)
runTest('Grouped layout matches and reallocates methods to corresponding recipes by title', () => {
  const text = `Recipe 1: Spiced Sweet Potato
Ingredients:
2 sweet potatoes
1 tsp cumin

Recipe 2: Lemon Herb Quinoa
Ingredients:
150g quinoa
1 lemon

Instructions:
Spiced Sweet Potato:
1. Roast sweet potatoes with cumin at 200C for 35 mins.

Lemon Herb Quinoa:
1. Rinse quinoa and boil in salted water.
2. Toss with fresh lemon juice and herbs.`;

  const parsed = parseBulkRecipeText(text);
  assert.strictEqual(parsed.length, 2, `Expected 2 parsed recipes, got ${parsed.length}`);
  assert.strictEqual(parsed[0].title, 'Spiced Sweet Potato');
  assert.ok(parsed[0].instructions.length >= 1, `Recipe 1 instructions missing, got ${parsed[0].instructions.length}`);
  assert.ok(parsed[0].instructions[0].includes('Roast sweet potatoes'));

  assert.strictEqual(parsed[1].title, 'Lemon Herb Quinoa');
  assert.ok(parsed[1].instructions.length >= 1, `Recipe 2 instructions missing, got ${parsed[1].instructions.length}`);
  assert.ok(parsed[1].instructions[0].includes('Rinse quinoa'));
});

// Test 7: User multi-recipe dump with inline Method, parentheticals, and varied divider styles
runTest('Batch text dump parses 4 complex recipes with exact ingredient and instruction counts', () => {
  const poutineText = `---

Recipe Title: Poutine
Page number: 214
Prep Time (hours and minutes): 0 Hours 25 Mins
Cook Time (Hours and minutes): 0 Hours 40 Mins
Ingredients:
For the chips:
1kg Maris Piper potatoes
vegetable oil or olive oil, for frying
sea salt
For the cheese curds:
75g raw unsalted cashews
35ml unsweetened almond milk
½ tsp white miso paste
1½ tsp apple cider vinegar
1½ tbsp nooch (nutritional yeast)
25g plant-based grated parmesan
½ small garlic clove
pinch of sea salt
For the gravy:
1 vegetable stock pot
300ml boiling water
3 red onions
4 garlic cloves
drizzle of olive oil
3 tbsp tomato purée
400ml plant-based red wine (mild flavoured)
3 thyme sprigs
2 large bay leaves (or 3 small)
1 tbsp tamari
2 tsp light brown sugar
pinch of sea salt
For the to serve:
handful of fresh flat-leaf parsley
pinch of black pepper

Method:

1. Soak the cashews in boiling water for at least 20 minutes to soften.
2. Cut the potatoes into thick chips (leaving skins on if preferred).
3. Place the chips in a large saucepan of cold salted water, bring to a boil, and simmer for 3 to 6 minutes until parboiled, then drain and dry on kitchen paper.
4. Dissolve the vegetable stock pot in 300ml boiling water.
5. Thinly slice the red onions and dice the garlic.
6. Heat olive oil in a saucepan over medium heat, fry the onions, garlic, and salt for 5 to 10 minutes until soft.
7. Add the tomato purée, red wine, thyme sprigs, bay leaves, tamari, brown sugar, and vegetable stock, bringing to a boil.
8. Reduce the heat and simmer gently for 25 minutes, splashing in extra water if the gravy becomes too thick.
9. Drain the soaked cashews and blend with the almond milk, white miso paste, apple cider vinegar, nutritional yeast, vegan parmesan, garlic, and salt until thick and creamy; chill in the fridge.
10. To cook the chips: Deep-fry in 4cm of hot vegetable oil at 180°C for 6 minutes until golden brown, or bake on a lined tray tossed in olive oil at 200°C for 40 minutes.
11. Pile the hot crispy chips onto a large sharing platter or individual plates.
12. Discard the bay leaves and thyme sprigs, then ladle a generous coating of hot gravy over the chips.
13. Spoon dollops of the cashew cheese curd over the hot gravy and chips.
14. Garnish with chopped flat-leaf parsley and cracked black pepper, serving immediately.

---

Recipe Title: Sausage Party Pizza
Page number: 216–217
Prep Time (hours and minutes): 0 Hours 45 Mins (plus 45 mins proving time)
Cook Time (Hours and minutes): 0 Hours 25 Mins
Ingredients:
For the pizza bases:
850g strong white bread flour, plus extra for dusting
150g finely ground semolina flour
1 tsp fine sea salt
14g fast-action dried yeast
1 tbsp caster sugar
70ml olive oil
650ml lukewarm water
For the sauce:
1 onion
3 small garlic cloves
40ml olive oil
2 x 400g tins best-quality Italian chopped tomatoes (we like Polpa tomatoes)
pinch of caster sugar
1 tsp sea salt
1 tsp dried oregano
For the garlic and herb dip:
120g plant-based mayonnaise
120g plant-based crème fraîche or plant-based cream cheese
1 tbsp cider vinegar
1 tsp salt
1 tsp garlic granules
1 tsp caster sugar
1 tsp Italian mixed herbs
pinch of black pepper
For the pizza topping:
2 tbsp olive oil
8 plant-based sausages
4 rosemary sprigs
20 pitted green olives
120g plant-based grated mozzarella
sea salt and black pepper

Method:

1. In a stand mixer fitted with a dough hook, mix the bread flour, semolina flour, salt, yeast, sugar, and olive oil.
2. Pour in the lukewarm water and knead on low speed for 10 minutes (or mix in a bowl and knead by hand for 10 minutes) until smooth and elastic.
3. Transfer the dough to an oiled bowl, cover, and let rise in a warm spot for 30 to 45 minutes until doubled in size.
4. For the pizza sauce, finely dice the onion and grate the garlic.
5. Heat 40ml olive oil in a saucepan over low-medium heat, sweating the onion and garlic for 10 minutes.
6. Increase the heat, add the chopped tomatoes, sugar, salt, and dried oregano, bringing to a boil.
7. Reduce heat to low, partially cover, and simmer for 15 to 25 minutes until rich and thick.
8. Whisk together all the dip ingredients in a bowl and chill in the fridge.
9. Heat 2 tbsp olive oil in a frying pan over medium-high heat, sauté the sausages and rosemary sprigs until browned, season with salt and pepper, and slice into rounds.
10. Slice the green olives and grate the mozzarella.
11. Preheat the oven to 250°C and place two heavy pizza trays inside to heat up.
12. Divide the risen dough into 8 equal balls; wrap 4 balls tightly in cling film to freeze for another day, and rest the remaining 4 balls under cling film for 15 minutes.
13. Stretch two dough balls by hand on a floured surface to form thin pizza bases with raised crusts, placing each on baking parchment.
14. Carefully slide the dough onto the hot baking trays, spread over tomato sauce, and top with sliced sausages, olives, and mozzarella.
15. Bake for 8 to 10 minutes until the crust is puffed and blistered and the cheese has melted.
16. Repeat with the remaining two fresh dough balls, slicing and serving hot with the garlic and herb dip.

Recipe Title: Cheesy Chicken Enchiladas and Mexican-Style Corn Salad
Prep Time (hours and minutes): 0 Hours 25 Mins
Cook Time (Hours and minutes): 0 Hours 50 Mins
Ingredients:
1 x 280g tin jackfruit in water
2 red, or red and yellow, peppers
½ aubergine
1 x pack plant-based chicken pieces (about 160g)
3 tbsp olive oil
2 tsp salt
250g tomatoes on the vine
4 tbsp olive oil
2 tbsp red wine vinegar
1 tsp sea salt
5 dried chipotle chillies
1 large onion
4 garlic cloves
2 tbsp maple syrup
1 tbsp ground cumin
2 tsp dried oregano
1 tsp smoked paprika
1 tsp ground cinnamon
150ml dry sherry
150ml water
95g smoked chipotle sauce
1 x 400g tin black beans
1 lemon
bunch of oregano leaves
20g fresh parsley leaves
1 tbsp olive oil
200g plant-based grated cheddar
200g plant-based grated mozzarella
8 large corn tortillas
sea salt
1 x 570g tin sweetcorn
1 tbsp olive oil
2 tsp sea salt
1 red onion
2 green peppers
6 spring onions
4 large green chillies
30g coriander leaves
100g lettuce
2 limes
1 tbsp plant-based mayonnaise
1 tsp cayenne pepper
handful of chives (to serve)
handful of coriander leaves (to serve)
Method: 1. Preheat the oven to 200°C. 2. Wash, drain, and pat-dry the jackfruit. Put it in a roasting tray and crush the chunks between your fingers to split the fibres, removing any seeds. Halve, core, and thinly slice the peppers. Trim and cut the aubergine into 1cm cubes. Add the peppers, aubergine, and plant-based chicken pieces to the roasting tray, drizzle with 3 tbsp olive oil, sprinkle with 2 tsp salt, and stir to coat. Roast in the oven for 30 minutes, stirring halfway through. 3. In a second roasting tray, toss the vine tomatoes with 2 tbsp olive oil, red wine vinegar, and 1 tsp sea salt. Roast alongside the vegetables for 30 minutes. 4. Put the dried chipotle chillies into a jug, cover with boiling water from a kettle, and leave for 12–15 minutes to rehydrate. 5. Warm the remaining 2 tbsp olive oil in a large frying pan over low-medium heat. Add the peeled and diced onion and minced/sliced garlic, sweating for 12–15 minutes until soft. Add the maple syrup, ground cumin, dried oregano, smoked paprika, and ground cinnamon, cooking for 2 minutes. 6. Drain the soaked chillies and add them to the frying pan along with the sherry, water, and smoked chipotle sauce. Reduce heat to a gentle simmer and cook for 20–25 minutes. Fold in the roasted tomatoes, take off the heat, and allow to cool to room temperature. Transfer the cooled sauce to a blender and blitz until smooth. 7. Drain the black beans and tip into a bowl. Pick and roughly chop the fresh oregano and parsley leaves. Add the juice of 1 lemon, 1 tbsp olive oil, grated cheeses, herbs, and a pinch of salt to the beans, stirring to combine. Fold in the roasted vegetable-chicken mixture and one-third of the blended enchilada sauce. 8. Tightly roll an eighth of the filling into each corn tortilla and lay them seam-side down into a roasting tray. Drizzle the remaining sauce down the middle of the enchiladas and bake for 20 minutes. 9. For the corn salad: Rinse and drain the sweetcorn and place in a bowl with 1 tbsp olive oil and 1 tsp sea salt. Peel and finely dice the red onion. Halve, core, and dice the green peppers. Trim and thinly slice the spring onions. Halve, deseed, and finely dice the green chillies. Pick and finely slice 30g coriander leaves. Shred the lettuce. Add these prepared vegetables to the sweetcorn along with the juice of 2 limes, plant-based mayonnaise, cayenne pepper, and remaining salt, folding thoroughly to combine. 10. Transfer 2 enchiladas onto each plate, spoon alongside the Mexican-style corn salad, garnish with chopped chives and coriander leaves, and serve immediately.

Recipe Title: Blackened Monk Chicken Noodles
Prep Time (hours and minutes): 0 Hours 25 Mins (plus 2 hours optional pickling)
Cook Time (Hours and minutes): 0 Hours 25 Mins
Ingredients:
1 large carrot
1 daikon (about 400g)
1 tbsp table salt
375ml boiling water
5 tbsp caster sugar
4 tbsp distilled white vinegar
150g black bean sauce
2 tsp brown rice miso paste
1½ tbsp tamari
1 tbsp rice vinegar
1 tbsp toasted sesame oil
sea salt
1 small head of broccoli
drizzle of olive oil
100g folded rice noodles
1 red onion
drizzle of toasted sesame oil
1 x pack plant-based chicken pieces (about 160g)
100g beansprouts
1 or 2 limes (to serve, optional)
handful of coriander leaves (to serve, optional)
50g salted peanuts (to serve, optional)
1 red chilli (to serve, optional)
handful of plant-based prawn crackers (to serve, optional)
sprinkle of sesame seeds (to serve, optional)
Method: 1. Peel and thinly slice the carrot and daikon, or cut them into matchsticks. Place in a bowl, mix with 1 tbsp table salt, and set aside for 20 minutes. Rinse thoroughly to remove the salt and pack into a sterilised jar or large bowl. Stir the boiling water, caster sugar, and white vinegar together until the sugar dissolves, then pour over the vegetables. Cover and leave to pickle for at least 2 hours (or 2–3 days for best results). 2. Preheat the oven to 180°C. 3. In a small bowl, whisk together the black bean sauce, brown rice miso paste, tamari, rice vinegar, 1 tbsp toasted sesame oil, and a pinch of salt until smooth. 4. Cut the broccoli into small florets, arrange on a baking tray, drizzle with olive oil, and season with a pinch of salt. Roast in the oven for 15–20 minutes until cooked through. 5. Cook the folded rice noodles in a small saucepan according to the packet instructions. Drain and rinse under cold running water to stop them sticking together. 6. Peel and roughly slice the red onion. Heat a drizzle of toasted sesame oil in a large saucepan over medium heat, add the onion and a pinch of salt, and cook for 5 minutes until soft. 7. Add the plant-based chicken pieces and fry for 3 minutes until browned on the outside. Stir in the beansprouts and cook for another 5 minutes. 8. Pour in the black bean sauce mixture and let it simmer for a few minutes. Fold in the roasted broccoli florets and cooked noodles, stirring for about 5 minutes until piping hot and evenly coated. 9. Cut the limes into wedges, chop the coriander and peanuts, and slice the red chilli. Dish the noodles onto serving plates, drain some of the pickled vegetables and place alongside, then garnish with lime wedges, prawn crackers, peanuts, red chilli, coriander, and sesame seeds.`;

  const parsed = parseBulkRecipeText(poutineText);
  assert.strictEqual(parsed.length, 4, `Expected 4 recipes, got ${parsed.length}`);

  // Recipe 1: Poutine
  assert.strictEqual(parsed[0].title, 'Poutine');
  assert.strictEqual(parsed[0].servings, null);
  assert.strictEqual(parsed[0].ingredients.length, 25);
  assert.strictEqual(parsed[0].instructions.length, 14);

  // Recipe 2: Sausage Party Pizza
  assert.strictEqual(parsed[1].title, 'Sausage Party Pizza');
  assert.strictEqual(parsed[1].servings, null);
  assert.strictEqual(parsed[1].ingredients.length, 28);
  assert.strictEqual(parsed[1].instructions.length, 16);

  // Recipe 3: Cheesy Chicken Enchiladas
  assert.strictEqual(parsed[2].title, 'Cheesy Chicken Enchiladas And Mexican-Style Corn Salad');
  assert.strictEqual(parsed[2].servings, null);
  assert.strictEqual(parsed[2].ingredients.length, 44);
  assert.strictEqual(parsed[2].instructions.length, 10);

  // Recipe 4: Blackened Monk Chicken Noodles
  assert.strictEqual(parsed[3].title, 'Blackened Monk Chicken Noodles');
  assert.strictEqual(parsed[3].servings, null);
  assert.strictEqual(parsed[3].ingredients.length, 25);
  assert.strictEqual(parsed[3].instructions.length, 9);
});

console.log(`\n=== MULTI-RECIPE PARSER TEST RUN COMPLETE ===`);
if (failures > 0) {
  console.error(`Total Failures: ${failures}`);
  process.exit(1);
} else {
  console.log(`All tests passed successfully!`);
}
