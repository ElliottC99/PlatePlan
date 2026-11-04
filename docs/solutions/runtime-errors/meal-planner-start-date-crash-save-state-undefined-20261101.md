---
date: "2026-11-01"
problem_type: "runtime_error"
component: "state_management"
severity: "high"
symptoms:
  - "Uncaught TypeError: Cannot read properties of undefined (reading 'currentPlan') at src/main.js:92"
  - "Changing meal planner start date or duration crashes with a white-screen exception"
root_cause: "null_check_missing"
tags:
  - meal-planner
  - saveState
  - optional-chaining
  - state-management
  - IndexedDB
related_issues: []
---

# Solution: Meal Planner Start Date Crash on `window.saveState()`

## 1. Problem Statement
When a user changed the Start Date or Plan Duration in Step 1 of the Meal Planner Wizard, the application threw an unhandled exception:
```text
CRASH TRACE
Uncaught TypeError: Cannot read properties of undefined (reading 'currentPlan')
File: http://localhost:3000/src/main.js:92
```
This crashed the UI and prevented the meal planner skeleton grid from updating dates or generating plans.

## 2. Root Cause Analysis
In `src/main.js`, `window.saveState` had a syntax typo on its fallback chain:
```javascript
// ❌ WRONG
window.saveState = function(stateData) {
  const rawPlan = stateData?.plan || stateData?.currentPlan || stateData .currentPlan ?.currentPlan;
  if (!rawPlan) return;
  ...
```
`stateData .currentPlan` was missing the optional chaining operator `?`. In Step 1, inputs (`GeneratorConstraintsForm.js`, `PlannerSkeletonGridUI.js`) invoke `window.saveState()` with zero arguments (`stateData` is `undefined`). Evaluating `stateData.currentPlan` immediately threw `TypeError`.

Furthermore:
- In `GeneratorConstraintsForm.js`, cadence selects used inline `onchange="state.prefs.mealRepeatCadence..."` referencing an unbound `state` global.
- In `MealPlanGeneratorService.js`, `options.cadence ?.prefs?.mealRepeatCadence` silently discarded passed cadence options.

## 3. Working Solution
1. **Universal Fallback & Safe Plan Extraction (`src/main.js`)**:
```javascript
// ✅ CORRECT
window.saveState = function(stateData) {
  try {
    const state = typeof getState === 'function' ? getState() : (window.AppState ? window.AppState.getState() : null);
    const data = stateData || state;

    // Extract plan safely whether passed as plan, stateData.plan, stateData.currentPlan, or state.currentPlan
    const rawPlan = (data?.slots ? data : null)
      || data?.plan
      || data?.currentPlan
      || state?.currentPlan
      || state?.plan;

    // 1. Always update local state cache to persist in-memory adjustments
    if (typeof saveStateCache === 'function') {
      saveStateCache(data);
    }

    // 2. If a valid plan exists, dispatch into official store and cloud repository
    if (rawPlan && rawPlan.slots && typeof rawPlan.slots === 'object') {
      if (typeof setActivePlan === 'function') {
        setActivePlan(rawPlan);
      } else if (window.store && typeof window.store.setActivePlan === 'function') {
        window.store.setActivePlan(rawPlan);
      }

      if (window.HouseholdRepository && typeof window.HouseholdRepository.saveCurrentPlan === 'function') {
        window.HouseholdRepository.saveCurrentPlan(rawPlan).catch(err => {
          console.error('[Persistence] Error delegating plan to HouseholdRepository:', err);
        });
      }
    }
  } catch (err) {
    console.warn('[Persistence] Handled warning in window.saveState:', err);
  }
};
```

2. **Clean Event Delegation (`GeneratorConstraintsForm.js`)**:
All cadence and constraint changes are bound via `.pp-constraint-input` and `data-key` in `bindConstraintEvents()`.

3. **Generator Option Fallbacks (`MealPlanGeneratorService.js`)**:
```javascript
const cadence = options.cadence || state.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
const skeletonGrid = options.skeletonGrid || state.skeletonGrid || {};
```

## 4. Prevention & Verification
- Unit test suite added in `scripts/test_planner_wizard_pipeline.js` covering zero-arg invocations, null inputs, and custom cadence resolution.
- Enforce Pattern #16 (Centralized Fallbacks) and avoid inline `onchange="..."` code strings in HTML templates.
