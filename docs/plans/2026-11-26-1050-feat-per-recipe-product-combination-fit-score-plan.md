---
title: Per-Recipe Combinatorial Product Mapping for Fit Score
date: 2026-11-26
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

## Goal Capsule

- **Objective:** Automatically evaluate combinations of pantry products across each recipe's ingredients so every recipe achieves its highest household Fit Score for the active meal context, with Vault, Planner, Today, and Shopping List always showing and buying the same resolved products.
- **Means:** Replace greedy single-ingredient product resolution (`isAutoDefault` / `highest_protein_per_kcal`) with a fast, epoch-memoized, context-parameterized combinatorial product solver backed by safe culinary guardrails, unified live macro resolution, and slot-scoped plan freezing.
- **Product Authority:** Elliott & Chloe household workflow (`ce-brainstorm` Product Contract seeded from `docs/ideation/2026-11-26-per-recipe-product-combination-fit-score-ideation.html`, pressure-tested via `ce-doc-review`).
- **Execution Profile:** Single feature branch (`dev/per-recipe-product-combination-fit-score`) and single PR targeting `development` (never `main`, no `package.json` version bump on `dev/*`).
- **Open Blockers:** None.

## Product Contract

### Problem and Motivation

PlatePlan currently resolves each recipe ingredient to a single global pantry product (`resolveDynamicProductForIngredient`) using `defaultProductId`, `isAutoDefault`, or a per-line `compareProductsByStrategy` sort (`highest_protein_per_kcal`). That greedy per-line choice ignores the rest of the recipe and often triggers the Calorie Deficit Paradox (pushing total calories below `calMinOpt` even when protein is optimal). Meanwhile, `extractRecipeMacros` trusts stale positive `recipe.macros` snapshots instead of live pantry products, `generateMealPlan` does not freeze `plan.productSelections`, `TodayRenderService` and `getPlannedSlotNutrition` ignore frozen plan selections, and `RecipeEnhancementService` jumps straight to mutating recipe quantities and forking `.enhanced` variants before checking whether pantry products alone reach `85+`.

### Requirements

- R1. The system evaluates combinations of candidate pantry products jointly across a recipe's ingredients to maximize `calculateMealFitScore` for the requested `(variant, mealType, activeProfile)` context, rather than picking one global product per ingredient in isolation. When `mealType === 'all'`, the solver evaluates each eligible meal type (`getEligibleMealTypes`) and selects the highest-scoring `(mealType, combo)`.
- R2. Product combination search enforces strict binding precedence (`subtypeId` → `ingredientId`/`groupId` → `categoryId` → `productId` → name) as its culinary safety boundary:
  - `subtypeId`-bound lines stay within their sub-type.
  - `ingredientId`-bound lines explore sibling sub-types bi-directionally (both leaner and fuller-fat).
  - `categoryId`-bound lines filter candidates by compatible culinary role (`classifyIngredientRole`, enforced whenever `lineRole !== 'other'`) and valid discrete item weight for discrete-count units (`qty`, `piece`, `item`, `patty`, `burger`, `slice`, or blank unit), falling back to the baseline candidate if filtering empties the pool.
  - Explicit `productId`-only lines (with no taxonomy binding) and `excludeNutrition` lines remain fixed.
- R3. Resolution follows one context-aware precedence contract across all surfaces:
  - **Unplanned surfaces** (Vault, Wizard Step 3, Planner swap/pin pickers): invoke the live solver for `(variant, mealType, activeProfile)`. Vault defaults to `(bestEligibleMealType, 'everyone')` when `#filter-type` and `#filter-who` are `'all'`, and honors explicit filter selections (or `r.who`) when set.
  - **Planned surfaces** (Planner grid, Today cards/nutrition, Shopping List, and Recipe Detail Modal opened with `instanceId`/plan context): resolve strictly in order **`plan.substitutions` / `state.overrides` > frozen `plan.productSelections` > live solver**.
  - **Shared meals (`!slot.isSplit` where E and C share `recipeId` + `variant`, and `mealPrepGroups` matched by `(recipeId, mealType, dayNum)`)**: solve once using `activeProfile = 'everyone'` so a shared dish never forks into different products for Elliott and Chloe. Split slots (`isSplit: true` or distinct E/C recipes) solve independently for `'elliott'` and `'chloe'`.
- R4. Over Fit Score plateaus and near-ties, the solver compares against the single-line `resolveDynamicProductForIngredient` baseline (`defaultProductId` → `isAutoDefault` → `autoDefaultStrategy`):
  - **Recipe-level churn gate:** override the baseline combo only when `bestFinalScore >= baselineFinalScore + 3`.
  - **Lexicographic plateau tie-breaking** (among combos tied on integer `finalScore`): (1) `min(fitScoreE, fitScoreC)` fairness when `activeProfile === 'everyone'` (omitted for single-person slots), (2) fewer ingredient departures from baseline, (3) aggregate `autoDefaultStrategy` alignment, and (4) lowest proportional ingredient cost (`calculateItemNutrition().cost`).
- R5. Evaluation meets mobile performance and accuracy SLAs (`< 2 ms` typical per recipe, `< 16 ms` Vault filter/render, `<= 1` Fit Score point max drift from exhaustive Cartesian enumeration across all meal splits including low-kcal breakfast curves) and always retains the baseline product unpruned.
- R6. Dynamic pantry-derived macros from the memoized combo solver become the live authority in `extractRecipeMacros` (and `RecipeWizardStep3Handlers.recalculateWizardMacros`) whenever pantry products are hydrated, with zero in-place mutation of `recipe.macros` / `recipe.enhanced.macros` and zero startup Firestore `recipes/*` writes:
  - `extractRecipeMacros` accepts optional context `{ mealType, activeProfile, productOverrides, planContext, products, ingredients, preferences }` and normalizes ingredients across both `ingredientSections` and `ingredients` for both `'original'` and `'enhanced'`.
  - **Partial-linkage completeness guard:** fall back to stored static `recipe.macros` if no ingredients resolve, if an unlinked/0-product nutrition-bearing line leaves `cal <= 0` or `prot <= 0` while valid static macros exist, or if major nutrition-bearing lines cannot resolve.
  - **`ProductSwapModal.evaluateSwapFitScore` compatibility:** evaluate swap candidates by passing `productOverrides` into `calculateMealFitScore` rather than mutating static `perServing`/`macros` on a cloned recipe.
  - **Startup write hygiene:** decouple `CacheMaintenanceService` and `recipeStore.autoRecalibrateRecipeDrift` from batch-writing or overwriting combo-solved `recipe.macros` on boot.
- R7. Recipe documents in Firestore remain free of concrete `productId`/`bankId` fields (`stripProductIdsFromIngredients`). Concrete winning combos are persisted only at plan-freeze time as slot-scoped `${eventId}:${ingKey}` entries in `plan.productSelections` (disambiguating `ingKey` for `categoryId`-only or duplicate lines within one recipe, and stopping new unscoped writes while retaining legacy unscoped fallback reads):
  - Wire plan freezing and stale-slot clearing/re-solving across all slot-mutating entry points: `MealPlanGeneratorService.generateMealPlan`, `PlannerSwapModalUI` (fixing its invalid `'protein'` priority), `PlannerMealSlot.selectAndSwapRecipe`, and `PlanSlotSwapService.swapPlanMealSlots` (migrating day-scoped keys on Today rearrange).
  - Align nested `isSplit` `_E`/`_C` event IDs between `freezeProductSelectionsForPlan` and `ShoppingCalculationService.candidateEventIds`, and match `mealPrepGroups` by `(recipeId, mealType, dayNum)`.
  - Wire `getPlannedSlotNutrition`, `TodayRenderService`, and `PlannerRenderService` to read frozen slot selections, `plan.substitutions`, and `variant` (`_variant`) instead of static `recipe.macros`.
- R8. `ShoppingCalculationService` keeps `entry.subtypeId` populated from `matchedProd.subtypeId` (preserving `ProductSwapModal` Tier 1 sub-type lists), while anchoring `atHomeKey` (`shoppingAtHome`) strictly on the authored line's taxonomy (`${rootOrIngId || 'ing'}:${authoredSubId}` when `ing.subtypeId`/`ing.subTypeId` is set, else `${rootOrIngId || rawName}` — never `matchedProd.subtypeId`), checking legacy `${rootOrIngId}:${matchedProd.subtypeId}` as a read fallback for in-progress plans.
- R9. `RecipeEnhancementService` runs zero-edit pantry combo optimization as Stage A before proposing quantity or serving mutations:
  - When Stage A reaches `>= 85`, return an explicit `stageAOptimal: true` / `noForkNeeded: true` state (preserved through route deduplication) and suppress redundant `.enhanced` variant creation in `RecipeEnhancementModalUI` unless the user opts into manual edits.
  - When Stage A is `< 85`, Stage B seeds working ingredients from Stage A's winning products without persisting `productId` on `.enhanced` ingredients.
- R10. `RecipeDetailModalService` passes `(variant, mealType, activeProfile, instanceId/planContext)` into `RecipeDetailModalUI.renderRecipeIngredientsListHTML` / `formatRecipeIngredientRow` (without triggering combo solving inside `RecipeVaultView`'s per-ingredient search filter). Ingredient rows display lightweight inline attribution chips on lines where the solver departed from baseline (showing the chosen product and recipe-level Fit Score lift, distinct from manual `plan.substitutions`).

### Key Decisions

- KTD1. **Context-aware per slot & profile optimization** — Unplanned surfaces evaluate live for the active `(variant, mealType, activeProfile)`; planned surfaces read frozen slot-scoped selections (with shared meals solved once for `'everyone'`). (session-settled: user-directed — chosen over one fixed household-wide combo per recipe: avoids capping multi-slot and split-person meals to one meal split's defaults)
- KTD2. **Safe culinary boundaries by taxonomy binding** — Keep `subtypeId`-bound lines locked to their sub-type, allow `ingredientId`-bound lines to explore sibling sub-types bi-directionally, and guard `categoryId`-bound lines with role and discrete-weight checks. (session-settled: user-approved — chosen over unlocking `subtypeId` cross-subtype swaps automatically: prevents unexpected culinary substitutions when a sub-type was explicitly chosen)
- KTD3. **`+3` point churn gate and lexicographic plateau tie-breaking** — Override baseline (`resolveDynamicProductForIngredient`) only when the optimal combo lifts Fit Score by at least `3` points, breaking integer ties by `min(E, C)` fairness (shared meals only), fewer baseline departures, aggregate `autoDefaultStrategy`, and lowest proportional cost. (session-settled: user-approved — chosen over pure `+1` point maximization: avoids confusing product churn across recipes for negligible 1-point differences)
- KTD4. **Abstract recipes, plan-frozen concrete combos, and live epoch-memoized macros** — Keep `recipes/*` free of `productId`/`bankId`, freeze slot-scoped combos in `plan.productSelections`, and serve Vault/Planner/Modal macros from an in-memory cache invalidated on `products`/`ingredients`/`preferences` epochs and recipe content/version identity (with `WeakMap` + structural fingerprint support for in-place Wizard/test edits). (session-settled: user-approved — chosen over writing solved product IDs or recalculated macros back to Firestore `recipes/*`: prevents stale SKU lock-in and multi-phone snapshot write loops)
- KTD5. **First-pass UX scope** — Include `RecipeEnhancementService` Stage A and lightweight inline attribution badges in `RecipeDetailModalUI`; defer interactive "Lock One & Re-Solve Rest" controls to a follow-up. (session-settled: user-approved — chosen over bundling full interactive constraint-pinning UI in v1: delivers full automatic optimization and transparency with a tighter UI surface)

### Scope Boundaries and Non-Goals

- **In scope:** Single-owner combo solver, catalog indexing & epoch/fingerprint memoization, `extractRecipeMacros` live authority + `ProductSwapModal` override support, slot-scoped `plan.productSelections` freezing across all plan-mutating flows, `getPlannedSlotNutrition` / `TodayRenderService` / `PlannerRenderService` alignment, `atHomeKey` stability fix, `RecipeEnhancementService` Stage A, lightweight `RecipeDetailModalUI` attribution badges, and standalone Node regression tests.
- **Non-goals (deferred):**
  - Interactive "Lock One & Re-Solve Rest" pin/re-balance controls in `RecipeDetailModal` and `ProductSwapModal`.
  - Cross-plan multi-day Top-K SKU / pack-remainder consolidation across a 7–10 day meal plan.
  - Asymmetric component forking (splitting a single shared recipe's finishing ingredient into separate Elliott/Chloe products).
  - Adding product-level allergen/dietary tags to the Firestore product schema.

### Success Criteria

- SC1. On recipes with multiple candidate products across 2–6 variable lines, the solver matches exhaustive Cartesian enumeration's maximum Fit Score within `<= 1` point (exact `0` without bucketing loss) in `< 2 ms` per recipe, including low-calorie single-person breakfast curves.
- SC2. High-protein recipes penalized by the Calorie Deficit Paradox under greedy `highest_protein_per_kcal` gain measurable Fit Score when bi-directional `ingredientId` siblings exist, while recipes within `< 3` points of baseline retain their baseline products.
- SC3. Updating a pantry product or macro preference in `Store` updates Vault Fit Scores, Detail Modal macros, and `ProductSwapModal` Fit Score deltas immediately with `0` Firestore `recipes/*` writes.
- SC4. Generating or swapping a meal plan freezes slot-scoped `plan.productSelections` (solving shared meals once for `'everyone'` and split slots per person), Today/Planner/Shopping all display and buy those exact products, and existing `shoppingAtHome` ticks survive sibling-subtype changes.
- SC5. All 53 existing tests (`npm test`, `npm run lint`, `npm run build`, `npm run ledger`) remain green alongside new solver, memoization, `ProductSwapModal`, plan-freezing, and `atHomeKey` regression tests.

### Outstanding Questions

#### Resolve Before Planning
- None.

#### Deferred to Planning
- Exact module layout to avoid circular ESM dependencies (e.g., extracting pure Fit curve math + `classifyIngredientRole` into leaf modules below `RecipeProductSolver.js`, `macroScoringUtils.js`, `fitScoreCalculator.js`, and `PantryTaxonomyService.js`, and updating `LEDGER.md`).
- Exact solver internals: `CatalogIndex` structure, constant-folding threshold, macro-bucketing epsilon (bounded so cumulative error stays `<= 1` Fit point), and Branch-and-Bound `+1` rounding slack / 2D bucketed DP cutoff.
- Exact `ingKey` disambiguation format for duplicate/category-only lines within one recipe in `plan.productSelections`.

### Sources

- `docs/ideation/2026-11-26-per-recipe-product-combination-fit-score-ideation.html`
- `docs/solutions/logic-errors/asymmetric-calorie-deficit-tapering-and-taxonomy-elevation.md`
- `docs/solutions/logic-errors/recipe-wizard-enhanced-variant-live-macro-recalculation-20261104.md`
- `docs/solutions/logic-errors/auto-default-strategy-and-recipe-macro-recalibration-20261102.md`

## Planning Contract

### Module Architecture & Acyclic ESM Dependency Graph

To prevent circular ESM imports (currently `fitScoreCalculator.js` → `macroScoringUtils.js` → `PantryTaxonomyService.js`, while `RecipeEnhancementNutrition.js` imports `RecipeWizardStep3Handlers.js`) and respect `plateplan-architecture.md` (one owner per job, no parallel duplicate services):

1. **Pure Leaf Helpers (`src/utils/fitScoreWeights.js` + `src/services/NutritionService.js`):**
   - Move `classifyIngredientRole` (pure regex/string helper, currently in `src/services/RecipeEnhancementNutrition.js:182-224`) into `src/services/NutritionService.js` and re-export it from `RecipeEnhancementNutrition.js` for backward compatibility.
   - Move `interpolateAsymmetricCurve`, `calculateCalorieScore`, and `calculateProteinScore` out of `src/utils/macroScoringUtils.js` into `src/utils/fitScoreWeights.js` (zero store/pantry imports) and re-export them from `macroScoringUtils.js` and `fitScoreCalculator.js`.
   - Add a pure `extractRecipeIngredients(recipe, variant)` helper (returning `ingredientSections` flattened when non-empty, else `ingredients`, avoiding original-section shadowing on `enhanced` spreads) in `src/utils/fitScoreWeights.js` (or `src/services/NutritionService.js`).
   - Remove the unused `saveCurrentPlan` import from `src/utils/fitScoreCalculator.js:9`.
2. **Pure Solver Engine (`src/services/RecipeProductSolver.js`):**
   - Imports only leaf modules: `NutritionService.js` (`calculateItemNutrition`, `resolveProductItemWeight`, `classifyIngredientRole`), `PantryHierarchyService.js` (`compareProductsByStrategy`), and `fitScoreWeights.js` (`DEFAULT_SPLITS`, `resolveFitScoreParams`, `calculateCalorieScore`, `calculateProteinScore`, `extractRecipeIngredients`). Zero imports from `store.js`, `macroScoringUtils.js`, `HouseholdRepository.js`, UI modals, or `RecipeEnhancementService.js`.
   - Consumed by `macroScoringUtils.js`, `fitScoreCalculator.js`, `PantryTaxonomyService.js` (`freezeProductSelectionsForPlan`), `RecipeEnhancementService.js`, `RecipeDetailModalService.js`, and `RecipeWizardStep3Handlers.js`.

### Solver & Memoization Design

1. **`CatalogIndex` (`buildCatalogIndex(products, ingredients)`):**
   - Cached via `WeakMap` keyed by `products` array reference (paired with `ingredients` length/ref + a monotonic `pantryEpoch` bumped in `store` setters `setProducts`/`setIngredients` for in-place mutations).
   - Indexes `productsById`, `productsBySubtypeId`, `productsByIngredientId`, `productsByCategoryLower`, `ingredientsById`, and `subtypeToRootId` in `O(P + I)` once per catalog change.
2. **Candidate Pool Construction per Line (`buildLineCandidates`):**
   - Respects strict precedence: `productOverrides[lineKey]` (pinned) → `subtypeId` (pool = products with matching `subtypeId`) → `ingredientId`/`groupId` (pool = all products under that root item and its sibling sub-types) → `categoryId`/`category` (pool = category products filtered by `classifyIngredientRole` when `lineRole !== 'other'` and discrete weight validity for discrete units `qty|piece|item|patty|burger|slice|""`, falling back to baseline if empty) → explicit `productId` → exact name fallback.
   - Always computes the single-line baseline product via the same precedence (`defaultProductId` → `isAutoDefault` → `compareProductsByStrategy`) and keeps it pinned in the candidate set even after bucketing.
3. **Constant Folding & Tight Bucketing:**
   - Precompute `(cal, prot, cost)` once per `(line, candidate)` via `calculateItemNutrition`.
   - Lines with `excludeNutrition`, pinned overrides, `<= 1` candidate, or zero macro spread fold into `(baseCal, baseProt, baseCost)`.
   - On variable lines with `> 6` candidates, deduplicate only near-identical macro SKUs within a tight recipe-bounded epsilon (`±1 kcal`, `±0.1 g` protein per serving) keeping the best `compareProductsByStrategy` representative while never dropping the baseline candidate.
4. **Search Algorithm (`solveOptimalRecipeProducts`):**
   - Compile Elliott & Chloe targets (`getTarget`) and `batchSize`/`shareE`/`shareC` multipliers into a lightweight scalar `scoreMacroPair(totalCal, totalProt, ctx)` matching `calculateSingleMealTypeFitScore` identically.
   - Sort variable lines descending by macro swing (`calSpan + 10 * protSpan`) and precompute suffix `[remMinCal, remMaxCal]` and `[remMinProt, remMaxProt]` arrays.
   - **Branch-and-Bound (`K <= 6` variable lines, or up to 2,500 visited nodes):** Compute exact unimodal upper bound on each curve (`100` if reachable interval overlaps `[minOpt, maxOpt]`, else `max(score(lo), score(hi))`) with `+1` rounding slack; prune when `UB < bestFinalScore` (never pruning ties so lexicographic tie-breakers run cleanly).
   - **2D Bucketed DP Fallback (`K > 6` or node budget reached):** Quantize per-serving `(round(cal / 2), round(prot * 4))` states, keeping the lexicographically best tuple per bucket.
   - **Churn Gate & Comparator:** Return the best combo only if `best.finalScore >= baseline.finalScore + 3` (or if `productOverrides` explicitly pinned a line); otherwise return `baseline`. Tie-break equal integer `finalScore` by: (1) `min(fitScoreE, fitScoreC)` when `activeProfile === 'everyone'`, (2) fewer departures from baseline, (3) aggregate `compareProductsByStrategy` rank sum, (4) lowest proportional `cost`.
5. **Memoization Cache:**
   - Keyed by `(recipeFingerprint, variant, mealType, activeProfile, catalogEpoch, prefsEpoch)` where `recipeFingerprint` hashes `(id, serves, variant, lineCount, sumQty, first/last line ids)` so in-place Wizard/test edits never return stale cached macros. Bypassed when `productOverrides` is passed.

### Plan-Freezing, Shopping, & Attribution Contracts

- **Slot-Scoped `plan.productSelections`:**
  - `freezeProductSelectionsForPlan` groups shared slots (`!slot.isSplit` where `${mealType}E` and `${mealType}C` have the same `recipeId` + `variant`) and solves **once** with `activeProfile: 'everyone'`, writing identical `${dayKey}_${mealType}E:${ingKey}` and `${dayKey}_${mealType}C:${ingKey}` entries (plus `${prepGroupId}:${ingKey}` when a `mealPrepGroup` matches `(recipeId, mealType, dayNum)`).
  - Nested `isSplit` slots write `${dayKey}_${slotKey}_E:${ingKey}` and `${dayKey}_${slotKey}_C:${ingKey}`, and `ShoppingCalculationService.js:162-166` passes `${slotKey}_E` / `${slotKey}_C` into `processSlotNode` so `candidateEventIds` matches them.
  - Stop writing unscoped `currentSelections[key]` entries; retain scoped-first / unscoped-fallback reads in `ShoppingCalculationService` for legacy plans.
  - Clear stale slot-scoped keys before re-freezing in `PlannerSwapModalUI`, `PlannerMealSlot.selectAndSwapRecipe`, and migrate day-scoped keys in `PlanSlotSwapService.swapPlanMealSlots`.
- **`atHomeKey` Stability (`R8`):**
  - Keep `entry.subtypeId = effectiveSubId` (including `matchedProd.subtypeId`) so `ProductSwapModal` Tier 1 stays populated.
  - Compute `atHomeKey` strictly from authored taxonomy (`authoredSubId ? "${rootOrIngId || 'ing'}:${authoredSubId}" : (rootOrIngId || rawName)`), checking legacy `${rootOrIngId}:${matchedProd.subtypeId}` as a read fallback when checking `atHomeMap`.

## Implementation Units

### U1. Extract Pure Leaf Helpers & Break Circular Imports
- **Covers:** R1, R2, R6 (architectural prerequisite)
- **Files:** `src/services/NutritionService.js`, `src/services/RecipeEnhancementNutrition.js`, `src/utils/fitScoreWeights.js`, `src/utils/fitScoreCalculator.js`, `src/utils/macroScoringUtils.js`
- **Work:**
  - Move `classifyIngredientRole` into `src/services/NutritionService.js` and re-export it from `src/services/RecipeEnhancementNutrition.js`.
  - Move `interpolateAsymmetricCurve`, `calculateCalorieScore`, and `calculateProteinScore` into `src/utils/fitScoreWeights.js` and re-export them from `src/utils/macroScoringUtils.js` and `src/utils/fitScoreCalculator.js`.
  - Remove unused `saveCurrentPlan` import from `src/utils/fitScoreCalculator.js`.
  - Add pure `extractRecipeIngredients(recipe, variant)` in `src/utils/fitScoreWeights.js` handling both `ingredientSections` and `ingredients` for `'original'` and `'enhanced'` without section shadowing.
- **Check:** `find src -name "*.js" -exec node --check {} +` and `node scripts/test_recipe_enhancement_service.js`.

### U2. Implement `src/services/RecipeProductSolver.js`
- **Covers:** R1, R2, R4, R5, KTD1, KTD2, KTD3, KTD4
- **Files:** `src/services/RecipeProductSolver.js`, `src/store/actions/pantryActions.js` (or `src/store/coreState.js` for `pantryEpoch`/`prefsEpoch` bump helpers)
- **Work:**
  - Implement `buildCatalogIndex`, `buildLineCandidates` (with strict binding precedence, `subtypeId` lock, bi-directional `ingredientId` search, `categoryId` role + discrete-weight guards, and `productOverrides` pinning), constant folding, baseline-preserving tight bucketing, `scoreMacroPair`, interval-bounded Branch-and-Bound + 2D bucketed DP fallback, `+3` churn gate, and 4-level lexicographic tie-breaker.
  - Export `solveOptimalRecipeProducts(recipe, context)` and `invalidateSolverCache()`.
  - Add `WeakMap` + epoch + recipe structural fingerprint memoization.
- **Check:** Standalone unit assertions in `scripts/test_recipe_product_solver.js` verifying brute-force parity (`<= 1` pt), `< 2 ms` latency, Calorie Deficit Paradox rescue, `+3` churn gate, and single-person vs shared fairness.

### U3. Wire Live Combo Macros, `ProductSwapModal`, Vault `r.who`, Wizard Step 3, & Boot Write Hygiene
- **Covers:** R1, R3, R6, KTD4, SC3
- **Files:** `src/utils/macroScoringUtils.js`, `src/utils/fitScoreCalculator.js`, `src/services/FitScoreService.js`, `src/components/vault/VaultRecipeCard.js`, `src/views/RecipeVaultView.js`, `src/components/ProductSwapModal.js`, `src/components/recipe/RecipeWizardStep3Handlers.js`, `src/components/recipe/RecipeWizardStep3View.js`, `src/services/CacheMaintenanceService.js`, `src/store/recipeStore.js`
- **Work:**
  - Update `extractRecipeMacros(recipe, variant, options)` and `calculateMealFitScore(recipe, mealType, options)` to call `solveOptimalRecipeProducts` when pantry products are hydrated, passing `{ mealType, activeProfile, productOverrides, planContext, products, ingredients, preferences }`, with completeness fallback to static `recipe.macros` and zero in-place mutation of `recipe.macros` / `recipe.enhanced.macros`.
  - Honor `r.who` fallback (`elliott` | `chloe`) in `FitScoreService.getSortedRecipes`, `VaultRecipeCard`, and `RecipeVaultView` when `#filter-who` is `'all'`.
  - Update `ProductSwapModal.evaluateSwapFitScore` to evaluate candidates via `productOverrides` passed to `calculateMealFitScore` instead of mutating cloned static macros.
  - Align `RecipeWizardStep3Handlers.recalculateWizardMacros` and `RecipeWizardStep3View` with the solver.
  - Decouple `CacheMaintenanceService.runDeferredMaintenance` and `src/store/recipeStore.js` (`setRecipes` and `updateRecipeInStore`, which call `autoRecalibrateRecipeDrift`) from writing or overwriting combo-solved `recipe.macros` on startup/updates.
- **Check:** `node scripts/test_vault_enhanced_fit_and_wizard_gate.js`, `node scripts/test_auto_default_and_recipe_recalculation.js`, `node scripts/test_recipe_wizard_enhanced_macros.js`.

### U4. Upgrade Slot-Scoped Plan Freezing & Align Planned Views (`Planner`, `Today`)
- **Covers:** R3, R7, KTD1, KTD4, SC4
- **Files:** `src/services/PantryTaxonomyService.js`, `src/services/MealPlanGeneratorService.js`, `src/components/planner/PlannerSwapModalUI.js`, `src/components/planner/PlannerMealSlot.js`, `src/services/PlanSlotSwapService.js`, `src/views/TodayView.js`, `src/views/TodayRenderService.js`, `src/views/PlannerRenderService.js`
- **Work:**
  - Upgrade `freezeProductSelectionsForPlan` to call `solveOptimalRecipeProducts` per slot (grouping shared `!isSplit` E/C slots and `mealPrepGroups` into one `'everyone'` solve, disambiguating duplicate/category-only `ingKey`s, stopping new unscoped writes, and supporting `forceOverwrite` for swapped slots).
  - Wire `generateMealPlan` to freeze `plan.productSelections`, fix `PlannerSwapModalUI` (`'protein'` → household strategy + clear stale slot keys), wire `PlannerMealSlot.selectAndSwapRecipe`, and update `PlanSlotSwapService.swapPlanMealSlots` to migrate day-scoped `productSelections`/`substitutions`.
  - Wire `getPlannedSlotNutrition`, `getPlanSlotInfo` (`_variant`), `TodayRenderService`, and `PlannerRenderService` to resolve `plan.substitutions` > `plan.productSelections` > live solver.
- **Check:** `node scripts/test_today_view.js`, `node scripts/test_planner_controls.js`, `node scripts/test_dynamic_recipe_product_resolution.js`.

### U5. Anchor `atHomeKey` & Align `ShoppingCalculationService`
- **Covers:** R7, R8, SC4
- **Files:** `src/services/ShoppingCalculationService.js`
- **Work:**
  - Pass suffixed `${slotKey}_E` / `${slotKey}_C` for nested `isSplit` slots into `processSlotNode` so `candidateEventIds` finds split frozen selections.
  - Match `matchedPrep` by `(recipeId, mealType, dayNum)` when `g.mealType` is present (retaining legacy `!g.mealType` fallback so existing tests/plans without `g.mealType` keep merging across days).
  - Add `categoryId` / disambiguated `ingKey` to `lookupKeys`.
  - Anchor `atHomeKey` on authored taxonomy (`${rootOrIngId || 'ing'}:${authoredSubId}` or `${rootOrIngId || rawName}`), keeping `entry.subtypeId` populated from `matchedProd.subtypeId` for `ProductSwapModal` Tier 1 and checking legacy `${rootOrIngId}:${matchedProd.subtypeId}` as read fallback.
- **Check:** `node scripts/test_shopping_servings_multiplier.js`, `node scripts/test_shopping_list.js`, `node scripts/test_today_view.js`.

### U6. Stage A Auto-Enhance & Lightweight `RecipeDetailModalUI` Attribution Chips
- **Covers:** R9, R10, KTD5
- **Files:** `src/services/RecipeEnhancementService.js`, `src/components/recipe/RecipeEnhancementModalUI.js`, `src/services/RecipeDetailModalService.js`, `src/components/recipe/RecipeDetailModalUI.js`
- **Work:**
  - Add Stage A pantry combo check to `generateEnhancementPlan`: when Stage A reaches `>= 85`, return `stageAOptimal: true` / `noForkNeeded: true` (preserving it past empty-signature dedupe) and display the optimal combo in `RecipeEnhancementModalUI` without creating a redundant `.enhanced` variant; when `< 85`, seed Stage B working ingredients from Stage A's winning products without persisting `productId`.
  - Thread `(variant, mealType, activeProfile, instanceId/planContext)` from `RecipeDetailModalService` (including `calculateMealFitScore` for header/crossbar, `updateRecipePreviewScale`, and `updateSinglePersonServes`) into `renderRecipeIngredientsListHTML` / `formatRecipeIngredientRow` (leaving `RecipeVaultView`'s search string builder untouched) and render a compact inline attribution chip on non-default combo picks (distinct from manual `plan.substitutions`).
- **Check:** `node scripts/test_recipe_enhancement_service.js`, `node scripts/test_recipe_review_and_auto_enhance_flow.js`, `node scripts/test_recipe_detail_modal_responsive.js`.

### U7. Regression Test Suite, Ledger, & Build Verification
- **Covers:** SC1, SC2, SC3, SC4, SC5
- **Files:** `scripts/test_recipe_product_solver.js`, `scripts/test_today_view.js`, `scripts/test_shopping_servings_multiplier.js`, `LEDGER.md`
- **Work:**
  - Add `scripts/test_recipe_product_solver.js` covering: exact brute-force parity, `< 2 ms` performance, Calorie Deficit Paradox bi-directional rescue, `+3` churn gate, `min(E, C)` fairness tie-break, single-person vs shared slots, partial-linkage fallback, `ProductSwapModal` override deltas, shared-meal single-solve plan freezing, `atHomeKey` preservation across sibling subtype swaps, and Stage A zero-fork short-circuit.
  - Run `npm run ledger`, `npm run lint`, `npm test`, `npm run build`, and `find src -name "*.js" -exec node --check {} +`.

## Verification Contract

Run in one chained command after the final edit:

```bash
node scripts/test_recipe_product_solver.js && npm run ledger && npm run lint && npm test && npm run build && find src -name "*.js" -exec node --check {} +
```

- All 53 existing tests plus `scripts/test_recipe_product_solver.js` pass (`0` failed).
- `npm run lint` passes.
- `npm run ledger` reports `0 dead shims, 0 parallel`, and no new dead modules beyond the pre-existing `1 dead` baseline (`src/services/FirestoreUtils.js`).
- `npm run build` stamps `dist/` cleanly with zero remaining placeholders.
- `git diff --stat origin/development` contains only scoped files (no `package.json` version bump, no unrelated dirty files).

## Definition of Done

- All Implementation Units `U1`–`U7` are complete and traced to `R1`–`R10`.
- `Verification Contract` passes with zero failures.
- `npm run branch:sync` is clean against `origin/development`.
- PR opened targeting `development` (never `main`) with `.github/pull_request_template.md` filled in and CI green.

