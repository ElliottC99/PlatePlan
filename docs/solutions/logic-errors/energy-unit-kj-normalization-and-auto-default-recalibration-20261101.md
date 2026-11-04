---
date: "2026-11-01"
problem_type: "logic_error"
component: "nutrition_service"
severity: "high"
symptoms:
  - "Disproportionately high calorie calculations for certain products (e.g. 1,885 kcal for THIS Fillet Steak, 1,784 kcal for a can of butter beans)"
  - "Pantry Auto-Default Strategy dropdown in preferences and manual recalibrate button do nothing (0 ingredients updated)"
  - "Entering 'Coconut Rice' into recipes produces massive calorie counts (>1,800 kcal) due to matching Desiccated Coconut"
root_cause: "unit_mismatch_and_comparator_miscall"
tags:
  - nutrition
  - atwater-energy
  - auto-default-strategy
  - taxonomy-mapping
  - unit-conversion
related_issues:
  - "docs/solutions/logic-errors/recipe-wizard-dynamic-macros-and-packsize-normalization-20261031.md"
  - "docs/solutions/logic-errors/product-first-weights-drained-weight-and-fit-score-zero-20261031.md"
---

# Energy Unit kJ Normalization, Auto-Default Recalibration, and Compound Taxonomy

## Problem Statement
Users observed that recipes involving certain ingredients (such as THIS Fillet Steak, Summer Pride Butter Beans, or Gaeng Phed Ped Yang with Coconut Rice) yielded massive calorie counts. Furthermore, setting the **Auto-Default Strategy** preference to `highest_protein_per_kcal` failed to update ingredient defaults in the pantry.

## Root Causes

1. **UK/EU Nutrition Declarations (kJ listed before kcal):**
   Under mandatory UK/EU food labelling laws, energy is declared as `857 kJ / 205 kcal` with kilojoules listed first. During Tesco bookmarklet scraping or manual entry, the first numeric token (`857`) was captured into `cal`. Because `normalizeEnergyKcal` only divided by 4.184 if `value > 2500`, values between 100 and 2,500 were saved as `cal`, resulting in a $4.2\times$ inflation of recipe calories.

2. **Comparator Miscall in `sweepAndRecalibrateIngredientDefaults`:**
   In `HydrationService.js`, the code called `compareProductsByStrategy(matchedProducts, criterion)`. However, `compareProductsByStrategy(a, b, criterion)` is a two-item comparator for sorting, not an array processor. Passing `(array, string)` caused `a.price` and `b.price` to evaluate as `undefined`, returning `0`. `bestProduct.id` was `undefined`, and zero ingredients were ever recalibrated.

3. **Compound Taxonomy Stemming Collision ("Coconut Rice"):**
   "Coconut Rice" stemmed to "Coconut", which matched `East End Desiccated Coconut` (633 kcal, 62g fat per 100g) rather than `Jasmine Rice` (136 kcal per 100g), adding over 1,450 phantom calories to any dish containing coconut rice.

## Solution

### 1. Atwater Energy Cross-Validation (`NutritionService.js`)
Implemented Atwater energy cross-validation:
$$\text{Atwater Energy} = (4 \times \text{prot}) + (4 \times \text{carb}) + (9 \times \text{fat}) + (2 \times \text{fibre})$$
If the ratio $\frac{\text{cal}}{\text{Atwater}}$ is between $3.4$ and $5.2$ (the exact mathematical signature of kilojoules: $4.184\text{ kJ/kcal}$), the value is automatically divided by 4.184 and rounded.

Added a runtime safeguard in `calculateItemNutrition`:
```javascript
const cleanCal = normalizeEnergyKcal(rawCal, rawProt, rawCarb, rawFat, rawFibre);
const calVal = cleanCal * scale;
```
Even if unscrubbed products exist in Firestore, recipe macro rollups neutralize the kJ inflation at runtime.

### 2. Array Sorting in `sweepAndRecalibrateIngredientDefaults` (`HydrationService.js`)
Fixed the array sort call and repository write method:
```javascript
const sorted = [...matchedProducts].sort((a, b) => compareProductsByStrategy(a, b, criterion));
const bestProduct = sorted[0];
if (bestProduct && String(ing.defaultProductId || '') !== String(bestProduct.id)) {
  updatedCount++;
  return { ...ing, defaultProductId: bestProduct.id, updatedAt: new Date().toISOString() };
}
```

### 3. Canonical Compound Synonyms (`RecipeIngredientParser.js`)
Introduced `CANONICAL_COMPOUND_SYNONYMS`:
```javascript
export const CANONICAL_COMPOUND_SYNONYMS = {
  'coconut rice': 'jasmine rice',
  'thai coconut rice': 'jasmine rice',
  'curry rice': 'jasmine rice',
  'garlic rice': 'jasmine rice'
};
```
This guarantees compound dishes match the core staple grain rather than falling back to high-fat adjectives.

## Prevention Strategies
- Always cross-validate declared energy against macronutrients when scraping or accepting food database entries.
- Always use `.sort((a, b) => comparator(a, b, criterion))` when using multi-strategy comparator functions.
