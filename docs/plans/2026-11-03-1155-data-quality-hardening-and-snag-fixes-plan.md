---
title: Data Quality Centre Hardening, Recalibration Bug Fix & Orphan Resolver Polish
type: fix
date: 2026-11-03
topic: data-quality-centre-hardening
---

# Plan: Data Quality Centre Hardening, Recalibration Bug Fix & Orphan Resolver Polish

> Created: 2026-11-03  
> Status: Implemented ✓  
> Author: Antigravity Pair Programming

## Summary

Following the initial deployment of the Data Health Centre and interactive resolution wizards, live testing revealed 5 specific snags and operational bottlenecks:
1. **Recalibration Disconnect**: `autoRecalibrateRecipeDrift` only checked `calDiff > 0.02`, while `runAudit` flags when *any* macro (calories, protein, carbs, fat) drifts by $>2\%$. This caused recipes whose calories drifted by $<2\%$ (e.g. 857 vs 856 kcal) but whose protein/fat drifted to silently fail to recalibrate when clicking `⚡ Recalibrate All`.
2. **Confusing Drift Summary**: The drift message only printed calories `(857 kcal stored vs 856 kcal calculated)`, giving the impression that 1 calorie was the cause of a $>2\%$ trigger.
3. **Orphan Products Missing Parent Ingredients**: Products referencing non-existent parent ingredient IDs (`no-ingredient`) were not properly supported by `SubtypeOrphanResolverModal.js`, which assumed an existing parent ingredient with a missing subtype.
4. **False Positive on Known Pantry Staples (`Sugar`)**: `UnitConversionService.js` maintains a built-in `DENSITY_TABLE` (`sugar: 0.85`, `flour: 0.5`, `rice: 0.8`, etc.). The scanner did not consult `findDensity()`, causing standard staples measured in volume to flag unnecessarily.
5. **Punitive Health Score & Ribbon Zero-States**: A flat deduction ($100 - \text{issues} \times 1.5$) rated a database with 96% integrity at an alarming $55\%$, while zero-count wizard buttons in the ribbon appeared active rather than completed.

---

## Acceptance Criteria

- [ ] **Macro Drift Alignment**: `autoRecalibrateRecipeDrift` recalibrates recipes if calories, protein, carbs, or fat drifted by $>2\%$, matching `runAudit`.
- [ ] **Transparent Drift Messaging**: The audit message explicitly identifies the drifted macro(s) (e.g. `Protein drifted: 42g stored vs 38g calc; Calories: 857 stored vs 856 calc`).
- [ ] **Dual-Mode Orphan Resolver**: `SubtypeOrphanResolverModal.js` supports resolving both:
  - `no-subtype`: Reassign to existing subtype, convert to parent default, or create new subtype.
  - `no-ingredient`: Select any existing pantry ingredient from a searchable dropdown, or delete the orphaned product.
- [ ] **Known Density Suppression**: `DataQualityScanner.js` checks `findDensity(name)` from `UnitConversionService.js`. If a standard density is known (such as sugar, flour, rice, oats), it is not flagged as a missing density factor.
- [ ] **Weighted Health Score**: The health score is calculated using severity-weighted deductions:
  $$\text{Score} = 100 - (\text{blockers} \times 4 + \text{gaps} \times 1 + \text{advisories} \times 0.3)$$
  Clamped between $0\%$ and $100\%$.
- [ ] **Ribbon Polish**: Action ribbon buttons with $0$ pending items are styled with muted opacity and display `(0 ✓)`.

---

## Implementation Steps

### Step 1: Fix `autoRecalibrateRecipeDrift` and Transparent Messages in `DataQualityScanner.js`
- In `autoRecalibrateRecipeDrift`:
  - Calculate `calDiff`, `protDiff`, `carbDiff`, and `fatDiff`.
  - Recalibrate and return `{ updated: true, recipe }` if *any* diff $> 0.02$.
- In `runAudit`:
  - Format the message to clearly highlight which macro(s) exceeded the $2\%$ threshold (e.g., `Prot: 42g stored vs 38g calc (+10.5%), Cal: 857 stored vs 856 calc`).
  - Import `findDensity` / check `findDensity(baseIng.name)` before flagging density mismatches.

### Step 2: Support `no-ingredient` Products in `SubtypeOrphanResolverModal.js`
- Expand `openSubtypeOrphanResolverModal` to detect whether `orphanIssue.type === 'no-ingredient'`:
  - If `orphanIssue.type === 'no-ingredient'`, find the affected product by `orphanIssue.productId`.
  - Render an ingredient assignment dropdown listing all ingredients in `state.ingredients`, alongside a `Delete Product` option.
  - Add save handler `handleResolveNoIngredientOrphan(productId, selectedIngId)` that updates the product via `ProductRepository.saveProduct` and re-renders the audit.

### Step 3: Polish Health Score & Action Ribbon in `DataQualityTableRenderService.js`
- Update health score computation to:
  ```js
  const blockers = audit.orphans.length;
  const gaps = audit.unmappedItems.length + audit.densityMismatch.length + audit.incompleteMacros.length + audit.planDesync.length;
  const advisories = audit.macroDrift.length;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (blockers * 4 + gaps * 1 + advisories * 0.3))));
  ```
- In the top action ribbon:
  - If count is 0, add `opacity: 0.6; filter: grayscale(0.5);` and append `✓`.

### Step 4: Verification & Automated Tests
- Extend `scripts/test_data_quality_wizards.js`:
  - Test macro drift recalibration when only protein/carbs drift.
  - Test known density suppression for Sugar.
  - Test weighted health score calculation.
  - Test `no-ingredient` orphan resolution flow.
- Run `npm run build` and `npm run ledger`.

---

## Technical Considerations & Risk Mitigation

- **Data Integrity**: Deleting or re-linking products in `SubtypeOrphanResolverModal.js` writes to Firestore under `households/elliott-chloe/products/{id}`.
- **Backwards Compatibility**: Existing `no-subtype` resolution remains completely intact and undisturbed.
- **Performance**: `findDensity` performs a fast substring lookup over a tiny 10-key dictionary, adding 0 overhead to the audit scan.
