---
title: Streamline Data Quality Screen and Fix Audit Modal New Item Creation
type: refactor
date: 2026-11-03
topic: data-quality-streamlining
---

# Streamline Data Quality Screen and Fix Audit Modal New Item Creation

> Created: 2026-11-03  
> Status: Implemented ✓

## Summary
Removes redundant and duplicative cards from the Data Quality Centre ("Incomplete Macro Specifications" and "Database Payload Health Warning") to eliminate noise and broken action buttons. Fixes the non-functioning "+ Create New Item" trigger in the Recipe Mapping Audit modal by supplying `onNewClick` to `createTaxonomySearchInput`. Aligns the "Link Product" action to the canonical 4-tier Pantry Bank sequence (`startAt: 'category'`) so users never experience unexpected skips directly to sub-types.

---

## Prior Solutions
- `docs/solutions/logic-errors/atomic-hierarchy-staging-and-pantry-taxonomy-enforcement-20261031.md`
- `docs/solutions/logic-errors/recipe-wizard-taxonomy-auto-default-hierarchy-and-variant-isolation-20261103.md`

---

## Problem Statement

1. **Broken "+ Create New Item" in Recipe Mapping Audit:**
   In `RecipeAuditModal.js`, `createTaxonomySearchInput` lacks an `onNewClick` callback. Clicking `✨ Create New Item "Corn Tortillas" ➔` closes the dropdown and does nothing.

2. **Sequence Mismatch on "Link Product":**
   Clicking `[Link Product]` in the Data Quality table calls `openAddItemWizard({ startAt: 'product' })`. In `AddItemWizardUI.js`, `startAt: 'product'` jumps straight to an unscoped sub-type search screen, bypassing Category and Root Item and violating the canonical 4-tier Pantry Bank sequence.

3. **Duplicative "Incomplete Macro Specifications" Card:**
   Ingredients derive macros from their Auto-Default Product. Ingredients without products are already caught by "Pantry Items Lacking Store Products". Flagging them again under "Incomplete Macro Specifications" is redundant, and its button calls a deleted legacy function `window.editIng()`.

4. **Redundant "Database Storage Health Warning" Card:**
   Preferences bloat is already silently auto-pruned in the background by code on render. Presenting a technical card with `Clean History Cache` is unnecessary developer clutter.

---

## Proposed Changes

### 1. Fix "+ Create New Item" in `RecipeAuditModal.js`
- Import `openTaxonomyCreationModal` from `./RecipeWizardTaxonomyModal.js`.
- Add `onNewClick` to `createTaxonomySearchInput`:
  ```javascript
  onNewClick: (typedName) => {
    openTaxonomyCreationModal({
      initialName: typedName || mountEl.dataset.originalName || '',
      onComplete: (created) => {
        if (!created) return;
        const parentName = created.parentName || created.rootItem?.name || typedName;
        const subName = created.subtypeName || created.subtype?.name || 'Standard';
        const ingId = created.ingredientId || created.rootItem?.id;
        const subId = created.subtypeId || created.subtype?.id;
        mountEl.dataset.selectedId = ingId;
        mountEl.dataset.selectedSubId = subId;
        if (searchInst?.inputEl) {
          searchInst.inputEl.value = `🏷️ ${subName} (${parentName})`;
        }
      }
    });
  }
  ```

### 2. Standardize "Link Product" Sequence in `DataQualityTableRenderService.js`
- Update `unmapped-link` to launch `openAddItemWizard` with `startAt: 'category'` and pre-filled parameters:
  ```javascript
  m.openAddItemWizard?.({
    startAt: 'category',
    parentId: ingId,
    itemName: ing?.name,
    category: ing?.category || 'General',
    onComplete: () => renderDataQualityView()
  });
  ```
  This preserves the canonical 4-step hierarchy without jumping straight to sub-types.

### 3. Safely Remove Redundant Cards in `DataQualityTableRenderService.js` and `DataQualityScanner.js`
- In `DataQualityTableRenderService.js`:
  - Remove Card 7: "Incomplete Macro Specifications".
  - Remove Card 8: "Database Storage Health Warning" (while keeping the background silent auto-prune logic).
  - Update `gaps` calculation to exclude `incompleteMacros.length`.
- In `DataQualityScanner.js`:
  - Deprecate or remove `incompleteMacros` from active audit count so it does not skew the health score.

---

## Acceptance Criteria
- [x] In Recipe Mapping Audit, clicking `✨ Create New Item "[name]" ➔` opens the 4-tier Pantry Bank creation wizard.
- [x] Finishing the wizard updates the audit card with the newly created entity and permits immediate 1-click **Save & Fix**.
- [x] In Data Quality Centre, clicking `[Link Product]` begins at Step 1 (Category) with known data pre-filled, following the identical 4-step sequence as the rest of the application.
- [x] Redundant "Incomplete Macro Specifications" and "Database Storage Health Warning" cards are removed from the Data Quality Centre.
- [x] `node scripts/test_data_quality_wizards.js` passes 100%.
- [x] `npm run build` succeeds cleanly.
