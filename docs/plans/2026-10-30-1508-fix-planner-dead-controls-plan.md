---
title: Planner Dead Controls - Plan
type: fix
date: 2026-10-30
topic: planner-dead-controls
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Planner Dead Controls - Plan

## Goal Capsule

- **Objective:** Every planner control Elliott and Chloe can see works the way it did before the 2026-10-01 modularisation. In particular, committing a plan and Start Fresh save, Step 2 "Swap ▾" changes the meal, and Step 2 day headings show their dates.
- **Means:** port the missing functions from the old runtime onto today's plan data, and save directly through `saveCurrentPlan` (KTD1, KTD2). Remove the dead calls in planner markup that is never shown (KTD4).
- **Product authority:** Elliott owns the app's behaviour. Barrie set the rule on 2026-10-30, and Elliott agreed: fix what is broken and used to work, and add new features later. Barrie chose the area and narrowed it to the visible planner after the planning audit. The other screens, slot reasons, plan history and library, and the unreachable swap modal are not active scope.
- **Authority order:** the Product Contract, then this plan's Key Technical Decisions, then `CLAUDE.md`, `plateplan-architecture.md` and `workflow-enforcer.md`.
- **Stop conditions:**
  - stop if a fix needs an edit to `src/main.js`, `src/services/ActionBridge.js` or `src/views/TodayView.js`, which Elliott's open PR #13 touches;
  - stop if anything reads the hidden legacy wrap's markup (as opposed to its inputs) before you remove it;
  - stop if a save would drop a field that `stripPlanPayload` keeps today.
- **Execution profile:** browser ES modules with no bundler. Standalone Node test scripts drive the real functions against a fake Firestore. The wizard is checked by hand on localhost and both phones.
- **Who ships:** Barrie merges the PR into `development`, tests on both phones, then releases to `main` as 3.52.0.
- **Open blockers:** None.

---

## Product Contract

### Summary

Product Contract preservation: changed R1, R2, R5, R8, AE1–AE4 and Scope Boundaries. Barrie narrowed the piece to the visible planner after the planning audit found that most dead planner markup is never shown (user-directed, 2026-10-30). R6–R8 are unchanged.

Fix the planner controls people can see:
- committing a plan from Step 3 and Step 4;
- Start Fresh;
- Step 2 "Swap ▾";
- Step 2 day headings.

The missing pieces are ported from the old runtime in git history onto today's plan data, and they save without losing ticks or swaps. Dead calls in planner markup that is never on screen are removed rather than restored. A test then fails whenever a visible planner control is wired to something that doesn't exist.

### Problem Frame

A whole-app scan on 2026-10-30 found about 90 dead-control hits in the planner. The planning audit then sorted them by what people actually see.

**What is visible is the wizard** (`#planner-wizard-host`). Four things are broken in it:
- **Commit does nothing.** "Save Shopping List & Plan" (Step 3) and "Commit Plan Now" (Step 4) call `commitPlannerWizardPlan`, which nothing defines.
- **Start Fresh doesn't stick.** It clears the plan on screen but saves nothing, so the next load brings the plan back.
- **Step 2 "Swap ▾" doesn't change the meal.** It edits the stale `state.plan` copy instead of the loaded plan. Usually it does nothing; after a step-3 product swap it throws.
- **Step 2 headings show "Day N" with no date**, because `formatPlanDayLabel` is missing.

**Most of the rest is never on screen.** The old day grid renders into `#plan-days-legacy-wrap`, which is `display:none`, and its slot rows can't render at all because `window.SLOTS` is undefined. That grid holds the draft and expired banners, the earlier-days toggle, "Clear reason", per-day nutrition and the plan score. Some render functions have no callers at all.

**The shared save is broken too.** `window.saveState` in `src/main.js` saves nothing when given a bare plan, and it throws when given nothing. Restored controls can't rely on it.

Every missing function was defined in the old runtime, `scripts/plateplan-app.js`, until the 2026-10-01 modularisation (`b4171d4`). That is the same break that took out Today in September.

### Key Decisions

- **Restore what used to work and is visible; remove the dead calls in hidden markup.** (session-settled: user-directed — chosen over restoring everything in the audit, which includes building a plan library screen, and over adding slot reasons now. Restoring markup that nobody can see would be a redesign, not a fix.) Governs R1, R2, R5.
- **The old runtime is the specification, not a redesign.** Each restored control does what it did at its last working version, ported onto today's data. Any difference is listed for Elliott (R6). Governs R1, R2, R6.
- **Stay clear of Elliott's open PR #13.** Restored controls keep their existing handlers and save directly rather than through `window.saveState`. Moving handlers to named bridge routes waits until PR #13 is sorted out. Governs R1, R8.

### Requirements

**Visible planner behaviour**
- R1. These controls work as they did before the break:
  - Step 3 "Save Shopping List & Plan" and Step 4 "Commit Plan Now" save the plan and move on as the old commit did;
  - Start Fresh clears the plan, and the clear survives a reload;
  - Step 2 "Swap ▾" changes that meal on the loaded plan and saves it.
- R2. Step 2 day headings show each day's date, as the old runtime's day labels did. The other helpers the visible planner skips quietly are available again: meal type from a slot key, slot construction and the escape helpers.
- R3. Restored behaviour works on today's plan data. It reads and writes the loaded plan (`currentPlan`) and its per-person slots, not the old shapes.
- R4. A restored control that saves the plan keeps every field the plan save keeps today. Eaten ticks, at-home ticks, swaps and product selections survive.

**Hidden and dead planner code**
- R5. Planner controls and helper calls that sit only in markup that is never shown, or in render functions with no callers, are removed rather than restored. This applies to everything not deferred in Scope Boundaries. No keep-or-remove list for Elliott is needed: the two controls with no working past (`togglePlanSetupCollapse` and the generator modal's button) are both in that code.

**Checks**
- R6. Any way a restored control differs from the old runtime is listed in the PR for Elliott.
- R7. The dead-controls guard covers the planner files, so a visible planner control wired to something that doesn't exist fails the test.
- R8. Nothing outside the planner changes. Today, the Pantry and Product Bank, the Vault and Settings behave as they do now. Step 3's shopping list is generated and shown as it is now; its save button changes only as R1 describes.

### Acceptance Examples

- AE1. **Covers R1, R4.** Given a generated plan with an at-home tick and a swap saved, when Elliott taps "Commit Plan Now", then the plan is saved, the app moves on as the old commit did, and the tick and the swap survive a reload.
- AE2. **Covers R1.** Given a saved plan, when Chloe taps Start Fresh and reloads, then the planner starts empty, and the old plan doesn't come back.
- AE3. **Covers R1, R3.** Given a plan on Step 2, when Elliott uses "Swap ▾" on Tuesday's dinner and picks another recipe, then Tuesday's dinner on the loaded plan shows the new recipe and keeps it after a reload. This holds even after a step-3 product swap.
- AE4. **Covers R2.** Given a plan whose day 1 is Monday 2 November, when Step 2 renders, then day 1's heading shows that date, not "Day 1" alone.

### Success Criteria

- On both phones, every planner button Elliott and Chloe can tap works, and none does nothing.
- The extended dead-controls guard passes. All other tests pass except the two known failures (`test_accessibility_dom.js`, `test_recipe_wizard.js`).

### Scope Boundaries

**Deferred to later planner pieces**
- **Slot reasons:** `getPlanSlotReason`, `setPlanSlotReason`, `clearPlanSlotReason`, `formatPlanSlotReason`. They need the plan save to keep `slotReasons`, and a visible row to show them.
- **Plan history and the plan library:** history actions, the apply-from-library modal, saved-plan recipe cards, `openSaveMealPlanModal`, and the `view-planlib` screen.
- **The swap modal** (`PlannerSwapModalUI`): no visible control reaches it today.

**Not built**
- **Restoring the hidden legacy day grid.** That would be a redesign; it covers the draft and expired banners, the earlier-days toggle, per-day nutrition and the plan score. Evidence that people miss it would change this.

**Follow-ups found during planning, not fixed here**
- `PlanRepository.savePlan` creates a stray `plans/{autoId}` document on every call when the plan has no `id`. One stray document is already in the 2026-10-29 backup. It needs a small fix, plus a backed-up clean-up step.
- `window.saveState` in `src/main.js` saves nothing given a bare plan, and throws given nothing. Fix it once Elliott's PR #13 is resolved.
- `PlanRepository.getPlanHistory` reads the wrong documents (it belongs to the history piece).

**Not active scope**
- The other screens: Settings, the recipe editor and importer, the Vault, Data Quality, Today and app start-up.
- Elliott's PR #13 itself.

### Dependencies / Assumptions

- The old runtime is recoverable at `b9e38ab:scripts/plateplan-app.js`, the parent of `b4171d4`. Line ranges are in the planning audit.
- `generatePlan` already saves the plan when it is generated (`MealPlanGeneratorService.js:250`), so commit saves an already-saved plan plus any Step 2 and Step 3 changes.

### Sources / Research

- **Planning audit (2026-10-30):** `scratchpad/planner-audit.md` (not in the repo). It has 57 missing names, each with its call site, visibility, old line range, dependencies, data shape and save behaviour. Its key facts are restated in the Problem Frame and the units.
- **Code:**
  - `src/views/PlannerView.js` (commit hook near line 113, `clearPlan` at line 241, the hidden `renderPlan`)
  - `src/views/PlannerRenderService.js` (Step 2 and Step 3)
  - `src/components/planner/PlannerMealSlot.js` (`renderDensePlanMealRow`, `selectAndSwapRecipe`)
  - `src/components/generator/GeneratorWizardModal.js:115`
  - `src/store/planSlice.js` (`setActivePlan`, `clearPlan`)
  - `src/services/RecipeFirestoreRepository.js` (`saveCurrentPlan`)
  - `src/models/MealPlannerModel.js` (`stripPlanPayload`)
  - `index.html:489` (`#plan-days-legacy-wrap`)
- **Old runtime:** `b9e38ab:scripts/plateplan-app.js`:
  - `commitPlannerWizardPlan`: 14730–14768
  - `formatPlanDayLabel`: 13348–13352
  - `getMealTypeFromSlotKey`: 3872–3879
  - `makePlanSlot`: 4889–4896
- **Learnings:**
  - `docs/solutions/ui-bugs/plan-is-in-currentplan-with-per-person-slots.md` (R3)
  - `docs/solutions/database-issues/plan-whole-document-save-erases-unlisted-fields.md` (R4)
  - `docs/solutions/workflow-issues/removing-a-feature-without-breaking-loads-guards-or-phones.md` (R5, R7)
- **Precedent:** `docs/plans/2026-10-29-2038-fix-pantry-products-dead-controls-plan.md`.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Save through `saveCurrentPlan`, not `window.saveState` or `setActivePlan`.** `saveCurrentPlan` writes `plans/current` with `stripPlanPayload`. That function keeps days, dates, slots, eaten ticks, at-home ticks, swaps and product selections, which is what R4 needs. `window.saveState` silently saves nothing for a bare plan, and it lives in `main.js`. `setActivePlan` creates a stray `plans/{autoId}` document when the plan has no `id`. Governs R1, R4.
- KTD2. **Port behaviour, don't copy code.** Every old function mutates `state.plan` and calls the old `saveState()`, whose cloud parts are stubs. Each restore is rewritten to read and write `getState().currentPlan` with the per-person slot keys, and to save per KTD1. Governs R1–R3.
- KTD3. **Commit keeps the old flow but not the old stamps.** The old commit set `score`, `appliedAt`, `savedStatus` and `confirmedShopping`. `stripPlanPayload` drops all of them and nothing reads them today. So commit saves the plan, sets the wizard step and opens Today, as the old one did, without the stamps. The PR lists this under R6. Governs R1, R6.
- KTD4. **Remove dead calls where they are, and move whole dead modules to the attic.** Functions with no callers, and branches that render only into the hidden wrap, are deleted inside live modules. A module the ledger shows as dead moves to `attic/` in the same commit, per the feature-removal learning. The hidden wrap's form inputs (`#plan-days`, `#plan-start-date`, `#plan-product-priority`) stay unless nothing reads them. Governs R5.
- KTD5. **The guard covers the planner files, excluding only the deferred features.** A new dead name anywhere else in the planner fails it. Each exclusion carries its reason in a comment, and the later piece that restores a feature deletes its exclusion.
  - **The swap modal is excluded by file path.** `PlannerSwapModalUI.js` and `PlannerSwapModalRenderService.js` go in an `OUT_OF_SCOPE` path pattern, as the use-up files were. Their dead helper names (`calculatePlanScore`, `makePlanSlot` and others) also appear in live files, so excluding those names would hide real dead calls.
  - **Slot reasons and history/library are excluded by name**, because they sit inside live files. The names are `getPlanSlotReason`, `setPlanSlotReason`, `clearPlanSlotReason`, `formatPlanSlotReason`, `renderPlanHistoryPanel`, `openSavedPlanRecipeCards`, `openPlanHistoryActions`, `openApplyPlanFromLibraryModal` and `openSaveMealPlanModal`, plus their `data-action` values.

  Governs R7.
- KTD7. **The guard reads `src/core/AppInitializer.js` as a routing source.** `initPlannerGridDelegation` there handles the planner's visible `data-action` values, including Step 2's `searchable-swap-slot`, `swap-slot`, `view-meal-detail`, `planned-meal-actions` and `set-plan-day-date`. Its `action === '...'` values join the routed set. Its own controls are not checked here, because start-up code is a later piece. Without it, those live routes would read as dead. Governs R5, R7.
- KTD6. **Put restored helpers in their owning module and import them.** Each goes where today's equivalent lives: day labels and date parsing next to `parsePlanLocalDate`; slot helpers next to the generator's slot shape; escape helpers from the existing shared ones. Planner files import them rather than reading `window`. Only a helper an inline handler needs goes on `window`, from its owning view module, not from `main.js`. Governs R2, R8.

### Sequencing

U1 then U2 then U3 then U4. U3's removals and U4's guard must land together, or the guard fails in between (U4 runs last and asserts the finished state).

---

## Implementation Units

### U1. Commit and Start Fresh save

- **Goal:** both commit buttons save the plan and move on, and Start Fresh's clear survives a reload.
- **Requirements:** R1, R3, R4, R6, AE1, AE2.
- **Dependencies:** none.
- **Files:**
  - `src/views/PlannerView.js` (define `commitPlannerWizardPlan` on `window`; make `clearPlan` save the cleared plan per KTD1)
  - `src/components/generator/GeneratorWizardModal.js` (only if its inline handler needs adjusting)
  - `scripts/test_planner_controls.js` (new)
- **Approach:**
  1. Read the old `commitPlannerWizardPlan` (old lines 14730–14768) and port its flow per KTD2 and KTD3. That means: guard that a plan is loaded, save it, set the wizard step as the old one did, then `showView('today')`.
  2. Port Start Fresh so the cleared plan is saved through `saveCurrentPlan`. Check what `planSlice.clearPlan` leaves in `currentPlan`, so the saved document is a valid empty plan and not a missing one.
  3. Write down any difference from the old runtime for the PR (R6).
- **Execution note:** write the reload-survival tests first and watch them fail on the current code.
- **Patterns to follow:**
  - the fake-Firestore set-up in `scripts/test_stock_data_removed.js` and `scripts/test_pantry_deletes.js`;
  - the Today ticks, which already save through `saveCurrentPlan`.
- **Test scenarios:**
  - Covers AE1. A loaded plan with an at-home tick and a swap: calling `commitPlannerWizardPlan()` writes `plans/current` once. The written document still has the tick, the swap, the slots and the day dates.
  - Covers AE1. After commit, the app asks for the Today view and the wizard step is set as the old commit set it.
  - With no plan loaded, commit makes no write and doesn't throw.
  - Covers AE2. After Start Fresh, `plans/current` holds a valid empty plan, and loading from that document gives an empty planner.
- **Verification:** on localhost, Step 4 "Commit Plan Now" opens Today and the plan is still there after a reload. Start Fresh, then reload, stays empty.

### U2. Step 2 swap and day labels

- **Goal:** "Swap ▾" changes the meal on the loaded plan, and Step 2 headings show dates.
- **Requirements:** R1, R2, R3, R4, AE3, AE4.
- **Dependencies:** U1 (shares the test file).
- **Files:**
  - `src/components/planner/PlannerMealSlot.js` (`selectAndSwapRecipe` reads and writes `currentPlan` and saves per KTD1; imports instead of `window` look-ups)
  - `src/views/PlannerRenderService.js` (day labels)
  - the owning modules for the restored helpers, per KTD6: `formatPlanDayLabel`, `getMealTypeFromSlotKey` and `makePlanSlot` (with `parsePlanRecipeValue` only as `makePlanSlot`'s internal dependency, not exposed for the deferred swap modal), plus the escape and date helpers the audit lists as already existing
  - `scripts/test_planner_controls.js`
- **Approach:**
  1. Port `formatPlanDayLabel` (old lines 13348–13352), `getMealTypeFromSlotKey` (3872–3879) and `makePlanSlot` (4889–4896) to today's slot shape.
  2. Re-point the visible planner's quiet `typeof window.X` checks at the imports.
  3. Delete the swap's calls to `calculatePlanScore` and `findMealPrepSuggestions`. The score is dropped by `stripPlanPayload` and isn't shown. Without the meal-prep recompute, a swapped recipe keeps the generator's prep groups, so Step 2's batch-prep badge and step-3 prep grouping won't reflect the swap. Both differences go in the R6 list.
  4. The Step 2 day card already prints "Day N". So its date label uses only the date part of the restored label: strip the `Day N · ` prefix, as the old `getPlanDateRangeLabel` did, and use an empty string when the day has no date.
- **Patterns to follow:** the generator's slot shape (`MealPlanGeneratorService.js`, around line 200); `parsePlanLocalDate` in `TodayViewService.js`.
- **Test scenarios:**
  - Covers AE3. A loaded plan with two people's dinners: `selectAndSwapRecipe` for Tuesday dinner sets that slot to the new recipe in `currentPlan`, and writes `plans/current` with it.
  - Covers AE3. With a stale `state.plan` present, as after a product swap, the swap still edits `currentPlan` and doesn't throw.
  - Covers AE4. `formatPlanDayLabel` for a plan with `dayDates[1] = '2026-11-02'` returns a label carrying that date, and the rendered Step 2 heading shows the date once and "Day 1" once. A day with no date renders "Day N" with no date text.
  - `getMealTypeFromSlotKey('dinnerE')` returns `dinner`, and `makePlanSlot` builds the shape the generator uses.
- **Verification:** on localhost, Step 2 headings show dates. "Swap ▾" on one meal changes it, and the change survives a reload.

### U3. Remove dead calls from hidden and uncalled planner code

- **Goal:** no planner code outside the deferred features names a function that doesn't exist.
- **Requirements:** R5, R8.
- **Dependencies:** U2.
- **Files:**
  - `src/views/PlannerView.js` (the hidden `renderPlan` path and its banners, the earlier-days toggle, per-slot rows and summary calls, per KTD4)
  - `src/components/planner/PlannerGridToolbar.js`, `PlannerWizardUI.js`, `PlannerGridUI.js`, `PlannerMealSlot.js` (render functions with no callers, such as `renderPlanSetupCard`, `renderBatchPrepPanel`, `renderSlotRow` and the toolbar banners)
  - any whole module the ledger then shows dead, moved to `attic/` with a row in `attic/README.md`
  - `LEDGER.md` (regenerated)
- **Approach:**
  1. Run the widened dead-controls scan restricted to the planner files, with `AppInitializer.js` as a routing source (KTD7). Without it the visible Step 2 "Swap ▾" reads as dead and would be deleted.
  2. For each hit outside the KTD5 exclusions, delete the dead call or function, or move the dead module to the attic.
  3. Before removing the hidden wrap's markup, check whether anything reads it (stop condition).
  4. Leave the deferred features' code in place.
- **Patterns to follow:** commit `d6e222a` (the Active Stock UI removal) and the feature-removal learning.
- **Test scenarios:**
  - The planner-scoped scan reports nothing outside the named exclusions.
  - `scripts/test_ledger.js` passes, and any moved module is listed in the attic.
  - The Step 1, 2 and 3 render functions still produce their markup (a smoke render in `scripts/test_planner_controls.js`).
- **Verification:** the wizard renders on localhost exactly as before, apart from the U1 and U2 fixes.

### U4. Extend the dead-controls guard to the planner

- **Goal:** a dead planner control fails the test from now on.
- **Requirements:** R7.
- **Dependencies:** U3.
- **Files:** `scripts/test_dead_controls.js`; `package.json` and `package-lock.json` (3.52.0).
- **Approach:**
  1. Add `src/views/PlannerView.js`, `src/views/PlannerRenderService.js` and `src/components/planner/` to the scope.
  2. Add `src/core/AppInitializer.js` as a routing source (KTD7).
  3. Add the KTD5 exclusions (the swap-modal files by path, the slot-reason and history/library names by name), each with its reason, and update the header comment.
- **Test scenarios:**
  - The guard passes on the finished tree.
  - A planted dead `window.X` call in a planner file fails it, and is then reverted.
  - A planted call to an excluded deferred name (for example `clearPlanSlotReason`) is not reported.
  - Step 2's `data-action="searchable-swap-slot"` is not reported, because it is routed in `AppInitializer.js`.
- **Verification:** `node scripts/test_dead_controls.js` passes, and `npm run build` stamps 3.52.0.

---

## Verification Contract

| Check | Command | Proves |
|---|---|---|
| Syntax | `find src -name '*.js' -print0 \| xargs -0 -n1 node --check` | modules parse |
| Planner controls | `node scripts/test_planner_controls.js` | R1–R4, AE1–AE4 |
| Guard | `node scripts/test_dead_controls.js` | R5, R7 |
| Ledger | `npm run ledger`, `node scripts/test_ledger.js` | R5 attic moves |
| Regressions | every other `scripts/test_*.js` and `test_vault_fit_score.js` | R8; only `test_accessibility_dom.js` and `test_recipe_wizard.js` may fail |
| Build | `npm run build` | 3.52.0 stamped |
| Manual | localhost, then both phones from `development` | commit, Start Fresh and swap survive a reload; Step 2 dates show; Today unchanged, and Step 3's shopping list unchanged apart from its save button |

## Definition of Done

- U1–U4 are committed on a new `dev/planner-dead-controls` branch, taken from `development`.
- Every Verification Contract check passes.
- The PR lists every difference from the old runtime (R6) and the follow-ups in Scope Boundaries.
- `ce-compound` runs on the branch before the PR into `development` merges.
- The PR is merged, the phone test passes, and `development` is released to `main` as 3.52.0.
- No `src/main.js`, `ActionBridge.js` or `TodayView.js` edits, no abandoned attempts, and no stray dead names outside the KTD5 exclusions.
