---
title: Automated Recipe Enhancement to 85+ Fit Score Engine
type: feat
date: 2026-11-01
topic: automated-recipe-enhancement-to-85-fit-score
---

# Automated Recipe Enhancement to 85+ Fit Score Engine

> Created: 2026-11-01  
> Status: Implemented  
> Plan Review: `docs/plans/reviews/2026-11-01-1945-automated-recipe-enhancement-to-85-fit-score-plan-review.md`  
> Author: Antigravity (Advanced Agentic Coding) & Elliott  

---

## 1. Summary

This plan specifies the architecture and implementation of the **Automated Recipe Enhancement Engine** in PlatePlan. The engine analyzes any recipe whose Fit Score is below 85% (Yellow, Orange, or Red tiers), calculates the exact nutritional adjustments required to meet household targets (Elliott & Chloe), and produces an **Enhanced Recipe (`recipe.enhanced`)** that achieves a **Fit Score $\ge 85\%$ (🟢 Ideal Match)**.

Key principles established in exploration & review:
1. **Hybrid Optimization:** First adjusts existing ingredient quantities (moderates cooking oils/butter, boosts primary protein, balances dry carbs); then proposes direct pantry swaps (e.g. Light Coconut Milk, 5% Lean Mince) and lean protein additions if a protein deficit remains.
2. **Preserves Recipe Structure (`ingredientSections`):** Seamlessly updates ingredients within their designated sections (e.g. *"For the Sauce"*, *"To Serve"*), maintaining both `enhanced.ingredientSections` and `enhanced.ingredients`.
3. **Culinary Quantization (`quantizeQuantity`):** Quantizes scaled numbers to natural kitchen units (e.g., grams to nearest 5g/10g; spoonfuls to 0.5; discrete items like eggs, chicken breasts, and cans to whole or half increments) to eliminate uncookable fractions like `0.72 can` or `1.3 breasts`.
4. **Target Alignment (`who` & `mealType` Aware):** Dynamically looks up target macros using the recipe's declared `mealType` (dinner, lunch, breakfast, snack) and audience (`who: 'both'`, `'elliott'`, or `'chloe'`) via `fitScoreCalculator.getTarget()`.
5. **Accessible Everywhere:** Integrated into **Recipe Wizard Step 3** (an `"⚡ Auto-Optimize to 85+ Fit"` action in the Enhanced tab) **AND** available on **existing Vault recipes** (via the Recipe Detail Modal and Vault Card action menu).
6. **Interactive Review Sheet:** A mobile-friendly bottom-sheet modal showing the **Before vs. After Fit Score** (e.g. `🔴 56% ➔ 🟢 92%`), a checklist of proposed tweaks (each toggleable on/off), and an **"Accept & Save Enhanced Variant"** button.
7. **Yield Adjustment Allowed:** If batch calories indicate the meal is severely over-portioned (>1,000 kcal/serving), the engine can suggest scaling the yield (e.g. Serves 2 $\to$ Serves 3).
8. **Zero Data Corruption:** The original recipe document is completely immutable; all alterations live strictly inside `recipe.enhanced`.

---

## 2. Problem Statement

Imported and user-authored recipes frequently fail to align with Elliott and Chloe's nutritional targets. As a result:
- Many recipes languish in the **Red (<50%)** or **Orange (50–69%)** tiers due to excessive cooking fats, high carb portions, or inadequate protein density.
- Users currently have to manually recalculate gram weights, look up products, and re-enter ingredient lines in Step 3 of the Recipe Wizard to create an enhanced variant.
- In Step 3, clicking the `"✨ Enhanced"` tab simply duplicates the original recipe identically without offering any nutritional assistance or optimization.
- Existing recipes saved in the Vault lack a one-click pathway to generate an enhanced version.

---

## 3. Prior Solutions & System Patterns

- `docs/solutions/logic-errors/universal-fit-score-drift-and-tapering-curve-20261030.md`: Core fit score formula, asymmetric tapering, and variant scoping (`original` vs `enhanced`).
- `docs/solutions/logic-errors/single-truth-recipe-yield-and-canonical-quantity-preservation-20261101.md`: Servings and canonical quantities must be preserved; modifying servings must scale nutrition per serving while preserving ingredient totals.
- `docs/solutions/logic-errors/recipe-wizard-dynamic-macros-and-packsize-normalization-20261031.md`: Resolves ingredients to pantry products and calculates line-by-line nutrition via `NutritionService.calculateItemNutrition`.
- `docs/solutions/patterns/individual/pattern-01-single-source-of-truth-for-business-logic.md`: Domain logic belongs in dedicated services (`src/services/`), not embedded inside DOM renderers.
- `docs/solutions/patterns/individual/pattern-24-batch-resource-operations.md`: Avoid serial N+1 database round-trips.

---

## 4. Architectural Design

```
+---------------------------------------------------------------------------------------+
|                              RecipeEnhancementService.js                              |
+---------------------------------------------------------------------------------------+
|  1. Target Resolver: calculates specific kcal & prot targets for recipe's who/mealType|
|  2. Role Classifier: (cooking_fat, primary_protein, starch_carb, rich_dairy, produce) |
|  3. Quantizer: quantizeQuantity(qty, unit) to realistic kitchen increments             |
|  4. Multi-Lever Heuristic Solver:                                                     |
|     - Lever 0: Yield Rebalance (>1000 kcal/serving -> suggest Serves +1)              |
|     - Lever 1: Fat Moderation (trim cooking oils/butter down to 5-10ml/serving)       |
|     - Lever 2: Protein Scaling (increase primary protein source up to 200g/serv)      |
|     - Lever 3: Carb Balancing (tune dry carbs down towards 70-80g/serv)               |
|     - Lever 4: Smart Swaps (full-fat coconut milk -> light, 20% mince -> 5% mince)    |
|     - Lever 5: Protein Booster (if prot < 25g, suggest adding edamame/tofu/chicken)   |
|  5. Section Preserver: updates ingredients within ingredientSections in-place         |
|  6. Simulation Loop: max 5 passes; terminates when predicted fit score >= 85%         |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       RecipeEnhancementModalUI.js (Interactive)                       |
+---------------------------------------------------------------------------------------+
|  - Before vs After Fit Score Badge: 🔴 54% -> 🟢 91%                                  |
|  - Macro Delta Highlights: 🔥 -310 kcal, 💪 +24g protein                              |
|  - Checkbox List of Proposed Tweaks (toggleable by user)                              |
|  - Mobile-responsive bottom sheet (max-height: 85vh, touch-scrollable)                |
|  - Action Buttons: [Cancel] [Apply to Wizard / Save to Vault]                         |
+---------------------------------------------------------------------------------------+
```

### Component 1: `src/services/RecipeEnhancementService.js` (Pure Domain Service)
Export functions:
- `resolveRecipeTargets(recipe, options)`:
  - Resolves target calories and protein using `fitScoreCalculator.getTarget(profile, type, mealType)` based on `recipe.who` (`both`, `elliott`, or `chloe`) and `recipe.mealType` / `recipe.types[0]` (defaulting to dinner).
- `classifyIngredientRole(ingredient, matchedProduct)`:
  - `cooking_fat`: Oils, butter, ghee, lard, cooking sprays.
  - `primary_protein`: Poultry, meat, fish, seafood, tofu, tempeh, seitan, eggs, high-protein pulses.
  - `starch_carb`: Rice, pasta, noodles, potatoes, bread, couscous, oats.
  - `rich_dairy_fat`: Heavy cream, coconut milk/cream, full-fat cheeses, mayonnaise.
  - `produce`: Fresh vegetables, leafy greens, mushrooms, aromatics (onions, garlic, ginger).
  - `seasoning`: Spices, salt, herbs, vinegars, soy sauce, stocks.
- `quantizeQuantity(qty, unit)`:
  - `g` / `ml`: Rounds to nearest 5 (under 100) or nearest 10 (over 100).
  - `tbsp` / `tsp`: Rounds to nearest 0.5.
  - `can` / `tin` / `pack`: Rounds to nearest 0.5 or 1.0.
  - `qty` / `piece` / `item`: Rounds to whole numbers.
- `generateEnhancementPlan(recipe, options)`:
  - Executes the multi-lever heuristic solver (capped at 5 passes).
  - Preserves `recipe.ingredientSections`.
  - Returns `{ beforeScore, predictedScore, proposedServings, adjustments: [...], enhancedRecipePayload }`.
- `applySelectedAdjustments(recipe, selectedAdjustments, options)`:
  - Applies approved adjustments into a clean `recipe.enhanced` structure conforming to `RecipeAuthoringService.js`, including `enhanced.changes` and prepended cooking notes.

### Component 2: `src/components/recipe/RecipeEnhancementModalUI.js` (Interactive UI)
- Renders a clean comparison dialog with:
  1. Header: "✨ Recipe Enhancer (Target 85+ Fit Score)"
  2. Score comparison badge: `[🔴 58%] ➔ [🟢 91% Ideal Match]`
  3. Macro crossbar before vs after:
     - Calories: `780 kcal ➔ 620 kcal (-160 kcal)`
     - Protein: `26g ➔ 45g (+19g)`
  4. Proposed changes list with checkboxes:
     - `☑ Reduce Olive Oil from 30ml to 10ml (-180 kcal)`
     - `☑ Increase Chicken Breast from 250g to 360g (+28g prot, +120 kcal)`
     - `☑ Reduce Basmati Rice from 180g to 140g (-140 kcal)`
     - `☑ Swap Coconut Milk to Light Coconut Milk (-95 kcal)`
  5. Interactive recalculation: Unchecking a box instantly re-evaluates the predicted score!
  6. Action buttons: `"Accept & Apply"` / `"Cancel"`.
  7. Mobile-first CSS styling: `.enhancement-modal-sheet { max-height: 85vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }`.

### Component 3: Integration into Recipe Wizard Step 3 (`RecipeWizardStep3View.js` & `RecipeWizardStep3Handlers.js`)
- When the user is on the `✨ Enhanced` tab in Step 3:
- Add an action button: `"⚡ Auto-Optimize to 85+ Fit"`.
- Clicking it opens `RecipeEnhancementModalUI`.
- On approval, it populates `wizardState.activeRecipe.enhanced` with the adjusted sections/ingredients, method notes, and recalculated macros, re-rendering Step 3 immediately with the green badge.

### Component 4: Integration into Recipe Detail & Vault (`RecipeDetailModalUI.js` & `VaultRecipeCard.js`)
- In `RecipeDetailModalUI.js`: If `r.enhanced` is absent or its fit score is `< 85`, render a prominent action pill: `"✨ Generate 85+ Enhanced Version"`.
- In `VaultRecipeCard.js`: In the `...` menu, add `"✨ Auto-Enhance Recipe (85+ Fit)"`.
- On approval in the modal: Calls `saveRecipe({ ...recipe, enhanced: enhancedPayload })` via `HouseholdRepository.js`, updates local store, and displays toast `"✨ Enhanced recipe saved with 92% Fit Score"`.

---

## 5. Acceptance Criteria

- [x] **AC 1 (Pure Domain Math):** `generateEnhancementPlan` evaluates a suboptimal recipe (e.g. 55% fit score) and returns adjustments that yield a predicted Fit Score $\ge 85\%$.
- [x] **AC 2 (Culinary Guardrails & Quantization):**
  - Cooking fats are never reduced below 5ml per serving.
  - Primary proteins are never scaled above 220g per serving.
  - Quantities round to natural culinary units (no `0.72 cans` or `2.13 breasts`).
  - Seasonings and vegetables are preserved.
  - Original recipe fields remain 100% immutable.
- [x] **AC 3 (Section Hierarchy Preservation):** If the input recipe has `ingredientSections`, the adjusted ingredients remain organized in their respective sections in `recipe.enhanced.ingredientSections`.
- [x] **AC 4 (Interactive Adjustment Selection):** In the Enhancement modal, toggling off an adjustment updates the predicted score live.
- [x] **AC 5 (Wizard Step 3 Integration):** Clicking `"⚡ Auto-Optimize to 85+ Fit"` in Wizard Step 3 successfully updates `recipe.enhanced` with the adjusted ingredients and displays the green fit badge.
- [x] **AC 6 (Vault & Detail Modal Integration):** Clicking `"✨ Generate 85+ Enhanced Version"` on an existing recipe saves `recipe.enhanced` to Firestore without modifying the original variant, and enables the `Original / Enhanced` tab toggle.
- [x] **AC 7 (Planner & Shopping Parity):** Meal planner swap modal allows selecting the new enhanced variant, and the shopping list uses the enhanced quantities when planned.

---

## 6. Implementation Steps

### Phase 1: Core Service (`src/services/RecipeEnhancementService.js`)
1. Create `resolveRecipeTargets()` supporting audience (`both`, `elliott`, `chloe`) and meal type.
2. Build `classifyIngredientRole()` using pantry category and ingredient name taxonomy.
3. Build `quantizeQuantity()` for culinary-realistic increments.
4. Build `generateEnhancementPlan()` implementing Levers 0–5 with a 5-pass limit and section preservation.
5. Write automated tests in `scripts/test_recipe_enhancement_service.js`.

### Phase 2: Interactive Review Modal (`src/components/recipe/RecipeEnhancementModalUI.js`)
1. Build modal template with before/after fit score badges, macro deltas, and toggleable adjustment checkboxes.
2. Wire real-time dynamic re-scoring when checkboxes are clicked.
3. Attach confirm callback that generates clean `recipe.enhanced` payload.

### Phase 3: Integration into Recipe Wizard Step 3
1. Update `RecipeWizardStep3View.js` to render the `"⚡ Auto-Optimize to 85+ Fit"` button in the Enhanced tab.
2. Update `RecipeWizardStep3Handlers.js` to open the modal and populate `wizardState.activeRecipe.enhanced`.

### Phase 4: Integration into Recipe Detail & Vault Cards
1. Add `"✨ Generate 85+ Enhanced Version"` action in `RecipeDetailModalUI.js` and `VaultRecipeCard.js`.
2. Connect to `saveRecipe()` in `HouseholdRepository.js` and store refresh.

### Phase 5: Verification & Build
1. Run all test suites: `node scripts/test_recipe_enhancement_service.js`, `test_vault_fit_score.js`, `test_shopping_list.js`.
2. Run `npm run build` to verify production bundling.
3. Push to development branch.

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Culinary Distortion** (Optimizer produces weird quantities like 2g pasta or 500g chicken) | High | Strict hard min/max bounds for every category (e.g. starch: 50–90g dry, meat: 120–220g) + `quantizeQuantity`. |
| **Section Hierarchy Eradication** | High | Explicit recursive traversal of `recipe.ingredientSections` ensuring sections are mirrored in `recipe.enhanced`. |
| **Unmapped Ingredients** (Recipe has custom ingredients without pantry product match) | Medium | Fallback to category-based macro defaults so optimization can still estimate and adjust quantities. |
| **Unattainable 85+ Target** (Dessert / Pure Fat baseline) | Medium | 5-pass solver limit with graceful fallback to best achievable score and user advisory. |
| **Original Recipe Overwrite** | Critical | Strict object isolation: only write to `recipe.enhanced`; `recipe.ingredients` and root fields are never mutated. |
| **Mobile Screen Overflow** | Medium | Mobile-first CSS bottom-sheet (`max-height: 85vh`, touch-scrolling). |
