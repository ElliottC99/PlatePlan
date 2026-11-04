---
date: "2026-11-01"
problem_type: "logic_error"
component: "javascript_logic"
severity: "high"
symptoms:
  - "Step 2 scaling permanently halved or altered author ingredient quantities on save (i.qty = scaledQty)"
  - "Ghost and redundant serving parameters (currentServings, targetServings, baseServings) caused state drift"
  - "Double-scaling of recipe macros occurred when servings were adjusted in Step 3 review"
  - "Recipe method instructions became incongruous with ingredient amounts (e.g. text states 'divide into 8 balls' but ingredients only contained flour for 2)"
root_cause: "incorrect_algorithm"
tags:
  - "recipe-wizard"
  - "recipe-servings"
  - "nutrition"
  - "macros"
  - "scaling"
related_issues: []
last_referenced: "2026-11-01"
status: "active"
---

# Single-Truth Recipe Yield Architecture & Canonical Quantity Preservation

## Problem Statement

The Recipe Wizard previously divided servings into three distinct, competing concepts:
1. `baseServings`: what the parsed text originally stated.
2. `currentServings`: an obsolete mirror of `baseServings` from an old manual input form.
3. `targetServings`: how many portions the user wanted to scale the recipe to before saving.

This architecture violated core Recipe Management System (RMS) principles:
- **Destructive Mutation**: When a user selected 2 servings in Step 2, the wizard permanently halved the ingredient quantities in the DOM and saved the mutated amounts (`item.qty = scaledQty`) to Firestore. The author's original quantities were permanently lost.
- **Method Incongruity**: Instructions written for the author's yield (e.g. *"Divide dough into 8 equal balls; wrap 4 in clingfilm to freeze"*) became detached from the ingredients in the database (which were reduced to 250g of flour, only enough for 2 small balls).
- **Macro Double-Scaling**: Step 3 had an independent `Servings` input (`#tp-serving-size`). If a user edited this input, `recalculateWizardMacros` divided the already-halved ingredient quantities by the new serving number, severely distorting calories and protein.

---

## Symptoms Observed

- *Sausage Party Pizza* (making 8 pizzas across 1kg flour, 8 sausages, 140ml oil, 20 olives) defaulted to `baseServings = 4` because of a missing header. Scaling to 2 servings reduced 8 pizzas to 4 pizzas, and divided by 2 servings = 2 entire pizzas per person ($\approx 2,000$ kcal).
- Re-opening or scaling a recipe in the meal planner multiplied against the already-mutated base.
- Dead fields (`currentServings`, `targetServings`) caused ghost state warnings in tests.

---

## Root Cause Analysis

1. **Conflation of Recipe Template with Cooking Execution**: The Recipe document in the Vault is a static template that must preserve the author's yield and unscaled ingredient quantities. Cooking portions (e.g. Elliott & Chloe cooking 2 portions tonight) are runtime execution concerns that belong in the Meal Planner and Cooking Modal, not in the permanent recipe storage.
2. **DOM-to-State Quantity Overwriting**: In `syncStep2InputsToState` and `onSaveRecipe`, `item.scaledQty` was written directly into `item.qty`, discarding `baseQty`.

---

## Working Solution

### 1. Single-Truth Yield Model (`src/components/recipe/RecipeWizardState.js`)

Eliminated `currentServings` and `targetServings` completely. Every recipe now stores a single, immutable author yield:
```javascript
activeRecipe: {
  title: '',
  servings: 4, // Canonical Recipe Yield
  prepTime: { hours: 0, minutes: 15 },
  cookTime: { hours: 0, minutes: 30 },
  ...
}
```

### 2. Single Input in Step 1A Manual Form (`src/components/recipe/RecipeWizardViews.js`)

Replaced the dual "Current Servings" and "Target Servings" inputs with a single input:
```html
<div>
  <label for="wiz-servings" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">Recipe Yield (Servings)</label>
  <input type="number" id="wiz-servings" name="servings" value="${recipe.servings || 4}" min="1" max="50" ... />
</div>
```

### 3. Non-Destructive Step 2 Mapping (`src/components/recipe/RecipeWizardStep2View.js` & `RecipeWizardStep2Handlers.js`)

- Removed `scaleFactor`, `scaledQty`, and DOM quantity mutation loops.
- Replaced the destructive scaling banner with an informational yield banner:
  ```html
  <div class="wiz-servings-banner" id="wiz-servings-banner" ...>
    <span>Recipe Mapping | Canonical Author Quantities</span>
    <span>Yield: <input id="wiz-servings-input" value="${servings}"> servings</span>
  </div>
  ```
- Quantities rendered in table rows strictly represent `item.qty` (unscaled author quantities).
- Editing `wiz-servings-input` updates `recipe.servings` and recalculates per-portion macros without touching the physical ingredient quantities.

### 4. Canonical Macro Calculation & Persistence (`src/components/recipe/RecipeWizardStep3Handlers.js`)

In `recalculateWizardMacros`:
```javascript
const serves = Number(recipeObj.servings || recipeObj.serves || 4) || 4;
allIngredients.forEach(item => {
  const qty = Number(item.qty ?? item.amount ?? 1) || 1;
  const nut = calcFn(matchedProduct, qty, item.unit || 'g');
  totalCal += nut.kcal;
  totalProt += nut.protein;
  totalCarb += nut.carbs;
  totalFat += nut.fat;
});
const perServing = {
  calories: Math.round(totalCal / serves),
  protein: Math.round((totalProt / serves) * 10) / 10,
  carbs: Math.round((totalCarb / serves) * 10) / 10,
  fat: Math.round((totalFat / serves) * 10) / 10
};
```
In `onSaveRecipe`:
Writes canonical unscaled `qty` to Firestore, sets `servings: safeServings`, and drops `targetServings` and `baseServings`.

### 5. Dynamic Runtime Scaling (`RecipeDetailModalService.js` & `ShoppingListService.js`)

When cooking or shopping for 2 portions from a 4-serving recipe:
$$\text{Multiplier} = \frac{\text{Meal Servings (2)}}{\text{Recipe Yield (4)}} = 0.50x$$
The recipe in the database remains pristine, while the shopping list and cooking view project the exact portions needed.

---

## Prevention Strategies

1. **Store Data Unscaled, Compute on Read**: Never mutate base ingredient quantities in the database. Perform scaling dynamically on read.
2. **Strict Single Responsibility for Serving Fields**: A Recipe document has only `servings` (Yield). A planned meal has `meal.servings` (Cooking Portions).
3. **Decouple Cooking Projections from Import Wizards**: The Recipe Wizard's sole responsibility is ingesting the recipe as written by the author.
