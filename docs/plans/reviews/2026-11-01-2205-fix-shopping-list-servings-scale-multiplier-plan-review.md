# Plan Review: Fix Shopping List Recipe Servings Scaling & Multiplier

> Review Date: 2026-11-01  
> Plan: `docs/plans/2026-11-01-2205-fix-shopping-list-servings-scale-multiplier-plan.md`  
> Reviewer: Antigravity Assistant  
> Verdict: **READY TO EXECUTE (Approved) ✓**  

---

## 1. Executive Assessment

The plan directly targets the mathematical flaw responsible for doubling ingredient purchases in Step 3 of the Meal Planner Wizard (as reported by the user for Red Peppers in "Harissa Chicken & Grain Salad", showing 6 qty instead of 3 qty).

The scope is clean and disciplined:
1. Replaces the hardcoded `weight = 0.5` per person slot in `src/services/ShoppingCalculationService.js` with dynamic `scaleMultiplier = targetServings / baseServings`.
2. Prevents slot-level rounding drift ($4 \times 0.75 \to 3.2$) by keeping precise intermediate quantities during aggregation and rounding to 1 decimal place at the total item and recipe summary level.
3. Implements automated verification via `scripts/test_shopping_servings_multiplier.js` testing 1-, 2-, 4-, and 6-serving recipe scenarios across split and shared plan slots.

---

## 2. Checklist Evaluation

| Category | Item | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Requirements** | Clear problem statement | PASS | User report and screenshot reproduced mathematically ($4 \text{ slots} \times 0.5 \times 3 = 6$ vs $4 \times 0.25 \times 3 = 3$). |
| **Requirements** | Measurable success criteria | PASS | Harissa Chicken produces 3 qty; Cheesy Chilli Macaroni produces 1 qty; Total = 4 qty. |
| **Research** | Compound search & prior solutions | PASS | Cross-referenced `docs/solutions/logic-errors/single-truth-recipe-yield-and-canonical-quantity-preservation-20261101.md`. |
| **Research** | Codebase patterns referenced | PASS | Single-truth recipe servings and dynamic runtime scaling. |
| **Edge Cases** | 1-serving recipes (single bowls) | PASS | No longer halves ingredient quantity ($1/1 = 1.0\times$). |
| **Edge Cases** | 6-serving batch recipes | PASS | Accurately calculates $4/6 \times \text{baseQty}$. |
| **Edge Cases** | Split slot nodes (`isSplit: true`) | PASS | Passes `personCount = 1` for each of Elliott and Chloe. |
| **Edge Cases** | Floating-point rounding drift | PASS | Retains precise intermediate quantities so $4 \times 0.75 = 3.0$ rather than $4 \times 0.8 = 3.2$. |
| **Lifecycle** | Automated test suite | PASS | Dedicated test script `scripts/test_shopping_servings_multiplier.js` planned. |
| **Lifecycle** | Non-destructive / Type 2 | PASS | No Firestore schema or data migrations required. |

---

## 3. Deep Analysis & Critical Checks

### 1. Mathematical Rigor & Precision Drift Mitigation
In the current code:
```javascript
const convertedAmount = Math.round((strict.qty * portionWeight) * 10) / 10;
```
For a 4-serving recipe calling for 3 peppers, each slot needs $3 / 4 = 0.75$ peppers.
- If rounded to 1 decimal place at each slot: `Math.round(0.75 * 10) / 10 = 0.8`.
- Summed over 4 slots: $0.8 \times 4 = 3.2$ peppers!
- Under the plan's fix:
  - Intermediate slot amount keeps precise float value: `slotQty = strict.qty * scaleMultiplier` ($0.75$).
  - Summed across 4 slots: $0.75 \times 4 = 3.0$ peppers.
  - Final item total: `entry.buyQty = Math.round(3.0 * 10) / 10 = 3.0`!
  - Exact chef accuracy achieved.

### 2. Multi-Recipe Composition
In the user's plan:
- **Harissa Chicken & Grain Salad**: 4 person-slots $\times (1 / 4) \times 3 = \mathbf{3\text{ Red Peppers}}$
- **Cheesy Chilli Macaroni**: 2 person-slots $\times (1 / 2) \times 1 = \mathbf{1\text{ Red Pepper}}$
- **Total Red Peppers**: $3 + 1 = \mathbf{4\text{ qty}}$ (matching expected physical purchase and fixing the 7 qty in the user's screenshot).

---

## 4. Verdict & Recommendation

* **Verdict**: **Approved (Ready for `/work`)**
* **Recommendation**: Transition immediately to `/work` to implement the changes in `ShoppingCalculationService.js`, verify with automated tests, and rebuild `dist/`.
