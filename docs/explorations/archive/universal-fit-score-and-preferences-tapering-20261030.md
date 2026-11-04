---
date: "2026-10-30"
exploration_type: "investigation"
component: "javascript_logic"
status: "concluded"
time_box: "30m"
outcome: "proceed_to_plan"
tags:
  - fit-score
  - macro-scoring
  - preferences
  - tapering-curve
  - single-source-of-truth
---

# Universal Fit Score Engine & Preferences Tapering Controls

## Question
1. **Why do recipes visibly switch from one Fit Score to another across the app (or a moment after loading)?**
2. **How do we establish a single, universal Fit Score calculation everywhere in PlatePlan, driven strictly by the Preferences screen — including new user-facing controls for how the score tapers off from target macros?**

## Scope
- **Time-box:** 30 minutes
- **Success Criteria:**
  - Identify every code path where Fit Scores are calculated, cached, or displayed differently.
  - Audit how Preferences (`profiles`, `calorieSplits`, `proteinSplits`, `fitScoreParams`) flow from IndexedDB/Firestore into the calculator.
  - Design clean, intuitive Preferences controls for Fit Score tapering and weighting.
- **Out of Scope:** Modifying recipe ingredient quantities or product pricing logic.

## Best Practices Research

### Industry Standards
1. **Single Source of Truth (Pattern #1 in `critical-patterns.md`):**
   - Domain calculations (like a nutritional Fit Score) must exist in **one pure, deterministic function** (`calculateMealFitScore` in `src/utils/fitScoreCalculator.js`) with **zero competing inline formulas** and **no mutable `_computedFitScore` / `r.fitScore` side-effects** stored on shared recipe objects.
2. **Piecewise Linear / Asymmetric Utility Curves (Nutritional Scoring):**
   - In nutrition apps (MacroFactor, Cronometer, MyFitnessPal), calorie and protein targets have **asymmetric utility**:
     - **Calories** have a tight optimal band (`95%–100%` of target) and penalize going *over* budget faster than going slightly under.
     - **Protein** is a floor-first macro (`100%–120%` of target is ideal; going slightly over is much better than falling short).
   - **Continuity requirement:** Piecewise linear curves must connect at their knot points (`minGrace` and `maxGrace`) without cliff drops.

## Multi-Order Analysis (Think Hard)

### Direct Effects (1st Order)
- Eliminating competing Fit Score call patterns and hydration race conditions stops recipes from jumping between two numbers on load or when opening modals.
- Exposing Fit Score tapering controls in Preferences lets the household tune how strict or forgiving the score is without editing code.

### Ripple Effects (2nd-4th Order)
- **2nd Order:** Vault sorting (`getSortedRecipes`), Meal Plan generation (`MealPlanGeneratorService`), Today view cards (`TodayView`), Swap modals (`PlannerSwapModalUI`), and Recipe Detail modals (`RecipeDetailModalService`) will all show the **exact same percentage and tier badge** for a given `(recipe, variant, mealType, profile)`.
- **3rd Order:** Fixing IndexedDB preference caching (`cacheSlice.js`) ensures that offline/initial boot immediately has `preferences.profiles` and `preferences.fitScoreParams` before `setRecipes` triggers its first render.
- **4th Order:** Pays down technical debt from legacy `r.fitScore` mutations and disconnected hardcoded fallback numbers (`2100/1650` vs `1950/1350` vs `2000/125`).

### Stakeholder Impact Matrix
| Stakeholder | Potential Impact | Severity |
|-------------|-----------------|----------|
| End Users (Elliott & Chloe) | Fit Scores stay rock-solid across Vault, Modal, Planner, and Today views; tapering can be customized in Preferences. | High (Positive) |
| Developers (Elliott & Dad) | One canonical calculation path (`fitScoreCalculator.js` + `macroScoringUtils.js`); easier debugging and maintenance. | High (Positive) |
| Downstream Systems | Meal Plan Generator and Vault Sort rank recipes identically to what badges display. | Medium (Positive) |

## Findings: Why Recipes Switch From One Fit Score to Another

Our audit across all 190 modules uncovered **6 concrete root causes** making Fit Scores flip or disagree:

### 1. The Hydration Order & IndexedDB Cache Bug (Why scores visibly "flip" ~1 second after page load)
- **Evidence A (`src/store/cacheSlice.js` line 106):**
  ```javascript
  preferences: state.preferences ? { nutritionTargets: state.preferences.nutritionTargets } : null,
  ```
  When saving state to IndexedDB, `cacheSlice.js` **strips `state.preferences.profiles`**!
- **Evidence B (`src/services/HydrationService.js` lines 189–209 & 331–356):**
  During cloud hydration, `setRecipes(recipes)` is called **before** `setPreferences(finalPrefs)`.
  - `setRecipes(recipes)` immediately fires `plateplan:state:recipes`, which triggers `renderRecipeVault()`.
  - During that first render, `state.preferences.profiles` is not populated yet, so `resolveHouseholdProfiles()` in `src/utils/fitScoreCalculator.js` (lines 70–76) falls back to hardcoded defaults (`Elliott: 2100 kcal / 140g`, `Chloe: 1650 kcal / 105g`, `35% Dinner`).
  - A split-second later, `setPreferences(finalPrefs)` (and the 300ms debounced `subscribePreferences` listener) fires with your real Firestore preferences, triggering a second `renderRecipeVault()` and causing **every recipe badge to visibly jump to a new number**!

### 2. Meal Type Mismatch: Vault Card ("All Types" = Dinner) vs Recipe’s Own Meal Type (`breakfast` / `lunch` / `snack`)
- **Evidence (`src/views/RecipeVaultView.js` line 138 & `src/components/vault/VaultRecipeCard.js` lines 236, 261–274):**
  - When the Vault filter is set to **"All Meal Types"** (`ft === 'all'`), `RecipeVaultView.js` sets `selectedMealType = 'dinner'` and passes `mealType: 'dinner'` to every card.
  - Inside `VaultRecipeCard.js`:
    - Line 261 computes `liveFitData = calculateMealFitScore(r, r.types[0])` (e.g. `'breakfast'`) and mutates `r.fitScore = liveFitData.score`.
    - Line 268 then renders the badge using `mealType` (`'dinner'`)!
  - **Result:** A Breakfast or Lunch recipe is scored against your **Dinner** macro budget when viewing "All Meal Types" in the Vault, but the moment you filter by "Breakfast" or click **View** to open `RecipeDetailModalService.js` (which uses `r.types[0]`), its Fit Score switches to its Breakfast score!
  - **Fix:** When the Vault meal-type filter is `"all"`, each recipe should be scored against its own primary meal type (`r.types?.[0] || r.type || 'dinner'`). When a specific meal-type filter is active (e.g. `"lunch"`), score against that selected meal type.

### 3. Variant Mix-Up (`original` vs `enhanced`)
- **Evidence A (`src/utils/fitScoreCalculator.js` line 87):**
  ```javascript
  const requestedVariant = options.variant || (r.enhanced ? 'enhanced' : 'original');
  ```
  Whenever a caller omits `options.variant`, `calculateMealFitScore` secretly scores the **`enhanced`** version if `r.enhanced` exists!
- **Evidence B (`src/views/TodayView.js` line 144):**
  ```javascript
  const fitBadge = renderFitScoreBadge(recipe, slot.type, { showLabel: true });
  ```
  `TodayView.js` does not pass `variant: slotInfo.variant` or `activeProfile: person`. So a planned **Original** meal for Elliott or Chloe displays the **Enhanced** Fit Score for Everyone!
- **Evidence C (`src/services/FitScoreService.js` lines 98 & 136 vs `VaultRecipeCard.js` line 264):**
  `getSortedRecipes` sets `r._computedFitScore = Math.max(scoreOrig, scoreEnh)`, while `VaultRecipeCard.js` overwrites `r._computedFitScore = liveFitData.score` during card rendering.

### 4. Profile Filter Ignored on Vault Card Badges
- **Evidence (`src/components/vault/VaultRecipeCard.js` line 269):**
  Even when you filter the Recipe Vault by **Elliott** or **Chloe** (`#filter-who`), `VaultRecipeCard.js` hardcodes `activeProfile: 'everyone'` inside `renderFitScoreBadge(...)`, while `getSortedRecipes` sorts by the selected person's score and `RecipeDetailModalService` switches score when toggling `Shared (2)` / `Elliott` / `Chloe`.

### 5. Competing Inline Formulas & Hardcoded Fallback Targets Across Modules
- **Competing Formula in `src/services/MealPlanGeneratorService.js` (line 316):**
  ```javascript
  let fitScore = 100 - (Math.abs(scaledProt - slot.targetProt) * 1.5 + Math.abs(scaledCal - slot.targetCal) * 0.05);
  ```
  Uses a completely different linear deduction formula instead of `calculateMealFitScore`.
- **Conflicting Default Profiles Across 4 Files:**
  - `fitScoreCalculator.js`: Elliott `2100 kcal / 140g`, Chloe `1650 kcal / 105g`
  - `RecipeDetailModalService.js` (line 198): Elliott `1950 kcal / 140g`, Chloe `1350 kcal / 100g`
  - `RecipeDetailModalService.js` (line 219): Elliott `800 kcal / 40g`, Chloe `600 kcal / 30g`
  - `HydrationService.js` (line 269): `2000 kcal / 125g` with `{ breakfast: 0.25, lunch: 0.35, dinner: 0.40 }`

### 6. Cliff-Drop Bug in the Current Tapering Math (`src/utils/macroScoringUtils.js`)
Look at `calculateCalorieScore` (lines 126–136) and `calculateProteinScore` (lines 154–164):
```javascript
if (r >= minOpt && r <= maxOpt) return 100;
if (r >= (minOpt - 0.10) && r < minOpt) return 86 + ((r - (minOpt - 0.10)) / (minOpt - (minOpt - 0.10))) * (99 - 86);
if (r > maxOpt && r <= (maxOpt + 0.05)) return 99 - ((r - maxOpt) / ((maxOpt + 0.05) - maxOpt)) * (99 - 86);
if (r < minOpt) {
  if (r <= lowFloor) return 0;
  return ((r - lowFloor) / (minOpt - lowFloor)) * 85;
}
```
- **The Cliff Drop:**
  - At `r = 0.85` (`minOpt - 0.10`), the grace-zone formula returns **`86`**.
  - At `r = 0.849` (just `0.1%` lower!), it falls through to `((r - lowFloor) / (minOpt - lowFloor)) * 85`, which divides by `(minOpt - lowFloor)` (`0.95 - 0.50 = 0.45`) instead of `(minGrace - lowFloor)` (`0.85 - 0.50 = 0.35`), causing the score to **plummet from `86` straight down to `66` (a 20-point cliff for a 1-calorie difference!)**.
  - The exact same cliff exists on the upper bound (`r = 1.05` drops from `86` to `74`) and in `calculateProteinScore`!

---

## Exploring New Preferences Controls for Fit Score Tapering

Right now, `src/utils/macroScoringUtils.js` secretly looks for `state.userPrefs.fitScoreParams`, which has **no UI in Preferences (`SettingsView.js`)**:

| Parameter | Current Default | Meaning |
| :--- | :--- | :--- |
| **Calorie Weight vs Protein Weight** | `50%` / `50%` | How much Calories vs Protein contribute to the final Fit Score |
| **Calorie Optimal Band (`calMinOpt` – `calMaxOpt`)** | `95% – 100%` | Ratio of target kcal that scores a perfect **100%** |
| **Calorie Zero Floors (`calLowFloor` – `calHighCeil`)** | `50% – 140%` | How far under (`50%`) or over (`140%`) target kcal before the calorie score tapers to **0%** |
| **Protein Optimal Band (`protMinOpt` – `protMaxOpt`)** | `100% – 120%` | Ratio of target protein that scores a perfect **100%** |
| **Protein Zero Floors (`protLowFloor` – `protHighCeil`)** | `70% – 200%` | How far under (`70%`) or over (`200%`) target protein before the protein score tapers to **0%** |
| **Taper Curve Shape / Presets** | Piecewise Linear (with cliff bug) | How steeply the score drops outside the optimal band (e.g. **Strict**, **Balanced**, **Forgiving**, or **Custom**) |

## Long-Term Implications
- **6 months / 1 year:** Having a single universal Fit Score module (`src/utils/fitScoreCalculator.js`) that reads from a canonical `getPreferences()` selector eliminates score drift permanently.
- **Reversibility:** **Type 2 (Easily Reversible)** — Preferences controls can include a **"Reset to Recommended Defaults"** button.
- **Tech Debt Impact:** **Significantly Reduces Debt** — removes duplicate inline formulas, fixes the hydration race condition, and repairs the piecewise linear cliff discontinuity.

## Decision

**Recommendation:** Proceed to `/plan` with the following confirmed product & engineering decisions:
1. **Fine-Grained Custom Percentage Inputs + Live Preview (No Presets):**
   - Add a dedicated **"🎯 Universal Fit Score & Tapering Rules"** card in Preferences (`SettingsView.js`).
   - Expose fine-grained custom percentage inputs for:
     - **Macro Weighting:** Calorie Weight (%) vs Protein Weight (%) (auto-balanced to 100%, default `50% / 50%`).
     - **Calorie Curve Knot Points (% of meal target):** Zero Floor (`50%`), Green Grace Min (`85%`), 100% Sweet Spot Min (`95%`), 100% Sweet Spot Max (`100%`), Green Grace Max (`105%`), and Zero Ceiling (`140%`).
     - **Protein Curve Knot Points (% of meal target):** Zero Floor (`70%`), Green Grace Min (`95%`), 100% Sweet Spot Min (`100%`), 100% Sweet Spot Max (`120%`), Green Grace Max (`130%`), and Zero Ceiling (`200%`).
   - Fix the 20-point cliff-drop bug in `macroScoringUtils.js` so the outer taper interpolates smoothly from `0` at `lowFloor` up to `85` at `minGrace` (and `85` at `maxGrace` down to `0` at `highCeil`).
   - Include a **Live Interactive Curve Preview** (showing real-time scores & badges at sample target ratios as inputs change) and a **Reset to Recommended Defaults** button.
2. **Highest Eligible Meal-Type Score When Viewing "All Meal Types":**
   - When no specific meal slot is forced (e.g. Recipe Vault filter is set to **"All Meal Types"** or opening a recipe from the Vault), the universal calculator evaluates all of the recipe's eligible meal types (`r.types || [r.type || 'dinner']`) and selects the **highest Fit Score** (e.g. if a recipe is tagged `Lunch` and `Dinner`, and `Lunch` scores higher, it displays and sorts by the `Lunch` Fit Score and opens the Recipe Detail Modal on that same `bestMealType`).
   - When a specific meal type filter or Planner/Today slot *is* active (e.g. filtering Vault by `Dinner`, or viewing a `Lunch` slot in the Planner/Today view), it scores strictly against that slot's meal type.

## Next Steps
- [x] Align with user on tapering UI and "All Meal Types" highest-score behavior.
- [x] Create implementation plan in `plans/2026-10-30-universal-fit-score-and-tapering-controls.md` via `/plan`.
