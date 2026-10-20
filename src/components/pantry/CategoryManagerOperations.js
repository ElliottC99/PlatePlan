/**
 * src/components/pantry/CategoryManagerOperations.js (v3.35.41)
 * Async Category Operations Pipeline (CRUD, Merge, Deduplication, Reassignment).
 * Routed directly to CategoryRepository micro-service.
 */

import { getState, setCategories, setIngredients, setProducts } from '../../store/store.js';
import { saveCategories } from '../../services/HouseholdRepository.js';
import { mergeCategory, renameCategory, reassignAndDeleteCategory, deleteCategory } from '../../services/CategoryRepository.js';
import { slugCategory, invalidateHierarchyCache, toCanonicalCategoryName } from '../../models/PantryHierarchyModel.js';
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
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

export async function submitMergeCat(sourceCat, targetCat) {
  if (!sourceCat || !targetCat) throw new Error('Missing source or target category');
  if (String(sourceCat).trim() === String(targetCat).trim()) throw new Error('Source and target categories must be different');
  
  await mergeCategory(sourceCat, targetCat);
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

export async function submitReassignAndDelete(deletedCat, reassignMode, massTargetCat, individualCatMap) {
  if (!deletedCat) return;
  const massInput = document.getElementById('cat-mass-search-input');
  const massTarget = (massInput ? massInput.value.trim() : '') || massTargetCat || 'Uncategorised';

  await reassignAndDeleteCategory(deletedCat, reassignMode, massTarget, individualCatMap);
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}

export async function handleDeleteCategory(identifier) {
  if (!identifier) return;
  const category = resolveCategory(identifier); if (!category?.name) return;

  await deleteCategory(category.id || category.name);
  if (typeof resetCategoryFilter === 'function') resetCategoryFilter();
  invalidateHierarchyCache();
}
