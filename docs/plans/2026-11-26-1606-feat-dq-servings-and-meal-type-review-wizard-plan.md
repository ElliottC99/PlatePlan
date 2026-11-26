---
title: Data Quality Servings and Meal-Type Review Wizard
date: 2026-11-26
type: feat
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Data Quality Servings and Meal-Type Review Wizard

## Goal Capsule

- **Objective:** Users can review and fix recipes with suspicious servings counts or mismatched meal types from a single guided wizard in the Data Health Centre, with settled choices remembered so confirmed recipes are not re-prompted.
- **Product authority:** Active scope is Area C (Data Quality Servings & Meal-Type Review Wizard). Areas A (Recipe Wizard & Parser Fixes) and B (Universal Partial/Token Search) are already implemented on `dev/fix-paste-parse-and-recipe-notes`.
- **Open blockers:** None.

---

## Product Contract

### Summary

Recipes saved with an inaccurate servings count or wrong meal-type tags distort Fit Scores, portion scaling, and meal plan generation. This feature adds a **Servings & Meal-Type Review** guided wizard to the Data Health Centre that detects likely servings and meal-type mismatches, previews the suggested adjustments alongside live per-serving macros and Fit Scores, saves updates to Firestore, and persists confirmed or dismissed decisions per recipe so the wizard stops prompting for settled items.

### Problem Frame

When imported recipes inherit default servings or fall back to `"Dinner"`, per-serving calorie and protein values become skewed (too high or too low) and meals land in the wrong planner slots. Today there is no audit pass that flags these mismatches or lets the user settle them in one flow without repeatedly dismissing the same intentional edge cases.

### Requirements

- R1. Scan household recipes for **servings mismatches**: flag recipes whose total-batch / per-serving calories are far outside the household target for their meal type (e.g., per-serving kcal > 1.45× or < 0.55× the average household meal target, or where an alternative servings count from 1–8 improves Fit Score by at least +12 points) and suggest the best-fitting servings count.
- R2. Scan household recipes for **meal-type mismatches**: flag recipes whose title keywords strongly indicate a meal type absent from their current `mealSuitability` / `types` (e.g., breakfast terms like oats/porridge/granola/pancake/smoothie/bagel, snack terms like bar/cookie/muffin/protein ball/bites, or lunch terms like wrap/sandwich/toastie/soup), or whose per-serving macros score substantially better (+15 points) under a different meal type, and suggest the better-fitting meal type(s).
- R3. Combine both checks into one **Servings & Meal-Type Review** guided wizard launched from the Data Health Centre action ribbon (showing the live count of unreviewed flagged recipes) and a matching audit card.
- R4. For each flagged recipe in the wizard, display current vs. suggested servings and meal-type tags with live editable controls (numeric servings input + multi-select Breakfast / Lunch / Dinner / Snacking pills) and a live per-serving macro and Fit Score preview as the user adjusts values.
- R5. Support two explicit resolution actions per recipe: **Apply & Remember** (updates the recipe's `serves`/`servings`, `mealSuitability`/`types`/`mealType`, and recalculated per-serving macros in Firestore and store, then records the recipe as reviewed) and **Keep Current & Remember** (leaves the recipe unchanged and records the recipe as reviewed so it is not flagged again).
- R6. Persist reviewed recipe decisions in a dedicated household preference map (`preferences.reviewedRecipeMetadata[recipeId]`) so choices survive reloads and are never pruned by Data Quality's "Clean History Cache" action; provide a "Reset Reviewed" control inside the wizard to clear remembered decisions if the user wants to re-check settled recipes.

### Key Decisions

- Show smart-flagged mismatches only rather than walking through every recipe in the vault (`session-settled: user-selected`, over all-unreviewed or toggleable browse — maximizes signal and avoids review fatigue). Governs R1, R2.
- Store remembered decisions in a dedicated `preferences.reviewedRecipeMetadata` map keyed by `recipeId`, with a "Reset Reviewed" option inside the wizard (`session-settled: user-confirmed` — immune to `dismissedQualityAdvisories` cache pruning). Governs R5, R6.
- Recalculate and persist updated per-serving macros whenever servings change in the wizard so Vault, Planner, and Today reflect the change immediately (`session-settled: user-confirmed`). Governs R5.

### Scope Boundaries

- Does not auto-modify recipes without explicit user confirmation in the wizard.
- Does not change the core Fit Score formula or meal plan generator logic.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers Area C (Data Quality Servings & Meal-Type Review Wizard), the final item from the 3-area polish batch following Area A (Recipe Wizard & Parser Fixes) and Area B (Universal Partial/Token Search), both already committed on `dev/fix-paste-parse-and-recipe-notes`.

### Acceptance Examples

- AE1. Suspicious servings and meal type are flagged with actionable suggestions
  - **Covers:** R1, R2
  - **Given:** Recipe A (`"Overnight Cinnamon Oats"`, `serves: 1`, `types: ['dinner']`, per-serving `1150 kcal / 60g prot` total batch) and Recipe B (`"Chicken Curry"`, `serves: 2`, `types: ['dinner']`, per-serving `650 kcal / 48g prot` matching dinner targets).
  - **When:** The Servings & Meal-Type scanner runs.
  - **Then:** Recipe A is flagged for both servings (suggesting `serves: 2`) and meal type (suggesting `Breakfast`), while Recipe B is not flagged.

- AE2. Applying or keeping a recipe persists memory and removes it from future prompts
  - **Covers:** R5, R6
  - **Given:** Recipe A is flagged in the wizard.
  - **When:** The user clicks **Apply & Remember** (or **Keep Current & Remember**).
  - **Then:** `preferences.reviewedRecipeMetadata[recipeA.id]` is persisted, Recipe A disappears from the flagged count on subsequent scans, and running Data Quality's "Clean History Cache" does not erase `reviewedRecipeMetadata`.

- AE3. Resetting reviewed choices restores flagged recipes for re-checking
  - **Covers:** R6
  - **Given:** Recipe A was previously marked **Keep Current & Remember** while still having mismatched metadata.
  - **When:** The user clicks **Reset Reviewed** in the wizard.
  - **Then:** `reviewedRecipeMetadata` is cleared and Recipe A appears in the flagged list again.

### Outstanding Questions

- None.
