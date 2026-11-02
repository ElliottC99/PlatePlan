# Implementation Plan: Fix VaultRecipeCard Menu Crash & Harden DOM Event Bindings

> Date: 2026-11-02  
> Status: Implemented ✓  
> Topic: fix-vault-recipe-card-menu-crash-and-harden-dom-event-bindings  
> Target Files:  
> - `src/components/vault/VaultRecipeCard.js`  
> - `src/components/ProductSwapModal.js`  
> - `src/components/pantry/SubtypeProductLinkerModalUI.js`  
> - `src/components/data-quality/MacroDriftPreviewModal.js`  
> - `src/components/data-quality/MealPlanSyncWarningModal.js`  
> - `src/components/data-quality/MergeIngredientsModal.js`  
> - `src/components/data-quality/SubtypeOrphanResolverModal.js`  
> - `src/components/data-quality/UnlinkedSweeperUI.js`  
> - `src/components/pantry/ReallocateProductModalUI.js`  
> - `src/views/DataQualityTableRenderService.js`  
> - `src/views/RecipeVaultView.js`  
> - `scripts/test_vault_recipe_card_menu.js`  

---

## 0. Prior Solutions & Patterns

- **Prior Exploration**: [`docs/plans/2026-11-02-1835-explore-vault-recipe-card-menu-crash-and-event-binding-audit.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/plans/2026-11-02-1835-explore-vault-recipe-card-menu-crash-and-event-binding-audit.md)
  - Diagnosed `TypeError: Cannot set properties of null (setting 'onclick')` on enhanced card "More" button click.
  - Performed static scan identifying 24 unguarded DOM lookups across `src/`.
- **Critical Patterns**:
  - **Pattern #2 (Single Source of Truth for UI Components & Event Delegation)**: Prefer delegated event handling over direct node property assignment.
  - **Pattern #10 (Atomic State Transitions & Safe Cleanup)**: Dynamic popups and menus must clean up listeners upon removal.

---

## 1. Problem Statement

1. **Vault Recipe Card Crash on Enhanced Recipes**:
   - Clicking "More" (`...`) on an Enhanced recipe card crashes with `TypeError: Cannot set properties of null (setting 'onclick')` at `VaultRecipeCard.js:132`.
   - `VaultRecipeCardRenderService.js` omits `[data-action="menu-edit"]` and `[data-action="menu-review"]` when `variant === 'enhanced'`, but `VaultRecipeCard.js` attempts to assign `.onclick` to both without checking if the elements exist.
2. **Systematic Anti-Pattern Across App**:
   - Multiple modal dialogs and views attach event listeners directly to the result of `document.getElementById(...)` or `.querySelector(...)` without verifying the element is non-null.
   - If an element is conditionally rendered, fails to mount, or is refactored, it results in an unhandled crash that halts the entire JavaScript thread.

---

## 2. Proposed Architecture & Solution

### Phase 1: Container-Level Event Delegation in `VaultRecipeCard.js`
Replace all 7 individual `.querySelector(...).onclick` statements on `dropdown` with a single delegated click listener:
```javascript
dropdown.addEventListener('click', async (clickEvt) => {
  const item = clickEvt.target.closest('[data-action]');
  if (!item) return;
  clickEvt.stopPropagation();
  dropdown.remove();

  const action = item.dataset.action;
  switch (action) {
    case 'menu-view':     return window.viewRecipe(recipeId, null, variant);
    case 'menu-enhance':  return window.openEnhanceRecipeModalForCurrent(recipeId);
    case 'menu-edit':     return window.openRecipeWizard('manual', recipeId);
    case 'menu-review':   return window.openRecipeWizard('review', recipeId);
    case 'menu-duplicate':return handleDuplicateRecipe(recipeId);
    case 'menu-favorite': return window.toggleRecipeFavourite(recipeId, clickEvt, variant);
    case 'menu-delete':   return handleDeleteRecipe(recipeId, variant);
  }
});
```
- **Benefits**:
  - Impossible to trigger `null.onclick` crashes.
  - Zero selector queries per menu open.
  - One consolidated listener that is cleanly garbage-collected when `dropdown.remove()` runs.

### Phase 2: App-Wide Guarding of Unguarded Lookups
Harden the 18 other unguarded DOM queries identified in the audit with defensive checks:
1. `src/components/ProductSwapModal.js`:
   - Guard `closeBtn`, `searchInput`, `sortSelect`, and `applyBtn`.
2. `src/components/pantry/SubtypeProductLinkerModalUI.js`:
   - Guard `reviewBtn.onclick`.
3. `src/components/pantry/ReallocateProductModalUI.js`:
   - Guard `#btn-toggle-create-sub`, `#btn-cancel-create-sub`, `#btn-save-create-sub`, `#btn-confirm-realloc`.
4. `src/components/data-quality/`:
   - `MacroDriftPreviewModal.js`: Guard `#drift-approve-btn`.
   - `MealPlanSyncWarningModal.js`: Guard `#btn-sync-active-plan`, `#btn-preserve-snapshot`.
   - `MergeIngredientsModal.js`: Guard `#confirm-merge-btn`.
   - `SubtypeOrphanResolverModal.js`: Guard `#batch-apply-btn`, `#resolve-orphans-confirm-btn`.
   - `UnlinkedSweeperUI.js`: Guard `#sweeper-close-btn`, `#sweeper-cancel-btn`.
5. `src/views/DataQualityTableRenderService.js`:
   - Guard `#dq-btn-relink`, `#dq-btn-refresh`.
6. `src/views/RecipeVaultView.js`:
   - Guard `#btn-manual-recipe`, `#btn-import-recipe`.

---

## 3. Acceptance Criteria

- [x] Clicking "More" (`...`) on an **Enhanced** recipe card in the Recipe Vault opens the dropdown menu without errors.
- [x] Clicking "More" (`...`) on an **Original** recipe card in the Recipe Vault opens the dropdown menu with all items functional.
- [x] Selecting "View Details", "Duplicate Recipe", "Favourite", or "Remove Enhanced Variant" works cleanly from the enhanced card menu.
- [x] All 24 identified unguarded DOM lookups across the codebase are guarded against `null` returns.
- [x] New automated test `scripts/test_vault_recipe_card_menu.js` passes, verifying both original and enhanced menu construction and action handling.
- [x] Full regression suite (`test_auto_default_and_recipe_recalculation.js`, `test_shopping_list.js`, `test_shopping_servings_multiplier.js`, `test_ledger.js`) passes.
- [x] Clean build via `npm run build`.

---

## 4. Implementation Steps

1. **Step 1: Refactor `openRecipeActionsDropdown` in `VaultRecipeCard.js`**
   - Replace lines 113–182 with delegated `dropdown.addEventListener('click', ...)`.
2. **Step 2: Harden Modals & Table Event Bindings**
   - Apply `if (el)` guards in `ProductSwapModal.js`, `SubtypeProductLinkerModalUI.js`, `ReallocateProductModalUI.js`, `MacroDriftPreviewModal.js`, `MealPlanSyncWarningModal.js`, `MergeIngredientsModal.js`, `SubtypeOrphanResolverModal.js`, `UnlinkedSweeperUI.js`, `DataQualityTableRenderService.js`, and `RecipeVaultView.js`.
3. **Step 3: Write Automated Test Suite**
   - Create `scripts/test_vault_recipe_card_menu.js` using JSDOM/DOM stubs to test clicking menu items on both original and enhanced recipe variants.
4. **Step 4: Verification & Build**
   - Run tests, check ledger, rebuild `dist/`.
