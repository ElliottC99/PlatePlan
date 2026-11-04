---
date: "2026-11-01"
problem_type: "logic_error"
component: "state_management"
severity: "critical"
symptoms:
  - "Deleting an enhanced recipe variant wiped the entire recipe document from Firestore"
  - "Clicking delete on an enhanced card permanently destroyed original recipe ingredients, steps, and metadata"
root_cause: "wrong_assumption"
tags:
  - recipe-vault
  - enhanced-recipes
  - variant-deletion
  - firestore
  - data-loss-prevention
related_issues: []
---

# Solution: Safe, Context-Aware Deletion of Enhanced Recipe Variants

## 1. Problem Statement
In PlatePlan, enhanced recipe variants (85+ Fit Score optimizations) are stored as nested properties (`recipe.enhanced` and `recipe.enhancedFitScore`) inside the single canonical recipe document in Firestore. When a user opened the 3-dots action menu on an Enhanced card in the Recipe Vault and clicked "Delete Recipe", the application invoked `deleteRecipe(recipeId)` via `HouseholdRepository`, permanently deleting the entire Firestore document.

## 2. Root Cause Analysis
The action controller (`VaultRecipeCard.js`) ignored the `variant` parameter in its delete handler:
```javascript
// ❌ WRONG: Wiped entire document regardless of whether card was original or enhanced
dropdown.querySelector('[data-action="menu-delete"]').onclick = (clickEvt) => {
  confirmDeleteVaultRecipe(recipe, async () => {
    const { deleteRecipe } = await import('../../services/HouseholdRepository.js');
    await deleteRecipe(recipeId);
    getState().recipes = getState().recipes.filter(r => r.id !== recipeId);
  });
};
```
Furthermore, the confirmation dialog always said *"Are you sure you want to delete [Recipe]?"* without clarifying whether the action affected the variant or the base recipe.

## 3. Working Solution
1. **Repository-Level Subproperty Deletion (`RecipeFirestoreRepository.js`)**:
```javascript
// ✅ CORRECT: Strips only enhanced fields via FieldValue.delete()
export async function deleteRecipeVariant(recipeId, variantKey = 'enhanced') {
  try {
    if (!isDbAvailable() || !recipeId) return { success: false, error: 'Unavailable or missing ID' };
    const docRef = db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(String(recipeId));

    let deleteField = null;
    if (typeof window !== 'undefined' && window.firebase?.firestore?.FieldValue?.delete) {
      deleteField = window.firebase.firestore.FieldValue.delete();
    }

    const updates = { updatedAt: new Date().toISOString() };
    if (variantKey === 'enhanced') {
      updates.enhanced = deleteField || null;
      updates.enhancedFitScore = deleteField || null;
    }

    await docRef.update(updates);
    return { success: true };
  } catch (err) {
    console.error('[RecipeFirestoreRepository] Delete Variant Error:', err);
    return { success: false, error: err };
  }
}
```

2. **Context-Aware UI & Messaging (`VaultRecipeCardRenderService.js`)**:
- For Enhanced cards:
  - Menu item: `<span>🗑️</span> Remove Enhanced Variant`
  - Dialog: *"Are you sure you want to remove the enhanced version of '[Recipe]'? Your original recipe will remain 100% untouched."*
  - Button: `Remove Variant`
- For Original cards:
  - Menu item: `<span>🗑️</span> Delete Entire Recipe`
  - Dialog: *"Are you sure you want to permanently delete '[Recipe]'? This will delete both the original and enhanced versions."*

3. **In-Memory Local State Pruning (`VaultRecipeCard.js`)**:
```javascript
if (variant === 'enhanced') {
  await deleteRecipeVariant(recipeId, 'enhanced');
  const r = getState()?.recipes?.find(x => x.id === recipeId);
  if (r) {
    delete r.enhanced;
    delete r.enhancedFitScore;
    if (r.variants) delete r.variants.enhanced;
  }
} else {
  await deleteRecipe(recipeId);
  getState().recipes = getState().recipes.filter(r => r.id !== recipeId);
}
```

4. **Detail Modal Support (`RecipeDetailModalUI.js` & `RecipeDetailModalService.js`)**:
When viewing the Enhanced tab in the detail modal, a `🗑️ Remove Variant` button safely removes the variant and transitions the view back to `'original'`.

## 4. Prevention & Verification
- Unit test suite added in `scripts/test_delete_recipe_variant.js` verifying that `deleteRecipeVariant` strips only variant fields while leaving the root recipe object, ingredients, and steps completely intact.
- Added data recovery script in `src/config/restoredGnocchi.js` and `src/main.js` to automatically rehydrate accidentally deleted recipes.
