---
title: Recipe Wizard Step 2 Review Flow, Live Macros, and Auto-Enhance Interactive Controls
type: feat
date: "2026-11-02"
topic: recipe-wizard-step2-review-and-auto-enhance-controls
---

# Implementation Plan: Recipe Wizard Step 2 Review Flow, Live Macros & Auto-Enhance Controls

> Created: 2026-11-02  
> Status: Implemented ✓  
> Author: Antigravity  
> Exploration Ref: `docs/plans/2026-11-02-1925-explore-recipe-wizard-step2-review-and-auto-enhance-controls.md`  

---

## 0. Prior Solutions & Pattern Awareness

### Prior Solutions
- `docs/solutions/logic-errors/recipe-vault-enhanced-variant-safe-deletion-20261101.md`: Safe lifecycle and dual-key isolation of `recipe.enhanced` and `recipe.enhancedFitScore`.
- `docs/solutions/runtime-errors/vault-recipe-card-menu-event-delegation-crash-20261102.md`: Container event delegation for recipe cards, preventing missing element crashes and passing variant parameters.
- `docs/solutions/logic-errors/universal-fit-score-drift-and-tapering-curve-20261030.md`: Standardizing variant passing (`'original'` vs `'enhanced'`) to fit score calculators and badges.

### Critical Patterns
- **Pattern #1 (Single Source of Truth for Business Logic)**: Recipe nutrition and fit score calculations must delegate directly to canonical engines (`fitScoreCalculator.js` and `NutritionService.js`) rather than ad-hoc math.
- **Pattern #2 (Single Source of Truth for UI Components & Event Delegation)**: Use container-level event delegation for steppers and table inputs.
- **Pattern #10 (Atomic State Transitions)**: The enhanced recipe variant payload saved upon applying must strictly match the user's active selections in the UI.

---

## 1. Problem Statement & Root Cause

1. **Card Menu "Review Recipe" & Variant Forwarding**:
   - `VaultRecipeCardRenderService.js` omits `menu-review` when `variant === 'enhanced'`.
   - `VaultRecipeCard.js` calls `openRecipeWizard('review', recipeId)` without passing `variant`.
   - `openRecipeWizard` in `RecipeWizardModal.js` defaults `'review'` mode to Step 3 (`currentStep = 3`) and only loads base recipe data, completely ignoring `found.enhanced`.
2. **View Recipe Modal "Edit" Button**:
   - `RecipeDetailModalUI.js` renders an "✏️ Edit" button that opens the wizard in manual step 1 mode, ignoring whether the user was viewing the Original or Enhanced tab.
3. **Recipe Wizard Step 2 Lacks Live Macros**:
   - `RecipeWizardStep2View.js` renders ingredient mapping and servings, but has **zero** macro or fit score visual indicators.
   - Input changes to ingredient quantity, unit, name, or water volume do not trigger live macro updates.
4. **Auto-Enhance Inaccurate Scores, Unchecked Items Bug & Missing Volume Controls**:
   - **Unchecked Items Bug**: `btnApply.onclick` passes `activeRoute.enhancedRecipePayload`, which was statically generated at modal launch. If the user unchecks an adjustment, the unchecked item is **still applied** as if it were checked!
   - **Score Drift**: `recomputeModalPredictedScore()` adds delta values onto the pre-baked payload without subtracting unchecked adjustments, and clamps results with `Math.max(beforeScore, ...)`.
   - **Lack of Volume Controls**: Adjustments are fixed all-or-nothing checkboxes without steppers or fine-grained quantity controls.

---

## 2. Proposed Architecture & Solution

### Phase 1: Card Menu "Review Recipe" & Variant Routing
1. In `src/components/vault/VaultRecipeCardRenderService.js`:
   - Render `menu-review` for **both** original and enhanced recipe variants.
   - For original cards: "🔍 Review Recipe".
   - For enhanced cards: "🔍 Review Enhanced Recipe".
2. In `src/components/vault/VaultRecipeCard.js`:
   - In delegated action routing for `menu-review`:
     ```javascript
     case 'menu-review':
       if (typeof window.openRecipeWizard === 'function') {
         window.openRecipeWizard('review', recipeId, variant);
       }
       break;
     ```

### Phase 2: View Recipe Modal — Replace "Edit" with "Review"
1. In `src/components/recipe/RecipeDetailModalUI.js`:
   - Replace `#modal-recipe-edit-btn` with `#modal-recipe-review-btn`:
     ```html
     <button type="button" id="modal-recipe-review-btn" class="btn secondary" ... onclick="if(typeof closeRecipePreview==='function')closeRecipePreview();if(typeof openRecipeWizard==='function')openRecipeWizard('review', '${escapeAttr(recipeId)}', '${variantKey}')" aria-label="Review recipe" title="Review recipe">
       🔍 Review
     </button>
     ```
   - Automatically passes the currently active tab variant (`variantKey`: `'original'` or `'enhanced'`).

### Phase 3: Recipe Wizard Step 2 Navigation, Live Fit Score & Macro Card
1. In `src/components/recipe/RecipeWizardModal.js`:
   - Update signature: `openRecipeWizard(initialMode = 'manual', editRecipeId = null, variant = 'original')`.
   - When `variant === 'enhanced'` and `found.enhanced` exists:
     - Populate `wizardState.activeRecipe` using the enhanced variant data:
       - `ingredientSections`: `found.enhanced.ingredientSections || ...`
       - `ingredients`: `found.enhanced.ingredients || ...`
       - `servings`: `found.enhanced.servings || found.servings || 4`
       - `macros`: `found.enhanced.macros || found.enhanced.nutrition || ...`
       - `methodSteps`: `found.enhanced.methodSteps || found.steps || ...`
     - Set `wizardState.activeVariant = 'enhanced'`.
   - When `initialMode === 'review'`:
     - Set `wizardState.choice = 'manual'`.
     - Set `wizardState.currentStep = 2`.
2. In `src/components/recipe/RecipeWizardStep2View.js`:
   - Recompute live macros for `activeRecipe` before rendering via `recalculateWizardMacros(activeRecipe)`.
   - Render a sticky/prominent **Live Nutrition Bar** at the top of Step 2 containing:
     - **Live Fit Score Badge** (via `renderFitScoreBadge(activeRecipe, targetMealType)`).
     - **Dual-Profile Per-Portion Split Card** (Elliott kcal/protein vs Chloe kcal/protein against household targets).
     - **Per-Serving Macro Summary** (Calories, Protein, Carbs, Fat).
3. In `src/components/recipe/RecipeWizardStep2Handlers.js`:
   - Add delegated `input` and `change` event listeners for:
     - `.wiz-ing-qty`: updates `item.qty` and triggers real-time macro & badge recalculation.
     - `.wiz-ing-unit`: updates `item.unit` and triggers recalculation.
     - `.wiz-ing-name`: updates `item.name` and triggers recalculation.
     - `#wiz-servings-input`: triggers recalculation.
   - Implement `updateLiveStep2NutritionDOM()` to mutate the nutrition cards and badges in-place without re-rendering the whole form (preserving input focus and cursor position).

### Phase 4: Auto-Enhance Engine — Dynamic Rebuilding, Unchecked Fix & Volume Steppers
1. In `src/components/recipe/RecipeEnhancementModalUI.js`:
   - **Fix the Unchecked Items Bug**:
     - Implement `buildLiveEnhancedRecipe(route)`:
       - Starts with a clean copy of the base recipe.
       - Gathers active adjustments: `const activeAdjs = (route.adjustments || []).filter(a => a.active !== false);`.
       - Applies only active quantity adjustments and active swaps.
       - Runs canonical `calculateBatchMacros` and `calculateMealFitScore`.
       - Returns `{ liveRecipe, liveFit, liveMacros }`.
     - Store this live payload on `route.liveEnhancedPayload`.
     - When `btnApply.onclick` runs:
       ```javascript
       const finalPayload = buildLiveEnhancedRecipe(activeRoute).liveRecipe;
       currentOnApply(finalPayload);
       ```
       **Guarantee:** Any adjustment unchecked by the user is 100% excluded from the applied enhanced variant!
   - **True Live Re-Scoring**:
     - `recomputeModalPredictedScore()` uses `buildLiveEnhancedRecipe(activeRoute)`:
       - Displays the exact simulated Fit Score and Tier badge.
       - Updates `#enh-impact-text` with true deltas against original baseline.
       - Displays full live per-serving macros (`Calories`, `Protein`, `Carbs`, `Fat`).
   - **Interactive Volume Steppers (`[-] [qty] [+]`)**:
     - For quantity adjustments, replace static text with interactive steppers:
       - Stepper buttons: `[-]` and `[+]`.
       - Direct quantity input allowing manual number entry.
       - Smart step resolution: `5g` / `10g` for solids, `5ml` for liquids, `1` for discrete pieces.
       - On stepper click or input: updates `adj.proposedQty` and re-runs `recomputeModalPredictedScore()`.

---

## 3. Detailed Acceptance Criteria

### Item 1: Card Menu "Review Recipe" & Step 2 Flow
- [x] On an **Original** recipe card in Recipe Vault: More menu shows "🔍 Review Recipe", clicking it opens Recipe Wizard directly at **Step 2** with original recipe data.
- [x] On an **Enhanced** recipe card in Recipe Vault: More menu shows "🔍 Review Enhanced Recipe", clicking it opens Recipe Wizard directly at **Step 2** with enhanced variant data.
- [x] Step 2 displays a Live Fit Score badge and Dual-Profile Macro Split card.
- [x] Changing ingredient quantity, unit, or recipe yield in Step 2 updates the live Fit Score badge and macro values in real time without losing input focus.

### Item 2: View Recipe Modal Review Button
- [x] In the View Recipe modal, the old "✏️ Edit" button is replaced with "🔍 Review".
- [x] Clicking "Review" on the Original tab opens Step 2 with original recipe data.
- [x] Clicking "Review" on the Enhanced tab opens Step 2 with enhanced variant data.

### Item 3: Auto-Enhance Engine & Volume Controls
- [x] Unchecking any adjustment in the Auto-Enhance modal recalculates the predicted Fit Score and macros based **strictly** on the remaining checked items (no stuck deltas or artificial clamping).
- [x] Clicking "Accept & Apply Enhanced Variant" saves **only the checked adjustments** into `recipe.enhanced` (unchecked adjustments are completely excluded).
- [x] Quantity adjustments in the Auto-Enhance modal feature interactive steppers (`[-]` and `[+]`) and editable quantity fields.
- [x] Modifying quantity via steppers dynamically recalculates and updates the live predicted Fit Score and macro summary.
- [x] Full per-serving macros (kcal, protein, carbs, fat) are clearly displayed in the Auto-Enhance review sheet.

### Regression & Integrity
- [x] All automated tests pass: `scripts/test_vault_recipe_card_menu.js`, `scripts/test_shopping_list.js`, `scripts/test_planner_wizard_pipeline.js`, `scripts/test_ledger.js`.
- [x] New automated test `scripts/test_recipe_review_and_auto_enhance_flow.js` verifies the complete lifecycle.
- [x] `npm run build` succeeds cleanly.

---

## 4. Implementation Steps

### Step 1: Card Menu & View Modal Review Action
- Edit `src/components/vault/VaultRecipeCardRenderService.js`: Render `menu-review` on both variants.
- Edit `src/components/vault/VaultRecipeCard.js`: Forward `variant` in `menu-review` action.
- Edit `src/components/recipe/RecipeDetailModalUI.js`: Replace `#modal-recipe-edit-btn` with `#modal-recipe-review-btn` passing `variantKey`.

### Step 2: Recipe Wizard Step 2 Variant Loading & Navigation
- Edit `src/components/recipe/RecipeWizardModal.js`: Support `(initialMode, editRecipeId, variant)`, overlay `found.enhanced` when `variant === 'enhanced'`, and route `'review'` mode to `currentStep = 2`.
- Update `RecipeWizardState.js` if necessary to ensure dual-key variant tracking.

### Step 3: Recipe Wizard Step 2 Live Fit Score & Macro Card
- Edit `src/components/recipe/RecipeWizardStep2View.js`: Add live Fit Score badge and Dual-Profile Macro Breakdown crossbar to Step 2 template.
- Edit `src/components/recipe/RecipeWizardStep2Handlers.js`: Add event listeners on input/change for quantity, unit, servings, and taxonomy linking with in-place DOM updates.

### Step 4: Auto-Enhance Ground-Truth Recalculator & Unchecked Fix
- Edit `src/components/recipe/RecipeEnhancementModalUI.js`:
  - Implement `buildLiveEnhancedRecipe(route)` computing from base recipe + strictly active adjustments.
  - Fix `btnApply.onclick` to pass the live dynamic payload.
  - Add interactive steppers (`[-]` and `[+]`) and direct quantity editing for quantity adjustments.
  - Render full live macro breakdown in the Hero card.

### Step 5: Automated Verification Suite & Build
- Create `scripts/test_recipe_review_and_auto_enhance_flow.js`.
- Run full test suite.
- Rebuild production distribution with `npm run build`.
