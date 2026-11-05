# Ideation: Recipe Wizard Instruction Parsing, Dual-Profile Macros, Dynamic Fit Scores, and Google Auth Restoration

**Date:** 2026-11-05  
**Topic:** Recipe Wizard Usability & Firestore Auth Restoration  
**Status:** Evaluated & Ranked  

---

## Executive Summary

This ideation session addresses four interrelated usability and reliability issues in PlatePlan:
1. **Recipe Wizard Step Authoring & Pasting**: The "+ Add Step" button in Step 2 fails to add steps, and pasted instruction blocks collapse into a single step.
2. **Streamlined Macro & Fit Score Display**: Remove legacy carb/fibre banners in favor of Elliott & Chloe dual-profile targets (Calories & Protein) and a combined meal fit score.
3. **Dynamic Live Recalculation**: Ensure macro and fit scores reactively recalculate as ingredient quantities, units, and pantry product mappings change.
4. **Google Account Login & Firestore Hydration**: Fix the silent sign-in failure in Chrome/Safari and restore an accessible sign-in entry point.

---

## Axis 1: Recipe Wizard Method Instruction Authoring & Multi-Step Parser

### Root Cause Analysis
- **Step 2 Addition Bug**: When clicking `#wiz-add-step-btn`, the handler calls `syncStep2InputsToState()`, pushes `'New step instruction'` to `activeRecipe.methodSteps`, and then calls `safeRender()`. However, `safeRender()` immediately invokes `syncStep2InputsToState()` again. Because `syncStep2InputsToState()` reads from the current DOM (`.wiz-step-input`), it reads the old list of steps and overwrites the array, deleting the newly pushed step before `renderWizardModal()` can draw it.
- **Single-Line UI Box**: Inputs are rendered as `<input type="text">`, which prevents multi-line typing and auto-expansion.
- **Parser Collapsing**: In Step 1A, instructions are split only by raw `\n`. If a user pastes a paragraph with inline step numbers (`1. ... 2. ...`) or bullet points without clean newlines, it treats the whole text as step 1. In Step 1B, `unpackCollapsedSteps` requires preceding punctuation before digit-period patterns (`([\.!?])\s*(?=\d+[\.\)]\s+)`), failing on common web recipe formats.

### Ideas Generated
1. **Idea 1.1 — Direct Array Push with DOM Skip on Render**:
   - *Concept*: Avoid calling `syncStep2InputsToState` inside `safeRender` when a step is appended.
   - *Critique*: Weak. Only fixes addition, doesn't address the single-line input constraint or parser collapsing.
   - *Verdict*: **Rejected**.
2. **Idea 1.2 — Resilient Step State Sync + Auto-Expanding Textarea Cards + Universal Step Tokenizer**:
   - *Concept*:
     - Fix `safeRender()` / `syncStep2InputsToState` order so in-memory additions are preserved.
     - Replace `<input type="text">` with auto-expanding `<textarea class="wiz-step-textarea">` with row autosizing.
     - Enhance `unpackCollapsedSteps` to detect a wider range of delimiters: `\n\d+[\.\)]`, inline `(?<=\s|^)\d+[\.\)]\s+`, `Step \d+:?`, and bullet points (`•`, `-`, `*`).
     - Wire `unpackCollapsedSteps` into Step 1A manual paste parsing as well as Step 1B bulk parsing.
   - *Critique*: Solves both the UI state bug and all major text pasting formats cleanly with zero bundle overhead.
   - *Verdict*: **SURVIVOR (Recommended)**.
3. **Idea 1.3 — External LLM Instruction Parser**:
   - *Concept*: Send raw recipe text to Gemini/Claude API to parse instructions.
   - *Critique*: Violates project constraints (client-only static PWA, no backend server, introduces latency, offline failure).
   - *Verdict*: **Rejected**.

---

## Axis 2: Recipe Wizard Macro & Fit Score Presentation

### Root Cause Analysis
- Step 2 currently renders `renderStep2MacrosSummaryHTML(activeRecipe)` in a purple banner (`#wiz-servings-banner`), showing total carbs, fat, calories, and protein for the whole recipe.
- This creates visual clutter with unneeded metrics (carbs, fat, fibre) and conflicts with the Apple HIG dual-profile design on the Today card (which tracks individual daily calories and protein for Elliott and Chloe).

### Ideas Generated
1. **Idea 2.1 — CSS Display None on Unwanted Badges**:
   - *Concept*: Hide carbs and fat badges via CSS.
   - *Critique*: Brittle. Leaves dead markup, redundant computations, and does not align with household profiles.
   - *Verdict*: **Rejected**.
2. **Idea 2.2 — Unified Dual-Profile Header Card (Elliott & Chloe Calories + Protein + Meal Fit Score)**:
   - *Concept*:
     - Retire `renderStep2MacrosSummaryHTML` completely.
     - Display a single, clean card at the top of Step 2 (and Step 3):
       - Left: Overall **Meal Fit Score Badge** (0–100, color-coded, e.g. "Fit 88").
       - Right / Stacked: **Elliott** (Portion kcal vs Target kcal, Protein vs Target) and **Chloe** (Portion kcal vs Target kcal, Protein vs Target).
     - Remove carbs, fat, and fibre badges entirely from the wizard header.
   - *Critique*: Perfectly matches the design language of the Today view nutrition card and provides actionable meal feedback.
   - *Verdict*: **SURVIVOR (Recommended)**.

---

## Axis 3: Dynamic Live Recalculation on Volume, Unit & Pantry Mapping Changes

### Root Cause Analysis
- In Step 2, changing an ingredient quantity or unit triggers `updateLiveStep2NutritionDOM()`. However, selecting a new taxonomy item in autocomplete does not immediately re-derive product nutritional data, and portions are not re-scaled through `calculateMealFitScore`.
- Furthermore, when switching between original and enhanced variants, macros don't always propagate to the UI without a full reload.

### Ideas Generated
1. **Idea 3.1 — Full Modal Re-render on Every Input**:
   - *Concept*: Call `renderWizardModal()` whenever any value changes.
   - *Critique*: Destroys UX. Drops active focus from input fields, resets scroll position, and dismisses open autocomplete menus.
   - *Verdict*: **Rejected**.
2. **Idea 3.2 — Reactive In-Place DOM Nutrition Updater**:
   - *Concept*:
     - On quantity/unit change or taxonomy/product resolution, update the internal ingredient in `wizardState.activeRecipe`.
     - Invoke `recalculateWizardMacros(activeRecipe)` to compute per-serving macros from mapped products.
     - Invoke `calculateMealFitScore(activeRecipe, targetMealType, { activeProfile: 'everyone', portionScaled: true })`.
     - Target innerHTML replacement strictly on `#wiz-step2-fit-badge-container` and `#wiz-step2-macro-crossbar-container` without redrawing the input rows.
   - *Critique*: Instantaneous visual feedback, preserve scroll and input cursor position, zero flickering.
   - *Verdict*: **SURVIVOR (Recommended)**.

---

## Axis 4: Google Account Login Restoration & Firestore Hydration

### Root Cause Analysis
- **Silent Redirect Failure**: `AuthService.js` uses `firebase.auth().signInWithRedirect(provider)`. Chrome and iOS Safari treat `github.io` / `localhost` and `plateplan-a5131.firebaseapp.com` as third-party storage, silently partitioning/wiping auth redirect state before returning to the app.
- **No Visible Entry Point**: When a user is unauthenticated or logs out, the app silently falls back to local mode. The Cloud Sync modal (`SyncPanelUI.js`) and top navigation bar offer no "Sign in with Google" button, leaving users stranded.
- **Swallowed Errors**: `waitForAuth()` uses `authInstance.getRedirectResult().catch(() => {})`, hiding redirect failures from diagnostics.

### Ideas Generated
1. **Idea 4.1 — Popup Sign-In with Automatic Local & Cloud Fallback**:
   - *Concept*:
     - Switch `signInWithGoogle` to use `firebase.auth().signInWithPopup(provider)`. Popups run in a separate top-level window context, completely bypassing third-party cookie/storage partitioning.
     - Add fallback to redirect only if popups are explicitly blocked by the browser.
     - In `SyncPanelUI.js`, if the user is unauthenticated, replace the "Sync Now" button with a prominent **"Sign in with Google"** button.
     - In the app header / mobile menu, show a login pill when in local mode (`Local only (Sign in to sync)`), which opens the login modal.
     - On successful login, immediately trigger `hydrateHouseholdData()` and redraw the current view.
   - *Critique*: Fully resolves the verified problem documented in `docs/solutions/integration-issues/google-sign-in-has-no-button-and-redirect-fails-silently.md`.
   - *Verdict*: **SURVIVOR (Recommended)**.
2. **Idea 4.2 — Email/Password Custom Auth**:
   - *Concept*: Introduce username and password credentials.
   - *Critique*: Massive scope increase, requires password reset flows, storage of credentials, and security maintenance.
   - *Verdict*: **Rejected**.

---

## Summary of Surviving Recommendations

| Area | Recommended Approach | Key Benefits |
|---|---|---|
| **Step Authoring & Parsing** | State sync ordering fix + auto-expanding `<textarea>` + universal multi-format step tokenizer (`unpackCollapsedSteps` applied to Step 1A & 1B). | Users can add steps freely; pasted recipes with numbered paragraphs split accurately. |
| **Macros & Fit Scores** | Remove carb/fat/fibre banner; replace with unified dual-profile card (Elliott & Chloe Calories/Protein) + overall meal Fit Score badge. | High visual clarity; matches Today view Apple HIG nutrition card. |
| **Live Recalculation** | Debounced in-place DOM updates for fit score badge and dual-profile crossbar on quantity, unit, or taxonomy changes. | Dynamic, real-time feedback with zero cursor jumps or screen redraws. |
| **Google Auth & Firestore** | Switch to `signInWithPopup` + add visible "Sign In with Google" buttons in Sync Panel and header when unauthenticated. | Eliminates silent redirect failures; lets Elliott & Chloe log in and hydrate Firestore with 1 tap. |

---

## Next Steps

1. Select which area(s) to implement first.
2. Run `/ce-plan` to produce a step-by-step implementation plan for the chosen areas.
3. Execute and verify via `/ce-work`.
