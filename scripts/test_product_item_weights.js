import assert from 'node:assert';
import { resolveProductItemWeight, calculateItemNutrition } from '../src/services/NutritionService.js';

console.log('=== RUNNING PRODUCT-DRIVEN ITEM WEIGHT SUITE ===\n');

// 1. Explicit top-level itemWeight
const pExplicit = {
  name: '10 Reduced Fat Mild Slices',
  itemWeight: 20,
  packSize: 200,
  itemCount: 10,
  cal: 180,
  prot: 15.8
};
assert.strictEqual(resolveProductItemWeight(pExplicit), 20, 'Top-level itemWeight should resolve to 20g');

// 2. Explicit itemWeight inside value object
const pValueExplicit = {
  name: 'Veggie Bacon Pieces',
  itemWeight: null,
  value: {
    itemWeight: 100
  }
};
assert.strictEqual(resolveProductItemWeight(pValueExplicit), 100, 'Nested value.itemWeight should resolve to 100g');

// 3. Derived from packSize / itemCount
const pCount = {
  name: 'Protein Patties',
  itemWeight: null,
  packSize: 400,
  itemCount: 4
};
assert.strictEqual(resolveProductItemWeight(pCount), 100, 'packSize / itemCount should resolve to 100g');

// 4. Derived from drainedWeight / itemCount
const pDrainedCount = {
  name: 'Whole Pickled Gherkins',
  itemWeight: null,
  drainedWeight: 370,
  packSize: 600,
  itemCount: 10
};
assert.strictEqual(resolveProductItemWeight(pDrainedCount), 37, 'drainedWeight / itemCount should resolve to 37g');

// 5. Embedded count in product name
const pNameCount = {
  name: 'Linda McCartney 6 Vegan Red Onion & Rosemary Sausages',
  itemWeight: null,
  packSize: 270
};
assert.strictEqual(resolveProductItemWeight(pNameCount), 45, 'Name leading count should resolve to 270/6 = 45g');

const pTwinPack = {
  name: 'Little Gem Lettuce Twin Pack',
  itemWeight: null,
  packSize: 160
};
assert.strictEqual(resolveProductItemWeight(pTwinPack), 80, 'Twin pack name should resolve to 160/2 = 80g');

// 6. Embedded count in notes
const pNotesCount = {
  name: 'Plant Burgers',
  itemWeight: null,
  packSize: 226,
  notes: '2 Burgers'
};
assert.strictEqual(resolveProductItemWeight(pNotesCount), 113, 'Notes count should resolve to 226/2 = 113g');

// 7. Single item packed in liquid with drainedWeight
const pMozzarella = {
  name: 'Mozzarella Ball',
  drainedWeight: 125,
  packSize: 210,
  packUnit: 'each'
};
assert.strictEqual(resolveProductItemWeight(pMozzarella), 125, 'Single item in liquid with drainedWeight should resolve to 125g');

// 8. calculateItemNutrition using discrete quantities
// 4 slices of cheese: 4 * 20g = 80g. At 180 kcal/100g and 15.8g prot/100g:
// 80/100 * 180 = 144 kcal, 80/100 * 15.8 = 12.64g protein
const cheeseNutrition = calculateItemNutrition(pExplicit, 4, 'qty');
assert.strictEqual(cheeseNutrition.kcal, 144, '4 cheese slices should equal 144 kcal');
assert.strictEqual(Math.round(cheeseNutrition.protein * 10) / 10, 12.6, '4 cheese slices should equal 12.6g protein');

// 2 burger patties: 2 * 113g = 226g. At 200 kcal/100g:
const burgerNutrition = calculateItemNutrition({ ...pNotesCount, cal: 200, prot: 18 }, 2, 'qty');
assert.strictEqual(burgerNutrition.kcal, 452, '2 burger patties should equal 452 kcal');

console.log('=== ALL PRODUCT-DRIVEN ITEM WEIGHT CHECKS PASSED ===');
