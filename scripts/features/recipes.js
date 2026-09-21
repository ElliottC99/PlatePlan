import { createLegacyView } from './create-legacy-view.js?v=3.0.8';

/**
 * Synchronous ingredient replacement with timestamping and try/catch rollback
 */
export async function replaceRecipeIngredient(recipeId, ingredientIndex, newProductId, variantKey = 'original') {
  if (!recipeId || ingredientIndex === undefined || ingredientIndex === null) return;
  
  if (!window.state) window.state = {};
  if (!Array.isArray(window.state.recipes)) window.state.recipes = [];

  const recipe = window.state.recipes.find(r => r && r.id === recipeId);
  if (!recipe) return;

  const variant = variantKey === 'enhanced' ? recipe.variants?.enhanced : (recipe.variants?.original || recipe);
  if (!variant || !Array.isArray(variant.ingredients) || !variant.ingredients[ingredientIndex]) return;

  const target = variant.ingredients[ingredientIndex];
  const previousProductId = target.productId || target.bankId || '';

  // 1. Capture current ISO timestamp
  const nowIso = new Date().toISOString();

  // 2. Synchronously update the specific ingredient's productId in window.state.recipes
  target.productId = newProductId;
  target.bankId = newProductId;

  // 3. Synchronously apply the new timestamp to the recipe's updatedAt field
  recipe.updatedAt = nowIso;

  // 4. Trigger an immediate UI re-render
  if (typeof window.rehydrateActiveRecipeAndStateCache === 'function') {
    window.rehydrateActiveRecipeAndStateCache({ changedProductIds: [newProductId], recipeId: recipe.id });
  }
  if (typeof window.renderAll === 'function') window.renderAll();
  if (typeof window.renderVault === 'function') window.renderVault();

  // 5. Execute Firestore updateDoc wrapped in a try/catch
  try {
    const householdId = window.activeHouseholdId || window.state?.meta?.householdId || 'elliott-chloe';
    const db = window.platePlanDb || (window.firebase && window.firebase.firestore && window.firebase.firestore());
    if (db) {
      const docRef = db.collection('households').doc(householdId).collection('recipes').doc(recipeId);
      const cleanRecipe = typeof window.sanitizePayloadForFirestore === 'function' ? window.sanitizePayloadForFirestore(recipe) : recipe;
      await docRef.set(cleanRecipe, { merge: true });
    }
  } catch (err) {
    console.error('[INGREDIENT REPLACEMENT ERROR - ROLLING BACK]', err);
    // 6. In catch block: revert local ingredient productId to previous state, re-render, show error toast
    target.productId = previousProductId;
    target.bankId = previousProductId;
    if (typeof window.rehydrateActiveRecipeAndStateCache === 'function') {
      window.rehydrateActiveRecipeAndStateCache({ changedProductIds: [previousProductId], recipeId: recipe.id });
    }
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.renderVault === 'function') window.renderVault();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to link ingredient in cloud. Reverted change.', 'error');
    }
  }
}

export default createLegacyView({ id: 'vault', rootId: 'view-vault' });
