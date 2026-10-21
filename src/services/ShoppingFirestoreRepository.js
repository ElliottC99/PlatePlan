import store from "../store/store.js";
/**
 * src/services/ShoppingFirestoreRepository.js (v3.38.52)
 * Dedicated Firestore repository for Shopping Lists, Products, and Inventory items.
 * Strictly scoped to 'households/elliott-chloe' subcollections.
 * Quarantines Firestore database logic from UI components.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';

function isDbAvailable() {
  if (!db) {
    console.warn('[ShoppingFirestoreRepository] Firestore db instance not initialized.');
    return false;
  }
  return true;
}

async function safeFirestoreGet(ref, timeoutMs = 2500) {
  if (!ref || typeof ref.get !== 'function') return null;
  try {
    const netPromise = ref.get();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore get timeout (offline mode)')), timeoutMs)
    );
    return await Promise.race([netPromise, timeoutPromise]);
  } catch (_netErr) {
    try {
      return await ref.get({ source: 'cache' });
    } catch (_cacheErr) {
      return null;
    }
  }
}

// ==========================================
// SHOPPING LIST OPERATIONS
// ==========================================

export async function saveShoppingList(list) {
  if (!list || !list.id) return { success: false, error: 'Invalid shopping list object' };
  if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };

  try {
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
    console.error('[ShoppingFirestoreRepository] Error saving shopping list:', err);
    return { success: false, error: err.message || err };
  }
}

export async function getShoppingLists() {
  if (!isDbAvailable()) return [];
  try {
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('shoppingLists').orderBy('createdAt', 'desc');
    const snap = await safeFirestoreGet(colRef);
    if (!snap || !snap.docs) return [];
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error fetching shopping lists:', err);
    return [];
  }
}

export async function getShoppingList(listId) {
  if (!listId || !isDbAvailable()) return null;
  try {
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('shoppingLists').doc(listId);
    const snap = await safeFirestoreGet(docRef);
    return (snap && snap.exists) ? { id: snap.id, ...snap.data() } : null;
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error fetching shopping list:', err);
    return null;
  }
}

export async function deleteShoppingList(listId) {
  if (!listId || !isDbAvailable()) return { success: false, error: 'Invalid parameters' };
  try {
    await db.collection('households').doc(HOUSEHOLD_ID).collection('shoppingLists').doc(listId).delete();
    return { success: true };
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error deleting shopping list:', err);
    return { success: false, error: err.message || err };
  }
}

export async function updateShoppingItem(listId, itemId, updates = {}) {
  if (!listId || !itemId || !isDbAvailable()) return { success: false, error: 'Invalid parameters' };
  try {
    const list = await getShoppingList(listId);
    if (!list || !Array.isArray(list.items)) return { success: false, error: 'Shopping list not found' };
    const itemIndex = list.items.findIndex(item => item.id === itemId || item.key === itemId);
    if (itemIndex === -1) return { success: false, error: 'Item not found in shopping list' };
    list.items[itemIndex] = { ...list.items[itemIndex], ...updates, updatedAt: new Date().toISOString() };
    return await saveShoppingList(list);
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error updating shopping item:', err);
    return { success: false, error: err.message || err };
  }
}

// ==========================================
// PRODUCT OPERATIONS
// ==========================================

export async function getProducts() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    const snap = await safeFirestoreGet(colRef);
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const ings = (typeof window !== 'undefined' && store.getState()?.ingredients) || [];
    const enforced = enforceCategorySSOT({ ingredients: ings, products: raw });
    return enforced.products;
  } catch (err) {
    console.warn('[ShoppingFirestoreRepository] Offline or unable to fetch products:', err.message || err);
    return [];
  }
}

export async function saveProduct(product) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!product || typeof product !== 'object') return { success: false, error: 'Invalid product data' };
    const enforced = enforceCategorySSOT({ ingredients: (typeof window !== 'undefined' && store.getState()?.ingredients) || [], products: [product] });
    const finalProd = enforced.products[0] || product;
    const prodData = { ...finalProd, updatedAt: new Date().toISOString() };
    const prodId = product.id || db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc().id;
    delete prodData.id;
    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(prodId).set(prodData, { merge: true });
    return { success: true, id: prodId };
  } catch (err) {
    console.warn('[ShoppingFirestoreRepository] Unable to save product to cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

export async function deleteProduct(productId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!productId) return { success: false, error: 'Missing product ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(productId).delete();
    return { success: true };
  } catch (err) {
    console.warn('[ShoppingFirestoreRepository] Unable to delete product from cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

export function subscribeProducts(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('products').onSnapshot(
      (snap) => { if (snap?.docs) callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

// ==========================================
// INVENTORY & PANTRY OPERATIONS
// ==========================================

export async function getInventory() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('inventory');
    const snap = await safeFirestoreGet(colRef);
    if (!snap || !snap.docs) return [];
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[ShoppingFirestoreRepository] Offline or error fetching inventory:', err.message || err);
    return [];
  }
}

export async function savePantryItem(item) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!item || typeof item !== 'object') return { success: false, error: 'Invalid item data' };

    const itemId = item.id || db.collection('households').doc(HOUSEHOLD_ID).collection('inventory').doc().id;
    const itemData = {
      id: itemId,
      ingredientId: item.ingredientId || null,
      subtypeId: item.subtypeId || null,
      productId: item.productId || null,
      customName: String(item.customName || item.name || '').trim(),
      category: item.category || null,
      storage: item.storage || 'cupboard',
      status: item.status || 'in_stock',
      isUseUp: Boolean(item.isUseUp),
      quantity: item.quantity !== undefined ? item.quantity : null,
      unit: item.unit || null,
      expiryDate: item.expiryDate || null,
      updatedAt: new Date().toISOString()
    };

    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('inventory').doc(itemId);
    await docRef.set(itemData, { merge: true });
    return { success: true, item: itemData };
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error saving pantry item:', err);
    return { success: false, error: err.message || err };
  }
}

export async function deletePantryItem(itemId) {
  try {
    if (!isDbAvailable() || !itemId) return { success: false, error: 'Invalid parameters' };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('inventory').doc(itemId);
    await docRef.delete();
    return { success: true };
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error deleting pantry item:', err);
    return { success: false, error: err.message || err };
  }
}

export async function saveInventory(items = []) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    const results = await Promise.all(items.map(item => savePantryItem(item)));
    return { success: true, results };
  } catch (err) {
    console.error('[ShoppingFirestoreRepository] Error saving inventory:', err);
    return { success: false, error: err.message || err };
  }
}
