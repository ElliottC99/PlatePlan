/**
 * src/store/shoppingSlice.js
 * Shopping list state management.
 */

import { state, dispatchStateEvent } from './state.js';
import { saveStateCache } from './cacheSlice.js';

export async function setShoppingList(listOrArray) {
  if (Array.isArray(listOrArray)) {
    state.shoppingList = listOrArray;
  } else if (listOrArray && typeof listOrArray === 'object') {
    state.shoppingList = Array.isArray(listOrArray.items) ? listOrArray.items : [];
  } else {
    state.shoppingList = [];
  }
  
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:shopping', state.shoppingList);
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);

  if (listOrArray && !Array.isArray(listOrArray) && listOrArray.id) {
    try {
      const { saveShoppingList } = await import('../repositories/ShoppingListRepository.js');
      await saveShoppingList(listOrArray);
    } catch (err) {
      console.warn('[Store] Failed to persist shopping list:', err);
    }
  }
}

export async function toggleShoppingItem(itemId) {
  const item = state.shoppingList.find(i => i.id === itemId);
  if (!item) return;

  item.isChecked = !item.isChecked;
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);
}

export async function addManualShoppingItem(newItem) {
  const item = {
    id: `item_${Math.random().toString(36).substr(2, 9)}`,
    ingredientId: newItem.ingredientId || '',
    name: newItem.name || 'Custom Item',
    category: newItem.category || 'Uncategorized',
    requiredQty: Number(newItem.requiredQty) || 1,
    inStockQty: 0,
    buyQty: Number(newItem.requiredQty) || 1,
    unit: newItem.unit || 'qty',
    isChecked: false,
    isManualAdd: true,
    ...newItem
  };

  state.shoppingList.push(item);
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);
}

export async function updateShoppingItemQty(itemId, newQty) {
  const item = state.shoppingList.find(i => i.id === itemId);
  if (!item) return;

  item.buyQty = Math.max(0, Number(newQty) || 0);
  saveStateCache(state);
  dispatchStateEvent('plateplan:state:shoppingList', state.shoppingList);
}
