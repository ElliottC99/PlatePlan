/**
 * src/services/CategoryMergeRepository.js (v3.38.54)
 * Dedicated repository for category merging and multi-item duplicate consolidation.
 * Handles cascading category reassignment across ingredients, products, and recipes.
 * Strictly scopes all operations to 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { getState as getStoreState, setIngredients, setProducts, setCategories } from '../store/store.js';
import { isDbAvailable } from './RecipeFirestoreRepository.js';
import { getRootItems, saveRootItem } from './PantryTaxonomyService.js';
import { getProducts, saveProduct } from './ProductRepository.js';

const strictNorm = (str) => String(str || '').toLowerCase().trim();
const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');
const slugCategory = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function cascadeReassignment(ingList = [], prodList = [], sourceNorm, cleanTargetCat, targetKebab) {
  const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
  const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];
  const changedIngIds = new Set(), changedSubtypeIds = new Set(), changedProdIds = new Set();

  updatedIngs.forEach(ing => {
    if (strictNorm(ing.category) === sourceNorm) {
      ing.category = cleanTargetCat; ing.cat = targetKebab; ing.updatedAt = new Date().toISOString();
      changedIngIds.add(String(ing.id));
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(st => {
          st.category = cleanTargetCat; st.cat = targetKebab;
          if (st.id) changedSubtypeIds.add(String(st.id));
        });
      }
      updatedProds.forEach(prod => {
        if (String(prod.ingredientId || prod.groupId || '') === String(ing.id)) {
          prod.category = cleanTargetCat; prod.cat = targetKebab; prod.updatedAt = new Date().toISOString();
          changedProdIds.add(String(prod.id));
        }
      });
    }
    if (Array.isArray(ing.subtypes)) {
      ing.subtypes.forEach(st => {
        if (strictNorm(st.category) === sourceNorm) {
          st.category = cleanTargetCat; st.cat = targetKebab;
          if (st.id) changedSubtypeIds.add(String(st.id));
          changedIngIds.add(String(ing.id));
          updatedProds.forEach(prod => {
            if (String(prod.subtypeId || '') === String(st.id)) {
              prod.category = cleanTargetCat; prod.cat = targetKebab; prod.updatedAt = new Date().toISOString();
              changedProdIds.add(String(prod.id));
            }
          });
        }
      });
    }
  });

  updatedProds.forEach(prod => {
    if (strictNorm(prod.category) === sourceNorm) {
      prod.category = cleanTargetCat; prod.cat = targetKebab; prod.updatedAt = new Date().toISOString();
      changedProdIds.add(String(prod.id));
    }
  });

  return { updatedIngs, updatedProds, changedIngIds, changedProdIds };
}

export async function mergeCategory(sourceCat, targetCat) {
  if (!sourceCat || !targetCat) return { success: false, error: 'Missing source or target' };

  const sourceNorm = strictNorm(sourceCat);
  const targetNorm = strictNorm(targetCat);
  const cleanTargetCat = String(targetCat).trim();
  const targetKebab = slugifyToKebab(cleanTargetCat);

  const state = getStoreState() || {};
  const currentCats = Array.isArray(state.categories) ? [...state.categories] : [];
  const filteredCats = currentCats.filter(c => strictNorm(typeof c === 'string' ? c : c.name) !== sourceNorm);
  if (!filteredCats.some(c => strictNorm(typeof c === 'string' ? c : c.name) === targetNorm)) {
    filteredCats.push(cleanTargetCat);
  }
  const updatedCats = filteredCats.sort((a, b) => {
    const nameA = typeof a === 'string' ? a : a.name, nameB = typeof b === 'string' ? b : b.name;
    return nameA.localeCompare(nameB);
  });

  const { updatedIngs: localCascadeIngs, updatedProds: localCascadeProds } = cascadeReassignment(state.ingredients || [], state.products || [], sourceNorm, cleanTargetCat, targetKebab);

  setCategories(updatedCats);
  setIngredients(localCascadeIngs);
  setProducts(localCascadeProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const catsDocRef = householdRef.collection('settings').doc('categories');

    const [dbIngs, dbProds, catsSnap] = await Promise.all([getRootItems(), getProducts(), catsDocRef.get()]);

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = cascadeReassignment(dbIngs, dbProds, sourceNorm, cleanTargetCat, targetKebab);

    const ingSavePromises = dbCascadeIngs
      .filter(ing => changedIngIds.has(String(ing.id)))
      .map(ing => saveRootItem(ing));

    const prodSavePromises = dbCascadeProds
      .filter(prod => changedProdIds.has(String(prod.id)))
      .map(prod => saveProduct(prod));

    await Promise.all([...ingSavePromises, ...prodSavePromises]);

    if (catsSnap.exists) {
      const snapCats = catsSnap.data()?.categories || [];
      const updatedSnapCats = snapCats.filter(c => strictNorm(typeof c === 'string' ? c : c.name) !== sourceNorm);
      if (!updatedSnapCats.some(c => strictNorm(typeof c === 'string' ? c : c.name) === targetNorm)) {
        updatedSnapCats.push(cleanTargetCat);
      }
      updatedSnapCats.sort((a, b) => (typeof a === 'string' ? a : a.name).localeCompare(typeof b === 'string' ? b : b.name));
      await catsDocRef.set({ categories: updatedSnapCats, updatedAt: new Date().toISOString() }, { merge: true });
    } else {
      await catsDocRef.set({ categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true });
    }

    return { success: true };
  } catch (err) {
    console.error('[CategoryMergeRepository] mergeCategory error:', err);
    throw err;
  }
}

export async function mergeAllDuplicates() {
  if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const categoriesDocRef = householdRef.collection('settings').doc('categories');

    const [categoriesSnap, ingredients, products] = await Promise.all([
      categoriesDocRef.get(),
      getRootItems(),
      getProducts()
    ]);

    const categoriesList = categoriesSnap.exists ? (categoriesSnap.data().categories || []) : [];

    const rawCategoriesSet = new Set();
    categoriesList.forEach(c => {
      const name = typeof c === 'string' ? c : c?.name;
      if (name) rawCategoriesSet.add(name);
    });
    ingredients.forEach(i => {
      if (i.category) rawCategoriesSet.add(i.category);
      if (Array.isArray(i.subtypes)) i.subtypes.forEach(st => { if (st.category) rawCategoriesSet.add(st.category); });
    });
    products.forEach(p => {
      if (p.category) rawCategoriesSet.add(p.category);
    });

    const grouped = new Map();
    rawCategoriesSet.forEach(rawName => {
      const slug = slugCategory(rawName);
      if (!slug) return;
      if (!grouped.has(slug)) grouped.set(slug, []);
      grouped.get(slug).push(rawName);
    });

    const canonicalMap = new Map();
    const updatedCategoriesList = [];

    for (const [_slug, names] of grouped.entries()) {
      if (names.length === 1) {
        canonicalMap.set(names[0], names[0]);
        updatedCategoriesList.push(names[0]);
        continue;
      }

      let masterName = names[0], maxCount = -1;
      names.forEach(name => {
        const ingCount = ingredients.filter(i => {
          const matchDirect = i.category === name || slugCategory(i.category) === slugCategory(name);
          const matchSub = Array.isArray(i.subtypes) && i.subtypes.some(st => st.category === name || slugCategory(st.category) === slugCategory(name));
          return matchDirect || matchSub;
        }).length;
        const prodCount = products.filter(p => p.category === name || slugCategory(p.category) === slugCategory(name)).length;
        const total = ingCount + prodCount;
        if (total > maxCount) {
          maxCount = total;
          masterName = name;
        }
      });

      names.forEach(name => canonicalMap.set(name, masterName));
      updatedCategoriesList.push(masterName);
    }

    let ingredientsChanged = 0;
    const ingUpdatePromises = [];
    ingredients.forEach(i => {
      let changed = false;
      let newCat = i.category;
      if (i.category && canonicalMap.has(i.category)) {
        const mapped = canonicalMap.get(i.category);
        if (i.category !== mapped) { newCat = mapped; changed = true; }
      }
      const subtypes = Array.isArray(i.subtypes) ? [...i.subtypes] : [];
      subtypes.forEach(st => {
        if (st.category && canonicalMap.has(st.category)) {
          const mapped = canonicalMap.get(st.category);
          if (st.category !== mapped) {
            st.category = mapped;
            st.cat = slugifyToKebab(mapped);
            changed = true;
          }
        }
      });
      if (changed) {
        ingUpdatePromises.push(saveRootItem({ ...i, category: newCat, cat: slugifyToKebab(newCat), subtypes }));
        ingredientsChanged++;
      }
    });

    let productsChanged = 0;
    const prodUpdatePromises = [];
    products.forEach(p => {
      if (p.category && canonicalMap.has(p.category)) {
        const mapped = canonicalMap.get(p.category);
        if (p.category !== mapped) {
          prodUpdatePromises.push(saveProduct({ ...p, category: mapped, cat: slugifyToKebab(mapped) }));
          productsChanged++;
        }
      }
    });

    await Promise.all([...ingUpdatePromises, ...prodUpdatePromises]);

    const finalUniqueCats = Array.from(new Set(updatedCategoriesList)).sort((a, b) => a.localeCompare(b));
    await categoriesDocRef.set({ categories: finalUniqueCats, updatedAt: new Date().toISOString() }, { merge: true });

    return { success: true, ingredientsChanged, productsChanged, categories: finalUniqueCats };
  } catch (err) {
    console.error('[CategoryMergeRepository] mergeAllDuplicates error:', err);
    throw err;
  }
}
