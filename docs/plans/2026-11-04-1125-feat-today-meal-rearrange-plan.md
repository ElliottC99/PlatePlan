---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
---

# Plan: Today View Meal Rearrangement & Day Swapping

**Date:** 2026-11-04  
**Author:** Antigravity  
**Target Branch:** `dev/meal-plan-library-history-and-rotation`  
**Output Contract:** Implementation-Ready Unified Plan  

---

## 1. Goal Capsule

Introduce an intuitive, meal-level "Rearrange" / "Swap Day" action on the Today tab (`#view-today`) allowing households to swap a planned meal (e.g. Monday's Dinner) with another day's meal in the active plan (e.g. Tuesday or Friday), cleanly updating slot assignments, persisting changes to Firestore (`plans/current`), resetting eaten statuses on the moved meals, and enabling flexible multi-day rotation without needing to enter the full planner wizard.

---

## 2. Product Contract

### Requirements
- **R1: Meal Slot Swapping Logic**:
  - Pure domain function `swapPlanMealSlots(plan, sourceDayKey, targetDayKey, mealType)` that cleanly exchanges slot payloads (including split `dinnerE`/`dinnerC` or legacy single-slot definitions).
  - Preserves custom serving multipliers, variant selections (`enhanced` vs `original`), and substitution overrides associated with the slot.
- **R2: Eaten State Reset**:
  - Updates `plan.eatenMeals` removing any ticked status for `sourceDate:mealType` and `targetDate:mealType` for both `e` and `c`.
- **R3: Today View UI Controls**:
  - Add "⇄ Swap" button to each Today meal card (`renderTodayMealCard`).
  - Render an accessible, clean modal dialog (`TodaySwapMealModalUI.js`) matching PlatePlan styling.
- **R4: Real-time Persistence & State Synchronization**:
  - Dispatches `plateplan:state:plan` via `setCurrentPlan` so Planner and Today views sync instantly.
  - Persists directly to `households/{HOUSEHOLD_ID}/plans/current` via `saveCurrentPlan()`.
- **R5: Automated Verification**:
  - Standalone Node test suite (`scripts/test_today_meal_rearrange.js`) verifying pairwise swapping, split-person slot preservation, eaten state resets, and multi-step rotation.

### Key Technical Decisions (KTDs)
- **KTD-1: Meal-Level Swapping** (`session-settled: user-directed`): Swapping operates at the meal level (e.g. Dinner with Dinner, Lunch with Lunch) so users can swap a specific meal without disrupting other meals on that day.
- **KTD-2: Eaten Status Reset** (`session-settled: user-directed`): Reset eaten status for moved meals to ensure pending consumption on the destination date.
- **KTD-3: ActionBridge Delegation** (`session-settled: user-approved`): Wire via `data-action="open-today-rearrange-modal"` and `data-action="execute-today-slot-swap"` per `AGENTS.md` standard.

---

## 3. Implementation Units

### U1: Domain Swap Service (`src/services/PlanSlotSwapService.js`)
- Implement `swapPlanMealSlots(plan, sourceDayKey, targetDayKey, mealType)`:
  - Validates `plan`, `plan.slots`, `sourceDayKey`, and `targetDayKey`.
  - Exchanges slot keys for the given `mealType`:
    - Handles standard meal keys (`breakfast`, `lunch`, `dinner`, `snack`).
    - Handles per-person keys (`${mealType}E`, `${mealType}C`).
    - Handles split object nodes (`slot.isSplit` with `.elliott` and `.chloe`).
  - Clears `plan.eatenMeals` entries for `sourceDate` and `targetDate` for `mealType` (both `both`, `e`, `c`).
  - Returns a deep-cloned sanitized plan copy.

### U2: Today Swap Modal Component (`src/components/today/TodaySwapMealModalUI.js`)
- Implement `renderTodaySwapModal({ plan, sourceDayKey, sourceDateStr, mealType, recipes })`:
  - Displays source meal card preview (title, image/icon, tags).
  - Lists all other days in `plan.dayDates` with their day labels (e.g. `Tue 5 Nov`) and what is currently planned for `mealType` on that day.
  - Each candidate destination day features a `data-action="execute-today-slot-swap"` button.
  - Displays close button with `data-action="close-today-swap-modal"`.

### U3: Today View & ActionBridge Wiring (`src/views/TodayView.js` & `src/services/ActionBridge.js`)
- In `TodayView.js`:
  - Pass `dayKey` to `renderTodayMealCard()` and add a "⇄ Swap" button triggering `data-action="open-today-rearrange-modal"` with `data-day-key="${dayKey}"` and `data-meal-type="${slot.type}"`.
  - Implement `openTodayRearrangeModal(dayKey, mealType)`: opens the modal.
  - Implement `executeTodaySlotSwap(sourceDayKey, targetDayKey, mealType)`:
    - Calls `swapPlanMealSlots()`.
    - Persists via `saveCurrentPlan(updatedPlan)`.
    - Updates reactive store via `setCurrentPlan(updatedPlan)`.
    - Shows toast notification.
    - Closes or refreshes modal and re-renders Today view.
- In `ActionBridge.js`:
  - Add routes for `open-today-rearrange-modal`, `execute-today-slot-swap`, `close-today-swap-modal`.

### U4: Unit & Integration Verification Suite (`scripts/test_today_meal_rearrange.js`)
- Test 1: Single meal slot pairwise swap exchanges recipes accurately.
- Test 2: Split person slots (`dinnerE`/`dinnerC`) swap cleanly without corruption.
- Test 3: Eaten status entries for both dates are completely purged.
- Test 4: Sequential 3-way rotation (Mon -> Tue -> Fri -> Mon) maintains plan validity and integrity.
- Test 5: Modal HTML output renders valid data-action attributes.

---

## 4. Verification & Acceptance Criteria
- [ ] Tapping "⇄ Swap" on a Today meal card opens the destination day picker modal.
- [ ] Selecting a target day exchanges the two meals cleanly across `plans/current` and memory state.
- [ ] Marked-eaten status is reset on both swapped slots.
- [ ] Today and Planner views immediately reflect the new schedule.
- [ ] All tests in `scripts/test_today_meal_rearrange.js` pass with 0 errors.
