---
title: Retrospective Taxonomy Elevation Wizard
date: 2026-11-11
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- Objective: Restore recipe ingredient mappings that previously auto-collapsed into specific sub-types back to their intended Root Item or Category levels, reverse-engineering original user intention from pantry auto-default products, with automatic batch elevation for Root Items, interactive recipe-by-recipe review for Category candidates, and immediate macro/fit score recalculation.
- Means: A dedicated two-stage Data Quality modal UI and domain service (`RecipeTaxonomyElevationService`) that identifies auto-default collisions, allows one-click batch approval for Root Items and card-by-card approval for Categories, and commits atomic Firestore updates with synchronized macro and fit score recalculations.
- Product Authority: Governs retrospective recipe taxonomy elevation accessible from the Data Quality view. Does not alter new recipe authoring in the Recipe Wizard or change the pantry taxonomy hierarchy.
- Open Blockers: None.

## Product Contract

### Context & Background

Prior to recent fixes, when a user mapped an ingredient during recipe creation to a high-level Root Item (e.g. "Maple Syrup") or a Category (e.g. "Syrups & Sweeteners"), the system automatically resolved and collapsed that ingredient to the specific sub-type associated with the auto-default product (e.g. "Zero Calorie Maple Syrup"). This locked recipes to narrow product variants rather than preserving the user's intended dynamic flexibility.

Although the Recipe Wizard now preserves Root Item and Category levels for new saves, existing recipes in the vault remain locked to sub-types. A retrospective elevation tool is required to restore these legacy recipes to their intended taxonomy level.

### Problem Statement

1. **Unwanted Sub-type Locking**: Legacy recipes contain ingredients locked to specific sub-types (e.g., `subtypeId: "sub_zero_cal_maple"`) simply because that sub-type held the auto-default product at the moment of recipe creation.
2. **Text-Matching Inadequacy**: Attempting to restore mappings via raw recipe text string matching is brittle, as ingredient strings often carry quantities, brands, or colloquial variations (e.g. "2 tbsp pure canadian maple syrup").
3. **Category vs Root Item Blast Radius**: Elevating an ingredient to a Root Item is safe and restorative (it lets the pantry choose between sub-types of that exact food). Elevating an ingredient all the way to a Category is broad (it allows substitution across any root item in that category, such as substituting honey for maple syrup). Category elevations therefore require explicit, recipe-by-recipe human review.

### Key Decisions

- session-settled: reverse-engineering root item intention. The scanner identifies Root Item candidates by checking whether the recipe ingredient's linked sub-type matches the auto-default product for its parent Root Item. This directly detects and reverses the historical auto-collapse bug without relying on raw text equality.
- session-settled: reverse-engineering category intention. The scanner identifies Category candidates by checking whether the recipe ingredient's linked sub-type matches the auto-default product for the whole Category.
- session-settled: full auto-default resolution strategy. Reverse-engineering identifies a product as the auto-default by checking both explicitly designated defaults (`defaultProductId`) and top products resolved through the active auto-default strategy (e.g. `highest_protein_per_kcal`).
- session-settled: two-stage confirmation model. The wizard operates in two distinct stages: Stage 1 provides a batch elevation for high-confidence Root Item restorations. Stage 2 presents an interactive, recipe-by-recipe review card for Category candidates, allowing the user to choose between [Elevate to Category], [Keep at Root Item], or [Keep at Sub-type].
- session-settled: stage 1 expandable pre-checked checklist. Stage 1 enables 1-click batch elevation while providing an expandable preview checklist (pre-checked by default) so users can uncheck any ingredient they intentionally wish to keep locked to a specific sub-type.
- session-settled: multi-variant synchronized elevation. The scanner evaluates both original and enhanced recipe variants, elevating matching ingredients across both and recalculating nutrition for both variants.
- session-settled: immediate macro and fit score auto-recalculation. Elevating an ingredient (to Root Item or Category) immediately recalculates that recipe's macros, nutrition, and Universal Fit Score using dynamic pantry product resolution, committing both the pointer change and the updated nutrition in the same atomic database transaction.

### User Scenarios & Workflows

#### Scenario 1: Batch Restoring Root Items (Stage 1)
1. User navigates to the **Data Quality** tab.
2. Under Taxonomy Integrity, user clicks **Elevate Recipe Taxonomy**.
3. Stage 1 displays the detected Root Item candidates: "14 ingredients in 8 recipes were auto-collapsed to sub-types that match the root item's auto-default."
4. User clicks **⚡ Elevate All to Root Items**.
5. All 14 ingredients have their `subtypeId` and `productId` stripped while preserving `ingredientId`, macros and fit scores are auto-recalculated immediately, and changes commit to Firestore.

#### Scenario 2: Recipe-by-Recipe Category Review (Stage 2)
1. The wizard advances to Stage 2: Category Elevation Candidates.
2. The wizard displays an interactive card for the first candidate:
   - **Recipe**: Banana Oat Pancakes
   - **Ingredient**: Maple Syrup (Quantity: 30ml)
   - **Current Mapping**: Zero Calorie Maple Syrup (Root: Maple Syrup)
   - **Detected Insight**: Matches the auto-default for Category "Syrups & Sweeteners".
3. User selects an explicit action:
   - **Promote to Category**: Sets `categoryId = 'cat_syrups'`, removes `ingredientId` and `subtypeId`.
   - **Elevate to Root Only**: Sets `ingredientId = 'ing_maple_syrup'`, removes `subtypeId`.
   - **Keep Sub-type**: Leaves mapping locked to Zero Calorie Maple Syrup.
4. On action click, the recipe is updated, its macros and fit score are recalculated, and the card advances to the next candidate until all are reviewed.

### Requirements

- R1. Auto-Default Reverse Engineering Scanner. The scanner must inspect every ingredient across all recipe variants (`original` and `enhanced`). It must resolve default products using both explicit `defaultProductId` and strategy-based ranking (`highest_protein_per_kcal`), comparing the ingredient's linked sub-type and product against:
  - (a) The auto-default product for that ingredient's parent Root Item (Root Candidate).
  - (b) The auto-default product for that ingredient's Category (Category Candidate).
- R2. Stage 1 Root Item Batch Elevation with Checklist. The UI must present the total count of auto-collapsed Root Item candidates with a single-click action to approve all, paired with an expandable checklist (pre-checked by default) allowing users to exclude specific ingredients from elevation.
- R3. Stage 2 Interactive Category Review Card. The UI must present Category candidates one recipe at a time on an interactive card displaying the recipe title, ingredient line, current sub-type, root item, proposed category, and three explicit decision buttons: [Elevate to Category], [Elevate to Root Item], [Keep Sub-type].
- R4. Immediate Multi-Variant Macro & Fit Score Recalculation. Every elevated recipe must have its per-serving calories, protein, and Universal Fit Score recalculated immediately across both `original` and `enhanced` variants via dynamic taxonomy resolution and portion scaling before committing.
- R5. Atomic Database Persistence. Changes must commit to Firestore using batched writes under `households/elliott-chloe/recipes`, updating local Store state and clearing cached hierarchy to ensure views react immediately.
- R6. Mobile-Optimized Apple HIG UI. The modal must follow Apple Human Interface Guidelines, support light and dark theme design tokens, and operate cleanly on mobile touch screens with minimum 44px tap targets.

### Scope Boundaries

- **In Scope**:
  - Scanning engine implementing reverse-engineered auto-default matching in `src/services/RecipeTaxonomyElevationService.js`.
  - Interactive two-stage modal UI in `src/components/data-quality/CategoryPromotionModalUI.js`.
  - Synchronized macro and fit score recalculation using `src/utils/macroScoringUtils.js` and `src/utils/fitScoreCalculator.js`.
  - Standalone verification test suite covering scanner precision, batch root elevation, and single category elevation.
- **Non-Goals**:
  - Automatically rewriting recipes without user interaction or confirmation.
  - Modifying pantry product records, prices, or store taxonomy.
  - Re-architecting the Recipe Wizard edit flow (already handles new recipes).

### Success Metrics & Verification Criteria

- Zero string-matching false positives: Candidates are identified purely through parent root and category auto-default product relationships.
- Batch Root Item elevation completes in one click, successfully stripping `subtypeId` while retaining `ingredientId`.
- Category review card allows granular per-recipe confirmation with zero unreviewed bulk promotions.
- Elevated recipes immediately reflect recalculated calories, protein, and fit scores without requiring a separate settings sweep.

## Planning Contract

### Technical Context & Existing Architecture

- **State Management & Persistence**: Recipes live in Firestore under `households/elliott-chloe/recipes` and in memory under `Store.getState().recipes`. Batch updates use Firestore batched writes via `batchUpdateRecipesInDb` in `src/services/HouseholdRepository.js`.
- **Taxonomy Structure**: Categories ➔ Root Items (`ingredients` collection) ➔ Sub-types (`rootItem.subtypes[]`) ➔ Products (`products` collection).
- **Dynamic Resolution Engine**: `resolveDynamicProductForIngredient(line, { products, ingredients, preferences })` in `src/services/PantryTaxonomyService.js` cascades downward: if `subtypeId` is set, matches within sub-type; if `ingredientId` is set without `subtypeId`, matches across all products under the root item; if only `categoryId` is set, matches across all products in the category.
- **Auto-Default Strategy**: Top products are resolved using `resolveDefaultProduct(item, products)` and `compareProductsByStrategy(a, b, criterion)` (defaulting to `highest_protein_per_kcal`) in `src/services/PantryHierarchyService.js`.
- **Universal Macro & Fit Score Calculation**: `computeDynamicMacrosFromIngredients(ingredients, serves)` and `calculateMealFitScore(recipe, mealType, options)` in `src/utils/macroScoringUtils.js` and `src/utils/fitScoreCalculator.js`.

### Key Technical Decisions (KTDs)

- KTD1. Candidate Partitioning Hierarchy. The scanner evaluates category auto-defaults first. Any ingredient matching the category auto-default is classified as a Category Candidate and excluded from the Root Candidate pool. Root Candidates include only ingredients matching their root item's auto-default that do not match the category auto-default.
- KTD2. Dual Match-Type Classification. For each candidate, the scanner records `matchType: 'explicit_default'` if the linked product ID matches `item.defaultProductId`, or `'strategy_rank'` if the product was chosen via `compareProductsByStrategy`. This tag is displayed on checklist rows and review cards.
- KTD3. Complete Pointer Normalization. Elevating an ingredient strips both `subtypeId` and `productId` (and any legacy `bankId`). Root elevations retain `ingredientId`. Category elevations set `categoryId = category` and strip `ingredientId`. Both sections and flattened `ingredients` arrays are synchronized in lockstep.
- KTD4. In-Flight Multi-Variant Recalculation. When an elevation is applied, the service immediately recomputes per-serving calories, protein, and Universal Fit Score for both `original` and `enhanced` (if present) variants using `PortionCalculationService` / `calculateMealFitScore`, stamping `updatedAt` and updating the recipe payload in memory before committing.
- KTD5. Non-Blocking Async Commit & Rollback. Batch updates execute asynchronously in chunks within Firestore's 500-write limit. A pre-mutation clone of affected recipes is retained in memory so an error alert allows a complete retry or clean dismissal without partial corrupt state.

## Implementation Units

### U1. Reverse-Engineering Scanner Engine & Candidate Partitioning
- **Files**: `src/services/RecipeTaxonomyElevationService.js`
- **Covers**: R1, KTD1, KTD2
- **Approach**:
  - Implement `resolveEffectiveDefaultProduct(target, products, criterion)` evaluating both explicit `defaultProductId` and strategy-based comparator ranking.
  - Scan all recipes and their variants (`original` and `enhanced`).
  - For each ingredient with a `subtypeId`, resolve its root item and category defaults.
  - If the ingredient's sub-type product matches the Category auto-default, add to `categoryCandidates` with `matchType` and exclude from root candidates.
  - Otherwise, if it matches the Root Item auto-default, add to `rootElevations` with `matchType`.
- **Test scenarios**:
  - Verify an ingredient matching the Category default is routed strictly to `categoryCandidates`.
  - Verify an ingredient matching only the Root Item default is routed to `rootElevations`.
  - Verify `matchType` accurately labels `explicit_default` vs `strategy_rank`.
  - Verify scan inspects both `original` and `enhanced` sections.

### U2. Atomic Recipe Elevation Mutations with Synchronized Recalculation
- **Files**: `src/services/RecipeTaxonomyElevationService.js`
- **Covers**: R4, R5, KTD3, KTD4, KTD5
- **Approach**:
  - Implement `applyRootElevationsToRecipe(recipe, selectedKeySet)`: strips `subtypeId`, `productId`, `bankId` for matching items in `ingredientSections` and `ingredients`. Recalculates `cal`, `prot`, `fitScore`, and `enhanced` macros/fit scores.
  - Implement `applyCategoryElevationToRecipe(recipe, candidateKey, decision)`: handles `category` (sets `categoryId`, deletes `ingredientId`, `subtypeId`, `productId`), `root` (sets `ingredientId`, deletes `subtypeId`, `productId`), or `subtype` (no-op). Recalculates nutrition and fit scores.
  - Implement `commitRecipeElevations(recipes)`: commits updates in atomic Firestore batched writes, updates Store state, and invalidates hierarchy cache.
- **Test scenarios**:
  - Verify elevating an ingredient to Root strips `subtypeId` and `productId`, retains `ingredientId`, and recalculates macros.
  - Verify elevating an ingredient to Category sets `categoryId`, deletes `ingredientId`, `subtypeId`, and `productId`.
  - Verify both `original` and `enhanced` variants have macros and fit scores recalculated immediately.

### U3. Stage 1 UI — Recipe-Grouped Checklist, Select All/None, and Async Progress
- **Files**: `src/components/data-quality/CategoryPromotionModalUI.js`
- **Covers**: R2, R6, KTD2, KTD5
- **Approach**:
  - Replace flat list with an expandable accordion grouped by recipe title.
  - Display recipe title, ingredient quantity/unit/text, current sub-type name, and match badge (`Explicit Default` / `Strategy Match`).
  - Add `Select All` and `Deselect All` buttons with pre-checked state by default.
  - Render empty state when zero root candidates exist.
  - Render in-progress spinner during recalculation and Firestore batch commit.
  - Implement pre-mutation snapshot and retryable error banner on commit failure.
- **Test scenarios**:
  - Verify Stage 1 checklist displays grouped recipes with match badges.
  - Verify unchecking an item excludes it from the batch elevation.
  - Verify empty state renders gracefully when 0 root candidates exist.

### U4. Stage 2 UI — Interactive Review Card, Navigation, and Live Macro Delta Preview
- **Files**: `src/components/data-quality/CategoryPromotionModalUI.js`
- **Covers**: R3, R6, KTD3, KTD4
- **Approach**:
  - Render Category candidates one at a time with a progress indicator (`Card X of Y`).
  - Display recipe title, ingredient line, current sub-type, root item, proposed category, and derivation match badge.
  - Compute dynamic live projection: compare current stored macros against projected macros if elevated to Category, displaying calorie, protein, and fit score delta.
  - Provide action buttons: `[Elevate to Category]`, `[Elevate to Root Item]`, `[Keep Sub-type]`, and `[Skip / Review Later]`.
  - Advance card index upon decision; render completion summary screen after the final card.
- **Test scenarios**:
  - Verify card displays progress indicator and candidate details.
  - Verify live macro delta computes and shows calorie/protein/fit score shift.
  - Verify `[Skip / Review Later]` advances without mutating recipe.
  - Verify completion summary screen displays after last candidate is resolved.

### U5. Automated Test Suite & Data Quality Alignment
- **Files**:
  - `scripts/test_recipe_taxonomy_elevation.js`
  - `scripts/test_data_quality_wizards.js`
- **Covers**: Verification Contract
- **Approach**:
  - Create dedicated standalone Node test script `scripts/test_recipe_taxonomy_elevation.js` verifying scanner partitioning, batch root elevation, and single category elevation with macro recalculation.
  - Update `scripts/test_data_quality_wizards.js` to assert elevation tool availability and correct issue counts.
  - Run ledger check (`npm run ledger`) and production build (`npm run build`).
- **Test scenarios**:
  - Run `node scripts/test_recipe_taxonomy_elevation.js` and verify all units pass.
  - Run `node scripts/test_data_quality_wizards.js` and verify assertions pass.
  - Verify `npm run ledger` reports 0 dead code.
  - Verify `npm run build` succeeds cleanly.

## Verification Contract

### Automated Verification Commands
```bash
node scripts/test_recipe_taxonomy_elevation.js
node scripts/test_data_quality_wizards.js
node scripts/test_dynamic_recipe_product_resolution.js
npm run ledger && node scripts/test_ledger.js
npm run build
```

### Manual Verification Recipe
1. Open the app on desktop or mobile (`npm run dev`).
2. Navigate to **Data Quality** ➔ click **Elevate Recipe Taxonomy**.
3. **Stage 1 (Root Items)**:
   - Check that candidate items are grouped by recipe with `[Explicit Default]` or `[Strategy Match]` badges.
   - Verify `Select All` / `Deselect All` toggles.
   - Click `⚡ Elevate Selected to Root Items` and confirm loading spinner displays during recalculation.
4. **Stage 2 (Categories)**:
   - Verify card displays `Card 1 of N` progress.
   - Verify live before/after calorie, protein, and fit score preview is visible.
   - Test `[Elevate to Category]`, `[Elevate to Root Item]`, and `[Skip / Review Later]`.
   - Verify completion summary screen renders when finished.
5. In the Recipe Vault, confirm elevated recipes display updated dynamic macros and fit scores.

## Definition of Done

- All 5 Implementation Units (U1–U5) are fully implemented without syntax errors.
- Candidate partitioning is 100% verified: Category candidates are never modified during Stage 1 batch elevation.
- Elevated ingredients have both `subtypeId` and `productId` cleanly stripped while preserving `ingredientId` (Root elevations) or `categoryId` (Category elevations).
- Recipes immediately recalculate calories, protein, and fit scores upon elevation commit.
- `scripts/test_recipe_taxonomy_elevation.js` and all existing verification scripts pass cleanly.
- `npm run ledger` reports 0 dead files and 0 dead shims.
- `npm run build` compiles with 0 errors.
