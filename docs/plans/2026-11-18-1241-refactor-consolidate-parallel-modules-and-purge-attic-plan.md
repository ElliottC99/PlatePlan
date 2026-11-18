---
title: "refactor: Consolidate the 6 parallel modules and purge expired attic files"
date: 2026-11-18
type: refactor
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# refactor: Consolidate the 6 parallel modules and purge expired attic files

## Goal Capsule
- Objective: Eliminate the 6 live parallel modules across App State, Data Quality, and Action Sheets into their 3 canonical owners so `LEDGER.md` reports `0 parallel`, and purge the 38 expired `attic/` entries whose 2-week quarantine ended on or before 2026-11-17.
- Means: Fold any uniquely used exports from parallel modules into their canonical owner (`src/store/coreState.js`, `src/services/DataQualityScanner.js`, `src/components/navigation/ActionSheetUI.js`), repoint all live imports and tests, move the 6 retired modules to `attic/` with a `2026-12-02` delete-after date, delete the 38 expired `attic/` files, and regenerate `LEDGER.md` + `plateplan-architecture.md`.
- Authority: Session-settled brainstorm decisions govern scope (6 parallel modules + expired `attic/` entries only); canonical ownership rules in `plateplan-architecture.md` and `AGENTS.md` govern module placement and quarantine.
- Stop condition: Do not purge `attic/` entries with `delete after` dates in `2026-11-24` or `2026-12-02`, and do not refactor `src/services/ShoppingListService.js` in this PR.

## Product Contract

### Problem Frame
PlatePlan's ledger (`LEDGER.md`) currently tracks 6 parallel modules across 3 jobs (app state, data quality, and action sheets) plus 38 `attic/` files whose 2-week quarantine window (`delete after` <= `2026-11-17`) has already passed as of `2026-11-18`. Keeping duplicate module entrypoints increases drift risk when state, data-quality remediation, or action sheets are modified.

### Requirements
- R1. Consolidate the 3 parallel App State modules (`src/store/state.js`, `src/state/AppState.js`, `src/models/StateModel.js`) so `src/store/coreState.js` (and `src/store/store.js` facade) is the sole App State owner with all live callers and tests updated.
- R2. Consolidate the 2 parallel Data Quality modules (`src/services/DataQualityScannerService.js`, `src/services/DataQualityService.js`) into `src/services/DataQualityScanner.js` so it is the sole Data Quality owner with all live callers and tests updated.
- R3. Consolidate `src/components/pantry/ActionSheetUI.js` into `src/components/navigation/ActionSheetUI.js` so `src/components/navigation/ActionSheetUI.js` is the sole Action Sheet owner and `src/views/PantryBankView.js` imports from it.
- R4. Quarantine the 6 retired modules in `attic/src/...` with `delete after` `2026-12-02` in `attic/README.md`, update `plateplan-architecture.md` parallel-modules list, and verify `npm run ledger` reports `0 parallel`, `0 dead`, `0 dead shims`.
- R5. Purge only expired `attic/` files whose `delete after` date in `attic/README.md` is on or before `2026-11-17` (38 rows across `2026-11-11` to `2026-11-17`), removing their rows from `attic/README.md` while preserving all `2026-11-24`, `2026-12-02`, and undated (`no date` in `LEDGER.md`) entries.

### Scope Boundaries
- In scope: The 6 parallel modules listed in `LEDGER.md`, their direct callers/tests (including internal `src/store/` imports from `src/store/state.js`), `plateplan-architecture.md`, `LEDGER.md`, `attic/README.md`, and the 38 expired files in `attic/`.
- Out of scope: Refactoring `src/services/ShoppingListService.js`, pruning the 95 unused exports in `LEDGER.md`, or purging active quarantine entries (`2026-11-24`, `2026-12-02`) or the 30 undated legacy `attic/` files.

## Planning Contract

### Key Technical Decisions
- KTD1. Consolidate only the 6 parallel modules and purge only expired `attic/` entries (`delete-after <= 2026-11-18`, i.e., `2026-11-11` through `2026-11-17`) (session-settled: user-directed — chosen over including `ShoppingListService.js` or purging all `attic/` files: keeps the 2-week quarantine contract intact for recent moves and isolates I2 to the exact parallel-module list). Covers R1, R2, R3, R5.
- KTD2. Move `getProfileMealTargets`, `normalizeProfileData`, and `getProfilesFromState` from `src/models/StateModel.js` into `src/store/coreState.js` (and re-export via `src/store/store.js`) rather than inventing a new `ProfileService` module. This follows `AGENTS.md`'s rule to extend the existing canonical owner rather than splitting new files. Covers R1.
- KTD3. Fold `dispatchStateEvent`, `subscribe`, and `updateState` from `src/store/state.js` into `src/store/coreState.js`, repoint internal store modules (`store.js`, `planSlice.js`, `shoppingSlice.js`, `recipeActions.js`, `pantryActions.js`) to `coreState.js`, and repoint `src/state/AppState.js` callers (`src/main.js`, `RecipeWizardStep1Handlers.js`, `RecipeWizardModal.js`, `RecipeWizardState.js`, `scripts/test_recipe_wizard_edit.js`) directly to `src/store/store.js` (updating `AppState.getState()` / `AppState.updateState()` calls in `src/main.js` to `getState()` / `updateState()`). Covers R1.
- KTD4. Merge `openActionSheet` from `src/components/pantry/ActionSheetUI.js` into `src/components/navigation/ActionSheetUI.js` alongside `openCreateActionSheet` rather than rewriting callers of either signature, minimizing UI regression risk while eliminating the duplicate module. Covers R3.

### High-Level Technical Design
| Job | Canonical Owner | Retired Parallel Modules | Live Callers to Repoint |
|---|---|---|---|
| App state | `src/store/coreState.js` (+ `src/store/store.js`) | `src/store/state.js`, `src/state/AppState.js`, `src/models/StateModel.js` | `src/store/store.js`, `src/store/planSlice.js`, `src/store/shoppingSlice.js`, `src/store/actions/recipeActions.js`, `src/store/actions/pantryActions.js`, `src/main.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`, `src/components/recipe/RecipeWizardModal.js`, `src/components/recipe/RecipeWizardState.js`, `src/views/SettingsView.js`, `src/services/PortionCalculationService.js`, `src/services/FitScoreService.js`, `scripts/test_recipe_wizard_edit.js` |
| Data Quality | `src/services/DataQualityScanner.js` | `src/services/DataQualityScannerService.js`, `src/services/DataQualityService.js` | `src/main.js`, `src/views/DataQualityView.js`, `src/views/DataQualityTableRenderService.js`, `scripts/test_recipe_servings_recalibration.js` |
| Action sheets | `src/components/navigation/ActionSheetUI.js` | `src/components/pantry/ActionSheetUI.js` | `src/views/PantryBankView.js` |

### Sequencing
1. Create a fresh `dev/consolidate-parallel-modules-and-purge-attic` branch from updated `development` via `npm run branch:start`.
2. Execute `U1` (App State), `U2` (Data Quality), and `U3` (Action Sheet) module consolidations.
3. Execute `U4` (Expired `attic/` purge) and `U5` (`plateplan-architecture.md` + `LEDGER.md` regeneration + `attic/README.md` quarantine updates).
4. Run full verification (`npm run ledger`, `node scripts/test_*.js`, `npm run build`).

## Implementation Units

### U1. Consolidate App State parallel modules into `src/store/coreState.js` and `src/store/store.js`
- Covers: R1, KTD1, KTD2, KTD3
- Files: `src/store/coreState.js`, `src/store/store.js`, `src/store/planSlice.js`, `src/store/shoppingSlice.js`, `src/store/actions/recipeActions.js`, `src/store/actions/pantryActions.js`, `src/main.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`, `src/components/recipe/RecipeWizardModal.js`, `src/components/recipe/RecipeWizardState.js`, `src/views/SettingsView.js`, `src/services/PortionCalculationService.js`, `src/services/FitScoreService.js`, `scripts/test_recipe_wizard_edit.js`
- Approach:
  1. Move `dispatchStateEvent`, `subscribe`, and `updateState` from `src/store/state.js` into `src/store/coreState.js`, and repoint `src/store/store.js`, `src/store/planSlice.js`, `src/store/shoppingSlice.js`, `src/store/actions/recipeActions.js`, and `src/store/actions/pantryActions.js` from `./state.js` / `../state.js` to `./coreState.js` / `../coreState.js`.
  2. Move `getProfileMealTargets`, `normalizeProfileData`, and `getProfilesFromState` from `src/models/StateModel.js` into `src/store/coreState.js` (and re-export from `src/store/store.js`), then repoint `SettingsView.js`, `PortionCalculationService.js`, and `FitScoreService.js` to `src/store/coreState.js`.
  3. Repoint all `src/state/AppState.js` imports in `src/main.js`, `RecipeWizardStep1Handlers.js`, `RecipeWizardModal.js`, `RecipeWizardState.js`, and `scripts/test_recipe_wizard_edit.js` to `src/store/store.js`. In `src/main.js`, replace `AppState.getState()` / `AppState.updateState(...)` with `getState()` / `updateState(...)` (preserving `window.AppState` alias if needed), and in `scripts/test_recipe_wizard_edit.js` import `getState` from `../src/store/store.js`.
  4. Move `src/store/state.js`, `src/state/AppState.js`, and `src/models/StateModel.js` to `attic/src/...`.
- Test scenarios:
  1. `node scripts/test_recipe_wizard_edit.js` passes importing `getState` from `src/store/store.js`.
  2. `FitScoreService` and `PortionCalculationService` callers resolve `getProfileMealTargets` and `getProfilesFromState` identically across `node test_vault_fit_score.js` and `node scripts/test_planner_controls.js`.
  3. `node --check` passes on every edited `src/` module.

### U2. Consolidate Data Quality modules into `src/services/DataQualityScanner.js`
- Covers: R2, KTD1
- Files: `src/services/DataQualityScanner.js`, `src/main.js`, `src/views/DataQualityView.js`, `src/views/DataQualityTableRenderService.js`, `scripts/test_recipe_servings_recalibration.js`
- Approach:
  1. Move `dismissDataQualityAdvisory`, `performGlobalProductRelink`, and `verifyZeroCalorieIngredient` from `src/services/DataQualityService.js` into `src/services/DataQualityScanner.js` (preserving `window.DataQualityScannerService` compatibility).
  2. Repoint `src/main.js` (keeping `window.DataQualityService` populated from `DataQualityScanner.js`), `src/views/DataQualityView.js`, and `src/views/DataQualityTableRenderService.js` to `src/services/DataQualityScanner.js`.
  3. Repoint `scripts/test_recipe_servings_recalibration.js` from `DataQualityScannerService.js` directly to `src/services/DataQualityScanner.js`.
  4. Move `src/services/DataQualityScannerService.js` and `src/services/DataQualityService.js` to `attic/src/services/...`.
- Test scenarios:
  1. `node scripts/test_recipe_servings_recalibration.js` passes importing `calculateRecipeDynamicMacros` from `src/services/DataQualityScanner.js`.
  2. `node scripts/test_data_quality_wizards.js` passes with all Data Quality operations routed through `DataQualityScanner.js`.

### U3. Consolidate Pantry ActionSheetUI into `src/components/navigation/ActionSheetUI.js`
- Covers: R3, KTD1, KTD4
- Files: `src/components/navigation/ActionSheetUI.js`, `src/views/PantryBankView.js`
- Approach:
  1. Add `openActionSheet` from `src/components/pantry/ActionSheetUI.js` into `src/components/navigation/ActionSheetUI.js` alongside `openCreateActionSheet` (using `escapeHtml` already present in `navigation/ActionSheetUI.js`).
  2. Update dynamic `import('../components/pantry/ActionSheetUI.js')` calls in `src/views/PantryBankView.js` (`item-action-sheet` and `subtype-action-sheet`) to `import('../components/navigation/ActionSheetUI.js')`.
  3. Move `src/components/pantry/ActionSheetUI.js` to `attic/src/components/pantry/ActionSheetUI.js`.
- Test scenarios:
  1. `node --check src/components/navigation/ActionSheetUI.js src/views/PantryBankView.js` succeeds cleanly.
  2. `grep -rn "pantry/ActionSheetUI" src/ scripts/ index.html` returns zero matches.

### U4. Purge expired `attic/` files (`delete after` <= `2026-11-17`)
- Covers: R5, KTD1
- Files: `attic/README.md`, expired files under `attic/`
- Approach:
  1. Identify the 38 rows in `attic/README.md` with `delete after` dates on or before `2026-11-17` (`2026-11-11`: 21, `2026-11-12`: 3, `2026-11-13`: 11, `2026-11-17`: 3).
  2. Delete those 38 files (and prune any resulting empty directories inside `attic/`) while leaving all `2026-11-24` (12 files) and `2026-12-02` (`RecipeImportParserForm.js` + the 6 newly retired parallel modules) files intact.
  3. Remove the 38 purged rows from `attic/README.md` and append the 6 newly retired parallel modules with `delete after` `2026-12-02`.
- Test scenarios:
  1. Verify every remaining row in `attic/README.md` has `delete after` >= `2026-11-24` and exists on disk in `attic/`.
  2. Verify no expired (`<= 2026-11-17`) file remains in `attic/`.

### U5. Update `plateplan-architecture.md` and regenerate `LEDGER.md`
- Covers: R4
- Files: `plateplan-architecture.md`, `LEDGER.md`
- Approach:
  1. Update the parallel-modules list and Data Quality owner note in `plateplan-architecture.md` so App state (`coreState.js`), Data Quality (`DataQualityScanner.js` — audit + remediation), and Action sheets (`navigation/ActionSheetUI.js`) each reflect a single owner.
  2. Run `npm run ledger` to regenerate `LEDGER.md` and verify `0 parallel`, `0 dead`, and `0 dead shims`.
- Test scenarios:
  1. `npm run ledger && node scripts/test_ledger.js` passes with `0 parallel`, `0 dead`, `0 dead shims`.

## Verification Contract
- `npm run ledger && node scripts/test_ledger.js` — `0 parallel`, `0 dead`, `0 dead shims`
- `node scripts/test_dead_controls.js`
- `node scripts/test_hig_dark_mode.js`
- `node scripts/test_recipe_wizard_edit.js`
- `node scripts/test_recipe_servings_recalibration.js`
- `node scripts/test_data_quality_wizards.js`
- `node scripts/test_planner_controls.js`
- `node scripts/test_shopping_list.js`
- `node test_vault_fit_score.js`
- `npm run build && node scripts/test_pwa_build.js`
- `grep -rnE "store/state\.js|state/AppState|models/StateModel|services/DataQualityScannerService|services/DataQualityService|pantry/ActionSheetUI" src/ scripts/ index.html` returns zero matches

## Definition of Done
- All 6 parallel modules are consolidated into their 3 canon owners and moved to `attic/` (`delete after: 2026-12-02`).
- All 38 expired `attic/` files (`delete after <= 2026-11-17`) are deleted and removed from `attic/README.md`; all `2026-11-24`, `2026-12-02`, and undated (`no date` in `LEDGER.md`) entries remain on disk.
- `plateplan-architecture.md` and `LEDGER.md` reflect `0 parallel`, `0 dead`, `0 dead shims`.
- All verification checks pass cleanly on a `dev/` branch synced with `origin/development`.
