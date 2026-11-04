---
title: Data Quality Modals Batch Resolve and Dropdown Clipping Fixes
type: fix
date: 2026-11-03
topic: data-quality-modals-batch-resolve-and-clipping-fixes
---

# Data Quality Modals Batch Resolve and Dropdown Clipping Fixes

> Created: 2026-11-03  
> Status: Implemented ✓  

## Summary
Resolve three targeted user-experience and workflow bottlenecks in the Data Health Centre:
1. **Resolve Orphans Modal**: Enable viewing, reassigning, or deleting **all** broken product links simultaneously in a single modal screen (rather than forcing the user to re-open the modal for each product individually), and eliminate dropdown clipping so autocomplete results are clearly visible.
2. **Unlinked Sweeper Modal**: Fix autocomplete dropdown clipping by widening the dialog, providing generous clearance, and prioritizing Master Items and Sub-Types over redundant category headers.
3. **Recipe Mapping Audit Feedback**: Fix toast visibility by elevating toast `z-index` above modals (from `10000` to `999999`), and add clear inline status feedback explaining that 291 confident items were auto-fixed and the remaining 35 items require manual review.

---

## Problem Statement

### 1. Test 1 (Resolve Orphans): Single-Item Constraint & Dropdown Clipping
- Currently, `DataQualityTableRenderService.js` line 87 calls `openSubtypeOrphanResolverModal(audit.orphans[0])`, passing only the first orphan. Clicking a row's "Resolve Links" button also only loads that single product.
- When the modal opens, only 1 product is shown. The user must resolve product 1, click commit, wait for the modal to close, find the next orphan row, click "Resolve Links" again, and repeat.
- Furthermore, the table container inside the modal had `overflow-y: auto`, causing the search dropdown (`position: absolute; top: 100%`) to be cut off at the bottom of the container.

### 2. Test 2 (Unlinked Sweeper): Dropdown Clipping & Narrow Layout
- The dialog container in `UnlinkedSweeperUI.js` had `overflow: hidden` and `#sweeper-list-container` had `overflow-y: auto` with zero bottom padding.
- Search input containers were constrained to `max-width: 320px`. When typing, the dropdown immediately collided with the bottom edge of the container.
- Additionally, the search dropdown listed 10+ category folders (`📂 [Category] Store Cupboard`) before any pantry items, burying the actual item/sub-type matches.

### 3. Test 3 (Recipe Mapping Audit): Hidden Toasts & Unclear Remaining Status
- The previous atomic batch fix successfully fixed 291 issues, dropping the count from 326 to 35.
- However, `AppInitializer.js` renders toasts with `z-index: 10000`, while `RecipeAuditModal` uses `z-index: 99999`. The success toast rendered *behind* the modal overlay, making it invisible.
- When clicking "Auto-Fix" when only low-confidence issues remain, no visible feedback was displayed.

---

## Acceptance Criteria
- [ ] **Multi-Orphan Modal**: Opening the Resolve Orphans modal (from the ribbon button or any orphan card row) displays **all** orphaned products in the database simultaneously.
- [ ] **1-Click Commit**: The user can assign valid sub-types or mark products for deletion across multiple items in the same modal and commit them in a single operation.
- [ ] **No Dropdown Clipping**: Autocomplete dropdowns in both `SubtypeOrphanResolverModal` and `UnlinkedSweeperUI` render with full clearance and high z-index without being clipped by table or dialog containers.
- [ ] **Pantry-Focused Sweeper Search**: Unlinked Sweeper search prioritizes Master Items and Sub-Types with clear badges, omitting misleading category folders.
- [ ] **Toast Visibility**: `AppInitializer.js` toasts are elevated to `z-index: 999999` so they appear on top of all modals.
- [ ] **Audit Feedback**: `RecipeAuditModal` provides clear inline feedback and toast indicators regarding confident fixes and remaining manual items.
- [ ] **Regression Testing**: All test suites pass (`node scripts/test_data_quality_wizards.js`) and build succeeds (`npm run build`).

---

## Technical Approach & Implementation Steps

### Step 1: Elevate Global Toast Z-Index in `AppInitializer.js`
- In `src/core/AppInitializer.js` line 18, change `z-index: 10000;` to `z-index: 999999;`.
- Ensure toasts always float above any modal dialog or backdrop (`z-index: 9999` or `99999`).

### Step 2: Multi-Item Batch Support & Styling in `SubtypeOrphanResolverModal.js`
- Modify `openSubtypeOrphanResolverModal(orphanIssue = {})`:
  - Fetch all orphans from `runAudit(state).orphans` when `orphanIssue` is not a single product or when opened via ribbon.
  - If a specific `orphanIssue.productId` is passed, sort that product to the top, but still include all other orphaned products so the user can resolve everything in one sitting.
  - Expand modal card to `max-width: 800px; min-height: 520px;`.
  - Remove container clipping: give `#subtype-orphan-resolver-modal` and its table container generous clearance (`min-height: 380px; padding-bottom: 200px;` and `overflow: visible;` or styled scroll box).
  - Support multi-parent persistence in `RootItemRepository.js` if products belong to different parent ingredients.

### Step 3: Improve `UnlinkedSweeperUI.js` Layout & Search
- Expand `.sweeper-dialog` to `max-width: 860px; min-height: 540px;`.
- Add `padding-bottom: 260px;` to `#sweeper-list-container`.
- Set focused row `z-index: 50; position: relative;` when search input is focused, so its dropdown overlays subsequent rows cleanly.
- Refactor `renderFilteredOptions`:
  - Remove Category folders from unlinked ingredient matching.
  - Display Master Items and their Sub-Types directly with clear visual separation.
  - Retain the `✨ New Item` option at the top.

### Step 4: Add Inline Status & Feedback in `RecipeAuditModal.js`
- In `RecipeAuditModal.js`:
  - When confident issues are 0 and total issues > 0: update button to show `✓ Confident Matches Auto-Fixed` and show an informational banner indicating that remaining 35 items require manual review.
  - When auto-fix completes, update the modal immediately and display the toast with full visibility.

### Step 5: Verification & Testing
- Run `node scripts/test_data_quality_wizards.js`.
- Run `npm run build`.
- Verify dev server output and verify no console errors.
