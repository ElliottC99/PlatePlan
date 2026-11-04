---
title: Fix Product Energy Unit Ingestion, Auto-Default Recalibration, and Coconut Rice Taxonomy
type: fix
date: 2026-11-01
topic: product-kj-normalization-and-auto-default-recalibration
---

# Fix Product Energy Unit Ingestion, Auto-Default Recalibration, and Coconut Rice Taxonomy

> Created: 2026-11-01  
> Status: Implemented  
> Author: Antigravity (Advanced Agentic Coding) & Elliott  

---

## 1. Summary

This plan addresses three intertwined root causes that distort nutritional macros and defeat user preferences in PlatePlan:
1. **Energy Unit Ingestion Flaw (kJ stored as kcal):** Products imported from Tesco (or entered manually from UK back-of-pack tables) often store kilojoules (kJ) in the `cal` field ($4.2\times$ inflation) because UK packaging lists `kJ / kcal` with `kJ` first, and PlatePlan lacked Atwater macro cross-validation.
2. **Broken Auto-Default Strategy Recalibration:** `sweepAndRecalibrateIngredientDefaults()` in `HydrationService.js` invokes `compareProductsByStrategy(matchedProducts, criterion)` as if it took an array, whereas it is a two-item comparator `(a, b, criterion)`. The function returns `0`, causing all automatic pantry default recalibrations to silently fail and leave 41 ingredients stuck on high-calorie, low-protein products despite user preferences for `highest_protein_per_kcal`.
3. **"Coconut Rice" Taxonomy Match Trap:** Recipes listing "Coconut Rice" fall back to stem matching on "Coconut", assigning East End Desiccated Coconut (633 kcal, 62g fat per 100g) and adding ~1,450 phantom calories to a dish.

---

## 2. Problem Statement

### 2.1 The kJ Ingestion & Storage Bug
Under UK and EU food labelling regulations, the mandatory energy declaration is printed as:
$$\text{Energy: } \mathbf{857\text{ kJ}} \text{ / } 205\text{ kcal}$$
When the Tesco bookmarklet extracts the table or when a user inputs data, the first numeric value (`857`) is frequently captured into the `cal` / `kcal` field.
In `NutritionService.js`, `normalizeEnergyKcal` only divided by 4.184 if `value > 2500`. Products with values like `857 kJ` (THIS Fillet Steak) or `446 kJ` (Summer Pride Butter Beans) were stored as `857 kcal` and `446 kcal`. When recipes use these products, `NutritionService.calculateItemNutrition` scales the 857 directly, producing $4.2\times$ inflated calories.

### 2.2 Broken Recalibration in `HydrationService.js`
In `HydrationService.js` (line 70):
```javascript
const bestProduct = compareProductsByStrategy(matchedProducts, criterion);
```
Because `compareProductsByStrategy` takes `(a, b, criterion)`, calling it with `(matchedProducts, criterion)` evaluates `a.price` and `b.price` as `undefined`, returning `0`. `bestProduct.id` is `undefined`, so `sweepAndRecalibrateIngredientDefaults` updates 0 ingredients and does nothing.

### 2.3 Coconut Rice Stemming Trap
In `RecipeIngredientParser.js`, "Coconut Rice" stems to "Coconut", which resolves to `ing1788293496759` (Desiccated Coconut, 633 kcal / 100g). A 300g portion calculates to 1,899 kcal and 186g fat.

---

## 3. Prior Solutions

- `docs/solutions/logic-errors/recipe-wizard-dynamic-macros-and-packsize-normalization-20261031.md`
- `docs/solutions/logic-errors/product-first-weights-drained-weight-and-fit-score-zero-20261031.md`
- `docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md`

---

## 4. Proposed Solution & Architecture

### Component 1: Atwater-Based Energy Unit Validation (`NutritionService.js`)
Enhance `normalizeEnergyKcal` to take optional macronutrient parameters `(value, prot, carb, fat, fibre = 0)`:
$$\text{Atwater Energy} = (4 \times \text{prot}) + (4 \times \text{carb}) + (9 \times \text{fat}) + (2 \times \text{fibre})$$
If $\text{Atwater} > 15$ and the ratio $\frac{\text{cal}}{\text{Atwater}}$ is between $3.4$ and $5.2$, the value is unambiguously in kilojoules. Convert it automatically:
$$\text{cal} = \text{Math.round}(\text{cal} / 4.184)$$
Also add a defensive check inside `calculateItemNutrition(item, quantity, unit)`: if an unnormalized product is encountered during recipe scaling, apply this Atwater correction on the fly so legacy unscrubbed products cannot inflate recipe macros.

### Component 2: Fix Tesco Bookmarklet & Ingestion Service (`TescoImportService.js` & `index.html`)
In `TescoImportService.js`:
Pass parsed macronutrients to `normalizeEnergyKcal` during `parseTescoProduct`.
In `index.html` (the bookmarklet code):
Ensure the energy regex prioritizes the `kcal` token over the `kJ` token:
`var km = ct.match(/(\d+(?:\.\d+)?)\s*kcal/i);`
`var jm = ct.match(/(\d+(?:\.\d+)?)\s*kj/i);`
If only a kJ value is present, divide by 4.184.

### Component 3: Fix `sweepAndRecalibrateIngredientDefaults` (`HydrationService.js`)
Replace the broken call with a proper array sort:
```javascript
const sorted = [...matchedProducts].sort((a, b) => compareProductsByStrategy(a, b, criterion));
const bestProduct = sorted[0];
```
Clean up line 54 syntax chaining.
Include an in-memory / write-through repair pass in `CacheMaintenanceService.js` that checks existing products in the household catalog, detects kJ entries via Atwater signature, and corrects them.

### Component 4: Taxonomy Mapping for "Coconut Rice" (`RecipeIngredientParser.js`)
In `RecipeIngredientParser.js`, add an explicit alias mapping:
`coconut rice` $\rightarrow$ maps to `Jasmine Rice` (or `Rice`) rather than falling back to `Coconut` / `Desiccated Coconut`.

---

## 5. Acceptance Criteria

- [x] **AC 1 (Atwater kJ Normalization):** Given a product with `cal: 857`, `prot: 28`, `carb: 3.3`, `fat: 8`, `normalizeEnergyKcal` outputs `205 kcal`.
- [x] **AC 2 (Runtime Nutrition Guard):** `calculateItemNutrition` automatically corrects a product with kJ stored as calories so recipe calories are computed at ~205 kcal per 100g, not 857 kcal.
- [x] **AC 3 (Pantry Auto-Default Recalibration):** `sweepAndRecalibrateIngredientDefaults()` properly sorts matched products using `compareProductsByStrategy` and updates ingredients to match the active strategy (`highest_protein_per_kcal`).
- [x] **AC 4 (Settings UI Trigger):** Changing the Auto-Default Strategy dropdown or clicking "⚡ Recalibrate All Defaults Now" updates ingredients and reflects the new defaults in the UI.
- [x] **AC 5 (Coconut Rice Mapping):** Parsing "300g Coconut Rice" matches `Jasmine Rice` (136 kcal / 100g) rather than `Desiccated Coconut` (633 kcal / 100g).
- [x] **AC 6 (Test Suite):** Standalone node test suite verifying all 5 criteria passes cleanly without regressions.

---

## 6. Implementation Steps

1. **Step 1:** Update `src/services/NutritionService.js` to enhance `normalizeEnergyKcal` with Atwater macro cross-validation and add the runtime safeguard in `calculateItemNutrition`.
2. **Step 2:** Update `src/services/TescoImportService.js` and `index.html` bookmarklet to enforce `kcal` extraction over `kJ`.
3. **Step 3:** Fix `src/services/HydrationService.js` `sweepAndRecalibrateIngredientDefaults` to sort `matchedProducts` correctly with `compareProductsByStrategy`.
4. **Step 4:** Add "Coconut Rice" taxonomy mapping in `src/services/RecipeIngredientParser.js`.
5. **Step 5:** Add automated repair routine in `src/services/CacheMaintenanceService.js` to scrub legacy products in Firestore when hydrated.
6. **Step 6:** Create and run `scripts/test_energy_unit_and_auto_default.js` to verify all acceptance criteria.
7. **Step 7:** Run full regression checks (`test_unit_conversion.js`, `test_shopping_list.js`, `test_recipe_wizard_tuning.js`, `test_ledger.js`).
