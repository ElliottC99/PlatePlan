---
title: Data Quality Centre Reassessment, Audit Consolidation & Guided Resolution Wizards
type: feature
date: 2026-11-03
topic: data-quality-centre-and-wizards
---

# Plan: Data Quality Centre Reassessment, Audit Consolidation & Guided Resolution Wizards

> Created: 2026-11-03  
> Status: Approved ✓ (Ready for /work)  
> Author: Antigravity Pair Programming

## Summary

Transform the **Data Quality Centre** from a fragmented, unresponsive view with 262 false-alarm warnings into a high-utility, executive **Data Health Dashboard** powered by guided **Interactive Resolution Wizards**.

Key achievements:
1. **Silence 262 False-Alarm Density Warnings**: Integrate with [`UnitConversionService.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/UnitConversionService.js) to recognize kitchen liquids (`LIQUID_WORDS`) and group any remaining dry-good volume issues strictly by ingredient.
2. **Wire Up 100% of Dead Buttons**: Implement delegated action routing on `#view-data` so every card action dispatches reliably.
3. **Interactive Resolution Wizards (User Steer: Option A for all)**:
   - **Deduplication Wizard** ([`MergeIngredientsModal.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/data-quality/MergeIngredientsModal.js)): Side-by-side comparison, link-count indicators, and 1-click atomic merge cascading across recipes, products, and meal plans.
   - **Macro Drift Wizard** ([`MacroDriftPreviewModal.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/data-quality/MacroDriftPreviewModal.js)): Side-by-side stored vs calculated macros with a 1-click **"Recalibrate All Drifted Recipes"** button and individual review options.
   - **Orphan Linker Wizard** ([`SubtypeOrphanResolverModal.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/data-quality/SubtypeOrphanResolverModal.js)): Resolves products referencing missing sub-types with options to assign to root default, select an existing sub-type, or create a new sub-type.
   - **Product Linker / Sweeper Wizard** ([`UnlinkedSweeperUI.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/components/data-quality/UnlinkedSweeperUI.js)): Guided linking for unmapped pantry ingredients to Tesco imports or catalog items.
4. **Architectural Consolidation**:
   - Merge `DataQualityEngine.js` and `DataQualityScannerService.js` into canonical owner [`src/services/DataQualityScanner.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/DataQualityScanner.js) (per `plateplan-architecture.md`).
   - Move obsolete drawer shims (`DataQualityDrawer.js`, `DataQualityFixModal.js`) to `attic/` and update `LEDGER.md`.

---

## User Steers & Decisions

- **Density Warnings**: **Option A** — Silence density checks for recognized kitchen liquids (oils, vinegars, soy sauce, stocks, water). Only flag non-liquid dry goods measured in volume (e.g. cups of flour), grouped by ingredient.
- **Recipe Macro Drift**: **Option A** — Interactive Recalibration Wizard showing side-by-side differences with a 1-click "Recalibrate All Drifted Recipes" button plus individual inspect options.
- **Duplicate Ingredients**: **Option A** — Interactive Merge Wizard showing side-by-side comparison, recommending the item with more links, and cascading merges across recipes, products, and meal plans.

---

## Technical Approach & Implementation Steps

### Step 1: Consolidate Scanner Logic in `src/services/DataQualityScanner.js`
- **File**: `src/services/DataQualityScanner.js` (Canonical Owner)
- Consolidate all audit routines into `runAudit(state)`:
  1. `macroDrift`: Detects recipes where stored macros differ >2% from active pantry auto-defaults.
  2. `planDesync`: Detects active meal plan slots whose snapshot macros differ from recipe templates.
  3. `incompleteMacros`: Flags ingredients missing calorie/protein specifications without valid default products.
  4. `densityMismatch`:
     - Import `LIQUID_WORDS` / liquid pattern logic or check `isLiquid` from `UnitConversionService.js`.
     - Skip recognized liquids (Soy Sauce, Sesame Oil, Vinegar, Water, Broth, Wine, Milk, etc.).
     - Skip products whose `packUnit` is already volume (`ml`, `l`).
     - Group remaining dry-goods volume issues **by ingredient ID** (not duplicated per recipe).
  5. `orphans`: Detects products pointing to non-existent `ingredientId` or `subtypeId`.
  6. `unmappedItems`: Detects pantry ingredients that have 0 store products attached.
  7. `duplicates`: Detects ingredient pairs with string similarity >85%.
  8. `storageHealth`: Flags preference document payloads exceeding 500 KB.
- Export clean helper functions: `runAudit`, `scanDataQualitySummary`, `getEffectiveIngredientMacros`.

### Step 2: Modernize Dashboard Layout & Action Delegation in `DataQualityTableRenderService.js`
- **File**: `src/views/DataQualityTableRenderService.js`
- **Top Summary Banner**:
  - Displays Overall Household Health Score (percentage).
  - Displays count of genuine actionable items.
  - Quick action chips to launch the respective wizards directly.
- **Card Categories**:
  - Filtered, clean cards with real metrics (noise-free).
- **Delegated Action Listener**:
  - Add a single delegated `click` listener on the view container for:
    - `.duplicate-merge-btn` -> calls `openMergeIngredientsModal({ ing1Id, ing2Id })`
    - `.orphan-resolve-btn` -> calls `openSubtypeOrphanResolverModal({ subtypeId, parentId })`
    - `.rec-manual-inspect-btn` -> calls `openMacroDriftPreviewModal([recipeId])`
    - `.plan-sync-active-btn` -> calls `openMealPlanSyncWarningModal(...)`
    - `.unmapped-tesco-btn` -> launches product linker / Tesco search
    - `#dq-btn-recalibrate-all` -> calls `openMacroDriftPreviewModal()`
    - `#dq-btn-sweeper` -> calls `openUnlinkedSweeperModal()`
    - `#dq-btn-recipe-audit` -> calls `openRecipeAuditModal()`

### Step 3: Polish & Modernize the Resolution Wizards
1. **Deduplication Wizard** (`src/components/data-quality/MergeIngredientsModal.js`):
   - Enhance side-by-side card comparison showing:
     - Name, Category, Default Product, Subtypes.
     - Number of recipes using each ingredient.
     - Number of store products linked.
   - Recommended "Keep" pre-selected based on higher usage.
   - Clear "Merge & Update Recipes" button executing `batchMergeIngredientsInDb`.
2. **Macro Drift Recalibration Wizard** (`src/components/data-quality/MacroDriftPreviewModal.js`):
   - Add top prominent button: **⚡ Recalibrate All Drifted Recipes**.
   - Show side-by-side table/cards of each drifted recipe (Stored vs Calculated Cal/Protein).
   - Allow single-click batch recalibration or individual recipe approval.
3. **Orphan Linker Wizard** (`src/components/data-quality/SubtypeOrphanResolverModal.js`):
   - Show affected product name, current parent ingredient, and the broken subtype reference.
   - 3 clean action choices:
     - Option 1: Assign to Parent Root Item Auto-Default.
     - Option 2: Link to an existing Sub-Type from the dropdown.
     - Option 3: Create a new Sub-Type with the product's name.

### Step 4: Quarantine Dead Files & Ledger Alignment
- Move superseded duplicate files into `attic/`:
  - `src/components/data-quality/DataQualityDrawer.js`
  - `src/components/data-quality/DataQualityFixModal.js`
  - `src/components/data-quality/DataQualityIssueRow.js`
- Update `plateplan-architecture.md` (Data Quality row).
- Run `npm run ledger` and verify.

### Step 5: Verification & Automated Tests
- Create `scripts/test_data_quality_wizards.js`:
  - Verify `runAudit` silences liquid density false alarms.
  - Verify dry goods volume check groups by ingredient.
  - Verify duplicate detection identifies test candidates.
  - Verify orphan detection flags missing subtype references.
  - Verify macro recalibration applies correct recalculated values.
- Run all test suites: `node scripts/test_data_quality_wizards.js`, `node scripts/test_variant_save_and_taxonomy_mapping.js`, `node scripts/test_shopping_list.js`, `node scripts/test_vault_recipe_card_menu.js`.
- Run `npm run build`.

---

## Acceptance Criteria

1. **Clean Health Metrics**: Opening the Data Quality Centre on real data reports ~27 actionable items, NOT 289 (the 262 liquid density false alarms are eliminated).
2. **Every Action Button Works**: Clicking "Review & Merge", "Resolve Links", "Recalibrate", or "Sync Active Week" opens the appropriate interactive modal/wizard immediately.
3. **1-Click Macro Recalibration**: The user can review and recalibrate all drifted recipes in a single click.
4. **Interactive Ingredient Merge**: The user can inspect duplicate candidates, see recipe usage counts, and merge them with cascade to recipes and products.
5. **No Parallel Drift**: `DataQualityScanner.js` is the single canonical scanner, `npm run ledger` is updated, and all unit tests pass.
