/**
 * src/repositories/ShoppingListRepository.js (v3.26.0)
 * Repository for persisting shopping lists in households/elliott-chloe/shoppingLists/{listId}.
 * Quarantines direct Firestore calls away from UI components.
 */

const HOUSEHOLD_ID = 'elliott-chloe';

export async function saveShoppingList(list) {
  if (!list || !list.id) return { success: false, error: 'Invalid shopping list object' };
  
  if (typeof window === 'undefined' || !window.firebase || !window.firebase.firestore) {
    console.warn('[ShoppingListRepository] Firestore db not available. Operating in local-only mode.');
    return { success: false, error: 'Database unavailable' };
  }

  try {
    const db = window.firebase.firestore();
    const listRef = db.collection('households').doc(HOUSEHOLD_ID).collection('shoppingLists').doc(list.id);
    
    const payload = {
      id: list.id,
      planId: list.planId || '',
      status: list.status || 'active',
      items: Array.isArray(list.items) ? list.items : [],
      createdAt: list.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await listRef.set(payload, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[ShoppingListRepository] Error saving shopping list:', err);
    return { success: false, error: err.message };
  }
}

export async function getShoppingLists() {
  if (typeof window === 'undefined' || !window.firebase || !window.firebase.firestore) {
    return [];
  }

  try {
    const db = window.firebase.firestore();
    const snap = await db.collection('households').doc(HOUSEHOLD_ID).collection('shoppingLists').orderBy('createdAt', 'desc').get();
    const lists = [];
    snap.forEach(doc => {
      lists.push(doc.data());
    });
    return lists;
  } catch (err) {
    console.error('[ShoppingListRepository] Error fetching shopping lists:', err);
    return [];
  }
}

if (typeof window !== 'undefined') {
  window.ShoppingListRepository = {
    saveShoppingList,
    getShoppingLists
  };
}
