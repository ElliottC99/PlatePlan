/**
 * scripts/test_recipe_importer.js
 * Automated test suite for RecipeImporter natural language parsing and JSON-LD extraction.
 */

import {
  parseIngredientString,
  matchIngredientTaxonomy,
  extractRecipeFromHtml,
  importRecipeFromHtml
} from '../src/services/RecipeImporter.js';

console.log('=== RUNNING RECIPE IMPORTER VERIFICATION SUITE ===\n');

// 1. Test Natural Language Parsing
const sampleIngredients = [
  "200g firm tofu, drained and cubed",
  "1 1/2 tsp smoked paprika",
  "½ cup diced onion (optional)",
  "400g block extra firm tofu, pressed",
  "2 cloves garlic, minced"
];

console.log('--- Test 1: Natural Language Ingredient Parsing ---');
sampleIngredients.forEach(raw => {
  const parsed = parseIngredientString(raw);
  console.log(`Input: "${raw}"`);
  console.log(`Parsed:`, JSON.stringify(parsed, null, 2));
  console.log('---');
});

// 2. Test Taxonomy Matching
const mockTaxonomy = [
  { id: 'ing-garlic-1', name: 'Garlic' },
  { id: 'ing-tofu-1', name: 'Firm Tofu' },
  { id: 'ing-onion-1', name: 'Onion' }
];

console.log('\n--- Test 2: Taxonomy Matching ---');
sampleIngredients.forEach(raw => {
  const parsed = parseIngredientString(raw);
  const matched = matchIngredientTaxonomy(parsed, mockTaxonomy);
  console.log(`Name: "${parsed.name}" -> Matched: ${matched.isNewTaxonomyItem ? 'NEW ITEM' : matched.matchedName + ' (' + matched.ingredientId + ')'}`);
});

// 3. Test JSON-LD HTML Extraction
const sampleJsonLdHtml = `
<!DOCTYPE html>
<html>
<head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "High-Protein Crispy Tofu Curry",
  "image": "https://example.com/tofu-curry.jpg",
  "recipeYield": "4 portions",
  "prepTime": "PT15M",
  "cookTime": "PT30M",
  "recipeIngredient": [
    "400g block extra firm tofu, pressed and cubed",
    "1 1/2 tsp smoked paprika",
    "2 cloves garlic, minced",
    "400g can chopped tomatoes"
  ],
  "recipeInstructions": [
    { "@type": "HowToStep", "text": "Press the tofu block and cut into 2cm cubes." },
    { "@type": "HowToStep", "text": "Sauté garlic and smoked paprika in olive oil." },
    { "@type": "HowToStep", "text": "Add chopped tomatoes and simmer for 20 minutes." }
  ],
  "nutrition": {
    "@type": "NutritionInformation",
    "calories": "480 kcal",
    "proteinContent": "28g",
    "carbohydrateContent": "35 grams",
    "fatContent": "18.5g",
    "fiberContent": "8g"
  }
}
</script>
</head>
<body></body>
</html>
`;

console.log('\n--- Test 3: JSON-LD HTML Recipe Extraction ---');
const imported = importRecipeFromHtml(sampleJsonLdHtml, 'https://example.com/recipes/tofu-curry');
console.log('Imported Recipe Result:', JSON.stringify(imported, null, 2));

console.log('\n=== TEST SUITE COMPLETED ===');
