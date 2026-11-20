---
title: "feat: Persist Planner Layout Grid and add synced Layout Grid templates"
date: 2026-11-18
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Persist Planner Layout Grid and add synced Layout Grid templates

## Goal Capsule
- Objective: Preserve the Step 1 Pre-Generation Layout Grid (`skeletonGrid`) across page refreshes even before plan generation, and let users save, load, and delete named Layout Grid templates synced across both household phones.
- Means: Persist and restore `skeletonGrid` in `src/store/cacheSlice.js`, call `saveStateCache(getState())` on grid mutations in `src/components/planner/PlannerSkeletonGridUI.js`, store `gridTemplates` in household `preferences.gridTemplates` (ensuring `whitelistPreferences` retains `gridTemplates`), and add template controls in `PlannerGridRenderService.js` routed via `ActionBridge.js`.
- Authority: Session-settled brainstorm decisions govern scope (`cacheSlice.js` persistence + `preferences.gridTemplates` synced via existing Firestore preferences path); `AGENTS.md` UI rules govern `data-action` routing and `DialogHelpers.js` prompts/confirms (no `<select>` dropdowns, no inline `onclick`).
- Stop condition: Do not create new Firestore collections or modify `firestore.rules`.

## Product Contract

### Problem Frame
`src/store/cacheSlice.js` persists `recipes`, `ingredients`, `products`, `categories`, `preferences`, `settings`, `currentPlan`, and `shoppingList`, omitting `state.skeletonGrid`. Refreshing the app before generating a plan wipes Step 1 pins, skips, and split assignments. Users also have no way to save a recurring weekly Layout Grid (such as a standard work week) for reuse.

### Requirements
- R1. `cacheSlice.js` (`saveStateCache` and `initStoreCache`) persists and restores `skeletonGrid`, all `PlannerSkeletonGridUI.js` mutators (`setSlotConfiguredStatus`, `setSplitPersonSlotStatus`, `clearSkeletonGrid`) trigger `saveStateCache(getState())`, and `HydrationService.js` does not overwrite a non-empty cached/edited `state.skeletonGrid` on hydration or realtime plan snapshot updates.
- R2. Users can save the current non-empty Layout Grid as a named template (`preferences.gridTemplates`), load a saved template onto `state.skeletonGrid` (also syncing `state.currentPlannerDays` from `template.days`, re-rendering Step 1, and saving cache), and delete a saved template after confirmation.
- R3. `preferences.gridTemplates` is permitted by `whitelistPreferences` in `src/services/PreferenceRepository.js` (with an appropriate per-key size allowance above 10 KB) so templates sync across Elliott's and Chloe's phones.
- R4. Template controls use `data-action` attributes on sibling `<button>` elements with CSS `var(--...)` tokens routed in `ActionBridge.js` and `DialogHelpers.js` (`showPrompt` / `showCustomConfirm`) dialogs (no native `<select>`, no inline `onclick`, no native `alert`/`confirm`/`prompt`).

### Scope Boundaries
- In scope: `src/store/cacheSlice.js`, `src/services/HydrationService.js`, `src/services/PreferenceRepository.js`, `src/components/planner/PlannerSkeletonGridUI.js`, `src/components/planner/PlannerGridRenderService.js`, `src/components/generator/GeneratorConstraintsForm.js`, `src/services/ActionBridge.js`, and `scripts/test_planner_controls.js`.
- Out of scope: New Firestore collections, `firestore.rules` changes, or multi-week calendar views.

## Planning Contract

### Key Technical Decisions
- KTD1. Persist `skeletonGrid` in `cacheSlice.js` and store `gridTemplates` in `preferences.gridTemplates` synced via Firestore preferences (session-settled: user-directed — chosen over localStorage-only templates or delaying templates: syncs templates to both phones using existing preferences persistence without schema migrations or rule edits). Covers R1, R2, R3.
- KTD2. Render saved templates as compact clickable pills/chips inside `.skeleton-grid-panel` with `data-action="load-grid-template"` and `data-action="delete-grid-template"`, plus a `Save Template` button (`data-action="save-grid-template"`), rather than a `<select>` dropdown. Covers R4.

### Sequencing
1. Create `dev/persist-layout-grid-and-templates` from updated `development`.
2. Execute `U1` (`cacheSlice.js` + `PlannerSkeletonGridUI.js` `skeletonGrid` persistence).
3. Execute `U2` (`preferences.gridTemplates` whitelist + `saveGridTemplate`/`loadGridTemplate`/`deleteGridTemplate` + `PlannerGridRenderService.js` + `ActionBridge.js`).
4. Add tests in `scripts/test_planner_controls.js` and run `npm run lint`, `npm test`, and `npm run build`.

## Implementation Units

### U1. Persist `skeletonGrid` in `cacheSlice.js` and protect it in `HydrationService.js`
- Covers: R1, KTD1
- Files: `src/store/cacheSlice.js`, `src/services/HydrationService.js`, `src/components/planner/PlannerSkeletonGridUI.js`
- Approach:
  1. In `src/store/cacheSlice.js`, include `skeletonGrid: fullState.skeletonGrid || latestCore.skeletonGrid || {}` in `saveStateCache` payload and restore `targetState.skeletonGrid = (initialCache.skeletonGrid && typeof initialCache.skeletonGrid === 'object') ? initialCache.skeletonGrid : {}` in `initStoreCache`.
  2. In `src/services/HydrationService.js` (`hydrateHouseholdData` and `subscribeCurrentPlan`), only populate `getState().skeletonGrid = plan.skeletonGrid` when `getState().skeletonGrid` is currently empty (`Object.keys(getState().skeletonGrid || {}).length === 0`) so Firestore's saved `currentPlan.skeletonGrid` does not overwrite unsaved Step 1 edits or loaded templates on refresh.
  3. In `src/components/planner/PlannerSkeletonGridUI.js`, call `saveStateCache(getState())` inside `setSlotConfiguredStatus`, `setSplitPersonSlotStatus`, and `clearSkeletonGrid` confirmation callback so pre-generation edits persist across refreshes.
- Test scenarios:
  1. Mutating `state.skeletonGrid` via `setSlotConfiguredStatus` or `setSplitPersonSlotStatus` populates `state.skeletonGrid`, and `saveStateCache` / `initStoreCache` round-trips `skeletonGrid`.
  2. `clearSkeletonGrid` resets `state.skeletonGrid` to `{}` and persists the cleared grid.

### U2. Add synced Layout Grid templates (`preferences.gridTemplates`) and Step 1 UI controls
- Covers: R2, R3, R4, KTD1, KTD2
- Files: `src/services/PreferenceRepository.js`, `src/components/planner/PlannerSkeletonGridUI.js`, `src/components/planner/PlannerGridRenderService.js`, `src/components/generator/GeneratorConstraintsForm.js`, `src/services/ActionBridge.js`, `scripts/test_planner_controls.js`
- Approach:
  1. In `src/services/PreferenceRepository.js`, add `'gridTemplates'` to `whitelistPreferences` `allowedKeys` and raise the per-key size cap for `'gridTemplates'` (e.g. `102400` bytes) so multiple saved templates are not silently dropped by the 10 KB cap.
  2. In `PlannerSkeletonGridUI.js`, implement and export `async saveGridTemplate()`, `loadGridTemplate(templateId)`, and `deleteGridTemplate(templateId)`:
     - `saveGridTemplate`: requires non-empty `skeletonGrid`, awaits `showPrompt({ title: 'Save Layout Grid Template', ... })` from `DialogHelpers.js` for a template name, deep-clones `skeletonGrid`, awaits `savePreferences(nextPrefs)` first, then updates `setPreferences(nextPrefs)` and re-renders.
     - `loadGridTemplate`: deep-clones the template's `skeletonGrid` onto `state.skeletonGrid`, syncs `state.currentPlannerDays = Number(template.days) || state.currentPlannerDays`, calls `saveStateCache(getState())`, and re-renders Step 1.
     - `deleteGridTemplate`: confirms via `showCustomConfirm`, awaits `savePreferences(nextPrefs)` without the deleted template, updates `setPreferences(nextPrefs)`, and re-renders.
  3. Update `GeneratorConstraintsForm.js` to read `gridTemplates` from `getState()?.preferences?.gridTemplates || getState()?.userPrefs?.gridTemplates || []` and pass it into `renderSkeletonGridUI`. In `PlannerGridRenderService.js`, render the `Save Template` button and sibling `<button>` template pills (`data-action="load-grid-template"` and `data-action="delete-grid-template"`, both with `data-template-id`) using CSS `var(--...)` tokens only.
  4. Route `save-grid-template`, `load-grid-template`, and `delete-grid-template` in `src/services/ActionBridge.js`.
  5. Add test coverage in `scripts/test_planner_controls.js` (with `showPrompt`/`showCustomConfirm` DOM mocks and `cacheSlice` round-trip check) for saving, loading (including `currentPlannerDays` sync), deleting, and `whitelistPreferences` retention of `gridTemplates`.
- Test scenarios:
  1. `whitelistPreferences` preserves `gridTemplates` entries above 10 KB cleanly.
  2. `saveGridTemplate` -> `clearSkeletonGrid` -> `loadGridTemplate` restores the saved `skeletonGrid` slots and `days`, and `deleteGridTemplate` removes the template.
  3. `node scripts/test_dead_controls.js` and `node scripts/test_hig_dark_mode.js` pass with the new template buttons/pills.

## Verification Contract
- `npm run lint` passes (exit 0)
- `npm test` passes all 53 suites (exit 0)
- `npm run build` succeeds

## Definition of Done
- `skeletonGrid` persists across refreshes via `cacheSlice.js` before plan generation.
- Users can save, load, and delete Layout Grid templates synced in `preferences.gridTemplates` with zero native `<select>`, `onclick=`, or `alert`/`confirm`/`prompt`.
- `npm run lint`, `npm test`, and `npm run build` pass on `dev/persist-layout-grid-and-templates`.
