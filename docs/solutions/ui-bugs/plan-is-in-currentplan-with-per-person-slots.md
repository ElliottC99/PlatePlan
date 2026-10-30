---
title: The loaded plan is state.currentPlan, and its slots are per person
date: 2026-10-27
last_updated: 2026-10-30
category: ui-bugs
module: meal plan state (currentPlan, plan slots)
problem_type: ui_bug
component: frontend
symptoms:
  - "Today always says \"No meals assigned to this day\" although the planner shows a full week"
  - "Today's date arrows move but every day stays empty"
  - "The Step 3 at-home tick does not stay ticked"
root_cause: logic_error
resolution_type: code_fix
severity: high
related_components:
  - data_model
tags: [currentPlan, state-plan, plan-slots, per-person-slots, mealE, mealC, today-view, shared-meal]
---

# The loaded plan is state.currentPlan, and its slots are per person

## Problem

The app's state has two plan fields, and a plan's meals are stored per person. Code that reads `state.plan`, or looks up a plain `dinner` slot, finds nothing and shows an empty screen without any error. Today has been blank this way since `b4171d4` (2026-10-01). The Step 3 at-home tick failed for the same reason.

## Symptoms

- Today shows "No meals assigned to this day in your active plan." on every day, while the planner shows the week.
- The Step 3 at-home tick doesn't stay ticked. Its save went to the wrong plan object.
- No console error. The read just returns `undefined`.

## Root cause

Two wrong assumptions:

- **Which state field holds the plan.** `HydrationService.js` puts the `plans/current` document into `getState().currentPlan`, on the first load and on every realtime update. `state.plan` is not refreshed from Firestore. It's an older field that some planner code still writes to.
- **What the slot keys are.** The planner and generator store each meal twice, once per person: `breakfastE`/`breakfastC`, `lunchE`/`lunchC`, `dinnerE`/`dinnerC`. See `MealPlanGeneratorService.js` and `PlannerRenderService.js`. A plain `dinner` key appears only in old plans.

## Solution

Fixed on `dev/review-state` (commits `a9d0498` and `70851ad`, pending merge to `main`):

- Today and the Step 3 at-home tick read and save `getState().currentPlan`, and refuse to save if it isn't loaded.
- `getTodayMealCards` (`src/views/TodayView.js`) reads `${mealType}E` and `${mealType}C`, and falls back to a plain `${mealType}` key for old plans.
- A meal counts as **shared** only when both slots hold the same recipe id **and** the same variant. This is the planner's rule (`PlannerRenderService.js`: `infoE.id === infoC.id && infoE.variant === infoC.variant`). A shared meal gets one card; anything else gets one card per person.

```js
const infoE = resolve(dayPlan[`${mealType}E`]);
const infoC = resolve(dayPlan[`${mealType}C`]);
if (infoE && infoC && infoE.id === infoC.id && infoE.variant === infoC.variant) {
  return [{ info: infoE, person: 'both' }];
}
```

`scripts/test_today_view.js` section 5 checks the shared-or-split cards.

## Prevention

- Read the live plan from `getState().currentPlan`. Treat `state.plan` as stale unless you've checked that the code path keeps it in sync.
- Some code still uses `state.plan`, so check before reusing it:
  - `clearCheckedShoppingItems` in `src/components/shopping/ShoppingBatchToolbar.js` clears `state.plan.shoppingAtHome`, while the at-home ticks now live on `currentPlan`. Nothing calls it by name; `componentRegistry.js` puts it on `window`.
  - `ProductSwapModal.js` picks `state.plan` before `currentPlan` when `plan` is set.
- Planner code lost in the 2026-10-01 modularisation can be recovered from the old runtime at `git show b9e38ab:scripts/plateplan-app.js`, but every function there reads and writes `state.plan` and calls an old `saveState()` whose cloud parts were stubs. So port the behaviour onto `currentPlan` and save through `saveCurrentPlan`; don't copy the code. `window.saveState` in `src/main.js` is no substitute: it saves nothing when given a bare plan. The 3.52.0 planner fix (`docs/plans/2026-10-30-1508-fix-planner-dead-controls-plan.md`) did this for commit, Start Fresh and the Step 2 swap.
- Look up a meal with the `E`/`C` suffix, and decide shared-or-split with the planner's id-and-variant rule rather than inventing another.
- Test against the real `plans/current` document or a backup of it, not a hand-made plan with plain `dinner` keys.

## Related Issues

- `docs/solutions/database-issues/plan-whole-document-save-erases-unlisted-fields.md`: the save these fixes call.
- `docs/plans/2026-10-27-1549-fix-today-and-step3-shopping-plan.md`, Deferred to Follow-Up Work: the swap path's stale `state.plan`. Fixed in 3.52.0: `selectAndSwapRecipe` now edits `currentPlan`.
