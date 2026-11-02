# Implementation Plan: Auto-Default Strategy Alignment & Recipe Macro Recalibration

> Date: 2026-11-02  
> Status: Approved ✓  
> Topic: auto-default-protein-density-and-recipe-recalculation  
> Target Files:  
> - `src/services/HydrationService.js`  
> - `src/services/PreferenceRepository.js`  
> - `src/services/PantryHierarchyService.js`  
> - `src/models/PantryHierarchyModel.js`  
> - `src/components/settings/DietaryExclusionManager.js`  
> - `src/views/SettingsView.js`  
> - `src/services/MaintenanceService.js`  
> - `scripts/test_auto_default_and_recipe_recalculation.js`  

---

## 0. Prior Solutions & Critical Patterns

- **Prior Solution**: [`docs/solutions/logic-errors/energy-unit-kj-normalization-and-auto-default-recalibration-20261101.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/solutions/logic-errors/energy-unit-kj-normalization-and-auto-default-recalibration-20261101.md)
  - Established two-item comparator sorting `[...matchedProducts].sort((a, b) => compareProductsByStrategy(a, b, criterion))`.
- **Prior Solution**: [`docs/solutions/logic-errors/single-truth-recipe-yield-and-canonical-quantity-preservation-20261101.md`](file:///Users/elliottcallender/Downloads/PlatePlan-main/docs/solutions/logic-errors/single-truth-recipe-yield-and-canonical-quantity-preservation-20261101.md)
  - Governs single source of truth for recipe yields and canonical ingredient parsing.
- **Critical Pattern**: Pattern #9 (Rigorous Planning & Multi-Order Thinking) and Pattern #10 (Atomic State Transitions).

---

## 1. Problem Statement

1. **Auto-Default Strategy Mismatch**:
   - The user expects the default product selection strategy to be **"Highest Protein Density"** (`highest_protein_per_kcal`), but the system defaults to `'lowest_absolute_price'` because legacy keys (`productPriority: "protein_per_kcal"`, `autoMappingStrategy: "protein_per_kcal"`) are not aliased during hydration, and four fallbacks hardcode `'lowest_absolute_price'`.
   - `PreferenceRepository.whitelistPreferences` strips `autoDefaultStrategy` on top-level preference writes.
2. **Auto-Default Resolution Precedence Flaw**:
   - `resolveDefaultProduct()` prioritizes any product with `isAutoDefault: true` *before* checking the ingredient's assigned `defaultProductId` and *before* sorting by strategy.
   - When "Recalibrate All Defaults" runs, it updates `ing.defaultProductId` but does not synchronize `isAutoDefault` on `products`, causing legacy flags to continue hijacking default resolution.
3. **Recipes Do Not Auto-Update**:
   - Recipes in Firestore store static nutrition and macro snapshots (`recipe.nutrition`, `recipe.macros`).
   - 96% of recipe ingredients have hardcoded `productId`s, pinning them to old products.
   - There is no mechanism to propagate optimal default products into recipe nutrition, leaving 94+ recipes displaying outdated calories, protein, and fit scores (e.g. `Sausage Potato Bake` at 1,186 kcal instead of 738 kcal).

---

## 2. Proposed Architecture & Solution

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. PREFERENCE ALIGNMENT                         │
│  HydrationService / DietaryExclusionManager                            │
│  - Alias legacy userPrefs.productPriority / autoMappingStrategy        │
│  - Default fallback: 'highest_protein_per_kcal' (was price)            │
│  - Whitelist autoDefaultStrategy in PreferenceRepository               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   2. PANTRY AUTO-DEFAULT SYNCHRONIZATION               │
│  PantryHierarchyService / HydrationService                             │
│  - ing.defaultProductId takes precedence over legacy isAutoDefault     │
│  - sweepAndRecalibrateIngredientDefaults() atomically updates BOTH:    │
│      a) ing.defaultProductId on ingredients                            │
│      b) p.isAutoDefault (true on best, false on siblings) on products │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                3. RECIPE MACRO RECALIBRATION ENGINE                    │
│  MaintenanceService.recalculateAllRecipeMacros()                       │
│  - Iterates Vault recipes                                              │
│  - Re-evaluates unpinned ingredients against optimal default products  │
│  - Re-calculates recipe.nutrition, recipe.macros, and fitScore         │
│  - Commits atomic batch to Firestore & updates reactive store          │
│  - Exposed via Settings: "⚡ Recalibrate Recipe Macros from Defaults"  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Acceptance Criteria

- [ ] **AC 1 (Preference Fallback)**: If no explicit strategy is in Firestore, the app defaults to `'highest_protein_per_kcal'` (Highest Protein Density), not `'lowest_absolute_price'`.
- [ ] **AC 2 (Legacy Aliasing)**: Legacy `userPrefs.productPriority: "protein_per_kcal"` and `autoMappingStrategy: "protein_per_kcal"` are seamlessly mapped to `autoDefaultStrategy` during hydration.
- [ ] **AC 3 (Whitelisting)**: `whitelistPreferences` preserves `autoDefaultStrategy` and `autoDefaultCriterion`.
- [ ] **AC 4 (Precedence Resolution)**: `resolveDefaultProduct` respects `item.defaultProductId` and the active strategy over stale sibling `isAutoDefault` flags.
- [ ] **AC 5 (Product Flag Sync)**: `sweepAndRecalibrateIngredientDefaults` sets `isAutoDefault: true` on the winning product and `isAutoDefault: false` on sibling products in the product bank, committing changes to Firestore and Store.
- [ ] **AC 6 (Recipe Macro Recalibration Engine)**: `recalculateAllRecipeMacros(options)` re-evaluates all recipes using optimal default products, updates `recipe.nutrition`, `recipe.macros`, and `recipe.fitScore`, and commits via `batchUpdateRecipesInDb`.
- [ ] **AC 7 (Settings Integration)**: Settings UI displays the active strategy as "Highest Protein Density" and provides a one-click button: `⚡ Recalibrate Recipe Macros from Optimal Defaults`.
- [ ] **AC 8 (Zero Regressions)**: All existing test suites pass.

---

## 4. Multi-Order Consequences & Edge Cases

- **1st Order**: Changing the default strategy shifts 41 pantry ingredients to higher-protein, lower-calorie products (e.g. Linda McCartney Sausages: 17g P / 123 kcal vs 8.7g P / 148 kcal).
- **2nd Order**: Recalibrating recipes aligns 94 recipes with their optimal defaults, increasing average recipe fit scores into the 85%+ green tier and dropping inflated calorie counts (e.g. Crispy Wings normalized from 12,365 kcal to 646 kcal).
- **3rd Order**: Meal planner generates healthier weekly schedules that hit Elliott & Chloe's exact daily targets with fewer portion-penalty adjustments.
- **Edge Case - Pinned Overrides**: If a recipe ingredient was explicitly customized by the user (indicated by a non-default product or user flag), recalibration preserves custom ingredients while updating generic mappings.
- **Edge Case - Offline / Missing DB**: Batch updates degrade gracefully to in-memory store updates without crashing if offline.

---

## 5. Step-by-Step Implementation Tasks

### Task 1: Update System Default & Whitelisting
- **Files**:
  - `src/services/PreferenceRepository.js`: Add `'autoDefaultStrategy'`, `'autoDefaultCriterion'` to `allowedKeys` in `whitelistPreferences`.
  - `src/services/HydrationService.js`:
    - In `sweepAndRecalibrateIngredientDefaults`: Default `criterion` to `'highest_protein_per_kcal'`.
    - In hydration listener: Read `strat = userPrefs.autoDefaultStrategy || userPrefs.autoDefaultCriterion || userPrefs.productPriority || userPrefs.autoMappingStrategy || 'highest_protein_per_kcal'`.
  - `src/components/settings/DietaryExclusionManager.js`: Default `autoDefaultCriterion` to `'highest_protein_per_kcal'`.
  - `src/services/PantryHierarchyService.js`: Default fallback in `compareProductsByStrategy` and `resolveDefaultProduct` to `'highest_protein_per_kcal'`.

### Task 2: Fix Auto-Default Resolution & Product Flag Synchronization
- **Files**:
  - `src/services/PantryHierarchyService.js` & `src/models/PantryHierarchyModel.js`:
    - Update `resolveDefaultProduct(item, products)`:
      1. Check `item.defaultProductId` first.
      2. If not found or product deleted, sort candidates by active strategy (`highest_protein_per_kcal`).
      3. Return best product with `isAutoDefault: true`.
  - `src/services/HydrationService.js`:
    - In `sweepAndRecalibrateIngredientDefaults()`:
      - Update `bestProduct.isAutoDefault = true`.
      - Update sibling products under the same ingredient/subtype to `isAutoDefault = false`.
      - Persist changed products via `ProductRepository.saveProduct` / `batchUpdate`.

### Task 3: Build Recipe Macro Recalibration Engine
- **Files**:
  - `src/services/MaintenanceService.js`:
    - Implement `recalculateAllRecipeMacros(options = {})`:
      1. Loads all recipes from Store.
      2. For each recipe, resolves ingredients against current optimal default products.
      3. Recalculates total calories, protein, carbs, fat using `NutritionService.calculateItemNutrition`.
      4. Normalizes per-serving macros and recalculates live `calculateMealFitScore`.
      5. Updates in-memory Store via `setRecipes()`.
      6. Commits updates to Firestore using `batchUpdateRecipesInDb(updates)`.
      7. Returns `{ success: true, updatedCount, details }`.

### Task 4: Expose Recalibration in Settings UI
- **Files**:
  - `src/components/settings/DietaryExclusionManager.js`:
    - Add button: `⚡ Recalibrate Recipe Macros from Optimal Defaults` beside the strategy dropdown.
  - `src/views/SettingsView.js`:
    - Implement `window.handleManualRecalibrateRecipeMacros()`.
    - Shows progress toast and updates UI.

### Task 5: Automated Testing & Verification
- **Files**:
  - Create `scripts/test_auto_default_and_recipe_recalculation.js`:
    1. Tests that default strategy is `'highest_protein_per_kcal'`.
    2. Tests that legacy `productPriority: "protein_per_kcal"` hydrates correctly.
    3. Tests that `resolveDefaultProduct` picks higher-protein product (Linda McCartney over standard sausage).
    4. Tests that `sweepAndRecalibrateIngredientDefaults` updates product `isAutoDefault` flags.
    5. Tests that `recalculateAllRecipeMacros` recalculates recipe calories/protein accurately and adjusts fit scores.
  - Run all core regression tests (`test_shopping_servings_multiplier.js`, `test_planner_wizard_pipeline.js`, `test_recipe_enhancement_service.js`, `test_ledger.js`).
  - Run `npm run build` to stamp `dist/`.

---

## 6. Verification Checklist
- [ ] Strategy defaults to "Highest Protein Density" on clean load.
- [ ] Changing strategy in Settings persists to Firestore without being stripped.
- [ ] Linda McCartney Sausages / Light Mayonnaise / Lighter Halloumi resolve as default products.
- [ ] Tapping "Recalibrate Recipe Macros" updates Vault recipe cards with optimized calories, protein, and fit scores.
- [ ] Full automated test suite passes.
