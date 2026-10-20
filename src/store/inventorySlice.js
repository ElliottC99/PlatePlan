/**
 * src/store/inventorySlice.js
 * Pantry inventory state management.
 */

import { state, dispatchStateEvent } from './state.js';
import { saveStateCache } from './cacheSlice.js';
import { savePantryItem, deletePantryItem, toggleUseUpStatusInDb } from '../repositories/InventoryRepository.js';

export function setInventory(newInventory) {
  state.inventory = Array.isArray(newInventory) ? newInventory : [];
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:inventory', state.inventory);
}

export function addPantryItem(item = {}) {
  if (!item || typeof item !== 'object') return null;
  const targetId = item.id || (item.subtypeId
    ? `inv_${item.ingredientId || 'custom'}_${item.subtypeId}`
    : (item.ingredientId ? `inv_${item.ingredientId}` : `inv_${Date.now()}`));

  const list = Array.isArray(state.inventory) ? [...state.inventory] : [];
  const idx = list.findIndex(i =>
    String(i.id) === String(targetId) ||
    (item.ingredientId &&
      String(i.ingredientId) === String(item.ingredientId) &&
      String(i.subtypeId || '') === String(item.subtypeId || '') &&
      i.status !== 'out_of_stock')
  );

  const addQty = Number(item.quantity ?? item.qty ?? 1) || 1;
  let updatedItem;

  if (idx !== -1) {
    const existing = list[idx];
    const currentQty = existing.status === 'out_of_stock' ? 0 : (Number(existing.quantity ?? existing.qty ?? 0) || 0);
    updatedItem = {
      ...existing,
      ...item,
      id: existing.id || targetId,
      status: 'in_stock',
      quantity: Number((currentQty + addQty).toFixed(2)),
      unit: item.unit || existing.unit || 'qty',
      updatedAt: new Date().toISOString()
    };
    list[idx] = updatedItem;
  } else {
    updatedItem = {
      id: targetId,
      ingredientId: item.ingredientId || null,
      subtypeId: item.subtypeId || null,
      productId: item.productId || null,
      customName: String(item.customName || item.name || 'Pantry Item').trim(),
      category: item.category || 'Store Cupboard',
      storage: item.storage || 'cupboard',
      status: 'in_stock',
      isUseUp: Boolean(item.isUseUp),
      quantity: addQty,
      unit: item.unit || 'qty',
      expiryDate: item.expiryDate || null,
      updatedAt: new Date().toISOString()
    };
    list.push(updatedItem);
  }

  state.inventory = list;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:inventory', state.inventory);
  savePantryItem(updatedItem);
  return updatedItem;
}

export function updatePantryItem(itemId, patch = {}) {
  if (!itemId && !patch.id) return null;
  const targetId = itemId || patch.id;
  const list = Array.isArray(state.inventory) ? [...state.inventory] : [];
  const idx = list.findIndex(i => String(i.id) === String(targetId));
  let updatedItem;
  if (idx !== -1) {
    updatedItem = { ...list[idx], ...patch, id: targetId, updatedAt: new Date().toISOString() };
    list[idx] = updatedItem;
  } else {
    updatedItem = {
      id: targetId,
      ingredientId: patch.ingredientId || null,
      subtypeId: patch.subtypeId || null,
      productId: patch.productId || null,
      customName: patch.customName || patch.name || 'Pantry Item',
      category: patch.category || 'Store Cupboard',
      storage: patch.storage || 'cupboard',
      status: 'in_stock',
      isUseUp: false,
      quantity: 1,
      unit: 'qty',
      expiryDate: null,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    list.push(updatedItem);
  }
  state.inventory = list;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:inventory', state.inventory);

  savePantryItem(updatedItem);
  return updatedItem;
}

export function removePantryItem(itemId) {
  if (!itemId) return;
  const list = Array.isArray(state.inventory) ? state.inventory : [];
  state.inventory = list.filter(i => String(i.id) !== String(itemId));
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:inventory', state.inventory);

  deletePantryItem(itemId);
}

export function toggleUseUpStatus(itemId) {
  if (!itemId) return;
  const list = state.inventory || [];
  const item = list.find(i => i.id === itemId);
  if (!item) return;
  const newStatus = !item.isUseUp;
  updatePantryItem(itemId, { isUseUp: newStatus });
  toggleUseUpStatusInDb(itemId, newStatus);
}
