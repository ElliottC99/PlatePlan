/**
 * src/models/PantryHierarchyModel.js (v3.20.01)
 * Relational Model & Operations for Category ➔ Ingredient ➔ Sub-type ➔ Product hierarchy.
 * Encapsulates aliasing, merging, promoting/demoting, and auto-default product resolution.
 */

import { getState, setIngredients, setProducts } from '../store/store.js';
import { saveIngredient, deleteIngredient, saveProduct } from '../services/HouseholdRepository.js';

export const slugCategory = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const slugifyToKebab = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function isSubtypeItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.isSubtype === true || item.is_subtype === true || item.type === 'subtype' || item.kind === 'subtype') return true;
  if (item.parentId || item.parent_id || item.parentIngredientId || item.parent_ingredient_id || item.parentName) return true;
  return false;
}

export function getActiveCategories(state = {}) {
  const categoryMap = new Map();
  (Array.isArray(state.categories) ? state.categories : []).forEach(c => {
    const name = typeof c === 'string' ? c : c?.name;
    if (name?.trim()) { const slug = slugCategory(name); if (slug && !categoryMap.has(slug)) categoryMap.set(slug, name.trim()); }
  });
  (Array.isArray(state.ingredients) ? state.ingredients : []).forEach(i => {
    const cat = i.category || i.cat;
    if (cat && typeof cat === 'string' && cat.trim()) { const slug = slugCategory(cat); if (slug && !categoryMap.has(slug)) categoryMap.set(slug, cat.charAt(0).toUpperCase() + cat.slice(1)); }
  });
  (Array.isArray(state.products) ? state.products : []).forEach(p => {
    const cat = p.category || p.cat;
    if (cat && typeof cat === 'string' && cat.trim()) { const slug = slugCategory(cat); if (slug && !categoryMap.has(slug)) categoryMap.set(slug, cat.charAt(0).toUpperCase() + cat.slice(1)); }
  });
  return Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b));
}

export function slugify(str) {
  if (!str || typeof str !== 'string') return '';
  let normalized = str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  if (normalized.endsWith('oes') && normalized.length > 4) normalized = normalized.slice(0, -2);
  else if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) normalized = normalized.slice(0, -1);
  return normalized;
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
    const criterion = state.settings?.autoDefaultCriterion || state.userPrefs?.autoDefaultCriterion || 'lowest-price';
    const sorted = [...pool].sort((a, b) => {
      const priceA = Number(a.price || Infinity), priceB = Number(b.price || Infinity);
      const sizeA = Number(a.packSize || a.pack || a.itemWeight || 1), sizeB = Number(b.packSize || b.pack || b.itemWeight || 1);
      const protA = Number(a.prot || a.protein || 0), protB = Number(b.prot || b.protein || 0);
      const kcalA = Number(a.kcal || a.cal || Infinity), kcalB = Number(b.kcal || b.cal || Infinity);
      if (criterion === 'lowest-unit-price') return (priceA / sizeA) - (priceB / sizeB);
      if (criterion === 'highest-protein') return protB - protA;
      if (criterion === 'lowest-calories') return kcalA - kcalB;
      return priceA - priceB;
    });
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
      else {
        subtypeItems.push({
          ...i,
          parentId: primary ? primary.id : i.groupId,
          parentName: primary ? primary.name : 'Unknown Core'
        });
      }
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

  const categoryMap = new Map();
  const orphanSubtypes = [];

  rootIngredients.forEach(root => {
    const cat = root.category || 'General';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);

    const directProducts = productMap.get(root.id) || [];
    const childSubtypes = [
      ...(Array.isArray(root.subtypes) ? root.subtypes : []),
      ...(subtypeMap.get(root.id) || [])
    ];

    const uniqueSubtypes = Array.from(new Map(childSubtypes.map(s => [s.id || s.name, s])).values());
    const enrichedSubtypes = uniqueSubtypes.map(st => {
      const stProducts = productMap.get(st.id) || [];
      return {
        ...st,
        parentId: root.id,
        parentName: root.name,
        products: stProducts,
        defaultProduct: resolveDefaultProduct(st, stProducts.length ? stProducts : directProducts)
      };
    });

    categoryMap.get(cat).push({
      ...root,
      subtypes: enrichedSubtypes,
      directProducts,
      products: directProducts,
      defaultProduct: resolveDefaultProduct(root, directProducts)
    });
  });

  subtypeItems.forEach(sub => {
    const pId = sub.parentId || sub.parent_id || sub.parentIngredientId || sub.parent_ingredient_id;
    const isMapped = rootIngredients.some(r => r.id === pId);
    if (!isMapped) orphanSubtypes.push(sub);
  });

  if (orphanSubtypes.length > 0) {
    const cat = 'Unassigned Sub-types';
    categoryMap.set(cat, [{
      id: 'group_orphan_subtypes',
      name: 'Unassigned Sub-types',
      category: cat,
      subtypes: orphanSubtypes.map(st => ({
        ...st,
        products: productMap.get(st.id) || [],
        defaultProduct: resolveDefaultProduct(st, prodList)
      })),
      directProducts: [],
      products: [],
      defaultProduct: null
    }]);
  }

  return Array.from(categoryMap.entries())
    .map(([category, items]) => ({
      category,
      ingredients: items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function logPantryHierarchyTelemetry(ingredients = [], products = []) {
  return buildPantryHierarchy(ingredients, products, { verbose: true });
}

let buildHierarchyTimer = null;
let cachedHierarchyResult = null;

export function invalidateHierarchyCache() {
  cachedHierarchyResult = null;
}

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
  setIngredients(ings);
  setProducts(updatedProds);
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
  const ings = (getState() || {}).ingredients || [];
  for (const ing of ings) {
    const sub = (ing.subtypes || []).find(s => String(s.id) === String(id));
    if (sub) return { ...sub, parentIngredientId: ing.id, parentName: ing.name, category: ing.category };
  }
  return null;
}

export function getItemById(id) {
  if (!id) return null;
  const ing = getIngredientById(id);
  if (ing) return { ...ing, type: 'ingredient' };
  const sub = getSubtypeById(id);
  return sub ? { ...sub, type: 'subtype' } : null;
}

export const PantryHierarchyModel = {
  getItemById, getIngredientById, getSubtypeById,
  slugCategory, slugifyToKebab, isSubtypeItem, getActiveCategories, slugify, resolveDefaultProduct,
  buildPantryHierarchy, addAlias: aliasIngredient, removeAlias, addSubtype: addSubtypeToIngredient,
  promoteSubtype: promoteToIngredient, demoteIngredient: demoteToSubtype, reparentSubtype, mergeIngredients,
  reallocateProduct, setAutoDefaultProduct
};

export const addAlias = aliasIngredient, addSubtype = addSubtypeToIngredient;
export const promoteSubtype = promoteToIngredient, demoteIngredient = demoteToSubtype;

if (typeof window !== 'undefined') window.PantryHierarchyModel = PantryHierarchyModel;
