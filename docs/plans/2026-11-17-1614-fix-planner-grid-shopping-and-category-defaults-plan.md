---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
title: Fix Planner Layout Grid Clear, Shopping List Stability & Keys, Swap Search Accents, and Category Macro Default
date: 2026-11-17
---

# Fix Planner Layout Grid Clear, Shopping List Stability & Keys, Swap Search Accents, and Category Macro Default

## Goal Capsule

- **Objective**: Fix five related UX and calculation issues across the Meal Planner Pre-Generation Layout Grid, Step 3 Shopping List, Step 3 Product Swap Modal, and Category-level default product selection.
- **Means**:
  1. Add a `Clear Grid` action button (with `showCustomConfirm` confirmation) in the Pre-Generation Layout Grid header routed through `ActionBridge.js`.
  2. Sort aggregated shopping list categories and items alphabetically by name (`localeCompare`) in `ShoppingCalculationService.js` / `ShoppingCategoryGroup.js` so list order never shifts on tick or swap.
  3. Include `subId` (and fall back to `key` when distinct) in `atHomeKey` inside `ShoppingCalculationService.js` so different Sub-Types or lines under one Root Item (such as Cherry Tomatoes and Baby Plum Tomatoes) cross off independently.
  4. Strip Unicode combining diacritics (NFD normalization) on both search queries and product fields in `ProductSwapModal.js` so searches like `creme fraiche` match `Crème Fraîche`.
  5. Sort Category-level candidate pools in `PantryTaxonomyService.js` (`resolveDynamicProductForIngredient`) by the active strategy (`highest_protein_per_kcal` by default) instead of returning the first Root Item's `isAutoDefault` product in array order.
- **Authority & Boundaries**: Work on a fresh `dev/*` branch from `development`; target `development` only; follow `AGENTS.md` (`data-action` + `ActionBridge.js`, `showCustomConfirm` from `DialogHelpers.js`, no `package.json` version bump on `dev/*`).

## Product Contract

### Requirements
- **R1 (Clear Layout Grid)**: The Pre-Generation Layout Grid header shows a `Clear Grid` button (enabled/visible when any slot is pinned or skipped, or always available with a no-op guard) that prompts via `showCustomConfirm`, clears `state.skeletonGrid`, saves, and re-renders the planner grid.
- **R2 (Fixed Shopping List Order)**: Once loaded, shopping list category groups and the items within each category render in fixed alphabetical order (`A -> Z`), unaffected by ticking items off or swapping products.
- **R3 (Independent Sub-Type Ticks)**: Crossing off one shopping list item (e.g. `Cherry Tomatoes`) only toggles that specific Sub-Type/line and does not cross off sibling Sub-Types under the same Root Item (e.g. `Baby Plum Tomatoes`), while still keeping the tick if the user swaps brands/products on that Sub-Type.
- **R4 (Diacritic-Insensitive Swap Search)**: Typing unaccented terms like `creme fraiche` in the Step 3 Product Swap Modal (all tiers, including Tier 3 Global Catalog) matches accented product names, brands, and sub-types such as `Crème Fraîche`.
- **R5 (Category-Level Macro Default Selection)**: When an ingredient line is bound at the Category level (e.g. `Pasta`), `resolveDynamicProductForIngredient` evaluates the Category's candidate pool using the active strategy (`highest_protein_per_kcal` by default) rather than short-circuiting on whichever Root Item's `isAutoDefault` product appears first in `products[]`.

### Flows
1. **Clear Grid Flow**: User taps `Clear Grid` in `PlannerGridRenderService.js` -> `ActionBridge.js` dispatches `clear-skeleton-grid` -> `PlannerSkeletonGridUI.js` confirms with `showCustomConfirm` -> resets `state.skeletonGrid = {}` -> persists via `saveCurrentPlan` / `window.saveState` -> re-renders `renderPlannerWizard()`.
2. **Shopping List Aggregation & Render Flow**: `aggregateShoppingListFromPlan` builds `atHomeKey` using `canonicalIngId` + `subId` (or `key` if no `subId` and distinct `rawName`) -> sorts `items` and `groups` alphabetically -> `ShoppingCategoryGroup.js` renders groups and items in that fixed alphabetical order.
3. **Swap Modal Search Flow**: User types `creme fraiche` -> `normalizeSearchText` strips combining diacritics (`NFD` + `/[\u0300-\u036f]/g`) on query and candidate fields -> `Crème Fraîche` appears in Tier 3 results.
4. **Category Default Resolution Flow**: `resolveDynamicProductForIngredient` handles Sub-Type (`subId`) and Root Item (`ingId`) with explicit `defaultProductId` / `isAutoDefault` first, and for Category (`cat`) sorts the candidate pool with `compareProductsByStrategy(a, b, criterion)` (preferring `isAutoDefault` only when a single explicit category-level default exists, not per-root `isAutoDefault` flags).

### Acceptance Examples
- **AE1**: Pinning 2 meals and skipping 1 slot in the Pre-Generation Layout Grid, clicking `Clear Grid`, and confirming resets all slots to `⚡ Auto-Generate (Unassigned)`.
- **AE2**: Ticking `Cherry Tomatoes` (`ing_tomato:sub_cherry`) leaves `Baby Plum Tomatoes` (`ing_tomato:sub_baby_plum`) unticked; swapping `Cherry Tomatoes` to another Cherry Tomatoes brand keeps it ticked; list order stays alphabetical before and after ticking/swapping.
- **AE3**: Searching `creme fraiche` in Step 3 Product Swap Modal Tier 3 returns `Tesco Crème Fraîche`.
- **AE4**: Given Category `Pasta` containing Root `Wheat Spaghetti` (`isAutoDefault: true`, `12g prot / 350 kcal`) first in `products[]` and Root `Red Lentil Pasta` (`isAutoDefault: true`, `26g prot / 340 kcal`) second in `products[]`, resolving a Category-only `Pasta` line under `highest_protein_per_kcal` selects `Red Lentil Pasta`.

## Planning Contract

### Key Technical Decisions
- **KTD-1 (`ActionBridge` routing for `Clear Grid`)**: Route `data-action="clear-skeleton-grid"` in `src/services/ActionBridge.js` rather than inline `onclick`, matching `AGENTS.md` and modern Today/Planner actions.
- **KTD-2 (`atHomeKey` granularity)**: Compute `atHomeKey` using `effectiveSubId = subId || ing.subtypeId || ing.subTypeId || matchedProd?.subtypeId || matchedProd?.subTypeId || null`:
  - When `effectiveSubId` is present: `${canonicalIngId || matchedIng?.id || ingId || 'ing'}:${effectiveSubId}`
  - When `effectiveSubId` is absent and both `canonicalIngId` (or `matchedIng?.id` / `ingId`) and `rawName` are present: `${canonicalIngId || matchedIng?.id || ingId}:${rawName}`
  - Otherwise: `canonicalIngId || matchedIng?.id || ingId || rawName`
  - Normalized with `.toLowerCase().replace(/\s+/g, '_')`. This preserves ticks across brand/product swaps within the same Sub-Type or line while keeping sibling Sub-Types and distinct unlinked/direct-product lines (such as `Cherry Tomatoes` vs `Baby Plum Tomatoes`) strictly separate.
- **KTD-3 (Category `pickBestProduct` without breaking Root/Sub-Type defaults)**:
  - In `src/services/PantryTaxonomyService.js`, pass `{ respectExplicitAutoDefault: true }` for Sub-Type (step 1) and Root Item (step 2), and `{ respectExplicitAutoDefault: false }` for Category (step 3) so `HydrationService`'s per-root `isAutoDefault` flags do not short-circuit Category-wide macro sorting.

### Sequencing
Execute U1 -> U2 -> U3 -> U4 in order; each unit touches distinct files and can be tested and committed independently.

## Implementation Units

### U1. Pre-Generation Layout Grid `Clear Grid` Button
- **Files**:
  - `src/components/planner/PlannerGridRenderService.js`
  - `src/components/planner/PlannerSkeletonGridUI.js`
  - `src/services/ActionBridge.js`
  - `scripts/test_planner_controls.js`
- **Changes**:
  - Add a `Clear Grid` button (`data-action="clear-skeleton-grid"`) in the header of `renderSkeletonGridUI()` in `PlannerGridRenderService.js` (line ~244).
  - Export `clearSkeletonGrid()` in `PlannerSkeletonGridUI.js`: checks if `state.skeletonGrid` has keys, confirms via `showCustomConfirm('Clear all pinned and skipped slots from the Pre-Generation Layout Grid?', 'Clear Layout Grid', () => { ... })` (passing the clear/save/re-render logic as the 3rd `onConfirm` callback, since `showCustomConfirm` is callback-based), resets `state.skeletonGrid = {}`, persists via `window.saveState?.()` (matching `setSplitPersonSlotStatus`), and re-renders `window.renderPlannerWizard?.()`.
  - Route `clear-skeleton-grid` in `ActionBridge.js` (`import('../components/planner/PlannerSkeletonGridUI.js').then(m => m.clearSkeletonGrid())`).
- **Verification**: Add test in `scripts/test_planner_controls.js` checking `renderSkeletonGridUI` renders `data-action="clear-skeleton-grid"` and `clearSkeletonGrid` clears `skeletonGrid` when `#view-modal-wrap`, `#view-modal-content`, and `#btn-confirm-yes.onclick()` are triggered.

### U2. Fixed Shopping List Order & Independent Sub-Type Ticks
- **Files**:
  - `src/services/ShoppingCalculationService.js`
  - `src/components/shopping/ShoppingCategoryGroup.js`
  - `scripts/test_shopping_list.js`
- **Changes**:
  - In `ShoppingCalculationService.js` (`aggregateShoppingListFromPlan`):
    - Derive `effectiveSubId = subId || ing.subtypeId || ing.subTypeId || matchedProd?.subtypeId || matchedProd?.subTypeId || null`.
    - Compute `atHomeKey` using `effectiveSubId` when present (`${canonicalIngId || matchedIng?.id || ingId || 'ing'}:${effectiveSubId}`), else `${rootOrIngId}:${rawName}` when both exist, else `rootOrIngId || rawName`.
    - Sort `items` alphabetically by `(a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' })`, and sort `groups` alphabetically by category name (with items inside each group already sorted alphabetically).
  - In `ShoppingCategoryGroup.js` (`renderShoppingCategoriesList` / `groupShoppingItemsByCategory`):
    - Ensure category entries and per-category items are sorted alphabetically by name so any direct caller also gets fixed order.
- **Verification**: Add AE2 assertions in `scripts/test_shopping_list.js` verifying `Cherry Tomatoes` and `Baby Plum Tomatoes` receive distinct `atHomeKey`s and that items/categories return in fixed alphabetical order regardless of slot order or `shoppingAtHome` state.

### U3. Diacritic-Insensitive Search in Step 3 Product Swap Modal
- **Files**:
  - `src/components/ProductSwapModal.js`
  - `scripts/test_planner_wizard_pipeline.js` (or `scripts/test_shopping_list.js`)
- **Changes**:
  - Add a small helper `normalizeSearchText(str)` using `String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()`.
  - Update `renderList(query)` in `ProductSwapModal.js` (lines ~248-249) to normalize both `query` and `item.name`, `item.brand`, and `inferSubtype(item)`.
- **Verification**: Add a unit check verifying `normalizeSearchText` / swap search matches `Crème Fraîche` when queried with `creme fraiche`.

### U4. Category-Level Macro Default Selection in `resolveDynamicProductForIngredient`
- **Files**:
  - `src/services/PantryTaxonomyService.js`
  - `scripts/test_dynamic_recipe_product_resolution.js`
- **Changes**:
  - Update `pickBestProduct(candidatePool, { respectExplicitAutoDefault = true } = {})` inside `resolveDynamicProductForIngredient` (`PantryTaxonomyService.js` line ~690).
  - Keep `respectExplicitAutoDefault: true` for Sub-Type (Step 1) and Root Item (Step 2) pools, and pass `{ respectExplicitAutoDefault: false }` for the Category pool (Step 3) so `compareProductsByStrategy(a, b, criterion)` picks the highest `prot / kcal` product across the whole category instead of the first Root Item's `isAutoDefault` entry.
- **Verification**: Add AE4 test in `scripts/test_dynamic_recipe_product_resolution.js` verifying `Pasta` category resolves `Red Lentil Pasta` over lower-protein wheat pasta even when wheat pasta appears first in `products[]` with `isAutoDefault: true`.

## Verification Contract

Run after all units complete:
- `node scripts/test_planner_controls.js`
- `node scripts/test_shopping_list.js`
- `node scripts/test_planner_wizard_pipeline.js`
- `node scripts/test_dynamic_recipe_product_resolution.js`
- `node scripts/test_auto_default_and_recipe_recalculation.js`
- `npm run ledger && node scripts/test_ledger.js`
- `npm run build && node scripts/test_pwa_build.js`

## Definition of Done
- All 4 implementation units (U1–U4) implemented on a fresh `dev/*` branch from `development`.
- All Verification Contract suites, ledger check, and production build pass after the final edit.
- PR opened targeting `development` with `.github/pull_request_template.md` completed.
