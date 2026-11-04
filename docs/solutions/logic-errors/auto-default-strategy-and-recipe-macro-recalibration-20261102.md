---
date: "2026-11-02"
problem_type: "logic_error"
component: "service_object"
severity: "high"
symptoms:
  - "Auto-default preference disconnected: defaults to lowest absolute price despite preference set to highest protein density"
  - "Stale product isAutoDefault flags override strategy sorting and ingredient defaultProductId assignments"
  - "Existing recipes in Vault do not recalculate calories, protein, or fit scores when default products change"
  - "Unconditional batch updates write all recipes on every recalculation run, threatening Firestore quotas"
root_cause: "incorrect_algorithm"
tags:
  - "auto-default-strategy"
  - "protein-density"
  - "recipe-macro-recalculation"
  - "pantry-hierarchy"
  - "delta-detection"
related_issues: []
---

# Auto-Default Strategy Alignment & Recipe Macro Recalibration Pipeline

## Problem Statement

Users noticed two related issues:
1. The household auto-default product priority was intended to be **"Highest Protein Density"** (`highest_protein_per_kcal`), but the app resolved pantry defaults as **"Lowest Absolute Price"** (`lowest_absolute_price`).
2. Recipes in the Vault retained frozen snapshot macros and fit scores, never updating when better default products were mapped in the pantry.

## Symptoms Observed

1. **Preference Key Mismatch**:
   - In Firestore (`households/elliott-chloe/settings/preferences`), legacy preference keys (`productPriority: "protein_per_kcal"`, `autoMappingStrategy: "protein_per_kcal"`) were not aliased to `autoDefaultStrategy` during hydration.
   - Four fallback points in `HydrationService.js`, `PantryHierarchyService.js`, and `DietaryExclusionManager.js` hardcoded `'lowest_absolute_price'`.
   - `PreferenceRepository.whitelistPreferences` stripped top-level `autoDefaultStrategy` keys on save.
2. **Precedence Inversion in Hierarchy Resolution**:
   - `resolveDefaultProduct` in `PantryHierarchyService.js` checked `p.isAutoDefault === true` before checking `item.defaultProductId` and before running strategy sorting.
   - Sibling products retaining historical `isAutoDefault: true` flags hijacked default selection.
3. **Decoupled Recipe Macros & Pinned IDs**:
   - Recipe macros are static snapshots (`recipe.nutrition`, `recipe.macros`). 96% of recipe ingredients stored pinned `productId` references, bypassing default product updates.
   - 94 recipes in the database had significant calorie/protein discrepancies against optimal defaults (e.g. `Sausage Potato Bake` at 1,186 kcal instead of 738 kcal; `Crispy Korean Wings` at 12,365 kcal instead of 646 kcal).

## Root Cause Analysis

- **System-Wide Fallback Misalignment**: The default fallback across all UI, hydration, and hierarchy modules was hardcoded to price rather than protein density.
- **Incomplete Product Flag Recalibration**: `sweepAndRecalibrateIngredientDefaults` updated `ing.defaultProductId` but did not clear `isAutoDefault: false` on unselected sibling products in Firestore.
- **Absence of Recalibration Engine & Propagation**: There was no batch recalculation engine to re-evaluate recipes from optimal ingredient defaults, nor was there background maintenance to keep recipes synchronized over time.

## Working Solution

### 1. Unified Fallback & Legacy Aliasing
In `src/services/HydrationService.js`, `src/services/PantryHierarchyService.js`, and `src/components/settings/DietaryExclusionManager.js`:
- Set system-wide default strategy fallback to `'highest_protein_per_kcal'`.
- Aliased legacy keys `userPrefs.productPriority` and `userPrefs.autoMappingStrategy` during hydration.
- Whitelisted `autoDefaultStrategy`, `autoDefaultCriterion`, `productPriority`, and `autoMappingStrategy` in `src/services/PreferenceRepository.js`.

### 2. Precedence Hierarchy & Product Flag Sync
In `src/services/PantryHierarchyService.js`:
- `resolveDefaultProduct` prioritizes explicit `item.defaultProductId` and strategy sorting above legacy `p.isAutoDefault` booleans.
- In `sweepAndRecalibrateIngredientDefaults()`, when the winning default product is assigned, it sets `isAutoDefault: true` on the winner and `isAutoDefault: false` on siblings in both in-memory store and Firestore.

### 3. Recipe Macro Recalibration Engine with Delta-Detection
In `src/services/MaintenanceService.js`:
- Added `recalculateAllRecipeMacros(options)`:
  - Resolves optimal default products for ingredients with missing or outdated product IDs.
  - Recomputes nutrition for base recipes and enhanced variants.
  - Recalculates live meal fit scores via `calculateMealFitScore`.
  - **Delta-Detection Guard**: Only adds recipes to the Firestore update batch if calories, protein, or fit score changed beyond an epsilon ($|\Delta \text{kcal}| > 0.5$, $|\Delta \text{prot}| > 0.2$, or $\text{score} \neq \text{newScore}$), preventing wasted Firestore writes.
- In `src/services/CacheMaintenanceService.js`:
  - Hooked background deferred maintenance to trigger `recalculateAllRecipeMacros({ forceAll: false })` whenever `sweepAndRecalibrateIngredientDefaults()` discovers and repairs ingredient defaults.

### 4. UI Controls
- Wired the strategy dropdown in `src/views/SettingsView.js` to automatically trigger pantry recalibration and recipe recalculation upon change.
- Added **⚡ Recalibrate Recipe Macros from Optimal Defaults** button in Settings $\to$ Data Management.

## Verification

- **Automated Test Suite**: Created [`scripts/test_auto_default_and_recipe_recalculation.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/scripts/test_auto_default_and_recipe_recalculation.js) covering:
  1. Preference whitelisting
  2. Strategy sorting prioritising protein density
  3. `resolveDefaultProduct` precedence
  4. Flag synchronization in Store and Firestore
  5. Recalibration of original and enhanced macros
- **Household Data Impact**:
  - 56 recipes had their fit score improved (e.g. *Super Green Lentils* +78 pts to 82; *Curried Coconut Chickpeas on Toast* +74 pts to 100).
  - 18 recipes now have a fit score $\ge 85$.

## Prevention Strategies

1. **Always Synchronize Paired Flags**: When assigning an entity ID pointer (like `ingredient.defaultProductId`), synchronize any boolean flags (`product.isAutoDefault`) on the target collection in the same batch.
2. **Delta-Detect Batch Persistence**: Always compare calculated snapshots against stored values before issuing database writes to protect cloud quota and bandwidth.
3. **Decoupled Calculations Need Trigger Pipelines**: If UI performance demands static snapshots on documents (avoiding thousands of calculations per render), ensure automated background triggers (`CacheMaintenanceService` deferred runs) keep them aligned with upstream taxonomy changes.
