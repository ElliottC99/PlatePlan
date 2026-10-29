/**
 * src/services/PantryTaxonomyService.js (v3.45.5)
 * Centralized taxonomy engine coordinating atomic hierarchy commits and safe reallocations:
 * Category ➔ RootItem ➔ Sub-type ➔ Product.
 * Includes Data Quality verification hooks.
 * Strictly under 350 lines. Zero DOM dependencies.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';
import { getState, setCategories, setIngredients, setProducts, setRecipes, saveStateCache } from '../store/store.js';
import { getCategories, saveCategories } from './CategoryRepository.js';
import { getProducts, saveProduct, addProductToBatch } from './ProductRepository.js';
import { addRecipeToBatch } from './RecipeFirestoreRepository.js';

function isDbAvailable() {
  if (!db) { console.warn('[PantryTaxonomyService] Firestore db instance not initialised.'); return false; }
  return true;
}

async function safeFirestoreGet(ref, timeoutMs = 2500) {
  if (!ref || typeof ref.get !== 'function') return null;
  try {
    const netPromise = ref.get();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore get timeout')), timeoutMs));
    return await Promise.race([netPromise, timeoutPromise]);
  } catch (_netErr) {
    try { return await ref.get({ source: 'cache' }); } catch (_cacheErr) { return null; }
  }
}

export async function getRootItems() {
  try {
    if (!isDbAvailable()) return [];
    const snap = await safeFirestoreGet(db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients'));
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const prods = (typeof window !== 'undefined' && getState()?.products) || [];
    return enforceCategorySSOT({ ingredients: raw, products: prods }).ingredients;
  } catch (err) {
    console.warn('[PantryTaxonomyService] getRootItems error:', err);
    return [];
  }
}

export async function saveRootItem(rootItem) {
  try {
    if (!isDbAvailable() || !rootItem || typeof rootItem !== 'object') return { success: false, error: 'Invalid' };
    const prods = (typeof window !== 'undefined' && getState()?.products) || [];
    const enforced = enforceCategorySSOT({ ingredients: [rootItem], products: prods });
    const finalItem = enforced.ingredients[0] || rootItem;
    const itemData = { ...finalItem, schemaVersion: 2, updatedAt: new Date().toISOString() };
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients');
    const itemId = rootItem.id || colRef.doc().id;
    delete itemData.id;
    delete itemData.ref;
    await colRef.doc(String(itemId)).set(itemData, { merge: true });
    return { success: true, id: itemId };
  } catch (err) {
    console.error('[PantryTaxonomyService] saveRootItem error:', err);
    return { success: false, error: err };
  }
}

export async function deleteRootItem(rootItemId) {
  try {
    if (!isDbAvailable() || !rootItemId) return { success: false, error: 'Unavailable or missing ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').doc(String(rootItemId)).delete();
    return { success: true };
  } catch (err) {
    console.error('[PantryTaxonomyService] deleteRootItem error:', err);
    return { success: false, error: err };
  }
}

export const getIngredients = getRootItems;
export const saveIngredient = saveRootItem;
export const deleteIngredient = deleteRootItem;

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

// ---- Guided delete: docs/plans/2026-10-29-1810-feat-pantry-guided-delete-plan.md ----

// One Firestore batch holds at most 500 writes; stay clear of it rather than split (KTD2).
const GUIDED_DELETE_WRITE_LIMIT = 450;

const sameId = (a, b) => a !== undefined && a !== null && a !== '' && String(a) === String(b);
const itemCategory = item => item?.category || item?.cat || '';

// Rewrites a recipe line to point at a category, root item or sub-type, clearing every field
// that still names the old target so shopping can't resolve through it (KTD4).
function remapRecipeLine(line, target, state) {
  const out = { ...line };
  for (const k of ['ingredientId', 'pantryItemId', 'bankId', 'groupId', 'subtypeId', 'subtypeName', 'productId', 'productName']) delete out[k];
  if (target.kind === 'category') {
    out.categoryId = target.name;
    out.name = target.name;
    return out;
  }
  const item = (state.ingredients || []).find(i => sameId(i.id, target.itemId)) || target.item || {};
  const itemId = String(target.itemId);
  Object.assign(out, { ingredientId: itemId, pantryItemId: itemId, bankId: itemId, groupId: `grp_${itemId}`, categoryId: itemCategory(item) });
  out.name = item.name || out.name;
  if (target.kind === 'subtype') {
    const sub = (item.subtypes || []).find(st => sameId(st.id, target.subtypeId)) || target.subtype || {};
    out.subtypeId = String(target.subtypeId);
    out.subtypeName = sub.name || '';
    if (sub.name) out.name = `${item.name} (${sub.name})`;
  }
  return out;
}

// The recipe lines a recipe holds, with a stable key for each (original, enhanced, and their sections).
function recipeLineSlots(recipe) {
  const slots = [];
  const add = (lines, where) => (Array.isArray(lines) ? lines : []).forEach((line, idx) => {
    if (line && typeof line === 'object') slots.push({ where, idx, line, key: `${recipe.id}|${where}|${idx}` });
  });
  add(recipe.ingredients, 'ingredients');
  (recipe.ingredientSections || []).forEach((sec, n) => add(sec?.ingredients, `sections.${n}`));
  add(recipe.enhanced?.ingredients, 'enhanced.ingredients');
  (recipe.enhanced?.ingredientSections || []).forEach((sec, n) => add(sec?.ingredients, `enhanced.sections.${n}`));
  return slots;
}

function setRecipeLine(recipe, where, idx, line) {
  const parts = where.split('.');
  const enhanced = parts[0] === 'enhanced';
  const rest = enhanced ? parts.slice(1) : parts;
  const holder = enhanced ? (recipe.enhanced = { ...recipe.enhanced }) : recipe;
  if (rest[0] === 'ingredients') {
    holder.ingredients = [...holder.ingredients];
    holder.ingredients[idx] = line;
  } else {
    const n = Number(rest[1]);
    holder.ingredientSections = [...holder.ingredientSections];
    const sec = { ...holder.ingredientSections[n], ingredients: [...holder.ingredientSections[n].ingredients] };
    sec.ingredients[idx] = line;
    holder.ingredientSections[n] = sec;
  }
}

// Works out a whole delete from in-memory state and the dialog's choices, without writing anything (KTD1).
// target: { kind: 'category', name } | { kind: 'item', id } | { kind: 'subtype', itemId, subtypeId }
// choices: { newSubtypes: [{ id, itemId, name }], productsAll, products: { [productId]: dest },
//            linesAll, lines: { [lineKey]: dest } }
export function planGuidedDelete(state, target, choices = {}) {
  const ingredients = state.ingredients || [];
  const categories = state.categories || [];
  const errors = [];

  const removed = { categories: [], items: [], subtypes: [] };
  if (target.kind === 'category') {
    removed.categories = [target.name];
    removed.items = ingredients.filter(i => itemCategory(i) === target.name);
  } else if (target.kind === 'item') {
    removed.items = ingredients.filter(i => sameId(i.id, target.id));
  } else {
    const parent = ingredients.find(i => sameId(i.id, target.itemId));
    removed.subtypes = (parent?.subtypes || []).filter(st => sameId(st.id, target.subtypeId));
  }
  removed.items.forEach(i => removed.subtypes.push(...(i.subtypes || [])));
  const removedItemIds = new Set(removed.items.map(i => String(i.id)));
  const removedSubIds = new Set(removed.subtypes.map(st => String(st.id)));
  if (target.kind === 'subtype') removedSubIds.add(String(target.subtypeId));
  const removedCats = new Set(removed.categories);

  // New sub-types created in the dialog join their parent's list in the same batch.
  const updatedItems = new Map();
  const itemFor = id => updatedItems.get(String(id)) || ingredients.find(i => sameId(i.id, id));
  for (const ns of choices.newSubtypes || []) {
    const name = String(ns.name || '').trim();
    const parent = itemFor(ns.itemId);
    if (!parent || removedItemIds.has(String(ns.itemId))) { errors.push('A new sub-type must go under an item that is not being deleted.'); continue; }
    if (!name) { errors.push('A new sub-type needs a name.'); continue; }
    if ((parent.subtypes || []).some(st => String(st.name || '').trim().toLowerCase() === name.toLowerCase())) { errors.push(`"${parent.name}" already has a sub-type called "${name}".`); continue; }
    updatedItems.set(String(parent.id), { ...parent, subtypes: [...(parent.subtypes || []), { id: ns.id, name, parentId: String(parent.id), aliases: [], category: itemCategory(parent), createdAt: new Date().toISOString() }] });
  }

  const liveSubtype = (itemId, subtypeId) => {
    if (removedItemIds.has(String(itemId)) || removedSubIds.has(String(subtypeId))) return null;
    const item = itemFor(itemId);
    const sub = (item?.subtypes || []).find(st => sameId(st.id, subtypeId));
    return sub ? { item, sub } : null;
  };

  // Products under anything removed must move to a surviving sub-type (R6, KTD5).
  const products = (state.products || []).filter(p => removedSubIds.has(String(p.subtypeId ?? p.subTypeId)) || removedItemIds.has(String(p.ingredientId))).map(p => {
    const dest = choices.products?.[p.id] || choices.productsAll || null;
    if (!dest) return { product: p, needsHome: true };
    const live = liveSubtype(dest.itemId, dest.subtypeId);
    if (!live) { errors.push(`"${p.name}" can't move somewhere that is being deleted or doesn't exist.`); return { product: p, needsHome: true, destination: dest }; }
    return { product: p, needsHome: false, destination: dest, live };
  });

  // Recipe lines naming anything removed must be remapped (R8, KTD4).
  const usesRemoved = line => [line.ingredientId, line.pantryItemId, line.bankId].some(v => v != null && removedItemIds.has(String(v)))
    || (line.subtypeId != null && removedSubIds.has(String(line.subtypeId)))
    || (line.groupId != null && removedItemIds.has(String(line.groupId).replace(/^grp_/, '')))
    || (line.categoryId != null && removedCats.has(String(line.categoryId)));
  const liveTarget = dest => {
    if (dest.kind === 'category') return categories.includes(dest.name) && !removedCats.has(dest.name);
    if (dest.kind === 'item') return !!itemFor(dest.itemId) && !removedItemIds.has(String(dest.itemId));
    return !!liveSubtype(dest.itemId, dest.subtypeId);
  };
  const lines = [];
  for (const recipe of state.recipes || []) {
    for (const slot of recipeLineSlots(recipe)) {
      if (!usesRemoved(slot.line)) continue;
      const dest = choices.lines?.[slot.key] || choices.linesAll || null;
      const entry = { recipeId: recipe.id, recipeName: recipe.name || recipe.title || '', ...slot, needsHome: !dest, destination: dest };
      if (dest && !liveTarget(dest)) { errors.push(`A line in "${entry.recipeName}" can't be remapped somewhere that is being deleted or doesn't exist.`); entry.needsHome = true; }
      lines.push(entry);
    }
  }

  const writes = [];
  for (const entry of products.filter(e => !e.needsHome)) {
    const { item, sub } = entry.live;
    const moved = { ...entry.product, ingredientId: String(item.id), subtypeId: String(sub.id), subTypeId: String(sub.id), category: itemCategory(item), isAutoDefault: false };
    if ('is_default' in moved) moved.is_default = false;
    writes.push({ type: 'product', data: moved });
  }
  const recipesById = new Map();
  for (const entry of lines.filter(e => !e.needsHome)) {
    const base = recipesById.get(String(entry.recipeId)) || { ...(state.recipes || []).find(r => sameId(r.id, entry.recipeId)) };
    setRecipeLine(base, entry.where, entry.idx, remapRecipeLine(entry.line, entry.destination, { ingredients: [...updatedItems.values(), ...ingredients] }));
    recipesById.set(String(entry.recipeId), base);
  }
  recipesById.forEach(r => writes.push({ type: 'recipe', data: r }));
  if (target.kind === 'subtype') {
    const parent = itemFor(target.itemId);
    if (parent) updatedItems.set(String(parent.id), { ...parent, subtypes: (parent.subtypes || []).filter(st => !sameId(st.id, target.subtypeId)) });
  }
  updatedItems.forEach(item => writes.push({ type: 'item', data: item }));
  removed.items.forEach(i => writes.push({ type: 'deleteItem', id: String(i.id) }));
  if (removed.categories.length) writes.push({ type: 'categories', data: categories.filter(c => !removedCats.has(c)) });

  // Every affected product and recipe gets written once homed, so the size is known before any choice (step 1 refusal).
  const projected = products.length + new Set(lines.map(e => String(e.recipeId))).size + writes.filter(w => w.type !== 'product' && w.type !== 'recipe').length;
  if (projected > GUIDED_DELETE_WRITE_LIMIT) errors.push('Too many changes to save in one go.');
  const needsHome = products.filter(e => e.needsHome).length + lines.filter(e => e.needsHome).length;
  return { target, removed, products, lines, errors, needsHome, writes };
}

// Saves a planned delete in one batch; the store changes only after the commit resolves (KTD2, KTD3).
export async function applyGuidedDelete(plan) {
  if (!plan || plan.errors.length || plan.needsHome) return { success: false, error: 'The delete is not ready.' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { success: false, offline: true };
  if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
  const household = db.collection('households').doc(HOUSEHOLD_ID);
  const batch = db.batch();
  const stamp = new Date().toISOString();
  for (const w of plan.writes) {
    if (w.type === 'product') addProductToBatch(batch, w.data);
    else if (w.type === 'recipe') addRecipeToBatch(batch, w.data);
    else if (w.type === 'item') {
      const data = { ...w.data, schemaVersion: 2, updatedAt: stamp };
      delete data.id;
      batch.set(household.collection('ingredients').doc(String(w.data.id)), data, { merge: true });
    } else if (w.type === 'deleteItem') batch.delete(household.collection('ingredients').doc(String(w.id)));
    else if (w.type === 'categories') batch.set(household.collection('settings').doc('categories'), { categories: w.data, updatedAt: stamp }, { merge: true });
  }
  try {
    await batch.commit();
  } catch (err) {
    console.error('[PantryTaxonomyService] Guided delete commit failed:', err);
    return { success: false, error: err };
  }

  const state = getState();
  const writtenById = type => new Map(plan.writes.filter(w => w.type === type).map(w => [String(w.data.id), w.data]));
  const items = writtenById('item'), prods = writtenById('product'), recipes = writtenById('recipe');
  const deleted = new Set(plan.writes.filter(w => w.type === 'deleteItem').map(w => w.id));
  setIngredients((state.ingredients || []).filter(i => !deleted.has(String(i.id))).map(i => items.get(String(i.id)) || i));
  setProducts((state.products || []).map(p => prods.get(String(p.id)) || p));
  setRecipes((state.recipes || []).map(r => recipes.get(String(r.id)) || r));
  const cats = plan.writes.find(w => w.type === 'categories');
  if (cats) setCategories(cats.data);
  saveStateCache(getState());
  return { success: true };
}
