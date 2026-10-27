/**
 * scripts/test_category_deletion.js
 * Verification test script to mock a category deletion and merge duplicates algorithm,
 * and verify that no orphaned references remain in the linked items array.
 */

import { strict as assert } from 'assert';

console.log('=== RUNNING CATEGORY REFERENTIAL INTEGRITY & DELETION TESTS ===');

// Mock a lightweight Firestore-like database
const mockDb = {
  batch() {
    const operations = [];
    return {
      update(ref, data) {
        operations.push({ type: 'update', ref, data });
      },
      set(ref, data, options) {
        operations.push({ type: 'set', ref, data, options });
      },
      delete(ref) {
        operations.push({ type: 'delete', ref });
      },
      commit() {
        // Apply operations to mock data
        operations.forEach(op => {
          if (op.type === 'update') {
            Object.assign(op.ref.data, op.data);
          } else if (op.type === 'set') {
            if (op.options && op.options.merge) {
              Object.assign(op.ref.data, op.data);
            } else {
              op.ref.data = { ...op.data };
            }
          } else if (op.type === 'delete') {
            op.ref.deleted = true;
          }
        });
        return Promise.resolve();
      }
    };
  }
};

// Mock the household ID and database
const HOUSEHOLD_ID = 'elliott-chloe';

// Sample raw data matching our Firestore schema
const mockIngredients = [
  {
    id: 'firm-tofu',
    name: 'Firm Tofu',
    category: 'Produce',
    cat: 'produce',
    subtypes: [
      { id: 'smoked-tofu', name: 'Smoked Tofu', category: 'Produce', cat: 'produce' }
    ]
  },
  {
    id: 'milk',
    name: 'Whole Milk',
    category: 'dairy-eggs',
    cat: 'dairy-eggs',
    subtypes: []
  },
  {
    id: 'choc-chip',
    name: 'Chocolate Chips',
    category: 'Baking',
    cat: 'baking',
    subtypes: []
  }
];

const mockProducts = [
  {
    id: 'tofu-pack',
    name: 'Organic Firm Tofu 400g',
    category: 'Produce',
    cat: 'produce'
  },
  {
    id: 'milk-carton',
    name: 'Cravendale Milk 1L',
    category: 'Dairy & Eggs',
    cat: 'dairy-eggs'
  }
];

const mockSettingsCategories = {
  categories: ['Produce', 'Dairy & Eggs', 'Baking', 'Other']
};

// Emulate collection fetches
const mockIngSnap = {
  docs: mockIngredients.map(ing => ({
    id: ing.id,
    ref: { data: ing },
    data() { return ing; }
  }))
};

const mockProdSnap = {
  docs: mockProducts.map(prod => ({
    id: prod.id,
    ref: { data: prod },
    data() { return prod; }
  }))
};

const mockCatsSnap = {
  exists: true,
  data() { return mockSettingsCategories; }
};

// Test 1: Category Deletion (repainting Produce to Uncategorised)
console.log('--- Test 1: Category Deletion and Cascade Re-parenting ---');

const strictNormalize = (str) => {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]+$/, '');
};
const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');

const runMockDeleteCategory = async (categoryName, fallbackCatName = 'Uncategorised') => {
  const batch = mockDb.batch();
  const deleteNormalized = strictNormalize(categoryName);

  // 1. Re-parent ingredients
  mockIngSnap.docs.forEach(doc => {
    const ing = doc.data();
    let changed = false;
    if (strictNormalize(ing.category) === deleteNormalized) {
      ing.category = fallbackCatName;
      ing.cat = slugifyToKebab(fallbackCatName);
      changed = true;
    }
    if (Array.isArray(ing.subtypes)) {
      ing.subtypes.forEach(st => {
        if (strictNormalize(st.category) === deleteNormalized) {
          st.category = fallbackCatName;
          st.cat = slugifyToKebab(fallbackCatName);
          changed = true;
        }
      });
    }
    if (changed) {
      batch.update(doc.ref, { 
        category: ing.category,
        cat: ing.cat,
        subtypes: ing.subtypes,
        updatedAt: new Date().toISOString()
      });
    }
  });

  // 2. Re-parent products
  mockProdSnap.docs.forEach(doc => {
    const prod = doc.data();
    if (strictNormalize(prod.category) === deleteNormalized) {
      batch.update(doc.ref, {
        category: fallbackCatName,
        cat: slugifyToKebab(fallbackCatName),
        updatedAt: new Date().toISOString()
      });
    }
  });

  // 3. Update categories settings array
  const updatedCats = mockSettingsCategories.categories.filter(c => strictNormalize(c) !== deleteNormalized);
  batch.set({ data: mockSettingsCategories }, { categories: updatedCats }, { merge: true });

  await batch.commit();
};

await runMockDeleteCategory('Produce');

// Verification
assert.equal(mockIngredients[0].category, 'Uncategorised');
assert.equal(mockIngredients[0].subtypes[0].category, 'Uncategorised');
assert.equal(mockProducts[0].category, 'Uncategorised');
assert(!mockSettingsCategories.categories.includes('Produce'));

console.log('✅ Test 1 Passed: Deletion cascaded perfectly to items, subtypes, and products with zero orphaned references.');

// Test 2: Category Merge
console.log('--- Test 2: Category Merge and Re-pointing ---');

mockIngredients[1].category = 'Dairy'; // Reset for merge
mockIngredients[1].cat = 'dairy';
mockProducts[1].category = 'Dairy';
mockProducts[1].cat = 'dairy';

const runMockMergeCategory = async (sourceCat, targetCat) => {
  const batch = mockDb.batch();
  const sourceNormalized = strictNormalize(sourceCat);
  const targetNormalized = strictNormalize(targetCat);

  mockIngSnap.docs.forEach(doc => {
    const ing = doc.data();
    let changed = false;
    if (strictNormalize(ing.category) === sourceNormalized) {
      ing.category = targetCat;
      ing.cat = slugifyToKebab(targetCat);
      changed = true;
    }
    if (Array.isArray(ing.subtypes)) {
      ing.subtypes.forEach(st => {
        if (strictNormalize(st.category) === sourceNormalized) {
          st.category = targetCat;
          st.cat = slugifyToKebab(targetCat);
          changed = true;
        }
      });
    }
    if (changed) {
      batch.update(doc.ref, { 
        category: ing.category,
        cat: ing.cat,
        subtypes: ing.subtypes,
        updatedAt: new Date().toISOString()
      });
    }
  });

  mockProdSnap.docs.forEach(doc => {
    const prod = doc.data();
    if (strictNormalize(prod.category) === sourceNormalized) {
      batch.update(doc.ref, {
        category: targetCat,
        cat: slugifyToKebab(targetCat),
        updatedAt: new Date().toISOString()
      });
    }
  });

  const updatedCats = mockSettingsCategories.categories.filter(c => strictNormalize(c) !== sourceNormalized);
  if (!updatedCats.some(c => strictNormalize(c) === targetNormalized)) {
    updatedCats.push(targetCat);
  }
  batch.set({ data: mockSettingsCategories }, { categories: updatedCats }, { merge: true });

  await batch.commit();
};

await runMockMergeCategory('Dairy', 'Dairy & Eggs');

assert.equal(mockIngredients[1].category, 'Dairy & Eggs');
assert.equal(mockProducts[1].category, 'Dairy & Eggs');
console.log('✅ Test 2 Passed: Merge repointed source categories to destination categories perfectly.');

console.log('=== ALL CATEGORY INTEGRITY TESTS PASSED SUCCESSFULLY ===');
