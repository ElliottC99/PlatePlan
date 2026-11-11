---
title: Recipe Wizard Enhancements and Google Auth Restoration - Plan
type: feat
date: 2026-11-05
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-ideate
execution: code
---

# Recipe Wizard Enhancements and Google Auth Restoration - Plan

## Goal Capsule

- **Objective:** Household members can add and edit multi-line recipe method steps smoothly without losing state, parse pasted recipe instructions into individual numbered steps regardless of formatting, view clean dual-profile Calories and Protein targets (Elliott & Chloe) alongside an overall meal Fit Score that updates reactively as ingredients and pantry products change, and sign in with Google seamlessly on both desktop and mobile devices.
- **Means:** 
  1. Fix state synchronization ordering in `RecipeWizardStep2Handlers.js` and `RecipeWizardState.js` so adding steps preserves in-memory items, switch step inputs to auto-expanding textareas, and upgrade `unpackCollapsedSteps` in `RecipeParserService.js` to tokenize multi-step pasted text into individual steps.
  2. Remove legacy whole-recipe carb, fat, and fibre banners in Step 2; introduce a unified dual-profile card showing Elliott & Chloe meal Calories & Protein targets alongside the overall meal Fit Score badge.
  3. Wire reactive in-place DOM listeners in Step 2 so quantity, unit, and taxonomy/product mappings trigger live macro recalculation and fit score updates without redrawing inputs or losing input focus.
  4. Switch Google authentication from `signInWithRedirect` to `signInWithPopup` with fallback in `AuthService.js`, and add visible "Sign in with Google" controls in `SyncPanelUI.js` and the header when running unauthenticated.
- **Authority hierarchy:** Product Contract `R1`–`R8` govern product behavior; Planning Contract `KTD1`–`KTD4` govern technical mechanisms; Implementation Units `U1`–`U5` execute within those constraints.
- **Execution profile:** Single branch (`execution: code`), Standard depth, 5 implementation units (`U1`–`U5`).
- **Stop conditions:** Stop if changes require modifying Firestore security rules or altering existing recipe document schemas in cloud storage.
- **Completion owner:** Implementing agent verifies all units, runs `npm run lint`, `npm run build`, and verifies all standalone tests.

---

## Product Contract

### Summary

Upgrade the Recipe Wizard authoring experience (step addition, multi-format text parsing, dual-profile nutrition calibration, and reactive in-place fit score recalculation) and restore reliable Google account authentication and Firestore hydration.

### Problem Frame

1. **Wizard Step Addition & Single-Line Input**: In Step 2 of the Recipe Wizard, clicking "+ Add Step" fails to add a step because `safeRender()` immediately invokes `syncStep2InputsToState()`, which reads the current DOM inputs and overwrites the array, deleting the newly pushed step. In addition, step inputs use single-line `<input type="text">`, which clips long instructions and does not expand.
2. **Pasted Text Collapsing**: Pasting recipe instructions into Step 1A splits only on literal newlines (`\n`). If text contains numbered steps in a single paragraph (e.g. `1. Preheat oven... 2. Chop onions...`) or bulleted text, it collapses into a single lumped step.
3. **Cluttered Generic Macro Banners**: Step 2 displays a legacy banner showing recipe-wide total carbs, fat, calories, and protein (`renderStep2MacrosSummaryHTML`). This clutters the UI and contradicts the Apple HIG dual-profile nutrition redesign established on the Today card.
4. **Static Macro/Fit Score Updates**: Nutrition figures and fit score badges in Step 2 do not dynamically update when changing quantities, units, or taxonomy products.
5. **Silent Google Sign-In Failure**: `AuthService.js` uses `firebase.auth().signInWithRedirect()`. Chrome and iOS Safari treat `github.io` / `localhost` and `plateplan-a5131.firebaseapp.com` as third-party storage, silently partitioning/wiping auth state. When logged out, the app silently falls back to local mode without any visible sign-in button in the sync diagnostics or header.

### Key Decisions

- **Preserve in-memory step additions before DOM re-sync**: `syncStep2InputsToState()` must run *before* pushing new steps to state, not inside `safeRender()`.
- **Dual-Profile Elliott & Chloe targets (Calories & Protein only) + Meal Fit Score**: Replace the whole-recipe carbs/fat banner with dual-profile portion rows matching the Today nutrition card.
- **In-place DOM updates for live nutrition**: On ingredient change, re-evaluate `recalculateWizardMacros` and `calculateMealFitScore` directly into `#wiz-step2-fit-badge-container` and `#wiz-step2-macro-crossbar-container` without redrawing the form.
- **Popup-first Google Authentication**: Replace `signInWithRedirect` with `signInWithPopup(GoogleAuthProvider)` and surface "Sign in with Google" in `SyncPanelUI.js` and local-mode headers.

### Requirements

#### Recipe Wizard Instruction Authoring & Parsing
- **R1.** Clicking "+ Add Step" in Step 2 of the Recipe Wizard appends a new instruction step that renders immediately, and deleting a step removes only the targeted step.
- **R2.** Step instruction fields render as auto-expanding textareas that display full multi-line instructions without clipping.
- **R3.** Pasting multi-step instructions into Step 1A (manual) or Step 1B (bulk) automatically splits into individual steps for digit-period patterns (`1.`, `2.`), step prefixes (`Step 1:`, `Step 2:`), parentheses (`1)`, `2)`), bullets (`•`, `-`, `*`), and double line breaks.

#### Nutrition & Fit Score Calibration
- **R4.** Step 2 and Step 3 of the Recipe Wizard display the overall Meal Fit Score badge (0–100, color-coded) and separate daily target comparison rows for Elliott (Calories & Protein) and Chloe (Calories & Protein).
- **R5.** The legacy carb, fat, and fibre banner in Step 2 (`renderStep2MacrosSummaryHTML`) is removed.
- **R6.** Editing an ingredient's quantity, unit, water volume, or taxonomy/product mapping dynamically updates the dual-profile nutrition badges and meal fit score in place, preserving input focus and scroll position.

#### Google Authentication & Cloud Sync
- **R7.** Google sign-in uses `firebase.auth().signInWithPopup(provider)` with fallback, ensuring reliable sign-in on Chrome and iOS Safari without third-party storage loss.
- **R8.** When unauthenticated or operating in local mode, a prominent "Sign in with Google" button appears in the Cloud Sync Diagnostics modal (`SyncPanelUI.js`) and the sync status pill in the header. Successful login immediately triggers household data hydration from Firestore.

---

## Planning Contract

### Known Technical Decisions (KTDs)

- **KTD1: State Sync Sequencing in `RecipeWizardStep2Handlers.js`**: `safeRender()` must accept a flag or avoid calling `syncStep2InputsToState()` when the in-memory state has already been intentionally modified by an action handler.
- **KTD2: Universal Instruction Tokenizer in `RecipeParserService.js`**: Extract `tokenizeMethodSteps(rawText)` that normalizes `\r\n` to `\n`, un-collapses inline numbered sentences `(?<=\.|\?|!|^|\n)\s*(?:\d+[\.\)]|Step\s*\d+:?|[•\-\*])\s+`, trims step numbers, and returns an array of clean step strings.
- **KTD3: In-Place Nutrition DOM Injection**: Avoid full `renderWizardModal()` calls on input/change events. Compute `recalculateWizardMacros(activeRecipe)` and `calculateMealFitScore(activeRecipe, targetMealType, { activeProfile: 'everyone', portionScaled: true })`, then update `innerHTML` of target containers directly.
- **KTD4: Firebase Popup Auth with Redirect Fallback**: `AuthService.js` attempts `signInWithPopup(provider)`. If blocked by a browser popup blocker (`auth/popup-blocked`), it falls back to `signInWithRedirect(provider)`.

---

## Implementation Units

### U1: Instruction Parsing & Step 2 State-Sync Fix
- **Files:** `src/services/RecipeParserService.js`, `src/components/recipe/RecipeWizardStep1Handlers.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`, `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardState.js`
- **Changes:**
  - In `RecipeWizardState.js`, ensure `syncStep2InputsToState` reads step textarea inputs safely without dropping new additions.
  - In `RecipeWizardStep2Handlers.js`, fix `btnAddStep` and `safeRender` so adding steps renders immediately.
  - In `RecipeWizardStep2View.js`, replace `<input type="text" class="wiz-step-input">` with `<textarea class="wiz-step-input">` styled with auto-expanding rows.
  - In `RecipeParserService.js`, expand `unpackCollapsedSteps` to handle inline step numbering, prefixes, and bullets. Use it in `RecipeWizardStep1Handlers.js` for `metRaw`.

### U2: Dual-Profile Macro & Fit Score Presentation in Wizard
- **Files:** `src/components/recipe/RecipeWizardStep2View.js`, `src/components/recipe/RecipeWizardStep3View.js`, `src/components/recipe/RecipeWizardStep2Handlers.js`
- **Changes:**
  - Remove `renderStep2MacrosSummaryHTML` and the purple banner displaying carbs, fat, and calories.
  - Unify the top of Step 2 with the dual-profile crossbar (`renderMacroBreakdownCrossbar`) and the meal fit score badge (`renderFitScoreBadge`).
  - Align labels to show planned per-person calories and protein vs target.

### U3: Reactive In-Place Live Recalculation
- **Files:** `src/components/recipe/RecipeWizardStep2Handlers.js`, `src/components/recipe/RecipeWizardTaxonomySearch.js`, `src/components/recipe/RecipeWizardStep3Handlers.js`
- **Changes:**
  - In `RecipeWizardStep2Handlers.js`, update `updateLiveStep2NutritionDOM` to re-resolve product nutrition from `productsBank` whenever quantities, units, or taxonomy items change.
  - Inject updated fit score badge and dual-profile macro cards without redrawing the form or dropping cursor focus.
  - Ensure servings adjustments immediately scale portions and fit scores.

### U4: Google Popup Auth & Cloud Hydration Entry Points
- **Files:** `src/services/AuthService.js`, `src/components/sync/SyncPanelUI.js`, `src/main.js`, `index.html`
- **Changes:**
  - In `AuthService.js`, update `signInWithGoogle` to use `signInWithPopup(provider)` with fallback to `signInWithRedirect`.
  - In `SyncPanelUI.js`, if `hydrationRes?.unauthenticated` or `!window.firebase?.auth()?.currentUser`, render a prominent "Sign in with Google" button.
  - In `src/main.js`, clicking the sync status indicator when unauthenticated opens the sign-in modal.
  - Ensure successful sign-in triggers `hydrateHouseholdData()` and redraws the current view.

### U5: Automated Regression Test Suite
- **Files:** `scripts/test_recipe_wizard_and_auth.js`
- **Changes:**
  - Test `unpackCollapsedSteps` with inline numbers, bullet points, and multi-paragraph text.
  - Test step addition and deletion state consistency.
  - Test dual-profile macro calculation and fit score generation for recipe wizard items.
  - Test popup auth fallback mechanism and unauthenticated sync UI rendering.

---

## Verification Contract

Run the following test commands:
```bash
node scripts/test_recipe_wizard_and_auth.js
node scripts/test_dead_controls.js
node scripts/test_shopping_list.js
npm run lint
npm run build
```
Quality gates:
- 0 syntax errors across all `src/` modules.
- All standalone test suites pass.
- `dist/` builds with version stamp.

---

## Definition of Done

1. Adding a step in Recipe Wizard Step 2 appends a new input box immediately.
2. Long instructions in Step 2 render in multi-line textareas without horizontal clipping.
3. Pasting recipes with inline numbering (`1. ... 2. ...`) or bullet points correctly parses into distinct numbered steps.
4. Step 2 shows the overall meal Fit Score badge and Elliott/Chloe Calories & Protein targets, with generic carbs/fat banners removed.
5. Changing quantities, units, or mapped taxonomy items dynamically updates the nutrition badges in place.
6. Google Sign-In triggers via popup without silent third-party storage failures, and a visible sign-in action is available when unauthenticated.
7. Automated test suite passes and PR diff is clean.
