# Plan: Auto-Populate Search Menu Field Upon Pantry Bank Item Creation

**Date**: 2026-11-03
**Status**: Ready for Plan-Review
**Target Branch**: `dev/recipe-bulk-parse-instruction-fix`

---

## 1. Problem Statement & Root Cause Analysis

When a user in **Recipe Mapping Audit** (or Recipe Wizard / Unlinked Sweeper) searches for an item and triggers **"✨ Create New Item"**:
1. The master hub modal (`AddToBankHubUI.js`) opens with 4 tiles: Category, Root Item, Sub-Type, Product.
2. Clicking any tile launches the 4-tier creation wizard (`AddItemWizardUI.js`).
3. **Core Blocker 1 (Rigid Product Requirement)**: `AddItemWizardUI.js` currently forces every pathway through all steps down to "Link Store Product". It provides NO "Finish & Save" button on Step 1 (Category or Root Item), Step 2 (Root Item or Sub-Type), or Step 3 (Sub-Type). On the final product step, if `productMode === 'manual'`, the footer renders an empty `<div></div>` with only "Open Full Product Form ➔". If the user is mapping an ingredient and doesn't want or have a 15-field store barcode product, they are trapped. Cancelling or closing wipes `window.__onHierarchyComplete`.
4. **Core Blocker 2 (DOM & Event Desynchronization in `RecipeAuditModal.js`)**: In `RecipeAuditModal.js`, the completion handler relied solely on `searchInst && searchInst.inputEl`. It did not fallback to direct DOM element lookup `mountEl.querySelector('.wiz-ing-tax-search')`, did not set `setAttribute('value', displayLabel)`, and did not dispatch DOM `input`/`change` events to ensure browser inputs update their rendered value and notify any parent listeners.
5. **Core Blocker 3 (Flexible Atomic Commits)**: `commitAtomicChain` in `PantryTaxonomyService.js` natively supports commits with or without a product payload (and Category-only). `AddItemWizardUI.js` was not exposing this capability, preventing users from creating items or categories directly.

---

## 2. Proposed Changes

### A. `src/components/pantry/AddItemWizardUI.js`
- **Add "Finish & Save to Bank" button at each stage**:
  - **Category mode (Step 1)**: User can click "Finish & Save Category" immediately without being forced to create dummy items, or click "Next: Add Item ➔".
  - **Root Item mode (Step 1 or 2)**: User can click "Finish & Link to Bank" on Step 1 (saving Root Item + Category) or Step 2 (saving Root Item + Sub-Type) without requiring a product.
  - **Sub-Type mode (Step 1 or 2)**: User can click "Finish & Link to Bank" on Step 2 after entering the variant name.
  - **Product Step (Final Step)**: Support:
    1. "Finish without Product" (or "Finish & Link to Bank") directly in the wizard footer without forcing the full 15-field product modal.
    2. "Existing Product": links selected existing product.
    3. "Full Product Editor": opens full form with pre-filled hierarchy.
- **Implement atomic commit on Finish at any step**:
  - When the user clicks "Finish & Link to Bank" at any step, call `commitAtomicChain` with the data collected up to that step.
  - Cleanly invoke `cb = onComplete || window.__onHierarchyComplete`, pass the created hierarchy payload, and close the wizard.

### B. `src/components/recipe/RecipeAuditModal.js`
- **Robust Auto-Population Handler**:
  - In `onNewClick(typedName)`, query both `mountEl.querySelector('.wiz-ing-tax-search')` and `searchInst?.inputEl`.
  - Handle all 3 creation levels:
    - **Category**: `val = cat:<categoryName>`, label = `📂 [Category] <categoryName>`, `mountEl.dataset.selectedId = cat:<categoryName>`, `mountEl.dataset.selectedSubId = ''`.
    - **Sub-Type / Variant**: label = `🏷️ <subName> (<parentName>)`, `mountEl.dataset.selectedId = <ingId>`, `mountEl.dataset.selectedSubId = <subId>`.
    - **Root Item**: label = `📦 <parentName>`, `mountEl.dataset.selectedId = <ingId>`, `mountEl.dataset.selectedSubId = ''`.
  - Update `inputEl.value = displayLabel`, `inputEl.setAttribute('value', displayLabel)`, `inputEl.dataset.taxVal = ...`.
  - Apply green success styling (`borderColor = '#10b981'`, `backgroundColor = '#ecfdf5'`, `color = 'var(--text,#1e293b)'`).
  - Dispatch `'input'` and `'change'` events on `inputEl`.

### C. `src/components/recipe/RecipeWizardTaxonomySearch.js` & `src/components/data-quality/UnlinkedSweeperUI.js`
- Update `onComplete` in `RecipeWizardTaxonomySearch.js` and `UnlinkedSweeperUI.js` with the same Category / Root Item / Sub-Type awareness and DOM event dispatching to ensure universal consistency across all search inputs in the application.

---

## 3. Verification & Test Plan
1. **Automated Suite**: Run `node scripts/test_data_quality_wizards.js`.
2. **Build Verification**: Run `npm run build` to verify dist build and zero placeholder issues.
3. **Manual Simulation Verification**:
   - Verify Category creation from search field auto-populates `📂 [Category] ...`.
   - Verify Root Item creation with "Finish & Link to Bank" on Step 1 / Step 2 auto-populates `🏷️ Standard (...)` or `📦 ...`.
   - Verify Sub-Type creation auto-populates `🏷️ <variant> (<parent>)`.
   - Verify full product form completion auto-populates search field and retains `dataset.selectedId` and `dataset.selectedSubId`.
