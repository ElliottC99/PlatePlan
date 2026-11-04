# Plan Review: Data Quality Modals Batch Resolve and Dropdown Clipping Fixes

> Review Date: 2026-11-03  
> Plan: `docs/plans/2026-11-03-1300-data-quality-modals-batch-resolve-and-clipping-fixes-plan.md`  
> Reviewer: Antigravity  
> Verdict: **Ready to Proceed (Approved)**

---

## 1. Completeness & Scope Checks
- **Problem Statement**: Accurately reflects all three user findings:
  1. Test 1 single-item limitation and search result clipping.
  2. Test 2 sweeper dropdown clipping and category crowding.
  3. Test 3 toast z-index hiding behind modal overlay and remaining 35 low-confidence items.
- **Scope Boundaries**: Strictly focused on the Data Health Centre wizards and global toast visibility. No changes to core schema or unrelated components.
- **Architectural Alignment**:
  - Follows PlatePlan taxonomy rule: products link strictly to valid Sub-Types.
  - Follows PlatePlan writer rules: all persistence remains strictly under `households/elliott-chloe/` and uses existing repositories.
  - Avoids native dialogs: respects `DialogHelpers.js`.

---

## 2. Technical Risk & Gap Analysis
- **Multi-Parent Persistence**: If products being resolved in the batch have different parent ingredients, saving only 1 parent would leave the other unpersisted.
  - *Mitigation*: In `RootItemRepository.js`, accept an array or map of parent ingredients and save all modified parents via `Promise.all(parents.map(p => saveCanonicalRootItem(p)))`.
- **CSS Stacking Context**: If table rows or dialog containers have `overflow: hidden`, dropdowns with `position: absolute` are clipped.
  - *Mitigation*: Ensure container has `overflow: visible` or has generous `min-height` with `padding-bottom: 260px;` and `z-index: 1050;` on the dropdowns.
- **Toast Stacking**: With toasts at `z-index: 999999;`, toasts will now cleanly overlay modal dialogs (`z-index: 99999`), preventing silent feedback failures.

---

## 3. Verification Strategy
- [x] Run `node scripts/test_data_quality_wizards.js` to ensure scanner, orphan resolution, and sweeper mappings run cleanly.
- [x] Run `npm run build` to verify syntax, bundling, and version integrity.
- [x] Provide precise testing instructions for the user in the browser.

---

## Verdict
**Approved.** Proceed directly to implementation via `/work`.
