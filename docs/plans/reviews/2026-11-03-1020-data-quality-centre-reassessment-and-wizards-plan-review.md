# Plan Review: Data Quality Centre Reassessment, Audit Consolidation & Guided Resolution Wizards

> **Date:** 2026-11-03  
> **Plan Reviewed:** `docs/plans/2026-11-03-1020-data-quality-centre-reassessment-and-wizards-plan.md`  
> **Status:** Approved ✓ (Ready for /work)  
> **Reviewer:** Antigravity Multi-Perspective System

---

## 1. Executive Assessment & Verdict

| Review Criterion | Status | Notes |
|---|---|---|
| **Problem Specificity** | PASS | Identifies exact broken UI line (line 232 in `DataQualityTableRenderService.js`) and the 262 false-alarm density warnings. |
| **User Steers Incorporated** | PASS | Strictly aligns with Option A for density warnings, macro recalibration wizard, and duplicate merge wizard. |
| **Architectural Tenets** | PASS | Consolidates parallel scanners into single canonical owner `src/services/DataQualityScanner.js` (per `plateplan-architecture.md`). |
| **Data Safety & Cascade** | PASS | Validates cascading merges across `recipes`, `products`, and `plans` without orphaned foreign keys. |
| **Verification Strategy** | PASS | Dedicated test script `scripts/test_data_quality_wizards.js` asserting real rules against mock and flattened data. |

**Verdict**: **READY FOR EXECUTION (`/work`)**.

---

## 2. Deep Gap Analysis & Mitigations

### Gap 1: Duplicate Ingredient Merge Cascade (2nd Order Effects)
- **Risk**: If ingredient $B$ is merged into ingredient $A$, any product whose `ingredientId === B.id` must be re-pointed to $A.id$. Any recipe ingredient with `ingredientId === B.id` must be re-pointed to $A.id$.
- **Mitigation**: `batchMergeIngredientsInDb` in [`RootItemRepository.js`](file:///Users/elliottcallender/Downloads/PlatePlan-main/src/services/RootItemRepository.js) already supports atomic writes across `recipes`, `products`, and `ingredients`. The wizard must pass all affected entity IDs into this atomic transaction and verify that the target ingredient retains all unique subtypes from both items.

### Gap 2: Liquid Density Filtering (Edge Cases)
- **Risk**: Some items might be labeled "ml" in recipes but are not in `LIQUID_WORDS` (e.g. "5 ml honey", "10 ml curry paste").
- **Mitigation**: `UnitConversionService.js` includes `honey`, `syrup`, `sauce`, `dressing`, etc. Furthermore, if the ingredient's linked default product has `packUnit === 'ml'` or `packUnit === 'l'`, it is intrinsically a liquid and must be exempted from density warnings.

### Gap 3: Orphan Resolver Modal Choices
- **Risk**: When resolving an orphaned product (e.g. `Protein Boost Sliced Bagels` whose subtype `sub_1791038085297` was deleted), reassigning it to root default must clear `subtypeId` to avoid resurrecting the orphan warning.
- **Mitigation**: `SubtypeOrphanResolverModal.js` must explicitly set `subtypeId: null` when reassigning to parent root default.

---

## 3. Implementation Order & Verification Gate

1. **Phase 1: Scanner Consolidation & Density Noise Elimination**
   - Update `src/services/DataQualityScanner.js` to absorb `DataQualityEngine.js` and `DataQualityScannerService.js`.
   - Implement liquid check and ingredient grouping.
   - Run `node -e "..."` audit verification to confirm issues drop from 289 to ~27 genuine items.
2. **Phase 2: Event Delegation & UI Re-architecture**
   - Wire up delegated click listener on `#view-data` in `src/views/DataQualityTableRenderService.js`.
   - Render top KPI Health Score and quick wizard launch buttons.
3. **Phase 3: Wizard Modernization & Polish**
   - Polish `MergeIngredientsModal.js`, `MacroDriftPreviewModal.js`, and `SubtypeOrphanResolverModal.js`.
4. **Phase 4: Dead Code Quarantine & Ledger**
   - Move `DataQualityDrawer.js` and `DataQualityFixModal.js` to `attic/`.
   - Update `plateplan-architecture.md` and run `npm run ledger`.
5. **Phase 5: Automated Test Suite**
   - Execute `node scripts/test_data_quality_wizards.js`.
   - Rebuild production bundle with `npm run build`.
