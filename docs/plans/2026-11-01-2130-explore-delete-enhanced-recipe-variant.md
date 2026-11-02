# Exploration: Context-Aware Deletion of Enhanced Recipe Variants

> Date: 2026-11-01  
> Topic: recipe-vault-variant-deletion  
> Focus: Preventing accidental deletion of root recipes when deleting enhanced variants  

---

## 1. Executive Summary & Incident Analysis

### The Incident
When a user viewed the Enhanced variant of a recipe in the Recipe Vault (e.g., *Creamy Sausage & Pea Gnocchi*) and selected "Delete Recipe" from the 3-dots action menu, the entire recipe document was permanently deleted from Firestore, destroying both the original recipe and its enhanced variant.

### Root Cause
1. **Single-Document Schema**:
   In PlatePlan, an enhanced recipe is not an independent document. It is stored within the primary recipe document under `recipe.enhanced` and `recipe.enhancedFitScore`.
2. **Missing Variant Context in Action Handlers**:
   In `src/components/vault/VaultRecipeCard.js`, `openRecipeActions(evt, recipeId, variant)` accepts the `variant` parameter (e.g. `'enhanced'` vs `'original'`). However, the `menu-delete` click handler completely ignores `variant`:
   ```javascript
   dropdown.querySelector('[data-action="menu-delete"]').onclick = (clickEvt) => {
     confirmDeleteVaultRecipe(recipe, async () => {
       const { deleteRecipe } = await import('../../services/HouseholdRepository.js');
       await deleteRecipe(recipeId); // <-- DELETES ENTIRE DOCUMENT REGARDLESS OF VARIANT!
       ...
     });
   };
   ```
3. **Misleading Confirmation Dialog**:
   `VaultRecipeCardRenderService.js` always displays "Delete Recipe?" and "Are you sure you want to delete [Recipe Name]?" with no indication whether the action applies to the variant or the base recipe.

---

## 2. Immediate Data Recovery Plan (Completed)

To recover the accidentally deleted *Creamy Sausage & Pea Gnocchi*:
1. The exact recipe document (`id: "r1784057670563"`, complete with all 14 ingredients, 9 steps, macro calibrations, and portions) was retrieved from `households_elliott-chloe_backup.json`.
2. Exported as `RESTORED_GNOCCHI_RECIPE` in `src/config/restoredGnocchi.js`.
3. Added automatic restoration on application startup in `src/main.js` and exposed `window.restoreDeletedGnocchi()`.
4. Refreshing the app immediately re-inserts the recipe into Firestore using the user's authenticated Google session.

---

## 3. Systematic Architectural Analysis (Multi-Order Thinking)

### 1st Order Consequences
- Users must be able to delete/revert an enhanced recipe variant without touching their original recipe.
- The 3-dots menu on an enhanced card must explicitly say: **`🗑️ Remove Enhanced Variant`**.
- The confirmation dialog must clearly communicate: *"Are you sure you want to remove the enhanced version of '[Recipe]'? Your original recipe will remain 100% intact."*

### 2nd Order Consequences
- When the enhanced variant is removed, `recipe.enhanced` and `recipe.enhancedFitScore` must be removed from the Firestore document using `saveRecipe` (with `enhanced: null` or `FieldValue.delete()`), updating the local state `getState().recipes` without filtering out the recipe.
- If the user was viewing the "Enhanced" tab in the Vault, the card should either disappear from the Enhanced tab or update to reflect that only the Original variant remains.
- If the recipe was in an active meal plan that pointed to the enhanced variant, the meal plan should safely fall back to the original recipe without crashing.

### 3rd Order Consequences
- Favoriting: `isRecipeVariantFavourite(recipeId, 'enhanced')` should be cleaned up or reset if the enhanced variant is deleted.
- Data Quality & Advisories: Any advisories referencing `recipe.enhanced` are automatically cleared when the enhanced variant is removed.

---

## 4. UI/UX Touchpoints for Variant Deletion

There are two primary locations where a user interacts with an enhanced recipe:

1. **Vault Recipe Card Action Menu (`VaultRecipeCard.js` & `VaultRecipeCardRenderService.js`)**:
   - If `variant === 'enhanced'`:
     - Menu Label: `🗑️ Remove Enhanced Variant`
     - Dialog Header: `Remove Enhanced Variant?`
     - Dialog Body: `Are you sure you want to remove the enhanced version of "${recipeTitle}"? Your original recipe will remain untouched.`
     - Confirm Button: `Remove Variant`
   - If `variant === 'original'`:
     - Menu Label: `🗑️ Delete Entire Recipe`
     - Dialog Header: `Delete Entire Recipe?`
     - Dialog Body: `Are you sure you want to permanently delete "${recipeTitle}"? This will delete both original and enhanced versions.`
     - Confirm Button: `Delete Recipe`

2. **Recipe View / Detail Modal (`RecipeDetailModalService.js`)**:
   - When viewing an enhanced recipe variant, provide a secondary action in the footer or header: `Remove Enhanced Variant`.
   - Tapping it prompts confirmation and removes the enhanced payload, switching the view back to the original recipe.

---

## 5. Decision Gate

- **Decision**: Proceed immediately to `/plan` to implement context-aware variant deletion across `VaultRecipeCard.js`, `VaultRecipeCardRenderService.js`, and `RecipeDetailModalService.js`.
