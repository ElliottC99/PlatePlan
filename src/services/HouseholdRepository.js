/**
 * src/services/HouseholdRepository.js (v3.38.54)
 * Dedicated data access repository facade for household-scoped Firestore operations.
 * Completely isolated from DOM manipulation and UI rendering.
 * All operations target the shared household path 'households/elliott-chloe'.
 */

import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { getPlanHistory, savePlanHistory } from '../repositories/PlanRepository.js';
import { 
  whitelistPreferences, 
  enforcePayloadSafetyValve, 
  prunePreferences, 
  savePreferencesWithAutoPrune,
  getHouseholdData,
  getPreferences,
  savePreferences
} from './PreferenceRepository.js';
import { getUnifiedCategories, getCategories, saveCategories } from './CategoryRepository.js';
import { executeSubcollectionMigration, cleanPreferencesBloat } from './SyncRepository.js';
import { 
  cleanLegacyMacros, 
  getCurrentPlan, 
  saveCurrentPlan, 
  savePlan, 
  subscribeRecipes, 
  subscribeCurrentPlan, 
  recalibrateRecipeMacrosAndDismissAdvisoriesInDb, 
  batchRecalibrateRecipesInDb, 
  batchUpdateRecipesInDb, 
  isDbAvailable, 
  safeFirestoreGet 
} from './RecipeFirestoreRepository.js';
import { getRecipes, saveRecipe, deleteRecipe } from './RecipeRepository.js';
import { getIngredients, saveIngredient, deleteIngredient } from './PantryFirestoreRepository.js';
import { 
  saveShoppingList,
  getShoppingLists,
  getShoppingList,
  deleteShoppingList,
  updateShoppingItem,
  getProducts,
  saveProduct,
  deleteProduct,
  subscribeProducts,
  getInventory,
  savePantryItem,
  deletePantryItem,
  saveInventory
} from './ShoppingFirestoreRepository.js';
import { 
  deleteSubtypeInDb,
  batchResolveSubtypeOrphansInDb,
  batchResolveOrphansWithNewSubtypeInDb,
  batchMergeIngredientsInDb,
  promoteSubtype,
  moveSubtype,
  mergeSubtype
} from './SubtypeRepository.js';
import { mergeCategory, mergeAllDuplicates } from './CategoryMergeRepository.js';
import { deleteCategory, reassignAndDeleteCategory, renameCategory } from './CategoryManagementRepository.js';
import { stripPlanPayload } from '../models/MealPlannerModel.js';

async function dismissAdvisoryInDb(issueKey) {
  if (!isDbAvailable()) return false;
  try {
    const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
    const rootRef = db.collection('households').doc(HOUSEHOLD_ID);

    let unionVal;
    if (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue) {
      unionVal = window.firebase.firestore.FieldValue.arrayUnion(issueKey);
    } else {
      unionVal = [issueKey];
    }

    await Promise.all([
      prefRef.update({ dismissedQualityAdvisories: unionVal }),
      rootRef.update({ dismissedQualityAdvisories: unionVal })
    ]);
    return true;
  } catch (err) {
    console.warn('[HouseholdRepository] Error in dismissAdvisoryInDb update, trying set with merge:', err);
    try {
      const prefRef = db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences');
      const rootRef = db.collection('households').doc(HOUSEHOLD_ID);
      const unionVal = (typeof window !== 'undefined' && window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue)
        ? window.firebase.firestore.FieldValue.arrayUnion(issueKey)
        : [issueKey];
      await Promise.all([
        prefRef.set({ dismissedQualityAdvisories: unionVal }, { merge: true }),
        rootRef.set({ dismissedQualityAdvisories: unionVal }, { merge: true })
      ]);
      return true;
    } catch (e) {
      console.error('[HouseholdRepository] Failed fallback set for dismissAdvisoryInDb:', e);
      return false;
    }
  }
}

function subscribeIngredients(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('ingredients').onSnapshot(
      (snap) => { if (snap?.docs) callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

function subscribePreferences(callback, errorCallback) {
  if (!isDbAvailable() || typeof callback !== 'function') return () => {};
  try {
    return db.collection('households').doc(HOUSEHOLD_ID).collection('settings').doc('preferences').onSnapshot(
      (docSnap) => {
        if (docSnap && docSnap.exists) {
          callback(docSnap.data());
        }
      },
      (err) => { if (typeof errorCallback === 'function') errorCallback(err); }
    );
  } catch (e) { return () => {}; }
}

async function save(state = {}) {
  const promises = [];
  if (Array.isArray(state.ingredients)) {
    state.ingredients.forEach(i => promises.push(saveIngredient(i)));
  }
  if (Array.isArray(state.products)) {
    state.products.forEach(p => promises.push(saveProduct(p)));
  }
  if (Array.isArray(state.categories)) {
    promises.push(saveCategories(state.categories));
  }
  const results = await Promise.all(promises);
  const failure = results.find(r => r && r.success === false && r.error);
  if (failure) {
    throw typeof failure.error === 'string' ? new Error(failure.error) : failure.error;
  }
  return results;
}

const saveHouseholdState = save;

const HouseholdRepository = {
  cleanLegacyMacros,
  saveCurrentPlan,
  getIngredients,
  saveIngredient,
  deleteIngredient,
  getProducts,
  saveProduct,
  deleteProduct,
  subscribeProducts,
  saveShoppingList,
  getShoppingLists,
  getShoppingList,
  deleteShoppingList,
  updateShoppingItem,
  getInventory,
  savePantryItem,
  deletePantryItem,
  saveInventory,
  getCategories,
  saveCategories,
  getPreferences,
  savePreferences,
  dismissAdvisoryInDb,
  savePreferencesWithAutoPrune,
  batchResolveOrphansWithNewSubtypeInDb,
  stripPlanPayload,
  getHouseholdData,
  getPlanHistory,
  savePlanHistory,
  executeSubcollectionMigration,
  cleanPreferencesBloat,
  deleteCategory,
  reassignAndDeleteCategory,
  renameCategory,
  mergeCategory,
  mergeAllDuplicates,
  batchUpdateRecipesInDb
};

export { 
  stripPlanPayload,
  whitelistPreferences,
  enforcePayloadSafetyValve,
  prunePreferences,
  savePreferencesWithAutoPrune,
  getHouseholdData,
  getPreferences,
  savePreferences,
  getUnifiedCategories,
  getCategories,
  saveCategories,
  executeSubcollectionMigration,
  cleanPreferencesBloat,
  getCurrentPlan,
  saveCurrentPlan,
  savePlan,
  subscribeRecipes,
  subscribeCurrentPlan,
  recalibrateRecipeMacrosAndDismissAdvisoriesInDb,
  batchRecalibrateRecipesInDb,
  batchUpdateRecipesInDb,
  cleanLegacyMacros,
  isDbAvailable,
  safeFirestoreGet,
  getRecipes,
  saveRecipe,
  deleteRecipe,
  getIngredients,
  saveIngredient,
  deleteIngredient,
  getProducts,
  saveProduct,
  deleteProduct,
  subscribeProducts,
  saveShoppingList,
  getShoppingLists,
  getShoppingList,
  deleteShoppingList,
  updateShoppingItem,
  getInventory,
  savePantryItem,
  deletePantryItem,
  saveInventory,
  getPlanHistory,
  savePlanHistory,
  deleteSubtypeInDb,
  batchResolveSubtypeOrphansInDb,
  batchResolveOrphansWithNewSubtypeInDb,
  batchMergeIngredientsInDb,
  promoteSubtype,
  moveSubtype,
  mergeSubtype,
  mergeCategory,
  mergeAllDuplicates,
  deleteCategory,
  reassignAndDeleteCategory,
  renameCategory,
  dismissAdvisoryInDb,
  subscribeIngredients,
  subscribePreferences,
  save,
  saveHouseholdState,
  HouseholdRepository
};

export default HouseholdRepository;
