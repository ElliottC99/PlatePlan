# Exploration: Recipe Review Ingredient Mapping, Variant Save Isolation, and Auto-Enhance Free-Hand Search

**Date:** 2026-11-02  
**Topic:** Recipe Review Ingestion Mapping, Enhanced Variant Preservation, and Auto-Enhance Free-Hand Search with Auto-Default Ranking  
**Author:** Antigravity  

---

## 1. Problem Statement & Root Cause Analysis

### Issue A: Existing Ingredients Appear as "✨ New Item" in Recipe Wizard Step 2 (Tests 2 & 3)
1. **Root Cause**:
   - In `RecipeWizardTaxonomySearch.js:15-34`:
     ```javascript
     export function getTaxonomyLabel(ingredientId, subtypeId, rawName = '', ingredientsBank = [], categoryId = null) {
       if (categoryId) return `📂 [Category] ${categoryId}`;
       if (!ingredientId || ingredientId === 'new_item') return `✨ New Item: ${rawName || 'Custom'}`;
       const ing = ingredientsBank.find(i => String(i.id) === String(ingredientId));
       if (!ing) return `✨ New Item: ${rawName || 'Custom'}`;
     ```
   - In PlatePlan, recipe ingredients are frequently mapped directly to **Products** (via `item.productId`, `item.bankId`, or `item.productName`), or have legacy family IDs (`fam_...`) that do not exist in the 3-tier root `ingredientsBank`.
   - `getTaxonomyLabel` completely ignores `item.productId`, `item.productName`, and `item.subtypeId`.
   - Furthermore, `RecipeWizardStep2View.js` lines 217 & 230 filter unlinked items with:
     ```javascript
     const unlinked = allIngs.filter(i => i.isNewTaxonomyItem || i.ingredientId === 'new_item' || (!i.ingredientId && !i.categoryId) || String(i.name || '').includes('✨ New'));
     ```
   - If an ingredient has `productId` and is fully mapped to a product (e.g., `productId: "ing1782490308502"`, "Toasted Sesame Oil"), because `(!i.ingredientId && !i.categoryId)` evaluates to `true`, it is wrongly classified as unlinked `✨ New Item` and blocks proceeding to Step 3.

### Issue B: Wizard Save Resets and Overwrites Enhanced Variant (Test 3)
1. **Root Cause**:
   - When reviewing an Enhanced recipe (`activeVariant === 'enhanced'`), `RecipeWizardModal.js` initializes `wizardState.activeRecipe` with the enhanced ingredients and method as the base recipe.
   - In `RecipeWizardStep3Handlers.js:311`:
     ```javascript
     if (hasDistinctEnhancedVariant(rec) && rec.enhanced) {
       recipeToSave.enhanced = rec.enhanced;
     }
     ```
   - `hasDistinctEnhancedVariant()` compares `recipe.ingredients` against `recipe.enhanced.ingredients`. Because both contain the enhanced ingredients, `hasDistinctEnhancedVariant()` returns `false`!
   - As a result, `recipeToSave.enhanced` was **completely omitted** from `recipeToSave`.
   - When saved, Firestore overwrote the recipe document, wiping `enhanced` completely.

### Issue C: Auto-Enhance Static Labels & Missing Free-Hand Search (Test 4)
1. **Root Cause**:
   - When quantity steppers (`[-]` and `[+]`) are altered in `RecipeEnhancementModalUI.js`, only the top-level macro pills and fit score recalculate. The adjustment row itself retains its initial pre-rendered text:
     - Header: `Boost lean protein: 320g ➔ 500g ...` (still says 500g when changed to 400g).
     - Subtext and impact pill: `+9.9g prot` (retains old delta).
   - **Rigid Two-Tab Routes**:
     - The modal locks users into two hard-coded generated routes ("Route 1: Protein Boost" vs "Route 2: Calorie Cut") that often ruin culinary balance (e.g., adding massive amounts of meat or dropping sauce inappropriately).
     - Users cannot manually select an ingredient from the recipe to swap or substitute.
     - Users need **free-hand search** across the entire product/pantry bank to pick their own substitutions or add ingredients, with search results strictly **ordered by `isAutoDefault: true`** so household favorites and preferred items appear first.

---

## 2. Recovery of "Spicy Dan Dan Noodles"

- **Status**: Recovered from `households_elliott-chloe_backup.json` (ID: `r1788293902486`).
- **Enhanced Variant Data**:
  - Name: "Spicy Dan Dan Noodles (enhanced)"
  - Fit Score: **100%**
  - Enhanced Per Serving Macros: 566 kcal, 36g protein, 41.8g carbs, 26.9g fat.
- **Implementation**:
  - Saved exact JSON payload into `src/config/restoredDanDan.js`.
  - Added `window.restoreDanDanNoodles()` in `src/main.js`.
  - Added automatic hydration trigger in `main.js`: if `r.id === 'r1788293902486'` has lost its `enhanced` object, it automatically restores it to Firestore and updates state.

---

## 3. Proposed Solutions

### Solution 1: Universal Product & Subtype Taxonomy Resolution for Step 2
1. Update `getTaxonomyLabel(item, ingredientsBank, productsBank)`:
   - Accept the full `item` object.
   - If `item.categoryId`, display `📂 [Category] ${item.categoryId}`.
   - If `item.productId` or `item.bankId`:
     - Look up product in `productsBank`.
     - If found: display `📦 ${product.name} [${product.category || 'Pantry'}]`.
   - If `item.subtypeId`:
     - Look up subtype in `ingredientsBank`.
     - If found: display `🏷️ ${sub.name} (${parentIng.name})`.
   - Use `resolveProductForIngredient(item, { products, ingredients })` as canonical fallback.
   - Only return `✨ New Item` if truly unresolvable.
2. In `RecipeWizardStep2View.js` and `RecipeWizardStep2Handlers.js`:
   - An item is unlinked ONLY if `!resolveProductForIngredient(item, { products, ingredients }) && !item.categoryId && !item.ingredientId`.

### Solution 2: Variant-Aware Wizard Persistence
1. Maintain clean separation between base original recipe and enhanced variant:
   - When reviewing `variant === 'original'`:
     - Base fields are edited.
     - `recipeToSave.enhanced = originalRecipe.enhanced` (strictly preserved, never wiped).
   - When reviewing `variant === 'enhanced'`:
     - Changes are saved to `recipeToSave.enhanced`.
     - Base fields remain intact as original.
     - Save button says "💾 Save Enhanced Variant".

### Solution 3: Auto-Enhance Dynamic Labels & Free-Hand Search
1. **Dynamic Stepper Labels**:
   - In `recomputeModalPredictedScore()`, update the adjustment card's title text (e.g. `320g ➔ ${proposedQty}g`), delta pill, and household impact dynamically.
2. **Free-Hand Ingredient Substitution & Search**:
   - Add a "Add / Swap Ingredient" free-hand search input to the modal.
   - Let users pick any ingredient from the recipe or search the pantry bank.
   - Autocomplete search queries across `state.products`:
     - **Sort Priority**: `isAutoDefault: true` products ranked at the top, followed by household favorites, then alphabetical.
   - Selecting a product creates a live swap adjustment that immediately recalculates macros and fit score!
3. **Flexible Interface**:
   - Replace or augment the rigid two-tab system with a unified review canvas where users can toggle algorithm adjustments or customize via free-hand substitutions.

---

## 4. Verification Strategy
- Test restore of Spicy Dan Dan Noodles.
- Automated tests verifying:
  - Mapped products with `productId` do not show as "✨ New Item".
  - Reviewing and saving original recipe preserves `recipe.enhanced`.
  - Reviewing and saving enhanced variant updates `recipe.enhanced` without altering base recipe.
  - Auto-Enhance free-hand search returns products ordered by `isAutoDefault`.
  - Volume steppers dynamically update row titles and macro deltas.
