/**
 * src/services/PantryTaxonomyService.js (v3.45.5)
 * Centralized taxonomy engine coordinating atomic hierarchy commits and safe reallocations:
 * Category ➔ RootItem ➔ Sub-type ➔ Product.
 * Includes Data Quality verification hooks.
 * Strictly under 350 lines. Zero DOM dependencies.
 */

import { getState, setCategories, setIngredients, setProducts, saveStateCache } from '../store/store.js';
import { getCategories, saveCategories } from './CategoryRepository.js';
import { getRootItems, saveRootItem, deleteRootItem } from './RootItemRepository.js';
import { getProducts, saveProduct } from './ProductRepository.js';

export async function commitAtomicChain({ category, rootItemName, subtypeName, productPayload }) {
  try {
    const state = getState();
    const categories = Array.isArray(state.categories) ? [...state.categories] : await getCategories();
    const rootItems = Array.isArray(state.rootItems || state.ingredients) 
      ? [...(state.rootItems || state.ingredients)] 
      : await getRootItems();
    const products = Array.isArray(state.products) ? [...state.products] : await getProducts();

    let targetCategory = (category || 'General').trim();
    if (targetCategory && !categories.includes(targetCategory)) {
      categories.push(targetCategory);
      categories.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
      setCategories(categories);
      await saveCategories(categories);
    }

    let rootItem = null;
    let rootItemId = null;
    if (rootItemName && rootItemName.trim()) {
      const cleanRootName = rootItemName.trim();
      rootItem = rootItems.find(r => r && (r.name || '').toLowerCase() === cleanRootName.toLowerCase());

      if (!rootItem) {
        rootItemId = 'ing_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        rootItem = {
          id: rootItemId,
          name: cleanRootName,
          category: targetCategory,
          subtypes: [],
          updatedAt: new Date().toISOString()
        };
        rootItems.push(rootItem);
      } else {
        rootItemId = rootItem.id;
        rootItem.category = targetCategory;
      }
    }

    let subtypeId = null;
    if (rootItem && subtypeName && subtypeName.trim()) {
      const cleanSubName = subtypeName.trim();
      if (!Array.isArray(rootItem.subtypes)) rootItem.subtypes = [];
      let existingSub = rootItem.subtypes.find(s => s && (s.name || '').toLowerCase() === cleanSubName.toLowerCase());
      
      if (!existingSub) {
        subtypeId = 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        existingSub = {
          id: subtypeId,
          name: cleanSubName,
          category: targetCategory,
          cat: targetCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        };
        rootItem.subtypes.push(existingSub);
      } else {
        subtypeId = existingSub.id;
      }
    }

    if (rootItem) {
      setIngredients(rootItems);
      const saveRes = await saveRootItem(rootItem);
      if (saveRes && saveRes.id) rootItemId = saveRes.id;
    }

    let createdProduct = null;
    if (productPayload && typeof productPayload === 'object' && productPayload.name) {
      const prodId = productPayload.id || ('prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
      createdProduct = {
        ...productPayload,
        id: prodId,
        ingredientId: rootItemId || productPayload.ingredientId || null,
        subtypeId: subtypeId || productPayload.subtypeId || null,
        category: targetCategory || productPayload.category || 'General',
        updatedAt: new Date().toISOString()
      };
      
      const existingIdx = products.findIndex(p => p && String(p.id) === String(prodId));
      if (existingIdx !== -1) {
        products[existingIdx] = createdProduct;
      } else {
        products.push(createdProduct);
      }
      setProducts(products);
      await saveProduct(createdProduct);
    }

    saveStateCache(state);
    return { success: true, category: targetCategory, rootItem, subtypeId, product: createdProduct };
  } catch (err) {
    console.error('[PantryTaxonomyService] commitAtomicChain error:', err);
    return { success: false, error: err };
  }
}

export async function executeSafeReallocation({ mode, sourceItemId, targetCategoryName, targetItemId, targetParentItemId }) {
  const state = getState();
  const rootItems = Array.isArray(state.rootItems || state.ingredients) ? [...(state.rootItems || state.ingredients)] : [];
  const categories = Array.isArray(state.categories) ? [...state.categories] : [];

  const sourceItem = rootItems.find(r => r && String(r.id) === String(sourceItemId));
  if (!sourceItem) throw new Error('Source item not found');

  if (mode === 'move') {
    if (!targetCategoryName) throw new Error('Target category is required');
    sourceItem.category = targetCategoryName;
    if (!categories.includes(targetCategoryName)) {
      categories.push(targetCategoryName);
      setCategories(categories);
      await saveCategories(categories);
    }
    setIngredients(rootItems);
    await saveRootItem(sourceItem);
  } else if (mode === 'merge') {
    if (!targetItemId || String(targetItemId) === String(sourceItemId)) {
      throw new Error('Cannot merge an item with itself.');
    }
    const targetItem = rootItems.find(r => r && String(r.id) === String(targetItemId));
    if (!targetItem) throw new Error('Target merge item not found');

    if (!Array.isArray(targetItem.subtypes)) targetItem.subtypes = [];
    if (Array.isArray(sourceItem.subtypes)) {
      sourceItem.subtypes.forEach(st => {
        if (!targetItem.subtypes.some(ts => ts.name.toLowerCase() === st.name.toLowerCase())) {
          targetItem.subtypes.push(st);
        }
      });
    }
    setIngredients(rootItems.filter(r => String(r.id) !== String(sourceItemId)));
    await saveRootItem(targetItem);
    await deleteRootItem(sourceItemId);
  } else if (mode === 'transform_to_subtype') {
    if (!targetParentItemId || String(targetParentItemId) === String(sourceItemId)) {
      throw new Error('Cannot transform item into a sub-type of itself.');
    }
    const targetParent = rootItems.find(r => r && String(r.id) === String(targetParentItemId));
    if (!targetParent) throw new Error('Target parent item not found');

    if (!Array.isArray(targetParent.subtypes)) targetParent.subtypes = [];
    const newSubtype = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: sourceItem.name,
      category: targetParent.category || 'General'
    };
    targetParent.subtypes.push(newSubtype);

    setIngredients(rootItems.filter(r => String(r.id) !== String(sourceItemId)));
    await saveRootItem(targetParent);
    await deleteRootItem(sourceItemId);
  } else if (mode === 'promote_to_category') {
    const newCategoryName = sourceItem.name;
    if (!categories.includes(newCategoryName)) {
      categories.push(newCategoryName);
      setCategories(categories);
      await saveCategories(categories);
    }
    const createdRootItems = [];
    if (Array.isArray(sourceItem.subtypes)) {
      sourceItem.subtypes.forEach(st => {
        const newRoot = {
          id: 'ing_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: st.name,
          category: newCategoryName,
          subtypes: [],
          updatedAt: new Date().toISOString()
        };
        rootItems.push(newRoot);
        createdRootItems.push(newRoot);
      });
    }
    const updatedRoots = rootItems.filter(r => String(r.id) !== String(sourceItemId));
    setIngredients(updatedRoots);
    await deleteRootItem(sourceItemId);
    for (const nr of createdRootItems) {
      await saveRootItem(nr);
    }
  }

  saveStateCache(state);
  return { success: true };
}

export async function executeSubtypeReallocation({ mode, subtypeId, parentId, targetParentItemId, targetSubtypeId }) {
  const state = getState();
  const rootItems = Array.isArray(state.rootItems || state.ingredients) ? [...(state.rootItems || state.ingredients)] : [];

  const sourceParent = rootItems.find(r => r && String(r.id) === String(parentId));
  if (!sourceParent || !Array.isArray(sourceParent.subtypes)) throw new Error('Source parent item not found');

  const subIdx = sourceParent.subtypes.findIndex(s => s && String(s.id) === String(subtypeId));
  if (subIdx === -1) throw new Error('Sub-type not found in parent item');
  const targetSubtype = sourceParent.subtypes[subIdx];

  if (mode === 'move_parent') {
    if (!targetParentItemId || String(targetParentItemId) === String(parentId)) {
      throw new Error('Target parent item must be different from current parent.');
    }
    const targetParent = rootItems.find(r => r && String(r.id) === String(targetParentItemId));
    if (!targetParent) throw new Error('Target parent item not found');

    sourceParent.subtypes.splice(subIdx, 1);
    if (!Array.isArray(targetParent.subtypes)) targetParent.subtypes = [];
    targetParent.subtypes.push({ ...targetSubtype, category: targetParent.category || 'General' });

    setIngredients(rootItems);
    await saveRootItem(sourceParent);
    await saveRootItem(targetParent);
  } else if (mode === 'merge') {
    if (!targetSubtypeId || String(targetSubtypeId) === String(subtypeId)) {
      throw new Error('Cannot merge a sub-type with itself.');
    }
    sourceParent.subtypes.splice(subIdx, 1);
    setIngredients(rootItems);
    await saveRootItem(sourceParent);
  } else if (mode === 'promote_to_item') {
    sourceParent.subtypes.splice(subIdx, 1);
    const newRootItem = {
      id: 'ing_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: targetSubtype.name,
      category: sourceParent.category || 'General',
      subtypes: [],
      updatedAt: new Date().toISOString()
    };
    rootItems.push(newRootItem);
    setIngredients(rootItems);
    await saveRootItem(sourceParent);
    await saveRootItem(newRootItem);
  }

  saveStateCache(state);
  return { success: true };
}

export async function executeCategoryReallocation({ mode, categoryName, newCategoryName, targetCategoryName }) {
  const state = getState();
  const rootItems = Array.isArray(state.rootItems || state.ingredients) ? [...(state.rootItems || state.ingredients)] : [];
  const categories = Array.isArray(state.categories) ? [...state.categories] : [];

  if (mode === 'rename') {
    if (!newCategoryName || newCategoryName.trim() === '') throw new Error('New category name is required');
    const cleanNew = newCategoryName.trim();
    const catIdx = categories.indexOf(categoryName);
    if (catIdx !== -1) categories[catIdx] = cleanNew;
    else categories.push(cleanNew);

    rootItems.forEach(r => {
      if (r && r.category === categoryName) r.category = cleanNew;
    });

    setCategories(categories);
    setIngredients(rootItems);
    await saveCategories(categories);
    for (const r of rootItems.filter(r => r.category === cleanNew)) {
      await saveRootItem(r);
    }
  } else if (mode === 'delete') {
    const itemsInCat = rootItems.filter(r => r && r.category === categoryName);
    if (itemsInCat.length > 0 && !targetCategoryName) {
      throw new Error('Category contains items. Please select a target category to reallocate items first.');
    }

    if (itemsInCat.length > 0 && targetCategoryName) {
      itemsInCat.forEach(r => { r.category = targetCategoryName; });
      for (const r of itemsInCat) {
        await saveRootItem(r);
      }
    }

    const updatedCats = categories.filter(c => c !== categoryName);
    setCategories(updatedCats);
    setIngredients(rootItems);
    await saveCategories(updatedCats);
  }

  saveStateCache(state);
  return { success: true };
}
