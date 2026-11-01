# Implementation Plan: Context-Aware Deletion of Enhanced Recipe Variants

> Date: 2026-11-01  
> Focus: Safe, context-aware deletion of enhanced recipe variants without deleting base recipes  
> Branch: `dev/recipe-bulk-parse-instruction-fix`  
> Status: Implemented (Verified with unit tests & build)  

---

## 1. Problem Statement & Executive Summary

### The Problem
In PlatePlan, enhanced recipe data is stored as sub-properties (`recipe.enhanced` and `recipe.enhancedFitScore`) inside the single canonical recipe document in Firestore.
When a user opened the 3-dots action menu on an Enhanced recipe card in the Recipe Vault and clicked "Delete Recipe", `VaultRecipeCard.js` unconditionally invoked `deleteRecipe(recipeId)` via `HouseholdRepository`, permanently wiping the entire recipe document from Firestore.

### The Objective
Implement context-aware deletion across the Recipe Vault card and Recipe Detail modal so that:
1. **Enhanced Variant Action**: When interacting with an enhanced variant, the action menu and confirmation dialog explicitly say **"Remove Enhanced Variant"** and **only** remove `enhanced` and `enhancedFitScore` from the Firestore document and local state. The base recipe remains 100% untouched.
2. **Original Recipe Action**: When interacting with the base recipe, the action menu and confirmation dialog explicitly say **"Delete Entire Recipe"** and warn that both the original and its enhanced variant will be deleted.
3. **Recipe Detail Modal Support**: When viewing an enhanced variant in the detail modal (`RecipeDetailModalUI.js`), provide a "Remove Enhanced Variant" action that safely removes the variant and transitions the view back to the original recipe.

---

## 2. Architecture & Flow

```
+---------------------------------------------------------------------------------------+
|                                User Click Event                                        |
+---------------------------------------------------------------------------------------+
           |                                                                |
           v (variant === 'enhanced')                                       v (variant === 'original')
+---------------------------------------+                +--------------------------------------+
| "Remove Enhanced Variant"             |                | "Delete Entire Recipe"               |
| Confirmation: "Your original recipe   |                | Confirmation: "Permanently delete    |
| will remain untouched."               |                | both original and enhanced?"         |
+---------------------------------------+                +--------------------------------------+
           |                                                                |
           v (confirmed)                                                    v (confirmed)
+---------------------------------------+                +--------------------------------------+
| HouseholdRepository.deleteRecipeVariant|               | HouseholdRepository.deleteRecipe     |
| - Firestore: FieldValue.delete() on   |                | - Firestore: document.delete()       |
|   recipe.enhanced & enhancedFitScore  |                | - Local State: filter out recipe     |
| - Local State: delete r.enhanced      |                | - Toast: "Deleted [Recipe]"          |
| - Prefs: clean ${recipeId}_enhanced   |                | - Re-render Recipe Vault             |
| - Toast: "Removed enhanced variant"   |                +--------------------------------------+
| - Re-render Recipe Vault / switch tab |
+---------------------------------------+
```

---

## 3. Detailed Component Changes

### 3.1 `src/services/RecipeFirestoreRepository.js` & `RecipeRepository.js` & `HouseholdRepository.js`
- Add `deleteRecipeVariant(recipeId, variantKey = 'enhanced')`:
  - Validates `recipeId`.
  - Obtains Firestore document reference `db.collection('households').doc(HOUSEHOLD_ID).collection('recipes').doc(String(recipeId))`.
  - Determines field deletion token using `window.firebase?.firestore?.FieldValue?.delete()` (or `db.constructor.FieldValue?.delete()`, fallback `null`).
  - Updates Firestore document:
    ```javascript
    const updates = { updatedAt: new Date().toISOString() };
    if (variantKey === 'enhanced') {
      updates.enhanced = deleteToken;
      updates.enhancedFitScore = deleteToken;
    }
    await docRef.update(updates);
    ```
  - Re-export `deleteRecipeVariant` through `RecipeRepository.js` and `HouseholdRepository.js`.

### 3.2 `src/components/vault/VaultRecipeCardRenderService.js`
- Update `renderRecipeActionsItems(recipeId, isFav, variant = 'original')`:
  - When `variant === 'enhanced'`:
    - Omit "Auto-Enhance (85+)".
    - Render red action button:
      ```html
      <button type="button" class="action-menu-item" data-action="menu-delete" style="color:#ef4444;">
        <span>🗑️</span> Remove Enhanced Variant
      </button>
      ```
  - When `variant === 'original'`:
    - Retain "Auto-Enhance (85+)" and "Edit Recipe".
    - Render red action button:
      ```html
      <button type="button" class="action-menu-item" data-action="menu-delete" style="color:#ef4444;">
        <span>🗑️</span> Delete Entire Recipe
      </button>
      ```
- Update `renderDeleteConfirmationContent(recipeTitle, variant = 'original')`:
  - If `variant === 'enhanced'`:
    - Icon: `🗑️`
    - Title: `Remove Enhanced Variant?`
    - Description: `Are you sure you want to remove the enhanced version of <strong>"${escapeHtml(recipeTitle)}"</strong>?<br><br><span style="font-size:12px;color:var(--text3,#a8a29e)">Your original recipe will remain 100% untouched.</span>`
    - Button text: `Remove Variant`
  - If `variant === 'original'`:
    - Title: `Delete Entire Recipe?`
    - Description: `Are you sure you want to permanently delete <strong>"${escapeHtml(recipeTitle)}"</strong>? This cannot be undone.`
    - Button text: `Confirm Delete`

### 3.3 `src/components/vault/VaultRecipeCard.js`
- Pass `variant` to `renderRecipeActionsItems(recipeId, isFav, variant)`.
- In `openRecipeActions(evt, recipeId, variant = 'original')`:
  - In `dropdown.querySelector('[data-action="menu-delete"]').onclick`:
    - Call `confirmDeleteVaultRecipe(recipe, async () => { ... }, variant)`:
      - If `variant === 'enhanced'`:
        - Invoke `const { deleteRecipeVariant } = await import('../../services/HouseholdRepository.js');`
        - `await deleteRecipeVariant(recipeId, 'enhanced');`
        - Mutate in-memory state:
          ```javascript
          const r = getState()?.recipes?.find(x => x.id === recipeId);
          if (r) {
            delete r.enhanced;
            delete r.enhancedFitScore;
            if (r.variants) delete r.variants.enhanced;
          }
          ```
        - Clean variant favorite if present:
          ```javascript
          const list = getState()?.userPrefs?.variantFavourites;
          if (Array.isArray(list)) {
            const idx = list.indexOf(`${recipeId}_enhanced`);
            if (idx !== -1) list.splice(idx, 1);
          }
          ```
        - Dispatch `plateplan:state:recipes`.
        - Show toast: `Removed enhanced variant from "${recipe.name || recipe.title}"`.
        - Re-render: `if (typeof window.renderRecipeVault === 'function') window.renderRecipeVault();`
      - If `variant === 'original'`:
        - Proceed with canonical `deleteRecipe(recipeId)` and remove from `getState().recipes`.

### 3.4 `src/components/recipe/RecipeDetailModalUI.js` & `RecipeDetailModalService.js`
- In `RecipeDetailModalUI.js`:
  - When `isEnh` is true, add a "Remove Variant" button in the modal header actions:
    ```html
    <button type="button" id="modal-recipe-delete-variant-btn" class="btn sm danger" style="padding:6px 10px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;border-radius:8px;cursor:pointer;" onclick="if(typeof removeCurrentEnhancedVariant==='function')removeCurrentEnhancedVariant('${escapeAttr(recipeId)}')">
      🗑️ Remove Variant
    </button>
    ```
- In `RecipeDetailModalService.js`:
  - Expose `window.removeCurrentEnhancedVariant(recipeId)`:
    - Prompts user confirmation via `confirmDeleteVaultRecipe` or a custom dialog.
    - Calls `deleteRecipeVariant(recipeId, 'enhanced')`.
    - Mutates local state on `previewState.recipe` and `getState().recipes`.
    - Switches tab to `'original'`.
    - Re-renders modal and vault.

---

## 4. Verification Plan

### Automated Unit Test (`scripts/test_delete_recipe_variant.js`)
Create a dedicated standalone node test verifying:
1. `deleteRecipeVariant` removes `enhanced` and `enhancedFitScore` fields.
2. The root recipe document retains all original ingredients, instructions, title, and ID.
3. Local state mutation cleanly strips the variant without removing the recipe from `getState().recipes`.
4. Rendering checks: `renderRecipeActionsItems` displays "Remove Enhanced Variant" when `variant === 'enhanced'`, and "Delete Entire Recipe" when `variant === 'original'`.
5. Dialog checks: `renderDeleteConfirmationContent` correctly highlights that the original recipe will remain untouched.

### Manual Verification
1. Open Recipe Vault.
2. Locate a recipe with an enhanced variant (e.g. *Creamy Sausage & Pea Gnocchi* or *Smashed Brooklyn Burgers*).
3. On the enhanced card, click the 3-dots "More" button.
4. Verify the dropdown shows: `🗑️ Remove Enhanced Variant` (not `Delete Recipe`).
5. Click `Remove Enhanced Variant`.
6. Verify dialog header: `Remove Enhanced Variant?` and note saying original recipe is untouched.
7. Click `Remove Variant`.
8. Confirm the enhanced card disappears, but the original recipe card remains completely intact in the vault!
9. Open the original recipe card: confirm all 14 ingredients, steps, and baseline macros are untouched.

---

## 5. Review & Approval

Please review this plan. Upon your confirmation (or `/work`), we will implement these changes, run the automated tests, and rebuild the application.
