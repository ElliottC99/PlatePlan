/**
 * src/services/CategoryManagementRepository.js (v3.38.54)
 * Dedicated repository for category deletion, cascading reassignment, and renaming.
 * Quarantines Firestore operations strictly scoped to 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { getState as getStoreState, setIngredients, setProducts, setCategories } from '../store/store.js';
import { isDbAvailable } from './RecipeFirestoreRepository.js';

const strictNorm = (str) => String(str || '').toLowerCase().trim();
const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[\s_]+/g, '-').replace(/[^a-z0-9\-]/g, '');
const slugCategory = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function commitChunkedOps(ops) {
  if (!ops || ops.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunkBatch = db.batch();
    ops.slice(i, i + CHUNK_SIZE).forEach(op => op(chunkBatch));
    await chunkBatch.commit();
  }
}

function cascadeReassignment(ingList = [], prodList = [], sourceNorm, cleanTargetCat, targetKebab) {
  const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
  const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];
  const changedIngIds = new Set();
  const changedSubtypeIds = new Set();
  const changedProdIds = new Set();

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
          ing.updatedAt = new Date().toISOString();
          updatedProds.forEach(prod => {
            const subRefId = String(prod.subtypeId || prod.subTypeId || '');
            if (subRefId && st.id && subRefId === String(st.id)) {
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

  return { updatedIngs, updatedProds, changedIngIds, changedSubtypeIds, changedProdIds };
}

export async function deleteCategory(categoryName, fallbackCatName = 'Uncategorised') {
  if (!categoryName) return { success: false, error: 'Missing category name' };

  const sourceNorm = strictNorm(categoryName);
  const targetCat = (fallbackCatName || 'Uncategorised').trim();
  const targetKebab = slugifyToKebab(targetCat);

  const state = getStoreState() || {};
  const categories = (state.categories || []).filter(c => strictNorm(typeof c === 'string' ? c : c?.name) !== sourceNorm);
  const { updatedIngs, updatedProds } = cascadeReassignment(state.ingredients, state.products, sourceNorm, targetCat, targetKebab);

  setCategories(categories); setIngredients(updatedIngs); setProducts(updatedProds);
  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const [ingSnap, prodSnap, catsSnap] = await Promise.all([
      householdRef.collection('ingredients').get(),
      householdRef.collection('products').get(),
      householdRef.collection('settings').doc('categories').get()
    ]);
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = 
      cascadeReassignment(dbIngs, dbProds, sourceNorm, targetCat, targetKebab);

    const deleteOps = [];
    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        deleteOps.push((b) => b.update(ing.ref, { category: ing.category, cat: ing.cat, subtypes: ing.subtypes || [], updatedAt: new Date().toISOString() }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        deleteOps.push((b) => b.update(prod.ref, { category: prod.category, cat: prod.cat, updatedAt: new Date().toISOString() }));
      }
    });

    if (catsSnap.exists) {
      const updatedCats = (catsSnap.data()?.categories || []).filter(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) !== sourceNorm && slugCategory(cName) !== sourceNorm;
      });
      deleteOps.push((b) => b.set(catsSnap.ref, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(deleteOps);
    return { success: true };
  } catch (err) {
    console.error('[CategoryManagementRepository] deleteCategory error:', err);
    throw err;
  }
}

export async function reassignAndDeleteCategory(deletedCat, reassignMode = 'mass', massTargetCat = 'Uncategorised', individualCatMap = {}) {
  if (!deletedCat) return { success: false, error: 'Missing category to delete' };

  const deletedSlug = slugCategory(deletedCat);
  const massTarget = (massTargetCat || '').trim() || 'Uncategorised';

  const reassignHierarchy = (ingList = [], prodList = []) => {
    const updatedIngs = Array.isArray(ingList) ? ingList.map(i => ({ ...i, subtypes: Array.isArray(i.subtypes) ? [...i.subtypes] : [] })) : [];
    const updatedProds = Array.isArray(prodList) ? prodList.map(p => ({ ...p })) : [];
    const changedIngIds = new Set(), changedProdIds = new Set();

    updatedIngs.forEach(i => {
      let changed = false;
      if (slugCategory(i.category) === deletedSlug || i.cat === deletedCat) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
        i.category = dest; i.cat = slugifyToKebab(dest); i.updatedAt = new Date().toISOString();
        changed = true;
      }
      if (Array.isArray(i.subtypes)) {
        i.subtypes.forEach(st => {
          if (slugCategory(st.category) === deletedSlug || st.cat === deletedCat) {
            const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[st.id] || massTarget);
            st.category = dest; st.cat = slugifyToKebab(dest);
            changed = true;
          }
        });
      }
      if (changed) changedIngIds.add(String(i.id));
    });

    updatedProds.forEach(p => {
      if (slugCategory(p.category) === deletedSlug || p.cat === deletedCat) {
        const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[p.id] || massTarget);
        p.category = dest; p.cat = slugifyToKebab(dest); p.updatedAt = new Date().toISOString();
        changedProdIds.add(String(p.id));
      }
    });

    return { updatedIngs, updatedProds, changedIngIds, changedProdIds };
  };

  const state = getStoreState() || {};
  const { updatedIngs, updatedProds } = reassignHierarchy(state.ingredients, state.products);
  const deletedNorm = strictNorm(deletedCat);
  const categories = (state.categories || []).filter(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) !== deletedNorm && slugCategory(cName) !== deletedSlug;
  });

  setCategories(categories); setIngredients(updatedIngs); setProducts(updatedProds);
  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const [ingSnap, prodSnap, catsSnap] = await Promise.all([
      householdRef.collection('ingredients').get(),
      householdRef.collection('products').get(),
      householdRef.collection('settings').doc('categories').get()
    ]);
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = reassignHierarchy(dbIngs, dbProds);

    const deleteOps = [];
    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        deleteOps.push((b) => b.update(ing.ref, { category: ing.category, cat: ing.cat, subtypes: ing.subtypes || [], updatedAt: new Date().toISOString() }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        deleteOps.push((b) => b.update(prod.ref, { category: prod.category, cat: prod.cat, updatedAt: new Date().toISOString() }));
      }
    });

    if (catsSnap.exists) {
      const updatedCats = (catsSnap.data()?.categories || []).filter(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) !== deletedNorm && slugCategory(cName) !== deletedSlug;
      });
      deleteOps.push((b) => b.set(catsSnap.ref, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(deleteOps);
    return { success: true };
  } catch (err) {
    console.error('[CategoryManagementRepository] reassignAndDeleteCategory error:', err);
    throw err;
  }
}

export async function renameCategory(oldCat, newName) {
  if (!oldCat || !newName) return { success: false, error: 'Missing source or new category name' };

  const sourceNorm = strictNorm(oldCat);
  const cleanNewName = String(newName).trim();
  const targetKebab = slugifyToKebab(cleanNewName);

  const state = getStoreState() || {};
  const { updatedIngs, updatedProds } = cascadeReassignment(state.ingredients, state.products, sourceNorm, cleanNewName, targetKebab);

  const currentCats = state.categories || [];
  const updatedCategories = currentCats.map(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return strictNorm(cName) === sourceNorm ? cleanNewName : c;
  });

  setCategories(updatedCategories); setIngredients(updatedIngs); setProducts(updatedProds);
  if (!isDbAvailable()) return { success: true };

  try {
    const householdRef = db.collection('households').doc(HOUSEHOLD_ID);
    const [ingSnap, prodSnap, catsSnap] = await Promise.all([
      householdRef.collection('ingredients').get(),
      householdRef.collection('products').get(),
      householdRef.collection('settings').doc('categories').get()
    ]);
    const dbIngs = ingSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    const dbProds = prodSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const { updatedIngs: dbCascadeIngs, updatedProds: dbCascadeProds, changedIngIds, changedProdIds } = 
      cascadeReassignment(dbIngs, dbProds, sourceNorm, cleanNewName, targetKebab);

    const renameOps = [];
    dbCascadeIngs.forEach(ing => {
      if (changedIngIds.has(String(ing.id))) {
        renameOps.push((b) => b.update(ing.ref, { category: ing.category, cat: ing.cat, subtypes: ing.subtypes || [], updatedAt: new Date().toISOString() }));
      }
    });

    dbCascadeProds.forEach(prod => {
      if (changedProdIds.has(String(prod.id))) {
        renameOps.push((b) => b.update(prod.ref, { category: prod.category, cat: prod.cat, updatedAt: new Date().toISOString() }));
      }
    });

    if (catsSnap.exists) {
      const updatedCats = (catsSnap.data()?.categories || []).map(c => {
        const cName = typeof c === 'string' ? c : c?.name;
        return strictNorm(cName) === sourceNorm ? cleanNewName : c;
      });
      renameOps.push((b) => b.set(catsSnap.ref, { categories: updatedCats, updatedAt: new Date().toISOString() }, { merge: true }));
    }

    await commitChunkedOps(renameOps);
    return { success: true };
  } catch (err) {
    console.error('[CategoryManagementRepository] renameCategory error:', err);
    throw err;
  }
}
