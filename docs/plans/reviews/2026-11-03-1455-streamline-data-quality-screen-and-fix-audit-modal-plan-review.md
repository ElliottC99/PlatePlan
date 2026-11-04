# Plan Review: Streamline Data Quality Screen and Fix Audit Modal New Item Creation

> Date: 2026-11-03  
> Plan: `docs/plans/2026-11-03-1455-streamline-data-quality-screen-and-fix-audit-modal-plan.md`  
> Verdict: **READY FOR EXECUTION (Approved ✓)**

---

## 1. Quality & Completeness Check
- **Scope & Boundaries:** Explicitly defines which two cards are being retired from the UI (Cards 7 and 8) while preserving essential background data health operations (silent auto-prune of legacy preferences).
- **Targeted Root Cause Fixes:** Directly addresses the missing `onNewClick` in `RecipeAuditModal.js` and corrects the sequence jump in `DataQualityTableRenderService.js` (`startAt: 'product'` ➔ `startAt: 'category'`).
- **Architectural Alignment:** Complies with PlatePlan's 4-tier taxonomy standard (`Category ➔ Root Item ➔ Sub-Type ➔ Product`) and UI Standard (Searchable Autocomplete Over `<select>` Dropdowns).

## 2. Multi-Order & Edge Case Analysis
- **1st Order:** Users clicking "+ Create New Item" in `RecipeAuditModal` will immediately be guided through the 4-tier Pantry Bank process, and their choice will automatically link and populate the card.
- **2nd Order:** Users clicking "Link Product" from the Data Health Centre will experience the identical, predictable 4-step sequence as the rest of the application without confusing jumps to sub-types.
- **3rd Order:** The Data Health Centre UI becomes cleaner, focused, and free of duplicate counts and broken buttons calling legacy code.
- **Data Integrity:** No data is destroyed; silent auto-prune of bloated legacy fields remains intact in code without bothering the user.

---

## Verdict & Recommendation
Approved. Ready to implement.
