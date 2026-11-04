---
title: Remove Redundant Unmapped Pantry Items Card from Data Quality Centre
type: refactor
date: 2026-11-03
topic: data-quality-unmapped-removal
---

# Remove Redundant Unmapped Pantry Items Card from Data Quality Centre

> Created: 2026-11-03  
> Status: Implemented ✓

## Summary
Safely and completely removes the redundant "Pantry Items Lacking Store Products" (formerly "Unmapped Core Ingredients") card and scanner check from the Data Quality Centre. The authoritative single source of truth for ingredient linkage is the Recipe Mapping Audit (`RecipeAuditModal.js`), which audits whether active recipe ingredients link to Master Pantry catalog entities. Pantry staples (e.g. Milled Flax Seed Mix, Sherry, Penne) do not require store barcode products unless a shopping list or active recipe requires them, making this card artificial busywork.

---

## Prior Solutions
- `docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md`
- `docs/solutions/patterns/critical-patterns.md` (Pattern 1: Single Source of Truth for Business Logic)

---

## Problem Statement

1. **Inverted Responsibility:**
   The "Pantry Items Lacking Store Products" check iterates over all pantry items in Firestore and flags any staple lacking a linked Tesco product. This inverts the true user workflow: recipe ingredients are what need linking to Master Pantry catalog records (which the Recipe Mapping Audit already comprehensively handles).
2. **Artificial Household Busywork:**
   Common staples (*Milled Flax Seed Mix*, *Sherry*, *Dried Penne*, spices) are perpetually flagged with an "Action Required" badge, forcing the household to either import Tesco products or click "Ignore".
3. **No Downstream Value:**
   No calculation (macros, nutrition, meal planning, or recipe scaling) depends on this check. Removing it eliminates noise, declutters the Data Health Centre, and lets users focus on real data integrity items (duplicates, orphans, macro drift, active plan sync).

---

## Proposed Changes

### 1. Update `src/services/DataQualityScanner.js`
- Retire the `unmappedItems` loop (lines 405–424).
- Keep `unmappedItems: []` in the initial `results` and `scanDataQualitySummary` return objects for backwards compatibility with any remaining consumers.

### 2. Update `src/views/DataQualityTableRenderService.js`
- Remove the "Pantry Items Lacking Store Products" card rendering block (lines 380–392).
- Remove `audit.unmappedItems.length` from the `gaps` calculation.
- Remove the `unmapped-link`, `unmapped-tesco`, and `unmapped-ignore` action click handlers.
- Remove or retain a no-op shim for `handleIgnoreStoreMapping`.

### 3. Update `src/views/DataQualityView.js`
- Keep `handleIgnoreStoreMapping` export as a benign no-op if called from `window.handleIgnoreStoreMapping`.

### 4. Update Automated Tests
- In `scripts/test_data_quality_wizards.js`, update Test 6 to verify that `unmappedItems` generates 0 noisy alerts and that the Data Quality Centre remains cleanly focused on actionable issues.

---

## Acceptance Criteria
- [x] "Pantry Items Lacking Store Products" card is removed from the Data Quality Centre UI.
- [x] Scanning total count and health score are no longer penalized by unmapped pantry staples.
- [x] Recipe Mapping Audit remains the single source of truth for unlinked recipe ingredients.
- [x] `node scripts/test_data_quality_wizards.js` passes 100%.
- [x] `npm run build` succeeds cleanly.
