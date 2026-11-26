/**
 * scripts/test_app_performance_guards.js
 * Regression checks for performance guards:
 * 1. Name sorting skips Fit Score calculation; fit sorting attaches reusable precomputed results.
 * 2. renderVaultRecipeCard reuses precomputed fit results without redundant calculateMealFitScore calls.
 * 3. DataQualityView mount/unmount does not leak duplicate document state listeners.
 * 4. RecipeProductSolver 2D DP fallback stays bounded on large category pools.
 */

import assert from 'node:assert/strict';

const listeners = new Map();
globalThis.document = {
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  },
  removeEventListener(type, fn) {
    listeners.get(type)?.delete(fn);
  },
  getElementById() {
    return null;
  },
  querySelectorAll() {
    return [];
  }
};
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  Store: { getState: () => ({ recipes: [], ingredients: [], products: [], preferences: {} }) }
};

const { getSortedRecipes } = await import('../src/services/FitScoreService.js');
const { renderVaultRecipeCard } = await import('../src/components/vault/VaultRecipeCard.js');
const { mount: mountDQ, unmount: unmountDQ } = await import('../src/views/DataQualityView.js');
const { solveOptimalRecipeProducts } = await import('../src/services/RecipeProductSolver.js');

// 1. Name sort skips scoring; fit sort attaches reusable precomputed results
{
  const sampleRecipes = [
    { id: 'r1', name: 'Zucchini Pasta', serves: 2, types: ['dinner'], nutrition: { perServing: { cal: 550, prot: 40 } } },
    { id: 'r2', name: 'Apple Oats', serves: 2, types: ['breakfast'], nutrition: { perServing: { cal: 420, prot: 30 } } }
  ];

  const byName = getSortedRecipes(sampleRecipes, 'name-asc', 'all', { activeProfile: 'everyone' });
  assert.equal(byName[0].id, 'r2');
  assert.equal(byName[1].id, 'r1');
  assert.equal(byName[0]._precomputedFitOrig, undefined, 'name-asc must not score recipes');

  const byFit = getSortedRecipes(sampleRecipes, 'fit-desc', 'all', { activeProfile: 'everyone' });
  assert.ok(byFit[0]._precomputedFitOrig, 'fit-desc must attach _precomputedFitOrig');
  assert.equal(byFit[0]._precomputedFitKey, 'all::everyone');

  // 2. renderVaultRecipeCard reuses _precomputedFitOrig without invoking window.calculateMealFitScore
  let calcCalls = 0;
  globalThis.window.calculateMealFitScore = () => {
    calcCalls++;
    return { score: 80, mealType: 'dinner', details: { elliott: { recipeKcal: 500, recipeProtein: 40 }, chloe: { recipeKcal: 400, recipeProtein: 30 } } };
  };
  const html = renderVaultRecipeCard(byFit[0], { mealType: 'all', activeProfile: 'everyone' });
  assert.ok(html.includes('recipe-card'), 'card HTML should render');
  assert.equal(calcCalls, 0, 'renderVaultRecipeCard must reuse _precomputedFitOrig');
}

// 3. DataQualityView mount/unmount does not leak duplicate listeners
{
  mountDQ(null);
  const countAfterFirstMount = listeners.get('plateplan:state:recipes')?.size || 0;
  assert.equal(countAfterFirstMount, 1, 'should attach exactly 1 listener per event');

  mountDQ(null);
  mountDQ(null);
  const countAfterRepeatedMounts = listeners.get('plateplan:state:recipes')?.size || 0;
  assert.equal(countAfterRepeatedMounts, 1, 'repeated mounts must not stack duplicate listeners');

  unmountDQ();
  const countAfterUnmount = listeners.get('plateplan:state:recipes')?.size || 0;
  assert.equal(countAfterUnmount, 0, 'unmount must remove all state listeners');
}

// 4. RecipeProductSolver 2D DP fallback stays bounded on 8 lines x 60 category products
{
  const products = [];
  for (let i = 0; i < 60; i++) {
    products.push({
      id: `p_${i}`,
      name: `Prod ${i}`,
      category: 'Fruit & Vegetables',
      kcal: 20 + i * 7,
      protein: 0.5 + i * 0.4,
      price: 1 + (i % 5) * 0.2,
      packSize: 200
    });
  }
  const recipe = {
    id: 'cat_stress_guard',
    name: 'Category Stress',
    serves: 2,
    types: ['dinner'],
    ingredients: Array.from({ length: 8 }, (_, i) => ({
      name: `Veg ${i}`,
      category: 'Fruit & Vegetables',
      qty: 100,
      unit: 'g'
    }))
  };

  const t0 = performance.now();
  const res = solveOptimalRecipeProducts(recipe, {
    variant: 'original',
    mealType: 'dinner',
    activeProfile: 'everyone',
    products,
    ingredients: [],
    preferences: {}
  });
  const elapsedMs = performance.now() - t0;
  assert.ok(res && typeof res.score === 'number', 'solver must return a valid result');
  assert.ok(elapsedMs < 100, `DP fallback should finish well under 100ms, took ${elapsedMs.toFixed(1)}ms`);
  console.log(`✅ test_app_performance_guards passed (DP 8x60: ${elapsedMs.toFixed(1)}ms)`);
}
