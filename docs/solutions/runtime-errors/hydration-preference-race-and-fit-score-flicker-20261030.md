---
date: "2026-10-30"
problem_type: "runtime_error"
component: "state_management"
severity: "high"
symptoms:
  - "On page load, Today View and Recipe Vault briefly display one Fit Score (e.g. 58% for Apple crumble protein bowl) before flickering to another score (83%) ~300ms later"
  - "ReferenceError: NETWORK_TIMEOUT_MS is not defined inside PreferenceRepository.getHouseholdData safeGet promise"
  - "IndexedDB cache entry (plateplan_store_cache) loses preferences and userPrefs whenever recipeStore.js saves recipes or currentPlan"
root_cause: "race_condition"
tags:
  - "hydration"
  - "indexeddb"
  - "firestore"
  - "fit-score-flicker"
  - "state-cache"
related_issues: []
related_solutions:
  - "universal-fit-score-drift-and-tapering-curve-20261030.md"
last_referenced: "2026-10-30"
status: "active"
---

# Hydration Preference Race & Page-Load Fit Score Flicker (`58%` → `83%`)

## Problem Statement

**What happened:**
When loading or refreshing PlatePlan, recipes on the Today page (such as "Apple crumble protein bowl") and in the Recipe Vault initially rendered with one Fit Score (`58%`) and then visibly flicked to a different permanent Fit Score (`83%`) roughly 300ms later.

**Impact:**
Every page load caused an jarring visual jump in Fit Score percentages and traffic-light badge colors (`🟠 58%` → `🟡 83%`) as the app transitioned from hardcoded fallback macro targets to the user's cloud-saved household preferences.

## Symptoms

1. **Today Page Badge Flicker (`58%` → `83%`)**
   - "Apple crumble protein bowl" (`602 kcal`, `81.1g P`, `serves: 1`, `breakfast`) rendered at `58%` immediately after `hydrateHouseholdData()` completed, then switched to `83%` ~300ms later when real-time Firestore listeners (`setupRealtimeSubscriptions`) attached.
2. **Silent `ReferenceError` Swallowed in `PreferenceRepository.js`**
   - `getHouseholdData()` in `src/services/PreferenceRepository.js` referenced `NETWORK_TIMEOUT_MS` on line 201 without importing it from `src/config/systemConfig.js`. Because the `try / catch` block around `Promise.race` swallowed all errors as "offline timeouts", the `ReferenceError` was completely silent in the console.
3. **Partial Slice State Overwriting IndexedDB `preferences`**
   - `src/store/recipeStore.js` called `saveStateCache(recipeState)` where `recipeState` only contained `{ recipes, draftRecipes, currentPlan }`, wiping out `preferences` and `userPrefs` in IndexedDB (`src/store/cacheSlice.js`).

## Investigation Steps

| Attempt | Hypothesis | Result |
|---------|------------|--------|
| 1. Reorder `setPreferences(finalPrefs)` before `setRecipes(recipes)` in `HydrationService.js` | Setting preferences before recipes during `hydrateHouseholdData()` will ensure the first render has user targets | ❌ Partially helped, but Today View still flickered from `58` to `83` because `preferencesData` returned by `getPreferences(uid)` during `hydrateHouseholdData` had empty `profiles` and `nutritionTargets` |
| 2. Simulate "Apple crumble protein bowl" (`r1784064331957`) in Node against backup JSON | Find the exact state combination that yields `58` vs `83` | ✅ `58` is the exact score with empty/fallback preferences (`2100 kcal / 140g`, `25%` breakfast = `525 kcal / 35g`); `83` is the exact score with cloud `prefData` (`390 kcal / 35g` E, `270 kcal / 23g` C) |
| 3. Inspect `getPreferences()` in `src/services/PreferenceRepository.js` | Check why `getPreferences(uid)` returned empty data during `hydrateHouseholdData()` while `subscribePreferences()` succeeded 300ms later | ✅ Found `ReferenceError: NETWORK_TIMEOUT_MS is not defined` inside `safeGet()` in `PreferenceRepository.js` AND partial-state overwrite in `cacheSlice.js` |

## Root Cause Analysis

1. **Unimported `NETWORK_TIMEOUT_MS` in `PreferenceRepository.js`:**
   ```javascript
   const timeoutPromise = new Promise((_, reject) =>
     setTimeout(() => reject(new Error('Firestore timeout')), NETWORK_TIMEOUT_MS)
   );
   ```
   Because `NETWORK_TIMEOUT_MS` was not imported in `PreferenceRepository.js`, constructing `timeoutPromise` threw `ReferenceError: NETWORK_TIMEOUT_MS is not defined` synchronously at `0ms`. `Promise.race` immediately rejected into `catch (_e)`, which tried `ref.get({ source: 'cache' })` and returned `null`. Thus `getPreferences(uid)` resolved to `{ userPrefs: {}, settings: {} }` while `getRecipes(uid)` and `getCurrentPlan(uid)` (which used `safeFirestoreGet(ref, timeoutMs = 2500)` in `RecipeFirestoreRepository.js`) succeeded!
   Then, 300ms later, `setupRealtimeSubscriptions()` attached `subscribePreferences` (`onSnapshot`), which does not use `safeGet`. When `onSnapshot` delivered the real `settings/preferences` document, `setPreferences` fired and re-rendered `TodayView` from `58%` to `83%`.

2. **Partial Slice State Passed to `saveStateCache`:**
   In `src/store/recipeStore.js`, `setRecipes` and `setCurrentPlan` called `saveStateCache(recipeState)`. Because `recipeState` only holds `{ recipes, draftRecipes, currentPlan }`, `saveStateCache` wrote `preferences: null, userPrefs: {}` to IndexedDB whenever `recipeStore` was mutated directly.

## Lessons Learned

### Mistakes Made
- **Assumption:** A `try / catch` block around `Promise.race([netPromise, timeoutPromise])` only catches network or timeout rejections.
  - **Why it was wrong:** Any synchronous `ReferenceError` or `TypeError` inside the `new Promise(...)` executor rejects the promise immediately at `0ms` and is silently masked as a network timeout by `catch (_e)`.
  - **Correction:** Always verify that constants used inside timeout helpers (`NETWORK_TIMEOUT_MS`) are imported from `src/config/systemConfig.js`, and never pass partial slice objects into a full-store IndexedDB persistence function without merging against `getState()`.

## Working Solution

### 1. Import `NETWORK_TIMEOUT_MS` & Whitelist `fitScoreParams` (`src/services/PreferenceRepository.js`)

```javascript
import { db, HOUSEHOLD_ID } from '../config/firebase.js';
import { NETWORK_TIMEOUT_MS } from '../config/systemConfig.js';
import { getState as getStoreState } from '../store/store.js';
import { isDbAvailable } from './RecipeFirestoreRepository.js';

export function whitelistPreferences(preferences) {
  if (!preferences || typeof preferences !== 'object') return {};
  const whitelisted = {};
  const allowedKeys = [
    'nutritionTargets', 'profiles', 'fitScoreParams', 'settings', 'theme',
    'mealPlanSettings', 'activeView', 'userPrefs', 'dismissedQualityAdvisories',
    'dismissedAdvisories', 'dismissed_advisories', 'updatedAt'
  ];
  // ...
}
```

### 2. Merge Partial Slice States in `saveStateCache` (`src/store/cacheSlice.js`)

```javascript
export function saveStateCache(passedState) {
  const coreState = (typeof getState === 'function' ? getState() : null) || {};
  const state = (passedState && typeof passedState === 'object')
    ? { ...coreState, ...passedState }
    : coreState;
  if (!state || typeof state !== 'object' || !state.recipes) {
    return;
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const latestCore = (typeof getState === 'function' ? getState() : null) || {};
    const fullState = { ...latestCore, ...state };
    const payload = {
      recipes: fullState.recipes || [],
      ingredients: fullState.ingredients || [],
      products: fullState.products || [],
      categories: fullState.categories || [],
      preferences: fullState.preferences || latestCore.preferences || fullState.userPrefs || null,
      userPrefs: (fullState.userPrefs && Object.keys(fullState.userPrefs).length > 0)
        ? fullState.userPrefs
        : (latestCore.userPrefs || fullState.preferences || {}),
      settings: fullState.settings || latestCore.settings || {},
      currentPlan: fullState.currentPlan || latestCore.currentPlan || null,
      shoppingList: fullState.shoppingList || latestCore.shoppingList || [],
      cachedAt: Date.now()
    };
    // ...
  }, 100);
}
```

### 3. Hydrate Preferences, Ingredients & Products Before Recipes (`src/services/HydrationService.js`)

```javascript
if (finalPrefs && Object.keys(finalPrefs).length > 0) {
  setPreferences(finalPrefs);
}
if (Array.isArray(ingredients) && ingredients.length > 0) {
  setIngredients(ingredients);
}
if (Array.isArray(products) && products.length > 0) {
  setProducts(products);
}
if (Array.isArray(recipes) && recipes.length > 0) {
  setRecipes(recipes.map(cleanLegacyMacros));
}
```

## Prevention Strategies

1. **Never Swallow `ReferenceError` Inside Network Timeout Wrappers:** Centralize Firestore timeout helpers (such as `safeFirestoreGet` in `RecipeFirestoreRepository.js`) rather than duplicating inline `Promise.race` wrappers across repositories.
2. **Always Merge With Core State in Cache Persistence:** Any persistence layer (`saveStateCache`) that writes a whole-store snapshot to IndexedDB must merge partial slice payloads with `getState()` so slice-level actions cannot null out unrelated domains.
3. **Bump `CACHE_KEY` When Changing Cached Schema:** When adding required fields (`preferences.profiles`, `fitScoreParams`) to the IndexedDB snapshot, bump `CACHE_KEY` in `src/store/cacheSlice.js` so browsers automatically invalidate stale snapshots on next load.
