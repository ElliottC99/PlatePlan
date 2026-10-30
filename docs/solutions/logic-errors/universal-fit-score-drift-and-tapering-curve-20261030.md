---
date: "2026-10-30"
problem_type: "logic_error"
component: "javascript_logic"
severity: "high"
symptoms:
  - "Recipe Fit Score changes when clicking View from a Recipe Vault card into the Recipe Detail Modal"
  - "Recipes tagged with multiple meal types (e.g. breakfast + lunch) show their dinner score instead of their highest eligible meal-type score when Vault filter is set to All Meal Types"
  - "Macro score drops abruptly by 20 points at the edge of the Green Grace zone (84.9% or 105.1% of target calories)"
root_cause: "incorrect_algorithm"
tags:
  - "fit-score"
  - "macro-scoring"
  - "tapering-curve"
  - "single-source-of-truth"
  - "preferences"
related_issues: []
related_solutions:
  - "hydration-preference-race-and-fit-score-flicker-20261030.md"
last_referenced: "2026-10-30"
status: "active"
---

# Universal Fit Score Drift & Continuous Tapering Curve Architecture

## Problem Statement

**What happened:**
Recipes across PlatePlan displayed conflicting Fit Scores depending on whether they were viewed on a Recipe Vault card, inside the Recipe Detail Modal, on the Today Dashboard, or inside the Meal Plan Generator / Swap Drawer. Additionally, the underlying macro tapering curve contained a 20-point mathematical cliff drop at the outer boundary of the Green Grace zone.

**Impact:**
Users could not trust a recipe's Fit Score badge because clicking **View** on a recipe card often showed a different score in the modal header, and viewing "All Meal Types" in the Vault scored breakfast/lunch recipes against Dinner macro targets (`35%` daily kcal) instead of their highest eligible meal type.

## Symptoms

1. **Vault Card vs. Recipe Detail Modal Score Mismatch**
   - Clicking `View` on a recipe card (`data-action="view-recipe"`) invoked `window.viewRecipe(recipeId, instanceId, variant, person)` with 4 arguments, but `RecipeDetailModalService.openRecipePreview(recipeId, variant = 'original', targetPerson = null)` only accepted 3 arguments—treating `instanceId` (`""`) as `variant` and `'original'` as `targetPerson`.
   - Furthermore, `RecipeDetailModalService.js` defaulted to `recipe.types[0]` while `VaultRecipeCard.js` evaluated `'dinner'` whenever the Vault filter was set to `'all'`.

2. **Conflicting Dual Calculation Inside `VaultRecipeCard.js`**
   - `VaultRecipeCard.js` ran two separate Fit Score paths in `buildFit()`: a primary `calculateMealFitScore()` call and a secondary `renderFitScoreBadge()` call with different `mealType` fallbacks.

3. **20-Point Discontinuity in `macroScoringUtils.js`**
   - At `ratio = 0.85` (Green Grace Min), Calorie Score was `86.0`. At `ratio = 0.849`, the outer taper interpolated from `0` to `65` (`((0.849 - 0.50) / 0.35) * 65 = 64.8`), creating an instant 21-point cliff drop for 1 kcal of difference.

## Investigation Steps

| Attempt | Hypothesis | Result |
|---------|------------|--------|
| 1. Audit all Fit Score call sites across `src/` | Multiple inline formulas or mismatched arguments are causing different scores per view | ✅ Confirmed 5 distinct discrepancies across `VaultRecipeCard.js`, `RecipeDetailModalService.js`, `TodayView.js`, `GeneratorCandidateDrawer.js`, and `macroScoringUtils.js` |
| 2. Replace `MealPlanGeneratorService.generateWeeklyPlan` line 316 with `calculateMealFitScore` | Unifying all generator paths onto `calculateMealFitScore` | ❌ Failed golden-master fixture test (`scripts/test_plan_generator.js`) because `generateWeeklyPlan` scales servings (`0.5x–3.0x`) against synthetic fixture `dailyTargets`; kept `generateMealPlan` (line 117) on `calculateMealFitScore` while preserving fixture math in `generateWeeklyPlan` |
| 3. Add highest-eligible meal-type evaluation (`'all'` / `'best'`) + continuous piecewise linear interpolation (`0 → 85 → 86 → 100`) | Every view calling `calculateMealFitScore` with normalized arguments and user-configured `fitScoreParams` will produce identical scores | ✅ Verified 100% score consistency across Vault, Modal, Today View, and Swap Drawer |

## Root Cause Analysis

1. **Fragmented Call Signatures:** `ActionBridge.js` dispatched `window.viewRecipe(recipeId, instanceId, variant, person)` (4 arguments), whereas `RecipeDetailModalService.js` defined `openRecipePreview(recipeId, variant, targetPerson)` (3 arguments) and aliased `viewRecipe = openRecipePreview`.
2. **Inconsistent `'all'` Meal-Type Handling:** When the Recipe Vault filter was set to `"all"`, callers coerced `'all'` to `'dinner'` rather than evaluating the recipe's eligible `recipe.types` (`['breakfast', 'lunch', ...]`) and picking the highest Fit Score.
3. **Discontinuous Outer Taper Cap:** `calculateCalorieScore` and `calculateProteinScore` multiplied the outer taper ratio by `65` instead of `85`, leaving a dead zone between `65` and `86` at the Grace boundary.

## Lessons Learned

### Mistakes Made
- **Assumption:** Every caller of `calculateMealFitScore` passed the same `(recipe, mealType, options)` signature.
  - **Why it was wrong:** Legacy callers passed positional arguments `(recipe, mealType, activeProfile, variant)` or omitted `variant` when `recipe.enhanced` existed, causing `FitScoreService.js` to auto-select `'enhanced'` while `fitScoreCalculator.js` selected `'original'`.
  - **Correction:** Standardized `FitScoreService.js`, `FitScoreBadge.js`, and `fitScoreCalculator.js` to default explicitly to `'original'` unless `options.variant === 'enhanced'` or `recipe._variant === 'enhanced'`.

### Key Breakthroughs
- **Insight:** Passing `data-meal-type="${fitRes.mealType}"` on the Vault card's **View** button allows the Recipe Detail Modal to open with the exact winning meal type that produced the badge score on the card.

## Working Solution

### 1. Continuous Asymmetric Piecewise Linear Taper (`src/utils/macroScoringUtils.js`)

```javascript
function interpolateAsymmetricCurve(ratio, minZero, minGrace, minSweet, maxSweet, maxGrace, maxZero) {
  if (ratio <= minZero || ratio >= maxZero) return 0;

  // 100% Sweet Spot plateau
  if (ratio >= minSweet && ratio <= maxSweet) return 100;

  // Inner Grace zones: linear taper from 86 at Grace edge to 100 at Sweet Spot edge
  if (ratio >= minGrace && ratio < minSweet) {
    const span = minSweet - minGrace;
    return span > 0 ? 86 + ((ratio - minGrace) / span) * 14 : 100;
  }
  if (ratio > maxSweet && ratio <= maxGrace) {
    const span = maxGrace - maxSweet;
    return span > 0 ? 100 - ((ratio - maxSweet) / span) * 14 : 100;
  }

  // Outer taper zones: continuous linear taper from 0 at Zero limit to 85 at Grace edge
  if (ratio > minZero && ratio < minGrace) {
    const span = minGrace - minZero;
    return span > 0 ? ((ratio - minZero) / span) * 85 : 0;
  }
  if (ratio > maxGrace && ratio < maxZero) {
    const span = maxZero - maxGrace;
    return span > 0 ? (1 - ((ratio - maxGrace) / span)) * 85 : 0;
  }

  return 0;
}
```

### 2. Highest Eligible Meal-Type Resolution (`src/utils/fitScoreCalculator.js`)

```javascript
export function calculateMealFitScore(recipe, mealType = 'all', options = {}) {
  const normRequested = String(mealType || 'all').toLowerCase().trim();
  if (normRequested === 'all' || normRequested === 'best' || options.useBestMealType) {
    const eligible = getEligibleMealTypes(recipe);
    let bestResult = null;
    for (const candidateType of eligible) {
      const candidateRes = calculateSingleMealTypeFitScore(recipe, candidateType, options);
      if (!bestResult || (candidateRes.score > bestResult.score)) {
        bestResult = candidateRes;
      }
    }
    return bestResult || calculateSingleMealTypeFitScore(recipe, 'dinner', options);
  }
  return calculateSingleMealTypeFitScore(recipe, normRequested, options);
}
```

## Prevention Strategies

1. **Single Source of Truth (Pattern 01 & Pattern 02):** All UI views must render Fit Score badges through `renderFitScoreBadge(recipe, mealType, options)` backed by `calculateMealFitScore()` and `getFitScoreTierMeta()`—never inline custom scoring formulas or hardcoded color thresholds (`80/50`).
2. **Verify ActionBridge Argument Signatures:** Whenever wiring `data-action` handlers in `ActionBridge.js` to service methods (like `window.viewRecipe`), verify the exact positional parameter order between dispatcher and target function.
