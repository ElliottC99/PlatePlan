import assert from 'node:assert';
import fs from 'node:fs';
import { resolveProductItemWeight, calculateItemNutrition } from '../src/services/NutritionService.js';
import { parseTescoProduct, guessItemWeight } from '../src/services/TescoImportService.js';

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

// 9. Bulk product with bookmarklet-copied itemWeight === packSize must NOT resolve to packSize as 1 item
const pBulkYoghurt = parseTescoProduct({
  name: 'Tesco Natural Yoghurt 500G',
  brand: 'Tesco',
  packSize: 500,
  packUnit: 'g',
  itemWeight: 500,
  itemCount: 1,
  cal: 65,
  prot: 5.2
});
assert.strictEqual(pBulkYoghurt.success, true);
assert(!pBulkYoghurt.data.itemWeight, 'Bulk 500g yoghurt must not copy packSize (500) into itemWeight');
assert.strictEqual(
  resolveProductItemWeight({ name: 'Tesco Natural Yoghurt 500G', packSize: 500, packUnit: 'g', itemWeight: 500, itemCount: 1 }),
  0,
  'resolveProductItemWeight must return 0 when itemWeight === packSize on a bulk product'
);

// 10. Multipack product where bookmarklet copied packSize into itemWeight must divide by embedded count
assert.strictEqual(
  resolveProductItemWeight({ name: 'Linda McCartney 6 Vegan Sausages', packSize: 270, itemWeight: 270, itemCount: 1 }),
  45,
  'Multipack with legacy itemWeight === packSize (270) must resolve to 270/6 = 45g'
);

const pBuns = parseTescoProduct({
  name: 'Tesco Finest 4 Brioche Burger Buns 200G',
  brand: 'Tesco',
  packSize: 200,
  packUnit: 'g',
  itemWeight: 200,
  itemCount: 1,
  cal: 280,
  prot: 8.5
});
assert.strictEqual(pBuns.data.itemWeight, 50, '4 Brioche Burger Buns 200G should derive itemWeight = 200 / 4 = 50g');

// 11. ProductBankView unit dropdowns must not force-sync each other
const pbvSource = fs.readFileSync(new URL('../src/views/ProductBankView.js', import.meta.url), 'utf8');
assert(!pbvSource.includes('syncUnitSelects('), 'ProductBankView must not couple mi-pack-unit, mi-item-weight-unit, and mi-drained-weight-unit via syncUnitSelects');

console.log('=== ALL PRODUCT-DRIVEN ITEM WEIGHT CHECKS PASSED ===');
