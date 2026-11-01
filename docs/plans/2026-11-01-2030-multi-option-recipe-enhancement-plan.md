---
title: Multi-Route Recipe Enhancement to 85+ Fit Score
type: feat
date: 2026-11-01
topic: recipe-enhancement-routes
---

# Multi-Route Recipe Enhancement to 85+ Fit Score

> Created: 2026-11-01
> Status: Approved ✓ (Reviewed 2026-11-01)

## Summary
Refactor the automated recipe enhancement engine (`RecipeEnhancementService`) and Apple HIG modal (`RecipeEnhancementModalUI`) to generate **alternative routes that achieve the exact same nutritional target ($\ge 85\%$ Fit Score)**. Instead of altering the character of the recipe with disparate themes, the optimizer provides 2–3 different culinary routes (e.g. Route 1: via ingredient swaps, Route 2: via portion scaling, Route 3: via balanced hybrid) that all arrive at the same destination: meeting household calorie and protein goals.

---

## Problem Statement & User Intent
When optimizing a recipe (e.g. "Smashed Brooklyn Burgers" or "Crispy Chicken Kimchi Caesar Salad"), the target destination is fixed: **achieve $\ge 85\%$ Fit Score for the household profile**.

However, there is more than one path to reach that exact nutritional target:
1. **Route 1 (Pantry Swaps)**: Keep the original portions unchanged (e.g., 2 burger patties), and reach the macro target entirely by swapping high-fat items to their leaner counterparts (e.g., 5% lean beef patties, reduced-fat cheese).
2. **Route 2 (Portion / Quantity Scaling)**: Keep the original ingredients unchanged (no swaps), and reach the macro target by scaling protein quantity (e.g., 2 patties ➔ 4 patties) while moderating cooking fat or balancing carbs.
3. **Route 3 (Balanced Hybrid)**: A moderate blend (e.g., 2 patties ➔ 3 patties plus light cheese swap) that balances portion satisfaction and calorie lightness.

The user does not want divergent or artificial concepts (like inserting tofu or beans where they don't belong). The goal is identical across all options: **the same household target, reached via different routes**.

---

## Architectural & Algorithmic Design

### 1. Unified Goal Specification
Each recipe enhancement run resolves an identical, immutable target:
* Target Kcal (e.g. $656\text{ kcal}$)
* Target Protein (e.g. $43\text{g}$)
* Fit Score Goal: $\ge 85\%$ (Ideal Match)

### 2. The Three Routes to the Same Goal

#### Route 1: "Via Pantry Swaps" (Portion-Preserved)
* **Strategy**: Fixes quantities to original servings/pieces; relies entirely on Lever 4 (Smart Swaps) and Lever 1 (Cooking Fat Moderation).
* **When Applicable**: When recipe contains swappable ingredients (beef/mince ➔ 5% lean, regular cheese ➔ reduced fat, coconut milk ➔ light coconut milk, regular mayo ➔ light mayo).
* **Destination**: Hitting $\ge 85\%$ Fit Score purely through product choices without altering portion counts.

#### Route 2: "Via Portion Scaling" (Ingredient-Preserved)
* **Strategy**: Avoids ingredient swaps; reaches the protein target by scaling the primary protein (Lever 2), while moderating cooking oil (Lever 1) or trimming starches (Lever 3) so calories stay in the optimal window.
* **When Applicable**: When the user prefers to use their existing staple ingredients as-is, but is willing to eat an extra patty or larger fillet.
* **Destination**: Hitting $\ge 85\%$ Fit Score purely through portion adjustments.

#### Route 3: "Via Balanced Hybrid" (Swaps + Portions)
* **Strategy**: Applies a gentle portion increase (e.g. 1 extra discrete item or $+25\%$ protein) combined with a primary lean swap, preventing extreme portion bulk or extreme swap reliance.
* **Destination**: Hitting $\ge 85\%$ Fit Score with minimal disruption to taste and volume.

### 3. Route Evaluation & Pruning Pipeline
1. For each candidate route ($R_1, R_2, R_3$):
   - Evaluate adjustments against a deep clone of the recipe's ingredients.
   - Calculate resulting macros: `finalMacros`.
   - Compute fit score using `calculateMealFitScore(simulatedRecipe, mealType, options)`.
   - Attach `preTaxonomy` and `postTaxonomy` (`Category / Root Item / Sub-type`) and linked products to every adjustment.
2. **Pruning & Qualification**:
   - Filter: Only keep routes where `predictedScore >= 85` (or reaches the green Ideal Match tier).
   - De-duplicate: If Route 2 and Route 3 generate the exact same adjustment list, drop the duplicate.
   - Sort: Rank routes by predicted score (highest first).
3. **Fallback & Parity**:
   - If only 1 route reaches $\ge 85\%$, present that single route cleanly.
   - Spread the top route on the root of the plan object (`{ ...primaryRoute, routes: [...], selectedRouteId: primaryRoute.id }`) for 100% backward compatibility.

---

## UI / UX Design in `RecipeEnhancementModalUI`

### Apple HIG Route Selector Bar
When multiple routes qualify (`routes.length > 1`), display an Apple HIG segmented control right under the modal header:

```
[ 🔄 Route 1: Via Swaps (96%) ]   [ ⚖️ Route 2: Via Portions (87%) ]   [ ✨ Route 3: Balanced (98%) ]
```

* **Interactive Switch**: Clicking a route pill immediately switches the displayed adjustment checklist, target impacts ($\Delta\text{kcal}$, $\Delta\text{protein}$), pre/post taxonomy comparison cards, and predicted fit score badge.
* **Visual Clarity**: Each route displays a clean description:
  - *Route 1*: "Reaches goal by substituting leaner ingredients while preserving original quantities."
  - *Route 2*: "Reaches goal by scaling protein portion while keeping original ingredients."
  - *Route 3*: "Reaches goal with a balanced combination of portion scaling and lean swaps."
* **Acceptance**: Clicking "Accept & Apply Enhanced Variant" saves strictly the selected route's `enhancedRecipePayload` into `recipe.enhanced`.

---

## Acceptance Criteria
- [ ] `generateEnhancementPlan` evaluates Route 1 (Swaps), Route 2 (Portions), and Route 3 (Hybrid), all aiming for the exact same target macros and $\ge 85\%$ Fit Score.
- [ ] No artificial or irrelevant ingredients (no tofu/beans forced into burger or pasta dishes unless present in recipe).
- [ ] Only routes achieving $\ge 85\%$ Fit Score are returned in `plan.routes`.
- [ ] `RecipeEnhancementModalUI` renders an Apple HIG segmented control when multiple routes exist.
- [ ] Switching routes updates the checklist, macro deltas, and pre/post taxonomy (`Category / Root Item / Sub-type` and linked product) in real time.
- [ ] Toggling checkboxes within a route recalculates that route's live fit score.
- [ ] 100% backward compatible: `plan.adjustments`, `plan.predictedScore`, and `plan.enhancedRecipePayload` point to the default/first route.
- [ ] Unit tests verify multi-route generation on both burger and curry recipes.
- [ ] Full regression suite passes and production build compiles cleanly.

---

## Implementation Steps
1. **Refactor `src/services/RecipeEnhancementService.js`**:
   - Implement `buildSwapsRoute`, `buildPortionsRoute`, and `buildHybridRoute`.
   - Aggregate, validate $\ge 85\%$, de-duplicate, and return `{ selectedRouteId, routes, ...primaryRoute }`.
2. **Update `src/components/recipe/RecipeEnhancementModalUI.js`**:
   - Add Apple HIG route segmented picker (`.enh-route-picker`).
   - Wire route switching and isolated checkbox recalculation.
3. **Expand Test Suite (`scripts/test_recipe_enhancement_service.js`)**:
   - Test that multiple routes reaching the same goal are generated, verified $\ge 85\%$, and expose full pre/post taxonomy.
4. **Verification & Commit**:
   - Run tests, compile with `npm run build`, push to git.
