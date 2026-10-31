---
title: Single-Truth Recipe Servings Architecture & Retroactive Macro Recalibration
type: refactor
date: 2026-10-31
topic: single-truth-recipe-servings-and-macro-recalibration
---

# Single-Truth Recipe Servings Architecture & Retroactive Macro Recalibration

> Created: 2026-10-31  
> Status: Draft  
> Branch: dev/recipe-bulk-parse-instruction-fix  

---

## 1. Executive Summary

PlatePlan currently splits servings across three conflicting fields: `baseServings`, `currentServings`, and `targetServings`. This leads to:
1. **Destructive Mutation**: Step 2 physically scales down author ingredient quantities in the database (`item.qty = scaledQty`), breaking the relationship with original method steps (e.g. method says *"divide into 8 pizza balls"*, but flour was reduced to 2 balls).
2. **Double-Scaling & Macro Volatility**: Step 3 has an independent `Servings` input that can divide already-scaled ingredients, causing severe macro distortions.
3. **Ghost State Drift**: `currentServings` is dead weight from legacy form iterations.

This plan refactors the Recipe Wizard and macro engine to a **Single-Truth Recipe Servings model**:
- Every recipe stores **one immutable author yield**: `recipe.servings`.
- Ingredients in the database **always retain their unscaled, canonical author amounts**.
- Scaling for cooking sessions (e.g. Elliott & Chloe cooking 2 portions from a 4-serving recipe) occurs **dynamically on read** in the Recipe Detail Modal, Planner, and Shopping List.
- A **retroactive recalibration routine** is provided to recalculate macros and fit scores for all existing recipes in the household collection.

---

## 2. Requirements & Acceptance Criteria

### A. Recipe Wizard Simplification
- [ ] **Remove `currentServings`**: Completely purge `currentServings` from `RecipeWizardState.js`, `RecipeWizardViews.js`, `RecipeWizardStep1Handlers.js`, and `RecipeWizardModal.js`.
- [ ] **Single Yield Input in Step 1**: Step 1A (Manual Form) features a single input: `Recipe Yield (Servings)`. Default to parsed value or 4.
- [ ] **Non-Destructive Step 2 Mapping**: Step 2 displays the author's yield (`Yield: X servings`) without mutating ingredient quantities into `scaledQty`. The input values remain the true recipe quantities.
- [ ] **Unified Servings in Step 3**: Step 3 displays and edits the canonical `recipe.servings`. Changing it immediately recalibrates macros:
  $$\text{Calories Per Serving} = \frac{\sum (\text{canonical ingredient qty} \times \text{product kcal})}{\text{recipe.servings}}$$
- [ ] **Deterministic Dual-Profile Split**: Step 3 crossbar shows the exact dinner split for 2 people:
  - Total dinner cooked = 2 portions.
  - **Elliott** ($59\%$ of 2 portions = 1.18 portions): $\text{Calories Per Serving} \times 1.18$.
  - **Chloe** ($41\%$ of 2 portions = 0.82 portions): $\text{Calories Per Serving} \times 0.82$.
- [ ] **Canonical Persistence**: `onSaveRecipe` writes unscaled `qty` into Firestore and sets `servings: safeServings`. Does not save `targetServings` or `baseServings`.

### B. Dynamic Runtime Scaling
- [ ] In `RecipeDetailModalService.js`:
  - "Shared (2)" scales by $\frac{2}{\text{recipe.servings}}$.
  - "Elliott (1)" scales by $\frac{1.18}{\text{recipe.servings}}$.
  - "Chloe (1)" scales by $\frac{0.82}{\text{recipe.servings}}$.
- [ ] In `ShoppingListService.js`:
  - Shopping multiplier continues to calculate $\frac{\text{meal.servings}}{\text{recipe.servings}}$.

### C. Retroactive Recalibration for Existing Recipes
- [ ] Implement `batchRecalibrateAllHouseholdRecipes()` in `RecipeFirestoreRepository.js` / `DataQualityScannerService.js`.
- [ ] Expose an action button in Data Quality / Settings (or executable script) to sweep all existing recipes in `households/elliott-chloe/recipes`, recalibrating their macros and fit scores against the new product-first, drained-weight engine.

---

## 3. Implementation Plan

### Phase 1: State & Step 1 Cleanup
**Target Files**:
- `src/components/recipe/RecipeWizardState.js`
- `src/components/recipe/RecipeWizardViews.js`
- `src/components/recipe/RecipeWizardStep1Handlers.js`
- `src/components/recipe/RecipeWizardModal.js`

1. In `RecipeWizardState.js`:
   - Initialize `activeRecipe.servings = 4`.
   - Remove `currentServings` and `targetServings` initializers and cleanup calls.
2. In `RecipeWizardViews.js` (`renderState1AManual`):
   - Replace the two inputs `Current Servings` and `Target Servings` with:
     ```html
     <div>
       <label for="wiz-servings" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Recipe Yield (Servings)</label>
       <input type="number" id="wiz-servings" name="servings" value="${recipe.servings || 4}" min="1" max="50" style="..." />
     </div>
     ```
3. In `RecipeWizardStep1Handlers.js`:
   - Read `#wiz-servings`. Assign directly to `wizardState.activeRecipe.servings`.

### Phase 2: Non-Destructive Step 2 Mapping
**Target Files**:
- `src/components/recipe/RecipeWizardStep2View.js`
- `src/components/recipe/RecipeWizardStep2Handlers.js`

1. In `RecipeWizardStep2View.js`:
   - Replace `#wiz-scaling-banner` with a clean informational header:
     ```html
     <div style="background: var(--purple-bg, #eef2ff); border: 1px solid rgba(79,70,229,0.2); padding: 8px 14px; border-radius: 8px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
       <span style="font-size: 13px; font-weight: 600; color: var(--purple, #4f46e5);">Recipe Mapping</span>
       <span style="font-size: 12px; color: var(--text2, #666);">Yield: <strong>${recipe.servings || 4} servings</strong></span>
     </div>
     ```
   - Ingredient quantities rendered in rows strictly use `item.qty` (canonical author amount).
2. In `RecipeWizardStep2Handlers.js`:
   - Remove `updateServingsScale` and DOM quantity mutation loops.
   - When users edit quantities in the table, they are editing the canonical recipe quantities.

### Phase 3: Step 3 Review & Persistence Normalization
**Target Files**:
- `src/components/recipe/RecipeWizardStep3View.js`
- `src/components/recipe/RecipeWizardStep3Handlers.js`

1. In `RecipeWizardStep3Handlers.js`:
   - `recalculateWizardMacros`:
     ```javascript
     const serves = Number(recipeObj.servings || recipeObj.serves || 4) || 4;
     allIngredients.forEach(item => {
       const qty = Number(item.qty ?? item.amount ?? 1) || 1;
       const nut = calcFn(matchedProduct, qty, item.unit || 'g');
       totalCal += nut.kcal;
       totalProt += nut.protein;
       totalCarb += nut.carbs;
       totalFat += nut.fat;
     });
     const perServing = {
       calories: Math.round(totalCal / serves),
       protein: Math.round((totalProt / serves) * 10) / 10,
       carbs: Math.round((totalCarb / serves) * 10) / 10,
       fat: Math.round((totalFat / serves) * 10) / 10
     };
     ```
   - In `onSaveRecipe`:
     - Read `#tp-serving-size`. Assign to `rec.servings = safeServings` and `rec.serves = safeServings`.
     - Save `ingredients: rec.ingredients.map(i => ({ name: i.name, qty: i.qty, unit: i.unit, ... }))`.
     - Remove `targetServings` and `baseServings` from the saved Firestore document.
2. In `RecipeWizardStep3View.js`:
   - Render `Dual-Profile Per-Portion Split (${recipe.servings} servings)`:
     $$\text{Elliott} = \text{baselineCal} \times 2 \times 0.59$$
     $$\text{Chloe} = \text{baselineCal} \times 2 \times 0.41$$

### Phase 4: Retroactive Database Recalibration
**Target Files**:
- `src/services/RecipeFirestoreRepository.js`
- `scripts/recalibrate_all_recipes.js`

1. Implement `batchRecalibrateAllHouseholdRecipes()`:
   - Fetches all recipes for `households/elliott-chloe/recipes`.
   - Iterates through each recipe, resolves linked products from state, and recalculates `macros` and `fitScore` using the new product-first logic.
   - Batch writes the updated `macros`, `fitScore`, and cleaned `servings` back to Firestore.
2. Provide a standalone Node script `scripts/recalibrate_all_recipes.js` (or trigger in Data Quality view) so Elliott can execute the migration safely anytime.

---

## 4. Verification & Testing Strategy

1. **Unit Tests**:
   - Verify `scripts/test_unit_conversion.js` and `scripts/test_multi_recipe_parser.js` pass.
   - Verify `scripts/test_shopping_list.js` passes with canonical scaling ($2/4 = 0.5x$).
2. **Wizard Integration Simulation**:
   - Parse *Sausage Party Pizza* (8 servings): verify total calories $\approx 6,800$ kcal $\rightarrow$ 850 kcal per serving.
   - In Step 3: verify Elliott shows $\approx 1,003$ kcal ($1.18$ portions) and Chloe shows $\approx 697$ kcal ($0.82$ portions).
   - Save recipe: verify saved document has `servings: 8` and canonical unscaled ingredients (1,000g flour, 8 sausages).
   - In Planner: plan for 2 servings $\rightarrow$ shopping list buys $0.25x$ (250g flour, 2 sausages).
3. **Code Ledger**:
   - Run `npm run ledger` to ensure zero dead shims and intact references.
4. **Build**:
   - `npm run build` succeeds and stamps `dist/`.

---

## 5. Rollback Strategy

All changes are confined to git branch `dev/recipe-bulk-parse-instruction-fix`. If unexpected issues arise, we can revert via `git revert` or reset back to commit `a470bab`.
