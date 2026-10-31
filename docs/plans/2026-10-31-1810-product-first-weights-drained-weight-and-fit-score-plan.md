---
title: Product-First Weights with Measurement Unit Converters & Drained Weight Normalization
type: fix
date: 2026-10-31
topic: product-first-weights-unit-converters-fit-score
---

# Product-First Weights with Measurement Unit Converters & Drained Weight Normalization

> Created: 2026-10-31  
> Status: Approved Architecture  
> Branch: dev/recipe-bulk-parse-instruction-fix  

---

## 1. Core Principle & Architecture

We draw a strict, clean architectural boundary between **Units of Measurement** and **Food Items**:

1. **Units of Measurement belong in the Unit Converter ([`UnitConversionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/UnitConversionService.js)):**
   - Standard culinary measures that describe *how much* was added:
     - `pinch` $\rightarrow$ 0.5g
     - `dash` / `splash` $\rightarrow$ 0.5g / 0.5ml
     - `drizzle` $\rightarrow$ 5ml
     - `sprig` $\rightarrow$ 2g
     - `leaf` $\rightarrow$ 1g
     - `clove` $\rightarrow$ 6g
     - `handful` $\rightarrow$ 30g
     - `tsp` $\rightarrow$ 5g / 5ml
     - `tbsp` $\rightarrow$ 15g / 15ml
   - Measurement units convert to grams/ml via standard culinary densities, regardless of the linked product.

2. **Food Item Weights belong in the Linked Product Bank ([`ProductRepository.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/repositories/ProductRepository.js) / [`NutritionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/NutritionService.js)):**
   - Countable food items (`qty`, `item`, `count`) like *sausages, peppers, tortillas, onions, olives, rolls* must **never** be hardcoded in food dictionaries.
   - Their weights are resolved directly from the **linked supermarket product**:
     1. **Direct Item Weight:** `product.itemWeight` (e.g. 45g per sausage, 150g per pepper).
     2. **Auto-Derived from Pack & Count:** If `itemWeight` is missing, derive it from `product.packSize / product.itemCount` (e.g. 270g pack with 6 count = 45g per sausage).
     3. **Auto-Derived from Product Title:** If count is in the name (e.g. *"6 Vegan Sausages"*, *"8 Corn Tortillas"*), derive `product.packSize / count`.
     4. **Single Produce Items:** If product is sold as *"Each"* (e.g. *Aubergine Each*), use `product.packSize`.
     5. **Canned/Jarred Ceilings:** Discrete counts of jarred/canned goods (e.g. 20 olives) are bounded by the product's `drainedWeight` (190g), preventing multi-kilogram explosions.

3. **Canned Goods Gross-to-Drained Weight Normalization:**
   - In [`NutritionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/NutritionService.js), `calculateItemNutritionalWeight` checks `product.packSize` (fixing the bug where it checked `netWeight`).
   - When a recipe specifies a gross can size (e.g. `400g tin black beans` or `400g can chickpeas`), the system normalizes the weight to the consumed **`product.drainedWeight` (240g)** before calculating macros.

4. **Vault FitScoreBadge Transparency:**
   - In [`FitScoreBadge.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/FitScoreBadge.js), differentiate mathematically valid `score = 0%` (Poor Match) from `isMissingMacros = true`.
   - Render `🔴 0%` with full tooltip breakdown instead of the neutral `⚪ --` ("Missing Calorie/Protein Data").

---

## 2. Implementation Tasks

### Task 1: Parser Post-Fixed Measurement Units
In [`src/services/RecipeIngredientParser.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/RecipeIngredientParser.js):
- Recognize trailing measurement units: `sprigs?`, `leaves?`, `leaf`, `cloves?`, `slices?`, `stalks?`, `heads?`, `bulbs?` when preceded by the ingredient name.
- E.g. `"4 rosemary sprigs"` $\rightarrow$ `qty: 4, unit: "sprig", name: "Rosemary"`.
- E.g. `"2 large bay leaves"` $\rightarrow$ `qty: 2, unit: "leaf", name: "Bay Leaves"`.
- E.g. `"3 thyme sprigs"` $\rightarrow$ `qty: 3, unit: "sprig", name: "Thyme"`.

### Task 2: Pure Measurement Units in UnitConversionService
In [`src/services/UnitConversionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/UnitConversionService.js):
- Ensure measurement units have precise gram/ml conversions:
  - `sprig: 2`, `sprigs: 2`
  - `leaf: 1`, `leaves: 1`
  - `pinch: 0.5`, `pinches: 0.5`, `dash: 0.5`, `dashes: 0.5`
  - `drizzle: 5`, `drizzles: 5`, `splash: 5`, `splashes: 5`
  - `clove: 6`, `cloves: 6`
  - `handful: 30`, `handfuls: 30`
- Remove food-type hardcoding and rely on the product resolution pipeline for countable food items.

### Task 3: Product-First Discrete Weight Resolution & Auto-Derivation
In [`src/services/NutritionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/NutritionService.js):
- Implement `resolveProductItemWeight(product)`:
  1. Return `product.itemWeight` if $> 0$.
  2. If `packSize > 0` and `itemCount > 1`, return `packSize / itemCount`.
  3. Extract leading counts from product name (e.g. `"6 Vegan Sausages"`, `"8 Tortillas"`) $\rightarrow$ `packSize / count`.
  4. If product name includes `"Each"` and `packSize > 0`, return `packSize`.
- For discrete items (`qty`, `item`, `count`), use `resolveProductItemWeight(product)`.
- If an item is in a jar/can with `drainedWeight` (e.g. olives), clamp total calculated weight so it cannot exceed the product's `drainedWeight`.

### Task 4: Fix Drained Weight Normalization for Canned Goods
In [`src/services/NutritionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/NutritionService.js):
- In `calculateItemNutritionalWeight(product, requestedGramWeight)`:
  - Check `product.packSize` (not `product.netWeight`).
  - When `product.drainedWeight` is present and `requestedGramWeight` is approximately the gross pack size ($\pm 15\%$, e.g. 380g–420g for a 400g can of black beans), scale to `product.drainedWeight` (240g).
  - For partial gram quantities, scale by the drained ratio $\frac{\text{drainedWeight}}{\text{packSize}}$.

### Task 5: Recipe Vault FitScoreBadge Zero Score vs Missing Data Fix
In [`src/components/FitScoreBadge.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/FitScoreBadge.js):
- Check `isActuallyMissing = !fitResult || fitResult.isMissingMacros || fitResult.error || typeof fitResult.score !== 'number'`.
- Only render `⚪ --` if `isActuallyMissing` is true.
- If macros exist and `fitResult.score === 0`, render `🔴 0%` (Poor Match) with tooltip.

### Task 6: Automated Verification & Regression Tests
- Run unit conversion tests: `node scripts/test_unit_conversion.js`.
- Run parser tests: `node scripts/test_multi_recipe_parser.js`.
- Run shopping list tests: `node scripts/test_shopping_list.js`.
- Run ledger tests: `node scripts/test_ledger.js`.
- Run production build: `npm run build`.
- Simulate *Sausage Party Pizza* and canned beans to verify exact macros and scores.
