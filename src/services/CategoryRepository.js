/**
 * src/services/CategoryRepository.js (v3.35.42)
 * Dedicated Micro-Repository for Category Mutations (Merge, Rename, Reassign & Delete).
 * Implements the Strangler Fig Pattern: isolated chunked-batch cascade operations with strict SSOT state syncing.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { getState as getStoreState, setCategories, setIngredients, setProducts } from '../store/store.js';
import { slugCategory, slugifyToKebab, toCanonicalCategoryName } from '../models/PantryHierarchyModel.js';

const strictNorm = (str) => String(str || '').toLowerCase().trim();

function isDbAvailable() {
  return Boolean(db && HOUSEHOLD_ID);
}

async function commitChunkedOps(ops = []) {
  if (!ops || ops.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = db.batch();
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    chunk.forEach(op => op(batch));
    await batch.commit();
  }
}

export async function mergeCategory(sourceCat, targetCat) {
  if (!sourceCat || !targetCat) return { success: false, error: 'Missing source or target category' };

  const sourceNorm = strictNorm(sourceCat);
  const targetNorm = strictNorm(targetCat);
  if (sourceNorm === targetNorm) return { success: false, error: 'Source and target categories must be different' };

  const cleanTargetCat = toCanonicalCategoryName(targetCat.trim());
  const targetKebab = slugifyToKebab(cleanTargetCat);

  const cascadeMerge = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];
    const changedIngIds = new Set();
    const changedProdIds = new Set();

    updatedIngs.forEach(ing => {
      let changed = false;
      if (strictNorm(ing.category) === sourceNorm || slugCategory(ing.category) === slugCategory(sourceCat)) {
        ing.category = cleanTargetCat;
        ing.cat = targetKebab;
        ing.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(st => {
          if (strictNorm(st.category) === sourceNorm || slugCategory(st.category) === slugCategory(sourceCat)) {
            st.category = cleanTargetCat;
            st.cat = targetKebab;
            changed = true;
          }
        });
      }
      if (changed) changedIngIds.add(String(ing.id));
    });

    updatedProds.forEach(prod => {
      if (strictNorm(prod.category) === sourceNorm || slugCategory(prod.category) === slugCategory(sourceCat)) {
        prod.category = cleanTargetCat;
        prod.cat = targetKebab;
        prod.updatedAt = new Date().toISOString();
        changedProdIds.add(String(prod.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedProdIds };
  };

  const state = getStoreState() || {};
  const { updatedIngs, updatedProds } = cascadeMerge(state.ingredients, state.products);
  const categories = (state.categories || []).filter(c => strictNorm(c) !== sourceNorm && slugCategory(c) !== slugCategory(sourceCat));
  if (!categories.some(c => strictNorm(c) === strictNorm(cleanTargetCat))) {
    categories.push(cleanTargetCat);
  }

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const ingSnap = await householdRef.collection('ingredients').get();
    const prodSnap = await householdRef.collection('products').get();

    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = cascadeMerge(dbIngs, dbProds);

    const ops = [];
    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        ops.push((b) => b.update(ing.ref, { category: ing.category, cat: ing.cat, subtypes: ing.subtypes || [], updatedAt: new Date().toISOString() }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        ops.push((b) => b.update(prod.ref, { category: prod.category, cat: prod.cat, updatedAt: new Date().toISOString() }));
      }
    });

    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const updatedCats = (data.categories || []).filter(c => strictNorm(typeof c === 'string' ? c : c?.name) !== sourceNorm);
      if (!updatedCats.some(c => strictNorm(typeof c === 'string' ? c : c?.name) === strictNorm(cleanTargetCat))) {
        updatedCats.push(cleanTargetCat);
      }
      ops.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(ops);
    return { success: true };
  } catch (err) {
    console.error('[CategoryRepository] mergeCategory error:', err);
    throw err;
  }
}

export async function renameCategory(oldName, newName) {
  if (!oldName || !newName) return { success: false, error: 'Missing source or target category name' };

  const sourceNorm = strictNorm(oldName);
  const cleanNewName = toCanonicalCategoryName(newName.trim());
  const newKebab = slugifyToKebab(cleanNewName);
  if (sourceNorm === strictNorm(cleanNewName)) return { success: true };

  const cascadeRename = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];
    const changedIngIds = new Set();
    const changedProdIds = new Set();

    updatedIngs.forEach(ing => {
      let changed = false;
      if (strictNorm(ing.category) === sourceNorm || slugCategory(ing.category) === slugCategory(oldName)) {
        ing.category = cleanNewName;
        ing.cat = newKebab;
        ing.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (Array.isArray(ing.subtypes)) {
        ing.subtypes.forEach(st => {
          if (strictNorm(st.category) === sourceNorm || slugCategory(st.category) === slugCategory(oldName)) {
            st.category = cleanNewName;
            st.cat = newKebab;
            changed = true;
          }
        });
      }
      if (changed) changedIngIds.add(String(ing.id));
    });

    updatedProds.forEach(prod => {
      if (strictNorm(prod.category) === sourceNorm || slugCategory(prod.category) === slugCategory(oldName)) {
        prod.category = cleanNewName;
        prod.cat = newKebab;
        prod.updatedAt = new Date().toISOString();
        changedProdIds.add(String(prod.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedProdIds };
  };

  const state = getStoreState() || {};
  const { updatedIngs, updatedProds } = cascadeRename(state.ingredients, state.products);
  const categories = (state.categories || []).map(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return (strictNorm(cName) === sourceNorm || slugCategory(cName) === slugCategory(oldName)) ? cleanNewName : c;
  });

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const ingSnap = await householdRef.collection('ingredients').get();
    const prodSnap = await householdRef.collection('products').get();

    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = cascadeRename(dbIngs, dbProds);

    const ops = [];
    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        ops.push((b) => b.update(ing.ref, { category: ing.category, cat: ing.cat, subtypes: ing.subtypes || [], updatedAt: new Date().toISOString() }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        ops.push((b) => b.update(prod.ref, { category: prod.category, cat: prod.cat, updatedAt: new Date().toISOString() }));
      }
    });

    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const updatedCats = (data.categories || []).map(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return (strictNorm(cName) === sourceNorm || slugCategory(cName) === slugCategory(oldName)) ? cleanNewName : c;
      });
      ops.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(ops);
    return { success: true };
  } catch (err) {
    console.error('[CategoryRepository] renameCategory error:', err);
    throw err;
  }
}

export async function reassignAndDeleteCategory(deletedCat, reassignMode = 'mass', massTargetCat = 'Uncategorised', individualCatMap = {}) {
  if (!deletedCat) return { success: false, error: 'Missing category to delete' };

  const deletedNorm = strictNorm(deletedCat);
  const massTarget = toCanonicalCategoryName((massTargetCat || '').trim() || 'Uncategorised');

  const cascadeReassign = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];
    const changedIngIds = new Set();
    const changedProdIds = new Set();

    updatedIngs.forEach(i => {
      let changed = false;
      if (strictNorm(i.category) === deletedNorm || slugCategory(i.category) === slugCategory(deletedCat)) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
        i.category = dest;
        i.cat = slugifyToKebab(dest);
        i.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (strictNorm(st.category) === deletedNorm || slugCategory(st.category) === slugCategory(deletedCat)) {
            const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[st.id] || massTarget);
            st.category = dest;
            st.cat = slugifyToKebab(dest);
            changed = true;
          }
        });
      }
      if (changed) changedIngIds.add(String(i.id));
    });

    updatedProds.forEach(p => {
      if (strictNorm(p.category) === deletedNorm || slugCategory(p.category) === slugCategory(deletedCat)) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[p.id] || massTarget);
        p.category = dest;
        p.cat = slugifyToKebab(dest);
        p.updatedAt = new Date().toISOString();
        changedProdIds.add(String(p.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedProdIds };
  };

  const state = getStoreState() || {};
  const { updatedIngs, updatedProds } = cascadeReassign(state.ingredients, state.products);
  const categories = (state.categories || []).filter(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) !== deletedNorm && slugCategory(cName) !== slugCategory(deletedCat);
  });

  setCategories(categories);
  setIngredients(updatedIngs);
  setProducts(updatedProds);

  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const ingSnap = await householdRef.collection('ingredients').get();
    const prodSnap = await householdRef.collection('products').get();

    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = cascadeReassign(dbIngs, dbProds);

    const ops = [];
    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        ops.push((b) => b.update(ing.ref, { category: ing.category, cat: ing.cat, subtypes: ing.subtypes || [], updatedAt: new Date().toISOString() }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        ops.push((b) => b.update(prod.ref, { category: prod.category, cat: prod.cat, updatedAt: new Date().toISOString() }));
      }
    });

    const catsDocRef = householdRef.collection('settings').doc('categories');
    const catsSnap = await catsDocRef.get();
    if (catsSnap.exists) {
      const data = catsSnap.data();
      const updatedCats = (data.categories || []).filter(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) !== deletedNorm && slugCategory(cName) !== slugCategory(deletedCat);
      });
      ops.push((b) => b.set(catsDocRef, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(ops);
    return { success: true };
  } catch (err) {
    console.error('[CategoryRepository] reassignAndDeleteCategory error:', err);
    throw err;
  }
}

export async function deleteCategory(categoryName, fallbackCatName = 'Uncategorised') {
  return reassignAndDeleteCategory(categoryName, 'mass', fallbackCatName, {});
}
