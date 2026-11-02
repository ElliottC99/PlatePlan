---
title: Fix Recipe Wizard Dynamic Macros, Unit Conversion Weights, and Fit Score
type: fix
date: 2026-10-31
topic: recipe-wizard-dynamic-macros-fit-score
---

# Fix Recipe Wizard Dynamic Macros, Unit Conversion Weights, and Fit Score

> Created: 2026-10-31  
> Status: Implemented  
> Branch: dev/recipe-bulk-parse-instruction-fix  

## 1. Summary

Fixes the Recipe Wizard macro and fit score calculation pipeline so that all recipes—including the four batch-parsed recipes (*Poutine*, *Sausage Party Pizza*, *Cheesy Chicken Enchiladas*, and *Blackened Monk Chicken Noodles*)—accurately reflect their mapped ingredients with realistic, per-serving macros and valid Universal Fit Scores instead of identical static numbers (532 kcal / 33.1g), massive inflated numbers (6,000+ kcal), or blank neutral badges (`⚪ --`).

---

## 2. Problem Statement

1. **Step 2 to Step 3 Macro Erasure**: `RecipeWizardStep2Handlers.js` implemented a private macro recalculator that only looked for `ing.productId`. Because Step 2 ingredients store taxonomy references (`ingredientId` / `subtypeId` / `categoryId`), products were unresolved and macros were reset to `{ calories: 0, protein: 0, carbs: 0, fat: 0 }`.
2. **Hardcoded Step 3 View Fallbacks**: `RecipeWizardStep3View.js` used `activeRec.macros?.calories || activeRec.calories || 450` and `|| 28`, evaluating to `450` and `28`, which produced identical split macros (532 kcal / 33.1g and 368 kcal / 22.9g) for every single dish.
3. **`packSize` Multiplier Explosion**: `NutritionService.calculateItemNutrition` fell back to `item.packSize` for any `unit === 'qty'` / `'item'`. Unmeasured oil or items like garlic and onions multiplied by the entire supermarket pack size (1L oil bottle = 8,280 kcal; 1kg onion bag = 1,260 kcal; 200g garlic pack = 1,192 kcal).
4. **Pepper Keyword Collision & Seasoning Gaps**: In `UnitConversionService.js`, "black pepper" matched `pepper: 160` (160g bell pepper), and salt/oil without units defaulted to 100g.
5. **Blank Fit Scores**: When calories exceeded the upper ceiling ($r \ge 1.6\times$ target), `macroScoringUtils.js` returned a 0% calorie score, which caused `FitScoreBadge.js` to render a neutral `⚪ --` badge.
6. **"⚠️ Est. Weight" Residual Labels**: Leftover label text requested to be removed.

---

## 3. Acceptance Criteria

- [x] `NutritionService.calculateItemNutrition` only uses `packSize` / `drainedWeight` for container units (`pack`, `can`, `tin`). For discrete items (`qty`, `item`, `piece`), if `item.itemWeight` is missing, it delegates to `toGrams(q, u, item.name, 0)`.
- [x] `UnitConversionService.toGrams` handles seasonings (black pepper, white pepper, salt) at `0.5g` (a culinary pinch), unmeasured cooking oil at `15g` (1 tbsp / 15ml), and prevents black/white pepper from matching the 160g bell pepper entry.
- [x] `RecipeWizardStep3Handlers.js` exports `resolveProductForIngredient` (implementing direct product, subtype default, subtype product, root item default, root item product, category default, and name fuzzy matching) and an upgraded `recalculateWizardMacros`.
- [x] `RecipeWizardStep2Handlers.js` imports and uses the unified `recalculateWizardMacros`.
- [x] `RecipeWizardStep3View.js` renders real dynamic macros and dual-profile splits, removes hardcoded `450` / `28` fallbacks, and strips `(Est. Weight)`.
- [x] `RecipeWizardStep2View.js` removes the `⚠️ Est. Weight` badge.
- [x] Interactive Servings in Step 3 recalculates macros on change.
- [x] All unit and regression tests pass; `npm run build` succeeds cleanly.

---

## 4. Implementation Tasks

- [x] Task 1: Refactor `src/services/UnitConversionService.js` for seasoning and oil weights.
- [x] Task 2: Refactor `src/services/NutritionService.js` to fix `packSize` fallback.
- [x] Task 3: Upgrade `src/components/recipe/RecipeWizardStep3Handlers.js` with `resolveProductForIngredient` and robust `recalculateWizardMacros`.
- [x] Task 4: Connect `src/components/recipe/RecipeWizardStep2Handlers.js` to the unified recalculator.
- [x] Task 5: Update `src/components/recipe/RecipeWizardStep3View.js` for dynamic macro rendering and cleaning `(Est. Weight)`.
- [x] Task 6: Remove `⚠️ Est. Weight` from `src/components/recipe/RecipeWizardStep2View.js`.
- [x] Task 7: Bind Step 3 servings change event in `src/components/recipe/RecipeWizardStep3Handlers.js`.
- [x] Task 8: Run unit test suites and `npm run build`.
