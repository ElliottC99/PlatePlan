# Plan Quality Review: Data Quality Centre Hardening, Recalibration Bug Fix & Orphan Resolver Polish

> **Reviewed Plan**: `docs/plans/2026-11-03-1155-data-quality-hardening-and-snag-fixes-plan.md`  
> **Review Date**: 2026-11-03  
> **Reviewer**: Antigravity Quality Gate  
> **Verdict**: **APPROVED ✓ (Ready for /work)**

---

## 1. Executive Summary

This review assesses the hardening plan created in response to live user testing of the newly consolidated Data Quality Centre. The plan addresses 5 high-impact snags:
1. Resolving the silent failure in `autoRecalibrateRecipeDrift` where recipes with non-calorie drift (protein/carbs/fat) failed to update.
2. Providing transparent messaging for macro drift so users know exactly why a recipe was flagged.
3. Enabling `SubtypeOrphanResolverModal.js` to handle products whose parent ingredient does not exist in the database (`no-ingredient`).
4. Suppressing known density false positives for staples like Sugar by consulting `UnitConversionService.js`.
5. Recalibrating the health score formula to use severity-weighted deductions and polishing ribbon zero-states.

The plan is tightly scoped, addresses real runtime issues, maintains architectural integrity, and includes automated verification.

---

## 2. Completeness & Rigor Checklist

### Requirements & Scope
- [x] **Specific Problem Statements**: Each of the 5 issues is precisely traced to root cause lines in code.
- [x] **Measurable Acceptance Criteria**: Clear conditions for drift recalibration, orphan handling, density suppression, and health score math.
- [x] **Scope Boundaries**: Focuses purely on hardening the Data Quality view, modals, and scanner without touching unrelated modules.

### Architectural & Pattern Compliance
- [x] **Single Source of Truth**: Preserves `DataQualityScanner.js` as the canonical audit owner.
- [x] **No Bundler / ES Modules**: Adheres strictly to native ES modules and repository standards.
- [x] **Reuse of Existing Utilities**: Reuses `findDensity` / `DENSITY_TABLE` from `UnitConversionService.js` rather than duplicating density values.
- [x] **Safe Persistence**: Writes products strictly via `ProductRepository.js` and `saveProduct`.

### Deep Analysis & Multi-Order Thinking
- [x] **1st Order**: Fixes drift recalibration, orphan linking for products with missing parents, and removes false density alarms.
- [x] **2nd Order**: Fixes health score perception so users see realistic progress (e.g. 88% -> 100%) as they resolve items.
- [x] **3rd Order**: Prevents orphan products from breaking recipe wizard or pantry views by giving users a direct path to link them to valid ingredients.
- [x] **Edge Cases**: Handles products with neither `ingredientId` nor `subtypeId`, ingredients with missing macros, and multi-macro drift.

---

## 3. Review Findings & Directives for `/work`

1. **Drift Recalibration**: Ensure `autoRecalibrateRecipeDrift` returns `{ updated: true, recipe }` whenever `calDiff > 0.02 || protDiff > 0.02 || carbDiff > 0.02 || fatDiff > 0.02`. In `runAudit`, format the message to show both the primary drifting macro and calories.
2. **Orphan Products**: For `no-ingredient` products, ensure `SubtypeOrphanResolverModal.js` displays a clean `<select>` of all pantry ingredients sorted alphabetically, with an option to Delete the product from the catalog.
3. **Density Table**: In `DataQualityScanner.js`, ensure `findDensity` is imported from `UnitConversionService.js` (or export it if not currently exported) so staples like Sugar, Rice, Flour, and Oats are skipped.
4. **Health Score**: Apply severity weights: Blockers -4%, Gaps -1%, Advisories -0.3%.

---

## 4. Final Verdict

**Status: Approved ✓**  
Proceed directly to execution via `/work`.
