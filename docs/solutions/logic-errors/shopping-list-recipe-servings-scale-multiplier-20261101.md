---
date: "2026-11-01"
problem_type: "logic_error"
component: "service_object"
severity: "high"
symptoms:
  - "Shopping list showed 6qty Red Peppers for Harissa Chicken & Grain Salad instead of 3qty for 4 planned servings (2 people over 2 days)"
  - "Shopping list ingredient breakdown doubled purchases for any recipe yielding more than 2 servings"
  - "False-positive ingredient matching in getCanonicalIngredientId where String(undefined) === String(undefined) collapsed distinct ingredients to the first bank entry"
root_cause: "wrong_assumption"
tags:
  - shopping-list
  - recipe-scaling
  - servings-multiplier
  - undefined-matching
related_issues: []
related_solutions:
  - "docs/solutions/logic-errors/single-truth-recipe-yield-and-canonical-quantity-preservation-20261101.md"
last_referenced: "2026-11-01"
---

# Shopping List Recipe Servings Scaling & Multiplier Bug

## Problem Statement

**What happened:**
In Step 3 of the Meal Planner Wizard and the Shopping List view, a 4-serving recipe ("Harissa Chicken & Grain Salad") calling for 3 Red Peppers was planned for 2 people over 2 days ($2 \times 2 = 4$ total servings). Instead of buying 3 Red Peppers ($1.0 \times \text{yield}$), the shopping list required 6 Red Peppers ($2.0 \times \text{yield}$).

**Impact:**
Households using recipes yielding 4, 6, or 8 portions were severely over-purchasing ingredients (e.g. buying 8 portions of ingredients for a 4-portion plan, an inflation of $200\%$). Conversely, single-portion recipes (yielding 1 portion, e.g. smoothies or omelettes) had their quantities halved, resulting in a $50\%$ under-purchase. Estimated basket costs were also distorted.

---

## Symptoms

1. **Inflated Ingredient Quantities in Shopping Breakdown:**
   - Recipe Usage Breakdown drawer for "Red Peppers Each" displayed:
     - Cheesy Chilli Macaroni: `1qty`
     - Harissa Chicken & Grain Salad: `6qty`
     - Total: `7qty`
   - Harissa Chicken was planned for 4 person-portions, so expected quantity was 3.

2. **Ingredient Bank Collision (Caught During Testing):**
   - When ingredients lacked `id` and `groupId` properties, `getCanonicalIngredientId` checked:
     `String(b.groupId) === String(item.groupId)`
     Because both evaluated to `"undefined"`, the check was truthy for the first element in `ingredientsBank`, causing unrelated ingredients (e.g. Chicken Breast) to merge into the first ingredient (e.g. Red Peppers).

---

## Investigation Steps

### What Was Tried

| Attempt | Hypothesis | Result |
|---|---|---|
| 1. Hardcoded portion weight inspection | Investigated why slot loops produced 6qty for 4 slots | ❌ Found `weight = (slotKey.endsWith('E') \|\| slotKey.endsWith('C')) ? 0.5 : 1` in `ShoppingCalculationService.js:258`. The code assumed every recipe serves 2. |
| 2. Slot-level rounding to 1 decimal place | Evaluated `Math.round((strict.qty * scaleMultiplier) * 10) / 10` per slot | ❌ Rounding per slot caused accumulation drift ($3/4 = 0.75 \to 0.8 \times 4 = 3.2$ peppers instead of 3.0). |
| 3. Dynamic yield scaling with unrounded intermediate accumulation | Used `scaleMultiplier = targetServings / baseServings`, kept precise float quantities during slot loops, and rounded at item/summary level | ✅ Produced exact integer and chef-accurate quantities across 1-, 2-, 4-, and 6-serving recipes ($4 \times 0.75 = 3.0$). |

### Key Discoveries

1. **Recipe Yield Ignored in Calculation:**
   `ShoppingCalculationService.js` was written under the naive assumption that all recipes serve 2, hardcoding `portionWeight = 0.5` per person slot (`lunchE`, `lunchC`). It completely ignored `fullRecipe.serves`.
2. **JavaScript String Casting Trap:**
   `String(undefined) === String(undefined)` evaluates to `true` (`"undefined" === "undefined"`). Property equality checks between objects must always verify that properties are defined before comparing string representations.

---

## Root Cause Analysis

In `src/services/ShoppingCalculationService.js`:
```javascript
// Former lines 258 & 218:
const weight = (slotKey.endsWith('E') || slotKey.endsWith('C')) ? 0.5 : 1;
...
const convertedAmount = Math.round((strict.qty * portionWeight) * 10) / 10;
```
1. `weight` was hardcoded to `0.5` for any individual slot.
2. For Harissa Chicken (`serves: 4`, 3 peppers), 1 person portion is $1/4 = 0.25$ of the recipe yield.
3. Multiplying by $0.5$ for 4 slots yielded $4 \times (0.5 \times 3) = \mathbf{6\text{ Red Peppers}}$, doubling the purchase.
4. For Cheesy Chilli Macaroni (`serves: 2`, 1 pepper), $2 \times (0.5 \times 1) = \mathbf{1\text{ Red Pepper}}$. The hardcoded `0.5` coincidentally matched 2-serving recipes, masking the flaw.

---

## Working Solution

### 1. Dynamic Scaling Formula in `src/services/ShoppingCalculationService.js`
```javascript
const processSlotNode = (slotNode, personCount = 1, dayNum = 1, mealType = 'meal') => {
  if (!slotNode || slotNode.isSkipped || slotNode.skipped) return;
  if (slotNode.isSplit && (slotNode.elliott || slotNode.chloe)) {
    if (slotNode.elliott) processSlotNode(slotNode.elliott, 1, dayNum, mealType);
    if (slotNode.chloe) processSlotNode(slotNode.chloe, 1, dayNum, mealType);
    return;
  }
  const recipeId = typeof slotNode === 'string' ? slotNode : (slotNode.recipeId || slotNode.id);
  if (!recipeId) return;

  const fullRecipe = vaultRecipes.find(r => r && String(r.id) === String(recipeId));
  if (!fullRecipe) return;

  const baseServings = Math.max(1, Number(fullRecipe.serves || fullRecipe.servings || 2) || 2);
  const targetServings = Number(slotNode?.servings || personCount || 1) || 1;
  const scaleMultiplier = targetServings / baseServings;
  ...
  const strict = convertToStrictUnit(rawQty, rawUnit, rawName);
  const slotQty = strict.qty * scaleMultiplier;
  ...
  existing.buyQty += slotQty;
  existing.requiredQty += slotQty;
  existing.recipeBreakdown.push({
    cookingEventId, recipeName, day: dayNum, mealType,
    servings: targetServings, qty: Math.round(slotQty * 100) / 100
  });
};

Object.entries(rawSlots).forEach(([dayKey, dayObj], dayIdx) => {
  if (!dayObj || typeof dayObj !== 'object') return;
  const dayNum = dayIdx + 1;
  Object.entries(dayObj).forEach(([slotKey, slotVal]) => {
    const personCount = (slotKey.endsWith('E') || slotKey.endsWith('C')) ? 1 : 2;
    const mealType = slotKey.replace(/[EC]$/, '');
    processSlotNode(slotVal, personCount, dayNum, mealType);
  });
});
```

### 2. Defending Against `String(undefined)` Equality
```javascript
  const rawName = String(item.name || item.ingredient || item.productName || item.raw || '').toLowerCase().trim();
  if (Array.isArray(ingredientsBank) && ingredientsBank.length && rawName) {
    const matched = ingredientsBank.find(b => 
      (item.id && b.id && String(b.id) === String(item.id)) ||
      (item.groupId && b.groupId && String(b.groupId) === String(item.groupId)) ||
      (rawName && String(b.name || '').toLowerCase().trim() === rawName)
    );
    if (matched) return String(matched.id);
  }
```

---

## Prevention Strategies

1. **Never Hardcode Ratio Constants When Yield Metadata Exists**:
   Always reference `recipe.serves` (or `recipe.servings`) as the denominator when scaling recipes.
2. **Postpone Intermediate Rounding**:
   Perform calculations on unrounded floating-point numbers during aggregation loops and apply `Math.round(val * 10) / 10` only at the presentation / persistence boundary.
3. **Guard String Conversions in Equality Checks**:
   Never compare `String(a) === String(b)` without verifying that both `a` and `b` are truthy/defined, as `"undefined" === "undefined"` is true.
4. **Automated Serving Scaling Test Suite**:
   Maintain `scripts/test_shopping_servings_multiplier.js` verifying 1-, 2-, 4-, and 6-serving yield math across shared and split meal slots.
