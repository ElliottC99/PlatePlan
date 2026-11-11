---
title: "Recipe Wizard Taxonomy Level Preservation & UI Polish"
date: "2026-11-11"
artifact_contract: "ce-unified-plan/v1"
product_contract_source: "ce-brainstorm"
execution: "code"
---

# Recipe Wizard Taxonomy Level Preservation & UI Polish

## Goal Capsule

- **Objective:** Enable household meal planners to preserve Root Item and Category level mappings without forced down-casting to sub-types, provide touch-friendly ingredient reordering in the Recipe Wizard, allow one-click cooking method copying into enhanced recipe variants, replace hardcoded member profile targets and household constants with dynamic configuration, retire obsolete manual sync buttons, and eliminate mobile header and timer formatting defects.
- **Product Authority:** Elliott Callender (household meal planner and PlatePlan author).
- **Open Blockers:** None.

---

## Product Contract

### Summary
The brainstorm scopes preserving high-level taxonomy mappings without auto-collapsing to sub-types, ingredient reordering in Recipe Wizard Step 2, copying method steps into enhanced variants, dynamic profile targets, centralizing household ID, retiring manual sync controls, and fixing mobile header and timer formatting defects. This plan covers that full scope in one unified implementation plan.

### Problem Statement

1. **Taxonomy Level Down-Casting:** When reviewing recipes in Step 2 of the Recipe Wizard, selecting a high-level taxonomy node (Root Item "Maple Syrup" or Category "Syrups") gets overridden during save. Step 3 falls back to the resolved default product's sub-type ID (e.g. "Zero Calorie Maple Syrup"), permanently collapsing the recipe's mapping to a specific sub-type and eliminating dynamic resolution flexibility.
2. **Ingredient Row Static Ordering:** Recipe Wizard Step 2 lacks reordering controls, forcing users to delete and re-enter lines if the parsed sequence does not match the desired culinary order.
3. **Enhanced Recipe Method Duplication:** When creating or editing an enhanced recipe variant, method steps start empty, requiring manual copy-pasting of instructions from the base recipe.
4. **Hardcoded Profiles & Constants:**
   - Household member names ('Elliott', 'Chloe'), meal slot keys (`lunchE`, `lunchC`, `dinnerE`, `dinnerC`), and calorie/protein targets (1950/140, 1350/90) are hardcoded instead of dynamically driven from `preferences.profiles` in Settings.
   - `HOUSEHOLD_ID = 'elliott-chloe'` is duplicated across 9 repository files instead of imported from a single source of truth.
5. **Mobile Header & Display Defects:**
   - The sync pill displays `• Synced Synced` on mobile due to a redundant CSS pseudo-element (`::after`).
   - The obsolete "Sync Now" button clutters the header despite Firestore handling real-time synchronization automatically.
   - Prep times stored as objects in Firestore display as `⏱ [object Object]` in the Today view.

### Key Decisions

- session-settled:preserve-taxonomy-level: Recipe ingredient saving must preserve deliberate Root Item (`ingredientId`) and Category (`categoryId`) mappings with `subtypeId: null`. The system must never auto-populate `subtypeId` from the default product when a higher-level node was chosen.
- session-settled:retrospective-migration: Provide a one-time migration that evaluates every recipe ingredient currently mapped to a sub-type. It automatically elevates ingredients to their parent Root Item where possible. Where an ingredient could legitimately be elevated further to a Category, it prompts the user for individual confirmation per recipe; if declined or uncertain, it defaults to the Root Item.
- session-settled:wizard-reorder: Provide touch-friendly `▲` / `▼` arrow buttons on each ingredient row in Recipe Wizard Step 2 to swap adjacent lines within a section.
- session-settled:method-copy-placement: Place a `📋 Copy Method from Original Recipe` button in both Recipe Wizard Step 2 (when editing an enhanced variant) and the Recipe Detail modal.
- session-settled:remove-sync-now-completely: Remove "Sync Now" buttons and references completely from the top header bar and sync panels; Firestore real-time snapshot listeners maintain persistent live synchronization.
- session-settled:dynamic-profiles-and-targets: Read member names and macro targets dynamically from `preferences.profiles` across meal planning, daily nutrition headers, and calculations.
- session-settled:centralize-household-id: Consolidate `HOUSEHOLD_ID` into a single export in `src/config/firebase.js` and import it across all repositories.
- session-settled:timer-object-formatting: Extract numeric minutes from recipe time objects (`time.total || time.prep || time.cook`) to prevent `[object Object]` rendering.
- session-settled:drop-paste-parse-autocomplete: Defer Paste & Parse automated suggestion chips/auto-linking until the preference learning model matures further to avoid confident false-links.

### Requirements

- R1. **Taxonomy Level Preservation on Save:**
  - In `RecipeWizardStep3Handlers.js`, saving an ingredient mapped to a Category (`categoryId` set) or a Root Item (`ingredientId` set with `subtypeId === null`) must persist `subtypeId: null` in Firestore.
  - Runtime product resolution (`resolveDynamicProductForIngredient`) dynamically selects products based on the highest mapped level (Category -> Root Item -> Sub-type).
- R2. **One-Time Retrospective Promotion Utility:**
  - Implement a migration script and Data Quality action that iterates through all household recipes.
  - Evaluate ingredients mapped to sub-types: automatically promote to Root Item where the sub-type represents the parent's default or common staple.
  - Where an ingredient can be elevated all the way to a Category, prompt the user with an interactive modal showing the candidate recipe and ingredient; if confirmed, elevate to Category, otherwise elevate to Root Item.
- R3. **Step 2 Ingredient Reordering:**
  - Add `▲` and `▼` action buttons to each ingredient row in `RecipeWizardStep2View.js`.
  - Clicking `▲` or `▼` swaps adjacent elements in `activeRecipe.ingredientSections[sIdx].ingredients` and re-renders the rows.
  - Disable or hide `▲` on the first row and `▼` on the last row of each section.
- R4. **Copy Method from Original Recipe:**
  - In `RecipeWizardStep2View.js` (when `variant === 'enhanced'`) and `RecipeDetailModalUI.js`, render a `📋 Copy Method from Original Recipe` button.
  - Clicking the button copies `baseRecipe.methodSteps || baseRecipe.instructions || baseRecipe.steps` into the enhanced recipe variant.
- R5. **Dynamic Member Profiles & Macro Targets:**
  - In `DailyNutritionCard.js`, `ProfilePreferencesForm.js`, `TodayRenderService.js`, and `systemConfig.js`, read member names and target calories/protein dynamically from `preferences.profiles` with graceful fallback to defaults.
- R6. **Centralized Household ID:**
  - Single source of truth for `HOUSEHOLD_ID` in `src/config/firebase.js`.
  - Update `ShoppingListRepository.js`, `PlanRepository.js`, and related services to import `HOUSEHOLD_ID` instead of hardcoding `'elliott-chloe'`.
- R7. **Remove Obsolete Sync Now Controls:**
  - Remove `#syncNowTopBtn` from `index.html` and `HeaderUI.js`.
  - Remove redundant manual sync triggers from `SyncPanelUI.js`.
- R8. **Mobile Header & Timer Formatting Fixes:**
  - Remove `.sync-pill[data-status="synced"]::after` from `styles/responsive.css` to fix the duplicate `• Synced Synced` badge.
  - Update `TodayRenderService.js` to parse `recipe.time` objects safely and display formatted minutes (e.g. `⏱️ 20m`).

### Non-Goals

- Speculative machine learning or automated fuzzy linking in Paste & Parse (deferred to a dedicated learning initiative).
- Multi-household tenancy architecture (the single household ID remains `'elliott-chloe'`, but is cleanly centralized).
- Bumping the `package.json` version number on feature branches.

### Success Criteria

1. Saving a recipe with an ingredient mapped to "Maple Syrup" (Root Item) persists `subtypeId: null`, dynamically resolving products at runtime without being collapsed into a specific sub-type.
2. The one-time migration evaluates existing recipes, promoting sub-types to Root Items automatically and prompting for Category promotions where applicable.
3. Ingredient rows in Recipe Wizard Step 2 can be rearranged up and down using `▲` / `▼` controls.
4. Enhanced recipe variants can adopt the original base recipe's method steps with a single click.
5. Member names and macro targets in the Today view and Meal Planner reflect dynamic settings from `preferences.profiles`.
6. `HOUSEHOLD_ID` is imported from `src/config/firebase.js` across all repositories.
7. Mobile header displays a clean `• Synced` status badge with no trailing duplicate text and no manual sync buttons.
8. Recipe cards in Today view format prep times as `⏱️ Xm` instead of `⏱ [object Object]`.

---

## Planning Contract

### Key Technical Decisions (KTDs)

- KTD1. **Explicit Mapping Level Retention (Governs R1):** In `RecipeWizardStep3Handlers.js:mapIngredientItem()`, inspect the ingredient mapping level explicitly. If `i.categoryId` is truthy, set `categoryId: i.categoryId`, `ingredientId: null`, `subtypeId: null`. If `i.ingredientId` is truthy and `i.subtypeId` is null, set `ingredientId: i.ingredientId`, `subtypeId: null`, `categoryId: null`. Only set `subtypeId` if `i.subtypeId` was explicitly selected by the user. (session-settled: user-directed — chosen over fallback to resolved product sub-type).
- KTD2. **Dual-Surface Method Copy (Governs R4):** When copying method steps into an enhanced variant, normalize method steps into an array of strings regardless of whether the base recipe stored them under `methodSteps`, `steps`, `method`, or newline-delimited `instructions`. (session-settled: user-directed — chosen over wizard-only copy).
- KTD3. **DOM Table Row Swap Architecture (Governs R3):** In `RecipeWizardStep2Handlers.js`, capture `click` on `.wiz-ing-reorder-btn`. Calculate target index based on direction (`-1` for up, `+1` for down). Mutate array in-place, then re-render the section table without full modal re-mounting to preserve focus and avoid scroll jumps.
- KTD4. **Graceful Profile Fallback (Governs R5):** Query `getState().preferences?.profiles` or `getState().userPrefs?.profiles`. If missing or empty, fall back to standard `DEFAULT_PROFILES` with 'Elliott' (1950 kcal / 140g P) and 'Chloe' (1350 kcal / 90g P), ensuring zero regression for unconfigured local states.
- KTD5. **Retrospective Promotion Two-Pass Engine (Governs R2):** Pass 1 automatically converts recipe ingredients whose `subtypeId` matches parent root item's default product to `subtypeId: null`. Pass 2 identifies ingredients whose parent root item has an obvious 1-to-1 or sole Category membership and presents an interactive confirmation modal in Data Quality.

---

## Implementation Units

### U1. Header & Display Fixes (Mobile Synced Badge, Timer Object Formatting, Sync Now Retirement)
- **Target Files:**
  - `styles/responsive.css`
  - `src/views/TodayRenderService.js`
  - `index.html`
  - `src/components/shell/HeaderUI.js`
  - `src/components/sync/SyncPanelUI.js`
- **Approach:**
  - Delete `.sync-pill[data-status="synced"]::after` in `styles/responsive.css` to eliminate the duplicate `• Synced Synced` badge on mobile.
  - In `TodayRenderService.js:144`, extract numeric minutes: if `recipe.time` is an object, read `recipe.time.total || recipe.time.prep || recipe.time.cook || 0`; format as `⏱️ ${time}m`.
  - Remove `#syncNowTopBtn` from `index.html` and `HeaderUI.js`.
  - In `SyncPanelUI.js`, remove the manual "Sync Now" button while keeping status metrics ("Last Synced", household ID).
- **Test Scenarios:**
  - Responsive sync pill renders only `• Synced` in mobile DOM viewports.
  - Recipe with `recipe.time = { prep: 15, cook: 20 }` renders as `⏱️ 15m` (or total if present) instead of `⏱ [object Object]`.
  - Header renders cleanly without `#syncNowTopBtn`.

### U2. Centralized Household ID & Dynamic Member Profiles
- **Target Files:**
  - `src/config/firebase.js`
  - `src/repositories/ShoppingListRepository.js`
  - `src/repositories/PlanRepository.js`
  - `src/services/CategoryManagementRepository.js`
  - `src/services/CategoryMergeRepository.js`
  - `src/services/HouseholdRepository.js`
  - `src/services/ShoppingFirestoreRepository.js`
  - `src/services/SubtypeRepository.js`
  - `src/components/profile/DailyNutritionCard.js`
  - `src/components/profile/ProfilePreferencesForm.js`
  - `src/views/TodayRenderService.js`
  - `src/config/systemConfig.js`
- **Approach:**
  - Export `HOUSEHOLD_ID = 'elliott-chloe'` from `src/config/firebase.js` as single source of truth.
  - Replace hardcoded `'elliott-chloe'` strings in all repository files with `import { HOUSEHOLD_ID } from '../config/firebase.js'`.
  - In `DailyNutritionCard.js` and `TodayRenderService.js`, read member names and targets from `preferences.profiles` array. If present, render cards and progress bars for each profile. If absent, fallback to default profiles.
- **Test Scenarios:**
  - Updating member names or targets in Settings immediately updates the Daily Nutrition card labels and target bars on Today view.
  - All repository queries continue targeting `households/elliott-chloe/` without regression.

### U3. Recipe Wizard Step 2 Ingredient Reordering
- **Target Files:**
  - `src/components/recipe/RecipeWizardStep2View.js`
  - `src/components/recipe/RecipeWizardStep2Handlers.js`
- **Approach:**
  - In `RecipeWizardStep2View.js`, add a reorder column to the ingredients table with `▲` and `▼` buttons carrying `class="wiz-reorder-btn"` and `data-direction="up|down"`, `data-sidx`, `data-iidx`.
  - Disable `▲` on row 0; disable `▼` on the last row of each section.
  - In `RecipeWizardStep2Handlers.js`, listen for click on `.wiz-reorder-btn`.
  - Swap elements in `sec.ingredients[iIdx]` and `sec.ingredients[iIdx + delta]`.
  - Re-render the section table DOM while preserving current inputs.
- **Test Scenarios:**
  - Clicking `▼` on the first ingredient swaps it with the second ingredient in memory and in the DOM.
  - First row has disabled `▲`; last row has disabled `▼`.
  - Section reordering preserves quantities, units, and taxonomy selections.

### U4. Copy Method from Original Recipe to Enhanced Variant
- **Target Files:**
  - `src/components/recipe/RecipeWizardStep2View.js`
  - `src/components/recipe/RecipeWizardStep2Handlers.js`
  - `src/components/recipe/RecipeDetailModalUI.js`
  - `src/services/RecipeDetailModalService.js`
- **Approach:**
  - In `RecipeWizardStep2View.js`, when `wizardState.variant === 'enhanced'`, render a `📋 Copy Method from Original Recipe` button above the Method steps list.
  - In `RecipeDetailModalUI.js`, when viewing an enhanced variant, render a button in the Method tab if the enhanced variant has no steps or if the user wants to sync steps from original.
  - On click, look up base recipe by `recipe.id` (or `recipe.baseRecipeId`), copy its method steps array, assign to enhanced variant, and show a success toast.
- **Test Scenarios:**
  - Editing an enhanced variant with empty method steps -> click button -> base recipe method steps populate immediately.
  - Notification toast confirms method steps copied.

### U5. Taxonomy Level Preservation on Save
- **Target Files:**
  - `src/components/recipe/RecipeWizardStep3Handlers.js`
  - `src/components/recipe/RecipeWizardState.js`
  - `src/services/DynamicTaxonomyResolver.js`
  - `scripts/test_dynamic_recipe_product_resolution.js`
- **Approach:**
  - Refactor `RecipeWizardStep3Handlers.js:mapIngredientItem` to respect deliberate mapping levels:
    - If `i.categoryId`: keep `categoryId: i.categoryId`, `ingredientId: null`, `subtypeId: null`.
    - If `i.ingredientId` without explicit `i.subtypeId`: keep `ingredientId: i.ingredientId`, `subtypeId: null`, `categoryId: null`.
    - Never fallback to `resolvedProd?.subtypeId` when writing recipe documents.
  - Ensure `DynamicTaxonomyResolver.js` correctly evaluates ingredients with `subtypeId === null` by dynamically querying root item products or category products.
- **Test Scenarios:**
  - Ingredient mapped to root item "Maple Syrup" with `subtypeId: null` saves to recipe with `subtypeId: null`.
  - Runtime nutrition and fit score calculations dynamically select the best product matching the root item.

### U6. One-Time Retrospective Taxonomy Promotion Utility
- **Target Files:**
  - `scripts/migrate_recipe_taxonomy_levels.js`
  - `src/components/data-quality/CategoryPromotionModalUI.js`
  - `src/views/DataQualityTableRenderService.js`
  - `src/services/DataQualityScanner.js`
- **Approach:**
  - Build `scripts/migrate_recipe_taxonomy_levels.js`:
    - Reads all recipes in `households/elliott-chloe/recipes`.
    - Pass 1: Promotes ingredients mapped to sub-types that match parent root item default products up to Root Item level (`subtypeId: null`).
    - Pass 2: Identifies candidates that could be promoted to Category level.
  - In Data Quality view, add a Card / Modal: "Retrospective Taxonomy Elevation".
  - Allows user to review Category promotion candidates per-recipe and confirm or decline.
- **Test Scenarios:**
  - Test migration script with `--dry-run`: outputs list of ingredients to elevate to Root Item and candidates for Category.
  - Executing promotion updates Firestore recipe documents atomically without corrupting variant arrays.

---

## Verification Contract

### Automated Verification Commands
```bash
# 1. Run Data Quality verification suite
node scripts/test_data_quality_wizards.js

# 2. Run Dynamic Taxonomy Resolution suite
node scripts/test_dynamic_recipe_product_resolution.js

# 3. Run Apple HIG & responsive design regression tests
node scripts/test_hig_dark_mode.js

# 4. Verify Code Ledger & dead code count
npm run ledger
node scripts/test_ledger.js

# 5. Production build & asset stamping
npm run build
```

### Manual Verification Checklist
1. Mobile Header: Check on mobile viewport that top sync badge shows `• Synced` with no duplicate word, and no "Sync Now" button appears.
2. Today View: Check Cottage Cheese Pancakes card displays prep time cleanly (e.g. `⏱️ 20m`) with no `[object Object]`.
3. Recipe Wizard Step 2:
   - Verify `▲` / `▼` buttons move ingredient rows up and down smoothly.
   - Verify editing an enhanced recipe displays "Copy Method from Original Recipe" and clicking it populates the method steps.
   - Map an ingredient to a Root Item (e.g. "Maple Syrup") -> save recipe -> verify saved recipe in Firestore has `subtypeId: null`.
4. Data Quality / Migration:
   - Run `scripts/migrate_recipe_taxonomy_levels.js` in dry-run mode, then test interactive category confirmation in Data Quality.

---

## Definition of Done

- All 6 Implementation Units (U1-U6) implemented with zero syntax errors.
- `styles/responsive.css` cleaned of duplicate pseudo-element.
- `index.html` cleaned of obsolete `#syncNowTopBtn`.
- All repository modules import `HOUSEHOLD_ID` from `src/config/firebase.js`.
- Automated tests exit code 0 (`npm run build` succeeds).
- All changes committed to a dedicated feature branch starting from `development`.
