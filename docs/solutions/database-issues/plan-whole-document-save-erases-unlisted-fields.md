---
title: The whole-document plan save erases any plans/current field not on its list
date: 2026-10-27
category: database-issues
module: meal plan persistence (plans/current)
problem_type: database_issue
component: data_model
symptoms:
  - "A Step 3 product swap disappears after any meal-eaten or at-home tick, on reload or on the other phone"
  - "The swap still shows on the phone that made it, so the loss is easy to miss when testing on one device"
root_cause: data_integrity
resolution_type: code_fix
severity: high
related_components:
  - service_layer
tags: [firestore, plans-current, saveCurrentPlan, stripPlanPayload, setActivePlan, whole-document-write, product-swap]
---

# The whole-document plan save erases any plans/current field not on its list

## Problem

`households/elliott-chloe/plans/current` has two writers that behave differently. Any field saved by one and not known to the other is silently deleted by the next save through `saveCurrentPlan`. On 2026-10-27 the new Today and Step 3 tick saves erased saved Swap Product choices this way.

## Symptoms

- Swap a product on planner Step 3, then tick any item at home or any meal on Today. After a reload, or on the other phone, the original product is back.
- The swap stays on the phone that made it, so a single-device check passes.

## What Didn't Work

- First fix (commit `ec811ba` on `dev/review-state`): carrying `substitutions` and `productSelections` across the realtime plan update in memory. It assumed swaps were never saved, because a search of `src/components/ProductSwapModal.js` for "save" found nothing. The save happens through `setActivePlan`, which that search does not match. The swap survived on the swapping device only. The code review found this, and the helper was removed.

## Solution

`stripPlanPayload` (`src/models/MealPlannerModel.js`) is the list of fields `saveCurrentPlan` writes. It now keeps sanitised `substitutions` and `productSelections`, as it already did for `eatenMeals` and `shoppingAtHome` (commit `23023e4` on `dev/review-state`, pending merge to `main`). `scripts/test_today_view.js` checks that each of these fields survives `stripPlanPayload`.

## Why This Works

The two writers:

- `saveCurrentPlan` (`src/services/RecipeFirestoreRepository.js`) writes `stripPlanPayload(plan)` with `.set(payload)`, **without merge**. It replaces the whole document, so any field not in the list is deleted. Callers: Today ticks, Step 3 at-home ticks, the plan generator, the skeleton grid, `window.saveState`.
- `setActivePlan` (`src/store/planSlice.js`) calls `savePlan` (`src/repositories/PlanRepository.js`), which writes the full plan to `plans/current` with `{ merge: true }`. Swap Product (`ProductSwapModal.js`) saves this way.

A merge write adds fields; the next whole-document write removes every field the list does not name. Adding a field to `stripPlanPayload` makes both writers agree on it.

## Prevention

- When a feature stores something on the current plan, add it to `stripPlanPayload` with a sanitiser and a round-trip test, whichever writer it uses.
- Before adding a new caller of `saveCurrentPlan`, list the fields in `plans/current` (or the latest backup) and check each one is on the list.
- Never call `saveCurrentPlan` without a loaded plan: `stripPlanPayload({})` produces an empty plan, and the whole-document write would replace the real one. Both tick handlers guard for this.
- Test persistence with a reload, or on a second device. A same-device check cannot see this failure.

## Related Issues

- `docs/plans/2026-10-27-1549-fix-today-and-step3-shopping-plan.md` (U9 and the code-review fixes).
- Still open: a swap can start from a stale `state.plan` copy, because the realtime update refreshes only `currentPlan` (listed in that plan's Deferred to Follow-Up Work).
