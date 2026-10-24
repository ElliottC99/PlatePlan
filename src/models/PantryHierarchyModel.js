/**
 * src/models/PantryHierarchyModel.js (v3.38.60)
 * Relational Model & Operations for Category ➔ Ingredient ➔ Sub-type ➔ Product hierarchy.
 * Decomposed: Traversal and building logic moved to PantryHierarchyService.js.
 */

import { getState, setIngredients, setProducts } from '../store/store.js';
import { saveRootItem as saveIngredient, deleteRootItem as deleteIngredient } from '../services/RootItemRepository.js';
import { saveProduct } from '../services/ProductRepository.js';
import { slugCategory, slugifyToKebab, toCanonicalCategoryName, slugify } from '../utils/pantryUtils.js';
import { 
  enforceCategorySSOT, 
  compareProductsByStrategy, 
  resolveDefaultProduct, 
  buildPantryHierarchy, 
  invalidateHierarchyCache, 
  debouncedBuildPantryHierarchy 
} from '../services/PantryHierarchyService.js';

export { slugCategory, slugifyToKebab, toCanonicalCategoryName, slugify };
export { enforceCategorySSOT, compareProductsByStrategy, resolveDefaultProduct, buildPantryHierarchy, invalidateHierarchyCache, debouncedBuildPantryHierarchy };

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

export async function aliasIngredient(ingredientId, aliasName) {
  const cleanAlias = (aliasName || '').trim();
  if (!ingredientId || !cleanAlias) return false;
  const state = getState(), ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(ingredientId));
  if (!ing) return false;
  const existing = Array.isArray(ing.aliases) ? [...ing.aliases] : (ing.alias ? [ing.alias] : []);
  if (!existing.some(a => a.toLowerCase() === cleanAlias.toLowerCase())) existing.push(cleanAlias);
  ing.aliases = existing; ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return true;
}

export async function removeAlias(ingredientId, aliasToRemove) {
  const state = getState(), ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(ingredientId));
  if (!ing || !Array.isArray(ing.aliases)) return false;
  ing.aliases = ing.aliases.filter(a => a.toLowerCase() !== (aliasToRemove || '').toLowerCase());
  ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return true;
}

export async function addSubtypeToIngredient(parentIngredientId, subtypeName, subtypeNotes = '') {
  const cleanName = (subtypeName || '').trim();
  if (!parentIngredientId || !cleanName) return false;
  const state = getState(), ings = [...(state.ingredients || [])], ing = ings.find(i => String(i.id) === String(parentIngredientId));
  if (!ing) return false;
  const currentSubtypes = Array.isArray(ing.subtypes) ? [...ing.subtypes] : [];
  const newSubtype = { id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, name: cleanName, notes: subtypeNotes.trim(), aliases: [], defaultProductId: null, createdAt: new Date().toISOString() };
  currentSubtypes.push(newSubtype); ing.subtypes = currentSubtypes; ing.updatedAt = new Date().toISOString();
  setIngredients(ings); await saveIngredient(ing);
  return newSubtype;
}

export async function promoteToIngredient(subtypeId, parentIngredientId) {
  const state = getState(), ings = [...(state.ingredients || [])];
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
  const state = getState(), ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
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
  const state = getState(), ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
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
  const state = getState(), ings = [...(state.ingredients || [])], prods = [...(state.products || [])];
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
  const state = getState(), prods = [...(state.products || [])], ings = state.ingredients || [];
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
  const state = getState(), prods = [...(state.products || [])], ings = [...(state.ingredients || [])];
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
  return !id ? null : ((getState()).ingredients || []).find(i => String(i.id) === String(id)) || null;
}

export function getSubtypeById(id) {
  if (!id) return null;
  for (const ing of ((getState()).ingredients || [])) {
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
