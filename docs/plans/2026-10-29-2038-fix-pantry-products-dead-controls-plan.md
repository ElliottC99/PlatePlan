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
- **Authority order:** the Product Contract, then this plan's Key Technical Decisions, then `CLAUDE.md`, `plateplan-architecture.md` and `workflow-enforcer.md`.
- **Stop conditions:** stop and ask if a control on these screens turns out to be used by another screen in a way the fix would break, or if the guard flags something in scope that this plan doesn't name.
- **Execution profile:** browser ES modules with no bundler. Routing and logic are tested as standalone Node scripts against a stub page and fake Firestore; the dialogs are checked by hand on both phones.
- **Who ships:** Barrie merges to `development` for the phone test, then releases to `main` as 3.49.0.
- **Open blockers:** None.

## Product Contract

### Summary

Product Contract preservation: changed R7 (bookmarklet output instead of a link or page text, user-approved during planning, 2026-10-29). Outstanding Questions answered in place.

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
- **The update reads the bookmarklet's output.** (session-settled: user-approved — chosen over also parsing copied Tesco page text: the app's only Tesco parser reads bookmarklet JSON, and a plain link can't be fetched from the browser.) Governs R7.
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

- R7. "Paste/update from Tesco" lets Elliott paste the Tesco bookmarklet's output into the open product form. The form's fields update from it, read by the app's Tesco parser (`parseTescoProduct`, as Data Quality's Tesco import uses).
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
- AE5. Covers R7, R8. In Edit product for a loaf with notes, pasting bookmarklet output that has a new price and nutrition updates those fields. The notes stay, and the product isn't saved until Save.
- AE6. Covers R9. Pasting text that isn't a Tesco product shows a message, and the form keeps its values.
- AE7. Covers R11. Adding a `data-pp-click` button to a Pantry or Products template makes the test fail.

### Scope Boundaries

- Active Stock (the hidden tab, its add-stock button and use-up flags) is out of scope. Whether to restore it or delete it is a separate decision.
- Dead controls on other screens (Vault, Planner, Settings, Data Quality and the old `index.html` modals) are out of scope. The guard test doesn't cover them until their own clean-up.
- No new filtering or sorting is added to the working product list.
- The Tesco bookmarklet itself and the format it pastes are not changed.

### Dependencies / Assumptions

- The Tesco import dialog's review step works today: its "Review" button is bound in `src/components/pantry/SubtypeProductLinkerModalUI.js`. It only checks the paste is valid JSON and passes the raw object to the product form. R7 uses `parseTescoProduct` instead.
- The existing-product picker's Confirm already works. Only its Cancel and the route into it are missing.
- Pre-linking a new product to a sub-type already exists for other entry points, through `window.__prefilledResolveBinding` and `window.__draftSubtypePayload`, which `saveManualIng` in `src/views/ProductBankView.js` reads.

### Outstanding Questions

Both planning questions are resolved:
- The duplicate dialog file is retired to `attic/` (KTD1).
- The guard is defined in KTD5 and built in U6.

### Sources / Research

- `~/PlatePlan-backups/dead-ui-actions-2026-10-29.md` (outside the repo): the original dead-controls list.
- `src/components/pantry/SubtypeProductLinkerModalUI.js` and `src/components/pantry/TescoImportModalUI.js`: `window.handleSubtypeLinkRoute` and `window.closeSubtypeActionModal` are called but never defined.
- `src/components/pantry/ReallocateProductModalRenderService.js`: Cancel calls `window.closeSubtypeActionModal`.
- `index.html` `view-bank`: the old filter block (`cat-filter`, `bank-family-search`, `bank-sort`, `bank-search`, `bank-list`) that nothing in `src/` references.
- `src/views/ProductBankView.js`: the edit form's "Paste/update from Tesco" calls `openTescoImportForIngredientEdit`, which nothing defines.
- PR #6 (3.48.1): fixed product Save and Cancel through the same ActionBridge routing this work uses.

## Planning Contract

### Key Technical Decisions

- KTD1. **One copy of the link and Tesco dialogs.** `src/components/pantry/SubtypeProductLinkerModalUI.js` stays. It's the newer copy: its Tesco Cancel is bound by ID and its product labels include the brand. `src/components/pantry/TescoImportModalUI.js` moves to `attic/` with a delete-after date. `AddToBankHubUI.js` and the `window.showTescoImport` hook in `src/main.js` import from the kept file instead. Governs R1–R6.
- KTD2. **Every fixed control is a named action routed in `ActionBridge.routeAction`.** This follows `CLAUDE.md` and the 3.48.1 fix. The new routes are `link-existing-product`, `link-manual-product`, `link-tesco-product`, `close-pantry-dialog` and `tesco-update`. The first three read the sub-type and parent from the button's `data-subtype-id` and `data-parent-id`. `tesco-import` already exists. Inline `onclick` and `window.X` calls in these dialogs are removed. Governs R1–R7.
- KTD3. **Import Tesco opens its dialog directly.** `ProductBankView.showTescoImport` imports `openTescoImportModal` from the kept file instead of calling `window.openTescoImportModal`. That `window` function only exists once a Pantry dialog has loaded the module, so on a fresh load the button did nothing. This also fixes the 3.48.1 empty-state button. Governs R5.
- KTD4. **The Tesco update is a paste box inside the product form.** The form and the other dialogs share `view-modal-content`, so opening the import dialog would lose unsaved edits. "Paste/update from Tesco" reveals a textarea and an "Update fields" button in the form. The pasted text goes through `parseTescoProduct` (`src/services/TescoImportService.js:138`) for its values. That parser fills every field with a default (0 for a missing nutrient, an inferred storage), so the decision about what was "carried" comes from the pasted JSON itself:
  - a top-level field is written only when the paste has that key with a non-empty value;
  - a nutrient is written only when `diagnostics.sourceValues` has a non-null value for it, or the paste has no `diagnostics` block;
  - storage is written only when `diagnostics.breadcrumbs` or `diagnostics.storageText` is non-empty.

  A failed or empty parse shows the parser's error and changes nothing. The form's existing `tescoData` prefill, used by Import from Tesco, stays as it is. Governs R7, R8, R9.
- KTD5. **A guard test over a fixed scope.** New `scripts/test_dead_controls.js` scans:
  - the `view-ingredients` and `view-bank` sections of `index.html`;
  - `src/views/PantryBankView.js`, `ProductBankView.js` and `ProductBankRenderService.js`;
  - every `src/components/pantry/*.js`, except the Active Stock and use-up files (`PantryInventory*`, `PantryStock*`, `UseUp*`).

  It fails on any of these:
  - a `data-pp-*` attribute;
  - an inline `on*=` handler calling a function nothing defines;
  - a `window.X(` or `typeof window.X` call for an undefined `X`;
  - a `data-action` value that neither `routeAction` nor a listener in the same scope handles.

  "Defined" means assigned to `window` anywhere in `src/`, or exported by a module that `componentRegistry` spreads onto `window`. Governs R11.

### Assumptions

- The Tesco import's review step and the existing-product picker's Confirm already work in the kept file. This plan only adds the routes into them and their Cancel.
- `saveManualIng` already stores a new product on the sub-type named by `window.__prefilledResolveBinding` (`ingredientId`, `subtypeId`, `parentCategory`), as the Tesco review step and Data Quality use it.

### Risks

- **Add to Bank › link existing passes swapped arguments.** `AddToBankHubUI.js:216` calls the picker with `(parentItemId, targetSubtypeId)`, but the signature is `(subtypeId, parentId)`, so the picker looks up the wrong item and sub-type. U1 fixes the call while it changes that import.
- **Other screens can call a removed `window` function.** Before retiring `TescoImportModalUI.js`, U1 searches `src/` and `index.html` for every name it puts on `window`, and keeps or repoints each one.

## Implementation Units

### U1. Keep one dialog file

- **Goal:** retire the duplicate `TescoImportModalUI.js` and point its callers at `SubtypeProductLinkerModalUI.js` (KTD1).
- **Requirements:** R1–R6; KTD1.
- **Dependencies:** none.
- **Files:** `src/components/pantry/TescoImportModalUI.js` → `attic/src/components/pantry/TescoImportModalUI.js`, `attic/README.md`, `src/components/pantry/AddToBankHubUI.js`, `src/main.js`, `LEDGER.md` (regenerated), `scripts/test_pantry_deletes.js`.
- **Approach:**
  1. Search for every name `TescoImportModalUI.js` exports or puts on `window`. Confirm the kept file provides each one under the same name.
  2. Repoint the imports in `AddToBankHubUI.js` and the `window.showTescoImport` hook in `src/main.js`.
  3. Fix the swapped arguments at `AddToBankHubUI.js:216`, and drop its re-render-only `onSuccess` callback. With a callback, the picker's Confirm returns before saving, so Add to Bank's link never saved. Its own save path already re-renders.
  4. Move the file to `attic/` with dated rows in `attic/README.md`, then run `npm run ledger`.
- **Test scenarios:**
  - Add to Bank's "link existing" path opens the picker with the chosen sub-type and its parent in the right argument order: the picker's title names the sub-type.
  - Confirming a product there writes it with that sub-type's `subtypeId` and its parent's `ingredientId`.
  - Nothing in `src/` imports `TescoImportModalUI.js` any more.
- **Verification:** the ledger lists the file under "In the attic", and the suite passes.

### U2. Link Product routes and dialog Cancels

- **Goal:** Link Product's three options and every Cancel in the link, picker, Tesco import and Reallocate dialogs work through named actions (KTD2).
- **Requirements:** R1, R2, R3, R4, R6; AE1–AE4.
- **Dependencies:** U1.
- **Files:** `src/components/pantry/SubtypeProductLinkerModalUI.js`, `src/components/pantry/ReallocateProductModalRenderService.js`, `src/services/ActionBridge.js`, `src/views/ProductBankView.js`, `scripts/test_pantry_deletes.js`.
- **Approach:**
  1. Replace the three `onclick="window.handleSubtypeLinkRoute(...)"` options with buttons carrying `data-action` plus `data-subtype-id` and `data-parent-id`.
  2. Replace every `window.closeSubtypeActionModal()` Cancel with `data-action="close-pantry-dialog"`.
  3. In `routeAction`:
     - `link-existing-product` opens the existing-product picker;
     - `link-manual-product` sets `window.__prefilledResolveBinding` to the sub-type, its parent and the parent's category, then opens the product form;
     - `link-tesco-product` opens the Tesco import for that sub-type;
     - `close-pantry-dialog` closes `view-modal-wrap`.

     The dialog module is imported dynamically, as the existing `ReorganiseModalUI` routes do.
  4. `cancelManualIng` clears `window.__prefilledResolveBinding`. Otherwise a cancelled Link Product › Add manually would pre-link the next unrelated new product to that sub-type.
- **Patterns to follow:** the `open-category-manager` and `delete-subtype` routes in `routeAction`; the 3.48.1 product-form tests.
- **Test scenarios:**
  - Covers AE1. Driving `link-existing-product` through `routeAction` opens the picker titled with the sub-type. Its Confirm (already bound) links the chosen product.
  - Covers AE2. `link-manual-product` opens the product form. Save then writes a product with that sub-type's `subtypeId` and its parent's `ingredientId`.
  - Covers AE3. `link-tesco-product` opens the Tesco import. Review with valid bookmarklet JSON opens the product form, and Save writes a product with that sub-type's `subtypeId` and its parent's `ingredientId`.
  - `link-manual-product`, then `cancel-manual-ing`, then `open-product-modal` and Save writes a product with no `subtypeId` or `ingredientId`.
  - Covers AE4. `close-pantry-dialog` closes the modal from each of the four dialogs, with nothing written.
- **Verification:** the tests pass, plus the phone checks.

### U3. Import Tesco from the header

- **Goal:** the Product Bank header's Import Tesco and the empty-state Import Tesco both open the Tesco import on a fresh load (KTD3).
- **Requirements:** R5.
- **Dependencies:** U1.
- **Files:** `index.html`, `src/views/ProductBankView.js`, `scripts/test_pantry_deletes.js`.
- **Approach:** change the header button to `data-action="tesco-import"`. Make `showTescoImport` dynamically import `openTescoImportModal` from the kept file and call it with no sub-type.
- **Test scenarios:**
  - With no `window.openTescoImportModal` defined, routing `tesco-import` opens the Tesco import. The 3.48.1 test stubbed that `window` function; it now runs without the stub.
- **Verification:** the test passes, plus the phone check.

### U4. Paste/update from Tesco

- **Goal:** the product form's "Paste/update from Tesco" fills the open form from bookmarklet output (KTD4).
- **Requirements:** R7, R8, R9; AE5, AE6.
- **Dependencies:** none.
- **Files:** `src/views/ProductBankView.js`, `src/services/ActionBridge.js`, `scripts/test_pantry_deletes.js`.
- **Approach:**
  1. The button becomes `data-action="tesco-update"`. It reveals a textarea and an "Update fields" button (`data-action="tesco-update-apply"`) inside the form, and focus moves to the textarea. Tapping it again hides the box.
  2. Apply writes into the form only the fields the paste carried, per KTD4: name, brand, price, pack, pack unit, nutrition, storage, item weight and drained weight. Notes, category and the product's links are never touched.
  3. After a good paste, the box closes and its text is cleared. A line under the button names what changed, such as "Updated: price, protein". It says "Nothing to update" when no field changed.
  4. An empty or failed paste shows the parser's error under the textarea, and the box stays open.
- **Test scenarios:**
  - Covers AE5. For a loaf with notes, pasting bookmarklet JSON with a new price and protein changes those inputs. Notes keep their value, and nothing is written to Firestore.
  - Covers AE6. Pasting text that isn't JSON shows the error, and every input keeps its value.
  - Fields missing from the payload, such as fibre, keep their current value. So does storage when the paste has no breadcrumbs.
  - After a good paste, the "Updated: …" line lists exactly the changed fields, and the box is closed.
  - An empty paste shows the error and changes nothing.
  - The Import from Tesco prefill, through Review and then the product form, still fills the form as before.
- **Verification:** the tests pass, plus the phone check.

### U5. Remove the old Product Bank block

- **Goal:** delete the unwired block under the product list, and the unused `data-pp-input` on the Pantry search (R10).
- **Requirements:** R10.
- **Dependencies:** none.
- **Files:** `index.html`.
- **Approach:**
  1. Remove the `cat-filter` chips, the `bank-family-search` and its datalist, `bank-sort`, `bank-search` and `bank-list` from `view-bank`.
  2. Remove `data-pp-input` from `#ingredient-group-search`. Its working listener in `PantryBankView.js` binds by ID.
  3. Confirm by search that nothing in `src/` references the removed IDs.
- **Test expectation:** covered by U6's guard: nothing in scope uses `data-pp-*` afterwards.
- **Verification:** the guard passes on these sections, plus the phone check that the Product Bank list and Pantry search still work.

### U6. Guard test for both screens

- **Goal:** `scripts/test_dead_controls.js` fails on any dead control in the Pantry and Products scope (KTD5).
- **Requirements:** R11; AE7.
- **Dependencies:** U1–U5 (the guard must pass once they land).
- **Files:** `scripts/test_dead_controls.js` (new).
- **Approach:** build the "defined" set from `window` assignments, `Object.assign(window, …)` keys and `componentRegistry` exports across `src/`. Collect the routed names by running `routeAction` with a stub page, plus the `action ===` and `case` literals of listeners in scope. Then scan the scope for the four failure kinds. Each failure prints its file, line and reason.
- **Execution note:** write the guard first and watch it fail on today's code with the dead controls named in the Problem Frame. Then let U1–U5 turn it green.
- **Test scenarios:**
  - Covers AE7. A fixture template string with `data-pp-click="x()"`, run through the guard's checker, is reported.
  - A fixture with `onclick="window.nope()"` is reported, and one with a defined `window` function isn't.
  - A fixture `data-action` that nothing routes is reported, and `data-action="tesco-import"` isn't.
  - On the real scope after U1–U5, the guard reports nothing.
- **Verification:** the guard fails on `main` and passes on the branch.

### U7. Release

- **Goal:** version 3.49.0, ledger current.
- **Requirements:** the whole plan.
- **Dependencies:** U1–U6.
- **Files:** `package.json`, `package-lock.json`, `LEDGER.md`.
- **Test expectation:** none -- version bump and regenerated ledger.
- **Verification:** the build stamps 3.49.0.

## Verification Contract

| Check | Command or action | Applies to |
|---|---|---|
| Dialog routes, Tesco import and update | `node scripts/test_pantry_deletes.js` | U1–U4 |
| Guard | `node scripts/test_dead_controls.js` | U5, U6 |
| Everything else unchanged | every `scripts/test_*.js` plus `test_vault_fit_score.js`; only `test_accessibility_dom`, `test_plan_generator` and `test_recipe_wizard` fail, as before | all |
| Build and ledger | `npm run build`, `npm run ledger`, `node scripts/test_ledger.js` | U1, U7 |
| Phones, from `development` | Pantry › sub-type › Link Product: each of the three routes, then Cancel. Product Bank header Import Tesco, then Cancel. Edit product › Paste/update from Tesco with bookmarklet output, then Save. Reallocate › Cancel. The Product Bank list and the Pantry search still work. Add to Bank › link existing | U1–U5 |

## Definition of Done

- Every unit's Verification holds, and the checks above pass apart from the three known failures.
- The guard reports nothing in its scope, and it fails if any dead control comes back.
- Both phones pass the checks in the Verification Contract on `development` before the release goes to `main`.
- No abandoned experimental code, debug logging or household data is in the diff.
