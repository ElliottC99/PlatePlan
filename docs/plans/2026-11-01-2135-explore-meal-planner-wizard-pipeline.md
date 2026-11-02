# Exploration: 4-Step Meal Planner Lifecycle & Crash Root Cause Analysis

> Date: 2026-11-01  
> Topic: meal-planner-wizard-lifecycle  
> Focus: Root-cause diagnosis of `TypeError: Cannot read properties of undefined (reading 'currentPlan')` and end-to-end audit of the 4-step meal planning pipeline.  
> Status: Exploration Complete  

---

## 1. Executive Summary & Incident Analysis

### The Incident
When navigating to the Meal Planner (Step 1) and attempting to change the Start Date in `<input type="date" id="wizard-plan-start">`, the application threw an unhandled crash:

```text
CRASH TRACE
Uncaught TypeError: Cannot read properties of undefined (reading 'currentPlan')
File: http://localhost:3000/src/main.js
Line: 92
```

### Root Cause Diagnosis
1. **Broken `saveState` Fallback Property Access**:
   In `src/main.js`, `window.saveState` was implemented as:
   ```javascript
   window.saveState = function(stateData) {
     const rawPlan = stateData?.plan || stateData?.currentPlan || stateData .currentPlan ?.currentPlan;
     if (!rawPlan) return;
     ...
   ```
   Notice that while the first two checks used optional chaining (`stateData?.plan`, `stateData?.currentPlan`), the third check contained a fatal typo: `stateData .currentPlan ?.currentPlan` (missing the optional chaining operator `?` before `.currentPlan`).
2. **Caller Invocations With No Arguments**:
   In `src/components/generator/GeneratorConstraintsForm.js`, the date and duration change handler is:
   ```javascript
   input.onchange = (e) => {
     const key = e.target.dataset.key;
     const val = e.target.value;
     const state = getState();
     if (key === 'plannerDays') state.currentPlannerDays = parseInt(val) || 7;
     if (key === 'plannerStartDate') state.currentPlannerStartDate = val;
     if (typeof window.saveState === 'function') window.saveState(); // <-- Called with NO ARGUMENTS (undefined)!
     if (onRender) onRender();
   };
   ```
   When `window.saveState()` was invoked with no arguments, `stateData` was `undefined`. Evaluating `stateData .currentPlan` immediately crashed with `TypeError: Cannot read properties of undefined (reading 'currentPlan')`.
3. **Compound Fragility Across Step 1**:
   The same no-argument invocation occurs in:
   - `PlannerSkeletonGridUI.js`: `handleFitScoreMinChange(val)`
   - `PlannerSkeletonGridUI.js`: `handleFitScoreMaxChange(val)`
   - `PlannerSkeletonGridUI.js`: `setSplitPersonSlotStatus(...)`
   - `ShoppingBatchToolbar.js`: `renderShoppingBatchToolbar` actions

Any user interaction with the fit score sliders, plan duration, start date, or skeleton slot toggles caused this fatal crash.

---

## 2. End-to-End Architectural Audit of the 4-Step Planner Pipeline

PlatePlan's Meal Planner is designed as a linear 4-step wizard that transitions households from high-level scheduling requests to a finalized, shopping-ready meal plan.

```
+---------------------------------------------------------------------------------------------------------+
|                                        MEAL PLANNER 4-STEP PIPELINE                                     |
+---------------------------------------------------------------------------------------------------------+
       |                                                                                                  
       v Step 1: Configure Plan Requests                                                                  
+-------------------------------------------------------------------------------------------------------+ 
| - Inputs: Plan length (1-14 days), Start date, Repeat cadences (Breakfast, Lunch, Dinner).            | 
| - Fit Score Scope: Dual-handle timeline (e.g. 70% to 100% Fit Score bounds).                          | 
| - Skeleton Interactivity: Pinning recipes to slots, skipping slots ("Not needed"), splitting couples.  | 
| - Action: "✨ Generate Meal Plan →"                                                                    | 
+-------------------------------------------------------------------------------------------------------+ 
       |                                                                                                  
       v Step 2: Review Generated Meal Plan                                                               
+-------------------------------------------------------------------------------------------------------+ 
| - Grid Layout: Day cards displaying date labels, Elliott & Chloe calories/protein, and prep groups.   | 
| - Macro Fit Badges: Displays tier badges (e.g. 94% Ideal Match, 81% Good Match).                     | 
| - Inline Modification:                                                                                | 
|     * "Swap ▾" opens searchable recipe modal with live candidate fit scoring & instant replacement.   | 
|     * "Toggle Variant" switches between original and 85+ enhanced versions.                           | 
|     * "Prioritise All Enhanced" bulk-upgrades compatible meals.                                       | 
| - Actions: "← Edit Requests" (Step 1) | "Proceed to Shopping List →" (Step 3).                         | 
+-------------------------------------------------------------------------------------------------------+ 
       |                                                                                                  
       v Step 3: Shopping List & Substitutions                                                             
+-------------------------------------------------------------------------------------------------------+ 
| - Aggregation: Calculates exact net ingredient quantities required across all planned meals.           | 
| - Supermarket Aisle Grouping: Groups ingredients into Produce, Bakery, Dairy, Pantry, etc.             | 
| - Product Mapping & Costing: Associates Tesco products, computes pack multiples and total basket £.   | 
| - Product Customization: Tapping an ingredient launches ProductSwapModal to switch store brands.      | 
| - Utility: "📋 Copy Shopping List to Clipboard" for instant mobile store use.                          | 
| - Actions: "← Back to Review Plan" (Step 2) | "✓ Save Shopping List & Plan (Commit to Today) →"       | 
+-------------------------------------------------------------------------------------------------------+ 
       |                                                                                                  
       v Step 4: Commit & Sync Lifecycle                                                                  
+-------------------------------------------------------------------------------------------------------+ 
| - Persistence: Atomically saves sanitised plan to Firestore `households/elliott-chloe/plans/current`.  | 
| - State Handoff: Sets `currentPlannerStep = 2` for future sessions and redirects to Today view.       | 
| - Reset Capability: "↺ Start Fresh" button safely resets parameters to today and 10 days without data loss| 
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. Systematic Findings & Hidden Vulnerabilities Discovered

Beyond the immediate crash at line 92, a comprehensive audit of all files in the pipeline revealed three additional architectural fragilities:

### Vulnerability A: `MealPlanGeneratorService.js` Typo in Cadence & Skeleton Options
In `src/services/MealPlanGeneratorService.js` (lines 120 and 123):
```javascript
const cadence = options.cadence ?.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
const skeletonGrid = options.skeletonGrid ?.skeletonGrid || {};
```
- When `options.cadence` is passed as an object (e.g., `{ breakfast: 1, lunch: 2, dinner: 2 }`), `options.cadence.prefs` is `undefined`, causing cadence options to be completely ignored and always fall back to the default `{ breakfast: 1, lunch: 2, dinner: 2 }`.
- **Target Fix**:
  ```javascript
  const cadence = options.cadence || state.prefs?.mealRepeatCadence || { breakfast: 1, lunch: 2, dinner: 2 };
  const skeletonGrid = options.skeletonGrid || state.skeletonGrid || {};
  ```

### Vulnerability B: Inline Legacy `state` Mutation in `GeneratorConstraintsForm.js`
In `src/components/generator/GeneratorConstraintsForm.js` (lines 63, 69, 75):
```html
<select id="wizard-cadence-breakfast" onchange="state.prefs.mealRepeatCadence=state.prefs.mealRepeatCadence||{};state.prefs.mealRepeatCadence.breakfast=parseInt(this.value)||1;saveState();">
```
- These selects execute inline JavaScript referencing an unqualified `state` variable. In ES module architecture, `state` is not a window global; changing cadence dropdowns throws `ReferenceError: state is not defined`.
- **Target Fix**: Bind all cadence selects through `bindConstraintEvents` using `.pp-constraint-input` and `data-key` attributes, properly delegating to `getState()` and reactive setters.

### Vulnerability C: Safe Universal `saveState` Implementation
In `src/main.js`:
- `window.saveState(stateData)` must safely accept:
  1. `undefined` / no arguments: fall back to `getState()`.
  2. A plan instance directly (with `.slots`): e.g. from `PlannerSwapModalUI`.
  3. A state container object with `.currentPlan` or `.plan`.
- In all cases, it must:
  1. Synchronize to `setActivePlan` and `saveCurrentPlan`.
  2. Persist to IndexedDB cache via `saveStateCache()`.
  3. Never throw if no plan exists (e.g. during pre-generation Step 1 configuration).

---

## 4. Multi-Order Thinking & Systemic Impact

### 1st Order Consequences
- Users can modify the Start Date and Plan Length without encountering crashes.
- The skeleton grid instantly updates its column headers and dates to match the selected start date.
- Changing cadence dropdowns cleanly updates household preferences.

### 2nd Order Consequences
- Meal plan generation correctly reads the user-selected start date and cadences, generating recipes starting on the requested calendar day (e.g., Monday rather than today).
- Meal swaps in Step 2 save successfully without triggering unhandled exceptions.
- Step 3 shopping aggregation computes quantities mapped to the exact generated plan dates.

### 3rd Order Consequences
- Long-term resilience: Eliminating ad-hoc inline handlers and fragile property chains prevents regressions as other views interact with the planner store.
- Zero desynchronization between IndexedDB cache and Firestore cloud storage.

---

## 5. Stakeholder Impact Matrix

| Stakeholder | Impact |
| :--- | :--- |
| **Elliott & Chloe (End Users)** | Smooth, seamless meal planning from start date selection to shopping list generation. Zero white-screen crashes. |
| **Developer / Maintainer** | Robust, type-safe persistence contract. All steps in wizard follow identical lifecycle conventions. |
| **Ops / Cloud Persistence** | Debounced, sanitized payloads sent to Firestore `plans/current` prevent excessive write operations and quota burn. |

---

## 6. Decision Gate & Next Steps

* **Decision**: Proceed immediately to `/plan` to implement the hardened universal `saveState` handler, clean up the generator options typos, and standardize event binding across the 4-step wizard.
