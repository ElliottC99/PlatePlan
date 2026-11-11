# Technical Plan: Vault Enhanced Recipe Fit Score Fix & Wizard Step 2 Mapping Gating

**Status:** Ready for Implementation  
**Created:** 2026-11-05  
**Target Branch:** `dev/enhanced-fit-score-and-wizard-gate`  
**Base Branch:** `development`  

---

## 1. Problem Frame

Users have identified two critical issues in the meal planning workflow:
1. **Enhanced Recipe Fit Score Collapse (87% Original vs 0% Enhanced):**  
   In the Recipe Vault (`VaultRecipeCard.js`), recipes with enhanced variants (such as *"Smashed Brooklyn Burgers"*) calculate an 87% Ideal Match for the original recipe, but the Enhanced version drops to **0% Poor Match** with completely blank portion targets (`Elliott   Chloe   🔴 0% · Poor Match`).
   - Root Cause 1: `buildFit` in `VaultRecipeCard.js` calls `calculateMealFitScore(r, ...)` passing `r` (the outer original recipe object) rather than `_active` (the merged enhanced recipe payload `enhancedActive`).
   - Root Cause 2: `VaultRecipeCard.js` attempts to call `window.calculateRecipeDisplayNutrition`, which is undefined on `window`, returning `bundle: null` and causing portion strings to remain empty.
   - Root Cause 3: In `fitScoreCalculator.js` and `macroScoringUtils.js`, if an enhanced variant records batch macros instead of per-serving macros, or if an aggressive protein boost pushes total calories above `calHighCeilPct` (140% of target budget), the asymmetric curve sharply clamps the calorie score to 0.
2. **Recipe Wizard Step 2 Mapping Bypass ("New Item" Allowed):**  
   In Step 2 of the Recipe Wizard (`RecipeWizardStep2View.js` and `RecipeWizardStep2Handlers.js`), users are currently able to click "Next: Final Inline Review →" and proceed to Step 3 even when ingredient autocomplete boxes retain `"✨ New Item"` status.
   - Root Cause 1: `isIngredientUnlinked()` considers an item linked if `item.categoryId` exists, but default parser outputs assign fallback category strings (e.g. `'Store Cupboard'` or `'General'`), inadvertently satisfying the check.
   - Root Cause 2: Autocomplete selection changes in Step 2 do not dynamically re-evaluate the unlinked state of the DOM, leaving the "Next" button enabled or out of sync.
   - Root Cause 3: Handlers rely solely on in-memory object properties without cross-checking the actual rendered autocomplete values (`data-tax-val="new_item"` or `"✨ New Item"` text).

---

## 2. Scope Boundaries

### In-Scope
- **Vault Enhanced Fit Score & Display Portions:**
  - Fix `VaultRecipeCard.js` `buildFit()` to pass `_active` (or `enhancedActive`) into `calculateMealFitScore` and `renderFitScoreBadge`.
  - Populate display portions (e.g., `Elliott 750kcal, 55g | Chloe 580kcal, 42g`) directly from `calculateMealFitScore().details` rather than relying on the missing `calculateRecipeDisplayNutrition` global.
  - Fix `extractRecipeMacros` and `buildEnhancedRecipePayload` to ensure per-serving and batch calories/protein are normalized consistently across original and enhanced variants.
  - Ensure enhanced variants that increase lean protein are properly evaluated without unintended ceiling drop-offs.
- **Recipe Wizard Step 2 Strict Mapping Gating:**
  - Update `isIngredientUnlinked(item)` in `RecipeWizardTaxonomySearch.js` so items with `isNewTaxonomyItem === true`, `ingredientId === 'new_item'`, or generic fallback categories without real product/root-item linkage are strictly identified as unlinked.
  - Cross-check DOM inputs (`.wiz-ing-tax-search`) for `data-tax-val="new_item"` or values matching `/New Item/i`.
  - Update `RecipeWizardStep2View.js` to ensure `#btn-next-step2` is disabled whenever any ingredient is unlinked, and display `#wiz-gate-warning-banner`.
  - Wire live autocomplete selection, deletion, and addition handlers in `RecipeWizardStep2Handlers.js` to dynamically toggle the Next button's disabled state in real time.
  - In `btnNext2.onclick`, add a hard gate that prevents navigating to Step 3 if any ingredient is unlinked, displaying an actionable warning notice.

### Out-of-Scope
- Overhauling the core Asymmetric Fit Score algorithm parameters or default splits.
- Re-architecting Step 3 or the Recipe Vault card layout beyond fixing the fit score and portion display.

---

## 3. Requirements Traceability

- **REQ-1 (Vault Enhanced Fit Score):** Enhanced recipe variants must accurately calculate and render their true fit score (e.g. $\ge 85\%$) and dual-profile macro targets instead of collapsing to 0% with empty profile text.
- **REQ-2 (Vault Portion Display):** Elliott and Chloe portion buttons on both Original and Enhanced cards must display formatted calories and protein derived directly from `calculateMealFitScore` details.
- **REQ-3 (Step 2 Next Button Disabled State):** The "Next: Final Inline Review →" button must be visually and functionally disabled whenever one or more ingredients have unlinked / "✨ New Item" status.
- **REQ-4 (Step 2 Live Dynamic Gating):** Selecting a valid Category, Item, or Sub-Type in the search picker must immediately recalculate unlinked items and re-enable the Next button when all ingredients are mapped.
- **REQ-5 (Step 2 Hard Click Interceptor):** Tapping "Next" when an unmapped item exists must block navigation and alert the user with the number of unmapped ingredients.

---

## 4. Key Technical Decisions

### Decision 1: Derive Display Portions Directly from `calculateMealFitScore().details`
- **Context:** `VaultRecipeCard.js` tried calling `window.calculateRecipeDisplayNutrition`, but that function does not exist, leaving `portions.e` and `portions.c` blank strings.
- **Decision:** In `buildFit()`, derive `portions` directly from `liveFitData.details`:
  ```javascript
  const e = liveFitData?.details?.elliott;
  const c = liveFitData?.details?.chloe;
  const portions = {
    eCal: e?.recipeKcal || 0,
    eProt: e?.recipeProtein || 0,
    cCal: c?.recipeKcal || 0,
    cProt: c?.recipeProtein || 0,
    e: e ? `${Math.round(e.recipeKcal)}kcal, ${Math.round(e.recipeProtein)}g` : '',
    c: c ? `${Math.round(c.recipeKcal)}kcal, ${Math.round(c.recipeProtein)}g` : ''
  };
  ```
- **Rationale:** Self-contained, zero external dependency, and guaranteed to match the exact portion-scaled macros used to compute the fit score badge.

### Decision 2: Strictly Pass Active Variant Recipe Payload in `buildFit()`
- **Context:** In `VaultRecipeCard.js`:
  ```javascript
  const originalFit = buildFit(r, false);
  const enhancedActive = r.enhanced ? { ...r, ...r.enhanced, ingredients: r.enhanced.ingredients || r.ingredients } : null;
  const enhancedFit = enhancedActive ? buildFit(enhancedActive, true) : null;
  ```
  `buildFit` accepted `_active` as its first parameter but referenced `r` in the function body.
- **Decision:** Use `_active` throughout `buildFit(_active, useEnhanced = false)`:
  - `calculateMealFitScore(_active, requestedMealType, { activeProfile, variant: variantKey, portionScaled: true })`
  - `renderFitScoreBadge(_active, resolvedMealType, ...)`
  - `renderFitBlock({ ..., recipeId: r.id, variant: variantKey, ... })`

### Decision 3: Multi-Layer Unlinked Ingredient Detection in Step 2
- **Context:** Some ingredients have `categoryId: 'Store Cupboard'` set as a default string from parsing, evading `item.categoryId` checks while still showing `✨ New Item` in the input.
- **Decision:** Define an ingredient as unlinked if:
  1. `item.isNewTaxonomyItem === true` OR `item.ingredientId === 'new_item'`
  2. OR `!item.productId && !item.bankId && !item.ingredientId && !item.subtypeId && (!item.categoryId || item.categoryId === 'Store Cupboard' || item.categoryId === 'General')`
  3. OR the input element in the active modal has `data-tax-val="new_item"` or its text value contains `"New Item"`.

---

## 5. Implementation Units

### Unit 1: Fix Vault Enhanced Recipe Fit Score & Portion Resolution
**Target Files:**
- `src/components/vault/VaultRecipeCard.js`
- `src/utils/macroScoringUtils.js`
- `src/utils/fitScoreCalculator.js`

**Changes:**
1. In `src/components/vault/VaultRecipeCard.js`:
   - Refactor `buildFit(_active, useEnhanced)` to evaluate `_active` instead of `r`.
   - Extract `portions.e` and `portions.c` directly from `liveFitData.details.elliott` and `liveFitData.details.chloe`.
   - Pass `_active` to `renderFitScoreBadge`.
2. In `src/utils/macroScoringUtils.js`:
   - In `extractRecipeMacros`, when `variant === 'enhanced'`, inspect both `r.enhanced` and `r.enhanced.nutrition` to ensure per-serving macros are correctly extracted.
   - Guard against NaN or unnormalized batch multipliers when `r.servings` differs between variants.

**Test Scenarios:**
- A recipe with an enhanced variant (e.g. Smashed Brooklyn Burgers) calculates its fit score for the enhanced variant using the enhanced ingredients and nutrition.
- The enhanced fit score displays an accurate percentage (e.g. $\ge 85\%$) rather than 0%.
- Elliott and Chloe portion labels display formatted calories and protein (e.g. `Elliott 750kcal, 55g | Chloe 580kcal, 42g`).

---

### Unit 2: Strict Step 2 Ingredient Mapping Gating & Live Validation
**Target Files:**
- `src/components/recipe/RecipeWizardTaxonomySearch.js`
- `src/components/recipe/RecipeWizardStep2View.js`
- `src/components/recipe/RecipeWizardStep2Handlers.js`

**Changes:**
1. In `src/components/recipe/RecipeWizardTaxonomySearch.js`:
   - Harden `isIngredientUnlinked(item, products, ingredients)`:
     - Return `true` if `item.isNewTaxonomyItem` or `item.ingredientId === 'new_item'`.
     - Reject fallback categories `'Store Cupboard'` and `'General'` unless explicitly selected with a valid category prefix `cat:`.
     - Reject if `!item.productId && !item.bankId && !item.ingredientId && !item.subtypeId && !item.categoryId`.
2. In `src/components/recipe/RecipeWizardStep2View.js`:
   - Keep `#btn-next-step2` disabled and styled with `opacity: 0.6; cursor: not-allowed` whenever `unlinked.length > 0`.
   - Display `#wiz-gate-warning-banner` highlighting the exact number of unmapped ingredients.
3. In `src/components/recipe/RecipeWizardStep2Handlers.js`:
   - Add a reactive helper `updateStep2NextButtonState(modalWrap)`:
     - Scans both state ingredients and active `.wiz-ing-tax-search` inputs.
     - Toggles `btnNext2.disabled`, opacity, cursor, and warning banner display in real time as the user selects autocomplete items or deletes ingredient lines.
   - In `bindTaxonomyAutocompleteEvents`, call `updateStep2NextButtonState(modalWrap)` immediately upon mapping selection.
   - In `btnNext2.onclick`, perform a blocking validation check: if any ingredient remains unmapped, display a clear warning toast/banner and abort step progression.

**Test Scenarios:**
- When opening Step 2 with an unmapped ingredient, the "Next: Final Inline Review →" button is disabled and the warning banner is visible.
- Selecting a valid Category or Product from the autocomplete immediately enables the "Next" button and hides the warning banner without requiring a page reload.
- Attempting to force-click "Next" with an unmapped item displays a blocking warning notice.

---

### Unit 3: Standalone Verification & Regression Test Suite
**Target Files:**
- `scripts/test_vault_enhanced_fit_and_wizard_gate.js`

**Test Suite Coverage:**
1. **Enhanced Fit Calculation Test:** Emulate a recipe with original and enhanced variants (including Smashed Brooklyn Burgers structure) and verify both `variant: 'original'` and `variant: 'enhanced'` return valid $>0\%$ fit scores and details.
2. **Portion Formatting Test:** Verify `buildFit` logic generates non-empty formatted portion strings for Elliott and Chloe.
3. **Step 2 Gating Test:** Verify `isIngredientUnlinked` correctly flags new items, items with fallback categories, and validates items mapped to real categories, root items, or products.
4. **Dead Controls & Accessibility:** Ensure all buttons and inputs maintain full compliance with `test_dead_controls.js` and `npm run lint`.

---

## 6. Verification Checklist

- [ ] `node scripts/test_vault_enhanced_fit_and_wizard_gate.js` passes.
- [ ] `node scripts/test_recipe_wizard_and_auth.js` passes.
- [ ] `node scripts/test_dead_controls.js` passes (0 dead controls).
- [ ] `node scripts/test_shopping_list.js` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` succeeds.
- [ ] Open Pull Request into `development` and verify CI check-runs pass before merging.
