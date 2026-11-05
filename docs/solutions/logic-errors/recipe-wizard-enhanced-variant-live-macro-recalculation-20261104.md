---
date: "2026-11-04"
last_updated: "2026-11-05"
problem_type: "logic_error"
component: "javascript_logic"
severity: "high"
symptoms:
  - "Reviewing an enhanced recipe in Recipe Wizard froze the Fit Score badge and Crossbar targets when editing quantities or volumes"
  - "Changing ingredient taxonomy mapping did not change macros or fit score because the previous product match persisted"
  - "Advancing to Step 3 Review clobbered live edits made in Step 2 with stale ingredient and macro data from the original recipe.enhanced snapshot"
  - "Method steps did not follow over when reviewing an enhanced recipe or when recipes stored steps under recipe.method"
  - "Recipe Vault card rendered 0% fit score and doubled calories for enhanced variant on page load, which normalized only after re-saving through the wizard"
  - "Recipe Detail Modal displayed 'No method steps specified' for enhanced recipe variants"
root_cause: "state_desynchronization_and_subobject_shadowing"
tags:
  - "recipe-wizard"
  - "enhanced-recipes"
  - "live-macro-recalculation"
  - "dual-variant"
  - "fit-score"
  - "macro-hydration"
  - "serving-scaling"
related_issues: []
related_solutions:
  - "docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md"
  - "docs/solutions/logic-errors/recipe-wizard-dynamic-macros-and-packsize-normalization-20261031.md"
last_referenced: "2026-11-05"
---

# Recipe Wizard Enhanced Variant Dual-State Synchronization & Live Macro Recalculation

## Problem Statement

When users reviewed an enhanced recipe (`openRecipeWizard('review', recipeId, 'enhanced')`) in the Recipe Wizard or viewed enhanced recipes across the Vault and Detail Modal:
1. Editing ingredient quantities, units, or volumes in Step 2 recalculated top-level `activeRecipe.macros`, but the **Fit Score Badge** and the **Elliott & Chloe Macro Breakdown Crossbar** remained completely frozen at their initial values.
2. Changing an ingredient's mapping via the taxonomy autocomplete dropdown failed to re-resolve the product nutrition, retaining the previous product's nutritional profile.
3. Advancing to Step 3 Review discarded the user's Step 2 edits, reverting the rendered ingredients, sections, and macros back to the initial unmodified enhanced recipe snapshot.
4. Method steps completely disappeared or failed to follow over when reviewing an enhanced recipe whose base recipe defined instructions under `recipe.method` (as an array) rather than `recipe.steps`.
5. In the Recipe Vault card, enhanced variants (e.g. Smashed Brooklyn Burgers) rendered with a 0% fit score and doubled calorie totals on initial page load (e.g. 1302 kcal for Elliott instead of 655 kcal), which temporarily corrected to 98% only after opening and re-saving the recipe in the wizard without making changes.
6. In the Recipe Detail View modal (`RecipeDetailModalService.js`), clicking "View" on an enhanced recipe rendered "No method steps specified" under the Method section.

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

### 5. Multi-Schema Method Step Extraction & Enhanced Fallback
`RecipeWizardModal.js` originally extracted steps using:
```javascript
const methodStepsArray = Array.isArray(targetSource.steps) 
  ? targetSource.steps 
  : (Array.isArray(targetSource.methodSteps) ? targetSource.methodSteps : (Array.isArray(targetSource.instructions) ? targetSource.instructions : []));
```
When a recipe in Firestore stored its instructions as an array under `recipe.method` (standard across many PlatePlan recipes), `methodStepsArray` evaluated to `[]` because `Array.isArray(targetSource.method)` was omitted. The fallback check `typeof targetSource.method === 'string'` also failed because `targetSource.method` was an array. Furthermore, if `found.enhanced` did not define its own instructions, it failed to inherit the base recipe's method steps.

### 6. Shallow Object Spread Yield Erasure (`serves: undefined`)
In `VaultRecipeCard.js`, when rendering an enhanced variant card, the code composed:
```javascript
const enhancedActive = { ...r, ...r.enhanced };
```
Because Firestore documents for enhanced recipes store macro overrides, ingredient diffs, and score tags under `r.enhanced` but typically omit `serves` / `servings`, spreading `...r.enhanced` over `r` evaluated `enhancedActive.serves` to `undefined`.

### 7. Yield Default Asymmetry in Macro Extraction vs Scoring
When `enhancedActive.serves` evaluated to `undefined`:
- `macroScoringUtils.js`'s `extractRecipeMacros(r)` used:
  ```javascript
  const serves = Number(r?.serves || r?.servings || 1);
  ```
  defaulting missing yield to **1 serving**.
- However, `calculateSingleMealTypeFitScore()` used:
  ```javascript
  const serves = Number(r?.servings || r?.serves || 2);
  ```
  defaulting missing yield to **2 servings**.
When `extractRecipeMacros` processed batch totals (e.g. 1102 kcal batch for a 2-serving dish), it treated the entire batch as 1 single portion (1102 kcal). Next, `calculateSingleMealTypeFitScore` applied Elliott's dinner split factor ($1.1818 \times 1102 \approx 1302$ kcal), causing the fit score to plunge to **0% (Poor Match)** on the vault card.
When the user opened the recipe in the Recipe Wizard, the wizard enforced `servings = 2`, recalculated per-serving macros as 551 kcal, and saving temporarily patched the numbers in memory until the next page load.

### 8. Dual-Key Macro Shadowing during Firestore `{ merge: true }` Writes
In Firestore, recipe documents historically stored macros under both short-form keys (`cal`, `prot`, `carb`) and canonical long-form keys (`calories`, `protein`, `carbs`) under `nutrition.perServing` and `macros`.
During `RecipeRepository.js` and `RecipeFirestoreRepository.js` updates, writes used `setDoc(docRef, data, { merge: true })`. If a write updated `calories` without explicitly setting `cal`, Firestore preserved the existing `cal` field.
When reading documents on page hydration, `extractRecipeMacros` previously gave precedence to `nutrition.perServing` over top-level `macros`:
```javascript
const candidates = [
  r?.nutrition?.perServing,
  r?.macros,
  ...
];
```
If `nutrition.perServing` had stale legacy keys, `extractRecipeMacros` read the stale values and bypassed the cleaned canonical `macros`. Furthermore, `cleanLegacyMacros` only cleaned `macros` and failed to clean `nutrition.perServing`.

### 9. Detail Modal Multi-Schema Instruction Resolution & Fallback Gap
In `RecipeDetailModalService.js`:
```javascript
let method = activeR.method || activeR.steps || '';
```
It failed to check `methodSteps` or `instructions`. Moreover, when rendering an enhanced variant (`activeR = r.enhanced`), `r.enhanced` contained only ingredient overrides and had no instructions of its own. Unlike `RecipeWizardModal.js`, `RecipeDetailModalService` did not fall back to the base recipe (`r`), resulting in `"No method steps specified"`.

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
      methodSteps: recipe.methodSteps || recipe.enhanced.methodSteps || recipe.enhanced.steps || recipe.enhanced.method || recipe.enhanced.instructions || recipe.steps || recipe.method || recipe.instructions || [],
      servings: recipe.servings || recipe.serves || 4
    }
  : recipe;
```

### 3. Clear Stale Product IDs on Taxonomy Selection
In `RecipeWizardStep2Handlers.js` (`bindTaxonomyAutocompleteEvents`):
Explicitly clear `productId`, `bankId`, `mappedItemId`, and `productMatch` before applying new taxonomy IDs, allowing `resolveProductForIngredient()` to resolve against the newly selected taxonomy.

### 4. Robust Method Extraction & Variant Fallback
In `RecipeWizardModal.js`:
Implement `extractRawSteps(targetSource)` exhaustively inspecting `methodSteps`, `steps`, `method` (both array and string split), and `instructions`. If `isEnhVariant` is active and `found.enhanced` does not define instructions, fall back to `extractRawSteps(found)` so enhanced variants always inherit cooking instructions. Normalize any object steps `{ text: '...' }` to strings to prevent `[object Object]` rendering.

### 5. Explicitly Preserve Yield on Variant Card Instantiation
In `VaultRecipeCard.js`:
```javascript
const enhancedActive = {
  ...r,
  ...r.enhanced,
  serves: Number(r.enhanced?.serves || r.serves || 2) || 2,
  servings: Number(r.enhanced?.servings || r.servings || r.serves || 2) || 2
};
```
This guarantees that object spreads never wipe out `serves` or `servings` on enhanced variant cards.

### 6. Harmonize Default Yields and Macro Precedence
In `src/utils/macroScoringUtils.js`:
1. Default missing yields in `extractRecipeMacros` to 2, exactly matching `calculateSingleMealTypeFitScore`:
   ```javascript
   const serves = Number(r?.serves || r?.servings || 2) || 2;
   ```
2. In `extractRecipeMacros`, prioritize verified `r?.macros` over `r?.nutrition?.perServing` so hydrated doc objects use cleaned canonical values.

### 7. Dual-Key Macro Synchronization on Write and Clean
1. In `RecipeFirestoreRepository.js` (`cleanLegacyMacros`):
   When cleaning `recipe.macros`, also clean and synchronize `recipe.nutrition.perServing` so both canonical (`calories`, `protein`) and short-form (`cal`, `prot`) keys stay identical.
2. In `RecipeRepository.js`:
   Replace redundant local `cleanLegacyMacros` with the canonical import from `RecipeFirestoreRepository.js`.
3. In `RecipeWizardStep3Handlers.js`:
   When constructing enhanced variants or saving recipes, explicitly write both key pairs to `nutrition.perServing` and `macros`, and populate `serves: 2`, `method`, `steps`, and `instructions`.

### 8. Recipe Detail Modal Instruction Extraction & Base Fallback
In `RecipeDetailModalService.js` and `RecipeEnhancementService.js`:
1. Check `activeR.methodSteps`, `activeR.steps`, `activeR.method`, and `activeR.instructions`.
2. If `activeR` is an enhanced variant without instructions, fall back to the base recipe's steps (`recipe.methodSteps || recipe.steps || recipe.method || recipe.instructions`).

## Prevention & Engineering Rules

1. **Dual-Variant Working State Synchronization**:
   Whenever a component operates on an entity with child variants (e.g., `recipe.enhanced`), any mutation to the working copy must immediately reflect into both the root working object and the corresponding variant sub-object before invoking multi-variant scoring utilities like `calculateMealFitScore()` or `extractRecipeMacros()`.
2. **Taxonomy Selection Cleanup**:
   Never update an entity's parent taxonomy (`categoryId`, `ingredientId`, `subtypeId`) without resetting direct leaf product keys (`productId`, `bankId`). Direct leaf keys always trump taxonomy heuristics in product resolution.
3. **Multi-Schema Array Extraction**:
   Always support the 4 common instructions schema keys: `methodSteps`, `steps`, `method`, and `instructions`, supporting both arrays and newline-separated strings.
4. **Enhanced Variant Content Inheritance**:
   When reviewing or authoring an enhanced variant that only changes ingredients, always inherit the parent recipe's method steps and sections if the enhanced variant does not provide custom overrides.
5. **Automated Verification**:
   All future recipe wizard tests must test mutations to both original and enhanced variants end-to-end, asserting that downstream display helpers reflect edited volumes without falling back to stale sub-objects.
6. **Object Spread Yield Preservation**:
   Never spread a partial sub-variant object (e.g. `{ ...parent, ...parent.enhanced }`) without explicitly re-asserting `serves` and `servings`. Missing variant yields cause per-portion calculations to divide batch macros by 1, doubling per-portion calories and collapsing fit scores to 0%.
7. **Serving Yield Default Parity**:
   All utilities that compute, extract, or score nutrition must agree on the fallback yield (2 servings across PlatePlan) when a recipe document omits `serves` or `servings`.
8. **Firestore `{ merge: true }` Dual-Key Synchronicity**:
   When supporting both legacy and canonical schemas (`cal`/`prot` vs `calories`/`protein`), writers must update or delete both keys in the same payload. Partial writes under `{ merge: true }` preserve stale sibling keys in Firestore documents.
