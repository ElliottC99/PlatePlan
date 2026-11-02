---
title: Quantity-Focused Recipe Auto-Enhance with Interactive Learned Swaps
type: feat
date: 2026-11-01
topic: recipe-auto-enhancement
---

# Quantity-Focused Recipe Auto-Enhance with Interactive Learned Swaps

> Created: 2026-11-01
> Status: Approved ✓ (Reviewed 2026-11-01)

## Summary
Refactor the Recipe Auto-Enhancement system to prioritize **pure culinary quantity adjustments** (protein scaling, fat/oil moderation, carb balancing, and serving rebalancing) as the primary automated engine to reach $\ge 85\%$ Fit Scores. Concurrently, introduce an **interactive inline swap picker (Option A)** that preserves volume without changing grams/ml, and a **Household Swap Learning Memory** (`preferences.swapPreferences`) that records user-selected ingredient substitutions and remembers them for future optimizations while strictly eliminating redundant self-swaps.

---

## Problem Statement

1. **Redundant Self-Swapping**:
   When an ingredient is already linked to a healthier or reduced-fat product (such as *Cheddar* already linked to *30% Reduced Fat Extra Mature Cheese*), the current heuristic still detects the word "Cheddar", searches for reduced fat cheese, and matches the exact same product, producing a confusing 0-impact swap row where Pre-Swap and Post-Swap are identical.
2. **Culinary Context Mismatch**:
   Hardcoded generic dairy swaps (e.g., substituting *Creme Fraiche* with *0% Skyr / Greek Yogurt*) break hot cooking dishes (such as *Creamy Sausage & Pea Gnocchi*) because yogurt curdles when heated in sauce. Culinary swaps must either be user-chosen or strictly constrained to cooking-safe equivalents (e.g., *Half-Fat Creme Fraiche*, *Quark*, or *Light Elmlea*).
3. **Unpredictable Volume Shifts**:
   Automated calorie-matching volume recalculations on substituted ingredients can change sauce or bulk mass unpredictably. Users expect recipe substitute volume to remain 1:1 with the original recipe portion (e.g., 100g Creme Fraiche replaced by 100g Half-Fat Creme Fraiche).
4. **Lack of Household Learning**:
   When a user intentionally chooses a specific brand or substitute for an ingredient, the app currently forgets it on the next recipe. The system needs to learn and persist household swap preferences over time.

---

## Proposed Solution Architecture

### 1. Pure Quantity-Based Auto-Enhancement Engine (`RecipeEnhancementService.js`)
- The automated route generation will reach $\ge 85\%$ Fit Score purely through **quantity adjustments**:
  - **Lean Protein Scaling**: Incrementally scale protein cuts (chicken breasts, beef mince, steaks, tofu, fish) by 20–30g or discrete unit items (+1 burger, +1 sausage) to meet household target protein ($\approx 43\text{g}$).
  - **Cooking Fat Moderation**: Clamp excessive cooking oils/butters (e.g. 30ml oil $\rightarrow$ 10–15ml) to eliminate empty fat calories without compromising cooking.
  - **Carb Balancing**: Moderately scale pasta/rice/potatoes if dinner calories exceed target limits.
  - **Servings Rebalancing**: Offer a route that re-portions batch servings (e.g. 2 servings $\rightarrow$ 3 portions) if single-serving calories are too dense.
- **Result**: Zero culinary weirdness, zero sauce curdling, zero flavor compromise, and 100% preservation of the user's purchased pantry ingredients.

### 2. Interactive Inline Swap Picker on Demand (Option A)
- For ingredients that have culinary alternatives in the pantry bank, render a clean Apple-style inline picker inside the adjustment row:
  - Example: `[ Creme Fraiche (Original) ▼ ]`
  - Options:
    - *Keep Original (100g)*
    - *Half-Fat Creme Fraiche (100g)*
    - *Quark (100g)*
- **Strict Volume Preservation**:
  - When the user selects an alternative from the picker, the volume/weight remains identical to the original recipe (e.g. 100g $\rightarrow$ 100g).
  - The modal dynamically recalculates the exact macros and updates the Fit Score and target impact in real time.

### 3. Self-Swap Prevention Guard
- Before offering any swap, verify:
  `if (currentProduct.id === targetProduct.id || currentProduct.name.toLowerCase().includes('reduced fat')) return false;`
- Never propose swapping an ingredient to its already-linked product.

### 4. Household Swap Memory (`preferences.swapPreferences`)
- Persist learned preferences in the household configuration (`households/elliott-chloe/settings/preferences`):
  ```json
  "swapPreferences": {
    "creme_fraiche": {
      "originalName": "Creme Fraiche",
      "preferredProductId": "prod_half_fat_creme_fraiche_id",
      "preferredSubtype": "Half-Fat Creme Fraiche",
      "preferredProductName": "50% Less Fat Creme Fraiche",
      "updatedAt": "2026-11-01T21:00:00Z"
    }
  }
  ```
- When the user accepts an enhancement with a chosen swap, call `HouseholdRepository.saveHouseholdSwapPreference(key, preference)`.
- On future auto-enhancements, if a recipe contains an ingredient with a learned preference in `swapPreferences`, the system remembers and prioritizes it.

---

## Acceptance Criteria

- [ ] **Acceptance Criterion 1 (Quantity-First Routes)**: The auto-enhance generator produces qualifying $\ge 85\%$ routes using strictly quantity adjustments (protein scale up, cooking fat moderation, carb balance, serving rebalance) without forcing automated product swaps.
- [ ] **Acceptance Criterion 2 (No Self-Swaps)**: Ingredients that are already linked to low-fat / target products (e.g. Cheddar linked to 30% Reduced Fat Cheddar) are never offered as self-swaps.
- [ ] **Acceptance Criterion 3 (Interactive Inline Swap Picker)**: If the user wishes to swap an ingredient, an inline Apple-style dropdown allows selecting a safe culinary alternative.
- [ ] **Acceptance Criterion 4 (Volume Preservation)**: Selecting a swap preserves the exact original gram/ml volume (1:1 portion preservation).
- [ ] **Acceptance Criterion 5 (Household Swap Learning)**: User-chosen swaps are saved to `preferences.swapPreferences` and automatically recalled as the default preferred substitute in future recipes.
- [ ] **Acceptance Criterion 6 (Regression Verification)**: All unit tests pass, and existing single-writer persistence rules (`HouseholdRepository.saveRecipe` for `recipe.enhanced`) remain strictly intact.

---

## Implementation Steps

### Phase 1: Pure Quantity Route Heuristics (`RecipeEnhancementService.js`)
1. Refactor `buildRoutePlan` so that automated routes (`Portion Scaling`, `Fat Moderation`, `Balanced Adjustments`) do not inject forced swaps by default.
2. Add `findCulinarySwapCandidates(ingredient, products, allIngredients, swapMemory)` helper that returns 2–3 valid culinary alternatives for an ingredient, strictly excluding identical products and unsuitable cross-category substitutions (e.g. no cold yogurt for hot cream sauces).

### Phase 2: Household Swap Memory Repository & Store
1. Extend `src/services/HouseholdRepository.js` with `saveHouseholdSwapPreference(ingredientKey, swapData)` and `getHouseholdSwapPreferences()`.
2. Connect swap preferences to store state (`state.preferences.swapPreferences`).
3. Load swap preferences during hydration (`HydrationService.js`).

### Phase 3: Interactive Inline Swap Picker UI (`RecipeEnhancementModalUI.js`)
1. Update adjustment rows: if an ingredient has available swaps, render an inline select control (`.enh-swap-select`).
2. When the select value changes:
   - Keep volume fixed (`swap.qty = original.qty`).
   - Recalculate route macros and call `recomputeModalPredictedScore(wrap, activeRoute)`.
3. When the user clicks "Accept & Apply Enhanced Variant", persist any chosen swaps to `saveHouseholdSwapPreference`.

### Phase 4: Verification & Automated Tests
1. Add test suite in `scripts/test_recipe_enhancement_service.js`:
   - Test quantity-first route generation without automated self-swaps.
   - Test culinary candidate discovery and volume preservation.
   - Test swap memory persistence and retrieval.
2. Build and verify dist (`npm run build`).
