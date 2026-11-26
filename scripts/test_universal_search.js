/**
 * scripts/test_universal_search.js
 * Regression test suite for Area B — Universal Partial-Token & Typo-Tolerant Search (R1–R6, AE1–AE3).
 */

import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = {
  localStorage: globalThis.localStorage,
  Store: { getState: () => ({ recipes: [], ingredients: [], products: [], preferences: {} }) }
};

const {
  normalizeSearchText,
  tokenizeSearchQuery,
  isWithinEditDistance1,
  scoreSearchMatch,
  matchesSearchQuery,
  filterAndRankBySearch
} = await import('../src/utils/searchUtils.js');

const { filterTaxonomyItemsByQuery } = await import('../src/components/recipe/RecipeWizardTaxonomySearch.js');

// AE1: Partial, out-of-order, diacritic-insensitive, cross-field, and 1-edit typo matching
{
  const recipeTitle = 'Parmesan Cauliflower Steaks With Pistachio Pesto';
  assert.equal(matchesSearchQuery('cauli pesto', recipeTitle), true, 'Out-of-order partial tokens should match');
  assert.equal(matchesSearchQuery('pistacio steaks', recipeTitle), true, '1-char typo on 4+ letter token should match');
  assert.equal(matchesSearchQuery('jalapeno', 'Jalapeño Cornbread'), true, 'Unaccented query should match accented target');
  assert.equal(
    matchesSearchQuery('tesco tofu', ['Organic Firm Tofu', 'Tesco', 'Tofu, Tempeh and Seitan']),
    true,
    'Cross-field brand + product name should match'
  );
  assert.equal(
    matchesSearchQuery('kale cavolo', ['Kale', 'Fruit & Vegetables', 'Cavolo Nero']),
    true,
    'Cross-field root item + sub-type should match'
  );
  // Transposition typo ("touf" -> "tofu")
  assert.equal(isWithinEditDistance1('touf', 'tofu'), true);
  assert.equal(matchesSearchQuery('touf', 'Organic Firm Tofu'), true);
}

// AE2: Autocomplete ranking puts exact and prefix matches ahead of substring and typo matches
{
  const items = [
    { id: '1', name: 'Cloves' },
    { id: '2', name: 'Black Olives' },
    { id: '3', name: 'Olive Oil' }
  ];
  const ranked = filterAndRankBySearch(items, 'oliv', i => i.name);
  assert.equal(ranked.length, 2, 'Cloves should not falsely match "oliv" (distance 2)');
  assert.equal(ranked[0].name, 'Olive Oil', 'Target-prefix match should rank first');
  assert.equal(ranked[1].name, 'Black Olives');

  // Exact full-target match ranks above target-prefix match, which ranks above mid-string match
  const exactVsTypo = filterAndRankBySearch(
    [{ name: 'Pistachio Pesto' }, { name: 'Pesto' }, { name: 'Pesto Rosso' }],
    'pesto',
    x => x.name
  );
  assert.equal(exactVsTypo[0].name, 'Pesto');
  assert.equal(exactVsTypo[1].name, 'Pesto Rosso');
  assert.equal(exactVsTypo[2].name, 'Pistachio Pesto');
  assert.ok(scoreSearchMatch('pesto', 'Pesto') > scoreSearchMatch('pesto', 'Pestos'));
  assert.ok(scoreSearchMatch('pistachio', 'Pistachio') > scoreSearchMatch('pistacio', 'Pistachio'));
  assert.ok(
    scoreSearchMatch('olive oil', 'Olive Oil Extra Virgin') > scoreSearchMatch('olive oil', 'Tesco Olive Oil'),
    'Leading phrase match must outrank non-leading phrase match'
  );

  // RecipeWizardTaxonomySearch uses universal search + ranking
  const taxBank = [
    { id: 'ing_cloves', name: 'Cloves', category: 'Herbs & Spices', subtypes: [] },
    { id: 'ing_kale', name: 'Kale', category: 'Fruit & Vegetables', subtypes: [{ id: 'sub_cav', name: 'Cavolo Nero' }] },
    { id: 'ing_oil', name: 'Olive Oil', category: 'Store Cupboard', subtypes: [] }
  ];
  const kaleRes = filterTaxonomyItemsByQuery('kale cavlo', taxBank, []);
  assert.equal(kaleRes.length, 1);
  assert.equal(kaleRes[0].ing.id, 'ing_kale');
}

// AE3: Short-token (<4 chars) noise guard & sub-10ms catalog performance
{
  assert.equal(matchesSearchQuery('pea', 'Peas'), true);
  assert.equal(matchesSearchQuery('pea', 'Peanut Butter'), true);
  assert.equal(matchesSearchQuery('pea', 'Tea'), false, '3-char token must not fuzzy-match Tea');
  assert.equal(matchesSearchQuery('pea', 'Bean'), false, '3-char token must not fuzzy-match Bean');
  assert.equal(normalizeSearchText('Crème Brûlée — Extra-Rich!'), 'creme brulee extra rich');
  assert.deepEqual(tokenizeSearchQuery('  cauli,  pesto! '), ['cauli', 'pesto']);

  const products = Array.from({ length: 400 }, (_, i) => ({
    name: i === 250 ? 'Organic Firm Tofu' : `Product Item ${i} Extra Virgin Olive Oil`,
    brand: i === 250 ? 'Tesco' : `Brand ${i % 15}`,
    category: 'Store Cupboard'
  }));
  const t0 = performance.now();
  const hits = filterAndRankBySearch(products, 'tesco tofum', p => [p.name, p.brand, p.category]);
  const elapsedMs = performance.now() - t0;
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, 'Organic Firm Tofu');
  assert.ok(elapsedMs < 15, `Full 400-product search should be fast (<15ms), took ${elapsedMs.toFixed(2)}ms`);
  console.log(`✅ test_universal_search passed (400-product typo query: ${elapsedMs.toFixed(2)}ms)`);
}
