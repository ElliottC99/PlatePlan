/**
 * src/services/CategoryRepository.js
 * Repository for category management and ingredient categorization.
 */
import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { safeFirestoreGet, isDbAvailable } from './RecipeFirestoreRepository.js';
import { getState as getStoreState, setCategories, setIngredients, setProducts } from '../store/store.js';

export const DEFAULT_PANTRY_CATEGORIES = [
  'Bakery', 'Baking', 'Beverages', 'Carbs', 'Dairy & Eggs', 'Drinks', 'Frozen',
  'Fruit & Vegetables', 'General', 'Grains, Legumes & Pulses', 'Herbs & Spices',
  'Meat & Seafood', 'Meat Substitutes', 'Nuts & Seeds', 'Other', 'Pantry',
  'Produce', 'Proteins', 'Store Cupboard'
];

export function getUnifiedCategories(state = {}, { includeDefaults = false } = {}) {
  const catMap = new Map();
  const addCategoryStr = (raw) => {
    if (!raw) return;
    const name = typeof raw === 'string' ? raw : (raw.name || raw.categoryName || raw.id || '');
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (trimmed.length > 0) {
        const normKey = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normKey && !catMap.has(normKey)) {
          catMap.set(normKey, trimmed);
        }
      }
    }
  };
  if (includeDefaults || (!state.categories?.length && !state.ingredients?.length && !state.products?.length)) {
    DEFAULT_PANTRY_CATEGORIES.forEach(addCategoryStr);
  }
  (Array.isArray(state.categories) ? state.categories : []).forEach(addCategoryStr);
  (Array.isArray(state.ingredients) ? state.ingredients : []).forEach(i => {
    addCategoryStr(i?.category || i?.cat);
    if (Array.isArray(i?.subtypes)) {
      i.subtypes.forEach(st => addCategoryStr(st?.category || st?.cat));
    }
  });
  (Array.isArray(state.products) ? state.products : []).forEach(p => {
    addCategoryStr(p?.category || p?.cat);
  });
  return Array.from(catMap.values()).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

export async function getCategories() {
  const defaultCategories = [
    'Bakery', 'Baking', 'Beverages', 'Carbs', 'Dairy & Eggs', 'Drinks', 'Frozen',
    'Fruit & Vegetables', 'General', 'Grains, Legumes & Pulses', 'Herbs & Spices',
    'Meat & Seafood', 'Meat Substitutes', 'Nuts & Seeds', 'Other', 'Pantry',
    'Produce', 'Proteins', 'Store Cupboard'
  ];
  try {
    if (!isDbAvailable()) return defaultCategories;
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    const snap = await safeFirestoreGet(docRef);
    if (snap && snap.exists) {
      const data = snap.data();
      if (Array.isArray(data?.categories) && data.categories.length > 0) return data.categories;
    }
    docRef.set({ categories: defaultCategories, updatedAt: new Date().toISOString() }).catch(() => {});
    return defaultCategories;
  } catch (err) {
    console.warn('[CategoryRepository] Error fetching categories, using defaults:', err.message || err);
    return defaultCategories;
  }
}

export async function saveCategories(categories) {
  const cleanCategories = Array.isArray(categories) ? [...categories] : [];
  setCategories(cleanCategories);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('plateplan:state:categories', { detail: cleanCategories }));
  }
  try {
    if (!isDbAvailable()) return { success: true, localOnly: true };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('categories');
    await docRef.set({ categories: cleanCategories, updatedAt: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export { deleteCategory, reassignAndDeleteCategory, renameCategory } from './CategoryManagementRepository.js';
export { mergeCategory, mergeAllDuplicates } from './CategoryMergeRepository.js';

