# Exploration: Recipe Wizard Step 2 Review Flow, Live Macros, and Auto-Enhance Controls

**Date:** 2026-11-02  
**Status:** Completed  
**Topic:** Review Recipe Navigation, Step 2 Live Fit Score & Macro Card, View Modal Review Button, and Enhanced Auto-Enhance Volume & Macro Engine

---

## 1. Problem Statement & User Goals

The user requested an exploration covering three deeply interconnected functional areas of the recipe workflow:

1. **Review Recipe from Recipe Card More Menu**:
   - Under "More" (`...`) on a recipe card in the Recipe Vault, selecting "Review Recipe" must take the user directly to **Step 2** of the recipe wizard for the *current* recipe variant (specifically `'enhanced'` or `'original'` depending on the active tab/card).
   - Step 2 must feature a **live fit score badge and macro breakdown card** that recalculates and updates in real time as ingredients, quantities, units, servings, and taxonomy links are altered.
2. **View Recipe Modal Review Button**:
   - In the View Recipe modal (`RecipeDetailModalUI.js`), replace the current "✏️ Edit" button with a "🔍 Review" button.
   - Clicking "Review" closes the preview and takes the user directly to **Step 2** of the recipe wizard for the active variant (Original or ✨ Enhanced) currently being viewed.
3. **Auto-Enhance Feature Upgrades**:
   - In the Auto-Enhance modal (`RecipeEnhancementModalUI.js`), the live fit score and live macros currently do not update correctly when toggling adjustments or selecting substitutes.
   - Provide fine-grained volume controls for increasing and reducing ingredient volumes (steppers `[-]` / `[+]`, direct quantity editing, or percentage dials) rather than rigid binary checkboxes.
   - Ensure the applied enhanced variant payload reflects the exact live configuration chosen by the user.

---

## 2. Codebase Audit & Gap Analysis

### 2.1 Item 1: Recipe Card "Review Recipe" Flow & Step 2

#### Current State:
1. **Menu Rendering (`VaultRecipeCardRenderService.js:104-111`)**:
   ```javascript
   const editReviewItems = !isEnh ? `
     <button type="button" class="action-menu-item" data-action="menu-edit">...</button>
     <button type="button" class="action-menu-item" data-action="menu-review" data-id="${rId}">...</button>
   ` : '';
   ```
   - When `variant === 'enhanced'`, `menu-review` is completely omitted from the menu HTML.
2. **Action Dispatch (`VaultRecipeCard.js:146-150`)**:
   ```javascript
   case 'menu-review':
     if (typeof window.openRecipeWizard === 'function') {
       window.openRecipeWizard('review', recipeId); // Does not pass variant!
     }
     break;
   ```
3. **Wizard Initialization (`RecipeWizardModal.js:69-185`)**:
   - `openRecipeWizard(initialMode = 'manual', editRecipeId = null)` only accepts two parameters. It does not accept `variant`.
   - When `initialMode === 'review'`, line 179 executes:
     ```javascript
     wizardState.choice = 'manual';
     wizardState.currentStep = 3; // Routes to Step 3 instead of Step 2!
     ```
   - It populates `wizardState.activeRecipe` strictly from `found` (the root recipe), completely ignoring `found.enhanced` even if reviewing an enhanced recipe.
4. **Step 2 Missing Live Nutrition (`RecipeWizardStep2View.js`)**:
   - Step 2 contains servings yield and ingredient/method mapping tables, but **zero** macro or fit score visual indicators.
   - `RecipeWizardStep2Handlers.js` calls `recalculateWizardMacros()` only on yield change or section add/delete, but input changes to `.wiz-ing-qty`, `.wiz-ing-unit`, or `.wiz-ing-name` do not trigger live recalculation.

#### Required Changes:
- Render `menu-review` on both original and enhanced recipe cards.
- Pass `variant` to `openRecipeWizard('review', recipeId, variant)`.
- Support `variant` in `openRecipeWizard(mode, editRecipeId, variant = 'original')`:
  - When `variant === 'enhanced'` and `found.enhanced` exists, overlay `found.enhanced` onto `wizardState.activeRecipe` (sections, ingredients, instructions, servings, macros) and set `wizardState.activeVariant = 'enhanced'`.
  - For `mode === 'review'`, set `wizardState.currentStep = 2`.
- Embed the Live Fit Score Badge and Dual-Profile Macro Card into Step 2 (`RecipeWizardStep2View.js`).
- Wire `input` / `change` event delegation in Step 2 so modifying any ingredient quantity, unit, or taxonomy link dynamically recomputes and renders live macros and fit score instantly without losing input focus.

---

### 2.2 Item 2: View Recipe Modal — Replace "Edit" with "Review"

#### Current State:
In `src/components/recipe/RecipeDetailModalUI.js` (lines 268-272):
```html
${recipeId ? `
  <button type="button" id="modal-recipe-edit-btn" class="btn secondary" ... onclick="if(typeof closeRecipePreview==='function')closeRecipePreview();if(typeof openRecipeWizard==='function')openRecipeWizard('manual', '${escapeAttr(recipeId)}')">
    ✏️ Edit
  </button>
` : ''}
```
- The button is labeled "✏️ Edit" and opens the wizard in `'manual'` mode at Step 1 (`currentStep = 1`).
- It does not respect whether the user is on the "Original" or "✨ Enhanced" tab (`isEnh` / `variantKey`).

#### Required Changes:
- Replace the button markup with:
  ```html
  <button type="button" id="modal-recipe-review-btn" class="btn secondary" ... onclick="if(typeof closeRecipePreview==='function')closeRecipePreview();if(typeof openRecipeWizard==='function')openRecipeWizard('review', '${escapeAttr(recipeId)}', '${variantKey}')" aria-label="Review recipe" title="Review recipe">
    🔍 Review
  </button>
  ```
- This seamlessly forwards the recipe ID and active variant (`'original'` or `'enhanced'`) into Step 2 of the wizard.

---

### 2.3 Item 3: Auto-Enhance Engine & Modal Improvements

#### Current State:
1. **Flawed Live Scoring (`RecipeEnhancementModalUI.js:506-526`)**:
   ```javascript
   function recomputeModalPredictedScore(wrap, route) {
     const targetMeal = route.targets?.mealType || 'dinner';
     const activeAdjs = (route.adjustments || []).filter(a => a.active);
     const deltaKcalTotal = activeAdjs.reduce((acc, a) => acc + (a.deltaKcal || 0) + (a.swapDeltaKcal || 0), 0);
     const deltaProtTotal = Math.round(activeAdjs.reduce((acc, a) => acc + (a.deltaProt || 0) + (a.swapDeltaProt || 0), 0) * 10) / 10;

     const baseKcal = (route.enhancedRecipePayload?.nutrition?.perServing?.cal || route.targets?.targetKcal || 650) + activeAdjs.reduce((acc, a) => acc + (a.swapDeltaKcal || 0), 0);
     const baseProt = (route.enhancedRecipePayload?.nutrition?.perServing?.prot || route.targets?.targetProt || 42) + activeAdjs.reduce((acc, a) => acc + (a.swapDeltaProt || 0), 0);

     const simulated = {
       ...route.enhancedRecipePayload,
       perServing: { cal: Math.max(100, Math.round(baseKcal)), prot: Math.max(5, Math.round(baseProt * 10) / 10), ... }
     };

     const simFit = calculateMealFitScore(simulated, targetMeal, { variant: 'enhanced' });
     const newScore = Math.max(route.beforeScore || 0, Math.round(Number(simFit?.score) || route.beforeScore || 0));
   ```
   **Critical Deficiencies Found:**
   - **Double-Counting & Stuck Deltas**: `route.enhancedRecipePayload` was pre-generated assuming *all* adjustments were applied. When an adjustment is unchecked (`a.active = false`), its calories and protein are **never subtracted** from `baseKcal`!
   - **Clamped Score**: `Math.max(route.beforeScore, ...)` prevents the score from reflecting true degradation if all improvements are turned off.
   - **Static Applied Payload**: When the user clicks "Accept & Apply Enhanced Variant" (`btnApply.onclick`), it passes `activeRoute.enhancedRecipePayload`, which was statically generated at the start and never re-evaluated with the active checkbox states or custom volume modifications!
   - **Missing Macro Cards**: The modal only shows a small text summary (`🔥 delta kcal`, `💪 delta protein`), leaving the user blind to the actual calories, protein, carbs, fat, and dual-profile splits.
2. **Lack of Volume Controls**:
   - Volume changes in `RecipeEnhancementService.js` are pre-baked (e.g. `15ml -> 10ml` fat, or `200g -> 350g` chicken).
   - The user cannot fine-tune the amount (e.g. scale up by 50g increments, reduce oil by 5ml steps, or restore partial amounts).

#### Required Changes:
1. **Ground-Truth Recalculation Engine**:
   - Rebuild the simulated recipe dynamically from the base recipe:
     ```
     activeRecipe -> apply active swaps -> apply active quantity adjustments -> compute true nutrition via calculateBatchMacros -> calculateMealFitScore
     ```
   - Eliminate hardcoded clamping (`Math.max(beforeScore, ...)`).
2. **Interactive Stepper & Volume Control UI**:
   - For quantity adjustments, provide an interactive quantity stepper:
     ```html
     <div class="enh-qty-stepper">
       <button type="button" class="enh-qty-btn-minus">-</button>
       <input type="number" class="enh-qty-input" value="${proposedQty}">
       <span class="enh-qty-unit">${unit}</span>
       <button type="button" class="enh-qty-btn-plus">+</button>
     </div>
     ```
   - Allow smart increments: `±5g` or `±10g` for solids, `±5ml` for oils/liquids, `±1` for discrete items (patties/eggs).
3. **Full Live Macro Card Display**:
   - Render the complete per-serving macro pill bar (`Calories`, `Protein`, `Carbs`, `Fat`) and dual-profile Elliott/Chloe target alignment badges directly in the Hero card.
4. **Dynamic Payload Building on Apply**:
   - When the user clicks "Accept & Apply", call `buildEnhancedRecipePayload()` with the exact live ingredients and quantities active in the modal.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph UI Triggers
        A1["Vault Recipe Card: More -> 'Review Recipe' (Original)"] -->|openRecipeWizard('review', id, 'original')| WIZ
        A2["Vault Recipe Card: More -> 'Review Recipe' (Enhanced)"] -->|openRecipeWizard('review', id, 'enhanced')| WIZ
        B["View Recipe Modal: Click 'Review'"] -->|openRecipeWizard('review', id, activeVariant)| WIZ
        C["Auto-Enhance Modal"] -->|Tuning volumes & swaps| ENH
    end

    subgraph WIZ [Recipe Wizard Step 2]
        WIZ_LOAD["Load Recipe Variant Data into wizardState.activeRecipe"]
        WIZ_LOAD --> WIZ_STEP2["Render Step 2: Mapping & Quantities"]
        WIZ_STEP2 --> WIZ_LIVE["Live Fit Score Badge + Dual-Profile Macro Crossbar"]
        WIZ_STEP2 -->|User edits qty/unit/taxonomy| WIZ_RECALC["recalculateWizardMacros()"]
        WIZ_RECALC -->|Live DOM Update| WIZ_LIVE
    end

    subgraph ENH [Interactive Auto-Enhance Engine]
        ENH_MODAL["Enhancement Modal Sheet"]
        ENH_MODAL --> ENH_STEPPERS["Ingredient Steppers [- / +] & Swaps"]
        ENH_STEPPERS -->|User adjusts volume or swap| ENH_RECALC["True Batch Macro & Fit Score Recalculator"]
        ENH_RECALC --> ENH_LIVE["Live Fit Score Badge + Macro Card"]
        ENH_MODAL -->|Click Accept & Apply| ENH_APPLY["buildEnhancedRecipePayload() with exact live values"]
    end
```

---

## 4. Multi-Order Consequences Analysis

### 1st Order Effects:
- Instant navigation from both Vault cards and View modal directly into Step 2 for whatever recipe variant is currently active.
- Real-time feedback in Step 2: users immediately see macro and fit score changes as they tweak ingredient quantities.
- Auto-Enhance users gain full ergonomic control over ingredient volume tuning with 100% accurate live scoring.

### 2nd Order Effects:
- Elimination of data disconnect between what users configure in Auto-Enhance and what gets saved into `recipe.enhanced`.
- Clean separation between original recipe baseline and enhanced variant: reviewing an enhanced recipe preserves and tunes the enhanced overlay without corrupting the original.

### 3rd Order Effects:
- High user confidence in nutritional calculations across all views (Vault, Wizard, View modal, Auto-Enhance).
- No regression in existing automated suites (Shopping list, Meal planner, Ledger).

---

## 5. Decision Gate & Next Steps

**Gate Decision:** **PROCEED TO `/plan`** 🟢

All three areas have been thoroughly investigated, code locations mapped, root causes diagnosed, and interface designs validated against codebase standards.

**Next Action:** Proceed with `/plan` to define the step-by-step implementation protocol.
