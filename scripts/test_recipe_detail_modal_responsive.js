/**
 * scripts/test_recipe_detail_modal_responsive.js
 * Unit and responsive layout verification for Recipe Detail Modal.
 * Verifies mobile layout readability, unified scroll container, and un-cramped headers.
 */

import assert from 'node:assert';

// Mock minimal DOM globals
if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}
global.window = {
  localStorage: global.localStorage,
  ppEscapeHtml: (s) => String(s ?? ''),
  Store: { getState: () => ({ rootItems: [], ingredients: [], products: [], preferences: {} }) }
};

const { renderRecipeDetailModalContent, formatRecipeIngredientRow, renderRecipeIngredientsListHTML } = await import('../src/components/recipe/RecipeDetailModalUI.js');

console.log('=== RUNNING RECIPE DETAIL MODAL RESPONSIVE VERIFICATION SUITE ===\n');

const mockRecipe = {
  id: 'rec_jacket_potatoes',
  name: 'Crispy Jacket Potatoes With Chestnut Butter',
  time: 45,
  types: ['Dinner'],
  serves: 4,
  ingredientSections: [
    {
      sectionTitle: 'Main Ingredients',
      ingredients: [
        { name: 'Potatoes', qty: 6, unit: 'qty', comment: 'about 8.5cm long' },
        { name: 'Vegetable Oil', qty: 15, unit: 'ml' }
      ]
    },
    {
      sectionTitle: 'Chestnut Butter',
      ingredients: [
        { name: 'Vacuum-Packed Cooked Chestnuts', qty: 70, unit: 'g' },
        { name: 'Maple Syrup', qty: 5, unit: 'ml' }
      ]
    }
  ],
  methodSteps: [
    'Pierce the potatoes with a sharp knife and microwave on high for 15 minutes.',
    'Blend cooked chestnuts and maple syrup until completely smooth.'
  ]
};

const html = renderRecipeDetailModalContent({
  r: mockRecipe,
  recipe: mockRecipe,
  activeR: mockRecipe,
  ingredientsCount: 4,
  stepsCount: 2,
  ingredientsHtml: renderRecipeIngredientsListHTML(mockRecipe.ingredientSections.flatMap(s => s.ingredients), {}, 1, mockRecipe.ingredientSections),
  methodHtml: '<div class="recipe-method-step-card"><span class="step-num">1</span><div>Step 1</div></div>'
});

// Test 1: Unified Scroll Body Container Architecture
console.log('--- Test 1: Unified Scroll Body Container Architecture ---');
assert(html.includes('class="recipe-view-scroll-body"'), 'Modal must have .recipe-view-scroll-body wrapping content to eliminate letterboxing');
const scrollIdx = html.indexOf('class="recipe-view-scroll-body"');
const crossbarIdx = html.indexOf('class="recipe-modal-crossbar"');
const bodyGridIdx = html.indexOf('class="recipe-modal-body');
assert(scrollIdx < crossbarIdx, '.recipe-view-scroll-body must enclose .recipe-modal-crossbar so crossbar scrolls naturally on mobile');
assert(crossbarIdx < bodyGridIdx, '.recipe-modal-crossbar must precede .recipe-modal-body');
console.log('✅ Test 1 Passed: Crossbar and grid enclosed in single unified scroll body.');

// Test 2: Separated Header & Action Navigation
console.log('\n--- Test 2: Separated Header & Action Navigation ---');
assert(html.includes('class="recipe-view-nav-main"'), 'Modal navigation must have .recipe-view-nav-main separating title/icons');
assert(html.includes('class="recipe-view-nav-title"'), 'Modal navigation must have .recipe-view-nav-title');
assert(html.includes('class="recipe-view-nav-actions"'), 'Modal navigation must have .recipe-view-nav-actions for toolbar');
assert(html.includes('class="recipe-view-nav-icons"'), 'Modal navigation must have .recipe-view-nav-icons for close and fav buttons');
console.log('✅ Test 2 Passed: Mobile navigation hierarchy isolates title width from action buttons.');

// Test 3: Essential DOM IDs preserved
console.log('\n--- Test 3: Essential DOM IDs preserved ---');
assert(html.includes('id="recipe-modal-ingredients-list"'), 'Must preserve #recipe-modal-ingredients-list for dynamic portion scaling');
assert(html.includes('id="preview-serves"'), 'Must preserve #preview-serves input');
assert(html.includes('id="modal-recipe-review-btn"'), 'Must preserve #modal-recipe-review-btn');
assert(html.includes('id="modal-recipe-fav-btn"'), 'Must preserve #modal-recipe-fav-btn');
console.log('✅ Test 3 Passed: All required interaction and scaling IDs preserved.');

// Test 4: CSS Media Query Rules
console.log('\n--- Test 4: CSS Media Query Rules for Mobile Viewport ---');
assert(html.includes('@media (max-width: 768px)') || html.includes('@media(max-width:768px)'), 'Inline style must contain mobile media query for 768px breakpoint');
assert(html.includes('grid-template-columns: 1fr'), 'Mobile media query must collapse grid to single column');
console.log('✅ Test 4 Passed: Responsive styles included for single-column mobile view.');

console.log('\n🎉 ALL RECIPE DETAIL MODAL RESPONSIVE TESTS PASSED SUCCESSFULLY!');
