/**
 * src/components/pantry/CategoryManagerOperations.js (v3.35.37)
 * Async Category Operations Pipeline (CRUD, Merge, Deduplication, Reassignment).
 * Isolated from direct view rendering to maintain single-responsibility separation.
 */

import { getState, setCategories, setIngredients, setProducts } from '../../store/store.js';
import { saveCategories, saveHouseholdState, mergeCategory, deleteCategory, renameCategory } from '../../services/HouseholdRepository.js';
import { slugCategory, slugifyToKebab, invalidateHierarchyCache, toCanonicalCategoryName } from '../../models/PantryHierarchyModel.js';
import { resetCategoryFilter } from '../../views/PantryBankView.js';

export { resolveCategory };

function getCategoryName(cat) {
  return !cat ? '' : typeof cat === 'string' ? cat : (cat.name || cat.categoryName || cat.id || '');
}

function resolveCategory(id) {
  const cats = getState()?.categories || [];
  for (const c of cats) {
    const cName = getCategoryName(c);
    if (typeof c === 'string' && (c === id || slugCategory(c) === slugCategory(id))) return { id: c, name: c };
    if (c && typeof c === 'object' && (String(c.id) === String(id) || String(cName) === String(id) || slugCategory(cName) === slugCategory(id))) return { id: c.id || cName, name: cName };
  }
  return { id, name: id };
}

export async function submitAddCat(val) {
  if (!val) return;
  const state = getState() || {}, categories = Array.isArray(state.categories) ? [...state.categories] : [];
  if (!categories.some(c => slugCategory(c) === slugCategory(val))) {
    categories.push(toCanonicalCategoryName(val));
    setCategories(categories);
    await saveCategories(categories);
  }
}

export async function submitMergeDuplicateCategories() {
  const repo = await import('../../services/HouseholdRepository.js');
  const res = await repo.mergeAllDuplicates();

  if (res && res.success) {
    const freshIngredients = await repo.getIngredients(), freshProducts = await repo.getProducts();
    setCategories(res.categories); setIngredients(freshIngredients); setProducts(freshProducts);

    if (window.Store?.setState) window.Store.setState({ categories: res.categories, ingredients: freshIngredients, products: freshProducts });
    invalidateHierarchyCache();
    
    document.dispatchEvent(new CustomEvent('plateplan:state:categories', { detail: res.categories }));
    document.dispatchEvent(new CustomEvent('plateplan:state:ingredients', { detail: freshIngredients }));
    document.dispatchEvent(new CustomEvent('plateplan:state:products', { detail: freshProducts }));

    if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
    if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
    if (typeof window.renderProductBank === 'function') window.renderProductBank();
    if (typeof window.showPlatePlanToast === 'function') window.showPlatePlanToast('Successfully merged duplicate categories!', 'success');
  }
}

export async function submitRenameCat(oldCat, rawName) {
  const newName = toCanonicalCategoryName(rawName.trim()), targetOld = (oldCat || '').trim();
  if (!newName || !targetOld || newName === targetOld) return;

  await renameCategory(targetOld, newName);
  invalidateHierarchyCache();
}

export async function submitMergeCat(sourceCat, targetCat) {
  if (!sourceCat || !targetCat) throw new Error('Missing source or target category');
  if (String(sourceCat).trim() === String(targetCat).trim()) throw new Error('Source and target categories must be different');
  await mergeCategory(sourceCat, targetCat);
}

export async function submitReassignAndDelete(deletedCat, reassignMode, massTargetCat, individualCatMap) {
  if (!deletedCat) return;
  const state = getState() || {}, ings = Array.isArray(state.ingredients) ? state.ingredients : [], prods = Array.isArray(state.products) ? state.products : [];
  const massInput = document.getElementById('cat-mass-search-input'), massTarget = (massInput ? massInput.value.trim() : '') || massTargetCat || 'Uncategorised';
  
  ings.forEach(i => {
    if (slugCategory(i.category) === slugCategory(deletedCat) || i.cat === deletedCat) {
      const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[i.id] || massTarget);
      i.category = dest; i.cat = slugifyToKebab(dest); i.updatedAt = new Date().toISOString();
    }
    if (Array.isArray(i.subtypes)) {
      i.subtypes.forEach(st => {
        if (slugCategory(st.category) === slugCategory(deletedCat) || st.cat === deletedCat) {
          const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[st.id] || massTarget);
          st.category = dest; st.cat = slugifyToKebab(dest);
        }
      });
    }
  });

  prods.forEach(p => {
    if (slugCategory(p.category) === slugCategory(deletedCat) || p.cat === deletedCat) {
      const dest = reassignMode === 'mass' ? massTarget : (individualCatMap[p.id] || massTarget);
      p.category = dest; p.cat = slugifyToKebab(dest); p.updatedAt = new Date().toISOString();
    }
  });

  const categories = (state.categories || []).filter(c => slugCategory(c) !== slugCategory(deletedCat));
  setCategories(categories); setIngredients(ings); setProducts(prods);
  await saveHouseholdState({ categories, ingredients: ings, products: prods });
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

export async function handleDeleteCategory(identifier) {
  if (!identifier) return;
  const category = resolveCategory(identifier); if (!category?.name) return;
  const targetId = category.id, targetName = category.name;
  
  await deleteCategory(targetId || targetName);
  const state = getState() || {}, fallbackCatName = 'Uncategorised', fallbackKebab = slugifyToKebab(fallbackCatName);

  const ings = Array.isArray(state.ingredients) ? [...state.ingredients] : [];
  ings.forEach(i => {
    let changed = false;
    if (slugCategory(i.category) === slugCategory(targetName) || i.cat === slugifyToKebab(targetName)) { i.category = fallbackCatName; i.cat = fallbackKebab; changed = true; }
    if (Array.isArray(i.subtypes)) {
      i.subtypes.forEach(st => {
        if (slugCategory(st.category) === slugCategory(targetName) || st.cat === slugifyToKebab(targetName)) { st.category = fallbackCatName; st.cat = fallbackKebab; changed = true; }
      });
    }
    if (changed) i.updatedAt = new Date().toISOString();
  });

  const prods = Array.isArray(state.products) ? [...state.products] : [];
  prods.forEach(p => {
    if (slugCategory(p.category) === slugCategory(targetName) || p.cat === slugifyToKebab(targetName)) { p.category = fallbackCatName; p.cat = fallbackKebab; p.updatedAt = new Date().toISOString(); }
  });

  const categories = (state.categories || []).filter(c => {
    const cName = typeof c === 'string' ? c : c?.name;
    return cName !== targetName && slugCategory(cName) !== slugCategory(targetName);
  });

  setCategories(categories); setIngredients(ings); setProducts(prods);
  invalidateHierarchyCache();
}
