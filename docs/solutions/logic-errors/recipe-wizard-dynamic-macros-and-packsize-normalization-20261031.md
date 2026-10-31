---
date: "2026-10-31"
problem_type: "logic_error"
component: "javascript_logic"
severity: "high"
symptoms:
  - "Recipe Wizard Step 3 displays identical static macros (532 kcal / 33.1g) regardless of recipe ingredients"
  - "Newly parsed recipes produce massive inflated macros (6,000+ kcal) and blank Universal Fit Scores (⚪ --)"
  - "Black pepper, white pepper, and unmeasured seasonings produce huge weights due to whole-item collisions"
  - "Unchecked packSize fallback multiplies discrete items (qty/item) by entire supermarket container packages"
  - "Residual (Est. Weight) and ⚠️ Est. Weight labels persist in Wizard Step 2 and Step 3 views"
root_cause: "incorrect_algorithm"
tags:
  - "recipe-wizard"
  - "macros"
  - "nutrition"
  - "fit-score"
  - "unit-conversion"
  - "pack-size"
related_issues: []
last_referenced: "2026-10-31"
status: "active"
---

# Recipe Wizard Dynamic Macros & PackSize Normalization

## Problem Statement

When users imported or reviewed recipes in the Recipe Wizard:
1. **Static Step 3 Macros**: Step 3 consistently displayed 532 kcal / 33.1g (Elliott) and 368 kcal / 22.9g (Chloe) across all recipes.
2. **Massive Macros & Blank Fit Scores (`⚪ --`)**: Recipes like *Poutine* or *Blackened Monk Chicken Noodles* generated 6,000+ kcal and displayed a neutral badge (`⚪ --`) instead of a color-coded fit score.
3. **Weight Collision on Seasonings**: Unmeasured seasonings (e.g. "black pepper", "sea salt") or unmeasured cooking oil defaulted to 160g (colliding with bell peppers) or multiplied against 100g/1L containers.

---

## Symptoms Observed

1. `RecipeWizardStep2Handlers.js` cleared `macros` to `{ calories: 0, protein: 0, carbs: 0, fat: 0 }` because it only looked up `ing.productId`, ignoring pantry taxonomy links (`ingredientId` / `subtypeId`).
2. `RecipeWizardStep3View.js` evaluated `activeRec.macros?.calories || activeRec.calories || 450`, falling back to 450 kcal and 28g protein for all dishes.
3. In `NutritionService.js`, `calculateItemNutrition` fell back to `item.packSize` for `qty` or `item` units when `item.itemWeight` was undefined (e.g. 1L oil bottle multiplied 8,280 kcal; 1kg onion bag multiplied 1,260 kcal).
4. In `macroScoringUtils.js`, when calories exceeded the upper target threshold ($r \ge 1.6$), the calorie score dropped to 0%. `FitScoreBadge.js` renders any score $\le 0$ as `⚪ --`.
5. Residual `(Est. Weight)` and `⚠️ Est. Weight` badges remained in Step 2 and Step 3 headers.

---

## Root Cause Analysis

1. **Taxonomy-to-Product Resolution Gap in Wizard Handlers**: Step 2 ingredients only store taxonomy identifiers (`ingredientId`, `subtypeId`, `categoryId`). Handlers attempted direct lookup by `productId`, resulting in unresolved products.
2. **Supermarket Package Size Fallback**: `packSize` (e.g. 1000g, 1000ml) represents the purchased grocery package, not the recipe portion or single-item piece size. Discrete items (`qty`, `item`, `piece`) should never fall back to `packSize` unless the unit is an explicit container (`pack`, `can`, `tin`).
3. **Keyword Collision in Unit Conversion**: `inferIngredientWeightByName` in `UnitConversionService.js` matched "black pepper" against `pepper: 160` (bell pepper).

---

## Solution Implementation

### 1. Supermarket Package Restriction in Nutrition Engine
In [`NutritionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/NutritionService.js):
- Constrained `packSize` / `drainedWeight` usage strictly to container units (`pack`, `can`, `tin`).
- For discrete items (`qty`, `item`, `piece`), if `item.itemWeight` is missing, delegate to culinary piece conversion `toGrams(q, u, item.name, 0)` rather than multiplying by the entire supermarket package.

### 2. Seasoning & Oil Culinary Fallbacks
In [`UnitConversionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/UnitConversionService.js):
- Added dedicated weights for black pepper, white pepper, sea salt, cayenne, and peppercorns at `0.5g` (pinch).
- Prevented black/white pepper from matching the 160g bell pepper entry.
- Added default culinary weight for unmeasured cooking oil ("vegetable oil, for frying") at `15g` (1 tbsp / 15ml).

### 3. Unified 5-Tier Product Resolution & Dynamic Recalculator
In [`RecipeWizardStep3Handlers.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardStep3Handlers.js):
- Exported `resolveProductForIngredient` implementing the full 5-tier resolution hierarchy:
  1. Direct product ID
  2. Subtype default product
  3. Root item default product
  4. Category default product
  5. Name fuzzy match
- Upgraded `recalculateWizardMacros` to compute dynamic per-serving calories, protein, carbs, and fat, syncing `macros`, `nutrition`, and `perServing` to prevent double-division in `calculateMealFitScore`.
- Bound live recalculation to `#wiz-rev-servings` `onchange`.

### 4. Step 2 & Step 3 Cleanup
- [`RecipeWizardStep2Handlers.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardStep2Handlers.js): Removed private recalculator and wired unified `recalculateWizardMacros`.
- [`RecipeWizardStep3View.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardStep3View.js): Removed hardcoded `450` / `28` fallbacks, enabled live dynamic split macro rendering, and stripped `(Est. Weight)`.
- [`RecipeWizardStep2View.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardStep2View.js): Removed `⚠️ Est. Weight` badges.

---

## Verification

1. All 92 unit conversion tests passed in `test_unit_conversion.js`.
2. Multi-recipe parser tests passed in `test_multi_recipe_parser.js`.
3. Standalone test suites passed (`test_shopping_list.js`, `test_recipe_importer.js`, `test_category_manager.js`, `test_ledger.js`).
4. Production build (`npm run build`) succeeded with stamped commit and version `3.52.1`.
5. Simulated parsing of the 4 user recipes confirmed realistic per-serving macros (~400–700 kcal) and non-zero fit score badges.
