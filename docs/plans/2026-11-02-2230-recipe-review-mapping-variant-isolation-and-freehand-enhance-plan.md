---
title: Recipe Review Ingestion Mapping, Variant Preservation, and Auto-Enhance Free-Hand Search
type: feat
date: "2026-11-02"
topic: recipe-review-mapping-variant-isolation-and-freehand-enhance
---

# Implementation Plan: Recipe Review Ingestion Mapping, Variant Preservation & Auto-Enhance Free-Hand Search

> Created: 2026-11-02  
> Status: Implemented ✓  
> Author: Antigravity  
> Exploration Ref: `docs/plans/2026-11-02-2105-explore-recipe-review-mapping-and-auto-enhance-freehand-search.md`  

---

## 0. Systematic App-Wide Pattern Awareness & Prior Solutions

### Prior Solutions
- `docs/solutions/logic-errors/recipe-vault-enhanced-variant-safe-deletion-20261101.md`: Safe lifecycle and dual-key isolation of `recipe.enhanced` and `recipe.enhancedFitScore`.
- `docs/solutions/runtime-errors/vault-recipe-card-menu-event-delegation-crash-20261102.md`: Container event delegation for recipe cards, preventing missing element crashes and passing variant parameters.
- `docs/solutions/logic-errors/universal-fit-score-drift-and-tapering-curve-20261030.md`: Standardizing variant passing (`'original'` vs `'enhanced'`) to fit score calculators and badges.

### Systematic Error Patterns Addressed App-Wide

#### Pattern A: Fragmented "Linked" Ingredient Detection
- **Symptom**: Code assumes an ingredient is unlinked if `!item.ingredientId && !item.categoryId`, falsely tagging products mapped via `productId` or `bankId` as `✨ New Item` and blocking progression.
- **Affected Areas**: `RecipeWizardTaxonomySearch.js`, `RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`, `RecipeWizardStep3Handlers.js`, `RecipeWizardState.js`, and `UnlinkedSweeperUI.js`.
- **Systematic Standard**: An ingredient is linked if:
  1. It has a known `productId` or `bankId` matching a product in `state.products`, OR
  2. It has a valid `ingredientId` (not `'new_item'`), OR
  3. It has a valid `categoryId`, OR
  4. It resolves via `resolveProductForIngredient(item, { products, ingredients })`.

#### Pattern B: Accidental Variant Erasure on Save
- **Symptom**: Flawed equality check `hasDistinctEnhancedVariant` compares root ingredients with enhanced ingredients. When saving an enhanced recipe, root and enhanced match, causing the enhanced variant to be omitted and wiped from Firestore.
- **Affected Areas**: `RecipeWizardStep3Handlers.js`, `RecipeWizardModal.js`, `RecipeWizardState.js`.
- **Systematic Standard**: Explicit variant isolation:
  - If editing `'original'`: write root fields and **strictly preserve** `recipe.enhanced` and `recipe.enhancedFitScore`.
  - If editing `'enhanced'`: preserve root original fields and write edited data into `recipe.enhanced` and `recipe.enhancedFitScore`.

#### Pattern C: UI Desynchronization in Dynamic Steppers & Rigid Algorithmic Lock-in
- **Symptom**: Modifying steppers updates the hero fit score but leaves individual row headers (`500g`) and delta tags (`+9.9g prot`) stuck on initial values. Rigid two-tab routes restrict culinary control.
- **Affected Areas**: `RecipeEnhancementModalUI.js`.
- **Systematic Standard**: Reactive in-place row updates on stepper interaction + free-hand search for custom substitutions ranked with `isAutoDefault: true` products first.

---

## 1. Problem Statement & Root Cause

1. **False "✨ New Item" Misclassification in Step 2**:
   - `getTaxonomyLabel()` in `RecipeWizardTaxonomySearch.js` only checked `ingredientsBank` by `ingredientId`. It ignored `item.productId`, `item.productName`, and `item.subtypeId`.
   - `RecipeWizardStep2View.js` lines 217 & 230 flagged items with `(!i.ingredientId && !i.categoryId)` as unlinked.
   - `syncStep2InputsToState()` converted any input with `✨` into `new_item`, erasing existing product links.
2. **Enhanced Recipe Overwrite & Erasure on Save**:
   - When reviewing an enhanced variant, `wizardState.activeRecipe` was set to the enhanced variant.
   - On save, `hasDistinctEnhancedVariant(rec)` returned `false` because root and enhanced matched, dropping `recipeToSave.enhanced` and overwriting the original recipe with the enhanced one without the variant key.
3. **Auto-Enhance Static Labels & Missing Free-Hand Search**:
   - When stepping quantity from 500g to 400g, row text remained `Boost lean protein: 320g ➔ 500g`.
   - Users are locked into two rigid routes with fixed options. Users cannot free-hand search to swap ingredients ordered by auto-default.

---

## 2. Proposed Architecture & Solution

### Phase 1: Universal Taxonomy & Linked Recognition (Step 2 & Step 3)
1. In `src/components/recipe/RecipeWizardTaxonomySearch.js`:
   - Update `getTaxonomyLabel(item, ingredientsBank, productsBank)`:
     - Check `item.categoryId` -> `📂 [Category] ${item.categoryId}`.
     - Check `item.productId` / `item.bankId`: look up in `productsBank`. If found, return `📦 ${product.name} [${product.category || 'Product'}]`.
     - Check `item.subtypeId`: look up in `ingredientsBank`. If found, return `🏷️ ${sub.name} (${parent.name})`.
     - Fallback to `resolveProductForIngredient(item, { products: productsBank, ingredients: ingredientsBank })`.
     - Only return `✨ New Item: ${item.name}` if completely unresolved.
   - In `renderTaxonomySearchHTML(sIdx, iIdx, item, ingredientsBank, productsBank)`:
     - Support `data-tax-val` with `prod:${item.productId}` when mapped to a product.
   - In autocomplete dropdown:
     - Include matching products from `productsBank` (ranked with `isAutoDefault: true` first), so users can search and link products directly.
2. In `src/components/recipe/RecipeWizardState.js`:
   - In `syncStep2InputsToState()`:
     - Support `val.startsWith('prod:')`: set `item.productId = val.slice(5)`, look up product, set `item.productName = prod.name`, `item.isNewTaxonomyItem = false`.
     - If `input.value` is not empty and matches an already linked product, do NOT clear `productId` or flag as `new_item`.
3. In `src/components/recipe/RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`, and `RecipeWizardStep3Handlers.js`:
   - Replace the flawed unlinked check:
     ```javascript
     export function isIngredientUnlinked(item, products = [], ingredients = []) {
       if (!item) return false;
       if (item.isNewTaxonomyItem || item.ingredientId === 'new_item') return true;
       if (item.categoryId) return false;
       if (item.productId && products.some(p => String(p.id) === String(item.productId))) return false;
       if (item.ingredientId && ingredients.some(i => String(i.id) === String(item.ingredientId))) return false;
       const resolved = resolveProductForIngredient(item, { products, ingredients });
       return !resolved;
     }
     ```
   - No more false warnings for existing recipe ingredients!
4. In `src/components/data-quality/UnlinkedSweeperUI.js`:
   - Update `scanUnlinkedRecipeIngredients()` line 39 to recognize `item.productId` and `item.bankId` as linked.

---

### Phase 2: Dual-Variant Isolated Persistence (Step 3 Save)
1. In `src/components/recipe/RecipeWizardModal.js`:
   - When opening in `'review'` mode:
     - Record `wizardState.activeVariant = variant || 'original'`.
     - Store the original recipe reference as `wizardState.baseOriginalRecipe = JSON.parse(JSON.stringify(found))`.
     - If `variant === 'enhanced'`, populate editor with `found.enhanced`, while keeping `wizardState.baseOriginalRecipe` safe.
2. In `src/components/recipe/RecipeWizardStep3View.js`:
   - Update Save button label:
     - If `wizardState.activeVariant === 'enhanced'`: `💾 Save Enhanced Variant`.
     - If `wizardState.activeVariant === 'original'`: `hasDistinctEnhancedVariant` ? `💾 Save Both Recipes` : `💾 Save Original Recipe`.
3. In `src/components/recipe/RecipeWizardStep3Handlers.js`:
   - In `btnSave.onclick`:
     - If `wizardState.activeVariant === 'enhanced'`:
       - Do **NOT** overwrite the original recipe root fields!
       - Re-construct the enhanced variant object from editor state (`ingredients`, `methodSteps`, `macros`, `nutrition`, `servings`, `fitScore`).
       - Base recipe retains its original fields from `wizardState.baseOriginalRecipe`.
       - `recipeToSave.enhanced = editedEnhancedPayload;`
       - `recipeToSave.enhancedFitScore = finalComputedScore;`
     - If `wizardState.activeVariant === 'original'`:
       - Root fields are updated with editor state.
       - Existing `wizardState.baseOriginalRecipe.enhanced` is **strictly preserved** on `recipeToSave.enhanced`.
       - `recipeToSave.enhancedFitScore = wizardState.baseOriginalRecipe.enhancedFitScore || wizardState.baseOriginalRecipe._scoreEnhanced;`
   - Save to Firestore via `saveRecipe(recipeToSave)` and update store.

---

### Phase 3: Auto-Enhance Dynamic Row Updates & Free-Hand Search
1. In `src/components/recipe/RecipeEnhancementModalUI.js`:
   - **Dynamic Row Labels**:
     - In `recomputeModalPredictedScore()`:
       - Update row title dynamically: `Boost lean protein: ${adj.originalQty || ''}${adj.unit || 'g'} ➔ ${adj.proposedQty}${adj.unit || 'g'} ${adj.ingredientName}`.
       - Update row tag dynamically: compute row-specific delta protein or calories based on `adj.proposedQty` vs `adj.originalQty`.
       - Update household impact text dynamically.
   - **Free-Hand Ingredient Substitution & Custom Adjustments**:
     - Remove the forced, rigid two-tab switching interface. Replace with a unified view:
       - Section 1: Algorithmic Recommendations (with checkboxes, volume steppers, and dynamic labels).
       - Section 2: **"➕ Custom Adjustments & Swaps"**:
         - Dropdown or button: "Pick an Ingredient to Swap or Adjust" (lists current recipe ingredients).
         - Live Autocomplete Search: searches `state.products`.
         - **Auto-Default Ordering**: Products are sorted with `p.isAutoDefault === true` at the very top, followed by favorite products, then alphabetical.
         - Selecting a product adds an interactive swap adjustment to the list with volume steppers.
         - The live score badge and macro chips immediately recalculate based on the custom swap!
   - On "Accept & Apply Enhanced Variant":
     - Saves all checked adjustments (both algorithmic and custom free-hand swaps) into `recipe.enhanced` and `recipe.enhancedFitScore`.

---

## 3. Acceptance Criteria

### Item 1: Recipe Review Ingestion Mapping
- [x] Opening "Review Recipe" on any original recipe in Recipe Vault opens Step 2 without any existing ingredients marked as "✨ New Item".
- [x] Opening "Review Enhanced Recipe" on an enhanced recipe opens Step 2 with all enhanced ingredients properly recognized and mapped.
- [x] No warning banner about "Action Required: X ingredient(s) retain an unlinked status" appears for recipes with valid products.
- [x] Autocomplete dropdown in Step 2 includes products, categories, and ingredients, displaying product names and categories cleanly.

### Item 2: Variant-Aware Wizard Persistence
- [x] Reviewing and saving an Original recipe retains the recipe's `enhanced` variant and `enhancedFitScore` in Firestore and store (never wiped).
- [x] Reviewing and saving an Enhanced recipe saves changes directly to `recipe.enhanced` and `recipe.enhancedFitScore` without overwriting the base original recipe.
- [x] Spicy Dan Dan Noodles retains its enhanced variant permanently across reloads and edits.

### Item 3: Auto-Enhance Dynamic Labels & Free-Hand Search
- [x] Stepping volume `[-]` / `[+]` or editing quantity immediately updates the row title (e.g. `320g ➔ 400g`), delta badge, and household impact text.
- [x] Rigid two-tab layout is replaced by a clear unified interface.
- [x] Users can free-hand search for product swaps/substitutions.
- [x] Product search results strictly rank `isAutoDefault: true` products at the top.
- [x] Selecting a custom product swap updates live Fit Score and macro cards.
- [x] Applying the enhancement saves both algorithmic and custom swaps to `recipe.enhanced`.

### Regression & Integrity
- [x] Automated verification suite `scripts/test_recipe_review_and_auto_enhance_flow.js` updated and passing.
- [x] New test `scripts/test_variant_save_and_taxonomy_mapping.js` verifies variant save isolation and product mapping.
- [x] All existing test suites pass (`test_vault_recipe_card_menu.js`, `test_ledger.js`, `test_shopping_list.js`).
- [x] `npm run build` succeeds cleanly.

---

## 4. Implementation Steps

1. **Phase 1: Taxonomy & Linked Mapping Engine**
   - Update `RecipeWizardTaxonomySearch.js`: Add product resolution to `getTaxonomyLabel` and dropdown autocomplete with auto-default ranking.
   - Update `RecipeWizardStep2View.js`, `RecipeWizardStep2Handlers.js`, and `RecipeWizardStep3Handlers.js`: Use unified `isIngredientUnlinked` helper.
   - Update `RecipeWizardState.js`: Handle `prod:` prefix in `syncStep2InputsToState`.
   - Update `UnlinkedSweeperUI.js`: Include `productId` and `bankId` in linked scan.

2. **Phase 2: Variant-Aware Wizard Persistence**
   - Update `RecipeWizardModal.js`: Cache `baseOriginalRecipe` and variant mode.
   - Update `RecipeWizardStep3View.js`: Show contextual save button labels.
   - Update `RecipeWizardStep3Handlers.js`: Save into `recipe.enhanced` if `activeVariant === 'enhanced'`, and preserve `enhanced` if `activeVariant === 'original'`.

3. **Phase 3: Auto-Enhance UI Polish & Free-Hand Search**
   - Update `RecipeEnhancementModalUI.js`:
     - Re-render row labels, delta badges, and impact text dynamically on stepper change.
     - Add free-hand product swap interface with `isAutoDefault: true` prioritization.
     - Support custom user swaps in `buildLiveEnhancedRecipe()`.

4. **Phase 4: Automated Testing & Production Build**
   - Write `scripts/test_variant_save_and_taxonomy_mapping.js`.
   - Run full regression suite and verify zero ledger issues.
   - Build production assets with `npm run build`.
   - Provide comprehensive manual test checklist.
