/**
 * src/services/PantryTaxonomyService.js (v3.43.2)
 * Centralized taxonomy engine coordinating atomic hierarchy commits:
 * Category ➔ RootItem ➔ Sub-type ➔ Product.
 * Strictly under 350 lines. Zero DOM dependencies.
 */

import { getState, setCategories, setIngredients, setProducts, saveStateCache } from '../store/store.js';
import { getCategories, saveCategories } from './CategoryRepository.js';
import { getRootItems, saveRootItem } from './RootItemRepository.js';
import { getProducts, saveProduct } from './ProductRepository.js';

/**
 * Executes a single transactional flow saving Category, Root Item, Sub-type, and Product.
 * @param {Object} params
 * @param {string} params.category
 * @param {string} params.rootItemName
 * @param {string} [params.subtypeName]
 * @param {Object} [params.productPayload]
 * @returns {Promise<Object>} { success, category, rootItem, subtypeId, product }
 */
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
    return {
      success: true,
      category: targetCategory,
      rootItem,
      subtypeId,
      product: createdProduct
    };
  } catch (err) {
    console.error('[PantryTaxonomyService] commitAtomicChain error:', err);
    return { success: false, error: err };
  }
}
