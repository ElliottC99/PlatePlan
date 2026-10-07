/**
 * src/repositories/InventoryRepository.js (v3.23.0)
 * Dedicated repository for subcollection persistence under 'households/elliott-chloe/inventory'.
 * Quarantined from direct UI rendering and root document payload mutations.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';

function isDbAvailable() {
  if (!db) {
    console.warn('[InventoryRepository] Firestore db instance not initialized.');
    return false;
  }
  return true;
}

export async function getInventory() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('inventory');
    const snap = await colRef.get();
    if (!snap || !snap.docs) return [];
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('[InventoryRepository] Offline or error fetching inventory:', err.message || err);
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
      customName: String(item.customName || item.name || '').trim(),
      status: item.status || 'in_stock', // 'in_stock' | 'low_stock' | 'out_of_stock'
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
    console.error('[InventoryRepository] Error saving pantry item:', err);
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
    console.error('[InventoryRepository] Error deleting pantry item:', err);
    return { success: false, error: err.message || err };
  }
}

export async function toggleUseUpStatusInDb(itemId, isUseUp) {
  try {
    if (!isDbAvailable() || !itemId) return { success: false, error: 'Invalid parameters' };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('inventory').doc(itemId);
    await docRef.update({
      isUseUp: Boolean(isUseUp),
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  } catch (err) {
    console.error('[InventoryRepository] Error toggling use-up status:', err);
    return { success: false, error: err.message || err };
  }
}

export async function saveInventoryBatch(items = []) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    const results = await Promise.all(items.map(item => savePantryItem(item)));
    return { success: true, results };
  } catch (err) {
    console.error('[InventoryRepository] Error saving inventory batch:', err);
    return { success: false, error: err.message || err };
  }
}

const InventoryRepository = {
  getInventory,
  savePantryItem,
  deletePantryItem,
  toggleUseUpStatusInDb,
  saveInventoryBatch
};

if (typeof window !== 'undefined') {
  window.InventoryRepository = InventoryRepository;
}

export default InventoryRepository;
