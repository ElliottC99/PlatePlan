---
title: Data Quality Wizards UI Clearance, Sweeper Type Handler & Atomic Recipe Auto-Fix
type: fix
date: 2026-11-03
topic: data-quality-wizards-snag-fixes-and-batch-perf
---

# Plan: Data Quality Wizards UI Clearance, Sweeper Type Handler & Atomic Recipe Auto-Fix

> Created: 2026-11-03  
> Status: Implemented ✓  
> Author: Antigravity Pair Programming

## Summary

This plan resolves 3 snags identified during live testing of the resolution wizards:
1. **Resolve Orphans Autocomplete Clipping**: When resolving a single product orphan, the scroll container's short height and `overflow-y: auto` clips the `createTaxonomySearchInput` dropdown menu. We give the table container a `min-height: 340px`, add clearance padding, and widen the dialog so sub-type results render cleanly without clipping.
2. **Unlinked Sweeper Typing Crash**: In `UnlinkedSweeperUI.js`, the keystroke filter handler at line 156 read `window.Store?.getState?.()`, returning `undefined` and throwing `Cannot read properties of undefined (reading 'ingredients')`. We replace this with the imported `getState()` helper with safe null guards.
3. **Recipe Mapping Audit Atomic Batch Relink & Progress Feedback**: Clicking `⚡ Auto-Fix Confident Matches` felt dead because `batchRelinkRecipeMappings` ran sequential `await saveRecipe(recipe)` Firestore network requests inside a loop (taking 50+ seconds for 200 items), while missing visual loading feedback and failing on recipes with `ingredientSections`. We refactor `batchRelinkRecipeMappings` to batch-modify recipes in memory, support sectioned ingredients, and persist via `batchUpdateRecipesInDb` in a single atomic batch write (<500ms), while adding instant loading feedback to the button.

---

## Prior Solutions Referenced

- [`docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md): Sectioned ingredient traversal patterns (`ingredientSections[].ingredients`).
- [`src/services/RecipeFirestoreRepository.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/RecipeFirestoreRepository.js): `batchUpdateRecipesInDb(modifiedRecipes)` for atomic multi-recipe Firestore writes.

---

## Acceptance Criteria

- [ ] **Autocomplete Clearance in Orphan Resolver**:
  - The dropdown menu in `SubtypeOrphanResolverModal.js` displays fully (at least 6-8 items visible) without being clipped by the table boundary or modal card.
  - Dialog is widened to `740px` and the search column is given 65% width to comfortably accommodate `🏷️ Sub-Type · 📂 Category › 📦 Root Item`.
- [ ] **Unlinked Sweeper Keystroke Search**:
  - Typing into the search box in `UnlinkedSweeperUI.js` executes smoothly without throwing any `TypeError`.
- [ ] **Atomic Recipe Auto-Fix with Immediate Feedback**:
  - Clicking `⚡ Auto-Fix Confident Matches` immediately disables the button and displays `⚡ Auto-fixing confident matches...`.
  - Fixes are committed via `batchUpdateRecipesInDb(modifiedRecipes)` in 1 atomic write.
  - Correctly updates recipes whether ingredients are in flat `recipe.ingredients` or sectioned `recipe.ingredientSections[].ingredients`.
  - Toasts the total number of fixed items and re-renders the audit with the updated issue count.

---

## Implementation Steps

### Step 1: Widen & Provide Clearance in `SubtypeOrphanResolverModal.js`
- In `src/components/data-quality/SubtypeOrphanResolverModal.js`:
  - Set modal card `max-width: 740px;`.
  - Set table scroll container `min-height: 340px; padding-bottom: 140px;`.
  - Set search column width to 65% and affected product column width to 35%.

### Step 2: Fix `getState()` Reference in `UnlinkedSweeperUI.js`
- In `src/components/data-quality/UnlinkedSweeperUI.js`:
  - In `attachSweeperSearchEvents` / `renderFilteredOptions`:
    Change line 156 from `const st = window.Store?.getState?.();` to:
    ```javascript
    const st = (typeof getState === 'function' ? getState() : (window.Store?.getState?.() || {})) || {};
    const masterItems = Array.isArray(st.ingredients) ? st.ingredients : [];
    ```

### Step 3: Implement Atomic Batch Relinking in `RecipeAuditService.js` & Feedback in `RecipeAuditModal.js`
- In `src/utils/RecipeAuditService.js`:
  - Import `batchUpdateRecipesInDb` from `../services/RecipeFirestoreRepository.js`.
  - Refactor `batchRelinkRecipeMappings(fixes)`:
    - Group fixes by `recipeId`.
    - Clone recipes from `getState().recipes`.
    - For each recipe, locate the target ingredient by matching either `itemIndex` against `recipe.ingredients` OR scanning `recipe.ingredientSections[].ingredients` for matching item name / original ingredient ID.
    - Apply new `ingredientId`, `subtypeId`, `ingredientName`, `subtypeName`, `qty`, `unit`.
    - Commit all modified recipes with `await batchUpdateRecipesInDb(modifiedRecipes)`.
    - Update store state with `setRecipes(updatedRecipes)`.
- In `src/components/recipe/RecipeAuditModal.js`:
  - In the `ram-autofix-btn` click handler:
    - Disable button and set text: `btn.disabled = true; btn.textContent = '⚡ Auto-fixing confident matches...';`.
    - Await `batchRelinkRecipeMappings(fixes)`.
    - Re-render modal content on success.

### Step 4: Verification & Automated Tests
- Check syntax with `node --check`.
- Run automated tests with `node scripts/test_data_quality_wizards.js`.
- Run `npm run build` to update `dist/`.
