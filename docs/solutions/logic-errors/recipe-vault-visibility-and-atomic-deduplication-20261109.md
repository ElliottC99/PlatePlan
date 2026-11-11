---
date: "2026-11-09"
problem_type: "logic-errors"
component: "RecipeVaultView, RecipeFirestoreRepository, DataQualityTableRenderService"
severity: "moderate"
symptoms:
  - "Recipe Vault grid only displayed 50 recipes despite 65+ recipes in the database"
  - "Snacking meal-type filter and recipe card badges did not consistently reflect mealSuitability array values"
  - "Accidental duplicates created during multi-recipe wizard imports or re-saving existing recipes"
root_cause: "Hardcoded 50-recipe slice in renderRecipeGrid, absence of 'snacking' type normalization across card badges/filters, and absence of cluster-based recipe deduplication with atomic Firestore persistence and Meal Plan slot reference repointing."
tags:
  - "recipe-vault"
  - "deduplication"
  - "meal-planner"
  - "firestore-batch"
  - "meal-suitability"
related_issues: []
related_solutions:
  - "docs/solutions/logic-errors/recipe-vault-enhanced-variant-safe-deletion-20261101.md"
last_referenced: "2026-11-09"
---

# Recipe Vault Visibility & Atomic Cluster Deduplication

## Problem Statement

**What happened:**
Users could only see a maximum of 50 recipes in the Recipe Vault grid even when more existed in the database. Furthermore, recipes tagged with `Snacking` in `mealSuitability` did not surface under the Meal Type filter, and saving recipes with existing titles generated duplicate recipe documents in Firestore rather than consolidating or updating them.

**Impact:**
Household members were unable to access their entire recipe catalog from the Vault. Meal planning slots referencing duplicate recipe IDs risked being orphaned if duplicates were deleted without repointing active slots.

## Symptoms

1. **Vault Truncation at 50 Items:**
   - In `renderRecipeGrid`, `recipesToRender` was passed through `platePlanListLimits.vaultRecipes || 50`, artificially capping the rendered list at 50 cards.
2. **Missing Snacking Filter Option & Inconsistent Badges:**
   - `#filter-type` in `index.html` and `VaultFilterToolbar.js` omitted the `snacking` option, and recipe card badges failed to map `Snacking` cleanly.
3. **Recipe Document Duplication:**
   - Saving recipes in Wizard Step 3 or bulk direct import always generated new UUIDs without checking if a recipe with that canonical title key already existed in the store or Firestore.

## Root Cause

1. `renderRecipeGrid` applied progressive slice limits to the main grid rather than displaying the full set of sorted recipes.
2. `getNormalizedRecipeTypes` did not exist as a shared normalizer between card badge rendering and Vault search/filter composition.
3. No deduplication clustering mechanism existed to score recipe richness (enhanced variants, linked ingredients, favourites) and merge duplicate clusters atomically in Firestore while migrating `favouriteVariantIds` and repointing active split meal plan slots (`elliott`/`chloe`).

## Solution Architecture

1. **Full Vault Rendering & Unified Type Normalization:**
   - Removed the 50-item limit in `src/views/RecipeVaultView.js`, allowing all sorted recipes to render cleanly.
   - Introduced `getNormalizedRecipeTypes(recipe)` in `src/components/vault/VaultRecipeCard.js`, handling array, string, and comma-separated formats and bi-directionally normalizing `snack` and `snacking`.
   - Added `<option value="snacking">Snacking</option>` to `index.html` and `VaultFilterToolbar.js`.
2. **Deterministic Title Key Normalization & Richness Scoring:**
   - `normalizeRecipeTitleKey(title)` normalizes Unicode NFC, strips trailing `(Copy)` (including numbered copies `(Copy 2)`) and `(Enhanced)`, and collapses whitespace.
   - `scoreRecipeCompleteness(recipe, favVariantIds)` calculates deterministic completeness scores (enhanced variant +1000, linked ingredients +10/ea, total ingredients +1/ea, method +10, favourite +50, date tie-breaker).
3. **Atomic Persistence & Reference Repointing:**
   - `repointMealPlanRecipeIds(plan, skeletonGrid, duplicateIdMap)` traverses days, meals, and split user slots (`elliott`/`chloe`) to re-point deleted IDs to canonical IDs.
   - `mergeDuplicateRecipeCluster(clusterMembers, chosenCanonicalId)` adopts missing enhanced variants, unions tags, migrates `preferences.favouriteVariantIds`, and uses a Firestore batch write to persist the canonical recipe and delete duplicates atomically, preventing partial failure data loss.
4. **Duplicate Prevention on Wizard Save:**
   - `onSaveRecipe` and `#btn-import-all-direct` look up existing matching titles via `findExistingRecipeByTitle` to update existing documents in place, preserving existing enhanced variants and favourite statuses.

## Verification

- Automated test suite in `scripts/test_recipe_wizard.js` (Tests 17, 18, 19):
  - Verified 65 recipes render without truncation.
  - Verified clustering, title normalization, and `mergeDuplicateRecipeCluster` execution with favorite migration.
  - Verified duplicate title reuse and variant preservation on Wizard save.
- All 19 tests in `scripts/test_recipe_wizard.js`, 5 tests in `scripts/test_variant_save_and_taxonomy_mapping.js`, and 36 checks in `scripts/test_ledger.js` pass cleanly (`npm run build` exits 0).
