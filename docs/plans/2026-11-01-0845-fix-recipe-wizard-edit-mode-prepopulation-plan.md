---
title: Fix Recipe Wizard Edit Mode Prepopulation
type: fix
date: 2026-11-01
topic: recipe-wizard-edit-mode-prepopulation
---

# Fix Recipe Wizard Edit Mode Prepopulation

> Created: 2026-11-01  
> Status: Draft  
> Branch: dev/recipe-bulk-parse-instruction-fix  

---

## 1. Problem Statement

When a user clicks **Edit Recipe** on any recipe card in the Recipe Vault (or from the detail view), the Recipe Wizard modal opens at Step 1 with **completely blank inputs** (empty title, default 4 servings, empty ingredients, empty instructions), instead of autofilling with the recipe's existing data.

---

## 2. Root Cause Analysis

1. **Broken State Accessor in `RecipeWizardModal.js`**:
   In [`src/components/recipe/RecipeWizardModal.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/recipe/RecipeWizardModal.js#L25):
   ```javascript
   const allRecipes = (typeof window !== 'undefined' ? (window.Store?.getState?.()?.recipes ?.recipes || []) : []);
   ```
   - Notice the broken chain and whitespace: `?.recipes ?.recipes`.
   - In PlatePlan, `getState().recipes` is an Array of recipe objects, not an object with a nested `.recipes` array.
   - Accessing `.recipes` on an Array evaluates to `undefined`, falling back to `[]`.
   - Consequently, `found = allRecipes.find(...)` is always `undefined`, so `wizardState.activeRecipe` was never populated when editing an existing recipe.

2. **Prep/Cook Time Type Normalization**:
   In Firestore, some recipes store `prepTime: 45` (integer minutes), while others store `{ hours: 0, minutes: 45 }`. If `prepTime` is a primitive number, accessing `.hours` and `.minutes` produces `undefined`, leaving time inputs blank.

3. **Step 1A Initial Form Hydration**:
   When `found` is populated, `ingRawText` and `methodRawText` must be accurately reconstructed from `ingredientSections`, `ingredients`, and `instructions` / `methodSteps` so the textareas and tags reflect the saved recipe immediately.

---

## 3. Implementation Plan

### Task 1: Fix Recipe Lookup in `RecipeWizardModal.js`
- Import `getState` from `../../store/coreState.js`.
- Cleanly extract `recipes` array:
  ```javascript
  const state = typeof getState === 'function' ? getState() : (typeof window !== 'undefined' ? window.Store?.getState?.() : {});
  const allRecipes = Array.isArray(state?.recipes) ? state.recipes : (Array.isArray(state?.recipes?.recipes) ? state.recipes.recipes : []);
  const found = allRecipes.find(r => r && (String(r.id) === String(editRecipeId) || String(r._id) === String(editRecipeId)));
  ```

### Task 2: Robust Normalization for Recipe Edit State
- Parse `prepTime` and `cookTime` whether they are numbers or `{ hours, minutes }` objects.
- Parse `mealSuitability` whether stored as `mealSuitability` array, `types` array, or single `type`.
- Reconstruct `ingredientsRaw`:
  - If `ingredientSections` exists, format each section with its title (e.g. `PIZZA BASES:\n850g Strong Flour...`).
  - Otherwise, format individual ingredients from `ingredients`.
- Reconstruct `methodRaw`:
  - If array (`methodSteps`, `steps`, `instructions`), join with `\n`.
  - If string, preserve as is.

### Task 3: Also Support "Edit Recipe" Directly from `RecipeDetailModalUI.js`
- Ensure the Recipe Detail Modal (Preview) includes an **Edit Recipe** button or action so users can open the editor directly from the preview modal without having to go back to the card dropdown.

### Task 4: Automated Verification Test
- Add test in `scripts/test_recipe_wizard_edit.js`:
  - Mock state with *Sausage Party Pizza* (id: `rec_pizza_1`, sections: `PIZZA BASES` & `SAUCE`).
  - Call `openRecipeWizard('manual', 'rec_pizza_1')`.
  - Assert `wizardState.activeRecipe.title === 'Sausage Party Pizza'`.
  - Assert `wizardState.activeRecipe.servings === 2`.
  - Assert `wizardState.activeRecipe.ingredientsRaw` contains `PIZZA BASES:` and `850g`.
  - Assert `wizardState.activeRecipe.methodRaw` contains `In a stand mixer`.

---

## 4. Acceptance Criteria

- [ ] Clicking **Edit Recipe** on *Sausage Party Pizza* loads the modal with:
  - Title: "Sausage Party Pizza"
  - Servings: 2 (which the user can now edit to 8!)
  - Prep Time & Cook Time filled in
  - Meal tags selected (Dinner)
  - Ingredients textarea populated with all sections and lines
  - Method textarea populated with all steps
- [ ] Changing Servings to `8` and clicking Next $\rightarrow$ Save updates the recipe in the Vault to `Servings: 8` and recalibrates macros to ~725 kcal per pizza.
- [ ] Tests pass and ledger remains clean.
