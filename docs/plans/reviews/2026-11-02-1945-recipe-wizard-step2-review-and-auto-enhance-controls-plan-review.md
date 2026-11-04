# Plan Review: Recipe Wizard Step 2 Review Flow, Live Macros & Auto-Enhance Controls

**Review Date:** 2026-11-02  
**Target Plan:** `docs/plans/2026-11-02-1945-recipe-wizard-step2-review-and-auto-enhance-controls-plan.md`  
**Review Status:** **APPROVED** 🟢

---

## 1. Completeness & Structural Evaluation

| Evaluation Criteria | Status | Notes |
|:---|:---:|:---|
| **Problem Statement** | ✅ Pass | Clearly identifies 4 root causes: missing review button on enhanced cards, edit button instead of review in modal, lack of live nutrition in Step 2, and unchecked adjustments bug + lack of volume controls in Auto-Enhance. |
| **Prior Solutions Searched** | ✅ Pass | Cross-references `recipe-vault-enhanced-variant-safe-deletion-20261101.md`, `vault-recipe-card-menu-event-delegation-crash-20261102.md`, and `universal-fit-score-drift-and-tapering-curve-20261030.md`. |
| **Acceptance Criteria** | ✅ Pass | Detailed, testable, and maps 1:1 to user requirements. |
| **Implementation Steps** | ✅ Pass | Broken down into 5 actionable phases across target files. |
| **Architectural Consistency** | ✅ Pass | Adheres to `AGENTS.md`: plain ES modules, no bundler, zero service worker, and standalone test runner. |

---

## 2. Deep Gap Analysis & Edge Cases

### 2.1 Focus Retention in Step 2 Live Updates
- **Risk**: Calling a full `renderWizardModal()` on every keystroke (`.wiz-ing-qty` oninput) would destroy and rebuild the DOM, causing the user to lose input focus and text selection while typing.
- **Mitigation Requirement**: Implement targeted DOM mutation:
  ```javascript
  function updateLiveStep2NutritionDOM() {
    recalculateWizardMacros(wizardState.activeRecipe);
    const fitBadgeContainer = document.getElementById('wiz-step2-fit-badge-container');
    const macroBarContainer = document.getElementById('wiz-step2-macro-crossbar-container');
    if (fitBadgeContainer) fitBadgeContainer.innerHTML = renderFitScoreBadge(wizardState.activeRecipe, ...);
    if (macroBarContainer) macroBarContainer.innerHTML = renderMacroBreakdownCrossbar(wizardState.activeRecipe, ...);
  }
  ```
  This keeps all ingredient inputs untouched and preserves active typing focus.

### 2.2 Volume Stepper Boundaries in Auto-Enhance
- **Risk**: Clicking the decrement button (`[-]`) repeatedly could drive ingredient volume to 0 or negative values, producing `NaN` or negative calories.
- **Mitigation Requirement**: Enforce lower bounds:
  - Weight (`g`): Minimum 5g.
  - Volume (`ml`): Minimum 5ml.
  - Discrete pieces (`qty`/`piece`/`patty`): Minimum 1.
  - If a user wishes to remove the ingredient adjustment entirely, they uncheck the adjustment checkbox.

### 2.3 Graceful Fallback for Missing Enhanced Variants
- **Risk**: If `openRecipeWizard('review', recipeId, 'enhanced')` is called on a recipe that lacks an `enhanced` variant in Firestore/Store, attempting to unpack `found.enhanced` could result in `undefined` errors.
- **Mitigation Requirement**: Check `if (variant === 'enhanced' && found.enhanced)`: if `found.enhanced` is missing, fall back seamlessly to original recipe data and log a benign warning.

### 2.4 Strict Exclusion of Unchecked Adjustments
- **Validation**: Confirming that `buildLiveEnhancedRecipe()` starts strictly from the original recipe's unmodified baseline and applies *only* adjustments where `a.active !== false`. When `btnApply` is clicked, this ensures that any adjustment unchecked in the modal is guaranteed not to appear in the saved recipe.

---

## 3. Verification & Testing Strategy

1. **Targeted Automated Test Script (`scripts/test_recipe_review_and_auto_enhance_flow.js`)**:
   - Assert "Review Recipe" opens Step 2 for original recipes.
   - Assert "Review Enhanced Recipe" opens Step 2 with enhanced variant data for enhanced recipes.
   - Assert View Recipe modal renders "Review" button with active tab variant.
   - Assert Step 2 live nutrition recalculates dynamically when ingredient quantities change.
   - Assert Auto-Enhance modal:
     - Unchecking an adjustment updates the live predicted score without stuck deltas.
     - Applying the enhancement saves **only** the active adjustments into `recipe.enhanced`.
     - Steppers increment and decrement quantities properly within bounds.
2. **Regression Check**:
   - Run `test_vault_recipe_card_menu.js`, `test_shopping_list.js`, `test_planner_wizard_pipeline.js`, and `test_ledger.js` (36/36 checks).

---

## 4. Final Verdict

**VERDICT:** **READY FOR IMPLEMENTATION** 🟢

The plan is comprehensive, addresses the exact root causes, eliminates the unchecked adjustments bug, adds the requested live nutrition cards to Step 2, and provides fine-grained stepper controls. Proceed directly to `/work`.
