# Plan Review: Wizard Enhanced Data Loading, Step 3 Product Mapping & Enforcing Taxonomy-Only Ingredient Mapping

**Date:** 2026-11-03  
**Status:** Approved  

## Review Criteria Assessment

1. **Problem Analysis & Coverage**:
   - Addresses user's key architectural finding: ingredients in PlatePlan must strictly map to taxonomy nodes (`categories`, `root items`, or `sub-types`), never directly to individual products. The product is always determined by the active **Auto-Default Product**.
   - Removes direct `prod:` mapping and `Products (Pantry)` section from `RecipeWizardTaxonomySearch.js`.
   - Adds helpful informational auto-default product badges in the taxonomy dropdown (e.g. `📦 Beef Mince [Meat Substitutes] → Default: Quorn Mince`) so the user sees the resolved product while maintaining clean taxonomy linkage.
   - Solves Test 4 ReferenceError (`routeNavHtml is not defined` in `RecipeEnhancementModalUI.js`).
   - Solves Test 2 ingredient shadowing in `RecipeWizardModal.js` where `found.ingredientSections` masked `found.enhanced.ingredients`.
   - Solves dual-profile macro drift in `renderMacroBreakdownCrossbar` by reading directly from `calculateMealFitScore(..., { portionScaled: true })`.
   - Solves Step 3 display by showing the taxonomy link and auto-default product with the "Mapped" badge, and reinstates the Fit Score badge in the Step 3 header.

2. **Systemic & Architectural Consistency**:
   - Conforms with `docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md` and `docs/solutions/logic-errors/auto-default-strategy-and-recipe-macro-recalibration-20261102.md`.
   - Preserves single source of truth for calculations and adheres strictly to `AGENTS.md` (no bundler, browser ES modules).

3. **Risk & Safety**:
   - Removing direct product selection prevents taxonomy fragmentation and ensures that changing an auto-default product in the pantry properly flows into recipe recalculations.
   - Enhanced variant initialization fix guarantees that enhanced ingredient quantities and ingredients (e.g. Quorn Mince, 7.5ml oil) are loaded instead of being overwritten by base original ingredients.

4. **Recommendation**:
   - Plan is Approved. Ready to proceed to `/work`.
