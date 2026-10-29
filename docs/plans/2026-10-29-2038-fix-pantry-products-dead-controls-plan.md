---
title: Pantry and Products Dead Controls - Plan
type: fix
date: 2026-10-29
topic: pantry-products-dead-controls
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Pantry and Products Dead Controls - Plan

## Goal Capsule

- **Objective:** On the Pantry and Product Bank screens, every control Elliott can see either does what it says or is gone. In particular, he can attach products to a sub-type in any of the three offered ways.
- **Means:** Wire each dead control through ActionBridge's named routes, build the missing Tesco update, remove the unwired legacy block, and add a test that stops these two screens regressing.
- **Product authority:** Elliott owns the app's behaviour. Barrie relayed his answers in the 2026-10-29 brainstorm. This work covers Pantry first, per Barrie's standing priority. Active Stock (a hidden tab) and other screens' dead controls are not active scope.
- **Open blockers:** None.

## Product Contract

### Summary

Every visible control on the Pantry and Product Bank screens is fixed or removed:
- Link Product's three routes open the existing-product picker, the product form, or the Tesco import, already linked to the sub-type.
- The header's Import Tesco opens the import.
- Every dialog's Cancel closes the dialog.
- "Paste/update from Tesco" fills the open product form from a Tesco paste.
- The old filter block under the product list is removed.

A test fails whenever Pantry or Products code wires a control to something that doesn't exist.

### Problem Frame

A static scan of `development` at `652d279`, plus Barrie's checks on a phone, found these controls doing nothing:
- the Link Product options and their Cancel;
- the Product Bank header's "Import Tesco";
- Cancel in the Tesco import, existing-product picker and Reallocate dialogs;
- "Paste/update from Tesco" in the product form.

There's also a block of old filters under the product list. Most of them call functions through `window.X` behind a silent check, or through `data-pp-click`, neither of which works any more. So a tap does nothing and shows no error. Elliott can't attach products to sub-types from the Pantry, and the dead buttons look like bugs. Product Save and Cancel had the same cause and were fixed in 3.48.1.

### Key Decisions

- **All three Link Product routes stay and work.** (session-settled: user-directed — chosen from link-existing, add-manually and import-from-Tesco, with any route not chosen to be removed; all three were chosen.) Governs R1, R2, R3, R4.
- **"Paste/update from Tesco" is built, not removed.** (session-settled: user-directed — chosen over removing the button.) Governs R7, R8.
- **The old filter block is removed, not reconnected.** (session-settled: user-approved — chosen over bringing back the chips and sort on the working list.) Governs R10.
- **A guard test covers these two screens only.** (session-settled: user-directed — chosen over a fixes-only change with no guard.) Governs R11.
- **Active Stock is decided separately.** (session-settled: user-approved — chosen over including the hidden Active Stock tab in this work.) See Scope Boundaries.

### Requirements

**Link Product (Pantry › sub-type › Link Product)**

- R1. "Link existing product" opens the existing-product picker for that sub-type, and picking a product links it to the sub-type.
- R2. "Add product manually" opens the product form already linked to that sub-type, so Save stores the new product on it.
- R3. "Import from Tesco" opens the Tesco import already linked to that sub-type, so the imported product is saved on it.
- R4. Cancel closes the Link Product dialog without changing anything.

**Tesco import and other dialogs**

- R5. The Product Bank header's "Import Tesco" opens the Tesco import, not linked to any sub-type, the same as the empty-state button.
- R6. Cancel closes the dialog, with nothing saved, in each of the Tesco import, the existing-product picker and the Reallocate product dialog.

**Paste/update from Tesco (Edit product form)**

- R7. "Paste/update from Tesco" lets Elliott paste a Tesco link or page text into the open product form. The form's fields update from it, using the same Tesco parsing as the import dialog.
- R8. Fields the paste doesn't contain keep their current values, and nothing is saved until Save.
- R9. When the paste can't be read as a Tesco product, the form says so and stays unchanged.

**Product Bank layout**

- R10. The old block under the product list is removed: the category chips, the ingredient search, the sort menu, the second search box and the empty list area. The working search and category grouping above it are unchanged.

**Guard**

- R11. A test fails when any control in Pantry or Products code uses `data-pp-*`, calls a `window` function that nothing defines, uses an inline handler that calls a missing function, or uses a `data-action` that nothing routes.

### Acceptance Examples

- AE1. Covers R1. From Pantry › Bread › Seeded › Link Product › "Link existing product", Elliott picks an existing loaf. It now shows under Seeded.
- AE2. Covers R2. From Link Product › "Add product manually", he fills in a name and taps Save. The new product appears under Seeded.
- AE3. Covers R3. From Link Product › "Import from Tesco", he pastes a Tesco product and reviews it. The product saves under Seeded.
- AE4. Covers R4, R6. Cancel in each of the four dialogs closes it, and no product or sub-type changes.
- AE5. Covers R7, R8. In Edit product for a loaf with notes, pasting a Tesco page that has a new price and nutrition updates those fields. The notes stay, and the product isn't saved until Save.
- AE6. Covers R9. Pasting text that isn't a Tesco product shows a message, and the form keeps its values.
- AE7. Covers R11. Adding a `data-pp-click` button to a Pantry or Products template makes the test fail.

### Scope Boundaries

- Active Stock (the hidden tab, its add-stock button and use-up flags) is out of scope. Whether to restore it or delete it is a separate decision.
- Dead controls on other screens (Vault, Planner, Settings, Data Quality and the old `index.html` modals) are out of scope. The guard test doesn't cover them until their own clean-up.
- No new filtering or sorting is added to the working product list.
- The Tesco bookmarklet itself and the format it pastes are not changed.

### Dependencies / Assumptions

- The Tesco import dialog's review step already parses a pasted Tesco product and works today: its "Review" button is bound in `src/components/pantry/TescoImportModalUI.js`. R7 reuses that parsing.
- The existing-product picker's Confirm already works. Only its Cancel and the route into it are missing.
- Pre-linking a new product to a sub-type already exists for other entry points, through `window.__prefilledResolveBinding` and `window.__draftSubtypePayload`, which `saveManualIng` in `src/views/ProductBankView.js` reads.

### Outstanding Questions

**Deferred to Planning**

- The Link Product dialog exists twice, in `src/components/pantry/SubtypeProductLinkerModalUI.js` and in `src/components/pantry/TescoImportModalUI.js`. Planning decides which copy stays, and the other is removed with no visible change.
- Planning decides how the guard test tells a defined `window` function from a missing one, reusing the scan behind `~/PlatePlan-backups/dead-ui-actions-2026-10-29.md`.

### Sources / Research

- `~/PlatePlan-backups/dead-ui-actions-2026-10-29.md` (outside the repo): the original dead-controls list.
- `src/components/pantry/SubtypeProductLinkerModalUI.js` and `src/components/pantry/TescoImportModalUI.js`: `window.handleSubtypeLinkRoute` and `window.closeSubtypeActionModal` are called but never defined.
- `src/components/pantry/ReallocateProductModalRenderService.js`: Cancel calls `window.closeSubtypeActionModal`.
- `index.html` `view-bank`: the old filter block (`cat-filter`, `bank-family-search`, `bank-sort`, `bank-search`, `bank-list`) that nothing in `src/` references.
- `src/views/ProductBankView.js`: the edit form's "Paste/update from Tesco" calls `openTescoImportForIngredientEdit`, which nothing defines.
- PR #6 (3.48.1): fixed product Save and Cancel through the same ActionBridge routing this work uses.
