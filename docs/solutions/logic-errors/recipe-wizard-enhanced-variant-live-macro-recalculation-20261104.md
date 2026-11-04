---
date: "2026-11-04"
problem_type: "logic_error"
component: "javascript_logic"
severity: "high"
symptoms:
  - "Reviewing an enhanced recipe in Recipe Wizard froze the Fit Score badge and Crossbar targets when editing quantities or volumes"
  - "Changing ingredient taxonomy mapping did not change macros or fit score because the previous product match persisted"
  - "Advancing to Step 3 Review clobbered live edits made in Step 2 with stale ingredient and macro data from the original recipe.enhanced snapshot"
root_cause: "state_desynchronization_and_subobject_shadowing"
tags:
  - "recipe-wizard"
  - "enhanced-recipes"
  - "live-macro-recalculation"
  - "dual-variant"
  - "fit-score"
related_issues: []
related_solutions:
  - "docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md"
  - "docs/solutions/logic-errors/recipe-wizard-dynamic-macros-and-packsize-normalization-20261031.md"
last_referenced: "2026-11-04"
---

# Recipe Wizard Enhanced Variant Dual-State Synchronization & Live Macro Recalculation

## Problem Statement

When users reviewed an enhanced recipe (`openRecipeWizard('review', recipeId, 'enhanced')`) in the Recipe Wizard:
1. Editing ingredient quantities, units, or volumes in Step 2 recalculated top-level `activeRecipe.macros`, but the **Fit Score Badge** and the **Elliott & Chloe Macro Breakdown Crossbar** remained completely frozen at their initial values.
2. Changing an ingredient's mapping via the taxonomy autocomplete dropdown failed to re-resolve the product nutrition, retaining the previous product's nutritional profile.
3. Advancing to Step 3 Review discarded the user's Step 2 edits, reverting the rendered ingredients, sections, and macros back to the initial unmodified enhanced recipe snapshot.

## Root Cause Analysis

### 1. Sub-Object Shadowing in Macro Extraction
In PlatePlan's data model, enhanced recipe data lives in a nested `recipe.enhanced` object.
When reviewing an enhanced variant, `openRecipeWizard()` initialized `wizardState.activeRecipe` by merging `{ ...found, ...found.enhanced }`, while simultaneously preserving `wizardState.activeRecipe.enhanced = found.enhanced`.
When live input edits occurred in Step 2, `recalculateWizardMacros()` updated `activeRecipe.macros`. However, both `renderFitScoreBadge()` and `renderMacroBreakdownCrossbar()` invoked `calculateMealFitScore(activeRecipe, targetMealType, { variant: 'enhanced' })`.
Inside `macroScoringUtils.js`, `extractRecipeMacros(r, 'enhanced')` prioritized reading from `r.enhanced`:
```javascript
if (variant === 'enhanced' && r.enhanced && typeof r.enhanced === 'object') {
  const enh = extractFromNode(r.enhanced);
  return { cal: enh.cal, prot: enh.prot, ... };
}
```
Because `activeRecipe.enhanced` was never updated during live edits, the scoring engine repeatedly read the **stale initial snapshot**, ignoring the newly recalculated macros.

### 2. Variant-Agnostic Fit Scoring in `recalculateWizardMacros`
Inside `recalculateWizardMacros(recipeObj)`:
```javascript
const fitResult = calculateMealFitScore(recipeObj, targetMealType);
```
`calculateMealFitScore` was called without an `options` parameter, defaulting to `variant: 'original'`. Furthermore, the result was only written to `recipeObj.fitScore`, leaving `recipeObj.enhancedFitScore` and `recipeObj.enhanced.fitScore` untouched.

### 3. Step 3 Stale Object Spread
In `RecipeWizardStep3View.js`:
```javascript
const isEnhancedTab = currentVariant === 'enhanced';
const displayRecipe = (isEnhancedTab && recipe.enhanced) ? { ...recipe, ...recipe.enhanced } : recipe;
```
Because `recipe.enhanced` remained un-synchronized with Step 2 edits, spreading `...recipe.enhanced` overwrote `recipe.ingredientSections`, `recipe.ingredients`, and `recipe.macros` with the old snapshot, visually wiping out all Step 2 work.

### 4. Taxonomy Re-Mapping Precedence Latch
In `resolveProductForIngredient(item)`:
```javascript
const directId = item.productId || item.bankId || item.mappedItemId;
if (directId) {
  const prod = products.find(p => String(p.id) === String(directId));
  if (prod) return prod;
}
```
When selecting a new root item or sub-type from the taxonomy dropdown, `onSelectCallback()` assigned `item.ingredientId` or `item.subtypeId`, but failed to clear `item.productId` and `item.bankId`. Because `directId` has higher resolution priority, the item remained permanently latched to the previous product match.

## Solution

### 1. Synchronize `activeRecipe.enhanced` on Every Recalculation
In `RecipeWizardStep3Handlers.js` (`recalculateWizardMacros`):
```javascript
if (recipeObj.enhanced && (typeof wizardState !== 'undefined' ? wizardState.activeVariant === 'enhanced' : true)) {
  recipeObj.enhanced.macros = { ...perServing };
  recipeObj.enhanced.nutrition = { ...recipeObj.nutrition };
  recipeObj.enhanced.calories = perServing.calories;
  recipeObj.enhanced.protein = perServing.protein;
  if (recipeObj.ingredientSections) recipeObj.enhanced.ingredientSections = recipeObj.ingredientSections;
  if (recipeObj.ingredients) recipeObj.enhanced.ingredients = recipeObj.ingredients;
}
```
And pass `{ variant: activeVar }` to `calculateMealFitScore()`, writing the score to `recipeObj.enhancedFitScore`, `recipeObj._scoreEnhanced`, and `recipeObj.enhanced.fitScore`.

### 2. Preserve Live Edited Sections in Step 3 Review
In `RecipeWizardStep3View.js`:
Ensure that `displayRecipe` preserves the live-edited `ingredientSections`, `ingredients`, and `macros` from Step 2:
```javascript
const displayRecipe = (isEnhancedTab && recipe.enhanced)
  ? {
      ...recipe,
      ...recipe.enhanced,
      ingredientSections: recipe.ingredientSections || recipe.enhanced.ingredientSections,
      ingredients: (recipe.ingredientSections ? recipe.ingredientSections.flatMap(s => s.ingredients || []) : null) || recipe.ingredients,
      macros: recipe.macros || recipe.enhanced.macros,
      servings: recipe.servings || recipe.serves || 4
    }
  : recipe;
```

### 3. Clear Stale Product IDs on Taxonomy Selection
In `RecipeWizardStep2Handlers.js` (`bindTaxonomyAutocompleteEvents`):
Explicitly clear `productId`, `bankId`, `mappedItemId`, and `productMatch` before applying new taxonomy IDs, allowing `resolveProductForIngredient()` to resolve against the newly selected taxonomy.

## Prevention & Engineering Rules

1. **Dual-Variant Working State Synchronization**:
   Whenever a component operates on an entity with child variants (e.g., `recipe.enhanced`), any mutation to the working copy must immediately reflect into both the root working object and the corresponding variant sub-object before invoking multi-variant scoring utilities like `calculateMealFitScore()` or `extractRecipeMacros()`.
2. **Taxonomy Selection Cleanup**:
   Never update an entity's parent taxonomy (`categoryId`, `ingredientId`, `subtypeId`) without resetting direct leaf product keys (`productId`, `bankId`). Direct leaf keys always trump taxonomy heuristics in product resolution.
3. **Automated Verification**:
   All future recipe wizard tests must test mutations to both original and enhanced variants end-to-end, asserting that downstream display helpers reflect edited volumes without falling back to stale sub-objects.
