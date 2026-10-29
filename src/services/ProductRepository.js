import { getState } from '../store/coreState.js';
import store from "../store/store.js";
/**
 * src/services/ProductRepository.js (v3.37.1)
 * Dedicated Micro-Repository for Product Operations & Data Access.
 * Isolated from direct view rendering to maintain single-responsibility separation.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { enforceCategorySSOT } from '../utils/categoryEnforcer.js';

function isDbAvailable() {
  if (!db) {
    console.warn('[ProductRepository] Firestore db instance not initialised.');
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

export async function getProducts() {
  try {
    if (!isDbAvailable()) return [];
    const colRef = db.collection('households').doc(HOUSEHOLD_ID).collection('products');
    const snap = await safeFirestoreGet(colRef);
    const raw = (snap && snap.docs) ? snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) : [];
    const ings = (typeof window !== 'undefined' && getState()?.ingredients) || [];
    const enforced = enforceCategorySSOT({ ingredients: ings, products: raw });
    return enforced.products;
  } catch (err) {
    console.warn('[ProductRepository] Offline or unable to fetch products:', err.message || err);
    return [];
  }
}

export async function saveProduct(product) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!product || typeof product !== 'object') return { success: false, error: 'Invalid product data' };
    const enforced = enforceCategorySSOT({ ingredients: (typeof window !== 'undefined' && getState()?.ingredients) || [], products: [product] });
    const finalProd = enforced.products[0] || product;
    const prodData = { ...finalProd, schemaVersion: 2, updatedAt: new Date().toISOString() };
    const prodId = product.id || db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc().id;
    delete prodData.id;
    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(prodId).set(prodData, { merge: true });
    return { success: true, id: prodId };
  } catch (err) {
    console.warn('[ProductRepository] Unable to save product to cloud (offline):', err.message || err);
    return { success: false, error: err };
  }
}

// Adds a product write to a batch the caller commits, with the same category and stamping as saveProduct.
export function addProductToBatch(batch, product) {
  const enforced = enforceCategorySSOT({ ingredients: (typeof window !== 'undefined' && getState()?.ingredients) || [], products: [product] });
  const prodData = { ...(enforced.products[0] || product), schemaVersion: 2, updatedAt: new Date().toISOString() };
  delete prodData.id;
  batch.set(db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(String(product.id)), prodData, { merge: true });
}

export async function deleteProduct(productId) {
  try {
    if (!isDbAvailable()) return { success: false, error: 'Database unavailable' };
    if (!productId) return { success: false, error: 'Missing product ID' };
    await db.collection('households').doc(HOUSEHOLD_ID).collection('products').doc(productId).delete();
    return { success: true };
  } catch (err) {
    console.warn('[ProductRepository] Unable to delete product from cloud (offline):', err.message || err);
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
