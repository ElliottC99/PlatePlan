---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Strictly Derive Discrete Item Weights from Product Bank Data

## Goal Capsule

- **Objective:** Ensure nutrition and macro calculations derive discrete item weights (`qty`, `item`, `count`) strictly and accurately from product bank data fields (`itemWeight`, `packSize / itemCount`, `drainedWeight`, `usablePackAmount`), supporting both root properties and nested `product.value` records.
- **Means:** 
  1. Enhance `resolveProductItemWeight` in `src/services/NutritionService.js` to systematically resolve:
     - Explicit 1 usable item size (`itemWeight`, `item_weight`, `usableItemSize`) at top-level or in `product.value`.
     - Ratio of `drainedWeight`, `usablePackAmount`, or `packSize` divided by `itemCount`.
     - Single packaged units packed in liquid with `drainedWeight` (e.g. mozzarella ball).
     - Natural counts embedded in product descriptors and notes (e.g. "6 Vegan Sausages", "Twin Pack", "2 Burgers").
     - Pack unit indicators (`each`, `item`).
  2. Maintain `drainedWeight` and `usablePackAmount` precedence for liquid-packed products in `calculateItemNutrition`.
  3. Add standalone regression test suite `scripts/test_product_item_weights.js`.
- **Authority Hierarchy:** Product Bank data integrity > Conversion heuristics > Fallback estimates.
- **Stop Conditions:**
  - `resolveProductItemWeight` reliably resolves single-item weights for products with explicit `itemWeight`, nested `value.itemWeight`, `packSize / itemCount`, and embedded pack counts.
  - 4 slices of `10 Reduced Fat Mild Slices` calculates at exactly 80g (144 kcal), not 400g.
  - All test suites (`scripts/test_unit_conversion.js`, `scripts/test_product_item_weights.js`, `scripts/test_shopping_list.js`) pass.

---

## Product Contract

### Problem Frame
When users review recipes in the Recipe Vault with discrete ingredient quantities (`qty`, `item`, `count`), if a product does not specify a single top-level `itemWeight`, the calculator previously failed to inspect nested `product.value` fields, `drainedWeight / itemCount`, or embedded item counts. Instead, it dropped to generic fallbacks (e.g. 100g/unit), producing inflated macros and inaccurate fit scores.

### Key Decisions
- **Decision 1 (Product Bank Truth):** Discrete weights must be derived strictly from product bank data (`itemWeight`, `packSize`, `itemCount`, `drainedWeight`, `usablePackAmount`).
- **Decision 2 (Banking Auto-Enhance Swaps):** Auto-enhance heuristic engine changes are banked for separate review; product mapping is handled directly by the user on the recipe.

---

## Implementation & Verification

### Affected Modules
- `src/services/NutritionService.js`: Updated `resolveProductItemWeight` and `calculateItemNutrition` to inspect root and nested `product.value` fields, prioritize `drainedWeight` for canned/brined goods, and compute `packSize / itemCount`.
- `scripts/test_product_item_weights.js`: Comprehensive regression suite verifying all product weight resolution paths.

### Verification Commands
```bash
node scripts/test_product_item_weights.js
node scripts/test_unit_conversion.js
node scripts/test_shopping_list.js
node --check src/services/NutritionService.js
npm run build
```
