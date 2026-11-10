---
date: "2026-11-10"
problem_type: "logic-errors"
component: "DataQualityScanner, RecipeAuditService, DataQualityTableRenderService, RecipeFirestoreRepository"
severity: "moderate"
symptoms:
  - "Data Quality card 'Unlinked Recipe Ingredients' listed pantry sub-types with 'Edit in Wizard' action buttons"
  - "Clicking 'Edit in Wizard' on an unlinked item opened the blank 'Add Recipe (Manual) / Parse Recipe(s)' wizard modal instead of editing a recipe"
  - "Recipe Mapping Audit perpetually re-flagged recipes (e.g. 'Spicy Dan Dan Noodles') despite successfully applying the 'Save & Fix' orphaned sub-type ID repair"
  - "Batch updating recipes in Firestore threw an unsupported field value error for undefined properties"
root_cause: "Conflation of pantry taxonomy gaps with recipe-level unmapped ingredients in DataQualityScanner, missing multi-schema variant synchronization across recipe.ingredientSections, recipe.ingredients, and recipe.enhanced in RecipeAuditService, and lack of undefined field pruning in batchUpdateRecipesInDb."
tags:
  - "data-quality"
  - "recipe-audit"
  - "pantry-taxonomy"
  - "wizard-routing"
  - "firestore-sanitization"
related_issues: []
related_solutions:
  - "docs/solutions/logic-errors/recipe-vault-visibility-and-atomic-deduplication-20261109.md"
last_referenced: "2026-11-10"
---

# Data Quality Pantry Taxonomy Isolation & Recipe Orphan Synchronization

## Problem Statement

**What happened:**
Users encountered two related data quality issues following the rollout of dynamic recipe-to-pantry resolution:
1. In the Data Quality dashboard, the "Unlinked Recipe Ingredients" card displayed pantry taxonomy sub-types (e.g. "Green Peppers", "Dried Penne", "Dry Sherry") that lacked branded products in the Product Bank. Clicking "Edit in Wizard" on these items launched a blank recipe creation dialog ("How would you like to add your recipe?") instead of editing a recipe.
2. In the Recipe Mapping Audit modal, fixing orphaned sub-type IDs (such as "Instant Noodles" in "Spicy Dan Dan Noodles") appeared to succeed via toast notification, but immediately reappeared upon re-audit because only the primary ingredient section was updated, leaving legacy flat arrays and enhanced variants unpatched. Furthermore, Firestore rejected batch updates containing `undefined` properties.

**Impact:**
Users were blocked from resolving data quality alerts, presented with nonsensical wizard navigation, and faced persisting audit warnings on clean recipes.

## Symptoms

1. **Unlinked Recipe Ingredients Card Noise & Broken Wizard Action:**
   - In `DataQualityScanner.js`, empty pantry sub-types (`products.some(...) === false`) were pushed into `results.unmappedItems`.
   - In `DataQualityTableRenderService.js`, `audit.unmappedItems` rendered under "Unlinked Recipe Ingredients" with a button:
     `<button data-action-dq="edit-recipe" data-recipe-id="${item.recipeId}">Edit in Wizard</button>`.
   - Because pantry sub-types have no `recipeId`, `item.recipeId` evaluated to `undefined`. Clicking it invoked `openRecipeWizard(undefined)`, which opened the choice dialog for creating a brand new recipe.
2. **Persistent Recipe Mapping Audit Warnings:**
   - In `RecipeAuditService.js`, `fixOrphanedSubtype` updated `recipe.ingredientSections`, but failed to update `recipe.ingredients` and `recipe.enhanced.variants[].ingredientSections`.
   - Subsequent audit scans inspected all ingredient locations, detecting the dangling sub-type ID in the un-synchronized arrays.
3. **Firestore Batch Write Rejection:**
   - Calling `batchUpdateRecipesInDb` with recipes carrying unstripped `undefined` keys threw:
     `FirebaseError: Function WriteBatch.update() called with invalid data. Unsupported field value: undefined`.

## Root Cause

1. **Pantry Taxonomy Conflation with Recipe Ingredients:**
   In PlatePlan's data model, pantry sub-types frequently represent culinary staples or taxonomy classifications without needing a dedicated branded store product in the Product Bank. Dynamic product resolution cleanly falls back to root parent ingredients or culinary name matches. Treating empty pantry sub-types as "Unlinked Recipe Ingredients" was an architectural error that polluted the recipe mapping queue.
2. **Recipe Schema Multiplicity:**
   Recipes in PlatePlan contain multiple parallel representations: structured sections (`ingredientSections`), legacy flat lists (`ingredients`), and enhanced variant sections (`enhanced.variants[].ingredientSections`). Mutating only `ingredientSections` left stale identifiers in the remaining arrays.
3. **Missing Payload Sanitization:**
   Firestore's Web SDK rejects payloads containing fields set to `undefined`. Batch updates lacked recursive sanitization prior to staging writes.

## Solution Architecture

1. **Retirement of Noisy Pantry Sub-type Alerts:**
   - Removed the sub-type product bank scan from `src/services/DataQualityScanner.js`.
   - `results.unmappedItems` is strictly reserved for recipe ingredient lines that lack pantry taxonomy mappings (`subtypeId`, `ingredientId`, or `categoryId`).
   - Standardized `scripts/test_data_quality_wizards.js` (Test 6) and `scripts/test_dynamic_recipe_product_resolution.js` to assert that pantry staples without products do not produce artificial alerts.
2. **Deep Recipe Schema Synchronization:**
   - Updated `fixOrphanedSubtype` in `src/utils/RecipeAuditService.js` to synchronize repairs across:
     - `recipe.ingredientSections`
     - `recipe.ingredients`
     - `recipe.enhanced.variants[].ingredientSections`
     - `recipe.enhanced.variants[].ingredients`
   - Added `updateRecipeAuditFix(recipeId, fixedRecipe)` to synchronize local state and IndexedDB cache immediately when an audit item is saved.
3. **Recursive Firestore Batch Sanitization:**
   - Enhanced `batchUpdateRecipesInDb` in `src/services/RecipeFirestoreRepository.js` with `sanitizeForFirestore(obj)` to recursively strip `undefined` values and nested invalid keys before calling `batch.update()`.

## Verification

- `node scripts/test_data_quality_wizards.js`: Verified liquid volume density filtering, duplicate candidate identification, and Test 6 (unmapped pantry staples produce zero alerts).
- `node scripts/test_dynamic_recipe_product_resolution.js`: Verified Units 1–5, ensuring dynamic resolution and data quality audit scanner work seamlessly without artificial alerts.
- `npm run build`: Confirmed clean build with zero syntax errors.
