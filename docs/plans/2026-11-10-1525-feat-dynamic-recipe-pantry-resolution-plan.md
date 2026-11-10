---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Dynamic Recipe-to-Pantry Resolution

## Goal Capsule

**Objective:** Recipes decouple from static grocery product IDs and bind hierarchically to Pantry Categories, Root Items, or Sub-Types, dynamically resolving the household's optimal product via preferences and auto-defaults in the Vault, while freezing selections at weekly Meal Plan creation to preserve stable shopping lists and allow local substitutions.

**Product Authority:** Replaces hardcoded recipe `productId` links with dynamic taxonomy traversal; Meal Plan cooking events own weekly frozen product choices. Deleting pantry products is unblocked from recipe references.

**Open Blockers:** None.

## Product Contract

### Summary

Recipes currently hardcode physical grocery product IDs directly onto ingredient lines. When grocery prices shift, defaults change, or newer products are added, existing recipes remain locked to outdated items and actively block obsolete products from being deleted from the pantry.

We are establishing dynamic recipe-to-pantry resolution where recipe ingredients bind hierarchically to a Category, Root Item, or Sub-Type rather than a static product ID. In the Recipe Vault, ingredients resolve dynamically down through contained sub-types to select products via household preference metrics and auto-defaults. When added to a weekly Meal Plan, the resolved product freezes for that specific cooking event and shopping list, allowing weekly swaps without altering the core recipe.

### User Value & Context

Household meal planning requires recipe definitions to reflect general cooking intentions (e.g. "200g Mature Cheddar" or "4 Brioche Buns") rather than a snapshot of whatever product happened to be in the database when the recipe was first imported. 

When a household changes their preferred grocery brand, finds a cheaper staple, or updates dietary preferences, the entire recipe catalog should instantly reflect those updated macro, calorie, and cost values without requiring manual edits across dozens of recipes. At the same time, planning a specific week must guarantee predictability: adding a meal to the weekly plan should freeze the chosen grocery items for that week's shopping run, while allowing one-off substitutions for that specific dinner.

### Requirements

#### R-1: Hierarchical Recipe Ingredient Binding
- Recipe ingredient lines must support binding to any of the three Pantry Bank levels:
  - `subtypeId` (e.g. Mature Cheddar)
  - `ingredientId` (Root Item, e.g. Cheddar)
  - `category` (Category, e.g. Dairy & Refrigerated)
- Recipe ingredient lines must not store a hardcoded `productId` as part of the canonical recipe definition.

#### R-2: Dynamic Sub-Type & Product Cascade
- Products must continue to belong strictly to a Sub-Type; products are never attached directly to Root Items or Categories.
- When resolving a recipe ingredient bound to a Category or Root Item:
  - The resolver cascades down through all sub-types contained within that Category or Root Item.
  - Across all available products under those candidate sub-types, it selects the winning product based on the household's active preference metric (price, macro density, or designated auto-default).
- In the Recipe Vault, recipe nutrition, calorie rollups, and fit scores evaluate dynamically against the currently resolved products.

#### R-3: Meal Plan & Shopping List Freezing
- When a recipe is added to a Meal Plan cooking event, the current dynamically resolved products freeze into that specific plan event's state (`productSelections`).
- The weekly Shopping List aggregates and purchases the specific products frozen into the active plan.
- Changes to pantry products or global defaults do not alter an already-frozen active meal plan unless the user explicitly requests a plan re-sync.

#### R-4: In-Plan Local Swaps
- Users must be able to tap any ingredient in the Meal Planner or Today view to swap products or sub-types for that specific cooking event.
- In-plan swaps modify only the plan event's local override; the base recipe definition remains completely untouched.

#### R-5: Automatic Legacy Recipe Migration
- On application startup, a background migration routine inspects existing recipes containing legacy `productId` entries.
- For each legacy product ID, the routine reverse-resolves its parent `subtypeId`, `ingredientId`, and `category` from the product catalog, writes these taxonomy keys to the recipe line, and deletes the static `productId`.

#### R-6: Data Quality Unmatched Resolution
- If an existing recipe references a `productId` that no longer exists or cannot be resolved to a sub-type, the migration must not guess.
- The item is flagged in the Data Quality scanner as an unlinked recipe ingredient, prompting the user with an interactive resolver to link it to an existing or new sub-type.

#### R-7: Unblocked Pantry Product Deletion
- Deleting a product from the Pantry Bank must no longer inspect recipes or refuse deletion due to recipe usage.
- If deleting a product leaves a sub-type with zero attached products, the existing Data Quality scanner surfaces the sub-type as needing a product.

### Key Decisions

1. **Category & Root Item Resolution via Sub-Type Cascade:**
   - *Alternative rejected:* Allowing products to be linked directly to Categories or Root Items.
   - *Reason:* Preserves the strict 3-tier hierarchy (Category › Root Item › Sub-Type › Product) and ensures grocery barcodes always retain clean sub-type classification.
2. **Freeze on Plan Addition:**
   - *Alternative rejected:* Keeping recipes dynamic inside the active weekly plan until shopping list generation.
   - *Reason:* Cooking events and shopping require predictability; users must be confident that the ingredients they planned earlier in the week don't shift unpredictably mid-week due to pantry edits.
3. **Automatic Startup Migration with Data Quality Safety Net:**
   - *Alternative rejected:* Blocking user workflow with a mandatory manual migration wizard.
   - *Reason:* 95%+ of existing products have valid parent sub-types and can be converted seamlessly without user friction; genuine orphans are cleanly managed in the Data Quality scanner.

### Scope Boundaries

- **In Scope:**
  - Decoupling recipe ingredients from static `productId` fields in the Recipe Wizard, Recipe Store, and Recipe Repository.
  - Dynamic product resolution logic supporting Category, Root Item, and Sub-Type bindings.
  - Meal planner cooking event product freezing and in-plan swap preservation.
  - Startup migration script for legacy recipe ingredient schemas.
  - Unblocking product deletion in `ProductBankView.js`.
  - Data Quality scanner integration for unlinked recipe ingredients.
- **Out of Scope:**
  - Automated dynamic barcode shopping substitution at the supermarket checkout.
  - Modifying the Core Pantry Bank 3-tier structure (Category › Root Item › Sub-Type).

### Success Criteria

1. **Zero Hardcoded Product IDs in New Recipes:** Saving or editing a recipe in the Recipe Wizard creates ingredient lines with taxonomy IDs (`subtypeId`, `ingredientId`, or `category`) and no canonical `productId`.
2. **Dynamic Vault Macro Updates:** Changing the auto-default product or pricing of a sub-type immediately updates the displayed calories, macros, and fit scores of all recipes using that sub-type in the Vault without editing the recipes.
3. **Stable Weekly Plans:** Adding a recipe to the Meal Planner freezes the selected products into the plan event; subsequent pantry default changes do not mutate the week's shopping list.
4. **Pantry Product Deletion Without Recipe Blockers:** Deleting any product in the Pantry Bank succeeds immediately without showing a "used in X recipes" blocking alert.
5. **Clean Legacy Migration:** Existing household recipes with legacy `productId` fields convert cleanly to sub-type references on startup, with zero broken recipe displays.

---

## Planning Contract

*Product Contract preservation: Product Contract unchanged.*

### Technical Architecture & Resolution Flow

```
[Recipe Ingredient Line]
        │
        ├─ has subtypeId ─────► Look up Products in Sub-Type
        │                            │
        ├─ has ingredientId ──► Find all Sub-Types under Root Item ──► Gather Candidate Products
        │                            │
        └─ has category ──────► Find all Sub-Types under Category ──► Gather Candidate Products
                                     │
                                     ▼
                        [Preference Metric Evaluator]
                        - Explicit isAutoDefault?
                        - Lowest Price per 100g?
                        - Highest Protein per £?
                                     │
                                     ▼
                     [Winning Product Selected Dynamically]
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
 [Recipe Vault Display]                             [Meal Planner Slot]
 - Dynamic macros, kcal, fit score                  - Freeze winning product ID into plan
 - Live updates when pantry changes                 - Preserves week-specific swaps
                                                    - Feeds Shopping List calculation
```

### Key Technical Decisions (KTDs)

- **KTD-1: Canonical Recipe Schema Invariant:**
  Recipe ingredient lines persist `{ name, qty, unit, subtypeId, ingredientId, category }`. Any `productId` or `bankId` key on recipe ingredient lines is strictly transient at runtime and stripped before persistence in `RecipeFirestoreRepository.js`.
- **KTD-2: Centralized Resolution Engine in `PantryTaxonomyService.js`:**
  All dynamic product selection converges on a single exported utility: `resolveDynamicProductForIngredient(line, { products, ingredients, preferences })`. `RecipeWizardStep3Handlers.js`, `macroScoringUtils.js`, `NutritionService.js`, `MaintenanceService.js`, and `RecipeDetailModalUI.js` call this canonical resolver rather than maintaining divergent fallbacks.
  *Fallback & Compatibility:* The resolver inspects taxonomy bindings (`subtypeId`, `ingredientId`, `category`) first. If taxonomy keys are absent, it falls back to `line.productId` for backward compatibility during phased rollout. Text-only ingredients (e.g. "salt to taste") return `null` safely without throwing.
- **KTD-3: Plan-Level Snapshotting:**
  Slot assignment callers (`MealPlanGeneratorService.js` and `PlannerMealSlot.js`) populate `plan.productSelections[cookingEventId:ingredientKey] = resolvedProductId` upon meal assignment. `ShoppingCalculationService.js` inspects both scoped `${cookingEventId}:${k}` and un-scoped `k` keys and adds `ing.subtypeId` to its lookup keys, guaranteeing shopping list stability. User swaps in `ProductSwapModal.js` update scoped `productSelections` directly.
- **KTD-4: Non-Destructive Startup Migration:**
  `CacheMaintenanceService.js:runDeferredMaintenance()` triggers `migrateLegacyRecipeProductBindings()` during initial store hydration. It computes changes in memory, updates store state, and commits only dirty recipes to Firestore.

---

## Implementation Units

### Unit 1: Dynamic Taxonomy Resolver Engine
- **Goal:** Implement the centralized resolver in `PantryTaxonomyService.js` that cascades Category and Root Item bindings down to Sub-Types and scores products by household preference metrics.
- **Files to Modify:**
  - `src/services/PantryTaxonomyService.js`
- **Requirements Covered:** R-1, R-2
- **Key Logic:**
  - Export `resolveDynamicProductForIngredient(item, { products, ingredients, preferences })`.
  - If `item.subtypeId`: filter products where `p.subtypeId === item.subtypeId`.
  - If `item.ingredientId` without `subtypeId`: find all subtypes under `ingredientId`, gather products matching those subtypes.
  - If `item.category` without `ingredientId`: find all root items and subtypes under `category`, gather products matching those subtypes.
  - Score candidate products: return `isAutoDefault` if present; otherwise rank using `preferences.autoDefaultCriterion` (cheapest price/100g, protein density).
  - Fallback: check `item.productId` if no taxonomy keys exist. Return `null` safely for unmapped or text-only ingredients.
- **Verification Scenarios:**
  - Unit test resolving a Sub-Type binding to its active default product.
  - Unit test resolving a Root Item binding by cascading to its sub-types and picking the metric winner.
  - Unit test resolving a Category binding across multiple root items.
  - Unit test graceful fallback for unmigrated product IDs and text-only lines.

### Unit 2: Recipe Wizard, Vault Scoring & Nutrition Decoupling
- **Goal:** Update the Recipe Wizard, Detail Modal, Vault Scoring (`macroScoringUtils.js`), and Nutrition Services to stop saving `productId` and dynamically compute macros from sub-type resolutions.
- **Files to Modify:**
  - `src/components/recipe/RecipeWizardStep3Handlers.js`
  - `src/utils/macroScoringUtils.js`
  - `src/services/NutritionService.js`
  - `src/components/recipe/RecipeDetailModalUI.js`
  - `src/services/RecipeFirestoreRepository.js`
- **Requirements Covered:** R-1, R-2
- **Key Logic:**
  - In `RecipeWizardStep3Handlers.js`: `mapIngredientItem()` stores `subtypeId`, `ingredientId`, and `category`, omitting `productId` and `bankId`.
  - In `src/utils/macroScoringUtils.js`: update `findProductForIngredient` and `computeDynamicMacrosFromIngredients` to route through `resolveDynamicProductForIngredient()`, ensuring Vault fit scores recalculate live.
  - In `RecipeFirestoreRepository.js`: sanitize recipe lines on write to drop any lingering `productId` or `bankId`.
  - In `RecipeDetailModalUI.js`: resolve the product dynamically from `resolveDynamicProductForIngredient()`.
- **Verification Scenarios:**
  - Save a new recipe in the wizard and verify Firestore payload contains `subtypeId` and `ingredientId` but no `productId`.
  - Alter the default product of a sub-type; verify the recipe detail modal and Vault recipe card fit score reflect the new product immediately.

### Unit 3: Meal Plan Product Freezing & Local Swaps
- **Goal:** Freeze resolved product selections into cooking events when added to the Meal Plan, and preserve plan-level overrides for shopping list generation.
- **Files to Modify:**
  - `src/models/MealPlannerModel.js`
  - `src/services/MealPlanGeneratorService.js`
  - `src/components/planner/PlannerMealSlot.js`
  - `src/components/ProductSwapModal.js`
  - `src/services/ShoppingCalculationService.js`
  - `src/services/TodayViewService.js`
- **Requirements Covered:** R-3, R-4
- **Key Logic:**
  - When meals are assigned in `MealPlanGeneratorService.js` or `PlannerMealSlot.js`: resolve all ingredient lines using `resolveDynamicProductForIngredient()` and store product IDs in `plan.productSelections[cookingEventId:ingredientKey] = resolvedProductId`.
  - In `ShoppingCalculationService.js`: check both scoped `${cookingEventId}:${k}` and un-scoped `k` in `plan.productSelections` and `plan.substitutions`, and add `ing.subtypeId` to `lookupKeys`.
  - In `ProductSwapModal.js` and `TodayViewService.js`: allow swapping a product for that day's meal, updating scoped `plan.productSelections` while leaving the recipe untouched.
- **Verification Scenarios:**
  - Add a recipe to Tuesday dinner; verify `plan.productSelections` records specific product IDs.
  - Swap an ingredient's product in Tuesday dinner via swap modal; verify the shopping list updates and the base recipe remains unchanged.

### Unit 4: Unblocked Pantry Product Deletion
- **Goal:** Remove the recipe-usage deletion blocker in `ProductBankView.js` and ensure clean deletion of obsolete products.
- **Files to Modify:**
  - `src/views/ProductBankView.js`
- **Requirements Covered:** R-7
- **Key Logic:**
  - Remove `recipeCount` guard in `handleDeleteProduct()`.
  - If a deleted product was the default for a sub-type, clear `defaultProductId` so the sub-type falls back to the next metric-ranked product.
- **Verification Scenarios:**
  - Delete a product that is referenced in recipes; verify deletion succeeds with confirm modal.
  - Verify recipes referencing that product's sub-type continue rendering without error, falling back to the remaining products or unlinked state.

### Unit 5: Legacy Startup Migration & Data Quality Orphan Scanner
- **Goal:** Automatically migrate existing recipe documents on startup from static `productId` to taxonomy keys, wire deferred launch trigger, and route unresolvable orphans to Data Quality.
- **Files to Modify:**
  - `src/services/MaintenanceService.js`
  - `src/services/CacheMaintenanceService.js`
  - `src/services/DataQualityScanner.js`
  - `src/views/DataQualityTableRenderService.js`
- **Requirements Covered:** R-5, R-6
- **Key Logic:**
  - Implement `migrateLegacyRecipeProductBindings()` in `MaintenanceService.js`.
  - In `CacheMaintenanceService.js`: call `migrateLegacyRecipeProductBindings()` inside `runDeferredMaintenance()`.
  - For each recipe with legacy `productId`: find product in `state.products`, attach `subtypeId`, `ingredientId`, and `category`, then delete `productId`.
  - If product ID cannot be found in catalog, flag with `needsSubtypeMapping: true`.
  - In `DataQualityScanner.js`: add check for recipe ingredients with `needsSubtypeMapping: true`, DRYing `calculateRecipeDynamicMacros()` to delegate to `resolveDynamicProductForIngredient()`. Surface orphans in Data Quality table with an interactive resolver modal.
- **Verification Scenarios:**
  - Run migration on mock legacy recipes; verify `productId` is stripped and `subtypeId` is populated.
  - Run Data Quality scan on orphan recipe items; verify they appear in the UI and allow user-directed mapping to a sub-type.

---

## Verification Contract

### Automated Regression Suite
- Create `scripts/test_dynamic_recipe_product_resolution.js`:
  1. Test dynamic resolution down from Category, Root Item, and Sub-Type.
  2. Test recipe macro update when sub-type default product changes.
  3. Test meal plan addition snapshots product selections.
  4. Test product deletion succeeds without recipe blockers.
  5. Test startup migration cleanly converts legacy recipe lines.
- Run existing suites: `node scripts/test_pantry_deletes.js`, `node scripts/test_shopping_list.js`, `node scripts/test_product_subtype_linkage.js`.
- Run `npm run ledger && npm run build`.

### Manual Browser Verification
1. **Recipe Wizard:** Create a recipe, link an ingredient to a sub-type, save, and confirm in Firestore that no `productId` is persisted on the recipe.
2. **Dynamic Update:** In Pantry Bank, change the default product under a sub-type; open the recipe and verify the displayed ingredient product and nutrition updated dynamically.
3. **Meal Planner:** Add the recipe to Tuesday Dinner. Verify the current product is frozen in the planner. Change the pantry default again; verify Tuesday Dinner and the Shopping List remain pinned to the original choice.
4. **Product Delete:** Delete an existing pantry product. Confirm no blocking alert appears and the deletion completes immediately.

---

## Definition of Done

1. All units (Unit 1 through Unit 5) implemented across target files without bundler/transpiler dependencies.
2. Standalone automated test `scripts/test_dynamic_recipe_product_resolution.js` passes with 0 failures.
3. All existing test scripts pass without regression.
4. `npm run ledger` and `npm run build` succeed with 0 errors.
5. Work delivered via standard git flow targeting `development`.
