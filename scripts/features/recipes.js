import { createLegacyView } from './create-legacy-view.js?v=3.3.4';

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
  
  // Clone the state for potential rollback
  const previousStateStr = JSON.stringify(window.state);

  // 1. Ensure the link action assigns the product ID to the recipe ingredient (ingredient.id = productId)
  target.id = newProductId;
  target.productId = newProductId;
  target.bankId = newProductId;

  // 2. Generate an ISO-8601 string timestamp and set both ingredient.updatedAt and recipe.updatedAt
  const nowIso = new Date().toISOString();
  target.updatedAt = nowIso;
  recipe.updatedAt = nowIso;

  // 3. Save state locally (localStorage.setItem('plateplan_v2', ...))
  localStorage.setItem('plateplan_v2', JSON.stringify(window.state));

  // 4. Synchronously force a UI re-render
  if (typeof window.rehydrateActiveRecipeAndStateCache === 'function') {
    window.rehydrateActiveRecipeAndStateCache({ changedProductIds: [newProductId], recipeId: recipe.id });
  }
  if (typeof window.renderAll === 'function') window.renderAll();
  if (typeof window.renderVault === 'function') window.renderVault();

  // 5. Initiate the Firestore write asynchronously inside a try/catch
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
    // 6. Rollback: If Firestore write fails, restore state from local/in-memory backup and re-render
    window.state = JSON.parse(previousStateStr);
    if (typeof state !== 'undefined' && state) {
      Object.assign(state, window.state);
    }
    localStorage.setItem('plateplan_v2', previousStateStr);
    if (typeof window.rehydrateActiveRecipeAndStateCache === 'function') {
      window.rehydrateActiveRecipeAndStateCache({ changedProductIds: [newProductId], recipeId: recipe.id });
    }
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.renderVault === 'function') window.renderVault();
    if (typeof window.showPlatePlanToast === 'function') {
      window.showPlatePlanToast('Failed to link ingredient in cloud. Reverted change.', 'error');
    }
  }
}

export default createLegacyView({ id: 'vault', rootId: 'view-vault' });
