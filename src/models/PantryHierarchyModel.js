/**
 * src/models/PantryHierarchyModel.js (v3.20.11)
 * Relational Model & Operations for Category ➔ Ingredient ➔ Sub-type ➔ Product hierarchy.
 * Encapsulates aliasing, merging, promoting/demoting, and auto-default product resolution strategies.
 */

import { getState, setIngredients, setProducts } from '../store/store.js';
import { saveIngredient, deleteIngredient, saveProduct } from '../services/HouseholdRepository.js';

export const slugCategory = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
export const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function toCanonicalCategoryName(str) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().split(/\s+/).map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '').join(' ');
}

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

export function isSubtypeItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.isSubtype === true || item.is_subtype === true || item.type === 'subtype' || item.kind === 'subtype') return true;
  return !!(item.parentId || item.parent_id || item.parentIngredientId || item.parent_ingredient_id || item.parentName);
}

export function getActiveCategories(state = {}) {
  const categoryMap = new Map();
  const registerCat = (raw) => {
    const name = typeof raw === 'string' ? raw : raw?.name;
    if (name && typeof name === 'string' && name.trim()) {
      const trimmed = name.trim(), slug = slugCategory(trimmed);
      if (slug && !categoryMap.has(slug)) categoryMap.set(slug, toCanonicalCategoryName(trimmed));
    }
  };
  (Array.isArray(state.categories) ? state.categories : []).forEach(registerCat);
  (Array.isArray(state.ingredients) ? state.ingredients : []).forEach(i => registerCat(i.category || i.cat));
  (Array.isArray(state.products) ? state.products : []).forEach(p => registerCat(p.category || p.cat));
  return Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b));
}

export function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  let norm = str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  if (norm.endsWith('oes') && norm.length > 4) norm = norm.slice(0, -2);
  else if (norm.endsWith('s') && !norm.endsWith('ss') && norm.length > 3) norm = norm.slice(0, -1);
  return norm;
}

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
    const state = getState() || (typeof window !== 'undefined' ? window.state : {}) || {};
    const criterion = state.settings?.autoDefaultStrategy || state.settings?.autoDefaultCriterion || state.userPrefs?.autoDefaultStrategy || state.userPrefs?.autoDefaultCriterion || 'lowest_absolute_price';
    const sorted = [...pool].sort((a, b) => compareProductsByStrategy(a, b, criterion));
    return { ...sorted[0], isAutoDefault: true };
  }
  return null;
}

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
    if (isSubtypeItem(item)) subtypeItems.push(item);
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
    const cat = root.category || 'General';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
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

    categoryMap.get(cat).push({
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

export function logPantryHierarchyTelemetry(ingredients = [], products = []) {
  return buildPantryHierarchy(ingredients, products, { verbose: true });
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

export async function aliasIngredient(ingredientId, aliasName) {
  const cleanAlias = (aliasName || '').trim();
  if (!ingredientId || !cleanAlias) return false;
  const state = getState() || {}, ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(ingredientId));
  if (!ing) return false;
  const existing = Array.isArray(ing.aliases) ? [...ing.aliases] : (ing.alias ? [ing.alias] : []);
  if (!existing.some(a => a.toLowerCase() === cleanAlias.toLowerCase())) existing.push(cleanAlias);
  ing.aliases = existing; ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return true;
}

export async function removeAlias(ingredientId, aliasToRemove) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(ingredientId));
  if (!ing || !Array.isArray(ing.aliases)) return false;
  ing.aliases = ing.aliases.filter(a => a.toLowerCase() !== (aliasToRemove || '').toLowerCase());
  ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return true;
}

export async function addSubtypeToIngredient(parentIngredientId, subtypeName, subtypeNotes = '') {
  const cleanName = (subtypeName || '').trim();
  if (!parentIngredientId || !cleanName) return false;
  const state = getState() || {}, ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(parentIngredientId));
  if (!ing) return false;
  const currentSubtypes = Array.isArray(ing.subtypes) ? [...ing.subtypes] : [];
  const newSubtype = { id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: cleanName, notes: subtypeNotes.trim(), aliases: [], defaultProductId: null, createdAt: new Date().toISOString() };
  currentSubtypes.push(newSubtype); ing.subtypes = currentSubtypes; ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return newSubtype;
}

export async function promoteToIngredient(subtypeId, parentIngredientId) {
  const state = getState() || {}, ings = [...(state.ingredients || [])];
  const existingIng = ings.find(i => String(i.id) === String(subtypeId));
  if (existingIng) {
    delete existingIng.groupId; delete existingIng.group_id; delete existingIng.parentId; delete existingIng.parent_id;
    delete existingIng.parentIngredientId; delete existingIng.parent_ingredient_id;
    existingIng.isSubtype = false; existingIng.is_subtype = false; existingIng.updatedAt = new Date().toISOString();
    setIngredients(ings); await saveIngredient(existingIng); return true;
  }
  const parent = ings.find(i => String(i.id) === String(parentIngredientId));
  if (!parent || !Array.isArray(parent.subtypes)) return false;
  const subtypeIndex = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subtypeIndex < 0) return false;
  const [subtype] = parent.subtypes.splice(subtypeIndex, 1);
  parent.updatedAt = new Date().toISOString();
  const newIngredient = { id: subtype.id || `ing_${Date.now()}`, name: subtype.name, category: parent.category || 'Other', notes: subtype.notes || '', aliases: Array.isArray(subtype.aliases) ? subtype.aliases : [], subtypes: [], defaultProductId: subtype.defaultProductId || null, updatedAt: new Date().toISOString() };
  ings.push(newIngredient); setIngredients(ings);
  await Promise.all([saveIngredient(parent), saveIngredient(newIngredient)]); return true;
}

export async function reparentSubtype(subtypeId, targetParentIngredientId, sourceParentIngredientId = null) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
  const targetParent = ings.find(i => String(i.id) === String(targetParentIngredientId));
  if (!targetParent) return false;
  let subtype = null;
  for (const ing of ings) {
    if (Array.isArray(ing.subtypes)) {
      const idx = ing.subtypes.findIndex(s => String(s.id) === String(subtypeId));
      if (idx >= 0) {
        [subtype] = ing.subtypes.splice(idx, 1);
        ing.updatedAt = new Date().toISOString();
        await saveIngredient(ing);
        break;
      }
    }
  }
  if (!subtype) return false;
  if (!Array.isArray(targetParent.subtypes)) targetParent.subtypes = [];
  targetParent.subtypes.push(subtype);
  targetParent.updatedAt = new Date().toISOString();
  const updatedProds = prods.map(p => (String(p.subtypeId) === String(subtypeId)) ? { ...p, ingredientId: targetParent.id, category: targetParent.category || p.category, updatedAt: new Date().toISOString() } : p);
  setIngredients(ings); setProducts(updatedProds);
  await Promise.all([saveIngredient(targetParent), ...updatedProds.filter(p => String(p.subtypeId) === String(subtypeId)).map(p => saveProduct(p))]);
  return true;
}

export async function demoteToSubtype(ingredientId, targetParentIngredientId) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
  const sourceIdx = ings.findIndex(i => String(i.id) === String(ingredientId));
  const targetParent = ings.find(i => String(i.id) === String(targetParentIngredientId));
  if (sourceIdx < 0 || !targetParent) return false;
  const [source] = ings.splice(sourceIdx, 1);
  const targetSubtypes = Array.isArray(targetParent.subtypes) ? [...targetParent.subtypes] : [];
  const newSubtype = { id: source.id, name: source.name, notes: source.notes || '', aliases: Array.isArray(source.aliases) ? source.aliases : [], defaultProductId: source.defaultProductId || null, createdAt: new Date().toISOString() };
  targetSubtypes.push(newSubtype); targetParent.subtypes = targetSubtypes; targetParent.updatedAt = new Date().toISOString();
  const updatedProds = prods.map(p => (String(p.ingredientId) === String(source.id)) ? { ...p, ingredientId: targetParent.id, subtypeId: source.id, updatedAt: new Date().toISOString() } : p);
  setIngredients(ings); setProducts(updatedProds);
  await Promise.all([deleteIngredient(source.id), saveIngredient(targetParent), ...updatedProds.filter(p => String(p.subtypeId) === String(source.id)).map(p => saveProduct(p))]);
  return true;
}

export async function mergeIngredients(sourceId, targetId) {
  const state = getState() || {}, ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
  const sourceIdx = ings.findIndex(i => String(i.id) === String(sourceId));
  const target = ings.find(i => String(i.id) === String(targetId));
  if (sourceIdx < 0 || !target || String(sourceId) === String(targetId)) return false;
  const [source] = ings.splice(sourceIdx, 1);
  const targetAliases = new Set(Array.isArray(target.aliases) ? target.aliases : []);
  if (source.name) targetAliases.add(source.name);
  if (Array.isArray(source.aliases)) source.aliases.forEach(a => targetAliases.add(a));
  target.aliases = Array.from(targetAliases);
  const targetSubtypes = Array.isArray(target.subtypes) ? [...target.subtypes] : [];
  if (Array.isArray(source.subtypes)) source.subtypes.forEach(st => targetSubtypes.push(st));
  target.subtypes = targetSubtypes; target.updatedAt = new Date().toISOString();
  const updatedProds = prods.map(p => (String(p.ingredientId) === String(source.id) || String(p.groupId) === String(source.id)) ? { ...p, ingredientId: target.id, updatedAt: new Date().toISOString() } : p);
  setIngredients(ings); setProducts(updatedProds);
  await Promise.all([deleteIngredient(source.id), saveIngredient(target), ...updatedProds.filter(p => String(p.ingredientId) === String(target.id)).map(p => saveProduct(p))]);
  return true;
}

export async function reallocateProduct(productId, newIngredientId, newSubtypeId = null, newCategory = null) {
  const state = getState() || {}, prods = [...(state.products || [])], ings = state.ingredients || [];
  const prod = prods.find(p => String(p.id) === String(productId));
  if (!prod) return false;
  const targetIng = ings.find(i => String(i.id) === String(newIngredientId));
  prod.ingredientId = newIngredientId || null; prod.subtypeId = newSubtypeId || null;
  if (newCategory) prod.category = newCategory;
  else if (targetIng?.category) prod.category = targetIng.category;
  prod.updatedAt = new Date().toISOString();
  setProducts(prods); await saveProduct(prod);
  return true;
}

export async function setAutoDefaultProduct(productId, parentIngredientId, subtypeId = null) {
  const state = getState() || {}, prods = [...(state.products || [])], ings = [...(state.ingredients || [])];
  const parent = ings.find(i => String(i.id) === String(parentIngredientId));
  if (parent) {
    if (subtypeId && Array.isArray(parent.subtypes)) {
      const st = parent.subtypes.find(s => String(s.id) === String(subtypeId));
      if (st) st.defaultProductId = productId;
    } else parent.defaultProductId = productId;
    parent.updatedAt = new Date().toISOString(); await saveIngredient(parent);
  }
  const updatedProds = prods.map(p => (String(p.ingredientId) === String(parentIngredientId) || String(p.subtypeId) === String(subtypeId)) ? { ...p, isAutoDefault: String(p.id) === String(productId), updatedAt: new Date().toISOString() } : p);
  setIngredients(ings); setProducts(updatedProds);
  const targetProd = updatedProds.find(p => String(p.id) === String(productId));
  if (targetProd) await saveProduct(targetProd);
  return true;
}

export function getIngredientById(id) {
  return !id ? null : ((getState() || {}).ingredients || []).find(i => String(i.id) === String(id)) || null;
}

export function getSubtypeById(id) {
  if (!id) return null;
  for (const ing of ((getState() || {}).ingredients || [])) {
    const sub = (ing.subtypes || []).find(s => String(s.id) === String(id));
    if (sub) return { ...sub, parentIngredientId: ing.id, parentName: ing.name, category: ing.category };
  }
  return null;
}

export function getItemById(id) {
  if (!id) return null;
  const ing = getIngredientById(id);
  return ing ? { ...ing, type: 'ingredient' } : ((getSubtypeById(id)) ? { ...getSubtypeById(id), type: 'subtype' } : null);
}

export const PantryHierarchyModel = {
  getItemById, getIngredientById, getSubtypeById, slugCategory, slugifyToKebab, toCanonicalCategoryName,
  enforceCategorySSOT,
  isSubtypeItem, getActiveCategories, slugify, resolveDefaultProduct, compareProductsByStrategy,
  buildPantryHierarchy, addAlias: aliasIngredient, removeAlias, addSubtype: addSubtypeToIngredient,
  promoteSubtype: promoteToIngredient, demoteIngredient: demoteToSubtype, reparentSubtype, mergeIngredients,
  reallocateProduct, setAutoDefaultProduct
};
export const addAlias = aliasIngredient, addSubtype = addSubtypeToIngredient, promoteSubtype = promoteToIngredient, demoteIngredient = demoteToSubtype;
if (typeof window !== 'undefined') window.PantryHierarchyModel = PantryHierarchyModel;
