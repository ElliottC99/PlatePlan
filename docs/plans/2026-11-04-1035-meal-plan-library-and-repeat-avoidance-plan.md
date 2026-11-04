---
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
---

# Plan: Meal Plan Library Auto-Archiving, Interactive History Management, and 30-Day Recipe Repeat Avoidance

**Date:** 2026-11-04  
**Author:** Antigravity  
**Target Branch:** `dev/recipe-bulk-parse-instruction-fix` (or dedicated feature branch)  
**Output Contract:** Durable Software Implementation Plan  

---

## 1. Goal Capsule

Enable automatic persistence of active meal plans into the Meal Plan Library (`#view-planlib`), provide full interactive management for saved plans (Restore as Active, View Recipe Cards, Delete), and teach the Meal Plan Generator to enforce a 30-day recipe rotation window so that household meals do not frequently repeat.

---

## 2. Requirements & Scope Boundaries

### In Scope:
1. **Auto-Archiving on Commit**:
   - Whenever `commitPlannerWizardPlan()` executes (or a plan is committed/saved from Step 3 / Step 4 of the Planner Wizard), the plan payload is automatically archived into the `plans` subcollection: `households/{HOUSEHOLD_ID}/plans/{planId}` with a stable date-indexed ID (e.g. `plan_YYYYMMDD_timestamp`) and human-readable title (e.g. `Plan: 4 Nov – 13 Nov`).
   - If an active plan currently exists in `plans/current` but has no history record in the library, the Library view will immediately render the current active plan with an "Active Plan" badge at the top so the view is never empty.

2. **Meal Plan Library Interactive Controls**:
   - Modernize `renderHistoryPanel()` in `src/components/planner/PlannerGridUI.js`:
     - **Active Plan Section**: Prominently displays the currently active plan at the top with an emerald `Active Plan` badge.
     - **Saved Plans History List**: Shows past saved plans with date range, total days, macro/fit-score preview, and recipe previews.
     - **Restore as Active Plan**: Clicking "Load Plan" confirms and saves that historical plan to `plans/current`, updates store state, and displays Today.
     - **View Recipe Cards**: Clicking "Recipe Cards" displays an interactive modal showing the recipe cards for that historical plan.
     - **Delete Saved Plan**: Clicking "Delete" prompts confirmation via `DialogHelpers.js` and calls `PlanRepository.deletePlan(planId)`.

3. **30-Day Recipe Repeat Avoidance in Meal Plan Generator**:
   - In `MealPlanGeneratorService.js`:
     - Inspect past planned recipes across the active plan and past saved plans whose execution dates fall within the last 30 days (`recentRecipeIds`).
     - Prioritize freshness: strictly avoid recipes in `recentRecipeIds` during candidate pool filtering (`getFilteredRecipes`).
     - Graceful Fallback: If the pool of unused recipes is insufficient to satisfy the planned days and cadence, fall back to the least-recently used recipes, guaranteeing the generator always fulfills all slots without errors.

### Out of Scope (Deferred):
- Today Tab meal rearrangement (day-switching e.g. swap Monday with Friday) — scheduled as the next standalone feature.
- Multi-household plan sharing or external export/import.

---

## 3. Technical Architecture & Data Model

### A. Persistence Layer (`households/{HOUSEHOLD_ID}/plans/`)
- `plans/current`: The active working meal plan document read by Today and the Planner.
- `plans/{planId}`: Archived snapshots.
  ```javascript
  {
    id: "plan_20261104_1730712000000",
    name: "Plan: 4 Nov – 13 Nov",
    startDate: "2026-11-04",
    endDate: "2026-11-13",
    days: 10,
    dayDates: { "1": "2026-11-04", "2": "2026-11-05", ... },
    slots: { ... },
    score: { score: 86, macroMatchPct: 92 },
    createdAt: "2026-11-04T10:35:00.000Z",
    updatedAt: "2026-11-04T10:35:00.000Z",
    archivedOnCommit: true
  }
  ```

### B. Recent Usage Extraction (`extractRecentPlannedRecipeIds`)
A helper function that scans:
1. `state.currentPlan`
2. Historical plans loaded from `PlanRepository.getPlanHistory()`
Extracts unique recipe IDs used on dates within `[today - 30 days, today]`.

### C. Generator Rotation Strategy (`MealPlanGeneratorService.js`)
```javascript
const recentRecipeMap = getRecentRecipeUsageMap(historyPlans, currentPlan, 30);
// Filter candidates:
const freshCandidates = pool.filter(r => !recentRecipeMap.has(r.id));
// If freshCandidates.length >= requiredSlots: use freshCandidates.
// Otherwise: sort pool by least-recently-used and top-up to satisfy required slots.
```

---

## 4. Implementation Steps

### Phase 1: Storage & Auto-Archive Pipeline
- **File**: `src/views/PlannerView.js` & `src/repositories/PlanRepository.js`
- **Task**:
  - In `commitPlannerWizardPlan()`: upon saving `plans/current`, automatically generate an archive document using `PlanRepository.savePlanHistory(archiveId, archivePlanPayload)`.
  - Ensure `archiveId` uses ISO date strings for chronological ordering.
  - Export a shared helper `autoArchiveActivePlan(plan)` for use when committing plans.

### Phase 2: Meal Plan Library UI & Interactive Actions
- **File**: `src/components/planner/PlannerGridUI.js` & `src/views/PlannerView.js`
- **Task**:
  - Rewrite `renderHistoryPanel()` to render:
    1. Active Plan card (if `currentPlan` exists) with `[Active Plan]` badge.
    2. Chronological list of historical cards.
    3. Action buttons: "Load as Active", "Recipe Cards", "Delete".
  - Wire actions via `ActionBridge` and delegated event handlers:
    - `restoreSavedPlan(planId)`: loads plan into store & saves to `plans/current`.
    - `openSavedPlanRecipeCards(planId)`: renders a modal displaying cards for all recipes in the plan.
    - `deleteSavedPlan(planId)`: confirms via `DialogHelpers.showConfirm()` and deletes from Firestore.

### Phase 3: 30-Day Repeat Avoidance Engine
- **File**: `src/services/MealPlanGeneratorService.js`
- **Task**:
  - Add `extractRecentRecipeUsage(planHistory, currentPlan, windowDays = 30)`.
  - In `generateMealPlan()`, pass historical usage into candidate selection.
  - Implement freshness ranking with LRU fallback so the generator never runs out of recipes.

### Phase 4: Unit & Integration Verification Suite
- **File**: `scripts/test_meal_plan_library_and_rotation.js`
- **Task**:
  - Test 1: Plan auto-archiving constructs clean payloads without document bloat.
  - Test 2: Library history renderer accurately identifies the active plan vs saved plans.
  - Test 3: Generator strictly omits recipes used in the past 30 days when sufficient fresh recipes exist.
  - Test 4: Generator gracefully falls back to least-recently-used recipes when candidate pool is smaller than required days.

---

## 5. Verification & Acceptance Criteria
- [ ] Committing a plan in the Planner Wizard immediately adds an entry to the Meal Plan Library.
- [ ] Active plan appears at the top of the Library view with an "Active Plan" indicator.
- [ ] Clicking "Load as Active" successfully restores a saved plan to the current planner and Today view.
- [ ] Clicking "Delete" cleanly removes a saved plan from Firestore after confirmation.
- [ ] Generator automatically suppresses recipes cooked in the last 30 days while maintaining target macro fit-scores.
- [ ] All automated tests in `scripts/test_meal_plan_library_and_rotation.js` pass with 0 failures.
