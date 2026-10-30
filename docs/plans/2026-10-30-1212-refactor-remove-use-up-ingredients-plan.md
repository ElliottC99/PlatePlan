---
title: Remove Use Up Ingredients - Plan
type: refactor
date: 2026-10-30
topic: remove-use-up-ingredients
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Remove Use Up Ingredients - Plan

## Goal Capsule

- **Objective:** No part of the app offers "Use up ingredients", a feature that has never worked. With it gone, every Pantry and Product Bank control either works or is gone, and the dead-controls guard checks all Pantry code.
- **Product authority:** Elliott owns the app's behaviour. On 2026-10-30, through Barrie, he confirmed the removal and added a future, working "Use up ingredients" feature to his future-enhancement list. Building that feature is not active scope.
- **Means:** unwire the button and screens, delete the dead helpers, and move the two screen modules to `attic/` (KTD1, KTD2).
- **Authority order:** the Product Contract, then this plan's Key Technical Decisions, then `CLAUDE.md`, `plateplan-architecture.md` and `workflow-enforcer.md`.
- **Stop conditions:** stop and ask if any live code calls a function this plan removes, or if the generator wizard or Today renders differently.
- **Execution profile:** browser ES modules with no bundler. Standalone Node test scripts. Vault, generator and Today are checked by hand on localhost and both phones.
- **Who ships:** Barrie merges the PR into `development`, tests on the phones, then releases to `main`.
- **Open blockers:** None.

---

## Product Contract

### Summary

Remove the Vault's "Use up ingredients" button and all the code behind it. The use-up screens, the generator's use-up panel, Today's use-up helpers and the planner's read of a use-up option all go. Nothing else on screen changes. The dead-controls guard then covers all Pantry code with no exclusions.

### Problem Frame

The "Use up ingredients" button arrived in the 2026-10-26 zip import. It calls `openUseUpRecipeFinder()`, which nothing defines, so tapping it does nothing.

The code behind it was never connected:
- The finder and editor screens are templates that nothing renders, and about 20 of their handlers don't exist.
- The generator's "Pantry Use-Up" panel is never rendered.
- Today's use-up coverage helpers have no callers.
- The planner reads a use-up option that nothing sets.
- The household data's `useUpProducts` is `{}`.

The older PlatePlanner app never had the feature.

A button that does nothing looks like a bug. The leftover code also misleads whoever reads it next. The Active Stock plan (`docs/plans/2026-10-30-0748-refactor-remove-active-stock-plan.md`, R11) kept the feature on the belief that it worked. That belief was wrong, and this plan supersedes R11.

### Key Decisions

- **Remove the feature now and add it back later as new work.** (session-settled: user-directed — chosen over building it now, and over leaving the dead button in place. Elliott confirmed on 2026-10-30: fix what is broken first, then add features to a stable product.) Governs R1–R6.
- **Design nothing from the existing use-up code.** It is templates and helpers with no working behaviour, so a future version starts from its own brainstorm. The two screens moved to `attic/` are staging for deletion, not a starting point. Governs R3.
- **Supersede, don't edit, the shipped Active Stock plan.** That plan's R11 records what was believed when 3.50.0 shipped. This plan's Problem Frame records the correction.

### Requirements

**What users see**
- R1. The Vault has no "Use up ingredients" button. The rest of the Vault toolbar is unchanged.
- R2. Apart from R1, nothing on screen changes. The generator wizard, Today, the Pantry and the Product Bank look and behave as they do now.

**Code and checks**
- R3. Code whose only job was the use-up feature is removed or moved to `attic/`, following the ledger-and-attic practice. That covers the two use-up screens, the generator's use-up panel, the three Today use-up helpers and the planner's use-up option read. The ledger shows moved modules as dead before the move.
- R4. The dead-controls guard covers every Pantry component with no exclusions.
- R5. The Active Stock guard no longer singles out use-up names as allowed. It still enforces everything else it checks.
- R6. No reference to the removed functions, modules or button is left in `src/` or `index.html`, including `window` globals and `data-action` strings.

### Success Criteria

- Tapping around the Vault, generator wizard and Today on both phones shows no change, except that the button is gone.
- All tests pass except the two known pre-existing failures (`test_accessibility_dom.js`, `test_recipe_wizard.js`).
- `npm run ledger` shows no live module whose only job was use-up.

### Scope Boundaries

- A working "Use up ingredients" feature is deferred. It is on Elliott's future-enhancement list and needs its own brainstorm.
- Other Vault controls are not audited here, and neither are dead controls on screens other than Pantry and Product Bank. (The Vault search, sort and filters use `data-pp-*` attributes, but `RecipeVaultView.js` drives them through its own listeners.)
- The shipped Active Stock plan is not edited.

### Sources / Research

- Button: `index.html` (Vault toolbar, `data-action="openUseUpRecipeFinder()"`).
- Screens: `src/components/pantry/UseUpFinderModalUI.js`, `src/components/pantry/UseUpEditorUI.js`, registered in `src/components/componentRegistry.js`.
- Generator: `renderUseUpPanel` in `src/components/generator/GeneratorConstraintsForm.js`. `renderConstraintsForm` takes a `useUp` argument it never uses, which `src/views/PlannerView.js` builds from `currentPlanOptions.useUp`.
- Today: `getUseUpEntries`, `getUseUpAvailableAmount`, `getRecipeUseUpCoverage` in `src/services/TodayViewService.js`. The module itself is live through `src/main.js`.
- Guards: `scripts/test_dead_controls.js` (`OUT_OF_SCOPE`); `scripts/test_no_active_stock.js` (header comment and the use-up allowance fixture).
- Learning: `docs/solutions/workflow-issues/removing-a-feature-without-breaking-loads-guards-or-phones.md` (removal order, and moving unregistered files to the attic in the same commit).

---

## Planning Contract

Product Contract preservation: Product Contract unchanged.

### Key Technical Decisions

- KTD1. **Move the use-up screens to the attic in the same commit that unregisters them, together with removing the guard exclusion.** `scripts/test_dead_controls.js` scans every file in `src/components/pantry/`. If the files stay in that folder after their handlers stop being defined, the guard fails (see the feature-removal learning in Sources). Governs R3, R4.
- KTD2. **Delete the generator panel, the planner read and the Today helpers in place.** They are functions inside live modules (`GeneratorConstraintsForm.js`, `PlannerView.js`, `TodayViewService.js`), so there is no file to move to the attic. Git keeps the history. Governs R3.
- KTD3. **Check R1 and R6 with a one-off search, not a new permanent guard.** The dead-controls guard covers the Pantry and Product Bank, not the Vault, and widening it was not asked for. Governs R1, R6.
- KTD4. **Release as 3.51.0.** A visible control is removed, which counts as a meaningful release under `CLAUDE.md`.

### Sequencing

U1 then U2. Each unit leaves every test passing apart from the two known failures.

---

## Implementation Units

### U1. Remove the Vault button and the use-up screens

- **Goal:** the button is gone, nothing loads the two use-up screens, and the dead-controls guard covers every Pantry file.
- **Requirements:** R1, R3, R4, R6.
- **Dependencies:** none.
- **Files:**
  - `index.html` (remove the `data-action="openUseUpRecipeFinder()"` button from the Vault toolbar)
  - `src/components/componentRegistry.js` (drop the `UseUpEditorUI` and `UseUpFinderModalUI` imports and registry entries)
  - `src/components/pantry/UseUpFinderModalUI.js` and `src/components/pantry/UseUpEditorUI.js`, moved to `attic/src/components/pantry/`
  - `attic/README.md` (two rows: moved 2026-10-30, delete after 2026-11-13)
  - `scripts/test_dead_controls.js` (remove the `OUT_OF_SCOPE` exclusion and its filter, and update the header comment)
  - `LEDGER.md` (regenerated)
- **Approach:**
  1. Remove the button and the registry entries.
  2. Run `npm run ledger` and confirm both files are listed as dead.
  3. Move them, add the attic rows, and remove the guard exclusion in the same commit (KTD1).
  4. Regenerate the ledger.
- **Patterns to follow:** commit `d6e222a` (the Active Stock UI removal).
- **Test scenarios:**
  - `scripts/test_dead_controls.js` passes with no exclusion.
  - The guard still fails when a dead `window.X` call is planted in a Pantry file and then reverted (mutation check).
  - `scripts/test_ledger.js` passes, and the ledger lists the two files in the attic.
- **Verification:** the Vault toolbar renders on localhost without the button. The favourites filter, search, sort and type and who filters behave as before.

### U2. Remove the generator panel, the planner read and the Today helpers

- **Goal:** no use-up code is left in the live modules or the Active Stock guard.
- **Requirements:** R2, R3, R5, R6.
- **Dependencies:** U1.
- **Files:**
  - `src/components/generator/GeneratorConstraintsForm.js` (delete `renderUseUpPanel` and the use-up line in the header comment)
  - `src/views/PlannerView.js` (delete the `rawUseUp` and `useUp` lines and the `useUp` argument; `renderConstraintsForm` never reads it)
  - `src/services/TodayViewService.js` (delete `getUseUpEntries`, `getUseUpAvailableAmount` and `getRecipeUseUpCoverage`, and the "use-up counters" header wording)
  - `scripts/test_no_active_stock.js` (drop the use-up allowance from the header comment, and the fixture check that use-up names are not reported)
  - `package.json` and `package-lock.json` (3.51.0, KTD4)
- **Approach:** after the edits, search `src/` and `index.html` for `useUp`, `UseUp`, `use-up`, `Use up` and `openUseUpRecipeFinder`, and expect no matches (KTD3, R6).
- **Patterns to follow:** commit `2ef6403` (removing the stock readers).
- **Test scenarios:**
  - `scripts/test_today_view.js` still passes. Today's other calculations are unchanged.
  - `scripts/test_no_active_stock.js` passes with every remaining rule and fixture.
  - The generator wizard's step 1 renders the same constraints form as before. There is no automated test for it, so check it by hand on localhost.
- **Verification:** the search above finds nothing, and every changed `src/` file passes `node --check`.

---

## Verification Contract

| Check | Command | Proves |
|---|---|---|
| Syntax | `find src -name '*.js' -print0 \| xargs -0 -n1 node --check` (as CI runs it) | modules parse |
| Pantry guard | `node scripts/test_dead_controls.js` | R4 |
| Active Stock guard | `node scripts/test_no_active_stock.js` | R5 |
| Leftovers | the KTD3 search over `src/` and `index.html` | R1, R6 |
| Regressions | every other `scripts/test_*.js` and `test_vault_fit_score.js` | R2; only `test_accessibility_dom.js` and `test_recipe_wizard.js` may fail |
| Ledger | `npm run ledger`, `node scripts/test_ledger.js` | R3 |
| Build | `npm run build` | 3.51.0 stamped |
| Manual | localhost, then both phones from `development` | R1, R2: Vault without the button; generator step 1 and Today unchanged |

## Definition of Done

- U1 and U2 are committed on `dev/remove-use-up`, taken from `development`.
- Every Verification Contract check passes.
- `ce-compound` runs on the branch before the PR into `development` merges, or it is recorded that no learning qualified.
- PR into `development` is merged, the phone test passes, and `development` is released to `main` as 3.51.0.
- No stray use-up references or abandoned attempts are left in the diff.
