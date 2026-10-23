/**
 * src/components/pantry/IngredientReorganiseOperations.js (v3.42.15)
 * Firestore operations for Root Item reorganization (Promote, Move, Merge, Demote).
 */

import { getState, setIngredients, setProducts, setCategories } from '../../store/store.js';
import { saveIngredient, deleteIngredient } from '../../services/IngredientRepository.js';
import { getProducts, saveProduct } from '../../services/ProductRepository.js';
import { getUnifiedCategories, saveCategories } from '../../services/HouseholdRepository.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';

export async function executePromoteItemToCategory(ingredientId) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const ing = ingredients.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  const newCategoryName = ing.name;
  const categories = getUnifiedCategories(state);
  if (!categories.some(c => c.toLowerCase() === newCategoryName.toLowerCase())) {
    const updatedCats = [...categories, newCategoryName].sort((a,b) => a.localeCompare(b));
    setCategories(updatedCats);
    await saveCategories(updatedCats);
  }

  const products = await getProducts();
  const subtypes = Array.isArray(ing.subtypes) ? ing.subtypes : [];

  if (subtypes.length === 0) {
    subtypes.push({
      id: 'sub_' + Date.now() + Math.random().toString(36).substring(2, 6),
      name: ing.name,
      updatedAt: new Date().toISOString()
    });
  }

  const newIngs = [];
  const productUpdates = [];

  for (const st of subtypes) {
    const newIngId = 'ing_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const defaultSubId = 'sub_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const newRootIng = {
      id: newIngId,
      name: st.name,
      category: newCategoryName,
      unit: ing.unit || '',
      subtypes: [{
        id: defaultSubId,
        name: st.name,
        notes: st.notes || '',
        updatedAt: new Date().toISOString()
      }],
      aliases: st.aliases || [],
      updatedAt: new Date().toISOString()
    };
    newIngs.push(newRootIng);
    await saveIngredient(newRootIng);

    if (st.id) {
      products.forEach(p => {
        if (String(p.subtypeId || p.subTypeId) === String(st.id)) {
          p.ingredientId = newIngId;
          p.subtypeId = defaultSubId;
          p.category = newCategoryName;
          p.updatedAt = new Date().toISOString();
          productUpdates.push(saveProduct(p));
        }
      });
    }
  }

  products.forEach(p => {
    if (String(p.ingredientId) === String(ingredientId) && !productUpdates.includes(p)) {
      p.category = newCategoryName;
      p.updatedAt = new Date().toISOString();
      productUpdates.push(saveProduct(p));
    }
  });

  await Promise.all(productUpdates);
  await deleteIngredient(ingredientId);

  const freshIngs = (state.ingredients || []).filter(i => String(i.id) !== String(ingredientId)).concat(newIngs);
  setIngredients(freshIngs);
  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}

export async function executeMoveItemCategory(ingredientId, newCategory) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const ing = ingredients.find(i => String(i.id) === String(ingredientId));
  if (!ing) return;

  ing.category = newCategory;
  ing.updatedAt = new Date().toISOString();
  if (Array.isArray(ing.subtypes)) {
    ing.subtypes.forEach(st => { st.category = newCategory; });
  }

  setIngredients([...ingredients]);
  await saveIngredient(ing);

  const products = await getProducts();
  const productUpdates = products.filter(p => String(p.ingredientId) === String(ingredientId)).map(p => {
    p.category = newCategory;
    p.updatedAt = new Date().toISOString();
    return saveProduct(p);
  });
  await Promise.all(productUpdates);

  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}

export async function executeMergeItem(sourceId, targetId) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const source = ingredients.find(i => String(i.id) === String(sourceId));
  const target = ingredients.find(i => String(i.id) === String(targetId));
  if (!source || !target) return;

  const targetSubtypes = Array.isArray(target.subtypes) ? target.subtypes : [];
  const sourceSubtypes = Array.isArray(source.subtypes) ? source.subtypes : [];
  target.subtypes = [...targetSubtypes, ...sourceSubtypes];
  target.updatedAt = new Date().toISOString();

  const targetAliases = Array.isArray(target.aliases) ? target.aliases : [];
  const sourceAliases = Array.isArray(source.aliases) ? source.aliases : [];
  target.aliases = Array.from(new Set([...targetAliases, source.name, ...sourceAliases]));

  setIngredients(ingredients.filter(i => String(i.id) !== String(sourceId)));
  await saveIngredient(target);

  const products = await getProducts();
  const productUpdates = products.filter(p => String(p.ingredientId) === String(sourceId)).map(p => {
    p.ingredientId = targetId;
    p.category = target.category;
    p.updatedAt = new Date().toISOString();
    return saveProduct(p);
  });
  await Promise.all(productUpdates);
  await deleteIngredient(sourceId);

  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}

export async function executeDemoteItemToSubtype(sourceId, parentId) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const source = ingredients.find(i => String(i.id) === String(sourceId));
  const parent = ingredients.find(i => String(i.id) === String(parentId));
  if (!source || !parent) return;

  const newSubId = 'sub_' + Date.now() + Math.random().toString(36).substring(2, 6);
  const newSub = {
    id: newSubId,
    name: source.name,
    notes: source.unit ? `Unit: ${source.unit}` : '',
    updatedAt: new Date().toISOString()
  };

  const parentSubtypes = Array.isArray(parent.subtypes) ? parent.subtypes : [];
  parent.subtypes = [...parentSubtypes, newSub];
  parent.updatedAt = new Date().toISOString();

  setIngredients(ingredients.filter(i => String(i.id) !== String(sourceId)));
  await saveIngredient(parent);

  const products = await getProducts();
  const productUpdates = products.filter(p => String(p.ingredientId) === String(sourceId) || String(p.subtypeId || '') === String(sourceId)).map(p => {
    p.ingredientId = parentId;
    p.subtypeId = newSubId;
    p.category = parent.category;
    p.updatedAt = new Date().toISOString();
    return saveProduct(p);
  });
  await Promise.all(productUpdates);
  await deleteIngredient(sourceId);

  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}
