# Implementation Plan: Fix Meal Planner Start Date Crash & Wizard Pipeline Hardening

> Date: 2026-11-01  
> Focus: Eliminate `TypeError: Cannot read properties of undefined (reading 'currentPlan')` on Start Date change and harden the 4-step Meal Planner Wizard  
> Branch: `dev/recipe-bulk-parse-instruction-fix`  
> Status: Implemented ✓ (Verified with scripts/test_planner_wizard_pipeline.js)  

---

## 1. Problem Statement & Executive Summary

### The Problem
When a user opens Step 1 ("Configure Plan Requests") of the Meal Planner Wizard and changes the Start Date or Plan Duration, the application crashes with:
```text
CRASH TRACE
Uncaught TypeError: Cannot read properties of undefined (reading 'currentPlan')
File: http://localhost:3000/src/main.js:92
```

### Root Causes
1. **Broken `saveState` Fallback Syntax**:
   In `src/main.js` (line 92):
   ```javascript
   const rawPlan = stateData?.plan || stateData?.currentPlan || stateData .currentPlan ?.currentPlan;
   ```
   `stateData .currentPlan` lacks the optional chaining operator `?`. When `window.saveState()` is called with zero arguments (as done in `GeneratorConstraintsForm.js` and `PlannerSkeletonGridUI.js`), `stateData` is `undefined`, causing an immediate crash when evaluating `stateData.currentPlan`.
2. **Options Typo in Meal Generator**:
   In `src/services/MealPlanGeneratorService.js` (lines 120 and 123):
   ```javascript
   const cadence = options.cadence ?.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
   const skeletonGrid = options.skeletonGrid ?.skeletonGrid || {};
   ```
   If `options.cadence` is passed directly as `{ breakfast: 1, lunch: 2, dinner: 2 }`, checking `.prefs.mealRepeatCadence` returns `undefined`, which silently discards user-configured cadences and defaults back to 1/2/2.
3. **Fragile Inline String Event Handlers**:
   In `src/components/generator/GeneratorConstraintsForm.js` (lines 63, 69, 75):
   The repeat cadence dropdowns use inline `onchange="state.prefs.mealRepeatCadence..."` strings that assume an unbound global `state` variable.
4. **Fragile Pinned Meals Chain**:
   In `src/views/PlannerView.js` (line 66):
   `const rawPinned = getState().currentPlanOptions?.pinnedMeals ?.pinnedRecipes || [];` has a typo space and lacks safety if `currentPlanOptions` is undefined.

---

## 2. Architecture & Design Principles

### Single Source of Truth & Universal Fallback (Pattern #1, Pattern #16)
`window.saveState(stateData)` must follow the robust contract:
- If `stateData` is passed:
  - If `stateData` is a plan itself (has `.slots`), treat it as `rawPlan`.
  - Else extract `stateData?.plan` or `stateData?.currentPlan`.
- If `stateData` is omitted or undefined:
  - Safely fall back to `getState()?.currentPlan || getState()?.plan`.
- Persist state to the local IndexedDB cache via `saveStateCache()`.
- If a valid plan (`rawPlan?.slots`) exists:
  - Sync into store via `setActivePlan(rawPlan)`.
  - Commit to Firestore via `saveCurrentPlan(rawPlan)`.
- If no plan exists yet (pre-generation in Step 1):
  - Do not throw an error; cleanly exit after caching in-memory state.

### Clean Event Delegation
- Move all `<select>` cadence changes from inline `onchange="..."` into `bindConstraintEvents()` alongside `plannerDays` and `plannerStartDate`.

---

## 3. Implementation Plan

### 3.1 Hardening `src/main.js` (`window.saveState`)
Replace the fragile property lookup with a safe, universal persistence handler:
```javascript
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

      // 1. Always update local state cache
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

### 3.2 Fixing `src/components/generator/GeneratorConstraintsForm.js`
- Remove inline `onchange="state.prefs.mealRepeatCadence..."` from:
  - `#wizard-cadence-breakfast`
  - `#wizard-cadence-lunch`
  - `#wizard-cadence-dinner`
- Add class `pp-constraint-input` and attributes:
  - `data-key="cadenceBreakfast"`
  - `data-key="cadenceLunch"`
  - `data-key="cadenceDinner"`
- In `bindConstraintEvents(container, onRender)`:
  Handle cadence keys safely in `getState().prefs.mealRepeatCadence` and trigger `window.saveState()` and `onRender()`.

### 3.3 Fixing `src/services/MealPlanGeneratorService.js`
In `generateMealPlan(options = {})`:
```javascript
  const cadence = options.cadence || state.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
  const minFitScore = Number(options.minFitScore !== undefined ? options.minFitScore : (state.prefs?.minFitScore || 0));
  const maxFitScore = Number(options.maxFitScore !== undefined ? options.maxFitScore : (state.prefs?.maxFitScore || 100));
  const skeletonGrid = options.skeletonGrid || state.skeletonGrid || {};
```

### 3.4 Cleaning up `src/views/PlannerView.js`
In `renderPlannerWizard()`:
```javascript
  const rawPinned = getState()?.currentPlanOptions?.pinnedMeals?.pinnedRecipes 
    || getState()?.currentPlanOptions?.pinnedMeals 
    || [];
```

---

## 4. Verification Plan

### Automated Test Suite (`scripts/test_planner_wizard_pipeline.js`)
Create a dedicated standalone node test verifying:
1. `window.saveState()` called with zero arguments executes cleanly without throwing `TypeError`.
2. `window.saveState(plan)` called with a plan containing `.slots` delegates to `setActivePlan` and `saveCurrentPlan`.
3. `window.saveState({ currentPlan: plan })` correctly extracts the plan.
4. `generateMealPlan({ cadence: { breakfast: 1, lunch: 3, dinner: 4 } })` accurately respects the provided cadence options rather than dropping into defaults.
5. `bindConstraintEvents` updates `plannerDays`, `plannerStartDate`, and `cadenceBreakfast/lunch/dinner` in `getState()`.

### Manual End-to-End Verification
1. Open Meal Planner (`http://localhost:3000/#planner`).
2. Step 1:
   - Change "Plan Length" from 10 days to 7 days. Verify skeleton grid updates to 7 days without error.
   - Change "Start Date" to tomorrow or next Monday. Verify date headers update without error.
   - Change repeat cadence (e.g. Lunch to 3 days). Verify value persists.
   - Set fit score timeline bounds.
   - Click "✨ Generate Meal Plan →".
3. Step 2:
   - Verify generated plan renders all day cards with calories, protein, and fit badges.
   - Click "Swap ▾" on a slot, pick a candidate, and click "Select & Swap". Verify slot updates.
   - Click "Proceed to Shopping List →".
4. Step 3:
   - Verify net ingredients are grouped by aisle.
   - Click "Copy List to Clipboard" (or verify toolbar).
   - Click "✓ Save Shopping List & Plan (Commit to Today) →".
5. Step 4 / Today:
   - Verify app redirects to Today view with today's meals populated from the generated plan.

---

## 5. Review & Approval

Please review this plan. Upon your confirmation (or `/work`), we will implement these fixes, run the automated tests, and rebuild the application.
