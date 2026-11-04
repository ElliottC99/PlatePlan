# Implementation Plan: Fix Shopping List Recipe Servings Scaling & Multiplier

> Date: 2026-11-01  
> Status: Implemented ✓  
> Focus: Correct shopping list quantity calculation so multi-serving recipes scale dynamically by `targetServings / baseServings` rather than a hardcoded `0.5` portion weight.  
> Target Files: `src/services/ShoppingCalculationService.js`, `scripts/test_shopping_servings_multiplier.js`  

---

## 0. Prior Solutions & Compound Findings

- **Compound Search Finding**: `docs/solutions/logic-errors/single-truth-recipe-yield-and-canonical-quantity-preservation-20261101.md`
  - In section 5 (*Dynamic Runtime Scaling*), it establishes the rule:
    $$\text{Multiplier} = \frac{\text{Meal Servings}}{\text{Recipe Yield}}$$
  - It established that a Recipe document in the Vault has only `servings` (canonical yield), while a planned meal has `meal.servings` (cooking portions).
  - While `ShoppingListService.js` had incorporated this scaling concept, the primary operational engine `ShoppingCalculationService.js` (used in Step 3 of the Meal Planner Wizard and the interactive shopping view) retained the legacy hardcoded `portionWeight = 0.5` per person slot (`lunchE`, `lunchC`).
  - This plan unifies `ShoppingCalculationService.js` with the documented single-truth dynamic scaling architecture.

---

## 1. Problem Definition & Context

### User Bug Report
In Step 3 of the Meal Planner Wizard and the Shopping List:
- **Red Peppers Each**: Displays total **7 qty**.
- Breakdown:
  - Cheesy Chilli Macaroni: **1 qty**
  - Harissa Chicken & Grain Salad: **6 qty**
- The user expected **3 qty** for Harissa Chicken & Grain Salad because:
  - The recipe serves 4 and requires 3 peppers.
  - The household planned 2 people for 2 days ($2 \times 2 = 4$ total servings).
  - 4 servings of a 4-serving recipe should buy exactly 3 peppers ($1.0 \times \text{yield}$), not 6!

### Root Cause
In `src/services/ShoppingCalculationService.js` (lines 128-261):
1. Line 258: `const weight = (slotKey.endsWith('E') || slotKey.endsWith('C')) ? 0.5 : 1;`
2. Line 131: `if (slotNode.elliott) processSlotNode(slotNode.elliott, 0.5, ...)`
3. Line 218: `const convertedAmount = Math.round((strict.qty * portionWeight) * 10) / 10;`

The calculation assumed every recipe serves 2, hardcoding `0.5` per person slot (`lunchE`, `lunchC`).
- For a recipe with `serves: 4`, 1 person eating 1 portion is $1/4 = 0.25$ of the recipe, not $0.5$!
- Multiplying by $0.5$ for 4 slots produced $4 \times 0.5 \times 3 = 6$ peppers (an 8-serving yield, $200\%$ over-purchase).
- Furthermore, rounding to 1 decimal place at the individual slot level ($0.75 \to 0.8$) can introduce rounding drift ($0.8 \times 4 = 3.2$).

---

## 2. Proposed Solution & Architecture

### Formula
For each slot node in the meal plan:
1. Determine `personCount`:
   - If slot key ends with `'E'` or `'C'` (or within a split slot for Elliott/Chloe): `personCount = 1`.
   - If un-suffixed / shared slot: `personCount = 2`.
2. Determine `targetServings`:
   - `targetServings = Number(slotNode?.servings || personCount || 1) || 1`.
3. Determine recipe baseline yield `baseServings`:
   - `baseServings = Math.max(1, Number(fullRecipe.serves || fullRecipe.servings || 2) || 2)`.
4. Calculate scale multiplier:
   - `scaleMultiplier = targetServings / baseServings`.
5. Calculate slot ingredient quantity:
   - `slotQty = strict.qty * scaleMultiplier`.
   - Keep precise intermediate quantity without premature integer/one-decimal rounding to avoid $4 \times 0.75 \to 3.2$ drift.
6. Record `servings: targetServings` in `recipeBreakdown`.
7. At the end of aggregation:
   - `entry.buyQty = Math.round(entry.buyQty * 10) / 10;`
   - `entry.requiredQty = Math.round(entry.requiredQty * 10) / 10;`
   - `rs.totalQty = Math.round(rs.totalQty * 10) / 10;`

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Update `ShoppingCalculationService.js`
- File: `src/services/ShoppingCalculationService.js`
- Change `processSlotNode(slotNode, personCount = 1, dayNum = 1, mealType = 'meal')`:
  - When `slotNode.isSplit`, pass `personCount = 1` to `processSlotNode(slotNode.elliott, 1, dayNum, mealType)` and `processSlotNode(slotNode.chloe, 1, dayNum, mealType)`.
  - Extract `baseServings = Math.max(1, Number(fullRecipe.serves || fullRecipe.servings || 2) || 2)`.
  - Extract `targetServings = Number(slotNode?.servings || personCount || 1) || 1`.
  - Compute `scaleMultiplier = targetServings / baseServings`.
  - Compute `slotQty = strict.qty * scaleMultiplier`.
  - Accumulate `existing.buyQty += slotQty` and `existing.requiredQty += slotQty`.
  - In `recipeBreakdown.push`:
    - Set `servings: targetServings`.
    - Set `qty: Math.round(slotQty * 100) / 100`.
- In `Object.entries(rawSlots)` loop:
  - `const personCount = (slotKey.endsWith('E') || slotKey.endsWith('C')) ? 1 : 2;`
  - Call `processSlotNode(slotVal, personCount, dayNum, mealType)`.

### Task 2: Automated Unit & Regression Tests
- Create `scripts/test_shopping_servings_multiplier.js`:
  - Test Case 1: 4-serving recipe (Harissa Chicken, 3 peppers) planned for 2 people $\times$ 2 days ($4 \text{ slots}$) $\to$ exactly **3 qty**.
  - Test Case 2: 2-serving recipe (Cheesy Chilli Macaroni, 1 pepper) planned for 2 people $\times$ 1 day ($2 \text{ slots}$) $\to$ exactly **1 qty**.
  - Test Case 3: Combined plan with both recipes $\to$ total **4 qty** Red Peppers (1 Cheesy Chilli Macaroni + 3 Harissa Chicken).
  - Test Case 4: 1-serving recipe (Protein Shake, 1 banana) planned for 1 person $\to$ exactly **1 qty** (verifying it does not purchase 0.5).
  - Test Case 5: 6-serving recipe (Batch Chilli, 600g mince) planned for 2 people $\times$ 2 days (4 servings) $\to$ exactly **400g** mince ($4/6 \times 600\text{g}$).
- Run all existing test suites:
  - `node scripts/test_shopping_list.js`
  - `node scripts/test_planner_wizard_pipeline.js`
  - `node scripts/test_recipe_enhancement_service.js`
  - `node scripts/test_delete_recipe_variant.js`

### Task 3: Build & Verification
- Run `npm run build` to update `dist/`.
- Verify no git warnings or syntax issues (`npm run dev` serving correctly).

---

## 4. Verification Checkpoints

1. [ ] `test_shopping_servings_multiplier.js` passes with 0 failures.
2. [ ] `test_shopping_list.js` passes.
3. [ ] `npm run build` succeeds cleanly.
4. [ ] Harissa Chicken & Grain Salad yields 3 qty Red Peppers for 4 servings.
5. [ ] Total Red Peppers is 4 qty (3 Harissa + 1 Cheesy Chilli Macaroni).
