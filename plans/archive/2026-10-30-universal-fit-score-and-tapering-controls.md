# Universal Fit Score Engine & Preferences Tapering Controls

> Created: 2026-10-30
> Status: Implemented
> Exploration: [universal-fit-score-and-preferences-tapering-20261030.md](../../docs/explorations/universal-fit-score-and-preferences-tapering-20261030.md)

## Summary

Establish a **single, universal Fit Score calculation** across all PlatePlan views (Recipe Vault, Recipe Detail Modal, Meal Planner, Swap Modals, Generator, and Today View), eliminate the page-load score flicker caused by IndexedDB/Firestore hydration order, fix the 20-point cliff-drop discontinuity in the macro tapering curve, score recipes by their **highest eligible meal type** when viewing "All Meal Types", and add a **Universal Fit Score & Tapering Rules** card with fine-grained percentage inputs and a live preview to the Preferences tab.

---

## Problem Statement

Users observe recipes switching from one Fit Score to another in two scenarios:
1. **On Page Load (The Flicker):** Recipes initially render with one Fit Score and then visibly flick to a second Fit Score ~0.5–1s later.
2. **Across Views / Actions:** A recipe card in the Vault shows one Fit Score, but clicking **View** (especially on an Enhanced variant or a Breakfast/Lunch recipe when the Vault filter is "All Meal Types") or viewing it in Today / Planner / Swap modals shows a different Fit Score.

### Root Causes Identified in `/explore`
1. **IndexedDB Cache & Hydration Order (`src/store/cacheSlice.js:106` & `src/services/HydrationService.js:189-209`):**
   - `saveStateCache` strips `state.preferences.profiles` and `fitScoreParams` when writing to IndexedDB.
   - `hydrateHouseholdData` calls `setRecipes(recipes)` (which immediately renders the Vault) *before* calling `setPreferences(finalPrefs)`, so the first render uses fallback numbers (`2100/140` & `1650/105`) and then flicks when `setPreferences` fires.
2. **"All Meal Types" Scoring Mismatch (`src/views/RecipeVaultView.js:138` & `src/components/vault/VaultRecipeCard.js:261-274`):**
   - When the Vault filter is `"all"`, `RecipeVaultView.js` passes `mealType = 'dinner'` to all cards, while `VaultRecipeCard.js` computes `r.types[0]` on line 261 and then renders the badge for `'dinner'` on line 268.
3. **`viewRecipe` Argument Signature Bug (`src/services/RecipeDetailModalService.js:310-333`):**
   - Every caller invokes `viewRecipe(recipeId, instanceId, variant, targetPerson)` (e.g. `viewRecipe(id, null, 'enhanced')`), but `viewRecipe` aliases `openRecipePreview(recipeId, initialTab = 'original')`. Passing `null` as the 2nd argument sets `currentTab = null`, forcing the modal onto the **Original** variant even when clicking **View** on the **Enhanced** variant!
4. **Implicit Variant Fallback (`src/utils/fitScoreCalculator.js:87` & `src/views/TodayView.js:144`):**
   - `calculateMealFitScore` defaults to `'enhanced'` if `options.variant` is omitted and `r.enhanced` exists. `TodayView.js` omits `variant` and `activeProfile`, causing Original planned meals to show Enhanced household scores.
5. **Vault Card Ignores Active Profile Filter (`src/components/vault/VaultRecipeCard.js:269`):**
   - Hardcodes `activeProfile: 'everyone'` instead of respecting `options.activeProfile` from `#filter-who`.
6. **20-Point Cliff-Drop Discontinuity in Tapering Math (`src/utils/macroScoringUtils.js:126-165`):**
   - At the edge of the Green Grace buffer (`r = minOpt - 0.10 = 0.85`), the score is `86`. At `r = 0.849`, the outer taper divides by `(minOpt - lowFloor)` instead of `(minGrace - lowFloor)`, causing an instant 20-point drop from `86` to `66`.
7. **Competing Inline Formulas & Hardcoded Targets:**
   - `MealPlanGeneratorService.js:316` uses an inline linear deduction formula; `RecipeDetailModalService.js:198-220` uses hardcoded `1950/1350` and `800/600` targets instead of the universal targets from `fitScoreCalculator.js`.

---

## Prior Solutions Referenced

- [es-module-connection-reset-and-build-cache-20261030.md](../docs/solutions/runtime-errors/es-module-connection-reset-and-build-cache-20261030.md)
- [floating-scroll-to-top-button-pattern-20261030.md](../docs/solutions/ui-bugs/floating-scroll-to-top-button-pattern-20261030.md)
- [plan-is-in-currentplan-with-per-person-slots.md](../docs/solutions/ui-bugs/plan-is-in-currentplan-with-per-person-slots.md)

---

## Proposed Solution

### Phase 1: Continuous Tapering Math & Universal Parameter Resolution (`src/utils/macroScoringUtils.js` & `src/utils/fitScoreWeights.js`)

1. **Canonical `DEFAULT_FIT_SCORE_PARAMS` in `src/utils/fitScoreWeights.js`:**
   Define and export the single source of truth for default tapering and weighting parameters (all stored as clean ratios or percentages and resolved via `resolveFitScoreParams(customParams)`):
   - **Macro Weights:** `calorieWeightPct: 50`, `proteinWeightPct: 50` (always summing to 100%).
   - **Calorie Curve (% of meal target):**
     - `calLowFloorPct: 50` (`0.50` — 0 score at or below 50% of target)
     - `calMinGracePct: 85` (`0.85` — enters Green tier `86` at 85% of target)
     - `calMinOptPct: 95` (`0.95` — 100 score from 95% to 100% of target)
     - `calMaxOptPct: 100` (`1.00` — upper bound of 100 score)
     - `calMaxGracePct: 105` (`1.05` — exits Green tier `86` at 105% of target)
     - `calHighCeilPct: 140` (`1.40` — 0 score at or above 140% of target)
   - **Protein Curve (% of meal target):**
     - `protLowFloorPct: 70` (`0.70` — 0 score at or below 70% of target)
     - `protMinGracePct: 95` (`0.95` — enters Green tier `86` at 95% of target)
     - `protMinOptPct: 100` (`1.00` — 100 score from 100% to 120% of target)
     - `protMaxOptPct: 120` (`1.20` — upper bound of 100 score)
     - `protMaxGracePct: 130` (`1.30` — exits Green tier `86` at 130% of target)
     - `protHighCeilPct: 200` (`2.00` — 0 score at or above 200% of target)
2. **Fix the Piecewise Linear Cliff Drop in `src/utils/macroScoringUtils.js`:**
   - **Sweet Spot (`[minOpt, maxOpt]`):** returns `100`.
   - **Lower Grace Zone (`[minGrace, minOpt)`):** interpolates smoothly from `86` (at `minGrace`) to `99` (approaching `minOpt`).
   - **Upper Grace Zone (`(maxOpt, maxGrace]`):** interpolates smoothly from `99` (just above `maxOpt`) down to `86` (at `maxGrace`).
   - **Lower Outer Taper (`(lowFloor, minGrace)`):** interpolates smoothly from `0` (at `lowFloor`) up to **`85`** (approaching `minGrace`):
     `((r - lowFloor) / (minGrace - lowFloor)) * 85` (eliminating the 20-point cliff!).
   - **Upper Outer Taper (`(maxGrace, highCeil)`):** interpolates smoothly from **`85`** (just above `maxGrace`) down to `0` (at `highCeil`):
     `(1 - ((r - maxGrace) / (highCeil - maxGrace))) * 85`.

---

### Phase 2: Universal Fit Score Engine & "Best Eligible Meal Type" (`src/utils/fitScoreCalculator.js` & `src/services/FitScoreService.js`)

1. **Best Eligible Meal Type When `mealType` is `'all'` / `'best'` / Unspecified:**
   - Add `getEligibleMealTypes(recipe)` in `src/utils/fitScoreCalculator.js`: extracts normalized meal types from `recipe.types || recipe.mealSuitability || [recipe.type || 'dinner']`.
   - When `calculateMealFitScore(recipe, mealType, options)` is called with `mealType === 'all'` or `mealType === 'best'` or `!mealType`:
     - Evaluates each eligible meal type on the recipe for the requested `variant` and `activeProfile`.
     - Selects and returns the result with the **highest `.score`** (breaking ties in order of the recipe's primary listed type).
     - Attaches `mealType: bestMealType` on the returned `fitResult` so badges and modals know which meal type produced that best score!
2. **Explicit Variant Default (`'original'` unless `'enhanced'` is requested):**
   - In `calculateMealFitScore`: default `requestedVariant` to `options.variant || (r._variant === 'enhanced' ? 'enhanced' : 'original')` so passing a base recipe without `options.variant` never silently switches to `'enhanced'`.
3. **Configurable Macro Weights (`calorieWeightPct` / `proteinWeightPct`):**
   - In `calculateMealFitScore` and `computeProfileFitScore`: combine `calScore` and `protScore` using `(calScore * calWeight) + (protScore * protWeight)` from `resolveFitScoreParams()`.
4. **Update `FitScoreBadge.js`:**
   - Respect `opts.precomputedFit` if passed, and include the winning `mealType` (e.g. `Lunch`) in the badge tooltip (`🟢 Fit Score: 92% (Ideal Match · Lunch)`).

---

### Phase 3: Fix Page-Load Score Flicker (`src/store/cacheSlice.js` & `src/services/HydrationService.js`)

1. **Preserve Full Preferences in IndexedDB (`src/store/cacheSlice.js`):**
   - Update line 106 of `src/store/cacheSlice.js` so `saveStateCache` persists the complete `state.preferences` object (including `profiles`, `nutritionTargets`, `mealSplits`, and `fitScoreParams`) instead of stripping everything except `{ nutritionTargets }`.
   - In `initStoreCache`, ensure `targetState.preferences` and `targetState.userPrefs` both hydrate `profiles` and `fitScoreParams` immediately on boot.
2. **Hydrate Preferences *Before* Recipes (`src/services/HydrationService.js`):**
   - In `hydrateHouseholdData()`, move `setPreferences(finalPrefs)` and `getState().userPrefs = ...` **above** `setRecipes(recipes)` and `setCurrentPlan(plan)`.
   - In `setupRealtimeSubscriptions()`, attach `subscribePreferences` **first** (before `subscribeRecipes`) so real-time preference snapshots are applied before recipe snapshots trigger UI renders.

---

### Phase 4: Align All Views & Modals to the Universal Calculator

1. **Recipe Vault (`src/views/RecipeVaultView.js` & `src/components/vault/VaultRecipeCard.js`):**
   - When `#filter-type` is `'all'`, pass `mealType: 'all'` into `getSortedRecipes` and `renderVaultGridContainer` → `renderVaultRecipeCard`.
   - In `VaultRecipeCard.js`:
     - Remove the conflicting dual calculation in `buildFit()`.
     - Pass `mealType` (`'all'` when unfiltered, or the selected filter `'breakfast'`/`'lunch'`/`'dinner'`/`'snack'`) and `activeProfile: options.activeProfile || 'everyone'` and `variant: useEnhanced ? 'enhanced' : 'original'` to `calculateMealFitScore` and `renderFitScoreBadge`.
     - Pass `data-meal-type="${fitRes.mealType}"` on the card's **View** button so opening the modal from the Vault opens with the exact meal type that was scored on the card!
2. **Recipe Detail Modal (`src/services/RecipeDetailModalService.js`):**
   - Fix `viewRecipe` / `openRecipePreview` to accept `(recipeId, instanceId = null, variant = 'original', targetPerson = null, mealTypeOverride = null)` (while still supporting 2-arg `openRecipePreview(recipeId, 'enhanced')` calls).
   - Use `getTarget(profile, ...)` from `fitScoreCalculator.js` for the modal's macro comparison badges instead of the hardcoded `1950/1350` and `800/600` numbers.
   - When opened without a forced planner slot, use `mealTypeOverride` or the best-scoring meal type from `calculateMealFitScore(activeR, 'all', ...)` so the modal header Fit Score pill **always matches the Vault card badge 100%**.
3. **Today View, Planner, Swap Modal & Generator:**
   - `src/views/TodayView.js`: Pass `{ variant: slotInfo.variant, activeProfile: person === 'both' ? 'everyone' : (person === 'c' ? 'chloe' : 'elliott'), showLabel: true }` to `renderFitScoreBadge`.
   - `src/services/MealPlanGeneratorService.js`: Replace the inline linear deduction formula at line 316 with `calculateMealFitScore`.
   - `src/components/generator/GeneratorCandidateDrawer.js`: Use `getFitScoreTierMeta` for consistent 4-tier colors (`85 / 70 / 50`).

---

### Phase 5: New "🎯 Universal Fit Score & Tapering Rules" Card in Preferences (`src/components/settings/FitScoreTaperingCard.js` & `src/views/SettingsView.js`)

Create a dedicated, self-contained component `src/components/settings/FitScoreTaperingCard.js` (< 250 lines) and wire it into `src/views/SettingsView.js`:
1. **Macro Weight Balance Inputs:**
   - **Calorie Weight (%)** and **Protein Weight (%)** inputs (`0–100%`, default `50% / 50%`). Editing one automatically sets the other to `100 - val`.
2. **Calorie Tapering Curve Inputs (% of Meal Target):**
   - 6 fine-grained percentage inputs:
     - **Zero Floor (`0%` Score)**: default `50%`
     - **Green Grace Min (`86%` Score)**: default `85%`
     - **100% Sweet Spot Min**: default `95%`
     - **100% Sweet Spot Max**: default `100%`
     - **Green Grace Max (`86%` Score)**: default `105%`
     - **Zero Ceiling (`0%` Score)**: default `140%`
3. **Protein Tapering Curve Inputs (% of Meal Target):**
   - 6 fine-grained percentage inputs:
     - **Zero Floor (`0%` Score)**: default `70%`
     - **Green Grace Min (`86%` Score)**: default `95%`
     - **100% Sweet Spot Min**: default `100%`
     - **100% Sweet Spot Max**: default `120%`
     - **Green Grace Max (`86%` Score)**: default `130%`
     - **Zero Ceiling (`0%` Score)**: default `200%`
4. **Live Interactive Tapering Preview & Reset Button:**
   - As any percentage input changes (`oninput`), a live preview table renders sample meals at `60%`, `80%`, `90%`, `98%`, `105%`, `120%`, and `145%` of target, showing the live **Calorie Score**, **Protein Score**, and **Combined Fit Score Badge** in real time.
   - Includes a **"↺ Reset Tapering to Defaults"** button.
5. **Save & Broadcast:**
   - Clicking **Save Preferences** in `SettingsView.js` reads `readFitScoreParamsFromDOM(container)` and persists `fitScoreParams` inside `userPrefs` and `preferences` to Firestore and IndexedDB, then triggers a full Fit Score refresh across all views.

---

## Acceptance Criteria

- [x] **No Page-Load Score Flicker:** `cacheSlice.js` caches full `preferences` (including `profiles` and `fitScoreParams`), and `HydrationService.js` hydrates `preferences` before `recipes`.
- [x] **Smooth Continuous Tapering Math:** The 20-point cliff drop at the Grace zone boundaries in `src/utils/macroScoringUtils.js` is eliminated; outer tapers interpolate smoothly from `0` to `85`.
- [x] **Highest Fit Score for "All Meal Types":** When the Recipe Vault is set to "All Meal Types", recipes with multiple meal types display and sort by their highest-scoring eligible meal type.
- [x] **100% Score Consistency Across Views:** A recipe's Fit Score on its Vault Card (both Original and Enhanced), inside the Recipe Detail Modal when clicking **View**, in the Today View, and in Planner Swap Modals all match for the same variant, meal type, and profile.
- [x] **Preferences Tapering Controls + Live Preview:** The Preferences tab renders the **Universal Fit Score & Tapering Rules** card with fine-grained percentage inputs for Macro Weights, Calorie Curve, and Protein Curve, a real-time preview strip, and a Reset button, persisting cleanly via `savePreferences`.
- [x] **Code Quality & Ledger Compliance:** Every created/modified file stays under the 400-line ceiling, uses no `alert()`/`confirm()`/`prompt()`, has no empty `catch` blocks, and passes all 36 checks in `scripts/test_ledger.js`.

---

## Implementation Steps

1. **Step 1 (`src/utils/fitScoreWeights.js` & `src/utils/macroScoringUtils.js`):** Add `DEFAULT_FIT_SCORE_PARAMS`, `resolveFitScoreParams()`, and fix the piecewise linear outer taper in `calculateCalorieScore` and `calculateProteinScore`.
2. **Step 2 (`src/utils/fitScoreCalculator.js`, `src/services/FitScoreService.js`, `src/components/FitScoreBadge.js`):** Support `'all'`/`'best'` meal-type evaluation (returning highest eligible meal-type score), apply custom `calorieWeightPct`/`proteinWeightPct`, and ensure explicit `'original'` default variant.
3. **Step 3 (`src/store/cacheSlice.js` & `src/services/HydrationService.js`):** Persist full `preferences` in IndexedDB and reorder hydration so `setPreferences` runs before `setRecipes`.
4. **Step 4 (`src/components/vault/VaultRecipeCard.js`, `src/views/RecipeVaultView.js`, `src/services/RecipeDetailModalService.js`, `src/views/TodayView.js`, `src/services/MealPlanGeneratorService.js`, `src/components/generator/GeneratorCandidateDrawer.js`):** Unify all callers to pass consistent `mealType`, `variant`, and `activeProfile`, and fix the 4-argument `viewRecipe` signature in `RecipeDetailModalService.js`.
5. **Step 5 (`src/components/settings/FitScoreTaperingCard.js`, `src/components/profile/ProfileSettingsModal.js`, `src/views/SettingsView.js`):** Build the fine-grained tapering controls + live preview UI and wire it into Preferences save/load.
6. **Step 6 (Verification):** Rebuild `dist/`, run syntax and Code Ledger checks (`scripts/ledger.js` & `scripts/test_ledger.js`), and verify live on `http://localhost:3000`.
