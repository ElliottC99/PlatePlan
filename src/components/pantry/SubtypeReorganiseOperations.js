/**
 * src/components/pantry/SubtypeReorganiseOperations.js (v3.42.20)
 * Firestore operations for Sub-type reorganization (Promote, Move, Merge) and product reallocation.
 */

import { getState, setIngredients, setProducts } from '../../store/store.js';
import { saveIngredient } from '../../services/IngredientRepository.js';
import { getProducts, saveProduct } from '../../services/ProductRepository.js';
import { invalidateHierarchyCache } from '../../models/PantryHierarchyModel.js';

export async function executePromoteSubtypeToItem(subtypeId, parentId) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const parent = ingredients.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;

  const subIndex = parent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIndex === -1) return;

  const sub = parent.subtypes[subIndex];
  const newIngId = 'ing_' + Date.now() + Math.random().toString(36).substring(2, 6);
  const defaultSubId = 'sub_' + Date.now() + Math.random().toString(36).substring(2, 6);

  const newRootIng = {
    id: newIngId,
    name: sub.name,
    category: parent.category || 'Pantry',
    unit: '',
    subtypes: [{
      id: defaultSubId,
      name: sub.name,
      notes: sub.notes || '',
      updatedAt: new Date().toISOString()
    }],
    aliases: sub.aliases || [],
    updatedAt: new Date().toISOString()
  };

  // Remove sub from parent
  parent.subtypes.splice(subIndex, 1);
  parent.updatedAt = new Date().toISOString();

  await saveIngredient(newRootIng);
  await saveIngredient(parent);

  const products = await getProducts();
  const productUpdates = products.filter(p => String(p.subtypeId || p.subTypeId) === String(subtypeId)).map(p => {
    p.ingredientId = newIngId;
    p.subtypeId = defaultSubId;
    p.category = parent.category || 'Pantry';
    p.updatedAt = new Date().toISOString();
    return saveProduct(p);
  });
  await Promise.all(productUpdates);

  const freshIngs = [...(state.ingredients || []), newRootIng];
  setIngredients(freshIngs);
  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}

export async function executeMoveSubtypeToParent(subtypeId, oldParentId, newParentId) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const oldParent = ingredients.find(i => String(i.id) === String(oldParentId));
  const newParent = ingredients.find(i => String(i.id) === String(newParentId));
  if (!oldParent || !newParent || !Array.isArray(oldParent.subtypes)) return;

  const subIndex = oldParent.subtypes.findIndex(s => String(s.id) === String(subtypeId));
  if (subIndex === -1) return;

  const sub = oldParent.subtypes.splice(subIndex, 1)[0];
  oldParent.updatedAt = new Date().toISOString();

  if (!Array.isArray(newParent.subtypes)) newParent.subtypes = [];
  sub.category = newParent.category || 'Pantry';
  newParent.subtypes.push(sub);
  newParent.updatedAt = new Date().toISOString();

  await saveIngredient(oldParent);
  await saveIngredient(newParent);

  const products = await getProducts();
  const productUpdates = products.filter(p => String(p.subtypeId || p.subTypeId) === String(subtypeId)).map(p => {
    p.ingredientId = newParentId;
    p.category = newParent.category || 'Pantry';
    p.updatedAt = new Date().toISOString();
    return saveProduct(p);
  });
  await Promise.all(productUpdates);

  setIngredients([...ingredients]);
  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}

export async function executeMergeSubtype(sourceSubtypeId, targetSubtypeId, parentId) {
  const state = getState();
  const ingredients = state.ingredients || [];
  const parent = ingredients.find(i => String(i.id) === String(parentId));
  if (!parent || !Array.isArray(parent.subtypes)) return;

  const sourceIndex = parent.subtypes.findIndex(s => String(s.id) === String(sourceSubtypeId));
  const target = parent.subtypes.find(s => String(s.id) === String(targetSubtypeId));
  if (sourceIndex === -1 || !target) return;

  const source = parent.subtypes.splice(sourceIndex, 1)[0];
  parent.updatedAt = new Date().toISOString();

  // Merge aliases or notes if needed
  const targetAliases = Array.isArray(target.aliases) ? target.aliases : [];
  const sourceAliases = Array.isArray(source.aliases) ? source.aliases : [];
  target.aliases = Array.from(new Set([...targetAliases, source.name, ...sourceAliases]));

  await saveIngredient(parent);

  const products = await getProducts();
  const productUpdates = products.filter(p => String(p.subtypeId || p.subTypeId) === String(sourceSubtypeId)).map(p => {
    p.subtypeId = targetSubtypeId;
    p.updatedAt = new Date().toISOString();
    return saveProduct(p);
  });
  await Promise.all(productUpdates);

  setIngredients([...ingredients]);
  invalidateHierarchyCache();
  if (typeof window.renderIngredientBank === 'function') window.renderIngredientBank();
  if (typeof window.renderProductBank === 'function') window.renderProductBank();
}
