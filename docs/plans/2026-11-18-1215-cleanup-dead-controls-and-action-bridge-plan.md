---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
title: Clean Up Dead data-pp-* Controls, Migrate Inline onclicks to ActionBridge, and Expand Dead-Controls Guard
date: 2026-11-18
---

# Clean Up Dead `data-pp-*` Controls, Migrate Inline `onclick`s to `ActionBridge`, and Expand Dead-Controls Guard

## Goal Capsule

- **Objective**: Eliminate all 30 broken `data-pp-*` controls, migrate remaining live inline `onclick=` handlers to `data-action` routed through PlatePlan's single `ActionBridge.js` / `RecipeActionBridge.js` dispatcher, and extend `scripts/test_dead_controls.js` to guard the entire app.
- **Means**:
  1. Remove the 29 dead `data-pp-*` attributes (and verify/prune unused legacy modal blocks) in `index.html`, plus the 1 `data-pp-click` in `src/components/recipe-editor/RecipeImportParserForm.js` (moving newly orphaned modules to `attic/` via `npm run ledger` if unused).
  2. Migrate inline `onclick=` handlers across `src/components/` and `src/views/` (32 files, 127 sites) to `data-action` + `data-*` attributes handled in `ActionBridge.js` (`routeAction`) and `RecipeActionBridge.js` (`routeRecipeAction`).
  3. Expand `scripts/test_dead_controls.js` from Pantry/Products/Planner-only to scan all of `index.html`, `src/views/`, and `src/components/`.
- **Authority & Boundaries**: Work on a fresh `dev/*` branch from `development`; target `development` only; reuse `ActionBridge.js` and `test_dead_controls.js` with zero parallel event bridges or duplicate test harnesses; follow `AGENTS.md` (`escapeAttr` for interpolated attributes, no `package.json` version bump on `dev/*`).

## Product Contract

### Requirements
- **R1 (Zero `data-pp-*` attributes)**: Neither `index.html` nor any file under `src/` contains `data-pp-click`, `data-pp-change`, `data-pp-input`, or `data-pp-focus`.
- **R2 (Single-bridge `data-action` routing)**: Live inline `onclick=` controls in `src/views/` and `src/components/` are migrated to `data-action` attributes routed in `ActionBridge.js` / `RecipeActionBridge.js` (or `AppInitializer.js` for existing grid delegation), and any `onclick=` calling a non-existent function is removed.
- **R3 (Whole-app dead-control guard)**: `scripts/test_dead_controls.js` scans all of `index.html`, `src/views/`, and `src/components/` and fails if any `data-pp-*`, dead `data-action`, or dead inline `on*` handler is introduced.

### Flows
1. User clicks any migrated button/control in Planner, Shopping, Recipe Wizard, Data Quality, Settings, or Shell -> `ActionBridge.js` capture listener (`document.addEventListener('click', ..., true)`) reads `data-action` and `dataset.*` -> `routeAction` / `routeRecipeAction` dispatches the exact module handler.
2. Developer runs `node scripts/test_dead_controls.js` -> verifies zero `data-pp-*` attributes and zero unrouted `data-action` or dead `on*` handlers across the entire app.

### Acceptance Examples
- **AE1**: `grep -rn "data-pp-click\|data-pp-change\|data-pp-input\|data-pp-focus" index.html src/` returns 0 matches.
- **AE2**: `node scripts/test_dead_controls.js` passes with full `index.html` + `src/views/` + `src/components/` coverage.
- **AE3**: `npm run ledger && node scripts/test_ledger.js` passes with 0 dead files outside `attic/`.

## Planning Contract

### Key Technical Decisions
- **KTD-1 (Reuse `ActionBridge.js` & `RecipeActionBridge.js`, no parallel bridge)**: Route recipe/editor actions in `src/services/RecipeActionBridge.js` and planner/shopping/data-quality/settings/shell actions in `src/services/ActionBridge.js`. Never add a second document-level click listener or `data-pp-*` shim.
- **KTD-2 (`index.html` legacy modals)**: Before deleting any modal wrapper ID in `index.html` (`r-src-type`, `unified-map-search`, `subst-search`, `enhance-search-orig`, `enhance-search-enh`), grep `src/` for the wrapper element ID; if `src/` still opens/populates that modal, strip only the dead `data-pp-*` attributes (or wire real `addEventListener`s if needed); if nothing in `src/` references the modal, remove the dead modal block or its `data-pp-*` attributes cleanly.
- **KTD-3 (Incremental migration by domain)**: Group the 32 inline-`onclick` files into two clean units (U2: Planner/Generator/Shopping + Shell/Settings; U3: Recipe/Recipe-Editor + Data Quality) so each unit is easy to verify and review.

### Sequencing
Execute U1 -> U2 -> U3 -> U4 in order.

## Implementation Units

### U1. Retire All 30 Dead `data-pp-*` Controls & Audit Legacy Recipe-Editor Markup
- **Files**:
  - `index.html`
  - `src/components/recipe-editor/RecipeImportParserForm.js` (and `src/components/componentRegistry.js` / `attic/` if `RecipeImportParserForm.js` is unused)
- **Changes**:
  - Grep `src/` for each legacy modal ID containing `data-pp-*` in `index.html` (`r-src-type`, `unified-map-search`, `subst-search`, `enhance-search-orig`, `recipe-step-orig-`, `enhance-search-enh`, `recipe-step-enh-`). Preserve live containers queried by `RecipeEditorModal.js` / `RecipeStepRow.js` (`#enh-name`, `#enh-changes`, `#orig-method-list`, `#enh-method-list`, `#r-src-type`), remove all 30 `data-pp-*` attributes (`click`, `change`, `input`, `focus`), and resolve unrouted `data-action`s in `#unified-map-modal`, `#subst-modal-wrap`, and `#enh-method-list`.
  - Audit `RecipeImportParserForm.js` (`data-pp-click="reviewPastedRecipeText()"`): since `reviewPastedRecipeText` does not exist and `renderRecipeImportParserForm` has no callers outside `componentRegistry.js`, remove it from `componentRegistry.js` and move `RecipeImportParserForm.js` to `attic/` (updating `attic/README.md` and running `npm run ledger`), or replace `data-pp-click` if a live caller exists.
- **Verification**: `grep -rn "data-pp-click\|data-pp-change\|data-pp-input" index.html src/` returns empty; `npm run ledger && node scripts/test_ledger.js` passes.

### U2. Migrate Inline `onclick=` Handlers in Planner, Generator, Shopping, Shell, Settings & Analytics
- **Files**:
  - `src/components/planner/PlannerGridRenderService.js`, `PlannerMealSlot.js`, `PlannerSwapModalRenderService.js`, `PlannerGridToolbar.js`, `PlannerWizardUI.js`, `PlannerModalsUI.js`, `src/views/PlannerView.js`
  - `src/components/generator/GeneratorCandidateDrawer.js`, `GeneratorWizardModal.js`
  - `src/components/shopping/ShoppingItemRow.js`
  - `src/components/prep/PrepSummaryToolbar.js`, `PrepStepCard.js`, `PrepContainerPlanner.js`
  - `src/components/shell/HeaderUI.js`, `NavigationUI.js`
  - `src/components/settings/DietaryExclusionManager.js`, `HouseholdSyncCard.js`
  - `src/components/analytics/WeeklySummaryToolbar.js`
  - `src/services/ActionBridge.js`
  - `scripts/test_planner_controls.js`
- **Changes**:
  - Replace inline `onclick="fn(...)"` in the files above with `data-action="..."` and `data-*` attributes (escaped via `escapeAttr`), and add matching `routeAction` branches in `src/services/ActionBridge.js` (preserving existing `stopPropagation` semantics where needed, e.g. modal backdrop clicks).
  - Update `scripts/test_planner_controls.js:602` (which currently asserts `window.setSlotConfiguredStatus(...)` in `onclick`) and any other `scripts/test_*.js` asserting `onclick=` strings to assert the migrated `data-action` / `data-*` attributes and `ActionBridge` routing.
- **Verification**: `node scripts/test_planner_controls.js && node scripts/test_shopping_list.js && node scripts/test_today_view.js` pass.

### U3. Migrate Inline `onclick=` Handlers in Recipe, Recipe-Editor, Pantry & Data Quality
- **Files**:
  - `src/components/recipe/RecipeDetailModalUI.js`, `RecipeWizardViews.js`, `RecipeWizardModal.js`, `RecipeEditorModalUI.js`, `RecipeWizardStep3View.js`
  - `src/components/recipe-editor/RecipeIngredientRow.js`, `RecipeStepRow.js`, `IngredientEditorRows.js`
  - `src/components/pantry/ReallocateProductModalRenderService.js`
  - `src/components/data-quality/ResolveUnlinkedModalRenderService.js`, `SubtypeOrphanResolverModal.js`, `MergeIngredientsModal.js`, `MacroDriftPreviewModal.js`, `MealPlanSyncWarningModal.js`
  - `src/components/recipe-editor/RecipeEditorModal.js`
  - `src/services/RecipeActionBridge.js`, `src/services/ActionBridge.js`
- **Changes**:
  - Replace inline `onclick=` with `data-action` + `data-*` attributes and route recipe actions in `RecipeActionBridge.js` and pantry/data-quality actions in `ActionBridge.js`.
  - Clean up dead `oninput="updateSaveBothVisibility()"`, `window.updateSaveBothVisibility`, and `reindexModalMethod` -> `reindexModalMethodRows` in `RecipeStepRow.js` and `RecipeEditorModal.js`.
- **Verification**: `node scripts/test_data_quality_wizards.js && node scripts/test_recipe_wizard_ui_space_efficiency.js && node scripts/test_variant_save_and_taxonomy_mapping.js` pass.

### U4. Expand `scripts/test_dead_controls.js` to Cover the Entire App
- **Files**:
  - `scripts/test_dead_controls.js`
- **Changes**:
  - Expand `scopeFiles()` in `scripts/test_dead_controls.js` to scan the entire `index.html`, all `src/views/*.js`, and all `src/components/**/*.js` (keeping `PlannerSwapModal*` excluded only if its deferred dead helper references remain), and extend the `data-pp-*` regex to include `data-pp-focus`.
  - Verify zero `data-pp-*` attributes, zero unrouted `data-action` attributes, and zero dead `on*` handlers across the entire repo.
- **Verification**: `node scripts/test_dead_controls.js` passes with full-repo coverage.

## Verification Contract

Run after all units complete:
- `node scripts/test_dead_controls.js`
- `node scripts/test_planner_controls.js`
- `node scripts/test_shopping_list.js`
- `node scripts/test_data_quality_wizards.js`
- `node scripts/test_recipe_wizard_ui_space_efficiency.js`
- `node scripts/test_variant_save_and_taxonomy_mapping.js`
- `npm run ledger && node scripts/test_ledger.js`
- `npm run build && node scripts/test_pwa_build.js`

## Definition of Done
- All 30 `data-pp-*` attributes removed and 127 inline `onclick=` sites migrated to `ActionBridge.js` / `RecipeActionBridge.js`.
- `scripts/test_dead_controls.js` covers full `index.html`, `src/views/`, and `src/components/` and passes.
- `npm run ledger`, `npm run build`, and all Verification Contract suites pass on a `dev/*` branch with a PR targeting `development`.
