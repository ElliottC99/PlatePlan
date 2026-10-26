/**
 * src/services/PantryHierarchyService.js (v3.38.60)
 * Service for processing and building the Category ➔ Ingredient ➔ Sub-type ➔ Product tree.
 * Encapsulates tree traversal, sorting, and default product resolution.
 */

import { getState } from '../store/store.js';
import { toCanonicalCategoryName, slugifyToKebab, slugCategory } from '../utils/pantryUtils.js';

/**
 * Normalizes and enforces Category Single Source of Truth across ingredients and products.
 */
export function enforceCategorySSOT(state = {}) {
  const ingredients = Array.isArray(state.ingredients) ? state.ingredients : [];
  const products = Array.isArray(state.products) ? state.products : [];

  const ingCatMap = new Map();
  ingredients.forEach(i => {
    if (i?.id && i?.category) {
      ingCatMap.set(String(i.id), i.category);
    }
  });

  ingredients.forEach(ing => {
    const parentCat = ing.category || ing.cat;
    if (parentCat && Array.isArray(ing.subtypes)) {
      ing.subtypes.forEach(st => {
        const canonicalCat = toCanonicalCategoryName(parentCat);
        const kebabCat = slugifyToKebab(canonicalCat);
        st.category = canonicalCat;
        st.cat = kebabCat;
      });
    }
  });

  products.forEach(p => {
    let parentCat = null;
    if (p.ingredientId && ingCatMap.has(String(p.ingredientId))) {
      parentCat = ingCatMap.get(String(p.ingredientId));
    } else if (p.groupId && ingCatMap.has(String(p.groupId))) {
      parentCat = ingCatMap.get(String(p.groupId));
    } else if (p.subtypeId) {
      for (const ing of ingredients) {
        if (Array.isArray(ing.subtypes) && ing.subtypes.some(st => String(st.id) === String(p.subtypeId))) {
          parentCat = ing.category || ing.cat;
          break;
        }
      }
    }

    if (parentCat) {
      const targetCat = toCanonicalCategoryName(parentCat);
      const targetKebab = slugifyToKebab(targetCat);
      p.category = targetCat;
      p.cat = targetKebab;
    }
  });

  return { ...state, ingredients, products };
}

/**
 * Compares two products based on a specific strategy (price, protein, kcal, etc).
 */
export function compareProductsByStrategy(a, b, criterion = 'lowest_absolute_price') {
  const normCrit = String(criterion || 'lowest_absolute_price').toLowerCase().replace(/-/g, '_');
  const priceA = Number(a?.price ?? a?.cost ?? 0), priceB = Number(b?.price ?? b?.cost ?? 0);
  const safePriceA = isNaN(priceA) || priceA < 0 ? 0 : priceA, safePriceB = isNaN(priceB) || priceB < 0 ? 0 : priceB;
  const protA = Number(a?.prot ?? a?.protein ?? 0), protB = Number(b?.prot ?? b?.protein ?? 0);
  const safeProtA = isNaN(protA) || protA < 0 ? 0 : protA, safeProtB = isNaN(protB) || protB < 0 ? 0 : protB;
  const kcalA = Number(a?.kcal ?? a?.cal ?? a?.calories ?? 0), kcalB = Number(b?.kcal ?? b?.cal ?? b?.calories ?? 0);
  const safeKcalA = isNaN(kcalA) || kcalA < 0 ? 0 : kcalA, safeKcalB = isNaN(kcalB) || kcalB < 0 ? 0 : kcalB;
  const unitA = String(a?.packUnit || a?.pack_unit || 'g').toLowerCase().trim(), unitB = String(b?.packUnit || b?.pack_unit || 'g').toLowerCase().trim();
  const rawSizeA = Number(a?.packSize ?? a?.pack_size ?? a?.pack ?? a?.itemWeight ?? a?.item_weight ?? 100);
  const rawSizeB = Number(b?.packSize ?? b?.pack_size ?? b?.pack ?? b?.itemWeight ?? b?.item_weight ?? 100);
  const sizeA = (unitA === 'kg' || unitA === 'l') && rawSizeA > 0 ? rawSizeA * 1000 : (rawSizeA > 0 ? rawSizeA : 100);
  const sizeB = (unitB === 'kg' || unitB === 'l') && rawSizeB > 0 ? rawSizeB * 1000 : (rawSizeB > 0 ? rawSizeB : 100);
  const safeSizeA = isNaN(sizeA) || sizeA <= 0 ? 100 : sizeA, safeSizeB = isNaN(sizeB) || sizeB <= 0 ? 100 : sizeB;

  switch (normCrit) {
    case 'lowest_unit_price': {
      const upA = safePriceA > 0 ? (safePriceA / safeSizeA) : Infinity, upB = safePriceB > 0 ? (safePriceB / safeSizeB) : Infinity;
      return upA !== upB ? upA - upB : safePriceA - safePriceB;
    }
    case 'highest_protein_content': case 'highest_protein':
      return safeProtB !== safeProtA ? safeProtB - safeProtA : safePriceA - safePriceB;
    case 'highest_protein_per_kcal': {
      const ratioA = safeKcalA > 0 ? (safeProtA / safeKcalA) : 0, ratioB = safeKcalB > 0 ? (safeProtB / safeKcalB) : 0;
      return Math.abs(ratioB - ratioA) > 1e-6 ? ratioB - ratioA : (safeKcalA !== safeKcalB ? safeKcalA - safeKcalB : safePriceA - safePriceB);
    }
    case 'highest_protein_per_pound': {
      const yieldA = safePriceA > 0 ? (((safeProtA / 100) * safeSizeA) / safePriceA) : 0;
      const yieldB = safePriceB > 0 ? (((safeProtB / 100) * safeSizeB) / safePriceB) : 0;
      return Math.abs(yieldB - yieldA) > 1e-6 ? yieldB - yieldA : (safePriceA !== safePriceB ? safePriceA - safePriceB : safeKcalA - safeKcalB);
    }
    case 'lowest_calorie_count': case 'lowest_calories':
      return safeKcalA !== safeKcalB ? safeKcalA - safeKcalB : safePriceA - safePriceB;
    case 'lowest_absolute_price': case 'lowest_price': default: {
      const effA = safePriceA > 0 ? safePriceA : (priceA === 0 ? 0 : Infinity);
      const effB = safePriceB > 0 ? safePriceB : (priceB === 0 ? 0 : Infinity);
      return effA - effB;
    }
  }
}

/**
 * Resolves the default product for an ingredient or subtype using specific sorting strategies.
 */
export function resolveDefaultProduct(item, products = []) {
  if (!item) return null;
  const list = Array.isArray(products) ? products : Object.values(products || {});
  const autoDefault = list.find(p =>
    (String(p.ingredientId) === String(item.id) || String(p.subtypeId) === String(item.id) || String(p.groupId) === String(item.id)) &&
    (p.isAutoDefault === true || p.is_default === true)
  );
  if (autoDefault) return { ...autoDefault, isAutoDefault: true };
  if (item.defaultProductId) {
    const matched = list.find(p => String(p.id) === String(item.defaultProductId));
    if (matched) return { ...matched, isAutoDefault: true };
  }
  const linked = list.filter(p => String(p.ingredientId) === String(item.id) || String(p.subtypeId) === String(item.id) || String(p.groupId) === String(item.id));
  const pool = linked.length > 0 ? linked : list;
  if (pool.length > 0) {
    const state = getState();
    const criterion = state.settings?.autoDefaultStrategy || state.settings?.autoDefaultCriterion || state.userPrefs?.autoDefaultStrategy || state.userPrefs?.autoDefaultCriterion || 'lowest_absolute_price';
    const sorted = [...pool].sort((a, b) => compareProductsByStrategy(a, b, criterion));
    return { ...sorted[0], isAutoDefault: true };
  }
  return null;
}

/**
 * Core algorithm to build the hierarchical pantry tree.
 */
export function buildPantryHierarchy(ingredients = [], products = [], options = {}) {
  const ingList = Array.isArray(ingredients) ? ingredients : Object.values(ingredients || {});
  const prodList = Array.isArray(products) ? products : Object.values(products || {});
  const groupClusters = new Map(), ungrouped = [];

  ingList.forEach(item => {
    const gId = item.groupId || item.group_id;
    if (gId) {
      if (!groupClusters.has(gId)) groupClusters.set(gId, []);
      groupClusters.get(gId).push({ ...item });
    } else ungrouped.push({ ...item });
  });

  const rootIngredients = [], subtypeItems = [];

  groupClusters.forEach((clusterItems) => {
    let primary = clusterItems.find(i => i.isSubtype !== true && i.is_subtype !== true && !i.parentId && !i.parent_id);
    if (!primary && clusterItems.length > 0) primary = clusterItems[0];
    clusterItems.forEach(i => {
      if (primary && i.id === primary.id) rootIngredients.push(i);
      else subtypeItems.push({ ...i, parentId: primary ? primary.id : i.groupId, parentName: primary ? primary.name : 'Unknown Core' });
    });
  });

  ungrouped.forEach(item => {
    const isSubtype = !!(item.parentId || item.parent_id || item.parentIngredientId || item.parent_ingredient_id || item.parentName || item.isSubtype || item.is_subtype || item.type === 'subtype');
    if (isSubtype) subtypeItems.push(item);
    else rootIngredients.push(item);
  });

  const productMap = new Map();
  prodList.forEach(prod => {
    const key = prod.subtypeId || prod.ingredientId || prod.groupId;
    if (key) {
      if (!productMap.has(key)) productMap.set(key, []);
      productMap.get(key).push(prod);
    }
  });

  const subtypeMap = new Map();
  subtypeItems.forEach(sub => {
    const pId = sub.parentId || sub.parent_id || sub.parentIngredientId || sub.parent_ingredient_id;
    if (pId) {
      if (!subtypeMap.has(pId)) subtypeMap.set(pId, []);
      subtypeMap.get(pId).push(sub);
    }
  });

  const categoryMap = new Map(), orphanSubtypes = [];

  rootIngredients.forEach(root => {
    const rawCat = (root.category || 'General').trim();
    const existingKey = Array.from(categoryMap.keys()).find(k => k.toLowerCase() === rawCat.toLowerCase());
    const catKey = existingKey || rawCat;
    if (!categoryMap.has(catKey)) categoryMap.set(catKey, []);
    const directProducts = productMap.get(root.id) || [];
    const childSubtypes = [...(Array.isArray(root.subtypes) ? root.subtypes : []), ...(subtypeMap.get(root.id) || [])];
    const uniqueSubtypes = Array.from(new Map(childSubtypes.map(s => [s.id || s.name, s])).values());
    const subtypeProducts = uniqueSubtypes.flatMap(st => productMap.get(st.id) || []);
    const allIngredientProducts = [...directProducts, ...subtypeProducts];

    const rootDefaultProduct = resolveDefaultProduct(root, allIngredientProducts);

    const enrichedSubtypes = uniqueSubtypes.map(st => {
      const stProducts = productMap.get(st.id) || [];
      const stDefault = resolveDefaultProduct(st, stProducts.length ? stProducts : allIngredientProducts) || rootDefaultProduct;
      return { ...st, parentId: root.id, parentName: root.name, products: stProducts, defaultProduct: stDefault };
    });

    categoryMap.get(catKey).push({
      ...root,
      subtypes: enrichedSubtypes,
      directProducts,
      products: directProducts,
      defaultProduct: rootDefaultProduct
    });
  });

  subtypeItems.forEach(sub => {
    const pId = sub.parentId || sub.parent_id || sub.parentIngredientId || sub.parent_ingredient_id;
    if (!rootIngredients.some(r => r.id === pId)) orphanSubtypes.push(sub);
  });

  if (orphanSubtypes.length > 0) {
    const cat = 'Unassigned Sub-types';
    categoryMap.set(cat, [{
      id: 'group_orphan_subtypes',
      name: 'Unassigned Sub-types',
      category: cat,
      subtypes: orphanSubtypes.map(st => ({ ...st, products: productMap.get(st.id) || [], defaultProduct: resolveDefaultProduct(st, prodList) })),
      directProducts: [],
      products: [],
      defaultProduct: null
    }]);
  }

  return Array.from(categoryMap.entries())
    .map(([category, items]) => ({ category, ingredients: items.sort((a, b) => (a.name || '').localeCompare(b.name || '')) }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

let buildHierarchyTimer = null;
let cachedHierarchyResult = null;

export function invalidateHierarchyCache() { cachedHierarchyResult = null; }

export function debouncedBuildPantryHierarchy(ingredients = [], products = [], callback) {
  if (buildHierarchyTimer) clearTimeout(buildHierarchyTimer);
  buildHierarchyTimer = setTimeout(() => {
    cachedHierarchyResult = buildPantryHierarchy(ingredients, products);
    if (typeof callback === 'function') callback(cachedHierarchyResult);
  }, 250);
  return cachedHierarchyResult || buildPantryHierarchy(ingredients, products);
}
