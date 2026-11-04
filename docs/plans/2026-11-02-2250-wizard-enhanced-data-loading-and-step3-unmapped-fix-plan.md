---
title: Fix Wizard Enhanced Recipe Loading, Step 3 Product Mapping & Enforce Taxonomy-Only Ingredient Mapping
type: fix
date: 2026-11-03
topic: recipe-wizard-taxonomy-and-variant-loading
---

# Plan: Fix Wizard Enhanced Recipe Loading, Step 3 Product Mapping & Enforce Taxonomy-Only Ingredient Mapping

> Created: 2026-11-03  
> Status: Implemented  
> Author: Antigravity Pair Programming

## Summary
Fix the runtime crash in Auto-Enhance (`routeNavHtml is not defined`), fix variant loading where base original recipe `ingredientSections` shadowed `found.enhanced.ingredients`, align the wizard Step 2/Step 3 dual-profile macro split with `calculateMealFitScore`, and enforce the fundamental PlatePlan architectural principle that **ingredients strictly map to Taxonomy nodes (Categories, Root Items, Sub-Types) and NEVER to individual products directly**. The product used for an ingredient is always resolved dynamically via the active **Auto-Default Product**.

---

## Prior Solutions & Pattern Awareness

- **`docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md`**:
  - Enforces hierarchical taxonomy containment: `Category ➔ Root Item ➔ Sub-Type ➔ Product`.
  - Recipe ingredients must link to the taxonomy hierarchy, never directly as a standalone product.
- **`docs/solutions/logic-errors/auto-default-strategy-and-recipe-macro-recalibration-20261102.md`**:
  - Auto-default resolution determines the product used for each taxonomy node based on the household strategy (e.g. `highest_protein_per_kcal`).
- **Pattern #01**: Single source of truth for business logic (`calculateMealFitScore` for portion scaling & fit scores).
- **Pattern #09**: Rigorous Planning (Multi-Order Thinking).

---

## Problem Statement

During manual verification of the Recipe Wizard and Auto-Enhance flows:
1. **Auto-Enhance Crash (Test 4)**:
   - Clicking "More" -> "Auto-Enhance" throws `RecipeEnhancementModalUI.js:374 Uncaught ReferenceError: routeNavHtml is not defined`.
2. **Enhanced Variant Ingredient Shadowing in Wizard (Test 2 & Screenshot 2)**:
   - In `RecipeWizardModal.js`, when reviewing an enhanced variant (`activeVariant === 'enhanced'`), `{ ...found, ...found.enhanced }` retains `found.ingredientSections` because `enhanced.ingredientSections` is omitted (enhanced variants store a flat `enhanced.ingredients` list).
   - Because `found.ingredientSections` existed, the wizard loaded the base original ingredients (15ml Sesame Oil, 200g Beef Mince) instead of enhanced ingredients (7.5ml Sesame Oil, 250g Quorn Mince), leading to 645 kcal instead of 566 kcal.
3. **Dual-Profile Per-Portion Split Macro Drift (Screenshot 2)**:
   - In `RecipeWizardStep3View.js`, `renderMacroBreakdownCrossbar` used an ad-hoc formula instead of using `calculateMealFitScore(activeRec, targetMealType, { variant, portionScaled: true })`. This caused Elliott's calories to display as 333 kcal (-51%) instead of 669 kcal (-13%).
4. **Architectural Inversion: Ingredients Mapped Directly to Individual Products**:
   - `RecipeWizardTaxonomySearch.js` incorrectly permitted searching and selecting individual products directly (`prod:id`).
   - In PlatePlan's data model, ingredients must **only** map to:
     - **Categories** (`cat:categoryName`)
     - **Root Items** (`ingredientId`)
     - **Sub-Types** (`ingredientId:subtypeId`)
     - **New Taxonomy Item** (`new_item`, which opens the Taxonomy Creation Modal)
   - Ingredients should **never** be linked to individual products directly. The product is always determined by the taxonomy node's **Auto-Default Product**.
5. **Step 3 Review Display & Missing Fit Score (Screenshot 3)**:
   - Step 3 ingredient review only checked category and ingredient IDs, but when ingredients had `productId` or when resolving taxonomy nodes, it fell back to unmapped text.
   - Step 3 identity banner omitted `fitTagHtml`, causing the Fit Score pill to disappear when moving from Step 2 to Step 3.

---

## Acceptance Criteria

- [ ] **AC 1: Auto-Enhance Crash Resolved**: Clicking "More" ➔ "Auto-Enhance" on any recipe card or view modal renders without throwing `ReferenceError: routeNavHtml is not defined`.
- [ ] **AC 2: Enhanced Variant Ingredients Preserved in Wizard**: Opening Step 2 of the Recipe Wizard for an enhanced recipe loads `found.enhanced.ingredients` (e.g., 7.5ml Sesame Oil, 250g Quorn Mince) and does NOT let `found.ingredientSections` shadow them.
- [ ] **AC 3: Dual-Profile Split Macros Match Recipe View Modal**: Step 2 and Step 3 headers calculate Elliott and Chloe's portion split via `calculateMealFitScore(..., { portionScaled: true })`, producing exact match with the View Recipe modal (e.g., Elliott 669 kcal, Chloe 463 kcal).
- [ ] **AC 4: Taxonomy-Only Ingredient Mapping Enforced**:
  - `RecipeWizardTaxonomySearch.js` removes individual product selection (`prod:`).
  - Search dropdown only allows selecting Categories, Root Items, or Sub-Types.
  - Dropdown options display the taxonomy hierarchy with its current active Auto-Default Product (e.g. `📦 Beef Mince [Meat Substitutes] → Auto-Default: Quorn Mince`).
  - `syncStep2InputsToState` only persists taxonomy IDs (`categoryId`, `ingredientId`, `subtypeId`) and strips direct `productId` assignment.
- [ ] **AC 5: Step 3 Review Renders Mapped Taxonomy & Fit Score**:
  - Step 3 displays the mapped taxonomy node and its resolved auto-default product with the green "Mapped" badge.
  - Step 3 header includes `fitTagHtml` showing the live Fit Score badge.
- [ ] **AC 6: Automated Test Verification**: All automated test suites (`test_variant_save_and_taxonomy_mapping.js`, `test_recipe_review_and_auto_enhance_flow.js`, `test_shopping_list.js`, `test_ledger.js`) pass cleanly.

---

## Technical Approach & Implementation Steps

### Step 1: Fix Auto-Enhance Modal Syntax
- **File**: `src/components/recipe/RecipeEnhancementModalUI.js`
- Remove `${routeNavHtml}` from template string (line 374).

### Step 2: Fix Enhanced Variant Ingestion in Recipe Wizard
- **File**: `src/components/recipe/RecipeWizardModal.js`
- When `isEnhVariant = activeVariant === 'enhanced' && found.enhanced`:
  - If `found.enhanced.ingredients` exists and `found.enhanced.ingredientSections` does not, delete `targetSource.ingredientSections` from the merged object so that `found.ingredientSections` does not shadow `found.enhanced.ingredients`.
  - Unpack `found.enhanced.ingredients` into `ingredientSections` preserving all taxonomy identifiers (`categoryId`, `ingredientId`, `subtypeId`, `name`, `qty`, `unit`, `raw`).

### Step 3: Enforce Taxonomy-Only Mapping & Remove Direct Product Selection
- **File**: `src/components/recipe/RecipeWizardTaxonomySearch.js`:
  - Remove `Products (Pantry)` section from search dropdown (`matchedProds` & `prod:` options).
  - Dropdown options strictly render:
    - `✨ New Item` (`data-val="new_item"`)
    - `📂 [Category] {category}` (`data-val="cat:{category}"`)
    - `📦 {rootItem.name} [{rootItem.category}]` (`data-val="{rootItem.id}"`)
    - `🏷️ {subtype.name} ({rootItem.name})` (`data-val="{rootItem.id}:{subtype.id}"`)
  - For each taxonomy node, look up its resolved auto-default product and display an informational indicator:
    `📦 Beef Mince [Meat Substitutes] → Default: Quorn Mince`
  - In `getTaxonomyLabel`:
    - Resolve label from `categoryId`, `subtypeId`, or `ingredientId`.
    - If a taxonomy node is mapped, show `🏷️ {subtype.name} ({rootItem.name})` or `📦 {rootItem.name}` with its auto-default product.
- **File**: `src/components/recipe/RecipeWizardState.js`:
  - In `syncStep2InputsToState`:
    - Reject or strip direct `prod:` values.
    - If `val.startsWith('cat:')`: set `categoryId`, clear `ingredientId`, `subtypeId`, `productId`.
    - If `val.includes(':')`: parse `[ingredientId, subtypeId]`, clear `categoryId`, `productId`.
    - If `val !== 'new_item'`: parse `ingredientId`, clear `categoryId`, `subtypeId`, `productId`.
    - Automatically resolve the auto-default product for nutrition & macro calculations via `resolveProductForIngredient`.

### Step 4: Align Dual-Profile Split & Add Fit Badge to Step 3
- **File**: `src/components/recipe/RecipeWizardStep3View.js`:
  - In `renderMacroBreakdownCrossbar`:
    - Call `calculateMealFitScore(activeRec, targetMealType, { variant, portionScaled: true })`.
    - Extract Elliott & Chloe's calories, protein, and percentage diffs directly from `fitResult.details.elliott` and `fitResult.details.chloe`.
  - In `renderStep3IngredientsReviewHTML`:
    - Check taxonomy linkages (`categoryId`, `ingredientId`, `subtypeId`) and resolve the auto-default product via `resolveProductForIngredient`.
    - Render taxonomy path + auto-default product name + "Mapped" badge.
  - In Step 3 Dish Identity Header:
    - Render `fitTagHtml` alongside dish title and variant badge.

### Step 5: Verification & Testing
- Update `scripts/test_variant_save_and_taxonomy_mapping.js`:
  - Assert that taxonomy search dropdown never outputs `prod:` options.
  - Assert that selecting a root item or subtype maps to taxonomy and resolves auto-default product.
  - Assert that wizard initialization for an enhanced recipe unpacks enhanced ingredients.
  - Assert that Step 2 & Step 3 macro crossbar matches `calculateMealFitScore`.
- Run all test suites: `node scripts/test_variant_save_and_taxonomy_mapping.js`, `node scripts/test_recipe_review_and_auto_enhance_flow.js`, `node scripts/test_shopping_list.js`, `node scripts/test_vault_recipe_card_menu.js`, `node scripts/test_ledger.js`.
- Run `npm run build` to verify assets and version tags.
